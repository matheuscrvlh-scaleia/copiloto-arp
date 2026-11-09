-- operacoes_contas_exemplo: faturas da Energisa de EXEMPLO (fictícias) para as
-- telas Contas e Energia solar: 3 unidades (matrículas fictícias, uma
-- geradora) e 12 meses (nov/2025 a out/2026), com os itens somando o total,
-- créditos oUC/mUC coerentes com a geração e saldo de créditos. Tudo com
-- exemplo = true: sai com operacoes.remover_exemplos().
-- Gerado por um script (scratchpad/gera-seed-contas.mjs); não editar à mão.

insert into operacoes.energia_unidades
  (matricula, endereco, apelido, classificacao, ligacao, papel, exemplo)
values
  ('0009100001', 'RUA FICTICIA DE EXEMPLO, 100 - BL A AREA COMUM', 'Área comum do Bloco A (exemplo)', 'MTC-Convencional Baixa Tensão / B3 Comercial', 'Trifásico', 'consome', true),
  ('0009100002', 'RUA FICTICIA DE EXEMPLO, 100 - GARAGEM', 'Garagem e iluminação externa (exemplo)', 'MTC-Convencional Baixa Tensão / B3 Comercial', 'Trifásico', 'consome', true),
  ('0009100003', 'RUA FICTICIA DE EXEMPLO, 100 - BL C COBERTURA', 'Usina solar da cobertura (exemplo)', 'MTC-Convencional Baixa Tensão / B3 Comercial', 'Trifásico', 'gera', true)
on conflict (matricula) do nothing;

-- 2025-11
with imp as (
  insert into operacoes.importacoes
    (tipo, status, referencia, resumo, avisos, bate, exemplo, criado_em, confirmado_em)
  values ('energisa', 'confirmada', '2025-11-01', '{"faturas": 3, "exemplo": true}', '[]', true, true,
    '2025-12-02 10:00:00-03', '2025-12-02 10:05:00-03')
  returning id
),
f0 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100001', '2025-11-01', '2025-12-11', '2025-10-23', '2025-11-23', '2025-12-23', 31, 'XY100001', 52300, 53480, 1180, '1476.42', 1080, '1168.18', null, 'Amarela', '2.45', '47.12', '55.93', '5.13', '357.81', 745, 0, 'GD_I', 'Nº 000.900.001, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
),
f1 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100002', '2025-11-01', '2025-12-11', '2025-10-23', '2025-11-23', '2025-12-23', 31, 'XY100002', 418200, 422100, 3900, '4879.71', 3800, '4110.25', null, 'Amarela', '2.45', '47.12', '138.95', '12.74', '819.03', 1015, 0, 'GD_I', 'Nº 000.900.002, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
),
f2 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100003', '2025-11-01', '2025-12-11', '2025-10-23', '2025-11-23', '2025-12-23', 31, 'XY100003', 20400, 20780, 380, '475.46', 280, '302.86', 5900, 'Amarela', '2.45', '47.12', '31.51', '2.89', '222.17', 0, 0, 'GD_I', 'Nº 000.900.003, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
)
insert into operacoes.energia_fatura_itens
  (fatura_id, ordem, descricao, tipo, origem, mes_geracao, unidade, quantidade,
   preco_unitario, valor, pis_cofins, base_icms, aliquota_icms, icms, tarifa_unitaria)
select f0.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 1180, 1.251207, 1476.42, 24.36, 1476.42, 18, 265.76, 0.90122 from f0
union all select f0.id, 2, 'Energia Atv Injetada GDI oUC 11/2025 mPT', 'injetada', 'oUC', '2025-11-01'::date, 'KWH', -1080, 1.081644, -1168.18, -19.27, -1168.18, 18, -210.27, 0.78122 from f0
union all select f0.id, 3, 'Adic. B. Amarela', 'bandeira', null, null::date, null, null, null, 2.45, 0.04, 2.45, 18, 0.44, null from f0
union all select f0.id, 4, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f0
union all select f1.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 3900, 1.251207, 4879.71, 80.52, 4879.71, 18, 878.35, 0.90122 from f1
union all select f1.id, 2, 'Energia Atv Injetada GDI oUC 11/2025 mPT', 'injetada', 'oUC', '2025-11-01'::date, 'KWH', -3800, 1.081644, -4110.25, -67.82, -4110.25, 18, -739.84, 0.78122 from f1
union all select f1.id, 3, 'Adic. B. Amarela', 'bandeira', null, null::date, null, null, null, 2.45, 0.04, 2.45, 18, 0.44, null from f1
union all select f1.id, 4, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f1
union all select f2.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 380, 1.251207, 475.46, 7.85, 475.46, 18, 85.58, 0.90122 from f2
union all select f2.id, 2, 'Energia Atv Injetada GDI mUC 11/2025 mPT', 'injetada', 'mUC', '2025-11-01'::date, 'KWH', -280, 1.081644, -302.86, -5.00, -302.86, 18, -54.51, 0.78122 from f2
union all select f2.id, 3, 'Adic. B. Amarela', 'bandeira', null, null::date, null, null, null, 2.45, 0.04, 2.45, 18, 0.44, null from f2
union all select f2.id, 4, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f2;

