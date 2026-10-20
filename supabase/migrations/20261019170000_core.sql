-- core: usuários, permissões, metas, importações, auditoria e preferências.
-- Modelo descrito em docs/modelo-de-dados.md.

create schema core;
grant usage on schema core to authenticated, service_role;

-- Competência: sempre o dia 1 do mês.
create domain core.competencia as date
  check (value is null or extract(day from value) = 1);

create function core.set_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Usuários e permissões
-- ---------------------------------------------------------------------------

create table core.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  email text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table core.permissoes (
  codigo text primary key,
  descricao text not null
);

create table core.usuario_permissoes (
  usuario_id uuid not null references core.usuarios (id) on delete cascade,
  permissao text not null references core.permissoes (codigo) on update cascade on delete cascade,
  concedida_por uuid references core.usuarios (id) on delete set null,
  concedida_em timestamptz not null default now(),
  primary key (usuario_id, permissao)
);

-- Perfil criado junto com o usuário do Auth.
create function core.criar_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into core.usuarios (id, nome, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

create trigger criar_usuario
after insert on auth.users
for each row execute function core.criar_usuario();

-- O usuário logado (ativo) tem a permissão?
create function core.pode(p text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from core.usuario_permissoes up
    join core.usuarios u on u.id = up.usuario_id
    where up.usuario_id = (select auth.uid())
      and up.permissao = p
      and u.ativo
  );
$$;

-- O usuário logado tem alguma permissão do módulo ('rh', 'financeiro')?
create function core.pode_modulo(modulo text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from core.usuario_permissoes up
    join core.usuarios u on u.id = up.usuario_id
    where up.usuario_id = (select auth.uid())
      and up.permissao like modulo || '.%'
      and u.ativo
  );
$$;

-- ---------------------------------------------------------------------------
-- Auditoria: quem mudou, quando, antes e depois.
-- Uso: create trigger auditoria after insert or update or delete on <tabela>
--      for each row execute function core.auditar('<coluna_pk>' [, ...]);
-- ---------------------------------------------------------------------------

create table core.auditoria (
  id bigint generated always as identity primary key,
  tabela text not null,
  registro_id text not null,
  acao text not null check (acao in ('insert', 'update', 'delete')),
  antes jsonb,
  depois jsonb,
  usuario_id uuid,
  em timestamptz not null default now()
);

create index auditoria_tabela_registro on core.auditoria (tabela, registro_id, em desc);

create function core.auditar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  linha jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  chave text := '';
  i int;
begin
  for i in 0 .. tg_nargs - 1 loop
    chave := chave || case when i > 0 then ':' else '' end || coalesce(linha ->> tg_argv[i], '');
  end loop;

  insert into core.auditoria (tabela, registro_id, acao, antes, depois, usuario_id)
  values (
    tg_table_schema || '.' || tg_table_name,
    chave,
    lower(tg_op),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end,
    (select auth.uid())
  );
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Metas e semáforo de qualquer indicador (RH e Financeiro)
-- ---------------------------------------------------------------------------

create type core.direcao_meta as enum ('maior_melhor', 'menor_melhor');

create table core.metas (
  id uuid primary key default gen_random_uuid(),
  indicador text not null check (indicador ~ '^[a-z_]+\.[a-z0-9_]+$'),
  direcao core.direcao_meta not null,
  meta numeric not null,
  -- Até onde o indicador fica em "Atenção" antes de "Fora". Null: sem faixa amarela.
  limite_atencao numeric,
  vigente_desde core.competencia not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (indicador, vigente_desde)
);

-- ---------------------------------------------------------------------------
-- Importações de arquivo (folha, tabela do plano…)
-- ---------------------------------------------------------------------------

create type core.tipo_importacao as enum ('folha', 'plano_saude');
create type core.status_importacao as enum ('previa', 'confirmada', 'substituida', 'revertida');

create table core.importacoes (
  id uuid primary key default gen_random_uuid(),
  tipo core.tipo_importacao not null,
  -- Competência (folha) ou início de vigência (plano), sempre dia 1.
  referencia core.competencia not null,
  arquivo_nome text not null,
  -- Caminho no bucket privado "importacoes": <tipo>/<id>/<arquivo>.
  arquivo_path text not null,
  arquivo_sha256 text not null,
  status core.status_importacao not null default 'previa',
  avisos jsonb not null default '[]',
  enviado_por uuid references core.usuarios (id) on delete set null,
  confirmado_por uuid references core.usuarios (id) on delete set null,
  confirmado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Só uma importação vale por tipo e referência.
create unique index importacoes_uma_confirmada
  on core.importacoes (tipo, referencia)
  where status = 'confirmada';

-- ---------------------------------------------------------------------------
-- Preferências por usuário (últimos filtros de cada tela)
-- ---------------------------------------------------------------------------

create table core.preferencias (
  usuario_id uuid not null references core.usuarios (id) on delete cascade,
  chave text not null,
  valor jsonb not null,
  atualizado_em timestamptz not null default now(),
  primary key (usuario_id, chave)
);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger atualizado_em before update on core.usuarios
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on core.metas
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on core.importacoes
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on core.preferencias
  for each row execute function core.set_atualizado_em();

create trigger auditoria after insert or update or delete on core.usuario_permissoes
  for each row execute function core.auditar('usuario_id', 'permissao');
create trigger auditoria after insert or update or delete on core.metas
  for each row execute function core.auditar('id');
create trigger auditoria after update on core.usuarios
  for each row execute function core.auditar('id');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table core.usuarios enable row level security;
alter table core.permissoes enable row level security;
alter table core.usuario_permissoes enable row level security;
alter table core.auditoria enable row level security;
alter table core.metas enable row level security;
alter table core.importacoes enable row level security;
alter table core.preferencias enable row level security;

create policy ver on core.usuarios for select to authenticated
  using (id = (select auth.uid()) or core.pode('admin.usuarios'));
create policy gerenciar on core.usuarios for update to authenticated
  using (core.pode('admin.usuarios')) with check (core.pode('admin.usuarios'));

create policy ver on core.permissoes for select to authenticated using (true);

create policy ver on core.usuario_permissoes for select to authenticated
  using (usuario_id = (select auth.uid()) or core.pode('admin.usuarios'));
create policy conceder on core.usuario_permissoes for insert to authenticated
  with check (core.pode('admin.usuarios'));
create policy revogar on core.usuario_permissoes for delete to authenticated
  using (core.pode('admin.usuarios'));

create policy ver on core.auditoria for select to authenticated
  using (
    case
      when tabela like 'rh.%' then core.pode('rh.parametros')
      when tabela = 'core.metas' then core.pode('rh.parametros') or core.pode('financeiro.importacao_parametros')
      when tabela in ('core.usuario_permissoes', 'core.usuarios') then core.pode('admin.usuarios')
      else false
    end
  );

create policy ver on core.metas for select to authenticated
  using (core.pode_modulo(split_part(indicador, '.', 1)));
create policy editar on core.metas for all to authenticated
  using (
    (indicador like 'rh.%' and core.pode('rh.parametros'))
    or (indicador like 'financeiro.%' and core.pode('financeiro.importacao_parametros'))
  )
  with check (
    (indicador like 'rh.%' and core.pode('rh.parametros'))
    or (indicador like 'financeiro.%' and core.pode('financeiro.importacao_parametros'))
  );

create function core.pode_importar(t core.tipo_importacao)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case t
    when 'folha' then core.pode('rh.folha')
    when 'plano_saude' then core.pode('rh.beneficios')
  end;
$$;

create policy ver on core.importacoes for select to authenticated
  using (core.pode_importar(tipo));
create policy enviar on core.importacoes for insert to authenticated
  with check (core.pode_importar(tipo) and enviado_por = (select auth.uid()));
create policy atualizar on core.importacoes for update to authenticated
  using (core.pode_importar(tipo)) with check (core.pode_importar(tipo));

create policy proprias on core.preferencias for all to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Privilégios (o RLS decide as linhas)
-- ---------------------------------------------------------------------------

grant select on all tables in schema core to authenticated;
grant update on core.usuarios to authenticated;
grant insert, delete on core.usuario_permissoes to authenticated;
grant insert, update, delete on core.metas to authenticated;
grant insert, update on core.importacoes to authenticated;
grant insert, update, delete on core.preferencias to authenticated;
grant all on all tables in schema core to service_role;
grant usage on all sequences in schema core to service_role;
grant execute on all functions in schema core to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Storage: bucket privado para os arquivos importados
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('importacoes', 'importacoes', false);

create policy importacoes_ver on storage.objects for select to authenticated
  using (
    bucket_id = 'importacoes'
    and (
      ((storage.foldername(name))[1] = 'folha' and core.pode('rh.folha'))
      or ((storage.foldername(name))[1] = 'plano_saude' and core.pode('rh.beneficios'))
    )
  );

create policy importacoes_enviar on storage.objects for insert to authenticated
  with check (
    bucket_id = 'importacoes'
    and (
      ((storage.foldername(name))[1] = 'folha' and core.pode('rh.folha'))
      or ((storage.foldername(name))[1] = 'plano_saude' and core.pode('rh.beneficios'))
    )
  );
