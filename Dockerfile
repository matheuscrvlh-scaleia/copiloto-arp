# syntax=docker/dockerfile:1.7
# Imagem de produção do sistema (Next em modo standalone). Como subir e
# atualizar: docs/deploy-vps.md. Construída pelo docker compose, que passa o
# .env como segredo do build (não fica em nenhuma camada da imagem).

FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Dependências, numa camada própria: só refaz quando o package-lock muda.
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# O .env entra só durante o build: o Next embute as NEXT_PUBLIC_* no
# JavaScript do navegador e algumas telas pré-renderizadas leem o banco.
RUN --mount=type=secret,id=env,target=/app/.env.production.local,required=true \
    --mount=type=cache,target=/app/.next/cache \
    npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    ARQUIVOS_DIR=/dados/arquivos
# Usuário sem privilégio (uid 1001): a pasta dos arquivos no servidor precisa
# ser dele (sudo chown -R 1001:1001 <pasta>).
RUN addgroup -S -g 1001 nodejs \
 && adduser -S -u 1001 -G nodejs nextjs \
 && mkdir -p /dados/arquivos \
 && chown -R nextjs:nodejs /dados
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/scripts/migrar-arquivos.mjs ./scripts/
USER nextjs
EXPOSE 3000
VOLUME ["/dados/arquivos"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/saude || exit 1
CMD ["node", "server.js"]
