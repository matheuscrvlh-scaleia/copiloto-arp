-- Fichas cadastrais de exemplo (mockup, spec 6): 24 fichas fictícias (PJ,
-- PF e fiador; recebidas, em preenchimento e usadas em contrato; 8 vindas
-- do Google Forms), com exemplo = true. Nomes, CPFs, CNPJs, telefones e
-- e-mails inventados (os dígitos verificadores conferem). A ficha 18 repete
-- o CPF da 11 (o detalhe avisa a equipe). "Remover dados de exemplo" apaga
-- tudo (ficha_dados e ficha_documentos saem junto, em cascata).
-- As respostas seguem src/lib/comercial/ficha.ts (respostasSchema).

-- CPF (pesos até 11) e CNPJ (pesos até 9): base + os dois dígitos.
create function pg_temp.com_dv(base text, maximo int) returns text
language plpgsql immutable as $f$
declare
  b text := base;
  soma int;
  peso int;
begin
  for k in 1..2 loop
    soma := 0;
    peso := 2;
    for i in reverse length(b)..1 loop
      soma := soma + substr(b, i, 1)::int * peso;
      peso := case when peso = maximo then 2 else peso + 1 end;
    end loop;
    b := b || (case when soma % 11 < 2 then 0 else 11 - soma % 11 end)::text;
  end loop;
  return b;
end;
$f$;

create function pg_temp.com_endereco(n int, rua text, bairro text) returns jsonb
language sql immutable as $f$
  select jsonb_build_object(
    'cep', '286' || lpad(((n * 37) % 100000)::text, 5, '0'),
    'logradouro', rua,
    'numero', ((n * 53) % 900 + 10)::text,
    'complemento', case when n % 3 = 0 then 'SALA ' || (n % 7 + 1) else '' end,
    'bairro', bairro,
    'cidade', 'NOVA FRIBURGO',
    'uf', 'RJ'
  );
$f$;

create function pg_temp.com_telefone(n int) returns text
language sql immutable as $f$
  select '2298' || lpad(((n * 137911) % 10000000)::text, 7, '0');
$f$;

do $$
declare
  r record;
  v_id uuid;
  v_ids uuid[] := '{}';
  v_quando timestamptz;
  v_cpf text;
  v_doc text;
  v_pessoa jsonb;
  v_conj jsonb;
  v_emp jsonb;
  v_renda jsonb;
  v_resp jsonb;
  v_nome text;
  v_docs text[];
  v_ruas text[] := array['RUA MONSENHOR MIRANDA', 'AV. ALBERTO BRAUNE', 'RUA GENERAL OSORIO',
    'RUA FARINHA FILHO', 'AV. GALDINO DO VALLE FILHO', 'RUA DANTE LAGINESTRA'];
  v_bairros text[] := array['CENTRO', 'OLARIA', 'CONSELHEIRO PAULINO', 'CORDOEIRA', 'PRADO', 'VILA AMELIA'];
