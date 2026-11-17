# Auditoria de paridade: sistema antigo × reescrita

Data: 16/11/2026. Somente leitura nos dois repositórios.

- Antigo: `repos/ARP/copiloto-arp`, `main` local em `c1b50f5`. **A produção roda
  `origin/main` (`35c1d40`), que tem mais 4 commits.** Veja a seção 0.
- Novo: `Desktop/copiloto-arp`, `69a6695`, sem mudanças locais.

Como foi feito: scripts Node com a AST do TypeScript. Eles listaram as telas,
as ações, os route handlers, as leituras, os componentes e os testes dos dois
lados. Seguiram as chamadas pelos imports (antigo: ação → helpers; novo:
rota → controller → service) para juntar as permissões e o cliente usado
(`createClient`/`createAdminClient` × `comoUsuario`/`comoServico`). Depois
conferi à mão cada divergência que os scripts apontaram. Os falsos positivos
foram descartados e não aparecem aqui.

Gravidade: **B** = bloqueia a virada · **C** = corrigir antes · **D** = pode
ficar para depois.

## Totais conferidos

| Categoria | Antigo | Com equivalente no novo | Achados |
|---|---|---|---|
| Telas (`page.tsx`) | 169 (main) + 20 novas e 3 alteradas só em produção | 169 / 169 com a mesma URL; 0 / 20 | 20 telas novas e 3 alteradas de produção (seção 0) |
| Layouts com lógica | 16 (6 com abas, 1 com botão fixo) | 16 / 16 | 0 |
| Redirects (`next.config.ts`) | 13 regras | 13 / 13 (`app/redirecionamentos.tsx`) | 0 |
| `proxy.ts` (rotas públicas) | 11 prefixos livres | 11 / 11 | `parceiro/` só em produção |
| Ações `"use server"` | 352 em 64 arquivos (main) | 352 / 352 (291 pelo nome, 61 renomeadas e conferidas à mão) | 0 com permissão mais fraca; mensagens (seção 7) |
| Route Handlers | 40 (main) + 2 só em produção | 40 / 40 | 2 de endereço (seção 2) + 2 de produção |
| Cron (`deploy/cron/crontab`) | 11 linhas (main) + 1 em produção | 11 / 11 com o mesmo horário UTC | 1 (Sustentabilidade, 10:40) |
| Leituras que tocam o banco (`src/server`, não ação) | 517 | 380 pelo nome + 137 renomeadas (cobertas pelas rotas) | 0 vazamentos |
| Rotas da API | — | 566 (323 com permissão, 201 autenticadas, 42 públicas) | 0 rotas `comoServico` sem conferência indevida |
| Menu (`navigation.ts`) | 580 linhas | idêntico (itens, ordem, permissões) | falta a seção Sustentabilidade de produção |
| Componentes (`src/components`) | 338 arquivos | 337 com as mesmas exportações; 1 substituído de propósito (`shell/secoes.ts`) | 0 |
| `data-guia` | 163 âncoras | 163 / 163 | 0 |
| Regras (`src/lib`) | 1631 exportações | 1627 (as 4 que faltam são da sessão antiga, trocada de propósito) | 0 |
| Testes unitários | 153 arquivos | 147 completos (pelos títulos), 4 parciais, 2 sem par | 6 (seção 8) |
| `supabase/tests` | 30 (main) + 2 novos e 1 alterado em produção | 30 / 30 com arquivo em `apps/api/db/tests/memoria` (outro agente está portando) | 3 de produção |

## 0. Produção está à frente do repositório portado (bloqueia)

`origin/main` tem 4 commits de 16/11 que não estão no `main` local, ponto de
partida do porte: `a04c16e`, `8f5481f`, `9d7c914` e `35c1d40`. O diff tem 247
arquivos e +59.835 linhas.

