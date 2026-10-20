-- rh: cadastros, parâmetros, benefícios, folha, ponto e custo de pessoal.
-- Dado sensível (salário, rubricas, custo individual) fica em tabela própria,
-- liberada só com rh.custo_pessoal.individual.

create schema rh;
grant usage on schema rh to authenticated, service_role;

create type rh.tipo_contrato as enum ('clt', 'aprendiz', 'estagiario', 'pj', 'pro_labore');
create type rh.situacao_folha as enum (
  'trabalhando', 'ferias', 'doenca', 'acidente', 'aposentadoria', 'demitido'
);
create type rh.status_folha as enum ('importada', 'conferida', 'fechada');
create type rh.natureza_rubrica as enum ('provento', 'desconto', 'informativa');
-- Como cada rubrica entra no custo (especificação do RH, seção 4.2).
create type rh.grupo_rubrica as enum (
  'salario',               -- remuneração
  'pro_labore',            -- custo do pró-labore (+ INSS 20%)
  'adicional',             -- remuneração, entra na base dos encargos
  'hora_extra',            -- remuneração
  'adiantamento',          -- não entra: é só o momento do pagamento
  'afastamento',           -- não entra: provento e desconto se anulam
  'rescisao',              -- custo (ex.: aviso prévio indenizado)
  'pagamento_provisionado',-- férias e 13º pagos: consomem a provisão
  'beneficio_desconto',    -- reduz o custo do benefício (coparticipação)
  'desconto_terceiros',    -- não entra: só repasse (pensão, consignado…)
  'imposto_funcionario',   -- não entra: já está no bruto
  'arredondamento',        -- não entra
  'reembolso_inss',        -- abate do custo (salário-família)
  'nao_classificada'       -- rubrica nova: a Gestora precisa classificar
);
create type rh.tipo_beneficio as enum (
  'plano_saude', 'odonto', 'alimentacao', 'transporte', 'seguro', 'outro'
);
create type rh.regra_dependente as enum ('nao_paga', 'percentual', 'valor_fixo');
create type rh.origem_valor as enum ('manual', 'enet');

-- ---------------------------------------------------------------------------
-- Cadastros
-- ---------------------------------------------------------------------------