-- 2025-12
with imp as (
  insert into operacoes.importacoes
    (tipo, status, referencia, resumo, avisos, bate, exemplo, criado_em, confirmado_em)
  values ('energisa', 'confirmada', '2025-12-01', '{"faturas": 3, "exemplo": true}', '[]', true, true,
    '2026-01-02 10:00:00-03', '2026-01-02 10:05:00-03')
  returning id
),
f0 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100001', '2025-12-01', '2026-01-11', '2025-11-23', '2025-12-23', '2026-01-23', 30, 'XY100001', 53480, 54720, 1240, '1551.50', 1140, '1233.07', null, 'Verde', '0.00', '47.12', '57.32', '5.25', '365.55', 1105, 0, 'GD_I', 'Nº 000.901.001, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
),
f1 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100002', '2025-12-01', '2026-01-11', '2025-11-23', '2025-12-23', '2026-01-23', 30, 'XY100002', 422100, 426150, 4050, '5067.39', 3950, '4272.49', null, 'Verde', '0.00', '47.12', '143.08', '13.11', '842.02', 1565, 0, 'GD_I', 'Nº 000.901.002, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
),
f2 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100003', '2025-12-01', '2026-01-11', '2025-11-23', '2025-12-23', '2026-01-23', 30, 'XY100003', 20780, 21180, 400, '500.48', 300, '324.49', 6300, 'Verde', '0.00', '47.12', '31.68', '2.91', '223.11', 0, 0, 'GD_I', 'Nº 000.901.003, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
)
insert into operacoes.energia_fatura_itens
  (fatura_id, ordem, descricao, tipo, origem, mes_geracao, unidade, quantidade,
   preco_unitario, valor, pis_cofins, base_icms, aliquota_icms, icms, tarifa_unitaria)
select f0.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 1240, 1.251207, 1551.50, 25.60, 1551.50, 18, 279.27, 0.90122 from f0
union all select f0.id, 2, 'Energia Atv Injetada GDI oUC 12/2025 mPT', 'injetada', 'oUC', '2025-12-01'::date, 'KWH', -1140, 1.081644, -1233.07, -20.35, -1233.07, 18, -221.95, 0.78122 from f0
union all select f0.id, 3, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f0
union all select f1.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 4050, 1.251207, 5067.39, 83.61, 5067.39, 18, 912.13, 0.90122 from f1
union all select f1.id, 2, 'Energia Atv Injetada GDI oUC 12/2025 mPT', 'injetada', 'oUC', '2025-12-01'::date, 'KWH', -3950, 1.081644, -4272.49, -70.50, -4272.49, 18, -769.05, 0.78122 from f1
union all select f1.id, 3, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f1
union all select f2.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 400, 1.251207, 500.48, 8.26, 500.48, 18, 90.09, 0.90122 from f2
union all select f2.id, 2, 'Energia Atv Injetada GDI mUC 12/2025 mPT', 'injetada', 'mUC', '2025-12-01'::date, 'KWH', -300, 1.081644, -324.49, -5.35, -324.49, 18, -58.41, 0.78122 from f2
union all select f2.id, 3, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f2;

-- 2026-01
with imp as (
  insert into operacoes.importacoes
    (tipo, status, referencia, resumo, avisos, bate, exemplo, criado_em, confirmado_em)
  values ('energisa', 'confirmada', '2026-01-01', '{"faturas": 3, "exemplo": true}', '[]', true, true,
    '2026-02-02 10:00:00-03', '2026-02-02 10:05:00-03')
  returning id
),
f0 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100001', '2026-01-01', '2026-02-11', '2025-12-23', '2026-01-23', '2026-02-23', 31, 'XY100001', 54720, 56030, 1310, '1639.08', 1210, '1308.79', null, 'Verde', '0.00', '47.12', '59.45', '5.44', '377.41', 1440, 0, 'GD_I', 'Nº 000.902.001, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
),
f1 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100002', '2026-01-01', '2026-02-11', '2025-12-23', '2026-01-23', '2026-02-23', 31, 'XY100002', 426150, 430350, 4200, '5255.07', 4100, '4434.74', null, 'Verde', '0.00', '47.12', '147.66', '13.54', '867.45', 2100, 0, 'GD_I', 'Nº 000.902.002, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
),
f2 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100003', '2026-01-01', '2026-02-11', '2025-12-23', '2026-01-23', '2026-02-23', 31, 'XY100003', 21180, 21600, 420, '525.51', 320, '346.13', 6500, 'Verde', '0.00', '47.12', '32.29', '2.96', '226.50', 0, 0, 'GD_I', 'Nº 000.902.003, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
)
insert into operacoes.energia_fatura_itens
  (fatura_id, ordem, descricao, tipo, origem, mes_geracao, unidade, quantidade,
   preco_unitario, valor, pis_cofins, base_icms, aliquota_icms, icms, tarifa_unitaria)
select f0.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 1310, 1.251207, 1639.08, 27.04, 1639.08, 18, 295.03, 0.90122 from f0
union all select f0.id, 2, 'Energia Atv Injetada GDI oUC 1/2026 mPT', 'injetada', 'oUC', '2026-01-01'::date, 'KWH', -1210, 1.081644, -1308.79, -21.60, -1308.79, 18, -235.58, 0.78122 from f0
union all select f0.id, 3, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f0
union all select f1.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 4200, 1.251207, 5255.07, 86.71, 5255.07, 18, 945.91, 0.90122 from f1
union all select f1.id, 2, 'Energia Atv Injetada GDI oUC 1/2026 mPT', 'injetada', 'oUC', '2026-01-01'::date, 'KWH', -4100, 1.081644, -4434.74, -73.17, -4434.74, 18, -798.25, 0.78122 from f1
union all select f1.id, 3, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f1
union all select f2.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 420, 1.251207, 525.51, 8.67, 525.51, 18, 94.59, 0.90122 from f2
union all select f2.id, 2, 'Energia Atv Injetada GDI mUC 1/2026 mPT', 'injetada', 'mUC', '2026-01-01'::date, 'KWH', -320, 1.081644, -346.13, -5.71, -346.13, 18, -62.30, 0.78122 from f2
union all select f2.id, 3, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f2;

