-- Oportunidades do RD Station CRM (API v2), gravadas pela sincronização
-- diária (/api/sync/rd-crm) ou pelo "Sincronizar agora". Só a service role
-- grava. A sessão lê as oportunidades sem os contatos; os contatos (nome,
-- e-mail, telefone) só o servidor lê, depois de conferir o Funil.

create table comercial.rd_oportunidades (
  id text primary key,
  -- Oportunidade no formato das telas (lib/comercial/fontes.ts), sem contatos.
  dados jsonb not null,
  contatos jsonb not null default '[]',
  atualizado_em timestamptz not null default now()
);

alter table comercial.rd_oportunidades enable row level security;

create policy ver on comercial.rd_oportunidades for select to authenticated
  using (
    (select core.pode('comercial.funil.ver'))
    or (select core.pode('comercial.painel.ver'))
    or (select core.pode('comercial.parametros.editar'))
  );

revoke all on comercial.rd_oportunidades from anon, authenticated;
grant select (id, dados, atualizado_em) on comercial.rd_oportunidades
  to authenticated;
grant all on comercial.rd_oportunidades to service_role;
