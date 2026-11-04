-- comercial: o que o próprio sistema cria e edita no módulo Comercial (spec
-- de 27/10/2026, seções 3, 4.7 a 4.16 e 6).
--
-- RD Station (CRM, Marketing, Conversas) e ENET (LUCs, contratos, clientes,
-- contas a receber) não moram aqui nesta fase: as telas leem dados de exemplo
-- gerados no servidor (src/server/comercial/fontes.ts). Aqui ficam
-- parâmetros e tabelas de apoio (4.13), registro de contatos (4.7), Censo
-- (4.8 e 4.9), fichas cadastrais (4.12), contratos e distratos (4.11), kit de
-- entrega (4.14), propostas de evento (4.15), pesquisa de mercado (4.16),
-- importações do histórico (4.13) e a foto mensal da ocupação (4.10).
--
-- Formulários públicos (ficha e Censo por token): o servidor grava pela
-- service role depois de conferir o token. Nada é aberto para anon.
-- Linhas com exemplo = true são do mockup; comercial.remover_exemplos() apaga.

create schema comercial;
grant usage on schema comercial to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Permissões (seção 3; mesmo catálogo de src/lib/permissions.ts)
-- ---------------------------------------------------------------------------

insert into core.permissoes (codigo, descricao) values
  ('comercial.funil.ver', 'Abrir a tela Funil comercial'),
  ('comercial.funil.ver_contato', 'Ver nome, e-mail e telefone do contato da oportunidade'),
  ('comercial.ocupacao.ver', 'Abrir a tela Ocupação e estoque'),
  ('comercial.vencimentos.ver', 'Abrir a tela Vencimentos de contrato'),
  ('comercial.valores.ver', 'Ver valores de aluguel, contrato e carteira nas telas (sem ela, as colunas de valor ficam ocultas)'),
  ('comercial.relacionamento.ver', 'Abrir a tela Relacionamento e receber os lembretes'),
  ('comercial.relacionamento.registrar', 'Registrar contato ou feedback de locatário'),
  ('comercial.censo.ver', 'Abrir as telas do Censo (indicadores e feedbacks)'),
  ('comercial.censo.aplicar', 'Abrir rodada do Censo, gerar o link do questionário, lançar resposta em nome da empresa e encerrar rodada'),
  ('comercial.censo.importar', 'Importar o histórico do Censo e desfazer importações'),
  ('comercial.painel.ver', 'Abrir o Painel de indicadores comerciais'),
  ('comercial.painel.metas', 'Cadastrar e alterar as metas do painel'),
  ('comercial.contratos.ver', 'Ver contratos, distratos e rascunhos'),
  ('comercial.contratos.editar', 'Criar e editar rascunhos de contrato e de distrato'),
  ('comercial.contratos.gerar', 'Gerar a versão final do contrato ou do distrato (Word e PDF, a partir da V2)'),
  ('comercial.formulario.ver', 'Ver as fichas cadastrais recebidas (dados pessoais e renda)'),
  ('comercial.formulario.link', 'Gerar e enviar o link da ficha cadastral'),
  ('comercial.kit.ver', 'Ver e baixar os documentos do kit de entrega'),
  ('comercial.kit.editar', 'Subir nova versão de documento do kit e mudar validade'),
  ('comercial.eventos.ver', 'Abrir o simulador e as propostas de eventos'),
  ('comercial.eventos.editar', 'Criar simulação e gerar proposta de evento'),
  ('comercial.pesquisa.ver', 'Abrir a Pesquisa de mercado'),
  ('comercial.pesquisa.editar', 'Cadastrar e corrigir imóveis pesquisados'),
  ('comercial.parametros.editar', 'Alterar as tabelas de apoio (de-para de fontes, faixas, preços de eventos, modelos)'),
  ('comercial.exportar', 'Exportar Excel e PDF em qualquer tela do módulo');

insert into core.cargo_permissoes (cargo_id, permissao)
  select c.id, p.codigo
  from core.cargos c
  join core.permissoes p on p.codigo like 'comercial.%'
  where c.nome = 'Administrador'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Parâmetros (4.13): uma linha só, uma coluna por campo do quadro.
-- ---------------------------------------------------------------------------

create table comercial.parametros (
  id boolean primary key default true check (id),
  -- Funil
  funil_padrao text not null default 'Comercial - Espaço Arp' check (btrim(funil_padrao) <> ''),
  -- Ocupação e carteira
  transferencia_dias int not null default 30 check (transferencia_dias between 0 and 365),
  curva_a_pct numeric(5, 2) not null default 70 check (curva_a_pct > 0 and curva_a_pct < 100),
  curva_b_pct numeric(5, 2) not null default 90 check (curva_b_pct > 0 and curva_b_pct < 100),
  -- Vencimentos e relacionamento
  vencimento_faixa1_dias int not null default 30 check (vencimento_faixa1_dias > 0),
  vencimento_faixa2_dias int not null default 90 check (vencimento_faixa2_dias > 0),
  lembrete_aniversario_dias int not null default 3 check (lembrete_aniversario_dias between 0 and 60),
  -- Vencimentos: reajuste previsto para contratos com reajuste nos próximos N dias (4.6).
  reajuste_previsto_dias int not null default 60 check (reajuste_previsto_dias between 1 and 365),
  -- Contratos
  empreendimento_nome text not null default 'ARP' check (btrim(empreendimento_nome) <> ''),
  endereco_cep text not null default '28613-001',
  endereco_logradouro text not null default 'Av. Conselheiro Julius Arp',
  endereco_numero text not null default '80',
  endereco_complemento text,
  endereco_bairro text not null default 'Centro',
  endereco_cidade text not null default 'Nova Friburgo',
  endereco_uf text not null default 'RJ' check (endereco_uf ~ '^[A-Z]{2}$'),
  indice_padrao text not null default 'IGPM' check (indice_padrao in ('IGPM', 'IPCA')),
  dia_vencimento_padrao int not null default 10 check (dia_vencimento_padrao between 1 and 31),
  caucao_alugueis numeric(5, 2) not null default 3 check (caucao_alugueis > 0),
  caucao_prazo_dias int not null default 5 check (caucao_prazo_dias >= 0),
  capitalizacao_prazo_dias int not null default 7 check (capitalizacao_prazo_dias >= 0),
  nc004_versao text not null default 'JUL/26' check (btrim(nc004_versao) <> ''),
  obras_tapume_dias int not null default 7 check (obras_tapume_dias >= 0),
  obras_retirada_dias int not null default 60 check (obras_retirada_dias >= 0),
  obras_projetos_dias int not null default 60 check (obras_projetos_dias >= 0),
  multa_alugueis numeric(5, 2) not null default 3 check (multa_alugueis >= 0),
  vaga_promocional_padrao int not null default 1 check (vaga_promocional_padrao >= 0),
  consumo_agua_padrao boolean not null default true,
  entrega_tipo_imovel text not null default 'Loja',
  entrega_padrao text not null default 'Shell / infraestrutura básica',
  entrega_prazo_implantacao_dias int not null default 60 check (entrega_prazo_implantacao_dias >= 0),
  -- Campos obrigatórios de cada garantia na Revisão: { "<garantia>": ["campo", ...] }.
  obrigatorios_garantia jsonb not null default '{}' check (jsonb_typeof(obrigatorios_garantia) = 'object'),
  -- Ficha cadastral
  ficha_boas_vindas text not null default '',
  ficha_termo_lgpd text not null default '',
  ficha_validade_dias int not null default 30 check (ficha_validade_dias between 1 and 365),
  -- Censo
  censo_dias_mensalidade int not null default 22 check (censo_dias_mensalidade between 1 and 31),
  -- Kit de entrega
  kit_aviso_dias int not null default 60 check (kit_aviso_dias between 0 and 365),
  -- Eventos (os valores de faixas_evento já estão com o reajuste; o % fica registrado)
  evento_reajuste_pct numeric(5, 2) not null default 10,
  evento_desconto_pct numeric(5, 2) not null default 30 check (evento_desconto_pct between 0 and 100),
  evento_pessoas_por_seguranca int not null default 100 check (evento_pessoas_por_seguranca > 0),
  evento_m2_por_agente int not null default 200 check (evento_m2_por_agente > 0),
  evento_fechamento_dias_uteis int not null default 30 check (evento_fechamento_dias_uteis >= 0),
  evento_validade_dias int not null default 30 check (evento_validade_dias > 0),
  evento_horario text not null default '10h às 22h',
  evento_condicao_pagamento text not null default '50% na reserva e 50% 48h antes da realização',
  evento_montagem text not null default 'Dia anterior, a partir das 19h',
  evento_desmontagem text not null default 'Liberar até 02h após o final da ação',
  evento_area_texto text not null default 'Partes demarcadas em planta anexa',
  evento_notas text[] not null default '{}',
  -- Pesquisa de mercado: limites das faixas de tamanho (m²); acima do último = "acima de".
  pesquisa_faixas_m2 numeric[] not null default '{30,50,80,100}' check (cardinality(pesquisa_faixas_m2) > 0),
  atualizado_em timestamptz not null default now(),
  check (curva_a_pct < curva_b_pct),
  check (vencimento_faixa1_dias < vencimento_faixa2_dias)
);

-- Listas editáveis (4.13). "extra" guarda o atributo de cada lista:
-- tipo_contato { "feedback": true } entra na tela de Feedbacks (4.9);
-- ficha_documento_* { "obrigatorio": true }.
create table comercial.listas (
  id uuid primary key default gen_random_uuid(),
  lista text not null check (lista in (
    'fonte_ajustada',
    'tipo_contato',
    'canal_contato',
    'censo_bloco',
    'censo_segmento',
    'censo_expectativa',
    'pesquisa_bairro',
    'pesquisa_tipo',
    'ficha_documento_pf',
    'ficha_documento_pj',
    'ficha_documento_fiador',
    'evento_observacao',
    'kit_categoria'
  )),
  valor text not null check (btrim(valor) <> ''),
  ordem int not null default 0,
  ativo boolean not null default true,
  extra jsonb not null default '{}' check (jsonb_typeof(extra) = 'object'),
  atualizado_em timestamptz not null default now()
);