-- 2026-02
with imp as (
  insert into operacoes.importacoes
    (tipo, status, referencia, resumo, avisos, bate, exemplo, criado_em, confirmado_em)
  values ('energisa', 'confirmada', '2026-02-01', '{"faturas": 3, "exemplo": true}', '[]', true, true,
    '2026-03-02 10:00:00-03', '2026-03-02 10:05:00-03')
  returning id
),
f0 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100001', '2026-02-01', '2026-03-11', '2026-01-23', '2026-02-23', '2026-03-23', 31, 'XY100001', 56030, 57320, 1290, '1614.06', 1190, '1287.16', null, 'Verde', '0.00', '47.12', '58.84', '5.39', '374.02', 1773, 0, 'GD_I', 'Nº 000.903.001, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
),
f1 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100002', '2026-02-01', '2026-03-11', '2026-01-23', '2026-02-23', '2026-03-23', 31, 'XY100002', 430350, 434500, 4150, '5192.51', 4050, '4380.66', null, 'Verde', '0.00', '47.12', '146.13', '13.40', '858.97', 2618, 0, 'GD_I', 'Nº 000.903.002, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
),
f2 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100003', '2026-02-01', '2026-03-11', '2026-01-23', '2026-02-23', '2026-03-23', 31, 'XY100003', 21600, 22010, 410, '512.99', 310, '335.31', 6400, 'Verde', '0.00', '47.12', '31.98', '2.93', '224.80', 0, 0, 'GD_I', 'Nº 000.903.003, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
)
insert into operacoes.energia_fatura_itens
  (fatura_id, ordem, descricao, tipo, origem, mes_geracao, unidade, quantidade,
   preco_unitario, valor, pis_cofins, base_icms, aliquota_icms, icms, tarifa_unitaria)
select f0.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 1290, 1.251207, 1614.06, 26.63, 1614.06, 18, 290.53, 0.90122 from f0
union all select f0.id, 2, 'Energia Atv Injetada GDI oUC 2/2026 mPT', 'injetada', 'oUC', '2026-02-01'::date, 'KWH', -1190, 1.081644, -1287.16, -21.24, -1287.16, 18, -231.69, 0.78122 from f0
union all select f0.id, 3, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f0
union all select f1.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 4150, 1.251207, 5192.51, 85.68, 5192.51, 18, 934.65, 0.90122 from f1
union all select f1.id, 2, 'Energia Atv Injetada GDI oUC 2/2026 mPT', 'injetada', 'oUC', '2026-02-01'::date, 'KWH', -4050, 1.081644, -4380.66, -72.28, -4380.66, 18, -788.52, 0.78122 from f1
union all select f1.id, 3, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f1
union all select f2.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 410, 1.251207, 512.99, 8.46, 512.99, 18, 92.34, 0.90122 from f2
union all select f2.id, 2, 'Energia Atv Injetada GDI mUC 2/2026 mPT', 'injetada', 'mUC', '2026-02-01'::date, 'KWH', -310, 1.081644, -335.31, -5.53, -335.31, 18, -60.36, 0.78122 from f2
union all select f2.id, 3, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f2;

-- 2026-03
with imp as (
  insert into operacoes.importacoes
    (tipo, status, referencia, resumo, avisos, bate, exemplo, criado_em, confirmado_em)
  values ('energisa', 'confirmada', '2026-03-01', '{"faturas": 3, "exemplo": true}', '[]', true, true,
    '2026-04-02 10:00:00-03', '2026-04-02 10:05:00-03')
  returning id
),
f0 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100001', '2026-03-01', '2026-04-11', '2026-02-23', '2026-03-23', '2026-04-23', 28, 'XY100001', 57320, 58540, 1220, '1526.47', 1120, '1211.44', null, 'Verde', '0.00', '47.12', '56.70', '5.20', '362.15', 2081, 0, 'GD_I', 'Nº 000.904.001, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
),
f1 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100002', '2026-03-01', '2026-04-11', '2026-02-23', '2026-03-23', '2026-04-23', 28, 'XY100002', 434500, 438480, 3980, '4979.80', 3880, '4196.78', null, 'Verde', '0.00', '47.12', '140.94', '12.92', '830.14', 3021, 0, 'GD_I', 'Nº 000.904.002, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
),
f2 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100003', '2026-03-01', '2026-04-11', '2026-02-23', '2026-03-23', '2026-04-23', 28, 'XY100003', 22010, 22400, 390, '487.97', 290, '313.68', 6000, 'Verde', '0.00', '47.12', '31.37', '2.87', '221.41', 0, 0, 'GD_I', 'Nº 000.904.003, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
)
insert into operacoes.energia_fatura_itens
  (fatura_id, ordem, descricao, tipo, origem, mes_geracao, unidade, quantidade,
   preco_unitario, valor, pis_cofins, base_icms, aliquota_icms, icms, tarifa_unitaria)
select f0.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 1220, 1.251207, 1526.47, 25.19, 1526.47, 18, 274.76, 0.90122 from f0
union all select f0.id, 2, 'Energia Atv Injetada GDI oUC 3/2026 mPT', 'injetada', 'oUC', '2026-03-01'::date, 'KWH', -1120, 1.081644, -1211.44, -19.99, -1211.44, 18, -218.06, 0.78122 from f0
union all select f0.id, 3, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f0
union all select f1.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 3980, 1.251207, 4979.80, 82.17, 4979.80, 18, 896.36, 0.90122 from f1
union all select f1.id, 2, 'Energia Atv Injetada GDI oUC 3/2026 mPT', 'injetada', 'oUC', '2026-03-01'::date, 'KWH', -3880, 1.081644, -4196.78, -69.25, -4196.78, 18, -755.42, 0.78122 from f1
union all select f1.id, 3, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f1
union all select f2.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 390, 1.251207, 487.97, 8.05, 487.97, 18, 87.83, 0.90122 from f2
union all select f2.id, 2, 'Energia Atv Injetada GDI mUC 3/2026 mPT', 'injetada', 'mUC', '2026-03-01'::date, 'KWH', -290, 1.081644, -313.68, -5.18, -313.68, 18, -56.46, 0.78122 from f2
union all select f2.id, 3, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f2;

