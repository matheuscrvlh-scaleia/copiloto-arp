-- Chamados criados por outros módulos (primeiro: Sustentabilidade, ver
-- docs/sustentabilidade.md, "Decisões da Etapa 0").
--
-- O módulo cria o chamado pelo sistema (src/server/os/criar.ts) com:
--   - acao_url / acao_rotulo: o botão "Executar" do detalhe leva à tela do
--     módulo onde o trabalho é feito (caminho interno, começa com "/");
--   - conclusao_externa: o chamado só conclui quando o módulo grava o dado
--     (src/server/os/sistema.ts, service role). Quem tem sessão comum não
--     conclui; cancelar continua pela regra de sempre (com motivo);
--   - origem 'modulo' + origem_modulo/origem_ref: de onde veio (ex.:
--     'sustentabilidade' + 'entrevista:<contrato_id>'), para o módulo achar
--     o chamado aberto dele.
-- A OS (os.ordens) tem as mesmas colunas: as duas tabelas são lidas com o
-- mesmo tipo (Chamado) e a recorrência copia o mesmo conjunto nas duas.

-- Valor novo do enum: não pode ser usado nesta mesma transação (nem em
-- check, índice ou dado abaixo).
alter type os.origem_chamado add value if not exists 'modulo';

-- ---------------------------------------------------------------------------
-- Colunas
-- ---------------------------------------------------------------------------

alter table os.chamados
  add column acao_url text
    check (acao_url ~ '^/([^/\\[:space:]][^[:space:]]*)?$' and length(acao_url) <= 500),
  add column acao_rotulo text
    check (btrim(acao_rotulo) <> '' and length(acao_rotulo) <= 80),
  add column conclusao_externa boolean not null default false,
  add column origem_modulo text
    check (origem_modulo ~ '^[a-z][a-z0-9_]*$'),
  add column origem_ref text
    check (btrim(origem_ref) <> '' and length(origem_ref) <= 200),
  -- Sem o "Executar" ninguém chegaria à tela que conclui o chamado.
  add constraint chamados_conclusao_externa_tem_acao
    check (not conclusao_externa or acao_url is not null),
  add constraint chamados_origem_ref_tem_modulo
    check (origem_ref is null or origem_modulo is not null);

alter table os.ordens
  add column acao_url text
    check (acao_url ~ '^/([^/\\[:space:]][^[:space:]]*)?$' and length(acao_url) <= 500),
  add column acao_rotulo text
    check (btrim(acao_rotulo) <> '' and length(acao_rotulo) <= 80),
  add column conclusao_externa boolean not null default false,
  add column origem_modulo text
    check (origem_modulo ~ '^[a-z][a-z0-9_]*$'),
  add column origem_ref text
    check (btrim(origem_ref) <> '' and length(origem_ref) <= 200),
  add constraint ordens_conclusao_externa_tem_acao
    check (not conclusao_externa or acao_url is not null),
  add constraint ordens_origem_ref_tem_modulo
    check (origem_ref is null or origem_modulo is not null);

-- O módulo procura o chamado aberto dele (chamadoAbertoDaOrigem).
create index chamados_origem_aberto on os.chamados (origem_modulo, origem_ref)
  where origem_modulo is not null
    and status in ('aberto', 'em_andamento', 'aguardando');

-- ---------------------------------------------------------------------------
-- Quem pode: igual à de 20261028210000_os_sem_lixeira_importacao_exemplo.sql,
-- mais a trava da conclusão externa e das colunas que só o sistema grava.
-- ---------------------------------------------------------------------------

create or replace function os.validar_chamado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select auth.uid());
  v_gestor boolean;
  v_pediu boolean;
