-- Censo de exemplo para o mockup (spec 4.8 e 4.9). Tudo com exemplo = true:
-- Configurações › "Remover dados de exemplo" apaga. Nomes inventados.
--
-- - "Censo 2026": rodada fechada com 178 respostas, como se tivesse vindo da
--   planilha do Google Forms (distribuição de segmentos e blocos da planilha
--   de 2026), com as sugestões da pergunta 10 já agrupadas em 8 temas (a
--   classificação pela IA fica para a V2). A importação de verdade da
--   planilha substitui esta rodada.
-- - "Censo 2027": rodada aberta (01/10 a 30/11/2026) com um convite por
--   locatário ativo do ENET de exemplo (src/server/comercial/exemplo, em
--   04/11/2026) e parte respondida pelo link e presencialmente.
--
-- Determinístico: setseed antes de cada sorteio.

create temp table censo_ex_temas (ordem int, nome text, textos text[]);
insert into censo_ex_temas values
  (1, 'Sinalização dos blocos', array[
    'Melhor sinalização dos blocos; clientes se perdem procurando a loja.',
    'Placas indicando os blocos logo na entrada do estacionamento.',
    'Mapa do espaço na entrada e nas escadas.',
    'Numeração das lojas mais visível nas fachadas.']),
  (2, 'Infraestrutura em dias de chuva', array[
    'Cobertura para passar entre os blocos quando chove.',
    'Poças no estacionamento em dia de chuva; clientes reclamam.',
    'Calhas transbordando na rua interna quando chove forte.']),
  (3, 'Caixa 24 horas e serviços', array[
    'Caixa eletrônico 24 horas dentro do espaço.',
    'Clientes pedem um banco 24 horas por perto.',
    'Um bicicletário coberto ajudaria quem vem de bicicleta.']),
  (4, 'Iluminação', array[
    'Iluminação nas ruas internas à noite.',
    'Os postes perto do bloco ficam apagados depois das 19h.',
    'Mais luz no caminho até o estacionamento.']),
  (5, 'Eventos e integração', array[
    'Mais eventos integrados com os lojistas.',
    'Clube de descontos entre os lojistas do espaço.',
    'Feiras no fim de semana trariam mais movimento.']),
  (6, 'Horários', array[
    'Abrir o estacionamento mais cedo.',
    'Portões abertos até mais tarde nos dias de semana.',
    'Horário do estacionamento no sábado é curto.']),
  (7, 'Divulgação', array[
    'Divulgação dos negócios no site e nas redes da ARP.',
    'Um guia das lojas para os clientes conhecerem o espaço.',
    'Campanhas do espaço citando os locatários.']),
  (8, 'Elogios', array[
    'Tudo ótimo, os clientes elogiam o espaço.',
    'Clientes comentam que o espaço está cada vez mais bonito.',
    'Segurança e limpeza muito elogiadas.']);

insert into comercial.censo_temas (nome, ordem, exemplo)
  select nome, ordem, true from censo_ex_temas order by ordem;

insert into comercial.censo_rodadas (nome, inicio, fim, situacao, encerrada_em, exemplo)
values
  ('Censo 2026', '2026-06-15', '2026-07-20', 'encerrada', '2026-07-21 18:00-03', true),
  ('Censo 2027', '2026-10-01', '2026-11-30', 'aberta', null, true);

-- Perfil de cada segmento (posições no sorteio, visitantes, ticket,
-- conversões por dia e se cobra mensalidade): só imitam a ordem de grandeza
-- da planilha de 2026.
create temp table censo_ex_seg (seg text, de int, ate int, vis int, ticket numeric, conv int, mensal boolean);
insert into censo_ex_seg values
  ('Serviços', 1, 53, 28, 250, 16, false),
  ('Clínicas e Médicos', 54, 95, 32, 320, 16, false),
  ('Comércio', 96, 128, 55, 190, 40, false),
  ('Alimentação', 129, 153, 85, 75, 95, false),
  ('Academias e Condicionamento', 154, 164, 75, 160, 50, true),
  ('Educação', 165, 170, 60, 480, 30, true),
  ('Veterinária', 171, 176, 22, 220, 16, false),
  ('Entretenimento', 177, 178, 150, 80, 150, false);

create temp table censo_ex_bloco (bloco text, de int, ate int);
insert into censo_ex_bloco values
  ('1', 1, 20), ('2', 21, 37), ('4', 38, 61), ('5', 62, 91), ('7', 92, 92),
  ('9', 93, 115), ('10', 116, 135), ('11', 136, 158), ('12', 159, 169),
  ('14', 170, 170), ('16', 171, 171), ('AC', 172, 177), ('QQ', 178, 178);