-- 2026-04
with imp as (
  insert into operacoes.importacoes
    (tipo, status, referencia, resumo, avisos, bate, exemplo, criado_em, confirmado_em)
  values ('energisa', 'confirmada', '2026-04-01', '{"faturas": 3, "exemplo": true}', '[]', true, true,
    '2026-05-02 10:00:00-03', '2026-05-02 10:05:00-03')
  returning id
),
f0 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100001', '2026-04-01', '2026-05-11', '2026-03-23', '2026-04-23', '2026-05-23', 31, 'XY100001', 58540, 59690, 1150, '1438.89', 1050, '1135.73', null, 'Verde', '0.00', '47.12', '54.57', '5.00', '350.28', 2339, 0, 'GD_I', 'Nº 000.905.001, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
),
f1 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100002', '2026-04-01', '2026-05-11', '2026-03-23', '2026-04-23', '2026-05-23', 31, 'XY100002', 438480, 442300, 3820, '4779.61', 3720, '4023.72', null, 'Verde', '0.00', '47.12', '136.06', '12.47', '803.01', 3224, 0, 'GD_I', 'Nº 000.905.002, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
),
f2 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100003', '2026-04-01', '2026-05-11', '2026-03-23', '2026-04-23', '2026-05-23', 31, 'XY100003', 22400, 22770, 370, '462.95', 270, '292.04', 5500, 'Verde', '0.00', '47.12', '30.76', '2.82', '218.03', 0, 0, 'GD_I', 'Nº 000.905.003, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
)
insert into operacoes.energia_fatura_itens
  (fatura_id, ordem, descricao, tipo, origem, mes_geracao, unidade, quantidade,
   preco_unitario, valor, pis_cofins, base_icms, aliquota_icms, icms, tarifa_unitaria)
select f0.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 1150, 1.251207, 1438.89, 23.74, 1438.89, 18, 259.00, 0.90122 from f0
union all select f0.id, 2, 'Energia Atv Injetada GDI oUC 4/2026 mPT', 'injetada', 'oUC', '2026-04-01'::date, 'KWH', -1050, 1.081644, -1135.73, -18.74, -1135.73, 18, -204.43, 0.78122 from f0
union all select f0.id, 3, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f0
union all select f1.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 3820, 1.251207, 4779.61, 78.86, 4779.61, 18, 860.33, 0.90122 from f1
union all select f1.id, 2, 'Energia Atv Injetada GDI oUC 4/2026 mPT', 'injetada', 'oUC', '2026-04-01'::date, 'KWH', -3720, 1.081644, -4023.72, -66.39, -4023.72, 18, -724.27, 0.78122 from f1
union all select f1.id, 3, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f1
union all select f2.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 370, 1.251207, 462.95, 7.64, 462.95, 18, 83.33, 0.90122 from f2
union all select f2.id, 2, 'Energia Atv Injetada GDI mUC 4/2026 mPT', 'injetada', 'mUC', '2026-04-01'::date, 'KWH', -270, 1.081644, -292.04, -4.82, -292.04, 18, -52.57, 0.78122 from f2
union all select f2.id, 3, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f2;

-- 2026-05
with imp as (
  insert into operacoes.importacoes
    (tipo, status, referencia, resumo, avisos, bate, exemplo, criado_em, confirmado_em)
  values ('energisa', 'confirmada', '2026-05-01', '{"faturas": 3, "exemplo": true}', '[]', true, true,
    '2026-06-02 10:00:00-03', '2026-06-02 10:05:00-03')
  returning id
),
f0 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100001', '2026-05-01', '2026-06-11', '2026-04-23', '2026-05-23', '2026-06-23', 30, 'XY100001', 59690, 60770, 1080, '1351.30', 980, '1060.01', null, 'Amarela', '2.45', '47.12', '52.87', '4.85', '340.86', 2497, 0, 'GD_I', 'Nº 000.906.001, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
),
f1 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100002', '2026-05-01', '2026-06-11', '2026-04-23', '2026-05-23', '2026-06-23', 30, 'XY100002', 442300, 446000, 3700, '4629.47', 3600, '3893.92', null, 'Amarela', '2.45', '47.12', '132.83', '12.18', '785.12', 3037, 0, 'GD_I', 'Nº 000.906.002, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
),
f2 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100003', '2026-05-01', '2026-06-11', '2026-04-23', '2026-05-23', '2026-06-23', 30, 'XY100003', 22770, 23120, 350, '437.92', 250, '270.41', 4800, 'Amarela', '2.45', '47.12', '30.60', '2.81', '217.08', 0, 0, 'GD_I', 'Nº 000.906.003, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
)
insert into operacoes.energia_fatura_itens
  (fatura_id, ordem, descricao, tipo, origem, mes_geracao, unidade, quantidade,
   preco_unitario, valor, pis_cofins, base_icms, aliquota_icms, icms, tarifa_unitaria)
