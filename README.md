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

Modelo padrão: `meta/llama-3.3-70b-instruct`.

## Usuários pra testar

| usuário | senha    | limite   |
| ------- | -------- | -------- |
| alice   | alice123 | R$ 5.000 |
| bob     | bob123   | R$ 200   |

O bob existe pra ficar fácil de testar o limite estourando. Com R$ 200 ele
compra o cabo mas não compra o fone.

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

Duas rotas, só:

```
POST /auth/login   →  token
POST /api/chat     →  precisa do token
```

O `/api/chat` manda e recebe a conversa inteira toda vez, incluindo as chamadas
de ferramenta e o que elas responderam. O desafio pede isso.

## Estado atual

Isso aqui é só a fundação: as pastas, os contratos e a configuração. As tools
estão registradas mas ainda não fazem nada, o agente é um stub, e o frontend
não tem CSS. É de propósito — cada um implementa a sua parte na sua branch.

```
feature/mcp-payments    as três tools        mcp-server/src/tools/
feature/agent-backend   o laço do agente     backend/src/agent/
feature/frontend        as telas             frontend/src/
```

Pra começar:

```bash
git checkout main && git pull
git checkout -b feature/sua-parte
```

## O que precisa entregar

Print de uma compra no cartão, print de uma no pix, print de uma recusada por
limite, e print de uma recusada por id inválido.
