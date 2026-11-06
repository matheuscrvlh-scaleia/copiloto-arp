-- calendario: agenda da empresa (eventos, reuniões, obras, tarefas, feriados…).
--
-- Tudo é configurável: os tipos de item (nome, cor, ícone, quais campos o
-- formulário pede e quem vê por padrão) ficam em calendario.tipos. Cada item
-- diz quem o vê:
--   todos     quem abre o calendário;
--   restrito  só os setores (os.setores), cargos (core.cargos) e pessoas
--             marcados, além de quem criou e do responsável;
--   privado   só quem criou e o responsável.
-- Quem tem calendario.ver_todos vê também os restritos; os privados, nunca.
--
-- Datas em aaaa-mm-dd e horas locais (Brasília): sem fuso no banco, como a
-- empresa trabalha num lugar só. Sem hora = dia inteiro.

create schema calendario;
grant usage on schema calendario to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Permissões (mesmo catálogo de src/lib/permissions.ts)
-- ---------------------------------------------------------------------------

insert into core.permissoes (codigo, descricao) values
  ('calendario.ver', 'Abrir o calendário e ver o que foi compartilhado com você'),
  ('calendario.criar', 'Criar itens no calendário e editar ou excluir os próprios'),
  ('calendario.editar_todos', 'Editar, concluir e excluir os itens de outras pessoas que você vê'),
  ('calendario.ver_todos', 'Ver os itens restritos a outros setores, cargos e pessoas (os privados continuam só de quem criou)'),
  ('calendario.configurar', 'Configurar os tipos de item: nome, cor, ícone, campos e quem vê por padrão');

-- Administrador tem tudo. Os demais cargos começam vendo e criando (é a
-- agenda da empresa); o resto se marca em Usuários e cargos.
insert into core.cargo_permissoes (cargo_id, permissao)
  select c.id, p.codigo
  from core.cargos c
  join core.permissoes p on p.codigo like 'calendario.%'
  where c.nome = 'Administrador'
     or p.codigo in ('calendario.ver', 'calendario.criar')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Tipos de item
-- ---------------------------------------------------------------------------

create table calendario.tipos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) between 1 and 40),
  descricao text check (length(descricao) <= 200),
  cor text not null check (cor ~ '^#[0-9a-f]{6}$'),
  icone text not null default 'evento' check (icone ~ '^[a-z_]{1,30}$'),
  -- Campos do formulário.
  usa_horario boolean not null default true,      -- false: sempre dia inteiro
  usa_periodo boolean not null default false,     -- vários dias (obra, férias)
  usa_local boolean not null default true,
  usa_responsavel boolean not null default false,
  usa_conclusao boolean not null default false,   -- marcar como feito (tarefa)
  usa_recorrencia boolean not null default true,
  visibilidade_padrao text not null default 'todos'
    check (visibilidade_padrao in ('todos', 'restrito', 'privado')),
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index tipos_nome on calendario.tipos (lower(btrim(nome)));
create index tipos_ordem on calendario.tipos (ordem, nome);

insert into calendario.tipos
  (nome, descricao, cor, icone, usa_horario, usa_periodo, usa_local,
   usa_responsavel, usa_conclusao, usa_recorrencia, visibilidade_padrao, ordem)
values
  ('Evento', 'Eventos do Espaço e da empresa', '#2a78d6', 'evento', true, true, true, false, false, true, 'todos', 1),
  ('Reunião', 'Reuniões internas e com parceiros', '#7c5cd6', 'reuniao', true, false, true, true, false, true, 'restrito', 2),
  ('Tarefa', 'Algo a fazer até a data, com responsável', '#d97706', 'tarefa', true, false, false, true, true, true, 'restrito', 3),
  ('Obra', 'Obras e reformas: do início ao fim previsto', '#0f8a8a', 'obra', false, true, true, true, true, false, 'todos', 4),
  ('Feriado e folga', 'Dias sem expediente', '#dc2626', 'feriado', false, true, false, false, false, true, 'todos', 5);

-- ---------------------------------------------------------------------------
-- Itens
-- ---------------------------------------------------------------------------

