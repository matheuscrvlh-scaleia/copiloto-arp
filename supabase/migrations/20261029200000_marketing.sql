-- marketing: base da marca e os cadastros que nenhuma API entrega (spec do
-- Módulo Marketing de 22/10/2026, seções 3, 4.4 e 4.12).
--
-- Os números das ferramentas (Meta, Google, TikTok, GA4, Search Console, RD
-- Station, redes, Google Perfil da Empresa, Asana e WPS) não moram aqui
-- nesta fase: o mockup usa dados de exemplo montados nos campos das APIs. O
-- que fica no banco é o que o Marketing edita: a marca (com versões) e os
-- parâmetros (com histórico em core.auditoria).

create schema marketing;
grant usage on schema marketing to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Permissões (mesmo catálogo de src/lib/permissions.ts)
-- ---------------------------------------------------------------------------

insert into core.permissoes (codigo, descricao) values
  ('marketing.painel', 'Ver o resumo semanal e os alertas do Marketing'),
  ('marketing.marca', 'Ver a base da marca, baixar os arquivos e usar o revisor de texto'),
  ('marketing.marca.editar', 'Alterar a base da marca e subir nova versão de arquivo'),
  ('marketing.anuncios', 'Ver campanhas, investimento e custo por lead de Meta, Google e TikTok'),
  ('marketing.site', 'Ver tráfego do site, buscas e quantidade de leads'),
  ('marketing.site.dados_lead', 'Ver nome, e-mail e telefone de cada lead (dado pessoal)'),
  ('marketing.redes', 'Ver seguidores, alcance e interações das redes'),
  ('marketing.reputacao', 'Ver avaliações da ARP e dos locatários-chave'),
  ('marketing.radar', 'Ver tarefas, eventos e sinalizações do Asana'),
  ('marketing.publico', 'Ver o fluxo de carros do estacionamento (sem placas)'),
  ('marketing.parametros', 'Editar locatários monitorados, landing pages, metas, regras de alerta e códigos da ronda'),
  ('marketing.exportar', 'Baixar Excel e PDF das telas do Marketing que já vê');

-- O Administrador tem tudo; o resto se marca por cargo em Usuários e cargos.
insert into core.cargo_permissoes (cargo_id, permissao)
  select c.id, p.codigo
  from core.cargos c
  join core.permissoes p on p.codigo like 'marketing.%'
  where c.nome = 'Administrador'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Marca: um bloco por item da base (propósito, tons, palavras…). Cada
-- alteração vira uma versão em marca_versoes, com antes e depois.
--
-- conteudo, pelo tipo:
--   texto: { "texto": "..." }
--   lista: { "itens": [{ "titulo": "...", "texto": "..." }] }  (texto opcional)
--   cores: { "itens": [{ "nome": "...", "hex": "#RRGGBB", "uso": "..." }] }
-- As listas palavras_proprietarias e palavras_proibidas alimentam o revisor.
-- ---------------------------------------------------------------------------

create table marketing.marca_blocos (
  chave text primary key check (chave ~ '^[a-z_]+$'),
  aba text not null check (aba in ('plataforma', 'tom_de_voz', 'publico', 'identidade')),
  titulo text not null,
  -- Para que serve o bloco (aparece embaixo do título).
  descricao text,
  tipo text not null check (tipo in ('texto', 'lista', 'cores')),
  ordem int not null,
  conteudo jsonb not null,
  versao int not null default 1,
  atualizado_por uuid references core.usuarios (id) on delete set null,
  atualizado_em timestamptz not null default now(),
  check (
    case tipo
      when 'texto' then jsonb_typeof(conteudo -> 'texto') = 'string'
      else jsonb_typeof(conteudo -> 'itens') = 'array'
    end
  )
);

create index marca_blocos_aba on marketing.marca_blocos (aba, ordem);

