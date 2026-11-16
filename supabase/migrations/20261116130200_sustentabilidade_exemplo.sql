-- Dados de exemplo do Módulo Sustentabilidade, no volume da seção 6 do spec.
-- Tudo fictício e marcado com exemplo = true: nomes inventados, CNPJs que
-- começam com 99 e terminam em 0001-00 (não existem), e-mails em
-- exemplo.invalid. Saem todos por sustentabilidade.remover_exemplos().
--
--   * 272 contratos (30 de Área Publicitária, 8 rescindidos), de 178 clientes
--   * questionário da entrevista (versões 1 e 2) e 23 entrevistas na versão 1
--     (20 de 2026 e 3 de 2024, que estão vencendo ou vencidas)
--   * Clube: 27 participantes locatários e 3 não locatários
--   * 12 coletores e 12 semanas de rondas
--   * 10 notas de RCC de 2026 e o preço das caçambas
--   * 3 programas (SustentArp, Mercado Local, Turismo), com formulários,
--     indicadores e lançamentos de janeiro a outubro de 2026
--   * marco inicial de 2024 e 2025

-- ---------------------------------------------------------------------------
-- Contratos
-- ---------------------------------------------------------------------------

with x as (
  select i, ((i - 1) % 178) + 1 as k,
    (array['01','02','04','05','09','10','11','12','14','16'])[1 + i % 10] as b
  from generate_series(1, 272) i
)
insert into sustentabilidade.contratos
  (id, contrato, cliente_nome, cliente_doc, lucs, bloco, tipo_loja, ramo, ativacao, inicio,
   rescisao, situacao, sincronizado_em, exemplo)
select
  ('c0000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
  'EX-' || lpad((100 + i)::text, 4, '0'),
  (array['Ateliê','Café','Clínica','Estúdio','Empório','Espaço','Casa','Loja','Instituto','Doceria',
         'Barbearia','Ótica','Padaria','Consultório','Academia','Livraria','Floricultura','Pet'])[1 + k % 18]
    || ' ' ||
  (array['Serra Azul','Vale Verde','Boa Vista','Aurora','Mirante','Horizonte','Jardim','Primavera',
         'Cascata','Alecrim'])[1 + (k / 18) % 10],
  '99' || lpad(k::text, 6, '0') || '000100',
  case
    when i % 9 = 0 then array['OOH' || lpad((i / 9)::text, 2, '0')]
    when i % 40 = 7 then array['ESTAC_' || lpad((i / 40 + 1)::text, 2, '0')]
    when i % 17 = 5 then array[b || '_129', b || '_130', b || '_202']
    else array[b || '_' || (1 + i % 3) || lpad((1 + i % 40)::text, 2, '0')]
  end,
  case when i % 9 = 0 then null else b end,
  case
    when i % 9 = 0 then 'Área Publicitária'
    when i % 40 = 7 then 'Quiosque'
    when i % 45 = 11 then 'Outros'
    when i % 2 = 0 then 'Sala Comercial'
    else 'Loja Comercial'
  end,
  (array['Gastronomia','Moda','Serviços médicos','Serviços','Academias','Educação','Veterinária',
         'Comércio','Beleza'])[1 + i % 9],
  date '2019-01-05' + (i * 53) % 2800,
  date '2019-01-05' + (i * 53) % 2800 - 20,
  case when i > 178 and i <= 258 and (i - 181) % 11 = 0 then date '2026-08-15' + i % 60 end,
  case when i > 178 and i <= 258 and (i - 181) % 11 = 0 then 'encerrado' else 'vigente' end,
  timestamptz '2026-11-16 07:30:00-03',
  true
from x;

-- ---------------------------------------------------------------------------
-- Formulários: ajudantes para montar a DefinicaoFormulario (saem no fim)
-- ---------------------------------------------------------------------------

create function sustentabilidade._ex_p(
  p_id text, p_numero text, p_texto text, p_tipo text,
  p_opcoes text[] default '{}', p_obrigatoria boolean default false,
  p_se text default null, p_se_valor text default null,
  p_fonte boolean default false, p_ajuda text default '',
  p_unidades text[] default '{}', p_auto text default null
) returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'id', p_id, 'numero', p_numero, 'texto', p_texto, 'ajuda', p_ajuda, 'tipo', p_tipo,
    'obrigatoria', p_obrigatoria,
    'opcoes', coalesce((
      select jsonb_agg(jsonb_build_object('id', p_id || '_' || n, 'texto', t, 'ativa', true) order by n)
      from unnest(p_opcoes) with ordinality as o (t, n)), '[]'::jsonb),
    'unidades', to_jsonb(p_unidades),
    'mostrar_se', case when p_se is null then null
      else jsonb_build_object('pergunta_id', p_se, 'valor', p_se_valor) end,
    'fonte_indicador', p_fonte, 'ativa', true, 'travada', p_auto is not null, 'auto', p_auto);
$$;

create function sustentabilidade._ex_s(p_id text, p_nome text, variadic p_perguntas jsonb[])
returns jsonb language sql immutable as $$
  select jsonb_build_object('id', p_id, 'nome', p_nome, 'ativa', true, 'perguntas', to_jsonb(p_perguntas));
$$;

-- ---------------------------------------------------------------------------
-- Questionário da entrevista: o mesmo de src/lib/sustentabilidade/
-- questionario-inicial.ts (ids q1…q46, q18b e q25b; opções qN_algo; seções
-- A–F). Versão 1 = o Forms (46 perguntas + 18b); versão 2 = a 1 + 25b, criada
-- sem respostas. O teste do banco confere que este texto é igual ao do código.
-- ---------------------------------------------------------------------------

