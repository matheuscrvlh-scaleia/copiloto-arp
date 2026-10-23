-- os: permissões, ligação com o histórico do sistema e o ponto de partida
-- do catálogo (setores, categorias, agenda do telhado, modelos de entrada e
-- saída, textos padrão do laudo). Tudo editável nas telas; os setores e
-- categorias são a proposta da especificação, a validar com cada setor.

-- ---------------------------------------------------------------------------
-- Permissões (mesmo catálogo de src/lib/permissions.ts)
-- ---------------------------------------------------------------------------

insert into core.permissoes (codigo, descricao) values
  ('os.acessar', 'Abrir chamados e ver Minha caixa, Abertos por mim, Quadro e Calendário do que é seu'),
  ('os.meu_setor', 'Ver a tela Meu setor e todos os chamados do seu setor'),
  ('os.todos_setores', 'Ver os chamados de todos os setores'),
  ('os.gerenciar_setor', 'Trocar responsável, prazo e prioridade e cancelar chamados do setor'),
  ('os.excluir', 'Mandar chamados para a lixeira e restaurar'),
  ('os.catalogo', 'Configurar setores, categorias, prazos, campos extras e o que aparece no portal'),
  ('os.modelos', 'Configurar os modelos de entrada e saída de cliente e os lembretes'),
  ('os.custos', 'Ver valor por minuto, mão de obra, materiais, custo total e rateio'),
  ('os.terceirizados', 'Cadastrar terceirizados e enviar ou cancelar o link da OS'),
  ('os.ativos', 'Ver ativos, ficha e histórico de manutenção'),
  ('os.ativos_gerenciar', 'Cadastrar, editar e dar baixa em ativos, planos preventivos e etiquetas'),
  ('os.vistorias', 'Criar, editar e emitir o laudo de vistoria'),
  ('os.portal', 'Gerar, reenviar e cancelar o link do portal de cada loja'),
  ('os.portal_agenda', 'Configurar horários, limites e bloqueios das agendas'),
  ('os.painel_setor', 'Ver o painel do seu setor'),
  ('os.painel_geral', 'Ver o painel geral e o de qualquer setor'),
  ('os.exportar', 'Exportar Excel e PDF das telas de chamados e OS'),
  ('os.parametros', 'Editar técnicos e valor por minuto, rateio, faixas do sinal, prazos e metas'),
  ('os.importacao', 'Rodar e desfazer a importação do sistema de OS atual'),
  ('os.historico', 'Ver quem alterou o quê e quando nos chamados e parâmetros');

-- O Administrador tem tudo; a Diretoria acompanha todos os setores.
insert into core.cargo_permissoes (cargo_id, permissao)
  select c.id, p.codigo
  from core.cargos c
  join core.permissoes p on p.codigo like 'os.%'
  where c.nome = 'Administrador'
on conflict do nothing;

insert into core.cargo_permissoes (cargo_id, permissao)
  select c.id, p.codigo
  from core.cargos c
  join core.permissoes p on p.codigo in (
    'os.acessar', 'os.todos_setores', 'os.painel_geral', 'os.custos',
    'os.ativos', 'os.exportar'
  )
  where c.nome = 'Diretoria'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Histórico do sistema: o módulo entra na auditoria e nos eventos
-- ---------------------------------------------------------------------------

alter table core.logs drop constraint logs_modulo_check;
alter table core.logs add constraint logs_modulo_check
  check (modulo in ('acesso', 'admin', 'rh', 'financeiro', 'integracoes', 'os'));