create table marketing.marca_versoes (
  id bigint generated always as identity primary key,
  bloco text not null references marketing.marca_blocos (chave) on delete cascade,
  versao int not null,
  -- Null na versão inicial.
  antes jsonb,
  depois jsonb not null,
  -- Versão desfeita por esta (botão "Voltar esta alteração").
  desfaz bigint references marketing.marca_versoes (id) on delete set null,
  por uuid references core.usuarios (id) on delete set null,
  em timestamptz not null default now(),
  unique (bloco, versao)
);

create index marca_versoes_em on marketing.marca_versoes (em desc);
create index marca_versoes_por on marketing.marca_versoes (por);
create index marca_versoes_desfaz on marketing.marca_versoes (desfaz);
create index marca_blocos_atualizado_por on marketing.marca_blocos (atualizado_por);

-- Antes de gravar: próxima versão, quem e quando. Só o conteúdo muda pela
-- tela (o RLS de update e a coluna liberada no grant garantem).
create function marketing.marca_nova_versao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.conteudo is not distinct from old.conteudo then
    return null; -- nada mudou: nem versão nova
  end if;
  new.versao := old.versao + 1;
  new.atualizado_por := (select auth.uid());
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger nova_versao before update on marketing.marca_blocos
  for each row execute function marketing.marca_nova_versao();

-- Depois de gravar: a linha do histórico. "desfaz" vem da sessão
-- (marketing.desfazer_versao), nunca do formulário.
create function marketing.marca_registrar_versao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into marketing.marca_versoes (bloco, versao, antes, depois, desfaz, por)
  values (
    new.chave,
    new.versao,
    case when tg_op = 'UPDATE' then old.conteudo end,
    new.conteudo,
    nullif(current_setting('marketing.desfaz', true), '')::bigint,
    (select auth.uid())
  );
  return null;
end;
$$;

create trigger registrar_versao after insert or update on marketing.marca_blocos
  for each row execute function marketing.marca_registrar_versao();

-- "Voltar esta alteração": o bloco volta ao que era antes dela, numa versão
-- nova (o histórico nunca perde nada). Com a sessão: o RLS de update confere
-- marketing.marca.editar.
create function marketing.desfazer_versao(p_versao bigint)
returns int
language plpgsql
set search_path = ''
as $$
declare
  v marketing.marca_versoes;
  n int;
begin
  select * into v from marketing.marca_versoes where id = p_versao;
  if v.id is null then
    raise exception 'versão não encontrada' using errcode = 'P0002';
  end if;
  if v.antes is null then
    raise exception 'a versão inicial não tem o que desfazer' using errcode = '22023';
  end if;
  if exists (
    select 1 from marketing.marca_blocos where chave = v.bloco and conteudo = v.antes
  ) then
    raise exception 'o bloco já está como antes desta alteração' using errcode = '22023';
  end if;
  perform set_config('marketing.desfaz', p_versao::text, true);
  update marketing.marca_blocos set conteudo = v.antes where chave = v.bloco;
  get diagnostics n = row_count;
  perform set_config('marketing.desfaz', '', true);
  if n = 0 then
    raise exception 'sem permissão para editar a marca' using errcode = '42501';
  end if;
  return (select versao from marketing.marca_blocos where chave = v.bloco);
end;
$$;

-- Arquivos de marca (PDFs, logos). Ficam no bucket privado "marketing", que
-- só o servidor lê e grava (service role) depois de conferir a permissão.
-- Subir uma versão nova marca a anterior como substituída: nada se apaga.
create table marketing.marca_arquivos (
  id uuid primary key default gen_random_uuid(),
  -- Agrupa as versões do mesmo arquivo (ex.: "guia_rapido").
  grupo text not null check (grupo ~ '^[a-z0-9_]+$'),
  titulo text not null,
  descricao text,
  -- Null: arquivo esperado e ainda não enviado.
  arquivo_nome text,
  arquivo_path text,
  tamanho bigint check (tamanho is null or tamanho >= 0),
  tipo_mime text,
  versao int not null default 1,
  atual boolean not null default true,
  enviado_por uuid references core.usuarios (id) on delete set null,
  enviado_em timestamptz not null default now(),
  unique (grupo, versao)
);

