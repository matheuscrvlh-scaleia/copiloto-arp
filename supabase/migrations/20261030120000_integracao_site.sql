-- Agenda de eventos do site da ARP (WordPress) entra como integração do
-- Marketing: só o endereço público da lista de eventos, sem login. O
-- segredo gravado é um vazio cifrado (a coluna e salvar_integracao exigem um).

alter table integracao.credenciais drop constraint credenciais_sistema_check;
alter table integracao.credenciais add constraint credenciais_sistema_check
  check (sistema in (
    'secullum', 'wps', 'diario_de_obras', 'copiloto_rh',
    'mkt_google', 'mkt_meta', 'mkt_tiktok', 'mkt_rd_station', 'mkt_asana',
    'mkt_site'
  ));
