-- Importação da folha (Extrato Mensal) numa transação só: grava tudo ou nada.
-- O servidor lê o PDF, aplica o salário fictício no protótipo e chama esta
-- função com a folha já estruturada.

create function rh.importar_folha(
  p_importacao_id uuid,
  -- { competencia, ficticia, resumo_empresa, colaboradores: [{ matricula, nome,
  --   situacao, tipo_contrato, departamento_codigo, cargo_codigo, cargo_nome,
  --   cbo, admissao, horas_mes, salario, base_inss, base_fgts, valor_fgts,
  --   liquido, rubricas: [{ codigo, descricao, natureza, referencia, valor }] }] }
  p_folha jsonb,
  -- De-para escolhido na prévia: { "<código da folha>": "<id do departamento>" }.
  p_departamentos jsonb default '{}',
  -- Já existe folha da competência (não fechada): substituir?
  p_substituir boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_competencia date := (p_folha ->> 'competencia')::date;
  v_importacao core.importacoes;
  v_existente rh.folhas;
  v_folha_id uuid;
  v_colaboradores int;
  v_novos_colaboradores int;
  v_novas_rubricas int;
  v_novos_departamentos int;
  v_novos_cargos int;
begin
  if not core.pode('rh.folha') then
    raise exception 'sem permissão para importar a folha' using errcode = '42501';
  end if;

  select * into v_importacao from core.importacoes where id = p_importacao_id for update;
  if v_importacao.id is null or v_importacao.tipo <> 'folha' then
    raise exception 'importação não encontrada';
  end if;
  if v_importacao.status <> 'previa' then
    raise exception 'esta importação já foi %', v_importacao.status;
  end if;
  if v_importacao.referencia <> v_competencia then
    raise exception 'a competência do arquivo (%) é diferente da prévia (%)',
      to_char(v_competencia, 'MM/YYYY'), to_char(v_importacao.referencia, 'MM/YYYY');
  end if;

  select * into v_existente from rh.folhas where competencia = v_competencia for update;
  if v_existente.id is not null then
    if v_existente.status = 'fechada' then
      raise exception 'a folha de % está fechada e não pode ser substituída', to_char(v_competencia, 'MM/YYYY');
    end if;
    if not p_substituir then
      raise exception 'já existe folha de %; confirme a substituição', to_char(v_competencia, 'MM/YYYY');
    end if;
    delete from rh.folhas where id = v_existente.id; -- leva pessoas e rubricas (cascade)
  end if;

  -- De-para de departamentos escolhido na prévia (só onde ainda não há código).
  update rh.departamentos d
  set codigo_folha = m.key::int
  from jsonb_each_text(p_departamentos) m
  where d.id = m.value::uuid and d.codigo_folha is null;

  -- Códigos que continuam sem departamento: cria "Departamento N" para a
  -- Gestora renomear em Parâmetros.
  insert into rh.departamentos (nome, codigo_folha)
  select distinct 'Departamento ' || (c ->> 'departamento_codigo'), (c ->> 'departamento_codigo')::int
  from jsonb_array_elements(p_folha -> 'colaboradores') c
  where c ->> 'departamento_codigo' is not null
  on conflict (codigo_folha) do nothing;
  get diagnostics v_novos_departamentos = row_count;

  insert into rh.cargos (nome, codigo_folha, cbo)
  select distinct on ((c ->> 'cargo_codigo')::int)
    c ->> 'cargo_nome', (c ->> 'cargo_codigo')::int, c ->> 'cbo'
  from jsonb_array_elements(p_folha -> 'colaboradores') c
  where c ->> 'cargo_codigo' is not null
  on conflict (codigo_folha) do nothing;
  get diagnostics v_novos_cargos = row_count;

  -- Rubrica nova entra como não classificada: a Gestora classifica depois.
  insert into rh.rubricas (codigo, descricao)
  select distinct on ((r ->> 'codigo')::int) (r ->> 'codigo')::int, r ->> 'descricao'
  from jsonb_array_elements(p_folha -> 'colaboradores') c,
       jsonb_array_elements(c -> 'rubricas') r
  on conflict (codigo) do nothing;
  get diagnostics v_novas_rubricas = row_count;

  select count(*) into v_novos_colaboradores
  from jsonb_array_elements(p_folha -> 'colaboradores') c
  where not exists (
    select 1 from rh.colaboradores x where x.matricula = (c ->> 'matricula')::int
  );

  -- A folha manda em tipo de contrato e cargo; nome, admissão e departamento
  -- só preenchem o que ainda estiver vazio (o ponto já pode ter trazido).
  insert into rh.colaboradores (matricula, nome, admissao, tipo_contrato, departamento_id, cargo_id)
  select
    (c ->> 'matricula')::int,
    initcap(lower(c ->> 'nome')),
    (c ->> 'admissao')::date,
    (c ->> 'tipo_contrato')::rh.tipo_contrato,
    (select d.id from rh.departamentos d where d.codigo_folha = (c ->> 'departamento_codigo')::int),
    (select g.id from rh.cargos g where g.codigo_folha = (c ->> 'cargo_codigo')::int)
  from jsonb_array_elements(p_folha -> 'colaboradores') c
  on conflict (matricula) do update set
    tipo_contrato = excluded.tipo_contrato,
    cargo_id = excluded.cargo_id,
    admissao = coalesce(rh.colaboradores.admissao, excluded.admissao),
    departamento_id = coalesce(rh.colaboradores.departamento_id, excluded.departamento_id);

  insert into rh.folhas (competencia, importacao_id, resumo_empresa, ficticia)
  values (
    v_competencia,
    p_importacao_id,
    coalesce(p_folha -> 'resumo_empresa', '{}'),
    coalesce((p_folha ->> 'ficticia')::boolean, false)
  )
  returning id into v_folha_id;

  insert into rh.folha_colaboradores (
    folha_id, colaborador_id, situacao, tipo_contrato, departamento_codigo_folha,
    departamento_id, cargo_id, horas_mes_min, salario, base_inss, base_fgts,
    valor_fgts, liquido
  )
  select
    v_folha_id,
    x.id,
    (c ->> 'situacao')::rh.situacao_folha,
    (c ->> 'tipo_contrato')::rh.tipo_contrato,
    (c ->> 'departamento_codigo')::int,
    (select d.id from rh.departamentos d where d.codigo_folha = (c ->> 'departamento_codigo')::int),
    (select g.id from rh.cargos g where g.codigo_folha = (c ->> 'cargo_codigo')::int),
    round((c ->> 'horas_mes')::numeric * 60)::int,
    (c ->> 'salario')::numeric,
    (c ->> 'base_inss')::numeric,
    (c ->> 'base_fgts')::numeric,
    (c ->> 'valor_fgts')::numeric,
    (c ->> 'liquido')::numeric
  from jsonb_array_elements(p_folha -> 'colaboradores') c
  join rh.colaboradores x on x.matricula = (c ->> 'matricula')::int;
  get diagnostics v_colaboradores = row_count;

  insert into rh.folha_rubricas (folha_id, colaborador_id, rubrica_codigo, natureza, referencia, valor)
  select
    v_folha_id,
    x.id,
    (r ->> 'codigo')::int,
    (r ->> 'natureza')::rh.natureza_rubrica,
    (r ->> 'referencia')::numeric,
    (r ->> 'valor')::numeric
  from jsonb_array_elements(p_folha -> 'colaboradores') c
  join rh.colaboradores x on x.matricula = (c ->> 'matricula')::int
  cross join jsonb_array_elements(c -> 'rubricas') r;

  update core.importacoes
  set status = 'substituida'
  where tipo = 'folha' and referencia = v_competencia and status = 'confirmada';

  update core.importacoes
  set status = 'confirmada', confirmado_por = (select auth.uid()), confirmado_em = now()
  where id = p_importacao_id;

  return jsonb_build_object(
    'folha_id', v_folha_id,
    'colaboradores', v_colaboradores,
    'colaboradores_novos', v_novos_colaboradores,
    'rubricas_novas', v_novas_rubricas,
    'departamentos_novos', v_novos_departamentos,
    'cargos_novos', v_novos_cargos
  );
end;
$$;

revoke all on function rh.importar_folha(uuid, jsonb, jsonb, boolean) from public, anon;
grant execute on function rh.importar_folha(uuid, jsonb, jsonb, boolean) to authenticated, service_role;