create or replace function core.modulo_da_auditoria(p_tabela text, p_linha jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_tabela like 'rh.%' then 'rh'
    when p_tabela like 'financeiro.%' then 'financeiro'
    when p_tabela like 'os.%' then 'os'
    when p_tabela like 'integracao.%' then 'integracoes'
    when p_tabela = 'core.metas' then
      case split_part(p_linha ->> 'indicador', '.', 1)
        when 'rh' then 'rh' when 'financeiro' then 'financeiro' else 'admin'
      end
    when p_tabela = 'core.importacoes' then
      case when p_linha ->> 'tipo' in ('folha', 'plano_saude') then 'rh' else 'financeiro' end
    else 'admin'
  end;
$$;

drop policy ver on core.auditoria;
create policy ver on core.auditoria for select to authenticated
  using (
    core.pode('admin.historico')
    or case
      when tabela like 'rh.%' then core.pode('rh.parametros')
      when tabela like 'os.%' then core.pode('os.historico')
      when tabela = 'core.metas' then core.pode('rh.parametros') or core.pode('financeiro.importacao_parametros')
      when tabela in ('core.usuario_permissoes', 'core.usuarios', 'core.cargos', 'core.cargo_permissoes')
        then core.pode('admin.usuarios')
      when tabela = 'core.empresa' then core.pode('admin.empresa')
      when tabela = 'integracao.credenciais' then core.pode('admin.integracoes')
      else false
    end
  );

-- ---------------------------------------------------------------------------
-- Setores (os do levantamento) e agenda do telhado
-- ---------------------------------------------------------------------------

insert into os.setores (nome, cor, icone, ordem) values
  ('Operações', '#2a78d6', 'wrench', 1),
  ('Comercial', '#eb6834', 'handshake', 2),
  ('Marketing', '#e87ba4', 'megaphone', 3),
  ('Sustentabilidade', '#1baf7a', 'leaf', 4),
  ('Estacionamento', '#eda100', 'car', 5),
  ('Financeiro', '#7c5cd6', 'wallet', 6),
  ('Gestão', '#525252', 'briefcase', 7);

insert into os.agendas (nome, hora_inicio, hora_fim, duracao_min, limite_por_dia, dias_semana, orientacao)
values (
  'Telhado', '07:00', '11:00', 60, 2, '{1,2,3,4,5,6}',
  'O acesso ao telhado é acompanhado pela equipe de Operações. Chegue no horário marcado.'
);

-- ---------------------------------------------------------------------------
-- Catálogo de partida (4.5): os tipos de serviço do sistema atual viram as
-- categorias de Operações na importação; estas são a base para começar.
-- ---------------------------------------------------------------------------

insert into os.categorias (
  setor_id, nome, icone, ordem, tipo_padrao, prioridade_padrao, prazo_valor,
  prazo_unidade, resposta_horas, registrar_tempo, vincular_ativo,
  vincular_loja, preventiva, no_portal, orientacao_portal
)
select s.id, c.nome, c.icone, c.ordem, c.tipo::os.tipo_chamado,
  c.prioridade::os.prioridade, c.prazo, c.unidade::os.unidade_prazo,
  c.resposta, c.tempo, c.ativo, c.loja, c.preventiva, c.portal, c.orientacao
from (values
  ('Operações', 'Elétrica', 'zap', 1, 'os', 'media', 2, 'dias_uteis', 4, true, true, true, false, false, null),
  ('Operações', 'Hidráulica', 'droplets', 2, 'os', 'media', 2, 'dias_uteis', 4, true, true, true, false, false, null),
  ('Operações', 'Estrutura', 'building', 3, 'os', 'media', 5, 'dias_uteis', 8, true, true, true, false, false, null),
  ('Operações', 'Telhado', 'house', 4, 'os', 'media', 5, 'dias_uteis', 8, true, true, false, false, false, null),
  ('Operações', 'Preventiva', 'calendar-check', 5, 'os', 'media', 5, 'dias_uteis', null, true, true, false, true, false, null),
  ('Operações', 'Manutenção', 'wrench', 6, 'solicitacao', 'media', 2, 'dias_uteis', 4, true, false, true, false, true,
    'Descreva o problema e, se puder, mande fotos. A equipe de Operações responde por aqui.'),
  ('Operações', 'Acesso ao telhado', 'calendar-clock', 7, 'solicitacao', 'baixa', 1, 'dias_uteis', 4, false, false, true, false, true,
    'Escolha um horário livre. O acesso é das 7h às 11h, com no máximo 2 acessos por dia.'),
  ('Operações', 'Enviar projeto', 'file-up', 8, 'solicitacao', 'media', 7, 'dias_uteis', 8, false, false, true, false, true,
    'Envie os projetos (layout, elétrico, hidráulico) com ART ou RRT. O laudo volta por aqui em até 7 dias úteis.'),
  ('Marketing', 'Sinalização', 'signpost', 1, 'solicitacao', 'media', 5, 'dias_uteis', 8, false, false, true, false, false, null),
  ('Marketing', 'Ambiência', 'sparkles', 2, 'solicitacao', 'media', 5, 'dias_uteis', 8, false, false, false, false, false, null),
  ('Sustentabilidade', 'Entrevista de cliente', 'messages-square', 1, 'tarefa', 'media', 10, 'dias_uteis', null, false, false, true, false, false, null),
  ('Estacionamento', 'Credenciamento', 'badge-check', 1, 'solicitacao', 'media', 3, 'dias_uteis', 8, false, false, true, false, false, null),
  ('Estacionamento', 'Descredenciamento', 'badge-x', 2, 'solicitacao', 'media', 3, 'dias_uteis', 8, false, false, true, false, false, null),
  ('Comercial', 'Entrada de cliente', 'door-open', 1, 'aviso', 'media', 10, 'dias_uteis', null, false, false, true, false, false, null),
  ('Comercial', 'Saída de cliente', 'door-closed', 2, 'aviso', 'media', 10, 'dias_uteis', null, false, false, true, false, false, null),
  ('Comercial', 'Portal do lojista', 'link', 3, 'tarefa', 'media', 2, 'dias_uteis', null, false, false, true, false, false, null),
  ('Financeiro', 'Cliente novo', 'receipt', 1, 'solicitacao', 'media', 5, 'dias_uteis', null, false, false, true, false, false, null),
  ('Gestão', 'Protocolo entre setores', 'stamp', 1, 'solicitacao', 'media', 5, 'dias_uteis', 8, false, false, false, false, false, null)
) as c(setor, nome, icone, ordem, tipo, prioridade, prazo, unidade, resposta, tempo, ativo, loja, preventiva, portal, orientacao)
join os.setores s on s.nome = c.setor;

-- Subcategorias de exemplo (um nível): Estrutura › Telhado, Calha.
insert into os.categorias (setor_id, pai_id, nome, icone, ordem, tipo_padrao, prazo_valor, registrar_tempo, vincular_ativo)
select c.setor_id, c.id, s.nome, 'corner-down-right', s.ordem, 'os', 5, true, true
from os.categorias c
cross join (values ('Calha', 1), ('Infiltração', 2)) as s(nome, ordem)
where c.nome = 'Estrutura';

-- Acesso ao telhado reserva horário na agenda; Enviar projeto tem o prazo
-- de retorno do terceirizado (laudo do projeto de cliente).
update os.categorias set agenda_id = (select id from os.agendas where nome = 'Telhado'),
  precisa_confirmacao = false
  where nome = 'Acesso ao telhado';
update os.categorias set prazo_terceirizado_dias = 7 where nome = 'Enviar projeto';
update os.categorias set precisa_confirmacao = false where tipo_padrao in ('tarefa', 'aviso');

-- Checklist da preventiva (exemplo; o setor ajusta).
update os.categorias set checklist = '[
  {"texto": "Conferir o estado geral do equipamento", "obrigatorio": true},
  {"texto": "Limpar e lubrificar o que for preciso", "obrigatorio": false},
  {"texto": "Foto do depois", "obrigatorio": true}
]'::jsonb
where nome = 'Preventiva';

