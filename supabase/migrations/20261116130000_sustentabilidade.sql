-- sustentabilidade: Módulo Sustentabilidade (spec de 13/11/2026).
--
-- Entrevistas de diagnóstico de resíduos, Clube SustentArp, rondas dos
-- coletores, RCC, programas com formulário e indicadores próprios, painel,
-- importações do histórico e parâmetros. Contrato: docs/sustentabilidade.md.
--
-- Regras gerais:
--   * Nada de valor de negócio fixo no código: prazos, limites, listas e
--     fatores ficam em parametros, setor_validades, rcc_fatores e rcc_precos.
--   * Dinheiro sempre em tabela à parte (*_valores), com RLS de
--     sustentabilidade.valores: o RLS libera linhas, não colunas.
--   * E-mail e telefone em tabela à parte (*_contatos), com RLS de
--     sustentabilidade.contato.
--   * Tarefa, prazo e lembrete são do Módulo de Chamados; aqui fica só o
--     chamado_id de cada coisa.
--   * Formulário: o rascunho muda à vontade; a versão publicada é imutável e
--     só nasce por publicar_formulario(). Respostas e lançamentos guardam a
--     versão em que foram feitos.
--   * "Programa – lançar" é uma permissão por programa
--     (sustentabilidade.programa.<id>), criada e apagada por gatilho.
--   * Competência é sempre o primeiro dia do mês (aaaa-mm-01).

create schema sustentabilidade;
grant usage on schema sustentabilidade to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Permissões (mesmo catálogo de src/lib/permissions.ts)
-- ---------------------------------------------------------------------------

insert into core.permissoes (codigo, descricao) values
  ('sustentabilidade.entrevistas.ver', 'Entrevistas – ver: lista de controle e situação da entrevista de cada locatário'),
  ('sustentabilidade.entrevistas.aplicar', 'Entrevistas – aplicar: preencher a entrevista no celular ou tablet, colher a assinatura e salvar'),
  ('sustentabilidade.entrevistas.respostas', 'Entrevistas – ver respostas: abrir as respostas completas e o PDF assinado'),
  ('sustentabilidade.entrevistas.dispensar', 'Entrevistas – dispensar ou corrigir: marcar dispensada (com motivo) e corrigir entrevista já salva'),
  ('sustentabilidade.entrevistas.questionario', 'Entrevistas – editar questionário: perguntas, opções e seções, publicar e restaurar versão'),
  ('sustentabilidade.clube.ver', 'Clube – ver: participantes do Clube SustentArp e situação do termo'),
  ('sustentabilidade.clube.editar', 'Clube – editar: incluir participante, anexar termo, lançar contribuições e ações'),
  ('sustentabilidade.valores', 'Ver valores: reais das contribuições do clube, do RCC e do tour (sem ela, só quantidades)'),
  ('sustentabilidade.ronda', 'Resíduos – lançar ronda: ronda semanal dos coletores'),
  ('sustentabilidade.rcc', 'Resíduos – RCC: lançar a nota mensal e ver toneladas e valor economizado'),
  ('sustentabilidade.programas.gerenciar', 'Programas – gerenciar: criar, ativar e inativar programas, montar formulário, definir indicadores e gerar ou desligar o link do parceiro'),
  ('sustentabilidade.painel', 'Painel de Sustentabilidade: cartões, gráficos e relatório mensal'),
  ('sustentabilidade.importar', 'Importar histórico: enviar as planilhas antigas, ver a prévia e desfazer'),
  ('sustentabilidade.contato', 'Ver contato: e-mail e telefone de locatários e parceiros'),
  ('sustentabilidade.exportar', 'Exportar Excel e PDF nas telas de Sustentabilidade'),
  ('sustentabilidade.parametros', 'Parâmetros de Sustentabilidade: prazos, fatores, limites e marco inicial, com histórico'),
  ('sustentabilidade.formularios.excluir', 'Formulários específicos – excluir pergunta, campo, opção, seção ou formulário sem uso (sem ela, só inativar)');

-- Administrador tem tudo; os outros cargos recebem em Usuários e cargos.
insert into core.cargo_permissoes (cargo_id, permissao)
  select c.id, p.codigo
  from core.cargos c
  join core.permissoes p on p.codigo like 'sustentabilidade.%'
  where c.nome = 'Administrador'
on conflict do nothing;

-- Quem usa alguma tela do módulo (inclui quem só lança num programa).
create function sustentabilidade.acessa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select core.pode_modulo('sustentabilidade');
$$;

-- Tem alguma destas? Os códigos vêm sem o prefixo "sustentabilidade.".
create function sustentabilidade.pode_alguma(variadic p text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from core.minhas_permissoes() m
    where m like 'sustentabilidade.%' and substring(m from 18) = any (p)
  );
$$;

-- Programas em que a pessoa tem "Programa – lançar".
create function sustentabilidade.meus_programas()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select substring(m from 27)::uuid
  from core.minhas_permissoes() m
  where m ~ '^sustentabilidade\.programa\.[0-9a-f-]{36}$';
$$;

-- ---------------------------------------------------------------------------
-- Parâmetros
-- ---------------------------------------------------------------------------

create table sustentabilidade.parametros (
  id boolean primary key default true check (id),
  -- Entrevistas
  meses_primeira_entrevista int not null default 6 check (meses_primeira_entrevista >= 0),
  validade_padrao_meses int not null default 24 check (validade_padrao_meses > 0),
  aviso_dias int not null default 30 check (aviso_dias >= 0),
  tipos_loja_dispensados text[] not null default '{"Área Publicitária"}',
  -- Qual data do contrato conta como inauguração.
  data_inauguracao text not null default 'ativacao' check (data_inauguracao in ('ativacao', 'inicio')),
  motivos_dispensa text[] not null default '{"Contrato temporário","Ativação de marca",Outro}',
  -- Clube
  clube_formas text[] not null default '{Pagante,"Contribui com resíduos","Engajado em ações","Certificado (selo)"}',
  termo_validade_meses int not null default 12 check (termo_validade_meses > 0),
  termo_aviso_dias int not null default 30 check (termo_aviso_dias >= 0),
  formas_contribuicao text[] not null default '{PIX,Dinheiro,Material,Serviço}',
  tipos_acao text[] not null default '{"Entrega de resíduos",Oficina,Evento,Outra}',
  -- Coletores
  limite_ocupacao_pct int not null default 90 check (limite_ocupacao_pct between 1 and 100),
  -- Setor do Chamados que recebe o chamado de recolhimento.
  recolhimento_setor_id uuid references os.setores (id) on delete set null,
  -- RCC
  rcc_empresas text[] not null default '{}',
  -- Programas
  areas_impacto text[] not null default '{Ambiental,Social,Turismo,"Economia local"}',
  grupos_impacto text[] not null default '{"Pessoas impactadas","Volume reciclado",Oficinas,"Produtores locais"}',
  cobranca_dia int not null default 5 check (cobranca_dia between 1 and 28),
  -- Unidades das perguntas "número + unidade".
  unidades text[] not null default '{"saco de 5 L","saco de 50 L","saco de 100 L","saco de 200 L",litros,kg}',
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid() references core.usuarios (id) on delete set null
);
create index parametros_setor on sustentabilidade.parametros (recolhimento_setor_id);
create index parametros_atualizado_por on sustentabilidade.parametros (atualizado_por);
insert into sustentabilidade.parametros (id) values (true);

-- Custos padrão por pessoa do tour (reais): só com sustentabilidade.valores.
create table sustentabilidade.parametros_valores (
  id boolean primary key default true check (id),
  tour_custo_album numeric(14, 2) not null default 2.48 check (tour_custo_album >= 0),
  tour_custo_copo numeric(14, 2) not null default 2.92 check (tour_custo_copo >= 0),
  atualizado_em timestamptz not null default now()
);
insert into sustentabilidade.parametros_valores (id) values (true);

-- Validade da entrevista por setor econômico (o resto usa validade_padrao_meses).
create table sustentabilidade.setor_validades (
  id uuid primary key default gen_random_uuid(),
  setor text not null unique check (btrim(setor) <> ''),
  meses int not null check (meses > 0),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Importações do histórico (4.10)
-- ---------------------------------------------------------------------------

create table sustentabilidade.importacoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('entrevistas', 'atracoes', 'produtores', 'ecocopos', 'quiosque', 'tour')),
  status text not null default 'previa' check (status in ('previa', 'confirmada', 'desfeita', 'substituida')),
  -- { "nome", "caminho", "bytes" }
  arquivo jsonb not null default '{}',
  sha256 text,
  -- O que foi lido (linhas, período, totais), sem reais.
  resumo jsonb not null default '{}',
  -- [{ "nivel": "erro"|"aviso"|"info", "linha"?, "mensagem" }]
  avisos jsonb not null default '[]',
  -- O que a pessoa decidiu na prévia (vínculo de LUC, nomes unidos, motivo).
  decisoes jsonb not null default '{}',
  -- Importação do mesmo arquivo que esta substitui ao ser confirmada.
  substitui uuid references sustentabilidade.importacoes (id) on delete set null,
  criado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  confirmado_por uuid references core.usuarios (id) on delete set null,
  confirmado_em timestamptz,
  desfeito_por uuid references core.usuarios (id) on delete set null,
  desfeito_em timestamptz
);
create index importacoes_tipo on sustentabilidade.importacoes (tipo, criado_em desc);
create index importacoes_sha256 on sustentabilidade.importacoes (sha256);
create index importacoes_substitui on sustentabilidade.importacoes (substitui);
create index importacoes_criado_por on sustentabilidade.importacoes (criado_por);
create index importacoes_confirmado_por on sustentabilidade.importacoes (confirmado_por);
create index importacoes_desfeito_por on sustentabilidade.importacoes (desfeito_por);

-- ---------------------------------------------------------------------------
-- Contratos: cópia de leitura de os.lojas (só a sincronização grava) mais o
-- que é do módulo (ativação corrigida, validade específica, dispensa)
-- ---------------------------------------------------------------------------

create table sustentabilidade.contratos (
  id uuid primary key default gen_random_uuid(),
  -- Null nos contratos de exemplo.
  loja_id uuid unique references os.lojas (id) on delete set null,
  contrato text,
  cliente_nome text not null check (btrim(cliente_nome) <> ''),
  -- CPF ou CNPJ, só dígitos.
  cliente_doc text check (cliente_doc ~ '^\d*$'),
  lucs text[] not null default '{}',
  bloco text,
  tipo_loja text,
  ramo text,
  ativacao date,
  inicio date,
  rescisao date,
  situacao text not null default 'vigente' check (situacao in ('vigente', 'encerrado')),
  sincronizado_em timestamptz,
  -- Do módulo
  ativacao_corrigida date,
  ativacao_corrigida_por uuid references core.usuarios (id) on delete set null,
  ativacao_corrigida_em timestamptz,
  ativacao_corrigida_motivo text check (length(ativacao_corrigida_motivo) <= 500),
  validade_meses_especifica int check (validade_meses_especifica > 0),
  dispensada_em timestamptz,
  dispensada_por uuid references core.usuarios (id) on delete set null,
  dispensada_motivo text check (length(dispensada_motivo) <= 500),
  -- Chamado "Entrevista de resíduos" aberto para este contrato.
  chamado_id uuid references os.chamados (id) on delete set null,
  exemplo boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check ((dispensada_em is null) = (dispensada_motivo is null)),
  check (ativacao_corrigida is null or ativacao_corrigida_motivo is not null)
);
create index contratos_cliente_doc on sustentabilidade.contratos (cliente_doc);
create index contratos_situacao on sustentabilidade.contratos (situacao, tipo_loja);
create index contratos_bloco on sustentabilidade.contratos (bloco);
create index contratos_chamado on sustentabilidade.contratos (chamado_id);
create index contratos_corrigida_por on sustentabilidade.contratos (ativacao_corrigida_por);
create index contratos_dispensada_por on sustentabilidade.contratos (dispensada_por);

