-- Carga por pessoa do Meu setor contada no banco.
--
-- Antes, o servidor lia o responsável e o prazo de até 5000 chamados em
-- aberto do setor e contava em JavaScript; acima disso a conta saía
-- incompleta. Aqui a contagem é um group by, com os mesmos filtros da barra.
--
-- security invoker: a função lê os.chamados com o RLS de quem chama (a
-- política `ver`), então cada pessoa conta só o que vê na lista.
--
-- O que só o servidor sabe vem por parâmetro:
-- - p_agora: o instante da visita (o mesmo "agora" dos cartões);
-- - p_criado_desde / p_criado_ate: o período de abertura já convertido para
--   Brasília pelo servidor (o mesmo filtro da lista).
--
-- "Em aberto" é aberto, em andamento ou aguardando (o cartão "Abertos"); com
-- status na barra (p_status), só os que estão nos dois. Atrasado: prazo antes
-- de p_agora (como o cartão "Atrasados"; sem calendário nem expediente).
-- Fora da lixeira. A fila (sem responsável) volta com responsavel_id nulo.

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
  p_criado_ate timestamptz default null
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
  group by c.responsavel_id;
$$;

revoke all on function os.carga_do_setor(
  uuid, timestamptz, os.status_chamado[], os.tipo_chamado[], uuid, uuid,
  os.prioridade, text, timestamptz, timestamptz
) from public, anon;
grant execute on function os.carga_do_setor(
  uuid, timestamptz, os.status_chamado[], os.tipo_chamado[], uuid, uuid,
  os.prioridade, text, timestamptz, timestamptz
) to authenticated, service_role;
