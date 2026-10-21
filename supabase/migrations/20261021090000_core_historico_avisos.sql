-- O histórico das integrações passa a trazer os avisos de cada execução
-- (guardados pela sincronização em sync_runs.cursor_depois->'avisos'), para
-- a tela mostrar o que precisa de conferência. Os avisos não têm dado
-- pessoal: só ids e matrículas.

drop function core.historico_integracoes(int);

create function core.historico_integracoes(p_limite int default 20)
returns table (
  sistema text,
  recurso text,
  status integracao.status_sync,
  iniciado_em timestamptz,
  finalizado_em timestamptz,
  registros int,
  erro text,
  avisos jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.sistema, r.recurso, r.status, r.iniciado_em, r.finalizado_em,
    r.registros, left(r.erro, 300),
    case when jsonb_typeof(r.cursor_depois -> 'avisos') = 'array'
      then r.cursor_depois -> 'avisos' else '[]'::jsonb end
  from integracao.sync_runs r
  where core.pode('admin.integracoes')
  order by r.iniciado_em desc
  limit least(greatest(p_limite, 1), 100);
$$;

revoke all on function core.historico_integracoes(int) from public, anon;
grant execute on function core.historico_integracoes(int)
  to authenticated, service_role;
