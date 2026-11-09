-- operacoes (água): dados de exemplo, até chegar o primeiro arquivo real do
-- parceiro. Três meses fictícios (jun, jul e ago/2026) em 5 blocos, com
-- hidrômetros "EXA…", nomes inventados e a foto desenhada na tela (não há
-- arquivo). Tudo com exemplo = true: operacoes.remover_exemplos() apaga
-- (importações em cascata e leituras).
--
-- Alertas de agosto: consumo acima do limite (EXA000004), variação contra a
-- média (EXA000007), consumo zero de quem consumia (EXA000010), virada do
-- relógio (EXA000013), leitura zerada (EXA000016), sem foto (EXA000005 e
-- EXA000017) e hidrômetro que sumiu (EXA000022, só até julho). "Cliente ≠
-- ENET" e "sala sem locatário" dependem dos contratos de os.lojas.

create temporary table agua_exemplo as
with meses (m, referencia) as (
  values (1, date '2026-06-01'), (2, date '2026-07-01'), (3, date '2026-08-01')
),
nomes (n) as (
  select array[
    'Café Serra', 'Ateliê Lume', 'Vila Pão', 'Studio Nó', 'Casa Brasa',
    'Ponto Verde', 'Oficina 9', 'Doce Trama', 'Bazar Fio', 'Lótus Yoga',
    'Tinta Viva', 'Grão Moído', 'Rede Azul', 'Arte & Linho', 'Bike Serra Acima',
    'Livraria Trilha', 'Clínica Aurora', 'Escola Passo', 'Studio Pilates Ar',
    'Odonto Vale', 'Fisio Movimento', 'Escritório Prisma', 'Barbearia Norte',
    'Ótica Visão', 'Pet Amigo', 'Empório Raiz'
  ]
),
hidros as (
  select
    i,
    (array['01', '02', '04', '05', '09'])[(i - 1) / 6 + 1] as bloco,
    case
      when i = 28 then '104 e 105'
      else (101 + (i - 1) % 6 + ((i - 1) / 6 % 2) * 100)::text
    end as sala,
    case
      when i = 25 then 'ESTOQUE ARP'
      when i = 26 then 'CONTROLE ARP'
      when i = 28 then 'Grão Moído – UNIFICADO'
      else (select n[(i - 1) % 26 + 1] from nomes)
    end as cliente,
    'EXA' || lpad(i::text, 6, '0') as hidrometro,
    case when i = 13 then 9990.000 else 100 + i * 37.5 end as inicio
  from generate_series(1, 30) as i
),
consumos as (
  select
    h.*,
    m.m,
    m.referencia,
    case
      when h.cliente like '%ARP' then 0
      when h.i = 4 then (array[28.0, 29.5, 42.4])[m.m]
      when h.i = 7 then (array[10.0, 10.0, 22.0])[m.m]
      when h.i = 10 then (array[8.0, 8.0, 0.0])[m.m]
      when h.i = 13 then (array[4.2, 4.3, 4.7])[m.m]
      when h.i = 16 then (array[6.0, 6.5, 0.0])[m.m]
      when h.i in (3, 11, 19, 28) then 12 + h.i % 5 + m.m * 1.15
      else (h.i * 7) % 9 + 1 + m.m * 0.35
    end::numeric(14, 3) as consumo
  from hidros h
  cross join meses m
  where not (h.i = 22 and m.m = 3)
),
leituras as (
  select
    c.*,
    c.inicio + coalesce(
      sum(c.consumo) over (partition by c.i order by c.m rows between unbounded preceding and 1 preceding),
      0
    ) as anterior
  from consumos c
)
select
  l.m,
  l.referencia,
  l.bloco,
  l.sala,
  l.cliente,
  l.hidrometro,
  (l.referencia - interval '1 month' + interval '22 days')::date as data_anterior,
  l.anterior::numeric(14, 3) as leitura_anterior,
  (l.referencia + interval '22 days')::date as data_atual,
  case
    when l.i = 16 and l.m = 3 then 0
    -- Virada do relógio (o visor volta a zero depois de 9.999,999 m³).
    when l.anterior + l.consumo >= 10000 then l.anterior + l.consumo - 10000
    else l.anterior + l.consumo
  end::numeric(14, 3) as leitura_atual,
  ((l.referencia + interval '22 days')::date
    - (l.referencia - interval '1 month' + interval '22 days')::date) as dias,
  l.consumo,
  t.tipo,
  case t.tipo
    when 'MINIMO' then 10
    when 'ZERO' then 0
    else round(l.consumo, 2)
  end::numeric(14, 3) as volume,
  case t.tipo
    when 'MINIMO' then 203.28
    when 'ZERO' then 0
    else round(l.consumo * 39.47, 2)
  end::numeric(14, 2) as valor,
  case
    when (l.i in (5, 17) and l.m = 3) or (l.i = 9 and l.m = 2) then null
    else 'exemplo'
  end as foto,
  l.i as linha
