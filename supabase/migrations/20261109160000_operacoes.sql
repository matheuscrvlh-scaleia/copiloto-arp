-- operacoes: Módulo Operações (spec de 04/11/2026, revisão de 09/11/2026).
--
-- Água (faturamento individualizado do parceiro de gestão hídrica), energia
-- (quadros de medidores, termo de autorização, contas da área comum e a
-- consulta da geração solar), rateio da limpeza e obras (orçamento previsto
-- e realizado, e a cópia do que a API do Diário de Obra devolve).
--
-- Regras gerais:
--   * Nada de valor de negócio fixo no código: limites, contrato da limpeza,
--     dados da ARP no termo e o que mais muda ficam em operacoes.parametros.
--   * Toda importação passa por operacoes.importacoes (prévia → confirmada →
--     desfeita ou substituída). As linhas de uma prévia já ficam gravadas
--     (área temporária, "vigente = false") e só passam a valer na confirmação,
--     que é atômica (funções abaixo). Desfazer volta à versão anterior.
--   * Valores em reais da água ficam em tabelas à parte, com RLS própria
--     (operacoes.agua.valores): sem a permissão, a pessoa só vê m³.
--   * O histórico de ocupantes das caixas é sigiloso (operacoes.energia.historico).
--   * O Diário de Obra é só consulta: as tabelas diario_* são uma cópia que só
--     a sincronização (service role) grava.
--   * Datas de referência mensais são o primeiro dia do mês (aaaa-mm-01).

create schema operacoes;
grant usage on schema operacoes to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Permissões (mesmo catálogo de src/lib/permissions.ts)
-- ---------------------------------------------------------------------------

insert into core.permissoes (codigo, descricao) values
  ('operacoes.agua.ver', 'Ver leituras do mês, hidrômetros, extrato e galeria de fotos da água'),
  ('operacoes.agua.valores', 'Ver os valores em reais da água (sem ela, só m³)'),
  ('operacoes.agua.importar', 'Importar o faturamento da água (planilha ou PDF e fotos), ver a prévia e desfazer'),
  ('operacoes.agua.vinculo', 'Ligar um hidrômetro a outra sala ou bloco, com registro de quem mudou'),
  ('operacoes.energia.ver', 'Ver os quadros de medidores e a ficha de cada caixa'),
  ('operacoes.energia.editar', 'Criar quadro e mudar caixa (status, sala, disjuntor, medidor, observações)'),
  ('operacoes.energia.historico', 'Ver o histórico de locatários anteriores da caixa (sigiloso, nunca sai no termo)'),
  ('operacoes.energia.termo', 'Gerar, baixar e reimprimir o termo de autorização de energia'),
  ('operacoes.energia.contas', 'Ver e importar as faturas da Energisa da área comum'),
  ('operacoes.solar.ver', 'Ver a consulta da geração solar, da compensação e do saldo de créditos'),
  ('operacoes.limpeza.ver', 'Ver o rateio da limpeza, a memória de cálculo e o histórico'),
  ('operacoes.limpeza.fechar', 'Lançar funcionários, minutos e extras do rateio, fechar, reabrir e enviar ao Financeiro'),
  ('operacoes.obras.ver', 'Ver as obras, o previsto e realizado e o painel de obras'),
  ('operacoes.obras.importar', 'Importar a planilha de orçamento e lançar o realizado'),
  ('operacoes.obras.diario', 'Ver as telas do Diário de Obra: painel, obra, relatórios e tarefas'),
  ('operacoes.obras.atualizar', 'Usar o botão Atualizar agora da consulta ao Diário de Obra'),
  ('operacoes.painel', 'Ver os cartões e gráficos do Painel de Operações'),
  ('operacoes.exportar', 'Exportar Excel e PDF nas telas de Operações'),
  ('operacoes.parametros', 'Editar os parâmetros de Operações (limites, contrato da limpeza, termo, obras)'),
  ('os.ativos_saida', 'Registrar a saída de um ativo (venda, doação, descarte, devolução) e desfazer');

-- Administrador tem tudo; os outros cargos recebem em Usuários e cargos.
insert into core.cargo_permissoes (cargo_id, permissao)
  select c.id, p.codigo
  from core.cargos c
  join core.permissoes p on p.codigo like 'operacoes.%' or p.codigo = 'os.ativos_saida'
  where c.nome = 'Administrador'
on conflict do nothing;

-- Quem usa alguma tela do módulo (parâmetros e cadastros de apoio).
create function operacoes.acessa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select core.pode_modulo('operacoes');
$$;

-- ---------------------------------------------------------------------------
-- Parâmetros (linha única)
-- ---------------------------------------------------------------------------

create table operacoes.parametros (
  id boolean primary key default true check (id),
  -- Água
  agua_limite_m3 numeric(10, 2) not null default 30 check (agua_limite_m3 > 0),
  -- Diferença aceita entre a soma das linhas e o resumo do arquivo (reais e m³).
  agua_tolerancia numeric(10, 2) not null default 0.01 check (agua_tolerancia >= 0),
  agua_blocos text[] not null default '{01,02,04,05,09,10,11,12,14,16,85}',
  agua_parceiro text not null default 'Parceiro de gestão hídrica',
  -- Modelo de importação da planilha: { "campo": "coluna ou título" }.
  agua_modelo jsonb not null default '{}',
  -- Energia: termo de autorização
  termo_razao_social text not null default 'ARP EMPREENDIMENTOS IMOBILIÁRIOS LTDA',
  termo_cnpj text not null default '33.111.139/0001-61',
  termo_endereco text not null default 'Av. Conselheiro Julius Arp, nº 80, Centro, Nova Friburgo/RJ',
  termo_cidade text not null default 'Nova Friburgo',
  termo_qualificacao_cpf text not null default 'pessoa física, locatária',
  termo_qualificacao_cnpj text not null default 'pessoa jurídica, locatária',
  termo_nome_arquivo text not null default 'TERMO DE AUTORIZACAO DE ENERGIA - BL[bloco] - [sala] - [LOCATARIO]',
  -- Energia: quadros e contas
  energia_disjuntores text[] not null default '{"40A Monofásico","40A Bifásico","40A Trifásico","50A Trifásico","70A Trifásico"}',
  energia_ligacoes text[] not null default '{Monofásica,Bifásica,Trifásica}',
  energia_medidor_situacoes text[] not null default '{"Medidor ativo","Chicote de espera","Cabos de espera","Tampa cega",Outro}',
  energia_alerta_pct numeric(6, 2) not null default 20 check (energia_alerta_pct > 0),
  solar_fonte text not null default 'a_confirmar'
    check (solar_fonte in ('a_confirmar', 'inversor', 'planilha', 'fatura_geradora')),
  -- Limpeza
  limpeza_empresa text not null default 'Black Star',
  limpeza_func_base int not null default 9 check (limpeza_func_base > 0),
  limpeza_func_area_comum int not null default 5 check (limpeza_func_area_comum >= 0),
  limpeza_func_rateados int not null default 4 check (limpeza_func_rateados >= 0),
  limpeza_blocos text[] not null default '{01,02,04,05,09,10,11}',
  -- Dia útil do mês seguinte até o qual o rateio vai ao Financeiro.
  limpeza_dia_util_envio int not null default 5 check (limpeza_dia_util_envio between 1 and 20),
  -- Extras padrão: [{ "descricao": "...", "valor_dia": 315.00 }].
  limpeza_extras_padrao jsonb not null default '[]',
  -- Obras
  obras_intervalo_min int not null default 60 check (obras_intervalo_min in (30, 60, 240)),
  -- Dias da semana (1 = segunda … 7 = domingo) que contam para "dia sem relatório".
  obras_dias_relatorio int[] not null default '{1,2,3,4,5,6}',
  obras_limite_desvio numeric(6, 2) not null default -10,
  obras_limite_orcamento_pct numeric(6, 2) not null default 10 check (obras_limite_orcamento_pct >= 0),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  check (limpeza_func_area_comum + limpeza_func_rateados <= limpeza_func_base)
);
insert into operacoes.parametros (id, limpeza_extras_padrao) values (true, '[
  {"descricao": "Vigia extra fins de semana", "valor_dia": 315.00},
  {"descricao": "Limpeza extra banheiros domingos e feriados", "valor_dia": 315.00},
  {"descricao": "Limpeza banheiros (por auxiliar/mês)", "valor_dia": 3897.00},
  {"descricao": "Insalubridade espaço pet", "valor_dia": 278.68},
  {"descricao": "Insalubridade limpeza de banheiro", "valor_dia": 2497.99}
]');