do $$
declare
  v2 jsonb := $q$
{"secoes": [
  {"id": "A", "nome": "Identificação", "ativa": true, "perguntas": [
    {"id":"q1","numero":"1","texto":"Nome da empresa","ajuda":"","tipo":"auto","obrigatoria":false,"opcoes":[],"unidades":[],"mostrar_se":null,"fonte_indicador":false,"ativa":true,"travada":true,"auto":"empresa"},
    {"id":"q2","numero":"2","texto":"Código do sistema (LUC)","ajuda":"","tipo":"auto","obrigatoria":false,"opcoes":[],"unidades":[],"mostrar_se":null,"fonte_indicador":false,"ativa":true,"travada":true,"auto":"luc"},
    {"id":"q3","numero":"3","texto":"Setor econômico","ajuda":"Define o prazo para refazer a entrevista.","tipo":"varias","obrigatoria":false,"opcoes":[{"id":"q3_saude","texto":"Saúde","ativa":true},{"id":"q3_industrial","texto":"Industrial/Confecção","ativa":true},{"id":"q3_gastronomico","texto":"Gastronômico","ativa":true},{"id":"q3_lojas","texto":"Lojas e serviços gerais","ativa":true},{"id":"q3_educacao_basica","texto":"Educação básica","ativa":true},{"id":"q3_educacao_profissionalizante","texto":"Educação profissionalizante","ativa":true},{"id":"q3_academia","texto":"Academia","ativa":true}],"unidades":[],"mostrar_se":null,"fonte_indicador":true,"ativa":true,"travada":false,"auto":null},
    {"id":"q4","numero":"4","texto":"Situação","ajuda":"","tipo":"auto","obrigatoria":false,"opcoes":[],"unidades":[],"mostrar_se":null,"fonte_indicador":false,"ativa":true,"travada":true,"auto":"situacao"},
    {"id":"q5","numero":"5","texto":"Data da entrevista","ajuda":"","tipo":"auto","obrigatoria":false,"opcoes":[],"unidades":[],"mostrar_se":null,"fonte_indicador":false,"ativa":true,"travada":true,"auto":"data"}
  ]},
  {"id": "B", "nome": "Entrevistado e estabelecimento", "ativa": true, "perguntas": [
    {"id":"q6","numero":"6","texto":"Nome completo e cargo do respondente","ajuda":"","tipo":"texto","obrigatoria":true,"opcoes":[],"unidades":[],"mostrar_se":null,"fonte_indicador":false,"ativa":true,"travada":false,"auto":null},
    {"id":"q7","numero":"7","texto":"Grau de conhecimento sobre gestão de resíduos","ajuda":"A entrevistadora avalia pela conversa.","tipo":"uma","obrigatoria":true,"opcoes":[{"id":"q7_muito","texto":"10 a 9 - muito conhecimento","ativa":true},{"id":"q7_mediano","texto":"8 a 6 - conhecimento mediano","ativa":true},{"id":"q7_pouco","texto":"5 a 3 - pouco conhecimento","ativa":true},{"id":"q7_nenhum","texto":"3 a 0 - sem conhecimento algum","ativa":true}],"unidades":[],"mostrar_se":null,"fonte_indicador":true,"ativa":true,"travada":false,"auto":null},
    {"id":"q8","numero":"8","texto":"Número de pessoas fixas (funcionários)","ajuda":"","tipo":"numero","obrigatoria":false,"opcoes":[],"unidades":[],"mostrar_se":null,"fonte_indicador":false,"ativa":true,"travada":false,"auto":null},
    {"id":"q9","numero":"9","texto":"Número de visitantes por dia (média)","ajuda":"","tipo":"numero","obrigatoria":false,"opcoes":[],"unidades":[],"mostrar_se":null,"fonte_indicador":false,"ativa":true,"travada":false,"auto":null},
    {"id":"q10","numero":"10","texto":"Existem banheiros internos? Quantos sanitários?","ajuda":"Se sim, informe a quantidade.","tipo":"sim_nao_quantidade","obrigatoria":false,"opcoes":[],"unidades":[],"mostrar_se":null,"fonte_indicador":false,"ativa":true,"travada":false,"auto":null},
    {"id":"q11","numero":"11","texto":"Existe copa, refeitório ou venda de alimentos?","ajuda":"Se sim, descreva quantidade, tamanho e funcionamento.","tipo":"sim_nao_descricao","obrigatoria":false,"opcoes":[],"unidades":[],"mostrar_se":null,"fonte_indicador":false,"ativa":true,"travada":false,"auto":null}
  ]},
  {"id": "C", "nome": "SustentArp", "ativa": true, "perguntas": [
    {"id":"q12","numero":"12","texto":"Você conhece o SustentArp?","ajuda":"","tipo":"uma","obrigatoria":false,"opcoes":[{"id":"q12_sim","texto":"Sim","ativa":true},{"id":"q12_pouco","texto":"Pouco","ativa":true},{"id":"q12_nao","texto":"Não","ativa":true}],"unidades":[],"mostrar_se":null,"fonte_indicador":true,"ativa":true,"travada":false,"auto":null},
    {"id":"q13","numero":"13","texto":"Sua empresa contribui para o Clube do SustentArp?","ajuda":"Se não, apresentar o clube.","tipo":"uma","obrigatoria":false,"opcoes":[{"id":"q13_sim","texto":"Sim","ativa":true},{"id":"q13_ainda_nao","texto":"Ainda não","ativa":true},{"id":"q13_nao","texto":"Não","ativa":true}],"unidades":[],"mostrar_se":null,"fonte_indicador":true,"ativa":true,"travada":false,"auto":null},
    {"id":"q14","numero":"14","texto":"Tem alguma sugestão para o Programa SustentArp?","ajuda":"","tipo":"texto_longo","obrigatoria":false,"opcoes":[],"unidades":[],"mostrar_se":null,"fonte_indicador":false,"ativa":true,"travada":false,"auto":null},
    {"id":"q15","numero":"15","texto":"Comentários e observações gerais","ajuda":"","tipo":"texto_longo","obrigatoria":false,"opcoes":[],"unidades":[],"mostrar_se":null,"fonte_indicador":false,"ativa":true,"travada":false,"auto":null}
  ]},
  {"id": "D", "nome": "PGRS", "ativa": true, "perguntas": [
    {"id":"q16","numero":"16","texto":"A empresa possui PGRS?","ajuda":"PGRS é o Plano de Gerenciamento de Resíduos Sólidos.","tipo":"uma","obrigatoria":true,"opcoes":[{"id":"q16_sim","texto":"Sim","ativa":true},{"id":"q16_nao","texto":"Não","ativa":true}],"unidades":[],"mostrar_se":null,"fonte_indicador":true,"ativa":true,"travada":false,"auto":null},
    {"id":"q17","numero":"17","texto":"Em que data o PGRS foi elaborado?","ajuda":"","tipo":"data","obrigatoria":false,"opcoes":[],"unidades":[],"mostrar_se":{"pergunta_id":"q16","valor":"q16_sim"},"fonte_indicador":false,"ativa":true,"travada":false,"auto":null}
  ]},
  {"id": "E", "nome": "Resíduos", "ativa": true, "perguntas": [
    {"id":"q18","numero":"18","texto":"Quais tipos de resíduos são gerados e como são acondicionados?","ajuda":"","tipo":"texto_longo","obrigatoria":false,"opcoes":[],"unidades":[],"mostrar_se":null,"fonte_indicador":false,"ativa":true,"travada":false,"auto":null},
    {"id":"q18b","numero":"18b","texto":"O estabelecimento separa os resíduos?","ajuda":"Define quais perguntas aparecem a seguir.","tipo":"uma","obrigatoria":true,"opcoes":[{"id":"q18b_sim","texto":"Sim","ativa":true},{"id":"q18b_nao","texto":"Não","ativa":true}],"unidades":[],"mostrar_se":null,"fonte_indicador":true,"ativa":true,"travada":false,"auto":null},
    {"id":"q19","numero":"19","texto":"Quantidade diária de lixo gerado","ajuda":"","tipo":"numero_unidade","obrigatoria":false,"opcoes":[],"unidades":["saco de 5 L","saco de 50 L","saco de 100 L","saco de 200 L","litros","kg"],"mostrar_se":{"pergunta_id":"q18b","valor":"q18b_nao"},"fonte_indicador":false,"ativa":true,"travada":false,"auto":null},
    {"id":"q20","numero":"20","texto":"Estimativa de geração por tipo de resíduo","ajuda":"","tipo":"grade","obrigatoria":false,"opcoes":[{"id":"q20_organico","texto":"Orgânico (restos de comida)","ativa":true},{"id":"q20_plastico","texto":"Plástico","ativa":true},{"id":"q20_papel","texto":"Papel/papelão","ativa":true},{"id":"q20_vidro","texto":"Vidro","ativa":true},{"id":"q20_metal","texto":"Metal","ativa":true},{"id":"q20_nao_reciclavel","texto":"Não reciclado (lixo de banheiro)","ativa":true}],"unidades":[],"mostrar_se":{"pergunta_id":"q18b","valor":"q18b_nao"},"fonte_indicador":true,"ativa":true,"travada":false,"auto":null},
    {"id":"q21","numero":"21","texto":"Com que frequência o lixo é retirado?","ajuda":"Ex.: diariamente, dia sim e dia não, 2 vezes por semana.","tipo":"texto","obrigatoria":false,"opcoes":[],"unidades":[],"mostrar_se":{"pergunta_id":"q18b","valor":"q18b_nao"},"fonte_indicador":false,"ativa":true,"travada":false,"auto":null},
    {"id":"q22","numero":"22","texto":"Coletor usado com mais frequência","ajuda":"","tipo":"uma","obrigatoria":false,"opcoes":[{"id":"q22_pev_cacula","texto":"PEV Caçula","ativa":true},{"id":"q22_pev_pontal","texto":"PEV Pontal","ativa":true},{"id":"q22_pev_sustentarp","texto":"PEV SustentArp","ativa":true},{"id":"q22_bloco3","texto":"Coletores internos - bloco 3","ativa":true},{"id":"q22_bloco5","texto":"Coletores internos - bloco 5","ativa":true},{"id":"q22_bloco9","texto":"Coletores internos - bloco 9","ativa":true},{"id":"q22_bloco10","texto":"Coletores internos - bloco 10","ativa":true},{"id":"q22_ruas","texto":"Coletores pequenos das ruas internas","ativa":true}],"unidades":[],"mostrar_se":{"pergunta_id":"q18b","valor":"q18b_nao"},"fonte_indicador":true,"ativa":true,"travada":false,"auto":null},
    {"id":"q24","numero":"24","texto":"Como o resíduo é separado?","ajuda":"Por origem e/ou por composição.","tipo":"texto_longo","obrigatoria":false,"opcoes":[],"unidades":[],"mostrar_se":{"pergunta_id":"q18b","valor":"q18b_sim"},"fonte_indicador":false,"ativa":true,"travada":false,"auto":null},
    {"id":"q25","numero":"25","texto":"Quantidade diária de resíduo reciclável","ajuda":"","tipo":"numero_unidade","obrigatoria":false,"opcoes":[],"unidades":["saco de 5 L","saco de 50 L","saco de 100 L","saco de 200 L","litros","kg"],"mostrar_se":{"pergunta_id":"q18b","valor":"q18b_sim"},"fonte_indicador":false,"ativa":true,"travada":false,"auto":null},
    {"id":"q25b","numero":"25b","texto":"Quantidade diária de resíduo não reciclável","ajuda":"","tipo":"numero_unidade","obrigatoria":false,"opcoes":[],"unidades":["saco de 5 L","saco de 50 L","saco de 100 L","saco de 200 L","litros","kg"],"mostrar_se":{"pergunta_id":"q18b","valor":"q18b_sim"},"fonte_indicador":false,"ativa":true,"travada":false,"auto":null},
    {"id":"q26","numero":"26","texto":"Estimativa de geração por tipo de resíduo","ajuda":"","tipo":"grade","obrigatoria":false,"opcoes":[{"id":"q26_organico","texto":"Orgânico (restos de comida)","ativa":true},{"id":"q26_plastico","texto":"Plástico","ativa":true},{"id":"q26_papel","texto":"Papel/papelão","ativa":true},{"id":"q26_vidro","texto":"Vidro","ativa":true},{"id":"q26_metal","texto":"Metal","ativa":true},{"id":"q26_nao_reciclavel","texto":"Não reciclado (lixo de banheiro)","ativa":true}],"unidades":[],"mostrar_se":{"pergunta_id":"q18b","valor":"q18b_sim"},"fonte_indicador":true,"ativa":true,"travada":false,"auto":null},
    {"id":"q27","numero":"27","texto":"Com que frequência o lixo é retirado?","ajuda":"","tipo":"texto","obrigatoria":false,"opcoes":[],"unidades":[],"mostrar_se":{"pergunta_id":"q18b","valor":"q18b_sim"},"fonte_indicador":false,"ativa":true,"travada":false,"auto":null},
    {"id":"q28","numero":"28","texto":"Coletores usados com mais frequência","ajuda":"","tipo":"varias","obrigatoria":false,"opcoes":[{"id":"q28_pev_cacula_azul","texto":"PEV Caçula (azul)","ativa":true},{"id":"q28_pev_pontal_azul","texto":"PEV Pontal (azul)","ativa":true},{"id":"q28_pev_sustentarp_azul","texto":"PEV SustentArp (azul)","ativa":true},{"id":"q28_pev_cacula_preto","texto":"PEV Caçula (preto)","ativa":true},{"id":"q28_pev_pontal_preto","texto":"PEV Pontal (preto)","ativa":true},{"id":"q28_pev_sustentarp_preto","texto":"PEV SustentArp (preto)","ativa":true},{"id":"q28_especiais","texto":"Coletores especiais SustentArp (cápsulas de café e outros)","ativa":true},{"id":"q28_bloco3_reciclavel","texto":"Coletores internos - bloco 3 (reciclável)","ativa":true},{"id":"q28_bloco3_nao_reciclavel","texto":"Coletores internos - bloco 3 (não reciclável)","ativa":true},{"id":"q28_bloco5_reciclavel","texto":"Coletores internos - bloco 5 (reciclável)","ativa":true},{"id":"q28_bloco5_nao_reciclavel","texto":"Coletores internos - bloco 5 (não reciclável)","ativa":true},{"id":"q28_bloco9_reciclavel","texto":"Coletores internos - bloco 9 (reciclável)","ativa":true},{"id":"q28_bloco9_nao_reciclavel","texto":"Coletores internos - bloco 9 (não reciclável)","ativa":true},{"id":"q28_bloco10_reciclavel","texto":"Coletores internos - bloco 10 (reciclável)","ativa":true},{"id":"q28_bloco10_nao_reciclavel","texto":"Coletores internos - bloco 10 (não reciclável)","ativa":true},{"id":"q28_ruas","texto":"Coletores pequenos das ruas internas","ativa":true}],"unidades":[],"mostrar_se":{"pergunta_id":"q18b","valor":"q18b_sim"},"fonte_indicador":true,"ativa":true,"travada":false,"auto":null},
    {"id":"q29","numero":"29","texto":"Algum resíduo não vai para os coletores internos da ARP? Qual e como é destinado?","ajuda":"","tipo":"texto_longo","obrigatoria":false,"opcoes":[],"unidades":[],"mostrar_se":{"pergunta_id":"q18b","valor":"q18b_sim"},"fonte_indicador":false,"ativa":true,"travada":false,"auto":null},
    {"id":"q30","numero":"30","texto":"Carências ou problemas para fazer a coleta seletiva","ajuda":"","tipo":"texto_longo","obrigatoria":false,"opcoes":[],"unidades":[],"mostrar_se":{"pergunta_id":"q18b","valor":"q18b_sim"},"fonte_indicador":false,"ativa":true,"travada":false,"auto":null},
    {"id":"q31","numero":"31","texto":"Comentários e observações gerais","ajuda":"","tipo":"texto_longo","obrigatoria":false,"opcoes":[],"unidades":[],"mostrar_se":{"pergunta_id":"q18b","valor":"q18b_sim"},"fonte_indicador":false,"ativa":true,"travada":false,"auto":null},
    {"id":"q23","numero":"23","texto":"Além do lixo comum, gera algum destes resíduos?","ajuda":"Cada opção marcada abre as perguntas específicas.","tipo":"varias","obrigatoria":false,"opcoes":[{"id":"q23_rss","texto":"RSS (saúde)","ativa":true},{"id":"q23_ri","texto":"RI (industrial)","ativa":true},{"id":"q23_rcc","texto":"RCC (construção)","ativa":true},{"id":"q23_oleo","texto":"Óleo de cozinha usado","ativa":true},{"id":"q23_caixa_gordura","texto":"Caixa de gordura","ativa":true},{"id":"q23_nenhum","texto":"Nenhum","ativa":true}],"unidades":[],"mostrar_se":null,"fonte_indicador":true,"ativa":true,"travada":false,"auto":null}
  ]},
  {"id": "F", "nome": "Resíduos especiais", "ativa": true, "perguntas": [
    {"id":"q32","numero":"32","texto":"RSS: quantidade diária gerada","ajuda":"","tipo":"numero_unidade","obrigatoria":false,"opcoes":[],"unidades":["saco de 5 L","saco de 50 L","saco de 100 L","saco de 200 L","litros","kg"],"mostrar_se":{"pergunta_id":"q23","valor":"q23_rss"},"fonte_indicador":false,"ativa":true,"travada":false,"auto":null},
    {"id":"q33","numero":"33","texto":"RSS: onde é feito o armazenamento temporário?","ajuda":"","tipo":"texto","obrigatoria":false,"opcoes":[],"unidades":[],"mostrar_se":{"pergunta_id":"q23","valor":"q23_rss"},"fonte_indicador":false,"ativa":true,"travada":false,"auto":null},
    {"id":"q34","numero":"34","texto":"RSS: empresa responsável pela coleta","ajuda":"","tipo":"texto","obrigatoria":false,"opcoes":[],"unidades":[],"mostrar_se":{"pergunta_id":"q23","valor":"q23_rss"},"fonte_indicador":false,"ativa":true,"travada":false,"auto":null},
    {"id":"q35","numero":"35","texto":"RI: quantidade diária gerada","ajuda":"","tipo":"numero_unidade","obrigatoria":false,"opcoes":[],"unidades":["saco de 5 L","saco de 50 L","saco de 100 L","saco de 200 L","litros","kg"],"mostrar_se":{"pergunta_id":"q23","valor":"q23_ri"},"fonte_indicador":false,"ativa":true,"travada":false,"auto":null},
    {"id":"q36","numero":"36","texto":"RI: composição","ajuda":"","tipo":"texto","obrigatoria":false,"opcoes":[],"unidades":[],"mostrar_se":{"pergunta_id":"q23","valor":"q23_ri"},"fonte_indicador":false,"ativa":true,"travada":false,"auto":null},
    {"id":"q37","numero":"37","texto":"RI: armazenamento temporário","ajuda":"","tipo":"texto","obrigatoria":false,"opcoes":[],"unidades":[],"mostrar_se":{"pergunta_id":"q23","valor":"q23_ri"},"fonte_indicador":false,"ativa":true,"travada":false,"auto":null},
    {"id":"q38","numero":"38","texto":"RI: empresa responsável pela coleta","ajuda":"","tipo":"texto","obrigatoria":false,"opcoes":[],"unidades":[],"mostrar_se":{"pergunta_id":"q23","valor":"q23_ri"},"fonte_indicador":false,"ativa":true,"travada":false,"auto":null},
    {"id":"q39","numero":"39","texto":"RCC: geração contínua ou eventual?","ajuda":"","tipo":"uma","obrigatoria":false,"opcoes":[{"id":"q39_continua","texto":"Contínua","ativa":true},{"id":"q39_eventual","texto":"Eventual","ativa":true}],"unidades":[],"mostrar_se":{"pergunta_id":"q23","valor":"q23_rcc"},"fonte_indicador":false,"ativa":true,"travada":false,"auto":null},
    {"id":"q40","numero":"40","texto":"RCC: quantidade gerada","ajuda":"","tipo":"numero_unidade","obrigatoria":false,"opcoes":[],"unidades":["saco de 5 L","saco de 50 L","saco de 100 L","saco de 200 L","litros","kg"],"mostrar_se":{"pergunta_id":"q23","valor":"q23_rcc"},"fonte_indicador":false,"ativa":true,"travada":false,"auto":null},
    {"id":"q41","numero":"41","texto":"RCC: armazenamento temporário","ajuda":"","tipo":"texto","obrigatoria":false,"opcoes":[],"unidades":[],"mostrar_se":{"pergunta_id":"q23","valor":"q23_rcc"},"fonte_indicador":false,"ativa":true,"travada":false,"auto":null},
    {"id":"q42","numero":"42","texto":"RCC: empresa responsável pela coleta","ajuda":"","tipo":"texto","obrigatoria":false,"opcoes":[],"unidades":[],"mostrar_se":{"pergunta_id":"q23","valor":"q23_rcc"},"fonte_indicador":false,"ativa":true,"travada":false,"auto":null},
    {"id":"q43","numero":"43","texto":"Óleo: litros gerados por dia ou semana","ajuda":"","tipo":"numero_unidade","obrigatoria":false,"opcoes":[],"unidades":["saco de 5 L","saco de 50 L","saco de 100 L","saco de 200 L","litros","kg"],"mostrar_se":{"pergunta_id":"q23","valor":"q23_oleo"},"fonte_indicador":false,"ativa":true,"travada":false,"auto":null},
    {"id":"q44","numero":"44","texto":"Óleo: armazenamento temporário","ajuda":"","tipo":"texto","obrigatoria":false,"opcoes":[],"unidades":[],"mostrar_se":{"pergunta_id":"q23","valor":"q23_oleo"},"fonte_indicador":false,"ativa":true,"travada":false,"auto":null},
    {"id":"q45","numero":"45","texto":"Óleo: empresa responsável pela coleta","ajuda":"","tipo":"texto","obrigatoria":false,"opcoes":[],"unidades":[],"mostrar_se":{"pergunta_id":"q23","valor":"q23_oleo"},"fonte_indicador":false,"ativa":true,"travada":false,"auto":null},
    {"id":"q46","numero":"46","texto":"Caixa de gordura: empresa usada e frequência","ajuda":"O resíduo da caixa de gordura não pode ir para os coletores da ARP.","tipo":"texto","obrigatoria":false,"opcoes":[],"unidades":[],"mostrar_se":{"pergunta_id":"q23","valor":"q23_caixa_gordura"},"fonte_indicador":false,"ativa":true,"travada":false,"auto":null}
  ]}
]}
$q$;
  v1 jsonb;