-- Tema de cada sugestão sorteada (peso pela repetição).
create temp table censo_ex_peso (pos int, tema int);
insert into censo_ex_peso
  select row_number() over (), t
  from unnest(array[1, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 7, 8, 8]) as t;

select setseed(0.2026);
create temp table censo_ex_26 as
  select i, random() as r_seg, random() as r_bloco, random() as u1, random() as u2,
    random() as r_vis, random() as r_ticket, random() as r_tval, random() as r_conv,
    random() as r_dias, random() as r_exp1, random() as r_exp2, random() as r_exp3,
    random() as r_sug, random() as r_tema, random() as r_texto, random() as r_hora
  from generate_series(0, 177) as i
  order by i;

create temp table censo_ex_26_linhas as
with nomes as (
  select
    array['Ateliê', 'Studio', 'Casa', 'Espaço', 'Empório', 'Oficina', 'Ponto', 'Recanto', 'Armazém', 'Cantinho',
          'Grupo', 'Bazar', 'Rede', 'Galeria', 'Núcleo', 'Vila', 'Toque', 'Arte', 'Mundo', 'Estação'] as p,
    array['Alecrim', 'Aurora', 'Bem-Estar', 'Lavanda', 'Serra Azul', 'Horizonte', 'Jasmim', 'Monte Verde', 'Bela Vista', 'Sol Nascente',
          'Girassol', 'Ipê', 'Primavera', 'Cedro', 'Manacá', 'Canela', 'Orquídea', 'Pinheiral', 'Riacho', 'Vale Novo'] as s
),
base as (
  select e.*,
    (row_number() over (order by e.r_seg, e.i))::int as pos_seg,
    (row_number() over (order by e.r_bloco, e.i))::int as pos_bloco
  from censo_ex_26 e
)
select b.*, sg.seg, sg.vis, sg.ticket as t_base, sg.conv as c_base, sg.mensal, bl.bloco,
  n.p[1 + b.i % 20] || ' ' || n.s[1 + (b.i / 20 + 3 * b.i) % 20] as empresa,
  -- Colaboradores puxados para poucos (mediana perto de 4, média perto de 10).
  greatest(1, least(140, round(exp(ln(4) + 1.42 * sqrt(-2 * ln(greatest(b.u1, 1e-9))) * cos(2 * pi() * b.u2)))))::int as colab,
  (array[22, 22, 22, 22, 20, 26, 12, 8, 4])[1 + floor(b.r_dias * 9)::int] as dias,
  case when b.r_ticket < 0.85
    then round(sg.ticket * (0.35 + 1.3 * b.r_tval::numeric) / 5) * 5 end as ticket,
  case when b.r_sug < 0.62
    then (select p.tema from censo_ex_peso p where p.pos = 1 + floor(b.r_tema * 14)::int) end as tema
from base b
cross join nomes n
join censo_ex_seg sg on b.pos_seg between sg.de and sg.ate
join censo_ex_bloco bl on b.pos_bloco between bl.de and bl.ate;

insert into comercial.censo_respostas (
  rodada_id, email, bloco, segmento, empresa_nome, colaboradores, visitantes_dia,
  ticket, mensalidade, dias_uso, conversoes_dia, expectativas, sugestao,
  ticket_ajustado, origem, respondida_em, exemplo
)
select
  (select id from comercial.censo_rodadas where nome = 'Censo 2026'),
  'contato' || l.i || '@exemplo.com.br',
  l.bloco,
  l.seg,
  l.empresa,
  l.colab,
  -- 5 responderam "-" (fica nulo) e 2 não recebem público.
  case when l.i in (41, 63, 120, 140, 160) then null when l.i in (17, 88) then 0
    else greatest(1, round(l.vis * (0.25 + 1.5 * l.r_vis)))::int end,
  l.ticket,
  case when l.ticket is not null then l.mensal end,
  case when l.ticket is not null and l.mensal then l.dias end,
  case when l.ticket is not null and l.r_conv >= 0.1
    then greatest(1, round(l.c_base * (0.3 + 1.4 * l.r_conv)))::int end,
  array_remove(array[
    case when l.r_exp1 < 0.42 or (l.r_exp2 >= 0.30 and l.r_exp3 >= 0.08 and l.i not in (99, 150))
      then 'Manter meu espaço' end,
    case when l.r_exp2 < 0.30 then 'Ampliar espaço' end,
    case when l.r_exp3 < 0.08 then 'Empreender com um novo negócio/projeto' end,
    case when l.i in (99, 150) then 'Reduzir meu espaço' end
  ], null),
  (select tm.textos[1 + floor(l.r_texto * array_length(tm.textos, 1))::int]
   from censo_ex_temas tm where tm.ordem = l.tema),
  case when l.ticket is null then null
    when l.mensal then round(l.ticket / l.dias, 4) else l.ticket end,
  'importacao',
  timestamptz '2026-06-15 08:00-03' + l.i * interval '4 hours 50 minutes' + l.r_hora * interval '3 hours',
  true
