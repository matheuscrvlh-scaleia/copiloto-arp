-- Desempenho do RLS e índices. Nenhuma regra de acesso muda: quem via (ou
-- mexia em) uma linha continua vendo (ou mexendo), e só isso.
--
-- 1. Chamada de função que não depende da linha vai dentro de `(select ...)`
--    (InitPlan): o Postgres calcula uma vez por consulta, e não uma vez por
--    linha. `core.pode` e `core.pode_modulo` são security definer e não são
--    expandidas no plano.
-- 2. Regra que depende da linha compara a coluna com um conjunto calculado
--    uma vez: `setor_id = any (array(select os.meus_setores()))` e
--    `id in (select os.meus_chamados_envolvidos())` (hashed SubPlan).
--    Antes, `os.ve_chamado` fazia ~8 subconsultas por chamado.
-- 3. Filhas do chamado: `exists (select 1 from os.chamados c where c.id =
--    chamado_id ...)` sem security definer. A subconsulta passa pelo RLS de
--    os.chamados (a política `ver`, que é a mesma regra de os.ve_chamado),
--    então "vê a filha quem vê o chamado" continua igual, com uma busca pela
--    chave do chamado e a regra já calculada.
-- 4. Nas filhas, a política `for all` de edição virou uma por comando
--    (insert, update, delete). Uma política `for all` também vale no select
--    (somada com `ver` por "ou"), então cada linha lida rodava a regra de
--    edição antes da de leitura. Como quem edita sempre vê (a regra de
--    edição exige a de leitura), tirar a edição do select não muda o que
--    cada um vê.
--
-- os.ve_chamado, os.edita_chamado, os.pode_ver_chamado e
-- os.pode_editar_chamado continuam iguais: o servidor chama
-- os.pode_editar_chamado (rpc), a política `abrir` de os.chamados usa a
-- versão security definer (uma subconsulta em os.chamados dentro de uma
-- política de os.chamados seria recursão) e os testes comparam as políticas
-- com elas (supabase/tests/os-rls.test.ts).
--
-- As políticas do schema rh não mudam nesta migration.

-- ---------------------------------------------------------------------------
-- Funções de apoio (calculadas uma vez por consulta)
-- ---------------------------------------------------------------------------

-- Setores do usuário logado: os.meus_setores() (já existe) em
-- `setor_id = any (array(select os.meus_setores()))`. O array(select ...)
-- vira InitPlan. (Atenção: `= any ((select f()))` não serve, o Postgres lê
-- como `any (subconsulta)` e compara uuid com uuid[].)

-- Chamados em que o usuário logado está envolvido (a mesma regra de
-- os.envolvido): destino para ele, para o setor dele ou com ele de
-- responsável, ou citado como participante. Só para quem usa o módulo (a
-- política de os.chamados já exige; aqui é para a função, que fica exposta
-- na API, não listar ids a quem perdeu o acesso).
create function os.meus_chamados_envolvidos()
returns setof uuid
language sql
stable
security definer
set search_path = ''
rows 100
as $$
  select d.chamado_id
  from os.destinatarios d
  where (select core.pode_modulo('os'))
    and (
      d.usuario_id = (select auth.uid())
      or d.responsavel_id = (select auth.uid())
      or d.setor_id = any (array(select os.meus_setores()))
    )
  union
  select p.chamado_id
  from os.participantes p
  where (select core.pode_modulo('os'))
    and p.usuario_id = (select auth.uid());
$$;

revoke all on function os.meus_chamados_envolvidos() from public, anon;
grant execute on function os.meus_chamados_envolvidos() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- core
-- ---------------------------------------------------------------------------

alter policy ver on core.usuarios
  using (id = (select auth.uid()) or (select core.pode('admin.usuarios')));
alter policy gerenciar on core.usuarios
  using ((select core.pode('admin.usuarios')))
  with check ((select core.pode('admin.usuarios')));
alter policy excluir on core.usuarios
  using ((select core.pode('admin.usuarios')) and id <> (select auth.uid()));

alter policy ver on core.usuario_permissoes
  using (usuario_id = (select auth.uid()) or (select core.pode('admin.usuarios')));
alter policy conceder on core.usuario_permissoes
  with check ((select core.pode('admin.usuarios')));
alter policy revogar on core.usuario_permissoes
  using ((select core.pode('admin.usuarios')));

alter policy ver on core.cargos
  using (
    (select core.pode('admin.usuarios'))
    or id = (select u.cargo_id from core.usuarios u where u.id = (select auth.uid()))
  );
alter policy criar on core.cargos
  with check ((select core.pode('admin.usuarios')));
alter policy editar on core.cargos
  using ((select core.pode('admin.usuarios')))
  with check ((select core.pode('admin.usuarios')));
alter policy apagar on core.cargos
  using ((select core.pode('admin.usuarios')));

alter policy ver on core.cargo_permissoes
  using (
    (select core.pode('admin.usuarios'))
    or cargo_id = (select u.cargo_id from core.usuarios u where u.id = (select auth.uid()))
  );
alter policy conceder on core.cargo_permissoes
  with check ((select core.pode('admin.usuarios')));
alter policy revogar on core.cargo_permissoes
  using ((select core.pode('admin.usuarios')));

alter policy editar on core.empresa
  using ((select core.pode('admin.empresa')))
  with check ((select core.pode('admin.empresa')));

alter policy ver on core.logs
  using ((select core.pode('admin.historico')));

