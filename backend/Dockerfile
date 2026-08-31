# Imagem do backend. Contexto de build: a raiz do repositorio.
#
#   docker build -f backend/Dockerfile -t agentic-backend .
#
# O backend sobe o servidor MCP como processo filho, entao a imagem precisa
# carregar tambem o workspace mcp-server e o shared.
FROM node:22-alpine

WORKDIR /app

# Os manifests primeiro: enquanto eles nao mudam, o Docker reaproveita a
# camada de instalacao e o build fica rapido.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY mcp-server/package.json mcp-server/
COPY frontend/package.json frontend/

# Sem --omit=dev de proposito: o `tsx`, que executa o TypeScript direto, e uma
# devDependency da raiz e e o que roda o backend e o servidor MCP.
RUN npm ci

COPY tsconfig.base.json ./
COPY shared/ shared/
COPY backend/ backend/
COPY mcp-server/ mcp-server/

ENV NODE_ENV=production
ENV PORT=3001

# Sem isso o cliente MCP chamaria `npx`, que resolve o pacote a cada spawn e
# leva uns 20s na primeira vez. Dentro da imagem o tsx ja esta instalado, e o
# npm run coloca node_modules/.bin no PATH do processo filho.
ENV MCP_SERVER_COMMAND=tsx

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=3s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "start", "-w", "backend"]