from censo_ex_26_linhas l
order by l.i;

insert into comercial.censo_sugestao_temas (tema_id, resposta_id, trecho, origem, exemplo)
select t.id, r.id, r.sugestao, 'importacao', true
from comercial.censo_respostas r
join censo_ex_26_linhas l on l.empresa = r.empresa_nome
join censo_ex_temas tm on tm.ordem = l.tema
join comercial.censo_temas t on t.nome = tm.nome
where r.rodada_id = (select id from comercial.censo_rodadas where nome = 'Censo 2026')
  and r.sugestao is not null;

-- Censo 2027: um convite por locatário ativo do ENET de exemplo (nome, LUC e
-- bloco do LUC; o segmento é o ramo de atividade do ENET).
create temp table censo_ex_convites (locatario text, empresa text, luc text, bloco text, segmento text);
insert into censo_ex_convites values
  ('CL00106', 'Ateliê Boa Vista ME', '09_206', '9', 'Veterinária'),
  ('CL00124', 'Ateliê Girassol ME', '10_102', '10', 'Clínicas e Médicos'),
  ('CL00017', 'Ateliê Jardim Ltda', '02_101', '2', 'Academias e Condicionamento'),
  ('CL00145', 'Ateliê Lumière ME', '10_128', '10', 'Entretenimento'),
  ('CL00243', 'Ateliê Lumière ME', '03_236', '3', 'Entretenimento'),
  ('CL00178', 'Ateliê Rosa dos Ventos ME', '12_203', '12', 'Clínicas e Médicos'),
  ('CL00164', 'Barbearia Alecrim Ltda', '11_134', '11', 'Comércio'),
  ('CL00141', 'Barbearia Girassol ME', '10_124', '10', 'Veterinária'),
  ('CL00239', 'Barbearia Horizonte Ltda', '12_108', '12', 'Veterinária'),
  ('CL00097', 'Barbearia Jardim Ltda', '05_231', '5', 'Academias e Condicionamento'),
  ('CL00088', 'Barbearia Rosa dos Ventos ME', '05_119', '5', 'Educação'),
  ('CL00112', 'Barbearia Serra Azul Ltda', '09_213', '9', 'Academias e Condicionamento'),
  ('CL00013', 'Barbearia Três Picos ME', '01_320', '1', 'Serviços'),
  ('CL00014', 'Bruno Moreira Pacheco', '01_121', '1', 'Entretenimento'),
  ('CL00176', 'Bruno Pacheco Esteves', '12_101', '12', 'Alimentação'),
  ('CL00140', 'Bruno Queiroz Ferraz', '10_123', '10', 'Serviços'),
  ('CL00152', 'Café Aurora Ltda', '11_113', '11', 'Veterinária'),
  ('CL00187', 'Café Girassol Ltda', '12_215', '12', 'Educação'),
  ('CL00170', 'Café Horizonte Ltda', '11_241', '11', 'Comércio'),
  ('CL00173', 'Café Jardim Ltda', '11_144', '11', 'Clínicas e Médicos'),
  ('CL00108', 'Café Jardim ME', '09_109', '9', 'Entretenimento'),
  ('CL00165', 'Café Jardim ME', '11_235', '11', 'Alimentação'),
  ('CL00201', 'Café Lumière Ltda', 'EXT_04', null, 'Serviços'),
  ('CL00199', 'Café Lumière ME', 'EXT_02', null, 'Academias e Condicionamento'),
  ('CL00117', 'Café Pinhal Ltda', '09_121', '9', 'Academias e Condicionamento'),
  ('CL00185', 'Café Primavera ME', '12_113', '12', 'Veterinária'),
  ('CL00004', 'Café Serra Azul Ltda', '01_106', '1', 'Entretenimento'),
  ('CL00191', 'Café Serra Azul Ltda', '12_220', '12', 'Veterinária'),
  ('CL00039', 'Caio Almeida Almeida', '03_108', '3', 'Alimentação'),
  ('CL00130', 'Caio Almeida Teixeira', '10_209', '10', 'Comércio'),
  ('CL00186', 'Caio Lacerda Queiroz', '12_214', '12', 'Alimentação'),
  ('CL00272', 'Caio Lacerda Valente', '12_112', '12', 'Academias e Condicionamento'),
  ('CL00101', 'Caio Queiroz Esteves', '07_101', '7', 'Clínicas e Médicos'),
  ('CL00241', 'Caio Siqueira Duarte', '05_125', '5', 'Veterinária'),
  ('CL00200', 'Carla Monteiro Barros', 'EXT_03', null, 'Veterinária'),
  ('CL00079', 'Carla Queiroz Teixeira', '05_107', '5', 'Entretenimento'),
  ('CL00046', 'Carla Rezende Almeida', '03_218', '3', 'Comércio'),
  ('CL00063', 'Carla Rezende Teixeira', '04_104', '4', 'Serviços'),
  ('CL00109', 'Casa Cascata ME', '09_210', '9', 'Veterinária'),
  ('CL00189', 'Casa Lumière Ltda', '12_117', '12', 'Academias e Condicionamento'),
  ('CL00273', 'Casa Primavera ME', '03_144', '3', 'Comércio'),
  ('CL00041', 'Casa Serra Azul Ltda', '03_111', '3', 'Clínicas e Médicos'),
  ('CL00094', 'Casa Serra Azul Ltda', '05_127', '5', 'Alimentação'),
  ('CL00236', 'Clínica Alecrim Ltda', 'STAN_05', null, 'Academias e Condicionamento'),
  ('CL00056', 'Clínica Alecrim ME', '03_234', '3', 'Veterinária'),
  ('CL00240', 'Clínica Aurora Ltda', '04_215', '4', 'Clínicas e Médicos'),
  ('CL00169', 'Clínica Boa Vista Ltda', '11_339', '11', 'Educação'),
  ('CL00020', 'Clínica Girassol Ltda', '02_305', '2', 'Academias e Condicionamento'),
  ('CL00092', 'Clínica Horizonte Ltda', '05_223', '5', 'Veterinária'),
  ('CL00279', 'Clínica Horizonte ME', '02_208', '2', 'Veterinária'),
  ('CL00121', 'Clínica Primavera Ltda', '09_227', '9', 'Alimentação'),
  ('CL00061', 'Clínica Rosa dos Ventos ME', '03_241', '3', 'Comércio'),
  ('CL00277', 'Clínica Rosa dos Ventos ME', '05_116', '5', 'Educação'),
  ('CL00066', 'Clínica Três Picos Ltda', '04_309', '4', 'Entretenimento'),
  ('CL00093', 'Diego Esteves Almeida', '05_126', '5', 'Veterinária'),
  ('CL00158', 'Doceria Alecrim Ltda', '11_130', '11', 'Clínicas e Médicos'),
  ('CL00167', 'Doceria Alecrim ME', '11_237', '11', 'Entretenimento'),
  ('CL00133', 'Doceria Aurora Ltda', '10_114', '10', 'Entretenimento'),
  ('CL00084', 'Doceria Jardim Ltda', '03_102', '3', 'Serviços'),
  ('CL00168', 'Doceria Pinhal Ltda', '11_138', '11', 'Clínicas e Médicos'),
  ('CL00024', 'Doceria Rosa dos Ventos Ltda', '02_111', '2', 'Entretenimento'),
  ('CL00278', 'Elisa Ferraz Siqueira', '09_118', '9', 'Academias e Condicionamento'),
  ('CL00177', 'Elisa Teixeira Moreira', '12_202', '12', 'Veterinária'),
  ('CL00008', 'Empório Alecrim Ltda', '01_112', '1', 'Serviços'),
  ('CL00111', 'Empório Alecrim Ltda', '09_112', '9', 'Veterinária'),
  ('CL00118', 'Empório Aurora ME', '09_222', '9', 'Clínicas e Médicos'),
  ('CL00182', 'Empório Girassol Ltda', '12_107', '12', 'Comércio'),
  ('CL00198', 'Empório Girassol Ltda', '85_101', '85', 'Clínicas e Médicos'),
  ('CL00011', 'Empório Mirante Ltda', '01_217', '1', 'Entretenimento'),
  ('CL00136', 'Empório Mirante Ltda', '10_117', '10', 'Veterinária'),
  ('CL00015', 'Empório Pinhal Ltda', '01_124', '1', 'Academias e Condicionamento'),
  ('CL00122', 'Empório Serra Azul Ltda', '09_128', '9', 'Academias e Condicionamento'),
  ('CL00102', 'Empório Serra Azul Ltda', '01_213', '1', 'Educação'),
  ('CL00028', 'Empório Três Picos Ltda', '02_117', '2', 'Veterinária'),
  ('CL00042', 'Empório Vale Verde Ltda', '03_113', '3', 'Academias e Condicionamento'),
  ('CL00179', 'Empório Vale Verde Ltda', '12_104', '12', 'Educação'),
  ('CL00284', 'Espaço Alecrim Ltda', '10_307', '10', 'Academias e Condicionamento'),
  ('CL00076', 'Espaço Aurora Ltda', '05_104', '5', 'Alimentação'),
  ('CL00134', 'Espaço Aurora Ltda', '10_115', '10', 'Comércio'),
  ('CL00147', 'Espaço Aurora Ltda', '11_203', '11', 'Veterinária'),
  ('CL00246', 'Espaço Mirante Ltda', '01_111', '1', 'Entretenimento'),
  ('CL00258', 'Espaço Primavera ME', '12_119', '12', 'Comércio'),
  ('CL00175', 'Espaço Vale Verde ME', '04_112', '4', 'Veterinária'),
  ('CL00126', 'Estúdio Alecrim ME', '10_204', '10', 'Veterinária'),
  ('CL00105', 'Estúdio Girassol ME', '09_105', '9', 'Veterinária'),
  ('CL00264', 'Estúdio Lumière Ltda', '14_103', '14', 'Entretenimento'),
  ('CL00060', 'Estúdio Mirante Ltda', '03_240', '3', 'Academias e Condicionamento'),
  ('CL00137', 'Estúdio Pinhal ME', '10_218', '10', 'Comércio'),
  ('CL00162', 'Estúdio Vale Verde ME', '11_228', '11', 'Veterinária'),
  ('CL00249', 'Fábio Duarte Barros', '03_114', '3', 'Educação'),
  ('CL00087', 'Fábio Ferraz Cardoso', '05_118', '5', 'Educação'),
  ('CL00154', 'Gabriela Almeida Cardoso', '11_115', '11', 'Entretenimento'),
  ('CL00089', 'Heitor Ferraz Ferraz', '05_320', '5', 'Academias e Condicionamento'),
  ('CL00128', 'Heitor Pacheco Siqueira', '10_106', '10', 'Academias e Condicionamento'),
  ('CL00064', 'Igor Cardoso Teixeira', '04_206', '4', 'Alimentação'),
  ('CL00107', 'Instituto Aurora Ltda', '05_115', '5', 'Comércio'),
  ('CL00113', 'Instituto Girassol Ltda', '09_214', '9', 'Clínicas e Médicos'),
  ('CL00001', 'Instituto Girassol ME', '01_302', '1', 'Comércio'),
  ('CL00053', 'Instituto Girassol ME', '03_328', '3', 'Alimentação'),
  ('CL00077', 'Instituto Girassol ME', '05_105', '5', 'Comércio'),
  ('CL00285', 'Instituto Jardim ME', '05_134', '5', 'Academias e Condicionamento'),
  ('CL00090', 'Instituto Lumière Ltda', '05_121', '5', 'Academias e Condicionamento'),
  ('CL00073', 'Instituto Primavera Ltda', '04_325', '4', 'Comércio'),
  ('CL00143', 'Instituto Rosa dos Ventos Ltda', '10_126', '10', 'Comércio'),
  ('CL00005', 'Isabela Duarte Valente', '01_119', '1', 'Comércio'),
  ('CL00151', 'Isabela Ferraz Esteves', '11_212', '11', 'Entretenimento'),
  ('CL00037', 'Isabela Monteiro Pacheco', '03_103', '3', 'Alimentação'),
  ('CL00038', 'Isabela Siqueira Xavier', '03_104', '3', 'Serviços'),
  ('CL00166', 'João Cardoso Moreira', '11_136', '11', 'Comércio'),
  ('CL00009', 'João Duarte Lacerda', '03_109', '3', 'Entretenimento'),
  ('CL00160', 'João Gouveia Teixeira', '11_126', '11', 'Educação'),
  ('CL00078', 'João Moreira Xavier', '05_106', '5', 'Serviços'),
  ('CL00281', 'João Rezende Barros', '11_221', '11', 'Veterinária'),
  ('CL00048', 'Laboratório Aurora Ltda', '03_120', '3', 'Serviços'),
  ('CL00269', 'Laboratório Aurora ME', '03_119', '3', 'Entretenimento'),
  ('CL00006', 'Laboratório Girassol ME', '01_108', '1', 'Veterinária'),
  ('CL00044', 'Laboratório Girassol ME', '03_116', '3', 'Comércio'),
  ('CL00192', 'Laboratório Jardim Ltda', '12_221', '12', 'Comércio'),
  ('CL00195', 'Laboratório Lumière Ltda', '14_102', '14', 'Clínicas e Médicos'),
  ('CL00083', 'Laboratório Lumière ME', '05_112', '5', 'Comércio'),
  ('CL00150', 'Laboratório Mirante Ltda', '11_307', '11', 'Serviços'),
  ('CL00146', 'Laboratório Mirante ME', '11_131', '11', 'Alimentação'),
  ('CL00021', 'Laboratório Pinhal Ltda', '02_106', '2', 'Academias e Condicionamento'),
  ('CL00135', 'Laboratório Vale Verde Ltda', '10_316', '10', 'Veterinária'),
  ('CL00139', 'Laboratório Vale Verde Ltda', '10_221', '10', 'Entretenimento'),
  ('CL00252', 'Laboratório Vale Verde Ltda', '05_110', '5', 'Entretenimento'),
  ('CL00157', 'Larissa Nogueira Queiroz', '11_218', '11', 'Educação'),
  ('CL00159', 'Larissa Queiroz Cardoso', '11_123', '11', 'Serviços'),
  ('CL00172', 'Lívia Lacerda Pacheco', '11_143', '11', 'Comércio'),
  ('CL00119', 'Lívia Nogueira Ferraz', '09_124', '9', 'Alimentação'),
  ('CL00132', 'Lívia Valente Moreira', '10_213', '10', 'Educação'),
  ('CL00057', 'Loja Aurora Ltda', '03_335', '3', 'Entretenimento'),
  ('CL00197', 'Loja Aurora ME', '14_104', '14', 'Academias e Condicionamento'),
  ('CL00253', 'Loja Boa Vista Ltda', '03_210', '3', 'Comércio'),
  ('CL00007', 'Loja Cascata Ltda', '01_110', '1', 'Entretenimento'),
  ('CL00261', 'Loja Cascata Ltda', '02_220', '2', 'Serviços'),
  ('CL00023', 'Loja Girassol ME', '02_110', '2', 'Comércio'),
  ('CL00040', 'Loja Girassol ME', '03_115', '3', 'Academias e Condicionamento'),
  ('CL00153', 'Loja Horizonte ME', '11_114', '11', 'Clínicas e Médicos'),
  ('CL00155', 'Loja Lumière Ltda', '11_216', '11', 'Educação'),
  ('CL00181', 'Loja Mirante ME', '12_206', '12', 'Academias e Condicionamento'),
  ('CL00120', 'Loja Pinhal Ltda', '09_125', '9', 'Veterinária'),
  ('CL00251', 'Loja Primavera Ltda', '02_202', '2', 'Serviços'),
  ('CL00010', 'Loja Três Picos Ltda', '01_114', '1', 'Veterinária'),
  ('CL00045', 'Marcelo Almeida Cardoso', '03_217', '3', 'Comércio'),
  ('CL00095', 'Marcelo Gouveia Queiroz', '05_128', '5', 'Clínicas e Médicos'),
  ('CL00283', 'Marcelo Moreira Xavier', '12_116', '12', 'Comércio'),
  ('CL00104', 'Marcelo Siqueira Teixeira', '09_103', '9', 'Veterinária'),
  ('CL00100', 'Marcelo Valente Rezende', '05_135', '5', 'Academias e Condicionamento'),
  ('CL00149', 'Natália Cardoso Ferraz', '11_106', '11', 'Academias e Condicionamento'),
  ('CL00237', 'Natália Esteves Barros', 'CASA_08', null, 'Academias e Condicionamento'),
  ('CL00071', 'Natália Rezende Duarte', '04_122', '4', 'Comércio'),
  ('CL00238', 'Oficina Boa Vista Ltda', 'LOJA_13', null, 'Clínicas e Médicos'),
  ('CL00190', 'Oficina Girassol ME', '12_318', '12', 'Alimentação'),
  ('CL00026', 'Oficina Horizonte Ltda', '02_115', '2', 'Alimentação'),
  ('CL00068', 'Oficina Horizonte Ltda', '09_226', '9', 'Alimentação'),
  ('CL00035', 'Oficina Mirante Ltda', '02_226', '2', 'Entretenimento'),
  ('CL00131', 'Oficina Primavera ME', '10_111', '10', 'Comércio'),
  ('CL00125', 'Oficina Rosa dos Ventos Ltda', '10_103', '10', 'Academias e Condicionamento'),
  ('CL00003', 'Oficina Vale Verde ME', '01_105', '1', 'Veterinária'),
  ('CL00052', 'Oficina Vale Verde ME', '03_125', '3', 'Comércio'),
  ('CL00074', 'Otávio Barros Queiroz', '05_202', '5', 'Serviços'),
  ('CL00103', 'Otávio Cardoso Nogueira', '09_102', '9', 'Clínicas e Médicos'),
  ('CL00250', 'Otávio Duarte Duarte', '02_222', '2', 'Alimentação'),
  ('CL00059', 'Otávio Lacerda Gouveia', '03_239', '3', 'Clínicas e Médicos'),
  ('CL00025', 'Otávio Moreira Gouveia', '02_212', '2', 'Academias e Condicionamento'),
  ('CL00012', 'Otávio Moreira Valente', '01_118', '1', 'Educação'),
  ('CL00027', 'Otávio Queiroz Lacerda', '02_116', '2', 'Comércio'),
  ('CL00070', 'Otávio Teixeira Teixeira', '04_121', '4', 'Clínicas e Médicos'),
  ('CL00174', 'Otávio Valente Almeida', '11_145', '11', 'Comércio'),
  ('CL00098', 'Ótica Aurora ME', '05_132', '5', 'Veterinária'),
  ('CL00091', 'Ótica Jardim Ltda', '05_222', '5', 'Educação'),
  ('CL00163', 'Ótica Jardim ME', '11_129', '11', 'Serviços'),
  ('CL00270', 'Ótica Jardim ME', '04_123', '4', 'Academias e Condicionamento'),
  ('CL00049', 'Ótica Lumière Ltda', '03_121', '3', 'Comércio'),
  ('CL00274', 'Ótica Lumière Ltda', '01_109', '1', 'Clínicas e Médicos'),
  ('CL00050', 'Ótica Lumière ME', '03_122', '3', 'Alimentação'),
  ('CL00029', 'Ótica Primavera Ltda', '02_118', '2', 'Entretenimento'),
  ('CL00123', 'Ótica Rosa dos Ventos ME', '09_130', '9', 'Alimentação'),
  ('CL00016', 'Ótica Serra Azul ME', '01_125', '1', 'Comércio'),
  ('CL00065', 'Paula Almeida Esteves', '04_107', '4', 'Alimentação'),
  ('CL00263', 'Paula Monteiro Teixeira', '11_146', '11', 'Clínicas e Médicos'),
  ('CL00116', 'Paula Teixeira Duarte', '09_120', '9', 'Academias e Condicionamento'),
  ('CL00161', 'Renato Ferraz Queiroz', '11_227', '11', 'Clínicas e Médicos'),
  ('CL00067', 'Renato Moreira Rezende', '04_111', '4', 'Educação'),
  ('CL00036', 'Renato Pacheco Cardoso', '03_101', '3', 'Clínicas e Médicos'),
  ('CL00080', 'Sabrina Almeida Siqueira', '05_209', '5', 'Veterinária'),
  ('CL00127', 'Studio Cascata Ltda', '10_105', '10', 'Academias e Condicionamento'),
  ('CL00180', 'Studio Girassol ME', '12_105', '12', 'Academias e Condicionamento'),
  ('CL00062', 'Studio Horizonte Ltda', '03_143', '3', 'Alimentação'),
  ('CL00022', 'Studio Horizonte Ltda', '02_109', '2', 'Veterinária'),
  ('CL00034', 'Studio Horizonte ME', '02_124', '2', 'Veterinária'),
  ('CL00055', 'Studio Horizonte ME', '03_132', '3', 'Clínicas e Médicos'),
  ('CL00254', 'Studio Horizonte ME', '03_345', '3', 'Serviços'),
  ('CL00138', 'Studio Pinhal Ltda', '10_319', '10', 'Comércio'),
  ('CL00142', 'Studio Serra Azul ME', '10_125', '10', 'Comércio'),
  ('CL00144', 'Studio Vale Verde Ltda', '10_227', '10', 'Educação'),
  ('CL00019', 'Tiago Barros Teixeira', '03_226', '3', 'Serviços'),
  ('CL00033', 'Tiago Lacerda Teixeira', '02_123', '2', 'Serviços'),
  ('CL00267', 'Tiago Nogueira Barros', '11_217', '11', 'Educação'),
  ('CL00148', 'Tiago Pacheco Gouveia', '11_104', '11', 'Veterinária'),
  ('CL00051', 'Vanessa Queiroz Nogueira', '03_123', '3', 'Serviços'),
  ('CL00193', 'Wagner Cardoso Siqueira', '12_122', '12', 'Clínicas e Médicos'),
  ('CL00075', 'Wagner Lacerda Esteves', '05_303', '5', 'Serviços'),
  ('CL00129', 'Wagner Moreira Teixeira', '10_108', '10', 'Alimentação'),
  ('CL00110', 'Wagner Siqueira Almeida', '09_311', '9', 'Comércio'),
  ('CL00268', 'Yasmin Barros Moreira', '09_101', '9', 'Serviços'),
  ('CL00030', 'Yasmin Ferraz Moreira', '02_119', '2', 'Veterinária'),
  ('CL00002', 'Yasmin Gouveia Gouveia', '01_104', '1', 'Academias e Condicionamento'),
  ('CL00096', 'Yasmin Moreira Rezende', '05_129', '5', 'Comércio'),
  ('CL00171', 'Yasmin Nogueira Esteves', '11_242', '11', 'Veterinária'),
  ('CL00031', 'Yasmin Xavier Lacerda', '02_121', '2', 'Educação');

