-- Energia solar pelo inversor (Growatt). A credencial (token da OpenAPI e o
-- id da usina) é configurada em Sustentabilidade › Configurações ›
-- Integrações; a geração de cada dia vem da sincronização diária e alimenta
-- a Energia solar de Operações e o Painel de Sustentabilidade quando a fonte
-- da geração (operacoes.parametros.solar_fonte) é "inversor".

-- 1. Novo sistema nas credenciais (prefixo sus_: as do Sustentabilidade).
alter table integracao.credenciais drop constraint credenciais_sistema_check;
alter table integracao.credenciais add constraint credenciais_sistema_check
  check (sistema = any (array[
    'secullum', 'wps', 'diario_de_obras', 'copiloto_rh', 'rd_crm', 'cameras',
    'mkt_google', 'mkt_youtube', 'mkt_meta', 'mkt_tiktok', 'mkt_rd_station',
    'mkt_asana', 'mkt_site', 'sus_growatt'
  ]));

-- 2. Quem configura: admin.integracoes em todas; marketing.parametros nas do
-- Marketing; sustentabilidade.parametros nas do Sustentabilidade.
create or replace function core.pode_integracao(p_sistema text) returns boolean
  language sql stable security definer
  set search_path to ''
  as $$
  select (select core.pode('admin.integracoes'))
    or (
      p_sistema like 'mkt\_%'
      and p_sistema <> 'mkt_rd_station'
      and (select core.pode('marketing.parametros'))
    )
    or (
      p_sistema like 'sus\_%'
      and (select core.pode('sustentabilidade.parametros'))
    );
$$;

-- 3. Geração diária lida do inversor. Uma linha por usina e dia; o dia de
-- hoje é parcial e a próxima leitura troca o valor. Só a sincronização
-- (service role) grava.
create table operacoes.solar_inversor_dias (
  usina_id bigint not null,
  dia date not null,
  energia_kwh numeric(12, 2) not null check (energia_kwh >= 0),
  sync_run_id uuid references integracao.sync_runs (id) on delete set null,
  atualizado_em timestamptz not null default now(),
  primary key (usina_id, dia)
);

create index solar_inversor_dias_dia on operacoes.solar_inversor_dias (dia);
create index solar_inversor_dias_sync_run on operacoes.solar_inversor_dias (sync_run_id);

alter table operacoes.solar_inversor_dias enable row level security;

-- Lê quem vê a Energia solar (a mesma regra das faturas).
create policy ver on operacoes.solar_inversor_dias
  for select to authenticated
  using (
    (select core.pode('operacoes.energia.contas'))
    or (select core.pode('operacoes.solar.ver'))
  );

revoke all on operacoes.solar_inversor_dias from public, anon, authenticated;
grant select on operacoes.solar_inversor_dias to authenticated;
grant select, insert, update, delete on operacoes.solar_inversor_dias to service_role;

-- 4. Histórico das execuções: cada pessoa vê o das integrações que pode
-- configurar (antes, só quem tinha admin.integracoes). Assim as
-- telas de Integrações do Marketing e do Sustentabilidade mostram as suas.
create or replace function core.historico_integracoes(p_limite integer default 20)
  returns table(sistema text, recurso text, status integracao.status_sync,
    iniciado_em timestamptz, finalizado_em timestamptz, registros integer,
    erro text, avisos jsonb)
  language sql stable security definer
  set search_path to ''
  as $$
  select r.sistema, r.recurso, r.status, r.iniciado_em, r.finalizado_em,
    r.registros, left(r.erro, 300),
    case when jsonb_typeof(r.cursor_depois -> 'avisos') = 'array'
      then r.cursor_depois -> 'avisos' else '[]'::jsonb end
  from integracao.sync_runs r
  where core.pode_integracao(r.sistema)
  order by r.iniciado_em desc
  limit least(greatest(p_limite, 1), 100);
$$;