begin
  -- A versão 1 é a 2 sem a 25b.
  select jsonb_build_object('secoes', jsonb_agg(
      jsonb_set(sec, '{perguntas}', (
        select jsonb_agg(p order by n)
        from jsonb_array_elements(sec -> 'perguntas') with ordinality as x (p, n)
        where p ->> 'id' <> 'q25b'))
      order by m))
    into v1
  from jsonb_array_elements(v2 -> 'secoes') with ordinality as y (sec, m);

  insert into sustentabilidade.formularios (id, tipo, nome, versao_publicada, rascunho, exemplo)
    values ('a0000000-0000-4000-8000-0000000000f0', 'questionario', 'Questionário RSU', 2, v2, true);
  insert into sustentabilidade.formulario_versoes (formulario_id, versao, definicao, resumo, publicado_em) values
    ('a0000000-0000-4000-8000-0000000000f0', 1, v1, 'Versão inicial: o questionário do Forms', '2026-04-01 09:00:00-03'),
    ('a0000000-0000-4000-8000-0000000000f0', 2, v2, 'Inclui a pergunta 25b (resíduo não reciclável)', '2026-11-03 09:00:00-03');
end $$;

-- ---------------------------------------------------------------------------
-- Entrevistas: 20 de 2026 (como as do Forms) e 3 de 2024 (papel digitalizado)
-- ---------------------------------------------------------------------------

