-- Copiloto RH passa a ser uma integração configurável em Administração ›
-- Integrações (endereço da API, client_id e client_secret).

alter table integracao.credenciais drop constraint credenciais_sistema_check;
alter table integracao.credenciais add constraint credenciais_sistema_check
  check (sistema in ('secullum', 'wps', 'diario_de_obras', 'copiloto_rh'));
