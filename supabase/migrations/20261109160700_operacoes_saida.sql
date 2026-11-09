-- operacoes_saida: o que faltava para a saída do ativo (Chamados) e para o
-- Painel de Operações, em cima do contrato 20261109160000_operacoes.
--
--   * Tipos de saída e formas de recebimento: listas editáveis nos
--     Parâmetros do Chamados (antes fixas na tela).
--   * Sobra sem cadastro (material de obra): cria o ativo e registra a
--     saída numa transação só, com a mesma permissão (os.ativos_saida).
--   * Ativo que saiu: os planos preventivos param (desfazer a saída religa
--     os que ela pausou), não volta a "em uso" sem desfazer a saída e não
--     recebe chamado nem OS novos.
--   * Feriados: o prazo de envio do rateio da limpeza (dia útil) aparece no
--     Painel de Operações, então quem usa Operações também lê os feriados.

-- ---------------------------------------------------------------------------
-- Parâmetros do Chamados: listas da saída do ativo
-- ---------------------------------------------------------------------------

alter table os.parametros
  add column ativos_saida_tipos text[] not null
    default '{Venda,Doação,Descarte,Devolução,Outro}'
    check (cardinality(ativos_saida_tipos) between 1 and 30),
  add column ativos_saida_formas text[] not null
    default '{Dinheiro,PIX,Outro}'
    check (cardinality(ativos_saida_formas) between 1 and 30);

-- ---------------------------------------------------------------------------
-- Sobra sem cadastro: cria o ativo e registra a saída de uma vez
-- ---------------------------------------------------------------------------

create function os.registrar_saida_sobra(
  p_nome text,
  p_categoria uuid,
  p_bloco text,
  p_area text,
  p_tipo text,
  p_data date,
  p_quantidade text,
  p_valor numeric,
  p_forma text,
  p_recebido_por text,
  p_destinatario text,
  p_documento text,
  p_responsavel uuid,
  p_motivo text,
  p_nf boolean,
  p_nf_numero text,
  p_observacoes text,
  p_anexos text[] default '{}'
)
returns table (ativo_id uuid, saida_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ativo uuid;
begin
  if not core.pode('os.ativos_saida') then
    raise exception 'sem permissão para registrar a saída do ativo' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_nome, ''))) < 2 then
    raise exception 'informe o que está saindo' using errcode = '22023';
  end if;
  insert into os.ativos (nome, categoria_id, bloco, area, observacao)
  values (
    left(btrim(p_nome), 200),
    p_categoria,
    nullif(btrim(coalesce(p_bloco, '')), ''),
    nullif(btrim(coalesce(p_area, '')), ''),
    'Sobra sem cadastro anterior: cadastrado na saída.'
  )
  returning id into v_ativo;
  return query select v_ativo, os.registrar_saida_ativo(
    v_ativo, p_tipo, p_data, p_quantidade, p_valor, p_forma, p_recebido_por,
    p_destinatario, p_documento, p_responsavel, p_motivo, p_nf, p_nf_numero,
    p_observacoes, p_anexos
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Gatilhos
-- ---------------------------------------------------------------------------

-- Saída registrada: os planos preventivos do ativo param (quem registra a
-- saída pode não ter os.ativos_gerenciar, que edita os planos). A saída
-- guarda quais pausou (planos_pausados), para o desfazer religar só esses.
-- Antes do insert: se a saída falhar, a pausa volta junto (mesma transação).
create function os.pausar_planos_na_saida()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  with pausados as (
    update os.planos_preventivos set ativo = false
      where ativo_id = new.ativo_id and ativo
      returning id
  )
  select coalesce(array_agg(id), '{}') into new.planos_pausados from pausados;
  return new;
end;
$$;

create trigger pausar_planos before insert on os.ativo_saidas
  for each row execute function os.pausar_planos_na_saida();

-- Ativo que saiu do Espaço ARP só volta a uso desfazendo a saída (com
-- motivo e registro de quem desfez), nunca pelo "Reativar".
create function os.manter_baixa_da_saida()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.situacao = 'baixado' and new.situacao <> 'baixado' and exists (
    select 1 from os.ativo_saidas s where s.ativo_id = new.id and s.desfeita_em is null
  ) then
    raise exception 'o ativo saiu do Espaço ARP: desfaça a saída para reativá-lo'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger manter_baixa_da_saida before update of situacao on os.ativos
  for each row execute function os.manter_baixa_da_saida();

-- Ativo baixado não recebe chamado nem OS novos (a lista de ativos para
-- vincular já os esconde; isto vale também para quem chega pelo endereço).
create function os.recusar_ativo_baixado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.ativo_id is not null
    and (tg_op = 'INSERT' or new.ativo_id is distinct from old.ativo_id)
    and exists (select 1 from os.ativos a where a.id = new.ativo_id and a.situacao = 'baixado')
  then
    raise exception 'o ativo está baixado e não recebe chamado nem OS'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger ativo_baixado before insert or update of ativo_id on os.chamados
  for each row execute function os.recusar_ativo_baixado();
create trigger ativo_baixado before insert or update of ativo_id on os.ordens
  for each row execute function os.recusar_ativo_baixado();

-- Relatório de saídas: filtros por tipo e por responsável.
create index ativo_saidas_tipo on os.ativo_saidas (tipo, data desc);

-- ---------------------------------------------------------------------------
-- Feriados: também para quem usa Operações (prazo do rateio no Painel)
-- ---------------------------------------------------------------------------

alter policy ver on os.feriados
  using (
    (select core.pode_modulo('os'))
    or (select core.pode_modulo('comercial'))
    or (select core.pode_modulo('operacoes'))
  );

-- ---------------------------------------------------------------------------
-- Acessos
-- ---------------------------------------------------------------------------

revoke all on function os.registrar_saida_sobra(text, uuid, text, text, text, date, text, numeric, text, text, text, text, uuid, text, boolean, text, text, text[]) from public, anon;
revoke all on function os.pausar_planos_na_saida() from public, anon;
revoke all on function os.manter_baixa_da_saida() from public, anon;
revoke all on function os.recusar_ativo_baixado() from public, anon;
grant execute on function os.registrar_saida_sobra(text, uuid, text, text, text, date, text, numeric, text, text, text, text, uuid, text, boolean, text, text, text[]) to authenticated;
