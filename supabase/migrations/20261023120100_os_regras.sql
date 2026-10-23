-- os: regras do módulo Chamados e OS (funções de acesso, ciclo de vida,
-- RLS e privilégios). Tabelas em 20261023120000_os.sql.
--
-- Quem vê um chamado: quem abriu, o responsável, os destinatários e
-- citados, a fila do próprio setor (sem responsável) e, com permissão, o
-- setor inteiro ou todos os setores. Dinheiro (valor por minuto,
-- materiais, terceirizado, rateio) fica em tabelas próprias, só com
-- os.custos. Arquivos ficam no bucket privado "os", que só o servidor lê,
-- depois de conferir o acesso pela linha de os.anexos (RLS) ou pelo token
-- do link. Lojista e terceirizado não são usuários: entram por link e o
-- servidor fala com o banco pela service role.

-- ---------------------------------------------------------------------------
-- Funções de acesso (security definer: o RLS das tabelas usa estas funções
-- sem cair em recursão)
-- ---------------------------------------------------------------------------

-- Setores do usuário logado.
create function os.meus_setores()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.setor_id
  from os.setor_membros m
  join core.usuarios u on u.id = m.usuario_id
  where m.usuario_id = (select auth.uid()) and u.ativo;
$$;

-- Pode trocar responsável, prazo e prioridade e cancelar chamados do setor.
create function os.gerencia(p_setor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select core.pode('os.gerenciar_setor')
    and (core.pode('os.todos_setores') or p_setor in (select os.meus_setores()));
$$;

-- Destinatário (pessoa, setor ou responsável do destino) ou participante.
create function os.envolvido(p_chamado uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1 from os.destinatarios d
      where d.chamado_id = p_chamado
        and (
          d.usuario_id = (select auth.uid())
          or d.responsavel_id = (select auth.uid())
          or d.setor_id in (select os.meus_setores())
        )
    )
    or exists (
      select 1 from os.participantes p
      where p.chamado_id = p_chamado and p.usuario_id = (select auth.uid())
    );
$$;

-- Quem vê um chamado (a mesma regra da política "ver" de os.chamados).
-- Quem gerencia o setor vê os chamados dele (senão não teria como trocar o
-- responsável).
create function os.ve_chamado(
  p_id uuid, p_setor uuid, p_aberto_por uuid, p_responsavel uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select core.pode_modulo('os') and (
    p_aberto_por = (select auth.uid())
    or p_responsavel = (select auth.uid())
    or core.pode('os.todos_setores')
    or core.pode('os.painel_geral')
    or (
      p_setor in (select os.meus_setores())
      and (
        p_responsavel is null
        or core.pode('os.meu_setor')
        or core.pode('os.painel_setor')
      )
    )
    or os.gerencia(p_setor)
    or os.envolvido(p_id)
  );
$$;

-- Quem mexe no chamado: quem abriu, o responsável, o setor dele, os
-- envolvidos e quem gerencia o setor, desde que veja o chamado (o colega
-- que não vê o chamado atribuído a outro também não anexa nem registra
-- tempo nele). O que cada um pode mudar fica no gatilho os.validar_chamado.
create function os.edita_chamado(
  p_id uuid, p_setor uuid, p_aberto_por uuid, p_responsavel uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select core.pode('os.acessar')
    and os.ve_chamado(p_id, p_setor, p_aberto_por, p_responsavel)
    and (
      p_aberto_por = (select auth.uid())
      or p_responsavel = (select auth.uid())
      or p_setor in (select os.meus_setores())
      or os.gerencia(p_setor)
      or os.envolvido(p_id)
      -- Lixeira: quem pode excluir alcança todo chamado que vê (o gatilho
      -- os.validar_chamado ainda limita o resto ao que cada um pode mudar).
      or core.pode('os.excluir')
    );
$$;

-- Quem pediu um chamado (conversão em OS mantém o solicitante).
create function os.solicitante_de(p_chamado uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select aberto_por from os.chamados where id = p_chamado;
$$;

-- As duas regras pelo id (para as tabelas filhas).
create function os.pode_ver_chamado(p_chamado uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from os.chamados c
    where c.id = p_chamado
      and os.ve_chamado(c.id, c.setor_id, c.aberto_por, c.responsavel_id)
  );
$$;

create function os.pode_editar_chamado(p_chamado uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from os.chamados c
    where c.id = p_chamado
      and os.edita_chamado(c.id, c.setor_id, c.aberto_por, c.responsavel_id)
  );
$$;

-- Pessoas que usam o módulo (para escolher responsável e citar com @). A
-- tabela core.usuarios só mostra o próprio usuário a quem não administra.
create function os.pessoas()
returns table (id uuid, nome text, setores uuid[])
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.nome,
    coalesce(array_agg(m.setor_id) filter (where m.setor_id is not null), '{}')
  from core.usuarios u
  left join os.setor_membros m on m.usuario_id = u.id
  where core.pode_modulo('os')
    and u.ativo
    and (
      exists (
        select 1 from core.usuario_permissoes up
        where up.usuario_id = u.id and up.permissao like 'os.%'
      )
      or exists (
        select 1 from core.cargo_permissoes cp
        join core.cargos c on c.id = cp.cargo_id
        where cp.cargo_id = u.cargo_id and cp.permissao like 'os.%' and c.ativo
      )
    )
  group by u.id, u.nome
  order by u.nome;
$$;

-- Ativos para vincular a um chamado (quem abre o chamado pode não ter
-- acesso à tela de Ativos).
create function os.ativos_para_vincular()
returns table (id uuid, codigo text, nome text, local text, situacao os.situacao_ativo)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.codigo, a.nome,
    concat_ws(' · ', a.bloco, l.nome, a.area, a.ponto),
    a.situacao
  from os.ativos a
  left join os.lojas l on l.id = a.loja_id
  where core.pode('os.acessar') and a.situacao <> 'baixado'
  order by a.codigo;
$$;

-- Manutenção por ativo (ficha, lista e sinal de troca): custo das OS (sem
-- canceladas) no período e desde sempre, corretivas e preventivas. Quem vê
-- ativos vê o sinal; o valor em reais a tela só mostra com os.custos.
create function os.resumo_ativos(p_desde date)
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
  select c.ativo_id,
    coalesce(sum(k.custo_total) filter (where c.criado_em >= p_desde), 0),
    coalesce(sum(k.custo_total), 0),
    count(*) filter (
      where c.criado_em >= p_desde and c.plano_id is null
        and not coalesce(cat.preventiva, false)
    ),
    count(*) filter (
      where c.criado_em >= p_desde
        and (c.plano_id is not null or coalesce(cat.preventiva, false))
    ),
    count(*) filter (where c.status in ('aberto', 'em_andamento', 'aguardando')),
    max(c.criado_em)
  from os.chamados c
  left join os.os_custos k on k.chamado_id = c.id
  left join os.categorias cat on cat.id = c.categoria_id
  where (core.pode('os.ativos') or core.pode('os.ativos_gerenciar'))
    and c.ativo_id is not null
    and c.tipo = 'os'
    and c.status <> 'cancelado'
    and c.lixeira_em is null
  group by c.ativo_id;
$$;

-- Próximo código de laudo: ARP01…ARP09, ARP10, ARP11… ARP100. O lpad só
-- completa até 2 dígitos (lpad de "100" em 2 cortaria para "10").
create function os.proximo_codigo_vistoria()
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select 'ARP' || lpad(n::text, greatest(2, length(n::text)), '0')
  from (
    select coalesce(max(substring(codigo from '^ARP(\d+)$')::int), 0) + 1 as n
    from os.vistorias
  ) as proximo;
$$;

alter table os.vistorias
  alter column codigo set default os.proximo_codigo_vistoria();

-- ---------------------------------------------------------------------------
-- Ciclo de vida do chamado (4.4)
-- ---------------------------------------------------------------------------

-- Transições permitidas (as mesmas de src/lib/os/ciclo.ts) e datas do
-- ciclo. Aguardando pausa o prazo: ao sair, o prazo é empurrado pelo tempo
-- parado e o tempo vai para aguardando_min (desconta dos indicadores).
create function os.ciclo_do_chamado()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_parado interval;
  v_permitidas os.status_chamado[];
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  v_permitidas := case old.status
    when 'aberto' then array['em_andamento', 'concluido', 'fechado', 'cancelado']
    when 'em_andamento' then array['aberto', 'aguardando', 'concluido', 'fechado', 'cancelado']
    when 'aguardando' then array['em_andamento', 'concluido', 'fechado', 'cancelado']
    when 'concluido' then array['fechado', 'em_andamento']
    else array[]::text[]
  end::os.status_chamado[];
  if not new.status = any (v_permitidas) then
    raise exception 'não é possível passar de % para %', old.status, new.status
      using errcode = 'P0001';
  end if;

  if old.status = 'aberto' and new.primeira_resposta_em is null then
    new.primeira_resposta_em := now();
  end if;

  if old.status = 'aguardando' and old.aguardando_desde is not null then
    v_parado := now() - old.aguardando_desde;
    new.aguardando_min := old.aguardando_min + floor(extract(epoch from v_parado) / 60)::int;
    if new.prazo is not null and new.prazo is not distinct from old.prazo then
      new.prazo := old.prazo + v_parado;
    end if;
    new.aguardando_desde := null;
  end if;

  case new.status
    when 'em_andamento' then
      new.iniciado_em := coalesce(new.iniciado_em, now());
      if old.status = 'concluido' then
        new.reaberto_vezes := old.reaberto_vezes + 1;
        new.concluido_em := null;
        new.concluido_por := null;
      end if;
    when 'aguardando' then
      new.aguardando_desde := now();
    when 'concluido' then
      new.concluido_em := now();
      new.concluido_por := coalesce(new.concluido_por, (select auth.uid()));
    when 'fechado' then
      new.fechado_em := now();
      new.fechado_por := case when new.fechado_automatico then null else (select auth.uid()) end;
      if new.concluido_em is null then
        new.concluido_em := now();
        new.concluido_por := coalesce(new.concluido_por, (select auth.uid()));
      end if;
    when 'cancelado' then
      new.cancelado_em := now();
      new.cancelado_por := (select auth.uid());
    else
      null;
  end case;
  return new;
end;
$$;

create trigger ciclo before update of status on os.chamados
  for each row execute function os.ciclo_do_chamado();

-- O que cada pessoa pode mudar. Sem usuário (service role, cron) ou em
-- ajuste feito pelo próprio banco (os.sincronizar_destinos), não se aplica.
create function os.validar_chamado()
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

  if new.lixeira_em is distinct from old.lixeira_em and not core.pode('os.excluir') then
    raise exception 'só quem pode excluir manda para a lixeira ou restaura'
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

create trigger validar before update on os.chamados
  for each row execute function os.validar_chamado();

-- Vários destinatários: o chamado anda junto. Começou um, o chamado fica Em
-- andamento; concluíram todos, o chamado conclui (ou fecha, se não precisa
-- de confirmação: Aviso, tarefa pessoal).
create function os.sincronizar_destinos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status os.status_chamado;
  v_total int;
  v_concluidos int;
  v_andando int;
begin
  select status into v_status from os.chamados where id = new.chamado_id;
  if v_status in ('fechado', 'cancelado') then
    return null;
  end if;
  select count(*),
    count(*) filter (where status = 'concluido'),
    count(*) filter (where status <> 'aberto')
    into v_total, v_concluidos, v_andando
    from os.destinatarios where chamado_id = new.chamado_id;

  perform set_config('os.sistema', 'on', true);
  if v_concluidos = v_total and v_status <> 'concluido' then
    update os.chamados
      set status = case
        when tipo = 'aviso' or pessoal or not precisa_confirmacao then 'fechado'::os.status_chamado
        else 'concluido'::os.status_chamado
      end
      where id = new.chamado_id;
  elsif v_concluidos < v_total and v_status = 'concluido' then
    update os.chamados set status = 'em_andamento' where id = new.chamado_id;
  elsif v_andando > 0 and v_status = 'aberto' then
    update os.chamados set status = 'em_andamento' where id = new.chamado_id;
  end if;
  perform set_config('os.sistema', 'off', true);
  return null;
end;
$$;

create trigger sincronizar after update of status on os.destinatarios
  for each row execute function os.sincronizar_destinos();

create function os.ciclo_do_destino()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'concluido' then
      new.concluido_em := now();
      new.concluido_por := coalesce(new.concluido_por, (select auth.uid()));
    else
      new.concluido_em := null;
      new.concluido_por := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger ciclo before update of status on os.destinatarios
  for each row execute function os.ciclo_do_destino();

-- OS com "ativo parado" fechou ou foi cancelada (inclusive pelo aceite
-- automático): o ativo volta a "Em uso". Não desfaz uma baixa nem um
-- "Parado" marcado à mão.
create function os.liberar_ativo_da_os()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('fechado', 'cancelado')
     and old.status is distinct from new.status
     and new.ativo_parado
     and new.ativo_id is not null then
    update os.ativos set situacao = 'em_uso'
      where id = new.ativo_id and situacao = 'em_manutencao';
  end if;
  return null;
end;
$$;

create trigger liberar_ativo after update of status on os.chamados
  for each row execute function os.liberar_ativo_da_os();

-- Situação do ativo: guarda os períodos (dias parado).
create function os.registrar_situacao_ativo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.situacao is not distinct from old.situacao then
    return null;
  end if;
  update os.ativo_situacoes set ate = now()
    where ativo_id = new.id and ate is null;
  insert into os.ativo_situacoes (ativo_id, situacao, usuario_id)
    values (new.id, new.situacao, (select auth.uid()));
  return null;
end;
$$;

create trigger situacao after insert or update of situacao on os.ativos
  for each row execute function os.registrar_situacao_ativo();

-- Subcategoria: só um nível, e do mesmo setor do pai.
create function os.validar_categoria()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_pai_setor uuid;
  v_pai_pai uuid;
begin
  if new.pai_id is null then
    return new;
  end if;
  select setor_id, pai_id into v_pai_setor, v_pai_pai
    from os.categorias where id = new.pai_id;
  if v_pai_pai is not null then
    raise exception 'subcategoria tem só um nível' using errcode = 'P0001';
  end if;
  if v_pai_setor <> new.setor_id then
    raise exception 'a subcategoria precisa ser do mesmo setor' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger validar before insert or update on os.categorias
  for each row execute function os.validar_categoria();

-- ---------------------------------------------------------------------------
-- Agenda
-- ---------------------------------------------------------------------------

-- Reserva de horário: confere o limite do dia, o choque com outro horário e
-- os bloqueios numa transação (dois lojistas ao mesmo tempo não passam do
-- limite). A janela e os dias da semana a tela já oferece certos.
create function os.reservar_horario(
  p_agenda uuid,
  p_inicio timestamptz,
  p_fim timestamptz,
  p_loja uuid,
  p_chamado uuid,
  p_observacao text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limite int;
  v_dia date := (p_inicio at time zone 'America/Sao_Paulo')::date;
  v_id uuid;
begin
  if (select auth.uid()) is not null and not core.pode('os.acessar') then
    raise exception 'sem permissão para marcar horário' using errcode = '42501';
  end if;
  select limite_por_dia into v_limite from os.agendas where id = p_agenda and ativo;
  if v_limite is null then
    raise exception 'agenda indisponível' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_agenda::text || v_dia::text));
  if (
    select count(*) from os.agendamentos
    where agenda_id = p_agenda and status = 'marcado'
      and (inicio at time zone 'America/Sao_Paulo')::date = v_dia
  ) >= v_limite then
    raise exception 'o limite de horários deste dia já foi atingido' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from os.agendamentos
    where agenda_id = p_agenda and status = 'marcado'
      and inicio < p_fim and fim > p_inicio
  ) then
    raise exception 'este horário acabou de ser ocupado' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from os.agenda_bloqueios
    where agenda_id = p_agenda and inicio < p_fim and fim > p_inicio
  ) then
    raise exception 'este horário está bloqueado' using errcode = 'P0001';
  end if;
  insert into os.agendamentos (agenda_id, chamado_id, loja_id, inicio, fim, observacao, criado_por)
    values (p_agenda, p_chamado, p_loja, p_inicio, p_fim, p_observacao, (select auth.uid()))
    returning id into v_id;
  return v_id;
end;
$$;

-- Bloqueio por clima: quem já tinha horário vai para "Remarcar".
create function os.remarcar_bloqueados()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update os.agendamentos set status = 'remarcar'
    where agenda_id = new.agenda_id and status = 'marcado'
      and inicio < new.fim and fim > new.inicio;
  return null;
end;
$$;

create trigger remarcar after insert on os.agenda_bloqueios
  for each row execute function os.remarcar_bloqueados();

-- ---------------------------------------------------------------------------
-- Custo da OS e importação
-- ---------------------------------------------------------------------------

-- Resultado do cálculo (src/lib/os/calculos.ts). Só o servidor grava,
-- depois de recalcular com o valor por minuto vigente em cada sessão.
create function os.gravar_calculo_os(p_chamado uuid, p_resultado jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into os.os_custos (
    chamado_id, minutos, minuto_homem, custo_mao_obra, custo_materiais,
    custo_total, valor_rateio, completo, memoria, calculado_em
  ) values (
    p_chamado,
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
  on conflict (chamado_id) do update set
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

-- Depois da importação (as OS mantêm o número antigo), a numeração dos
-- chamados novos continua acima do maior número que já existe.
create function os.ajustar_numeracao()
returns bigint
language sql
security definer
set search_path = ''
as $$
  select setval('os.chamado_numero_seq', x.m)
  from (select max(numero) as m from os.chamados) x
  where x.m is not null
    and x.m >= (
      select case when is_called then last_value else last_value - 1 end
      from os.chamado_numero_seq
    );
$$;

-- Desfaz uma importação: apaga só o que ela trouxe.
create function os.desfazer_importacao(p_importacao uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not core.pode('os.importacao') then
    raise exception 'sem permissão para desfazer a importação' using errcode = '42501';
  end if;
  delete from os.anexos where importacao_id = p_importacao;
  delete from os.sessoes where importacao_id = p_importacao;
  delete from os.agendamentos where importacao_id = p_importacao;
  delete from os.chamados where importacao_id = p_importacao;
  delete from os.vistorias where importacao_id = p_importacao;
  delete from os.ativos where importacao_id = p_importacao;
  delete from os.contatos where importacao_id = p_importacao;
  delete from os.profissionais where importacao_id = p_importacao;
  delete from os.empresas where importacao_id = p_importacao;
  -- Técnico que já está em OS nova fica (só perde o vínculo à importação).
  update os.tecnicos t set importacao_id = null
    where t.importacao_id = p_importacao
      and exists (select 1 from os.sessao_tecnicos st where st.tecnico_id = t.id);
  delete from os.tecnicos where importacao_id = p_importacao;
  update os.importacoes
    set status = 'desfeita', desfeito_em = now(), desfeito_por = (select auth.uid())
    where id = p_importacao;
end;
$$;

-- ---------------------------------------------------------------------------
-- atualizado_em e auditoria
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'setores', 'parametros', 'metas', 'agendas', 'categorias', 'lojas',
    'tecnicos', 'empresas', 'profissionais', 'contatos', 'ativo_categorias',
    'ativos', 'planos_preventivos', 'modelos', 'modelo_itens', 'vistorias',
    'vistoria_ambientes', 'chamados', 'destinatarios', 'sessoes', 'os_custos',
    'agendamentos'
  ] loop
    execute format(
      'create trigger atualizado_em before update on os.%I
         for each row execute function core.set_atualizado_em()', t);
  end loop;

  -- Cadastros, parâmetros e chamados: quem mudou, quando, antes e depois.
  foreach t in array array[
    'setores', 'metas', 'agendas', 'agenda_bloqueios', 'categorias', 'lojas',
    'tecnicos', 'tecnico_valores', 'empresas', 'profissionais', 'contatos',
    'ativo_categorias', 'ativos', 'planos_preventivos', 'modelos',
    'modelo_itens', 'vistorias', 'chamados', 'importacoes'
  ] loop
    execute format(
      'create trigger auditoria after insert or update or delete on os.%I
         for each row execute function core.auditar(''id'')', t);
  end loop;
end;
$$;

create trigger auditoria after update on os.parametros
  for each row execute function core.auditar('id');
create trigger auditoria after insert or update or delete on os.setor_membros
  for each row execute function core.auditar('setor_id', 'usuario_id');
create trigger auditoria after insert or update or delete on os.feriados
  for each row execute function core.auditar('data');
create trigger auditoria after insert or update or delete on os.os_custos
  for each row execute function core.auditar('chamado_id');
create trigger auditoria after insert or update or delete on os.material_valores
  for each row execute function core.auditar('material_id');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'os' loop
    execute format('alter table os.%I enable row level security', t);
  end loop;
end;
$$;

-- Configuração que todo o módulo lê.
create policy ver on os.setores for select to authenticated using (core.pode_modulo('os'));
create policy editar on os.setores for all to authenticated
  using (core.pode('os.catalogo')) with check (core.pode('os.catalogo'));

create policy ver on os.setor_membros for select to authenticated using (core.pode_modulo('os'));
create policy editar on os.setor_membros for all to authenticated
  using (core.pode('os.catalogo')) with check (core.pode('os.catalogo'));

create policy ver on os.parametros for select to authenticated using (core.pode_modulo('os'));
create policy editar on os.parametros for update to authenticated
  using (core.pode('os.parametros')) with check (core.pode('os.parametros'));

create policy ver on os.feriados for select to authenticated using (core.pode_modulo('os'));
create policy editar on os.feriados for all to authenticated
  using (core.pode('os.parametros')) with check (core.pode('os.parametros'));

create policy ver on os.metas for select to authenticated using (core.pode_modulo('os'));
create policy editar on os.metas for all to authenticated
  using (core.pode('os.parametros')) with check (core.pode('os.parametros'));

create policy ver on os.agendas for select to authenticated using (core.pode_modulo('os'));
create policy editar on os.agendas for all to authenticated
  using (core.pode('os.portal_agenda')) with check (core.pode('os.portal_agenda'));

create policy ver on os.agenda_bloqueios for select to authenticated using (core.pode_modulo('os'));
create policy editar on os.agenda_bloqueios for all to authenticated
  using (core.pode('os.portal_agenda')) with check (core.pode('os.portal_agenda'));

create policy ver on os.categorias for select to authenticated using (core.pode_modulo('os'));
create policy editar on os.categorias for all to authenticated
  using (core.pode('os.catalogo')) with check (core.pode('os.catalogo'));

create policy ver on os.lojas for select to authenticated using (core.pode_modulo('os'));
create policy editar on os.lojas for all to authenticated
  using (core.pode('os.portal')) with check (core.pode('os.portal'));

create policy ver on os.tecnicos for select to authenticated using (core.pode_modulo('os'));
create policy editar on os.tecnicos for all to authenticated
  using (core.pode('os.parametros')) with check (core.pode('os.parametros'));

-- Valor por minuto: só quem vê custos ou edita os parâmetros.
create policy ver on os.tecnico_valores for select to authenticated
  using (core.pode('os.custos') or core.pode('os.parametros'));
create policy editar on os.tecnico_valores for all to authenticated
  using (core.pode('os.parametros')) with check (core.pode('os.parametros'));

create policy ver on os.empresas for select to authenticated using (core.pode_modulo('os'));
create policy editar on os.empresas for all to authenticated
  using (core.pode('os.terceirizados')) with check (core.pode('os.terceirizados'));

create policy ver on os.profissionais for select to authenticated using (core.pode_modulo('os'));
create policy editar on os.profissionais for all to authenticated
  using (core.pode('os.terceirizados')) with check (core.pode('os.terceirizados'));

create policy ver on os.contatos for select to authenticated using (core.pode('os.acessar'));
create policy editar on os.contatos for all to authenticated
  using (core.pode('os.parametros') or core.pode('os.terceirizados'))
  with check (core.pode('os.parametros') or core.pode('os.terceirizados'));

-- Ativos
create policy ver on os.ativo_categorias for select to authenticated using (core.pode_modulo('os'));
create policy editar on os.ativo_categorias for all to authenticated
  using (core.pode('os.ativos_gerenciar') or core.pode('os.parametros'))
  with check (core.pode('os.ativos_gerenciar') or core.pode('os.parametros'));

create policy ver on os.ativos for select to authenticated
  using (core.pode('os.ativos') or core.pode('os.ativos_gerenciar'));
create policy editar on os.ativos for all to authenticated
  using (core.pode('os.ativos_gerenciar')) with check (core.pode('os.ativos_gerenciar'));

create policy ver on os.ativo_situacoes for select to authenticated
  using (core.pode('os.ativos') or core.pode('os.ativos_gerenciar'));

create policy ver on os.planos_preventivos for select to authenticated
  using (core.pode('os.ativos') or core.pode('os.ativos_gerenciar'));
create policy editar on os.planos_preventivos for all to authenticated
  using (core.pode('os.ativos_gerenciar')) with check (core.pode('os.ativos_gerenciar'));

-- Modelos
create policy ver on os.modelos for select to authenticated using (core.pode_modulo('os'));
create policy editar on os.modelos for all to authenticated
  using (core.pode('os.modelos')) with check (core.pode('os.modelos'));

create policy ver on os.modelo_itens for select to authenticated using (core.pode_modulo('os'));
create policy editar on os.modelo_itens for all to authenticated
  using (core.pode('os.modelos')) with check (core.pode('os.modelos'));

create policy ver on os.disparos for select to authenticated using (core.pode_modulo('os'));

-- Vistorias
create policy ver on os.vistorias for select to authenticated using (core.pode('os.vistorias'));
create policy editar on os.vistorias for all to authenticated
  using (core.pode('os.vistorias')) with check (core.pode('os.vistorias'));

create policy ver on os.vistoria_ambientes for select to authenticated
  using (core.pode('os.vistorias'));
create policy editar on os.vistoria_ambientes for all to authenticated
  using (core.pode('os.vistorias')) with check (core.pode('os.vistorias'));

-- Chamados
create policy ver on os.chamados for select to authenticated
  using (os.ve_chamado(id, setor_id, aberto_por, responsavel_id));
create policy abrir on os.chamados for insert to authenticated
  with check (
    core.pode('os.acessar')
    and (
      aberto_por = (select auth.uid())
      -- Converter em OS: a OS nova mantém quem pediu a original (é quem
      -- confirma no fim), se quem converte mexe na original.
      or (
        convertido_de_id is not null
        and os.pode_editar_chamado(convertido_de_id)
        and aberto_por is not distinct from os.solicitante_de(convertido_de_id)
      )
    )
  );
create policy editar on os.chamados for update to authenticated
  using (os.edita_chamado(id, setor_id, aberto_por, responsavel_id))
  with check (core.pode('os.acessar'));

-- Filhas do chamado: vê quem vê o chamado; mexe quem mexe no chamado.
create policy ver on os.destinatarios for select to authenticated
  using (os.pode_ver_chamado(chamado_id));
create policy editar on os.destinatarios for all to authenticated
  using (os.pode_editar_chamado(chamado_id)) with check (os.pode_editar_chamado(chamado_id));

create policy ver on os.participantes for select to authenticated
  using (os.pode_ver_chamado(chamado_id));
create policy editar on os.participantes for all to authenticated
  using (os.pode_ver_chamado(chamado_id)) with check (os.pode_ver_chamado(chamado_id));

-- A linha do tempo só cresce: ninguém edita nem apaga.
create policy ver on os.eventos for select to authenticated
  using (os.pode_ver_chamado(chamado_id));
create policy registrar on os.eventos for insert to authenticated
  with check (
    os.pode_ver_chamado(chamado_id)
    and (autor_id is null or autor_id = (select auth.uid()))
  );

create policy ver on os.anexos for select to authenticated
  using (
    (chamado_id is not null and os.pode_ver_chamado(chamado_id))
    or ((vistoria_id is not null or ambiente_id is not null) and core.pode('os.vistorias'))
    or (ativo_id is not null and (core.pode('os.ativos') or core.pode('os.ativos_gerenciar')))
  );
create policy enviar on os.anexos for insert to authenticated
  with check (
    (chamado_id is not null and os.pode_editar_chamado(chamado_id))
    or ((vistoria_id is not null or ambiente_id is not null) and core.pode('os.vistorias'))
    or (ativo_id is not null and core.pode('os.ativos_gerenciar'))
  );
create policy remover on os.anexos for delete to authenticated
  using (
    enviado_por = (select auth.uid())
    or ((vistoria_id is not null or ambiente_id is not null) and core.pode('os.vistorias'))
    or (ativo_id is not null and core.pode('os.ativos_gerenciar'))
  );

create policy ver on os.sessoes for select to authenticated
  using (os.pode_ver_chamado(chamado_id));
create policy editar on os.sessoes for all to authenticated
  using (os.pode_editar_chamado(chamado_id)) with check (os.pode_editar_chamado(chamado_id));

create policy ver on os.sessao_tecnicos for select to authenticated
  using (exists (
    select 1 from os.sessoes s where s.id = sessao_id and os.pode_ver_chamado(s.chamado_id)
  ));
create policy editar on os.sessao_tecnicos for all to authenticated
  using (exists (
    select 1 from os.sessoes s where s.id = sessao_id and os.pode_editar_chamado(s.chamado_id)
  ))
  with check (exists (
    select 1 from os.sessoes s where s.id = sessao_id and os.pode_editar_chamado(s.chamado_id)
  ));

create policy ver on os.materiais for select to authenticated
  using (os.pode_ver_chamado(chamado_id));
create policy editar on os.materiais for all to authenticated
  using (os.pode_editar_chamado(chamado_id)) with check (os.pode_editar_chamado(chamado_id));

-- Dinheiro: só com os.custos.
create policy ver on os.material_valores for select to authenticated
  using (core.pode('os.custos'));
create policy editar on os.material_valores for all to authenticated
  using (core.pode('os.custos')) with check (core.pode('os.custos'));

create policy ver on os.os_custos for select to authenticated
  using (core.pode('os.custos') and os.pode_ver_chamado(chamado_id));
create policy editar on os.os_custos for all to authenticated
  using (core.pode('os.custos') and os.pode_editar_chamado(chamado_id))
  with check (core.pode('os.custos') and os.pode_editar_chamado(chamado_id));

create policy ver on os.chamado_profissionais for select to authenticated
  using (os.pode_ver_chamado(chamado_id));
create policy editar on os.chamado_profissionais for all to authenticated
  using (os.pode_editar_chamado(chamado_id)) with check (os.pode_editar_chamado(chamado_id));

-- Links: o token é segredo; só quem gerencia (ou mexe na OS) vê.
create policy ver on os.terceirizado_links for select to authenticated
  using (core.pode('os.terceirizados') or os.pode_editar_chamado(chamado_id));
create policy editar on os.terceirizado_links for all to authenticated
  using (core.pode('os.terceirizados')) with check (core.pode('os.terceirizados'));

create policy ver on os.portal_links for select to authenticated using (core.pode('os.portal'));
create policy editar on os.portal_links for all to authenticated
  using (core.pode('os.portal')) with check (core.pode('os.portal'));

-- Agendamentos: todos do módulo veem a agenda (Calendário); marcar passa por
-- os.reservar_horario; remarcar e cancelar, quem configura a agenda ou quem
-- marcou.
create policy ver on os.agendamentos for select to authenticated using (core.pode_modulo('os'));
create policy editar on os.agendamentos for update to authenticated
  using (core.pode('os.portal_agenda') or criado_por = (select auth.uid()))
  with check (core.pode('os.portal_agenda') or criado_por = (select auth.uid()));

create policy proprias on os.notificacoes for select to authenticated
  using (usuario_id = (select auth.uid()));
create policy ler on os.notificacoes for update to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));

create policy ver on os.importacoes for select to authenticated using (core.pode('os.importacao'));
create policy editar on os.importacoes for all to authenticated
  using (core.pode('os.importacao')) with check (core.pode('os.importacao'));

-- ---------------------------------------------------------------------------
-- Privilégios (o RLS decide as linhas)
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on all tables in schema os to authenticated;
-- Linha do tempo, notificações, situações do ativo e disparos só crescem
-- pelo servidor ou pelos gatilhos.
revoke update, delete on os.eventos from authenticated;
-- Notificação: a pessoa só marca como lida.
revoke insert, update, delete on os.notificacoes from authenticated;
grant update (lida_em) on os.notificacoes to authenticated;
revoke insert, update, delete on os.ativo_situacoes from authenticated;
revoke insert, update, delete on os.disparos from authenticated;
revoke insert, delete on os.parametros from authenticated;
grant all on all tables in schema os to service_role;
grant usage, select on all sequences in schema os to authenticated, service_role;

revoke all on all functions in schema os from public, anon;
grant execute on function
  os.meus_setores(),
  os.gerencia(uuid),
  os.envolvido(uuid),
  os.ve_chamado(uuid, uuid, uuid, uuid),
  os.edita_chamado(uuid, uuid, uuid, uuid),
  os.pode_ver_chamado(uuid),
  os.pode_editar_chamado(uuid),
  os.solicitante_de(uuid),
  os.pessoas(),
  os.ativos_para_vincular(),
  os.resumo_ativos(date),
  os.proximo_codigo_vistoria(),
  os.reservar_horario(uuid, timestamptz, timestamptz, uuid, uuid, text),
  os.desfazer_importacao(uuid)
  to authenticated, service_role;
grant execute on function os.gravar_calculo_os(uuid, jsonb), os.ajustar_numeracao()
  to service_role;

-- ---------------------------------------------------------------------------
-- Storage: bucket privado. Só o servidor lê e grava (service role), depois
-- de conferir o acesso pela linha de os.anexos (RLS) ou pelo token do link.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('os', 'os', false);