with elig as (
  select c.*, row_number() over (order by c.contrato) as rn
  from sustentabilidade.contratos c
  where c.exemplo and c.tipo_loja <> 'Área Publicitária' and c.rescisao is null
),
e as (
  select c.*, ((rn - 3) / 11)::int as j, false as antiga,
    date '2026-04-28' + ((rn - 3) / 11)::int * 8 + ((rn - 3) / 11)::int % 3 as dt
  from elig c where rn % 11 = 3 and rn <= 212
  union all
  select c.*, 20 + ((rn - 8) / 11)::int, true,
    (array[date '2024-11-20', date '2024-12-02', date '2024-09-15'])[1 + ((rn - 8) / 11)::int]
  from elig c where rn in (8, 19, 30)
),
r as (
  select e.*,
    (j * 7) % 20 as jg, (j * 3) % 20 as jp, (j * 9) % 20 as jc,
    j % 3 = 0 and not antiga as separa,
    case when antiga then 'lojas' when j < 9 then 'lojas' when j < 14 then 'saude' when j < 18 then 'gastronomico' else 'academia' end as setor_op,
    (array['Ana','Bruno','Carla','Diego','Elisa','Fábio','Gabriela','Heitor','Isabela','João'])[1 + j % 10]
      || ' ' || (array['Almeida','Barros','Cardoso','Duarte','Esteves','Ferraz','Gouveia'])[1 + j % 7] as respondente
  from e
)
insert into sustentabilidade.entrevistas
  (contrato_id, lucs, cliente_doc, data, tipo, setor, formulario_versao, respostas, situacao,
   respondente_nome, origem, entrevistador_id, valida_ate, exemplo)
