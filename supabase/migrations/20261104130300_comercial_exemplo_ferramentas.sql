-- Dados de exemplo das ferramentas do Comercial (exemplo = true; saem com
-- comercial.remover_exemplos() em Configurações): 10 propostas de evento
-- (4.15) e 108 imóveis de pesquisa de mercado (4.16), só locação.
-- Clientes, endereços e links são inventados; tudo determinístico (sem
-- random()), com os valores calculados pela tabela de faixas da carga.

-- ---------------------------------------------------------------------------
-- Propostas de evento
-- ---------------------------------------------------------------------------

insert into comercial.propostas_evento (
  cliente, criado_em, data_evento, data_evento_fim, horario, tipo_data,
  area_m2, dias, pessoas, desconto_pct, valor_original, valor_parceria,
  desconto_primeira_edicao, valor_final, segurancas, agentes_limpeza,
  condicao_pagamento, montagem, desmontagem, area_evento, notas, observacoes,
  validade, status, calculo, exemplo
)
select
  v.cliente,
  v.criado::timestamptz + interval '13 hours',
  v.inicio::date,
  v.fim::date,
  p.evento_horario,
  v.tipo,
  v.area,
  v.dias,
  v.pessoas,
  v.desconto,
  v.original,
  v.parceria,
  v.primeira,
  v.parceria - v.primeira,
  v.segurancas,
  v.agentes,
  p.evento_condicao_pagamento,
  p.evento_montagem,
  p.evento_desmontagem,
  p.evento_area_texto,
  p.evento_notas,
  array(
    select l.valor from comercial.listas l
    where l.lista = 'evento_observacao' and l.ordem <= v.observacoes
    order by l.ordem
  ),
  v.criado::date + p.evento_validade_dias,
  v.status,
  jsonb_build_object('faixa', v.faixa, 'fixo', v.faixa = 'Fixo', 'preco', v.preco,
    'valor_dia', v.original / v.dias),
  true
from comercial.parametros p
cross join (values
  ('Feira Gastronômica Serra Fria', '2026-11-02', '2026-12-12', '2026-12-13', 'sazonal', 730, 2, 1500, 30, 16060.00, 11242.00, 0, 15, 4, 'enviada', '3', 11.00, 10),
  ('Encontro de Motociclistas Vale Verde', '2026-11-03', '2027-01-23', null, 'comum', 450, 1, 600, 30, 2475.00, 1732.50, 0, 6, 3, 'rascunho', '3', 5.50, 8),
  ('Bazar de Natal Mãos da Serra', '2026-10-06', '2026-12-05', '2026-12-07', 'sazonal', 180, 3, 400, 30, 8910.00, 6237.00, 500, 4, 1, 'fechada', '2', 16.50, 10),
  ('Workshop de Fotografia Luz Alpina', '2026-10-14', '2026-11-28', null, 'comum', 20, 1, 40, 30, 275.00, 192.50, 0, 1, 1, 'fechada', 'Fixo', 275.00, 6),
  ('Festival de Cervejas da Montanha', '2026-09-10', '2026-10-17', '2026-10-18', 'comum', 1200, 2, 2500, 30, 9240.00, 6468.00, 0, 25, 6, 'fechada', '4', 3.85, 10),
  ('Exposição de Carros Antigos Retrô', '2026-09-22', '2026-10-24', null, 'comum', 900, 1, 800, 20, 4950.00, 3960.00, 0, 8, 5, 'perdida', '3', 5.50, 9),
  ('Lançamento de Coleção Ateliê Pinho', '2026-08-05', '2026-09-12', null, 'comum', 80, 1, 120, 30, 880.00, 616.00, 0, 2, 1, 'perdida', '1', 11.00, 5),
  ('Corrida Noturna Trilhas do Vale', '2026-10-28', '2027-03-14', null, 'comum', 300, 1, 700, 30, 2475.00, 1732.50, 0, 7, 2, 'enviada', '2', 8.25, 10),
  ('Feira de Adoção Patas Amigas', '2026-07-15', '2026-08-22', null, 'comum', 150, 1, 300, 50, 1237.50, 618.75, 0, 3, 1, 'fechada', '2', 8.25, 7),
  ('Congresso Regional de Têxteis', '2026-11-04', '2027-04-20', '2027-04-22', 'comum', 2000, 3, 1800, 30, 23100.00, 16170.00, 0, 18, 10, 'enviada', '4', 3.85, 10)
) as v (cliente, criado, inicio, fim, tipo, area, dias, pessoas, desconto,
  original, parceria, primeira, segurancas, agentes, status, faixa, preco, observacoes);