create unique index marca_arquivos_um_atual on marketing.marca_arquivos (grupo) where atual;
create index marca_arquivos_enviado_por on marketing.marca_arquivos (enviado_por);

insert into storage.buckets (id, name, public) values ('marketing', 'marketing', false);

-- ---------------------------------------------------------------------------
-- Parâmetros e cadastros (4.12). Cada alteração cai em core.auditoria.
-- ---------------------------------------------------------------------------

create table marketing.locatarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  categoria text not null check (btrim(categoria) <> ''),
  perfil_url text,
  -- gerente: a ARP é gerente do perfil (todas as avaliações);
  -- consulta_publica: consulta oficial de lugares (dados parciais);
  -- sem_acesso: ainda sem dado (aparece com "sem dados").
  forma_acesso text not null default 'sem_acesso'
    check (forma_acesso in ('gerente', 'consulta_publica', 'sem_acesso')),
  ativo boolean not null default true,
  entrada_em date not null default current_date,
  saida_em date,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (saida_em is null or saida_em >= entrada_em)
);

-- "Locatário repetido: não deixa salvar."
create unique index locatarios_nome on marketing.locatarios (lower(btrim(nome)));

create table marketing.landing_pages (
  -- conversion_identifier do RD Station.
  identificador text primary key check (btrim(identificador) <> ''),
  nome text not null,
  -- Null: "Sem tipo" (gera o aviso no Painel).
  interesse text check (interesse in ('evento', 'locacao', 'outro')),
  atualizado_em timestamptz not null default now()
);

create table marketing.regras_alerta (
  regra text primary key check (regra in (
    'sinalizacoes_abertas',
    'locatario_em_alerta',
    'avaliacao_sem_resposta',
    'custo_por_lead_acima_meta',
    'campanha_sem_lead',
    'avaliacoes_abaixo_do_ritmo',
    'tarefa_atrasada',
    'landing_page_sem_tipo'
  )),
  -- Quantidade ou dias, conforme a regra; null nas que usam a meta.
  limite numeric check (limite is null or limite >= 0),
  nivel text not null check (nivel in ('urgente', 'atencao', 'aviso')),
  ativa boolean not null default true,
  atualizado_em timestamptz not null default now()
);

create table marketing.temas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  ativo boolean not null default true,
  ordem int not null default 0,
  atualizado_em timestamptz not null default now()
);

create unique index temas_nome on marketing.temas (lower(btrim(nome)));

create table marketing.ronda_codigos (
  codigo text primary key check (codigo ~ '^[A-Z0-9]{1,5}$'),
  descricao text not null,
  area text not null check (area in ('marketing', 'operacoes')),
  atualizado_em timestamptz not null default now()
);

-- Uma linha só: reputação, Asana e estacionamento.
create table marketing.parametros (
  id boolean primary key default true check (id),
  -- Reputação
  estrelas_reclamacao int[] not null default '{1,2}'
    check (cardinality(estrelas_reclamacao) > 0 and estrelas_reclamacao <@ '{1,2,3,4,5}'),
  janela_reputacao_dias int not null default 30 check (janela_reputacao_dias between 1 and 365),
  reclamacoes_atencao int not null default 1 check (reclamacoes_atencao >= 1),
  reclamacoes_alerta int not null default 3 check (reclamacoes_alerta >= 1),
  nota_atencao numeric(3, 2) not null default 3.5 check (nota_atencao between 1 and 5),
  -- Asana (os nomes mudam no Asana: nunca fixos no código)
  asana_projetos_marketing text[] not null default '{}',
  asana_projeto_calendario text,
  asana_projeto_ronda text,
  asana_tag_locatario text,
  asana_tag_terceiro text,
  asana_tag_gratuita text,
  asana_tag_paga text,
  sinalizacao_antiga_dias int not null default 15 check (sinalizacao_antiga_dias >= 1),
  -- Estacionamento
  vagas int not null default 350 check (vagas > 0),
  janela_recorrencia_dias int not null default 30 check (janela_recorrencia_dias between 1 and 365),
  atualizado_em timestamptz not null default now(),
  check (reclamacoes_alerta > reclamacoes_atencao)
);

