# ARP Centralizador

Visão geral, como rodar e deploy: README.md. Arquitetura: docs/arquitetura.md
(vale para todo o código). Módulo novo ou mudança em módulo:
docs/guia-de-modulo-api.md e docs/guia-de-modulo-web.md.

- Camadas da API (`apps/api/src/modules/<modulo>`): routes → controller →
  service → repository; a dependência só desce. Controller sem regra e sem
  SQL; service sem `request`/`reply`; SQL só no repository (Kysely).
- Regra pura, formato e contrato (Zod) ficam em `packages/shared`, que não
  importa Node, React nem banco.
- Toda rota declara o acesso (`acesso` ou `permissao`) e valida a entrada com
  Zod; a resposta leva só os campos da tela.
- Banco: `comoUsuario` para o que é feito em nome de quem está logado (o RLS
  vale); `comoServico` só depois de `exigir(ctx, permissao)` no service.
- Mudanças no banco só por nova migration em `apps/api/db/migrations` (nunca
  editar uma já aplicada); toda tabela nova com RLS, política com
  `(select core.pode(...))` e teste em `apps/api/db/tests`.
- Conectores de sistemas externos (`apps/api/src/connectors`) não importam
  Fastify e só fazem leitura. Toda resposta externa passa por schema Zod
  antes de ser usada. Testes nunca chamam sistema externo de verdade.
- Segredos só em `apps/api/.env`; o front não recebe segredo (nada secreto em
  `VITE_*`). Nunca registrar senha, token, cookie ou dado pessoal no log.
- Nada de valor de negócio fixo no código (metas, encargos, jornadas,
  faixas): vira parâmetro no banco.
- Nunca copiar dados reais de clientes, funcionários ou credenciais para o
  repo (o banco de homologação é um clone da produção).
- Front (`apps/web/src/modules/<modulo>`): dados por TanStack Query e
  `lib/api.ts` (nenhum `fetch` solto); gravação invalida as chaves do que
  mudou; biblioteca pesada entra por `import()`.
- Arquivos só por `infra/arquivos`; confira a permissão antes de assinar o
  link.
- TypeScript estrito: sem `any`, sem `as` para calar o compilador. Código,
  comentários e mensagens em português.
- Antes de concluir: `npm run check` e `npm test` (na raiz).
