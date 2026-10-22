-- Histórico de alterações de todo o sistema (Administração › Histórico de
-- alterações). Junta três fontes numa consulta só, com busca e filtros:
--   - core.auditoria: alterações de dados (triggers e funções do banco);
--   - core.logs (nova): eventos que não são alteração de linha, como entrar,
--     errar a senha, trocar senha, testar integração ou recalcular o custo;
--   - integracao.sync_runs: cada execução das sincronizações.
-- Quem vê: a permissão nova admin.historico. Desenho em docs/modelo-de-dados.md.

-- ---------------------------------------------------------------------------
-- Permissão (mesmo catálogo de src/lib/permissions.ts)
-- ---------------------------------------------------------------------------

insert into core.permissoes (codigo, descricao) values
  ('admin.historico', 'Ver o histórico de alterações e os registros de todo o sistema');

-- O Administrador tem tudo; quem administra os usuários individualmente também.
insert into core.cargo_permissoes (cargo_id, permissao)
  select c.id, 'admin.historico' from core.cargos c where c.nome = 'Administrador'
on conflict do nothing;
insert into core.usuario_permissoes (usuario_id, permissao)
  select up.usuario_id, 'admin.historico'
  from core.usuario_permissoes up
  where up.permissao = 'admin.usuarios'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Eventos do sistema. Só o servidor grava (service role), porque parte deles
-- acontece sem sessão (senha errada). Sem chave estrangeira no usuário: o
-- registro fica mesmo depois que ele é excluído.
-- ---------------------------------------------------------------------------

create table core.logs (
  id bigint generated always as identity primary key,
  em timestamptz not null default now(),
  usuario_id uuid,
  modulo text not null check (modulo in ('acesso', 'admin', 'rh', 'financeiro', 'integracoes')),
  evento text not null check (evento ~ '^[a-z_]+$'),
  descricao text not null check (btrim(descricao) <> ''),
  -- Contexto do evento (e-mail digitado, sistema, resultado). Nunca senha nem token.
  detalhes jsonb not null default '{}'
);

create index logs_em on core.logs (em desc);
create index auditoria_em on core.auditoria (em desc);

alter table core.logs enable row level security;

create policy ver on core.logs for select to authenticated
  using (core.pode('admin.historico'));

grant select on core.logs to authenticated;
grant all on core.logs to service_role;
grant usage on all sequences in schema core to service_role;

-- Quem vê o histórico do sistema vê toda a auditoria; o resto, como antes.
drop policy ver on core.auditoria;
create policy ver on core.auditoria for select to authenticated
  using (
    core.pode('admin.historico')
    or case
      when tabela like 'rh.%' then core.pode('rh.parametros')
      when tabela = 'core.metas' then core.pode('rh.parametros') or core.pode('financeiro.importacao_parametros')
      when tabela in ('core.usuario_permissoes', 'core.usuarios', 'core.cargos', 'core.cargo_permissoes')
        then core.pode('admin.usuarios')
      when tabela = 'core.empresa' then core.pode('admin.empresa')
      when tabela = 'integracao.credenciais' then core.pode('admin.integracoes')
      else false
    end
  );

-- Importações (folha, tabela do plano) passam a ir para a auditoria: envio da
-- prévia, confirmação, substituição. Só nomes, caminhos e contagens.
create trigger auditoria after insert or update or delete on core.importacoes
  for each row execute function core.auditar('id');

-- ---------------------------------------------------------------------------
-- Consulta da tela
-- ---------------------------------------------------------------------------