create unique index listas_valor on comercial.listas (lista, lower(btrim(valor)));
create index listas_ordem on comercial.listas (lista, ordem);

-- De-para de fontes do RD para a fonte ajustada (lista fonte_ajustada).
create table comercial.fontes_de_para (
  fonte_rd text primary key check (btrim(fonte_rd) <> ''),
  fonte_ajustada text not null check (btrim(fonte_ajustada) <> ''),
  atualizado_em timestamptz not null default now()
);

create index fontes_de_para_ajustada on comercial.fontes_de_para (fonte_ajustada);

-- Tipo de LUC do ENET ("Tipo loja") e se conta na ocupação (4.5).
create table comercial.tipos_luc (
  tipo text primary key check (btrim(tipo) <> ''),
  conta_ocupacao boolean not null default true,
  ordem int not null default 0,
  atualizado_em timestamptz not null default now()
);

-- Tabela de preço de eventos (4.15). fixo: valor por dia; senão, por m² por dia.
create table comercial.faixas_evento (
  id uuid primary key default gen_random_uuid(),
  ordem int not null unique,
  nome text not null check (btrim(nome) <> ''),
  area_de numeric(10, 2) not null check (area_de >= 0),
  area_ate numeric(10, 2) not null,
  fixo boolean not null default false,
  valor_comum numeric(14, 2) not null check (valor_comum >= 0),
  valor_sazonal numeric(14, 2) not null check (valor_sazonal >= 0),
  atualizado_em timestamptz not null default now(),
  check (area_ate > area_de)
);

-- ---------------------------------------------------------------------------
-- Importações do histórico (4.13). As linhas importadas guardam
-- importacao_id; comercial.desfazer_importacao() apaga e marca "desfeita".
-- ---------------------------------------------------------------------------

create table comercial.importacoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('censo', 'fichas', 'pesquisa', 'contatos')),
  arquivo_nome text not null,
  -- Bucket "comercial": importacoes/<tipo>/<id>/<arquivo>.
  arquivo_path text,
  arquivo_sha256 text not null,
  linhas int not null default 0 check (linhas >= 0),
  duplicadas int not null default 0 check (duplicadas >= 0),
  com_aviso int not null default 0 check (com_aviso >= 0),
  avisos jsonb not null default '[]' check (jsonb_typeof(avisos) = 'array'),
  status text not null default 'previa' check (status in ('previa', 'confirmada', 'desfeita')),
  enviado_por uuid references core.usuarios (id) on delete set null,
  confirmado_por uuid references core.usuarios (id) on delete set null,
  confirmado_em timestamptz,
  desfeito_por uuid references core.usuarios (id) on delete set null,
  desfeito_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- "Arquivo já importado": o mesmo arquivo só vale uma vez por tipo.
create unique index importacoes_uma_confirmada
  on comercial.importacoes (tipo, arquivo_sha256) where status = 'confirmada';
create index importacoes_criado_em on comercial.importacoes (criado_em desc);
create index importacoes_enviado_por on comercial.importacoes (enviado_por);
create index importacoes_confirmado_por on comercial.importacoes (confirmado_por);
create index importacoes_desfeito_por on comercial.importacoes (desfeito_por);

-- Quem importa cada tipo: quem grava aquele dado.
create function comercial.pode_importar(p_tipo text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case p_tipo
    when 'censo' then core.pode('comercial.censo.importar')
    when 'fichas' then core.pode('comercial.formulario.ver')
    when 'pesquisa' then core.pode('comercial.pesquisa.editar')
    when 'contatos' then core.pode('comercial.relacionamento.registrar')
    else false
  end;
$$;

-- ---------------------------------------------------------------------------
-- Registro de contatos com locatários (4.7). Ligado ao locatário e ao
-- contrato do ENET (não ao imóvel); LUC e bloco ficam para filtro.
-- ---------------------------------------------------------------------------

create table comercial.contatos (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date,
  locatario_enet_id text,
  locatario_nome text not null check (btrim(locatario_nome) <> ''),
  contrato_enet_id text,
  luc text,
  bloco text,
  -- Valores das listas tipo_contato e canal_contato (conferidos no servidor).
  tipo text not null check (btrim(tipo) <> ''),
  canal text not null check (btrim(canal) <> ''),
  descricao text not null check (btrim(descricao) <> ''),
  precisa_outro_setor boolean not null default false,
  registrado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  registrado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  importacao_id uuid references comercial.importacoes (id),
  exemplo boolean not null default false
);

create index contatos_data on comercial.contatos (data desc);
create index contatos_tipo on comercial.contatos (tipo);
create index contatos_bloco on comercial.contatos (bloco);
create index contatos_locatario on comercial.contatos (locatario_enet_id);
create index contatos_contrato on comercial.contatos (contrato_enet_id);
create index contatos_registrado_por on comercial.contatos (registrado_por);
create index contatos_importacao on comercial.contatos (importacao_id);

-- ---------------------------------------------------------------------------
-- Censo (4.8 e 4.9)
-- ---------------------------------------------------------------------------

create table comercial.censo_rodadas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  inicio date not null,
  fim date not null,
  situacao text not null default 'aberta' check (situacao in ('aberta', 'encerrada')),
  criada_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  criada_em timestamptz not null default now(),
  encerrada_por uuid references core.usuarios (id) on delete set null,
  encerrada_em timestamptz,
  atualizado_em timestamptz not null default now(),
  importacao_id uuid references comercial.importacoes (id),
  exemplo boolean not null default false,
  check (fim >= inicio)
);

create unique index censo_rodadas_nome on comercial.censo_rodadas (lower(btrim(nome)));
create index censo_rodadas_inicio on comercial.censo_rodadas (inicio desc);
create index censo_rodadas_criada_por on comercial.censo_rodadas (criada_por);
create index censo_rodadas_encerrada_por on comercial.censo_rodadas (encerrada_por);
create index censo_rodadas_importacao on comercial.censo_rodadas (importacao_id);

-- Link único por empresa (locatário ativo do ENET) na rodada, sem login.
create table comercial.censo_convites (
  id uuid primary key default gen_random_uuid(),
  rodada_id uuid not null references comercial.censo_rodadas (id) on delete cascade,
  token text not null unique
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
    check (length(token) >= 32),
  locatario_enet_id text,
  empresa_nome text not null check (btrim(empresa_nome) <> ''),
  luc text,
  bloco text,
  enviado_em timestamptz,
  criado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  exemplo boolean not null default false
);

create unique index censo_convites_empresa on comercial.censo_convites (rodada_id, locatario_enet_id);
create index censo_convites_bloco on comercial.censo_convites (rodada_id, bloco);
create index censo_convites_criado_por on comercial.censo_convites (criado_por);

-- Perguntas 1 a 10 e 7a. Números nulos = sem resposta válida (a importação
-- deixa fora do indicador o que não é número). bloco/segmento nulos = "(vazio)".
create table comercial.censo_respostas (
  id uuid primary key default gen_random_uuid(),
  rodada_id uuid not null references comercial.censo_rodadas (id) on delete cascade,
  -- Uma resposta por convite; importadas não têm convite.
  convite_id uuid unique references comercial.censo_convites (id) on delete set null,
  locatario_enet_id text,
  luc text,
  email text,                                      -- 1
  bloco text,                                      -- 2
  segmento text,                                   -- 3
  empresa_nome text not null check (btrim(empresa_nome) <> ''), -- 4
  colaboradores int check (colaboradores >= 0),    -- 5
  visitantes_dia int check (visitantes_dia >= 0),  -- 6
  ticket numeric(14, 2) check (ticket >= 0),       -- 7
  mensalidade boolean,                             -- 7a
  dias_uso int check (dias_uso between 1 and 31),  -- 7a
  conversoes_dia int check (conversoes_dia >= 0),  -- 8
  expectativas text[] not null default '{}',       -- 9
  sugestao text,                                   -- 10
  -- ticket ÷ dias de uso quando é mensalidade; senão o ticket. Gravado pelo
  -- servidor (em 2026 vem da coluna da planilha).
  ticket_ajustado numeric(14, 4) check (ticket_ajustado >= 0),
  -- Empresa repetida na rodada: só uma conta (a mais recente; o usuário muda).
  considerada boolean not null default true,
  origem text not null default 'link' check (origem in ('link', 'presencial', 'importacao')),
  -- Quem lançou em nome da empresa (presencial); nulo pelo link.
  lancada_por uuid references core.usuarios (id) on delete set null,
  respondida_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  importacao_id uuid references comercial.importacoes (id),
  exemplo boolean not null default false,
  check (mensalidade is true or dias_uso is null)
);

create unique index censo_respostas_uma_por_empresa
  on comercial.censo_respostas (rodada_id, coalesce(locatario_enet_id, lower(btrim(empresa_nome))))
  where considerada;
create index censo_respostas_rodada on comercial.censo_respostas (rodada_id, bloco, segmento);
create index censo_respostas_lancada_por on comercial.censo_respostas (lancada_por);
create index censo_respostas_importacao on comercial.censo_respostas (importacao_id);

-- Responde até a rodada fechar; a importação grava na rodada já fechada.
-- Depois de fechada, só "considerada" muda.
create function comercial.censo_resposta_conferir()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_situacao text;
  v_rodada uuid;
