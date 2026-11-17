# SDD: ARP Centralizador

Documento de design do software. Resume **como** o sistema é construído e
**por quê**. O que o produto faz está no [PRD](prd.md). As regras de código
em detalhe estão em [arquitetura.md](arquitetura.md), e o passo a passo de um
módulo em [guia-de-modulo-api.md](guia-de-modulo-api.md) e
[guia-de-modulo-web.md](guia-de-modulo-web.md). Quando este documento e a
arquitetura divergirem, vale a arquitetura.

## 1. Contexto

```
navegador ─▶ nginx do host (HTTPS)
               └─▶ web (nginx + React estático)
                     ├─ /api/* ─▶ api (Node 24 + Fastify 5)
                     │              ├─▶ db (Postgres 17, rede interna)
                     │              ├─▶ disco (/dados/arquivos)
                     │              └─▶ sistemas externos (só leitura)
                     └─ o resto: arquivos do build
```

Tudo roda numa VPS com Docker Compose: `db`, `migrar` (roda as migrations e
termina), `api` e `web`. Só `web` e `api` publicam porta, e só em
`127.0.0.1`; o banco fica numa rede sem saída.

## 2. Decisões

| Decisão | Por quê | Descartado |
|---|---|---|
| Postgres próprio com o schema e o RLS do Supabase | Mantém as regras de acesso já testadas em produção e tira a dependência do Supabase | Reescrever o acesso só na API (perderia a segunda camada) |
| API Fastify + Kysely + Zod | Tipos de ponta a ponta, SQL explícito, validação de toda entrada | ORM com migrations geradas (o schema já existia em SQL) |
| Camadas routes → controller → service → repository | Regra testável sem HTTP; SQL num lugar só | Lógica nas rotas |
| `packages/shared` puro (sem Node, React ou banco), uma cópia por app | Mesma regra e mesmo contrato na tela e na API; cada app instala, testa e gera imagem sozinho | Workspace npm na raiz (acoplava os apps); pacote publicado (custo de versão) |
| Mesma origem para tela e API | Cookie `SameSite=Strict`, sem CORS | API em subdomínio |
| JWT curto (10 min) + token de renovação opaco, trocado a cada uso | Sessão revogável no banco; reuso do token denuncia roubo | JWT longo; sessão só em memória |
| Permissões lidas do banco a cada pedido | Quem perde o acesso perde na hora | Permissões dentro do JWT |
| Agendador dentro da API com trava no banco | Uma peça a menos para operar; nunca roda em dobro | Cron do host ou fila externa |
| Arquivos no disco com link assinado (HMAC, prazo) | Simples de operar e de fazer backup | Armazenamento de objetos (S3) |
| Leituras ao vivo do Marketing em memória do processo | Meta e Google são lentos; 1 h de validade basta para a tela | Cache compartilhado (Redis) |

## 3. Componentes

### 3.1 web (`apps/web`)

React 19, Vite, React Router, TanStack Query, Tailwind 4. Build estático
servido pelo nginx do contêiner, que também repassa `/api/` para a API.

- Cada módulo declara as telas em `modules/<modulo>/rotas.tsx`, carregadas
  sob demanda; biblioteca pesada (planilha, PDF, gráfico) por `import()`.
- Dados só por `lib/api.ts` (cookie, cabeçalho `X-ARP`, renovação da
  sessão, erro padronizado) e TanStack Query; gravação invalida as chaves
  do que mudou.
- Aba aberta durante deploy recarrega uma vez quando um arquivo da versão
  anterior some (`lib/versao-nova.ts`).

### 3.2 api (`apps/api`)

Node 24, Fastify 5. Um processo serve o HTTP e roda as rotinas; as
migrations e as sincronizações manuais são comandos à parte
(`dist/migrar.js`, `dist/sincronizar.js`) da mesma imagem.

```
src/
  app.ts, server.ts      monta o Fastify; sobe HTTP + agendador
  http/                  plugins: erros, segurança, sessão, permissão
  infra/                 banco, cofre, arquivos, agendador, eventos, log
  connectors/            clientes dos sistemas externos (só leitura)
  modules/<modulo>/      routes, controller, service, repository, jobs
```

- Toda rota declara o acesso (`publico`, `autenticado` ou uma
  permissão); rota sem declaração é negada e um teste falha.
- O service recebe um `Contexto` (quem pediu) e lança erros tipados; o
  plugin de erros converte para `{ erro: { codigo, mensagem, campos? } }`.
- Rotas em `/api/v1/<modulo>/<recurso>`. Endereços chamados por terceiros
  (volta de OAuth, contagem das câmeras) ficam fora de `/api/v1`.

### 3.3 shared (`apps/*/packages/shared`)

Regras puras (cálculo, classificação, formato), schemas Zod dos contratos
e dos sistemas externos, tipos. Importado como `@arp/shared/...` pelo alias
do tsconfig e do Vite/Vitest. As cópias da API e do web são idênticas; o
teste `copia-identica.test.ts` falha se divergirem.

### 3.4 db

Postgres 17. Schemas por domínio: `auth`, `core`, `rh`, `financeiro`,
`comercial`, `marketing`, `os`, `operacoes`, `sustentabilidade`,
`calendario`, `formularios`, `integracao` e `infra`.

## 4. Dados e acesso

A segurança dos dados tem duas camadas: a permissão da rota e o RLS do
banco. A API conecta com um papel (`arp_api`) que sozinho não lê nada; toda
consulta roda num escopo, que é uma transação:

