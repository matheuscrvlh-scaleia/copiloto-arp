-- Saúde das integrações para o dashboard: a última execução de cada
-- sistema/recurso. Só a situação (quando, se deu certo, quantos registros);
-- nada do conteúdo sincronizado nem a mensagem de erro técnica.

create function core.saude_integracoes()
returns table (
  sistema text,
  recurso text,
  status integracao.status_sync,
  iniciado_em timestamptz,
  finalizado_em timestamptz,
  registros int,
  ultimo_sucesso timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (r.sistema, r.recurso)
    r.sistema,
    r.recurso,
    r.status,
    r.iniciado_em,
    r.finalizado_em,
    r.registros,
    (
      select max(s.finalizado_em)
      from integracao.sync_runs s
      where s.sistema = r.sistema and s.recurso = r.recurso and s.status = 'sucesso'
    )
  from integracao.sync_runs r
  where (select auth.uid()) is not null
  order by r.sistema, r.recurso, r.iniciado_em desc;
$$;

revoke all on function core.saude_integracoes() from public, anon;
grant execute on function core.saude_integracoes() to authenticated, service_role;