-- Campos extras de exemplo.
update os.categorias set campos = '[
  {"chave": "placa", "rotulo": "Placa do veículo", "tipo": "texto", "obrigatorio": false},
  {"chave": "vagas", "rotulo": "Quantidade de vagas", "tipo": "numero", "obrigatorio": true}
]'::jsonb
where nome = 'Credenciamento';
update os.categorias set campos = '[
  {"chave": "tipo_projeto", "rotulo": "Tipo de projeto", "tipo": "lista", "opcoes": ["Layout", "Elétrico", "Hidráulico", "Ar-condicionado", "Outro"], "obrigatorio": true},
  {"chave": "art", "rotulo": "ART ou RRT", "tipo": "anexo", "obrigatorio": true}
]'::jsonb
where nome = 'Enviar projeto';

-- ---------------------------------------------------------------------------
-- Categorias de ativo (vida útil padrão a validar com Operações)
-- ---------------------------------------------------------------------------

insert into os.ativo_categorias (nome, vida_util_padrao_anos) values
  ('Ar-condicionado', 10),
  ('Bomba', 8),
  ('Portão', 15),
  ('Elevador', 25),
  ('Escada rolante', 25),
  ('Gerador', 20),
  ('Iluminação', 8),
  ('Quadro elétrico', 20),
  ('Registro de água', 15),
  ('Câmera', 6),
  ('Exaustor', 10);

