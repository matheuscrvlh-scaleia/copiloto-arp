-- Exclusão de uma folha importada errada (arquivo trocado, competência
-- errada), numa transação só: a folha (pessoas e rubricas em cascata), o custo
-- de pessoal da competência e a importação marcada como revertida. Folha
-- fechada não é excluída. Para trocar por outro arquivo do mesmo mês, basta
-- importar de novo e confirmar a substituição (rh.importar_folha).

create function rh.excluir_folha(p_folha_id uuid)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_folha rh.folhas;
begin
  if not core.pode('rh.folha') then
    raise exception 'Você não tem permissão para excluir a folha'
      using errcode = '42501';
  end if;

  select * into v_folha from rh.folhas where id = p_folha_id for update;
  if not found then
    raise exception 'Folha não encontrada';
  end if;
  if v_folha.status = 'fechada' then
    raise exception 'A folha de % está fechada e não pode ser excluída',
      to_char(v_folha.competencia, 'MM/YYYY');
  end if;

  -- Sem folha, o custo do mês não tem de onde vir.
  delete from rh.custos_colaborador where competencia = v_folha.competencia;
  delete from rh.folhas where id = p_folha_id;

  update core.importacoes
  set status = 'revertida'
  where tipo = 'folha' and referencia = v_folha.competencia and status = 'confirmada';

  insert into core.auditoria (tabela, registro_id, acao, antes, depois, usuario_id)
  values (
    'rh.folhas',
    p_folha_id::text,
    'delete',
    jsonb_build_object(
      'competencia', v_folha.competencia,
      'importacao_id', v_folha.importacao_id,
      'ficticia', v_folha.ficticia
    ),
    null,
    (select auth.uid())
  );

  return v_folha.competencia;
end;
$$;

revoke execute on function rh.excluir_folha(uuid) from public, anon;
grant execute on function rh.excluir_folha(uuid) to authenticated, service_role;
