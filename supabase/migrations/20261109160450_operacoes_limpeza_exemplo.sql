-- operacoes_limpeza_exemplo: meses de exemplo do rateio da limpeza, até o
-- histórico real ser importado. Todos com exemplo = true (somem com
-- operacoes.remover_exemplos()). Julho e agosto de 2026 seguem os totais do
-- mockup, fechados e enviados. Outubro fica aberto para lançar, com os
-- minutos e a soma dos extras de setembro da spec (4.8): dá a mesma conta
-- de setembro (área comum 42.084,08, total 57.783,61). Setembro em si fica
-- de fora (o teste do contrato, supabase/tests/operacoes.test.ts, cria esse
-- mês). Valores de rateio, sem dado pessoal; nomes da equipe fictícios.

insert into operacoes.limpeza_meses (
  referencia, apontamento, valor_base, base_composicao, func_base,
  func_area_comum, func_rateados, regra_bl04, status, origem, exemplo,
  fechado_em, enviado_em, criado_em
) values
  ('2026-07-01', 'APONTAMENTO 07.2026 (EXEMPLO)', 35323.94,
   '38.509,83 − 8.072,68 + 1.736,79 + 630,00 + 2.520,00', 9, 5, 4, 'separado',
   'fechado', 'tela', true, '2026-08-05 16:00-03', '2026-08-06 10:00-03', '2026-08-03 09:00-03'),
  ('2026-08-01', 'APONTAMENTO 08.2026 (EXEMPLO)', 35323.94,
   '38.509,83 − 8.072,68 + 1.736,79 + 630,00 + 2.520,00', 9, 5, 4, 'separado',
   'fechado', 'tela', true, '2026-09-03 15:30-03', '2026-09-04 09:20-03', '2026-09-01 09:00-03'),
  ('2026-10-01', 'APONTAMENTO 10.2026 (EXEMPLO)', 35323.94,
   '38.509,83 − 8.072,68 + 1.736,79 + 630,00 + 2.520,00', 9, 5, 4, 'separado',
   'aberto', 'tela', true, null, null, '2026-11-03 09:00-03')
on conflict (referencia) do nothing;

-- Extras da área comum: (mês, ordem, descrição, quantidade, valor por unidade, valor).
insert into operacoes.limpeza_extras (referencia, ordem, descricao, quantidade, valor_unitario, valor)
select m.ref::date, e.ordem, e.descricao, e.qtd, e.unit, e.valor
from (values ('2026-07-01', 7, 5), ('2026-08-01', 11, 5), ('2026-10-01', 9, 4))
  as m (ref, vigia, domingos)
cross join lateral (values
  (0, 'Insalubridade espaço pet', null::numeric, null::numeric, 278.68),
  (1, 'Limpeza banheiros (por auxiliar/mês)', 4, 3897.00, 15588.00),
  (2, 'Vigia extra fins de semana', m.vigia, 315.00, m.vigia * 315.00),
  (3, 'Insalubridade limpeza de banheiro', null, null, 2497.99),
  (4, 'Limpeza extra banheiros domingos e feriados', m.domingos, 315.00, m.domingos * 315.00)
) as e (ordem, descricao, qtd, unit, valor)
where exists (select 1 from operacoes.limpeza_meses x where x.referencia = m.ref::date and x.exemplo)
  and not exists (select 1 from operacoes.limpeza_extras x where x.referencia = m.ref::date);

-- Minutos por dia (limpeza, manutenção) de cada bloco.
insert into operacoes.limpeza_minutos (referencia, bloco, limpeza, manutencao)
select v.ref::date, v.bloco, v.limpeza, v.manutencao
from (values
  ('2026-07-01', '01', 128, 75), ('2026-07-01', '02', 70, 72), ('2026-07-01', '04', 230, 148),
  ('2026-07-01', '05', 294, 227), ('2026-07-01', '09', 150, 117), ('2026-07-01', '10', 176, 116),
  ('2026-07-01', '11', 166, 150),
  ('2026-08-01', '01', 123, 79), ('2026-08-01', '02', 71, 74), ('2026-08-01', '04', 232, 143),
  ('2026-08-01', '05', 296, 225), ('2026-08-01', '09', 152, 119), ('2026-08-01', '10', 177, 111),
  ('2026-08-01', '11', 167, 150),
  ('2026-10-01', '01', 131, 73), ('2026-10-01', '02', 67, 74), ('2026-10-01', '04', 229, 150),
  ('2026-10-01', '05', 295, 226), ('2026-10-01', '09', 152, 114), ('2026-10-01', '10', 178, 115),
  ('2026-10-01', '11', 167, 148)
) as v (ref, bloco, limpeza, manutencao)
where exists (select 1 from operacoes.limpeza_meses x where x.referencia = v.ref::date and x.exemplo)
on conflict (referencia, bloco) do nothing;