create trigger atualizado_em before update on marketing.locatarios
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on marketing.landing_pages
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on marketing.regras_alerta
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on marketing.temas
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on marketing.ronda_codigos
  for each row execute function core.set_atualizado_em();
create trigger atualizado_em before update on marketing.parametros
  for each row execute function core.set_atualizado_em();

create trigger auditoria after insert or update or delete on marketing.locatarios
  for each row execute function core.auditar('id');
create trigger auditoria after insert or update or delete on marketing.landing_pages
  for each row execute function core.auditar('identificador');
create trigger auditoria after insert or update or delete on marketing.regras_alerta
  for each row execute function core.auditar('regra');
create trigger auditoria after insert or update or delete on marketing.temas
  for each row execute function core.auditar('id');
create trigger auditoria after insert or update or delete on marketing.ronda_codigos
  for each row execute function core.auditar('codigo');
create trigger auditoria after insert or update or delete on marketing.parametros
  for each row execute function core.auditar('id');
create trigger auditoria after insert or update or delete on marketing.marca_arquivos
  for each row execute function core.auditar('id');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table marketing.marca_blocos enable row level security;
alter table marketing.marca_versoes enable row level security;
alter table marketing.marca_arquivos enable row level security;
alter table marketing.locatarios enable row level security;
alter table marketing.landing_pages enable row level security;
alter table marketing.regras_alerta enable row level security;
alter table marketing.temas enable row level security;
alter table marketing.ronda_codigos enable row level security;
alter table marketing.parametros enable row level security;

create policy ver on marketing.marca_blocos for select to authenticated
  using ((select core.pode('marketing.marca')));
create policy editar on marketing.marca_blocos for update to authenticated
  using ((select core.pode('marketing.marca.editar')))
  with check ((select core.pode('marketing.marca.editar')));

create policy ver on marketing.marca_versoes for select to authenticated
  using ((select core.pode('marketing.marca')));

-- Envio de arquivo: só o servidor grava (service role), depois de conferir
-- marketing.marca.editar.
create policy ver on marketing.marca_arquivos for select to authenticated
  using ((select core.pode('marketing.marca')));

-- Cadastros: quem usa o módulo lê (as telas cruzam os dados com eles);
-- só Parâmetros grava.
create policy ver on marketing.locatarios for select to authenticated
  using ((select core.pode_modulo('marketing')));
create policy incluir on marketing.locatarios for insert to authenticated
  with check ((select core.pode('marketing.parametros')));
create policy editar on marketing.locatarios for update to authenticated
  using ((select core.pode('marketing.parametros')))
  with check ((select core.pode('marketing.parametros')));
create policy excluir on marketing.locatarios for delete to authenticated
  using ((select core.pode('marketing.parametros')));

create policy ver on marketing.landing_pages for select to authenticated
  using ((select core.pode_modulo('marketing')));
create policy incluir on marketing.landing_pages for insert to authenticated
  with check ((select core.pode('marketing.parametros')));
create policy editar on marketing.landing_pages for update to authenticated
  using ((select core.pode('marketing.parametros')))
  with check ((select core.pode('marketing.parametros')));
create policy excluir on marketing.landing_pages for delete to authenticated
  using ((select core.pode('marketing.parametros')));

create policy ver on marketing.regras_alerta for select to authenticated
  using ((select core.pode_modulo('marketing')));
