-- operacoes_limpeza: gravações do rateio da limpeza (spec 4.8) em uma
-- transação só.
--
--   * limpeza_salvar: cria ou altera o mês aberto e troca, de uma vez, os
--     extras, os minutos, a composição do contrato e a equipe. Roda com a
--     sessão de quem chama (security invoker): o RLS e os grants do contrato
--     (20261109160000_operacoes) valem aqui também, e mês fechado não muda.
--   * limpeza_gravar_previa: grava os meses lidos da planilha do histórico
--     na prévia de uma importação (origem 'importacao', com os valores da
--     aba). Security definer porque as colunas da importação (origem,
--     importacao_id, status, valores_planilha) não têm grant para a sessão;
--     confere a permissão de importar e que a prévia é de quem chama.
--     Confirmar e desfazer são os do contrato (confirmar_importacao,
--     desfazer_importacao).

create function operacoes.limpeza_salvar(p_ref date, p_dados jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status text;
begin
  if not (select core.pode('operacoes.limpeza.fechar')) then
    raise exception 'sem permissão para lançar o rateio' using errcode = '42501';
  end if;
  if extract(day from p_ref) <> 1 then
    raise exception 'mês de referência inválido' using errcode = '22023';
  end if;

  select status into v_status from operacoes.limpeza_meses where referencia = p_ref;
  if not found then
    insert into operacoes.limpeza_meses (
      referencia, apontamento, valor_base, base_composicao, func_base,
      func_area_comum, func_rateados, regra_bl04
    ) values (
      p_ref,
      nullif(btrim(p_dados ->> 'apontamento'), ''),
      (p_dados ->> 'valor_base')::numeric,
      nullif(btrim(p_dados ->> 'base_composicao'), ''),
      (p_dados ->> 'func_base')::int,
      (p_dados ->> 'func_area_comum')::int,
      (p_dados ->> 'func_rateados')::int,
      coalesce(p_dados ->> 'regra_bl04', 'separado')
    );
  elsif v_status <> 'aberto' then
    raise exception 'o mês está fechado: reabra para editar' using errcode = '22023';
  else
    update operacoes.limpeza_meses set
      apontamento = nullif(btrim(p_dados ->> 'apontamento'), ''),
      valor_base = (p_dados ->> 'valor_base')::numeric,
      base_composicao = nullif(btrim(p_dados ->> 'base_composicao'), ''),
      func_base = (p_dados ->> 'func_base')::int,
      func_area_comum = (p_dados ->> 'func_area_comum')::int,
      func_rateados = (p_dados ->> 'func_rateados')::int,
      regra_bl04 = coalesce(p_dados ->> 'regra_bl04', regra_bl04)
    where referencia = p_ref;
    if not found then
      raise exception 'o mês está fechado: reabra para editar' using errcode = '22023';
    end if;
  end if;

  delete from operacoes.limpeza_extras where referencia = p_ref;
  insert into operacoes.limpeza_extras (referencia, ordem, descricao, quantidade, valor_unitario, valor)
  select p_ref, (x.ordem - 1)::int, btrim(x.v ->> 'descricao'),
    (x.v ->> 'quantidade')::numeric, (x.v ->> 'valor_unitario')::numeric,
    (x.v ->> 'valor')::numeric
  from jsonb_array_elements(coalesce(p_dados -> 'extras', '[]')) with ordinality as x (v, ordem);

  delete from operacoes.limpeza_minutos where referencia = p_ref;
  insert into operacoes.limpeza_minutos (referencia, bloco, limpeza, manutencao)
  select p_ref, x ->> 'bloco', coalesce((x ->> 'limpeza')::int, 0),
    coalesce((x ->> 'manutencao')::int, 0)
  from jsonb_array_elements(coalesce(p_dados -> 'minutos', '[]')) as x;

  delete from operacoes.limpeza_contrato where referencia = p_ref;
  insert into operacoes.limpeza_contrato (referencia, ordem, descricao, valor, entra_conferencia)
  select p_ref, (x.ordem - 1)::int, btrim(x.v ->> 'descricao'), (x.v ->> 'valor')::numeric,
    coalesce((x.v ->> 'entra_conferencia')::boolean, false)
  from jsonb_array_elements(coalesce(p_dados -> 'contrato', '[]')) with ordinality as x (v, ordem);

  delete from operacoes.limpeza_equipe where referencia = p_ref;
  insert into operacoes.limpeza_equipe (referencia, ordem, nome, funcao, grupo, blocos, turno, minutos_dia)
  select p_ref, (x.ordem - 1)::int, btrim(x.v ->> 'nome'),
    nullif(btrim(x.v ->> 'funcao'), ''), x.v ->> 'grupo',
    coalesce(array(select jsonb_array_elements_text(x.v -> 'blocos')), '{}'),
    nullif(btrim(x.v ->> 'turno'), ''), (x.v ->> 'minutos_dia')::int
  from jsonb_array_elements(coalesce(p_dados -> 'equipe', '[]')) with ordinality as x (v, ordem);
end;
$$;

create function operacoes.limpeza_gravar_previa(p_importacao uuid, p_meses jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v operacoes.importacoes;
  m jsonb;
  v_ref date;
  v_incompleto boolean;
  v_n int := 0;
begin
  if not operacoes.pode_importar('limpeza') then
    raise exception 'sem permissão para importar o rateio' using errcode = '42501';
  end if;
  select * into v from operacoes.importacoes where id = p_importacao for update;
  if not found or v.tipo <> 'limpeza' or v.status <> 'previa'
     or v.criado_por is distinct from (select auth.uid()) then
    raise exception 'prévia de importação do rateio não encontrada' using errcode = 'P0001';
  end if;

  for m in select * from jsonb_array_elements(coalesce(p_meses, '[]')) loop
    v_ref := (m ->> 'referencia')::date;
    if exists (select 1 from operacoes.limpeza_meses where referencia = v_ref) then
      raise exception 'o mês % já existe no rateio', to_char(v_ref, 'MM/YYYY')
        using errcode = '22023';
    end if;
    v_incompleto := coalesce((m ->> 'incompleto')::boolean, false);
    insert into operacoes.limpeza_meses (
      referencia, importacao_id, apontamento, valor_base, func_base,
      func_area_comum, func_rateados, regra_bl04, status, incompleto, origem,
      valores_planilha, fechado_por, fechado_em, criado_por
    ) values (
      v_ref, p_importacao, nullif(btrim(m ->> 'apontamento'), ''),
      (m ->> 'valor_base')::numeric, (m ->> 'func_base')::int,
      (m ->> 'func_area_comum')::int, (m ->> 'func_rateados')::int,
      m ->> 'regra_bl04',
      case when v_incompleto then 'aberto' else 'fechado' end,
      v_incompleto, 'importacao', m -> 'valores_planilha',
      case when v_incompleto then null else (select auth.uid()) end,
      case when v_incompleto then null else now() end,
      (select auth.uid())
    );
    insert into operacoes.limpeza_extras (referencia, ordem, descricao, quantidade, valor_unitario, valor)
    select v_ref, (x.ordem - 1)::int, btrim(x.v ->> 'descricao'),
      (x.v ->> 'quantidade')::numeric, (x.v ->> 'valor_unitario')::numeric,
      (x.v ->> 'valor')::numeric
    from jsonb_array_elements(coalesce(m -> 'extras', '[]')) with ordinality as x (v, ordem);
    insert into operacoes.limpeza_minutos (referencia, bloco, limpeza, manutencao)
    select v_ref, x ->> 'bloco', coalesce((x ->> 'limpeza')::int, 0),
      coalesce((x ->> 'manutencao')::int, 0)
    from jsonb_array_elements(coalesce(m -> 'minutos', '[]')) as x;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

revoke all on function operacoes.limpeza_salvar(date, jsonb) from public, anon;
revoke all on function operacoes.limpeza_gravar_previa(uuid, jsonb) from public, anon;
grant execute on function operacoes.limpeza_salvar(date, jsonb) to authenticated;
grant execute on function operacoes.limpeza_gravar_previa(uuid, jsonb) to authenticated;
