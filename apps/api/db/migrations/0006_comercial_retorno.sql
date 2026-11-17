-- Retorno do cliente sobre o Comercial (nov/2026).
--
-- Parâmetros novos: funil de mídia (leads de mídia no Painel), canal que
-- conta como visita, texto do convite dos formulários, dados da locadora
-- nos contratos (razão social, CNPJ, forma de representação) e o projeto do
-- Asana de onde vêm os registros do SAC.
-- Kit: o mapa de fachada pode atender só alguns LUCs do bloco.
-- Relacionamento: nota de 0 a 10 (NPS) no contato e o vínculo com a tarefa
-- do Asana (SAC), que entra só pela rotina (service role).
-- Censo: rodada errada pode ser excluída; com respostas, só por quem tem
-- comercial.censo.aprovar (liderança).

alter table comercial.parametros
  add column funil_midia text not null default 'Mídia OOH',
  add column relacionamento_canal_visita text not null default 'Presencial',
  add column formulario_texto_convite text not null default
    'Olá, estamos te convidando a responder o nosso formulário *{formulario}*, através do link abaixo. Agradecemos a participação e, qualquer dúvida, estaremos disponíveis por aqui!',
  add column locadora_razao_social text not null default '',
  add column locadora_cnpj text not null default '',
  add column locadora_representacao text not null default 'contrato_social',
  add column relacionamento_asana_projeto text not null default
    'SAC - Relacionamentos - Feedbacks Relacionamento',
  add constraint parametros_funil_midia_check check (btrim(funil_midia) <> ''),
  add constraint parametros_relacionamento_canal_visita_check
    check (btrim(relacionamento_canal_visita) <> ''),
  add constraint parametros_formulario_texto_convite_check
    check (btrim(formulario_texto_convite) <> ''),
  add constraint parametros_locadora_representacao_check
    check (locadora_representacao = any (array[
      'procurador', 'diretor', 'diretor_executivo', 'contrato_social'
    ]));

alter table comercial.kit_documentos
  add column lucs text[] not null default '{}'::text[];

alter table comercial.contatos
  add column nps smallint,
  add column asana_gid text,
  add column asana_url text,
  add constraint contatos_nps_check check (nps between 0 and 10);

create unique index contatos_asana_gid on comercial.contatos (asana_gid)
  where asana_gid is not null;

insert into core.permissoes (codigo, descricao)
values (
  'comercial.censo.aprovar',
  'Censo – editar ou excluir rodada que já tem respostas (liderança)'
)
on conflict do nothing;

-- O Administrador tem tudo; quem já cuida dos parâmetros do Comercial e
-- aplica o Censo é a liderança.
insert into core.cargo_permissoes (cargo_id, permissao)
select c.id, 'comercial.censo.aprovar'
from core.cargos c
where c.nome = 'Administrador'
   or (
     exists (select 1 from core.cargo_permissoes a
             where a.cargo_id = c.id and a.permissao = 'comercial.censo.aplicar')
     and exists (select 1 from core.cargo_permissoes b
                 where b.cargo_id = c.id and b.permissao = 'comercial.parametros.editar')
   )
on conflict do nothing;

create policy excluir on comercial.censo_rodadas for delete to authenticated
using (
  (select core.pode('comercial.censo.aplicar'))
  and (
    (select core.pode('comercial.censo.aprovar'))
    or not exists (
      select 1 from comercial.censo_respostas r where r.rodada_id = censo_rodadas.id
    )
  )
);
