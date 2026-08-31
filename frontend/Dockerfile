# Imagem do frontend. Contexto de build: a raiz do repositorio.
#
#   docker build -f frontend/Dockerfile -t agentic-frontend .
#
# Duas etapas: o Vite gera os arquivos estaticos, o nginx serve. A imagem final
# nao carrega Node nem node_modules.
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY mcp-server/package.json mcp-server/
COPY frontend/package.json frontend/
RUN npm ci

COPY tsconfig.base.json ./
COPY shared/ shared/
COPY frontend/ frontend/

# O Vite injeta isso no bundle em tempo de build, nao de execucao: trocar a URL
# da API depois exige rebuildar a imagem.
ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build -w frontend

FROM nginx:alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