-- ---------------------------------------------------------------------------
-- Modelos de entrada e saída de cliente (4.12), a validar com cada setor
-- ---------------------------------------------------------------------------

insert into os.modelos (nome, gatilho, descricao) values
  ('Entrada de cliente', 'entrada', 'Contrato novo no ENET: o que cada setor faz para receber o cliente.'),
  ('Saída de cliente', 'saida', 'Rescisão ou data de saída no ENET: o que cada setor faz na saída.');

insert into os.modelo_itens (modelo_id, ordem, setor_id, categoria_id, titulo, prazo_dias, condicao, acao)
select m.id, i.ordem, s.id, c.id, i.titulo, i.prazo, i.condicao, i.acao
from (values
  ('Entrada de cliente', 1, 'Operações', null, 'Vistoria de entrada', 0, 'sempre', 'vistoria_entrada'),
  ('Entrada de cliente', 2, 'Estacionamento', 'Credenciamento', 'Credenciamento', 3, 'tem_vaga', 'nenhuma'),
  ('Entrada de cliente', 3, 'Sustentabilidade', 'Entrevista de cliente', 'Entrevista com o cliente', 30, 'sempre', 'nenhuma'),
  ('Entrada de cliente', 4, 'Marketing', null, 'Itens do Marketing (a definir com o setor)', 10, 'sempre', 'nenhuma'),
  ('Entrada de cliente', 5, 'Financeiro', 'Cliente novo', 'Itens do Financeiro (a definir com o setor)', 5, 'sempre', 'nenhuma'),
  ('Entrada de cliente', 6, 'Comercial', 'Portal do lojista', 'Gerar e enviar o link do portal da loja', 1, 'sempre', 'portal_gerar'),
  ('Saída de cliente', 1, 'Operações', null, 'Vistoria de saída (comparada com a de entrada)', 0, 'sempre', 'vistoria_saida'),
  ('Saída de cliente', 2, 'Estacionamento', 'Descredenciamento', 'Descredenciamento', 3, 'sempre', 'nenhuma'),
  ('Saída de cliente', 3, 'Comercial', 'Portal do lojista', 'Cancelar o link do portal da loja', 0, 'sempre', 'portal_cancelar')
) as i(modelo, ordem, setor, categoria, titulo, prazo, condicao, acao)
join os.modelos m on m.nome = i.modelo
join os.setores s on s.nome = i.setor
left join os.categorias c on c.nome = i.categoria and c.setor_id = s.id and c.pai_id is null;

-- ---------------------------------------------------------------------------
-- Feriados (nacionais e o estadual do RJ); os municipais, em Parâmetros.
-- ---------------------------------------------------------------------------

insert into os.feriados (data, nome) values
  ('2026-01-01', 'Confraternização Universal'),
  ('2026-04-03', 'Sexta-feira Santa'),
  ('2026-04-21', 'Tiradentes'),
  ('2026-04-23', 'São Jorge (RJ)'),
  ('2026-05-01', 'Dia do Trabalho'),
  ('2026-09-07', 'Independência'),
  ('2026-10-12', 'Nossa Senhora Aparecida'),
  ('2026-11-02', 'Finados'),
  ('2026-11-15', 'Proclamação da República'),
  ('2026-11-20', 'Consciência Negra'),
  ('2026-12-25', 'Natal'),
  ('2027-01-01', 'Confraternização Universal'),
  ('2027-03-26', 'Sexta-feira Santa'),
  ('2027-04-21', 'Tiradentes'),
  ('2027-04-23', 'São Jorge (RJ)'),
  ('2027-05-01', 'Dia do Trabalho'),
  ('2027-09-07', 'Independência'),
  ('2027-10-12', 'Nossa Senhora Aparecida'),
  ('2027-11-02', 'Finados'),
  ('2027-11-15', 'Proclamação da República'),
  ('2027-11-20', 'Consciência Negra'),
  ('2027-12-25', 'Natal');

-- ---------------------------------------------------------------------------
-- Parâmetros: textos padrão do laudo (4.16 B), ambientes e causas de falha
-- ---------------------------------------------------------------------------