-- Composição do contrato: só a parte de limpeza entra na conferência.
insert into operacoes.limpeza_contrato (referencia, ordem, descricao, valor, entra_conferencia)
select m.ref::date, c.ordem, c.descricao, c.valor, c.entra
from (values ('2026-07-01', 7, 5), ('2026-08-01', 11, 5), ('2026-10-01', 9, 4))
  as m (ref, vigia, domingos)
cross join lateral (values
  (0, 'Vigia com 13 agentes e viatura', 51937.71, false),
  (1, 'Limpeza com 13 auxiliares', 53688.61, true),
  (2, 'Limpeza administrativa com 1 auxiliar', 3569.45, false),
  (3, 'Vigilância patrimonial com 2 vigilantes', 13979.98, false),
  (4, format('2 vigias extras de fim de semana (315,00 × %s)', m.vigia), m.vigia * 315.00, true),
  (5, format('1 limpeza de banheiro em domingos e feriados (315,00 × %s)', m.domingos), m.domingos * 315.00, true)
) as c (ordem, descricao, valor, entra)
where exists (select 1 from operacoes.limpeza_meses x where x.referencia = m.ref::date and x.exemplo)
  and not exists (select 1 from operacoes.limpeza_contrato x where x.referencia = m.ref::date);

-- Equipe (nomes fictícios): 4 nos blocos (minutos = soma dos blocos dela),
-- 5 na área comum e 4 nos banheiros (extra da área comum).
insert into operacoes.limpeza_equipe (referencia, ordem, nome, funcao, grupo, blocos, turno, minutos_dia)
select m.referencia, e.ordem, e.nome, e.funcao, e.grupo, e.blocos, e.turno,
  case when e.grupo = 'blocos' then (
    select sum(n.limpeza + n.manutencao)::int from operacoes.limpeza_minutos n
    where n.referencia = m.referencia and n.bloco = any (e.blocos)
  ) end
from operacoes.limpeza_meses m
cross join (values
  (0, 'Colaborador A', 'Auxiliar de limpeza', 'blocos', '{01,11}'::text[], 'Segunda a sexta'),
  (1, 'Colaborador B', 'Auxiliar de limpeza', 'blocos', '{02,04}', 'Segunda a sexta'),
  (2, 'Colaborador C', 'Auxiliar de limpeza', 'blocos', '{05}', 'Segunda a sexta'),
  (3, 'Colaborador D', 'Auxiliar de limpeza', 'blocos', '{09,10}', 'Segunda a sexta'),
  (4, 'Colaborador E', 'Capina e áreas externas', 'area_comum', '{}', 'Segunda a sexta'),
  (5, 'Colaborador F', 'Capina e áreas externas', 'area_comum', '{}', 'Segunda a sexta'),
  (6, 'Colaborador G', 'Capina e áreas externas', 'area_comum', '{}', 'Segunda a sexta'),
  (7, 'Colaborador H', 'Coleta de lixo (insalubridade)', 'area_comum', '{}', '12x36'),
  (8, 'Colaborador I', 'Coleta de lixo (insalubridade)', 'area_comum', '{}', '12x36'),
  (9, 'Colaborador J', 'Limpeza de banheiros', 'banheiros', '{}', 'Segunda a sábado'),
  (10, 'Colaborador K', 'Limpeza de banheiros', 'banheiros', '{}', 'Segunda a sábado'),
  (11, 'Colaborador L', 'Limpeza de banheiros', 'banheiros', '{}', 'Segunda a sábado'),
  (12, 'Colaborador M', 'Limpeza de banheiros', 'banheiros', '{}', 'Escala de domingo')
) as e (ordem, nome, funcao, grupo, blocos, turno)
where m.exemplo
  and not exists (select 1 from operacoes.limpeza_equipe x where x.referencia = m.referencia);
