-- IA ARP: o assistente do sistema (botão no cabeçalho de toda tela) e a
-- gestão dele em Administração › Configurações › IA.
--
-- A IA só lê, pelas mesmas rotas das telas e com a sessão de quem pergunta:
-- o que a pessoa não vê na tela a IA também não vê. Aqui ficam a
-- configuração, os limites de uso, as conversas (só o dono lê) e o registro
-- de uso (o gestor vê números, nunca o conteúdo das conversas).

create schema ia;
grant usage on schema ia to authenticated, service_role;

-- 1. Permissões. Quem administra usuários começa com as duas, para ligar a
-- IA para os outros cargos e pessoas.
insert into core.permissoes (codigo, descricao) values
  ('ia.usar', 'Usar a IA ARP: perguntar sobre os dados do sistema (ela só lê o que a pessoa já pode ver)'),
  ('ia.gerenciar', 'Configurar a IA ARP: ligar e desligar, modelo, limites de uso e o painel de consumo')
on conflict do nothing;

insert into core.cargo_permissoes (cargo_id, permissao)
select cp.cargo_id, v.p
from core.cargo_permissoes cp
cross join (values ('ia.usar'), ('ia.gerenciar')) as v (p)
where cp.permissao = 'admin.usuarios'
on conflict do nothing;

insert into core.usuario_permissoes (usuario_id, permissao)
select up.usuario_id, v.p
from core.usuario_permissoes up
cross join (values ('ia.usar'), ('ia.gerenciar')) as v (p)
where up.permissao = 'admin.usuarios'
on conflict do nothing;

-- 2. Configuração (uma linha). Preços em US$ por milhão de tokens, por
-- modelo (tabela da Anthropic de nov/2026; o gestor corrige na tela).
create table ia.config (
  id boolean primary key default true check (id),
  ativa boolean not null default true,
  esforco text not null default 'medium'
    check (esforco in ('low', 'medium', 'high', 'xhigh', 'max')),
  max_consultas integer not null default 12 check (max_consultas between 1 and 40),
  -- Tokens por pessoa por mês sem limite próprio nem do cargo (null: sem limite).
  limite_padrao_mes bigint check (limite_padrao_mes > 0),
  -- Teto de gasto do sistema inteiro no mês, em US$ (null: sem teto).
  orcamento_mes_usd numeric(12, 2) check (orcamento_mes_usd > 0),
  dias_de_guarda integer not null default 180 check (dias_de_guarda between 1 and 3650),
  cotacao_dolar numeric(10, 4) not null default 5.40 check (cotacao_dolar > 0),
  precos jsonb not null default '{}' check (jsonb_typeof(precos) = 'object'),
  instrucoes text not null default '' check (length(instrucoes) <= 4000),
  atualizado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  atualizado_em timestamptz not null default now()
);

create index config_atualizado_por on ia.config (atualizado_por);

insert into ia.config (limite_padrao_mes, precos) values (
  2000000,
  '{
    "claude-opus-5-5":   {"entrada": 4,   "saida": 20,  "cache_escrita": 5,     "cache_leitura": 0.2},
    "claude-sonnet-5-5": {"entrada": 2,   "saida": 10,  "cache_escrita": 2.5,   "cache_leitura": 0.1},
    "claude-haiku-5-5":  {"entrada": 0.1, "saida": 0.5, "cache_escrita": 0.125, "cache_leitura": 0.01},
    "claude-fable-5-2":  {"entrada": 8,   "saida": 40,  "cache_escrita": 10,    "cache_leitura": 0.2},
    "claude-opus-5":     {"entrada": 5,   "saida": 25,  "cache_escrita": 6.25,  "cache_leitura": 0.5},
    "claude-sonnet-5":   {"entrada": 2,   "saida": 10,  "cache_escrita": 2.5,   "cache_leitura": 0.2}
  }'
);

create trigger auditoria after insert or delete or update on ia.config
  for each row execute function core.auditar('id');

alter table ia.config enable row level security;

create policy ver on ia.config for select to authenticated
  using ((select core.pode('ia.usar')) or (select core.pode('ia.gerenciar')));
create policy editar on ia.config for update to authenticated
  using ((select core.pode('ia.gerenciar')))
  with check ((select core.pode('ia.gerenciar')));

revoke all on ia.config from public, anon, authenticated;
grant select on ia.config to authenticated;
grant update (
  ativa, esforco, max_consultas, limite_padrao_mes, orcamento_mes_usd,
  dias_de_guarda, cotacao_dolar, precos, instrucoes, atualizado_por,
  atualizado_em
) on ia.config to authenticated;
grant all on ia.config to service_role;

-- 3. Limite de tokens por mês de um cargo ou de uma pessoa (o da pessoa
-- vale sobre o do cargo, que vale sobre o padrão). tokens_mes null: sem limite.
create table ia.limites (
  id uuid primary key default gen_random_uuid(),
  cargo_id uuid unique references core.cargos (id) on delete cascade,
  usuario_id uuid unique references core.usuarios (id) on delete cascade,
  tokens_mes bigint check (tokens_mes >= 0),
  atualizado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  atualizado_em timestamptz not null default now(),
  check ((cargo_id is null) <> (usuario_id is null))
);

create index limites_atualizado_por on ia.limites (atualizado_por);

create trigger auditoria after insert or delete or update on ia.limites
  for each row execute function core.auditar('id');

alter table ia.limites enable row level security;

create policy ver on ia.limites for select to authenticated
  using ((select core.pode('ia.gerenciar')));
create policy criar on ia.limites for insert to authenticated
  with check ((select core.pode('ia.gerenciar')));