select f0.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 1080, 1.251207, 1351.30, 22.30, 1351.30, 18, 243.23, 0.90122 from f0
union all select f0.id, 2, 'Energia Atv Injetada GDI oUC 5/2026 mPT', 'injetada', 'oUC', '2026-05-01'::date, 'KWH', -980, 1.081644, -1060.01, -17.49, -1060.01, 18, -190.80, 0.78122 from f0
union all select f0.id, 3, 'Adic. B. Amarela', 'bandeira', null, null::date, null, null, null, 2.45, 0.04, 2.45, 18, 0.44, null from f0
union all select f0.id, 4, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f0
union all select f1.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 3700, 1.251207, 4629.47, 76.39, 4629.47, 18, 833.30, 0.90122 from f1
union all select f1.id, 2, 'Energia Atv Injetada GDI oUC 5/2026 mPT', 'injetada', 'oUC', '2026-05-01'::date, 'KWH', -3413, 1.081644, -3691.65, -60.91, -3691.65, 18, -664.50, 0.78122 from f1
union all select f1.id, 3, 'Energia Atv Injetada GDI oUC 10/2025 mPT', 'injetada', 'oUC', '2025-10-01'::date, 'KWH', -187, 1.081644, -202.27, -3.34, -202.27, 18, -36.41, 0.78122 from f1
union all select f1.id, 4, 'Adic. B. Amarela', 'bandeira', null, null::date, null, null, null, 2.45, 0.04, 2.45, 18, 0.44, null from f1
union all select f1.id, 5, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f1
union all select f2.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 350, 1.251207, 437.92, 7.23, 437.92, 18, 78.83, 0.90122 from f2
union all select f2.id, 2, 'Energia Atv Injetada GDI mUC 5/2026 mPT', 'injetada', 'mUC', '2026-05-01'::date, 'KWH', -250, 1.081644, -270.41, -4.46, -270.41, 18, -48.67, 0.78122 from f2
union all select f2.id, 3, 'Adic. B. Amarela', 'bandeira', null, null::date, null, null, null, 2.45, 0.04, 2.45, 18, 0.44, null from f2
union all select f2.id, 4, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f2;

-- 2026-06
with imp as (
  insert into operacoes.importacoes
    (tipo, status, referencia, resumo, avisos, bate, exemplo, criado_em, confirmado_em)
  values ('energisa', 'confirmada', '2026-06-01', '{"faturas": 3, "exemplo": true}', '[]', true, true,
    '2026-07-02 10:00:00-03', '2026-07-02 10:05:00-03')
  returning id
),
f0 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100001', '2026-06-01', '2026-07-11', '2026-05-23', '2026-06-23', '2026-07-23', 31, 'XY100001', 60770, 61780, 1010, '1311.42', 910, '1020.95', null, 'Vermelha P1', '5.80', '47.12', '53.33', '4.89', '343.39', 2627, 0, 'GD_I', 'Nº 000.907.001, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
),
f1 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100002', '2026-06-01', '2026-07-11', '2026-05-23', '2026-06-23', '2026-07-23', 31, 'XY100002', 446000, 449650, 3650, '4739.27', 3550, '3982.81', null, 'Vermelha P1', '5.80', '47.12', '137.21', '12.58', '809.38', 2607, 0, 'GD_I', 'Nº 000.907.002, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
),
f2 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100003', '2026-06-01', '2026-07-11', '2026-05-23', '2026-06-23', '2026-07-23', 31, 'XY100003', 23120, 23460, 340, '441.47', 240, '269.26', 4400, 'Vermelha P1', '5.80', '47.12', '32.03', '2.94', '225.13', 0, 0, 'GD_I', 'Nº 000.907.003, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
)
insert into operacoes.energia_fatura_itens
  (fatura_id, ordem, descricao, tipo, origem, mes_geracao, unidade, quantidade,
   preco_unitario, valor, pis_cofins, base_icms, aliquota_icms, icms, tarifa_unitaria)
select f0.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 1010, 1.298431, 1311.42, 21.64, 1311.42, 18, 236.06, 0.90122 from f0
union all select f0.id, 2, 'Energia Atv Injetada GDI oUC 6/2026 mPT', 'injetada', 'oUC', '2026-06-01'::date, 'KWH', -910, 1.121921, -1020.95, -16.85, -1020.95, 18, -183.77, 0.78122 from f0
union all select f0.id, 3, 'Adic. B. Vermelha P1', 'bandeira', null, null::date, null, null, null, 5.80, 0.10, 5.80, 18, 1.04, null from f0
union all select f0.id, 4, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f0
union all select f1.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 3650, 1.298431, 4739.27, 78.20, 4739.27, 18, 853.07, 0.90122 from f1
union all select f1.id, 2, 'Energia Atv Injetada GDI oUC 6/2026 mPT', 'injetada', 'oUC', '2026-06-01'::date, 'KWH', -3120, 1.121921, -3500.39, -57.76, -3500.39, 18, -630.07, 0.78122 from f1
union all select f1.id, 3, 'Energia Atv Injetada GDI oUC 10/2025 mPT', 'injetada', 'oUC', '2025-10-01'::date, 'KWH', -413, 1.121921, -463.35, -7.65, -463.35, 18, -83.40, 0.78122 from f1
union all select f1.id, 4, 'Energia Atv Injetada GDI oUC 11/2025 mPT', 'injetada', 'oUC', '2025-11-01'::date, 'KWH', -17, 1.121921, -19.07, -0.31, -19.07, 18, -3.43, 0.78122 from f1
union all select f1.id, 5, 'Adic. B. Vermelha P1', 'bandeira', null, null::date, null, null, null, 5.80, 0.10, 5.80, 18, 1.04, null from f1
union all select f1.id, 6, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f1
union all select f2.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 340, 1.298431, 441.47, 7.28, 441.47, 18, 79.46, 0.90122 from f2
union all select f2.id, 2, 'Energia Atv Injetada GDI mUC 6/2026 mPT', 'injetada', 'mUC', '2026-06-01'::date, 'KWH', -240, 1.121921, -269.26, -4.44, -269.26, 18, -48.47, 0.78122 from f2
union all select f2.id, 3, 'Adic. B. Vermelha P1', 'bandeira', null, null::date, null, null, null, 5.80, 0.10, 5.80, 18, 1.04, null from f2
union all select f2.id, 4, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f2;

