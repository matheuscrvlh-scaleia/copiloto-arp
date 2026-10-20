-- Administração: cargos de acesso, dados da empresa e credenciais das
-- integrações. Desenho em docs/modelo-de-dados.md.

-- ---------------------------------------------------------------------------
-- Permissões novas (mesmo catálogo de src/lib/permissions.ts)
-- ---------------------------------------------------------------------------

insert into core.permissoes (codigo, descricao) values
  ('admin.empresa', 'Editar os dados da empresa'),
  ('admin.integracoes', 'Configurar, testar e sincronizar as integrações');

update core.permissoes
  set descricao = 'Gerenciar usuários, cargos e permissões'
  where codigo = 'admin.usuarios';

-- Quem já administra os usuários passa a administrar o resto.
insert into core.usuario_permissoes (usuario_id, permissao)
  select up.usuario_id, novas.codigo
  from core.usuario_permissoes up
  cross join (select unnest(array['admin.empresa', 'admin.integracoes']) as codigo) novas
  where up.permissao = 'admin.usuarios'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Cargos de acesso: conjunto de permissões dado a um grupo de usuários.
-- Não confundir com rh.cargos (cargo do funcionário na folha).
-- A permissão do usuário é a do cargo somada às individuais.
-- ---------------------------------------------------------------------------

create table core.cargos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (btrim(nome) <> ''),
  descricao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table core.cargo_permissoes (
  cargo_id uuid not null references core.cargos (id) on delete cascade,
  permissao text not null references core.permissoes (codigo) on update cascade on delete cascade,
  primary key (cargo_id, permissao)
);

alter table core.usuarios
  add column cargo_id uuid references core.cargos (id) on delete set null;
create index usuarios_cargo on core.usuarios (cargo_id);

-- Pontos de partida; o administrador renomeia, apaga ou cria outros.
insert into core.cargos (nome, descricao) values
  ('Administrador', 'Acesso a tudo, inclusive à Administração'),
  ('Diretoria', 'Todos os painéis do RH e do Financeiro'),
  ('Gestão de RH', 'Telas e parâmetros do RH'),
  ('Financeiro', 'Telas e parâmetros do Financeiro');

insert into core.cargo_permissoes (cargo_id, permissao)
  select c.id, p.codigo
  from core.cargos c
  join core.permissoes p on case c.nome
    when 'Administrador' then true
    when 'Diretoria' then p.codigo like 'rh.%' or p.codigo like 'financeiro.%'
    when 'Gestão de RH' then p.codigo like 'rh.%'
    when 'Financeiro' then p.codigo like 'financeiro.%'
  end;

-- O usuário logado (ativo) tem a permissão, pelo cargo ou individual?
create or replace function core.pode(p text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from core.usuarios u
    where u.id = (select auth.uid())
      and u.ativo
      and (
        exists (
          select 1 from core.usuario_permissoes up
          where up.usuario_id = u.id and up.permissao = p
        )
        or exists (
          select 1 from core.cargo_permissoes cp
          where cp.cargo_id = u.cargo_id and cp.permissao = p
        )
      )
  );
$$;

-- O usuário logado tem alguma permissão do módulo ('rh', 'financeiro')?
create or replace function core.pode_modulo(modulo text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from core.usuarios u
    where u.id = (select auth.uid())
      and u.ativo
      and (
        exists (
          select 1 from core.usuario_permissoes up
          where up.usuario_id = u.id and up.permissao like modulo || '.%'
        )
        or exists (
          select 1 from core.cargo_permissoes cp
          where cp.cargo_id = u.cargo_id and cp.permissao like modulo || '.%'
        )
      )
  );
$$;

-- Permissões do usuário logado (cargo + individuais). Vazio se desativado.
create function core.minhas_permissoes()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select up.permissao
  from core.usuario_permissoes up
  join core.usuarios u on u.id = up.usuario_id
  where u.id = (select auth.uid()) and u.ativo
  union
  select cp.permissao
  from core.cargo_permissoes cp
  join core.usuarios u on u.cargo_id = cp.cargo_id
  where u.id = (select auth.uid()) and u.ativo;
