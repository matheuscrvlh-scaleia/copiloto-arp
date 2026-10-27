-- A folha importada no modo protótipo (fictícia) passa a ter tudo editável na
-- tela, inclusive o salário e as rubricas de salário: a ARP corrige à mão o
-- que veio em R$ 2.000,00. Mesma função de 20261021160000_rh_editar_folha,
-- sem a trava do protótipo.

create or replace function rh.salvar_pessoa_folha(
  p_folha_id uuid,
  p_colaborador_id uuid,
  -- { tipo_contrato, departamento_id, cargo_id, horas_mes_min, salario }
  p_pessoa jsonb,
  -- [{ codigo, natureza, referencia, valor }]: substitui todas as da pessoa.
  p_rubricas jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_folha rh.folhas;
  v_pessoa rh.folha_colaboradores;
  v_codigo int;
  v_rubricas_antes jsonb;
begin
  if not core.pode('rh.folha') then
    raise exception 'Você não tem permissão para editar a folha'
      using errcode = '42501';
  end if;

  select * into v_folha from rh.folhas where id = p_folha_id for update;
  if not found then
    raise exception 'Folha não encontrada';
  end if;
  if v_folha.status = 'fechada' then
    raise exception 'A folha de % está fechada e não pode ser editada',
      to_char(v_folha.competencia, 'MM/YYYY');
  end if;

  select * into v_pessoa from rh.folha_colaboradores
    where folha_id = p_folha_id and colaborador_id = p_colaborador_id;
  if not found then
    raise exception 'Esta pessoa não está na folha';
  end if;
  if jsonb_typeof(p_rubricas) is distinct from 'array' then
    raise exception 'Rubricas inválidas';
  end if;

  select r.codigo into v_codigo
    from jsonb_to_recordset(p_rubricas) as r(codigo int)
    where not exists (select 1 from rh.rubricas x where x.codigo = r.codigo)
    limit 1;
  if found then
    raise exception 'A rubrica % não está cadastrada', v_codigo;
  end if;

  select coalesce(jsonb_agg(rubrica_codigo order by rubrica_codigo), '[]')
    into v_rubricas_antes
    from rh.folha_rubricas
    where folha_id = p_folha_id and colaborador_id = p_colaborador_id;

  update rh.folha_colaboradores set
    tipo_contrato = (p_pessoa ->> 'tipo_contrato')::rh.tipo_contrato,
    departamento_id = (p_pessoa ->> 'departamento_id')::uuid,
    cargo_id = (p_pessoa ->> 'cargo_id')::uuid,
    horas_mes_min = (p_pessoa ->> 'horas_mes_min')::int,
    salario = (p_pessoa ->> 'salario')::numeric
  where folha_id = p_folha_id and colaborador_id = p_colaborador_id;

  delete from rh.folha_rubricas
    where folha_id = p_folha_id and colaborador_id = p_colaborador_id;
  insert into rh.folha_rubricas (folha_id, colaborador_id, rubrica_codigo, natureza, referencia, valor)
    select p_folha_id, p_colaborador_id, r.codigo, r.natureza, r.referencia, r.valor
    from jsonb_to_recordset(p_rubricas)
      as r(codigo int, natureza rh.natureza_rubrica, referencia numeric, valor numeric);

  -- O líquido acompanha as rubricas.
  update rh.folha_colaboradores set liquido = (
    select coalesce(sum(case natureza when 'provento' then valor when 'desconto' then -valor else 0 end), 0)
    from rh.folha_rubricas
    where folha_id = p_folha_id and colaborador_id = p_colaborador_id
  )
  where folha_id = p_folha_id and colaborador_id = p_colaborador_id;

  update rh.folhas set atualizado_em = now() where id = p_folha_id;

  insert into core.auditoria (tabela, registro_id, acao, antes, depois, usuario_id)
  values (
    'rh.folha_colaboradores',
    p_folha_id || ':' || p_colaborador_id,
    'update',
    jsonb_build_object(
      'tipo_contrato', v_pessoa.tipo_contrato,
      'departamento_id', v_pessoa.departamento_id,
      'cargo_id', v_pessoa.cargo_id,
      'horas_mes_min', v_pessoa.horas_mes_min,
      'rubricas', v_rubricas_antes
    ),
    jsonb_build_object(
      'tipo_contrato', p_pessoa ->> 'tipo_contrato',
      'departamento_id', p_pessoa ->> 'departamento_id',
      'cargo_id', p_pessoa ->> 'cargo_id',
      'horas_mes_min', (p_pessoa ->> 'horas_mes_min')::int,
      'salario_alterado', (p_pessoa ->> 'salario')::numeric is distinct from v_pessoa.salario,
      'rubricas', (
        select coalesce(jsonb_agg(r.codigo order by r.codigo), '[]')
        from jsonb_to_recordset(p_rubricas) as r(codigo int)
      )
    ),
    (select auth.uid())
  );
end;
$$;

revoke execute on function rh.salvar_pessoa_folha(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function rh.salvar_pessoa_folha(uuid, uuid, jsonb, jsonb)
  to authenticated, service_role;
