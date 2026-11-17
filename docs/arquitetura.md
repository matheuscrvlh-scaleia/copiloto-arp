# Arquitetura

Vale para todo o código do repositório. Quem cria ou mexe num módulo segue
este documento; quando ele não cobre um caso, o módulo de referência
(`calendario`) é o exemplo.

## Visão geral

```
navegador ─▶ nginx do host (HTTPS, arp.copiloto.scaleia.ai)
               └─ tudo ─▶ web (nginx + React estático, 127.0.0.1:8081 → 80)
                            ├─ /api/* ─▶ api (Fastify, api:3000 na rede do Docker)
                            └─ o resto: arquivos do build
api ─▶ db (Postgres 17, só na rede interna do Docker)
api ─▶ disco (/dados/arquivos: fotos, PDFs, planilhas)
api ─▶ sistemas externos (só leitura), pelas rotinas agendadas
```

Front e API saem da mesma origem: o cookie de sessão é `SameSite=Strict`
e não existe CORS. A API fica atrás de dois proxies (nginx do host → nginx
do `web`): ela só aceita `X-Forwarded-For`/`X-Forwarded-Proto` de loopback
e das redes privadas do Docker (`PROXIES_CONFIAVEIS`), e é daí que saem o IP
real (limite de tentativas, logs) e o protocolo. A porta `127.0.0.1:3001`
da API continua publicada só para diagnóstico direto no servidor.

## Repositório

```
docker-compose.yml        db, migrar (migrations), api e web
apps/
  api/                    Node 24 + Fastify 5 + TypeScript
    .env                  (fora do git; modelo em .env.example)
    Dockerfile
    db/migrations/        SQL numerado; nunca editar um já aplicado
    db/tests/             testes do RLS
    src/
      server.ts           sobe o processo (HTTP + rotinas agendadas)
      migrar.ts           comando das migrations (processo à parte)
      sincronizar.ts      comando que roda uma sincronização na hora
      app.ts              monta o Fastify (plugins + módulos)
      contexto.ts         quem fez o pedido; `pode` e `exigir`
      erros.ts            erros que o service lança
      config/             env validado com Zod
      infra/              banco, cofre, arquivos, agendador, eventos,
                          senhas, páginas, log
      http/               plugins: erros, segurança, sessão, permissão
      connectors/         sistemas externos (só leitura, sem Fastify)
      modules/index.ts    lista dos módulos (MODULOS), dos endereços fora
                          de /api/v1 (EXTERNOS) e das rotinas (ROTINAS)
      modules/<modulo>/   ver "Camadas"
    scripts/fumaca.ts     chama todas as rotas GET e mostra status e tempo
  web/                    React 19 + Vite + TypeScript + Tailwind 4
    .env                  (só VITE_*; nada secreto)
    Dockerfile, nginx.conf
    src/
      app/                roteador, provedores, casca (menu, barra)
      components/         UI compartilhada
      lib/                cliente da API, sessão, utilitários de tela
      modules/<modulo>/   páginas, componentes e chamadas do módulo
packages/
  shared/                 regras puras e contratos, usados pelos dois lados
    src/<modulo>/         cálculo, formato, validação (Zod), tipos
```

`packages/shared` não importa nada de Node, de React nem do banco. É o
único código que os dois lados compartilham. Só os testes dele usam Node
(`tsconfig.testes.json`; o `tsconfig.json` do pacote não tem os tipos de Node).

## Camadas da API (MVC)

Cada módulo em `apps/api/src/modules/<modulo>/` é dividido por recurso:

```
<modulo>/
  index.ts                 plugin Fastify do módulo: registra as rotas
  <recurso>.routes.ts      caminho, método, permissão, schema Zod → controller
  <recurso>.controller.ts  HTTP: lê a requisição validada, chama o service,
                           devolve a resposta. Sem regra e sem SQL.
  <recurso>.service.ts     caso de uso: regra de negócio, permissão fina,
                           transação, log. Sem `request`/`reply`.
  <recurso>.repository.ts  acesso ao banco (Kysely). Só consultas.
  jobs.ts                  rotinas agendadas do módulo (se houver)
```

A dependência só desce: routes → controller → service → repository. O
service recebe um `Contexto` (quem pediu) e nunca um objeto do Fastify. A
regra pura (cálculo, classificação, formatação) fica em `packages/shared`
e é chamada pelo service e pela tela. O passo a passo para portar um módulo
está em `docs/guia-de-modulo-api.md`; o módulo de referência da API é
`auth`.

Convenções:

- Rotas em `/api/v1/<modulo>/<recurso>`, substantivos no plural, em
  português, kebab-case. `GET` lê, `POST` cria ou executa, `PATCH` altera,
  `DELETE` remove.