create table rh.departamentos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  -- "Depto" do Extrato Mensal (2 a 6).
  codigo_folha int unique,
  -- Id do departamento no Secullum. Junto com codigo_folha, é o de-para.
  secullum_id int unique,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table rh.cargos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  codigo_folha int unique,
  cbo text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table rh.motivos_desligamento (
  id uuid primary key default gen_random_uuid(),
  secullum_id int unique,
  descricao text not null,
  -- Classificação para o turnover (ex.: voluntário, involuntário). Configurável.
  tipo_turnover text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table rh.colaboradores (
  id uuid primary key default gen_random_uuid(),
  -- "Empr." no Extrato Mensal = NumeroFolha no Secullum. Null para quem não
  -- está na folha (ex.: PJ).
  matricula int unique,
  nome text not null,
  nascimento date,
  admissao date,
  desligamento date,
  motivo_desligamento_id uuid references rh.motivos_desligamento (id) on delete set null,
  tipo_contrato rh.tipo_contrato,
  departamento_id uuid references rh.departamentos (id) on delete set null,
  cargo_id uuid references rh.cargos (id) on delete set null,
  secullum_id int unique,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (desligamento is null or admissao is null or desligamento >= admissao)
);

create index colaboradores_departamento on rh.colaboradores (departamento_id);

create table rh.dependentes (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references rh.colaboradores (id) on delete cascade,
  nome text not null,
  nascimento date,
  tem_plano boolean not null default false,
  tem_odonto boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index dependentes_colaborador on rh.dependentes (colaborador_id);

-- ---------------------------------------------------------------------------
-- Parâmetros (com vigência; toda alteração vai para core.auditoria)
-- Percentuais: 20 = 20%.
-- ---------------------------------------------------------------------------

create table rh.parametros_empresa (
  vigente_desde core.competencia primary key,
  regime_tributario text,
  rat_pct numeric(7, 3) not null check (rat_pct between 0 and 3),
  fap numeric(5, 4) not null check (fap between 0.5 and 2),
  banco_horas_inicio date not null,
  banco_horas_fim date not null,
  banco_horas_adicional_pct numeric(7, 3) not null default 50 check (banco_horas_adicional_pct >= 0),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (banco_horas_fim > banco_horas_inicio)
);

create table rh.encargos_por_contrato (
  tipo_contrato rh.tipo_contrato not null,
  vigente_desde core.competencia not null,
  inss_patronal_pct numeric(7, 3) not null check (inss_patronal_pct >= 0),
  terceiros_pct numeric(7, 3) not null check (terceiros_pct >= 0),
  fgts_pct numeric(7, 3) not null check (fgts_pct >= 0),
  -- RAT ajustado (rat × fap) de parametros_empresa incide?
  aplica_rat boolean not null,
  provisiona_13 boolean not null,
  provisiona_ferias boolean not null,
  -- Multa rescisória provisionada: % sobre o FGTS do mês (40 na CLT).
  multa_rescisoria_pct numeric(7, 3) not null check (multa_rescisoria_pct >= 0),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (tipo_contrato, vigente_desde)
);

-- Jornada mensal em níveis: o mais específico vence
-- (colaborador > cargo > departamento > empresa). Sem nenhum id = empresa.
create table rh.jornadas (
  id uuid primary key default gen_random_uuid(),
  departamento_id uuid references rh.departamentos (id) on delete cascade,
  cargo_id uuid references rh.cargos (id) on delete cascade,
  colaborador_id uuid references rh.colaboradores (id) on delete cascade,
  horas_mes_min int not null check (horas_mes_min > 0),
  vigente_desde core.competencia not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (num_nonnulls(departamento_id, cargo_id, colaborador_id) <= 1),
  unique nulls not distinct (departamento_id, cargo_id, colaborador_id, vigente_desde)
);

create table rh.rubricas (
  codigo int primary key,
  descricao text not null,
  grupo rh.grupo_rubrica not null default 'nao_classificada',
  classificada_por uuid references core.usuarios (id) on delete set null,
  classificada_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Benefícios e plano de saúde
-- ---------------------------------------------------------------------------

create table rh.beneficios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo rh.tipo_beneficio not null,
  -- Valor mensal cheio. Null em plano e odonto: vem da tabela de faixas.
  valor_padrao numeric(14, 2) check (valor_padrao >= 0),
  -- Rubricas da folha com o que o funcionário paga (ex.: {307, 8111}).
  rubricas_desconto int[] not null default '{}',
  -- Rubricas do que o funcionário paga pelos dependentes (ex.: {490}).
  rubricas_desconto_dependente int[] not null default '{}',
  -- Quanto a empresa paga do dependente.
  dependente_regra rh.regra_dependente not null default 'nao_paga',
  dependente_valor numeric(14, 2) check (dependente_valor >= 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check ((dependente_regra = 'nao_paga') = (dependente_valor is null))
);

create table rh.colaborador_beneficios (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references rh.colaboradores (id) on delete cascade,
  beneficio_id uuid not null references rh.beneficios (id) on delete restrict,
  -- Se preenchido, a mudança de faixa não sobrescreve.
  valor_manual numeric(14, 2) check (valor_manual >= 0),
  desde date not null,
  ate date,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (ate is null or ate >= desde)
);

create index colaborador_beneficios_colaborador on rh.colaborador_beneficios (colaborador_id);

-- Uma tabela por reajuste da operadora, por benefício (plano ou odonto).
create table rh.plano_tabelas (
  id uuid primary key default gen_random_uuid(),
  beneficio_id uuid not null references rh.beneficios (id) on delete restrict,
  vigente_desde core.competencia not null,
  reajuste_pct numeric(7, 3),
  importacao_id uuid references core.importacoes (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (beneficio_id, vigente_desde)
);

create table rh.plano_faixas_etarias (
  tabela_id uuid not null references rh.plano_tabelas (id) on delete cascade,
  idade_min int not null check (idade_min >= 0),
  -- Null: sem limite (ex.: "59 ou mais").
  idade_max int,
  mensalidade numeric(14, 2) not null check (mensalidade >= 0),
  primary key (tabela_id, idade_min),
  check (idade_max is null or idade_max >= idade_min)
);

-- Quanto o colaborador paga do titular, pelo tempo de casa.
create table rh.plano_coparticipacao (
  tabela_id uuid not null references rh.plano_tabelas (id) on delete cascade,
  meses_min int not null check (meses_min >= 0),
  meses_max int,
  colaborador_pct numeric(7, 3) check (colaborador_pct between 0 and 100),
  colaborador_valor_fixo numeric(14, 2) check (colaborador_valor_fixo >= 0),
  primary key (tabela_id, meses_min),
  check (meses_max is null or meses_max >= meses_min),
  check (num_nonnulls(colaborador_pct, colaborador_valor_fixo) = 1)
);

-- ---------------------------------------------------------------------------
-- Folha mensal (Extrato Mensal da Sousa e Couto)
-- ---------------------------------------------------------------------------

create table rh.folhas (
  id uuid primary key default gen_random_uuid(),
  competencia core.competencia not null unique,
  importacao_id uuid references core.importacoes (id) on delete set null,
  -- Resumo da empresa no fim do extrato (INSS, RAT, Terceiros, FGTS, IRRF),
  -- usado na tela de conferência.
  resumo_empresa jsonb not null default '{}',
  status rh.status_folha not null default 'importada',
  -- Protótipo: todo salário e pró-labore trocado por R$ 2.000,00 antes de gravar.
  ficticia boolean not null default false,
  fechada_por uuid references core.usuarios (id) on delete set null,
  fechada_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check ((status = 'fechada') = (fechada_em is not null))
);

-- 🔒 sensível
create table rh.folha_colaboradores (
  folha_id uuid not null references rh.folhas (id) on delete cascade,
  colaborador_id uuid not null references rh.colaboradores (id) on delete restrict,
  situacao rh.situacao_folha not null,
  tipo_contrato rh.tipo_contrato not null,
  -- Como veio no arquivo; departamento_id pode ser corrigido pela Gestora.
  departamento_codigo_folha int,
  departamento_id uuid references rh.departamentos (id) on delete set null,
  cargo_id uuid references rh.cargos (id) on delete set null,
  horas_mes_min int,
  salario numeric(14, 2),
  base_inss numeric(14, 2),
  base_fgts numeric(14, 2),
  valor_fgts numeric(14, 2),
  liquido numeric(14, 2),
  primary key (folha_id, colaborador_id)
);

create index folha_colaboradores_colaborador on rh.folha_colaboradores (colaborador_id);

-- 🔒 sensível
create table rh.folha_rubricas (
  id bigint generated always as identity primary key,
  folha_id uuid not null,
  colaborador_id uuid not null,
  rubrica_codigo int not null references rh.rubricas (codigo) on delete restrict,
  natureza rh.natureza_rubrica not null,
  referencia numeric(14, 4),
  valor numeric(14, 2) not null,
  foreign key (folha_id, colaborador_id)
    references rh.folha_colaboradores (folha_id, colaborador_id) on delete cascade
);

create index folha_rubricas_colaborador on rh.folha_rubricas (folha_id, colaborador_id);

-- ---------------------------------------------------------------------------
-- Ponto (Secullum): totais do /Calcular por colaborador e competência
-- Horas em minutos.
-- ---------------------------------------------------------------------------

create table rh.ponto_mensal (
  competencia core.competencia not null,
  colaborador_id uuid not null references rh.colaboradores (id) on delete cascade,
  -- Departamento no ponto naquele mês.
  departamento_id uuid references rh.departamentos (id) on delete set null,
  previstas_min int not null default 0,   -- Carga
  normais_min int not null default 0,     -- Normais
  faltas_min int not null default 0,      -- Faltas
  atrasos_min int not null default 0,     -- Atras.
  faltas_dias int not null default 0,     -- FaltasDias
  -- {"Abono2": 480, …}: separados até a Gestora dizer o que é cada um.
  abonos_min jsonb not null default '{}',
  banco_saldo_min int not null default 0,     -- BSaldo
  banco_creditos_min int not null default 0,  -- BCred.
  banco_debitos_min int not null default 0,   -- BDeb.
  sync_run_id uuid references integracao.sync_runs (id) on delete set null,
  atualizado_em timestamptz not null default now(),
  primary key (competencia, colaborador_id)
);

create table rh.afastamentos (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references rh.colaboradores (id) on delete cascade,
  inicio date not null,
  fim date not null,
  motivo text,
  justificativa text,
  atualizado_em timestamptz not null default now(),
  check (fim >= inicio),
  unique nulls not distinct (colaborador_id, inicio, justificativa)
);

-- ---------------------------------------------------------------------------
-- Valores financeiros usados pelo RH. Manuais até a integração com o ENET.
-- ---------------------------------------------------------------------------

create table rh.dados_financeiros_mensais (
  competencia core.competencia primary key,
  faturamento_bruto numeric(14, 2),
  custo_despesa_total numeric(14, 2),
  custos_operacionais_sem_pessoal numeric(14, 2),
  lucro numeric(14, 2),
  endomarketing numeric(14, 2),
  origem rh.origem_valor not null default 'manual',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table rh.orcamento_endomarketing (
  ano int primary key check (ano between 2000 and 2100),
  valor numeric(14, 2) not null check (valor >= 0),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 🔒 sensível: é o custo individual do PJ.
create table rh.notas_pj (
  id uuid primary key default gen_random_uuid(),
  competencia core.competencia not null,
  colaborador_id uuid not null references rh.colaboradores (id) on delete restrict,
  numero_documento text not null,
  valor numeric(14, 2) not null check (valor >= 0),
  origem rh.origem_valor not null default 'manual',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (competencia, colaborador_id, numero_documento)
);

-- ---------------------------------------------------------------------------
-- Custo calculado por colaborador e competência
-- ---------------------------------------------------------------------------

-- 🔒 sensível
create table rh.custos_colaborador (
  competencia core.competencia not null,
  colaborador_id uuid not null references rh.colaboradores (id) on delete restrict,
  departamento_id uuid references rh.departamentos (id) on delete set null,
  cargo_id uuid references rh.cargos (id) on delete set null,
  tipo_contrato rh.tipo_contrato not null,
  remuneracao numeric(14, 2) not null default 0,
  encargos numeric(14, 2) not null default 0,
  provisao_13 numeric(14, 2) not null default 0,
  provisao_ferias numeric(14, 2) not null default 0,
  multa_rescisoria numeric(14, 2) not null default 0,
  beneficios numeric(14, 2) not null default 0,
  rescisao numeric(14, 2) not null default 0,
  reembolsos numeric(14, 2) not null default 0,
  custo_total numeric(14, 2) not null,
  jornada_min int check (jornada_min > 0),
  custo_hora numeric(14, 4),
  salario_hora numeric(14, 4),
  -- Cada linha da conta, com o parâmetro usado (memória de cálculo).
  memoria jsonb not null,
  calculado_em timestamptz not null default now(),
  primary key (competencia, colaborador_id),
  check (
    custo_total = remuneracao + encargos + provisao_13 + provisao_ferias
      + multa_rescisoria + beneficios + rescisao - reembolsos
  )
);

create index custos_colaborador_departamento on rh.custos_colaborador (competencia, departamento_id);

-- Somas por departamento e cargo para quem não vê o custo individual.
create function rh.custo_agregado(inicio date, fim date)
returns table (
  competencia date,
  departamento_id uuid,
  cargo_id uuid,
  tipo_contrato rh.tipo_contrato,
  colaboradores bigint,
  remuneracao numeric,
  encargos numeric,
  provisoes numeric,
  beneficios numeric,
  rescisao numeric,
  reembolsos numeric,
  custo_total numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.competencia, c.departamento_id, c.cargo_id, c.tipo_contrato,
    count(*),
    sum(c.remuneracao), sum(c.encargos),
    sum(c.provisao_13 + c.provisao_ferias + c.multa_rescisoria),
    sum(c.beneficios), sum(c.rescisao), sum(c.reembolsos), sum(c.custo_total)
  from rh.custos_colaborador c
  where core.pode('rh.custo_pessoal')
    and c.competencia between inicio and fim
  group by 1, 2, 3, 4;
$$;

-- Quadro por mês (headcount), sem expor salário.
create function rh.quadro_mensal(inicio date, fim date)
returns table (
  competencia date,
  departamento_id uuid,
  tipo_contrato rh.tipo_contrato,
  situacao rh.situacao_folha,
  colaboradores bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select f.competencia, fc.departamento_id, fc.tipo_contrato, fc.situacao, count(*)
  from rh.folha_colaboradores fc
  join rh.folhas f on f.id = fc.folha_id
  where core.pode_modulo('rh')
    and f.competencia between inicio and fim
  group by 1, 2, 3, 4;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'departamentos', 'cargos', 'motivos_desligamento', 'colaboradores', 'dependentes',
    'parametros_empresa', 'encargos_por_contrato', 'jornadas', 'rubricas', 'beneficios',
    'colaborador_beneficios', 'plano_tabelas', 'folhas', 'dados_financeiros_mensais',
    'orcamento_endomarketing', 'notas_pj'
  ] loop
    execute format(
      'create trigger atualizado_em before update on rh.%I
         for each row execute function core.set_atualizado_em()', t);
  end loop;
end;
$$;

create trigger atualizado_em before update on rh.ponto_mensal
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on rh.afastamentos
  for each row execute function core.set_atualizado_em();

-- Histórico de parâmetros e cadastros editados na tela.
create trigger auditoria after insert or update or delete on rh.parametros_empresa
  for each row execute function core.auditar('vigente_desde');
create trigger auditoria after insert or update or delete on rh.encargos_por_contrato
  for each row execute function core.auditar('tipo_contrato', 'vigente_desde');
create trigger auditoria after insert or update or delete on rh.jornadas
  for each row execute function core.auditar('id');
create trigger auditoria after insert or update or delete on rh.rubricas
  for each row execute function core.auditar('codigo');
create trigger auditoria after insert or update or delete on rh.departamentos
  for each row execute function core.auditar('id');
create trigger auditoria after insert or update or delete on rh.motivos_desligamento
  for each row execute function core.auditar('id');
create trigger auditoria after insert or update or delete on rh.beneficios
  for each row execute function core.auditar('id');
create trigger auditoria after insert or update or delete on rh.colaborador_beneficios
  for each row execute function core.auditar('id');
create trigger auditoria after insert or update or delete on rh.plano_tabelas
  for each row execute function core.auditar('id');
create trigger auditoria after insert or update or delete on rh.dados_financeiros_mensais
  for each row execute function core.auditar('competencia');
create trigger auditoria after insert or update or delete on rh.orcamento_endomarketing
  for each row execute function core.auditar('ano');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'rh' loop
    execute format('alter table rh.%I enable row level security', t);
  end loop;
end;
$$;

-- Leitura para qualquer permissão do RH; escrita para quem edita aquilo.
create function rh.criar_politicas(tabela text, ler text, editar text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format(
    'create policy ver on rh.%I for select to authenticated using (%s)', tabela, ler);
  if editar is not null then
    execute format(
      'create policy editar on rh.%I for all to authenticated using (%s) with check (%s)',
      tabela, editar, editar);
  end if;
end;
$$;

select rh.criar_politicas('departamentos', 'core.pode_modulo(''rh'')', 'core.pode(''rh.parametros'')');
select rh.criar_politicas('cargos', 'core.pode_modulo(''rh'')', 'core.pode(''rh.parametros'')');
select rh.criar_politicas('motivos_desligamento', 'core.pode_modulo(''rh'')', 'core.pode(''rh.parametros'')');
select rh.criar_politicas('colaboradores', 'core.pode_modulo(''rh'')', 'core.pode(''rh.parametros'')');
select rh.criar_politicas('dependentes', 'core.pode(''rh.beneficios'')', 'core.pode(''rh.beneficios'')');
select rh.criar_politicas('parametros_empresa', 'core.pode_modulo(''rh'')', 'core.pode(''rh.parametros'')');
select rh.criar_politicas('encargos_por_contrato', 'core.pode_modulo(''rh'')', 'core.pode(''rh.parametros'')');
select rh.criar_politicas('jornadas', 'core.pode_modulo(''rh'')', 'core.pode(''rh.parametros'')');
select rh.criar_politicas('rubricas', 'core.pode_modulo(''rh'')', 'core.pode(''rh.parametros'') or core.pode(''rh.folha'')');
select rh.criar_politicas('beneficios', 'core.pode_modulo(''rh'')', 'core.pode(''rh.beneficios'')');
select rh.criar_politicas('colaborador_beneficios', 'core.pode(''rh.beneficios'')', 'core.pode(''rh.beneficios'')');
select rh.criar_politicas('plano_tabelas', 'core.pode_modulo(''rh'')', 'core.pode(''rh.beneficios'')');
select rh.criar_politicas('plano_faixas_etarias', 'core.pode_modulo(''rh'')', 'core.pode(''rh.beneficios'')');
select rh.criar_politicas('plano_coparticipacao', 'core.pode_modulo(''rh'')', 'core.pode(''rh.beneficios'')');
select rh.criar_politicas('folhas', 'core.pode_modulo(''rh'')', 'core.pode(''rh.folha'')');
-- Sensíveis: ler exige a permissão individual; importar exige rh.folha.
select rh.criar_politicas('folha_colaboradores', 'core.pode(''rh.custo_pessoal.individual'')', 'core.pode(''rh.folha'')');
select rh.criar_politicas('folha_rubricas', 'core.pode(''rh.custo_pessoal.individual'')', 'core.pode(''rh.folha'')');
select rh.criar_politicas('custos_colaborador', 'core.pode(''rh.custo_pessoal.individual'')', null);
select rh.criar_politicas('notas_pj', 'core.pode(''rh.custo_pessoal.individual'')', 'core.pode(''rh.parametros'')');
-- Vindos do ponto: só a sincronização grava.
select rh.criar_politicas('ponto_mensal', 'core.pode(''rh.jornada'') or core.pode(''rh.painel'')', null);
select rh.criar_politicas('afastamentos', 'core.pode_modulo(''rh'')', null);
select rh.criar_politicas('dados_financeiros_mensais', 'core.pode_modulo(''rh'')', 'core.pode(''rh.parametros'')');
select rh.criar_politicas('orcamento_endomarketing', 'core.pode_modulo(''rh'')', 'core.pode(''rh.parametros'')');

drop function rh.criar_politicas(text, text, text);

-- ---------------------------------------------------------------------------
-- Privilégios (o RLS decide as linhas)
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on all tables in schema rh to authenticated;
revoke insert, update, delete on rh.custos_colaborador, rh.ponto_mensal, rh.afastamentos
  from authenticated;
grant all on all tables in schema rh to service_role;
grant usage on all sequences in schema rh to authenticated, service_role;
grant execute on all functions in schema rh to authenticated, service_role;