create policy editar on marketing.regras_alerta for update to authenticated
  using ((select core.pode('marketing.parametros')))
  with check ((select core.pode('marketing.parametros')));

create policy ver on marketing.temas for select to authenticated
  using ((select core.pode_modulo('marketing')));
create policy incluir on marketing.temas for insert to authenticated
  with check ((select core.pode('marketing.parametros')));
create policy editar on marketing.temas for update to authenticated
  using ((select core.pode('marketing.parametros')))
  with check ((select core.pode('marketing.parametros')));
create policy excluir on marketing.temas for delete to authenticated
  using ((select core.pode('marketing.parametros')));

create policy ver on marketing.ronda_codigos for select to authenticated
  using ((select core.pode_modulo('marketing')));
create policy incluir on marketing.ronda_codigos for insert to authenticated
  with check ((select core.pode('marketing.parametros')));
create policy editar on marketing.ronda_codigos for update to authenticated
  using ((select core.pode('marketing.parametros')))
  with check ((select core.pode('marketing.parametros')));
create policy excluir on marketing.ronda_codigos for delete to authenticated
  using ((select core.pode('marketing.parametros')));

create policy ver on marketing.parametros for select to authenticated
  using ((select core.pode_modulo('marketing')));
create policy editar on marketing.parametros for update to authenticated
  using ((select core.pode('marketing.parametros')))
  with check ((select core.pode('marketing.parametros')));

grant select on all tables in schema marketing to authenticated;
grant update (conteudo) on marketing.marca_blocos to authenticated;
grant insert, update, delete on marketing.locatarios, marketing.landing_pages,
  marketing.temas, marketing.ronda_codigos to authenticated;
grant update on marketing.regras_alerta, marketing.parametros to authenticated;
grant all on all tables in schema marketing to service_role;
grant execute on function marketing.desfazer_versao(bigint) to authenticated;

-- Metas do Marketing (core.metas, indicador "marketing.*"): Parâmetros edita.
alter policy ver on core.metas
  using (
    case split_part(indicador, '.', 1)
      when 'rh' then (select core.pode_modulo('rh'))
      when 'financeiro' then (select core.pode_modulo('financeiro'))
      when 'os' then (select core.pode_modulo('os'))
      when 'marketing' then (select core.pode_modulo('marketing'))
      else core.pode_modulo(split_part(indicador, '.', 1))
    end
  );
alter policy editar on core.metas
  using (
    (indicador like 'rh.%' and (select core.pode('rh.parametros')))
    or (indicador like 'financeiro.%' and (select core.pode('financeiro.importacao_parametros')))
    or (indicador like 'marketing.%' and (select core.pode('marketing.parametros')))
  )
  with check (
    (indicador like 'rh.%' and (select core.pode('rh.parametros')))
    or (indicador like 'financeiro.%' and (select core.pode('financeiro.importacao_parametros')))
    or (indicador like 'marketing.%' and (select core.pode('marketing.parametros')))
  );

-- Histórico dos parâmetros: quem edita os parâmetros vê o histórico deles.
alter policy ver on core.auditoria
  using (
    (select core.pode('admin.historico'))
    or case
      when tabela like 'rh.%' then (select core.pode('rh.parametros'))
      when tabela like 'os.%' then (select core.pode('os.historico'))
      when tabela like 'marketing.%' then (select core.pode('marketing.parametros'))
      when tabela = 'core.metas' then
        (select core.pode('rh.parametros'))
        or (select core.pode('financeiro.importacao_parametros'))
        or (select core.pode('marketing.parametros'))
      when tabela in (
        'core.usuario_permissoes', 'core.usuarios', 'core.cargos', 'core.cargo_permissoes'
      ) then (select core.pode('admin.usuarios'))
      when tabela = 'core.empresa' then (select core.pode('admin.empresa'))
      when tabela = 'integracao.credenciais' then (select core.pode('admin.integracoes'))
      else false
    end
  );

