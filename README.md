# Agentic Payments

Um chatbot que conversa com um LLM e consegue comprar de verdade — bom, comprar
de mentira, mas com todas as regras de uma compra de verdade.

## O desafio

A ideia é simples de descrever e chata de fazer direito: o usuário entra, pede
alguma coisa em português normal ("quero um fone"), e o agente resolve o resto.
Ele lista o catálogo, registra a intenção de compra, pergunta se é cartão ou
pix, e paga.

O detalhe é que o modelo não pode ser confiável. Ele inventa coisa. Se alguém
pedir pra ele ignorar o limite de gasto, ou se ele simplesmente alucinar um
número de intenção que nunca existiu, o pagamento tem que ser recusado do mesmo
jeito. Quem decide se a compra acontece é o servidor, nunca o LLM.

São três ferramentas, expostas via MCP:

- **listar_catalogo** — mostra o que tem à venda
- **registrar_intencao** — reserva a intenção de comprar e devolve um id
- **realizar_compra** — paga, a partir de um id que já existe

O valor nunca é argumento de `realizar_compra`. Ele vem da intenção que o
servidor guardou. Assim o modelo não consegue mudar o preço nem que queira.

E `realizar_compra` precisa recusar em cinco situações: id inventado, id de
outro usuário, intenção já paga, intenção vencida, e valor acima do limite.

## Rodando

Com Docker, que e o caminho mais previsivel:

```bash
cp .env.example .env     # preencha a NVIDIA_API_KEY e troque o JWT_SECRET
docker compose up --build
```

Frontend em http://localhost:8080, backend em http://localhost:3001.

Ou direto na maquina:

```bash
npm install
cp .env.example .env
npm run dev
```

Backend na 3001, frontend na 5173. O servidor MCP sobe sozinho junto com o
backend — se quiser rodar ele isolado pra debugar, `npm run dev:mcp`.

Você vai precisar de uma chave da NVIDIA NIM (é grátis, pega em
build.nvidia.com) e joga no `.env`. Se preferir rodar local com Ollama, é só
trocar a `NVIDIA_BASE_URL`.

Modelo padrão: `nvidia/nemotron-3-nano-30b-a3b`.

O `meta/llama-3.3-70b-instruct` que estava aqui antes foi aposentado pela NVIDIA
em 26/08/2026 e agora devolve 410. Se você trocar de modelo, confira antes que
ele faz tool calling — boa parte do catálogo da NIM não faz, e sem isso o agente
não sai do lugar.

## Usuários pra testar

| usuário | senha    | limite   |
| ------- | -------- | -------- |
| alice   | alice123 | R$ 5.000 |
| bob     | bob123   | R$ 200   |

O bob existe pra ficar fácil de testar o limite estourando. Com R$ 200 ele
compra o cabo mas não compra o fone.

Para entender o projeto sem ler o código, comece por
[docs/como-funciona.md](docs/como-funciona.md): explica o caminho de uma compra,
por que o modelo não consegue trapacear e como testar cada recusa.

## Como está organizado

```
shared/       contratos que todo mundo importa
backend/      login, o agente, e o cliente MCP
mcp-server/   as três tools
frontend/     as duas telas
```

O `shared/src/contracts.ts` é o combinado do time. Se você precisar mudar
alguma coisa lá, avisa os outros antes de mergear, porque as três partes
dependem dele.

As rotas:

```
POST   /auth/register  →  cria usuario e ja devolve a sessao
POST   /auth/login    →  access token + refresh token
POST   /auth/refresh  →  troca o refresh por um par novo
POST   /auth/logout   →  encerra a sessao (precisa do token)
GET    /auth/me       →  usuario atual (precisa do token)
POST   /api/chat      →  precisa do token
DELETE /api/chat/:id  →  precisa do token
GET    /api/auditoria →  log das tools chamadas (precisa do token)
```

O access vale 15 minutos e o refresh 7 dias. O refresh fica guardado no
servidor e rotaciona a cada uso: reapresentar o antigo nao funciona. O logout
revoga tambem o access atual, que sendo stateless continuaria valendo ate
expirar. O frontend renova sozinho quando leva 401, entao ninguem cai para a
tela de login no meio de uma compra.

O registro valida com zod (usuario de 3 a 32 caracteres, senha de 8+). O limite
de gasto de um usuario novo vem do servidor (`LIMITE_PADRAO`), nunca do request.

Backend e servidor MCP leem o mesmo arquivo de usuarios, porque rodam em
processos separados: sem isso, um usuario criado no backend nao existiria para
as tools e toda compra seria recusada.

As senhas do seed sao hash scrypt, nunca texto puro — as credenciais da tabela
acima continuam valendo.

O `/api/chat` recebe só a mensagem nova mais um `conversa_id`, e devolve a
conversa inteira, incluindo as chamadas de ferramenta e o que elas responderam.
O histórico fica no servidor: o cliente não consegue forjar uma resposta de
ferramenta nem injetar uma mensagem `system`. A system prompt é montada a cada
chamada e nunca é devolvida ao frontend.

## Estado atual

As três partes estão integradas na `feature/backend`:

```
feature/mcp-payments    as três tools        pronto, merjado
feature/frontend        as telas             pronto, merjado
feature/backend         o laço do agente     pronto
```

O merge do frontend teve conflito no `Chat.tsx`: as duas branches saíram do
mesmo commit e a do frontend ainda mandava o histórico inteiro pro `/api/chat`.
Ficou com o contrato novo, mantendo o loading e o tratamento de erro que vieram
de lá.

Testes:

```bash
npm test        # 69 testes, não precisa de chave de API
npm run typecheck
npm run lint
npm run e2e:ui   # navegador de verdade, precisa da chave da NVIDIA
```

O agente é testado contra um servidor que finge ser a API da OpenAI
(`tests/helpers.ts`), com as respostas roteirizadas. O laço roda de verdade
contra o servidor MCP de verdade — o que é falso é só o modelo. Dá pra cobrir
compra aprovada, `intencao_id` alucinado, limite estourado, intenção expirada e
o modelo tentando trocar o `usuario_id`, tudo sem rede.

Cada chamada de ferramenta fica registrada com quem, quando, quanto e qual foi o
resultado. `GET /api/auditoria` devolve os registros do próprio usuário, e
`AUDIT_LOG_FILE` no `.env` grava também em JSONL no disco.

## O que precisa entregar

Print de uma compra no cartão, print de uma no pix, print de uma recusada por
limite, e print de uma recusada por id inválido.