select
  r.id, r.lucs, r.cliente_doc, r.dt,
  case when j % 5 = 2 and not antiga then 'atualizacao' else 'primeira' end,
  case setor_op when 'lojas' then 'Lojas e serviços gerais' when 'saude' then 'Saúde'
    when 'gastronomico' then 'Gastronômico' else 'Academia' end,
  1,
  jsonb_strip_nulls(jsonb_build_object(
    'q1', r.cliente_nome,
    'q2', array_to_string(r.lucs, '/'),
    'q3', jsonb_build_array('q3_' || setor_op),
    'q4', case when j % 5 = 2 and not antiga then 'Atualização' else '1ª vez' end,
    'q5', to_char(r.dt, 'YYYY-MM-DD'),
    'q6', respondente || ' – ' || (array['Gerente','Sócia','Proprietário','Atendente'])[1 + j % 4],
    'q7', case when antiga or jg < 8 then 'q7_pouco' when jg < 14 then 'q7_mediano' when jg < 19 then 'q7_nenhum' else 'q7_muito' end,
    'q8', 2 + j % 9,
    'q9', 10 + (j * 13) % 90,
    'q10', case when j % 2 = 0 then jsonb_build_object('r', 'sim', 'd', 1 + j % 3) else jsonb_build_object('r', 'nao') end,
    'q11', case when j % 4 = 1 then jsonb_build_object('r', 'sim', 'd', 'Copa pequena, usada no almoço') else jsonb_build_object('r', 'nao') end,
    'q12', case when antiga or jc < 11 then 'q12_sim' when jc < 16 then 'q12_nao' else 'q12_pouco' end,
    'q13', case when j % 4 = 0 and not antiga then 'q13_sim' else 'q13_nao' end,
    'q16', case when antiga then 'q16_nao' when jp < 2 then 'q16_sim' when jp < 19 then 'q16_nao' end,
    'q17', case when jp < 2 and not antiga then '2025-03-10' end,
    'q18', 'Papel, plástico e restos de comida, em sacos de lixo comuns',
    'q18b', case when separa then 'q18b_sim' else 'q18b_nao' end,
    'q19', case when not separa then jsonb_build_object('n', 1 + j % 4, 'u', 'saco de 100 L') end,
    'q20', case when not separa then jsonb_build_object(
      'q20_organico', 'medio', 'q20_plastico', 'pouco', 'q20_papel', (array['pouco','medio','muito'])[1 + j % 3],
      'q20_vidro', 'nao_gera', 'q20_metal', 'nao_gera', 'q20_nao_reciclavel', 'pouco') end,
    'q21', case when not separa then 'Diariamente' end,
    'q22', case when not separa then 'q22_' || (array['pev_cacula','pev_pontal','pev_sustentarp','bloco3',
      'bloco5','bloco9','bloco10','ruas'])[1 + j % 8] end,
    'q24', case when separa then 'Por composição: reciclável e não reciclável' end,
    'q25', case when separa then jsonb_build_object('n', 1 + j % 3, 'u', 'saco de 50 L') end,
    'q26', case when separa then jsonb_build_object(
      'q26_organico', 'pouco', 'q26_plastico', 'medio', 'q26_papel', 'muito', 'q26_vidro', 'pouco',
      'q26_metal', 'nao_gera', 'q26_nao_reciclavel', 'pouco') end,
    'q27', case when separa then '2 vezes por semana' end,
    'q28', case when separa then jsonb_build_array(
      'q28_' || (array['pev_cacula','pev_pontal','pev_sustentarp'])[1 + j % 3] || '_azul',
      'q28_' || (array['pev_cacula','pev_pontal','pev_sustentarp'])[1 + j % 3] || '_preto') end,
    'q23', case
      when antiga then jsonb_build_array('q23_nenhum')
      when j % 6 = 0 then jsonb_build_array('q23_rss')
      when j % 9 = 0 then jsonb_build_array('q23_oleo')
      else jsonb_build_array('q23_nenhum') end,
    'q32', case when j % 6 = 0 and not antiga then jsonb_build_object('n', 1, 'u', 'saco de 5 L') end,
    'q33', case when j % 6 = 0 and not antiga then 'Sala de utilidades, em caixa fechada' end,
    'q34', case when j % 6 = 0 and not antiga then 'Coletora de resíduos de saúde (fictícia)' end,
    'q43', case when j % 9 = 0 and j % 6 <> 0 then jsonb_build_object('n', 3, 'u', 'litros') end,
    'q44', case when j % 9 = 0 and j % 6 <> 0 then 'Bombona de 20 litros na cozinha' end,
    'q45', case when j % 9 = 0 and j % 6 <> 0 then 'Coletora de óleo (fictícia)' end)),
  'salva',
  respondente,
  case when antiga then 'papel' else 'forms' end,
  null,
  (r.dt + interval '24 months')::date,
  true
from r;

-- A ativação dos entrevistados vem antes da entrevista.
update sustentabilidade.contratos c
  set ativacao = least(c.ativacao, e.data - 240), inicio = least(c.inicio, e.data - 260)
  from sustentabilidade.entrevistas e
  where e.contrato_id = c.id and e.exemplo;

-- ---------------------------------------------------------------------------
-- Clube SustentArp: 27 locatários e 3 não locatários
-- ---------------------------------------------------------------------------

