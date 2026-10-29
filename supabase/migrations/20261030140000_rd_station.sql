-- RD Station Marketing com dados reais: a sincronização diária grava os
-- contatos que converteram nas últimas 18 semanas, cada conversão (com a
-- origem da sessão que converteu) e uma foto diária das landing pages (o
-- plano da ARP só lê 45 dias para trás no analytics; a foto guarda o resto).
-- Só o servidor grava (service role). Contato tem dado pessoal: só lê quem
-- vê Site e leads; as telas mostram nome, e-mail e telefone só com
-- marketing.site.dados_lead.

create table marketing.rd_contatos (
  uuid text primary key,
  nome text not null default '',
  email text not null default '',
  telefone text not null default '',
  cidade text not null default '',
  uf text not null default '',
  tags text[] not null default '{}',
  -- Etapa do funil hoje: Lead, Lead qualificado, Cliente ('' se o RD não diz).
  etapa text not null default '',
  criado_em timestamptz,
  -- last_conversion_date do RD: igual ao do RD, o contato não é relido.
  ultima_conversao timestamptz,
  atualizado_em timestamptz not null default now()
);

create table marketing.rd_conversoes (
  -- Contato, identificador e data (o RD não dá id ao evento).
  id text primary key,
  contato_uuid text not null references marketing.rd_contatos (uuid) on delete cascade,
  -- conversion_identifier: a landing page ou o formulário.
  identificador text not null,
  convertido_em timestamptz not null,
  -- Sessão que converteu: utm_source / utm_medium / utm_campaign, ou o site
  -- de onde a pessoa veio, ou (direct).
  origem text not null default '',
  meio text not null default '',
  campanha text not null default ''
);
create index rd_conversoes_data on marketing.rd_conversoes (convertido_em);
create index rd_conversoes_contato on marketing.rd_conversoes (contato_uuid);

create table marketing.rd_landing_pages_dia (
  identificador text not null,
  dia date not null,
  nome text not null default '',
  visitas int not null default 0 check (visitas >= 0),
  conversoes int not null default 0 check (conversoes >= 0),
  primary key (identificador, dia)
);

alter table marketing.rd_contatos enable row level security;
alter table marketing.rd_conversoes enable row level security;
alter table marketing.rd_landing_pages_dia enable row level security;

create policy ver on marketing.rd_contatos for select to authenticated
  using ((select core.pode('marketing.site')));
create policy ver on marketing.rd_conversoes for select to authenticated
  using ((select core.pode_modulo('marketing')));
create policy ver on marketing.rd_landing_pages_dia for select to authenticated
  using ((select core.pode_modulo('marketing')));

grant select on marketing.rd_contatos, marketing.rd_conversoes,
  marketing.rd_landing_pages_dia to authenticated;
grant all on marketing.rd_contatos, marketing.rd_conversoes,
  marketing.rd_landing_pages_dia to service_role;