-- Quem e quando da correção e da dispensa saem daqui, não da tela.
create function sustentabilidade.contratos_marcar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ativacao_corrigida is distinct from old.ativacao_corrigida then
    if new.ativacao_corrigida is null then
      new.ativacao_corrigida_por := null;
      new.ativacao_corrigida_em := null;
      new.ativacao_corrigida_motivo := null;
    else
      new.ativacao_corrigida_por := (select auth.uid());
      new.ativacao_corrigida_em := now();
    end if;
  end if;
  if new.dispensada_motivo is distinct from old.dispensada_motivo then
    if new.dispensada_motivo is null then
      new.dispensada_por := null;
      new.dispensada_em := null;
    else
      new.dispensada_por := (select auth.uid());
      new.dispensada_em := coalesce(old.dispensada_em, now());
    end if;
  end if;
  return new;
end;
$$;
create trigger marcar before update on sustentabilidade.contratos
  for each row execute function sustentabilidade.contratos_marcar();

-- ---------------------------------------------------------------------------
-- Programas (4.8)
-- ---------------------------------------------------------------------------

create table sustentabilidade.programas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) between 1 and 120),
  descricao text,
  area text,
  parceiro_nome text,
  parceiro_doc text check (parceiro_doc ~ '^\d*$'),
  inicio date,
  fim date,
  frequencia text not null default 'mensal' check (frequencia in ('mensal', 'evento')),
  ativo boolean not null default true,
  exemplo boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (fim is null or inicio is null or fim >= inicio)
);
create unique index programas_nome on sustentabilidade.programas (lower(btrim(nome)));
create index programas_ativo on sustentabilidade.programas (ativo, nome);

-- Contato do parceiro: só com sustentabilidade.contato.
create table sustentabilidade.programa_contatos (
  programa_id uuid primary key references sustentabilidade.programas (id) on delete cascade,
  email text,
  telefone text,
  contato text,
  atualizado_em timestamptz not null default now()
);

-- "Programa – lançar": uma permissão por programa, que acompanha o programa.
create function sustentabilidade.programa_permissao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from core.permissoes where codigo = 'sustentabilidade.programa.' || old.id;
    return old;
  end if;
  if tg_op = 'INSERT' then
    insert into core.permissoes (codigo, descricao)
      values ('sustentabilidade.programa.' || new.id, 'Programa – lançar: ' || new.nome);
    insert into core.cargo_permissoes (cargo_id, permissao)
      select c.id, 'sustentabilidade.programa.' || new.id
      from core.cargos c where c.nome = 'Administrador'
    on conflict do nothing;
  elsif new.nome is distinct from old.nome then
    update core.permissoes set descricao = 'Programa – lançar: ' || new.nome
      where codigo = 'sustentabilidade.programa.' || new.id;
  end if;
  return new;
end;
$$;
create trigger permissao after insert or update of nome or delete on sustentabilidade.programas
  for each row execute function sustentabilidade.programa_permissao();

-- ---------------------------------------------------------------------------
-- Formulários (4.13): questionário da entrevista e formulários dos programas
-- ---------------------------------------------------------------------------

create table sustentabilidade.formularios (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('questionario', 'programa')),
  programa_id uuid references sustentabilidade.programas (id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 1 and 120),
  ativo boolean not null default true,
  -- 0 = nunca publicado.
  versao_publicada int not null default 0 check (versao_publicada >= 0),
  -- DefinicaoFormulario (src/lib/sustentabilidade/formulario/tipos.ts).
  rascunho jsonb not null default '{"secoes": []}' check (jsonb_typeof(rascunho -> 'secoes') = 'array'),
  rascunho_alterado boolean not null default false,
  exemplo boolean not null default false,
  criado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check ((tipo = 'questionario') = (programa_id is null))
);
-- Um questionário só.
create unique index formularios_questionario on sustentabilidade.formularios (tipo) where tipo = 'questionario';
create index formularios_programa on sustentabilidade.formularios (programa_id);
create index formularios_criado_por on sustentabilidade.formularios (criado_por);

create table sustentabilidade.formulario_versoes (
  formulario_id uuid not null references sustentabilidade.formularios (id) on delete cascade,
  versao int not null check (versao > 0),
  definicao jsonb not null check (jsonb_typeof(definicao -> 'secoes') = 'array'),
  resumo text not null check (length(btrim(resumo)) between 1 and 500),
  publicado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  publicado_em timestamptz not null default now(),
  primary key (formulario_id, versao)
);
create index formulario_versoes_publicado_por on sustentabilidade.formulario_versoes (publicado_por);

-- Versão publicada não muda nem some (nem pela service role). Só sai junto
-- com o formulário inteiro, que por sua vez não sai se tiver lançamento.
create function sustentabilidade.versao_imutavel()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    -- "on delete set null" de quem publicou é a única mudança aceita.
    if new.formulario_id = old.formulario_id and new.versao = old.versao
       and new.definicao = old.definicao and new.resumo = old.resumo
       and new.publicado_em = old.publicado_em and new.publicado_por is null then
      return new;
    end if;
    raise exception 'versão publicada não pode ser alterada' using errcode = '42501';
  end if;
  if exists (select 1 from sustentabilidade.formularios f where f.id = old.formulario_id) then
    raise exception 'versão publicada não pode ser apagada' using errcode = '42501';
  end if;
  return old;
end;
$$;
create trigger imutavel before update or delete on sustentabilidade.formulario_versoes
  for each row execute function sustentabilidade.versao_imutavel();

-- "Alterações do rascunho": quando, quem e o que mudou.
create table sustentabilidade.formulario_alteracoes (
  id uuid primary key default gen_random_uuid(),
  formulario_id uuid not null references sustentabilidade.formularios (id) on delete cascade,
  quando timestamptz not null default now(),
  quem uuid default auth.uid() references core.usuarios (id) on delete set null,
  descricao text not null check (length(btrim(descricao)) between 1 and 500),
  antes jsonb,
  depois jsonb
);
create index formulario_alteracoes_formulario on sustentabilidade.formulario_alteracoes (formulario_id, quando desc);
create index formulario_alteracoes_quem on sustentabilidade.formulario_alteracoes (quem);

-- ---------------------------------------------------------------------------
-- Entrevistas (4.4)
-- ---------------------------------------------------------------------------

