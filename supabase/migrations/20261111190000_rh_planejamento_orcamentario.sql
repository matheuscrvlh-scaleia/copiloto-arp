-- Planejamento orçamentário do RH (antigo Endomarketing), spec de 07/11/2026.
-- O orçamento do ano é um valor único do RH que vem do ERP (ENET): ninguém o
-- digita na tela, só a sincronização (service role) grava. Cada gasto lançado
-- abate do orçamento do ano da sua data. Finalizar o ano guarda o total
-- gasto e quem fechou; daí em diante o ano é só leitura (orçamento e gastos).
-- Endomarketing vira uma das categorias de gasto, que a Gestora cadastra.

-- ---------------------------------------------------------------------------
-- Permissões: rh.endomarketing passa a ser rh.orcamento (o código muda em
-- cascata nas permissões de usuário e de cargo). Lançar fica numa nova.
-- ---------------------------------------------------------------------------

update core.permissoes
  set codigo = 'rh.orcamento',
      descricao = 'Ver o planejamento orçamentário do RH (orçamento do ano e gastos)'
  where codigo = 'rh.endomarketing';

insert into core.permissoes (codigo, descricao) values
  ('rh.orcamento.lancar', 'Lançar gastos do RH, editar as categorias de gasto e finalizar o orçamento do ano');

-- Quem edita os parâmetros do RH (a Gestora) já lança e vê.
insert into core.usuario_permissoes (usuario_id, permissao)
  select usuario_id, p.codigo
  from core.usuario_permissoes up
  cross join (values ('rh.orcamento'), ('rh.orcamento.lancar')) p (codigo)
  where up.permissao = 'rh.parametros'
on conflict do nothing;
insert into core.cargo_permissoes (cargo_id, permissao)
  select cargo_id, p.codigo
  from core.cargo_permissoes cp
  cross join (values ('rh.orcamento'), ('rh.orcamento.lancar')) p (codigo)
  where cp.permissao = 'rh.parametros'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- O orçamento anual de endomarketing (vazio) dá lugar ao orçamento do RH.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from rh.orcamento_endomarketing) then
    raise exception 'rh.orcamento_endomarketing tem dados: migrar antes de apagar';
  end if;
end;
$$;
drop table rh.orcamento_endomarketing;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table rh.categorias_gasto (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) between 1 and 60),
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index categorias_gasto_nome on rh.categorias_gasto (lower(btrim(nome)));

insert into rh.categorias_gasto (nome) values
  ('Endomarketing'), ('Capacitação'), ('Eventos'), ('Brindes'),
  ('Alimentação'), ('Datas comemorativas'), ('Ações de saúde');

-- Um por ano, gravado pela sincronização com o ERP. Finalizado: fotografia
-- do total gasto, data e quem fechou.
create table rh.orcamentos_anuais (
  ano int primary key check (ano between 2000 and 2100),
  valor numeric(14, 2) not null check (valor >= 0),
  origem text not null default 'enet' check (origem in ('enet')),
  recebido_em timestamptz not null default now(),
  finalizado_em timestamptz,
  finalizado_por uuid references core.usuarios (id) on delete set null,
  total_gasto numeric(14, 2),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check ((finalizado_em is null) = (total_gasto is null))
);

create table rh.gastos (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  valor numeric(14, 2) not null check (valor > 0),
  categoria_id uuid not null references rh.categorias_gasto (id) on delete restrict,
  -- O que foi gasto (ex.: bolo e salgados).
  descricao text not null check (length(btrim(descricao)) between 1 and 200),
  -- O motivo (ex.: aniversariantes de outubro).
  finalidade text not null check (length(btrim(finalidade)) between 1 and 200),
  observacao text check (length(observacao) <= 1000),
  criado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index gastos_data on rh.gastos (data);
create index gastos_categoria on rh.gastos (categoria_id);

-- ---------------------------------------------------------------------------
-- Regras
-- ---------------------------------------------------------------------------

create function rh.ano_finalizado(p_ano int)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from rh.orcamentos_anuais o
    where o.ano = p_ano and o.finalizado_em is not null
  );
$$;

-- Ano finalizado: nenhum gasto dele entra, muda ou sai (nem trocando a data
-- para dentro ou para fora dele). Categoria desativada não recebe gasto novo
-- (o gasto antigo que já a tem continua como está).
create function rh.conferir_gasto()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE')
     and rh.ano_finalizado(extract(year from old.data)::int) then
    raise exception 'o orçamento de % já foi finalizado: os gastos dele não mudam',
      extract(year from old.data)::int;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  if rh.ano_finalizado(extract(year from new.data)::int) then
    raise exception 'o orçamento de % já foi finalizado: não entra gasto nesse ano',
      extract(year from new.data)::int;
  end if;
  -- Sem categoria, quem barra é o not null (mensagem certa).
  if new.categoria_id is not null
     and (tg_op = 'INSERT' or new.categoria_id is distinct from old.categoria_id)
     and not exists (
       select 1 from rh.categorias_gasto c
       where c.id = new.categoria_id and c.ativa
     ) then
    raise exception 'categoria desativada: escolha outra da lista';
  end if;
  return new;