-- 2026-07
with imp as (
  insert into operacoes.importacoes
    (tipo, status, referencia, resumo, avisos, bate, exemplo, criado_em, confirmado_em)
  values ('energisa', 'confirmada', '2026-07-01', '{"faturas": 3, "exemplo": true}', '[]', true, true,
    '2026-08-02 10:00:00-03', '2026-08-02 10:05:00-03')
  returning id
),
f0 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100001', '2026-07-01', '2026-08-11', '2026-06-23', '2026-07-23', '2026-08-23', 30, 'XY100001', 61780, 62770, 990, '1285.45', 890, '998.51', null, 'Vermelha P1', '5.80', '47.12', '52.69', '4.83', '339.86', 2730, 0, 'GD_I', 'Nº 000.908.001, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
),
f1 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100002', '2026-07-01', '2026-08-11', '2026-06-23', '2026-07-23', '2026-08-23', 30, 'XY100002', 449650, 453250, 3600, '4674.35', 3500, '3926.72', null, 'Vermelha P1', '5.80', '47.12', '135.62', '12.43', '800.55', 2085, 0, 'GD_I', 'Nº 000.908.002, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
),
f2 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100003', '2026-07-01', '2026-08-11', '2026-06-23', '2026-07-23', '2026-08-23', 30, 'XY100003', 23460, 23790, 330, '428.48', 230, '258.04', 4200, 'Vermelha P1', '5.80', '47.12', '31.72', '2.91', '223.36', 0, 0, 'GD_I', 'Nº 000.908.003, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
)
insert into operacoes.energia_fatura_itens
  (fatura_id, ordem, descricao, tipo, origem, mes_geracao, unidade, quantidade,
   preco_unitario, valor, pis_cofins, base_icms, aliquota_icms, icms, tarifa_unitaria)
select f0.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 990, 1.298431, 1285.45, 21.21, 1285.45, 18, 231.38, 0.90122 from f0
union all select f0.id, 2, 'Energia Atv Injetada GDI oUC 7/2026 mPT', 'injetada', 'oUC', '2026-07-01'::date, 'KWH', -890, 1.121921, -998.51, -16.48, -998.51, 18, -179.73, 0.78122 from f0
union all select f0.id, 3, 'Adic. B. Vermelha P1', 'bandeira', null, null::date, null, null, null, 5.80, 0.10, 5.80, 18, 1.04, null from f0
union all select f0.id, 4, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f0
union all select f1.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 3600, 1.298431, 4674.35, 77.13, 4674.35, 18, 841.38, 0.90122 from f1
union all select f1.id, 2, 'Energia Atv Injetada GDI oUC 7/2026 mPT', 'injetada', 'oUC', '2026-07-01'::date, 'KWH', -2978, 1.121921, -3341.08, -55.13, -3341.08, 18, -601.39, 0.78122 from f1
union all select f1.id, 3, 'Energia Atv Injetada GDI oUC 11/2025 mPT', 'injetada', 'oUC', '2025-11-01'::date, 'KWH', -398, 1.121921, -446.52, -7.37, -446.52, 18, -80.37, 0.78122 from f1
union all select f1.id, 4, 'Energia Atv Injetada GDI oUC 12/2025 mPT', 'injetada', 'oUC', '2025-12-01'::date, 'KWH', -124, 1.121921, -139.12, -2.30, -139.12, 18, -25.04, 0.78122 from f1
union all select f1.id, 5, 'Adic. B. Vermelha P1', 'bandeira', null, null::date, null, null, null, 5.80, 0.10, 5.80, 18, 1.04, null from f1
union all select f1.id, 6, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f1
union all select f2.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 330, 1.298431, 428.48, 7.07, 428.48, 18, 77.13, 0.90122 from f2
union all select f2.id, 2, 'Energia Atv Injetada GDI mUC 7/2026 mPT', 'injetada', 'mUC', '2026-07-01'::date, 'KWH', -230, 1.121921, -258.04, -4.26, -258.04, 18, -46.45, 0.78122 from f2
union all select f2.id, 3, 'Adic. B. Vermelha P1', 'bandeira', null, null::date, null, null, null, 5.80, 0.10, 5.80, 18, 1.04, null from f2
union all select f2.id, 4, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f2;

-- 2026-08
with imp as (
  insert into operacoes.importacoes
    (tipo, status, referencia, resumo, avisos, bate, exemplo, criado_em, confirmado_em)
  values ('energisa', 'confirmada', '2026-08-01', '{"faturas": 3, "exemplo": true}', '[]', true, true,
    '2026-09-02 10:00:00-03', '2026-09-02 10:05:00-03')
  returning id
),
f0 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100001', '2026-08-01', '2026-09-11', '2026-07-23', '2026-08-23', '2026-09-23', 31, 'XY100001', 62770, 63790, 1020, '1324.40', 920, '1032.17', null, 'Amarela', '2.45', '47.12', '53.04', '4.86', '341.80', 2899, 0, 'GD_I', 'Nº 000.909.001, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
),
f1 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100002', '2026-08-01', '2026-09-11', '2026-07-23', '2026-08-23', '2026-09-23', 31, 'XY100002', 453250, 456930, 3680, '4778.23', 3580, '4016.47', null, 'Amarela', '2.45', '47.12', '137.56', '12.61', '811.33', 1771, 0, 'GD_I', 'Nº 000.909.002, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
),
f2 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100003', '2026-08-01', '2026-09-11', '2026-07-23', '2026-08-23', '2026-09-23', 31, 'XY100003', 23790, 24135, 345, '447.96', 245, '274.87', 4600, 'Amarela', '2.45', '47.12', '31.59', '2.89', '222.66', 0, 0, 'GD_I', 'Nº 000.909.003, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
)
insert into operacoes.energia_fatura_itens
  (fatura_id, ordem, descricao, tipo, origem, mes_geracao, unidade, quantidade,
   preco_unitario, valor, pis_cofins, base_icms, aliquota_icms, icms, tarifa_unitaria)