-- ---------------------------------------------------------------------------
-- Importações (todas as do módulo)
-- ---------------------------------------------------------------------------

create table operacoes.importacoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('agua', 'energisa', 'orcamento', 'limpeza')),
  status text not null default 'previa'
    check (status in ('previa', 'confirmada', 'desfeita', 'substituida', 'cancelada')),
  -- Mês (aaaa-mm-01) ou, no orçamento, a obra e a revisão ("Edifício garagem R01").
  referencia text not null,
  -- [{ "nome", "caminho", "sha256", "bytes" }]
  arquivos jsonb not null default '[]',
  -- O que foi lido e o resumo do arquivo, sem reais da água (ver importacao_valores).
  resumo jsonb not null default '{}',
  -- [{ "nivel": "erro"|"aviso"|"info", "bloco"?, "linha"?, "mensagem" }]
  avisos jsonb not null default '[]',
  -- Conciliação com o resumo do arquivo.
  bate boolean,
  incompleta boolean not null default false,
  motivo text check (length(motivo) <= 500),
  -- Importação que esta substituiu (volta a valer se esta for desfeita).
  substitui uuid references operacoes.importacoes (id) on delete set null,
  exemplo boolean not null default false,
  criado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  confirmado_por uuid references core.usuarios (id) on delete set null,
  confirmado_em timestamptz,
  desfeito_por uuid references core.usuarios (id) on delete set null,
  desfeito_em timestamptz,
  check (not incompleta or motivo is not null)
);
create index importacoes_tipo on operacoes.importacoes (tipo, criado_em desc);
create index importacoes_substitui on operacoes.importacoes (substitui);
create index importacoes_criado_por on operacoes.importacoes (criado_por);
create index importacoes_confirmado_por on operacoes.importacoes (confirmado_por);
create index importacoes_desfeito_por on operacoes.importacoes (desfeito_por);
-- Um mês de água confirmado por vez.
create unique index importacoes_agua_vigente on operacoes.importacoes (referencia)
  where tipo = 'agua' and status = 'confirmada';

-- Totais em reais da conciliação da água (RLS de operacoes.agua.valores).
create table operacoes.importacao_valores (
  importacao_id uuid primary key references operacoes.importacoes (id) on delete cascade,
  valor_arquivo numeric(14, 2),
  valor_lido numeric(14, 2),
  -- { "05": { "arquivo": 17295.42, "lido": 16088.07 } }
  por_bloco jsonb not null default '{}'
);

-- ---------------------------------------------------------------------------
-- Água
-- ---------------------------------------------------------------------------

create table operacoes.agua_leituras (
  id uuid primary key default gen_random_uuid(),
  importacao_id uuid not null references operacoes.importacoes (id) on delete cascade,
  -- false enquanto a importação é prévia ou depois que foi desfeita/substituída.
  vigente boolean not null default false,
  referencia date not null check (extract(day from referencia) = 1),
  bloco text not null check (bloco ~ '^\d{2}$'),
  sala text not null default '',
  cliente text not null default '',
  hidrometro text not null check (length(btrim(hidrometro)) between 1 and 40),
  data_anterior date,
  leitura_anterior numeric(14, 3),
  data_atual date,
  leitura_atual numeric(14, 3),
  dias int check (dias >= 0),
  consumo numeric(14, 3) not null default 0,
  volume_faturado numeric(14, 3) not null default 0,
  tipo text not null check (tipo in ('FATURADO', 'MINIMO', 'ZERO', 'REFATURADO')),
  -- Caminho da foto do visor (src/server/arquivos, bucket "operacoes").
  foto text,
  -- Linha no arquivo, para a prévia mostrar de onde veio.
  linha_arquivo int,
  exemplo boolean not null default false
);
create index agua_leituras_importacao on operacoes.agua_leituras (importacao_id);
create index agua_leituras_mes on operacoes.agua_leituras (referencia, bloco) where vigente;
create index agua_leituras_hidrometro on operacoes.agua_leituras (hidrometro, referencia) where vigente;
create unique index agua_leituras_unica on operacoes.agua_leituras (referencia, hidrometro, bloco, sala)
  where vigente;

create table operacoes.agua_valores (
  leitura_id uuid primary key references operacoes.agua_leituras (id) on delete cascade,
  valor numeric(14, 2) not null
);

-- Correção do vínculo do hidrômetro (sala e bloco) a partir de um mês.
create table operacoes.agua_vinculos (
  id uuid primary key default gen_random_uuid(),
  hidrometro text not null,
  desde date not null check (extract(day from desde) = 1),
  bloco text not null check (bloco ~ '^\d{2}$'),
  sala text not null,
  motivo text not null check (length(btrim(motivo)) between 3 and 500),
  criado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  unique (hidrometro, desde)
);
create index agua_vinculos_criado_por on operacoes.agua_vinculos (criado_por);

-- ---------------------------------------------------------------------------
-- Energia: salas, quadros, caixas, ocupantes e termos
-- ---------------------------------------------------------------------------

create table operacoes.salas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,               -- ex.: BL04-311
  bloco text not null check (bloco ~ '^\d{2}$'),
  sala text not null,                        -- ex.: 101-102
  pavimento text,
  armario text,
  projeto text,
  disjuntor text,
  rota text,
  observacoes text,
  exemplo boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index salas_bloco on operacoes.salas (bloco, sala);

