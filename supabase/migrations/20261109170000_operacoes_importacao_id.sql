-- A importação do orçamento gera o id da importação antes de gravar (ele
-- entra no caminho do arquivo guardado: importacoes/orcamento/<id>/...).
-- Sem o grant da coluna id, a tela recebia "permission denied" e nenhuma
-- planilha de orçamento entrava. O id continua sendo um uuid; o RLS de
-- insert (tipo, status 'previa', criado_por = quem grava) não muda.
grant insert (id) on operacoes.importacoes to authenticated;
