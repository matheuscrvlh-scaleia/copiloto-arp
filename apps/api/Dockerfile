# syntax=docker/dockerfile:1
#
# Imagem da API (Node 24 + Fastify). O contexto do build é a pasta do app:
#   docker build apps/api
#
# A mesma imagem serve o HTTP (`node dist/server.js`, o padrão) e roda as
# migrations (`node dist/migrar.js`, serviço `migrar` do compose).

# --- 1. Build ---------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app

# Só os manifestos primeiro: a camada do `npm ci` é reaproveitada enquanto
# as dependências não mudarem.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# dist/server.js e dist/migrar.js, com packages/shared dentro.
RUN npm run build

# --- 2. Dependências de produção --------------------------------------------
FROM node:24-alpine AS producao
WORKDIR /app

COPY package.json package-lock.json ./

# Sem devDependencies.
RUN npm ci --omit=dev --no-audit --no-fund \
 && npm cache clean --force

# --- 3. Execução ------------------------------------------------------------
FROM node:24-alpine

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    ARQUIVOS_DIR=/dados/arquivos

WORKDIR /app
COPY --from=producao /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY db/migrations ./db/migrations

# Pasta dos arquivos (o compose monta o volume aqui), já do usuário sem root.
RUN mkdir -p /dados/arquivos && chown node:node /dados/arquivos

# Usuário `node` (uid 1000) da imagem oficial: nada roda como root.
USER node
EXPOSE 3000

# Sem wget/curl: o próprio Node pergunta à rota de saúde (que confere o banco).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/v1/saude').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]

CMD ["node", "dist/server.js"]