-- Minúsculas e sem acento, para a busca achar "beneficio" em "Benefício".
create function core.sem_acento(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(lower(t), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn');
$$;

-- Módulo de uma linha da auditoria, pela tabela (e, nas tabelas comuns, pelo
-- conteúdo: a meta é do RH ou do Financeiro pelo indicador).
create function core.modulo_da_auditoria(p_tabela text, p_linha jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_tabela like 'rh.%' then 'rh'
    when p_tabela like 'financeiro.%' then 'financeiro'
    when p_tabela like 'integracao.%' then 'integracoes'
    when p_tabela = 'core.metas' then
      case split_part(p_linha ->> 'indicador', '.', 1)
        when 'rh' then 'rh' when 'financeiro' then 'financeiro' else 'admin'
      end
    when p_tabela = 'core.importacoes' then
      case when p_linha ->> 'tipo' in ('folha', 'plano_saude') then 'rh' else 'financeiro' end
    else 'admin'
  end;
$$;

-- Uma página do histórico, do mais recente para o mais antigo, com o total
-- que casa com os filtros. Datas são dias no horário de Brasília (inclusive).
-- p_tabelas: tabelas cujo nome na tela casa com a busca (a tela conhece os
-- nomes amigáveis; o banco, só "rh.encargos_por_contrato").
create function core.historico(
  p_busca text default null,
  p_tabelas text[] default null,
  p_modulo text default null,
  p_tipo text default null,
  p_usuario uuid default null,
  p_de date default null,
  p_ate date default null,
  p_limite int default 50,
  p_deslocamento int default 0
)
returns table (
  tipo text,
  id text,
  em timestamptz,
  modulo text,
  usuario_id uuid,
  usuario_nome text,
  acao text,
  objeto text,
  registro_id text,
  descricao text,
  antes jsonb,
  depois jsonb,
  total bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with eventos as (
    select 'alteracao' as tipo, 'a' || a.id as id, a.em,
      core.modulo_da_auditoria(a.tabela, coalesce(a.depois, a.antes)) as modulo,
      a.usuario_id, a.acao, a.tabela as objeto, a.registro_id,
      null::text as descricao, a.antes, a.depois
    from core.auditoria a
    union all
    select 'evento', 'l' || l.id, l.em, l.modulo, l.usuario_id, l.evento,
      null, null, l.descricao, null, l.detalhes
    from core.logs l
    union all
    select 'sincronizacao', 's' || r.id, r.iniciado_em, 'integracoes', null,
      r.status::text, r.sistema, r.recurso, left(r.erro, 300), null,
      jsonb_build_object(
        'finalizado_em', r.finalizado_em,
        'registros', r.registros,
        'avisos', case when jsonb_typeof(r.cursor_depois -> 'avisos') = 'array'
          then r.cursor_depois -> 'avisos' else '[]'::jsonb end
      )
    from integracao.sync_runs r
  ),
  filtrados as (
    select e.*, u.nome as usuario_nome
    from eventos e
    left join core.usuarios u on u.id = e.usuario_id
    where core.pode('admin.historico')
      and (p_modulo is null or e.modulo = p_modulo)
      and (p_tipo is null or e.tipo = p_tipo)
      and (p_usuario is null or e.usuario_id = p_usuario)
      and (p_de is null or e.em >= p_de::timestamp at time zone 'America/Sao_Paulo')
      and (p_ate is null or e.em < (p_ate + 1)::timestamp at time zone 'America/Sao_Paulo')
      and (
        nullif(btrim(p_busca), '') is null
        or e.objeto = any(coalesce(p_tabelas, '{}'))
        or strpos(
          core.sem_acento(concat_ws(' ', u.nome, e.acao, e.objeto, e.registro_id,
            e.descricao, e.antes::text, e.depois::text)),
          core.sem_acento(btrim(p_busca))
        ) > 0
      )
  )
  select f.tipo, f.id, f.em, f.modulo, f.usuario_id, f.usuario_nome, f.acao,
    f.objeto, f.registro_id, f.descricao, f.antes, f.depois,
    count(*) over () as total
  from filtrados f
  order by f.em desc, f.id desc
  limit least(greatest(p_limite, 1), 200)
  offset greatest(p_deslocamento, 0);
$$;

-- Nomes para o filtro "Quem" (quem vê o histórico pode não ter admin.usuarios).
create function core.historico_autores()
returns table (id uuid, nome text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.nome
  from core.usuarios u
  where core.pode('admin.historico')
  order by u.nome;
$$;

revoke all on function core.historico(text, text[], text, text, uuid, date, date, int, int) from public, anon;
revoke all on function core.historico_autores() from public, anon;
grant execute on function
  core.historico(text, text[], text, text, uuid, date, date, int, int),
  core.historico_autores(),
  core.sem_acento(text),
  core.modulo_da_auditoria(text, jsonb)
  to authenticated, service_role;
