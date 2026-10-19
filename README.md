# copiloto-arp

ERP da ARP. Consulta dados de ~8 sistemas externos (APIs REST) e consolida numa base própria.

## Stack

- **Next.js** (App Router) na **Vercel**: front e back (Route Handlers / Server Actions)
- **Supabase**: Postgres, Auth e RLS
- **TypeScript** estrito, **Tailwind CSS**, **Biome** (lint + format)

## Arquitetura

```
Vercel Cron ─▶ /api/sync/[sistema] ─▶ conector ─▶ valida (Zod) ─▶ upsert no Supabase
                                                              └▶ registra em sync_runs
App (Next.js) ─▶ Supabase (com RLS)
```

Princípios:

- **Conectores independentes do Next**: cada sistema externo é um módulo puro
  (`buscarPagina(cursor) → { dados, proximoCursor }`), testável isoladamente e
  portável para outro runtime se um dia for preciso.
- **Sincronização incremental e idempotente**: o cursor só avança em caso de
  sucesso; upserts nunca duplicam dados.
- **Segredos só no servidor**: credenciais de sistemas externos e a
  `service_role` do Supabase nunca chegam ao navegador.

## Estrutura

```
src/
  app/          rotas (páginas e API)
```

As pastas abaixo serão criadas conforme forem necessárias:

```
src/
  components/   componentes de UI
  connectors/   um módulo por sistema externo (sem dependência do Next)
  server/       código exclusivo do servidor (acesso a dados, regras de negócio)
  lib/          utilitários compartilhados
supabase/       migrations e configuração local
```

## Desenvolvimento

Requer Node 24+.

```bash
npm install
npm run dev        # http://localhost:3000
npm run check      # lint + tipos
npm run format     # formata o código
```
