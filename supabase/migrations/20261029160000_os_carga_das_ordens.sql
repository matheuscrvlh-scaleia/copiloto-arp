-- Carga por pessoa do Geral das OS (aba Geral de Ordens de serviço).
--
-- A mesma conta de os.carga_do_setor (20261028210000), sobre os.ordens: em
-- aberto e atrasados de cada responsável do setor, com os filtros da barra.
-- Sem p_tipos: toda linha de os.ordens é OS. security invoker: conta só o
-- que quem pede vê (RLS de os.ordens).

create function os.carga_das_ordens(
  p_setor uuid,
  p_agora timestamptz,
  p_status os.status_chamado[] default null,
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
    o.responsavel_id,
    count(*)::int as abertos,
    count(*) filter (where o.prazo < p_agora)::int as atrasados
  from os.ordens o
  where o.setor_id = p_setor
    and o.status in ('aberto', 'em_andamento', 'aguardando')
    and (p_status is null or o.status = any (p_status))
    and (p_categoria is null or o.categoria_id = p_categoria)
    and (p_responsavel is null or o.responsavel_id = p_responsavel)
    and (p_prioridade is null or o.prioridade = p_prioridade)
    and (p_etiqueta is null or o.etiquetas @> array[p_etiqueta])
    and (p_criado_desde is null or o.criado_em >= p_criado_desde)
    and (p_criado_ate is null or o.criado_em <= p_criado_ate)
    and (p_aberto_por is null or o.aberto_por = p_aberto_por)
  group by o.responsavel_id;
$$;

revoke all on function os.carga_das_ordens(
  uuid, timestamptz, os.status_chamado[], uuid, uuid, os.prioridade, text,
  timestamptz, timestamptz, uuid
) from public, anon;
grant execute on function os.carga_das_ordens(
  uuid, timestamptz, os.status_chamado[], uuid, uuid, os.prioridade, text,
  timestamptz, timestamptz, uuid
) to authenticated, service_role;