from leituras l
cross join lateral (
  select case
    when l.cliente like '%ARP' then 'ZERO'
    when l.i = 30 and l.m = 2 then 'REFATURADO'
    when l.consumo > 10 then 'FATURADO'
    else 'MINIMO'
  end as tipo
) t;

with importacoes as (
  insert into operacoes.importacoes (
    tipo, status, referencia, arquivos, resumo, avisos, bate, exemplo, confirmado_em
  )
  select
    'agua',
    'confirmada',
    to_char(e.referencia, 'YYYY-MM-DD'),
    '[]',
    jsonb_build_object(
      'pasta', '',
      'conferencias', '[]'::jsonb,
      'mantidos', '[]'::jsonb,
      'totais', jsonb_build_object(
        'linhas', count(*),
        'consumo', sum(e.consumo),
        'volume', sum(e.volume)
      ),
      'fotos', jsonb_build_object(
        'ligadas', count(e.foto),
        'semLeitura', '[]'::jsonb,
        'recusadas', '[]'::jsonb,
        'semFoto', count(*) - count(e.foto)
      ),
      'novos', '[]'::jsonb,
      'ignoradas', '[]'::jsonb
    ),
    '[]',
    true,
    true,
    (e.referencia + interval '1 month 5 days 13 hours')
  from agua_exemplo e
  group by e.referencia
  returning id, referencia
),
-- (CTEs que gravam rodam sempre, mesmo sem ninguém ler o resultado.)
valores as (
  insert into operacoes.importacao_valores (importacao_id, valor_arquivo, valor_lido, por_bloco)
  select
    i.id,
    sum(e.valor),
    sum(e.valor),
    (
      select jsonb_object_agg(b.bloco, jsonb_build_object('arquivo', b.total, 'lido', b.total))
      from (
        select x.bloco, sum(x.valor) as total
        from agua_exemplo x
        where x.referencia = i.referencia::date
        group by x.bloco
      ) b
    )
  from importacoes i
  join agua_exemplo e on e.referencia = i.referencia::date
  group by i.id, i.referencia
  returning importacao_id
),
leituras as (
  insert into operacoes.agua_leituras (
    importacao_id, vigente, referencia, bloco, sala, cliente, hidrometro,
    data_anterior, leitura_anterior, data_atual, leitura_atual, dias,
    consumo, volume_faturado, tipo, foto, linha_arquivo, exemplo
  )
  select
    i.id, true, e.referencia, e.bloco, e.sala, e.cliente, e.hidrometro,
    e.data_anterior, e.leitura_anterior, e.data_atual, e.leitura_atual, e.dias,
    e.consumo, e.volume, e.tipo, e.foto, e.linha, true
  from agua_exemplo e
  join importacoes i on i.referencia::date = e.referencia
  returning id, referencia, hidrometro
)
insert into operacoes.agua_valores (leitura_id, valor)
select l.id, e.valor
from leituras l
join agua_exemplo e on e.referencia = l.referencia and e.hidrometro = l.hidrometro;

drop table agua_exemplo;