alter policy ver on core.auditoria
  using (
    (select core.pode('admin.historico'))
    or case
      when tabela like 'rh.%' then (select core.pode('rh.parametros'))
      when tabela like 'os.%' then (select core.pode('os.historico'))
      when tabela = 'core.metas' then
        (select core.pode('rh.parametros'))
        or (select core.pode('financeiro.importacao_parametros'))
      when tabela in (
        'core.usuario_permissoes', 'core.usuarios', 'core.cargos', 'core.cargo_permissoes'
      ) then (select core.pode('admin.usuarios'))
      when tabela = 'core.empresa' then (select core.pode('admin.empresa'))
      when tabela = 'integracao.credenciais' then (select core.pode('admin.integracoes'))
      else false
    end
  );

-- O módulo vem da linha: os módulos conhecidos viram InitPlan; qualquer
-- outro cai na chamada por linha de antes.
alter policy ver on core.metas
  using (
    case split_part(indicador, '.', 1)
      when 'rh' then (select core.pode_modulo('rh'))
      when 'financeiro' then (select core.pode_modulo('financeiro'))
      when 'os' then (select core.pode_modulo('os'))
      else core.pode_modulo(split_part(indicador, '.', 1))
    end
  );
alter policy editar on core.metas
  using (
    (indicador like 'rh.%' and (select core.pode('rh.parametros')))
    or (indicador like 'financeiro.%' and (select core.pode('financeiro.importacao_parametros')))
  )
  with check (
    (indicador like 'rh.%' and (select core.pode('rh.parametros')))
    or (indicador like 'financeiro.%' and (select core.pode('financeiro.importacao_parametros')))
  );

-- O mesmo case de core.pode_importar(tipo), com cada permissão calculada
-- uma vez.
alter policy ver on core.importacoes
  using (
    case tipo
      when 'folha' then (select core.pode('rh.folha'))
      when 'plano_saude' then (select core.pode('rh.beneficios'))
    end
  );
alter policy enviar on core.importacoes
  with check (
    case tipo
      when 'folha' then (select core.pode('rh.folha'))
      when 'plano_saude' then (select core.pode('rh.beneficios'))
    end
    and enviado_por = (select auth.uid())
  );
alter policy atualizar on core.importacoes
  using (
    case tipo
      when 'folha' then (select core.pode('rh.folha'))
      when 'plano_saude' then (select core.pode('rh.beneficios'))
    end
  )
  with check (
    case tipo
      when 'folha' then (select core.pode('rh.folha'))
      when 'plano_saude' then (select core.pode('rh.beneficios'))
    end
  );

-- ---------------------------------------------------------------------------
-- financeiro
-- ---------------------------------------------------------------------------

alter policy ver on financeiro.estacionamento_movimento
  using (
    (select core.pode('financeiro.painel'))
    or (select core.pode('financeiro.fluxo_de_caixa'))
    or (select core.pode('financeiro.performance_capital'))
  );
alter policy ver on financeiro.estacionamento_pagamentos
  using (
    (select core.pode('financeiro.painel'))
    or (select core.pode('financeiro.fluxo_de_caixa'))
    or (select core.pode('financeiro.performance_capital'))
  );

-- integracao: RLS ligado e nenhuma política (só a service role). Nada muda.

-- ---------------------------------------------------------------------------
-- os: tabelas de cadastro e configuração (só permissão, nada da linha)
-- ---------------------------------------------------------------------------

alter policy ver on os.setores using ((select core.pode_modulo('os')));
alter policy editar on os.setores
  using ((select core.pode('os.catalogo'))) with check ((select core.pode('os.catalogo')));

alter policy ver on os.setor_membros using ((select core.pode_modulo('os')));
alter policy editar on os.setor_membros
  using ((select core.pode('os.catalogo'))) with check ((select core.pode('os.catalogo')));

alter policy ver on os.categorias using ((select core.pode_modulo('os')));
alter policy editar on os.categorias
  using ((select core.pode('os.catalogo'))) with check ((select core.pode('os.catalogo')));

alter policy ver on os.parametros using ((select core.pode_modulo('os')));
alter policy editar on os.parametros
  using ((select core.pode('os.parametros'))) with check ((select core.pode('os.parametros')));

alter policy ver on os.feriados using ((select core.pode_modulo('os')));
alter policy editar on os.feriados
  using ((select core.pode('os.parametros'))) with check ((select core.pode('os.parametros')));

alter policy ver on os.metas using ((select core.pode_modulo('os')));
alter policy editar on os.metas
  using ((select core.pode('os.parametros'))) with check ((select core.pode('os.parametros')));

alter policy ver on os.tecnicos using ((select core.pode_modulo('os')));
alter policy editar on os.tecnicos
  using ((select core.pode('os.parametros'))) with check ((select core.pode('os.parametros')));

alter policy ver on os.tecnico_valores
  using ((select core.pode('os.custos')) or (select core.pode('os.parametros')));
alter policy editar on os.tecnico_valores
  using ((select core.pode('os.parametros'))) with check ((select core.pode('os.parametros')));

alter policy ver on os.empresas using ((select core.pode_modulo('os')));
alter policy editar on os.empresas
  using ((select core.pode('os.terceirizados'))) with check ((select core.pode('os.terceirizados')));

alter policy ver on os.profissionais using ((select core.pode_modulo('os')));
alter policy editar on os.profissionais
  using ((select core.pode('os.terceirizados'))) with check ((select core.pode('os.terceirizados')));

alter policy ver on os.contatos using ((select core.pode('os.acessar')));
alter policy editar on os.contatos
  using ((select core.pode('os.parametros')) or (select core.pode('os.terceirizados')))
  with check ((select core.pode('os.parametros')) or (select core.pode('os.terceirizados')));

