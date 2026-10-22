-- Inativar cargo e excluir usuário.
--
-- Cargo inativo: continua ligado aos usuários, mas não dá permissão
-- nenhuma (ficam só as individuais). Reativar devolve tudo.

alter table core.cargos add column ativo boolean not null default true;

-- O usuário logado (ativo) tem a permissão, pelo cargo ativo ou individual?
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
          join core.cargos c on c.id = cp.cargo_id
          where cp.cargo_id = u.cargo_id and c.ativo and cp.permissao = p
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
          join core.cargos c on c.id = cp.cargo_id
          where cp.cargo_id = u.cargo_id and c.ativo
            and cp.permissao like modulo || '.%'
        )
      )
  );
$$;

-- Permissões do usuário logado (cargo ativo + individuais). Vazio se desativado.
create or replace function core.minhas_permissoes()
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
  join core.cargos c on c.id = cp.cargo_id and c.ativo
  join core.usuarios u on u.cargo_id = cp.cargo_id
  where u.id = (select auth.uid()) and u.ativo;
$$;

-- Ninguém tira o último administrador ativo pela aplicação (nem de si mesmo).
-- A service role e as migrations (sem auth.uid()) não passam por esta trava.
create or replace function core.garantir_um_administrador()
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
          join core.cargos c on c.id = cp.cargo_id
          where cp.cargo_id = u.cargo_id and c.ativo
            and cp.permissao = 'admin.usuarios'
        )
      )
  ) then
    raise exception 'é preciso manter pelo menos um administrador ativo'
      using errcode = 'P0001';
  end if;
  return null;
end;
$$;

create trigger um_administrador after update of ativo on core.cargos
  for each statement execute function core.garantir_um_administrador();

-- Excluir usuário: o administrador apaga o perfil com a própria sessão (fica
-- na auditoria e passa pela trava do último administrador); o servidor
-- apaga o usuário do Auth em seguida. Ninguém exclui a si mesmo.
create policy excluir on core.usuarios for delete to authenticated
  using (core.pode('admin.usuarios') and id <> (select auth.uid()));
grant delete on core.usuarios to authenticated;

drop trigger um_administrador on core.usuarios;
create trigger um_administrador after update of ativo, cargo_id or delete on core.usuarios
  for each statement execute function core.garantir_um_administrador();
drop trigger auditoria on core.usuarios;
create trigger auditoria after update or delete on core.usuarios
  for each row execute function core.auditar('id');
