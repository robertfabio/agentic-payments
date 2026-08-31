# Contexto de build: a raiz do repositorio.
# Carrega o mcp-server junto porque o backend o sobe como processo filho.
FROM node:22-alpine

WORKDIR /app

# Manifests primeiro para reaproveitar a camada de instalacao.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY mcp-server/package.json mcp-server/
COPY frontend/package.json frontend/

# Sem --omit=dev: o tsx, que executa o TypeScript, e devDependency da raiz.
RUN npm ci

COPY tsconfig.base.json ./
COPY shared/ shared/
COPY backend/ backend/
COPY mcp-server/ mcp-server/

ENV NODE_ENV=production
ENV PORT=3001

# Evita o npx, que custava ~20s resolvendo o pacote no primeiro spawn.
ENV MCP_SERVER_COMMAND=tsx

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=3s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "start", "-w", "backend"]