As migrations desses commits **já estão** no banco novo: `0001_base.sql` é um
dump da produção e tem o schema `sustentabilidade`, `os.travar_destino_externo`
etc. **O código que usa esse banco não está no novo.** O
`admin/catalogo.test.ts` do novo já registra isso ("ainda não foi portado").

| Achado | Antigo (`origin/main`) | Onde deveria estar no novo | Grav. |
|---|---|---|---|
| Módulo Sustentabilidade inteiro: 19 telas internas | `src/app/(app)/sustentabilidade/**` (clube, contribuições, coletores, importações, parâmetros, entrevistas, questionário, respostas, programas, RCC, rondas) | `apps/web/src/modules/sustentabilidade/rotas.tsx` + `apps/api/src/modules/sustentabilidade` | B |
| Ações e leituras do módulo: 12 arquivos `"use server"` e ~140 funções exportadas | `src/server/sustentabilidade/**` (34 arquivos) | `apps/api/src/modules/sustentabilidade/*.routes.ts` | B |
| Regras puras: 75 arquivos | `src/lib/sustentabilidade/**` | `packages/shared/src/sustentabilidade` | B |
| Componentes: 46 arquivos | `src/components/sustentabilidade/**` | `apps/web/src/modules/sustentabilidade/components` | B |
| Tela pública do parceiro dos programas | `src/app/parceiro/[token]/{page,layout,area}.tsx` e `parceiro/` livre no `proxy.ts` | rota pública `parceiro/:token` + rota `publico` da API | B |
| Relatório mensal (route handler) | `src/app/(app)/sustentabilidade/relatorio/[mes]/route.ts` | rota GET da API que devolve o arquivo | B |
| Rotina diária | `api/cron/sustentabilidade` às `40 10 * * *` UTC | `modules/sustentabilidade/jobs.ts` + `ROTINAS` | B |
| Permissões: `sustentabilidade.*` (18 chaves) + `sustentabilidade.programa.<id>` dinâmica | `src/lib/permissions.ts` (+63 linhas) | `packages/shared/src/permissions.ts` | B |
| Seção do menu e ícones | `src/config/navigation.ts` (+86), `components/shell/{icones,secoes}.ts` | `apps/web/src/config/navigation.ts`, `app/shell` | B |
| Tickets: "módulos externos" (chamado de outro módulo, destino travado, avisos) | `src/server/os/{sistema.ts (novo, 178 l.), criar.ts, chamados.ts, rotinas/recorrencias.ts, acoes/notificacoes.ts, acoes/portal.ts}`, `components/os/chamado/detalhe.tsx`, `components/os/portal/form-loja.tsx`, `lib/os/{chamado,rotulos}.ts` + migration `20261116120000_os_modulos_externos.sql` (gatilhos já no banco novo) | `apps/api/src/modules/os/*`, `apps/web/src/modules/os/*`, `packages/shared/src/os` | B |
| Admin › Usuários e Cargos: grupos de permissão | `components/admin/{grupos-permissao.ts (novo), permissoes.tsx}`, `app/(app)/admin/usuarios/{[id],cargos}`, `server/admin/{acoes/usuarios.ts, dados.ts}` | `apps/web/src/modules/admin`, `apps/api/src/modules/admin` | B |
| Assinatura (vistoria por link e ordem) | `components/assinatura.tsx` (+251), `app/vistoria/[token]/assinar.tsx`, `app/ordem/[token]/page.tsx` | `apps/web/src/components`, `modules/os/paginas/publico` | C |
| Operações: agregação por mês e solar | `lib/operacoes/{por-mes.ts (novo), solar.ts}` | `packages/shared/src/operacoes` | C |
| Núcleo: `auth.ts`, `cache.ts`, `lib/historico.ts`, `arquivos/caminho.ts`, `preferencias/filtros.ts`, `components/dashboard/tela.tsx`, guias (`config/guias/{index,tipos,trilhas}.ts`) | diffs pequenos (1 a 102 linhas) | equivalentes no novo | C |
| Testes de RLS de produção | `supabase/tests/{sustentabilidade, sustentabilidade-chamados}.test.ts` (novos), `os.test.ts` (+171) | `apps/api/db/tests` | C |