create table calendario.itens (
  id uuid primary key default gen_random_uuid(),
  tipo_id uuid not null references calendario.tipos (id) on delete restrict,
  titulo text not null check (length(btrim(titulo)) between 1 and 160),
  descricao text check (length(descricao) <= 4000),
  local text check (length(local) <= 200),
  inicio date not null,
  fim date not null,
  hora_inicio time,
  hora_fim time,
  responsavel_id uuid references core.usuarios (id) on delete set null,
  concluido_em timestamptz,
  concluido_por uuid references core.usuarios (id) on delete set null,
  -- Repete a partir do início até recorrencia_ate (sem fim: para sempre).
  recorrencia text check (recorrencia in ('diaria', 'semanal', 'mensal', 'anual')),
  recorrencia_ate date,
  visibilidade text not null default 'todos'
    check (visibilidade in ('todos', 'restrito', 'privado')),
  setores uuid[] not null default '{}',
  cargos uuid[] not null default '{}',
  usuarios uuid[] not null default '{}',
  criado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (fim >= inicio and fim - inicio <= 366),
  check (hora_fim is null or hora_inicio is not null),
  check (hora_fim is null or fim > inicio or hora_fim > hora_inicio),
  check (recorrencia is not null or recorrencia_ate is null),
  check (recorrencia_ate is null or recorrencia_ate >= inicio),
  -- Item que repete não se conclui (seria a série inteira).
  check (recorrencia is null or concluido_em is null),
  check (
    visibilidade <> 'restrito'
    or cardinality(setores) + cardinality(cargos) + cardinality(usuarios) > 0
  ),
  check (cardinality(setores) <= 50 and cardinality(cargos) <= 50 and cardinality(usuarios) <= 200)
);

create index itens_tipo on calendario.itens (tipo_id);
create index itens_responsavel on calendario.itens (responsavel_id);
create index itens_criado_por on calendario.itens (criado_por);
create index itens_concluido_por on calendario.itens (concluido_por);
create index itens_inicio on calendario.itens (inicio);
create index itens_fim on calendario.itens (fim);
create index itens_recorrentes on calendario.itens (recorrencia_ate) where recorrencia is not null;
create index itens_setores on calendario.itens using gin (setores);
create index itens_cargos on calendario.itens using gin (cargos);
create index itens_usuarios on calendario.itens using gin (usuarios);

create trigger atualizado_em before update on calendario.tipos
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on calendario.itens
  for each row execute function core.set_atualizado_em();
create trigger auditoria after insert or update or delete on calendario.tipos
  for each row execute function core.auditar('id');
create trigger auditoria after insert or update or delete on calendario.itens
  for each row execute function core.auditar('id');

-- ---------------------------------------------------------------------------
-- Regras
-- ---------------------------------------------------------------------------

-- Cargo de acesso de quem está logado (para a visibilidade por cargo).
create function calendario.meu_cargo()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.cargo_id from core.usuarios u
  where u.id = (select auth.uid()) and u.ativo and u.cargo_id is not null;
$$;