begin
  if v_eu is null or current_setting('os.sistema', true) = 'on' then
    return new;
  end if;
  v_gestor := os.gerencia(old.setor_id);
  v_pediu := old.aberto_por = v_eu;

  -- O que liga o chamado ao módulo de origem só o sistema grava.
  if new.acao_url is distinct from old.acao_url
     or new.acao_rotulo is distinct from old.acao_rotulo
     or new.conclusao_externa is distinct from old.conclusao_externa
     or new.origem_modulo is distinct from old.origem_modulo
     or new.origem_ref is distinct from old.origem_ref then
    raise exception 'a ligação do chamado com o módulo de origem não muda por aqui'
      using errcode = 'P0001';
  end if;

  -- Conclusão externa: conclui (ou fecha) só o módulo, pela service role.
  -- Confirmar ou reabrir o que o módulo concluiu e cancelar seguem as
  -- regras abaixo.
  if old.conclusao_externa
     and new.status in ('concluido', 'fechado')
     and old.status not in ('concluido', 'fechado') then
    raise exception 'este chamado fecha sozinho ao salvar o trabalho no módulo: use o botão Executar'
      using errcode = 'P0001';
  end if;

  if old.status in ('concluido', 'fechado', 'cancelado')
     and new.status = old.status
     and (
       new.responsavel_id is distinct from old.responsavel_id
       or new.prazo is distinct from old.prazo
       or new.prioridade is distinct from old.prioridade
       or new.setor_id is distinct from old.setor_id
       or new.categoria_id is distinct from old.categoria_id
     ) then
    raise exception 'chamado encerrado não muda responsável, prazo, prioridade nem setor'
      using errcode = 'P0001';
  end if;

  -- O único prazo novo que não é troca de prazo: o empurrado por
  -- os.ciclo_do_chamado ao sair de Aguardando (que roda antes deste
  -- gatilho, com o mesmo now() da transação).
  if (
       new.prazo is distinct from old.prazo
       and (
         case when old.status = 'aguardando' and new.status <> 'aguardando'
           then new.prazo is distinct from old.prazo + (now() - old.aguardando_desde)
           -- Fora disso, qualquer troca conta (inclusive apagar o prazo).
           else true
         end
       )
     )
     or new.prioridade is distinct from old.prioridade then
    if not (v_gestor or v_pediu) then
      raise exception 'só quem pediu ou quem gerencia o setor muda prazo e prioridade'
        using errcode = 'P0001';
    end if;
  end if;

  if new.setor_id is distinct from old.setor_id
     and not (v_gestor or (v_pediu and old.status = 'aberto')) then
    raise exception 'só quem gerencia o setor transfere o chamado' using errcode = 'P0001';
  end if;

  if new.responsavel_id is distinct from old.responsavel_id and not (
    v_gestor
    -- Assumir: estava sem responsável (ou quem pediu assume o próprio).
    or (new.responsavel_id = v_eu and (old.responsavel_id is null or v_pediu))
    -- Devolver à fila.
    or (old.responsavel_id = v_eu and new.responsavel_id is null)
    or (v_pediu and old.status = 'aberto')
  ) then
    raise exception 'só quem gerencia o setor troca o responsável' using errcode = 'P0001';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'cancelado' and not (v_gestor or v_pediu) then
      raise exception 'só quem pediu ou quem gerencia o setor cancela' using errcode = 'P0001';
    end if;
    -- Confirmar e reabrir: quem pediu (quem gerencia o setor também).
    if old.status = 'concluido' and not (v_pediu or v_gestor) then
      raise exception 'só quem pediu confirma ou reabre o chamado' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

-- Vários destinos: o último a concluir conclui o chamado pelo banco
-- (os.sincronizar_destinos, com os.sistema ligado), o que pularia a trava
-- acima. Por isso a pessoa também não conclui o destino de um chamado de
-- conclusão externa.
create function os.travar_destino_externo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or current_setting('os.sistema', true) = 'on'
     or new.status <> 'concluido'
     or old.status = 'concluido' then
    return new;
  end if;
  if exists (select 1 from os.chamados c where c.id = new.chamado_id and c.conclusao_externa)
     or exists (select 1 from os.ordens o where o.id = new.ordem_id and o.conclusao_externa) then
    raise exception 'este chamado fecha sozinho ao salvar o trabalho no módulo: use o botão Executar'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger travar_destino_externo before update of status on os.destinatarios
  for each row execute function os.travar_destino_externo();

-- ---------------------------------------------------------------------------
-- Modelo de entrada: a entrevista sai (o Sustentabilidade cria o chamado
-- dela, com prazo a partir da ativação, e cancela na rescisão).
-- ---------------------------------------------------------------------------

delete from os.modelo_itens i
using os.modelos m, os.setores s
where m.id = i.modelo_id
  and s.id = i.setor_id
  and m.gatilho = 'entrada'
  and s.nome = 'Sustentabilidade'
  and i.titulo = 'Entrevista com o cliente';

-- ---------------------------------------------------------------------------
-- Lojas: o que o Sustentabilidade lê do contrato (do ENET, quando houver
-- API; até lá, do cadastro manual).
-- ---------------------------------------------------------------------------

alter table os.lojas
  add column tipo_loja text,
  add column ramo text,
  add column ativacao date,
  add column rescisao date,
  add column piso text,
  add column rua text;

-- ---------------------------------------------------------------------------
-- Só o sistema (service role, sem auth.uid()) cria chamado de módulo: quem
-- tem sessão não forja origem_modulo/origem_ref (o módulo acharia o chamado
-- como dele) nem conclusao_externa (ninguém concluiria).
-- ---------------------------------------------------------------------------
create function os.limpar_campos_de_modulo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.acao_url := null;
    new.acao_rotulo := null;
    new.conclusao_externa := false;
    new.origem_modulo := null;
    new.origem_ref := null;
  end if;
  return new;
end;
$$;

create trigger limpar_campos_de_modulo before insert on os.chamados
  for each row execute function os.limpar_campos_de_modulo();
create trigger limpar_campos_de_modulo before insert on os.ordens
  for each row execute function os.limpar_campos_de_modulo();
