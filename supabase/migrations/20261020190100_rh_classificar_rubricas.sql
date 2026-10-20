-- Rubricas novas da folha de 07/2026 (rescisões, afastamentos e o reajuste
-- antecipado de 3%, "antecipação salarial"). Arquivo separado porque o
-- valor 'informativa' do enum só pode ser usado depois de criado.
-- Só classifica o que ainda está como não classificada: escolha já feita
-- na tela fica.

insert into rh.rubricas (codigo, descricao, grupo, classificada_em) values
  -- Informativas (FGTS da rescisão): o encargo vem dos parâmetros.
  (23,   'FGTS de rescisão', 'informativa', now()),
  (35,   'FGTS 13º salário rescisão', 'informativa', now()),
  -- Desconto que zera o líquido: a rescisão é paga à parte.
  (51,   'Líquido rescisão', 'adiantamento', now()),
  (292,  'Vale / adiantamento', 'adiantamento', now()),
  (871,  'Desconto troco adiantamento salarial', 'arredondamento', now()),
  -- Devolução do VT pelo demitido: reduz o custo do benefício.
  (414,  'Restituição vale-transporte', 'beneficio_desconto', now()),
  -- Férias pagas na rescisão.
  (815,  'Média horas férias proporcionais', 'pagamento_provisionado', now()),
  (816,  'Média valor férias proporcionais', 'pagamento_provisionado', now()),
  (817,  'Vantagens férias proporcionais', 'pagamento_provisionado', now()),
  (8156, 'Média valor férias 1/12 indenizado', 'pagamento_provisionado', now()),
  (8157, 'Média horas férias 1/12 indenizado', 'pagamento_provisionado', now()),
  (8158, 'Vantagens férias 1/12 indenizado', 'pagamento_provisionado', now()),
  (8169, '1/3 férias proporcionais rescisão', 'pagamento_provisionado', now()),
  -- Reajuste antecipado sobre cada verba: segue o grupo da verba-base.
  (8232, '13º salário integral antecipação salarial', 'pagamento_provisionado', now()),
  (8238, 'Férias proporcionais antecipação salarial', 'pagamento_provisionado', now()),
  (8239, '1/3 férias proporcionais antecipação salarial', 'pagamento_provisionado', now()),
  (8242, 'Férias 1/12 indenizado antecipação salarial', 'pagamento_provisionado', now()),
  (8243, '1/3 férias indenizadas antecipação salarial', 'pagamento_provisionado', now()),
  (9609, 'Aviso prévio antecipação salarial', 'rescisao', now()),
  (8244, 'Antecipação salarial afastamento acidente de trabalho', 'afastamento', now()),
  (8245, 'Antecipação salarial afastamento', 'afastamento', now())
on conflict (codigo) do update
  set grupo = excluded.grupo, classificada_em = excluded.classificada_em
  where rh.rubricas.grupo = 'nao_classificada';
