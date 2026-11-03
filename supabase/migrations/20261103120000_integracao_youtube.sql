-- O canal do YouTube da ARP está numa conta Google diferente da que acessa
-- Ads, Analytics, Search Console e Perfil da Empresa: volta a ter acesso
-- próprio (login Google à parte), em vez de um produto do mkt_google.

alter table integracao.credenciais drop constraint credenciais_sistema_check;
alter table integracao.credenciais add constraint credenciais_sistema_check
  check (sistema in (
    'secullum', 'wps', 'diario_de_obras', 'copiloto_rh',
    'mkt_google', 'mkt_youtube', 'mkt_meta', 'mkt_tiktok', 'mkt_rd_station',
    'mkt_asana', 'mkt_site'
  ));