alter policy ver on os.lojas using ((select core.pode_modulo('os')));
alter policy editar on os.lojas
  using ((select core.pode('os.portal'))) with check ((select core.pode('os.portal')));

alter policy ver on os.agendas using ((select core.pode_modulo('os')));
alter policy editar on os.agendas
  using ((select core.pode('os.portal_agenda'))) with check ((select core.pode('os.portal_agenda')));

alter policy ver on os.agenda_bloqueios using ((select core.pode_modulo('os')));
alter policy editar on os.agenda_bloqueios
  using ((select core.pode('os.portal_agenda'))) with check ((select core.pode('os.portal_agenda')));

alter policy ver on os.agendamentos using ((select core.pode_modulo('os')));
alter policy editar on os.agendamentos
  using ((select core.pode('os.portal_agenda')) or criado_por = (select auth.uid()))
  with check ((select core.pode('os.portal_agenda')) or criado_por = (select auth.uid()));

alter policy ver on os.ativo_categorias using ((select core.pode_modulo('os')));
alter policy editar on os.ativo_categorias
  using ((select core.pode('os.ativos_gerenciar')) or (select core.pode('os.parametros')))
  with check ((select core.pode('os.ativos_gerenciar')) or (select core.pode('os.parametros')));

alter policy ver on os.ativos
  using ((select core.pode('os.ativos')) or (select core.pode('os.ativos_gerenciar')));
alter policy editar on os.ativos
  using ((select core.pode('os.ativos_gerenciar')))
  with check ((select core.pode('os.ativos_gerenciar')));

alter policy ver on os.ativo_situacoes
  using ((select core.pode('os.ativos')) or (select core.pode('os.ativos_gerenciar')));

alter policy ver on os.planos_preventivos
  using ((select core.pode('os.ativos')) or (select core.pode('os.ativos_gerenciar')));
alter policy editar on os.planos_preventivos
  using ((select core.pode('os.ativos_gerenciar')))
  with check ((select core.pode('os.ativos_gerenciar')));

alter policy ver on os.modelos using ((select core.pode_modulo('os')));
alter policy editar on os.modelos
  using ((select core.pode('os.modelos'))) with check ((select core.pode('os.modelos')));

alter policy ver on os.modelo_itens using ((select core.pode_modulo('os')));
alter policy editar on os.modelo_itens
  using ((select core.pode('os.modelos'))) with check ((select core.pode('os.modelos')));

alter policy ver on os.disparos using ((select core.pode_modulo('os')));

alter policy ver on os.vistorias using ((select core.pode('os.vistorias')));
alter policy editar on os.vistorias
  using ((select core.pode('os.vistorias'))) with check ((select core.pode('os.vistorias')));

alter policy ver on os.vistoria_ambientes using ((select core.pode('os.vistorias')));
alter policy editar on os.vistoria_ambientes
  using ((select core.pode('os.vistorias'))) with check ((select core.pode('os.vistorias')));

alter policy ver on os.material_valores using ((select core.pode('os.custos')));
alter policy editar on os.material_valores
  using ((select core.pode('os.custos'))) with check ((select core.pode('os.custos')));

alter policy ver on os.portal_links using ((select core.pode('os.portal')));
alter policy editar on os.portal_links
  using ((select core.pode('os.portal'))) with check ((select core.pode('os.portal')));

alter policy ver on os.importacoes using ((select core.pode('os.importacao')));
alter policy editar on os.importacoes
  using ((select core.pode('os.importacao'))) with check ((select core.pode('os.importacao')));

-- os.notificacoes já comparava só com (select auth.uid()).

-- ---------------------------------------------------------------------------
-- os.chamados
-- ---------------------------------------------------------------------------

-- Quem vê: a regra de os.ve_chamado, escrita sobre as colunas.
--   os.gerencia(setor) = gerenciar_setor e (todos_setores ou setor meu):
--   com todos_setores a linha já passa; sem, sobra "setor meu e
--   gerenciar_setor", que entra junto de meu_setor e painel_setor.
alter policy ver on os.chamados
  using (
    (select core.pode_modulo('os'))
    and (
      aberto_por = (select auth.uid())
      or responsavel_id = (select auth.uid())
      or (select core.pode('os.todos_setores'))
      or (select core.pode('os.painel_geral'))
      or (
        setor_id = any (array(select os.meus_setores()))
        and (
          responsavel_id is null
          or (select core.pode('os.meu_setor'))
          or (select core.pode('os.painel_setor'))
          or (select core.pode('os.gerenciar_setor'))
        )
      )
      or id in (select os.meus_chamados_envolvidos())
    )
  );

-- Quem mexe: a regra de os.edita_chamado (os.acessar, vê o chamado e está
-- ligado a ele). Aqui os.gerencia(setor) sobra só como "gerenciar_setor e
-- todos_setores": o caso do setor meu já é uma das opções.
alter policy editar on os.chamados
  using (
    (select core.pode('os.acessar'))
    and (select core.pode_modulo('os'))
    and (
      aberto_por = (select auth.uid())
      or responsavel_id = (select auth.uid())
      or (select core.pode('os.todos_setores'))
      or (select core.pode('os.painel_geral'))
      or (
        setor_id = any (array(select os.meus_setores()))
        and (
          responsavel_id is null
          or (select core.pode('os.meu_setor'))
          or (select core.pode('os.painel_setor'))
          or (select core.pode('os.gerenciar_setor'))
        )
      )
      or id in (select os.meus_chamados_envolvidos())
    )
    and (
      aberto_por = (select auth.uid())
      or responsavel_id = (select auth.uid())
      or setor_id = any (array(select os.meus_setores()))
      or ((select core.pode('os.gerenciar_setor')) and (select core.pode('os.todos_setores')))
      or id in (select os.meus_chamados_envolvidos())
      or (select core.pode('os.excluir'))
    )
  )
  with check ((select core.pode('os.acessar')));

