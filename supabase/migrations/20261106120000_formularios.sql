-- formularios: formulários personalizados com link público (no lugar do
-- Google Forms, Typeform ou Tally). A equipe monta as perguntas, publica, manda
-- o link e acompanha as respostas. Quantos formulários quiser, todos editáveis
-- (inclusive depois de publicados).
--
-- As perguntas ficam em formularios.campos (jsonb), validadas pelo Zod de
-- src/lib/formularios. Cada resposta guarda o valor por id da pergunta e o
-- título da pergunta no momento do envio: se a pergunta mudar ou sair, a
-- resposta antiga continua legível.
--
-- Quem responde não tem login: o servidor confere o token e grava pela
-- service role com formularios.responder(). Nada é aberto para anon.

create schema formularios;
grant usage on schema formularios to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Permissões (mesmo catálogo de src/lib/permissions.ts)
-- ---------------------------------------------------------------------------

insert into core.permissoes (codigo, descricao) values
  ('formularios.ver', 'Ver os formulários e as respostas recebidas'),
  ('formularios.editar', 'Criar, editar, publicar, encerrar e excluir formulários e respostas'),
  ('formularios.exportar', 'Baixar as respostas em Excel e PDF');

insert into core.cargo_permissoes (cargo_id, permissao)
  select c.id, p.codigo
  from core.cargos c
  join core.permissoes p on p.codigo like 'formularios.%'
  where c.nome = 'Administrador'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table formularios.formularios (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (btrim(titulo) <> '' and length(titulo) <= 200),
  descricao text not null default '' check (length(descricao) <= 5000),
  -- Perguntas na ordem em que aparecem.
  campos jsonb not null default '[]' check (jsonb_typeof(campos) = 'array'),
  -- Texto da tela de agradecimento.
  mensagem_final text not null default '' check (length(mensagem_final) <= 2000),
  situacao text not null default 'rascunho'
    check (situacao in ('rascunho', 'publicado', 'encerrado')),
  -- Link público: /responder/<token>. Trocar o token desativa o link antigo.
  token text not null unique
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
    check (token ~ '^[A-Za-z0-9_-]{32,128}$'),
  -- Encerra sozinho na data ou no limite de respostas.
  encerra_em timestamptz,
  limite_respostas int check (limite_respostas is null or limite_respostas > 0),
  -- Mantidos por formularios.responder() e pela exclusão de resposta.
  total_respostas int not null default 0 check (total_respostas >= 0),
  ultima_resposta_em timestamptz,
  criado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  publicado_em timestamptz,
  atualizado_em timestamptz not null default now()
);

create index formularios_situacao on formularios.formularios (situacao);
create index formularios_atualizado_em on formularios.formularios (atualizado_em desc);
create index formularios_criado_por on formularios.formularios (criado_por);

create table formularios.respostas (
  id uuid primary key default gen_random_uuid(),
  formulario_id uuid not null references formularios.formularios (id) on delete cascade,
  -- { "<id da pergunta>": valor }
  respostas jsonb not null check (jsonb_typeof(respostas) = 'object'),
  -- { "<id da pergunta>": "<título no momento do envio>" }
  perguntas jsonb not null default '{}' check (jsonb_typeof(perguntas) = 'object'),
  enviada_em timestamptz not null default now()
);

create index respostas_formulario on formularios.respostas (formulario_id, enviada_em desc);

-- O contador de respostas muda a cada envio: isso não conta como edição
-- (nem para "atualizado em" nem para o histórico).
create trigger atualizado_em before update on formularios.formularios
  for each row
  when (
    (to_jsonb(old) - array['total_respostas', 'ultima_resposta_em', 'atualizado_em'])
    is distinct from
    (to_jsonb(new) - array['total_respostas', 'ultima_resposta_em', 'atualizado_em'])
  )
  execute function core.set_atualizado_em();

-- Quem mudou o formulário, quando, antes e depois. Respostas não (dado de
-- quem respondeu).
create trigger auditoria after insert or delete on formularios.formularios
  for each row execute function core.auditar('id');
create trigger auditoria_edicao after update on formularios.formularios
  for each row
  when (
    (to_jsonb(old) - array['total_respostas', 'ultima_resposta_em', 'atualizado_em'])
    is distinct from
    (to_jsonb(new) - array['total_respostas', 'ultima_resposta_em', 'atualizado_em'])
  )
  execute function core.auditar('id');

-- ---------------------------------------------------------------------------
-- Envio pelo link (só a service role, depois de o servidor validar as
-- respostas com o Zod das perguntas atuais). Confere de novo, com a linha
-- travada, se o formulário aceita resposta: publicado, dentro da data e do
-- limite. Ao bater o limite, encerra.
-- ---------------------------------------------------------------------------

create function formularios.responder(p_token text, p_respostas jsonb, p_perguntas jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  f formularios.formularios%rowtype;
  novo uuid;
begin
  select * into f from formularios.formularios where token = p_token for update;
  if not found then
    raise exception 'formulário não encontrado' using errcode = 'P0002';
  end if;
  if f.situacao <> 'publicado'
    or (f.encerra_em is not null and f.encerra_em <= now())
    or (f.limite_respostas is not null and f.total_respostas >= f.limite_respostas) then
    raise exception 'formulário encerrado' using errcode = 'P0001';
  end if;

  insert into formularios.respostas (formulario_id, respostas, perguntas)
    values (f.id, p_respostas, p_perguntas)
    returning id into novo;

  update formularios.formularios
    set total_respostas = total_respostas + 1,
        ultima_resposta_em = now(),
        situacao = case
          when limite_respostas is not null and total_respostas + 1 >= limite_respostas
            then 'encerrado'
          else situacao
        end
    where id = f.id;
  return novo;
end;
$$;

revoke execute on function formularios.responder(text, jsonb, jsonb) from public;
grant execute on function formularios.responder(text, jsonb, jsonb) to service_role;

-- Excluir resposta (spam, teste) acerta o total do formulário.
create function formularios.descontar_resposta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update formularios.formularios
    set total_respostas = greatest(total_respostas - 1, 0),
        ultima_resposta_em = (
          select max(enviada_em) from formularios.respostas where formulario_id = old.formulario_id
        )
    where id = old.formulario_id;
  return old;
end;
$$;

create trigger descontar after delete on formularios.respostas
  for each row execute function formularios.descontar_resposta();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table formularios.formularios enable row level security;
alter table formularios.respostas enable row level security;

create policy ver on formularios.formularios for select to authenticated
  using ((select core.pode('formularios.ver')) or (select core.pode('formularios.editar')));
create policy criar on formularios.formularios for insert to authenticated
  with check ((select core.pode('formularios.editar')) and criado_por = (select auth.uid()));
create policy editar on formularios.formularios for update to authenticated
  using ((select core.pode('formularios.editar')))
  with check ((select core.pode('formularios.editar')));
create policy excluir on formularios.formularios for delete to authenticated
  using ((select core.pode('formularios.editar')));

-- Respostas: quem vê os formulários. Ninguém com login insere (só o link);
-- quem edita pode excluir.
create policy ver on formularios.respostas for select to authenticated
  using ((select core.pode('formularios.ver')) or (select core.pode('formularios.editar')));
create policy excluir on formularios.respostas for delete to authenticated
  using ((select core.pode('formularios.editar')));

grant select, insert, update, delete on formularios.formularios to authenticated;
grant select, delete on formularios.respostas to authenticated;
grant all on all tables in schema formularios to service_role;
