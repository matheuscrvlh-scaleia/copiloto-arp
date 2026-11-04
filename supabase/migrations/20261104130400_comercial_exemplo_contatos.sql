-- Exemplo do Relacionamento (spec 4.7): 26 contatos fictícios com
-- locatários do ENET de exemplo (src/server/comercial/exemplo/enet.ts:
-- contratos da carteira inicial, que o gerador repete igual todo dia).
-- Datas relativas ao dia em que a migration roda, para caber nos "últimos
-- 90 dias". Sem quem registrou (exemplo = true); "Remover dados de
-- exemplo" em Configurações apaga.

insert into comercial.contatos
  (data, locatario_enet_id, locatario_nome, contrato_enet_id, luc, bloco, tipo, canal, descricao, precisa_outro_setor, registrado_por, exemplo)
values
  (current_date - 1,  'CL00001', 'Instituto Girassol ME',          'CT00001', '01_302', 'Bloco 01', 'Reclamação',        'WhatsApp',   'Ar-condicionado da sala pingando na entrada desde segunda.', true, null, true),
  (current_date - 2,  'CL00007', 'Loja Cascata Ltda',              'CT00008', '01_110', 'Bloco 01', 'Renovação',         'Telefone',   'Quer renovar por mais 36 meses; pediu proposta com o reajuste do ano.', false, null, true),
  (current_date - 3,  'CL00014', 'Bruno Moreira Pacheco',          'CT00016', '01_121', 'Bloco 01', 'Feedback positivo', 'Presencial', 'Elogiou a limpeza dos corredores e o novo horário da portaria.', false, null, true),
  (current_date - 5,  'CL00023', 'Loja Girassol ME',               'CT00027', '02_110', 'Bloco 02', 'Sugestão',          'E-mail',     'Sugere mais bicicletários perto da Rua das Rendas.', false, null, true),
  (current_date - 6,  'CL00029', 'Ótica Primavera Ltda',           'CT00034', '02_118', 'Bloco 02', 'Atendimento',       'WhatsApp',   'Pediu a segunda via do boleto do condomínio.', false, null, true),
  (current_date - 8,  'CL00036', 'Renato Pacheco Cardoso',         'CT00042', '03_101', 'Bloco 03', 'Mudança de imóvel', 'Presencial', 'Procura sala maior no mesmo bloco, perto de 60 m².', false, null, true),
  (current_date - 9,  'CL00042', 'Empório Vale Verde Ltda',        'CT00050', '03_113', 'Bloco 03', 'Reclamação',        'Telefone',   'Lâmpadas queimadas no estacionamento do bloco à noite.', true, null, true),
  (current_date - 11, 'CL00050', 'Ótica Lumière ME',               'CT00059', '03_122', 'Bloco 03', 'Feedback positivo', 'E-mail',     'Gostou do evento de fim de semana; movimento acima do normal.', false, null, true),
  (current_date - 13, 'CL00056', 'Clínica Alecrim ME',             'CT00068', '03_234', 'Bloco 03', 'Atendimento',       'Presencial', 'Pediu orientação para placa de fachada; enviado o regimento.', false, null, true),
  (current_date - 15, 'CL00063', 'Carla Rezende Teixeira',         'CT00078', '04_104', 'Bloco 04', 'Renovação',         'WhatsApp',   'Contrato perto do fim; quer conversar sobre prazo indeterminado.', false, null, true),
  (current_date - 18, 'CL00071', 'Natália Rezende Duarte',         'CT00087', '04_122', 'Bloco 04', 'Sugestão',          'Presencial', 'Sugere sinalização melhor da Rua da Tinturaria para clientes.', false, null, true),
  (current_date - 20, 'CL00077', 'Instituto Girassol ME',          'CT00095', '05_105', 'Bloco 05', 'Reclamação',        'E-mail',     'Barulho de obra na loja vizinha fora do horário permitido.', true, null, true),
  (current_date - 23, 'CL00088', 'Barbearia Rosa dos Ventos ME',   'CT00107', '05_119', 'Bloco 05', 'Feedback positivo', 'WhatsApp',   'Agradeceu a resposta rápida da manutenção.', false, null, true),
  (current_date - 26, 'CL00095', 'Marcelo Gouveia Queiroz',        'CT00114', '05_128', 'Bloco 05', 'Atendimento',       'Telefone',   'Dúvida sobre o rateio de água do mês.', false, null, true),
  (current_date - 30, 'CL00103', 'Otávio Cardoso Nogueira',        'CT00123', '09_102', 'Bloco 09', 'Devolução',         'Presencial', 'Avisou que pretende devolver o imóvel no próximo semestre.', false, null, true),
  (current_date - 34, 'CL00110', 'Wagner Siqueira Almeida',        'CT00130', '09_311', 'Bloco 09', 'Sugestão',          'E-mail',     'Pede tomadas para carro elétrico no estacionamento.', false, null, true),
  (current_date - 38, 'CL00118', 'Empório Aurora ME',              'CT00139', '09_222', 'Bloco 09', 'Reclamação',        'WhatsApp',   'Infiltração no teto do depósito depois da chuva forte.', true, null, true),
  (current_date - 42, 'CL00121', 'Clínica Primavera Ltda',         'CT00146', '10_101', 'Bloco 10', 'Renovação',         'Presencial', 'Aceitou a renovação; aguarda a minuta do aditivo.', false, null, true),
  (current_date - 47, 'CL00130', 'Caio Almeida Teixeira',          'CT00153', '10_209', 'Bloco 10', 'Feedback positivo', 'Telefone',   'Satisfeito com a segurança noturna do bloco.', false, null, true),
  (current_date - 52, 'CL00137', 'Estúdio Pinhal ME',              'CT00160', '10_218', 'Bloco 10', 'Outro',             'E-mail',     'Pediu indicação de fornecedor de mobiliário.', false, null, true),
  (current_date - 58, 'CL00143', 'Instituto Rosa dos Ventos Ltda', 'CT00167', '10_126', 'Bloco 10', 'Mudança de imóvel', 'WhatsApp',   'Quer saber das salas vagas no Bloco 11 para ampliar.', false, null, true),
  (current_date - 64, 'CL00149', 'Natália Cardoso Ferraz',         'CT00174', '11_106', 'Bloco 11', 'Reclamação',        'Presencial', 'Elevador do bloco parado duas vezes na semana.', true, null, true),
  (current_date - 71, 'CL00155', 'Loja Lumière Ltda',              'CT00181', '11_216', 'Bloco 11', 'Sugestão',          'WhatsApp',   'Sugere feira de artesanato no deck aos sábados.', false, null, true),
  (current_date - 78, 'CL00163', 'Ótica Jardim ME',                'CT00190', '11_129', 'Bloco 11', 'Atendimento',       'Telefone',   'Pediu a planta da loja para o projeto de reforma.', false, null, true),
  (current_date - 85, 'CL00168', 'Doceria Pinhal Ltda',            'CT00197', '11_138', 'Bloco 11', 'Feedback positivo', 'Presencial', 'Elogiou a decoração de fim de ano dos corredores.', false, null, true),
  (current_date - 120, 'CL00176', 'Bruno Pacheco Esteves',         'CT00205', '12_101', 'Bloco 12', 'Renovação',         'E-mail',     'Primeiro contato sobre a renovação do ano que vem.', false, null, true);
