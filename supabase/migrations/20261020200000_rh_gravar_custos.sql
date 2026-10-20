-- Custo de pessoal: gravação do cálculo (src/lib/rh/custo.ts) e banco de
-- horas em R$.

-- Troca o custo da competência inteira numa transação só. Só o servidor
-- (service_role) chama, depois de conferir a permissão de quem pediu.
-- Folha fechada não é recalculada.
create function rh.gravar_custos(p_competencia date, p_linhas jsonb)
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
    salario_hora, memoria
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
    l -> 'memoria'
  from jsonb_array_elements(p_linhas) l;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function rh.gravar_custos(date, jsonb) from public, anon, authenticated;
grant execute on function rh.gravar_custos(date, jsonb) to service_role;

-- Banco de horas positivo em R$ por departamento: horas × salário por hora
-- da última folha calculada até o mês × (1 + adicional). Mesma permissão do
-- custo agregado (somas por departamento podem revelar salário).
create function rh.banco_horas_em_reais(p_competencia date)
returns table (
  departamento_id uuid,
  colaboradores bigint,
  positivo_min bigint,
  sem_salario bigint,
  valor numeric,
  folha date,
  adicional_pct numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  -- Vigente no mês; sem nenhum, a primeira configuração.
  with adicional as (
    select pe.banco_horas_adicional_pct as pct
    from rh.parametros_empresa pe
    order by (pe.vigente_desde <= p_competencia) desc,
      case when pe.vigente_desde <= p_competencia then pe.vigente_desde end desc,
      pe.vigente_desde
    limit 1
  ),
  ultima as (
    select max(c.competencia) as competencia
    from rh.custos_colaborador c
    where c.competencia <= p_competencia
  ),
  linhas as (
    select p.departamento_id, p.banco_saldo_min, c.salario_hora
    from rh.ponto_mensal p
    left join rh.custos_colaborador c
      on c.colaborador_id = p.colaborador_id
     and c.competencia = (select u.competencia from ultima u)
    where p.competencia = p_competencia and p.banco_saldo_min > 0
  )
  select
    l.departamento_id,
    count(*),
    sum(l.banco_saldo_min),
    count(*) filter (where l.salario_hora is null),
    round(
      sum(l.banco_saldo_min / 60.0 * l.salario_hora)
        * (1 + (select a.pct from adicional a) / 100),
      2),
    (select u.competencia from ultima u),
    (select a.pct from adicional a)
  from linhas l
  where core.pode('rh.custo_pessoal')
  group by l.departamento_id;
$$;

revoke execute on function rh.banco_horas_em_reais(date) from public, anon;
grant execute on function rh.banco_horas_em_reais(date) to authenticated, service_role;
