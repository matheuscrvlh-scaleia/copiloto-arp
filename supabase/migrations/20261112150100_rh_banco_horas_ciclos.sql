-- Fechamento do ciclo do banco de horas (tarefas do RH de 06/11/2026, item 3).
-- "Fechar ciclo" (a partir da data de fim dos Parâmetros) grava a lista por
-- pessoa: saldo final, valor calculado (positivo × salário/hora × (1 +
-- adicional); negativo × salário/hora), ação e valor realizado (o da folha,
-- editável). "Finalizar ciclo" deixa tudo só leitura, guarda os totais, a
-- data e quem finalizou, e abre o próximo ciclo nos Parâmetros. O valor do
-- fechamento não entra no custo de pessoal (já vem da folha).
--
-- Ver e mexer pede o custo individual (o valor de cada pessoa revela o
-- salário) e os parâmetros do RH (finalizar troca o ciclo deles).

create table rh.banco_horas_ciclos (
  id uuid primary key default gen_random_uuid(),
  inicio date not null unique,
  fim date not null,
  finalizado_em timestamptz,
  finalizado_por uuid references core.usuarios (id) on delete set null,
  total_saldo_min int,
  total_calculado numeric(14, 2),
  total_realizado numeric(14, 2),
  criado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (fim > inicio),
  check ((finalizado_em is null) = (total_saldo_min is null))
);

create table rh.banco_horas_fechamentos (
  ciclo_id uuid not null references rh.banco_horas_ciclos (id) on delete cascade,
  colaborador_id uuid not null references rh.colaboradores (id) on delete restrict,
  -- BSaldo do ponto no último dia do ciclo.
  saldo_min int not null,
  salario_hora numeric(14, 4),
  -- Null sem salário/hora (sem folha calculada) ou sem o adicional.
  valor_calculado numeric(14, 2),
  acao text check (acao in ('pago', 'descontado', 'abonado')),
  -- Null: ainda o da folha (rubrica 408 e grupo "banco de horas").
  valor_realizado numeric(14, 2),
  atualizado_em timestamptz not null default now(),
  primary key (ciclo_id, colaborador_id)
);

-- ---------------------------------------------------------------------------
-- Regras
-- ---------------------------------------------------------------------------

create function rh.pode_fechar_banco()
returns boolean
language sql
stable
set search_path = ''
as $$
  select core.pode('rh.parametros') and core.pode('rh.custo_pessoal.individual');
$$;

-- Ciclo finalizado não muda nem sai; o fechamento só abre a partir da data
-- de fim.
create function rh.conferir_ciclo_banco()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.finalizado_em is not null then
    raise exception 'o ciclo do banco de horas de % a % já foi finalizado e não muda',
      to_char(old.inicio, 'DD/MM/YYYY'), to_char(old.fim, 'DD/MM/YYYY');
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  if tg_op = 'INSERT' and new.fim > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'o ciclo só pode ser fechado a partir de %',
      to_char(new.fim, 'DD/MM/YYYY');
  end if;
  return new;
end;
$$;

create trigger conferir before insert or update or delete on rh.banco_horas_ciclos
  for each row execute function rh.conferir_ciclo_banco();

-- security definer: olha o ciclo mesmo sem poder vê-lo pelo RLS.
create function rh.travar_fechamento_banco()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from rh.banco_horas_ciclos c
    where c.id = (case when tg_op = 'DELETE' then old.ciclo_id else new.ciclo_id end)
      and c.finalizado_em is not null
  ) or (tg_op = 'UPDATE' and exists (
    select 1 from rh.banco_horas_ciclos c
    where c.id = old.ciclo_id and c.finalizado_em is not null
  )) then
    raise exception 'o ciclo do banco de horas já foi finalizado: o fechamento é só leitura';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger travar before insert or update or delete on rh.banco_horas_fechamentos
  for each row execute function rh.travar_fechamento_banco();

/**
 * Próximo ciclo: começa no dia seguinte ao fim e dura os mesmos meses
 * (24/06–23/12 → 24/12–23/06); ciclo de menos de um mês, os mesmos dias.
 */
create function rh.proximo_ciclo_banco(p_inicio date, p_fim date)
returns table (inicio date, fim date)
language sql
immutable
set search_path = ''
as $$
  with d as (
    select p_fim + 1 as novo,
      (extract(year from age(p_fim + 1, p_inicio)) * 12
        + extract(month from age(p_fim + 1, p_inicio)))::int as meses
  )
  select d.novo,
    case when d.meses > 0
      then (d.novo + make_interval(months => d.meses))::date - 1
      else d.novo + (p_fim - p_inicio)
    end
  from d;
$$;

/**
 * Finaliza o ciclo: toda pessoa com saldo precisa de ação; guarda os totais,
 * a data e quem finalizou; o fechamento fica só leitura e os Parâmetros
 * passam ao próximo ciclo (vigência do mês de hoje, demais valores iguais).
 */