create table operacoes.quadros (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,               -- b01, b02…
  nome text not null check (length(btrim(nome)) between 1 and 80),
  bloco text not null check (bloco ~ '^\d{2}$'),
  projeto text,
  subestacao text,
  roteiro_base text,                         -- ex.: 14-250-645
  armario text,
  disjuntor_geral text,                      -- ex.: 150A tripolar
  espacos int check (espacos > 0),
  observacoes text,
  -- Caminhos das fotos reais da sala de medidores.
  fotos text[] not null default '{}',
  ordem int not null default 0,
  ativo boolean not null default true,
  exemplo boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index quadros_bloco on operacoes.quadros (bloco, ordem);

create table operacoes.caixas (
  id uuid primary key default gen_random_uuid(),
  quadro_id uuid not null references operacoes.quadros (id) on delete cascade,
  numero text not null check (length(btrim(numero)) between 1 and 30),
  numero_antigo text,
  lado text not null default 'esquerdo' check (lado in ('esquerdo', 'direito')),
  coluna int not null default 1 check (coluna > 0),
  linha int not null default 1 check (linha > 0),
  rota text,
  sala_id uuid references operacoes.salas (id) on delete set null,
  salas_texto text,                          -- como está no painel ("Sala 228", "101 e 102")
  pavimento text,
  status text not null default 'livre' check (status in ('ocupado', 'reservado', 'livre')),
  -- Locatário atual (do ENET ou digitado, para sala sem contrato).
  ocupante text,
  ocupante_documento text,
  ocupante_desde date,
  contrato text,
  ocupante_origem text check (ocupante_origem in ('enet', 'manual', 'importacao')),
  -- Locatário trocado (ENET) ainda sem termo.
  locatario_novo boolean not null default false,
  disjuntor_amperes int check (disjuntor_amperes > 0),
  ligacao text check (ligacao in ('Monofásica', 'Bifásica', 'Trifásica')),
  disjuntor_texto text,
  medidor_situacao text,
  medidor_numero text,
  modulo text,
  observacoes text,
  exemplo boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (quadro_id, numero)
);
create index caixas_sala on operacoes.caixas (sala_id);
create index caixas_status on operacoes.caixas (quadro_id, status);

-- Histórico de ocupantes (sigiloso). Sem nome repetido na mesma caixa.
create table operacoes.caixa_ocupantes (
  id uuid primary key default gen_random_uuid(),
  caixa_id uuid not null references operacoes.caixas (id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 1 and 200),
  documento text,
  entrada date,
  saida date,
  origem text not null default 'manual' check (origem in ('enet', 'manual', 'importacao')),
  criado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  criado_em timestamptz not null default now()
);
create unique index caixa_ocupantes_nome on operacoes.caixa_ocupantes (caixa_id, lower(btrim(nome)));
create index caixa_ocupantes_criado_por on operacoes.caixa_ocupantes (criado_por);

create table operacoes.termos (
  id uuid primary key default gen_random_uuid(),
  caixa_id uuid not null references operacoes.caixas (id) on delete cascade,
  versao int not null check (versao > 0),
  locatario text not null,
  documento text not null,
  qualificacao text,
  bloco text not null,
  pavimento text,
  sala text not null,
  projeto text,
  amperes int,
  ligacao text,
  armario text,
  rota text,
  observacao_tecnica text,
  data_emissao date not null,
  pdf text not null,
  docx text,
  emitido_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  emitido_em timestamptz not null default now(),
  unique (caixa_id, versao)
);
create index termos_emitido_por on operacoes.termos (emitido_por);

-- ---------------------------------------------------------------------------
-- Energia: contas da área comum (faturas da Energisa)
-- ---------------------------------------------------------------------------

create table operacoes.energia_unidades (
  matricula text primary key check (matricula ~ '^\d{6,12}$'),
  endereco text,
  apelido text,
  classificacao text,
  ligacao text,
  papel text not null default 'consome' check (papel in ('consome', 'gera', 'gera_e_consome')),
  ativa boolean not null default true,
  exemplo boolean not null default false,
  criado_em timestamptz not null default now()
);

create table operacoes.energia_faturas (
  id uuid primary key default gen_random_uuid(),
  importacao_id uuid references operacoes.importacoes (id) on delete cascade,
  matricula text not null references operacoes.energia_unidades (matricula) on delete restrict,
  referencia date not null check (extract(day from referencia) = 1),
  vencimento date,
  leitura_anterior_data date,
  leitura_atual_data date,
  proxima_leitura date,
  dias int,
  medidor text,
  leitura_anterior numeric(14, 2),
  leitura_atual numeric(14, 2),
  consumo_kwh numeric(14, 2) not null default 0,
  valor_consumo numeric(14, 2) not null default 0,
  -- Energia injetada compensada: kWh e valor (positivo; na fatura vem negativo).
  compensado_kwh numeric(14, 2) not null default 0,
  valor_compensado numeric(14, 2) not null default 0,
  bandeira text,
  valor_bandeira numeric(14, 2) not null default 0,
  iluminacao_publica numeric(14, 2) not null default 0,
  icms numeric(14, 2) not null default 0,
  pis_cofins numeric(14, 2) not null default 0,
  total numeric(14, 2) not null,
  saldo_kwh numeric(14, 2),
  expirar_kwh numeric(14, 2),
  classificacao_gd text,
  nota_fiscal text,
  observacao text,
  arquivo text,
  sha256 text unique,
  exemplo boolean not null default false,
  importado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  importado_em timestamptz not null default now(),
  unique (matricula, referencia)
);
create index energia_faturas_importacao on operacoes.energia_faturas (importacao_id);
create index energia_faturas_referencia on operacoes.energia_faturas (referencia);
create index energia_faturas_importado_por on operacoes.energia_faturas (importado_por);

create table operacoes.energia_fatura_itens (
  id uuid primary key default gen_random_uuid(),
  fatura_id uuid not null references operacoes.energia_faturas (id) on delete cascade,
  ordem int not null,
  descricao text not null,
  tipo text not null check (tipo in ('consumo', 'injetada', 'bandeira', 'iluminacao', 'outro')),
  -- Crédito de outra unidade (oUC) ou da própria (mUC), e o mês em que foi gerado.
  origem text check (origem in ('oUC', 'mUC')),
  mes_geracao date,
  quantidade numeric(14, 2),
  valor numeric(14, 2) not null,
  pis_cofins numeric(14, 2),
  icms numeric(14, 2)
);
create index energia_fatura_itens_fatura on operacoes.energia_fatura_itens (fatura_id, ordem);

-- ---------------------------------------------------------------------------
-- Rateio da limpeza
-- ---------------------------------------------------------------------------

create table operacoes.limpeza_meses (
  referencia date primary key check (extract(day from referencia) = 1),
  importacao_id uuid references operacoes.importacoes (id) on delete cascade,
  apontamento text,                          -- ex.: BLACK STAR COM APONTAMENTO 12.2025
  valor_base numeric(14, 2) check (valor_base >= 0),
  base_composicao text,                      -- ex.: 38.509,83 − 8.072,68 + …
  func_base int check (func_base > 0),
  func_area_comum int check (func_area_comum >= 0),
  func_rateados int check (func_rateados >= 0),
  -- Até nov/2025 o Bloco 04 entrava na área comum; desde dez/2025, separado.
  regra_bl04 text not null default 'separado' check (regra_bl04 in ('separado', 'area_comum')),
  status text not null default 'aberto' check (status in ('aberto', 'fechado')),
  incompleto boolean not null default false,
  origem text not null default 'tela' check (origem in ('tela', 'importacao')),
  -- Valores da aba importada, para conferir a conta refeita: { "area_comum": …, "01": …, "total": … }.
  valores_planilha jsonb,
  fechado_por uuid references core.usuarios (id) on delete set null,
  fechado_em timestamptz,
  reaberto_por uuid references core.usuarios (id) on delete set null,
  reaberto_em timestamptz,
  reaberto_motivo text,
  enviado_por uuid references core.usuarios (id) on delete set null,
  enviado_em timestamptz,
  exemplo boolean not null default false,
  criado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (status = 'aberto' or (fechado_em is not null and not incompleto)),
  check (enviado_em is null or status = 'fechado')
);
create index limpeza_meses_importacao on operacoes.limpeza_meses (importacao_id);
create index limpeza_meses_fechado_por on operacoes.limpeza_meses (fechado_por);
create index limpeza_meses_reaberto_por on operacoes.limpeza_meses (reaberto_por);
create index limpeza_meses_enviado_por on operacoes.limpeza_meses (enviado_por);
create index limpeza_meses_criado_por on operacoes.limpeza_meses (criado_por);

create table operacoes.limpeza_extras (
  id uuid primary key default gen_random_uuid(),
  referencia date not null references operacoes.limpeza_meses (referencia) on delete cascade,
  ordem int not null default 0,
  descricao text not null check (length(btrim(descricao)) between 1 and 200),
  quantidade numeric(10, 2),
  valor_unitario numeric(14, 2),
  valor numeric(14, 2) not null
);
create index limpeza_extras_mes on operacoes.limpeza_extras (referencia, ordem);

create table operacoes.limpeza_minutos (
  referencia date not null references operacoes.limpeza_meses (referencia) on delete cascade,
  bloco text not null check (bloco ~ '^\d{2}$'),
  limpeza int not null default 0 check (limpeza >= 0),
  manutencao int not null default 0 check (manutencao >= 0),
  primary key (referencia, bloco)
);

-- Composição do contrato do mês; a conferência soma os que entram.
create table operacoes.limpeza_contrato (
  id uuid primary key default gen_random_uuid(),
  referencia date not null references operacoes.limpeza_meses (referencia) on delete cascade,
  ordem int not null default 0,
  descricao text not null check (length(btrim(descricao)) between 1 and 200),
  valor numeric(14, 2) not null,
  entra_conferencia boolean not null default false
);
create index limpeza_contrato_mes on operacoes.limpeza_contrato (referencia, ordem);

-- Quem trabalha onde no mês (nomes da equipe terceirizada).
create table operacoes.limpeza_equipe (
  id uuid primary key default gen_random_uuid(),
  referencia date not null references operacoes.limpeza_meses (referencia) on delete cascade,
  ordem int not null default 0,
  nome text not null check (length(btrim(nome)) between 1 and 120),
  funcao text,
  grupo text not null check (grupo in ('area_comum', 'blocos', 'banheiros', 'externo')),
  blocos text[] not null default '{}',
  turno text,
  minutos_dia int check (minutos_dia >= 0)
);
create index limpeza_equipe_mes on operacoes.limpeza_equipe (referencia, ordem);

create table operacoes.limpeza_anexos (
  id uuid primary key default gen_random_uuid(),
  referencia date not null references operacoes.limpeza_meses (referencia) on delete cascade,
  nome text not null,
  caminho text not null,
  tipo text not null default 'outro' check (tipo in ('medicao', 'apontamento', 'outro')),
  enviado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  enviado_em timestamptz not null default now()
);
create index limpeza_anexos_mes on operacoes.limpeza_anexos (referencia);
create index limpeza_anexos_enviado_por on operacoes.limpeza_anexos (enviado_por);

-- ---------------------------------------------------------------------------
-- Obras: orçamento (previsto) e realizado
-- ---------------------------------------------------------------------------

create table operacoes.obras (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) between 1 and 120),
  responsavel text,
  -- Obra correspondente no Diário de Obra (operacoes.diario_obras.id), se houver.
  diario_obra_id text,
  ativa boolean not null default true,
  exemplo boolean not null default false,
  criado_em timestamptz not null default now()
);
create unique index obras_nome on operacoes.obras (lower(btrim(nome)));