create table sustentabilidade.entrevistas (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references sustentabilidade.contratos (id) on delete restrict,
  lucs text[] not null default '{}',
  cliente_doc text,
  data date not null,
  tipo text not null default 'primeira' check (tipo in ('primeira', 'atualizacao')),
  -- Setor econômico (pergunta 3): define a validade.
  setor text,
  formulario_versao int not null check (formulario_versao > 0),
  -- { pergunta_id: valor }
  respostas jsonb not null default '{}' check (jsonb_typeof(respostas) = 'object'),
  situacao text not null default 'rascunho' check (situacao in ('rascunho', 'salva')),
  -- Idempotência do envio offline: o mesmo rascunho não entra duas vezes.
  rascunho_chave uuid unique,
  respondente_nome text,
  -- Caminhos em src/server/arquivos.
  assinatura_respondente text,
  assinatura_entrevistador text,
  pdf text,
  -- [{ "nome", "caminho" }]
  anexos jsonb not null default '[]',
  origem text not null default 'sistema' check (origem in ('sistema', 'forms', 'papel')),
  entrevistador_id uuid default auth.uid() references core.usuarios (id) on delete set null,
  chamado_id uuid references os.chamados (id) on delete set null,
  valida_ate date,
  importacao_id uuid references sustentabilidade.importacoes (id) on delete set null,
  exemplo boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index entrevistas_contrato on sustentabilidade.entrevistas (contrato_id, data desc);
create index entrevistas_data on sustentabilidade.entrevistas (data desc);
create index entrevistas_cliente_doc on sustentabilidade.entrevistas (cliente_doc);
create index entrevistas_entrevistador on sustentabilidade.entrevistas (entrevistador_id);
create index entrevistas_chamado on sustentabilidade.entrevistas (chamado_id);
create index entrevistas_importacao on sustentabilidade.entrevistas (importacao_id);
create index entrevistas_valida_ate on sustentabilidade.entrevistas (valida_ate) where situacao = 'salva';
-- A mesma entrevista (contrato e data) não entra duas vezes.
create unique index entrevistas_unica on sustentabilidade.entrevistas (contrato_id, data) where situacao = 'salva';

create table sustentabilidade.entrevista_transferencias (
  id uuid primary key default gen_random_uuid(),
  entrevista_id uuid not null references sustentabilidade.entrevistas (id) on delete cascade,
  de_contrato_id uuid not null references sustentabilidade.contratos (id) on delete restrict,
  para_contrato_id uuid not null references sustentabilidade.contratos (id) on delete restrict,
  motivo text not null check (length(btrim(motivo)) between 3 and 500),
  quem uuid default auth.uid() references core.usuarios (id) on delete set null,
  quando timestamptz not null default now(),
  check (de_contrato_id <> para_contrato_id)
);
create index entrevista_transferencias_entrevista on sustentabilidade.entrevista_transferencias (entrevista_id);
create index entrevista_transferencias_de on sustentabilidade.entrevista_transferencias (de_contrato_id);
create index entrevista_transferencias_para on sustentabilidade.entrevista_transferencias (para_contrato_id);
create index entrevista_transferencias_quem on sustentabilidade.entrevista_transferencias (quem);

-- ---------------------------------------------------------------------------
-- Clube SustentArp (4.5): por cliente (CPF ou CNPJ), não por LUC
-- ---------------------------------------------------------------------------

create table sustentabilidade.participantes (
  id uuid primary key default gen_random_uuid(),
  cliente_doc text not null unique check (cliente_doc ~ '^\d{11}$|^\d{14}$'),
  nome text not null check (length(btrim(nome)) between 1 and 200),
  -- Cadastrado à mão: parceiro externo, "Não locatário".
  locatario_manual boolean not null default false,
  formas text[] not null default '{}',
  saiu_em date,
  saiu_motivo text check (length(saiu_motivo) <= 500),
  -- Interesse registrado pela entrevista (pergunta 13), ainda sem termo.
  interesse boolean not null default false,
  exemplo boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (saiu_em is null or saiu_motivo is not null)
);
create index participantes_nome on sustentabilidade.participantes (nome);

create table sustentabilidade.participante_contatos (
  participante_id uuid primary key references sustentabilidade.participantes (id) on delete cascade,
  email text,
  telefone text,
  contato text,
  atualizado_em timestamptz not null default now()
);

create table sustentabilidade.participante_valores (
  participante_id uuid primary key references sustentabilidade.participantes (id) on delete cascade,
  valor_combinado_mes numeric(14, 2) not null check (valor_combinado_mes >= 0),
  atualizado_em timestamptz not null default now()
);

create table sustentabilidade.termos (
  id uuid primary key default gen_random_uuid(),
  participante_id uuid not null references sustentabilidade.participantes (id) on delete cascade,
  ano int not null check (ano between 2000 and 2100),
  assinado_em date not null,
  valido_ate date not null,
  -- Caminhos em src/server/arquivos: o termo anexado ou gerado e a assinatura na tela.
  arquivo text,
  assinatura text,
  -- Chamado "Renovar termo do Clube".
  chamado_id uuid references os.chamados (id) on delete set null,
  criado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  unique (participante_id, ano),
  check (valido_ate >= assinado_em)
);
create index termos_valido_ate on sustentabilidade.termos (valido_ate);
create index termos_chamado on sustentabilidade.termos (chamado_id);
create index termos_criado_por on sustentabilidade.termos (criado_por);

create table sustentabilidade.contribuicoes (
  id uuid primary key default gen_random_uuid(),
  participante_id uuid not null references sustentabilidade.participantes (id) on delete cascade,
  data date not null,
  forma text not null check (btrim(forma) <> ''),
  competencia date not null check (extract(day from competencia) = 1),
  observacao text check (length(observacao) <= 1000),
  criado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index contribuicoes_participante on sustentabilidade.contribuicoes (participante_id, data desc);
create index contribuicoes_competencia on sustentabilidade.contribuicoes (competencia);
create index contribuicoes_criado_por on sustentabilidade.contribuicoes (criado_por);

-- Valor da contribuição (pode ser zero): só com sustentabilidade.valores.
create table sustentabilidade.contribuicao_valores (
  contribuicao_id uuid primary key references sustentabilidade.contribuicoes (id) on delete cascade,
  valor numeric(14, 2) not null check (valor >= 0)
);

create table sustentabilidade.acoes (
  id uuid primary key default gen_random_uuid(),
  participante_id uuid not null references sustentabilidade.participantes (id) on delete cascade,
  data date not null,
  tipo text not null check (btrim(tipo) <> ''),
  observacao text check (length(observacao) <= 1000),
  criado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index acoes_participante on sustentabilidade.acoes (participante_id, data desc);
create index acoes_data on sustentabilidade.acoes (data);
create index acoes_criado_por on sustentabilidade.acoes (criado_por);

-- ---------------------------------------------------------------------------
-- Coletores e rondas (4.6)
-- ---------------------------------------------------------------------------

create table sustentabilidade.coletores (
  id uuid primary key default gen_random_uuid(),
  local text not null check (length(btrim(local)) between 1 and 120),
  -- preto = não reciclável; azul = reciclável.
  cor text not null check (cor in ('preto', 'azul')),
  conteineres int not null default 1 check (conteineres > 0),
  -- Litros de cada contêiner. Null = a confirmar.
  capacidade_l numeric(10, 2) check (capacidade_l > 0),
  ativo boolean not null default true,
  ordem int not null default 0,
  exemplo boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index coletores_ordem on sustentabilidade.coletores (ativo, ordem);

create table sustentabilidade.rondas (
  id uuid primary key default gen_random_uuid(),
  data_hora timestamptz not null default now(),
  chamado_id uuid references os.chamados (id) on delete set null,
  observacao text check (length(observacao) <= 1000),
  foto text,
  lancado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  exemplo boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index rondas_data on sustentabilidade.rondas (data_hora desc);
create index rondas_chamado on sustentabilidade.rondas (chamado_id);
create index rondas_lancado_por on sustentabilidade.rondas (lancado_por);

-- Coletor não visitado = sem linha (nunca zero).
create table sustentabilidade.ronda_itens (
  id uuid primary key default gen_random_uuid(),
  ronda_id uuid not null references sustentabilidade.rondas (id) on delete cascade,
  coletor_id uuid not null references sustentabilidade.coletores (id) on delete restrict,
  conteineres int not null check (conteineres >= 0),
  ocupacao_pct int not null check (ocupacao_pct between 0 and 100 and ocupacao_pct % 10 = 0),
  observacao text check (length(observacao) <= 1000),
  foto text,
  unique (ronda_id, coletor_id)
);
create index ronda_itens_coletor on sustentabilidade.ronda_itens (coletor_id);

-- ---------------------------------------------------------------------------
-- RCC (4.7)
-- ---------------------------------------------------------------------------

-- Fatores com vigência: a nota usa o fator vigente na competência dela.
create table sustentabilidade.rcc_fatores (
  id uuid primary key default gen_random_uuid(),
  vigente_desde date not null unique,
  toneladas_por_cacamba numeric(8, 3) not null check (toneladas_por_cacamba > 0),
  volume_m3 numeric(8, 3) not null check (volume_m3 > 0),
  criado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index rcc_fatores_criado_por on sustentabilidade.rcc_fatores (criado_por);
insert into sustentabilidade.rcc_fatores (vigente_desde, toneladas_por_cacamba, volume_m3)
  values ('2000-01-01', 8, 5);

-- Preço da caçamba por classe (reais): só com sustentabilidade.valores.
create table sustentabilidade.rcc_precos (
  id uuid primary key default gen_random_uuid(),
  vigente_desde date not null unique,
  preco_a numeric(14, 2) not null check (preco_a >= 0),
  preco_b numeric(14, 2) not null check (preco_b >= 0),
  exemplo boolean not null default false,
  criado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index rcc_precos_criado_por on sustentabilidade.rcc_precos (criado_por);

create table sustentabilidade.rcc_notas (
  id uuid primary key default gen_random_uuid(),
  competencia date not null check (extract(day from competencia) = 1),
  empresa text not null check (btrim(empresa) <> ''),
  numero text not null check (btrim(numero) <> ''),
  -- PDF da nota (obrigatório), caminho em src/server/arquivos.
  pdf text not null check (btrim(pdf) <> ''),
  cacambas_a int not null default 0 check (cacambas_a >= 0),
  cacambas_b int not null default 0 check (cacambas_b >= 0),
  chamado_id uuid references os.chamados (id) on delete set null,
  lancado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  exemplo boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (cacambas_a + cacambas_b > 0)
);
create index rcc_notas_competencia on sustentabilidade.rcc_notas (competencia desc);
create index rcc_notas_empresa on sustentabilidade.rcc_notas (empresa);
create index rcc_notas_chamado on sustentabilidade.rcc_notas (chamado_id);
create index rcc_notas_lancado_por on sustentabilidade.rcc_notas (lancado_por);

create table sustentabilidade.rcc_nota_valores (
  nota_id uuid primary key references sustentabilidade.rcc_notas (id) on delete cascade,
  valor_total numeric(14, 2) not null check (valor_total >= 0)
);

-- ---------------------------------------------------------------------------
-- Programas: indicadores, link do parceiro, lançamentos e listas de cadastro
-- ---------------------------------------------------------------------------

create table sustentabilidade.programa_indicadores (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references sustentabilidade.programas (id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 1 and 120),
  formulario_id uuid not null references sustentabilidade.formularios (id) on delete restrict,
  -- Null na contagem de lançamentos.
  campo_id text,
  calculo text not null check (calculo in ('soma', 'contagem', 'contagem_distintos', 'media', 'percentual')),
  -- { "campo_id", "valor" } ou null.
  filtro jsonb check (filtro is null or (filtro ? 'campo_id' and filtro ? 'valor')),
  -- Resposta contada no percentual.
  percentual_valor text,
  unidade text,
  -- Grupo de impacto do painel (parametros.grupos_impacto). Null = nenhum.
  grupo text,
  mostrar_painel boolean not null default false,
  -- Indicador em reais: só aparece com sustentabilidade.valores.
  em_reais boolean not null default false,
  ativo boolean not null default true,
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (calculo = 'contagem' or campo_id is not null),
  check (calculo <> 'percentual' or percentual_valor is not null)
);
create index programa_indicadores_programa on sustentabilidade.programa_indicadores (programa_id, ordem);
create index programa_indicadores_formulario on sustentabilidade.programa_indicadores (formulario_id);
create index programa_indicadores_grupo on sustentabilidade.programa_indicadores (grupo) where mostrar_painel;

-- Link do parceiro: o token só existe em hash (sha256). A página
-- /parceiro/[token] lê pelo servidor (service role); ninguém lê daqui o token.
create table sustentabilidade.programa_links (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references sustentabilidade.programas (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  criado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  desligado_em timestamptz,
  desligado_por uuid references core.usuarios (id) on delete set null,
  ultimo_acesso_em timestamptz
);
-- Um link ativo por programa.
create unique index programa_links_ativo on sustentabilidade.programa_links (programa_id) where desligado_em is null;
create index programa_links_programa on sustentabilidade.programa_links (programa_id);
create index programa_links_criado_por on sustentabilidade.programa_links (criado_por);
create index programa_links_desligado_por on sustentabilidade.programa_links (desligado_por);

create table sustentabilidade.lancamentos (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references sustentabilidade.programas (id) on delete restrict,
  formulario_id uuid not null,
  formulario_versao int not null,
  -- Data do fato (não a do lançamento).
  data date not null,
  -- { campo_id: valor }. Campos do tipo "reais" ficam em lancamento_valores.
  valores jsonb not null default '{}' check (jsonb_typeof(valores) = 'object'),
  origem text not null default 'equipe' check (origem in ('equipe', 'link', 'importacao')),
  link_id uuid references sustentabilidade.programa_links (id) on delete set null,
  lancado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  importacao_id uuid references sustentabilidade.importacoes (id) on delete set null,
  exemplo boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (formulario_id, formulario_versao)
    references sustentabilidade.formulario_versoes (formulario_id, versao) on delete restrict,
  check (link_id is null or origem = 'link')
);
create index lancamentos_programa on sustentabilidade.lancamentos (programa_id, data desc);
create index lancamentos_formulario on sustentabilidade.lancamentos (formulario_id, formulario_versao);
create index lancamentos_data on sustentabilidade.lancamentos (data);
create index lancamentos_link on sustentabilidade.lancamentos (link_id);
create index lancamentos_lancado_por on sustentabilidade.lancamentos (lancado_por);
create index lancamentos_importacao on sustentabilidade.lancamentos (importacao_id);

-- O formulário do lançamento é do mesmo programa.
create function sustentabilidade.lancamento_do_programa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from sustentabilidade.formularios f
    where f.id = new.formulario_id and f.programa_id = new.programa_id
  ) then
    raise exception 'o formulário não é deste programa' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger do_programa before insert or update of programa_id, formulario_id on sustentabilidade.lancamentos
  for each row execute function sustentabilidade.lancamento_do_programa();

-- Campos em reais do lançamento ({ campo_id: número }): só com sustentabilidade.valores.
create table sustentabilidade.lancamento_valores (
  lancamento_id uuid primary key references sustentabilidade.lancamentos (id) on delete cascade,
  valores jsonb not null default '{}' check (jsonb_typeof(valores) = 'object')
);

-- "Lista de cadastro": lista que cresce com o uso (ex.: produtores da feira).
create table sustentabilidade.cadastros_lista (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references sustentabilidade.programas (id) on delete cascade,
  campo_id text not null,
  valor text not null check (length(btrim(valor)) between 1 and 200),
  -- Sem acento, minúsculo e sem espaço sobrando: evita o mesmo nome duas vezes.
  normalizado text not null check (btrim(normalizado) <> ''),
  importacao_id uuid references sustentabilidade.importacoes (id) on delete set null,
  criado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  unique (programa_id, campo_id, normalizado)
);
create index cadastros_lista_importacao on sustentabilidade.cadastros_lista (importacao_id);
create index cadastros_lista_criado_por on sustentabilidade.cadastros_lista (criado_por);

-- ---------------------------------------------------------------------------
-- Painel: marco inicial, equivalências e consolidado anual (4.9 e 4.11)
-- ---------------------------------------------------------------------------

-- Total consolidado por ano do que não dá para importar linha a linha.
create table sustentabilidade.marcos (
  indicador text not null check (indicador ~ '^[a-z0-9_]+$'),
  ano int not null check (ano between 2000 and 2100),
  valor numeric not null,
  exemplo boolean not null default false,
  atualizado_em timestamptz not null default now(),
  primary key (indicador, ano)
);

create table sustentabilidade.equivalencias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (btrim(nome) <> ''),
  fator numeric not null check (fator > 0),
  unidade text,
  -- Só aparece no painel depois de confirmada com a área.
  confirmado boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- "Fechar ano": os totais ficam gravados e não mudam até alguém reabrir.
create table sustentabilidade.consolidados (
  ano int primary key check (ano between 2000 and 2100),
  -- { indicador: número }, sem reais (ver consolidado_valores).
  totais jsonb not null default '{}' check (jsonb_typeof(totais) = 'object'),
  situacao text not null default 'fechado' check (situacao in ('fechado', 'reaberto')),
  fechado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  fechado_em timestamptz not null default now(),
  reaberto_por uuid references core.usuarios (id) on delete set null,
  reaberto_em timestamptz,
  reaberto_motivo text check (length(reaberto_motivo) <= 500),
  check (situacao <> 'reaberto' or (reaberto_em is not null and reaberto_motivo is not null))
);
create index consolidados_fechado_por on sustentabilidade.consolidados (fechado_por);
create index consolidados_reaberto_por on sustentabilidade.consolidados (reaberto_por);

-- Totais em reais do ano fechado: só com sustentabilidade.valores.
create table sustentabilidade.consolidado_valores (
  ano int primary key references sustentabilidade.consolidados (ano) on delete cascade,
  totais jsonb not null default '{}' check (jsonb_typeof(totais) = 'object')
);

-- ---------------------------------------------------------------------------
-- Gatilhos
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'parametros', 'parametros_valores', 'setor_validades', 'contratos', 'programas',
    'programa_contatos', 'formularios', 'entrevistas', 'participantes',
    'participante_contatos', 'participante_valores', 'coletores', 'rondas', 'rcc_notas',
    'programa_indicadores', 'lancamentos', 'marcos', 'equivalencias'
  ] loop
    execute format(
      'create trigger atualizado_em before update on sustentabilidade.%I
         for each row execute function core.set_atualizado_em()', t);
  end loop;
end $$;

-- Auditoria (antes e depois) de tudo que é editável.
do $$
declare t text;
begin
  foreach t in array array[
    'setor_validades', 'participantes', 'termos', 'contribuicoes', 'acoes', 'coletores',
    'rcc_fatores', 'rcc_precos', 'rcc_notas', 'programas', 'programa_indicadores',
    'programa_links', 'equivalencias'
  ] loop
    execute format(
      'create trigger auditoria after insert or update or delete on sustentabilidade.%I
         for each row execute function core.auditar(''id'')', t);
  end loop;
end $$;
create trigger auditoria after insert or update or delete on sustentabilidade.parametros
  for each row execute function core.auditar('id');
create trigger auditoria after insert or update or delete on sustentabilidade.parametros_valores
  for each row execute function core.auditar('id');
create trigger auditoria after insert or update or delete on sustentabilidade.participante_contatos
  for each row execute function core.auditar('participante_id');
create trigger auditoria after insert or update or delete on sustentabilidade.participante_valores
  for each row execute function core.auditar('participante_id');
create trigger auditoria after insert or update or delete on sustentabilidade.contribuicao_valores
  for each row execute function core.auditar('contribuicao_id');
create trigger auditoria after insert or update or delete on sustentabilidade.rcc_nota_valores
  for each row execute function core.auditar('nota_id');
create trigger auditoria after insert or update or delete on sustentabilidade.programa_contatos
  for each row execute function core.auditar('programa_id');
create trigger auditoria after insert or update or delete on sustentabilidade.marcos
  for each row execute function core.auditar('indicador', 'ano');
create trigger auditoria after insert or update or delete on sustentabilidade.consolidados
  for each row execute function core.auditar('ano');
create trigger auditoria after insert or update or delete on sustentabilidade.consolidado_valores
  for each row execute function core.auditar('ano');
create trigger auditoria after insert on sustentabilidade.formulario_versoes
  for each row execute function core.auditar('formulario_id', 'versao');
create trigger auditoria after update on sustentabilidade.importacoes
  for each row execute function core.auditar('id');
-- Contratos: só o que é do módulo (a sincronização não enche o histórico).
create trigger auditoria after update of ativacao_corrigida, ativacao_corrigida_motivo,
    validade_meses_especifica, dispensada_motivo on sustentabilidade.contratos
  for each row execute function core.auditar('id');
-- Formulários: o rascunho tem o log próprio (formulario_alteracoes).
create trigger auditoria after insert or delete or update of nome, ativo, versao_publicada
    on sustentabilidade.formularios
  for each row execute function core.auditar('id');
-- Entrevista: o rascunho é salvo a cada resposta; o histórico guarda a
-- hora em que ela foi salva e toda correção depois disso.
create trigger auditoria after update on sustentabilidade.entrevistas
  for each row when (old.situacao = 'salva' or new.situacao = 'salva')
  execute function core.auditar('id');
create trigger auditoria_exclusao after delete on sustentabilidade.entrevistas
  for each row when (old.situacao = 'salva')
  execute function core.auditar('id');
-- Lançamentos e rondas: correção e exclusão (o que muda um mês já visto).
create trigger auditoria after update or delete on sustentabilidade.lancamentos
  for each row execute function core.auditar('id');
create trigger auditoria after update or delete on sustentabilidade.lancamento_valores
  for each row execute function core.auditar('lancamento_id');
create trigger auditoria after update or delete on sustentabilidade.rondas
  for each row execute function core.auditar('id');
create trigger auditoria after update or delete on sustentabilidade.ronda_itens
  for each row execute function core.auditar('id');

-- ---------------------------------------------------------------------------
-- Formulários: uso, publicação
-- ---------------------------------------------------------------------------

-- Perguntas e opções de uma definição. A linha da pergunta tem opcao_id null.
create function sustentabilidade.itens_da_definicao(p_definicao jsonb)
returns table (pergunta_id text, opcao_id text)
language sql
immutable
set search_path = ''
as $$
  select p ->> 'id', null::text
  from jsonb_array_elements(p_definicao -> 'secoes') s,
       jsonb_array_elements(s -> 'perguntas') p
  union all
  select p ->> 'id', o ->> 'id'
  from jsonb_array_elements(p_definicao -> 'secoes') s,
       jsonb_array_elements(s -> 'perguntas') p,
       jsonb_array_elements(p -> 'opcoes') o;
$$;

-- Quantas respostas (entrevistas salvas) ou lançamentos usaram cada pergunta
-- e cada opção, somando todas as versões. Linha com opcao_id null = a pergunta.
create function sustentabilidade.uso_do_formulario(p_id uuid)
returns table (pergunta_id text, opcao_id text, usos bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with f as (
    select id, tipo, rascunho from sustentabilidade.formularios
    where id = p_id and (select sustentabilidade.acessa())
  ),
  itens as (
    select distinct i.pergunta_id, i.opcao_id
    from (
      select rascunho as d from f
      union all
      select v.definicao from sustentabilidade.formulario_versoes v join f on f.id = v.formulario_id
    ) d, sustentabilidade.itens_da_definicao(d.d) i
    where i.pergunta_id is not null
  ),
  respostas as (
    select e.respostas as r
    from sustentabilidade.entrevistas e, f
    where f.tipo = 'questionario' and e.situacao = 'salva'
    union all
    select l.valores || coalesce(lv.valores, '{}'::jsonb)
    from sustentabilidade.lancamentos l
    join f on f.id = l.formulario_id
    left join sustentabilidade.lancamento_valores lv on lv.lancamento_id = l.id
  )
  select i.pergunta_id, i.opcao_id,
    (select count(*) from respostas x
     where case
       when i.opcao_id is null then
         coalesce(x.r -> i.pergunta_id, 'null'::jsonb) not in ('null'::jsonb, '""'::jsonb, '[]'::jsonb, '{}'::jsonb)
       else case jsonb_typeof(x.r -> i.pergunta_id)
         when 'string' then x.r ->> i.pergunta_id = i.opcao_id
         when 'array' then (x.r -> i.pergunta_id) ? i.opcao_id
         when 'object' then (x.r -> i.pergunta_id) ? i.opcao_id
         else false
       end
     end)
  from itens i;
$$;

-- Publica o rascunho como versão N + 1 (imutável).
-- Recusa: tirar do rascunho pergunta ou opção que já tem resposta ou
-- lançamento em qualquer versão (só inativar); tirar campo usado por
-- indicador; e, sem "Formulários específicos – excluir", tirar qualquer
-- pergunta ou opção que estava na versão publicada.
create function sustentabilidade.publicar_formulario(p_id uuid, p_resumo text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  f sustentabilidade.formularios;
  v_lista text;
  v_versao int;
begin
  select * into f from sustentabilidade.formularios where id = p_id for update;
  if not found then
    raise exception 'formulário não encontrado' using errcode = 'P0001';
  end if;
  if not core.pode(case f.tipo
      when 'questionario' then 'sustentabilidade.entrevistas.questionario'
      else 'sustentabilidade.programas.gerenciar' end) then
    raise exception 'sem permissão para publicar este formulário' using errcode = '42501';
  end if;
  if coalesce(btrim(p_resumo), '') = '' then
    raise exception 'informe o resumo da versão' using errcode = '22023';
  end if;

  select string_agg(u.pergunta_id || coalesce(' (opção ' || u.opcao_id || ')', ''), ', '
           order by u.pergunta_id, u.opcao_id nulls first)
    into v_lista
  from sustentabilidade.uso_do_formulario(p_id) u
  where u.usos > 0 and not exists (
    select 1 from sustentabilidade.itens_da_definicao(f.rascunho) i
    where i.pergunta_id = u.pergunta_id and i.opcao_id is not distinct from u.opcao_id);
  if v_lista is not null then
    raise exception 'já tem respostas ou lançamentos e só pode ser inativado: %', v_lista
      using errcode = '23503';
  end if;

  select string_agg(distinct pi.campo_id, ', ') into v_lista
  from sustentabilidade.programa_indicadores pi
  where pi.formulario_id = p_id and pi.campo_id is not null and not exists (
    select 1 from sustentabilidade.itens_da_definicao(f.rascunho) i
    where i.pergunta_id = pi.campo_id);
  if v_lista is not null then
    raise exception 'campo usado por indicador só pode ser inativado: %', v_lista
      using errcode = '23503';
  end if;

  if f.versao_publicada > 0 and not core.pode('sustentabilidade.formularios.excluir') then
    select string_agg(a.pergunta_id || coalesce(' (opção ' || a.opcao_id || ')', ''), ', '
             order by a.pergunta_id, a.opcao_id nulls first)
      into v_lista
    from sustentabilidade.formulario_versoes v,
         sustentabilidade.itens_da_definicao(v.definicao) a
    where v.formulario_id = p_id and v.versao = f.versao_publicada and not exists (
      select 1 from sustentabilidade.itens_da_definicao(f.rascunho) i
      where i.pergunta_id = a.pergunta_id and i.opcao_id is not distinct from a.opcao_id);
    if v_lista is not null then
      raise exception 'excluir pergunta ou opção exige a permissão de excluir (sem ela, só inativar): %', v_lista
        using errcode = '42501';
    end if;
  end if;

  v_versao := f.versao_publicada + 1;
  insert into sustentabilidade.formulario_versoes (formulario_id, versao, definicao, resumo, publicado_por)
    values (p_id, v_versao, f.rascunho, btrim(p_resumo), (select auth.uid()));
  update sustentabilidade.formularios
    set versao_publicada = v_versao, rascunho_alterado = false
    where id = p_id;
  return v_versao;
end;
$$;

-- ---------------------------------------------------------------------------
-- Entrevistas: o que a lista de controle mostra, sem as respostas
-- ---------------------------------------------------------------------------

-- "Entrevistas – ver" mostra a situação de cada contrato, mas as respostas e
-- o PDF são de "ver respostas" (RLS da tabela). Esta função devolve só os
-- dados de controle das entrevistas salvas.
create function sustentabilidade.entrevistas_resumo()
returns table (
  id uuid, contrato_id uuid, lucs text[], cliente_doc text, data date, tipo text, setor text,
  formulario_versao int, origem text, entrevistador_id uuid, chamado_id uuid, valida_ate date,
  tem_pdf boolean, exemplo boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.contrato_id, e.lucs, e.cliente_doc, e.data, e.tipo, e.setor,
    e.formulario_versao, e.origem, e.entrevistador_id, e.chamado_id, e.valida_ate,
    e.pdf is not null, e.exemplo
  from sustentabilidade.entrevistas e
  where e.situacao = 'salva'
    and (select sustentabilidade.pode_alguma(
      'entrevistas.ver', 'entrevistas.aplicar', 'entrevistas.respostas',
      'entrevistas.dispensar', 'clube.ver', 'clube.editar', 'painel'));
$$;

-- ---------------------------------------------------------------------------
-- Importações: confirmar e desfazer
-- ---------------------------------------------------------------------------

-- Confirma a prévia. As linhas (entrevistas, lançamentos, cadastros) são
-- gravadas antes, com importacao_id desta prévia. Se ela substitui outra do
-- mesmo arquivo, as linhas da anterior saem e ela fica "substituida" (o
-- arquivo e o registro continuam).
create function sustentabilidade.confirmar_importacao(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v sustentabilidade.importacoes;
begin
  select * into v from sustentabilidade.importacoes where id = p_id for update;
  if not found then
    raise exception 'importação não encontrada' using errcode = 'P0001';
  end if;
  if not core.pode('sustentabilidade.importar') then
    raise exception 'sem permissão para importar' using errcode = '42501';
  end if;
  if v.status <> 'previa' then
    raise exception 'esta importação não é mais uma prévia' using errcode = '22023';
  end if;
  if v.substitui is not null then
    delete from sustentabilidade.lancamentos where importacao_id = v.substitui;
    delete from sustentabilidade.entrevistas where importacao_id = v.substitui;
    update sustentabilidade.importacoes set status = 'substituida'
      where id = v.substitui and status = 'confirmada';
  end if;
  update sustentabilidade.importacoes
    set status = 'confirmada', confirmado_por = (select auth.uid()), confirmado_em = now()
    where id = p_id;
end;
$$;

-- Desfaz a importação (prévia ou confirmada): apaga o que ela trouxe e
-- devolve quantas linhas saíram. A substituída não volta sozinha: o arquivo
-- dela continua guardado para importar de novo.
create function sustentabilidade.desfazer_importacao(p_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v sustentabilidade.importacoes;
  v_n int;
  v_total int := 0;
begin
  select * into v from sustentabilidade.importacoes where id = p_id for update;
  if not found then
    raise exception 'importação não encontrada' using errcode = 'P0001';
  end if;
  if not core.pode('sustentabilidade.importar') then
    raise exception 'sem permissão para desfazer esta importação' using errcode = '42501';
  end if;
  if v.status not in ('previa', 'confirmada') then
    raise exception 'esta importação já foi desfeita ou substituída' using errcode = '22023';
  end if;

  delete from sustentabilidade.lancamentos where importacao_id = p_id;
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;
  delete from sustentabilidade.entrevistas where importacao_id = p_id;
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;
  -- Nome de lista que veio com ela e que nenhum lançamento que ficou usa.
  delete from sustentabilidade.cadastros_lista c
    where c.importacao_id = p_id and not exists (
      select 1 from sustentabilidade.lancamentos l
      where l.programa_id = c.programa_id
        and l.valores ->> c.campo_id in (c.valor, c.id::text));

  update sustentabilidade.importacoes
    set status = 'desfeita', desfeito_por = (select auth.uid()), desfeito_em = now()
    where id = p_id;
  return v_total;
end;
$$;

-- ---------------------------------------------------------------------------
-- Dados de exemplo
-- ---------------------------------------------------------------------------

-- Apaga tudo que é de exemplo. O que já recebeu dado real fica (formulário
-- com lançamento real, contrato com entrevista real, coletor com ronda real).
create function sustentabilidade.remover_exemplos()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not core.pode('sustentabilidade.parametros') then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  delete from sustentabilidade.lancamentos where exemplo;
  delete from sustentabilidade.entrevistas where exemplo;
  delete from sustentabilidade.programa_indicadores i using sustentabilidade.programas p
    where p.id = i.programa_id and p.exemplo
      and not exists (select 1 from sustentabilidade.lancamentos l where l.programa_id = p.id);
  delete from sustentabilidade.formularios f
    where f.exemplo
      and not exists (select 1 from sustentabilidade.lancamentos l where l.formulario_id = f.id)
      and not exists (select 1 from sustentabilidade.programa_indicadores i where i.formulario_id = f.id)
      and (f.tipo <> 'questionario' or not exists (select 1 from sustentabilidade.entrevistas));
  delete from sustentabilidade.programas p
    where p.exemplo
      and not exists (select 1 from sustentabilidade.lancamentos l where l.programa_id = p.id)
      and not exists (select 1 from sustentabilidade.formularios f where f.programa_id = p.id);
  delete from sustentabilidade.participantes where exemplo;
  delete from sustentabilidade.rondas where exemplo;
  delete from sustentabilidade.coletores c
    where c.exemplo
      and not exists (select 1 from sustentabilidade.ronda_itens i where i.coletor_id = c.id);
  delete from sustentabilidade.rcc_notas where exemplo;
  delete from sustentabilidade.rcc_precos where exemplo;
  delete from sustentabilidade.marcos where exemplo;
  delete from sustentabilidade.contratos c
    where c.exemplo
      and not exists (select 1 from sustentabilidade.entrevistas e where e.contrato_id = c.id)
      and not exists (
        select 1 from sustentabilidade.entrevista_transferencias t
        where t.de_contrato_id = c.id or t.para_contrato_id = c.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'sustentabilidade' loop
    execute format('alter table sustentabilidade.%I enable row level security', t);
  end loop;
end $$;

-- Parâmetros: quem usa o módulo lê; "Parâmetros" edita.
create policy ver on sustentabilidade.parametros for select to authenticated
  using ((select sustentabilidade.acessa()));
create policy editar on sustentabilidade.parametros for update to authenticated
  using ((select core.pode('sustentabilidade.parametros')))
  with check ((select core.pode('sustentabilidade.parametros')));

create policy ver on sustentabilidade.parametros_valores for select to authenticated
  using ((select core.pode('sustentabilidade.valores')));
create policy editar on sustentabilidade.parametros_valores for update to authenticated
  using ((select core.pode('sustentabilidade.parametros')) and (select core.pode('sustentabilidade.valores')))
  with check ((select core.pode('sustentabilidade.parametros')) and (select core.pode('sustentabilidade.valores')));

create policy ver on sustentabilidade.setor_validades for select to authenticated
  using ((select sustentabilidade.acessa()));
create policy criar on sustentabilidade.setor_validades for insert to authenticated
  with check ((select core.pode('sustentabilidade.parametros')));
create policy editar on sustentabilidade.setor_validades for update to authenticated
  using ((select core.pode('sustentabilidade.parametros')))
  with check ((select core.pode('sustentabilidade.parametros')));
create policy excluir on sustentabilidade.setor_validades for delete to authenticated
  using ((select core.pode('sustentabilidade.parametros')));

-- Importações: só "Importar histórico". Mudança de status só pelas funções.
create policy ver on sustentabilidade.importacoes for select to authenticated
  using ((select core.pode('sustentabilidade.importar')));
create policy criar on sustentabilidade.importacoes for insert to authenticated
  with check (
    (select core.pode('sustentabilidade.importar')) and status = 'previa'
    and criado_por = (select auth.uid())
  );
create policy editar on sustentabilidade.importacoes for update to authenticated
  using (status = 'previa' and criado_por = (select auth.uid()) and (select core.pode('sustentabilidade.importar')))
  with check (status = 'previa' and criado_por = (select auth.uid()));

-- Contratos: quem trabalha com entrevistas, clube ou painel lê. Só a
-- sincronização (service role) cria; "dispensar ou corrigir" muda o que é do módulo.
create policy ver on sustentabilidade.contratos for select to authenticated
  using ((select sustentabilidade.pode_alguma(
    'entrevistas.ver', 'entrevistas.aplicar', 'entrevistas.respostas', 'entrevistas.dispensar',
    'clube.ver', 'clube.editar', 'painel', 'importar')));
create policy editar on sustentabilidade.contratos for update to authenticated
  using ((select core.pode('sustentabilidade.entrevistas.dispensar')))
  with check ((select core.pode('sustentabilidade.entrevistas.dispensar')));

-- Programas: "gerenciar" e o painel veem todos; "Programa – lançar" só o seu.
create policy ver on sustentabilidade.programas for select to authenticated
  using (
    (select sustentabilidade.pode_alguma('programas.gerenciar', 'painel'))
    or id in (select sustentabilidade.meus_programas())
  );
create policy criar on sustentabilidade.programas for insert to authenticated
  with check ((select core.pode('sustentabilidade.programas.gerenciar')) and not exemplo);
create policy editar on sustentabilidade.programas for update to authenticated
  using ((select core.pode('sustentabilidade.programas.gerenciar')))
  with check ((select core.pode('sustentabilidade.programas.gerenciar')));
create policy excluir on sustentabilidade.programas for delete to authenticated
  using ((select core.pode('sustentabilidade.programas.gerenciar')));

create policy ver on sustentabilidade.programa_contatos for select to authenticated
  using (
    (select core.pode('sustentabilidade.contato'))
    and exists (select 1 from sustentabilidade.programas p where p.id = programa_contatos.programa_id)
  );
create policy criar on sustentabilidade.programa_contatos for insert to authenticated
  with check ((select core.pode('sustentabilidade.programas.gerenciar')) and (select core.pode('sustentabilidade.contato')));
create policy editar on sustentabilidade.programa_contatos for update to authenticated
  using ((select core.pode('sustentabilidade.programas.gerenciar')) and (select core.pode('sustentabilidade.contato')))
  with check ((select core.pode('sustentabilidade.programas.gerenciar')) and (select core.pode('sustentabilidade.contato')));
create policy excluir on sustentabilidade.programa_contatos for delete to authenticated
  using ((select core.pode('sustentabilidade.programas.gerenciar')) and (select core.pode('sustentabilidade.contato')));

-- Formulários: quem usa o módulo lê a definição. O questionário é de
-- "editar questionário"; os dos programas, de "Programas – gerenciar".
-- versao_publicada só muda por publicar_formulario().
create policy ver on sustentabilidade.formularios for select to authenticated
  using ((select sustentabilidade.acessa()));
create policy criar on sustentabilidade.formularios for insert to authenticated
  with check (
    case tipo
      when 'questionario' then (select core.pode('sustentabilidade.entrevistas.questionario'))
      else (select core.pode('sustentabilidade.programas.gerenciar'))
    end
  );
create policy editar on sustentabilidade.formularios for update to authenticated
  using (
    case tipo
      when 'questionario' then (select core.pode('sustentabilidade.entrevistas.questionario'))
      else (select core.pode('sustentabilidade.programas.gerenciar'))
    end
  )
  with check (
    case tipo
      when 'questionario' then (select core.pode('sustentabilidade.entrevistas.questionario'))
      else (select core.pode('sustentabilidade.programas.gerenciar'))
    end
  );
-- Excluir: só formulário de programa, com as duas permissões. Com lançamento
-- ou indicador, a chave estrangeira recusa.
create policy excluir on sustentabilidade.formularios for delete to authenticated
  using (
    tipo = 'programa'
    and (select core.pode('sustentabilidade.programas.gerenciar'))
    and (select core.pode('sustentabilidade.formularios.excluir'))
  );

create policy ver on sustentabilidade.formulario_versoes for select to authenticated
  using ((select sustentabilidade.acessa()));

create policy ver on sustentabilidade.formulario_alteracoes for select to authenticated
  using ((select sustentabilidade.pode_alguma('entrevistas.questionario', 'programas.gerenciar')));
create policy criar on sustentabilidade.formulario_alteracoes for insert to authenticated
  with check (
    quem = (select auth.uid())
    and (select sustentabilidade.pode_alguma('entrevistas.questionario', 'programas.gerenciar'))
  );

-- Entrevistas: as respostas são de "ver respostas" e de quem corrige; quem
-- aplica vê as que aplicou. A lista de controle usa entrevistas_resumo().
create policy ver on sustentabilidade.entrevistas for select to authenticated
  using (
    (select sustentabilidade.pode_alguma('entrevistas.respostas', 'entrevistas.dispensar'))
    or (entrevistador_id = (select auth.uid()) and (select core.pode('sustentabilidade.entrevistas.aplicar')))
    or (importacao_id is not null and (select core.pode('sustentabilidade.importar')))
  );
create policy criar on sustentabilidade.entrevistas for insert to authenticated
  with check (
    not exemplo and (
      (origem = 'sistema' and importacao_id is null and entrevistador_id = (select auth.uid())
        and (select core.pode('sustentabilidade.entrevistas.aplicar')))
      or (origem <> 'sistema' and (select core.pode('sustentabilidade.importar'))
        and importacao_id in (
          select i.id from sustentabilidade.importacoes i
          where i.status = 'previa' and i.criado_por = (select auth.uid())))
    )
  );
-- Quem aplica muda o próprio rascunho (e o salva); a salva só muda por
-- "dispensar ou corrigir", com o antes e o depois na auditoria.
create policy editar on sustentabilidade.entrevistas for update to authenticated
  using (
    (situacao = 'rascunho' and entrevistador_id = (select auth.uid())
      and (select core.pode('sustentabilidade.entrevistas.aplicar')))
    or (select core.pode('sustentabilidade.entrevistas.dispensar'))
  )
  with check (
    not exemplo and (
      (entrevistador_id = (select auth.uid()) and (select core.pode('sustentabilidade.entrevistas.aplicar')))
      or (select core.pode('sustentabilidade.entrevistas.dispensar'))
    )
  );
create policy excluir on sustentabilidade.entrevistas for delete to authenticated
  using (
    situacao = 'rascunho' and entrevistador_id = (select auth.uid())
    and (select core.pode('sustentabilidade.entrevistas.aplicar'))
  );

create policy ver on sustentabilidade.entrevista_transferencias for select to authenticated
  using ((select sustentabilidade.pode_alguma('entrevistas.ver', 'entrevistas.respostas', 'entrevistas.dispensar')));
create policy criar on sustentabilidade.entrevista_transferencias for insert to authenticated
  with check (quem = (select auth.uid()) and (select core.pode('sustentabilidade.entrevistas.dispensar')));

-- Clube: "ver" e o painel leem; "editar" grava. Quem aplica entrevista pode
-- registrar o interesse (pergunta 13).
create policy ver on sustentabilidade.participantes for select to authenticated
  using ((select sustentabilidade.pode_alguma('clube.ver', 'clube.editar', 'painel')));
create policy criar on sustentabilidade.participantes for insert to authenticated
  with check (
    not exemplo and (
      (select core.pode('sustentabilidade.clube.editar'))
      or (interesse and formas = '{}' and (select core.pode('sustentabilidade.entrevistas.aplicar')))
    )
  );
create policy editar on sustentabilidade.participantes for update to authenticated
  using ((select core.pode('sustentabilidade.clube.editar')))
  with check ((select core.pode('sustentabilidade.clube.editar')));

create policy ver on sustentabilidade.participante_contatos for select to authenticated
  using (
    (select core.pode('sustentabilidade.contato'))
    and (select sustentabilidade.pode_alguma('clube.ver', 'clube.editar'))
  );
create policy criar on sustentabilidade.participante_contatos for insert to authenticated
  with check ((select core.pode('sustentabilidade.clube.editar')) and (select core.pode('sustentabilidade.contato')));
create policy editar on sustentabilidade.participante_contatos for update to authenticated
  using ((select core.pode('sustentabilidade.clube.editar')) and (select core.pode('sustentabilidade.contato')))
  with check ((select core.pode('sustentabilidade.clube.editar')) and (select core.pode('sustentabilidade.contato')));
create policy excluir on sustentabilidade.participante_contatos for delete to authenticated
  using ((select core.pode('sustentabilidade.clube.editar')) and (select core.pode('sustentabilidade.contato')));

create policy ver on sustentabilidade.participante_valores for select to authenticated
  using (
    (select core.pode('sustentabilidade.valores'))
    and (select sustentabilidade.pode_alguma('clube.ver', 'clube.editar', 'painel'))
  );
create policy criar on sustentabilidade.participante_valores for insert to authenticated
  with check ((select core.pode('sustentabilidade.clube.editar')) and (select core.pode('sustentabilidade.valores')));
create policy editar on sustentabilidade.participante_valores for update to authenticated
  using ((select core.pode('sustentabilidade.clube.editar')) and (select core.pode('sustentabilidade.valores')))
  with check ((select core.pode('sustentabilidade.clube.editar')) and (select core.pode('sustentabilidade.valores')));
create policy excluir on sustentabilidade.participante_valores for delete to authenticated
  using ((select core.pode('sustentabilidade.clube.editar')) and (select core.pode('sustentabilidade.valores')));

create policy ver on sustentabilidade.termos for select to authenticated
  using ((select sustentabilidade.pode_alguma('clube.ver', 'clube.editar', 'painel')));
create policy criar on sustentabilidade.termos for insert to authenticated
  with check ((select core.pode('sustentabilidade.clube.editar')));
create policy editar on sustentabilidade.termos for update to authenticated
  using ((select core.pode('sustentabilidade.clube.editar')))
  with check ((select core.pode('sustentabilidade.clube.editar')));
create policy excluir on sustentabilidade.termos for delete to authenticated
  using ((select core.pode('sustentabilidade.clube.editar')));

create policy ver on sustentabilidade.contribuicoes for select to authenticated
  using ((select sustentabilidade.pode_alguma('clube.ver', 'clube.editar')));
create policy criar on sustentabilidade.contribuicoes for insert to authenticated
  with check ((select core.pode('sustentabilidade.clube.editar')));
create policy editar on sustentabilidade.contribuicoes for update to authenticated
  using ((select core.pode('sustentabilidade.clube.editar')))
  with check ((select core.pode('sustentabilidade.clube.editar')));
create policy excluir on sustentabilidade.contribuicoes for delete to authenticated
  using ((select core.pode('sustentabilidade.clube.editar')));

-- Quem lança a contribuição grava o valor; ler depois exige "Ver valores".
create policy ver on sustentabilidade.contribuicao_valores for select to authenticated
  using (
    (select core.pode('sustentabilidade.valores'))
    and (select sustentabilidade.pode_alguma('clube.ver', 'clube.editar', 'painel'))
  );
create policy criar on sustentabilidade.contribuicao_valores for insert to authenticated
  with check ((select core.pode('sustentabilidade.clube.editar')));
create policy editar on sustentabilidade.contribuicao_valores for update to authenticated
  using ((select core.pode('sustentabilidade.clube.editar')) and (select core.pode('sustentabilidade.valores')))
  with check ((select core.pode('sustentabilidade.clube.editar')) and (select core.pode('sustentabilidade.valores')));

create policy ver on sustentabilidade.acoes for select to authenticated
  using ((select sustentabilidade.pode_alguma('clube.ver', 'clube.editar')));
create policy criar on sustentabilidade.acoes for insert to authenticated
  with check ((select core.pode('sustentabilidade.clube.editar')));
create policy editar on sustentabilidade.acoes for update to authenticated
  using ((select core.pode('sustentabilidade.clube.editar')))
  with check ((select core.pode('sustentabilidade.clube.editar')));
create policy excluir on sustentabilidade.acoes for delete to authenticated
  using ((select core.pode('sustentabilidade.clube.editar')));

-- Coletores: cadastro nos Parâmetros; quem usa o módulo lê.
create policy ver on sustentabilidade.coletores for select to authenticated
  using ((select sustentabilidade.acessa()));
create policy criar on sustentabilidade.coletores for insert to authenticated
  with check ((select core.pode('sustentabilidade.parametros')) and not exemplo);
create policy editar on sustentabilidade.coletores for update to authenticated
  using ((select core.pode('sustentabilidade.parametros')))
  with check ((select core.pode('sustentabilidade.parametros')));
create policy excluir on sustentabilidade.coletores for delete to authenticated
  using ((select core.pode('sustentabilidade.parametros')));

-- Rondas: "lançar ronda" lança e lê; o painel lê.
create policy ver on sustentabilidade.rondas for select to authenticated
  using ((select sustentabilidade.pode_alguma('ronda', 'painel')));
create policy criar on sustentabilidade.rondas for insert to authenticated
  with check (
    (select core.pode('sustentabilidade.ronda')) and lancado_por = (select auth.uid()) and not exemplo
  );
create policy editar on sustentabilidade.rondas for update to authenticated
  using ((select core.pode('sustentabilidade.ronda')))
  with check ((select core.pode('sustentabilidade.ronda')));
create policy excluir on sustentabilidade.rondas for delete to authenticated
  using ((select core.pode('sustentabilidade.ronda')));

create policy ver on sustentabilidade.ronda_itens for select to authenticated
  using ((select sustentabilidade.pode_alguma('ronda', 'painel')));
create policy criar on sustentabilidade.ronda_itens for insert to authenticated
  with check ((select core.pode('sustentabilidade.ronda')));
create policy editar on sustentabilidade.ronda_itens for update to authenticated
  using ((select core.pode('sustentabilidade.ronda')))
  with check ((select core.pode('sustentabilidade.ronda')));
create policy excluir on sustentabilidade.ronda_itens for delete to authenticated
  using ((select core.pode('sustentabilidade.ronda')));

-- RCC: "RCC" lança e lê; o painel lê. Fatores e preços são dos Parâmetros.
create policy ver on sustentabilidade.rcc_fatores for select to authenticated
  using ((select sustentabilidade.pode_alguma('rcc', 'painel', 'parametros')));
create policy criar on sustentabilidade.rcc_fatores for insert to authenticated
  with check ((select core.pode('sustentabilidade.parametros')));
create policy editar on sustentabilidade.rcc_fatores for update to authenticated
  using ((select core.pode('sustentabilidade.parametros')))
  with check ((select core.pode('sustentabilidade.parametros')));
create policy excluir on sustentabilidade.rcc_fatores for delete to authenticated
  using ((select core.pode('sustentabilidade.parametros')));

create policy ver on sustentabilidade.rcc_precos for select to authenticated
  using (
    (select core.pode('sustentabilidade.valores'))
    and (select sustentabilidade.pode_alguma('rcc', 'painel', 'parametros'))
  );
create policy criar on sustentabilidade.rcc_precos for insert to authenticated
  with check ((select core.pode('sustentabilidade.parametros')) and (select core.pode('sustentabilidade.valores')) and not exemplo);
create policy editar on sustentabilidade.rcc_precos for update to authenticated
  using ((select core.pode('sustentabilidade.parametros')) and (select core.pode('sustentabilidade.valores')))
  with check ((select core.pode('sustentabilidade.parametros')) and (select core.pode('sustentabilidade.valores')));
create policy excluir on sustentabilidade.rcc_precos for delete to authenticated
  using ((select core.pode('sustentabilidade.parametros')) and (select core.pode('sustentabilidade.valores')));

create policy ver on sustentabilidade.rcc_notas for select to authenticated
  using ((select sustentabilidade.pode_alguma('rcc', 'painel')));
create policy criar on sustentabilidade.rcc_notas for insert to authenticated
  with check ((select core.pode('sustentabilidade.rcc')) and lancado_por = (select auth.uid()) and not exemplo);
create policy editar on sustentabilidade.rcc_notas for update to authenticated
  using ((select core.pode('sustentabilidade.rcc')))
  with check ((select core.pode('sustentabilidade.rcc')));
create policy excluir on sustentabilidade.rcc_notas for delete to authenticated
  using ((select core.pode('sustentabilidade.rcc')));

-- Quem lança a nota grava o valor; ler depois exige "Ver valores".
create policy ver on sustentabilidade.rcc_nota_valores for select to authenticated
  using (
    (select core.pode('sustentabilidade.valores'))
    and (select sustentabilidade.pode_alguma('rcc', 'painel'))
  );
create policy criar on sustentabilidade.rcc_nota_valores for insert to authenticated
  with check ((select core.pode('sustentabilidade.rcc')));
create policy editar on sustentabilidade.rcc_nota_valores for update to authenticated
  using ((select core.pode('sustentabilidade.rcc')) and (select core.pode('sustentabilidade.valores')))
  with check ((select core.pode('sustentabilidade.rcc')) and (select core.pode('sustentabilidade.valores')));
create policy excluir on sustentabilidade.rcc_nota_valores for delete to authenticated
  using ((select core.pode('sustentabilidade.rcc')));

-- Indicadores: vê quem vê o programa; "gerenciar" define.
create policy ver on sustentabilidade.programa_indicadores for select to authenticated
  using (
    (select sustentabilidade.pode_alguma('programas.gerenciar', 'painel'))
    or programa_id in (select sustentabilidade.meus_programas())
  );
create policy criar on sustentabilidade.programa_indicadores for insert to authenticated
  with check ((select core.pode('sustentabilidade.programas.gerenciar')));
create policy editar on sustentabilidade.programa_indicadores for update to authenticated
  using ((select core.pode('sustentabilidade.programas.gerenciar')))
  with check ((select core.pode('sustentabilidade.programas.gerenciar')));
create policy excluir on sustentabilidade.programa_indicadores for delete to authenticated
  using ((select core.pode('sustentabilidade.programas.gerenciar')));

-- Link do parceiro: só "Programas – gerenciar". O parceiro não tem usuário:
-- a página externa confere o hash e lê pelo servidor (service role).
create policy ver on sustentabilidade.programa_links for select to authenticated
  using ((select core.pode('sustentabilidade.programas.gerenciar')));
create policy criar on sustentabilidade.programa_links for insert to authenticated
  with check ((select core.pode('sustentabilidade.programas.gerenciar')) and criado_por = (select auth.uid()));
create policy editar on sustentabilidade.programa_links for update to authenticated
  using ((select core.pode('sustentabilidade.programas.gerenciar')))
  with check ((select core.pode('sustentabilidade.programas.gerenciar')));

-- Lançamentos: "gerenciar" em todos; "Programa – lançar" só no seu programa;
-- o painel lê; "Importar histórico" grava os da prévia que criou.
create policy ver on sustentabilidade.lancamentos for select to authenticated
  using (
    (select sustentabilidade.pode_alguma('programas.gerenciar', 'painel'))
    or programa_id in (select sustentabilidade.meus_programas())
    or (importacao_id is not null and (select core.pode('sustentabilidade.importar')))
  );
create policy criar on sustentabilidade.lancamentos for insert to authenticated
  with check (
    not exemplo and (
      (origem = 'equipe' and link_id is null and importacao_id is null
        and lancado_por = (select auth.uid())
        and ((select core.pode('sustentabilidade.programas.gerenciar'))
          or programa_id in (select sustentabilidade.meus_programas())))
      or (origem = 'importacao' and (select core.pode('sustentabilidade.importar'))
        and importacao_id in (
          select i.id from sustentabilidade.importacoes i
          where i.status = 'previa' and i.criado_por = (select auth.uid())))
    )
  );
create policy editar on sustentabilidade.lancamentos for update to authenticated
  using (
    (select core.pode('sustentabilidade.programas.gerenciar'))
    or programa_id in (select sustentabilidade.meus_programas())
  )
  with check (
    not exemplo and (
      (select core.pode('sustentabilidade.programas.gerenciar'))
      or programa_id in (select sustentabilidade.meus_programas())
    )
  );
create policy excluir on sustentabilidade.lancamentos for delete to authenticated
  using (
    (select core.pode('sustentabilidade.programas.gerenciar'))
    or programa_id in (select sustentabilidade.meus_programas())
  );

-- Reais do lançamento: quem pode gravar o lançamento grava; ler exige "Ver
-- valores" e ver o lançamento (o RLS de lancamentos vale no exists).
create policy ver on sustentabilidade.lancamento_valores for select to authenticated
  using (
    (select core.pode('sustentabilidade.valores'))
    and exists (select 1 from sustentabilidade.lancamentos l where l.id = lancamento_valores.lancamento_id)
  );
create policy criar on sustentabilidade.lancamento_valores for insert to authenticated
  with check (
    (select core.pode('sustentabilidade.programas.gerenciar'))
    or (select core.pode('sustentabilidade.importar'))
    or lancamento_id in (
      select l.id from sustentabilidade.lancamentos l
      where l.programa_id in (select sustentabilidade.meus_programas()))
  );
create policy editar on sustentabilidade.lancamento_valores for update to authenticated
  using (
    (select core.pode('sustentabilidade.valores'))
    and exists (select 1 from sustentabilidade.lancamentos l where l.id = lancamento_valores.lancamento_id)
  )
  with check ((select core.pode('sustentabilidade.valores')));

create policy ver on sustentabilidade.cadastros_lista for select to authenticated
  using (
    (select sustentabilidade.pode_alguma('programas.gerenciar', 'painel', 'importar'))
    or programa_id in (select sustentabilidade.meus_programas())
  );
create policy criar on sustentabilidade.cadastros_lista for insert to authenticated
  with check (
    (select sustentabilidade.pode_alguma('programas.gerenciar', 'importar'))
    or programa_id in (select sustentabilidade.meus_programas())
  );
create policy editar on sustentabilidade.cadastros_lista for update to authenticated
  using ((select core.pode('sustentabilidade.programas.gerenciar')))
  with check ((select core.pode('sustentabilidade.programas.gerenciar')));
create policy excluir on sustentabilidade.cadastros_lista for delete to authenticated
  using ((select core.pode('sustentabilidade.programas.gerenciar')));

-- Marco inicial, equivalências e consolidado: o painel lê; "Parâmetros" grava
-- (inclusive fechar e reabrir o ano).
create policy ver on sustentabilidade.marcos for select to authenticated
  using ((select sustentabilidade.pode_alguma('painel', 'parametros')));
create policy criar on sustentabilidade.marcos for insert to authenticated
  with check ((select core.pode('sustentabilidade.parametros')) and not exemplo);
create policy editar on sustentabilidade.marcos for update to authenticated
  using ((select core.pode('sustentabilidade.parametros')))
  with check ((select core.pode('sustentabilidade.parametros')));
create policy excluir on sustentabilidade.marcos for delete to authenticated
  using ((select core.pode('sustentabilidade.parametros')));

create policy ver on sustentabilidade.equivalencias for select to authenticated
  using ((select sustentabilidade.pode_alguma('painel', 'parametros')));
create policy criar on sustentabilidade.equivalencias for insert to authenticated
  with check ((select core.pode('sustentabilidade.parametros')));
create policy editar on sustentabilidade.equivalencias for update to authenticated
  using ((select core.pode('sustentabilidade.parametros')))
  with check ((select core.pode('sustentabilidade.parametros')));
create policy excluir on sustentabilidade.equivalencias for delete to authenticated
  using ((select core.pode('sustentabilidade.parametros')));

create policy ver on sustentabilidade.consolidados for select to authenticated
  using ((select sustentabilidade.pode_alguma('painel', 'parametros')));
create policy criar on sustentabilidade.consolidados for insert to authenticated
  with check ((select core.pode('sustentabilidade.parametros')));
create policy editar on sustentabilidade.consolidados for update to authenticated
  using ((select core.pode('sustentabilidade.parametros')))
  with check ((select core.pode('sustentabilidade.parametros')));

create policy ver on sustentabilidade.consolidado_valores for select to authenticated
  using (
    (select core.pode('sustentabilidade.valores'))
    and (select sustentabilidade.pode_alguma('painel', 'parametros'))
  );
create policy criar on sustentabilidade.consolidado_valores for insert to authenticated
  with check ((select core.pode('sustentabilidade.parametros')) and (select core.pode('sustentabilidade.valores')));
create policy editar on sustentabilidade.consolidado_valores for update to authenticated
  using ((select core.pode('sustentabilidade.parametros')) and (select core.pode('sustentabilidade.valores')))
  with check ((select core.pode('sustentabilidade.parametros')) and (select core.pode('sustentabilidade.valores')));

-- ---------------------------------------------------------------------------
-- Grants (por coluna onde só parte é editável)
-- ---------------------------------------------------------------------------

grant select on all tables in schema sustentabilidade to authenticated;

grant update (meses_primeira_entrevista, validade_padrao_meses, aviso_dias, tipos_loja_dispensados,
  data_inauguracao, motivos_dispensa, clube_formas, termo_validade_meses, termo_aviso_dias,
  formas_contribuicao, tipos_acao, limite_ocupacao_pct, recolhimento_setor_id, rcc_empresas,
  areas_impacto, grupos_impacto, cobranca_dia, unidades, atualizado_por)
  on sustentabilidade.parametros to authenticated;
grant update (tour_custo_album, tour_custo_copo) on sustentabilidade.parametros_valores to authenticated;
grant insert (setor, meses), update (setor, meses), delete on sustentabilidade.setor_validades to authenticated;

grant insert (tipo, arquivo, sha256, resumo, avisos, decisoes, substitui, criado_por)
  on sustentabilidade.importacoes to authenticated;
grant update (resumo, avisos, decisoes, substitui) on sustentabilidade.importacoes to authenticated;

-- Contratos: só o que é do módulo. Quem e quando vêm do gatilho.
grant update (ativacao_corrigida, ativacao_corrigida_motivo, validade_meses_especifica, dispensada_motivo)
  on sustentabilidade.contratos to authenticated;

grant insert (id, nome, descricao, area, parceiro_nome, parceiro_doc, inicio, fim, frequencia, ativo)
  on sustentabilidade.programas to authenticated;
grant update (nome, descricao, area, parceiro_nome, parceiro_doc, inicio, fim, frequencia, ativo)
  on sustentabilidade.programas to authenticated;
grant delete on sustentabilidade.programas to authenticated;
grant insert (programa_id, email, telefone, contato), update (email, telefone, contato), delete
  on sustentabilidade.programa_contatos to authenticated;

grant insert (id, tipo, programa_id, nome, ativo, rascunho, rascunho_alterado, criado_por)
  on sustentabilidade.formularios to authenticated;
grant update (nome, ativo, rascunho, rascunho_alterado) on sustentabilidade.formularios to authenticated;
grant delete on sustentabilidade.formularios to authenticated;
grant insert (formulario_id, quem, descricao, antes, depois)
  on sustentabilidade.formulario_alteracoes to authenticated;

grant insert (id, contrato_id, lucs, cliente_doc, data, tipo, setor, formulario_versao, respostas,
  situacao, rascunho_chave, respondente_nome, assinatura_respondente, assinatura_entrevistador,
  pdf, anexos, origem, entrevistador_id, chamado_id, valida_ate, importacao_id)
  on sustentabilidade.entrevistas to authenticated;
grant update (contrato_id, lucs, cliente_doc, data, tipo, setor, respostas, situacao,
  respondente_nome, assinatura_respondente, assinatura_entrevistador, pdf, anexos, valida_ate)
  on sustentabilidade.entrevistas to authenticated;
grant delete on sustentabilidade.entrevistas to authenticated;
grant insert (entrevista_id, de_contrato_id, para_contrato_id, motivo, quem)
  on sustentabilidade.entrevista_transferencias to authenticated;

grant insert (id, cliente_doc, nome, locatario_manual, formas, saiu_em, saiu_motivo, interesse)
  on sustentabilidade.participantes to authenticated;
grant update (cliente_doc, nome, locatario_manual, formas, saiu_em, saiu_motivo, interesse)
  on sustentabilidade.participantes to authenticated;
grant insert (participante_id, email, telefone, contato), update (email, telefone, contato), delete
  on sustentabilidade.participante_contatos to authenticated;
grant insert (participante_id, valor_combinado_mes), update (valor_combinado_mes), delete
  on sustentabilidade.participante_valores to authenticated;
grant insert (id, participante_id, ano, assinado_em, valido_ate, arquivo, assinatura, criado_por),
  update (ano, assinado_em, valido_ate, arquivo, assinatura), delete
  on sustentabilidade.termos to authenticated;
grant insert (id, participante_id, data, forma, competencia, observacao, criado_por),
  update (data, forma, competencia, observacao), delete
  on sustentabilidade.contribuicoes to authenticated;
grant insert, update (valor) on sustentabilidade.contribuicao_valores to authenticated;
grant insert (id, participante_id, data, tipo, observacao, criado_por),
  update (data, tipo, observacao), delete
  on sustentabilidade.acoes to authenticated;

grant insert (local, cor, conteineres, capacidade_l, ativo, ordem),
  update (local, cor, conteineres, capacidade_l, ativo, ordem), delete
  on sustentabilidade.coletores to authenticated;
grant insert (id, data_hora, chamado_id, observacao, foto, lancado_por),
  update (data_hora, observacao, foto), delete
  on sustentabilidade.rondas to authenticated;
grant insert, update (conteineres, ocupacao_pct, observacao, foto), delete
  on sustentabilidade.ronda_itens to authenticated;

grant insert (vigente_desde, toneladas_por_cacamba, volume_m3, criado_por),
  update (vigente_desde, toneladas_por_cacamba, volume_m3), delete
  on sustentabilidade.rcc_fatores to authenticated;
grant insert (vigente_desde, preco_a, preco_b, criado_por),
  update (vigente_desde, preco_a, preco_b), delete
  on sustentabilidade.rcc_precos to authenticated;
grant insert (id, competencia, empresa, numero, pdf, cacambas_a, cacambas_b, chamado_id, lancado_por),
  update (competencia, empresa, numero, pdf, cacambas_a, cacambas_b), delete
  on sustentabilidade.rcc_notas to authenticated;
grant insert, update (valor_total), delete on sustentabilidade.rcc_nota_valores to authenticated;

grant insert (id, programa_id, nome, formulario_id, campo_id, calculo, filtro, percentual_valor,
  unidade, grupo, mostrar_painel, em_reais, ativo, ordem),
  update (nome, formulario_id, campo_id, calculo, filtro, percentual_valor, unidade, grupo,
  mostrar_painel, em_reais, ativo, ordem), delete
  on sustentabilidade.programa_indicadores to authenticated;
-- Link: cria com o hash e desliga. O último acesso é do servidor.
grant insert (id, programa_id, token_hash, criado_por), update (desligado_em, desligado_por)
  on sustentabilidade.programa_links to authenticated;
grant insert (id, programa_id, formulario_id, formulario_versao, data, valores, origem,
  lancado_por, importacao_id),
  update (data, valores), delete
  on sustentabilidade.lancamentos to authenticated;
grant insert, update (valores) on sustentabilidade.lancamento_valores to authenticated;
grant insert (id, programa_id, campo_id, valor, normalizado, importacao_id, criado_por),
  update (valor, normalizado), delete
  on sustentabilidade.cadastros_lista to authenticated;

grant insert (indicador, ano, valor), update (valor), delete on sustentabilidade.marcos to authenticated;
grant insert (nome, fator, unidade, confirmado), update (nome, fator, unidade, confirmado), delete
  on sustentabilidade.equivalencias to authenticated;
grant insert (ano, totais, fechado_por),
  update (totais, situacao, fechado_por, fechado_em, reaberto_por, reaberto_em, reaberto_motivo)
  on sustentabilidade.consolidados to authenticated;
grant insert, update (totais) on sustentabilidade.consolidado_valores to authenticated;

grant all on all tables in schema sustentabilidade to service_role;

revoke all on all functions in schema sustentabilidade from public, anon;
grant execute on function sustentabilidade.acessa() to authenticated, service_role;
grant execute on function sustentabilidade.pode_alguma(text[]) to authenticated, service_role;
grant execute on function sustentabilidade.meus_programas() to authenticated, service_role;
grant execute on function sustentabilidade.itens_da_definicao(jsonb) to authenticated, service_role;
grant execute on function sustentabilidade.uso_do_formulario(uuid) to authenticated;
grant execute on function sustentabilidade.publicar_formulario(uuid, text) to authenticated;
grant execute on function sustentabilidade.entrevistas_resumo() to authenticated;
grant execute on function sustentabilidade.confirmar_importacao(uuid) to authenticated;
grant execute on function sustentabilidade.desfazer_importacao(uuid) to authenticated;
grant execute on function sustentabilidade.remover_exemplos() to authenticated;

-- ---------------------------------------------------------------------------
-- Metas do painel (core.metas, indicador "sustentabilidade.*"): lê quem usa
-- o módulo (regra geral da política "ver"); "Parâmetros" edita
-- ---------------------------------------------------------------------------

alter policy editar on core.metas
  using (
    (indicador like 'rh.%' and (select core.pode('rh.parametros')))
    or (indicador like 'financeiro.%' and (select core.pode('financeiro.importacao_parametros')))
    or (indicador like 'marketing.%' and (select core.pode('marketing.parametros')))
    or (indicador like 'comercial.%' and (select core.pode('comercial.painel.metas')))
    or (indicador like 'sustentabilidade.%' and (select core.pode('sustentabilidade.parametros')))
  )
  with check (
    (indicador like 'rh.%' and (select core.pode('rh.parametros')))
    or (indicador like 'financeiro.%' and (select core.pode('financeiro.importacao_parametros')))
    or (indicador like 'marketing.%' and (select core.pode('marketing.parametros')))
    or (indicador like 'comercial.%' and (select core.pode('comercial.painel.metas')))
    or (indicador like 'sustentabilidade.%' and (select core.pode('sustentabilidade.parametros')))
  );

-- Validade por setor: os valores ainda não foram fechados com a área
-- (seção 10 do spec); começam todos no padrão e mudam nos Parâmetros.
insert into sustentabilidade.setor_validades (setor, meses) values
  ('Saúde', 24), ('Industrial/Confecção', 24), ('Gastronômico', 24),
  ('Lojas e serviços gerais', 24), ('Educação básica', 24),
  ('Educação profissionalizante', 24), ('Academia', 24);