create function rh.finalizar_ciclo_banco(p_ciclo uuid)
returns rh.banco_horas_ciclos
language plpgsql
security definer
set search_path = ''
as $$
declare
  c rh.banco_horas_ciclos;
  sem_acao int;
  prox record;
  mes date := date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
begin
  if not (select rh.pode_fechar_banco()) then
    raise exception 'sem permissão para finalizar o ciclo do banco de horas'
      using errcode = '42501';
  end if;
  select * into c from rh.banco_horas_ciclos where id = p_ciclo for update;
  if not found then
    raise exception 'ciclo do banco de horas não encontrado';
  end if;
  if c.finalizado_em is not null then
    raise exception 'o ciclo já foi finalizado';
  end if;
  select count(*) into sem_acao from rh.banco_horas_fechamentos f
    where f.ciclo_id = p_ciclo and f.saldo_min <> 0 and f.acao is null;
  if sem_acao > 0 then
    raise exception 'escolha a ação de % pessoa(s) com saldo antes de finalizar', sem_acao;
  end if;

  update rh.banco_horas_ciclos
    set finalizado_em = now(),
        finalizado_por = auth.uid(),
        total_saldo_min = coalesce((select sum(f.saldo_min) from rh.banco_horas_fechamentos f where f.ciclo_id = p_ciclo), 0),
        total_calculado = (select sum(f.valor_calculado) from rh.banco_horas_fechamentos f where f.ciclo_id = p_ciclo),
        total_realizado = (select sum(f.valor_realizado) from rh.banco_horas_fechamentos f where f.ciclo_id = p_ciclo)
    where id = p_ciclo
    returning * into c;

  select * into prox from rh.proximo_ciclo_banco(c.inicio, c.fim);
  insert into rh.parametros_empresa (
    vigente_desde, regime_tributario, rat_pct, fap,
    banco_horas_inicio, banco_horas_fim, banco_horas_adicional_pct
  )
  select mes, p.regime_tributario, p.rat_pct, p.fap,
    prox.inicio, prox.fim, p.banco_horas_adicional_pct
  from rh.parametros_empresa p
  order by (p.vigente_desde <= mes) desc,
    case when p.vigente_desde <= mes then p.vigente_desde end desc,
    p.vigente_desde
  limit 1
  on conflict (vigente_desde) do update
    set banco_horas_inicio = excluded.banco_horas_inicio,
        banco_horas_fim = excluded.banco_horas_fim;
  return c;
end;
$$;

revoke execute on function rh.finalizar_ciclo_banco(uuid) from public, anon;
grant execute on function rh.finalizar_ciclo_banco(uuid) to authenticated, service_role;
grant execute on function rh.pode_fechar_banco() to authenticated, service_role;
grant execute on function rh.proximo_ciclo_banco(date, date) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Gatilhos de sempre, auditoria e RLS
-- ---------------------------------------------------------------------------

create trigger atualizado_em before update on rh.banco_horas_ciclos
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on rh.banco_horas_fechamentos
  for each row execute function core.set_atualizado_em();
create trigger auditoria after insert or update or delete on rh.banco_horas_ciclos
  for each row execute function core.auditar('id');
create trigger auditoria after insert or update or delete on rh.banco_horas_fechamentos
  for each row execute function core.auditar('ciclo_id', 'colaborador_id');

alter table rh.banco_horas_ciclos enable row level security;
alter table rh.banco_horas_fechamentos enable row level security;

-- Os totais do ciclo não revelam salário de ninguém: vê quem vê o custo; a
-- lista por pessoa, só com o custo individual.
create policy ver on rh.banco_horas_ciclos for select to authenticated
  using ((select core.pode('rh.custo_pessoal')));
create policy criar on rh.banco_horas_ciclos for insert to authenticated
  with check ((select rh.pode_fechar_banco()));
create policy excluir on rh.banco_horas_ciclos for delete to authenticated
  using ((select rh.pode_fechar_banco()));

create policy ver on rh.banco_horas_fechamentos for select to authenticated
  using ((select core.pode('rh.custo_pessoal.individual')));
create policy criar on rh.banco_horas_fechamentos for insert to authenticated
  with check ((select rh.pode_fechar_banco()));
create policy editar on rh.banco_horas_fechamentos for update to authenticated
  using ((select rh.pode_fechar_banco()))
  with check ((select rh.pode_fechar_banco()));
create policy excluir on rh.banco_horas_fechamentos for delete to authenticated
  using ((select rh.pode_fechar_banco()));

grant select on rh.banco_horas_ciclos, rh.banco_horas_fechamentos to authenticated;
grant insert (inicio, fim), delete on rh.banco_horas_ciclos to authenticated;
grant insert (ciclo_id, colaborador_id, saldo_min, salario_hora, valor_calculado, acao, valor_realizado),
  update (acao, valor_realizado), delete
  on rh.banco_horas_fechamentos to authenticated;
grant all on rh.banco_horas_ciclos, rh.banco_horas_fechamentos to service_role;
