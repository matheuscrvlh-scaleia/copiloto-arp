# syntax=docker/dockerfile:1
#
# Imagem da API (Node 24 + Fastify). O contexto do build é a RAIZ do
# repositório (npm workspaces):
#   docker build -f apps/api/Dockerfile .
#
# A mesma imagem serve o HTTP (`node dist/server.js`, o padrão) e roda as
# migrations (`node dist/migrar.js`, serviço `migrar` do compose).

# --- 1. Build ---------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /repo

# Só os manifestos primeiro: a camada do `npm ci` é reaproveitada enquanto
# as dependências não mudarem.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

RUN npm ci --workspace @arp/api --workspace @arp/shared \
      --include-workspace-root --no-audit --no-fund

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api

# dist/server.js e dist/migrar.js, com @arp/shared dentro.
RUN npm run build --workspace @arp/api

# --- 2. Dependências de produção --------------------------------------------
FROM node:24-alpine AS producao
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

# Sem devDependencies. O mkdir garante a pasta mesmo quando o npm põe tudo
# na raiz (o COPY do estágio final falharia se ela não existisse).
RUN npm ci --workspace @arp/api --omit=dev --no-audit --no-fund \
 && mkdir -p apps/api/node_modules \
 && npm cache clean --force

# --- 3. Execução ------------------------------------------------------------
FROM node:24-alpine

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    ARQUIVOS_DIR=/dados/arquivos

# Mesma árvore do repositório: o Node acha as dependências em
# /app/node_modules subindo a partir de /app/apps/api.
WORKDIR /app/apps/api
COPY --from=producao /repo/node_modules /app/node_modules
COPY --from=producao /repo/apps/api/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY apps/api/package.json ./
COPY apps/api/db/migrations ./db/migrations

# Pasta dos arquivos (o compose monta o volume aqui), já do usuário sem root.
RUN mkdir -p /dados/arquivos && chown node:node /dados/arquivos

# Usuário `node` (uid 1000) da imagem oficial: nada roda como root.
USER node
EXPOSE 3000

# Sem wget/curl: o próprio Node pergunta à rota de saúde (que confere o banco).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/v1/saude').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]

CMD ["node", "dist/server.js"]