- Endereço chamado por terceiro e que não pode mudar (volta de OAuth em
  `/api/integracoes/*`, contagem das câmeras em `/api/cameras`) fica fora de
  `/api/v1`: o plugin entra em `EXTERNOS` (`modules/index.ts`) com o caminho
  inteiro. Vale a mesma regra de declarar o acesso.
- Módulo grande divide o recurso em mais de um service
  (`<recurso>-acoes.service.ts`) e guarda o que é comum em `base.*` ou
  `apoio.ts`; a dependência continua só descendo.
- Toda entrada (params, query, body) tem schema Zod na rota. O schema e o
  tipo da resposta moram em `packages/shared/src/<modulo>/contratos.ts`
  quando a tela também usa.
- Toda rota declara o acesso: `{ acesso: "publico" }`, `{ acesso:
  "autenticado" }` ou `{ permissao: "os.acessar" }`. Rota sem declaração
  é negada (403) e o teste `rotas.test.ts` falha.
- Erros são lançados (`ErroDeNegocio`, `ErroDePermissao`,
  `ErroNaoEncontrado`, `ErroDeValidacao`); o plugin de erros converte.
  Controller não monta resposta de erro.

### Resposta

```
200/201  { ...dados }                         leitura ou gravação
200      { mensagem: "Salvo." }               gravação sem dado de volta
4xx/5xx  { erro: { codigo, mensagem, campos? } }
```

Erro de validação da rota: `campos` leva campo → mensagem, e `mensagem`
é a do primeiro campo, como `campo: mensagem`. As mensagens padrão do Zod
saem em português (`config/zod.ts`, carregado uma vez pelo `app.ts`);
quem valida no service e quer o rótulo da tela monta `Rótulo: mensagem`.

`mensagem` de erro é para a pessoa ler (português, sem detalhe técnico).
`codigo` é estável (`validacao`, `nao_autenticado`, `sem_permissao`,
`senha_provisoria`, `nao_encontrado`, `conflito`, `regra`, `limite`,
`interno`; lista em `@arp/shared/contratos/erro`). Erro 5xx nunca devolve
mensagem do banco nem stack.

## Banco

Postgres 17 próprio. O schema veio do Supabase (migration `0001_base.sql`)
com as mesmas tabelas, funções, gatilhos e **políticas de RLS**. A
segurança dos dados tem duas camadas: a permissão da rota e o RLS.

- A API conecta com o papel `arp_api`, que sozinho não lê nada
  (`NOINHERIT`). Toda consulta roda dentro de um dos escopos de
  `infra/banco`:

  | Escopo | Papel no Postgres | Quando |
  |---|---|---|
  | `banco.comoUsuario(usuarioId, fn)` | `authenticated` + `request.jwt.claims` | tudo o que é feito em nome de quem está logado. O RLS vale. |
  | `banco.comoServico(fn)` | `service_role` (ignora o RLS) | rotinas, sincronização, login, link público, e gravações que o RLS não cobre, **sempre depois** de conferir a permissão no service. |
  | `banco.comoAnonimo(fn)` | `anon` | o que o banco libera para visitante. |

  Cada escopo é uma transação (`set local role` + `set_config(...,
  true)`): tudo o que acontece dentro é atômico e o papel não vaza para a
  próxima requisição.
- `auth.uid()` devolve o usuário do escopo. As políticas usam `(select
  core.pode('...'))`, calculado uma vez por consulta.
- Mudança de schema: nova migration em `apps/api/db/migrations`. Tabela
  nova nasce com RLS e política. Nunca editar migration aplicada (o
  executor guarda o checksum em `infra.migracoes` e recusa).
- As migrations rodam por um comando à parte (`npm run db:migrar`; no
  Docker, o serviço `migrar`, que termina antes de a API subir), com a
  conexão de administrador (`DATABASE_ADMIN_URL`), uma transação por
  arquivo. O mesmo comando cria o papel `arp_api` se ele não existir. Banco
  clonado da produção: `npm run db:marcar-base` registra as migrations da
  base sem rodar. O processo que serve HTTP nunca roda migration nem recebe
  a conexão de administrador.
- Os valores saem do banco como o PostgREST entregava: `date` como texto
  (`"2026-11-16"`), `timestamptz` como ISO em UTC, `numeric` e `bigint`
  como número. A conexão usa o fuso UTC.
- Consulta com Kysely e os tipos gerados (`npm run db:tipos`). SQL cru só
  com `sql` do Kysely (parâmetros sempre vinculados; nunca concatenar).
- Lista grande pagina no banco. Filtro, ordenação e soma ficam no SQL.

