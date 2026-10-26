-- Custo de pessoal por tipo de contrato (spec de 26/10/2026):
-- * estagiário: sem encargos; provisiona só o recesso remunerado, se marcado;
-- * PJ: sem encargos; custo = valor mensal do contrato (Salário no Copiloto RH);
-- * sócio (pró-labore): fora do custo, do quadro e das listas;
-- * benefício vinculado a um tipo de contrato, além de pessoas.

-- ---------------------------------------------------------------------------
-- Encargos: recesso do estagiário (1/12 da bolsa por mês, sem 1/3 e sem
-- encargos). Os percentuais de estagiário e PJ ficam no banco, mas o cálculo
-- os ignora (sempre zero).
-- ---------------------------------------------------------------------------

alter table rh.encargos_por_contrato
  add column provisiona_recesso boolean not null default false;

-- ---------------------------------------------------------------------------
-- Valor mensal do PJ, do campo Salário do Copiloto RH. Só a sincronização
-- grava; só quem vê o custo individual lê. Sem linha: valor não informado.
-- No protótipo, gravado como R$ 2.000,00.
-- ---------------------------------------------------------------------------

-- 🔒 sensível
create table rh.valores_pj (
  colaborador_id uuid primary key references rh.colaboradores (id) on delete cascade,
  valor numeric(14, 2) not null check (valor >= 0),
  sync_run_id uuid references integracao.sync_runs (id) on delete set null,
  atualizado_em timestamptz not null default now()
);

create trigger atualizado_em before update on rh.valores_pj
  for each row execute function core.set_atualizado_em();

alter table rh.valores_pj enable row level security;
create policy ver on rh.valores_pj for select to authenticated
  using (core.pode('rh.custo_pessoal.individual'));
grant select on rh.valores_pj to authenticated;
grant all on rh.valores_pj to service_role;

-- ---------------------------------------------------------------------------
-- Benefício por tipo de contrato: todos com aquele contrato no Copiloto RH
-- recebem, inclusive quem for admitido depois. O vínculo da pessoa
-- (colaborador_beneficios) continua valendo e vence o do contrato.
-- ---------------------------------------------------------------------------

create table rh.beneficio_contratos (
  id uuid primary key default gen_random_uuid(),
  beneficio_id uuid not null references rh.beneficios (id) on delete restrict,
  tipo_contrato rh.tipo_contrato not null,
  desde date not null,
  ate date,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (ate is null or ate >= desde)
);

-- Um vínculo em aberto por benefício e contrato.
create unique index beneficio_contratos_aberto
  on rh.beneficio_contratos (beneficio_id, tipo_contrato) where ate is null;

create trigger atualizado_em before update on rh.beneficio_contratos
  for each row execute function core.set_atualizado_em();
create trigger auditoria after insert or update or delete on rh.beneficio_contratos
  for each row execute function core.auditar('id');

alter table rh.beneficio_contratos enable row level security;
create policy ver on rh.beneficio_contratos for select to authenticated
  using (core.pode('rh.beneficios'));
create policy editar on rh.beneficio_contratos for all to authenticated
  using (core.pode('rh.beneficios')) with check (core.pode('rh.beneficios'));
grant select, insert, update, delete on rh.beneficio_contratos to authenticated;
grant all on rh.beneficio_contratos to service_role;

-- ---------------------------------------------------------------------------
-- Custo: PJ sem valor informado aparece na tabela, mas não entra no custo
-- médio (não soma R$ 0 na média).
-- ---------------------------------------------------------------------------

alter table rh.custos_colaborador
  add column valor_informado boolean not null default true;

-- Igual a 20261020200000, mais o valor_informado.
create or replace function rh.gravar_custos(p_competencia date, p_linhas jsonb)
returns int
language plpgsql
set search_path = ''
as $$
declare
  n int;
