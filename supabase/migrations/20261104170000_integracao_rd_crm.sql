-- RD Station em Administração › Integrações: o Comercial e o Marketing
-- usam os mesmos dados. Entra o RD Station CRM (token da instância), e o
-- RD Station Marketing deixa de ser configurável só com marketing.parametros.

alter table integracao.credenciais drop constraint credenciais_sistema_check;
alter table integracao.credenciais add constraint credenciais_sistema_check
  check (sistema in (
    'secullum', 'wps', 'diario_de_obras', 'copiloto_rh', 'rd_crm',
    'mkt_google', 'mkt_youtube', 'mkt_meta', 'mkt_tiktok', 'mkt_rd_station',
    'mkt_asana', 'mkt_site'
  ));

create or replace function core.pode_integracao(p_sistema text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select core.pode('admin.integracoes'))
    or (
      p_sistema like 'mkt\_%'
      and p_sistema <> 'mkt_rd_station'
      and (select core.pode('marketing.parametros'))
    );
$$;
