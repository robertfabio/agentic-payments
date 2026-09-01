# Fluxo de trabalho

Git Flow, com os nomes que o time já vinha usando.

## Os branches

| Branch      | Para que serve                                         |
| ----------- | ------------------------------------------------------ |
| `main`      | O que está pronto para entregar. Só recebe release.    |
| `develop`   | Onde as partes se integram. É daqui que sai o próximo. |
| `feature/*` | Uma parte por branch. Sai de `develop`, volta pra lá.  |
| `release/*` | Congela o que vai entrar. Sai de `develop`.            |
| `hotfix/*`  | Correção urgente. Sai de `main`.                       |

## Começando uma parte nova

```bash
git checkout develop && git pull
git checkout -b feature/sua-parte
```

Trabalhe, commite, e quando terminar:

```bash
git checkout develop && git pull
git merge feature/sua-parte
```

Ou abra PR de `feature/sua-parte` → `develop`, que é melhor quando a mudança
encosta em código de outra pessoa.

## Fechando uma entrega

```bash
git checkout -b release/1.0.0 develop
# só correção de bug aqui, nada de feature nova

git checkout main && git merge release/1.0.0
git tag -a v1.0.0 -m "Entrega do desafio"

git checkout develop && git merge release/1.0.0
```

## Antes de mergear qualquer coisa

```bash
npm test            # 87 testes, não precisa de chave de API
npm run typecheck
npm run lint
npm run e2e:ui      # navegador de verdade, precisa da chave
```

## Sobre os commits

Um commit, uma mudança. Se a mensagem precisa de "e" no meio ("adiciona X e
corrige Y"), provavelmente são dois commits.

O corpo da mensagem explica **por que**, não o que. O diff já mostra o que
mudou. Exemplo do histórico:

```
fix: aquece o cliente mcp na subida do backend

O spawn do `npx tsx` leva uns 20s na primeira vez. Pagando isso dentro
da primeira mensagem do usuario, o request chega a estourar o timeout
de 60s do cliente MCP.
```

Prefixos em uso: `feat`, `fix`, `test`, `docs`, `chore`, `style`, `refactor`.

## Uma armadilha que já nos pegou

Se você começou sua branch antes de uma mudança no `shared/src/contracts.ts`,
rebaseie antes de escrever mais código. Foi o que gerou o conflito no
`Chat.tsx`: a branch do frontend ainda mandava o histórico inteiro pro
`/api/chat` depois que o contrato passou a ser `message` + `conversa_id`.

```bash
git checkout feature/sua-parte
git rebase develop
```