begin
  if exists (
    select 1 from rh.folhas where competencia = p_competencia and status = 'fechada'
  ) then
    raise exception 'A folha de % está fechada: o custo não é recalculado',
      to_char(p_competencia, 'MM/YYYY');
  end if;

  delete from rh.custos_colaborador where competencia = p_competencia;

  insert into rh.custos_colaborador (
    competencia, colaborador_id, departamento_id, cargo_id, tipo_contrato,
    remuneracao, encargos, provisao_13, provisao_ferias, multa_rescisoria,
    beneficios, rescisao, reembolsos, custo_total, jornada_min, custo_hora,
    salario_hora, memoria, valor_informado
  )
  select
    p_competencia,
    (l ->> 'colaborador_id')::uuid,
    (l ->> 'departamento_id')::uuid,
    (l ->> 'cargo_id')::uuid,
    (l ->> 'tipo_contrato')::rh.tipo_contrato,
    (l ->> 'remuneracao')::numeric,
    (l ->> 'encargos')::numeric,
    (l ->> 'provisao_13')::numeric,
    (l ->> 'provisao_ferias')::numeric,
    (l ->> 'multa_rescisoria')::numeric,
    (l ->> 'beneficios')::numeric,
    (l ->> 'rescisao')::numeric,
    (l ->> 'reembolsos')::numeric,
    (l ->> 'custo_total')::numeric,
    (l ->> 'jornada_min')::int,
    (l ->> 'custo_hora')::numeric,
    (l ->> 'salario_hora')::numeric,
    l -> 'memoria',
    coalesce((l ->> 'valor_informado')::boolean, true)
  from jsonb_array_elements(p_linhas) l;

  get diagnostics n = row_count;
  return n;
end;
$$;

-- Somas por competência, departamento, cargo e contrato, como antes, mais
-- quantos ativos no fim do mês ficaram sem valor (PJ sem Salário no
-- Copiloto): a tela tira esses do divisor do custo médio.
drop function rh.custo_agregado(date, date);
create function rh.custo_agregado(inicio date, fim date)
returns table (
  competencia date,
  departamento_id uuid,
  cargo_id uuid,
  tipo_contrato rh.tipo_contrato,
  colaboradores bigint,
  remuneracao numeric,
  encargos numeric,
  provisoes numeric,
  beneficios numeric,
  rescisao numeric,
  reembolsos numeric,
  custo_total numeric,
  sem_valor bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.competencia, c.departamento_id, c.cargo_id, c.tipo_contrato,
    count(*),
    sum(c.remuneracao), sum(c.encargos),
    sum(c.provisao_13 + c.provisao_ferias + c.multa_rescisoria),
    sum(c.beneficios), sum(c.rescisao), sum(c.reembolsos), sum(c.custo_total),
    count(*) filter (
      where not c.valor_informado
        and x.admissao <= (c.competencia + interval '1 month - 1 day')::date
        and (x.desligamento is null
          or x.desligamento > (c.competencia + interval '1 month - 1 day')::date)
    )
  from rh.custos_colaborador c
  join rh.colaboradores x on x.id = c.colaborador_id
  where core.pode('rh.custo_pessoal')
    and c.competencia between inicio and fim
  group by 1, 2, 3, 4;
$$;

revoke execute on function rh.custo_agregado(date, date) from public, anon;
grant execute on function rh.custo_agregado(date, date) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Sócios: quem tem rubrica de pró-labore em alguma folha (ou contrato de
-- pró-labore na folha ou no Copiloto). Ficam fora do custo, do quadro e das
-- listas de Funcionários; o cadastro no Copiloto não muda.
-- Só os ids: qualquer permissão do RH vê, sem expor valores.
-- ---------------------------------------------------------------------------

create function rh.socios()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select x.id
  from rh.colaboradores x
  where core.pode_modulo('rh')
    and (
      x.tipo_contrato = 'pro_labore'
      or exists (
        select 1 from rh.folha_colaboradores fc
        where fc.colaborador_id = x.id and fc.tipo_contrato = 'pro_labore'
      )
      or exists (
        select 1
        from rh.folha_rubricas fr
        join rh.rubricas r on r.codigo = fr.rubrica_codigo
        where fr.colaborador_id = x.id and r.grupo = 'pro_labore'
      )
    );
$$;

revoke execute on function rh.socios() from public, anon;
grant execute on function rh.socios() to authenticated, service_role;
