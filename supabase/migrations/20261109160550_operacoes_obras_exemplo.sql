-- operacoes_obras_exemplo: dados de exemplo das Obras (previsto e realizado)
-- até a planilha de orçamento real ser importada. Tudo fictício (nomes,
-- valores, datas) e marcado exemplo = true: operacoes.remover_exemplos()
-- apaga (importações → revisões, etapas e previsto em cascata; realizado;
-- obras).
--
-- Edifício Anexo Norte: R00 (14/07/2026) e R01 (03/10/2026, vigente), com o
-- realizado até jun/26 vindo da planilha e o de jul a out/26 lançado na tela.
-- Praça de convivência: R00 (10/08/2026), realizado de ago a nov/26.

insert into operacoes.obras (id, nome, responsavel, exemplo) values
  ('0b7a0000-0000-4000-8000-000000000001', 'Edifício Anexo Norte (exemplo)', 'Eng. Carla Mendes (fictícia)', true),
  ('0b7a0000-0000-4000-8000-000000000002', 'Praça de convivência (exemplo)', 'Eng. Paulo Reis (fictício)', true);

insert into operacoes.importacoes
  (id, tipo, status, referencia, arquivos, resumo, avisos, bate, exemplo, criado_em, confirmado_em)
values
  ('0b7a0000-0000-4000-8000-0000000000a1', 'orcamento', 'confirmada',
   'Edifício Anexo Norte (exemplo) R00', '[]',
   '{"obra_id": "0b7a0000-0000-4000-8000-000000000001", "obra": "Edifício Anexo Norte (exemplo)", "revisao": "R00", "data": "2026-07-14", "etapas": 6, "total_arquivo": 1484899.97, "total_etapas": 1484900.00, "diferenca": -0.03, "realizado_planilha": 180000.00, "realizado_importado": true, "meses": {"de": "2026-06-01", "ate": "2027-07-01"}}',
   '[{"nivel": "info", "mensagem": "Coluna I: “02/12/2026” (mês repetido no cabeçalho, entre dez/2026 e fev/2027) foi lida como jan/2027, escolhido na prévia."},
     {"nivel": "aviso", "mensagem": "A soma das etapas (R$ 1.484.900,00) difere do total da planilha (R$ 1.484.899,97) em R$ -0,03."},
     {"nivel": "aviso", "linha": 11, "mensagem": "Casa de máquinas: etapa sem valor (contratação extra após projeto)."}]',
   null, true, '2026-07-15 12:02:00-03', '2026-07-15 12:10:00-03'),
  ('0b7a0000-0000-4000-8000-0000000000a2', 'orcamento', 'confirmada',
   'Edifício Anexo Norte (exemplo) R01', '[]',
   '{"obra_id": "0b7a0000-0000-4000-8000-000000000001", "obra": "Edifício Anexo Norte (exemplo)", "revisao": "R01", "data": "2026-10-03", "etapas": 6, "total_arquivo": 1576000.00, "total_etapas": 1576000.00, "diferenca": 0, "realizado_planilha": 180000.00, "realizado_importado": false, "meses": {"de": "2026-06-01", "ate": "2028-01-01"}}',
   '[{"nivel": "info", "mensagem": "O realizado da planilha (R$ 180.000,00 até jun/2026) não foi importado: a obra já tem realizado lançado."}]',
   true, true, '2026-10-05 09:30:00-03', '2026-10-05 09:41:00-03'),
  ('0b7a0000-0000-4000-8000-0000000000a3', 'orcamento', 'confirmada',
   'Praça de convivência (exemplo) R00', '[]',
   '{"obra_id": "0b7a0000-0000-4000-8000-000000000002", "obra": "Praça de convivência (exemplo)", "revisao": "R00", "data": "2026-08-10", "etapas": 3, "total_arquivo": 305000.00, "total_etapas": 305000.00, "diferenca": 0, "realizado_planilha": 0, "realizado_importado": false, "meses": {"de": "2026-08-01", "ate": "2027-02-01"}}',
   '[]',
   true, true, '2026-08-11 14:00:00-03', '2026-08-11 14:05:00-03');

