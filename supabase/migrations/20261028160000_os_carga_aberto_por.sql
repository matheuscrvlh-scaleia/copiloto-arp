-- Carga por pessoa do Meu setor com o filtro "Abertos por mim".
--
-- "Abertos por mim" deixou de ser uma tela e virou filtro da Minha caixa e
-- do Meu setor. No Meu setor ele vale para a lista, os cartões e a carga:
-- p_aberto_por conta só os chamados abertos por essa pessoa. O resto é a
-- função de 20261026190000_os_carga_setor.sql, sem mudança.

drop function os.carga_do_setor(
  uuid, timestamptz, os.status_chamado[], os.tipo_chamado[], uuid, uuid,
  os.prioridade, text, timestamptz, timestamptz
);

create function os.carga_do_setor(
  p_setor uuid,
  p_agora timestamptz,
  p_status os.status_chamado[] default null,
  p_tipos os.tipo_chamado[] default null,
  p_categoria uuid default null,
  p_responsavel uuid default null,
  p_prioridade os.prioridade default null,
  p_etiqueta text default null,
  p_criado_desde timestamptz default null,
  p_criado_ate timestamptz default null,
  p_aberto_por uuid default null
)
returns table (responsavel_id uuid, abertos int, atrasados int)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.responsavel_id,
    count(*)::int as abertos,
    count(*) filter (where c.prazo < p_agora)::int as atrasados
  from os.chamados c
  where c.setor_id = p_setor
    and c.lixeira_em is null
    and c.status in ('aberto', 'em_andamento', 'aguardando')
    and (p_status is null or c.status = any (p_status))
    and (p_tipos is null or c.tipo = any (p_tipos))
    and (p_categoria is null or c.categoria_id = p_categoria)
    and (p_responsavel is null or c.responsavel_id = p_responsavel)
    and (p_prioridade is null or c.prioridade = p_prioridade)
    and (p_etiqueta is null or c.etiquetas @> array[p_etiqueta])
    and (p_criado_desde is null or c.criado_em >= p_criado_desde)
    and (p_criado_ate is null or c.criado_em <= p_criado_ate)
    and (p_aberto_por is null or c.aberto_por = p_aberto_por)
  group by c.responsavel_id;
$$;

revoke all on function os.carga_do_setor(
  uuid, timestamptz, os.status_chamado[], os.tipo_chamado[], uuid, uuid,
  os.prioridade, text, timestamptz, timestamptz, uuid
) from public, anon;
grant execute on function os.carga_do_setor(
  uuid, timestamptz, os.status_chamado[], os.tipo_chamado[], uuid, uuid,
  os.prioridade, text, timestamptz, timestamptz, uuid
) to authenticated, service_role;