$$;

revoke all on function core.minhas_permissoes() from public, anon;
grant execute on function core.minhas_permissoes() to authenticated, service_role;

-- Ninguém tira o último administrador ativo pela aplicação (nem de si mesmo).
-- A service role e as migrations (sem auth.uid()) não passam por esta trava.
create function core.garantir_um_administrador()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return null;
  end if;
  if not exists (
    select 1
    from core.usuarios u
    where u.ativo
      and (
        exists (
          select 1 from core.usuario_permissoes up
          where up.usuario_id = u.id and up.permissao = 'admin.usuarios'
        )
        or exists (
          select 1 from core.cargo_permissoes cp
          where cp.cargo_id = u.cargo_id and cp.permissao = 'admin.usuarios'
        )
      )
  ) then
    raise exception 'é preciso manter pelo menos um administrador ativo'
      using errcode = 'P0001';
  end if;
  return null;
end;
$$;

create trigger um_administrador after delete on core.usuario_permissoes
  for each statement execute function core.garantir_um_administrador();
create trigger um_administrador after delete on core.cargo_permissoes
  for each statement execute function core.garantir_um_administrador();
create trigger um_administrador after update of ativo, cargo_id on core.usuarios
  for each statement execute function core.garantir_um_administrador();

create trigger atualizado_em before update on core.cargos
  for each row execute function core.set_atualizado_em();
create trigger auditoria after insert or update or delete on core.cargos
  for each row execute function core.auditar('id');
create trigger auditoria after insert or update or delete on core.cargo_permissoes
  for each row execute function core.auditar('cargo_id', 'permissao');

alter table core.cargos enable row level security;
alter table core.cargo_permissoes enable row level security;

-- Cada um vê o próprio cargo; o administrador vê e edita todos.
create policy ver on core.cargos for select to authenticated
  using (
    core.pode('admin.usuarios')
    or id = (select u.cargo_id from core.usuarios u where u.id = (select auth.uid()))
  );
create policy criar on core.cargos for insert to authenticated
  with check (core.pode('admin.usuarios'));
create policy editar on core.cargos for update to authenticated
  using (core.pode('admin.usuarios')) with check (core.pode('admin.usuarios'));
create policy apagar on core.cargos for delete to authenticated
  using (core.pode('admin.usuarios'));

create policy ver on core.cargo_permissoes for select to authenticated
  using (
    core.pode('admin.usuarios')
    or cargo_id = (select u.cargo_id from core.usuarios u where u.id = (select auth.uid()))
  );
create policy conceder on core.cargo_permissoes for insert to authenticated
  with check (core.pode('admin.usuarios'));
create policy revogar on core.cargo_permissoes for delete to authenticated
  using (core.pode('admin.usuarios'));

grant select, insert, update, delete on core.cargos to authenticated;
grant select, insert, delete on core.cargo_permissoes to authenticated;
grant all on core.cargos, core.cargo_permissoes to service_role;

-- O e-mail vem do Auth: pela aplicação só mudam nome, situação e cargo.
revoke update on core.usuarios from authenticated;
grant update (nome, ativo, cargo_id) on core.usuarios to authenticated;

-- ---------------------------------------------------------------------------
-- Empresa: uma linha só, com a identificação usada nas telas e relatórios.
-- ---------------------------------------------------------------------------

create table core.empresa (
  id boolean primary key default true check (id),
  -- Nome curto exibido no menu e nas telas.
  nome text not null check (btrim(nome) <> ''),
  razao_social text,
  cnpj text check (cnpj ~ '^[0-9]{14}$'),
  email text,
  telefone text,
  site text,
  endereco text,
  cidade text,
  uf text check (uf ~ '^[A-Z]{2}$'),
  cep text check (cep ~ '^[0-9]{8}$'),
  atualizado_em timestamptz not null default now()
);

