# syntax=docker/dockerfile:1
#
# Imagem do front (React estático servido por nginx).
# O contexto do build é a RAIZ do repositório (npm workspaces):
#   docker build -f apps/web/Dockerfile .
#
# As variáveis VITE_* entram no JavaScript na hora do build. Hoje a tela não
# usa nenhuma (fala com a API pela mesma origem); se um dia usar, ela chega
# aqui por `build.args` no compose, não pelo `env_file` (que só vale com o
# contêiner já rodando, quando o JavaScript já está pronto).

# --- 1. Dependências e build ------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /repo

# Só os manifestos primeiro: a camada do `npm ci` é reaproveitada enquanto
# as dependências não mudarem.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

# Instala só o que o front usa (o workspace web, o shared e a raiz). Sem
# scripts de instalação: nada do que o build usa depende deles.
RUN npm ci --workspace @arp/web --workspace @arp/shared \
      --include-workspace-root --ignore-scripts --no-audit --no-fund

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web

RUN npm run build --workspace @arp/web

# --- 2. Servidor ------------------------------------------------------------
# nginx oficial na variante sem root: o processo roda como o usuário 101.
FROM nginxinc/nginx-unprivileged:1.31-alpine

# Porta interna 80 sem root: desde o Docker 20.10 todo contêiner nasce com
# net.ipv4.ip_unprivileged_port_start=0, então o usuário 101 abre a 80 sem
# capacidade nenhuma (funciona com `cap_drop: ALL` e `no-new-privileges`).
# Não se usa setcap no binário nem root "só para abrir a porta".
COPY apps/web/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html

USER 101
EXPOSE 80

# Sistema de arquivos só leitura: o nginx escreve só em /tmp (pid e
# temporários), que o compose monta como tmpfs.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/saude-web || exit 1

# Direto no nginx, sem os scripts de entrada da imagem (eles editam a
# configuração padrão, que aqui não existe e não pode ser escrita).
ENTRYPOINT []
CMD ["nginx", "-g", "daemon off;"]