| Escopo | Papel | Uso |
|---|---|---|
| `comoUsuario(id, fn)` | `authenticated` | Tudo o que é feito em nome de quem está logado; o RLS vale |
| `comoServico(fn)` | `service_role` | Rotinas, login, links públicos; só depois de `exigir(ctx, permissao)` no service |
| `comoAnonimo(fn)` | `anon` | O que o banco libera a visitante |

- Políticas com `(select core.pode('...'))`, calculado uma vez por
  consulta.
- Migrations SQL numeradas, uma transação por arquivo, com checksum (não se
  edita migration aplicada). Tabela nova nasce com RLS, política e teste
  em `apps/api/db/tests`.
- Auditoria de linhas por gatilho (`core.auditoria`); eventos do sistema
  em `core.logs`; execuções das rotinas em `integracao.sync_runs`.
- Valores de negócio (metas, encargos, faixas) são parâmetros no banco.

## 5. Sessão e segurança

- Senha com argon2id (hashes bcrypt herdados são trocados no primeiro
  acesso). Bloqueio por e-mail e IP depois de `LOGIN_TENTATIVAS` erros.
- Cookies `HttpOnly; Secure; SameSite=Strict`: acesso (JWT de 10 min) e
  renovação (token opaco guardado como hash, trocado a cada uso; reuso
  encerra a sessão). Limite de 8 h e 30 min sem uso.
- Gravação exige `X-ARP: 1` e `Origin` do próprio site.
- Links públicos valem pelo token, conferido no service. O portal do
  lojista tem sessão própria (`SameSite=Lax`, cookie com HMAC).
- OAuth das integrações: `state` e PKCE num cookie curto, preso a quem
  começou; a permissão é conferida de novo na volta.
- Helmet, limite de requisições (mais rígido em login e rotas públicas),
  corpo até 1 MiB, `trustProxy` só para os dois nginx.
- Credenciais das integrações cifradas com AES-256-GCM
  (`INTEGRACOES_CHAVE`, a mesma do sistema anterior).
- Contêineres sem root e com sistema de arquivos só leitura.

Detalhes e achados em [revisao-de-seguranca.md](revisao-de-seguranca.md).

## 6. Integrações e rotinas

- Conectores em `apps/api/src/connectors`: não importam Fastify, só leem,
  passam toda resposta por schema Zod e respeitam o limite de cada
  serviço (espera em 429, timeout curto nos serviços públicos). Testes
  usam respostas montadas, nunca o sistema de verdade.
- O agendador (`infra/agendador`) dispara as rotinas de cada módulo
  (`jobs.ts`) com `pg_try_advisory_lock`: se a mesma rotina ainda roda, a
  nova é pulada. Horários em UTC; tabela completa no README.
- `marketing.aquecer-manha` também roda na subida da API, para encher a
  memória das leituras ao vivo.
- No desligamento (SIGTERM) a API para de disparar rotinas e espera o que
  já começou por até 12 s.

## 7. Implantação

| Serviço | Imagem | Observações |
|---|---|---|
| `db` | postgres:17-alpine | Volume `db`; só rede interna; sem porta publicada |
| `migrar` | a da API | `node dist/migrar.js`; a API só sobe depois dele |
| `api` | `apps/api/Dockerfile` | Porta `127.0.0.1:3001` para diagnóstico; volume dos arquivos |
| `web` | `apps/web/Dockerfile` | nginx sem root; `127.0.0.1:8081`, para onde o nginx do host aponta |

- Cada Dockerfile usa a pasta do app como contexto (`docker build
  apps/api`).
- Deploy: `git pull && docker compose up -d --build`. Conferência:
  `docker compose ps`, logs da API e a fumaça.
- Backup: `pg_dump` do banco, `tar` da pasta de arquivos e cópia do
  `apps/api/.env`, guardados fora da VPS.

## 8. Observabilidade

- Log estruturado (pino) sem senha, token, cookie ou dado pessoal.
- Healthcheck da API (`/api/v1/saude`, confere o banco) e do web.
- `core.logs` (eventos, tentativas de login, reuso de sessão; em
  Administração › Histórico) e `integracao.sync_runs` (cada
  sincronização).
- Conferência de fumaça: chama toda rota `GET` sem parâmetro e mostra
  rota, status e tempo; qualquer 5xx é defeito.

## 9. Qualidade

- TypeScript estrito (sem `any`, sem `as` para calar o compilador), Biome e
  Vitest. Antes de concluir: `npm run check` e `npm test` em `apps/api` e
  em `apps/web`.
- Testes do shared (regra pura), da API (unidade e integração contra o
  banco de homologação, pulados se ele não responder), do RLS e do web
  (Testing Library).

## 10. Riscos e limites

| Risco | Efeito | Mitigação |
|---|---|---|
| Uma VPS só | Parada da máquina derruba o sistema | Backup fora da VPS; serviços com reinício automático |
| Memória das leituras ao vivo é por processo | Com mais de uma instância da API, cada uma lê de novo | Hoje roda uma instância; Redis se isso mudar |
| Duas cópias do shared | Contrato diferente entre tela e API | `copia-identica.test.ts` |
| Perda da `INTEGRACOES_CHAVE` | Credenciais das integrações não abrem | Cópia do `.env` junto com o backup |
| Homologação é clone da produção | Dado real em ambiente de teste | Testes com usuários próprios (`.env.teste`); nenhum dado real copiado para o repo |
| API externa muda o formato | Sincronização falha | Schema Zod recusa e a falha fica em `sync_runs`; o que já foi sincronizado continua no banco |
