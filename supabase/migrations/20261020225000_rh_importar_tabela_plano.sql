-- Tabela de faixas do plano de saúde (planilha da operadora), gravada numa
-- transação só: tabela, faixas, coparticipação e a importação confirmada.
-- Roda com a sessão de quem envia (RLS: rh.beneficios).

create function rh.importar_tabela_plano(
  p_importacao_id uuid,
  p_beneficio_id uuid,
  p_reajuste_pct numeric,
  p_faixas jsonb,
  p_coparticipacao jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_imp core.importacoes;
  v_tabela uuid;
begin
  if not core.pode('rh.beneficios') then
    raise exception 'Você não tem permissão para importar a tabela do plano'
      using errcode = '42501';
  end if;

  select * into v_imp from core.importacoes where id = p_importacao_id for update;
  if not found or v_imp.tipo <> 'plano_saude' then
    raise exception 'Importação não encontrada. Envie o arquivo de novo';
  end if;
  if v_imp.status <> 'previa' then
    raise exception 'Esta prévia já foi usada. Envie o arquivo de novo';
  end if;
  if not exists (
    select 1 from rh.beneficios
    where id = p_beneficio_id and tipo in ('plano_saude', 'odonto')
  ) then
    raise exception 'Escolha um benefício do tipo plano de saúde ou odonto';
  end if;

  -- Mesma vigência do mesmo benefício: a nova substitui a anterior.
  update core.importacoes i
    set status = 'substituida'
    from rh.plano_tabelas t
    where t.beneficio_id = p_beneficio_id
      and t.vigente_desde = v_imp.referencia
      and t.importacao_id = i.id
      and i.status = 'confirmada';
  delete from rh.plano_tabelas
    where beneficio_id = p_beneficio_id and vigente_desde = v_imp.referencia;

  insert into rh.plano_tabelas (beneficio_id, vigente_desde, reajuste_pct, importacao_id)
    values (p_beneficio_id, v_imp.referencia, p_reajuste_pct, p_importacao_id)
    returning id into v_tabela;

  insert into rh.plano_faixas_etarias (tabela_id, idade_min, idade_max, mensalidade)
    select v_tabela, f.idade_min, f.idade_max, f.mensalidade
    from jsonb_to_recordset(p_faixas)
      as f(idade_min int, idade_max int, mensalidade numeric);

  insert into rh.plano_coparticipacao (
    tabela_id, meses_min, meses_max, colaborador_pct, colaborador_valor_fixo
  )
    select v_tabela, c.meses_min, c.meses_max, c.colaborador_pct, c.colaborador_valor_fixo
    from jsonb_to_recordset(p_coparticipacao)
      as c(meses_min int, meses_max int, colaborador_pct numeric, colaborador_valor_fixo numeric);

  begin
    update core.importacoes
      set status = 'confirmada', confirmado_por = (select auth.uid()), confirmado_em = now()
      where id = p_importacao_id;
  exception when unique_violation then
    raise exception 'Já existe outra tabela confirmada com vigência em %. Escolha outro mês de vigência',
      to_char(v_imp.referencia, 'MM/YYYY');
  end;

  return v_tabela;
end;
$$;

revoke execute on function rh.importar_tabela_plano(uuid, uuid, numeric, jsonb, jsonb)
  from public, anon;
grant execute on function rh.importar_tabela_plano(uuid, uuid, numeric, jsonb, jsonb)
  to authenticated, service_role;
