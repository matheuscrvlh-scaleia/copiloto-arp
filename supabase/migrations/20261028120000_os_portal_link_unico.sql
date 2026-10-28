-- Portal do lojista com um link só (/portal) para todas as lojas: a loja
-- entra com o CNPJ e fica numa sessão (cookie) gravada aqui. Os links por
-- loja (os.portal_links) deixam de valer: os ativos são cancelados e a
-- tabela fica só como histórico.

update os.portal_links set cancelado_em = now() where cancelado_em is null;

-- CNPJ só com dígitos (a tela já grava assim) e índice para a entrada.
update os.lojas set cnpj = nullif(regexp_replace(cnpj, '\D', '', 'g'), '')
  where cnpj is not null and cnpj !~ '^\d{14}$';
create index lojas_cnpj_vigente on os.lojas (cnpj) where situacao = 'vigente';

-- Sessão da loja no portal. O token vai no cookie; encerrar vale na hora
-- (o portal confere a sessão, o prazo e o contrato a cada requisição).
create table os.portal_sessoes (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references os.lojas (id) on delete cascade,
  token text not null unique check (length(token) >= 32),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  ultimo_acesso_em timestamptz,
  encerrado_em timestamptz,
  encerrado_por uuid references core.usuarios (id) on delete set null,
  check (criado_em < expira_em)
);
create index portal_sessoes_loja on os.portal_sessoes (loja_id);
create index portal_sessoes_encerrado_por on os.portal_sessoes (encerrado_por)
  where encerrado_por is not null;

-- Tentativas de entrada que falharam (CNPJ sem loja vigente), por IP:
-- limita quem tenta CNPJs em sequência. Só o servidor lê e grava.
create table os.portal_tentativas (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  criado_em timestamptz not null default now()
);
create index portal_tentativas_ip on os.portal_tentativas (ip, criado_em);

alter table os.portal_sessoes enable row level security;
create policy ver on os.portal_sessoes for select to authenticated
  using ((select core.pode('os.portal')));
create policy editar on os.portal_sessoes for update to authenticated
  using ((select core.pode('os.portal'))) with check ((select core.pode('os.portal')));
grant select, update on os.portal_sessoes to authenticated;
grant all on os.portal_sessoes to service_role;

alter table os.portal_tentativas enable row level security;
grant all on os.portal_tentativas to service_role;

-- Itens dos modelos de entrada e saída: o texto antigo falava em gerar e
-- cancelar o link da loja (só troca se ninguém editou).
update os.modelo_itens
  set titulo = 'Enviar à loja o link do portal (entra com o CNPJ)'
  where acao = 'portal_gerar' and titulo = 'Gerar e enviar o link do portal da loja';
update os.modelo_itens
  set titulo = 'Encerrar o acesso da loja ao portal'
  where acao = 'portal_cancelar' and titulo = 'Cancelar o link do portal da loja';

-- Dois tipos de pedido novos no portal, em Operações (as do portal que já
-- existem continuam).
insert into os.categorias (
  setor_id, nome, icone, ordem, tipo_padrao, prioridade_padrao, prazo_valor,
  prazo_unidade, resposta_horas, vincular_loja, no_portal, orientacao_portal
)
select s.id, c.nome, c.icone, c.ordem, 'solicitacao', 'media', c.prazo,
  'dias_uteis', 8, true, true, c.orientacao
from (values
  ('Reunião', 'users', 9, 3,
    'Conte o assunto e sugira dias e horários. A equipe confirma por aqui.'),
  ('Envio de documentos', 'folder-open', 10, 5,
    'Anexe os documentos e diga do que se trata. A equipe responde por aqui.')
) as c(nome, icone, ordem, prazo, orientacao)
join os.setores s on s.nome = 'Operações'
where not exists (
  select 1 from os.categorias x where x.setor_id = s.id and x.nome = c.nome
);