select f0.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 1020, 1.298431, 1324.40, 21.85, 1324.40, 18, 238.39, 0.90122 from f0
union all select f0.id, 2, 'Energia Atv Injetada GDI oUC 8/2026 mPT', 'injetada', 'oUC', '2026-08-01'::date, 'KWH', -920, 1.121921, -1032.17, -17.03, -1032.17, 18, -185.79, 0.78122 from f0
union all select f0.id, 3, 'Adic. B. Amarela', 'bandeira', null, null::date, null, null, null, 2.45, 0.04, 2.45, 18, 0.44, null from f0
union all select f0.id, 4, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f0
union all select f1.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 3680, 1.298431, 4778.23, 78.84, 4778.23, 18, 860.08, 0.90122 from f1
union all select f1.id, 2, 'Energia Atv Injetada GDI oUC 8/2026 mPT', 'injetada', 'oUC', '2026-08-01'::date, 'KWH', -3266, 1.121921, -3664.19, -60.46, -3664.19, 18, -659.55, 0.78122 from f1
union all select f1.id, 3, 'Energia Atv Injetada GDI oUC 12/2025 mPT', 'injetada', 'oUC', '2025-12-01'::date, 'KWH', -314, 1.121921, -352.28, -5.81, -352.28, 18, -63.41, 0.78122 from f1
union all select f1.id, 4, 'Adic. B. Amarela', 'bandeira', null, null::date, null, null, null, 2.45, 0.04, 2.45, 18, 0.44, null from f1
union all select f1.id, 5, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f1
union all select f2.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 345, 1.298431, 447.96, 7.39, 447.96, 18, 80.63, 0.90122 from f2
union all select f2.id, 2, 'Energia Atv Injetada GDI mUC 8/2026 mPT', 'injetada', 'mUC', '2026-08-01'::date, 'KWH', -245, 1.121921, -274.87, -4.54, -274.87, 18, -49.48, 0.78122 from f2
union all select f2.id, 3, 'Adic. B. Amarela', 'bandeira', null, null::date, null, null, null, 2.45, 0.04, 2.45, 18, 0.44, null from f2
union all select f2.id, 4, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f2;

-- 2026-09
with imp as (
  insert into operacoes.importacoes
    (tipo, status, referencia, resumo, avisos, bate, exemplo, criado_em, confirmado_em)
  values ('energisa', 'confirmada', '2026-09-01', '{"faturas": 3, "exemplo": true}', '[]', true, true,
    '2026-10-02 10:00:00-03', '2026-10-02 10:05:00-03')
  returning id
),
f0 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100001', '2026-09-01', '2026-10-11', '2026-08-23', '2026-09-23', '2026-10-23', 31, 'XY100001', 63790, 64850, 1060, '1376.34', 960, '1077.04', null, 'Amarela', '2.45', '47.12', '54.31', '4.98', '348.87', 3174, 0, 'GD_I', 'Nº 000.910.001, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
),
f1 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100002', '2026-09-01', '2026-10-11', '2026-08-23', '2026-09-23', '2026-10-23', 31, 'XY100002', 456930, 460680, 3750, '4869.12', 3650, '4095.01', null, 'Amarela', '2.45', '47.12', '139.78', '12.81', '823.68', 1826, 0, 'GD_I', 'Nº 000.910.002, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
),
f2 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100003', '2026-09-01', '2026-10-11', '2026-08-23', '2026-09-23', '2026-10-23', 31, 'XY100003', 24135, 24495, 360, '467.44', 260, '291.70', 5200, 'Amarela', '2.45', '47.12', '32.07', '2.94', '225.31', 0, 0, 'GD_I', 'Nº 000.910.003, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
)
insert into operacoes.energia_fatura_itens
  (fatura_id, ordem, descricao, tipo, origem, mes_geracao, unidade, quantidade,
   preco_unitario, valor, pis_cofins, base_icms, aliquota_icms, icms, tarifa_unitaria)
select f0.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 1060, 1.298431, 1376.34, 22.71, 1376.34, 18, 247.74, 0.90122 from f0
union all select f0.id, 2, 'Energia Atv Injetada GDI oUC 9/2026 mPT', 'injetada', 'oUC', '2026-09-01'::date, 'KWH', -960, 1.121921, -1077.04, -17.77, -1077.04, 18, -193.87, 0.78122 from f0
union all select f0.id, 3, 'Adic. B. Amarela', 'bandeira', null, null::date, null, null, null, 2.45, 0.04, 2.45, 18, 0.44, null from f0
union all select f0.id, 4, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f0
union all select f1.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 3750, 1.298431, 4869.12, 80.34, 4869.12, 18, 876.44, 0.90122 from f1
union all select f1.id, 2, 'Energia Atv Injetada GDI oUC 9/2026 mPT', 'injetada', 'oUC', '2026-09-01'::date, 'KWH', -3650, 1.121921, -4095.01, -67.57, -4095.01, 18, -737.10, 0.78122 from f1
union all select f1.id, 3, 'Adic. B. Amarela', 'bandeira', null, null::date, null, null, null, 2.45, 0.04, 2.45, 18, 0.44, null from f1
union all select f1.id, 4, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f1
union all select f2.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 360, 1.298431, 467.44, 7.71, 467.44, 18, 84.14, 0.90122 from f2
union all select f2.id, 2, 'Energia Atv Injetada GDI mUC 9/2026 mPT', 'injetada', 'mUC', '2026-09-01'::date, 'KWH', -260, 1.121921, -291.70, -4.81, -291.70, 18, -52.51, 0.78122 from f2
union all select f2.id, 3, 'Adic. B. Amarela', 'bandeira', null, null::date, null, null, null, 2.45, 0.04, 2.45, 18, 0.44, null from f2
union all select f2.id, 4, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f2;

