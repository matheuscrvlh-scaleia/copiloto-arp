-- Formulários: pergunta do tipo "Envio de arquivo". Os arquivos ficam no
-- bucket privado "formularios", em <formulario_id>/<uuid>.<ext>, e a
-- resposta guarda caminho, nome, tamanho e tipo. Quem responde sobe pelo
-- servidor (service role, depois de conferir o token e o tipo pelo
-- conteúdo); a equipe baixa por um link assinado que o servidor gera depois
-- de conferir formularios.ver ou formularios.editar. Ninguém com login lê
-- ou grava o bucket direto.
--
-- As perguntas condicionais não mudam o banco: a condição fica em campos.

insert into storage.buckets (id, name, public) values ('formularios', 'formularios', false);
