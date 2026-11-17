# ARP Centralizador

Sistema web da ARP Empreendimentos Imobiliários (Espaço ARP, Nova Friburgo-RJ).
Junta num lugar só os dados que estavam espalhados entre o ENET, o ponto, a
folha, o estacionamento e as planilhas, e calcula os indicadores que a equipe
montava à mão.

Este repositório é a reescrita do sistema (antes Next.js + Supabase) em API
Fastify + front React + Postgres próprio, com as mesmas telas, endereços e
regras.

## Módulos

- **Gestão**: visão da diretoria, com os indicadores dos outros módulos.
- **RH**: custo de pessoal, quadro e turnover, jornada e banco de horas,
  funcionários, orçamento, folha e benefícios.
- **Financeiro**: inadimplência, faturamento, contas a pagar, fluxo de caixa,
  plano orçamentário e Performance & Capital.
- **Tickets** (`os`): chamados entre setores, lojistas e terceirizados, ordens
  de serviço com tempo e custo, ativos, vistorias com laudo, portal do
  lojista e painéis por setor.
- **Marketing**: base da marca, anúncios, site e leads, redes, reputação,
  radar do Asana, fluxo do estacionamento e painel semanal.
- **Comercial**: painel, funil, ocupação, vencimentos, relacionamento, Censo,
  contratos e distratos, ficha cadastral, kit, eventos e pesquisa de mercado.
- **Operações**: água, energia, limpeza e obras, com as importações.
- **Sustentabilidade**: entrevistas, Clube, programas com link do parceiro,
  rondas, RCC e painel.
- **Calendário**: agenda da empresa, com quem vê cada item.
- **Relatórios**: formulários e relatórios com link público.
- **Administração**: usuários, cargos e permissões, empresa, integrações,
  histórico e configurações (IA).
- **IA ARP**: assistente no cabeçalho de toda tela. Responde sobre os dados
  que a pessoa já pode ver, lendo as mesmas telas com as mesmas permissões;
  liberada por cargo ou pessoa (`ia.usar`), com limites de tokens, teto de
  gasto e painel de uso em Administração › Configurações › IA.

## Stack

- **API**: Node 24, Fastify 5, TypeScript, Kysely, Zod.
- **Front**: React 19, Vite, React Router, TanStack Query, Tailwind 4.
- **Banco**: Postgres 17, com RLS (as políticas vieram do sistema antigo).
- **Arquivos**: no disco do servidor, por link assinado.
- **Qualidade**: TypeScript estrito, Biome, Vitest.
- **Publicação**: Docker Compose na VPS, atrás do nginx do host.

## Estrutura

```
docker-compose.yml   db, migrar (migrations), api e web
apps/api             API (src/), migrations (db/migrations), scripts
apps/web             front (src/), nginx.conf do contêiner
apps/*/packages/shared  regras puras e contratos (Zod), uma cópia por app
docs/                arquitetura e guias
```

Cada app é independente: tem o seu `package.json`, `package-lock.json`,
`node_modules`, `tsconfig.json`, `biome.json`, `.dockerignore` e Dockerfile
(o contexto do build é a pasta do app). A raiz não tem `package.json`.

`packages/shared` existe nos dois apps, igual. Mudou um arquivo, copie para
o outro: o teste `copia-identica.test.ts` falha enquanto as cópias forem
diferentes.

Como o código é organizado, sessão, segurança e rotinas:
[docs/arquitetura.md](docs/arquitetura.md). Passo a passo de um módulo:
[docs/guia-de-modulo-api.md](docs/guia-de-modulo-api.md) e
[docs/guia-de-modulo-web.md](docs/guia-de-modulo-web.md).

## Desenvolvimento

Precisa de Node 24 e de um Postgres 17 acessível.

```
cd apps/api && npm install && cd ../web && npm install && cd ../..
cp apps/api/.env.example apps/api/.env     # preencha (ver "Variáveis")
cp apps/web/.env.example apps/web/.env
cd apps/api && npm run db:migrar           # cria o papel arp_api e o schema
npm run dev                                # (apps/api) API em 127.0.0.1:3000
npm run dev                                # (apps/web) tela em localhost:5173 (/api → API)
```

Com `SITE_URL=http://localhost:5173` os cookies saem sem `Secure`, para o
navegador aceitar sem HTTPS.

Antes de concluir qualquer mudança, em `apps/api` e em `apps/web`:

```
npm run check     # biome + typecheck (do app e do seu packages/shared)
npm test          # vitest do app e do seu packages/shared
npm run build     # api (tsup) ou web (vite)
```

Os testes de integração da API usam o banco de `apps/api/.env` e os usuários
de `apps/api/.env.teste` (`TESTE_EMAIL`, `TESTE_EMAIL_SEM_ACESSO`,
`TESTE_SENHA`); sem banco acessível eles são pulados, com aviso. Nunca
aponte os testes para a produção.

Conferência de fumaça (entra e chama todas as rotas `GET` sem parâmetro,
menos as que chamam sistema externo; mostra só rota, status e tempo):

```
cd apps/api
npx tsx --env-file=.env --env-file=.env.teste scripts/fumaca.ts
```

Aceita `BASE_URL`, `FUMACA_EMAIL`, `FUMACA_SENHA`, `FUMACA_ORIGEM` e
`FUMACA_ROTAS` (ver o cabeçalho do arquivo, com o uso no servidor).

## Variáveis

Todas em `apps/api/.env` (modelo comentado em `apps/api/.env.example`; o
arquivo de verdade fica fora do git). O front não recebe segredo:
`apps/web/.env` só existe porque o compose o referencia.

