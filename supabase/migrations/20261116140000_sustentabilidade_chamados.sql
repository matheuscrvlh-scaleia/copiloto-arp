-- Categorias dos chamados que o Módulo Sustentabilidade cria pelo sistema
-- (src/server/sustentabilidade/rotinas.ts, categoriaDoModulo). Todas sem
-- confirmação do solicitante: quem conclui é o próprio módulo, ao salvar o
-- trabalho (conclusao_externa), ou a equipe, num chamado que ninguém pediu.
-- O prazo vem do módulo (data prevista, validade, dia da cobrança); só o
-- recolhimento de coletor usa o prazo da categoria.
--
-- "Entrevista de cliente" (dados iniciais do Chamados) vira "Entrevista de
-- resíduos", o nome do spec (4.4): o item do modelo de entrada que a usava
-- saiu em 20261116120000_os_modulos_externos.sql, e os chamados antigos
-- dessa categoria passam a mostrar o nome novo. Se alguém já criou à mão
-- uma "Entrevista de resíduos", ela é a que vale e a antiga fica como está.

update os.categorias c
set nome = 'Entrevista de resíduos', icone = 'messages-square'
from os.setores s
where s.id = c.setor_id
  and s.nome = 'Sustentabilidade'
  and c.pai_id is null
  and c.nome = 'Entrevista de cliente'
  and not exists (
    select 1 from os.categorias x
    where x.setor_id = s.id and x.pai_id is null and x.nome = 'Entrevista de resíduos'
  );

insert into os.categorias (
  setor_id, nome, icone, ordem, tipo_padrao, prioridade_padrao, prazo_valor,
  prazo_unidade, vincular_loja, precisa_confirmacao
)
select s.id, c.nome, c.icone, c.ordem, 'tarefa', 'media', c.prazo,
  'dias_uteis', c.loja, false
from (values
  ('Sustentabilidade', 'Entrevista de resíduos', 'messages-square', 1, null::int, true),
  ('Sustentabilidade', 'Ronda dos coletores', 'recycle', 2, null, false),
  ('Sustentabilidade', 'Lançar nota do RCC', 'receipt', 3, null, false),
  ('Sustentabilidade', 'Renovar termo do Clube', 'file-pen', 4, null, false),
  ('Sustentabilidade', 'Cobrar lançamento do parceiro', 'alarm-clock', 5, null, false),
  ('Sustentabilidade', 'Relatório de Sustentabilidade do mês', 'file-text', 6, null, false),
  -- Coletor acima do limite: quem recolhe é Operações (o setor de destino
  -- do chamado vem dos Parâmetros do módulo; a categoria fica em Operações).
  ('Operações', 'Recolhimento de coletor', 'trash-2', 20, 1, false)
) as c(setor, nome, icone, ordem, prazo, loja)
join os.setores s on s.nome = c.setor
where not exists (
  select 1 from os.categorias x
  where x.setor_id = s.id and x.pai_id is null and x.nome = c.nome
);

-- Sem Operações (base nova sem os dados iniciais), o recolhimento fica em
-- Sustentabilidade.
insert into os.categorias (
  setor_id, nome, icone, ordem, tipo_padrao, prioridade_padrao, prazo_valor,
  prazo_unidade, precisa_confirmacao
)
select s.id, 'Recolhimento de coletor', 'trash-2', 7, 'tarefa', 'media', 1,
  'dias_uteis', false
from os.setores s
where s.nome = 'Sustentabilidade'
  and not exists (select 1 from os.setores o where o.nome = 'Operações')
  and not exists (
    select 1 from os.categorias x
    where x.setor_id = s.id and x.pai_id is null and x.nome = 'Recolhimento de coletor'
  );

-- As que já existiam (a entrevista renomeada, alguma criada à mão) também
-- ficam sem confirmação e como tarefa.
update os.categorias c
set precisa_confirmacao = false, tipo_padrao = 'tarefa'
from os.setores s
where s.id = c.setor_id
  and c.pai_id is null
  and (
    (s.nome = 'Sustentabilidade' and c.nome in (
      'Entrevista de resíduos', 'Ronda dos coletores', 'Lançar nota do RCC',
      'Renovar termo do Clube', 'Cobrar lançamento do parceiro',
      'Relatório de Sustentabilidade do mês', 'Recolhimento de coletor'))
    or (s.nome = 'Operações' and c.nome = 'Recolhimento de coletor')
  );