insert into sustentabilidade.participantes (id, cliente_doc, nome, locatario_manual, formas, exemplo)
select
  ('b0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  c.cliente_doc, c.cliente_nome, false,
  (case n % 4 when 0 then '{Pagante}' when 1 then '{"Contribui com resíduos"}'
     when 2 then '{"Engajado em ações"}' else '{"Certificado (selo)"}' end)::text[]
    || (case when n % 3 = 0 and n % 4 <> 1 then '{"Contribui com resíduos"}' else '{}' end)::text[],
  true
from generate_series(0, 26) n
join sustentabilidade.contratos c on c.contrato = 'EX-' || lpad((103 + 6 * n)::text, 4, '0');

insert into sustentabilidade.participantes (id, cliente_doc, nome, locatario_manual, formas, exemplo)
select
  ('b0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  '999000' || lpad(n::text, 2, '0') || '000100',
  (array['Associação Raízes do Vale','Coletivo Recicla Serra','Instituto Mata Atlântica Viva'])[n - 26],
  true,
  (case when n = 28 then '{"Engajado em ações"}' else '{Pagante}' end)::text[],
  true
from generate_series(27, 29) n;

insert into sustentabilidade.participante_contatos (participante_id, email, telefone, contato)
select p.id, 'contato' || right(p.id::text, 2) || '@exemplo.invalid',
  '(22) 5550-01' || right(p.id::text, 2), 'Responsável (fictício)'
from sustentabilidade.participantes p where p.exemplo;

-- Termo do ano: dois locatários a vencer e um não locatário vencido.
insert into sustentabilidade.termos (participante_id, ano, assinado_em, valido_ate, arquivo)
select p.id, extract(year from t.d)::int, t.d, (t.d + interval '12 months')::date,
  'clube/termos/' || p.id || '/exemplo-termo.pdf'
from sustentabilidade.participantes p
cross join lateral (select right(p.id::text, 2)::int as n) x
cross join lateral (
  select case x.n
    when 2 then date '2025-11-20'
    when 5 then date '2025-12-01'
    when 29 then date '2025-09-10'
    else date '2026-01-10' + (x.n * 37) % 290
  end as d) t
where p.exemplo;

insert into sustentabilidade.participante_valores (participante_id, valor_combinado_mes)
select p.id, case when x.n = 27 then 200 else 50 + (x.n * 10) % 100 end
from sustentabilidade.participantes p
cross join lateral (select right(p.id::text, 2)::int as n) x
where p.exemplo and (x.n = 27 or (x.n < 27 and x.n % 4 = 0));

-- Contribuições mensais de quem tem valor combinado (alguns meses faltam)
-- e uma doação de material, sem valor, de outros quatro.
insert into sustentabilidade.contribuicoes (id, participante_id, data, forma, competencia, observacao)
select md5('contribuicao-' || x.n || '-' || m)::uuid, v.participante_id,
  make_date(2026, m, 10), 'PIX', make_date(2026, m, 1), null
from sustentabilidade.participante_valores v
cross join lateral (select right(v.participante_id::text, 2)::int as n) x
cross join generate_series(1, 10) m
where (x.n + m) % 5 <> 0
union all
select md5('contribuicao-' || n || '-material')::uuid,
  ('b0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  make_date(2026, 1 + n % 10, 18), 'Material', make_date(2026, 1 + n % 10, 1),
  'Doação de material para oficina'
from unnest(array[5, 10, 15, 25]) n;

insert into sustentabilidade.contribuicao_valores (contribuicao_id, valor)
select c.id, coalesce(case when c.forma = 'PIX' then v.valor_combinado_mes end, 0)
from sustentabilidade.contribuicoes c
left join sustentabilidade.participante_valores v on v.participante_id = c.participante_id;

insert into sustentabilidade.acoes (participante_id, data, tipo, observacao)
select p.id, date '2026-02-01' + (x.n * 13 + a * 29) % 270,
  (array['Entrega de resíduos','Oficina','Evento','Outra'])[1 + (x.n + a) % 4], null
from sustentabilidade.participantes p
cross join lateral (select right(p.id::text, 2)::int as n) x
cross join lateral generate_series(1, x.n % 7) a
where p.exemplo;

-- ---------------------------------------------------------------------------
-- Coletores (12) e rondas semanais (12 semanas, até 10/11/2026)
-- ---------------------------------------------------------------------------

insert into sustentabilidade.coletores (id, local, cor, conteineres, ordem, exemplo)
select ('d0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, c.local, c.cor, c.q, n::int, true
from unnest(
  array['PEV Caçula','PEV Caçula','PEV Pontal','PEV Pontal','PEV SustentArp','PEV SustentArp',
        'Coletores internos - bloco 3','Coletores internos - bloco 5','Coletores internos - bloco 5',
        'Coletores internos - bloco 9','Coletores internos - bloco 10','Coletores das ruas internas'],
  array['preto','azul','preto','azul','preto','azul','preto','preto','azul','preto','preto','preto'],
  array[4, 2, 3, 2, 2, 3, 2, 2, 1, 2, 2, 6]
) with ordinality as c (local, cor, q, n);

insert into sustentabilidade.rondas (id, data_hora, observacao, exemplo)
select ('e0000000-0000-4000-8000-' || lpad(w::text, 12, '0'))::uuid,
  timestamptz '2026-11-10 09:00:00-03' - w * interval '7 days' + (w * 7 % 50) * interval '1 minute',
  null, true
from generate_series(0, 11) w;

-- Coletor não visitado fica sem linha. O PEV Caçula preto enche nas duas últimas.
insert into sustentabilidade.ronda_itens (ronda_id, coletor_id, conteineres, ocupacao_pct)
select ('e0000000-0000-4000-8000-' || lpad(w::text, 12, '0'))::uuid, c.id, c.conteineres,
  least(100,
    case c.cor when 'preto' then 40 + ((w * 3 + c.ordem * 7) % 6) * 10 else 10 + ((w + c.ordem) % 4) * 10 end
    + case when w < 2 and c.ordem = 1 then 30 else 0 end)
from generate_series(0, 11) w
cross join sustentabilidade.coletores c
where c.exemplo and (w * 5 + c.ordem * 3) % 17 <> 0;

-- ---------------------------------------------------------------------------
-- RCC: 10 notas de 2026 e o preço das caçambas
-- ---------------------------------------------------------------------------

insert into sustentabilidade.rcc_precos (vigente_desde, preco_a, preco_b, exemplo)
  values ('2026-01-01', 520, 980, true);

insert into sustentabilidade.rcc_notas (id, competencia, empresa, numero, pdf, cacambas_a, cacambas_b, exemplo)
select md5('rcc-nota-' || m)::uuid, make_date(2026, m, 1), 'Coletora de entulho (fictícia)',
  'NF ' || (1200 + m * 61), 'rcc/exemplo/rcc-2026-' || lpad(m::text, 2, '0') || '.pdf',
  2 + (m * 3) % 5, (m * 2) % 4, true
from generate_series(1, 10) m;

insert into sustentabilidade.rcc_nota_valores (nota_id, valor_total)
select id, cacambas_a * 520 + cacambas_b * 980 from sustentabilidade.rcc_notas where exemplo;

-- ---------------------------------------------------------------------------
-- Programas, formulários (versão 1) e indicadores de 4.8
-- ---------------------------------------------------------------------------

insert into sustentabilidade.programas
  (id, nome, descricao, area, parceiro_nome, parceiro_doc, inicio, frequencia, exemplo) values
  ('a0000000-0000-4000-8000-000000000001', 'SustentArp', 'Coleta de recicláveis e oficinas de educação ambiental',
   'Ambiental', 'Parceiro de coleta (fictício)', '99900101000100', '2024-01-01', 'mensal', true),
  ('a0000000-0000-4000-8000-000000000002', 'Mercado Local', 'Feiras, atrações e produtores locais',
   'Economia local', 'Parceira do Mercado Local (fictícia)', '99900102000100', '2024-01-01', 'mensal', true),
  ('a0000000-0000-4000-8000-000000000003', 'Turismo', 'Quiosque de informações e tour guiado',
   'Turismo', 'Parceira de turismo (fictícia)', '99900103000100', '2023-02-01', 'mensal', true);

insert into sustentabilidade.programa_contatos (programa_id, email, telefone, contato)
select id, 'parceiro' || right(id::text, 1) || '@exemplo.invalid', '(22) 5550-020' || right(id::text, 1),
  'Contato do parceiro (fictício)'
from sustentabilidade.programas where exemplo;

do $$
declare
  f record;
begin
  for f in
    select * from (values
      ('a0000000-0000-4000-8000-0000000000f1'::uuid, 'a0000000-0000-4000-8000-000000000001'::uuid, 'Coleta e oficinas',
        jsonb_build_object('secoes', jsonb_build_array(sustentabilidade._ex_s('s1', 'Lançamento',
          sustentabilidade._ex_p('data', '1', 'Data', 'data', p_obrigatoria => true),
          sustentabilidade._ex_p('material', '2', 'Material', 'uma',
            array['Recicláveis','Cápsulas de café','Eletrônicos','Outros'], true),
          sustentabilidade._ex_p('peso', '3', 'Peso', 'numero_unidade', p_obrigatoria => true, p_fonte => true, p_unidades => array['kg']),
          sustentabilidade._ex_p('oficina', '4', 'Oficina realizada?', 'sim_nao', p_fonte => true),
          sustentabilidade._ex_p('tema', '5', 'Tema da oficina', 'texto', p_se => 'oficina', p_se_valor => 'sim'),
          sustentabilidade._ex_p('participantes', '6', 'Participantes da oficina', 'numero', p_se => 'oficina', p_se_valor => 'sim', p_fonte => true),
          sustentabilidade._ex_p('visitantes', '7', 'Visitantes', 'numero', p_fonte => true))))),
      ('a0000000-0000-4000-8000-0000000000f2', 'a0000000-0000-4000-8000-000000000002', 'Atrações do mês',
        jsonb_build_object('secoes', jsonb_build_array(sustentabilidade._ex_s('s1', 'Lançamento',
          sustentabilidade._ex_p('data', '1', 'Data', 'data', p_obrigatoria => true),
          sustentabilidade._ex_p('horario', '2', 'Horário', 'hora'),
          sustentabilidade._ex_p('tipo', '3', 'Tipo', 'uma',
            array['Feira de produtor local','Feira de orgânicos','Degustação','Oficina','Oficina infantil','DJ',
                  'Massagem','Demonstração','Contação de história'], true, p_fonte => true),
          sustentabilidade._ex_p('tema', '4', 'Tema', 'texto', p_obrigatoria => true),
          sustentabilidade._ex_p('local', '5', 'Local', 'uma',
            array['Rua das Rendas','Boulevard','Corredor do Mercado Local'], true),
          sustentabilidade._ex_p('horas_experiencia', '6', 'Horas de experiência', 'numero_unidade', p_fonte => true, p_unidades => array['h']),
          sustentabilidade._ex_p('horas_oficina', '7', 'Horas de oficina', 'numero_unidade', p_unidades => array['h']),
          sustentabilidade._ex_p('inscricao', '8', 'Inscrição', 'uma', array['Aberta','Paga','Gratuita']),
          sustentabilidade._ex_p('valor', '9', 'Valor', 'reais'))))),
      ('a0000000-0000-4000-8000-0000000000f3', 'a0000000-0000-4000-8000-000000000002', 'Produtores na feira',
        jsonb_build_object('secoes', jsonb_build_array(sustentabilidade._ex_s('s1', 'Lançamento',
          sustentabilidade._ex_p('data', '1', 'Data da feira', 'data', p_obrigatoria => true),
          sustentabilidade._ex_p('produtor', '2', 'Produtor', 'lista_cadastro', p_obrigatoria => true, p_fonte => true))))),
      ('a0000000-0000-4000-8000-0000000000f4', 'a0000000-0000-4000-8000-000000000002', 'Ecocopos',
        jsonb_build_object('secoes', jsonb_build_array(sustentabilidade._ex_s('s1', 'Lançamento',
          sustentabilidade._ex_p('data', '1', 'Data', 'data', p_obrigatoria => true),
          sustentabilidade._ex_p('tipo', '2', 'Tipo', 'uma', array['Copo','Caneca'], true),
          sustentabilidade._ex_p('quantidade', '3', 'Quantidade', 'numero', p_obrigatoria => true, p_fonte => true),
          sustentabilidade._ex_p('valor', '4', 'Valor', 'reais'))))),
      ('a0000000-0000-4000-8000-0000000000f5', 'a0000000-0000-4000-8000-000000000003', 'Perguntas no quiosque',
        jsonb_build_object('secoes', jsonb_build_array(sustentabilidade._ex_s('s1', 'Lançamento',
          sustentabilidade._ex_p('pergunta', '1', 'Pergunta', 'texto', p_obrigatoria => true),
          sustentabilidade._ex_p('data', '2', 'Data', 'data', p_obrigatoria => true),
          sustentabilidade._ex_p('horario', '3', 'Horário', 'hora', p_obrigatoria => true),
          sustentabilidade._ex_p('publico', '4', 'Público', 'uma',
            array['Turista','Friburguense','Entrega','Trabalhador','Não informado'], true, p_fonte => true),
          sustentabilidade._ex_p('cidade', '5', 'Cidade de origem', 'texto', p_se => 'publico', p_se_valor => 'publico_1'),
          sustentabilidade._ex_p('pessoas', '6', 'Número de pessoas', 'numero', p_fonte => true),
          sustentabilidade._ex_p('dificuldade', '7', 'Dificuldade na resposta', 'texto'))))),
      ('a0000000-0000-4000-8000-0000000000f6', 'a0000000-0000-4000-8000-000000000003', 'Tour guiado',
        jsonb_build_object('secoes', jsonb_build_array(sustentabilidade._ex_s('s1', 'Lançamento',
          sustentabilidade._ex_p('data', '1', 'Data', 'data', p_obrigatoria => true),
          sustentabilidade._ex_p('grupo', '2', 'Grupo ou descrição', 'texto', p_obrigatoria => true),
          sustentabilidade._ex_p('tipo', '3', 'Tipo', 'uma', array['Mensal','Escolar','Cervejeiro','Outro'], true),
          sustentabilidade._ex_p('participantes', '4', 'Participantes', 'numero', p_obrigatoria => true, p_fonte => true),
          sustentabilidade._ex_p('receita_parceiro', '5', 'Receita do parceiro', 'reais'),
          sustentabilidade._ex_p('receita_arp', '6', 'Receita da ARP', 'reais', p_fonte => true),
          sustentabilidade._ex_p('custo_parceiro', '7', 'Custo do parceiro', 'reais'),
          sustentabilidade._ex_p('custo_album', '8', 'Custo do álbum', 'reais', p_ajuda => 'Padrão por pessoa, dos Parâmetros.'),
          sustentabilidade._ex_p('custo_copo', '9', 'Custo do copo', 'reais', p_ajuda => 'Padrão por pessoa, dos Parâmetros.'),
          sustentabilidade._ex_p('outros_custos', '10', 'Outros custos', 'reais')))))
    ) as t (id, programa_id, nome, definicao)
  loop
    insert into sustentabilidade.formularios (id, tipo, programa_id, nome, versao_publicada, rascunho, exemplo)
      values (f.id, 'programa', f.programa_id, f.nome, 1, f.definicao, true);
    insert into sustentabilidade.formulario_versoes (formulario_id, versao, definicao, resumo, publicado_em)
      values (f.id, 1, f.definicao, 'Versão inicial (exemplo)', '2026-01-02 09:00:00-03');
  end loop;
end $$;

insert into sustentabilidade.programa_indicadores
  (programa_id, formulario_id, nome, campo_id, calculo, filtro, percentual_valor, unidade, grupo,
   mostrar_painel, em_reais, ordem) values
  -- SustentArp
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000f1', 'Volume reciclado', 'peso', 'soma', null, null, 'kg', 'Volume reciclado', true, false, 1),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000f1', 'Oficinas', null, 'contagem', '{"campo_id": "oficina", "valor": "sim"}', null, 'oficinas', 'Oficinas', true, false, 2),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000f1', 'Participantes das oficinas', 'participantes', 'soma', null, null, 'pessoas', 'Pessoas impactadas', true, false, 3),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000f1', 'Visitantes', 'visitantes', 'soma', null, null, 'pessoas', 'Pessoas impactadas', true, false, 4),
  -- Mercado Local
  ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-0000000000f2', 'Ativações no mês', null, 'contagem', null, null, 'ativações', null, false, false, 1),
  ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-0000000000f2', 'Horas de atividade', 'horas_experiencia', 'soma', null, null, 'horas', null, false, false, 2),
  ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-0000000000f2', 'Oficinas', null, 'contagem', '{"campo_id": "tipo", "valor": "tipo_4"}', null, 'oficinas', 'Oficinas', true, false, 3),
  ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-0000000000f3', 'Participações de produtores', null, 'contagem', null, null, 'participações', 'Produtores locais', true, false, 4),
  ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-0000000000f3', 'Produtores únicos', 'produtor', 'contagem_distintos', null, null, 'produtores', 'Produtores locais', true, false, 5),
  ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-0000000000f4', 'Ecocopos vendidos', 'quantidade', 'soma', null, null, 'copos', null, false, false, 6),
  -- Turismo
  ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-0000000000f5', 'Perguntas no mês', null, 'contagem', null, null, 'perguntas', null, false, false, 1),
  ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-0000000000f5', 'Turistas', 'publico', 'percentual', null, 'publico_1', '%', null, false, false, 2),
  ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-0000000000f5', 'Pessoas atendidas', 'pessoas', 'soma', null, null, 'pessoas', 'Pessoas impactadas', true, false, 3),
  ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-0000000000f6', 'Tours', null, 'contagem', null, null, 'tours', null, false, false, 4),
  ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-0000000000f6', 'Participantes do tour', 'participantes', 'soma', null, null, 'pessoas', 'Pessoas impactadas', true, false, 5),
  ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-0000000000f6', 'Receita da ARP no tour', 'receita_arp', 'soma', null, null, 'em reais', null, false, true, 6);

-- ---------------------------------------------------------------------------
-- Lançamentos de janeiro a outubro de 2026
-- ---------------------------------------------------------------------------

-- SustentArp: 8 coletas por mês; as primeiras têm oficina.
insert into sustentabilidade.lancamentos
  (programa_id, formulario_id, formulario_versao, data, valores, origem, exemplo)
select 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000f1', 1,
  make_date(2026, m, 3 * s),
  jsonb_strip_nulls(jsonb_build_object(
    'data', to_char(make_date(2026, m, 3 * s), 'YYYY-MM-DD'),
    'material', 'material_' || (1 + s % 4),
    'peso', jsonb_build_object('n', (array[1840,2010,2230,1960,2410,2280,2120,2350,2490,2560])[m] / 8, 'u', 'kg'),
    'oficina', jsonb_build_object('r', case when s <= (array[2,3,4,3,5,4,2,4,5,4])[m] then 'sim' else 'nao' end),
    'tema', case when s <= (array[2,3,4,3,5,4,2,4,5,4])[m]
      then (array['Compostagem','Separação em casa','Brinquedos de sucata','Horta em vasos'])[1 + (m + s) % 4] end,
    'participantes', case when s <= (array[2,3,4,3,5,4,2,4,5,4])[m] then 12 + (m * s) % 20 end,
    'visitantes', 5 + (m + s) % 9)),
  case when s % 2 = 0 then 'link' else 'equipe' end, true
from generate_series(1, 10) m cross join generate_series(1, 8) s;

-- Mercado Local: atrações do mês (cerca de 30 por mês).
insert into sustentabilidade.lancamentos
  (id, programa_id, formulario_id, formulario_versao, data, valores, origem, exemplo)
select md5('atracao-' || m || '-' || s)::uuid,
  'a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-0000000000f2', 1,
  make_date(2026, m, 1 + (s * 3) % 27),
  jsonb_strip_nulls(jsonb_build_object(
    'data', to_char(make_date(2026, m, 1 + (s * 3) % 27), 'YYYY-MM-DD'),
    'horario', lpad((9 + s % 9)::text, 2, '0') || ':00',
    'tipo', 'tipo_' || (1 + (s * 5 + m) % 9),
    'tema', (array['Sabores da serra','Mãos que fazem','Manhã no mercado','Tarde de música','Colheita da semana'])[1 + (s + m) % 5],
    'local', 'local_' || (1 + s % 3),
    'horas_experiencia', jsonb_build_object('n', 1 + s % 3, 'u', 'h'),
    'horas_oficina', case when (1 + (s * 5 + m) % 9) in (4, 5) then jsonb_build_object('n', 2, 'u', 'h') end,
    'inscricao', 'inscricao_' || (1 + s % 3))),
  'equipe', true
from generate_series(1, 10) m
cross join lateral generate_series(1, (array[12,29,35,34,57,47,12,27,36,31])[m]) s;

-- O valor da inscrição paga é em reais: fica à parte.
insert into sustentabilidade.lancamento_valores (lancamento_id, valores)
select l.id, jsonb_build_object('valor', 20 + (extract(day from l.data)::int % 4) * 10)
from sustentabilidade.lancamentos l
where l.formulario_id = 'a0000000-0000-4000-8000-0000000000f2' and l.valores ->> 'inscricao' = 'inscricao_2';

-- Mercado Local: produtores cadastrados e as participações nas feiras.
insert into sustentabilidade.cadastros_lista (programa_id, campo_id, valor, normalizado)
select 'a0000000-0000-4000-8000-000000000002', 'produtor', a || ' ' || b,
  translate(lower(a || ' ' || b), 'áàâãéêíóôõúç', 'aaaaeeiooouc')
from unnest(array['Sítio','Horta','Doces','Queijaria','Apiário','Cogumelos','Ateliê','Pães','Geleias',
                  'Flores','Cervejaria']) a
cross join unnest(array['da Serra','do Vale']) b;

with produtores as (
  select valor, row_number() over (order by normalizado) as n from sustentabilidade.cadastros_lista
  where programa_id = 'a0000000-0000-4000-8000-000000000002' and campo_id = 'produtor'
)
insert into sustentabilidade.lancamentos
  (programa_id, formulario_id, formulario_versao, data, valores, origem, exemplo)
select 'a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-0000000000f3', 1,
  make_date(2026, m, 7 * f),
  jsonb_build_object('data', to_char(make_date(2026, m, 7 * f), 'YYYY-MM-DD'), 'produtor', p.valor),
  'equipe', true
from generate_series(1, 10) m
cross join generate_series(1, 3) f
cross join lateral generate_series(1, 8 + (m + f) % 5) s
join produtores p on p.n = 1 + (s + f * 3 + m) % 22;

-- Mercado Local: ecocopos.
insert into sustentabilidade.lancamentos
  (id, programa_id, formulario_id, formulario_versao, data, valores, origem, exemplo)
select md5('ecocopo-' || m || '-' || s)::uuid,
  'a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-0000000000f4', 1,
  make_date(2026, m, 8 * s),
  jsonb_build_object('data', to_char(make_date(2026, m, 8 * s), 'YYYY-MM-DD'), 'tipo', 'tipo_1', 'quantidade', 10 + s * 5),
  'equipe', true
from generate_series(1, 10) m
cross join lateral generate_series(1, (array[0,1,0,1,2,1,3,2,1,0])[m]) s;

insert into sustentabilidade.lancamento_valores (lancamento_id, valores)
select l.id, jsonb_build_object('valor', (l.valores ->> 'quantidade')::int * 4.25)
from sustentabilidade.lancamentos l
where l.formulario_id = 'a0000000-0000-4000-8000-0000000000f4';

-- Turismo: perguntas no quiosque (cerca de 200 por mês). Número de pessoas
-- só a partir de julho, como na planilha.
insert into sustentabilidade.lancamentos
  (programa_id, formulario_id, formulario_versao, data, valores, origem, exemplo)
select 'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-0000000000f5', 1,
  make_date(2026, m, 1 + s % 27),
  jsonb_strip_nulls(jsonb_build_object(
    'pergunta', (array['Onde fica o banheiro?','Onde tem estacionamento?','Onde almoçar?','Qual o horário das lojas?',
                       'Onde fica a feira?','Como chego ao centro?','Tem caixa eletrônico?','Onde compro lembranças?'])[1 + s % 8],
    'data', to_char(make_date(2026, m, 1 + s % 27), 'YYYY-MM-DD'),
    'horario', lpad((9 + s % 9)::text, 2, '0') || ':' || lpad(((s * 7) % 60)::text, 2, '0'),
    'publico', case when s % 8 = 0 then 'publico_1' when s % 8 < 5 then 'publico_2'
      when s % 8 = 5 then 'publico_3' when s % 8 = 6 then 'publico_4' else 'publico_5' end,
    'cidade', case when s % 8 = 0
      then (array['Rio de Janeiro','Niterói','Petrópolis','São Paulo','Juiz de Fora'])[1 + (s / 8) % 5] end,
    'pessoas', case when m >= 7 then 1 + s % 4 end)),
  'link', true
from generate_series(1, 10) m
cross join lateral generate_series(1, (array[217,150,226,162,197,177,211,216,196,204])[m]) s;

-- Turismo: 7 tours no ano; receitas e custos em reais ficam à parte.
with tours (m, pessoas, tipo, grupo) as (values
  (2, 5, 'tipo_1', 'Tour do mês'), (3, 3, 'tipo_1', 'Tour do mês'), (4, 61, 'tipo_2', 'Escola municipal (fictícia)'),
  (5, 71, 'tipo_2', 'Colégio da serra (fictício)'), (6, 29, 'tipo_1', 'Tour do mês'),
  (8, 57, 'tipo_3', 'Grupo cervejeiro'), (10, 25, 'tipo_1', 'Tour do mês'))
insert into sustentabilidade.lancamentos
  (id, programa_id, formulario_id, formulario_versao, data, valores, origem, exemplo)
select md5('tour-' || m)::uuid,
  'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-0000000000f6', 1,
  make_date(2026, m, 20),
  jsonb_build_object('data', to_char(make_date(2026, m, 20), 'YYYY-MM-DD'), 'grupo', grupo,
    'tipo', tipo, 'participantes', pessoas),
  'equipe', true
from tours;

insert into sustentabilidade.lancamento_valores (lancamento_id, valores)
select l.id, jsonb_build_object(
  'receita_parceiro', p * 35, 'receita_arp', p * 10, 'custo_parceiro', p * 30,
  'custo_album', round(p * 2.48, 2), 'custo_copo', round(p * 2.92, 2), 'outros_custos', 50)
from sustentabilidade.lancamentos l
cross join lateral (select (l.valores ->> 'participantes')::int as p) x
where l.formulario_id = 'a0000000-0000-4000-8000-0000000000f6';

-- ---------------------------------------------------------------------------
-- Marco inicial: totais de 2024 e 2025 (antes do sistema)
-- ---------------------------------------------------------------------------

insert into sustentabilidade.marcos (indicador, ano, valor, exemplo) values
  ('volume_reciclado', 2024, 18400, true), ('volume_reciclado', 2025, 22750, true),
  ('energia_gerada', 2024, 91200, true), ('energia_gerada', 2025, 97800, true),
  ('rcc_total', 2024, 312, true), ('rcc_total', 2025, 288, true),
  ('pessoas_impactadas', 2024, 3150, true), ('pessoas_impactadas', 2025, 4020, true);

drop function sustentabilidade._ex_s(text, text, jsonb[]);
drop function sustentabilidade._ex_p(text, text, text, text, text[], boolean, text, text, boolean, text, text[], text);