**Recomendação:** antes de tudo, fixe a base do porte em `origin/main`. Depois
porte o diff `c1b50f5..35c1d40` como mais um pedaço.

## 1. Telas

As 169 telas do `main` têm rota no novo com a mesma URL, públicas incluídas
(`portal`, `ordem`, `ficha`, `censo`, `responder`, `vistoria`, `login`,
`trocar-senha`). Nenhuma permissão divergente.

- Em 9 telas o antigo conferia permissões a mais dentro da `page.tsx`: `/gestao`,
  `/rh`, `/rh/jornada`, `/rh/jornada/banco-de-horas`, `/rh/custo-de-pessoal`,
  `/rh/funcionarios/:id`, `/rh/configuracoes/importacoes`, `/os/ordens` e
  `/os/calendario`. Essas permissões são `rh.custo_pessoal.individual`,
  `rh.parametros`, `os.custos`, `os.exportar` e `os.meu_setor`. No novo, a
  mesma conferência está no service da API, que devolve os flags e omite os
  dados. Conferido.
- 9 endereços de arquivo do antigo (route handlers de PDF) viraram telas do
  novo que chamam a API. A URL é a mesma. Não é achado.

## 2. Route Handlers e endereços externos

| Achado | Antigo | Onde deveria estar no novo | Grav. |
|---|---|---|---|
| Links de arquivo já enviados quebram. O laudo da vistoria vai por WhatsApp/e-mail com validade de **7 dias** (`DIAS_DO_LINK`). O formato do token e a `ARQUIVOS_CHAVE` são os mesmos, mas o caminho mudou de `/api/arquivos/<token>` para `/api/v1/arquivos/<token>`. Os links enviados nos 7 dias antes da virada dariam 404. | `src/app/api/arquivos/[token]/route.ts` (GET/PUT), `server/arquivos/index.ts:102` | alias `GET /api/arquivos/:token` em `EXTERNOS` (`apps/api/src/modules/index.ts`), apontando para o mesmo controller. Acrescentar o caminho à lista "Endereços que não podem mudar" de `docs/porte.md` | C |
| Saúde mudou de `/api/saude` para `/api/v1/saude` (e o web tem `/saude-web`). Só importa se algum monitor externo usa o caminho antigo. | `src/app/api/saude/route.ts` | alias ou conferir o monitor | D |

As outras rotas foram conferidas, com a permissão equivalente:
- 21 PDFs/planilhas.
- 4 retornos de OAuth em `/api/integracoes/...`.
- `/api/cameras/contagem`.
- `/api/sessao`, que virou `/api/v1/auth/uso`.
- 10 `/api/sync|cron/*`, que viraram `jobs.ts` com o mesmo cron UTC. As
  rotinas internas de `os.rotinas` (aceite, recorrências, modelos,
  preventivas, cobrança), `comercial.rotinas` (foto da ocupação, aniversários,
  kit) e `marketing` (aquecer Meta e Google) são as mesmas.

## 3. Ações (Server Actions)

Nenhuma ação sem rota. Nenhuma permissão mais fraca.

As 61 ações renomeadas foram conferidas à mão. Exemplos:
- `definirSenha` → `POST /auth/trocar-senha`
- `criar/duplicar/excluirFormulario` → `/relatorios` com `pode("formularios.editar")` no service
- `recalcularCustos` → `exigirAlguma(["rh.folha","rh.parametros"])`, como o antigo (basta uma)
- importações do Comercial → `/importacoes/:tipo/*` com `podeImportar` por tipo
- água, contas e leituras → `operacoes.agua.importar`

Também não há chamada de conferência assíncrona sem `await`: as 13 chamadas
sem `await` são de funções síncronas.

## 4. Leituras: escopo do cliente