-- ---------------------------------------------------------------------------
-- Ponto de partida (tudo editável nas telas)
-- ---------------------------------------------------------------------------

-- Base da marca com o que o spec já traz do rebranding 2025 e do guia
-- rápido. O que o spec não transcreve fica vazio, para preencher pela tela
-- com o documento em mãos (valores, discurso, cores, explicação dos tons).
insert into marketing.marca_blocos (chave, aba, titulo, descricao, tipo, ordem, conteudo) values
  ('proposito', 'plataforma', 'Propósito', 'Por que a ARP existe.', 'texto', 1,
    '{"texto": "Conectar pessoas e impulsionar negócios através do nosso ecossistema criativo."}'),
  ('arquetipo', 'plataforma', 'Arquétipo', 'A personalidade da marca.', 'texto', 2,
    '{"texto": "Mago"}'),
  ('atributos', 'plataforma', 'Atributos', 'Como a marca é percebida.', 'lista', 3,
    '{"itens": [{"titulo": "Corajosa"}, {"titulo": "Visionária"}, {"titulo": "Parceira"}, {"titulo": "Transformadora"}, {"titulo": "Inovadora"}]}'),
  ('valores', 'plataforma', 'Valores', 'Os 5 valores do rebranding 2025.', 'lista', 4,
    '{"itens": []}'),
  ('direcionadores', 'plataforma', 'Direcionadores de experiência', 'O que toda experiência ARP entrega.', 'lista', 5,
    '{"itens": [{"titulo": "Transformamos histórias"}, {"titulo": "Vivemos a rua"}, {"titulo": "Herdamos coragem"}]}'),
  ('posicionamento', 'plataforma', 'Discurso de posicionamento', 'O texto de apresentação da marca.', 'texto', 6,
    '{"texto": ""}'),
  ('tagline', 'plataforma', 'Tagline', null, 'texto', 7,
    '{"texto": "ARP. Onde tudo acontece."}'),
  ('tons', 'tom_de_voz', 'Tons de voz', 'Os 5 tons, com a explicação de cada um.', 'lista', 1,
    '{"itens": [{"titulo": "Empoderador", "texto": ""}, {"titulo": "Mente aberta", "texto": ""}, {"titulo": "Confiante", "texto": ""}, {"titulo": "Positiva", "texto": ""}, {"titulo": "Humorada", "texto": ""}]}'),
  ('palavras_proprietarias', 'tom_de_voz', 'Palavras proprietárias', 'Palavras que são da ARP. O revisor sugere estas.', 'lista', 2,
    '{"itens": [{"titulo": "Energia"}, {"titulo": "1911"}, {"titulo": "Lugar de ser"}, {"titulo": "Rua do Relógio"}]}'),
  ('palavras_proibidas', 'tom_de_voz', 'Palavras proibidas', 'Palavras que a ARP não usa. O revisor marca estas em vermelho.', 'lista', 3,
    '{"itens": [{"titulo": "Super Espaço"}, {"titulo": "Melhor da Cidade"}, {"titulo": "Tem de tudo"}, {"titulo": "Repleto de atividades"}, {"titulo": "Shopping"}]}'),
  ('frases_de_apoio', 'tom_de_voz', 'Frases de apoio', 'Frases prontas no tom da marca.', 'lista', 4,
    '{"itens": []}'),
  ('personas', 'publico', 'Personas', 'Quem a ARP quer encontrar.', 'lista', 1,
    '{"itens": [{"titulo": "A Corajosa", "texto": ""}, {"titulo": "O Bon Vivant", "texto": ""}, {"titulo": "O Prático", "texto": ""}]}'),
  ('clusters', 'publico', 'Clusters', 'Grupos de público.', 'lista', 2,
    '{"itens": [{"titulo": "Empreendedores"}, {"titulo": "Franqueados"}, {"titulo": "Artistas"}, {"titulo": "Instituições"}, {"titulo": "Pais de pets"}]}'),
  ('jornada', 'publico', 'Jornada', 'Etapas da relação com a marca.', 'lista', 3,
    '{"itens": [{"titulo": "Descoberta", "texto": ""}, {"titulo": "Consideração", "texto": ""}, {"titulo": "Conversão", "texto": ""}, {"titulo": "Fidelização", "texto": ""}]}'),
  ('brand_moments', 'publico', 'Brand moments', 'Momentos em que a marca aparece.', 'lista', 4,
    '{"itens": []}'),
  ('cores_primarias', 'identidade', 'Cores primárias', 'Códigos do guia rápido 2025.', 'cores', 1,
    '{"itens": []}'),
  ('cores_secundarias', 'identidade', 'Cores secundárias', 'Códigos do guia rápido 2025.', 'cores', 2,
    '{"itens": []}'),
  ('tipografia', 'identidade', 'Tipografia', 'Famílias e onde usar cada uma.', 'lista', 3,
    '{"itens": [{"titulo": "Poppins", "texto": ""}, {"titulo": "Haboro Contrast", "texto": ""}]}'),
  ('logo', 'identidade', 'Versões do logo', 'Quando usar cada versão.', 'lista', 4,
    '{"itens": []}'),
  ('grafismos', 'identidade', 'Grafismos', 'Elementos gráficos de apoio.', 'lista', 5,
    '{"itens": []}');