-- 2026-10
with imp as (
  insert into operacoes.importacoes
    (tipo, status, referencia, resumo, avisos, bate, exemplo, criado_em, confirmado_em)
  values ('energisa', 'confirmada', '2026-10-01', '{"faturas": 3, "exemplo": true}', '[]', true, true,
    '2026-11-02 10:00:00-03', '2026-11-02 10:05:00-03')
  returning id
),
f0 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100001', '2026-10-01', '2026-11-11', '2026-09-23', '2026-10-23', '2026-11-23', 30, 'XY100001', 64850, 65960, 1110, '1441.26', 1010, '1133.14', null, 'Vermelha P1', '5.80', '47.12', '56.50', '5.18', '361.04', 3495, 120, 'GD_I', 'Nº 000.911.001, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
),
f1 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100002', '2026-10-01', '2026-11-11', '2026-09-23', '2026-10-23', '2026-11-23', 30, 'XY100002', 460680, 465630, 4950, '6427.23', 4850, '5441.32', null, 'Vermelha P1', '5.80', '47.12', '178.50', '16.37', '1038.83', 970, 0, 'GD_I', 'Nº 000.911.002, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
),
f2 as (
  insert into operacoes.energia_faturas (importacao_id, exemplo, matricula, referencia, vencimento, leitura_anterior_data, leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior, leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado, injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins, total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao)
  select imp.id, true, '0009100003', '2026-10-01', '2026-11-11', '2026-09-23', '2026-10-23', '2026-11-23', 30, 'XY100003', 24495, 24870, 375, '486.91', 275, '308.53', 5600, 'Vermelha P1', '5.80', '47.12', '33.14', '3.04', '231.30', 0, 0, 'GD_I', 'Nº 000.911.003, série 001 (exemplo)', 'Fatura de exemplo (fictícia).'
  from imp
  returning id
)
insert into operacoes.energia_fatura_itens
  (fatura_id, ordem, descricao, tipo, origem, mes_geracao, unidade, quantidade,
   preco_unitario, valor, pis_cofins, base_icms, aliquota_icms, icms, tarifa_unitaria)
select f0.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 1110, 1.298431, 1441.26, 23.78, 1441.26, 18, 259.43, 0.90122 from f0
union all select f0.id, 2, 'Energia Atv Injetada GDI oUC 10/2026 mPT', 'injetada', 'oUC', '2026-10-01'::date, 'KWH', -1010, 1.121921, -1133.14, -18.70, -1133.14, 18, -203.97, 0.78122 from f0
union all select f0.id, 3, 'Adic. B. Vermelha P1', 'bandeira', null, null::date, null, null, null, 5.80, 0.10, 5.80, 18, 1.04, null from f0
union all select f0.id, 4, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f0
union all select f1.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 4950, 1.298431, 6427.23, 106.05, 6427.23, 18, 1156.90, 0.90122 from f1
union all select f1.id, 2, 'Energia Atv Injetada GDI oUC 10/2026 mPT', 'injetada', 'oUC', '2026-10-01'::date, 'KWH', -3994, 1.121921, -4480.95, -73.94, -4480.95, 18, -806.57, 0.78122 from f1
union all select f1.id, 3, 'Energia Atv Injetada GDI oUC 12/2025 mPT', 'injetada', 'oUC', '2025-12-01'::date, 'KWH', -112, 1.121921, -125.66, -2.07, -125.66, 18, -22.62, 0.78122 from f1
union all select f1.id, 4, 'Energia Atv Injetada GDI oUC 1/2026 mPT', 'injetada', 'oUC', '2026-01-01'::date, 'KWH', -535, 1.121921, -600.23, -9.90, -600.23, 18, -108.04, 0.78122 from f1
union all select f1.id, 5, 'Energia Atv Injetada GDI oUC 2/2026 mPT', 'injetada', 'oUC', '2026-02-01'::date, 'KWH', -209, 1.121921, -234.48, -3.87, -234.48, 18, -42.21, 0.78122 from f1
union all select f1.id, 6, 'Adic. B. Vermelha P1', 'bandeira', null, null::date, null, null, null, 5.80, 0.10, 5.80, 18, 1.04, null from f1
union all select f1.id, 7, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f1
union all select f2.id, 1, 'Consumo em kWh', 'consumo', null, null::date, 'KWH', 375, 1.298431, 486.91, 8.03, 486.91, 18, 87.64, 0.90122 from f2
union all select f2.id, 2, 'Energia Atv Injetada GDI mUC 10/2026 mPT', 'injetada', 'mUC', '2026-10-01'::date, 'KWH', -275, 1.121921, -308.53, -5.09, -308.53, 18, -55.54, 0.78122 from f2
union all select f2.id, 3, 'Adic. B. Vermelha P1', 'bandeira', null, null::date, null, null, null, 5.80, 0.10, 5.80, 18, 1.04, null from f2
union all select f2.id, 4, 'CONTRIBUIÇÃO ILUM PUBLICA', 'iluminacao', null, null::date, null, null, null, 47.12, null, null, null, null, null from f2;