- Nenhum caso de sessão/RLS no antigo virando `comoServico` no novo sem
  conferência antes. Cobertura: 100% de `os`, `rh`, `admin` e `acesso`, mais
  o resto, pelo nome e pelas rotas.
- 207 rotas não públicas usam `comoServico` em algum ponto. Todas conferem
  antes uma permissão, `chamadoParaEditar` ou a leitura com RLS. As exceções
  são as mesmas do antigo: `auth/uso`, `auth/trocar-senha` e as consultas de
  CEP/CNPJ.
- 18 rotas `autenticado` não conferem nada no service. Todas leem ou gravam
  com `comoUsuario`, como o antigo: notificações, filtros lembrados, empresa
  para o painel, concluir item do calendário, desfazer saída via RPC.

## 5. Menu e navegação

`apps/web/src/config/navigation.ts` é idêntico ao do `main` (580 linhas) em
itens, ordem e permissões. **Falta a seção Sustentabilidade** de produção
(seção 0).

## 6. Componentes

Sem achados além da seção 0.

## 7. Mensagens que mudaram

Nenhuma mensagem de tela some. Só um caso aparece para quem não tem a
permissão e chega a chamar a ação (a tela esconde o botão).

| Achado | Antigo | Novo | Grav. |
|---|---|---|---|
| Mensagens de permissão específicas viraram o 403 genérico da rota: "Você não tem permissão para editar a empresa.", "...gerenciar usuários.", "...gerenciar o portal.", "...configurar as agendas.", "...lançar gastos do RH.", "Você não tem acesso ao módulo." | `server/admin/acoes/{empresa,usuarios}.ts`, `os/acoes/{portal,visoes}.ts`, `rh/acoes/orcamento.ts` | `ErroDePermissao(mensagem)` no service ou mensagem na rota | D |
| ~25 mensagens de entrada adulterada ("Usuário inválido.", "Vistoria inválida.", "Ciclo inválido."…) viraram o erro de validação do Zod | ações de `admin`, `comercial`, `operacoes`, `os`, `rh` | — (não aparece no uso normal) | D |
| "Senha fraca: use letras, números e símbolos." (recusa do Supabase Auth) não existe mais. Hoje vale só o mínimo de 10 caracteres, que é o mesmo do antigo. Conferir se a produção do Supabase tinha alguma regra extra de senha (a `config.toml` local não tem). | `server/acesso/acoes/trocar-senha.ts:53`, `admin/acoes/usuarios.ts:75` | `auth.service.ts` | D |

## 8. Testes

| Achado | Antigo | Novo | Grav. |
|---|---|---|---|
| Sem par | `src/server/marketing/conexoes.test.ts` (3 casos: teste por produto, sem id não chama a API) | `apps/api/src/modules/admin` ou `marketing` (`conexoes.ts`) | D |
| Sem par (a paginação do PostgREST foi trocada por SQL) | `src/server/supabase-paginas.test.ts` (8) | `infra/paginas.ts` | D |
| Parcial | `src/config/guias/guias.test.ts` (8/9), `src/lib/sessao.test.ts` (5/7, sessão trocada), `src/server/env.test.ts` (0/2), `src/server/operacoes/importacoes.test.ts` (0/3: filtro por sha256) | mesmos nomes no novo | D |
| Fixture do conector ausente | `src/connectors/diario-de-obras/__fixtures__/relatorio.json` | `apps/api/src/connectors/diario-de-obras` | D |

`supabase/tests`: os 30 do `main` têm arquivo com o mesmo nome em
`apps/api/db/tests/memoria/`. Ainda faltam os 3 de produção (seção 0).

## 9. Efeitos inevitáveis da virada (avisar o cliente)

- Todos saem e entram de novo: as sessões do Supabase e o cookie da loja no
  portal (`SESSAO_CHAVE`) não valem no novo. As senhas continuam valendo (o
  hash bcrypt é aceito).
