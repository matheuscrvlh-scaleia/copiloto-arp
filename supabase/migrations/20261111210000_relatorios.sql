-- Relatórios: o módulo Formulários passa a se chamar Relatórios na tela
-- (menu Gestão, abaixo do Dashboard) e ganha o que os concorrentes têm
-- (Google Forms, Typeform, Tally, Jotform): cor de destaque do link, uma
-- seção por página com barra de progresso e endereço para onde levar quem
-- respondeu. O schema, as tabelas e os códigos das permissões continuam
-- "formularios" (só os textos mudam).

alter table formularios.formularios
  add column cor text not null default 'grafite'
    check (cor in ('grafite', 'azul', 'verde', 'vinho', 'laranja', 'roxo')),
  -- Cada título de seção abre uma página nova no link.
  add column paginas boolean not null default false,
  -- Depois do envio, leva para este endereço (só https) em vez do
  -- agradecimento.
  add column redirecionar_para text
    check (
      redirecionar_para is null
      or (redirecionar_para ~ '^https://[^\s]+$' and length(redirecionar_para) <= 500)
    );

update core.permissoes set descricao = 'Ver os relatórios e as respostas recebidas'
  where codigo = 'formularios.ver';
update core.permissoes set descricao = 'Criar, editar, publicar, encerrar e excluir relatórios e respostas'
  where codigo = 'formularios.editar';
update core.permissoes set descricao = 'Baixar as respostas dos relatórios em Excel e PDF'
  where codigo = 'formularios.exportar';
