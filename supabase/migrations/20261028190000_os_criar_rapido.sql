-- Quem usa o módulo cria categoria e terceirizado pelo "Novo chamado" (sem
-- editar nem excluir: isso continua com os.catalogo e os.terceirizados).
-- Categoria: só a simples, de cima, sem responsável, agenda nem portal.
create policy criar on os.categorias for insert to authenticated
  with check (
    (select core.pode('os.acessar'))
    and pai_id is null
    and responsavel_padrao_id is null
    and agenda_id is null
    and not no_portal
  );

-- Terceirizado: a empresa ativa, cadastrada à mão (não a da importação).
create policy criar on os.empresas for insert to authenticated
  with check (
    (select core.pode('os.acessar'))
    and ativo
    and not exemplo
    and legado_id is null
    and importacao_id is null
  );