select setseed(0.2027);
create temp table censo_ex_27 as
  select c.*, random() as r_ordem, random() as r_env, random() as u1, random() as u2,
    random() as r_vis, random() as r_ticket, random() as r_tval, random() as r_conv,
    random() as r_exp1, random() as r_exp2, random() as r_exp3, random() as r_sug,
    random() as r_tema, random() as r_texto, random() as r_hora, random() as r_pres
  from censo_ex_convites c
  order by c.locatario;

insert into comercial.censo_convites (rodada_id, locatario_enet_id, empresa_nome, luc, bloco, enviado_em, exemplo)
select
  (select id from comercial.censo_rodadas where nome = 'Censo 2027'),
  e.locatario, e.empresa, e.luc, e.bloco,
  case when e.r_env < 0.8 then timestamptz '2026-10-01 09:00-03' + e.r_env * interval '6 days' end,
  true
from censo_ex_27 e
order by e.locatario;

-- 41 empresas já responderam (as primeiras do sorteio), 8 delas em
-- aplicação presencial; quem respondeu teve o link enviado.
create temp table censo_ex_27_linhas as
select e.*, sg.vis, sg.ticket as t_base, sg.conv as c_base, sg.mensal,
  coalesce(b.valor, 'AC') as bloco_resposta,
  greatest(1, least(140, round(exp(ln(4) + 1.42 * sqrt(-2 * ln(greatest(e.u1, 1e-9))) * cos(2 * pi() * e.u2)))))::int as colab,
  case when e.r_ticket < 0.85
    then round(sg.ticket * (0.35 + 1.3 * e.r_tval::numeric) / 5) * 5 end as ticket,
  case when e.r_sug < 0.55
    then (select p.tema from censo_ex_peso p where p.pos = 1 + floor(e.r_tema * 14)::int) end as tema,
  row_number() over (order by e.r_ordem, e.locatario) as n
