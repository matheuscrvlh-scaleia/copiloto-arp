-- IA ARP: conversas da equipe e uso sem limite padrão.
-- - Nova permissão ia.conversas: quem a tem lê as conversas das outras
--   pessoas (só lê; apagar e avaliar continuam só do dono). Começa com quem
--   já gerencia a IA.
-- - A IA nasce sem limite mensal: o limite só existe se alguém puser em
--   Configurações › IA (padrão, por cargo ou por pessoa).

insert into core.permissoes (codigo, descricao) values
  ('ia.conversas', 'Ler as conversas das outras pessoas com a IA ARP (cada leitura fica no histórico)')
on conflict do nothing;

insert into core.cargo_permissoes (cargo_id, permissao)
select cargo_id, 'ia.conversas' from core.cargo_permissoes
where permissao = 'ia.gerenciar'
on conflict do nothing;

insert into core.usuario_permissoes (usuario_id, permissao)
select usuario_id, 'ia.conversas' from core.usuario_permissoes
where permissao = 'ia.gerenciar'
on conflict do nothing;

drop policy ver on ia.conversas;
create policy ver on ia.conversas for select to authenticated
  using (usuario_id = (select auth.uid()) or (select core.pode('ia.conversas')));

drop policy ver on ia.perguntas;
create policy ver on ia.perguntas for select to authenticated
  using (usuario_id = (select auth.uid()) or (select core.pode('ia.conversas')));

-- O limite de 2 milhões que a 0009 pôs de fábrica sai; um valor escolhido
-- depois (diferente desse) fica.
update ia.config set limite_padrao_mes = null where limite_padrao_mes = 2000000;
