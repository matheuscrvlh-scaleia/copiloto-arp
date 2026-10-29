-- Ordens de serviço independentes dos chamados.
--
-- Até aqui a OS era um chamado de tipo 'os' (os.chamados). Agora ela tem
-- tabela própria (os.ordens), numeração própria, RLS e gatilhos próprios:
-- abrir uma OS não cria chamado, e um chamado não vira OS (sai o "Converter
-- em OS" e o ticket automático do Financeiro). O único elo é um vínculo
-- simples: a OS pode apontar para um chamado (os.ordens.vinculado_a_id),
-- só como referência.
--
-- A OS tem tudo o que o chamado tem (ciclo, destinos, participantes, linha
-- do tempo, anexos, checklist, campos, etiquetas, recorrência), com as
-- mesmas colunas, para o detalhe e o ciclo servirem aos dois. O que é só da
-- OS (tempo, materiais, custos, profissionais, link do terceirizado, campos
-- de execução, assinatura e plano preventivo) sai de os.chamados.
--
-- Filhas comuns (destinatarios, participantes, eventos, anexos,
-- notificacoes) ganham ordem_id: cada linha é de um chamado ou de uma OS.
-- Filhas só da OS (sessoes, materiais, os_custos, ordem_profissionais,
-- terceirizado_links) passam a apontar para os.ordens.
--
-- Dados: cada chamado de tipo 'os' vira uma OS com o mesmo id e o mesmo
-- número, com as filhas, a linha do tempo e as notificações. O chamado de
-- que a OS foi convertida vira o vínculo dela.

-- ---------------------------------------------------------------------------
-- Antes: o que é só da OS não pode estar em chamado que não é OS
-- ---------------------------------------------------------------------------

do $$
declare
  v_tabela text;
  v_tem boolean;
begin
  foreach v_tabela in array array[
    'sessoes', 'materiais', 'os_custos', 'chamado_profissionais', 'terceirizado_links'
  ] loop
    execute format(
      'select exists (select 1 from os.%I x join os.chamados c on c.id = x.chamado_id
         where c.tipo <> ''os'')', v_tabela)
      into v_tem;
    if v_tem then
      raise exception 'os.% tem linhas de chamado que não é OS: confira antes desta migration', v_tabela;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- os.ordens
-- ---------------------------------------------------------------------------

create sequence os.ordem_numero_seq;

create table os.ordens (
  id uuid primary key default gen_random_uuid(),
  numero bigint not null unique default nextval('os.ordem_numero_seq'),
  -- Sempre 'os': a OS tem a forma do chamado (o detalhe, o ciclo e a linha
  -- do tempo servem aos dois e decidem pela coluna).
  tipo os.tipo_chamado not null default 'os' check (tipo = 'os'),
  titulo text not null check (btrim(titulo) <> ''),
  descricao text,
  setor_id uuid not null references os.setores (id),
  categoria_id uuid references os.categorias (id) on delete set null,
  status os.status_chamado not null default 'aberto',
  prioridade os.prioridade not null default 'media',
  origem os.origem_chamado not null default 'sistema',
  pessoal boolean not null default false,
  precisa_confirmacao boolean not null default true,
  aberto_por uuid references core.usuarios (id) on delete set null,
  solicitante_nome text,
  solicitante_telefone text,
  responsavel_id uuid references core.usuarios (id) on delete set null,
  prazo timestamptz,
  -- Vínculos
  loja_id uuid references os.lojas (id) on delete set null,
  ativo_id uuid references os.ativos (id) on delete set null,
  vistoria_id uuid references os.vistorias (id) on delete set null,
  ambiente_id uuid references os.vistoria_ambientes (id) on delete set null,
  -- Chamado vinculado (só referência: um não cria nem move o outro).
  vinculado_a_id uuid references os.chamados (id) on delete set null,
  campos jsonb not null default '{}' check (jsonb_typeof(campos) = 'object'),
  etiquetas text[] not null default '{}',
  checklist jsonb not null default '[]' check (jsonb_typeof(checklist) = 'array'),
  destinos_em_ordem boolean not null default false,
  -- Ciclo (os.ciclo_do_chamado, o mesmo do chamado)
  primeira_resposta_em timestamptz,
  iniciado_em timestamptz,
  aguardando_desde timestamptz,
  aguardando_tipo os.motivo_aguardando,
  aguardando_motivo text,
  aguardando_min int not null default 0 check (aguardando_min >= 0),
  concluido_em timestamptz,
  concluido_por uuid references core.usuarios (id) on delete set null,
  fechado_em timestamptz,
  fechado_por uuid references core.usuarios (id) on delete set null,
  fechado_automatico boolean not null default false,
  cancelado_em timestamptz,
  cancelado_por uuid references core.usuarios (id) on delete set null,
  motivo_cancelamento text,
  reaberto_vezes int not null default 0,
  ultimo_motivo_reabertura text,
  solucao text,
  causa_falha text,
  -- Execução
  execucao os.execucao not null default 'interna',
  local text,
  bloco text,
  empresa_id uuid references os.empresas (id) on delete set null,
  visita_data date,
  visita_periodo os.periodo_visita,
  prazo_terceirizado timestamptz,
  cobranca_avisada_em timestamptz,
  -- Ativo parado enquanto a OS está aberta (volta a "Em uso" ao fechar).
  ativo_parado boolean not null default false,
  rateio boolean not null default false,
  assinatura_nome text,
  assinatura_path text,
  assinado_em timestamptz,
  avaliacao smallint check (avaliacao between 1 and 5),
  avaliacao_comentario text,
  avaliado_em timestamptz,
  -- Repetir: a mesma regra do chamado (uma ocorrência por data da série).
  recorrencia jsonb,
  serie_id uuid,
  serie_data date,
  plano_id uuid references os.planos_preventivos (id) on delete set null,
  plano_data date,
  legado_origem text,
  legado_id text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (status <> 'aguardando' or aguardando_tipo is not null),
  check (status <> 'cancelado' or nullif(btrim(motivo_cancelamento), '') is not null),
  unique (serie_id, serie_data),
  unique (plano_id, plano_data),
  unique (legado_origem, legado_id)
);

-- As OS de hoje: mesmo id e mesmo número. O chamado convertido vira o
-- vínculo (se a OS não tinha outro).
insert into os.ordens (
  id, numero, titulo, descricao, setor_id, categoria_id, status, prioridade,
  origem, pessoal, precisa_confirmacao, aberto_por, solicitante_nome,
  solicitante_telefone, responsavel_id, prazo, loja_id, ativo_id, vistoria_id,
  ambiente_id, vinculado_a_id, campos, etiquetas, checklist, destinos_em_ordem,
  primeira_resposta_em, iniciado_em, aguardando_desde, aguardando_tipo,
  aguardando_motivo, aguardando_min, concluido_em, concluido_por, fechado_em,
  fechado_por, fechado_automatico, cancelado_em, cancelado_por,
  motivo_cancelamento, reaberto_vezes, ultimo_motivo_reabertura, solucao,
  causa_falha, execucao, local, bloco, empresa_id, visita_data, visita_periodo,
  prazo_terceirizado, cobranca_avisada_em, ativo_parado, rateio,
  assinatura_nome, assinatura_path, assinado_em, avaliacao,
  avaliacao_comentario, avaliado_em, recorrencia, serie_id, serie_data,
  plano_id, plano_data, legado_origem, legado_id, criado_em, atualizado_em
)
select
  c.id, c.numero, c.titulo, c.descricao, c.setor_id, c.categoria_id, c.status,
  c.prioridade, c.origem, c.pessoal, c.precisa_confirmacao, c.aberto_por,
  c.solicitante_nome, c.solicitante_telefone, c.responsavel_id, c.prazo,
  c.loja_id, c.ativo_id, c.vistoria_id, c.ambiente_id,
  -- O vínculo é com um chamado: OS ligada a outra OS perde o elo.
  case
    when v.tipo is distinct from 'os' and c.vinculado_a_id is not null then c.vinculado_a_id
    when cv.tipo is distinct from 'os' and c.convertido_de_id is not null then c.convertido_de_id
  end,
  c.campos, c.etiquetas, c.checklist, c.destinos_em_ordem,
  c.primeira_resposta_em, c.iniciado_em, c.aguardando_desde, c.aguardando_tipo,
  c.aguardando_motivo, c.aguardando_min, c.concluido_em, c.concluido_por,
  c.fechado_em, c.fechado_por, c.fechado_automatico, c.cancelado_em,
  c.cancelado_por, c.motivo_cancelamento, c.reaberto_vezes,
  c.ultimo_motivo_reabertura, c.solucao, c.causa_falha,
  coalesce(c.execucao, 'interna'), c.local, c.bloco, c.empresa_id,
  c.visita_data, c.visita_periodo, c.prazo_terceirizado, c.cobranca_avisada_em,
  c.ativo_parado, c.rateio, c.assinatura_nome, c.assinatura_path,
  c.assinado_em, c.avaliacao, c.avaliacao_comentario, c.avaliado_em,
  c.recorrencia, c.serie_id, c.serie_data, c.plano_id, c.plano_data,
  c.legado_origem, c.legado_id, c.criado_em, c.atualizado_em
from os.chamados c
left join os.chamados v on v.id = c.vinculado_a_id
left join os.chamados cv on cv.id = c.convertido_de_id
where c.tipo = 'os';

-- A numeração da OS continua acima da maior que já existe.
select setval('os.ordem_numero_seq', coalesce((select max(numero) from os.ordens), 0) + 1, false);

create index ordens_setor_status on os.ordens (setor_id, status);
create index ordens_responsavel on os.ordens (responsavel_id, status);
create index ordens_aberto_por on os.ordens (aberto_por, status);
create index ordens_loja on os.ordens (loja_id) where loja_id is not null;
create index ordens_ativo on os.ordens (ativo_id) where ativo_id is not null;
create index ordens_lista_criado on os.ordens (criado_em desc, id);
create index ordens_lista_prazo on os.ordens (prazo, id);
create index ordens_lista_status on os.ordens (status, prazo);
create index ordens_concluido on os.ordens (concluido_em) where concluido_em is not null;
create index ordens_fechado on os.ordens (fechado_em) where fechado_em is not null;
create index ordens_cancelado on os.ordens (cancelado_em) where cancelado_em is not null;
create index ordens_visita on os.ordens (visita_data) where visita_data is not null;
create index ordens_categoria on os.ordens (categoria_id);
create index ordens_empresa on os.ordens (empresa_id) where empresa_id is not null;
create index ordens_vistoria on os.ordens (vistoria_id) where vistoria_id is not null;
create index ordens_ambiente on os.ordens (ambiente_id) where ambiente_id is not null;
create index ordens_vinculado_a on os.ordens (vinculado_a_id) where vinculado_a_id is not null;
create index ordens_concluido_por on os.ordens (concluido_por) where concluido_por is not null;
create index ordens_fechado_por on os.ordens (fechado_por) where fechado_por is not null;
create index ordens_cancelado_por on os.ordens (cancelado_por) where cancelado_por is not null;
create index ordens_plano on os.ordens (plano_id) where plano_id is not null;

-- ---------------------------------------------------------------------------
-- Filhas comuns: chamado ou OS
-- ---------------------------------------------------------------------------

alter table os.destinatarios
  add column ordem_id uuid references os.ordens (id) on delete cascade,
  alter column chamado_id drop not null;
update os.destinatarios set ordem_id = chamado_id, chamado_id = null
  where chamado_id in (select id from os.ordens);
alter table os.destinatarios
  add constraint destinatarios_dono check (num_nonnulls(chamado_id, ordem_id) = 1);
create index destinatarios_ordem on os.destinatarios (ordem_id) where ordem_id is not null;

-- Participantes: a chave (chamado_id, usuario_id) vira uma única por dono.
alter table os.participantes drop constraint participantes_pkey;
alter table os.participantes
  add column id bigint generated always as identity primary key,
  add column ordem_id uuid references os.ordens (id) on delete cascade,
  alter column chamado_id drop not null;
update os.participantes set ordem_id = chamado_id, chamado_id = null
  where chamado_id in (select id from os.ordens);
alter table os.participantes
  add constraint participantes_dono check (num_nonnulls(chamado_id, ordem_id) = 1),
  add constraint participantes_chamado_usuario unique (chamado_id, usuario_id),
  add constraint participantes_ordem_usuario unique (ordem_id, usuario_id);

alter table os.eventos
  add column ordem_id uuid references os.ordens (id) on delete cascade,
  alter column chamado_id drop not null;
update os.eventos set ordem_id = chamado_id, chamado_id = null
  where chamado_id in (select id from os.ordens);
alter table os.eventos
  add constraint eventos_dono check (num_nonnulls(chamado_id, ordem_id) = 1);
create index eventos_ordem on os.eventos (ordem_id, em) where ordem_id is not null;

alter table os.anexos
  drop constraint anexos_check,
  add column ordem_id uuid references os.ordens (id) on delete cascade;
update os.anexos set ordem_id = chamado_id, chamado_id = null
  where chamado_id in (select id from os.ordens);
alter table os.anexos
  add constraint anexos_dono
    check (num_nonnulls(chamado_id, ordem_id, vistoria_id, ambiente_id, ativo_id) >= 1),
  add constraint anexos_chamado_ou_ordem check (num_nonnulls(chamado_id, ordem_id) <= 1);
create index anexos_ordem on os.anexos (ordem_id) where ordem_id is not null;

alter table os.notificacoes
  add column ordem_id uuid references os.ordens (id) on delete cascade;
update os.notificacoes set ordem_id = chamado_id, chamado_id = null
  where chamado_id in (select id from os.ordens);
create index notificacoes_ordem on os.notificacoes (ordem_id) where ordem_id is not null;

-- ---------------------------------------------------------------------------
-- Filhas só da OS
-- ---------------------------------------------------------------------------

alter table os.sessoes rename column chamado_id to ordem_id;
alter table os.sessoes drop constraint sessoes_chamado_id_fkey;
alter table os.sessoes
  add constraint sessoes_ordem_id_fkey foreign key (ordem_id) references os.ordens (id) on delete cascade;
alter index os.sessoes_chamado rename to sessoes_ordem;

alter table os.materiais rename column chamado_id to ordem_id;
alter table os.materiais drop constraint materiais_chamado_id_fkey;
alter table os.materiais
  add constraint materiais_ordem_id_fkey foreign key (ordem_id) references os.ordens (id) on delete cascade;
alter index os.materiais_chamado rename to materiais_ordem;

alter table os.os_custos rename column chamado_id to ordem_id;
alter table os.os_custos drop constraint os_custos_chamado_id_fkey;
alter table os.os_custos
  add constraint os_custos_ordem_id_fkey foreign key (ordem_id) references os.ordens (id) on delete cascade;

alter table os.chamado_profissionais rename to ordem_profissionais;
alter table os.ordem_profissionais rename column chamado_id to ordem_id;
alter table os.ordem_profissionais drop constraint chamado_profissionais_chamado_id_fkey;
alter table os.ordem_profissionais
  add constraint ordem_profissionais_ordem_id_fkey foreign key (ordem_id) references os.ordens (id) on delete cascade;
alter index os.chamado_profissionais_profissional rename to ordem_profissionais_profissional;

alter table os.terceirizado_links rename column chamado_id to ordem_id;
alter table os.terceirizado_links drop constraint terceirizado_links_chamado_id_fkey;
alter table os.terceirizado_links
  add constraint terceirizado_links_ordem_id_fkey foreign key (ordem_id) references os.ordens (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- os.chamados sem a OS
-- ---------------------------------------------------------------------------

-- Os chamados que eram OS saem (já copiados): sem auditoria de "apagado".
alter table os.chamados disable trigger auditoria;
delete from os.chamados where tipo = 'os';
alter table os.chamados enable trigger auditoria;

-- Sem conversão: abrir é só em nome de si mesmo.
alter policy abrir on os.chamados
  with check ((select core.pode('os.acessar')) and aberto_por = (select auth.uid()));
drop function os.solicitante_de(uuid);

drop trigger liberar_ativo on os.chamados;

alter table os.chamados
  drop column convertido_de_id,
  drop column convertido_em_id,
  drop column execucao,
  drop column local,
  drop column bloco,
  drop column empresa_id,
  drop column visita_data,
  drop column visita_periodo,
  drop column prazo_terceirizado,
  drop column cobranca_avisada_em,
  drop column ativo_parado,
  drop column rateio,
  drop column assinatura_nome,
  drop column assinatura_path,
  drop column assinado_em,
  drop column plano_id,
  drop column plano_data,
  add constraint chamados_sem_os check (tipo <> 'os');

-- Ninguém mais abre ticket no Financeiro a partir da OS.
alter table os.parametros drop column setor_financeiro_id;

-- ---------------------------------------------------------------------------
-- Funções de acesso da OS (as mesmas regras do chamado)
-- ---------------------------------------------------------------------------

-- Chamados em que o usuário está envolvido: só os de chamado.
create or replace function os.meus_chamados_envolvidos()
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
    and d.chamado_id is not null
    and (
      d.usuario_id = (select auth.uid())
      or d.responsavel_id = (select auth.uid())
      or d.setor_id = any (array(select os.meus_setores()))
    )
  union
  select p.chamado_id
  from os.participantes p
  where (select core.pode_modulo('os'))
    and p.chamado_id is not null
    and p.usuario_id = (select auth.uid());
$$;

-- OS em que o usuário está envolvido (destino ou participante).
create function os.minhas_ordens_envolvidas()
returns setof uuid
language sql
stable
security definer
set search_path = ''
rows 100
as $$
  select d.ordem_id
  from os.destinatarios d
  where (select core.pode_modulo('os'))
    and d.ordem_id is not null
    and (
      d.usuario_id = (select auth.uid())
      or d.responsavel_id = (select auth.uid())
      or d.setor_id = any (array(select os.meus_setores()))
    )
  union
  select p.ordem_id
  from os.participantes p
  where (select core.pode_modulo('os'))
    and p.ordem_id is not null
    and p.usuario_id = (select auth.uid());
$$;

-- Regra antiga (por linha), para o servidor (rpc) e para os testes
-- compararem com as políticas: a mesma de os.ve_chamado e os.edita_chamado.
create function os.envolvido_na_ordem(p_ordem uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1 from os.destinatarios d
      where d.ordem_id = p_ordem
        and (
          d.usuario_id = (select auth.uid())
          or d.responsavel_id = (select auth.uid())
          or d.setor_id in (select os.meus_setores())
        )
    )
    or exists (
      select 1 from os.participantes p
      where p.ordem_id = p_ordem and p.usuario_id = (select auth.uid())
    );
$$;

create function os.pode_ver_ordem(p_ordem uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from os.ordens o
    where o.id = p_ordem
      and core.pode_modulo('os')
      and (
        o.aberto_por = (select auth.uid())
        or o.responsavel_id = (select auth.uid())
        or core.pode('os.todos_setores')
        or core.pode('os.painel_geral')
        or (
          o.setor_id in (select os.meus_setores())
          and (
            o.responsavel_id is null
            or core.pode('os.meu_setor')
            or core.pode('os.painel_setor')
          )
        )
        or os.gerencia(o.setor_id)
        or os.envolvido_na_ordem(o.id)
      )
  );
$$;

create function os.pode_editar_ordem(p_ordem uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select core.pode('os.acessar')
    and os.pode_ver_ordem(p_ordem)
    and exists (
      select 1 from os.ordens o
      where o.id = p_ordem
        and (
          o.aberto_por = (select auth.uid())
          or o.responsavel_id = (select auth.uid())
          or o.setor_id in (select os.meus_setores())
          or os.gerencia(o.setor_id)
          or os.envolvido_na_ordem(o.id)
        )
    );
$$;

-- ---------------------------------------------------------------------------
-- Gatilhos da OS
-- ---------------------------------------------------------------------------

-- Ciclo e "quem pode mudar o quê": as mesmas funções do chamado (olham só
-- as colunas da linha).
create trigger ciclo before update of status on os.ordens
  for each row execute function os.ciclo_do_chamado();
create trigger validar before update on os.ordens
  for each row execute function os.validar_chamado();
create trigger liberar_ativo after update of status on os.ordens
  for each row execute function os.liberar_ativo_da_os();
create trigger atualizado_em before update on os.ordens
  for each row execute function core.set_atualizado_em();
create trigger auditoria after insert or update or delete on os.ordens
  for each row execute function core.auditar('id');

drop trigger auditoria on os.os_custos;
create trigger auditoria after insert or update or delete on os.os_custos
  for each row execute function core.auditar('ordem_id');

-- Vários destinatários: o chamado ou a OS anda junto com os destinos.
create or replace function os.sincronizar_destinos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status os.status_chamado;
  v_fecha boolean;
  v_total int;
  v_concluidos int;
  v_andando int;
  v_novo os.status_chamado;
begin
  if new.ordem_id is not null then
    select status, not precisa_confirmacao into v_status, v_fecha
      from os.ordens where id = new.ordem_id;
  else
    select status, tipo = 'aviso' or pessoal or not precisa_confirmacao
      into v_status, v_fecha
      from os.chamados where id = new.chamado_id;
  end if;
  if v_status in ('fechado', 'cancelado') then
    return null;
  end if;
  select count(*),
    count(*) filter (where status = 'concluido'),
    count(*) filter (where status <> 'aberto')
    into v_total, v_concluidos, v_andando
    from os.destinatarios
    where chamado_id is not distinct from new.chamado_id
      and ordem_id is not distinct from new.ordem_id;

  if v_concluidos = v_total and v_status <> 'concluido' then
    v_novo := case when v_fecha then 'fechado'::os.status_chamado else 'concluido'::os.status_chamado end;
  elsif v_concluidos < v_total and v_status = 'concluido' then
    v_novo := 'em_andamento'::os.status_chamado;
  elsif v_andando > 0 and v_status = 'aberto' then
    v_novo := 'em_andamento'::os.status_chamado;
  end if;
  if v_novo is null then
    return null;
  end if;

  perform set_config('os.sistema', 'on', true);
  if new.ordem_id is not null then
    update os.ordens set status = v_novo where id = new.ordem_id;
  else
    update os.chamados set status = v_novo where id = new.chamado_id;
  end if;
  perform set_config('os.sistema', 'off', true);
  return null;
end;
$$;

create or replace function os.respeitar_ordem_do_destino()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('os.sistema', true) = 'on'
     or old.status <> 'aberto'
     or new.status = 'aberto' then
    return new;
  end if;
  if (
    exists (select 1 from os.chamados c where c.id = new.chamado_id and c.destinos_em_ordem)
    or exists (select 1 from os.ordens o where o.id = new.ordem_id and o.destinos_em_ordem)
  ) and exists (
    select 1 from os.destinatarios d
    where d.chamado_id is not distinct from new.chamado_id
      and d.ordem_id is not distinct from new.ordem_id
      and d.ordem < new.ordem
      and d.status <> 'concluido'
  ) then
    raise exception 'esta parte espera a anterior concluir'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Cálculo da OS (só o servidor grava).
drop function os.gravar_calculo_os(uuid, jsonb);
create function os.gravar_calculo_os(p_ordem uuid, p_resultado jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into os.os_custos (
    ordem_id, minutos, minuto_homem, custo_mao_obra, custo_materiais,
    custo_total, valor_rateio, completo, memoria, calculado_em
  ) values (
    p_ordem,
    (p_resultado ->> 'minutos')::int,
    (p_resultado ->> 'minuto_homem')::int,
    (p_resultado ->> 'custo_mao_obra')::numeric,
    (p_resultado ->> 'custo_materiais')::numeric,
    (p_resultado ->> 'custo_total')::numeric,
    (p_resultado ->> 'valor_rateio')::numeric,
    (p_resultado ->> 'completo')::boolean,
    coalesce(p_resultado -> 'memoria', '[]'),
    now()
  )
  on conflict (ordem_id) do update set
    minutos = excluded.minutos,
    minuto_homem = excluded.minuto_homem,
    custo_mao_obra = excluded.custo_mao_obra,
    custo_materiais = excluded.custo_materiais,
    custo_total = excluded.custo_total,
    valor_rateio = excluded.valor_rateio,
    completo = excluded.completo,
    memoria = excluded.memoria,
    calculado_em = excluded.calculado_em;
$$;

-- Resumo dos ativos: as OS do ativo (agora em os.ordens).
create or replace function os.resumo_ativos(p_desde date)
returns table (
  ativo_id uuid,
  custo_periodo numeric,
  custo_total numeric,
  corretivas_periodo bigint,
  preventivas_periodo bigint,
  os_abertas bigint,
  ultima_os timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.ativo_id,
    coalesce(sum(k.custo_total) filter (where o.criado_em >= p_desde), 0),
    coalesce(sum(k.custo_total), 0),
    count(*) filter (
      where o.criado_em >= p_desde and o.plano_id is null
        and not coalesce(cat.preventiva, false)
    ),
    count(*) filter (
      where o.criado_em >= p_desde
        and (o.plano_id is not null or coalesce(cat.preventiva, false))
    ),
    count(*) filter (where o.status in ('aberto', 'em_andamento', 'aguardando')),
    max(o.criado_em)
  from os.ordens o
  left join os.os_custos k on k.ordem_id = o.id
  left join os.categorias cat on cat.id = o.categoria_id
  where (core.pode('os.ativos') or core.pode('os.ativos_gerenciar'))
    and o.ativo_id is not null
    and o.status <> 'cancelado'
  group by o.ativo_id;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table os.ordens enable row level security;

-- Quem vê e quem mexe: as regras do chamado, com os envolvidos da OS.
create policy ver on os.ordens for select to authenticated
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
      or id in (select os.minhas_ordens_envolvidas())
    )
  );
create policy abrir on os.ordens for insert to authenticated
  with check ((select core.pode('os.acessar')) and aberto_por = (select auth.uid()));
create policy editar on os.ordens for update to authenticated
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
      or id in (select os.minhas_ordens_envolvidas())
    )
    and (
      aberto_por = (select auth.uid())
      or responsavel_id = (select auth.uid())
      or setor_id = any (array(select os.meus_setores()))
      or ((select core.pode('os.gerenciar_setor')) and (select core.pode('os.todos_setores')))
      or id in (select os.minhas_ordens_envolvidas())
    )
  )
  with check ((select core.pode('os.acessar')));

-- Filhas. Ver: a linha do dono passa pelo RLS dele (exists). Mexer: o mesmo
-- exists com o resto da regra de edição. As regras ficam em texto e cada
-- política é montada com elas (iguais para chamado e OS).
do $$
declare
  -- %1$s: alias do dono; %2$s: função dos envolvidos.
  v_mexe constant text := '(select core.pode(''os.acessar''))
    and (
      %1$s.aberto_por = (select auth.uid())
      or %1$s.responsavel_id = (select auth.uid())
      or %1$s.setor_id = any (array(select os.meus_setores()))
      or ((select core.pode(''os.gerenciar_setor'')) and (select core.pode(''os.todos_setores'')))
      or %1$s.id in (select %2$s())
    )';
  v_mexe_c text := format(v_mexe, 'c', 'os.meus_chamados_envolvidos');
  v_mexe_o text := format(v_mexe, 'o', 'os.minhas_ordens_envolvidas');
  -- Dono visível (o RLS do dono decide) e dono em que a pessoa mexe.
  v_ve text;
  v_edita text;
  t text;
begin
  -- Comuns: chamado ou OS.
  foreach t in array array['destinatarios', 'participantes', 'eventos'] loop
    v_ve := format(
      '(exists (select 1 from os.chamados c where c.id = %1$I.chamado_id)
        or exists (select 1 from os.ordens o where o.id = %1$I.ordem_id))', t);
    v_edita := format(
      '(exists (select 1 from os.chamados c where c.id = %1$I.chamado_id and %2$s)
        or exists (select 1 from os.ordens o where o.id = %1$I.ordem_id and %3$s))',
      t, v_mexe_c, v_mexe_o);
    execute format('alter policy ver on os.%I using (%s)', t, v_ve);
    if t = 'eventos' then
      -- A linha do tempo só cresce: quem vê registra (em nome próprio).
      execute format(
        'alter policy registrar on os.eventos with check (%s
           and (autor_id is null or autor_id = (select auth.uid())))', v_ve);
    elsif t = 'participantes' then
      -- Quem vê cita e descita.
      execute format('alter policy incluir on os.%I with check (%s)', t, v_ve);
      execute format('alter policy editar on os.%I using (%s) with check (%2$s)', t, v_ve);
      execute format('alter policy remover on os.%I using (%s)', t, v_ve);
    else
      execute format('alter policy incluir on os.%I with check (%s)', t, v_edita);
      execute format('alter policy editar on os.%I using (%s) with check (%2$s)', t, v_edita);
      execute format('alter policy remover on os.%I using (%s)', t, v_edita);
    end if;
  end loop;

  execute format(
    'alter policy ver on os.anexos using (
       (chamado_id is not null and exists (select 1 from os.chamados c where c.id = anexos.chamado_id))
       or (ordem_id is not null and exists (select 1 from os.ordens o where o.id = anexos.ordem_id))
       or ((vistoria_id is not null or ambiente_id is not null) and (select core.pode(''os.vistorias'')))
       or (ativo_id is not null
         and ((select core.pode(''os.ativos'')) or (select core.pode(''os.ativos_gerenciar'')))))');
  execute format(
    'alter policy enviar on os.anexos with check (
       (chamado_id is not null and exists (
         select 1 from os.chamados c where c.id = anexos.chamado_id and %s))
       or (ordem_id is not null and exists (
         select 1 from os.ordens o where o.id = anexos.ordem_id and %s))
       or ((vistoria_id is not null or ambiente_id is not null) and (select core.pode(''os.vistorias'')))
       or (ativo_id is not null and (select core.pode(''os.ativos_gerenciar''))))',
    v_mexe_c, v_mexe_o);

  -- Só da OS.
  foreach t in array array['sessoes', 'materiais', 'ordem_profissionais', 'os_custos'] loop
    v_ve := format('exists (select 1 from os.ordens o where o.id = %I.ordem_id)', t);
    v_edita := format(
      'exists (select 1 from os.ordens o where o.id = %I.ordem_id and %s)', t, v_mexe_o);
    if t = 'os_custos' then
      -- Dinheiro: só com os.custos.
      v_ve := '(select core.pode(''os.custos'')) and ' || v_ve;
      v_edita := '(select core.pode(''os.custos'')) and ' || v_edita;
    end if;
    execute format('alter policy ver on os.%I using (%s)', t, v_ve);
    execute format('alter policy incluir on os.%I with check (%s)', t, v_edita);
    execute format('alter policy editar on os.%I using (%s) with check (%2$s)', t, v_edita);
    execute format('alter policy remover on os.%I using (%s)', t, v_edita);
  end loop;

  -- Técnicos da sessão: pela sessão (que passa pelo RLS dela).
  execute 'alter policy ver on os.sessao_tecnicos using (exists (
     select 1 from os.sessoes s join os.ordens o on o.id = s.ordem_id
     where s.id = sessao_tecnicos.sessao_id))';
  v_edita := format(
    'exists (select 1 from os.sessoes s join os.ordens o on o.id = s.ordem_id
       where s.id = sessao_tecnicos.sessao_id and %s)', v_mexe_o);
  execute format('alter policy incluir on os.sessao_tecnicos with check (%s)', v_edita);
  execute format('alter policy editar on os.sessao_tecnicos using (%s) with check (%1$s)', v_edita);
  execute format('alter policy remover on os.sessao_tecnicos using (%s)', v_edita);

  -- Link do terceirizado: o token é segredo; quem gerencia terceirizados ou
  -- mexe na OS.
  execute format(
    'alter policy ver on os.terceirizado_links using (
       (select core.pode(''os.terceirizados''))
       or exists (select 1 from os.ordens o where o.id = terceirizado_links.ordem_id and %s))',
    v_mexe_o);
end;
$$;

-- ---------------------------------------------------------------------------
-- Privilégios
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on os.ordens to authenticated;
grant all on os.ordens to service_role;
grant usage, select on sequence os.ordem_numero_seq to authenticated, service_role;
revoke all on function os.minhas_ordens_envolvidas() from public, anon;
revoke all on function os.envolvido_na_ordem(uuid) from public, anon;
revoke all on function os.pode_ver_ordem(uuid) from public, anon;
revoke all on function os.pode_editar_ordem(uuid) from public, anon;
grant execute on function
  os.minhas_ordens_envolvidas(),
  os.envolvido_na_ordem(uuid),
  os.pode_ver_ordem(uuid),
  os.pode_editar_ordem(uuid)
  to authenticated, service_role;
revoke all on function os.gravar_calculo_os(uuid, jsonb) from public, anon, authenticated;
grant execute on function os.gravar_calculo_os(uuid, jsonb) to service_role;
