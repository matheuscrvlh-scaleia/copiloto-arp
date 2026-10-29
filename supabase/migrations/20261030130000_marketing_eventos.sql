-- A agenda de eventos do site sai do Radar operacional e vira a tela
-- Marketing › Eventos do site, com permissão própria. Quem já via a agenda
-- pelo Radar (no cargo ou na pessoa) continua vendo.

insert into core.permissoes (codigo, descricao) values
  ('marketing.eventos', 'Ver a agenda de eventos publicada no site da ARP');

insert into core.cargo_permissoes (cargo_id, permissao)
  select cargo_id, 'marketing.eventos'
  from core.cargo_permissoes
  where permissao = 'marketing.radar'
on conflict do nothing;

insert into core.usuario_permissoes (usuario_id, permissao)
  select usuario_id, 'marketing.eventos'
  from core.usuario_permissoes
  where permissao = 'marketing.radar'
on conflict do nothing;