-- Fechamento máximo: 30 dias úteis (parâmetro) antes do 1º dia, sem contar
-- sábado e domingo (os feriados nacionais vêm do serviço, na tela).
update comercial.propostas_evento pe
set fechamento_ate = (
  select d::date
  from generate_series(pe.data_evento - 1, pe.data_evento - 120, interval '-1 day') d
  where extract(isodow from d) < 6
  order by d desc
  offset (select evento_fechamento_dias_uteis - 1 from comercial.parametros)
  limit 1
)
where pe.exemplo and pe.data_evento is not null;

-- ---------------------------------------------------------------------------
-- Pesquisa de mercado: 108 imóveis de 08/2023 a 08/2024, só locação
-- ---------------------------------------------------------------------------

insert into comercial.pesquisa_imoveis (
  data_pesquisa, endereco, bairro, tipo, area_m2, aluguel, condominio, iptu,
  vagas, observacao, fonte, exemplo
)
select
  date '2023-08-01' + (i * 37) % 396,
  (array[
    'Rua das Camélias Brancas', 'Travessa do Orvalho', 'Rua Vale das Gralhas',
    'Avenida das Hortênsias Azuis', 'Rua do Moinho Antigo', 'Rua Alameda dos Ciprestes',
    'Rua Recanto das Bromélias', 'Travessa da Neblina', 'Rua dos Tecelões Unidos',
    'Rua Mirante do Sol Poente', 'Avenida Jardim das Araucárias', 'Rua da Fonte Clara'
  ])[1 + (i * 5) % 12]
    || ', ' || (10 + (i * 37) % 890)
    || case when t.tipo = 'Sala comercial' then ' — sala ' || (101 + (i * 3) % 12) else '' end,
  b.bairro,
  t.tipo,
  a.area,
  round(a.area * vm.valor / 10) * 10,
  case when i % 4 = 0 then null else 80 + (i * 41) % 820 end,
  20 + (i * 13) % 160,
  i % 3,
  'Anúncio de exemplo (' || (array['Viva Real', 'Zap Imóveis', 'Chaves na Mão', 'Imobiliária local'])[1 + i % 4] || ')',
  'https://example.com/anuncios/pesquisa-' || i,
  true
from generate_series(1, 108) as i
cross join lateral (
  select case
    when (i * 7) % 20 < 10 then 'Loja'
    when (i * 7) % 20 < 17 then 'Sala comercial'
    when (i * 7) % 20 < 19 then 'Casa comercial'
    else 'Galpão'
  end as tipo
) t
cross join lateral (
  select case
    when (i * 11) % 20 < 11 then 'Centro'
    when (i * 11) % 20 < 13 then 'Olaria'
    when (i * 11) % 20 < 15 then 'Vila Nova'
    when (i * 11) % 20 < 16 then 'Bela Vista'
    when (i * 11) % 20 < 17 then 'Jardim Ouro Preto'
    when (i * 11) % 20 < 19 then 'Lagoinha'
    else 'Mury'
  end as bairro
) b
cross join lateral (
  select case
    when t.tipo = 'Galpão' then 150 + (i * 53) % 450
    else 22 + (i * 29) % 158 + (i % 2) * 0.5
  end::numeric(10, 2) as area
) a
cross join lateral (
  select ((case when b.bairro = 'Centro' then 55 else 32 end) + (i * 17) % 30)
    * (case when t.tipo = 'Galpão' then 0.4 else 1 end) as valor
) vm;