create table operacoes.orcamento_revisoes (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references operacoes.obras (id) on delete cascade,
  importacao_id uuid references operacoes.importacoes (id) on delete cascade,
  codigo text not null check (codigo ~ '^R\d{2}$'),
  data date,
  titulo text,
  total numeric(16, 2) not null,
  -- Total escrito na planilha (a soma das etapas pode diferir em centavos).
  total_arquivo numeric(16, 2),
  vigente boolean not null default false,
  exemplo boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (obra_id, codigo)
);
create unique index orcamento_revisoes_vigente on operacoes.orcamento_revisoes (obra_id) where vigente;
create index orcamento_revisoes_importacao on operacoes.orcamento_revisoes (importacao_id);

create table operacoes.orcamento_etapas (
  id uuid primary key default gen_random_uuid(),
  revisao_id uuid not null references operacoes.orcamento_revisoes (id) on delete cascade,
  ordem int not null,
  nome text not null,
  observacao text,
  unique (revisao_id, ordem)
);

create table operacoes.orcamento_previsto (
  etapa_id uuid not null references operacoes.orcamento_etapas (id) on delete cascade,
  mes date not null check (extract(day from mes) = 1),
  valor numeric(16, 2) not null,
  primary key (etapa_id, mes)
);

create table operacoes.obra_realizado (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references operacoes.obras (id) on delete cascade,
  etapa text not null,
  mes date not null check (extract(day from mes) = 1),
  valor numeric(16, 2) not null,
  descricao text,
  anexo text,
  origem text not null default 'tela' check (origem in ('tela', 'planilha')),
  importacao_id uuid references operacoes.importacoes (id) on delete cascade,
  exemplo boolean not null default false,
  lancado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  lancado_em timestamptz not null default now()
);
create index obra_realizado_obra on operacoes.obra_realizado (obra_id, mes);
create index obra_realizado_importacao on operacoes.obra_realizado (importacao_id);
create index obra_realizado_lancado_por on operacoes.obra_realizado (lancado_por);

-- ---------------------------------------------------------------------------
-- Diário de Obra: cópia do que a API devolve (só a sincronização grava)
-- ---------------------------------------------------------------------------

create table operacoes.diario_obras (
  id text primary key,                       -- _id no aplicativo
  nome text not null,
  status_id int not null,
  grupo text,
  responsavel text,
  data_inicio date,
  data_fim date,
  prazo_contratual int,
  prazo_decorrido int,
  prazo_a_vencer int,
  realizado numeric(7, 2),
  -- { total, naoIniciada, emAndamento, concluida }
  tarefas jsonb,
  -- GET /obras/{id} validado (ficha completa).
  dados jsonb not null,
  -- GET /obras/{id}/lista-de-tarefas validado (cronograma).
  lista_de_tarefas jsonb,
  modificado_no_app timestamp,
  atualizado_em timestamptz not null default now()
);

create table operacoes.diario_relatorios (
  id text primary key,                       -- _id no aplicativo
  obra_id text not null references operacoes.diario_obras (id) on delete cascade,
  numero int not null,
  data date not null,
  data_fim date,
  status_id int not null,
  modelo text,
  autor text,
  autor_cargo text,
  app text,
  criado_no_app timestamp,
  -- GET /obras/{id}/relatorios/{id} validado (null até o detalhe ser lido).
  dados jsonb,
  modificado_no_app timestamp,
  detalhado_em timestamptz,
  atualizado_em timestamptz not null default now()
);
create index diario_relatorios_obra on operacoes.diario_relatorios (obra_id, data desc);
create index diario_relatorios_data on operacoes.diario_relatorios (data desc);
create index diario_relatorios_status on operacoes.diario_relatorios (status_id);

