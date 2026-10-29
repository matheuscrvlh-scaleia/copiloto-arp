-- Aviso é para ser lido, não executado: cada pessoa que recebe aperta "Li".
-- A aba Avisos conta e filtra por lido e não lido (de quem recebe) e por
-- "todos leram" (de quem mandou).
--
-- Quem recebe: as pessoas dos destinos (setor inteiro ou a pessoa); sem
-- destinos, o responsável ou, sem ele, o setor do aviso. Quem mandou não
-- conta, nem usuário inativo.

create table os.leituras (
  chamado_id uuid not null references os.chamados (id) on delete cascade,
  usuario_id uuid not null default auth.uid() references core.usuarios (id) on delete cascade,
  lido_em timestamptz not null default now(),
  primary key (chamado_id, usuario_id)
);
create index leituras_usuario on os.leituras (usuario_id);

alter table os.leituras enable row level security;

-- Quem vê o aviso vê quem já leu; cada um só marca a própria leitura, de um
-- aviso que vê.
create policy ver on os.leituras for select to authenticated
  using (exists (select 1 from os.chamados c where c.id = leituras.chamado_id));
create policy incluir on os.leituras for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and exists (
      select 1 from os.chamados c
      where c.id = leituras.chamado_id and c.tipo = 'aviso'
    )
  );

-- Leitura não se desfaz.
grant select, insert on os.leituras to authenticated;
grant all on os.leituras to service_role;

-- Por aviso, de uma vez (a lista de quem mandou mostra "3 de 5 leram"). Só
-- dos avisos que quem pergunta vê.
create function os.leitores_dos_avisos(p_chamados uuid[])
returns table (chamado_id uuid, usuario_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with c as (
    select id, setor_id, responsavel_id, aberto_por,
      exists (select 1 from os.destinatarios d where d.chamado_id = id) as com_destinos
    from os.chamados
    where id = any (p_chamados) and tipo = 'aviso' and os.pode_ver_chamado(id)
  ),
  pessoas as (
    select c.id, d.usuario_id
    from c join os.destinatarios d on d.chamado_id = c.id
    where d.usuario_id is not null
    union
    select c.id, m.usuario_id
    from c
    join os.destinatarios d on d.chamado_id = c.id and d.usuario_id is null
    join os.setor_membros m on m.setor_id = d.setor_id
    union
    select c.id, c.responsavel_id from c
    where not c.com_destinos and c.responsavel_id is not null
    union
    select c.id, m.usuario_id
    from c join os.setor_membros m on m.setor_id = c.setor_id
    where not c.com_destinos and c.responsavel_id is null
  )
  select p.id, p.usuario_id
  from pessoas p
  join c on c.id = p.id
  join core.usuarios u on u.id = p.usuario_id and u.ativo
  where p.usuario_id is distinct from c.aberto_por;
$$;

-- Campos calculados (o PostgREST filtra e ordena por eles, como colunas).
create function os.lido_por_mim(c os.chamados)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from os.leituras l
    where l.chamado_id = c.id and l.usuario_id = (select auth.uid())
  );
$$;

create function os.todos_leram(c os.chamados)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from os.leitores_dos_avisos(array[c.id]) p
    where not exists (
      select 1 from os.leituras l
      where l.chamado_id = c.id and l.usuario_id = p.usuario_id
    )
  );
$$;

revoke all on function
  os.leitores_dos_avisos(uuid[]),
  os.lido_por_mim(os.chamados),
  os.todos_leram(os.chamados)
from public, anon;
grant execute on function
  os.leitores_dos_avisos(uuid[]),
  os.lido_por_mim(os.chamados),
  os.todos_leram(os.chamados)
to authenticated, service_role;

-- Aviso não tem prazo: os em aberto perdem o que tinham (e os lembretes).
update os.destinatarios d set prazo = null
from os.chamados c
where c.id = d.chamado_id and c.tipo = 'aviso' and d.prazo is not null;
update os.chamados set prazo = null
where tipo = 'aviso' and prazo is not null
  and status not in ('concluido', 'fechado', 'cancelado');