insert into marketing.marca_arquivos (grupo, titulo, descricao) values
  ('rebranding', 'Rebranding Espaço Arp – Doc Final – 2025', 'Documento completo da marca (54 páginas).'),
  ('guia_rapido', 'Guia rápido ARP 2025', 'Resumo para o dia a dia (10 páginas).'),
  ('ebook_108_anos', 'E-book 108 anos', 'História da Fábrica de Rendas Arp.'),
  ('logos', 'Logos', 'Versões do logo para baixar.');

insert into marketing.parametros (
  asana_projetos_marketing, asana_projeto_calendario, asana_projeto_ronda,
  asana_tag_locatario, asana_tag_terceiro, asana_tag_gratuita, asana_tag_paga
) values (
  '{"Marketing","Demandas internas","Conteúdo e redes"}', 'Calendário de eventos',
  'Ronda de ambiência', 'Locatário', 'Terceiro', 'Gratuito', 'Pago'
);

insert into marketing.regras_alerta (regra, limite, nivel) values
  ('sinalizacoes_abertas', 30, 'urgente'),
  ('locatario_em_alerta', null, 'urgente'),
  ('avaliacao_sem_resposta', 2, 'atencao'),
  ('custo_por_lead_acima_meta', null, 'atencao'),
  ('campanha_sem_lead', null, 'atencao'),
  ('avaliacoes_abaixo_do_ritmo', null, 'atencao'),
  ('tarefa_atrasada', 7, 'atencao'),
  ('landing_page_sem_tipo', null, 'aviso');

insert into marketing.ronda_codigos (codigo, descricao, area) values
  ('S', 'Sinalização', 'marketing'),
  ('E', 'Estrutura', 'operacoes');

insert into marketing.temas (nome, ordem) values
  ('Estacionamento', 1), ('Sinalização', 2), ('Atendimento', 3),
  ('Limpeza', 4), ('Eventos', 5), ('Gastronomia', 6);

-- Landing pages do RD conhecidas (exemplo). Uma sexta, só no RD, aparece
-- como "Sem tipo" até alguém classificar.
insert into marketing.landing_pages (identificador, nome, interesse) values
  ('lp-casamentos-e-festas', 'Casamentos e festas', 'evento'),
  ('lp-eventos-corporativos', 'Eventos corporativos', 'evento'),
  ('lp-lojas-disponiveis', 'Lojas disponíveis', 'locacao'),
  ('lp-espacos-coworking', 'Salas e coworking', 'locacao'),
  ('lp-newsletter-agenda', 'Agenda da semana', 'outro');

