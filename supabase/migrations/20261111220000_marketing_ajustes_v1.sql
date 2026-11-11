-- Ajustes do Marketing (apresentação de 30/10 e "Ajustes Copiloto V1"):
-- 1. Marca › Imagens de referência: arquivo de marca marcado como
--    referência (imagem, título e para que serve), vista em grade.
-- 2. Visualização padrão: o administrador esconde quadros de cada tela, e
--    vale para todos do módulo (uma só, sem escolha por usuário).
-- 3. Reputação › Benchmark: as referências (espaços parecidos com a ARP).
-- 4. Público e visitação volta, agora com a contagem das câmeras.

-- 1 ------------------------------------------------------------------------
alter table marketing.marca_arquivos
  add column referencia boolean not null default false;

-- 2 ------------------------------------------------------------------------
-- "tela.quadro" de cada quadro escondido (lib/marketing/visualizacao.ts).
-- Fica na linha única de parâmetros: o histórico e o "voltar" já cobrem.
alter table marketing.parametros
  add column quadros_ocultos text[] not null default '{}'
    check (cardinality(quadros_ocultos) <= 200),
  -- Termos que contam como busca pela marca no Search Console (Painel).
  add column termos_marca text[] not null default '{arp}'
    check (cardinality(termos_marca) between 1 and 20);

-- 3 ------------------------------------------------------------------------
create table marketing.benchmark (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  cidade text,
  -- Usuário do Instagram, sem @ (o que a consulta da Meta usa).
  instagram text check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  site text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index benchmark_nome on marketing.benchmark (lower(btrim(nome)));

create trigger atualizado_em before update on marketing.benchmark
  for each row execute function core.set_atualizado_em();
create trigger auditoria after insert or update or delete on marketing.benchmark
  for each row execute function core.auditar('id');

alter table marketing.benchmark enable row level security;
create policy ver on marketing.benchmark for select to authenticated
  using ((select core.pode_modulo('marketing')));
create policy incluir on marketing.benchmark for insert to authenticated
  with check ((select core.pode('marketing.parametros')));
create policy editar on marketing.benchmark for update to authenticated
  using ((select core.pode('marketing.parametros')))
  with check ((select core.pode('marketing.parametros')));
create policy remover on marketing.benchmark for delete to authenticated
  using ((select core.pode('marketing.parametros')));
grant select, insert, update, delete on marketing.benchmark to authenticated;
grant all on marketing.benchmark to service_role;

-- 4 ------------------------------------------------------------------------
-- A contagem fica em integracao.camera_contagens (só o servidor lê); a tela
-- confere esta permissão antes de ler. Quem vê o Painel passa a ver também.
insert into core.permissoes (codigo, descricao) values
  ('marketing.publico', 'Ver o fluxo de pessoas contado pelas câmeras (sem imagem)');

insert into core.cargo_permissoes (cargo_id, permissao)
  select cargo_id, 'marketing.publico'
  from core.cargo_permissoes
  where permissao = 'marketing.painel'
on conflict do nothing;

insert into core.usuario_permissoes (usuario_id, permissao)
  select usuario_id, 'marketing.publico'
  from core.usuario_permissoes
  where permissao = 'marketing.painel'
on conflict do nothing;