insert into core.empresa (nome) values ('ARP');

create trigger atualizado_em before update on core.empresa
  for each row execute function core.set_atualizado_em();
create trigger auditoria after update on core.empresa
  for each row execute function core.auditar('id');

alter table core.empresa enable row level security;
create policy ver on core.empresa for select to authenticated using (true);
create policy editar on core.empresa for update to authenticated
  using (core.pode('admin.empresa')) with check (core.pode('admin.empresa'));

grant select, update on core.empresa to authenticated;
grant all on core.empresa to service_role;

-- ---------------------------------------------------------------------------
-- Credenciais das integrações. Ficam no schema integracao (só a service role
-- lê). O segredo (senha ou token) chega já cifrado pelo servidor; o banco
-- nunca vê o texto aberto. A tela usa as funções abaixo, que conferem a
-- permissão admin.integracoes e nunca devolvem o segredo.
-- ---------------------------------------------------------------------------

create table integracao.credenciais (
  sistema text primary key check (sistema in ('secullum', 'wps', 'diario_de_obras')),
  -- O que não é segredo (usuário, banco, URL…), para mostrar e editar.
  parametros jsonb not null default '{}',
  -- AES-256-GCM com a chave INTEGRACOES_CHAVE, que só o servidor tem.
  segredo_cifrado text not null,
  ativa boolean not null default true,
  configurado_por uuid references core.usuarios (id) on delete set null,
  configurado_em timestamptz not null default now(),
  testado_em timestamptz,
  teste_ok boolean,
  teste_mensagem text
);

alter table integracao.credenciais enable row level security;
grant all on integracao.credenciais to service_role;