-- /empresa e /cadastros (lidos uma vez por dia).
create table operacoes.diario_cadastros (
  id boolean primary key default true check (id),
  empresa jsonb,
  cadastros jsonb,
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Gatilhos
-- ---------------------------------------------------------------------------

create trigger atualizado_em before update on operacoes.parametros
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on operacoes.salas
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on operacoes.quadros
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on operacoes.caixas
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on operacoes.limpeza_meses
  for each row execute function core.set_atualizado_em();

create trigger auditoria after insert or update or delete on operacoes.parametros
  for each row execute function core.auditar('id');
create trigger auditoria after insert or update or delete on operacoes.agua_vinculos
  for each row execute function core.auditar('id');
create trigger auditoria after insert or update or delete on operacoes.quadros
  for each row execute function core.auditar('id');
create trigger auditoria after insert or update or delete on operacoes.caixas
  for each row execute function core.auditar('id');
create trigger auditoria after insert or update or delete on operacoes.termos
  for each row execute function core.auditar('id');
create trigger auditoria after insert or update or delete on operacoes.limpeza_meses
  for each row execute function core.auditar('referencia');
create trigger auditoria after insert or update or delete on operacoes.obra_realizado
  for each row execute function core.auditar('id');
create trigger auditoria after update on operacoes.importacoes
  for each row execute function core.auditar('id');

-- ---------------------------------------------------------------------------
-- Funções: importações
-- ---------------------------------------------------------------------------

-- Permissão de importar cada tipo (mesma regra das telas).
create function operacoes.pode_importar(p_tipo text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_tipo
    when 'agua' then core.pode('operacoes.agua.importar')
    when 'energisa' then core.pode('operacoes.energia.contas')
    when 'orcamento' then core.pode('operacoes.obras.importar')
    when 'limpeza' then core.pode('operacoes.limpeza.fechar')
    else false
  end;
$$;

-- Quem vê a importação (o histórico de importações).
create function operacoes.ve_importacao(p_tipo text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select operacoes.pode_importar(p_tipo) or case p_tipo
    when 'agua' then core.pode('operacoes.agua.ver')
    when 'energisa' then core.pode('operacoes.energia.contas')
    when 'orcamento' then core.pode('operacoes.obras.ver')
    when 'limpeza' then core.pode('operacoes.limpeza.ver')
    else false
  end;
$$;

-- Confirma a prévia: as linhas passam a valer de uma vez. Na água, o mês que
-- já existia vira "substituída" (fica guardado). Mês que não bate com o
-- resumo do arquivo só entra com motivo, marcado "incompleto". No orçamento,
-- a revisão nova passa a ser a vigente.
create function operacoes.confirmar_importacao(p_id uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v operacoes.importacoes;
  v_anterior uuid;
begin
  select * into v from operacoes.importacoes where id = p_id for update;
  if not found then
    raise exception 'importação não encontrada' using errcode = 'P0001';
  end if;
  if not operacoes.pode_importar(v.tipo) then
    raise exception 'sem permissão para importar este tipo' using errcode = '42501';
  end if;
  if v.status <> 'previa' then
    raise exception 'só uma prévia pode ser confirmada' using errcode = '22023';
  end if;
  if v.bate is false and nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'os totais não batem com o resumo do arquivo: informe o motivo para confirmar assim mesmo'
      using errcode = '22023';
  end if;

  if v.tipo = 'agua' then
    select id into v_anterior from operacoes.importacoes
      where tipo = 'agua' and status = 'confirmada' and referencia = v.referencia
      for update;
    if v_anterior is not null then
      update operacoes.agua_leituras set vigente = false where importacao_id = v_anterior;
      update operacoes.importacoes set status = 'substituida' where id = v_anterior;
    end if;
    update operacoes.agua_leituras set vigente = true where importacao_id = p_id;
  elsif v.tipo = 'orcamento' then
    update operacoes.orcamento_revisoes r set vigente = false
      where r.vigente and r.obra_id in (
        select obra_id from operacoes.orcamento_revisoes where importacao_id = p_id);
    update operacoes.orcamento_revisoes set vigente = true where importacao_id = p_id;
  end if;

  update operacoes.importacoes set
    status = 'confirmada',
    substitui = coalesce(v_anterior, substitui),
    incompleta = coalesce(v.bate is false, false),
    motivo = case when v.bate is false then btrim(p_motivo) else motivo end,
    confirmado_por = (select auth.uid()),
    confirmado_em = now()
  where id = p_id;
end;
$$;

-- Desfaz uma importação confirmada (ou descarta uma prévia). Na água, o mês
-- substituído volta a valer. Faturas, revisões do orçamento e meses do
-- rateio trazidos por ela são apagados.
create function operacoes.desfazer_importacao(p_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v operacoes.importacoes;
  v_apagadas int := 0;
  v_obra uuid;
begin
  select * into v from operacoes.importacoes where id = p_id for update;
  if not found then
    raise exception 'importação não encontrada' using errcode = 'P0001';
  end if;
  if not operacoes.pode_importar(v.tipo) then
    raise exception 'sem permissão para desfazer esta importação' using errcode = '42501';
  end if;
  if v.status not in ('previa', 'confirmada') then
    raise exception 'esta importação já foi desfeita ou substituída' using errcode = '22023';
  end if;

  -- Sai primeiro (um mês de água confirmado por vez), depois o anterior volta.
  update operacoes.importacoes set
    status = case when v.status = 'previa' then 'cancelada' else 'desfeita' end,
    desfeito_por = (select auth.uid()),
    desfeito_em = now()
  where id = p_id;

  if v.tipo = 'agua' then
    delete from operacoes.agua_leituras where importacao_id = p_id;
    get diagnostics v_apagadas = row_count;
    if v.status = 'confirmada' and v.substitui is not null then
      update operacoes.importacoes set status = 'confirmada' where id = v.substitui and status = 'substituida';
      update operacoes.agua_leituras set vigente = true where importacao_id = v.substitui;
    end if;
  elsif v.tipo = 'energisa' then
    delete from operacoes.energia_faturas where importacao_id = p_id;
    get diagnostics v_apagadas = row_count;
  elsif v.tipo = 'orcamento' then
    select obra_id into v_obra from operacoes.orcamento_revisoes where importacao_id = p_id limit 1;
    delete from operacoes.obra_realizado where importacao_id = p_id;
    delete from operacoes.orcamento_revisoes where importacao_id = p_id;
    get diagnostics v_apagadas = row_count;
    -- A revisão confirmada mais recente que sobrou volta a ser a vigente
    -- (nunca uma que ainda é prévia).
    if v_obra is not null and not exists (
      select 1 from operacoes.orcamento_revisoes where obra_id = v_obra and vigente
    ) then
      update operacoes.orcamento_revisoes set vigente = true
        where id = (
          select r.id from operacoes.orcamento_revisoes r
          left join operacoes.importacoes i on i.id = r.importacao_id
          where r.obra_id = v_obra and (r.importacao_id is null or i.status = 'confirmada')
          order by r.codigo desc limit 1);
    end if;
  elsif v.tipo = 'limpeza' then
    delete from operacoes.limpeza_meses where importacao_id = p_id;
    get diagnostics v_apagadas = row_count;
  end if;
  return v_apagadas;
end;
$$;

-- ---------------------------------------------------------------------------
-- Funções: rateio da limpeza (fechar, reabrir, enviar)
-- ---------------------------------------------------------------------------

create function operacoes.limpeza_fechar(p_ref date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v operacoes.limpeza_meses;
begin
  if not core.pode('operacoes.limpeza.fechar') then
    raise exception 'sem permissão para fechar o rateio' using errcode = '42501';
  end if;
  select * into v from operacoes.limpeza_meses where referencia = p_ref for update;
  if not found then
    raise exception 'mês não encontrado' using errcode = 'P0001';
  end if;
  if v.status = 'fechado' then
    raise exception 'o mês já está fechado' using errcode = '22023';
  end if;
  if v.valor_base is null or v.func_base is null or v.func_area_comum is null or v.func_rateados is null then
    raise exception 'preencha o valor base e os funcionários antes de fechar' using errcode = '22023';
  end if;
  if not exists (
    select 1 from operacoes.limpeza_minutos
    where referencia = p_ref and limpeza + manutencao > 0
  ) then
    raise exception 'lance os minutos dos blocos antes de fechar' using errcode = '22023';
  end if;
  update operacoes.limpeza_meses set
    status = 'fechado', incompleto = false,
    fechado_por = (select auth.uid()), fechado_em = now()
  where referencia = p_ref;
end;
$$;

create function operacoes.limpeza_reabrir(p_ref date, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not core.pode('operacoes.limpeza.fechar') then
    raise exception 'sem permissão para reabrir o rateio' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'informe o motivo para reabrir' using errcode = '22023';
  end if;
  update operacoes.limpeza_meses set
    status = 'aberto', enviado_por = null, enviado_em = null,
    reaberto_por = (select auth.uid()), reaberto_em = now(),
    reaberto_motivo = btrim(p_motivo)
  where referencia = p_ref and status = 'fechado';
  if not found then
    raise exception 'só um mês fechado pode ser reaberto' using errcode = '22023';
  end if;
end;
$$;

create function operacoes.limpeza_enviar(p_ref date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not core.pode('operacoes.limpeza.fechar') then
    raise exception 'sem permissão para enviar o rateio' using errcode = '42501';
  end if;
  update operacoes.limpeza_meses set
    enviado_por = (select auth.uid()), enviado_em = now()
  where referencia = p_ref and status = 'fechado';
  if not found then
    raise exception 'feche o mês antes de enviar ao Financeiro' using errcode = '22023';
  end if;
end;
$$;

-- Mês aberto para edição (as tabelas filhas só mudam enquanto ele está aberto).
create function operacoes.limpeza_aberto(p_ref date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from operacoes.limpeza_meses where referencia = p_ref and status = 'aberto');
$$;

-- ---------------------------------------------------------------------------
-- Funções: energia (emitir termo, troca de locatário)
-- ---------------------------------------------------------------------------

-- Próxima versão do termo da caixa (a anterior fica no histórico).
create function operacoes.proxima_versao_termo(p_caixa uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(max(versao), 0) + 1 from operacoes.termos where caixa_id = p_caixa;
$$;

-- Troca o locatário da caixa: o anterior vai para o histórico (sem repetir
-- nome) e a caixa fica marcada "locatário novo sem termo".
create function operacoes.trocar_locatario(
  p_caixa uuid,
  p_nome text,
  p_documento text,
  p_desde date,
  p_contrato text default null,
  p_origem text default 'manual'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v operacoes.caixas;
begin
  if not (core.pode('operacoes.energia.editar') or (select auth.role()) = 'service_role') then
    raise exception 'sem permissão para editar a caixa' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_nome, ''))) = 0 then
    raise exception 'informe o novo locatário' using errcode = '22023';
  end if;
  if p_origem not in ('enet', 'manual') then
    raise exception 'origem inválida' using errcode = '22023';
  end if;
  select * into v from operacoes.caixas where id = p_caixa for update;
  if not found then
    raise exception 'caixa não encontrada' using errcode = 'P0001';
  end if;
  if v.ocupante is not null and lower(btrim(v.ocupante)) = lower(btrim(p_nome)) then
    return;
  end if;
  if v.ocupante is not null and btrim(v.ocupante) <> '' then
    insert into operacoes.caixa_ocupantes (caixa_id, nome, documento, entrada, saida, origem)
      values (p_caixa, btrim(v.ocupante), v.ocupante_documento, v.ocupante_desde,
              coalesce(p_desde, current_date), coalesce(v.ocupante_origem, 'manual'))
      on conflict (caixa_id, lower(btrim(nome))) do update set saida = excluded.saida;
  end if;
  update operacoes.caixas set
    ocupante = btrim(p_nome),
    ocupante_documento = nullif(btrim(coalesce(p_documento, '')), ''),
    ocupante_desde = p_desde,
    contrato = p_contrato,
    ocupante_origem = p_origem,
    status = 'ocupado',
    locatario_novo = true
  where id = p_caixa;
end;
$$;

-- ---------------------------------------------------------------------------
-- Dados de exemplo: remover tudo o que foi marcado "exemplo"
-- ---------------------------------------------------------------------------

create function operacoes.remover_exemplos()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not core.pode('operacoes.parametros') then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  delete from operacoes.importacoes where exemplo;
  delete from operacoes.agua_leituras where exemplo;
  delete from operacoes.energia_faturas where exemplo;
  delete from operacoes.energia_unidades u where u.exemplo
    and not exists (select 1 from operacoes.energia_faturas f where f.matricula = u.matricula);
  delete from operacoes.quadros where exemplo;
  delete from operacoes.salas where exemplo;
  delete from operacoes.limpeza_meses where exemplo;
  delete from operacoes.obra_realizado where exemplo;
  delete from operacoes.orcamento_revisoes where exemplo;
  delete from operacoes.obras where exemplo;
  -- Colunas "exemplo" do Diário de Obra vêm de 20261109160600.
  delete from operacoes.diario_relatorios where exemplo;
  delete from operacoes.diario_obras where exemplo;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table operacoes.parametros enable row level security;
alter table operacoes.importacoes enable row level security;
alter table operacoes.importacao_valores enable row level security;
alter table operacoes.agua_leituras enable row level security;
alter table operacoes.agua_valores enable row level security;
alter table operacoes.agua_vinculos enable row level security;
alter table operacoes.salas enable row level security;
alter table operacoes.quadros enable row level security;
alter table operacoes.caixas enable row level security;
alter table operacoes.caixa_ocupantes enable row level security;
alter table operacoes.termos enable row level security;
alter table operacoes.energia_unidades enable row level security;
alter table operacoes.energia_faturas enable row level security;
alter table operacoes.energia_fatura_itens enable row level security;
alter table operacoes.limpeza_meses enable row level security;
alter table operacoes.limpeza_extras enable row level security;
alter table operacoes.limpeza_minutos enable row level security;
alter table operacoes.limpeza_contrato enable row level security;
alter table operacoes.limpeza_equipe enable row level security;
alter table operacoes.limpeza_anexos enable row level security;
alter table operacoes.obras enable row level security;
alter table operacoes.orcamento_revisoes enable row level security;
alter table operacoes.orcamento_etapas enable row level security;
alter table operacoes.orcamento_previsto enable row level security;
alter table operacoes.obra_realizado enable row level security;
alter table operacoes.diario_obras enable row level security;
alter table operacoes.diario_relatorios enable row level security;
alter table operacoes.diario_cadastros enable row level security;

-- Parâmetros: quem usa o módulo lê; quem tem operacoes.parametros edita.
create policy ver on operacoes.parametros for select to authenticated
  using ((select operacoes.acessa()));
create policy editar on operacoes.parametros for update to authenticated
  using ((select core.pode('operacoes.parametros')))
  with check ((select core.pode('operacoes.parametros')));

-- Importações: vê quem vê o tipo; cria a prévia quem importa o tipo.
-- Confirmar e desfazer só pelas funções (mudam várias tabelas de uma vez).
create policy ver on operacoes.importacoes for select to authenticated
  using ((select operacoes.ve_importacao(tipo)));
create policy criar on operacoes.importacoes for insert to authenticated
  with check (
    (select operacoes.pode_importar(tipo)) and status = 'previa'
    and criado_por = (select auth.uid()) and not exemplo
  );
-- A prévia pode ser ajustada (avisos, resumo) por quem a criou.
create policy editar on operacoes.importacoes for update to authenticated
  using (status = 'previa' and criado_por = (select auth.uid()) and (select operacoes.pode_importar(tipo)))
  with check (status = 'previa' and criado_por = (select auth.uid()));

create policy ver on operacoes.importacao_valores for select to authenticated
  using ((select core.pode('operacoes.agua.valores')));
create policy criar on operacoes.importacao_valores for insert to authenticated
  with check (exists (
    select 1 from operacoes.importacoes i
    where i.id = importacao_id and i.status = 'previa' and i.criado_por = (select auth.uid())
  ));

-- Água: leituras vigentes para quem vê; prévia para quem importa.
create policy ver on operacoes.agua_leituras for select to authenticated
  using (
    (vigente and (select core.pode('operacoes.agua.ver')))
    or (select core.pode('operacoes.agua.importar'))
  );
create policy criar on operacoes.agua_leituras for insert to authenticated
  with check (
    (select core.pode('operacoes.agua.importar')) and not vigente and not exemplo
    and exists (
      select 1 from operacoes.importacoes i
      where i.id = importacao_id and i.tipo = 'agua' and i.status = 'previa'
        and i.criado_por = (select auth.uid())
    )
  );

create policy ver on operacoes.agua_valores for select to authenticated
  using (
    (select core.pode('operacoes.agua.valores'))
    and exists (select 1 from operacoes.agua_leituras l where l.id = leitura_id)
  );
create policy criar on operacoes.agua_valores for insert to authenticated
  with check (exists (
    select 1 from operacoes.agua_leituras l
    join operacoes.importacoes i on i.id = l.importacao_id
    where l.id = leitura_id and i.status = 'previa' and i.criado_por = (select auth.uid())
  ));

create policy ver on operacoes.agua_vinculos for select to authenticated
  using ((select core.pode('operacoes.agua.ver')));
create policy criar on operacoes.agua_vinculos for insert to authenticated
  with check ((select core.pode('operacoes.agua.vinculo')) and criado_por = (select auth.uid()));
create policy excluir on operacoes.agua_vinculos for delete to authenticated
  using ((select core.pode('operacoes.agua.vinculo')));

-- Energia: quadros, caixas e salas.
create policy ver on operacoes.salas for select to authenticated
  using ((select core.pode('operacoes.energia.ver')) or (select core.pode('operacoes.agua.ver')));
create policy criar on operacoes.salas for insert to authenticated
  with check ((select core.pode('operacoes.energia.editar')));
create policy editar on operacoes.salas for update to authenticated
  using ((select core.pode('operacoes.energia.editar')))
  with check ((select core.pode('operacoes.energia.editar')));
create policy excluir on operacoes.salas for delete to authenticated
  using ((select core.pode('operacoes.energia.editar')));

create policy ver on operacoes.quadros for select to authenticated
  using ((select core.pode('operacoes.energia.ver')));
create policy criar on operacoes.quadros for insert to authenticated
  with check ((select core.pode('operacoes.energia.editar')));
create policy editar on operacoes.quadros for update to authenticated
  using ((select core.pode('operacoes.energia.editar')))
  with check ((select core.pode('operacoes.energia.editar')));
create policy excluir on operacoes.quadros for delete to authenticated
  using ((select core.pode('operacoes.energia.editar')));

create policy ver on operacoes.caixas for select to authenticated
  using ((select core.pode('operacoes.energia.ver')));
create policy criar on operacoes.caixas for insert to authenticated
  with check ((select core.pode('operacoes.energia.editar')));
create policy editar on operacoes.caixas for update to authenticated
  using ((select core.pode('operacoes.energia.editar')))
  with check ((select core.pode('operacoes.energia.editar')));
create policy excluir on operacoes.caixas for delete to authenticated
  using ((select core.pode('operacoes.energia.editar')));

create policy ver on operacoes.caixa_ocupantes for select to authenticated
  using ((select core.pode('operacoes.energia.historico')));

create policy ver on operacoes.termos for select to authenticated
  using ((select core.pode('operacoes.energia.ver')));
create policy criar on operacoes.termos for insert to authenticated
  with check ((select core.pode('operacoes.energia.termo')) and emitido_por = (select auth.uid()));

-- Energia: contas e solar.
create policy ver on operacoes.energia_unidades for select to authenticated
  using ((select core.pode('operacoes.energia.contas')) or (select core.pode('operacoes.solar.ver')));
create policy criar on operacoes.energia_unidades for insert to authenticated
  with check ((select core.pode('operacoes.energia.contas')) or (select core.pode('operacoes.parametros')));
create policy editar on operacoes.energia_unidades for update to authenticated
  using ((select core.pode('operacoes.energia.contas')) or (select core.pode('operacoes.parametros')))
  with check ((select core.pode('operacoes.energia.contas')) or (select core.pode('operacoes.parametros')));

create policy ver on operacoes.energia_faturas for select to authenticated
  using ((select core.pode('operacoes.energia.contas')) or (select core.pode('operacoes.solar.ver')));
create policy criar on operacoes.energia_faturas for insert to authenticated
  with check (
    (select core.pode('operacoes.energia.contas')) and not exemplo
    and importado_por = (select auth.uid())
    and exists (
      select 1 from operacoes.importacoes i
      where i.id = importacao_id and i.tipo = 'energisa' and i.status = 'previa'
        and i.criado_por = (select auth.uid())
    )
  );

create policy ver on operacoes.energia_fatura_itens for select to authenticated
  using (exists (select 1 from operacoes.energia_faturas f where f.id = fatura_id));
create policy criar on operacoes.energia_fatura_itens for insert to authenticated
  with check (exists (
    select 1 from operacoes.energia_faturas f
    join operacoes.importacoes i on i.id = f.importacao_id
    where f.id = fatura_id and i.status = 'previa' and i.criado_por = (select auth.uid())
  ));

-- Limpeza: vê quem tem limpeza.ver ou fechar; edita só mês aberto.
create policy ver on operacoes.limpeza_meses for select to authenticated
  using ((select core.pode('operacoes.limpeza.ver')) or (select core.pode('operacoes.limpeza.fechar')));
create policy criar on operacoes.limpeza_meses for insert to authenticated
  with check (
    (select core.pode('operacoes.limpeza.fechar')) and status = 'aberto' and not exemplo
    and enviado_em is null and fechado_em is null
  );
create policy editar on operacoes.limpeza_meses for update to authenticated
  using ((select core.pode('operacoes.limpeza.fechar')) and status = 'aberto')
  with check (status = 'aberto' and enviado_em is null);
create policy excluir on operacoes.limpeza_meses for delete to authenticated
  using ((select core.pode('operacoes.limpeza.fechar')) and status = 'aberto' and origem = 'tela');

create policy ver on operacoes.limpeza_extras for select to authenticated
  using (exists (select 1 from operacoes.limpeza_meses m where m.referencia = limpeza_extras.referencia));
create policy criar on operacoes.limpeza_extras for insert to authenticated
  with check ((select core.pode('operacoes.limpeza.fechar')) and operacoes.limpeza_aberto(referencia));
create policy editar on operacoes.limpeza_extras for update to authenticated
  using ((select core.pode('operacoes.limpeza.fechar')) and operacoes.limpeza_aberto(referencia))
  with check (operacoes.limpeza_aberto(referencia));
create policy excluir on operacoes.limpeza_extras for delete to authenticated
  using ((select core.pode('operacoes.limpeza.fechar')) and operacoes.limpeza_aberto(referencia));

create policy ver on operacoes.limpeza_minutos for select to authenticated
  using (exists (select 1 from operacoes.limpeza_meses m where m.referencia = limpeza_minutos.referencia));
create policy criar on operacoes.limpeza_minutos for insert to authenticated
  with check ((select core.pode('operacoes.limpeza.fechar')) and operacoes.limpeza_aberto(referencia));
create policy editar on operacoes.limpeza_minutos for update to authenticated
  using ((select core.pode('operacoes.limpeza.fechar')) and operacoes.limpeza_aberto(referencia))
  with check (operacoes.limpeza_aberto(referencia));
create policy excluir on operacoes.limpeza_minutos for delete to authenticated
  using ((select core.pode('operacoes.limpeza.fechar')) and operacoes.limpeza_aberto(referencia));

create policy ver on operacoes.limpeza_contrato for select to authenticated
  using (exists (select 1 from operacoes.limpeza_meses m where m.referencia = limpeza_contrato.referencia));
create policy criar on operacoes.limpeza_contrato for insert to authenticated
  with check ((select core.pode('operacoes.limpeza.fechar')) and operacoes.limpeza_aberto(referencia));
create policy editar on operacoes.limpeza_contrato for update to authenticated
  using ((select core.pode('operacoes.limpeza.fechar')) and operacoes.limpeza_aberto(referencia))
  with check (operacoes.limpeza_aberto(referencia));
create policy excluir on operacoes.limpeza_contrato for delete to authenticated
  using ((select core.pode('operacoes.limpeza.fechar')) and operacoes.limpeza_aberto(referencia));

create policy ver on operacoes.limpeza_equipe for select to authenticated
  using (exists (select 1 from operacoes.limpeza_meses m where m.referencia = limpeza_equipe.referencia));
create policy criar on operacoes.limpeza_equipe for insert to authenticated
  with check ((select core.pode('operacoes.limpeza.fechar')) and operacoes.limpeza_aberto(referencia));
create policy editar on operacoes.limpeza_equipe for update to authenticated
  using ((select core.pode('operacoes.limpeza.fechar')) and operacoes.limpeza_aberto(referencia))
  with check (operacoes.limpeza_aberto(referencia));
create policy excluir on operacoes.limpeza_equipe for delete to authenticated
  using ((select core.pode('operacoes.limpeza.fechar')) and operacoes.limpeza_aberto(referencia));

create policy ver on operacoes.limpeza_anexos for select to authenticated
  using (exists (select 1 from operacoes.limpeza_meses m where m.referencia = limpeza_anexos.referencia));
create policy criar on operacoes.limpeza_anexos for insert to authenticated
  with check ((select core.pode('operacoes.limpeza.fechar')) and enviado_por = (select auth.uid()));
create policy excluir on operacoes.limpeza_anexos for delete to authenticated
  using ((select core.pode('operacoes.limpeza.fechar')) and operacoes.limpeza_aberto(referencia));

-- Obras: previsto e realizado.
create policy ver on operacoes.obras for select to authenticated
  using ((select core.pode('operacoes.obras.ver')) or (select core.pode('operacoes.obras.diario')));
create policy criar on operacoes.obras for insert to authenticated
  with check ((select core.pode('operacoes.obras.importar')) and not exemplo);
create policy editar on operacoes.obras for update to authenticated
  using ((select core.pode('operacoes.obras.importar')))
  with check ((select core.pode('operacoes.obras.importar')));

create policy ver on operacoes.orcamento_revisoes for select to authenticated
  using ((select core.pode('operacoes.obras.ver')));
create policy criar on operacoes.orcamento_revisoes for insert to authenticated
  with check (
    (select core.pode('operacoes.obras.importar')) and not vigente and not exemplo
    and exists (
      select 1 from operacoes.importacoes i
      where i.id = importacao_id and i.tipo = 'orcamento' and i.status = 'previa'
        and i.criado_por = (select auth.uid())
    )
  );

create policy ver on operacoes.orcamento_etapas for select to authenticated
  using (exists (select 1 from operacoes.orcamento_revisoes r where r.id = revisao_id));
create policy criar on operacoes.orcamento_etapas for insert to authenticated
  with check (exists (
    select 1 from operacoes.orcamento_revisoes r
    join operacoes.importacoes i on i.id = r.importacao_id
    where r.id = revisao_id and i.status = 'previa' and i.criado_por = (select auth.uid())
  ));

create policy ver on operacoes.orcamento_previsto for select to authenticated
  using (exists (select 1 from operacoes.orcamento_etapas e where e.id = etapa_id));
create policy criar on operacoes.orcamento_previsto for insert to authenticated
  with check (exists (
    select 1 from operacoes.orcamento_etapas e
    join operacoes.orcamento_revisoes r on r.id = e.revisao_id
    join operacoes.importacoes i on i.id = r.importacao_id
    where e.id = etapa_id and i.status = 'previa' and i.criado_por = (select auth.uid())
  ));

create policy ver on operacoes.obra_realizado for select to authenticated
  using ((select core.pode('operacoes.obras.ver')));
create policy criar on operacoes.obra_realizado for insert to authenticated
  with check (
    (select core.pode('operacoes.obras.importar')) and not exemplo
    and lancado_por = (select auth.uid())
  );
create policy editar on operacoes.obra_realizado for update to authenticated
  using ((select core.pode('operacoes.obras.importar')) and origem = 'tela')
  with check ((select core.pode('operacoes.obras.importar')) and origem = 'tela');
create policy excluir on operacoes.obra_realizado for delete to authenticated
  using ((select core.pode('operacoes.obras.importar')) and origem = 'tela');

-- Diário de Obra: só leitura.
create policy ver on operacoes.diario_obras for select to authenticated
  using ((select core.pode('operacoes.obras.diario')) or (select core.pode('operacoes.painel')));
create policy ver on operacoes.diario_relatorios for select to authenticated
  using ((select core.pode('operacoes.obras.diario')) or (select core.pode('operacoes.painel')));
create policy ver on operacoes.diario_cadastros for select to authenticated
  using ((select core.pode('operacoes.obras.diario')));

-- ---------------------------------------------------------------------------
-- Acessos
-- ---------------------------------------------------------------------------

grant select on all tables in schema operacoes to authenticated;
grant update (agua_limite_m3, agua_tolerancia, agua_blocos, agua_parceiro, agua_modelo,
  termo_razao_social, termo_cnpj, termo_endereco, termo_cidade, termo_qualificacao_cpf,
  termo_qualificacao_cnpj, termo_nome_arquivo, energia_disjuntores, energia_ligacoes,
  energia_medidor_situacoes, energia_alerta_pct, solar_fonte, limpeza_empresa,
  limpeza_func_base, limpeza_func_area_comum, limpeza_func_rateados, limpeza_blocos,
  limpeza_dia_util_envio, limpeza_extras_padrao, obras_intervalo_min, obras_dias_relatorio,
  obras_limite_desvio, obras_limite_orcamento_pct, atualizado_por)
  on operacoes.parametros to authenticated;
grant insert (tipo, referencia, arquivos, resumo, avisos, bate, criado_por)
  on operacoes.importacoes to authenticated;
grant update (resumo, avisos, bate, arquivos) on operacoes.importacoes to authenticated;
grant insert on operacoes.importacao_valores, operacoes.agua_leituras, operacoes.agua_valores,
  operacoes.agua_vinculos, operacoes.salas, operacoes.quadros, operacoes.caixas,
  operacoes.termos, operacoes.energia_unidades, operacoes.energia_faturas,
  operacoes.energia_fatura_itens, operacoes.limpeza_extras, operacoes.limpeza_minutos,
  operacoes.limpeza_contrato, operacoes.limpeza_equipe, operacoes.limpeza_anexos,
  operacoes.obras, operacoes.orcamento_revisoes, operacoes.orcamento_etapas,
  operacoes.orcamento_previsto, operacoes.obra_realizado
  to authenticated;
grant delete on operacoes.agua_vinculos, operacoes.salas, operacoes.quadros, operacoes.caixas,
  operacoes.limpeza_meses, operacoes.limpeza_extras, operacoes.limpeza_minutos,
  operacoes.limpeza_contrato, operacoes.limpeza_equipe, operacoes.limpeza_anexos,
  operacoes.obra_realizado
  to authenticated;
grant update on operacoes.salas, operacoes.quadros, operacoes.energia_unidades,
  operacoes.limpeza_extras, operacoes.limpeza_minutos, operacoes.limpeza_contrato,
  operacoes.limpeza_equipe, operacoes.obras, operacoes.obra_realizado
  to authenticated;
-- Caixa: o ocupante só muda por trocar_locatario (vai para o histórico).
grant update (numero, numero_antigo, lado, coluna, linha, rota, sala_id, salas_texto,
  pavimento, status, disjuntor_amperes, ligacao, disjuntor_texto, medidor_situacao,
  medidor_numero, modulo, observacoes, locatario_novo)
  on operacoes.caixas to authenticated;
-- Mês do rateio: status, fechamento e envio só pelas funções.
grant insert (referencia, apontamento, valor_base, base_composicao, func_base,
  func_area_comum, func_rateados, regra_bl04, criado_por)
  on operacoes.limpeza_meses to authenticated;
grant update (apontamento, valor_base, base_composicao, func_base, func_area_comum,
  func_rateados, regra_bl04)
  on operacoes.limpeza_meses to authenticated;
grant all on all tables in schema operacoes to service_role;

revoke all on all functions in schema operacoes from public, anon;
grant execute on function operacoes.acessa() to authenticated, service_role;
grant execute on function operacoes.pode_importar(text) to authenticated, service_role;
grant execute on function operacoes.ve_importacao(text) to authenticated, service_role;
grant execute on function operacoes.confirmar_importacao(uuid, text) to authenticated;
grant execute on function operacoes.desfazer_importacao(uuid) to authenticated;
grant execute on function operacoes.limpeza_fechar(date) to authenticated;
grant execute on function operacoes.limpeza_reabrir(date, text) to authenticated;
grant execute on function operacoes.limpeza_enviar(date) to authenticated;
grant execute on function operacoes.limpeza_aberto(date) to authenticated, service_role;
grant execute on function operacoes.proxima_versao_termo(uuid) to authenticated, service_role;
grant execute on function operacoes.trocar_locatario(uuid, text, text, date, text, text)
  to authenticated, service_role;
grant execute on function operacoes.remover_exemplos() to authenticated;

-- ---------------------------------------------------------------------------
-- Chamados (os): saída do ativo (venda, doação, descarte, devolução, outro)
-- ---------------------------------------------------------------------------

create table os.ativo_saidas (
  id uuid primary key default gen_random_uuid(),
  ativo_id uuid not null references os.ativos (id) on delete cascade,
  tipo text not null check (length(btrim(tipo)) between 1 and 40),
  data date not null,
  quantidade text,
  valor numeric(14, 2) check (valor >= 0),
  forma_recebimento text,
  recebido_por text,
  destinatario_nome text,
  destinatario_documento text,
  responsavel_id uuid references core.usuarios (id) on delete set null,
  motivo text,
  nota_fiscal boolean not null default false,
  nota_fiscal_numero text,
  observacoes text,
  -- Caminhos das fotos, recibo ou termo de doação (src/server/arquivos, bucket "os").
  anexos text[] not null default '{}',
  -- Situação do ativo antes da saída (volta a ela se a saída for desfeita).
  situacao_anterior os.situacao_ativo not null,
  registrado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  registrado_em timestamptz not null default now(),
  desfeita_por uuid references core.usuarios (id) on delete set null,
  desfeita_em timestamptz,
  desfeita_motivo text,
  check (tipo <> 'Venda' or valor is not null),
  check (not nota_fiscal or nota_fiscal_numero is not null),
  check (desfeita_em is null or desfeita_motivo is not null)
);
create index ativo_saidas_ativo on os.ativo_saidas (ativo_id, registrado_em desc);
create index ativo_saidas_data on os.ativo_saidas (data desc);
create index ativo_saidas_responsavel on os.ativo_saidas (responsavel_id);
create index ativo_saidas_registrado_por on os.ativo_saidas (registrado_por);
create index ativo_saidas_desfeita_por on os.ativo_saidas (desfeita_por);
-- Uma saída valendo por ativo.
create unique index ativo_saidas_ativa on os.ativo_saidas (ativo_id) where desfeita_em is null;

create trigger auditoria after insert or update or delete on os.ativo_saidas
  for each row execute function core.auditar('id');

alter table os.ativo_saidas enable row level security;
create policy ver on os.ativo_saidas for select to authenticated
  using ((select core.pode('os.ativos')) or (select core.pode('os.ativos_gerenciar'))
         or (select core.pode('os.ativos_saida')));

-- Registra a saída e baixa o ativo ("Baixado – Vendido" etc.). Sobra sem
-- cadastro: crie o ativo antes (a tela cria e chama esta função em seguida).
create function os.registrar_saida_ativo(
  p_ativo uuid,
  p_tipo text,
  p_data date,
  p_quantidade text,
  p_valor numeric,
  p_forma text,
  p_recebido_por text,
  p_destinatario text,
  p_documento text,
  p_responsavel uuid,
  p_motivo text,
  p_nf boolean,
  p_nf_numero text,
  p_observacoes text,
  p_anexos text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v os.ativos;
  v_id uuid;
begin
  if not core.pode('os.ativos_saida') then
    raise exception 'sem permissão para registrar a saída do ativo' using errcode = '42501';
  end if;
  select * into v from os.ativos where id = p_ativo for update;
  if not found then
    raise exception 'ativo não encontrado' using errcode = 'P0001';
  end if;
  if v.situacao = 'baixado' then
    raise exception 'o ativo já está baixado' using errcode = '22023';
  end if;
  insert into os.ativo_saidas (ativo_id, tipo, data, quantidade, valor, forma_recebimento,
    recebido_por, destinatario_nome, destinatario_documento, responsavel_id, motivo,
    nota_fiscal, nota_fiscal_numero, observacoes, anexos, situacao_anterior)
  values (p_ativo, btrim(p_tipo), p_data, nullif(btrim(coalesce(p_quantidade, '')), ''), p_valor,
    nullif(btrim(coalesce(p_forma, '')), ''), nullif(btrim(coalesce(p_recebido_por, '')), ''),
    nullif(btrim(coalesce(p_destinatario, '')), ''), nullif(btrim(coalesce(p_documento, '')), ''),
    p_responsavel, nullif(btrim(coalesce(p_motivo, '')), ''), coalesce(p_nf, false),
    nullif(btrim(coalesce(p_nf_numero, '')), ''), nullif(btrim(coalesce(p_observacoes, '')), ''),
    coalesce(p_anexos, '{}'), v.situacao)
  returning id into v_id;
  update os.ativos set
    situacao = 'baixado',
    baixa_data = p_data,
    baixa_motivo = case lower(btrim(p_tipo))
      when 'venda' then 'Vendido'
      when 'doação' then 'Doado'
      when 'descarte' then 'Descartado'
      when 'devolução' then 'Devolvido'
      else btrim(p_tipo)
    end
  where id = p_ativo;
  return v_id;
end;
$$;

-- Desfaz a saída (com motivo): o ativo volta à situação de antes.
create function os.desfazer_saida_ativo(p_saida uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v os.ativo_saidas;
begin
  if not core.pode('os.ativos_saida') then
    raise exception 'sem permissão para desfazer a saída' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'informe o motivo para desfazer' using errcode = '22023';
  end if;
  select * into v from os.ativo_saidas where id = p_saida for update;
  if not found or v.desfeita_em is not null then
    raise exception 'saída não encontrada ou já desfeita' using errcode = 'P0001';
  end if;
  update os.ativo_saidas set
    desfeita_por = (select auth.uid()), desfeita_em = now(), desfeita_motivo = btrim(p_motivo)
  where id = p_saida;
  update os.ativos set situacao = v.situacao_anterior, baixa_data = null, baixa_motivo = null
  where id = v.ativo_id;
end;
$$;

grant select on os.ativo_saidas to authenticated;
grant all on os.ativo_saidas to service_role;
revoke all on function os.registrar_saida_ativo(uuid, text, date, text, numeric, text, text, text, text, uuid, text, boolean, text, text, text[]) from public, anon;
revoke all on function os.desfazer_saida_ativo(uuid, text) from public, anon;
grant execute on function os.registrar_saida_ativo(uuid, text, date, text, numeric, text, text, text, text, uuid, text, boolean, text, text, text[]) to authenticated;
grant execute on function os.desfazer_saida_ativo(uuid, text) to authenticated;