-- Locatários-chave de exemplo (nomes inventados). A planilha do Daniel
-- substitui esta lista pela carga inicial em Parâmetros.
insert into marketing.locatarios (nome, categoria, perfil_url, forma_acesso, entrada_em) values
  ('Bistrô Tear', 'Gastronomia', 'https://maps.google.com/?cid=1001', 'gerente', '2026-01-05'),
  ('Empório Bobina', 'Loja do térreo', 'https://maps.google.com/?cid=1002', 'gerente', '2026-01-05'),
  ('Pizzaria Fio de Ouro', 'Gastronomia', 'https://maps.google.com/?cid=1003', 'gerente', '2026-01-05'),
  ('Livraria Novelo', 'Loja do térreo', 'https://maps.google.com/?cid=1004', 'gerente', '2026-01-05'),
  ('Studio Trama Pilates', 'Experiência', 'https://maps.google.com/?cid=1005', 'gerente', '2026-01-05'),
  ('Sorveteria Renda Fria', 'Gastronomia', 'https://maps.google.com/?cid=1006', 'gerente', '2026-01-05'),
  ('Barbearia Agulha', 'Serviços', 'https://maps.google.com/?cid=1007', 'gerente', '2026-01-05'),
  ('Pet Carretel', 'Loja do térreo', 'https://maps.google.com/?cid=1008', 'gerente', '2026-01-05'),
  ('Hamburgueria Lançadeira', 'Gastronomia', 'https://maps.google.com/?cid=1009', 'gerente', '2026-01-05'),
  ('Doceria Bordado', 'Gastronomia', 'https://maps.google.com/?cid=1010', 'gerente', '2026-01-05'),
  ('Ótica Ponto Cruz', 'Loja do térreo', 'https://maps.google.com/?cid=1011', 'gerente', '2026-01-05'),
  ('Escola de Música Urdume', 'Experiência', 'https://maps.google.com/?cid=1012', 'gerente', '2026-01-05'),
  ('Galeria Linha Viva', 'Experiência', 'https://maps.google.com/?cid=1013', 'gerente', '2026-01-05'),
  ('Brinquedoteca Retalho', 'Experiência', 'https://maps.google.com/?cid=1014', 'gerente', '2026-01-05'),
  ('Ateliê Crochê & Cia', 'Loja do térreo', 'https://maps.google.com/?cid=1015', 'gerente', '2026-01-05'),
  ('Casa da Tecelagem', 'Gastronomia', 'https://maps.google.com/?cid=1016', 'gerente', '2026-01-05'),
  ('Academia Fibra', 'Serviços', 'https://maps.google.com/?cid=1017', 'gerente', '2026-01-05'),
  ('Vinheria Meada', 'Gastronomia', 'https://maps.google.com/?cid=1018', 'consulta_publica', '2026-01-05'),
  ('Coworking Teia', 'Serviços', 'https://maps.google.com/?cid=1019', 'consulta_publica', '2026-01-05'),
  ('Floricultura Tramela', 'Loja do térreo', null, 'sem_acesso', '2026-01-05');

-- Metas iniciais (a confirmar com o Daniel; editáveis em Parâmetros).
insert into core.metas (indicador, direcao, meta, limite_atencao, vigente_desde) values
  ('marketing.avaliacoes_novas_arp', 'maior_melhor', 30, 24, '2026-01-01'),
  ('marketing.nota_media_arp', 'maior_melhor', 4.6, 4.4, '2026-01-01'),
  ('marketing.leads_mes', 'maior_melhor', 240, 200, '2026-01-01'),
  ('marketing.custo_por_lead', 'menor_melhor', 45, 55, '2026-01-01');