-- Converter em OS consulta a original: continua com as funções security
-- definer (uma subconsulta em os.chamados aqui seria recursão). É insert de
-- uma linha.
alter policy abrir on os.chamados
  with check (
    (select core.pode('os.acessar'))
    and (
      aberto_por = (select auth.uid())
      or (
        convertido_de_id is not null
        and os.pode_editar_chamado(convertido_de_id)
        and aberto_por is not distinct from os.solicitante_de(convertido_de_id)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Filhas do chamado
-- Ver:   exists (select 1 from os.chamados c where c.id = <filha>.chamado_id)
--        (o RLS de os.chamados aplica a regra de ver).
-- Mexer: o mesmo exists com o resto de os.edita_chamado (os.acessar e
--        ligado ao chamado).
-- ---------------------------------------------------------------------------

-- os.destinatarios
alter policy ver on os.destinatarios
  using (exists (select 1 from os.chamados c where c.id = destinatarios.chamado_id));
drop policy editar on os.destinatarios;
create policy incluir on os.destinatarios for insert to authenticated
  with check (exists (
    select 1 from os.chamados c
    where c.id = destinatarios.chamado_id
      and (select core.pode('os.acessar'))
      and (
        c.aberto_por = (select auth.uid())
        or c.responsavel_id = (select auth.uid())
        or c.setor_id = any (array(select os.meus_setores()))
        or ((select core.pode('os.gerenciar_setor')) and (select core.pode('os.todos_setores')))
        or c.id in (select os.meus_chamados_envolvidos())
        or (select core.pode('os.excluir'))
      )
  ));
create policy editar on os.destinatarios for update to authenticated
  using (exists (
    select 1 from os.chamados c
    where c.id = destinatarios.chamado_id
      and (select core.pode('os.acessar'))
      and (
        c.aberto_por = (select auth.uid())
        or c.responsavel_id = (select auth.uid())
        or c.setor_id = any (array(select os.meus_setores()))
        or ((select core.pode('os.gerenciar_setor')) and (select core.pode('os.todos_setores')))
        or c.id in (select os.meus_chamados_envolvidos())
        or (select core.pode('os.excluir'))
      )
  ))
  with check (exists (
    select 1 from os.chamados c
    where c.id = destinatarios.chamado_id
      and (select core.pode('os.acessar'))
      and (
        c.aberto_por = (select auth.uid())
        or c.responsavel_id = (select auth.uid())
        or c.setor_id = any (array(select os.meus_setores()))
        or ((select core.pode('os.gerenciar_setor')) and (select core.pode('os.todos_setores')))
        or c.id in (select os.meus_chamados_envolvidos())
        or (select core.pode('os.excluir'))
      )
  ));
create policy remover on os.destinatarios for delete to authenticated
  using (exists (
    select 1 from os.chamados c
    where c.id = destinatarios.chamado_id
      and (select core.pode('os.acessar'))
      and (
        c.aberto_por = (select auth.uid())
        or c.responsavel_id = (select auth.uid())
        or c.setor_id = any (array(select os.meus_setores()))
        or ((select core.pode('os.gerenciar_setor')) and (select core.pode('os.todos_setores')))
        or c.id in (select os.meus_chamados_envolvidos())
        or (select core.pode('os.excluir'))
      )
  ));

-- os.participantes: quem vê o chamado cita e descita.
alter policy ver on os.participantes
  using (exists (select 1 from os.chamados c where c.id = participantes.chamado_id));
drop policy editar on os.participantes;
create policy incluir on os.participantes for insert to authenticated
  with check (exists (select 1 from os.chamados c where c.id = participantes.chamado_id));
create policy editar on os.participantes for update to authenticated
  using (exists (select 1 from os.chamados c where c.id = participantes.chamado_id))
  with check (exists (select 1 from os.chamados c where c.id = participantes.chamado_id));
create policy remover on os.participantes for delete to authenticated
  using (exists (select 1 from os.chamados c where c.id = participantes.chamado_id));

-- os.eventos: só cresce.
alter policy ver on os.eventos
  using (exists (select 1 from os.chamados c where c.id = eventos.chamado_id));
alter policy registrar on os.eventos
  with check (
    exists (select 1 from os.chamados c where c.id = eventos.chamado_id)
    and (autor_id is null or autor_id = (select auth.uid()))
  );

-- os.anexos
alter policy ver on os.anexos
  using (
    (chamado_id is not null
      and exists (select 1 from os.chamados c where c.id = anexos.chamado_id))
    or ((vistoria_id is not null or ambiente_id is not null) and (select core.pode('os.vistorias')))
    or (ativo_id is not null
      and ((select core.pode('os.ativos')) or (select core.pode('os.ativos_gerenciar'))))
  );
alter policy enviar on os.anexos
  with check (
    (chamado_id is not null and exists (
      select 1 from os.chamados c
      where c.id = anexos.chamado_id
        and (select core.pode('os.acessar'))
        and (
          c.aberto_por = (select auth.uid())
          or c.responsavel_id = (select auth.uid())
          or c.setor_id = any (array(select os.meus_setores()))
          or ((select core.pode('os.gerenciar_setor')) and (select core.pode('os.todos_setores')))
          or c.id in (select os.meus_chamados_envolvidos())
          or (select core.pode('os.excluir'))
        )
    ))
    or ((vistoria_id is not null or ambiente_id is not null) and (select core.pode('os.vistorias')))
    or (ativo_id is not null and (select core.pode('os.ativos_gerenciar')))
  );
alter policy remover on os.anexos
  using (
    enviado_por = (select auth.uid())
    or ((vistoria_id is not null or ambiente_id is not null) and (select core.pode('os.vistorias')))
    or (ativo_id is not null and (select core.pode('os.ativos_gerenciar')))
  );

-- os.sessoes
alter policy ver on os.sessoes
  using (exists (select 1 from os.chamados c where c.id = sessoes.chamado_id));
drop policy editar on os.sessoes;
create policy incluir on os.sessoes for insert to authenticated
  with check (exists (
    select 1 from os.chamados c
    where c.id = sessoes.chamado_id
      and (select core.pode('os.acessar'))
      and (
        c.aberto_por = (select auth.uid())
        or c.responsavel_id = (select auth.uid())
        or c.setor_id = any (array(select os.meus_setores()))
        or ((select core.pode('os.gerenciar_setor')) and (select core.pode('os.todos_setores')))
        or c.id in (select os.meus_chamados_envolvidos())
        or (select core.pode('os.excluir'))
      )
  ));
create policy editar on os.sessoes for update to authenticated
  using (exists (
    select 1 from os.chamados c
    where c.id = sessoes.chamado_id
      and (select core.pode('os.acessar'))
      and (
        c.aberto_por = (select auth.uid())
        or c.responsavel_id = (select auth.uid())
        or c.setor_id = any (array(select os.meus_setores()))
        or ((select core.pode('os.gerenciar_setor')) and (select core.pode('os.todos_setores')))
        or c.id in (select os.meus_chamados_envolvidos())
        or (select core.pode('os.excluir'))
      )
  ))
  with check (exists (
    select 1 from os.chamados c
    where c.id = sessoes.chamado_id
      and (select core.pode('os.acessar'))
      and (
        c.aberto_por = (select auth.uid())
        or c.responsavel_id = (select auth.uid())
        or c.setor_id = any (array(select os.meus_setores()))
        or ((select core.pode('os.gerenciar_setor')) and (select core.pode('os.todos_setores')))
        or c.id in (select os.meus_chamados_envolvidos())
        or (select core.pode('os.excluir'))
      )
  ));
create policy remover on os.sessoes for delete to authenticated
  using (exists (
    select 1 from os.chamados c
    where c.id = sessoes.chamado_id
      and (select core.pode('os.acessar'))
      and (
        c.aberto_por = (select auth.uid())
        or c.responsavel_id = (select auth.uid())
        or c.setor_id = any (array(select os.meus_setores()))
        or ((select core.pode('os.gerenciar_setor')) and (select core.pode('os.todos_setores')))
        or c.id in (select os.meus_chamados_envolvidos())
        or (select core.pode('os.excluir'))
      )
  ));

-- os.sessao_tecnicos: pela sessão (que também passa pelo RLS dela).
alter policy ver on os.sessao_tecnicos
  using (exists (
    select 1 from os.sessoes s
    join os.chamados c on c.id = s.chamado_id
    where s.id = sessao_tecnicos.sessao_id
  ));
drop policy editar on os.sessao_tecnicos;
create policy incluir on os.sessao_tecnicos for insert to authenticated
  with check (exists (
    select 1 from os.sessoes s
    join os.chamados c on c.id = s.chamado_id
    where s.id = sessao_tecnicos.sessao_id
      and (select core.pode('os.acessar'))
      and (
        c.aberto_por = (select auth.uid())
        or c.responsavel_id = (select auth.uid())
        or c.setor_id = any (array(select os.meus_setores()))
        or ((select core.pode('os.gerenciar_setor')) and (select core.pode('os.todos_setores')))
        or c.id in (select os.meus_chamados_envolvidos())
        or (select core.pode('os.excluir'))
      )
  ));
create policy editar on os.sessao_tecnicos for update to authenticated
  using (exists (
    select 1 from os.sessoes s
    join os.chamados c on c.id = s.chamado_id
    where s.id = sessao_tecnicos.sessao_id
      and (select core.pode('os.acessar'))
      and (
        c.aberto_por = (select auth.uid())
        or c.responsavel_id = (select auth.uid())
        or c.setor_id = any (array(select os.meus_setores()))
        or ((select core.pode('os.gerenciar_setor')) and (select core.pode('os.todos_setores')))
        or c.id in (select os.meus_chamados_envolvidos())
        or (select core.pode('os.excluir'))
      )
  ))
  with check (exists (
    select 1 from os.sessoes s
    join os.chamados c on c.id = s.chamado_id
    where s.id = sessao_tecnicos.sessao_id
      and (select core.pode('os.acessar'))
      and (
        c.aberto_por = (select auth.uid())
        or c.responsavel_id = (select auth.uid())
        or c.setor_id = any (array(select os.meus_setores()))
        or ((select core.pode('os.gerenciar_setor')) and (select core.pode('os.todos_setores')))
        or c.id in (select os.meus_chamados_envolvidos())
        or (select core.pode('os.excluir'))
      )
  ));
create policy remover on os.sessao_tecnicos for delete to authenticated
  using (exists (
    select 1 from os.sessoes s
    join os.chamados c on c.id = s.chamado_id
    where s.id = sessao_tecnicos.sessao_id
      and (select core.pode('os.acessar'))
      and (
        c.aberto_por = (select auth.uid())
        or c.responsavel_id = (select auth.uid())
        or c.setor_id = any (array(select os.meus_setores()))
        or ((select core.pode('os.gerenciar_setor')) and (select core.pode('os.todos_setores')))
        or c.id in (select os.meus_chamados_envolvidos())
        or (select core.pode('os.excluir'))
      )
  ));

-- os.materiais
alter policy ver on os.materiais
  using (exists (select 1 from os.chamados c where c.id = materiais.chamado_id));
drop policy editar on os.materiais;
create policy incluir on os.materiais for insert to authenticated
  with check (exists (
    select 1 from os.chamados c
    where c.id = materiais.chamado_id
      and (select core.pode('os.acessar'))
      and (
        c.aberto_por = (select auth.uid())
        or c.responsavel_id = (select auth.uid())
        or c.setor_id = any (array(select os.meus_setores()))
        or ((select core.pode('os.gerenciar_setor')) and (select core.pode('os.todos_setores')))
        or c.id in (select os.meus_chamados_envolvidos())
        or (select core.pode('os.excluir'))
      )
  ));
create policy editar on os.materiais for update to authenticated
  using (exists (
    select 1 from os.chamados c
    where c.id = materiais.chamado_id
      and (select core.pode('os.acessar'))
      and (
        c.aberto_por = (select auth.uid())
        or c.responsavel_id = (select auth.uid())
        or c.setor_id = any (array(select os.meus_setores()))
        or ((select core.pode('os.gerenciar_setor')) and (select core.pode('os.todos_setores')))
        or c.id in (select os.meus_chamados_envolvidos())
        or (select core.pode('os.excluir'))
      )
  ))
  with check (exists (
    select 1 from os.chamados c
    where c.id = materiais.chamado_id
      and (select core.pode('os.acessar'))
      and (
        c.aberto_por = (select auth.uid())
        or c.responsavel_id = (select auth.uid())
        or c.setor_id = any (array(select os.meus_setores()))
        or ((select core.pode('os.gerenciar_setor')) and (select core.pode('os.todos_setores')))
        or c.id in (select os.meus_chamados_envolvidos())
        or (select core.pode('os.excluir'))
      )
  ));
create policy remover on os.materiais for delete to authenticated
  using (exists (
    select 1 from os.chamados c
    where c.id = materiais.chamado_id
      and (select core.pode('os.acessar'))
      and (
        c.aberto_por = (select auth.uid())
        or c.responsavel_id = (select auth.uid())
        or c.setor_id = any (array(select os.meus_setores()))
        or ((select core.pode('os.gerenciar_setor')) and (select core.pode('os.todos_setores')))
        or c.id in (select os.meus_chamados_envolvidos())
        or (select core.pode('os.excluir'))
      )
  ));

-- os.os_custos: dinheiro, só com os.custos.
alter policy ver on os.os_custos
  using (
    (select core.pode('os.custos'))
    and exists (select 1 from os.chamados c where c.id = os_custos.chamado_id)
  );
drop policy editar on os.os_custos;
create policy incluir on os.os_custos for insert to authenticated
  with check ((select core.pode('os.custos')) and exists (
    select 1 from os.chamados c
    where c.id = os_custos.chamado_id
      and (select core.pode('os.acessar'))
      and (
        c.aberto_por = (select auth.uid())
        or c.responsavel_id = (select auth.uid())
        or c.setor_id = any (array(select os.meus_setores()))
        or ((select core.pode('os.gerenciar_setor')) and (select core.pode('os.todos_setores')))
        or c.id in (select os.meus_chamados_envolvidos())
        or (select core.pode('os.excluir'))
      )
  ));
create policy editar on os.os_custos for update to authenticated
  using ((select core.pode('os.custos')) and exists (
    select 1 from os.chamados c
    where c.id = os_custos.chamado_id
      and (select core.pode('os.acessar'))
      and (
        c.aberto_por = (select auth.uid())
        or c.responsavel_id = (select auth.uid())
        or c.setor_id = any (array(select os.meus_setores()))
        or ((select core.pode('os.gerenciar_setor')) and (select core.pode('os.todos_setores')))
        or c.id in (select os.meus_chamados_envolvidos())
        or (select core.pode('os.excluir'))
      )
  ))
  with check ((select core.pode('os.custos')) and exists (
    select 1 from os.chamados c
    where c.id = os_custos.chamado_id
      and (select core.pode('os.acessar'))
      and (
        c.aberto_por = (select auth.uid())
        or c.responsavel_id = (select auth.uid())
        or c.setor_id = any (array(select os.meus_setores()))
        or ((select core.pode('os.gerenciar_setor')) and (select core.pode('os.todos_setores')))
        or c.id in (select os.meus_chamados_envolvidos())
        or (select core.pode('os.excluir'))
      )
  ));
create policy remover on os.os_custos for delete to authenticated
  using ((select core.pode('os.custos')) and exists (
    select 1 from os.chamados c
    where c.id = os_custos.chamado_id
      and (select core.pode('os.acessar'))
      and (
        c.aberto_por = (select auth.uid())
        or c.responsavel_id = (select auth.uid())
        or c.setor_id = any (array(select os.meus_setores()))
        or ((select core.pode('os.gerenciar_setor')) and (select core.pode('os.todos_setores')))
        or c.id in (select os.meus_chamados_envolvidos())
        or (select core.pode('os.excluir'))
      )
  ));

-- os.chamado_profissionais
alter policy ver on os.chamado_profissionais
  using (exists (select 1 from os.chamados c where c.id = chamado_profissionais.chamado_id));
drop policy editar on os.chamado_profissionais;
create policy incluir on os.chamado_profissionais for insert to authenticated
  with check (exists (
    select 1 from os.chamados c
    where c.id = chamado_profissionais.chamado_id
      and (select core.pode('os.acessar'))
      and (
        c.aberto_por = (select auth.uid())
        or c.responsavel_id = (select auth.uid())
        or c.setor_id = any (array(select os.meus_setores()))
        or ((select core.pode('os.gerenciar_setor')) and (select core.pode('os.todos_setores')))
        or c.id in (select os.meus_chamados_envolvidos())
        or (select core.pode('os.excluir'))
      )
  ));
create policy editar on os.chamado_profissionais for update to authenticated
  using (exists (
    select 1 from os.chamados c
    where c.id = chamado_profissionais.chamado_id
      and (select core.pode('os.acessar'))
      and (
        c.aberto_por = (select auth.uid())
        or c.responsavel_id = (select auth.uid())
        or c.setor_id = any (array(select os.meus_setores()))
        or ((select core.pode('os.gerenciar_setor')) and (select core.pode('os.todos_setores')))
        or c.id in (select os.meus_chamados_envolvidos())
        or (select core.pode('os.excluir'))
      )
  ))
  with check (exists (
    select 1 from os.chamados c
    where c.id = chamado_profissionais.chamado_id
      and (select core.pode('os.acessar'))
      and (
        c.aberto_por = (select auth.uid())
        or c.responsavel_id = (select auth.uid())
        or c.setor_id = any (array(select os.meus_setores()))
        or ((select core.pode('os.gerenciar_setor')) and (select core.pode('os.todos_setores')))
        or c.id in (select os.meus_chamados_envolvidos())
        or (select core.pode('os.excluir'))
      )
  ));
create policy remover on os.chamado_profissionais for delete to authenticated
  using (exists (
    select 1 from os.chamados c
    where c.id = chamado_profissionais.chamado_id
      and (select core.pode('os.acessar'))
      and (
        c.aberto_por = (select auth.uid())
        or c.responsavel_id = (select auth.uid())
        or c.setor_id = any (array(select os.meus_setores()))
        or ((select core.pode('os.gerenciar_setor')) and (select core.pode('os.todos_setores')))
        or c.id in (select os.meus_chamados_envolvidos())
        or (select core.pode('os.excluir'))
      )
  ));

-- os.terceirizado_links: o token é segredo; quem gerencia terceirizados ou
-- mexe na OS. A política de edição (for all, só os.terceirizados) não muda:
-- ela não depende da linha.
alter policy ver on os.terceirizado_links
  using (
    (select core.pode('os.terceirizados'))
    or exists (
      select 1 from os.chamados c
      where c.id = terceirizado_links.chamado_id
        and (select core.pode('os.acessar'))
        and (
          c.aberto_por = (select auth.uid())
          or c.responsavel_id = (select auth.uid())
          or c.setor_id = any (array(select os.meus_setores()))
          or ((select core.pode('os.gerenciar_setor')) and (select core.pode('os.todos_setores')))
          or c.id in (select os.meus_chamados_envolvidos())
          or (select core.pode('os.excluir'))
        )
    )
  );
alter policy editar on os.terceirizado_links
  using ((select core.pode('os.terceirizados')))
  with check ((select core.pode('os.terceirizados')));

-- ---------------------------------------------------------------------------
-- Índices
-- Já existiam: chamados (setor_id, status), (responsavel_id, status),
-- (aberto_por, status), (criado_em desc), prazo dos abertos, concluido_em,
-- fechado_em, loja, ativo; destinatarios (chamado_id), (setor_id),
-- (usuario_id); participantes (usuario_id) e a chave (chamado_id, usuario_id);
-- setor_membros (usuario_id); usuario_permissoes e cargo_permissoes pela
-- chave (usuario_id, ...) e (cargo_id, ...); usuarios (cargo_id).
-- Chave estrangeira para usuário costuma ficar vazia: índice parcial (o
-- `on delete` busca `coluna = id`, que o parcial atende).
-- ---------------------------------------------------------------------------

-- os.chamados: listas (sempre fora da lixeira), ordem e cartões.
create index chamados_lista_criado on os.chamados (criado_em desc, id)
  where lixeira_em is null;
create index chamados_lista_prazo on os.chamados (prazo, id)
  where lixeira_em is null;
create index chamados_lista_status on os.chamados (status, prazo)
  where lixeira_em is null;
create index chamados_lixeira on os.chamados (lixeira_em desc)
  where lixeira_em is not null;
create index chamados_cancelado on os.chamados (cancelado_em)
  where cancelado_em is not null;
create index chamados_visita on os.chamados (visita_data)
  where visita_data is not null;
-- os.chamados: chaves estrangeiras.
create index chamados_categoria on os.chamados (categoria_id);
create index chamados_empresa on os.chamados (empresa_id) where empresa_id is not null;
create index chamados_vistoria on os.chamados (vistoria_id) where vistoria_id is not null;
create index chamados_ambiente on os.chamados (ambiente_id) where ambiente_id is not null;
create index chamados_vinculado_a on os.chamados (vinculado_a_id) where vinculado_a_id is not null;
create index chamados_convertido_de on os.chamados (convertido_de_id) where convertido_de_id is not null;
create index chamados_convertido_em on os.chamados (convertido_em_id) where convertido_em_id is not null;
create index chamados_concluido_por on os.chamados (concluido_por) where concluido_por is not null;
create index chamados_fechado_por on os.chamados (fechado_por) where fechado_por is not null;
create index chamados_cancelado_por on os.chamados (cancelado_por) where cancelado_por is not null;
create index chamados_lixeira_por on os.chamados (lixeira_por) where lixeira_por is not null;

-- Filhas do chamado.
create index destinatarios_responsavel on os.destinatarios (responsavel_id)
  where responsavel_id is not null;
create index destinatarios_concluido_por on os.destinatarios (concluido_por)
  where concluido_por is not null;
create index eventos_autor on os.eventos (autor_id) where autor_id is not null;
create index anexos_vistoria on os.anexos (vistoria_id) where vistoria_id is not null;
create index anexos_evento on os.anexos (evento_id) where evento_id is not null;
create index anexos_enviado_por on os.anexos (enviado_por) where enviado_por is not null;
create index sessoes_criado_por on os.sessoes (criado_por) where criado_por is not null;
create index materiais_criado_por on os.materiais (criado_por) where criado_por is not null;
create index os_custos_aprovado_por on os.os_custos (orcamento_aprovado_por)
  where orcamento_aprovado_por is not null;
create index chamado_profissionais_profissional on os.chamado_profissionais (profissional_id);
create index terceirizado_links_empresa on os.terceirizado_links (empresa_id)
  where empresa_id is not null;
create index terceirizado_links_criado_por on os.terceirizado_links (criado_por)
  where criado_por is not null;
create index terceirizado_links_criado_em on os.terceirizado_links (criado_em);
create index agendamentos_chamado on os.agendamentos (chamado_id) where chamado_id is not null;
create index agendamentos_loja on os.agendamentos (loja_id) where loja_id is not null;
create index agendamentos_criado_por on os.agendamentos (criado_por) where criado_por is not null;
create index agendamentos_inicio on os.agendamentos (inicio);
create index disparos_chamado on os.disparos (chamado_id) where chamado_id is not null;
create index disparos_loja on os.disparos (loja_id);
create index disparos_disparado_por on os.disparos (disparado_por) where disparado_por is not null;
create index notificacoes_chamado on os.notificacoes (chamado_id) where chamado_id is not null;

-- Cadastros do módulo.
create index categorias_pai on os.categorias (pai_id) where pai_id is not null;
create index categorias_agenda on os.categorias (agenda_id) where agenda_id is not null;
create index categorias_responsavel_padrao on os.categorias (responsavel_padrao_id)
  where responsavel_padrao_id is not null;
create index metas_categoria on os.metas (categoria_id) where categoria_id is not null;
create index tecnicos_setor on os.tecnicos (setor_id) where setor_id is not null;
create index profissionais_empresa on os.profissionais (empresa_id);
create index ativos_fornecedor on os.ativos (fornecedor_id) where fornecedor_id is not null;
create index ativos_loja on os.ativos (loja_id) where loja_id is not null;
create index ativos_responsavel on os.ativos (responsavel_id) where responsavel_id is not null;
create index ativos_setor on os.ativos (setor_id) where setor_id is not null;
create index planos_preventivos_categoria on os.planos_preventivos (categoria_id)
  where categoria_id is not null;
create index planos_preventivos_responsavel on os.planos_preventivos (responsavel_id)
  where responsavel_id is not null;
create index planos_preventivos_setor on os.planos_preventivos (setor_id);
create index planos_preventivos_proxima on os.planos_preventivos (proxima_data) where ativo;
create index modelo_itens_modelo on os.modelo_itens (modelo_id);
create index modelo_itens_categoria on os.modelo_itens (categoria_id) where categoria_id is not null;
create index modelo_itens_responsavel on os.modelo_itens (responsavel_id)
  where responsavel_id is not null;
create index modelo_itens_setor on os.modelo_itens (setor_id) where setor_id is not null;
create index vistorias_criado_por on os.vistorias (criado_por) where criado_por is not null;
create index vistorias_entrada on os.vistorias (entrada_id) where entrada_id is not null;
create index vistorias_loja on os.vistorias (loja_id) where loja_id is not null;
create index vistorias_vistoriador on os.vistorias (vistoriador_id) where vistoriador_id is not null;
create index vistorias_data on os.vistorias (data);
create index vistoria_ambientes_entrada on os.vistoria_ambientes (entrada_ambiente_id)
  where entrada_ambiente_id is not null;
create index portal_links_criado_por on os.portal_links (criado_por) where criado_por is not null;
create index portal_links_cancelado_por on os.portal_links (cancelado_por)
  where cancelado_por is not null;
create index agenda_bloqueios_agenda on os.agenda_bloqueios (agenda_id);
create index agenda_bloqueios_criado_por on os.agenda_bloqueios (criado_por)
  where criado_por is not null;
create index importacoes_enviado_por on os.importacoes (enviado_por) where enviado_por is not null;
create index importacoes_confirmado_por on os.importacoes (confirmado_por)
  where confirmado_por is not null;
create index importacoes_desfeito_por on os.importacoes (desfeito_por) where desfeito_por is not null;

-- core
create index usuario_permissoes_permissao on core.usuario_permissoes (permissao);
create index usuario_permissoes_concedida_por on core.usuario_permissoes (concedida_por)
  where concedida_por is not null;
create index cargo_permissoes_permissao on core.cargo_permissoes (permissao);
create index importacoes_enviado_por on core.importacoes (enviado_por) where enviado_por is not null;
create index importacoes_confirmado_por on core.importacoes (confirmado_por)
  where confirmado_por is not null;

-- integracao e financeiro: execução da sincronização que gravou a linha.
create index registros_brutos_sync_run on integracao.registros_brutos (sync_run_id)
  where sync_run_id is not null;
create index credenciais_configurado_por on integracao.credenciais (configurado_por)
  where configurado_por is not null;
create index estacionamento_movimento_sync_run on financeiro.estacionamento_movimento (sync_run_id)
  where sync_run_id is not null;
create index estacionamento_pagamentos_sync_run on financeiro.estacionamento_pagamentos (sync_run_id)
  where sync_run_id is not null;