begin
  if new.convite_id is not null then
    select rodada_id into v_rodada from comercial.censo_convites where id = new.convite_id;
    if v_rodada is distinct from new.rodada_id then
      raise exception 'o convite é de outra rodada' using errcode = '22023';
    end if;
  end if;
  select situacao into v_situacao from comercial.censo_rodadas where id = new.rodada_id;
  if v_situacao = 'encerrada' then
    if tg_op = 'INSERT' and new.origem <> 'importacao' then
      raise exception 'a rodada do Censo está encerrada' using errcode = '22023';
    end if;
    if tg_op = 'UPDATE'
      and (to_jsonb(new) - 'considerada' - 'atualizado_em')
        is distinct from (to_jsonb(old) - 'considerada' - 'atualizado_em') then
      raise exception 'a rodada do Censo está encerrada' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

create trigger conferir before insert or update on comercial.censo_respostas
  for each row execute function comercial.censo_resposta_conferir();

create table comercial.censo_temas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  exemplo boolean not null default false
);

create unique index censo_temas_nome on comercial.censo_temas (lower(btrim(nome)));

-- Sugestão (pergunta 10 ou contato de feedback) num tema. Um texto pode ter
-- mais de um tema; mover troca tema_id e grava quem moveu.
create table comercial.censo_sugestao_temas (
  id uuid primary key default gen_random_uuid(),
  tema_id uuid not null references comercial.censo_temas (id) on delete cascade,
  resposta_id uuid references comercial.censo_respostas (id) on delete cascade,
  contato_id uuid references comercial.contatos (id) on delete cascade,
  -- Trecho usado como exemplo (sem o nome da empresa).
  trecho text,
  origem text not null default 'manual' check (origem in ('manual', 'ia', 'importacao')),
  movido_por uuid references core.usuarios (id) on delete set null,
  movido_em timestamptz,
  criado_em timestamptz not null default now(),
  exemplo boolean not null default false,
  check ((resposta_id is null) <> (contato_id is null))
);

create unique index censo_sugestao_temas_resposta on comercial.censo_sugestao_temas (resposta_id, tema_id);
create unique index censo_sugestao_temas_contato on comercial.censo_sugestao_temas (contato_id, tema_id);
create index censo_sugestao_temas_tema on comercial.censo_sugestao_temas (tema_id);
create index censo_sugestao_temas_movido_por on comercial.censo_sugestao_temas (movido_por);

create function comercial.sugestao_movida()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.tema_id is distinct from old.tema_id then
    new.movido_por := (select auth.uid());
    new.movido_em := now();
  end if;
  return new;
end;
$$;

create trigger movida before update on comercial.censo_sugestao_temas
  for each row execute function comercial.sugestao_movida();

-- ---------------------------------------------------------------------------
-- Ficha cadastral (4.12). Link único por interessado; quem abre vê só a
-- própria. Dado pessoal (CPF/CNPJ e as 48 respostas) fica em ficha_dados,
-- liberada só com comercial.formulario.ver.
-- ---------------------------------------------------------------------------

create table comercial.fichas (
  id uuid primary key default gen_random_uuid(),
  token text not null unique
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
    check (length(token) >= 32),
  -- Pergunta 4; nulo até o interessado escolher.
  tipo text check (tipo in ('pj', 'pf', 'fiador')),
  situacao text not null default 'em_preenchimento'
    check (situacao in ('em_preenchimento', 'recebida', 'usada')),
  -- LUC pretendido (pergunta 3); nulo = "Ainda não sei".
  luc text,
  -- Nome completo (15) ou razão social (5); antes, para quem o link foi gerado.
  nome text,
  -- Fiador ou cônjuge ligado à ficha do locatário.
  ficha_principal_id uuid references comercial.fichas (id) on delete set null,
  origem text not null default 'sistema' check (origem in ('sistema', 'google_forms')),
  gerada_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  gerada_em timestamptz not null default now(),
  expira_em timestamptz,
  iniciada_em timestamptz,
  consentimento_em timestamptz,
  recebida_em timestamptz,
  usada_em timestamptz,
  ultimo_acesso_em timestamptz,
  atualizado_em timestamptz not null default now(),
  importacao_id uuid references comercial.importacoes (id),
  exemplo boolean not null default false,
  -- Sem aceite da LGPD não segue.
  check (situacao = 'em_preenchimento' or (consentimento_em is not null and recebida_em is not null))
);

create index fichas_gerada_em on comercial.fichas (gerada_em desc);
create index fichas_situacao on comercial.fichas (situacao, tipo);
create index fichas_luc on comercial.fichas (luc);
create index fichas_nome on comercial.fichas (lower(nome));
create index fichas_principal on comercial.fichas (ficha_principal_id);
create index fichas_gerada_por on comercial.fichas (gerada_por);
create index fichas_importacao on comercial.fichas (importacao_id);

create table comercial.ficha_dados (
  ficha_id uuid primary key references comercial.fichas (id) on delete cascade,
  -- CPF ou CNPJ, só dígitos.
  documento text check (documento ~ '^[0-9]{11}([0-9]{3})?$'),
  -- Perguntas 1 a 48 (validadas por Zod no servidor).
  respostas jsonb not null default '{}' check (jsonb_typeof(respostas) = 'object'),
  -- Pergunta 48 (o sistema avisa se for diferente do nome da 15).
  assinatura_nome text,
  atualizado_em timestamptz not null default now()
);

create index ficha_dados_documento on comercial.ficha_dados (documento);

-- Documentos comprobatórios (um por item das listas ficha_documento_*).
create table comercial.ficha_documentos (
  id uuid primary key default gen_random_uuid(),
  ficha_id uuid not null references comercial.fichas (id) on delete cascade,
  documento text not null check (btrim(documento) <> ''),
  -- Bucket "comercial": fichas/<ficha_id>/<arquivo>.
  arquivo_path text not null,
  arquivo_nome text not null,
  tamanho bigint check (tamanho >= 0),
  tipo_mime text,
  enviado_em timestamptz not null default now()
);

create index ficha_documentos_ficha on comercial.ficha_documentos (ficha_id);

-- Quem abriu cada ficha (LGPD, seção 10).
create table comercial.ficha_acessos (
  id bigint generated always as identity primary key,
  ficha_id uuid not null references comercial.fichas (id) on delete cascade,
  usuario_id uuid not null default auth.uid() references core.usuarios (id) on delete cascade,
  acao text not null default 'abriu' check (acao in ('abriu', 'pdf', 'documento')),
  em timestamptz not null default now()
);

create index ficha_acessos_ficha on comercial.ficha_acessos (ficha_id, em desc);
create index ficha_acessos_usuario on comercial.ficha_acessos (usuario_id);

-- ---------------------------------------------------------------------------
-- Kit de entrega (4.14). Versão nova vira a atual; as antigas ficam.
-- ---------------------------------------------------------------------------

create table comercial.kit_documentos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  -- Valor da lista kit_categoria.
  categoria text not null check (btrim(categoria) <> ''),
  ordem int not null default 0,
  -- Só mapas de fachada: códigos de bloco atendidos (ex.: '11', 'Deck').
  blocos text[] not null default '{}',
  todo_contrato boolean not null default false,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index kit_documentos_nome on comercial.kit_documentos (lower(btrim(nome)));
create index kit_documentos_categoria on comercial.kit_documentos (categoria, ordem);
create index kit_documentos_blocos on comercial.kit_documentos using gin (blocos);

create table comercial.kit_versoes (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references comercial.kit_documentos (id) on delete cascade,
  -- Rótulo da versão (ex.: "2ª alteração", "SET/26", "2026").
  versao text not null check (btrim(versao) <> ''),
  data date,
  -- Nula = sem validade.
  validade date,
  paginas int check (paginas > 0),
  -- Nulos: metadado sem arquivo ainda. Bucket "comercial": kit/<documento_id>/<arquivo>.
  arquivo_path text,
  arquivo_nome text,
  tamanho bigint check (tamanho >= 0),
  atual boolean not null default true,
  enviado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  enviado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index kit_versoes_uma_atual on comercial.kit_versoes (documento_id) where atual;
create index kit_versoes_documento on comercial.kit_versoes (documento_id, enviado_em desc);
create index kit_versoes_validade on comercial.kit_versoes (validade) where atual;
create index kit_versoes_enviado_por on comercial.kit_versoes (enviado_por);

create function comercial.kit_nova_versao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.atual then
    update comercial.kit_versoes set atual = false
      where documento_id = new.documento_id and atual and id <> new.id;
  end if;
  return new;
end;
$$;

create trigger nova_versao before insert on comercial.kit_versoes
  for each row execute function comercial.kit_nova_versao();

-- ---------------------------------------------------------------------------
-- Contratos e distratos (4.11). Rascunho salvo de verdade; cada gravação
-- vira uma linha em contrato_versoes (quem, quando, o que). Gerar de novo um
-- contrato já gerado cria a versão seguinte (V02...).
-- ---------------------------------------------------------------------------

create table comercial.contratos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('contrato', 'distrato')),
  status text not null default 'rascunho' check (status in ('rascunho', 'pronto', 'gerado')),
  versao int not null default 1 check (versao >= 1),
  etapa_atual int not null default 1 check (etapa_atual between 1 and 8),
  -- Códigos bloco_unidade do ENET (um ou mais).
  lucs text[] not null default '{}',
  bloco text,
  area_m2 numeric(10, 2) check (area_m2 >= 0),
  locatario_nome text,
  parte_tipo text check (parte_tipo in ('pf', 'pj')),
  garantia text check (garantia in ('fiador', 'capitalizacao', 'seguro_fianca', 'caucao', 'sem_garantia')),
  aluguel numeric(14, 2) check (aluguel >= 0),
  inicio date,
  termino date,
  -- Dados de cada etapa, por chave da etapa (validados por Zod no servidor).
  dados jsonb not null default '{}' check (jsonb_typeof(dados) = 'object'),
  ficha_id uuid references comercial.fichas (id) on delete set null,
  -- Distrato: contrato do ENET de origem.
  contrato_enet_id text,
  criado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_por uuid references core.usuarios (id) on delete set null,
  atualizado_em timestamptz not null default now(),
  gerado_por uuid references core.usuarios (id) on delete set null,
  gerado_em timestamptz,
  exemplo boolean not null default false
);