## Sessão (cookie + JWT)

- `POST /api/v1/auth/entrar` confere a senha (argon2id; hashes bcrypt
  herdados são aceitos e trocados no primeiro acesso) e cria a sessão em
  `auth.sessoes`.
- Dois cookies `HttpOnly; Secure; SameSite=Strict`:
  - `__Host-arp_acesso`: JWT curto (10 min) com `sub` e `sid`.
  - `__Secure-arp_renovacao` (`Path=/api/v1/auth`): token opaco, guardado
    só como hash, trocado a cada uso; reuso de um token antigo encerra a
    sessão. Folga de 10 s para duas abas que renovam juntas: nesse intervalo
    o token anterior ainda rende um acesso novo (mas nenhum token novo).
  - Com `SITE_URL` em http (desenvolvimento local) os nomes saem sem
    prefixo e sem `Secure` (`arp_acesso`, `arp_renovacao`): o navegador
    recusaria os prefixos sem HTTPS. Em https, sempre com.
- A cada requisição a API valida o JWT e lê o usuário e as permissões no
  banco (sem cache: quem perde o acesso perde na hora).
- Limites: 8 h de sessão e 30 min sem uso (`packages/shared/src/sessao`).
  Só `POST /api/v1/auth/uso` (que a tela chama quando a pessoa mexe) e o
  login contam como uso: consultas automáticas não prolongam a sessão.
- Login: mensagem única para e-mail inexistente, senha errada e usuário
  inativo ou bloqueado; depois de `LOGIN_TENTATIVAS` erros do mesmo e-mail
  e IP em `LOGIN_JANELA_MINUTOS` (contados em `core.logs`), bloqueia.
- Gravações exigem o cabeçalho `X-ARP: 1` e `Origin` do próprio site
  (defesa extra contra CSRF, além do `SameSite`). Única exceção: o envio de
  arquivo por link assinado (`PUT /api/v1/arquivos/<token>`), que vale pelo
  token.
- Senha provisória: enquanto estiver marcada, a API só aceita trocar a
  senha e sair.
- Reuso de token de renovação fica no log do processo e em `core.logs`
  (evento `sessao_reusada`, em Administração › Histórico).
- Links públicos (portal, ordem, ficha, censo, responder, vistoria) não
  usam a sessão: valem pelo token do link, conferido no service.
- Portal do lojista: tem sessão própria, sem relação com a dos usuários.
  Cookie `__Secure-arp_portal` (`arp_portal` em http), `SameSite=Lax` (o
  lojista chega por link do WhatsApp), só no caminho
  `/api/v1/os/portal-publico`; o valor é `<token>.<HMAC>` com chave
  derivada de `JWT_CHAVE`, e o banco guarda só o SHA-256 do token
  (`modules/os/portal-cookie.ts`). O plugin de permissão nunca lê esse cookie.
- Autorização OAuth das integrações (Google, YouTube, RD Station, RD
  Station CRM, TikTok): a volta vem de outro site, sem os cookies da sessão
  (`SameSite=Strict`). O `state` (e o verificador do PKCE, no Google) vai
  num cookie `SameSite=Lax`, `HttpOnly`, de poucos minutos, só no caminho do
  retorno, junto com quem começou (cifrado com a chave do cofre e preso ao
  `state`); na volta a permissão dessa pessoa é conferida de novo no banco.

## Segurança

- Entrada validada com Zod em toda rota; saída só com os campos da tela.
- `@fastify/helmet`, limite de requisições (mais rígido em login e em
  toda rota pública), corpo limitado (1 MiB; arquivo vai por link de envio
  ou formulário com limite próprio), `trustProxy` só para os dois nginx
  (loopback e redes privadas do Docker).
- Segredos só no `.env` da API. O front não recebe segredo algum.
- Credenciais das integrações cifradas (AES-256-GCM, `INTEGRACOES_CHAVE`).
- Arquivos: só por `infra/arquivos`; para o navegador, link assinado
  (HMAC, com prazo). Conferir a permissão antes de assinar.
- Contêineres sem root, sistema de arquivos só leitura, portas publicadas
  só em `127.0.0.1`, banco sem porta publicada.
- Log estruturado (pino) sem senha, token, cookie ou dado pessoal.
- Auditoria de linhas pelo gatilho do banco (`core.auditoria`); eventos
  do sistema em `core.logs` (`infra/eventos`).

## Rotinas agendadas

