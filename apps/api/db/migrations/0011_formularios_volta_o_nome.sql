-- Relatórios volta a se chamar Formulários (pedido do dono em 19/11/2026):
-- os textos das permissões formularios.* deixam de falar em relatórios.
update core.permissoes
set descricao = replace(descricao, 'relatórios', 'formulários')
where codigo like 'formularios.%';