create index contratos_atualizado_em on comercial.contratos (atualizado_em desc);
create index contratos_filtros on comercial.contratos (tipo, status);
create index contratos_garantia on comercial.contratos (garantia);
create index contratos_bloco on comercial.contratos (bloco);
create index contratos_lucs on comercial.contratos using gin (lucs);
create index contratos_ficha on comercial.contratos (ficha_id);
create index contratos_enet on comercial.contratos (contrato_enet_id);
create index contratos_gerado_em on comercial.contratos (gerado_em);
create index contratos_criado_por on comercial.contratos (criado_por);
create index contratos_atualizado_por on comercial.contratos (atualizado_por);
create index contratos_gerado_por on comercial.contratos (gerado_por);

create table comercial.contrato_versoes (
  id bigint generated always as identity primary key,
  contrato_id uuid not null references comercial.contratos (id) on delete cascade,
  versao int not null,
  status text not null,
  etapa_atual int not null,
  -- A linha do contrato como ficou nesta gravação.
  conteudo jsonb not null,
  por uuid references core.usuarios (id) on delete set null,
  em timestamptz not null default now()
);

create index contrato_versoes_contrato on comercial.contrato_versoes (contrato_id, em desc);
create index contrato_versoes_por on comercial.contrato_versoes (por);

-- Versão do kit entregue com o contrato.
create table comercial.contrato_kit (
  contrato_id uuid not null references comercial.contratos (id) on delete cascade,
  versao_id uuid not null references comercial.kit_versoes (id),
  primary key (contrato_id, versao_id)
);

create index contrato_kit_versao on comercial.contrato_kit (versao_id);

-- Comprovantes, apólice, planta e outros anexos (bucket "comercial":
-- contratos/<contrato_id>/<arquivo>).
create table comercial.contrato_anexos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references comercial.contratos (id) on delete cascade,
  tipo text not null check (tipo in (
    'planta', 'vistoria', 'garantia', 'comprovante_caucao', 'comprovante_capitalizacao',
    'apolice', 'credencial', 'outro'
  )),
  arquivo_path text not null,
  arquivo_nome text not null,
  tamanho bigint check (tamanho >= 0),
  tipo_mime text,
  enviado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  enviado_em timestamptz not null default now()
);

create index contrato_anexos_contrato on comercial.contrato_anexos (contrato_id);
create index contrato_anexos_enviado_por on comercial.contrato_anexos (enviado_por);

create function comercial.contrato_antes_de_gravar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_por := coalesce((select auth.uid()), new.atualizado_por);
  new.atualizado_em := now();
  if tg_op = 'UPDATE' then
    new.tipo := old.tipo;
    new.criado_por := old.criado_por;
    new.criado_em := old.criado_em;
    -- Mexer num contrato já gerado abre a versão seguinte.
    if old.status = 'gerado' and new.status <> 'gerado' then
      new.versao := old.versao + 1;
    else
      new.versao := old.versao;
    end if;
  end if;
  if new.status = 'gerado' and (tg_op = 'INSERT' or old.status <> 'gerado') then
    new.gerado_por := coalesce((select auth.uid()), new.gerado_por);
    new.gerado_em := now();
  end if;
  return new;
end;
$$;

create trigger antes_de_gravar before insert or update on comercial.contratos
  for each row execute function comercial.contrato_antes_de_gravar();

create function comercial.contrato_registrar_versao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and (to_jsonb(new) - 'atualizado_em' - 'atualizado_por')
      = (to_jsonb(old) - 'atualizado_em' - 'atualizado_por') then
    return null;
  end if;
  insert into comercial.contrato_versoes (contrato_id, versao, status, etapa_atual, conteudo, por)
  values (new.id, new.versao, new.status, new.etapa_atual, to_jsonb(new), new.atualizado_por);
  -- A ficha escolhida passa a "Usada em contrato".
  if new.ficha_id is not null
    and (tg_op = 'INSERT' or new.ficha_id is distinct from old.ficha_id) then
    update comercial.fichas
      set situacao = 'usada', usada_em = coalesce(usada_em, now())
      where id = new.ficha_id and situacao = 'recebida';
  end if;
  return null;
end;
$$;

create trigger registrar_versao after insert or update on comercial.contratos
  for each row execute function comercial.contrato_registrar_versao();

-- ---------------------------------------------------------------------------
-- Propostas de evento (4.15). Não é receita: a realizada vem do ENET.
-- ---------------------------------------------------------------------------

create table comercial.propostas_evento (
  id uuid primary key default gen_random_uuid(),
  cliente text not null check (btrim(cliente) <> ''),
  data_evento date,
  data_evento_fim date,
  horario text,
  tipo_data text not null default 'comum' check (tipo_data in ('comum', 'sazonal')),
  area_m2 numeric(10, 2) not null check (area_m2 > 0),
  dias int not null default 1 check (dias > 0),
  pessoas int check (pessoas >= 0),
  desconto_pct numeric(5, 2) not null default 0 check (desconto_pct between 0 and 100),
  valor_original numeric(14, 2) not null check (valor_original >= 0),
  -- Valor de parceria = original menos o desconto da condição comercial.
  valor_parceria numeric(14, 2) not null check (valor_parceria >= 0),
  desconto_primeira_edicao numeric(14, 2) not null default 0 check (desconto_primeira_edicao >= 0),
  valor_final numeric(14, 2) not null check (valor_final >= 0),
  segurancas int check (segurancas >= 0),
  agentes_limpeza int check (agentes_limpeza >= 0),
  condicao_pagamento text,
  montagem text,
  desmontagem text,
  fechamento_ate date,
  area_evento text,
  notas text[] not null default '{}',
  -- Observações marcadas da lista evento_observacao.
  observacoes text[] not null default '{}',
  validade date,
  status text not null default 'rascunho' check (status in ('rascunho', 'enviada', 'fechada', 'perdida')),
  -- Referência opcional à oportunidade no RD.
  oportunidade_rd text,
  -- Faixa e parâmetros usados no cálculo (a proposta não muda se a tabela mudar).
  calculo jsonb not null default '{}' check (jsonb_typeof(calculo) = 'object'),
  criado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  exemplo boolean not null default false,
  check (data_evento_fim is null or data_evento is null or data_evento_fim >= data_evento)
);

create index propostas_evento_criado_em on comercial.propostas_evento (criado_em desc);
create index propostas_evento_status on comercial.propostas_evento (status);
create index propostas_evento_data on comercial.propostas_evento (data_evento);
create index propostas_evento_criado_por on comercial.propostas_evento (criado_por);

-- ---------------------------------------------------------------------------
-- Pesquisa de mercado (4.16): só locação.
-- ---------------------------------------------------------------------------

create table comercial.pesquisa_imoveis (
  id uuid primary key default gen_random_uuid(),
  data_pesquisa date not null,
  endereco text not null check (btrim(endereco) <> ''),
  cep text check (cep ~ '^[0-9]{5}-?[0-9]{3}$'),
  -- Valores das listas pesquisa_bairro e pesquisa_tipo.
  bairro text not null check (btrim(bairro) <> ''),
  tipo text not null check (btrim(tipo) <> ''),
  area_m2 numeric(10, 2) not null check (area_m2 > 0),
  aluguel numeric(14, 2) not null check (aluguel >= 0),
  condominio numeric(14, 2) check (condominio >= 0),
  iptu numeric(14, 2) check (iptu >= 0),
  vagas int check (vagas >= 0),
  observacao text,
  -- Link do anúncio.
  fonte text,
  valor_m2 numeric generated always as (aluguel / area_m2) stored,
  custo_total numeric generated always as (aluguel + coalesce(condominio, 0) + coalesce(iptu, 0)) stored,
  custo_m2 numeric generated always as ((aluguel + coalesce(condominio, 0) + coalesce(iptu, 0)) / area_m2) stored,
  criado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  importacao_id uuid references comercial.importacoes (id),
  exemplo boolean not null default false
);

create index pesquisa_imoveis_data on comercial.pesquisa_imoveis (data_pesquisa desc);
create index pesquisa_imoveis_filtros on comercial.pesquisa_imoveis (tipo, bairro);
create index pesquisa_imoveis_area on comercial.pesquisa_imoveis (area_m2);
create index pesquisa_imoveis_criado_por on comercial.pesquisa_imoveis (criado_por);
create index pesquisa_imoveis_importacao on comercial.pesquisa_imoveis (importacao_id);

-- ---------------------------------------------------------------------------
-- Foto da ocupação no último dia de cada mês (4.10): a rotina grava.
-- ---------------------------------------------------------------------------