| Variável | Para quê |
|---|---|
| `NODE_ENV`, `HOST`, `PORT`, `LOG_LEVEL` | processo da API |
| `SITE_URL` | endereço público (https em produção): origem aceita nas gravações e base dos links |
| `AGENDADOR` | `0` desliga as rotinas agendadas |
| `PROXIES_CONFIAVEIS` | de quem a API aceita `X-Forwarded-*` (o padrão cobre os dois nginx) |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | contêiner `db` |
| `DATABASE_URL` | conexão da API (papel `arp_api`) |
| `DATABASE_ADMIN_URL` | só migrations; o compose a apaga no serviço `api` |
| `BANCO_CONEXOES` | tamanho do pool |
| `JWT_CHAVE` | assina o acesso; trocar encerra a sessão de todos |
| `INTEGRACOES_CHAVE` | cofre das credenciais das integrações; **a mesma do sistema anterior** |
| `ARQUIVOS_CHAVE` | assina os links de arquivo |
| `ARQUIVOS_DIR` | pasta dos arquivos dentro do contêiner |
| `LOGIN_TENTATIVAS`, `LOGIN_JANELA_MINUTOS` | bloqueio do login |
| `ARQUIVOS_HOST_DIR` (ambiente do compose) | pasta dos arquivos no host (padrão `./dados/arquivos`) |

## Deploy

Na VPS, na pasta do repositório:

```
git pull && docker compose up -d --build
```

O serviço `migrar` roda as migrations pendentes e termina; a `api` só sobe
depois dele, e o `web` só depois de a `api` responder. Só `web`
(`127.0.0.1:8081`) e `api` (`127.0.0.1:3001`, para diagnóstico) publicam
porta; o nginx do host faz o HTTPS e manda tudo para o `web`.

Primeira subida: crie a pasta dos arquivos com o dono certo
(`mkdir -p dados/arquivos && chown -R 1000:1000 dados/arquivos`).

Conferir depois de subir: `docker compose ps` (tudo `healthy`),
`docker compose logs --tail 50 api` e a conferência de fumaça contra
`http://127.0.0.1:3001`.

## Migrations

- Arquivos SQL numerados em `apps/api/db/migrations`. Nunca edite um já
  aplicado: o executor guarda o checksum em `infra.migracoes` e recusa.
- Mudança de schema: arquivo novo, com RLS e política na tabela nova e teste
  em `apps/api/db/tests`.
- Rodar: `npm run db:migrar` (em `apps/api`) em desenvolvimento; no servidor o
  `docker compose up` já roda (`docker compose run --rm migrar` para rodar
  só elas).
- Banco clonado da produção antiga: `npm run db:marcar-base` (em `apps/api`)
  registra as migrations da base sem rodar.
- Tipos do Kysely: `npm run db:tipos` (em `apps/api`).

## Rotinas agendadas

Rodam dentro da API, com trava no banco (nunca em dobro). Horários em UTC
(Brasília = UTC−3). `AGENDADOR=0` desliga.

| Rotina | Cron (UTC) | Brasília | O que faz |
|---|---|---|---|
| `marketing.aquecer-madrugada` | `10 3 * * *` | 00h10 | relê Meta e Google do dia |
| `sync.secullum` | `0 9 * * *` | 06h00 | ponto |
| `sync.rd-station` | `15 9 * * *` | 06h15 | leads |
| `sync.rd-crm` | `20 9 * * *` | 06h20 | funil |
| `sync.copiloto-rh` | `30 9 * * *` | 06h30 | Copiloto RH |
| `sync.meta` | `45 9 * * *` | 06h45 | anúncios |
| `sync.wps` | `0 10 * * *` | 07h00 | estacionamento |
| `sync.growatt` | `10 10 * * *` | 07h10 | geração da usina solar (Growatt), últimos 8 dias |
| `os.rotinas` | `30 10 * * *` | 07h30 | lembretes e prazos dos chamados |
| `sustentabilidade.rotinas` | `40 10 * * *` | 07h40 | entrevistas, termo do Clube e cobrança dos parceiros |
| `marketing.aquecer-manha` | `50 10 * * *` | 07h50 | relê Meta e Google do dia |
| `comercial.rotinas` | `0 11 * * *` | 08h00 | rotinas do Comercial |
| `ia.limpeza` | `50 6 * * *` | 03h50 | apaga conversas da IA além do prazo de guarda |
| `sync.diario-de-obras` | `*/30 * * * *` | a cada 30 min | Diário de Obras |

Rodar uma sincronização na hora:

```
docker compose exec api node dist/sincronizar.js secullum 2026-09
docker compose exec api node dist/sincronizar.js wps 2026-09-01 2026-09-30
docker compose exec api node dist/sincronizar.js growatt 2023-03-16 2026-11-17
docker compose exec api node dist/sincronizar.js rd-station   # ou rd-crm, copiloto-rh, meta, diario-de-obras
```

## Backup

Dois lugares guardam dados: o banco (volume `db`) e a pasta dos arquivos.

Banco, pelo contêiner `db` (formato custom, comprimido):

```
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > ~/backup-arp/arp-$(date +%F).dump
```

Arquivos (a pasta de `ARQUIVOS_HOST_DIR`, padrão `./dados/arquivos`):

```
tar -czf ~/backup-arp/arquivos-$(date +%F).tar.gz -C dados arquivos
```

Guarde os dois fora da VPS, junto com uma cópia do `apps/api/.env`: sem a
`INTEGRACOES_CHAVE` as credenciais das integrações não abrem.

Restaurar o banco (com a API parada):

```
docker compose stop api web
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' \
  < ~/backup-arp/arp-AAAA-MM-DD.dump
docker compose up -d
```