from censo_ex_27 e
join censo_ex_seg sg on sg.seg = e.segmento
left join comercial.listas b on b.lista = 'censo_bloco' and b.valor = e.bloco;

delete from censo_ex_27_linhas where n > 41;

update comercial.censo_convites c
set enviado_em = coalesce(c.enviado_em, timestamptz '2026-10-02 09:00-03')
from censo_ex_27_linhas l
where c.locatario_enet_id = l.locatario
  and c.rodada_id = (select id from comercial.censo_rodadas where nome = 'Censo 2027');

insert into comercial.censo_respostas (
  rodada_id, convite_id, locatario_enet_id, luc, email, bloco, segmento,
  empresa_nome, colaboradores, visitantes_dia, ticket, mensalidade, dias_uso,
  conversoes_dia, expectativas, sugestao, ticket_ajustado, origem,
  respondida_em, exemplo
)
select
  c.rodada_id, c.id, l.locatario, l.luc,
  'contato' || l.n || '@exemplo.com.br',
  l.bloco_resposta, l.segmento, l.empresa, l.colab,
  greatest(0, round(l.vis * (0.25 + 1.5 * l.r_vis)))::int,
  l.ticket,
  case when l.ticket is not null then l.mensal end,
  case when l.ticket is not null and l.mensal then 22 end,
  case when l.ticket is not null and l.r_conv >= 0.1
    then greatest(1, round(l.c_base * (0.3 + 1.4 * l.r_conv)))::int end,
  array_remove(array[
    case when l.r_exp1 < 0.42 or (l.r_exp2 >= 0.30 and l.r_exp3 >= 0.08) then 'Manter meu espaço' end,
    case when l.r_exp2 < 0.30 then 'Ampliar espaço' end,
    case when l.r_exp3 < 0.08 then 'Empreender com um novo negócio/projeto' end
  ], null),
  (select tm.textos[1 + floor(l.r_texto * array_length(tm.textos, 1))::int]
   from censo_ex_temas tm where tm.ordem = l.tema),
  case when l.ticket is null then null
    when l.mensal then round(l.ticket / 22, 4) else l.ticket end,
  case when l.r_pres < 0.2 then 'presencial' else 'link' end,
  timestamptz '2026-10-02 10:00-03' + l.n * interval '19 hours' + l.r_hora * interval '5 hours',
  true
from censo_ex_27_linhas l
join comercial.censo_convites c
  on c.locatario_enet_id = l.locatario
  and c.rodada_id = (select id from comercial.censo_rodadas where nome = 'Censo 2027')
order by l.n;

insert into comercial.censo_sugestao_temas (tema_id, resposta_id, trecho, origem, exemplo)
select t.id, r.id, r.sugestao, 'importacao', true
from comercial.censo_respostas r
join censo_ex_27_linhas l on l.locatario = r.locatario_enet_id
join censo_ex_temas tm on tm.ordem = l.tema
join comercial.censo_temas t on t.nome = tm.nome
where r.rodada_id = (select id from comercial.censo_rodadas where nome = 'Censo 2027')
  and r.sugestao is not null;

drop table censo_ex_temas, censo_ex_seg, censo_ex_bloco, censo_ex_peso, censo_ex_26, censo_ex_26_linhas,
  censo_ex_convites, censo_ex_27, censo_ex_27_linhas;