insert into operacoes.orcamento_revisoes
  (id, obra_id, importacao_id, codigo, data, titulo, total, total_arquivo, vigente, exemplo)
values
  ('0b7a0000-0000-4000-8000-0000000000b1', '0b7a0000-0000-4000-8000-000000000001',
   '0b7a0000-0000-4000-8000-0000000000a1', 'R00', '2026-07-14',
   'Estimativa de custo e desembolso para execução do Edifício Anexo Norte (exemplo)',
   1484900.00, 1484899.97, false, true),
  ('0b7a0000-0000-4000-8000-0000000000b2', '0b7a0000-0000-4000-8000-000000000001',
   '0b7a0000-0000-4000-8000-0000000000a2', 'R01', '2026-10-03',
   'Estimativa de custo e desembolso para execução do Edifício Anexo Norte (exemplo)',
   1576000.00, 1576000.00, true, true),
  ('0b7a0000-0000-4000-8000-0000000000b3', '0b7a0000-0000-4000-8000-000000000002',
   '0b7a0000-0000-4000-8000-0000000000a3', 'R00', '2026-08-10',
   'Cronograma físico-financeiro da Praça de convivência (exemplo)',
   305000.00, 305000.00, true, true);

-- Etapas: (revisão, ordem, nome, observação) e o previsto de cada uma:
-- valor igual em cada mês de um intervalo (mais um mês avulso quando há).
with etapa (id, revisao_id, ordem, nome, observacao, de, ate, valor) as (
  values
    -- Anexo Norte R00
    ('0b7a0000-0000-4000-8000-0000000001a1'::uuid, '0b7a0000-0000-4000-8000-0000000000b1'::uuid, 1, 'Fundação', 'Realizado até jun/2026 (planilha)', '2026-06-01'::date, '2026-06-01'::date, 180000.00),
    ('0b7a0000-0000-4000-8000-0000000001a2', '0b7a0000-0000-4000-8000-0000000000b1', 2, 'Térreo', null, '2026-07-01', '2026-10-01', 95000.00),
    ('0b7a0000-0000-4000-8000-0000000001a3', '0b7a0000-0000-4000-8000-0000000000b1', 3, 'Pavimento 1', null, '2026-09-01', '2026-12-01', 88500.00),
    ('0b7a0000-0000-4000-8000-0000000001a4', '0b7a0000-0000-4000-8000-0000000000b1', 4, 'Pavimento 2', null, '2027-01-01', '2027-04-01', 88500.00),
    ('0b7a0000-0000-4000-8000-0000000001a5', '0b7a0000-0000-4000-8000-0000000000b1', 5, 'Cobertura', null, '2027-05-01', '2027-07-01', 72300.00),
    ('0b7a0000-0000-4000-8000-0000000001a6', '0b7a0000-0000-4000-8000-0000000000b1', 6, 'Casa de máquinas', 'Contratação extra após projeto', null, null, null),
    -- Anexo Norte R01
    ('0b7a0000-0000-4000-8000-0000000001b1', '0b7a0000-0000-4000-8000-0000000000b2', 1, 'Fundação', 'Realizado até jun/2026 (planilha)', '2026-06-01', '2026-06-01', 180000.00),
    ('0b7a0000-0000-4000-8000-0000000001b2', '0b7a0000-0000-4000-8000-0000000000b2', 2, 'Térreo', null, '2026-07-01', '2026-09-01', 95000.00),
    ('0b7a0000-0000-4000-8000-0000000001b3', '0b7a0000-0000-4000-8000-0000000000b2', 3, 'Pavimento 1', null, '2026-10-01', '2027-01-01', 92000.00),
    ('0b7a0000-0000-4000-8000-0000000001b4', '0b7a0000-0000-4000-8000-0000000000b2', 4, 'Pavimento 2', null, '2027-02-01', '2027-05-01', 92000.00),
    ('0b7a0000-0000-4000-8000-0000000001b5', '0b7a0000-0000-4000-8000-0000000000b2', 5, 'Cobertura', null, '2027-06-01', '2027-08-01', 75000.00),
    ('0b7a0000-0000-4000-8000-0000000001b6', '0b7a0000-0000-4000-8000-0000000000b2', 6, 'Casa de máquinas', 'Contratação extra após projeto', '2028-01-01', '2028-01-01', 40000.00),
    -- Praça de convivência R00
    ('0b7a0000-0000-4000-8000-0000000001c1', '0b7a0000-0000-4000-8000-0000000000b3', 1, 'Terraplenagem', null, '2026-08-01', '2026-09-01', 40000.00),
    ('0b7a0000-0000-4000-8000-0000000001c2', '0b7a0000-0000-4000-8000-0000000000b3', 2, 'Pavimentação', null, '2026-10-01', '2026-12-01', 55000.00),
    ('0b7a0000-0000-4000-8000-0000000001c3', '0b7a0000-0000-4000-8000-0000000000b3', 3, 'Paisagismo', null, '2027-01-01', '2027-02-01', 30000.00)
), novas as (
  insert into operacoes.orcamento_etapas (id, revisao_id, ordem, nome, observacao)
  select id, revisao_id, ordem, nome, observacao from etapa
  returning id
)
insert into operacoes.orcamento_previsto (etapa_id, mes, valor)
select e.id, m::date, e.valor
from etapa e
cross join lateral generate_series(e.de, e.ate, interval '1 month') m
where e.valor is not null;

