-- Dados iniciais: catálogo de permissões e valores de referência da
-- especificação do RH (16/10/2026). Tudo continua editável na tela; a Gestora
-- de RH confirma encargos e rubricas antes do primeiro fechamento.
-- RAT, FAP e o ciclo do banco de horas não têm valor conhecido: a Gestora
-- preenche em Parâmetros.

-- Mesmo catálogo de src/lib/permissions.ts (um teste confere os dois).
insert into core.permissoes (codigo, descricao) values
  ('admin.usuarios', 'Gerenciar usuários e permissões'),
  ('rh.painel', 'Ver o painel de RH'),
  ('rh.custo_pessoal', 'Ver custo de pessoal por departamento e cargo'),
  ('rh.custo_pessoal.individual', 'Ver salário e custo individual, com memória de cálculo'),
  ('rh.quadro', 'Ver quadro, admissões, desligamentos e turnover'),
  ('rh.jornada', 'Ver absenteísmo, horas extras e banco de horas'),
  ('rh.endomarketing', 'Ver gastos de endomarketing'),
  ('rh.folha', 'Importar a folha mensal e classificar rubricas'),
  ('rh.beneficios', 'Cadastrar benefícios, plano de saúde e dependentes'),
  ('rh.parametros', 'Editar parâmetros, metas e faixas do semáforo do RH'),
  ('financeiro.painel', 'Ver o painel financeiro'),
  ('financeiro.inadimplencia', 'Ver a inadimplência por cliente e as parcelas'),
  ('financeiro.inadimplencia.contato', 'Ver e-mail e telefone do cliente'),
  ('financeiro.faturamento', 'Ver faturado, recebido e a receber'),
  ('financeiro.contas_a_pagar', 'Ver notas a vencer e títulos pagos'),
  ('financeiro.fluxo_de_caixa', 'Ver entradas e saídas realizadas e previstas'),
  ('financeiro.plano_orcamentario', 'Ver o realizado por conta e por setor'),
  ('financeiro.performance_capital', 'Ver o Performance & Capital'),
  ('financeiro.importacao_parametros', 'Importar o relatório do ENET e editar dívida, metas e faixas da régua'),
  ('financeiro.exportar', 'Exportar Excel e PDF das telas liberadas');

-- Encargos por tipo de contrato (seção 4.1 da especificação).
insert into rh.encargos_por_contrato (
  tipo_contrato, vigente_desde, inss_patronal_pct, terceiros_pct, fgts_pct,
  aplica_rat, provisiona_13, provisiona_ferias, multa_rescisoria_pct
) values
  ('clt',        '2026-01-01', 20, 5.8, 8, true,  true,  true,  40),
  ('aprendiz',   '2026-01-01', 20, 5.8, 2, true,  true,  true,  40),
  ('estagiario', '2026-01-01',  0, 0,   0, false, false, false,  0),
  ('pj',         '2026-01-01',  0, 0,   0, false, false, false,  0),
  ('pro_labore', '2026-01-01', 20, 0,   0, false, false, false,  0);

-- Meta inicial do % de custo de pessoal sobre a receita bruta.
insert into core.metas (indicador, direcao, meta, limite_atencao, vigente_desde)
values ('rh.custo_sobre_receita', 'menor_melhor', 10, null, '2026-01-01');

-- Rubricas mapeadas na folha de 07/2026 (seção 4.2 da especificação).
insert into rh.rubricas (codigo, descricao, grupo) values
  (8781, 'Dias normais', 'salario'),
  (9180, 'Saldo de salário', 'salario'),
  (100,  'Pró-labore', 'pro_labore'),
  (358,  'Triênio', 'adicional'),
  (353,  'Triênio', 'adicional'),
  (149,  'Periculosidade', 'adicional'),
  (330,  'Adicional noturno', 'adicional'),
  (854,  'Reflexo adicional noturno DSR', 'adicional'),
  (339,  'Quebra de caixa', 'adicional'),
  (250,  'Reflexo extras DSR', 'hora_extra'),
  (408,  'Saldo banco de horas 50%', 'hora_extra'),
  (8221, 'Antecipação salarial', 'adiantamento'),
  (981,  'Desconto do adiantamento', 'adiantamento'),
  (8468, 'Desconto do adiantamento', 'adiantamento'),
  (8785, 'Afastamento por doença', 'afastamento'),
  (8786, 'Afastamento por acidente', 'afastamento'),
  (8796, 'Aposentadoria por invalidez', 'afastamento'),
  (8801, 'Desconto dos dias afastados', 'afastamento'),
  (8808, 'Desconto dos dias afastados', 'afastamento'),
  (9591, 'Aviso prévio', 'rescisao'),
  (28,   'Férias', 'pagamento_provisionado'),
  (29,   'Férias', 'pagamento_provisionado'),
  (64,   'Férias', 'pagamento_provisionado'),
  (811,  'Férias', 'pagamento_provisionado'),
  (8126, 'Férias', 'pagamento_provisionado'),
  (307,  'Plano de saúde', 'beneficio_desconto'),
  (8111, 'Desconto plano de saúde (detalhado)', 'beneficio_desconto'),
  (490,  'Plano de saúde dependente', 'beneficio_desconto'),
  (478,  'Odonto dependente', 'beneficio_desconto'),
  (319,  'Alimentação', 'beneficio_desconto'),
  (334,  'Vale-transporte 1%', 'beneficio_desconto'),
  (405,  'Pensão', 'desconto_terceiros'),
  (486,  'Pensão', 'desconto_terceiros'),
  (487,  'Pensão', 'desconto_terceiros'),
  (484,  'Empréstimo consignado', 'desconto_terceiros'),
  (485,  'Empréstimo consignado', 'desconto_terceiros'),
  (491,  'Empréstimo consignado', 'desconto_terceiros'),
  (493,  'Empréstimo consignado', 'desconto_terceiros'),
  (9750, 'Empréstimo consignado', 'desconto_terceiros'),
  (9754, 'Estorno', 'desconto_terceiros'),
  (9755, 'Estorno', 'desconto_terceiros'),
  (202,  'Farmácia', 'desconto_terceiros'),
  (473,  'Farmácia', 'desconto_terceiros'),
  (483,  'Segunda via de cartão', 'desconto_terceiros'),
  (998,  'INSS', 'imposto_funcionario'),
  (999,  'IRRF', 'imposto_funcionario'),
  (821,  'Diferença de INSS', 'imposto_funcionario'),
  (826,  'Diferença de INSS', 'imposto_funcionario'),
  (836,  'Diferença de INSS', 'imposto_funcionario'),
  (989,  'Diferença de INSS', 'imposto_funcionario'),
  (843,  'INSS do pró-labore', 'imposto_funcionario'),
  (992,  'Troco do mês', 'arredondamento'),
  (993,  'Troco do mês anterior', 'arredondamento'),
  (991,  'Estouro', 'arredondamento'),
  (995,  'Salário-família', 'reembolso_inss');

-- 13º pago na rescisão: faixas 8550–8561 e 9592–9608. A descrição exata vem
-- na primeira importação que trouxer cada código.
insert into rh.rubricas (codigo, descricao, grupo)
select codigo, '13º salário', 'pagamento_provisionado'
from (
  select generate_series(8550, 8561) as codigo
  union all
  select generate_series(9592, 9608)
) faixas;
