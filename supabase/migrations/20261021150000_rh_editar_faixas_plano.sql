-- Faixas do plano corrigidas na tela (sem enviar outra planilha): troca as
-- faixas de uma tabela numa transação só. Roda com a sessão de quem edita
-- (RLS: rh.beneficios). As faixas passam a ir para a auditoria, inclusive as
-- importadas, para ficar o antes e o depois de cada correção.

create trigger auditoria after insert or update or delete on rh.plano_faixas_etarias
  for each row execute function core.auditar('tabela_id', 'idade_min');

create function rh.salvar_faixas_plano(p_tabela_id uuid, p_faixas jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not core.pode('rh.beneficios') then
    raise exception 'Você não tem permissão para editar a tabela do plano'
      using errcode = '42501';
  end if;

  perform 1 from rh.plano_tabelas where id = p_tabela_id for update;
  if not found then
    raise exception 'Tabela do plano não encontrada';
  end if;
  if jsonb_typeof(p_faixas) <> 'array' or jsonb_array_length(p_faixas) = 0 then
    raise exception 'Informe ao menos uma faixa';
  end if;

  delete from rh.plano_faixas_etarias where tabela_id = p_tabela_id;
  insert into rh.plano_faixas_etarias (tabela_id, idade_min, idade_max, mensalidade)
    select p_tabela_id, f.idade_min, f.idade_max, f.mensalidade
    from jsonb_to_recordset(p_faixas)
      as f(idade_min int, idade_max int, mensalidade numeric);

  if exists (
    select 1
    from rh.plano_faixas_etarias a
    join rh.plano_faixas_etarias b
      on b.tabela_id = a.tabela_id and b.idade_min > a.idade_min
    where a.tabela_id = p_tabela_id
      and (a.idade_max is null or a.idade_max >= b.idade_min)
  ) then
    raise exception 'Faixas sobrepostas. Confira as idades';
  end if;

  -- Marca a tabela como alterada (e registra na auditoria dela).
  update rh.plano_tabelas set atualizado_em = now() where id = p_tabela_id;
end;
$$;

revoke execute on function rh.salvar_faixas_plano(uuid, jsonb) from public, anon;
grant execute on function rh.salvar_faixas_plano(uuid, jsonb)
  to authenticated, service_role;