-- Térreo da R01: outubro com 110.000,00 (a obra atrasou e o mês ficou maior).
insert into operacoes.orcamento_previsto (etapa_id, mes, valor) values
  ('0b7a0000-0000-4000-8000-0000000001b2', '2026-10-01', 110000.00);

-- Realizado: a Fundação veio da planilha R00 (até jun/26); o resto, da tela.
insert into operacoes.obra_realizado
  (obra_id, etapa, mes, valor, descricao, origem, importacao_id, exemplo, lancado_em)
values
  ('0b7a0000-0000-4000-8000-000000000001', 'Fundação', '2026-06-01', 180000.00,
   'Realizado até jun/2026 (planilha R00)', 'planilha', '0b7a0000-0000-4000-8000-0000000000a1', true, '2026-07-15 12:10:00-03'),
  ('0b7a0000-0000-4000-8000-000000000001', 'Térreo', '2026-07-01', 96200.00, 'Medição 01 (fictícia)', 'tela', null, true, '2026-08-05 10:00:00-03'),
  ('0b7a0000-0000-4000-8000-000000000001', 'Térreo', '2026-08-01', 93850.40, 'Medição 02 (fictícia)', 'tela', null, true, '2026-09-04 10:00:00-03'),
  ('0b7a0000-0000-4000-8000-000000000001', 'Térreo', '2026-09-01', 97100.00, 'Medição 03 (fictícia)', 'tela', null, true, '2026-10-05 10:00:00-03'),
  ('0b7a0000-0000-4000-8000-000000000001', 'Térreo', '2026-10-01', 104300.00, 'Medição 04 (fictícia)', 'tela', null, true, '2026-11-04 10:00:00-03'),
  ('0b7a0000-0000-4000-8000-000000000001', 'Pavimento 1', '2026-10-01', 61000.00, 'Nota de material (fictícia)', 'tela', null, true, '2026-11-04 10:30:00-03'),
  ('0b7a0000-0000-4000-8000-000000000002', 'Terraplenagem', '2026-08-01', 41200.00, 'Medição 01 (fictícia)', 'tela', null, true, '2026-09-02 09:00:00-03'),
  ('0b7a0000-0000-4000-8000-000000000002', 'Terraplenagem', '2026-09-01', 39900.00, 'Medição 02 (fictícia)', 'tela', null, true, '2026-10-02 09:00:00-03'),
  ('0b7a0000-0000-4000-8000-000000000002', 'Pavimentação', '2026-10-01', 57300.00, 'Medição 03 (fictícia)', 'tela', null, true, '2026-11-03 09:00:00-03'),
  ('0b7a0000-0000-4000-8000-000000000002', 'Pavimentação', '2026-11-01', 52000.00, 'Adiantamento de material (fictício)', 'tela', null, true, '2026-11-06 09:00:00-03');