begin
  for r in
    select * from (values
      -- n, tipo, situação, origem, dias atrás, LUC, nome (PF/sócio), estado civil,
      -- cônjuge, profissão, empresa (renda), renda, razão social, natureza, ramo, CNAE, principal
      (1, 'pj', 'recebida', 'sistema', 3, '11_131', 'LARISSA NOGUEIRA PACHECO', 'Casado(a)',
        'RAFAEL PACHECO DIAS', 'EMPRESARIA', 'ATELIE ALECRIM', 9500::numeric,
        'ATELIE ALECRIM PRESENTES LTDA', 'LTDA (com sócios)', 'COMERCIO DE PRESENTES', '4789-0/99', null::int),
      (2, 'pj', 'recebida', 'sistema', 9, '03_105', 'OTAVIO BRANDAO REIS', 'Solteiro(a)',
        null, 'EMPRESARIO', 'CAFE SERRA FRIA', 7200, 'CAFE SERRA FRIA LTDA', 'LTDA (unipessoal)',
        'CAFETERIA', '5611-2/03', null),
      (3, 'pj', 'usada', 'sistema', 41, '05_212', 'BEATRIZ CAMPOS VIANA', 'Divorciado(a)',
        null, 'ESTILISTA', 'MODA RAIZ', 12800, 'MODA RAIZ CONFECCOES EIRELI', 'EIRELI',
        'CONFECCAO DE ROUPAS', '1412-6/01', null),
      (4, 'pj', 'em_preenchimento', 'sistema', 2, '02_118', 'ROGERIO TAVARES LIMA', '',
        null, '', '', null, 'PADARIA TRIGO BOM ME', 'MEI/ME', '', '', null),
      (5, 'pj', 'recebida', 'google_forms', 58, '09_301', 'CARLA MENDES ROCHA', 'Em união estável / convivente',
        'DIEGO ROCHA SALES', 'EDUCADORA FISICA', 'STUDIO EQUILIBRIO', 6100, 'STUDIO PILATES EQUILIBRIO ME',
        'MEI/ME', 'ESTUDIO DE PILATES', '8591-1/00', null),
      (6, 'pj', 'usada', 'google_forms', 77, '12_140', 'FERNANDO AGUIAR LOPES', 'Casado(a)',
        'PATRICIA LOPES AGUIAR', 'OPTOMETRISTA', 'OTICA VISAO CLARA', 15400, 'OTICA VISAO CLARA LTDA',
        'LTDA (com sócios)', 'OTICA', '4774-1/00', null),
      (7, 'pj', 'recebida', 'sistema', 14, '07_204', 'GUSTAVO TEIXEIRA MOURA', 'Solteiro(a)',
        null, 'VETERINARIO', 'PET CASA FELIZ', 8800, 'PET CASA FELIZ LTDA', 'LTDA (com sócios)',
        'PET SHOP', '4789-0/04', null),
      (8, 'pj', 'em_preenchimento', 'sistema', 1, '10_115', 'BRINQUEDOTECA SOL', '',
        null, '', '', null, '', '', '', '', null),
      (9, 'pj', 'recebida', 'google_forms', 64, '04_109', 'MARCOS VINICIUS PRADO', 'Solteiro(a)',
        null, 'TECNICO EM ELETRONICA', 'TECH REPAROS', 5400, 'TECH REPAROS CELULARES ME', 'MEI/ME',
        'ASSISTENCIA TECNICA DE CELULARES', '9512-6/00', null),
      (10, 'pf', 'recebida', 'sistema', 5, '01_102', 'JULIANA FREITAS MORAES', 'Casado(a)',
        'ANDRE MORAES CUNHA', 'NUTRICIONISTA', 'CLINICA VIVER BEM', 8700, '', '', '', '', null),
      (11, 'pf', 'recebida', 'sistema', 11, '03_110', 'PEDRO HENRIQUE SALGADO', 'Solteiro(a)',
        null, 'ARQUITETO', 'SALGADO ARQUITETURA', 11200, '', '', '', '', null),
      (12, 'pf', 'usada', 'sistema', 33, '06_120', 'ANA PAULA RIBEIRO COSTA', 'Solteiro(a)',
        null, 'PSICOLOGA', 'CONSULTORIO PROPRIO', 9300, '', '', '', '', null),
      (13, 'pf', 'em_preenchimento', 'sistema', 4, '', 'LUCAS MARTINS DUARTE', 'Solteiro(a)',
        null, '', '', null, '', '', '', '', null),
      (14, 'pf', 'recebida', 'google_forms', 49, '08_133', 'RENATA SIQUEIRA LEAL', 'Divorciado(a)',
        null, 'DENTISTA', 'SORRISO SERRANO', 13500, '', '', '', '', null),
      (15, 'pf', 'usada', 'google_forms', 86, '11_127', 'CLAUDIO BARRETO NUNES', 'Casado(a)',
        'SIMONE NUNES BARRETO', 'ADVOGADO', 'BARRETO ADVOCACIA', 16800, '', '', '', '', null),
      (16, 'pf', 'em_preenchimento', 'sistema', 45, '02_104', 'TATIANE GOMES', '',
        null, '', '', null, '', '', '', '', null),
      (17, 'pf', 'recebida', 'sistema', 20, '', 'VINICIUS ARAUJO PINHEIRO', 'Em união estável / convivente',
        'LETICIA PINHEIRO ARAUJO', 'FOTOGRAFO', 'ESTUDIO LUZ', 7600, '', '', '', '', null),
      (18, 'pf', 'recebida', 'google_forms', 130, '03_110', 'PEDRO HENRIQUE SALGADO', 'Solteiro(a)',
        null, 'ARQUITETO', 'SALGADO ARQUITETURA', 10400, '', '', '', '', null),
      (19, 'fiador', 'recebida', 'sistema', 10, '03_110', 'ROBERTO SALGADO FILHO', 'Casado(a)',
        'ELAINE CRISTINA SALGADO', 'ENGENHEIRO', 'CONSTRUTORA SERRA', 18900, '', '', '', '', 11),
      (20, 'fiador', 'recebida', 'sistema', 39, '05_212', 'HELENA VIANA CAMPOS', 'Viúvo(a)',
        null, 'APOSENTADA', 'INSS', 6200, '', '', '', '', 3),
      (21, 'fiador', 'usada', 'google_forms', 31, '06_120', 'SERGIO MOURA TEIXEIRA', 'Solteiro(a)',
        null, 'CONTADOR', 'MOURA CONTABILIDADE', 12100, '', '', '', '', 12),
      (22, 'fiador', 'em_preenchimento', 'sistema', 6, '01_102', 'DENISE ALVES CORREA', '',
        null, '', '', null, '', '', '', '', 10),
      (23, 'fiador', 'recebida', 'google_forms', 100, '12_140', 'JORGE LUIS PRADO', 'Casado(a)',
        'MARTA REGINA PRADO', 'MEDICO', 'HOSPITAL SERRANO', 21500, '', '', '', '', null),
      (24, 'fiador', 'em_preenchimento', 'sistema', 0, '', 'INDICADO PELO LOCATARIO', '',
        null, '', '', null, '', '', '', '', 17)
    ) as t(n, tipo, situacao, origem, dias, luc, nome, estado_civil, conjuge, profissao, empresa,
           renda, razao, natureza, ramo, cnae, principal)
    order by n
  loop
    v_quando := now() - make_interval(days => r.dias, hours => (r.n * 5) % 9);
    -- A 18 é um envio antigo do Forms da mesma pessoa da 11.
    v_cpf := pg_temp.com_dv(lpad(((case when r.n = 18 then 11 else r.n end * 7654321 + 12345678)
      % 1000000000)::text, 9, '0'), 11);
    v_conj := case when r.conjuge is null then '{}'::jsonb else jsonb_build_object(
      'nome', r.conjuge,
      'cpf', pg_temp.com_dv(lpad(((r.n * 3456789 + 98765432) % 1000000000)::text, 9, '0'), 11),
      'doc_tipo', 'RG', 'doc_numero', lpad(((r.n * 918273) % 100000000)::text, 8, '0') || '-' || (r.n % 10),
      'orgao', 'DETRAN', 'orgao_uf', 'RJ',
      'expedicao', (date '2012-01-01' + r.n * 97)::text,
      'nascimento', (date '1978-01-01' + r.n * 211)::text,
      'nacionalidade', 'BRASILEIRA', 'profissao', 'AUTONOMO(A)',
      'telefone', pg_temp.com_telefone(r.n + 100), 'telefone2', '',
      'email', 'conjuge' || r.n || '@exemplo.test') end;
    v_pessoa := jsonb_build_object(
      'nome', r.nome,
      'cpf', v_cpf,
      'doc_tipo', case when r.n % 4 = 0 then 'CNH' else 'RG' end,
      'doc_numero', lpad(((r.n * 192837) % 100000000)::text, 8, '0') || '-' || ((r.n + 3) % 10),
      'orgao', case when r.n % 4 = 0 then 'DETRAN' else 'IFP' end, 'orgao_uf', 'RJ',
      'expedicao', (date '2010-01-01' + r.n * 113)::text,
      'nascimento', (date '1975-01-01' + r.n * 211)::text,
      'nacionalidade', 'BRASILEIRA',
      'estado_civil', r.estado_civil,
      'endereco', pg_temp.com_endereco(r.n, v_ruas[1 + r.n % 6], v_bairros[1 + (r.n * 5) % 6]),
      'telefone', pg_temp.com_telefone(r.n),
      'telefone2', case when r.n % 5 = 0 then '2225' || lpad(((r.n * 7919) % 1000000)::text, 6, '0') else '' end,
      'email', 'interessado' || r.n || '@exemplo.test',
      'conjuge', v_conj);
    v_emp := case when r.tipo = 'pj' and r.razao <> '' then jsonb_build_object(
      'cnpj', pg_temp.com_dv(lpad(((r.n * 48271 + 1000003) % 100000000)::text, 8, '0') || '0001', 9),
      'razao_social', r.razao,
      'nome_fantasia', regexp_replace(r.razao, ' (LTDA|ME|EIRELI)$', ''),
      'natureza', r.natureza,
      'ie', case when r.n % 2 = 0 then '' else lpad(((r.n * 31337) % 100000000)::text, 8, '0') end,
      'ie_isento', r.n % 2 = 0,
      'im', case when r.n % 3 = 0 then '' else lpad(((r.n * 4242) % 1000000)::text, 6, '0') end,
      'im_nao_tem', r.n % 3 = 0,
      'cnae', r.cnae, 'ramo', r.ramo,
      'endereco', pg_temp.com_endereco(r.n + 50, 'AV. CONSELHEIRO JULIUS ARP', 'CENTRO'),
      'capital_social', (r.n % 5 + 1) * 20000,
      'ultima_alteracao', (date '2019-01-07' + r.n * 61)::text) else '{}'::jsonb end;
    v_renda := case when r.renda is null then '{}'::jsonb else jsonb_build_object(
      'profissao', r.profissao, 'empresa', r.empresa,
      'endereco', pg_temp.com_endereco(r.n + 20, v_ruas[1 + (r.n + 2) % 6], 'CENTRO'),
      'telefone', '2225' || lpad(((r.n * 4513) % 1000000)::text, 6, '0'),
      'email', case when r.n % 2 = 0 then 'contato' || r.n || '@empresa-exemplo.test' else '' end,
      'renda', r.renda,
      'referencia_nome', 'REFERENCIA PESSOAL ' || r.n,
      'referencia_telefone', pg_temp.com_telefone(r.n + 300),
      'outras_rendas', case when r.n % 4 = 1 then 'ALUGUEL DE IMOVEL' else '' end,
      'patrimonio', case when r.n % 3 = 0 then '["Veículos", "Imóvel próprio"]'::jsonb
        when r.n % 3 = 1 then '["Veículos"]'::jsonb else '[]'::jsonb end,
      'paga_aluguel', r.n % 2 = 1,
      'aluguel_nome', case when r.n % 2 = 1 then 'IMOBILIARIA EXEMPLO ' || r.n else '' end,
      'aluguel_telefone', case when r.n % 2 = 1 then '2225' || lpad(((r.n * 1301) % 1000000)::text, 6, '0') else '' end)
      end;
    v_nome := case when r.tipo = 'pj' and r.razao <> '' then r.razao else r.nome end;

    if r.situacao = 'em_preenchimento' then
      -- Links abertos: 8, 16 e 24 sem nada preenchido (a 16 já venceu);
      -- 4, 13 e 22 salvos no meio ("Salvar e continuar depois").
      v_resp := case when r.n in (8, 16, 24) then null else jsonb_build_object(
        'email', 'interessado' || r.n || '@exemplo.test', 'aceite', true,
        'luc', case when r.luc = '' then 'nao_sei' else r.luc end, 'tipo', r.tipo,
        'empresa', v_emp,
        'pessoas', jsonb_build_array(v_pessoa - 'endereco' - 'telefone2' - 'conjuge' - 'expedicao'),
        'renda', '{}'::jsonb, 'assinatura', '') end;
      insert into comercial.fichas (tipo, situacao, luc, nome, origem, gerada_em, expira_em,
          iniciada_em, consentimento_em, ultimo_acesso_em, exemplo, ficha_principal_id)
        values (case when r.n in (8, 16, 24) then null else r.tipo end, 'em_preenchimento',
          nullif(r.luc, ''), v_nome, 'sistema', v_quando, v_quando + interval '30 days',
          case when v_resp is null then null else v_quando + interval '1 hour' end,
          case when v_resp is null then null else v_quando + interval '1 hour' end,
          case when v_resp is null then null else v_quando + interval '1 hour' end, true,
          case when r.principal is not null then v_ids[r.principal] end)
        returning id into v_id;
      if v_resp is not null then
        v_doc := case when r.tipo = 'pj' then v_emp ->> 'cnpj' else v_cpf end;
        insert into comercial.ficha_dados (ficha_id, documento, respostas)
          values (v_id, v_doc, v_resp);
      end if;
    else
      v_resp := jsonb_build_object(
        'email', 'interessado' || r.n || '@exemplo.test', 'aceite', true,
        'luc', case when r.luc = '' then 'nao_sei' else r.luc end, 'tipo', r.tipo,
        'empresa', v_emp, 'pessoas', jsonb_build_array(v_pessoa), 'renda', v_renda,
        -- A 7 assinou com o nome abreviado: o sistema avisou e a pessoa confirmou.
        'assinatura', case when r.n = 7 then 'GUSTAVO T. MOURA' else r.nome end);
      insert into comercial.fichas (tipo, situacao, luc, nome, origem, gerada_em, expira_em,
          iniciada_em, consentimento_em, recebida_em, usada_em, ultimo_acesso_em, exemplo,
          ficha_principal_id)
        values (r.tipo, r.situacao, nullif(r.luc, ''), v_nome, r.origem, v_quando,
          case when r.origem = 'sistema' then v_quando + interval '30 days' end,
          v_quando, v_quando, v_quando + interval '2 hours',
          case when r.situacao = 'usada' then v_quando + interval '5 days' end,
          v_quando + interval '2 hours', true,
          case when r.principal is not null then v_ids[r.principal] end)
        returning id into v_id;
      v_doc := case when r.tipo = 'pj' then v_emp ->> 'cnpj' else v_cpf end;
      insert into comercial.ficha_dados (ficha_id, documento, respostas, assinatura_nome)
        values (v_id, v_doc, v_resp, v_resp ->> 'assinatura');
      -- Documentos só nas fichas do sistema (o Forms não recebia arquivo).
      if r.origem = 'sistema' then
        v_docs := case when r.tipo = 'pj'
          then array['Contrato social e última alteração', 'Cartão CNPJ', 'Identidade e CPF do sócio administrador']
          else array['Identidade e CPF', 'Comprovante de residência', 'Comprovante de renda'] end;
        insert into comercial.ficha_documentos (ficha_id, documento, arquivo_path, arquivo_nome,
            tamanho, tipo_mime, enviado_em)
          select v_id, d, 'fichas/' || v_id || '/exemplo-' || i || '.pdf',
            lower(replace(d, ' ', '-')) || '.pdf', 180000 + i * 23000, 'application/pdf',
            v_quando + make_interval(mins => 20 + i::int)
          from unnest(v_docs) with ordinality as x(d, i);
      end if;
    end if;
    v_ids := v_ids || v_id;
  end loop;
end;
$$;

drop function pg_temp.com_dv(text, int);
drop function pg_temp.com_endereco(int, text, text);
drop function pg_temp.com_telefone(int);