-- Marca ou desmarca como feito. Pode quem criou, o responsável ou quem tem
-- calendario.editar_todos (e vê o item). O tipo precisa usar conclusão.
create function calendario.concluir(p_item uuid, p_feito boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item calendario.itens;
  v_tipo calendario.tipos;
  v_eu uuid := (select auth.uid());
begin
  if not core.pode('calendario.ver') then
    raise exception 'sem acesso ao calendário' using errcode = '42501';
  end if;
  select * into v_item from calendario.itens where id = p_item;
  if not found then
    raise exception 'item não encontrado' using errcode = 'P0001';
  end if;
  if not (
    v_item.criado_por = v_eu
    or v_item.responsavel_id = v_eu
    or (
      core.pode('calendario.editar_todos')
      and v_item.visibilidade <> 'privado'
      and (
        v_item.visibilidade = 'todos'
        or core.pode('calendario.ver_todos')
        or v_eu = any (v_item.usuarios)
        or v_item.setores && array(select os.meus_setores())
        or v_item.cargos && array(select calendario.meu_cargo())
      )
    )
  ) then
    raise exception 'só quem criou, o responsável ou quem edita todos conclui este item'
      using errcode = 'P0001';
  end if;
  select * into v_tipo from calendario.tipos where id = v_item.tipo_id;
  if not v_tipo.usa_conclusao then
    raise exception 'este tipo de item não se conclui' using errcode = 'P0001';
  end if;
  if v_item.recorrencia is not null then
    raise exception 'item que se repete não se conclui' using errcode = 'P0001';
  end if;
  update calendario.itens
    set concluido_em = case when p_feito then now() end,
        concluido_por = case when p_feito then v_eu end
    where id = p_item;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table calendario.tipos enable row level security;
alter table calendario.itens enable row level security;

create policy ver on calendario.tipos for select to authenticated
  using ((select core.pode('calendario.ver')) or (select core.pode('calendario.configurar')));
create policy criar on calendario.tipos for insert to authenticated
  with check ((select core.pode('calendario.configurar')));
create policy editar on calendario.tipos for update to authenticated
  using ((select core.pode('calendario.configurar')))
  with check ((select core.pode('calendario.configurar')));
create policy excluir on calendario.tipos for delete to authenticated
  using ((select core.pode('calendario.configurar')));

-- Quem vê: ver o cabeçalho deste arquivo.
create policy ver on calendario.itens for select to authenticated
  using (
    (select core.pode('calendario.ver'))
    and (
      visibilidade = 'todos'
      or criado_por = (select auth.uid())
      or responsavel_id = (select auth.uid())
      or (
        visibilidade = 'restrito'
        and (
          (select core.pode('calendario.ver_todos'))
          or usuarios && array[(select auth.uid())]
          or setores && array(select os.meus_setores())
          or cargos && array(select calendario.meu_cargo())
        )
      )
    )
  );

-- Cria em nome próprio, num tipo ativo.
create policy criar on calendario.itens for insert to authenticated
  with check (
    (select core.pode('calendario.criar'))
    and criado_por = (select auth.uid())
    and exists (select 1 from calendario.tipos t where t.id = tipo_id and t.ativo)
  );

-- Edita e exclui: os próprios (com calendario.criar) ou, com
-- calendario.editar_todos, os que vê (o UPDATE e o DELETE filtrados também
-- passam pela política de leitura). Privado de outra pessoa, nunca.
create policy editar on calendario.itens for update to authenticated
  using (
    ((select core.pode('calendario.criar')) and criado_por = (select auth.uid()))
    or ((select core.pode('calendario.editar_todos')) and visibilidade <> 'privado')
  )
  with check (
    exists (select 1 from calendario.tipos t where t.id = tipo_id and t.ativo)
    and (
      ((select core.pode('calendario.criar')) and criado_por = (select auth.uid()))
      or (select core.pode('calendario.editar_todos'))
    )
  );
create policy excluir on calendario.itens for delete to authenticated
  using (
    ((select core.pode('calendario.criar')) and criado_por = (select auth.uid()))
    or ((select core.pode('calendario.editar_todos')) and visibilidade <> 'privado')
  );

-- ---------------------------------------------------------------------------
-- Acessos
-- ---------------------------------------------------------------------------

grant select on all tables in schema calendario to authenticated;
grant insert, update, delete on calendario.tipos to authenticated;
-- Quem criou e a conclusão não mudam pela tela (concluir é pela função).
grant insert (tipo_id, titulo, descricao, local, inicio, fim, hora_inicio,
  hora_fim, responsavel_id, recorrencia, recorrencia_ate, visibilidade,
  setores, cargos, usuarios) on calendario.itens to authenticated;
grant update (tipo_id, titulo, descricao, local, inicio, fim, hora_inicio,
  hora_fim, responsavel_id, recorrencia, recorrencia_ate, visibilidade,
  setores, cargos, usuarios) on calendario.itens to authenticated;
grant delete on calendario.itens to authenticated;
grant all on all tables in schema calendario to service_role;

revoke all on all functions in schema calendario from public, anon;
grant execute on function calendario.meu_cargo() to authenticated, service_role;
grant execute on function calendario.concluir(uuid, boolean) to authenticated;