create policy editar on ia.limites for update to authenticated
  using ((select core.pode('ia.gerenciar')))
  with check ((select core.pode('ia.gerenciar')));
create policy excluir on ia.limites for delete to authenticated
  using ((select core.pode('ia.gerenciar')));

revoke all on ia.limites from public, anon, authenticated;
grant select, delete on ia.limites to authenticated;
grant insert (cargo_id, usuario_id, tokens_mes),
  update (tokens_mes, atualizado_por, atualizado_em) on ia.limites to authenticated;
grant all on ia.limites to service_role;

-- 4. Conversas e perguntas: só o dono lê, grava e apaga. `mensagens` guarda
-- o turno no formato da API da Claude (para continuar a conversa); a tela
-- lê só pergunta, resposta e fontes.
create table ia.conversas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references core.usuarios (id) on delete cascade,
  titulo text not null check (length(titulo) between 1 and 200),
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now()
);

create index conversas_usuario on ia.conversas (usuario_id, atualizada_em desc);
create index conversas_atualizada on ia.conversas (atualizada_em);

alter table ia.conversas enable row level security;

create policy ver on ia.conversas for select to authenticated
  using (usuario_id = (select auth.uid()));
create policy criar on ia.conversas for insert to authenticated
  with check (usuario_id = (select auth.uid()) and (select core.pode('ia.usar')));
create policy editar on ia.conversas for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));
create policy excluir on ia.conversas for delete to authenticated
  using (usuario_id = (select auth.uid()));

revoke all on ia.conversas from public, anon, authenticated;
grant select, delete on ia.conversas to authenticated;
grant insert (titulo), update (titulo, atualizada_em) on ia.conversas to authenticated;
grant all on ia.conversas to service_role;

create table ia.perguntas (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references ia.conversas (id) on delete cascade,
  usuario_id uuid not null default auth.uid() references core.usuarios (id) on delete cascade,
  pergunta text not null check (length(pergunta) between 1 and 4000),
  resposta text not null default '',
  mensagens jsonb not null default '[]' check (jsonb_typeof(mensagens) = 'array'),
  fontes jsonb not null default '[]' check (jsonb_typeof(fontes) = 'array'),
  status text not null default 'andamento'
    check (status in ('andamento', 'ok', 'erro', 'limite', 'recusa', 'cancelada')),
  avaliacao smallint check (avaliacao in (-1, 1)),
  criada_em timestamptz not null default now()
);

create index perguntas_conversa on ia.perguntas (conversa_id, criada_em);
create index perguntas_usuario on ia.perguntas (usuario_id);

alter table ia.perguntas enable row level security;

create policy ver on ia.perguntas for select to authenticated
  using (usuario_id = (select auth.uid()));
create policy criar on ia.perguntas for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and (select core.pode('ia.usar'))
    and exists (
      select 1 from ia.conversas c
      where c.id = conversa_id and c.usuario_id = (select auth.uid())
    )
  );
create policy editar on ia.perguntas for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));
create policy excluir on ia.perguntas for delete to authenticated
  using (usuario_id = (select auth.uid()));

revoke all on ia.perguntas from public, anon, authenticated;
grant select, delete on ia.perguntas to authenticated;
grant insert (conversa_id, pergunta),
  update (resposta, mensagens, fontes, status, avaliacao) on ia.perguntas to authenticated;
grant all on ia.perguntas to service_role;

-- 5. Uso: uma linha por pergunta, com o cargo da pessoa naquele momento.
-- Fica mesmo depois de a conversa ser apagada (só perde o vínculo). Só a
-- API grava (service role, depois de conferir ia.usar); a pessoa vê o
-- próprio uso e avalia a resposta; o gestor vê tudo.
create table ia.uso (
  id uuid primary key default gen_random_uuid(),
  pergunta_id uuid unique references ia.perguntas (id) on delete set null,
  conversa_id uuid references ia.conversas (id) on delete set null,
  usuario_id uuid references core.usuarios (id) on delete set null,
  cargo_id uuid references core.cargos (id) on delete set null,
  modelo text not null,
  tokens_entrada bigint not null default 0 check (tokens_entrada >= 0),
  tokens_saida bigint not null default 0 check (tokens_saida >= 0),
  tokens_cache_escrita bigint not null default 0 check (tokens_cache_escrita >= 0),
  tokens_cache_leitura bigint not null default 0 check (tokens_cache_leitura >= 0),
  -- Os que contam no limite (entrada + saída + escrita do cache).
  tokens_contados bigint not null default 0 check (tokens_contados >= 0),
  custo_usd numeric(14, 6) not null default 0 check (custo_usd >= 0),
  consultas integer not null default 0 check (consultas >= 0),
  -- Primeiro trecho do endereço de cada fonte consultada (rh, financeiro…).
  modulos text[] not null default '{}',
  duracao_ms integer not null default 0 check (duracao_ms >= 0),
  status text not null
    check (status in ('ok', 'erro', 'limite', 'recusa', 'cancelada')),
  avaliacao smallint check (avaliacao in (-1, 1)),
  criado_em timestamptz not null default now()
);

create index uso_criado on ia.uso (criado_em);
create index uso_usuario on ia.uso (usuario_id, criado_em);
create index uso_cargo on ia.uso (cargo_id);
create index uso_conversa on ia.uso (conversa_id);

alter table ia.uso enable row level security;

create policy ver on ia.uso for select to authenticated
  using (usuario_id = (select auth.uid()) or (select core.pode('ia.gerenciar')));
create policy avaliar on ia.uso for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

revoke all on ia.uso from public, anon, authenticated;
grant select on ia.uso to authenticated;
grant update (avaliacao) on ia.uso to authenticated;
grant all on ia.uso to service_role;