end;
$$;

create trigger conferir before insert or update or delete on rh.gastos
  for each row execute function rh.conferir_gasto();

-- Orçamento finalizado não muda nem sai (a correção, se houver, é no ERP e
-- num ano ainda aberto).
create function rh.travar_orcamento_finalizado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.finalizado_em is not null then
    raise exception 'o orçamento de % já foi finalizado e não muda', old.ano;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger travar before update or delete on rh.orcamentos_anuais
  for each row execute function rh.travar_orcamento_finalizado();

/**
 * Finaliza o orçamento do ano: guarda o total gasto, a data e quem fechou.
 * Daí em diante o ano é só leitura e a sincronização passa a puxar o ano
 * seguinte.
 */
create function rh.finalizar_orcamento(p_ano int)
returns rh.orcamentos_anuais
language plpgsql
security definer
set search_path = ''
as $$
declare
  o rh.orcamentos_anuais;
begin
  if not (select core.pode('rh.orcamento.lancar')) then
    raise exception 'sem permissão para finalizar o orçamento' using errcode = '42501';
  end if;
  select * into o from rh.orcamentos_anuais where ano = p_ano for update;
  if not found then
    raise exception 'o orçamento de % ainda não chegou do ERP', p_ano;
  end if;
  if o.finalizado_em is not null then
    raise exception 'o orçamento de % já foi finalizado', p_ano;
  end if;
  update rh.orcamentos_anuais
    set finalizado_em = now(),
        finalizado_por = auth.uid(),
        total_gasto = coalesce((
          select sum(g.valor) from rh.gastos g
          where g.data >= make_date(p_ano, 1, 1) and g.data < make_date(p_ano + 1, 1, 1)
        ), 0)
    where ano = p_ano
    returning * into o;
  return o;
end;
$$;

revoke execute on function rh.finalizar_orcamento(int) from public, anon;
grant execute on function rh.finalizar_orcamento(int) to authenticated, service_role;
grant execute on function rh.ano_finalizado(int) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Gatilhos de sempre e auditoria
-- ---------------------------------------------------------------------------

create trigger atualizado_em before update on rh.categorias_gasto
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on rh.orcamentos_anuais
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on rh.gastos
  for each row execute function core.set_atualizado_em();

create trigger auditoria after insert or update or delete on rh.categorias_gasto
  for each row execute function core.auditar('id');
create trigger auditoria after insert or update or delete on rh.orcamentos_anuais
  for each row execute function core.auditar('ano');
create trigger auditoria after insert or update or delete on rh.gastos
  for each row execute function core.auditar('id');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table rh.categorias_gasto enable row level security;
alter table rh.orcamentos_anuais enable row level security;
alter table rh.gastos enable row level security;

-- Categorias: a lista é lida por quem vê o planejamento; cadastra e edita
-- quem lança. Excluir não há: só desativar.
create policy ver on rh.categorias_gasto for select to authenticated
  using ((select core.pode('rh.orcamento')) or (select core.pode('rh.orcamento.lancar')));
create policy criar on rh.categorias_gasto for insert to authenticated
  with check ((select core.pode('rh.orcamento.lancar')));
create policy editar on rh.categorias_gasto for update to authenticated
  using ((select core.pode('rh.orcamento.lancar')))
  with check ((select core.pode('rh.orcamento.lancar')));

-- Orçamento: só leitura na tela (grava a sincronização; finaliza a função).
create policy ver on rh.orcamentos_anuais for select to authenticated
  using ((select core.pode('rh.orcamento')) or (select core.pode('rh.orcamento.lancar')));

create policy ver on rh.gastos for select to authenticated
  using ((select core.pode('rh.orcamento')) or (select core.pode('rh.orcamento.lancar')));
create policy criar on rh.gastos for insert to authenticated
  with check ((select core.pode('rh.orcamento.lancar')));
create policy editar on rh.gastos for update to authenticated
  using ((select core.pode('rh.orcamento.lancar')))
  with check ((select core.pode('rh.orcamento.lancar')));
create policy excluir on rh.gastos for delete to authenticated
  using ((select core.pode('rh.orcamento.lancar')));

grant select on rh.categorias_gasto, rh.orcamentos_anuais, rh.gastos to authenticated;
grant insert (nome, ativa), update (nome, ativa) on rh.categorias_gasto to authenticated;
grant insert (data, valor, categoria_id, descricao, finalidade, observacao),
  update (data, valor, categoria_id, descricao, finalidade, observacao),
  delete on rh.gastos to authenticated;
grant all on rh.categorias_gasto, rh.orcamentos_anuais, rh.gastos to service_role;
