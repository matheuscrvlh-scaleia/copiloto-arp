-- Sessões de login. O navegador guarda só o token de renovação (cookie
-- HttpOnly); aqui fica o hash dele. A cada renovação o token troca; o
-- anterior fica guardado para reconhecer reuso (token roubado) e encerrar a
-- sessão. Só a API (papel service_role) lê e grava.

create table auth.sessoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  -- SHA-256 (hex) do segredo do token de renovação atual e do anterior.
  token_hash text not null,
  token_anterior_hash text,
  criada_em timestamptz not null default now(),
  -- Fim da sessão mesmo em uso (8 h depois de entrar).
  expira_em timestamptz not null,
  -- Última vez que a pessoa mexeu na tela (limite de inatividade).
  ultimo_uso timestamptz not null default now(),
  -- Última troca do token de renovação.
  renovada_em timestamptz not null default now(),
  ip text,
  agente text,
  revogada_em timestamptz,
  -- 'saiu', 'expirou', 'reuso', 'senha', 'bloqueado'
  motivo text,
  constraint sessoes_revogada_check check ((revogada_em is null) = (motivo is null))
);

create index sessoes_usuario on auth.sessoes (usuario_id) where revogada_em is null;
create index sessoes_expira_em on auth.sessoes (expira_em);

alter table auth.sessoes enable row level security;
-- Sem política: com o RLS ligado, só quem ignora o RLS (service_role) acessa.
revoke all on auth.sessoes from public, anon, authenticated;
grant select, insert, update, delete on auth.sessoes to service_role;

-- O limite de tentativas de login conta os erros recentes em core.logs.
create index logs_login_falhou on core.logs (em desc) where evento = 'login_falhou';
