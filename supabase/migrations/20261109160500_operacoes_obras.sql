-- operacoes_obras: Obras — previsto e realizado (spec 4.9), complemento do
-- contrato 20261109160000_operacoes.
--
-- Uma obra do Diário de Obra fica ligada a no máximo uma obra do orçamento
-- (operacoes.obras.diario_obra_id). Sem chave estrangeira de propósito: a
-- cópia do Diário (operacoes.diario_obras) é refeita pela sincronização, e a
-- obra do orçamento não pode cair junto. O índice também serve a quem
-- procura a obra do orçamento pelo id do Diário.

create unique index obras_diario_obra on operacoes.obras (diario_obra_id)
  where diario_obra_id is not null;
