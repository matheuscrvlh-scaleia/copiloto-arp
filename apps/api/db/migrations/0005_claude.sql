-- Inteligência artificial (Claude, da Anthropic). A chave da API e o modelo
-- são configurados em Administração › Integrações (só admin.integracoes:
-- core.pode_integracao já cobre, sem prefixo de módulo). As telas que usam a
-- IA chamam o conector com a credencial salva; nada novo é gravado no banco.

alter table integracao.credenciais drop constraint credenciais_sistema_check;
alter table integracao.credenciais add constraint credenciais_sistema_check
  check (sistema = any (array[
    'secullum', 'wps', 'diario_de_obras', 'copiloto_rh', 'rd_crm', 'cameras',
    'mkt_google', 'mkt_youtube', 'mkt_meta', 'mkt_tiktok', 'mkt_rd_station',
    'mkt_asana', 'mkt_site', 'sus_growatt', 'claude'
  ]));
