-- financeiro: começa pelo estacionamento (WPS ParkingPlus, API BI).
--
-- A receita do estacionamento não vem do ENET (aviso do fluxo de caixa na
-- especificação do Financeiro). A WPS entrega, por dia, os pagamentos e as
-- entradas e saídas de veículos. Só a sincronização grava.
--
-- Valores em reais, como a API entrega (conferido em 60 dias de
-- homologação: há valores como 117,33). Placa e operador não são guardados
-- (LGPD).

create schema financeiro;
grant usage on schema financeiro to authenticated, service_role;

create table financeiro.estacionamento_pagamentos (
  estacionamento_id int not null,
  -- "codigo" na API: um por pagamento (a API repete o registro por RPS e
  -- por grupo; a sincronização grava uma vez só).
  wps_codigo bigint not null,
  -- Dia consultado na rota (yyyymmdd).
  data date not null,
  -- "data" do pagamento, horário local do estacionamento.
  pago_em timestamp not null,
  -- "descricao": tipo de cliente/convênio, ex.: ROTATIVO, MENSALISTA.
  tipo_cliente text not null,
  ticket text,                            -- mensalidade não tem ticket
  recibo text not null,
  forma_pagamento text not null,          -- formaPagamento.descricao
  forma_pagamento_codigo int not null,    -- formaPagamento.codigoMapeado
  -- Grupos da API em que o pagamento apareceu: cartao_credito, desconto…
  grupos text[] not null check (cardinality(grupos) > 0),
  valor_bruto numeric(14, 2) not null,
  valor_desconto numeric(14, 2) not null default 0,
  valor_liquido numeric(14, 2) not null,
  parcial int not null default 0,         -- significado pendente com a WPS
  terminal text,
  tarifa text,
  sync_run_id uuid references integracao.sync_runs (id) on delete set null,
  atualizado_em timestamptz not null default now(),
  primary key (estacionamento_id, wps_codigo)
);

create index estacionamento_pagamentos_data
  on financeiro.estacionamento_pagamentos (estacionamento_id, data);

create table financeiro.estacionamento_movimento (
  estacionamento_id int not null,
  data date not null,
  -- Chave de "subdetalhes" na API: carro, caminhao, moto.
  tipo_veiculo text not null,
  entradas int not null default 0 check (entradas >= 0),
  saidas int not null default 0 check (saidas >= 0),
  sync_run_id uuid references integracao.sync_runs (id) on delete set null,
  atualizado_em timestamptz not null default now(),
  primary key (estacionamento_id, data, tipo_veiculo)
);

create trigger atualizado_em before update on financeiro.estacionamento_pagamentos
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on financeiro.estacionamento_movimento
  for each row execute function core.set_atualizado_em();

-- Telas que usam o estacionamento: painel, fluxo de caixa e Performance &
-- Capital (setor Estacionamento).
alter table financeiro.estacionamento_pagamentos enable row level security;
create policy ver on financeiro.estacionamento_pagamentos for select to authenticated
  using (
    core.pode('financeiro.painel') or core.pode('financeiro.fluxo_de_caixa')
    or core.pode('financeiro.performance_capital')
  );
grant select on financeiro.estacionamento_pagamentos to authenticated;
grant all on financeiro.estacionamento_pagamentos to service_role;

alter table financeiro.estacionamento_movimento enable row level security;
create policy ver on financeiro.estacionamento_movimento for select to authenticated
  using (
    core.pode('financeiro.painel') or core.pode('financeiro.fluxo_de_caixa')
    or core.pode('financeiro.performance_capital')
  );
grant select on financeiro.estacionamento_movimento to authenticated;
grant all on financeiro.estacionamento_movimento to service_role;

-- Troca os dias informados de uma vez: o que a WPS não lista mais naquele
-- dia (ex.: estorno) sai. p_dias: [{ data, pagamentos: [...], movimento: [...] }].
-- Só a sincronização (service_role) chama.
create function financeiro.gravar_estacionamento(
  p_estacionamento_id int,
  p_dias jsonb,
  p_sync_run_id uuid
)
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_datas date[];
  n int;
begin
  select coalesce(array_agg((d ->> 'data')::date), '{}')
    into v_datas
    from jsonb_array_elements(p_dias) d;

  delete from financeiro.estacionamento_pagamentos
    where estacionamento_id = p_estacionamento_id and data = any (v_datas);
  delete from financeiro.estacionamento_movimento
    where estacionamento_id = p_estacionamento_id and data = any (v_datas);

  -- Já gravado em outro dia (fora de p_dias): passa para o dia informado.
  -- Dentro de p_dias cada wps_codigo vem uma vez só (a sincronização garante).
  insert into financeiro.estacionamento_pagamentos (
    estacionamento_id, wps_codigo, data, pago_em, tipo_cliente, ticket, recibo,
    forma_pagamento, forma_pagamento_codigo, grupos, valor_bruto,
    valor_desconto, valor_liquido, parcial, terminal, tarifa, sync_run_id
  )
  select
    p_estacionamento_id,
    (p ->> 'wps_codigo')::bigint,
    (d ->> 'data')::date,
    (p ->> 'pago_em')::timestamp,
    p ->> 'tipo_cliente',
    p ->> 'ticket',
    p ->> 'recibo',
    p ->> 'forma_pagamento',
    (p ->> 'forma_pagamento_codigo')::int,
    array(select jsonb_array_elements_text(p -> 'grupos')),
    (p ->> 'valor_bruto')::numeric,
    coalesce((p ->> 'valor_desconto')::numeric, 0),
    (p ->> 'valor_liquido')::numeric,
    coalesce((p ->> 'parcial')::int, 0),
    p ->> 'terminal',
    p ->> 'tarifa',
    p_sync_run_id
  from jsonb_array_elements(p_dias) d,
    jsonb_array_elements(d -> 'pagamentos') p
  on conflict (estacionamento_id, wps_codigo) do update set
    data = excluded.data,
    pago_em = excluded.pago_em,
    tipo_cliente = excluded.tipo_cliente,
    ticket = excluded.ticket,
    recibo = excluded.recibo,
    forma_pagamento = excluded.forma_pagamento,
    forma_pagamento_codigo = excluded.forma_pagamento_codigo,
    grupos = excluded.grupos,
    valor_bruto = excluded.valor_bruto,
    valor_desconto = excluded.valor_desconto,
    valor_liquido = excluded.valor_liquido,
    parcial = excluded.parcial,
    terminal = excluded.terminal,
    tarifa = excluded.tarifa,
    sync_run_id = excluded.sync_run_id;
  get diagnostics n = row_count;

  insert into financeiro.estacionamento_movimento (
    estacionamento_id, data, tipo_veiculo, entradas, saidas, sync_run_id
  )
  select
    p_estacionamento_id,
    (d ->> 'data')::date,
    m ->> 'tipo_veiculo',
    (m ->> 'entradas')::int,
    (m ->> 'saidas')::int,
    p_sync_run_id
  from jsonb_array_elements(p_dias) d,
    jsonb_array_elements(d -> 'movimento') m;

  return n;
end;
$$;

revoke execute on function financeiro.gravar_estacionamento(int, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function financeiro.gravar_estacionamento(int, jsonb, uuid)
  to service_role;