O agendador roda dentro da API (`infra/agendador`), com trava no banco
(`pg_try_advisory_lock`) para nunca rodar em dobro: se a mesma rotina ainda
está rodando (aqui ou em outra instância), a nova execução é pulada. Cada
módulo declara as suas em `modules/<modulo>/jobs.ts` (uma lista de
`Rotina`: nome, cron, `executar`) e `modules/index.ts` as junta em
`ROTINAS`, que o `server.ts` entrega ao agendador. Horários em UTC, os
mesmos de antes. Toda execução fica em `integracao.sync_runs` ou em
`core.logs`. `AGENDADOR=0` desliga.

| Rotina | Cron (UTC) | Brasília |
|---|---|---|
| `marketing.aquecer-madrugada` | `10 3 * * *` | 00h10 |
| `sync.secullum` | `0 9 * * *` | 06h00 |
| `sync.rd-station` | `15 9 * * *` | 06h15 |
| `sync.rd-crm` | `20 9 * * *` | 06h20 |
| `sync.copiloto-rh` | `30 9 * * *` | 06h30 |
| `sync.meta` | `45 9 * * *` | 06h45 |
| `sync.wps` | `0 10 * * *` | 07h00 |
| `os.rotinas` | `30 10 * * *` | 07h30 |
| `sustentabilidade.rotinas` | `40 10 * * *` | 07h40 |
| `marketing.aquecer-manha` | `50 10 * * *` | 07h50 |
| `comercial.rotinas` | `0 11 * * *` | 08h00 |
| `sync.diario-de-obras` | `*/30 * * * *` | a cada 30 min |

- Rodar uma sincronização na hora, fora do agendador (o que antes era
  chamar `/api/sync/*`): `node dist/sincronizar.js <nome> [argumentos]` no
  contêiner da API (`npm run sincronizar -w @arp/api -- <nome>` em
  desenvolvimento). Segue as mesmas travas e registra em
  `integracao.sync_runs`. Os nomes e argumentos estão em `src/sincronizar.ts`.
- Desligamento (SIGTERM): o agendador para de disparar, a API fecha as
  conexões e espera o que já começou (rotinas, avisos dos chamados,
  registros de eventos) por até 12 s; o `stop_grace_period` do compose é
  15 s. Rotina cortada solta a trava com a conexão e roda no próximo horário.

### Leituras ao vivo do Marketing

Meta, Google, Asana, a agenda do site e o benchmark são lidos da ferramenta
na hora em que a tela abre e guardados na **memória do processo**
(`modules/marketing/memoria.ts`, o `use cache` do sistema antigo): uma hora
quando deu certo, segundos quando falhou. Quem salva, testa ou sincroniza a
integração chama `esquecerLeituras(tag)`. As rotinas `marketing.aquecer-*`
refazem as leituras do dia antes de o time chegar. A memória é por
processo: reiniciar a API esvazia, e duas instâncias não a dividem.

## Front

- Rotas com React Router; cada módulo exporta as suas em
  `modules/<modulo>/rotas.tsx`, carregadas sob demanda (`lazy`).
- Dados com TanStack Query. Cada módulo tem `api.ts` com as chamadas
  tipadas (contratos de `@arp/shared`) e as chaves de consulta. Página lê
  com `useSuspenseQuery` dentro de `<Suspense>` com esqueleto; gravação
  com `useMutation`, que invalida as chaves do que mudou.
- Nenhum `fetch` solto: tudo por `lib/api.ts` (cookies, cabeçalho `X-ARP`,
  renovação da sessão, erro padronizado).
- A tela esconde o que a pessoa não pode usar (`usePermissao`), mas quem
  garante é a API.
- Biblioteca pesada (planilha, PDF, gráfico, arrastar) entra por
  `import()` na hora do uso.
- Componentes de UI compartilhados em `src/components`; do módulo, em
  `modules/<modulo>/components`.

## Qualidade

- TypeScript estrito nos três pacotes; sem `any` e sem `as` para calar o
  compilador.
- Biome (lint e formatação) e Vitest. `npm run check` e `npm test` na raiz
  rodam tudo e precisam passar antes de publicar.
- Regra pura tem teste em `packages/shared`. Service com regra de
  permissão tem teste. O RLS tem teste em `apps/api/db/tests`. Os testes de
  integração da API usam o banco de homologação (`apps/api/.env` e
  `.env.teste`) e são pulados, com aviso, se ele não estiver acessível.
- Conferência de fumaça: `apps/api/scripts/fumaca.ts` entra com um usuário e
  chama todas as rotas `GET` sem parâmetro (menos as que chamam sistema
  externo), mostrando só rota, status e tempo. Qualquer 5xx é defeito.
- Nada de valor de negócio fixo no código (metas, encargos, faixas): é
  parâmetro no banco.
- Nunca dados reais de clientes, funcionários ou credenciais no repo.
