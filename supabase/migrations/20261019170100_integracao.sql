-- integracao: controle das sincronizações e dados brutos recebidos.
-- Não é exposto na API: só o servidor acessa, com a service role.

create schema integracao;
revoke all on schema integracao from public, anon, authenticated;
grant usage on schema integracao to service_role;

create type integracao.status_sync as enum ('rodando', 'sucesso', 'erro');

create table integracao.sync_runs (
  id uuid primary key default gen_random_uuid(),
  sistema text not null,
  recurso text not null,
  iniciado_em timestamptz not null default now(),
  finalizado_em timestamptz,
  status integracao.status_sync not null default 'rodando',
  cursor_antes jsonb,
  cursor_depois jsonb,
  registros int not null default 0,
  erro text,
  check ((status = 'rodando') = (finalizado_em is null))
);

-- Trava: uma execução por sistema e recurso de cada vez. Quem iniciar uma
-- execução deve antes marcar como 'erro' as 'rodando' esquecidas (timeout).
create unique index sync_runs_uma_rodando
  on integracao.sync_runs (sistema, recurso)
  where status = 'rodando';

create index sync_runs_recentes on integracao.sync_runs (sistema, recurso, iniciado_em desc);

-- Até onde cada recurso já foi sincronizado. Só avança em execução com sucesso.
create table integracao.cursores (
  sistema text not null,
  recurso text not null,
  cursor jsonb not null,
  atualizado_em timestamptz not null default now(),
  primary key (sistema, recurso)
);

-- Payload já validado pelo conector (campos que não usamos já foram descartados).
create table integracao.registros_brutos (
  sistema text not null,
  recurso text not null,
  chave_externa text not null,
  payload jsonb not null,
  hash text not null,
  sync_run_id uuid references integracao.sync_runs (id) on delete set null,
  recebido_em timestamptz not null default now(),
  primary key (sistema, recurso, chave_externa)
);

alter table integracao.sync_runs enable row level security;
alter table integracao.cursores enable row level security;
alter table integracao.registros_brutos enable row level security;

grant all on all tables in schema integracao to service_role;