create table comercial.ocupacao_fotos (
  mes core.competencia primary key,
  lucs int not null check (lucs >= 0),
  lucs_locados int not null check (lucs_locados >= 0),
  abl_total numeric(12, 2) not null check (abl_total >= 0),
  abl_locada numeric(12, 2) not null check (abl_locada >= 0),
  clientes_ativos int check (clientes_ativos >= 0),
  -- { "<bloco>": { lucs, lucs_locados, abl_total, abl_locada } } e idem por tipo.
  por_bloco jsonb not null default '{}' check (jsonb_typeof(por_bloco) = 'object'),
  por_tipo jsonb not null default '{}' check (jsonb_typeof(por_tipo) = 'object'),
  gravada_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Funções
-- ---------------------------------------------------------------------------

-- Desfaz uma importação confirmada: apaga as linhas que ela trouxe.
create function comercial.desfazer_importacao(p_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v comercial.importacoes;
  n int;
  total int := 0;
begin
  select * into v from comercial.importacoes where id = p_id for update;
  if v.id is null then
    raise exception 'importação não encontrada' using errcode = 'P0002';
  end if;
  if not comercial.pode_importar(v.tipo) then
    raise exception 'sem permissão para desfazer esta importação' using errcode = '42501';
  end if;
  if v.status <> 'confirmada' then
    raise exception 'só uma importação confirmada pode ser desfeita' using errcode = '22023';
  end if;

  delete from comercial.censo_respostas where importacao_id = p_id;
  get diagnostics n = row_count; total := total + n;
  delete from comercial.censo_rodadas where importacao_id = p_id;
  delete from comercial.contatos where importacao_id = p_id;
  get diagnostics n = row_count; total := total + n;
  delete from comercial.fichas where importacao_id = p_id;
  get diagnostics n = row_count; total := total + n;
  delete from comercial.pesquisa_imoveis where importacao_id = p_id;
  get diagnostics n = row_count; total := total + n;

  update comercial.importacoes
    set status = 'desfeita', desfeito_por = (select auth.uid()), desfeito_em = now()
    where id = p_id;
  return total;
end;
$$;

-- "Remover dados de exemplo" (Configurações): apaga tudo que veio com
-- exemplo = true e devolve quantas linhas saíram de cada tabela.
create function comercial.remover_exemplos()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb := '{}';
  n int;
begin
  if not core.pode('comercial.parametros.editar') then
    raise exception 'sem permissão para remover os dados de exemplo' using errcode = '42501';
  end if;
  delete from comercial.censo_sugestao_temas where exemplo;
  get diagnostics n = row_count; r := r || jsonb_build_object('censo_sugestao_temas', n);
  delete from comercial.contatos where exemplo;
  get diagnostics n = row_count; r := r || jsonb_build_object('contatos', n);
  delete from comercial.censo_respostas where exemplo;
  get diagnostics n = row_count; r := r || jsonb_build_object('censo_respostas', n);
  delete from comercial.censo_convites where exemplo;
  get diagnostics n = row_count; r := r || jsonb_build_object('censo_convites', n);
  delete from comercial.censo_rodadas where exemplo;
  get diagnostics n = row_count; r := r || jsonb_build_object('censo_rodadas', n);
  delete from comercial.censo_temas where exemplo;
  get diagnostics n = row_count; r := r || jsonb_build_object('censo_temas', n);
  delete from comercial.contratos where exemplo;
  get diagnostics n = row_count; r := r || jsonb_build_object('contratos', n);
  delete from comercial.fichas where exemplo;
  get diagnostics n = row_count; r := r || jsonb_build_object('fichas', n);
  delete from comercial.propostas_evento where exemplo;
  get diagnostics n = row_count; r := r || jsonb_build_object('propostas_evento', n);
  delete from comercial.pesquisa_imoveis where exemplo;
  get diagnostics n = row_count; r := r || jsonb_build_object('pesquisa_imoveis', n);
  return r;
end;
$$;

revoke execute on function comercial.desfazer_importacao(uuid) from public;
revoke execute on function comercial.remover_exemplos() from public;
revoke execute on function comercial.pode_importar(text) from public;
grant execute on function comercial.desfazer_importacao(uuid), comercial.remover_exemplos(),
  comercial.pode_importar(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Triggers de atualizado_em e auditoria
-- ---------------------------------------------------------------------------

create trigger atualizado_em before update on comercial.parametros
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on comercial.listas
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on comercial.fontes_de_para
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on comercial.tipos_luc
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on comercial.faixas_evento
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on comercial.importacoes
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on comercial.contatos
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on comercial.censo_rodadas
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on comercial.censo_respostas
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on comercial.censo_temas
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on comercial.fichas
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on comercial.ficha_dados
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on comercial.kit_documentos
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on comercial.kit_versoes
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on comercial.propostas_evento
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on comercial.pesquisa_imoveis
  for each row execute function core.set_atualizado_em();

-- Parâmetros, tabelas de apoio, kit, temas e pesquisa: quem, quando, antes e
-- depois. Fichas, respostas e contatos não (dado pessoal); contratos têm
-- contrato_versoes.
create trigger auditoria after insert or update or delete on comercial.parametros
  for each row execute function core.auditar('id');
create trigger auditoria after insert or update or delete on comercial.listas
  for each row execute function core.auditar('id');
create trigger auditoria after insert or update or delete on comercial.fontes_de_para
  for each row execute function core.auditar('fonte_rd');
create trigger auditoria after insert or update or delete on comercial.tipos_luc
  for each row execute function core.auditar('tipo');
create trigger auditoria after insert or update or delete on comercial.faixas_evento
  for each row execute function core.auditar('id');
create trigger auditoria after insert or update or delete on comercial.kit_documentos
  for each row execute function core.auditar('id');
create trigger auditoria after insert or update or delete on comercial.kit_versoes
  for each row execute function core.auditar('id');
create trigger auditoria after insert or update or delete on comercial.censo_temas
  for each row execute function core.auditar('id');
create trigger auditoria after insert or update or delete on comercial.censo_sugestao_temas
  for each row execute function core.auditar('id');
create trigger auditoria after insert or update or delete on comercial.pesquisa_imoveis
  for each row execute function core.auditar('id');
create trigger auditoria after insert or update or delete on comercial.importacoes
  for each row execute function core.auditar('id');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table comercial.parametros enable row level security;
alter table comercial.listas enable row level security;
alter table comercial.fontes_de_para enable row level security;
alter table comercial.tipos_luc enable row level security;
alter table comercial.faixas_evento enable row level security;
alter table comercial.importacoes enable row level security;
alter table comercial.contatos enable row level security;
alter table comercial.censo_rodadas enable row level security;
alter table comercial.censo_convites enable row level security;
alter table comercial.censo_respostas enable row level security;
alter table comercial.censo_temas enable row level security;
alter table comercial.censo_sugestao_temas enable row level security;
alter table comercial.fichas enable row level security;
alter table comercial.ficha_dados enable row level security;
alter table comercial.ficha_documentos enable row level security;
alter table comercial.ficha_acessos enable row level security;
alter table comercial.kit_documentos enable row level security;
alter table comercial.kit_versoes enable row level security;
alter table comercial.contratos enable row level security;
alter table comercial.contrato_versoes enable row level security;
alter table comercial.contrato_kit enable row level security;
alter table comercial.contrato_anexos enable row level security;
alter table comercial.propostas_evento enable row level security;
alter table comercial.pesquisa_imoveis enable row level security;
alter table comercial.ocupacao_fotos enable row level security;

-- Configuração: quem usa o módulo lê; só Parâmetros grava.
create policy ver on comercial.parametros for select to authenticated
  using ((select core.pode_modulo('comercial')));
create policy editar on comercial.parametros for update to authenticated
  using ((select core.pode('comercial.parametros.editar')))
  with check ((select core.pode('comercial.parametros.editar')));

create policy ver on comercial.listas for select to authenticated
  using ((select core.pode_modulo('comercial')));
create policy incluir on comercial.listas for insert to authenticated
  with check ((select core.pode('comercial.parametros.editar')));
create policy editar on comercial.listas for update to authenticated
  using ((select core.pode('comercial.parametros.editar')))
  with check ((select core.pode('comercial.parametros.editar')));
create policy excluir on comercial.listas for delete to authenticated
  using ((select core.pode('comercial.parametros.editar')));

create policy ver on comercial.fontes_de_para for select to authenticated
  using ((select core.pode_modulo('comercial')));
create policy incluir on comercial.fontes_de_para for insert to authenticated
  with check ((select core.pode('comercial.parametros.editar')));
create policy editar on comercial.fontes_de_para for update to authenticated
  using ((select core.pode('comercial.parametros.editar')))
  with check ((select core.pode('comercial.parametros.editar')));
create policy excluir on comercial.fontes_de_para for delete to authenticated
  using ((select core.pode('comercial.parametros.editar')));

create policy ver on comercial.tipos_luc for select to authenticated
  using ((select core.pode_modulo('comercial')));
create policy incluir on comercial.tipos_luc for insert to authenticated
  with check ((select core.pode('comercial.parametros.editar')));
create policy editar on comercial.tipos_luc for update to authenticated
  using ((select core.pode('comercial.parametros.editar')))
  with check ((select core.pode('comercial.parametros.editar')));
create policy excluir on comercial.tipos_luc for delete to authenticated
  using ((select core.pode('comercial.parametros.editar')));

create policy ver on comercial.faixas_evento for select to authenticated
  using ((select core.pode_modulo('comercial')));
create policy incluir on comercial.faixas_evento for insert to authenticated
  with check ((select core.pode('comercial.parametros.editar')));
create policy editar on comercial.faixas_evento for update to authenticated
  using ((select core.pode('comercial.parametros.editar')))
  with check ((select core.pode('comercial.parametros.editar')));
create policy excluir on comercial.faixas_evento for delete to authenticated
  using ((select core.pode('comercial.parametros.editar')));

-- Importações: cada tipo com a permissão de quem grava aquele dado.
create policy ver on comercial.importacoes for select to authenticated
  using (
    case tipo
      when 'censo' then (select core.pode('comercial.censo.importar'))
      when 'fichas' then (select core.pode('comercial.formulario.ver'))
      when 'pesquisa' then (select core.pode('comercial.pesquisa.editar'))
      when 'contatos' then (select core.pode('comercial.relacionamento.registrar'))
      else false
    end
  );
create policy enviar on comercial.importacoes for insert to authenticated
  with check (
    enviado_por = (select auth.uid())
    and case tipo
      when 'censo' then (select core.pode('comercial.censo.importar'))
      when 'fichas' then (select core.pode('comercial.formulario.ver'))
      when 'pesquisa' then (select core.pode('comercial.pesquisa.editar'))
      when 'contatos' then (select core.pode('comercial.relacionamento.registrar'))
      else false
    end
  );
create policy atualizar on comercial.importacoes for update to authenticated
  using (
    case tipo
      when 'censo' then (select core.pode('comercial.censo.importar'))
      when 'fichas' then (select core.pode('comercial.formulario.ver'))
      when 'pesquisa' then (select core.pode('comercial.pesquisa.editar'))
      when 'contatos' then (select core.pode('comercial.relacionamento.registrar'))
      else false
    end
  )
  with check (
    case tipo
      when 'censo' then (select core.pode('comercial.censo.importar'))
      when 'fichas' then (select core.pode('comercial.formulario.ver'))
      when 'pesquisa' then (select core.pode('comercial.pesquisa.editar'))
      when 'contatos' then (select core.pode('comercial.relacionamento.registrar'))
      else false
    end
  );

-- Contatos: Relacionamento vê todos; Censo vê só os tipos de feedback (4.9).
-- Quem registra edita e apaga só os seus.
create policy ver on comercial.contatos for select to authenticated
  using (
    (select core.pode('comercial.relacionamento.ver'))
    or ((select core.pode('comercial.censo.ver')) and tipo = any (array(
      select l.valor from comercial.listas l
      where l.lista = 'tipo_contato' and (l.extra ->> 'feedback')::boolean
    )))
  );
create policy registrar on comercial.contatos for insert to authenticated
  with check (
    (select core.pode('comercial.relacionamento.registrar'))
    and registrado_por = (select auth.uid())
  );
create policy editar on comercial.contatos for update to authenticated
  using ((select core.pode('comercial.relacionamento.registrar')) and registrado_por = (select auth.uid()))
  with check ((select core.pode('comercial.relacionamento.registrar')) and registrado_por = (select auth.uid()));
create policy excluir on comercial.contatos for delete to authenticated
  using ((select core.pode('comercial.relacionamento.registrar')) and registrado_por = (select auth.uid()));

-- Censo: quem vê as telas lê rodadas, respostas e temas; quem aplica abre e
-- encerra rodada, gera link (convites, com o token) e lança em nome da empresa.
create policy ver on comercial.censo_rodadas for select to authenticated
  using (
    (select core.pode('comercial.censo.ver'))
    or (select core.pode('comercial.censo.aplicar'))
    or (select core.pode('comercial.censo.importar'))
  );
create policy abrir on comercial.censo_rodadas for insert to authenticated
  with check ((select core.pode('comercial.censo.aplicar')));
create policy editar on comercial.censo_rodadas for update to authenticated
  using ((select core.pode('comercial.censo.aplicar')))
  with check ((select core.pode('comercial.censo.aplicar')));

create policy ver on comercial.censo_convites for select to authenticated
  using ((select core.pode('comercial.censo.aplicar')));
create policy gerar on comercial.censo_convites for insert to authenticated
  with check ((select core.pode('comercial.censo.aplicar')));
create policy editar on comercial.censo_convites for update to authenticated
  using ((select core.pode('comercial.censo.aplicar')))
  with check ((select core.pode('comercial.censo.aplicar')));
create policy excluir on comercial.censo_convites for delete to authenticated
  using ((select core.pode('comercial.censo.aplicar')));

create policy ver on comercial.censo_respostas for select to authenticated
  using (
    (select core.pode('comercial.censo.ver'))
    or (select core.pode('comercial.censo.aplicar'))
    or (select core.pode('comercial.censo.importar'))
  );
create policy lancar on comercial.censo_respostas for insert to authenticated
  with check (
    (select core.pode('comercial.censo.aplicar'))
    and origem = 'presencial'
    and lancada_por = (select auth.uid())
  );
-- Corrigir a resposta (aplicar) ou escolher qual repetida conta (aplicar ou importar).
create policy editar on comercial.censo_respostas for update to authenticated
  using ((select core.pode('comercial.censo.aplicar')) or (select core.pode('comercial.censo.importar')))
  with check ((select core.pode('comercial.censo.aplicar')) or (select core.pode('comercial.censo.importar')));

create policy ver on comercial.censo_temas for select to authenticated
  using ((select core.pode('comercial.censo.ver')) or (select core.pode('comercial.censo.aplicar')));
create policy incluir on comercial.censo_temas for insert to authenticated
  with check ((select core.pode('comercial.censo.aplicar')));
create policy editar on comercial.censo_temas for update to authenticated
  using ((select core.pode('comercial.censo.aplicar')))
  with check ((select core.pode('comercial.censo.aplicar')));
create policy excluir on comercial.censo_temas for delete to authenticated
  using ((select core.pode('comercial.censo.aplicar')));

create policy ver on comercial.censo_sugestao_temas for select to authenticated
  using ((select core.pode('comercial.censo.ver')) or (select core.pode('comercial.censo.aplicar')));
create policy incluir on comercial.censo_sugestao_temas for insert to authenticated
  with check ((select core.pode('comercial.censo.aplicar')));
create policy mover on comercial.censo_sugestao_temas for update to authenticated
  using ((select core.pode('comercial.censo.aplicar')))
  with check ((select core.pode('comercial.censo.aplicar')));
create policy excluir on comercial.censo_sugestao_temas for delete to authenticated
  using ((select core.pode('comercial.censo.aplicar')));

-- Fichas: a lista (nome, tipo, LUC, situação, datas) para quem vê fichas,
-- gera link ou monta contrato; dados pessoais, documentos e acessos só com
-- comercial.formulario.ver. O interessado grava pelo servidor (token).
create policy ver on comercial.fichas for select to authenticated
  using (
    (select core.pode('comercial.formulario.ver'))
    or (select core.pode('comercial.formulario.link'))
    or (select core.pode('comercial.contratos.editar'))
  );
create policy gerar on comercial.fichas for insert to authenticated
  with check (
    (select core.pode('comercial.formulario.link'))
    and gerada_por = (select auth.uid())
    and situacao = 'em_preenchimento'
  );
create policy editar on comercial.fichas for update to authenticated
  using ((select core.pode('comercial.formulario.link')) or (select core.pode('comercial.formulario.ver')))
  with check ((select core.pode('comercial.formulario.link')) or (select core.pode('comercial.formulario.ver')));
-- Só link ainda não preenchido.
create policy excluir on comercial.fichas for delete to authenticated
  using ((select core.pode('comercial.formulario.link')) and situacao = 'em_preenchimento');

create policy ver on comercial.ficha_dados for select to authenticated
  using ((select core.pode('comercial.formulario.ver')));
create policy incluir on comercial.ficha_dados for insert to authenticated
  with check ((select core.pode('comercial.formulario.ver')));
create policy editar on comercial.ficha_dados for update to authenticated
  using ((select core.pode('comercial.formulario.ver')))
  with check ((select core.pode('comercial.formulario.ver')));

create policy ver on comercial.ficha_documentos for select to authenticated
  using ((select core.pode('comercial.formulario.ver')));

create policy ver on comercial.ficha_acessos for select to authenticated
  using ((select core.pode('comercial.formulario.ver')));
create policy registrar on comercial.ficha_acessos for insert to authenticated
  with check ((select core.pode('comercial.formulario.ver')) and usuario_id = (select auth.uid()));

-- Kit: quem vê o kit e quem monta contrato (etapa Documentos) leem.
create policy ver on comercial.kit_documentos for select to authenticated
  using (
    (select core.pode('comercial.kit.ver'))
    or (select core.pode('comercial.contratos.ver'))
    or (select core.pode('comercial.contratos.editar'))
  );
create policy incluir on comercial.kit_documentos for insert to authenticated
  with check ((select core.pode('comercial.kit.editar')));
create policy editar on comercial.kit_documentos for update to authenticated
  using ((select core.pode('comercial.kit.editar')))
  with check ((select core.pode('comercial.kit.editar')));

create policy ver on comercial.kit_versoes for select to authenticated
  using (
    (select core.pode('comercial.kit.ver'))
    or (select core.pode('comercial.contratos.ver'))
    or (select core.pode('comercial.contratos.editar'))
  );
create policy incluir on comercial.kit_versoes for insert to authenticated
  with check ((select core.pode('comercial.kit.editar')));
create policy editar on comercial.kit_versoes for update to authenticated
  using ((select core.pode('comercial.kit.editar')))
  with check ((select core.pode('comercial.kit.editar')));

-- Contratos: "gerado" só com comercial.contratos.gerar; apagar só rascunho.
create policy ver on comercial.contratos for select to authenticated
  using (
    (select core.pode('comercial.contratos.ver'))
    or (select core.pode('comercial.contratos.editar'))
    or (select core.pode('comercial.contratos.gerar'))
  );
create policy criar on comercial.contratos for insert to authenticated
  with check (
    (select core.pode('comercial.contratos.editar'))
    and criado_por = (select auth.uid())
    and status <> 'gerado'
  );
create policy editar on comercial.contratos for update to authenticated
  using ((select core.pode('comercial.contratos.editar')) or (select core.pode('comercial.contratos.gerar')))
  with check (
    case when status = 'gerado'
      then (select core.pode('comercial.contratos.gerar'))
      else (select core.pode('comercial.contratos.editar'))
    end
  );
create policy excluir on comercial.contratos for delete to authenticated
  using ((select core.pode('comercial.contratos.editar')) and status = 'rascunho');

create policy ver on comercial.contrato_versoes for select to authenticated
  using (exists (select 1 from comercial.contratos c where c.id = contrato_versoes.contrato_id));

create policy ver on comercial.contrato_kit for select to authenticated
  using (exists (select 1 from comercial.contratos c where c.id = contrato_kit.contrato_id));
create policy incluir on comercial.contrato_kit for insert to authenticated
  with check ((select core.pode('comercial.contratos.editar')));
create policy excluir on comercial.contrato_kit for delete to authenticated
  using ((select core.pode('comercial.contratos.editar')));

create policy ver on comercial.contrato_anexos for select to authenticated
  using (exists (select 1 from comercial.contratos c where c.id = contrato_anexos.contrato_id));
create policy incluir on comercial.contrato_anexos for insert to authenticated
  with check ((select core.pode('comercial.contratos.editar')) and enviado_por = (select auth.uid()));
create policy excluir on comercial.contrato_anexos for delete to authenticated
  using ((select core.pode('comercial.contratos.editar')));

create policy ver on comercial.propostas_evento for select to authenticated
  using ((select core.pode('comercial.eventos.ver')) or (select core.pode('comercial.eventos.editar')));
create policy incluir on comercial.propostas_evento for insert to authenticated
  with check ((select core.pode('comercial.eventos.editar')));
create policy editar on comercial.propostas_evento for update to authenticated
  using ((select core.pode('comercial.eventos.editar')))
  with check ((select core.pode('comercial.eventos.editar')));
create policy excluir on comercial.propostas_evento for delete to authenticated
  using ((select core.pode('comercial.eventos.editar')));

create policy ver on comercial.pesquisa_imoveis for select to authenticated
  using ((select core.pode('comercial.pesquisa.ver')) or (select core.pode('comercial.pesquisa.editar')));
create policy incluir on comercial.pesquisa_imoveis for insert to authenticated
  with check ((select core.pode('comercial.pesquisa.editar')));
create policy editar on comercial.pesquisa_imoveis for update to authenticated
  using ((select core.pode('comercial.pesquisa.editar')))
  with check ((select core.pode('comercial.pesquisa.editar')));
create policy excluir on comercial.pesquisa_imoveis for delete to authenticated
  using ((select core.pode('comercial.pesquisa.editar')));

create policy ver on comercial.ocupacao_fotos for select to authenticated
  using ((select core.pode('comercial.ocupacao.ver')) or (select core.pode('comercial.painel.ver')));

-- ---------------------------------------------------------------------------
-- Privilégios (o RLS decide as linhas)
-- ---------------------------------------------------------------------------

grant select on all tables in schema comercial to authenticated;
grant update on comercial.parametros to authenticated;
grant insert, update, delete on comercial.listas, comercial.fontes_de_para,
  comercial.tipos_luc, comercial.faixas_evento to authenticated;
grant insert, update on comercial.importacoes to authenticated;
grant insert, update, delete on comercial.contatos to authenticated;
grant insert, update on comercial.censo_rodadas, comercial.censo_respostas to authenticated;
grant insert, update, delete on comercial.censo_convites, comercial.censo_temas,
  comercial.censo_sugestao_temas to authenticated;
grant insert, update, delete on comercial.fichas to authenticated;
grant insert, update on comercial.ficha_dados to authenticated;
grant insert on comercial.ficha_acessos to authenticated;
grant insert, update on comercial.kit_documentos, comercial.kit_versoes to authenticated;
grant insert, update, delete on comercial.contratos to authenticated;
grant insert, delete on comercial.contrato_kit, comercial.contrato_anexos to authenticated;
grant insert, update, delete on comercial.propostas_evento, comercial.pesquisa_imoveis to authenticated;
grant all on all tables in schema comercial to service_role;
grant usage, select on all sequences in schema comercial to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Metas do Painel (core.metas, indicador "comercial.*"), feriados de Nova
-- Friburgo (os.feriados) e histórico (core.auditoria)
-- ---------------------------------------------------------------------------

alter policy ver on core.metas
  using (
    case split_part(indicador, '.', 1)
      when 'rh' then (select core.pode_modulo('rh'))
      when 'financeiro' then (select core.pode_modulo('financeiro'))
      when 'os' then (select core.pode_modulo('os'))
      when 'marketing' then (select core.pode_modulo('marketing'))
      when 'comercial' then
        (select core.pode('comercial.painel.ver')) or (select core.pode('comercial.painel.metas'))
      else core.pode_modulo(split_part(indicador, '.', 1))
    end
  );
alter policy editar on core.metas
  using (
    (indicador like 'rh.%' and (select core.pode('rh.parametros')))
    or (indicador like 'financeiro.%' and (select core.pode('financeiro.importacao_parametros')))
    or (indicador like 'marketing.%' and (select core.pode('marketing.parametros')))
    or (indicador like 'comercial.%' and (select core.pode('comercial.painel.metas')))
  )
  with check (
    (indicador like 'rh.%' and (select core.pode('rh.parametros')))
    or (indicador like 'financeiro.%' and (select core.pode('financeiro.importacao_parametros')))
    or (indicador like 'marketing.%' and (select core.pode('marketing.parametros')))
    or (indicador like 'comercial.%' and (select core.pode('comercial.painel.metas')))
  );

alter policy ver on os.feriados
  using ((select core.pode_modulo('os')) or (select core.pode_modulo('comercial')));
alter policy editar on os.feriados
  using ((select core.pode('os.parametros')) or (select core.pode('comercial.parametros.editar')))
  with check ((select core.pode('os.parametros')) or (select core.pode('comercial.parametros.editar')));

alter policy ver on core.auditoria
  using (
    (select core.pode('admin.historico'))
    or case
      when tabela like 'rh.%' then (select core.pode('rh.parametros'))
      when tabela = 'os.feriados' then
        (select core.pode('os.historico')) or (select core.pode('comercial.parametros.editar'))
      when tabela like 'os.%' then (select core.pode('os.historico'))
      when tabela like 'marketing.%' then (select core.pode('marketing.parametros'))
      when tabela like 'comercial.%' then (select core.pode('comercial.parametros.editar'))
      when tabela = 'core.metas' then
        (select core.pode('rh.parametros'))
        or (select core.pode('financeiro.importacao_parametros'))
        or (select core.pode('marketing.parametros'))
        or (select core.pode('comercial.painel.metas'))
      when tabela in (
        'core.usuario_permissoes', 'core.usuarios', 'core.cargos', 'core.cargo_permissoes'
      ) then (select core.pode('admin.usuarios'))
      when tabela = 'core.empresa' then (select core.pode('admin.empresa'))
      when tabela = 'integracao.credenciais' then (select core.pode('admin.integracoes'))
      else false
    end
  );

-- ---------------------------------------------------------------------------
-- Storage: bucket privado "comercial". A primeira pasta diz o assunto:
-- kit/, fichas/, contratos/, importacoes/<tipo>/.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('comercial', 'comercial', false);

create policy comercial_ver on storage.objects for select to authenticated
  using (
    bucket_id = 'comercial'
    and case (storage.foldername(name))[1]
      when 'kit' then
        (select core.pode('comercial.kit.ver')) or (select core.pode('comercial.contratos.ver'))
        or (select core.pode('comercial.contratos.editar'))
      when 'fichas' then (select core.pode('comercial.formulario.ver'))
      when 'contratos' then
        (select core.pode('comercial.contratos.ver')) or (select core.pode('comercial.contratos.editar'))
      when 'importacoes' then case (storage.foldername(name))[2]
        when 'censo' then (select core.pode('comercial.censo.importar'))
        when 'fichas' then (select core.pode('comercial.formulario.ver'))
        when 'pesquisa' then (select core.pode('comercial.pesquisa.editar'))
        when 'contatos' then (select core.pode('comercial.relacionamento.registrar'))
        else false
      end
      else false
    end
  );

create policy comercial_enviar on storage.objects for insert to authenticated
  with check (
    bucket_id = 'comercial'
    and case (storage.foldername(name))[1]
      when 'kit' then (select core.pode('comercial.kit.editar'))
      when 'fichas' then (select core.pode('comercial.formulario.ver'))
      when 'contratos' then (select core.pode('comercial.contratos.editar'))
      when 'importacoes' then case (storage.foldername(name))[2]
        when 'censo' then (select core.pode('comercial.censo.importar'))
        when 'fichas' then (select core.pode('comercial.formulario.ver'))
        when 'pesquisa' then (select core.pode('comercial.pesquisa.editar'))
        when 'contatos' then (select core.pode('comercial.relacionamento.registrar'))
        else false
      end
      else false
    end
  );

-- ---------------------------------------------------------------------------
-- Ponto de partida (tudo editável em Configurações)
-- ---------------------------------------------------------------------------

insert into comercial.parametros (
  obrigatorios_garantia, ficha_boas_vindas, ficha_termo_lgpd, evento_notas
) values (
  '{
    "fiador": ["quantidade", "fiadores"],
    "capitalizacao": ["instituicao", "valor", "proposta", "comprovante"],
    "seguro_fianca": ["seguradora", "susep_seguradora", "corretora", "susep_corretora", "proposta", "apolice", "vigencia_inicio", "vigencia_fim", "documento_apolice"],
    "caucao": ["aluguel_base", "quantidade", "data_deposito"],
    "sem_garantia": []
  }',
  E'Bem-vindo(a)! Estamos felizes com o seu interesse em nosso processo de locação. Este formulário foi criado para tornar o cadastro mais ágil e seguro, reunindo apenas as informações necessárias para análise da sua proposta.\n\nNão esqueça de encaminhar as documentações comprobatórias.\n\nTime ARP',
  'Em razão das regras estabelecidas pela LGPD (Lei 13.709), seus dados pessoais serão submetidos a consulta para fins de proteção ao crédito (artigo 7º, X). Ao prosseguir, você declara estar ciente e de acordo com o uso dos dados para fins de aprovação locatícia.',
  '{"Valores sob demanda","Quantidades distribuídas pelos dias","Limpeza e segurança exclusivas do evento"}'
);

insert into comercial.listas (lista, valor, ordem, extra) values
  ('fonte_ajustada', 'Tráfego Direto', 1, '{}'),
  ('fonte_ajustada', 'Indicação', 2, '{}'),
  ('fonte_ajustada', 'Orgânico', 3, '{}'),
  ('fonte_ajustada', 'Google Pago', 4, '{}'),
  ('fonte_ajustada', 'Social', 5, '{}'),
  ('fonte_ajustada', 'Desconhecido', 6, '{}'),
  ('fonte_ajustada', 'Feiras e Eventos', 7, '{}'),
  ('fonte_ajustada', 'Outros', 8, '{}'),
  ('tipo_contato', 'Feedback positivo', 1, '{"feedback": true}'),
  ('tipo_contato', 'Reclamação', 2, '{"feedback": true}'),
  ('tipo_contato', 'Sugestão', 3, '{"feedback": true}'),
  ('tipo_contato', 'Atendimento', 4, '{}'),
  ('tipo_contato', 'Renovação', 5, '{}'),
  ('tipo_contato', 'Mudança de imóvel', 6, '{}'),
  ('tipo_contato', 'Devolução', 7, '{}'),
  ('tipo_contato', 'Outro', 8, '{}'),
  ('canal_contato', 'Presencial', 1, '{}'),
  ('canal_contato', 'WhatsApp', 2, '{}'),
  ('canal_contato', 'Telefone', 3, '{}'),
  ('canal_contato', 'E-mail', 4, '{}'),
  ('censo_bloco', '1', 1, '{}'),
  ('censo_bloco', '2', 2, '{}'),
  ('censo_bloco', '4', 3, '{}'),
  ('censo_bloco', '5', 4, '{}'),
  ('censo_bloco', '7', 5, '{}'),
  ('censo_bloco', '9', 6, '{}'),
  ('censo_bloco', '10', 7, '{}'),
  ('censo_bloco', '11', 8, '{}'),
  ('censo_bloco', '12', 9, '{}'),
  ('censo_bloco', '14', 10, '{}'),
  ('censo_bloco', '16', 11, '{}'),
  ('censo_bloco', 'AC', 12, '{}'),
  ('censo_bloco', 'QQ', 13, '{}'),
  ('censo_segmento', 'Academias e Condicionamento', 1, '{}'),
  ('censo_segmento', 'Alimentação', 2, '{}'),
  ('censo_segmento', 'Clínicas e Médicos', 3, '{}'),
  ('censo_segmento', 'Comércio', 4, '{}'),
  ('censo_segmento', 'Educação', 5, '{}'),
  ('censo_segmento', 'Entretenimento', 6, '{}'),
  ('censo_segmento', 'Serviços', 7, '{}'),
  ('censo_segmento', 'Veterinária', 8, '{}'),
  ('censo_expectativa', 'Manter meu espaço', 1, '{}'),
  ('censo_expectativa', 'Ampliar espaço', 2, '{}'),
  ('censo_expectativa', 'Empreender com um novo negócio/projeto', 3, '{}'),
  ('censo_expectativa', 'Reduzir meu espaço', 4, '{}'),
  ('pesquisa_bairro', 'Centro', 1, '{}'),
  ('pesquisa_bairro', 'Vila Nova', 2, '{}'),
  ('pesquisa_bairro', 'Bela Vista', 3, '{}'),
  ('pesquisa_bairro', 'Jardim Ouro Preto', 4, '{}'),
  ('pesquisa_bairro', 'Lagoinha', 5, '{}'),
  ('pesquisa_bairro', 'Mury', 6, '{}'),
  ('pesquisa_bairro', 'Olaria', 7, '{}'),
  ('pesquisa_tipo', 'Loja', 1, '{}'),
  ('pesquisa_tipo', 'Sala comercial', 2, '{}'),
  ('pesquisa_tipo', 'Casa comercial', 3, '{}'),
  ('pesquisa_tipo', 'Galpão', 4, '{}'),
  ('ficha_documento_pf', 'Identidade e CPF', 1, '{"obrigatorio": true}'),
  ('ficha_documento_pf', 'Comprovante de residência', 2, '{"obrigatorio": true}'),
  ('ficha_documento_pf', 'Comprovante de renda', 3, '{"obrigatorio": true}'),
  ('ficha_documento_fiador', 'Identidade e CPF', 1, '{"obrigatorio": true}'),
  ('ficha_documento_fiador', 'Comprovante de residência', 2, '{"obrigatorio": true}'),
  ('ficha_documento_fiador', 'Comprovante de renda', 3, '{"obrigatorio": true}'),
  ('ficha_documento_pj', 'Contrato social e última alteração', 1, '{"obrigatorio": true}'),
  ('ficha_documento_pj', 'Cartão CNPJ', 2, '{"obrigatorio": true}'),
  ('ficha_documento_pj', 'Identidade e CPF do sócio administrador', 3, '{"obrigatorio": true}'),
  ('evento_observacao', 'Obstrução de áreas', 1, '{}'),
  ('evento_observacao', 'Alvarás', 2, '{}'),
  ('evento_observacao', 'Estacionamento rotativo', 3, '{}'),
  ('evento_observacao', 'Infraestrutura elétrica', 4, '{}'),
  ('evento_observacao', 'Banheiros', 5, '{}'),
  ('evento_observacao', 'Controle de acesso', 6, '{}'),
  ('evento_observacao', 'Limite de ruído', 7, '{}'),
  ('evento_observacao', 'Fechamento da área', 8, '{}'),
  ('evento_observacao', 'Ocupação de stands', 9, '{}'),
  ('evento_observacao', 'Visita técnica', 10, '{}'),
  ('kit_categoria', 'Regimento e normas', 1, '{}'),
  ('kit_categoria', 'Documentos do imóvel', 2, '{}'),
  ('kit_categoria', 'Segurança contra incêndio', 3, '{}'),
  ('kit_categoria', 'Mapas de fachada', 4, '{}');

-- Fontes do RD que aparecem hoje (mockup) e o grupo de cada uma.
insert into comercial.fontes_de_para (fonte_rd, fonte_ajustada) values
  ('Tráfego Direto', 'Tráfego Direto'),
  ('Social | Link da Bio do RD Station', 'Social'),
  ('Busca Orgânica | Google', 'Orgânico'),
  ('Desconhecido', 'Desconhecido'),
  ('Busca Paga | Google', 'Google Pago'),
  ('Indicação por Clientes', 'Indicação'),
  ('Feiras e Eventos', 'Feiras e Eventos'),
  ('Contato por Telefone', 'Outros');

insert into comercial.tipos_luc (tipo, conta_ocupacao, ordem) values
  ('Loja Comercial', true, 1),
  ('Sala Comercial', true, 2),
  ('Galpão', true, 3),
  ('Quiosque', true, 4),
  ('Stand', true, 5),
  ('Casarão', true, 6),
  ('Outros', true, 7),
  ('Área Publicitária', false, 8),
  ('Vaga de Garagem', false, 9),
  ('Eventos', false, 10);

insert into comercial.faixas_evento (ordem, nome, area_de, area_ate, fixo, valor_comum, valor_sazonal) values
  (0, 'Fixo', 0, 25, true, 275.00, 550.00),
  (1, '1', 0, 100, false, 11.00, 22.00),
  (2, '2', 100, 300, false, 8.25, 16.50),
  (3, '3', 300, 1000, false, 5.50, 11.00),
  (4, '4', 1000, 3000, false, 3.85, 7.70);

-- Kit de hoje: 7 documentos e 10 mapas de fachada (só os metadados; o PDF
-- sobe pela tela). O mapa geral não tem bloco: não entra sozinho no contrato.
insert into comercial.kit_documentos (nome, categoria, ordem, blocos, todo_contrato) values
  ('01 — Regimento Interno ARP, 2ª alteração (registrado)', 'Regimento e normas', 1, '{}', true),
  ('02 — Normas Administrativas Complementares (NC001 a NC011)', 'Regimento e normas', 2, '{}', true),
  ('03 — Capa do IPTU nº 80', 'Documentos do imóvel', 3, '{}', false),
  ('04 — RGI nº 80 — 21254', 'Documentos do imóvel', 4, '{}', false),
  ('05 — Certificado de aprovação do Corpo de Bombeiros (CAA-01802/25)', 'Segurança contra incêndio', 5, '{}', false),
  ('06 — Laudo de exigências LE-01622/24', 'Segurança contra incêndio', 6, '{}', false),
  ('07 — Certificado de manutenção e ARTs do sistema de incêndio', 'Segurança contra incêndio', 7, '{}', false),
  ('Mapa geral de fachadas', 'Mapas de fachada', 10, '{}', false),
  ('Fachada 1 — Boulevard Julius Arp', 'Mapas de fachada', 11, '{1,2,Casarão}', false),
  ('Fachada 2 — Rua das Rendas', 'Mapas de fachada', 12, '{1,2,4,5}', false),
  ('Fachada 3 — Rua 1911', 'Mapas de fachada', 13, '{1,2,3,4,5}', false),
  ('Fachada 4 — Rua da Tinturaria', 'Mapas de fachada', 14, '{3,4,5,9}', false),
  ('Fachada 5 — Rua das Borboletas', 'Mapas de fachada', 15, '{9,10,Deck,11}', false),
  ('Fachada 6 — Rua do Relógio', 'Mapas de fachada', 16, '{10,11,12}', false),
  ('Fachada 7 — Rua da Chaminé', 'Mapas de fachada', 17, '{10,12}', false),
  ('Fachada 8 — Rua Freiburg', 'Mapas de fachada', 18, '{14,16,QQ Praça}', false),
  ('Fachada 9 — Rua das Artes', 'Mapas de fachada', 19, '{1,5,7,11}', false);

insert into comercial.kit_versoes (documento_id, versao, data, validade, paginas)
  select d.id, v.versao, v.data::date, v.validade::date, v.paginas
  from (values
    (1, '2ª alteração', '2026-01-20', null, 24),
    (2, 'SET/26', '2026-09-01', null, 58),
    (3, '2026', '2026-01-01', '2026-12-31', null),
    (4, '2023', '2023-01-01', null, null),
    (5, 'CAA-01802/25', '2025-04-11', '2030-04-02', null),
    (6, 'LE-01622/24', '2024-04-25', null, null),
    (7, '2025', '2025-01-01', '2026-12-15', null)
  ) as v (ordem, versao, data, validade, paginas)
  join comercial.kit_documentos d on d.ordem = v.ordem
  union all
  select d.id, '29/08/2023', date '2023-08-29', null, null
  from comercial.kit_documentos d where d.categoria = 'Mapas de fachada';
