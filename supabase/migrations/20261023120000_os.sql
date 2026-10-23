-- os: Chamados, Ordens de Serviço e Ativos (especificação "Módulo Chamados,
-- OS e Ativos", 22/10/2026). Desenho em docs/modelo-de-dados.md.
--
-- Diferente do RH e do Financeiro, os dados nascem aqui: o usuário cria e
-- edita. Tudo é um chamado (Tarefa, Solicitação, OS ou Aviso); OS, ativo,
-- vistoria, portal e agenda são recursos que a categoria liga. O ENET entra
-- só como consulta (os.lojas, gravada pela sincronização ou à mão).
--
-- Esta migration cria os tipos e as tabelas; as regras (funções, gatilhos,
-- RLS) ficam em 20261023120100_os_regras.sql.

create schema os;
grant usage on schema os to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type os.tipo_chamado as enum ('tarefa', 'solicitacao', 'os', 'aviso');
create type os.status_chamado as enum (
  'aberto', 'em_andamento', 'aguardando', 'concluido', 'fechado', 'cancelado'
);
create type os.prioridade as enum ('baixa', 'media', 'alta', 'urgente');
create type os.origem_chamado as enum (
  'sistema', 'portal', 'modelo', 'preventiva', 'recorrencia', 'vistoria', 'importacao'
);
create type os.motivo_aguardando as enum (
  'material', 'terceirizado', 'lojista', 'aprovacao', 'outro'
);
create type os.status_destino as enum ('aberto', 'em_andamento', 'aguardando', 'concluido');
create type os.unidade_prazo as enum ('horas', 'dias_uteis');
create type os.execucao as enum ('interna', 'terceirizada');
create type os.periodo_visita as enum ('manha', 'tarde', 'noite');
create type os.regra_rateio as enum ('hora_trabalhada', 'manual', 'percentual', 'terceirizado');
create type os.situacao_ativo as enum ('em_uso', 'em_manutencao', 'parado', 'baixado');
create type os.tipo_vistoria as enum ('entrada', 'saida', 'preventiva', 'extraordinaria');
create type os.status_vistoria as enum ('andamento', 'finalizado', 'cancelado');
create type os.resposta_ambiente as enum ('respondido', 'nao_se_aplica', 'pendente');
create type os.status_agendamento as enum ('marcado', 'remarcar', 'cancelado', 'realizado');

-- ---------------------------------------------------------------------------
-- Setores e parâmetros
-- ---------------------------------------------------------------------------

create table os.setores (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (btrim(nome) <> ''),
  -- Cor do selo (hex) e ícone (nome do lucide) nas telas.
  cor text not null default '#2a78d6' check (cor ~ '^#[0-9a-fA-F]{6}$'),
  icone text not null default 'inbox',
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Quem é de cada setor. "gestor" recebe o aviso quando um chamado do setor
-- vence; o que ele pode fazer vem das permissões (os.gerenciar_setor).
create table os.setor_membros (
  setor_id uuid not null references os.setores (id) on delete cascade,
  usuario_id uuid not null references core.usuarios (id) on delete cascade,
  gestor boolean not null default false,
  primary key (setor_id, usuario_id)
);
create index setor_membros_usuario on os.setor_membros (usuario_id);

-- Uma linha só: tudo o que pode mudar (seção 4.15). Alterações vão para a
-- auditoria (antes e depois).
create table os.parametros (
  id smallint primary key default 1 check (id = 1),
  -- Ciclo
  aceite_dias_uteis int not null default 3 check (aceite_dias_uteis between 0 and 60),
  aviso_vencimento_horas int not null default 24 check (aviso_vencimento_horas between 1 and 240),
  confirmacao_alerta_dias int not null default 2 check (confirmacao_alerta_dias between 1 and 60),
  dias_uteis int[] not null default '{1,2,3,4,5}',
  expediente_inicio time not null default '08:00',
  expediente_fim time not null default '18:00',
  -- OS
  almoco_inicio time not null default '12:00',
  almoco_fim time not null default '13:00',
  -- Acima deste valor, o orçamento do terceirizado precisa de aprovação
  -- antes de concluir a OS. Null: sem teto.
  teto_terceirizado numeric(14, 2) check (teto_terceirizado >= 0),
  terceirizado_prazo_dias int not null default 7 check (terceirizado_prazo_dias between 1 and 90),
  -- Causa da falha, escolhida ao concluir uma OS corretiva.
  causas_falha text[] not null default '{}',
  -- Ativos
  preventiva_antecedencia_dias int not null default 7 check (preventiva_antecedencia_dias between 0 and 90),
  -- Aviso de garantia vencendo na ficha do ativo (dias antes do fim).
  garantia_aviso_dias int not null default 60 check (garantia_aviso_dias between 0 and 365),
  sinal_peso_avaliar numeric not null default 30,
  sinal_peso_trocar numeric not null default 60,
  sinal_corretivas_avaliar int not null default 3,
  sinal_corretivas_trocar int not null default 5,
  sinal_idade_avaliar_pct numeric not null default 80,
  sinal_idade_trocar_pct numeric not null default 100,
  -- Lembretes recorrentes: cria o próximo N dias antes.
  recorrencia_antecedencia_dias int not null default 3 check (recorrencia_antecedencia_dias between 0 and 60),
  -- Vistorias: textos padrão por tipo ({ entrada: { observacao, termo }, … }).
  vistoria_locador text not null default 'ARP EMPREENDIMENTOS IMOBILIÁRIOS',
  vistoria_local text not null default 'Nova Friburgo - RJ',
  vistoria_ambientes text[] not null default '{}',
  vistoria_textos jsonb not null default '{}',
  -- Portal
  portal_boas_vindas text not null default '',
  -- WhatsApp: modelos das mensagens prontas ({ chave: texto com {{campos}} }).
  mensagens jsonb not null default '{}',
  atualizado_em timestamptz not null default now(),
  check (sinal_peso_avaliar < sinal_peso_trocar),
  check (sinal_corretivas_avaliar < sinal_corretivas_trocar),
  check (sinal_idade_avaliar_pct < sinal_idade_trocar_pct),
  check (almoco_inicio < almoco_fim),
  check (expediente_inicio < expediente_fim)
);
insert into os.parametros (id) values (1);

create table os.feriados (
  data date primary key,
  nome text not null check (btrim(nome) <> '')
);

-- Agendas (telhado, vistorias, doca…): janela do dia e limite.
create table os.agendas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (btrim(nome) <> ''),
  hora_inicio time not null,
  hora_fim time not null,
  duracao_min int not null default 60 check (duracao_min between 15 and 720),
  limite_por_dia int not null check (limite_por_dia > 0),
  -- Até quantos dias à frente o lojista vê horários livres no portal.
  antecedencia_dias int not null default 30 check (antecedencia_dias between 1 and 180),
  dias_semana int[] not null default '{1,2,3,4,5,6}',
  -- Instruções ao lojista na hora de marcar.
  orientacao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (hora_inicio < hora_fim)
);

-- ---------------------------------------------------------------------------
-- Catálogo por setor (4.5)
-- ---------------------------------------------------------------------------

create table os.categorias (
  id uuid primary key default gen_random_uuid(),
  setor_id uuid not null references os.setores (id) on delete cascade,
  -- Subcategoria: um nível só (ex.: Estrutura › Telhado).
  pai_id uuid references os.categorias (id) on delete cascade,
  nome text not null check (btrim(nome) <> ''),
  icone text not null default 'tag',
  cor text check (cor ~ '^#[0-9a-fA-F]{6}$'),
  ordem int not null default 0,
  ativo boolean not null default true,
  -- Comportamento
  tipo_padrao os.tipo_chamado not null default 'solicitacao',
  responsavel_padrao_id uuid references core.usuarios (id) on delete set null,
  prioridade_padrao os.prioridade not null default 'media',
  prazo_valor int check (prazo_valor > 0),
  prazo_unidade os.unidade_prazo not null default 'dias_uteis',
  -- SLA de primeira resposta (horas corridas). Null: sem meta de resposta.
  resposta_horas int check (resposta_horas > 0),
  precisa_confirmacao boolean not null default true,
  -- Recursos
  registrar_tempo boolean not null default false,
  vincular_ativo boolean not null default false,
  vincular_loja boolean not null default false,
  agenda_id uuid references os.agendas (id) on delete set null,
  -- Preventiva não conta como corretiva no sinal de troca.
  preventiva boolean not null default false,
  -- Prazo de retorno do terceirizado (ex.: projeto de cliente, 7 dias úteis).
  prazo_terceirizado_dias int check (prazo_terceirizado_dias > 0),
  -- Campos extras: [{ chave, rotulo, tipo, opcoes?, obrigatorio? }].
  campos jsonb not null default '[]' check (jsonb_typeof(campos) = 'array'),
  -- Checklist padrão: [{ texto, obrigatorio? }]. Item obrigatório pendente
  -- impede concluir.
  checklist jsonb not null default '[]' check (jsonb_typeof(checklist) = 'array'),
  -- Portal do lojista
  no_portal boolean not null default false,
  orientacao_portal text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique nulls not distinct (setor_id, pai_id, nome)
);
create index categorias_setor on os.categorias (setor_id);

-- Metas dos painéis: por setor e/ou categoria (nenhum = geral).
create table os.metas (
  id uuid primary key default gen_random_uuid(),
  setor_id uuid references os.setores (id) on delete cascade,
  categoria_id uuid references os.categorias (id) on delete cascade,
  indicador text not null check (indicador in ('pct_no_prazo', 'tempo_medio_horas')),
  meta numeric not null check (meta >= 0),
  -- Até onde fica amarelo antes de vermelho. Null: sem faixa amarela.
  limite_atencao numeric check (limite_atencao >= 0),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique nulls not distinct (setor_id, categoria_id, indicador)
);

-- ---------------------------------------------------------------------------
-- Lojas: um contrato de locação (ENET, só leitura) por linha. O histórico
-- fica no contrato, não no imóvel: um novo locatário na mesma LUC é outra
-- linha. Até a API do ENET, cadastro manual ou dados de exemplo.
-- ---------------------------------------------------------------------------

create table os.lojas (
  id uuid primary key default gen_random_uuid(),
  enet_id text unique,
  contrato text,
  luc text not null check (btrim(luc) <> ''),
  nome text not null check (btrim(nome) <> ''),
  locatario text,
  cnpj text,
  bloco text,
  situacao text not null default 'vigente' check (situacao in ('vigente', 'encerrado')),
  inicio date,
  fim date,
  telefone text,
  tem_vaga boolean,
  exemplo boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index lojas_luc on os.lojas (luc);

-- ---------------------------------------------------------------------------
-- Técnicos, terceirizados e contatos
-- ---------------------------------------------------------------------------

-- Quem registra tempo em OS. Ligado ao usuário quando houver. Desligado
-- continua nas OS antigas e sai dos painéis a partir da data.
create table os.tecnicos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  usuario_id uuid unique references core.usuarios (id) on delete set null,
  setor_id uuid references os.setores (id) on delete set null,
  desligado_em date,
  legado_id text unique,
  importacao_id uuid,
  exemplo boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Valor por minuto com vigência: mudar o valor não recalcula OS antigas
-- (cada sessão usa o valor vigente na data dela). Só com os.custos.
create table os.tecnico_valores (
  id uuid primary key default gen_random_uuid(),
  tecnico_id uuid not null references os.tecnicos (id) on delete cascade,
  vigente_desde date not null,
  valor_minuto numeric(14, 6) not null check (valor_minuto >= 0),
  criado_em timestamptz not null default now(),
  unique (tecnico_id, vigente_desde)
);

create table os.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  cnpj text,
  contato text,
  telefone text,
  email text,
  servicos text,
  prazo_retorno_dias int check (prazo_retorno_dias > 0),
  ativo boolean not null default true,
  legado_id text unique,
  importacao_id uuid,
  exemplo boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table os.profissionais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references os.empresas (id) on delete cascade,
  nome text not null check (btrim(nome) <> ''),
  telefone text,
  ativo boolean not null default true,
  legado_id text unique,
  importacao_id uuid,
  exemplo boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Contatos salvos para o WhatsApp (colaboradores, lojistas, fornecedores).
create table os.contatos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  telefone text not null check (btrim(telefone) <> ''),
  empresa text,
  observacao text,
  legado_id text unique,
  importacao_id uuid,
  exemplo boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Ativos (4.9)
-- ---------------------------------------------------------------------------

create table os.ativo_categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (btrim(nome) <> ''),
  vida_util_padrao_anos numeric(5, 1) check (vida_util_padrao_anos > 0),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create sequence os.ativo_codigo_seq;

create table os.ativos (
  id uuid primary key default gen_random_uuid(),
  -- Vai na etiqueta QR.
  codigo text not null unique default 'AT-' || lpad(nextval('os.ativo_codigo_seq')::text, 4, '0'),
  nome text not null check (btrim(nome) <> ''),
  categoria_id uuid references os.ativo_categorias (id) on delete set null,
  fabricante text,
  modelo text,
  numero_serie text,
  -- Local: bloco, loja ou área comum, e o ponto (ex.: casa de máquinas).
  bloco text,
  loja_id uuid references os.lojas (id) on delete set null,
  area text,
  ponto text,
  compra_data date,
  compra_valor numeric(14, 2) check (compra_valor >= 0),
  garantia_fim date,
  fornecedor_id uuid references os.empresas (id) on delete set null,
  valor_reposicao numeric(14, 2) check (valor_reposicao > 0),
  vida_util_anos numeric(5, 1) check (vida_util_anos > 0),
  situacao os.situacao_ativo not null default 'em_uso',
  baixa_data date,
  baixa_motivo text,
  setor_id uuid references os.setores (id) on delete set null,
  responsavel_id uuid references core.usuarios (id) on delete set null,
  observacao text,
  legado_id text unique,
  importacao_id uuid,
  exemplo boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (situacao <> 'baixado' or (baixa_data is not null and baixa_motivo is not null))
);
create index ativos_categoria on os.ativos (categoria_id);

-- Períodos de cada situação, para os "dias parado". Mantido por gatilho.
create table os.ativo_situacoes (
  id uuid primary key default gen_random_uuid(),
  ativo_id uuid not null references os.ativos (id) on delete cascade,
  situacao os.situacao_ativo not null,
  desde timestamptz not null default now(),
  ate timestamptz,
  usuario_id uuid
);
create index ativo_situacoes_ativo on os.ativo_situacoes (ativo_id, desde);

-- Plano preventivo: cria a OS sozinho N dias antes da próxima data.
create table os.planos_preventivos (
  id uuid primary key default gen_random_uuid(),
  ativo_id uuid not null references os.ativos (id) on delete cascade,
  titulo text not null check (btrim(titulo) <> ''),
  descricao text,
  frequencia_dias int check (frequencia_dias > 0),
  frequencia_meses int check (frequencia_meses > 0),
  proxima_data date not null,
  -- Null: vale o padrão dos parâmetros.
  antecedencia_dias int check (antecedencia_dias >= 0),
  setor_id uuid not null references os.setores (id) on delete cascade,
  categoria_id uuid references os.categorias (id) on delete set null,
  responsavel_id uuid references core.usuarios (id) on delete set null,
  checklist jsonb not null default '[]' check (jsonb_typeof(checklist) = 'array'),
  ativo boolean not null default true,
  exemplo boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (num_nonnulls(frequencia_dias, frequencia_meses) = 1)
);
create index planos_ativo on os.planos_preventivos (ativo_id);

-- ---------------------------------------------------------------------------
-- Modelos de entrada e saída de cliente (4.12)
-- ---------------------------------------------------------------------------

create table os.modelos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (btrim(nome) <> ''),
  -- entrada/saida: disparados pelo ENET (contrato novo, rescisão); manual:
  -- só pelo botão "Disparar modelo".
  gatilho text not null check (gatilho in ('entrada', 'saida', 'manual')),
  descricao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table os.modelo_itens (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid not null references os.modelos (id) on delete cascade,
  ordem int not null default 0,
  setor_id uuid not null references os.setores (id) on delete cascade,
  categoria_id uuid references os.categorias (id) on delete set null,
  titulo text not null check (btrim(titulo) <> ''),
  descricao text,
  -- Prazo em dias a partir da data do contrato (início ou saída).
  prazo_dias int not null default 0,
  responsavel_id uuid references core.usuarios (id) on delete set null,
  -- tem_vaga: credenciamento só se o contrato tiver vaga.
  condicao text not null default 'sempre' check (condicao in ('sempre', 'tem_vaga')),
  -- O que o item faz sozinho, além de virar uma linha do Aviso.
  acao text not null default 'nenhuma' check (acao in (
    'nenhuma', 'vistoria_entrada', 'vistoria_saida', 'portal_gerar', 'portal_cancelar'
  )),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Vistorias de locação (4.10 e 4.16 B)
-- ---------------------------------------------------------------------------

create table os.vistorias (
  id uuid primary key default gen_random_uuid(),
  -- ARP01…ARP09, ARP10… (padrão em os.proximo_codigo_vistoria). Editável.
  codigo text not null unique check (btrim(codigo) <> ''),
  tipo os.tipo_vistoria not null,
  status os.status_vistoria not null default 'andamento',
  rascunho boolean not null default true,
  data date not null,
  hora time,
  vistoriador_id uuid references core.usuarios (id) on delete set null,
  vistoriador_nome text not null check (btrim(vistoriador_nome) <> ''),
  locador text not null,
  loja_id uuid references os.lojas (id) on delete set null,
  locatario text not null,
  bloco text not null,
  unidade text not null,
  -- Entrada: "Autorizado início da obra (Projeto)"; saída: "Teve vistoria de
  -- constatação?".
  campo_tipo text check (campo_tipo in ('sim', 'nao', 'nao_se_aplica')),
  itens_anteriores text,
  observacao text not null default '',
  consideracoes text,
  termo text not null default '',
  local_data text not null default '',
  -- Vistoria de entrada do mesmo contrato (para comparar na saída).
  entrada_id uuid references os.vistorias (id) on delete set null,
  -- Incluir as fotos da entrada no laudo de saída.
  comparar_no_laudo boolean not null default false,
  assinatura_locador_path text,
  assinatura_locatario_path text,
  assinado_em timestamptz,
  legado_id text unique,
  importacao_id uuid,
  exemplo boolean not null default false,
  criado_por uuid references core.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table os.vistoria_ambientes (
  id uuid primary key default gen_random_uuid(),
  vistoria_id uuid not null references os.vistorias (id) on delete cascade,
  ordem int not null default 0,
  titulo text not null check (btrim(titulo) <> ''),
  resposta os.resposta_ambiente not null default 'respondido',
  descricao text,
  problema boolean not null default false,
  -- Ambiente da vistoria de entrada equivalente (comparação na saída).
  entrada_ambiente_id uuid references os.vistoria_ambientes (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index vistoria_ambientes_vistoria on os.vistoria_ambientes (vistoria_id, ordem);

-- ---------------------------------------------------------------------------
-- Chamados (4.3 e 4.4)
-- ---------------------------------------------------------------------------

create sequence os.chamado_numero_seq;

create table os.chamados (
  id uuid primary key default gen_random_uuid(),
  -- OS importadas mantêm o número antigo (a importação avança a sequência).
  numero bigint not null unique default nextval('os.chamado_numero_seq'),
  tipo os.tipo_chamado not null,
  titulo text not null check (btrim(titulo) <> ''),
  descricao text,
  setor_id uuid not null references os.setores (id),
  categoria_id uuid references os.categorias (id) on delete set null,
  status os.status_chamado not null default 'aberto',
  prioridade os.prioridade not null default 'media',
  origem os.origem_chamado not null default 'sistema',
  -- Tarefa pessoal rápida: não passa pela confirmação.
  pessoal boolean not null default false,
  precisa_confirmacao boolean not null default true,
  aberto_por uuid references core.usuarios (id) on delete set null,
  -- Quem pediu pelo portal (nome e telefone obrigatórios lá).
  solicitante_nome text,
  solicitante_telefone text,
  responsavel_id uuid references core.usuarios (id) on delete set null,
  prazo timestamptz,
  -- Vínculos
  loja_id uuid references os.lojas (id) on delete set null,
  ativo_id uuid references os.ativos (id) on delete set null,
  vistoria_id uuid references os.vistorias (id) on delete set null,
  ambiente_id uuid references os.vistoria_ambientes (id) on delete set null,
  vinculado_a_id uuid references os.chamados (id) on delete set null,
  convertido_de_id uuid references os.chamados (id) on delete set null,
  convertido_em_id uuid references os.chamados (id) on delete set null,
  -- Campos extras da categoria ({ chave: valor }), etiquetas livres e
  -- checklist ([{ texto, obrigatorio, feito, por, em }]).
  campos jsonb not null default '{}' check (jsonb_typeof(campos) = 'object'),
  etiquetas text[] not null default '{}',
  checklist jsonb not null default '[]' check (jsonb_typeof(checklist) = 'array'),
  -- Ciclo (mantido pelo gatilho os.ciclo_do_chamado)
  primeira_resposta_em timestamptz,
  iniciado_em timestamptz,
  aguardando_desde timestamptz,
  aguardando_tipo os.motivo_aguardando,
  aguardando_motivo text,
  -- Tempo total em Aguardando (desconta do prazo e dos indicadores).
  aguardando_min int not null default 0 check (aguardando_min >= 0),
  concluido_em timestamptz,
  concluido_por uuid references core.usuarios (id) on delete set null,
  fechado_em timestamptz,
  fechado_por uuid references core.usuarios (id) on delete set null,
  fechado_automatico boolean not null default false,
  cancelado_em timestamptz,
  cancelado_por uuid references core.usuarios (id) on delete set null,
  motivo_cancelamento text,
  reaberto_vezes int not null default 0,
  ultimo_motivo_reabertura text,
  -- Ordem de Serviço (4.8)
  execucao os.execucao,
  local text,
  bloco text,
  empresa_id uuid references os.empresas (id) on delete set null,
  visita_data date,
  visita_periodo os.periodo_visita,
  prazo_terceirizado timestamptz,
  cobranca_avisada_em timestamptz,
  solucao text,
  causa_falha text,
  -- Ativo parado enquanto a OS está aberta (volta a "Em uso" ao fechar).
  ativo_parado boolean not null default false,
  rateio boolean not null default false,
  assinatura_nome text,
  assinatura_path text,
  assinado_em timestamptz,
  -- Portal: avaliação do lojista ao concluir.
  avaliacao smallint check (avaliacao between 1 and 5),
  avaliacao_comentario text,
  avaliado_em timestamptz,
  -- Repetir: { frequencia, intervalo?, dias_semana?, dia_mes?, fim? }. A
  -- série guarda a data de cada ocorrência: nunca duas na mesma data.
  recorrencia jsonb,
  serie_id uuid,
  serie_data date,
  plano_id uuid references os.planos_preventivos (id) on delete set null,
  plano_data date,
  -- Lixeira: nada é apagado de verdade.
  lixeira_em timestamptz,
  lixeira_por uuid references core.usuarios (id) on delete set null,
  -- Importação do sistema atual
  legado_origem text,
  legado_id text,
  importacao_id uuid,
  exemplo boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (status <> 'aguardando' or aguardando_tipo is not null),
  check (status <> 'cancelado' or nullif(btrim(motivo_cancelamento), '') is not null),
  check (tipo = 'os' or execucao is null),
  unique (serie_id, serie_data),
  unique (plano_id, plano_data),
  unique (legado_origem, legado_id)
);

create index chamados_setor_status on os.chamados (setor_id, status);
create index chamados_responsavel on os.chamados (responsavel_id, status);
create index chamados_aberto_por on os.chamados (aberto_por, status);
create index chamados_loja on os.chamados (loja_id);
create index chamados_ativo on os.chamados (ativo_id);
create index chamados_prazo on os.chamados (prazo)
  where status in ('aberto', 'em_andamento', 'aguardando');
create index chamados_criado on os.chamados (criado_em desc);
-- Painéis: fechados e concluídos no período.
create index chamados_concluido on os.chamados (concluido_em) where concluido_em is not null;
create index chamados_fechado on os.chamados (fechado_em) where fechado_em is not null;

-- Vários destinatários (setores ou pessoas), cada um com o próprio andamento.
-- O chamado só conclui quando todos concluírem.
create table os.destinatarios (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references os.chamados (id) on delete cascade,
  setor_id uuid references os.setores (id) on delete cascade,
  usuario_id uuid references core.usuarios (id) on delete cascade,
  -- Item do modelo de entrada/saída (título e prazo próprios).
  titulo text,
  prazo timestamptz,
  status os.status_destino not null default 'aberto',
  responsavel_id uuid references core.usuarios (id) on delete set null,
  lido_em timestamptz,
  concluido_em timestamptz,
  concluido_por uuid references core.usuarios (id) on delete set null,
  observacao text,
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (num_nonnulls(setor_id, usuario_id) >= 1)
);
create index destinatarios_chamado on os.destinatarios (chamado_id);
create index destinatarios_setor on os.destinatarios (setor_id);
create index destinatarios_usuario on os.destinatarios (usuario_id);

-- Citados (@) e quem segue o chamado: veem e recebem as notificações.
create table os.participantes (
  chamado_id uuid not null references os.chamados (id) on delete cascade,
  usuario_id uuid not null references core.usuarios (id) on delete cascade,
  motivo text not null default 'seguindo' check (motivo in ('mencionado', 'seguindo')),
  criado_em timestamptz not null default now(),
  primary key (chamado_id, usuario_id)
);
create index participantes_usuario on os.participantes (usuario_id);

-- Linha do tempo única: conversa, mudanças, anexos e quem fez cada coisa.
create table os.eventos (
  id bigint generated always as identity primary key,
  chamado_id uuid not null references os.chamados (id) on delete cascade,
  tipo text not null check (tipo in (
    'criado', 'comentario', 'status', 'alteracao', 'anexo', 'tempo',
    'conversao', 'portal', 'terceirizado', 'sistema'
  )),
  texto text,
  -- Contexto: { de, para, campo, … }.
  dados jsonb not null default '{}',
  -- Comentário que o lojista vê no portal. Nota interna = false.
  visivel_lojista boolean not null default false,
  autor_id uuid references core.usuarios (id) on delete set null,
  -- Lojista, terceirizado ou "Sistema" (sem usuário).
  autor_nome text,
  em timestamptz not null default now()
);
create index eventos_chamado on os.eventos (chamado_id, em);

-- Arquivos no bucket privado "os". Caminho: <dono>/<id do dono>/<arquivo>.
create table os.anexos (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid references os.chamados (id) on delete cascade,
  evento_id bigint references os.eventos (id) on delete set null,
  vistoria_id uuid references os.vistorias (id) on delete cascade,
  ambiente_id uuid references os.vistoria_ambientes (id) on delete cascade,
  ativo_id uuid references os.ativos (id) on delete cascade,
  categoria text not null default 'anexo' check (categoria in (
    'foto', 'antes', 'depois', 'anexo', 'assinatura', 'laudo', 'orcamento',
    'manual', 'nota_fiscal'
  )),
  nome text not null,
  path text not null unique,
  mime text,
  tamanho int,
  visivel_lojista boolean not null default false,
  enviado_por uuid references core.usuarios (id) on delete set null,
  enviado_por_nome text,
  importacao_id uuid,
  exemplo boolean not null default false,
  em timestamptz not null default now(),
  check (num_nonnulls(chamado_id, vistoria_id, ambiente_id, ativo_id) >= 1)
);
create index anexos_chamado on os.anexos (chamado_id);
create index anexos_ambiente on os.anexos (ambiente_id);
create index anexos_ativo on os.anexos (ativo_id);

-- Sessões de trabalho (substituem "continua em outra data"). fim null =
-- cronômetro rodando (Iniciar no celular).
create table os.sessoes (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references os.chamados (id) on delete cascade,
  data date not null,
  inicio time not null,
  fim time,
  almoco_inicio time,
  almoco_fim time,
  observacao text,
  criado_por uuid references core.usuarios (id) on delete set null,
  importacao_id uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check ((almoco_inicio is null) = (almoco_fim is null)),
  check (almoco_inicio is null or almoco_inicio < almoco_fim)
);
create index sessoes_chamado on os.sessoes (chamado_id, data);

create table os.sessao_tecnicos (
  sessao_id uuid not null references os.sessoes (id) on delete cascade,
  tecnico_id uuid not null references os.tecnicos (id),
  primary key (sessao_id, tecnico_id)
);
create index sessao_tecnicos_tecnico on os.sessao_tecnicos (tecnico_id);

-- Materiais: o que foi usado (todos veem). O valor fica em material_valores.
create table os.materiais (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references os.chamados (id) on delete cascade,
  descricao text not null check (btrim(descricao) <> ''),
  quantidade numeric(12, 3) not null check (quantidade > 0),
  unidade text,
  criado_por uuid references core.usuarios (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index materiais_chamado on os.materiais (chamado_id);

create table os.material_valores (
  material_id uuid primary key references os.materiais (id) on delete cascade,
  valor_unitario numeric(14, 4) not null check (valor_unitario >= 0)
);

-- Dinheiro da OS (só com os.custos): o que se digita (terceirizado, rateio)
-- e o resultado do cálculo, gravado pelo servidor (os.gravar_calculo_os)
-- com o valor por minuto vigente em cada sessão.
create table os.os_custos (
  chamado_id uuid primary key references os.chamados (id) on delete cascade,
  valor_terceirizado numeric(14, 2) check (valor_terceirizado >= 0),
  orcamento_numero text,
  orcamento_aprovado_em timestamptz,
  orcamento_aprovado_por uuid references core.usuarios (id) on delete set null,
  rateio_regra os.regra_rateio,
  -- Divisão manual: valor em reais; porcentagem: % do valor da OS.
  rateio_valor numeric(14, 4),
  -- Resultado
  minutos int,
  minuto_homem int,
  custo_mao_obra numeric(14, 2),
  custo_materiais numeric(14, 2),
  custo_total numeric(14, 2),
  valor_rateio numeric(14, 2),
  completo boolean,
  memoria jsonb not null default '[]',
  calculado_em timestamptz,
  -- Valores do sistema atual, para a conferência centavo a centavo.
  legado_valor numeric(14, 2),
  legado_valor_rateio numeric(14, 2),
  legado_minutos int,
  legado_minuto_homem int,
  atualizado_em timestamptz not null default now()
);

create table os.chamado_profissionais (
  chamado_id uuid not null references os.chamados (id) on delete cascade,
  profissional_id uuid not null references os.profissionais (id) on delete cascade,
  primary key (chamado_id, profissional_id)
);

-- Link da OS para o terceirizado: sem login. Para de funcionar quando a OS
-- fecha ou é cancelada (o servidor confere) ou quando é cancelado aqui.
create table os.terceirizado_links (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references os.chamados (id) on delete cascade,
  token text not null unique check (length(token) >= 32),
  empresa_id uuid references os.empresas (id) on delete set null,
  criado_por uuid references core.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  aceito_em timestamptz,
  recusado_em timestamptz,
  recusa_motivo text,
  chegada_em timestamptz,
  -- Localização do aparelho ao tocar "Cheguei"/"Terminei" (se permitida).
  chegada_local jsonb,
  saida_em timestamptz,
  saida_local jsonb,
  solucao text,
  valor_informado numeric(14, 2) check (valor_informado >= 0),
  orcamento_numero text,
  terminado_em timestamptz,
  cancelado_em timestamptz,
  ultimo_acesso_em timestamptz
);
create unique index terceirizado_links_um_ativo on os.terceirizado_links (chamado_id)
  where cancelado_em is null;

-- ---------------------------------------------------------------------------
-- Portal do lojista e agendas (4.11)
-- ---------------------------------------------------------------------------

create table os.portal_links (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references os.lojas (id) on delete cascade,
  token text not null unique check (length(token) >= 32),
  criado_por uuid references core.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  enviado_em timestamptz,
  cancelado_em timestamptz,
  cancelado_por uuid references core.usuarios (id) on delete set null,
  ultimo_acesso_em timestamptz
);
create unique index portal_links_um_ativo on os.portal_links (loja_id)
  where cancelado_em is null;

create table os.agenda_bloqueios (
  id uuid primary key default gen_random_uuid(),
  agenda_id uuid not null references os.agendas (id) on delete cascade,
  inicio timestamptz not null,
  fim timestamptz not null,
  motivo text not null check (btrim(motivo) <> ''),
  criado_por uuid references core.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  check (inicio < fim)
);

create table os.agendamentos (
  id uuid primary key default gen_random_uuid(),
  agenda_id uuid not null references os.agendas (id) on delete cascade,
  chamado_id uuid references os.chamados (id) on delete cascade,
  loja_id uuid references os.lojas (id) on delete set null,
  inicio timestamptz not null,
  fim timestamptz not null,
  status os.status_agendamento not null default 'marcado',
  observacao text,
  criado_por uuid references core.usuarios (id) on delete set null,
  importacao_id uuid,
  exemplo boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (inicio < fim)
);
create index agendamentos_agenda on os.agendamentos (agenda_id, inicio);

-- Disparo de um modelo para um contrato: uma vez só por modelo e loja.
create table os.disparos (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid not null references os.modelos (id) on delete cascade,
  loja_id uuid not null references os.lojas (id) on delete cascade,
  chamado_id uuid references os.chamados (id) on delete set null,
  automatico boolean not null default false,
  disparado_por uuid references core.usuarios (id) on delete set null,
  em timestamptz not null default now(),
  unique (modelo_id, loja_id)
);

-- ---------------------------------------------------------------------------
-- Notificações dentro do sistema (sininho). Só o servidor grava.
-- ---------------------------------------------------------------------------

create table os.notificacoes (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references core.usuarios (id) on delete cascade,
  chamado_id uuid references os.chamados (id) on delete cascade,
  tipo text not null check (tipo ~ '^[a-z_]+$'),
  titulo text not null,
  texto text,
  href text not null,
  -- Evita repetir o mesmo aviso (ex.: "vence em 24h" do mesmo chamado).
  chave text,
  lida_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (usuario_id, chave)
);
create index notificacoes_usuario on os.notificacoes (usuario_id, criado_em desc);

-- ---------------------------------------------------------------------------
-- Importação única do sistema de OS atual (4.14)
-- ---------------------------------------------------------------------------

create table os.importacoes (
  id uuid primary key default gen_random_uuid(),
  arquivo_nome text not null,
  arquivo_path text,
  status text not null default 'previa' check (status in ('previa', 'confirmada', 'desfeita')),
  -- Contagens dos dois lados, problemas e o status escolhido para os que
  -- não estão na correspondência.
  resumo jsonb not null default '{}',
  problemas jsonb not null default '[]',
  mapeamento jsonb not null default '{}',
  enviado_por uuid references core.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  confirmado_em timestamptz,
  confirmado_por uuid references core.usuarios (id) on delete set null,
  desfeito_em timestamptz,
  desfeito_por uuid references core.usuarios (id) on delete set null
);