create function core.integracoes_configuradas()
returns table (
  sistema text,
  parametros jsonb,
  ativa boolean,
  configurado_por text,
  configurado_em timestamptz,
  testado_em timestamptz,
  teste_ok boolean,
  teste_mensagem text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.sistema, c.parametros, c.ativa, u.nome, c.configurado_em,
    c.testado_em, c.teste_ok, c.teste_mensagem
  from integracao.credenciais c
  left join core.usuarios u on u.id = c.configurado_por
  where core.pode('admin.integracoes')
  order by c.sistema;
$$;

-- Salva parâmetros e, se vier, o segredo novo (null mantém o atual).
-- Registra na auditoria só o que mudou, nunca o segredo.
create function core.salvar_integracao(
  p_sistema text,
  p_parametros jsonb,
  p_segredo_cifrado text,
  p_ativa boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  anterior jsonb;
begin
  if not core.pode('admin.integracoes') then
    raise exception 'sem permissão para configurar integrações' using errcode = '42501';
  end if;

  select jsonb_build_object('parametros', c.parametros, 'ativa', c.ativa)
    into anterior
    from integracao.credenciais c
    where c.sistema = p_sistema;

  if anterior is null then
    if p_segredo_cifrado is null then
      raise exception 'informe a senha ou o token' using errcode = '22023';
    end if;
    insert into integracao.credenciais
      (sistema, parametros, segredo_cifrado, ativa, configurado_por)
    values
      (p_sistema, coalesce(p_parametros, '{}'), p_segredo_cifrado,
       coalesce(p_ativa, true), (select auth.uid()));
  else
    update integracao.credenciais c set
      parametros = coalesce(p_parametros, '{}'),
      segredo_cifrado = coalesce(p_segredo_cifrado, c.segredo_cifrado),
      ativa = coalesce(p_ativa, c.ativa),
      configurado_por = (select auth.uid()),
      configurado_em = now(),
      testado_em = null,
      teste_ok = null,
      teste_mensagem = null
    where c.sistema = p_sistema;
  end if;

  insert into core.auditoria (tabela, registro_id, acao, antes, depois, usuario_id)
  values (
    'integracao.credenciais',
    p_sistema,
    case when anterior is null then 'insert' else 'update' end,
    anterior,
    jsonb_build_object(
      'parametros', coalesce(p_parametros, '{}'),
      'ativa', coalesce(p_ativa, true),
      'segredo_trocado', p_segredo_cifrado is not null
    ),
    (select auth.uid())
  );
end;
$$;

create function core.registrar_teste_integracao(
  p_sistema text,
  p_ok boolean,
  p_mensagem text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not core.pode('admin.integracoes') then
    raise exception 'sem permissão para configurar integrações' using errcode = '42501';
  end if;
  update integracao.credenciais set
    testado_em = now(),
    teste_ok = p_ok,
    teste_mensagem = left(p_mensagem, 500)
  where sistema = p_sistema;
end;
$$;

create function core.remover_integracao(p_sistema text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  anterior jsonb;
begin
  if not core.pode('admin.integracoes') then
    raise exception 'sem permissão para configurar integrações' using errcode = '42501';
  end if;
  delete from integracao.credenciais c
    where c.sistema = p_sistema
    returning jsonb_build_object('parametros', c.parametros, 'ativa', c.ativa)
    into anterior;
  if anterior is not null then
    insert into core.auditoria (tabela, registro_id, acao, antes, depois, usuario_id)
    values ('integracao.credenciais', p_sistema, 'delete', anterior, null, (select auth.uid()));
  end if;
end;
$$;

-- Últimas execuções, com a mensagem de erro (só para quem configura).
create function core.historico_integracoes(p_limite int default 20)
returns table (
  sistema text,
  recurso text,
  status integracao.status_sync,
  iniciado_em timestamptz,
  finalizado_em timestamptz,
  registros int,
  erro text
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.sistema, r.recurso, r.status, r.iniciado_em, r.finalizado_em,
    r.registros, left(r.erro, 300)
  from integracao.sync_runs r
  where core.pode('admin.integracoes')
  order by r.iniciado_em desc
  limit least(greatest(p_limite, 1), 100);
$$;

-- Para o dashboard: só se cada sistema está configurado e passou no teste.
create function core.estado_integracoes()
returns table (sistema text, ativa boolean, teste_ok boolean, testado_em timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select c.sistema, c.ativa, c.teste_ok, c.testado_em
  from integracao.credenciais c
  where (select auth.uid()) is not null;
$$;

revoke all on function core.integracoes_configuradas() from public, anon;
revoke all on function core.salvar_integracao(text, jsonb, text, boolean) from public, anon;
revoke all on function core.registrar_teste_integracao(text, boolean, text) from public, anon;
revoke all on function core.remover_integracao(text) from public, anon;
revoke all on function core.historico_integracoes(int) from public, anon;
revoke all on function core.estado_integracoes() from public, anon;
revoke all on function core.garantir_um_administrador() from public, anon, authenticated;
grant execute on function
  core.integracoes_configuradas(),
  core.salvar_integracao(text, jsonb, text, boolean),
  core.registrar_teste_integracao(text, boolean, text),
  core.remover_integracao(text),
  core.historico_integracoes(int),
  core.estado_integracoes()
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Auditoria: quem vê o histórico das tabelas novas
-- ---------------------------------------------------------------------------

drop policy ver on core.auditoria;
create policy ver on core.auditoria for select to authenticated
  using (
    case
      when tabela like 'rh.%' then core.pode('rh.parametros')
      when tabela = 'core.metas' then core.pode('rh.parametros') or core.pode('financeiro.importacao_parametros')
      when tabela in ('core.usuario_permissoes', 'core.usuarios', 'core.cargos', 'core.cargo_permissoes')
        then core.pode('admin.usuarios')
      when tabela = 'core.empresa' then core.pode('admin.empresa')
      when tabela = 'integracao.credenciais' then core.pode('admin.integracoes')
      else false
    end
  );