update os.parametros set
  vistoria_ambientes = array[
    'Paredes', 'Teto', 'Piso', 'Fachada e Acesso', 'Infraestrutura elétrica',
    'Tipo de ligação', 'Tipo de autorização do medidor',
    'Infraestrutura hidrossanitária', 'Consumo de água no imóvel',
    'Tem banheiro (se sim, descrever abaixo)', 'Banheiro',
    'Ventilação, Janelas, Climatização'
  ],
  vistoria_textos = jsonb_build_object(
    'entrada', jsonb_build_object(
      'observacao', 'TODAS AS CONDIÇÕES AQUI DESCRITAS ESTÃO BASEADAS NA SITUAÇÃO ATUAL DO IMÓVEL, NA DATA DA VISTORIA REALIZADA NO LOCAL, ACIMA MENCIONADA. PARA QUAISQUER ADAPTAÇÕES OU MODIFICAÇÕES NO IMÓVEL, SERÁ NECESSÁRIO A APRESENTAÇÃO DOS PROJETOS ARQUITETÔNICOS E COMPLEMENTARES (LAYOUT, ELÉTRICO, HIDRÁULICOS, ETC.), ELABORADOS POR PROFISSIONAIS HABILITADOS, MEDIANTE APRESENTAÇÃO DE ART E RRT, CONFORME A NC004 - ORIENTAÇÕES TÉCNICAS SOBRE PROCESSO DE OBRAS E REFORMAS NOS PRÉDIOS E UNIDADES DA ARP.',
      'termo', 'O(a) LOCATÁRIO(a) está ciente de que, ao final da locação, deverá restituir o imóvel conforme o pactuado no contrato, observando o estado ora registrado. Caso identifique qualquer divergência em relação ao laudo, o(a) LOCATÁRIO(a) deverá comunicá-la à LOCADORA no prazo máximo de 24 (vinte e quatro) horas, contadas da assinatura deste documento. A ausência de manifestação dentro desse prazo, bem como o início de obras ou intervenções sem comunicação prévia, implicará plena concordância com o estado descrito, não cabendo posteriores reclamações ou cobranças à LOCADORA. E, por estarem de acordo, assinam o presente documento.'
    ),
    'saida', jsonb_build_object(
      'observacao', 'TODAS AS CONDIÇÕES AQUI DESCRITAS ESTÃO BASEADAS NA SITUAÇÃO ATUAL DO IMÓVEL, NA DATA DA VISTORIA REALIZADA NO LOCAL, ACIMA MENCIONADA.',
      'termo', 'Neste ato, as partes declaram estar de acordo com o estado do imóvel verificado na presente vistoria de saída, reconhecendo que a entrega das chaves ocorre nas condições ora registradas. A presente declaração restringe-se exclusivamente à condição física do imóvel, não implicando quitação de obrigações contratuais, financeiras ou legais decorrentes do contrato de locação, as quais serão apuradas e regularizadas em procedimento próprio de rescisão contratual. E, por estarem de acordo, assinam o presente documento.'
    ),
    'preventiva', jsonb_build_object(
      'observacao', 'TODAS AS CONDIÇÕES AQUI DESCRITAS ESTÃO BASEADAS NA SITUAÇÃO ATUAL DO IMÓVEL, NA DATA DA VISTORIA REALIZADA NO LOCAL, ACIMA MENCIONADA.',
      'termo', 'Laudo de vistoria preventiva realizado para acompanhamento periódico do estado de conservação do imóvel e de suas instalações.'
    ),
    'extraordinaria', jsonb_build_object(
      'observacao', 'TODAS AS CONDIÇÕES AQUI DESCRITAS ESTÃO BASEADAS NA SITUAÇÃO ATUAL DO IMÓVEL, NA DATA DA VISTORIA REALIZADA NO LOCAL, ACIMA MENCIONADA.',
      'termo', 'Laudo de vistoria extraordinária realizado para constatação pontual de ocorrências, manutenções ou alterações no imóvel.'
    )
  ),
  causas_falha = array[
    'Desgaste natural', 'Falta de manutenção', 'Mau uso', 'Instalação inadequada',
    'Peça com defeito', 'Clima (chuva, vento, raio)', 'Vandalismo', 'Outra'
  ],
  portal_boas_vindas = 'Olá! Por aqui você faz pedidos à administração do Espaço ARP e acompanha cada um até o fim.'
where id = 1;
