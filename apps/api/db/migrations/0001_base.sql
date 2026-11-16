--
-- PostgreSQL database dump
--


-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.12

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: calendario; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA calendario;


--
-- Name: comercial; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA comercial;


--
-- Name: core; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA core;


--
-- Name: financeiro; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA financeiro;


--
-- Name: formularios; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA formularios;


--
-- Name: integracao; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA integracao;


--
-- Name: marketing; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA marketing;


--
-- Name: operacoes; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA operacoes;


--
-- Name: os; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA os;


--
-- Name: rh; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA rh;


--
-- Name: sustentabilidade; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA sustentabilidade;


--
-- Name: competencia; Type: DOMAIN; Schema: core; Owner: -
--

CREATE DOMAIN core.competencia AS date
	CONSTRAINT competencia_check CHECK (((VALUE IS NULL) OR (EXTRACT(day FROM VALUE) = (1)::numeric)));


--
-- Name: direcao_meta; Type: TYPE; Schema: core; Owner: -
--

CREATE TYPE core.direcao_meta AS ENUM (
    'maior_melhor',
    'menor_melhor'
);


--
-- Name: status_importacao; Type: TYPE; Schema: core; Owner: -
--

CREATE TYPE core.status_importacao AS ENUM (
    'previa',
    'confirmada',
    'substituida',
    'revertida'
);


--
-- Name: tipo_importacao; Type: TYPE; Schema: core; Owner: -
--

CREATE TYPE core.tipo_importacao AS ENUM (
    'folha',
    'plano_saude'
);


--
-- Name: status_sync; Type: TYPE; Schema: integracao; Owner: -
--

CREATE TYPE integracao.status_sync AS ENUM (
    'rodando',
    'sucesso',
    'erro'
);


--
-- Name: execucao; Type: TYPE; Schema: os; Owner: -
--

CREATE TYPE os.execucao AS ENUM (
    'interna',
    'terceirizada'
);


--
-- Name: motivo_aguardando; Type: TYPE; Schema: os; Owner: -
--

CREATE TYPE os.motivo_aguardando AS ENUM (
    'material',
    'terceirizado',
    'lojista',
    'aprovacao',
    'outro'
);


--
-- Name: origem_chamado; Type: TYPE; Schema: os; Owner: -
--

CREATE TYPE os.origem_chamado AS ENUM (
    'sistema',
    'portal',
    'modelo',
    'preventiva',
    'recorrencia',
    'vistoria',
    'importacao',
    'modulo'
);


--
-- Name: periodo_visita; Type: TYPE; Schema: os; Owner: -
--

CREATE TYPE os.periodo_visita AS ENUM (
    'manha',
    'tarde',
    'noite'
);


--
-- Name: prioridade; Type: TYPE; Schema: os; Owner: -
--

CREATE TYPE os.prioridade AS ENUM (
    'baixa',
    'media',
    'alta',
    'urgente'
);


--
-- Name: regra_rateio; Type: TYPE; Schema: os; Owner: -
--

CREATE TYPE os.regra_rateio AS ENUM (
    'hora_trabalhada',
    'manual',
    'percentual',
    'terceirizado'
);


--
-- Name: resposta_ambiente; Type: TYPE; Schema: os; Owner: -
--

CREATE TYPE os.resposta_ambiente AS ENUM (
    'respondido',
    'nao_se_aplica',
    'pendente'
);


--
-- Name: situacao_ativo; Type: TYPE; Schema: os; Owner: -
--

CREATE TYPE os.situacao_ativo AS ENUM (
    'em_uso',
    'em_manutencao',
    'parado',
    'baixado'
);


--
-- Name: status_agendamento; Type: TYPE; Schema: os; Owner: -
--

CREATE TYPE os.status_agendamento AS ENUM (
    'marcado',
    'remarcar',
    'cancelado',
    'realizado'
);


--
-- Name: status_chamado; Type: TYPE; Schema: os; Owner: -
--

CREATE TYPE os.status_chamado AS ENUM (
    'aberto',
    'em_andamento',
    'aguardando',
    'concluido',
    'fechado',
    'cancelado'
);


--
-- Name: status_destino; Type: TYPE; Schema: os; Owner: -
--

CREATE TYPE os.status_destino AS ENUM (
    'aberto',
    'em_andamento',
    'aguardando',
    'concluido'
);


--
-- Name: status_vistoria; Type: TYPE; Schema: os; Owner: -
--

CREATE TYPE os.status_vistoria AS ENUM (
    'andamento',
    'finalizado',
    'cancelado'
);


--
-- Name: tipo_chamado; Type: TYPE; Schema: os; Owner: -
--

CREATE TYPE os.tipo_chamado AS ENUM (
    'tarefa',
    'solicitacao',
    'os',
    'aviso'
);


--
-- Name: tipo_vistoria; Type: TYPE; Schema: os; Owner: -
--

CREATE TYPE os.tipo_vistoria AS ENUM (
    'entrada',
    'saida',
    'preventiva',
    'extraordinaria'
);


--
-- Name: unidade_prazo; Type: TYPE; Schema: os; Owner: -
--

CREATE TYPE os.unidade_prazo AS ENUM (
    'horas',
    'dias_uteis'
);


--
-- Name: grupo_rubrica; Type: TYPE; Schema: rh; Owner: -
--

CREATE TYPE rh.grupo_rubrica AS ENUM (
    'salario',
    'pro_labore',
    'adicional',
    'hora_extra',
    'faltas_atrasos',
    'afastamento_empresa',
    'banco_horas',
    'verbas_sem_encargos',
    'adiantamento',
    'afastamento',
    'rescisao',
    'pagamento_provisionado',
    'beneficio_desconto',
    'desconto_terceiros',
    'imposto_funcionario',
    'arredondamento',
    'reembolso_inss',
    'informativa',
    'nao_classificada'
);


--
-- Name: natureza_rubrica; Type: TYPE; Schema: rh; Owner: -
--

CREATE TYPE rh.natureza_rubrica AS ENUM (
    'provento',
    'desconto',
    'informativa'
);


--
-- Name: origem_valor; Type: TYPE; Schema: rh; Owner: -
--

CREATE TYPE rh.origem_valor AS ENUM (
    'manual',
    'enet'
);


--
-- Name: regra_dependente; Type: TYPE; Schema: rh; Owner: -
--

CREATE TYPE rh.regra_dependente AS ENUM (
    'nao_paga',
    'percentual',
    'valor_fixo'
);


--
-- Name: situacao_folha; Type: TYPE; Schema: rh; Owner: -
--

CREATE TYPE rh.situacao_folha AS ENUM (
    'trabalhando',
    'ferias',
    'doenca',
    'acidente',
    'aposentadoria',
    'demitido'
);


--
-- Name: status_folha; Type: TYPE; Schema: rh; Owner: -
--

CREATE TYPE rh.status_folha AS ENUM (
    'importada',
    'conferida',
    'fechada'
);


--
-- Name: tipo_beneficio; Type: TYPE; Schema: rh; Owner: -
--

CREATE TYPE rh.tipo_beneficio AS ENUM (
    'plano_saude',
    'odonto',
    'alimentacao',
    'transporte',
    'seguro',
    'outro'
);


--
-- Name: tipo_contrato; Type: TYPE; Schema: rh; Owner: -
--

CREATE TYPE rh.tipo_contrato AS ENUM (
    'clt',
    'aprendiz',
    'estagiario',
    'pj',
    'pro_labore'
);


--
-- Name: concluir(uuid, boolean); Type: FUNCTION; Schema: calendario; Owner: -
--

CREATE FUNCTION calendario.concluir(p_item uuid, p_feito boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_item calendario.itens;
  v_tipo calendario.tipos;
  v_eu uuid := (select auth.uid());
begin
  if not core.pode('calendario.ver') then
    raise exception 'sem acesso ao calendário' using errcode = '42501';
  end if;
  select * into v_item from calendario.itens where id = p_item;
  if not found then
    raise exception 'item não encontrado' using errcode = 'P0001';
  end if;
  if not (
    v_item.criado_por = v_eu
    or v_item.responsavel_id = v_eu
    or (
      core.pode('calendario.editar_todos')
      and v_item.visibilidade <> 'privado'
      and (
        v_item.visibilidade = 'todos'
        or core.pode('calendario.ver_todos')
        or v_eu = any (v_item.usuarios)
        or v_item.setores && array(select os.meus_setores())
        or v_item.cargos && array(select calendario.meu_cargo())
      )
    )
  ) then
    raise exception 'só quem criou, o responsável ou quem edita todos conclui este item'
      using errcode = 'P0001';
  end if;
  select * into v_tipo from calendario.tipos where id = v_item.tipo_id;
  if not v_tipo.usa_conclusao then
    raise exception 'este tipo de item não se conclui' using errcode = 'P0001';
  end if;
  if v_item.recorrencia is not null then
    raise exception 'item que se repete não se conclui' using errcode = 'P0001';
  end if;
  update calendario.itens
    set concluido_em = case when p_feito then now() end,
        concluido_por = case when p_feito then v_eu end
    where id = p_item;
end;
$$;


--
-- Name: meu_cargo(); Type: FUNCTION; Schema: calendario; Owner: -
--

CREATE FUNCTION calendario.meu_cargo() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select u.cargo_id from core.usuarios u
  where u.id = (select auth.uid()) and u.ativo and u.cargo_id is not null;
$$;


--
-- Name: censo_resposta_conferir(); Type: FUNCTION; Schema: comercial; Owner: -
--

CREATE FUNCTION comercial.censo_resposta_conferir() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_situacao text;
  v_rodada uuid;
begin
  if new.convite_id is not null then
    select rodada_id into v_rodada from comercial.censo_convites where id = new.convite_id;
    if v_rodada is distinct from new.rodada_id then
      raise exception 'o convite é de outra rodada' using errcode = '22023';
    end if;
  end if;
  select situacao into v_situacao from comercial.censo_rodadas where id = new.rodada_id;
  if v_situacao = 'encerrada' then
    if tg_op = 'INSERT' and new.origem <> 'importacao' then
      raise exception 'a rodada do Censo está encerrada' using errcode = '22023';
    end if;
    if tg_op = 'UPDATE'
      and (to_jsonb(new) - 'considerada' - 'atualizado_em')
        is distinct from (to_jsonb(old) - 'considerada' - 'atualizado_em') then
      raise exception 'a rodada do Censo está encerrada' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;


--
-- Name: contrato_antes_de_gravar(); Type: FUNCTION; Schema: comercial; Owner: -
--

CREATE FUNCTION comercial.contrato_antes_de_gravar() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  new.atualizado_por := coalesce((select auth.uid()), new.atualizado_por);
  new.atualizado_em := now();
  if tg_op = 'UPDATE' then
    new.tipo := old.tipo;
    new.criado_por := old.criado_por;
    new.criado_em := old.criado_em;
    -- Mexer num contrato já gerado abre a versão seguinte.
    if old.status = 'gerado' and new.status <> 'gerado' then
      new.versao := old.versao + 1;
    else
      new.versao := old.versao;
    end if;
  end if;
  if new.status = 'gerado' and (tg_op = 'INSERT' or old.status <> 'gerado') then
    new.gerado_por := coalesce((select auth.uid()), new.gerado_por);
    new.gerado_em := now();
  end if;
  return new;
end;
$$;


--
-- Name: contrato_conferir(); Type: FUNCTION; Schema: comercial; Owner: -
--

CREATE FUNCTION comercial.contrato_conferir() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if new.status = 'gerado' and (tg_op = 'INSERT' or old.status not in ('pronto', 'gerado')) then
    raise exception 'o contrato só é gerado depois de pronto para gerar (Revisão)'
      using errcode = '22023';
  end if;
  if new.ficha_id is not null
    and (tg_op = 'INSERT' or new.ficha_id is distinct from old.ficha_id)
    and not exists (
      select 1 from comercial.fichas f
      where f.id = new.ficha_id and f.situacao in ('recebida', 'usada')
    ) then
    raise exception 'ficha não encontrada ou ainda não recebida' using errcode = '22023';
  end if;
  return new;
end;
$$;


--
-- Name: contrato_registrar_versao(); Type: FUNCTION; Schema: comercial; Owner: -
--

CREATE FUNCTION comercial.contrato_registrar_versao() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if tg_op = 'UPDATE'
    and (to_jsonb(new) - 'atualizado_em' - 'atualizado_por')
      = (to_jsonb(old) - 'atualizado_em' - 'atualizado_por') then
    return null;
  end if;
  insert into comercial.contrato_versoes (contrato_id, versao, status, etapa_atual, conteudo, por)
  values (new.id, new.versao, new.status, new.etapa_atual, to_jsonb(new), new.atualizado_por);
  -- A ficha escolhida passa a "Usada em contrato".
  if new.ficha_id is not null
    and (tg_op = 'INSERT' or new.ficha_id is distinct from old.ficha_id) then
    update comercial.fichas
      set situacao = 'usada', usada_em = coalesce(usada_em, now())
      where id = new.ficha_id and situacao = 'recebida';
  end if;
  return null;
end;
$$;


--
-- Name: desfazer_importacao(uuid); Type: FUNCTION; Schema: comercial; Owner: -
--

CREATE FUNCTION comercial.desfazer_importacao(p_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v comercial.importacoes;
  n int;
  total int := 0;
begin
  select * into v from comercial.importacoes where id = p_id for update;
  if v.id is null then
    raise exception 'importação não encontrada' using errcode = 'P0002';
  end if;
  if not comercial.pode_importar(v.tipo) then
    raise exception 'sem permissão para desfazer esta importação' using errcode = '42501';
  end if;
  if v.status not in ('confirmada', 'confirmando') then
    raise exception 'só uma importação confirmada pode ser desfeita' using errcode = '22023';
  end if;

  delete from comercial.censo_respostas where importacao_id = p_id;
  get diagnostics n = row_count; total := total + n;
  delete from comercial.censo_rodadas where importacao_id = p_id;
  delete from comercial.contatos where importacao_id = p_id;
  get diagnostics n = row_count; total := total + n;
  delete from comercial.fichas where importacao_id = p_id;
  get diagnostics n = row_count; total := total + n;
  delete from comercial.pesquisa_imoveis where importacao_id = p_id;
  get diagnostics n = row_count; total := total + n;

  update comercial.importacoes
    set status = 'desfeita', desfeito_por = (select auth.uid()), desfeito_em = now()
    where id = p_id;
  return total;
end;
$$;


--
-- Name: gravar_ficha_pelo_link(text, text, text, text, text, jsonb, text, boolean); Type: FUNCTION; Schema: comercial; Owner: -
--

CREATE FUNCTION comercial.gravar_ficha_pelo_link(p_token text, p_tipo text, p_luc text, p_nome text, p_documento text, p_respostas jsonb, p_assinatura text, p_enviar boolean) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_id uuid;
  f comercial.fichas;
begin
  update comercial.fichas
    set tipo = p_tipo,
        luc = p_luc,
        nome = p_nome,
        iniciada_em = coalesce(iniciada_em, now()),
        consentimento_em = coalesce(consentimento_em, now()),
        ultimo_acesso_em = now(),
        situacao = case when p_enviar then 'recebida' else situacao end,
        recebida_em = case when p_enviar then now() else recebida_em end
    where token = p_token
      and situacao = 'em_preenchimento'
      and cancelada_em is null
      and (expira_em is null or expira_em > now())
    returning id into v_id;
  if v_id is null then
    select * into f from comercial.fichas where token = p_token;
    return case
      when f.id is null then 'inexistente'
      when f.situacao <> 'em_preenchimento' then 'enviada'
      when f.cancelada_em is not null then 'cancelada'
      else 'expirada'
    end;
  end if;
  insert into comercial.ficha_dados (ficha_id, documento, respostas, assinatura_nome)
    values (v_id, p_documento, p_respostas, p_assinatura)
    on conflict (ficha_id) do update
      set documento = excluded.documento,
          respostas = excluded.respostas,
          assinatura_nome = excluded.assinatura_nome;
  return 'ok';
end;
$$;


--
-- Name: kit_nova_versao(); Type: FUNCTION; Schema: comercial; Owner: -
--

CREATE FUNCTION comercial.kit_nova_versao() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if new.atual then
    update comercial.kit_versoes set atual = false
      where documento_id = new.documento_id and atual and id <> new.id;
  end if;
  return new;
end;
$$;


--
-- Name: pode_importar(text); Type: FUNCTION; Schema: comercial; Owner: -
--

CREATE FUNCTION comercial.pode_importar(p_tipo text) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select case p_tipo
    when 'censo' then core.pode('comercial.censo.importar')
    when 'fichas' then core.pode('comercial.formulario.ver')
    when 'pesquisa' then core.pode('comercial.pesquisa.editar')
    when 'contatos' then core.pode('comercial.relacionamento.registrar')
    else false
  end;
$$;


--
-- Name: remover_exemplos(); Type: FUNCTION; Schema: comercial; Owner: -
--

CREATE FUNCTION comercial.remover_exemplos() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  r jsonb := '{}';
  n int;
begin
  if not core.pode('comercial.parametros.editar') then
    raise exception 'sem permissão para remover os dados de exemplo' using errcode = '42501';
  end if;
  delete from comercial.censo_sugestao_temas where exemplo;
  get diagnostics n = row_count; r := r || jsonb_build_object('censo_sugestao_temas', n);
  delete from comercial.contatos where exemplo;
  get diagnostics n = row_count; r := r || jsonb_build_object('contatos', n);
  delete from comercial.censo_respostas where exemplo;
  get diagnostics n = row_count; r := r || jsonb_build_object('censo_respostas', n);
  delete from comercial.censo_convites where exemplo;
  get diagnostics n = row_count; r := r || jsonb_build_object('censo_convites', n);
  delete from comercial.censo_rodadas where exemplo;
  get diagnostics n = row_count; r := r || jsonb_build_object('censo_rodadas', n);
  -- Tema de exemplo que já classifica sugestão real fica (vira tema do sistema).
  update comercial.censo_temas t set exemplo = false
    where t.exemplo
      and exists (select 1 from comercial.censo_sugestao_temas s where s.tema_id = t.id);
  delete from comercial.censo_temas where exemplo;
  get diagnostics n = row_count; r := r || jsonb_build_object('censo_temas', n);
  delete from comercial.contratos where exemplo;
  get diagnostics n = row_count; r := r || jsonb_build_object('contratos', n);
  delete from comercial.fichas where exemplo;
  get diagnostics n = row_count; r := r || jsonb_build_object('fichas', n);
  delete from comercial.propostas_evento where exemplo;
  get diagnostics n = row_count; r := r || jsonb_build_object('propostas_evento', n);
  delete from comercial.pesquisa_imoveis where exemplo;
  get diagnostics n = row_count; r := r || jsonb_build_object('pesquisa_imoveis', n);
  delete from comercial.ocupacao_fotos where exemplo;
  get diagnostics n = row_count; r := r || jsonb_build_object('ocupacao_fotos', n);
  return r;
end;
$$;


--
-- Name: sugestao_movida(); Type: FUNCTION; Schema: comercial; Owner: -
--

CREATE FUNCTION comercial.sugestao_movida() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if new.tema_id is distinct from old.tema_id then
    new.movido_por := (select auth.uid());
    new.movido_em := now();
  end if;
  return new;
end;
$$;


--
-- Name: auditar(); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.auditar() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  linha jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  chave text := '';
  i int;
begin
  for i in 0 .. tg_nargs - 1 loop
    chave := chave || case when i > 0 then ':' else '' end || coalesce(linha ->> tg_argv[i], '');
  end loop;

  insert into core.auditoria (tabela, registro_id, acao, antes, depois, usuario_id)
  values (
    tg_table_schema || '.' || tg_table_name,
    chave,
    lower(tg_op),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end,
    (select auth.uid())
  );
  return null;
end;
$$;


--
-- Name: criar_usuario(); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.criar_usuario() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  insert into core.usuarios (id, nome, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;


--
-- Name: estado_integracoes(); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.estado_integracoes() RETURNS TABLE(sistema text, ativa boolean, teste_ok boolean, testado_em timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select c.sistema, c.ativa, c.teste_ok, c.testado_em
  from integracao.credenciais c
  where (select auth.uid()) is not null;
$$;


--
-- Name: garantir_um_administrador(); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.garantir_um_administrador() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if (select auth.uid()) is null then
    return null;
  end if;
  if not exists (
    select 1
    from core.usuarios u
    where u.ativo
      and (
        exists (
          select 1 from core.usuario_permissoes up
          where up.usuario_id = u.id and up.permissao = 'admin.usuarios'
        )
        or exists (
          select 1 from core.cargo_permissoes cp
          join core.cargos c on c.id = cp.cargo_id
          where cp.cargo_id = u.cargo_id and c.ativo
            and cp.permissao = 'admin.usuarios'
        )
      )
  ) then
    raise exception 'é preciso manter pelo menos um administrador ativo'
      using errcode = 'P0001';
  end if;
  return null;
end;
$$;


--
-- Name: historico(text, text[], text, text, uuid, date, date, integer, integer); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.historico(p_busca text DEFAULT NULL::text, p_tabelas text[] DEFAULT NULL::text[], p_modulo text DEFAULT NULL::text, p_tipo text DEFAULT NULL::text, p_usuario uuid DEFAULT NULL::uuid, p_de date DEFAULT NULL::date, p_ate date DEFAULT NULL::date, p_limite integer DEFAULT 50, p_deslocamento integer DEFAULT 0) RETURNS TABLE(tipo text, id text, em timestamp with time zone, modulo text, usuario_id uuid, usuario_nome text, acao text, objeto text, registro_id text, descricao text, antes jsonb, depois jsonb, total bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  with eventos as (
    select 'alteracao' as tipo, 'a' || a.id as id, a.em,
      core.modulo_da_auditoria(a.tabela, coalesce(a.depois, a.antes)) as modulo,
      a.usuario_id, a.acao, a.tabela as objeto, a.registro_id,
      null::text as descricao, a.antes, a.depois
    from core.auditoria a
    union all
    select 'evento', 'l' || l.id, l.em, l.modulo, l.usuario_id, l.evento,
      null, null, l.descricao, null, l.detalhes
    from core.logs l
    union all
    select 'sincronizacao', 's' || r.id, r.iniciado_em, 'integracoes', null,
      r.status::text, r.sistema, r.recurso, left(r.erro, 300), null,
      jsonb_build_object(
        'finalizado_em', r.finalizado_em,
        'registros', r.registros,
        'avisos', case when jsonb_typeof(r.cursor_depois -> 'avisos') = 'array'
          then r.cursor_depois -> 'avisos' else '[]'::jsonb end
      )
    from integracao.sync_runs r
  ),
  filtrados as (
    select e.*, u.nome as usuario_nome
    from eventos e
    left join core.usuarios u on u.id = e.usuario_id
    where core.pode('admin.historico')
      and (p_modulo is null or e.modulo = p_modulo)
      and (p_tipo is null or e.tipo = p_tipo)
      and (p_usuario is null or e.usuario_id = p_usuario)
      and (p_de is null or e.em >= p_de::timestamp at time zone 'America/Sao_Paulo')
      and (p_ate is null or e.em < (p_ate + 1)::timestamp at time zone 'America/Sao_Paulo')
      and (
        nullif(btrim(p_busca), '') is null
        or e.objeto = any(coalesce(p_tabelas, '{}'))
        or strpos(
          core.sem_acento(concat_ws(' ', u.nome, e.acao, e.objeto, e.registro_id,
            e.descricao, e.antes::text, e.depois::text)),
          core.sem_acento(btrim(p_busca))
        ) > 0
      )
  )
  select f.tipo, f.id, f.em, f.modulo, f.usuario_id, f.usuario_nome, f.acao,
    f.objeto, f.registro_id, f.descricao, f.antes, f.depois,
    count(*) over () as total
  from filtrados f
  order by f.em desc, f.id desc
  limit least(greatest(p_limite, 1), 200)
  offset greatest(p_deslocamento, 0);
$$;


--
-- Name: historico_autores(); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.historico_autores() RETURNS TABLE(id uuid, nome text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select u.id, u.nome
  from core.usuarios u
  where core.pode('admin.historico')
  order by u.nome;
$$;


--
-- Name: historico_integracoes(integer); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.historico_integracoes(p_limite integer DEFAULT 20) RETURNS TABLE(sistema text, recurso text, status integracao.status_sync, iniciado_em timestamp with time zone, finalizado_em timestamp with time zone, registros integer, erro text, avisos jsonb)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select r.sistema, r.recurso, r.status, r.iniciado_em, r.finalizado_em,
    r.registros, left(r.erro, 300),
    case when jsonb_typeof(r.cursor_depois -> 'avisos') = 'array'
      then r.cursor_depois -> 'avisos' else '[]'::jsonb end
  from integracao.sync_runs r
  where core.pode('admin.integracoes')
  order by r.iniciado_em desc
  limit least(greatest(p_limite, 1), 100);
$$;


--
-- Name: integracoes_configuradas(); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.integracoes_configuradas() RETURNS TABLE(sistema text, parametros jsonb, ativa boolean, configurado_por text, configurado_em timestamp with time zone, testado_em timestamp with time zone, teste_ok boolean, teste_mensagem text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select c.sistema, c.parametros, c.ativa, u.nome, c.configurado_em,
    c.testado_em, c.teste_ok, c.teste_mensagem
  from integracao.credenciais c
  left join core.usuarios u on u.id = c.configurado_por
  where core.pode_integracao(c.sistema)
  order by c.sistema;
$$;


--
-- Name: minhas_permissoes(); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.minhas_permissoes() RETURNS SETOF text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select up.permissao
  from core.usuario_permissoes up
  join core.usuarios u on u.id = up.usuario_id
  where u.id = (select auth.uid()) and u.ativo
  union
  select cp.permissao
  from core.cargo_permissoes cp
  join core.cargos c on c.id = cp.cargo_id and c.ativo
  join core.usuarios u on u.cargo_id = cp.cargo_id
  where u.id = (select auth.uid()) and u.ativo;
$$;


--
-- Name: modulo_da_auditoria(text, jsonb); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.modulo_da_auditoria(p_tabela text, p_linha jsonb) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select case
    when p_tabela like 'rh.%' then 'rh'
    when p_tabela like 'financeiro.%' then 'financeiro'
    when p_tabela like 'os.%' then 'os'
    when p_tabela like 'comercial.%' then 'comercial'
    when p_tabela like 'operacoes.%' then 'operacoes'
    when p_tabela like 'sustentabilidade.%' then 'sustentabilidade'
    when p_tabela like 'integracao.%' then 'integracoes'
    when p_tabela = 'core.metas' then
      case split_part(p_linha ->> 'indicador', '.', 1)
        when 'rh' then 'rh'
        when 'financeiro' then 'financeiro'
        when 'comercial' then 'comercial'
        when 'sustentabilidade' then 'sustentabilidade'
        else 'admin'
      end
    when p_tabela = 'core.importacoes' then
      case when p_linha ->> 'tipo' in ('folha', 'plano_saude') then 'rh' else 'financeiro' end
    else 'admin'
  end;
$$;


--
-- Name: pode(text); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.pode(p text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from core.usuarios u
    where u.id = (select auth.uid())
      and u.ativo
      and (
        exists (
          select 1 from core.usuario_permissoes up
          where up.usuario_id = u.id and up.permissao = p
        )
        or exists (
          select 1 from core.cargo_permissoes cp
          join core.cargos c on c.id = cp.cargo_id
          where cp.cargo_id = u.cargo_id and c.ativo and cp.permissao = p
        )
      )
  );
$$;


--
-- Name: pode_importar(core.tipo_importacao); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.pode_importar(t core.tipo_importacao) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select case t
    when 'folha' then core.pode('rh.folha')
    when 'plano_saude' then core.pode('rh.beneficios')
  end;
$$;


--
-- Name: pode_integracao(text); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.pode_integracao(p_sistema text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select (select core.pode('admin.integracoes'))
    or (
      p_sistema like 'mkt\_%'
      and p_sistema <> 'mkt_rd_station'
      and (select core.pode('marketing.parametros'))
    );
$$;


--
-- Name: pode_modulo(text); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.pode_modulo(modulo text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from core.usuarios u
    where u.id = (select auth.uid())
      and u.ativo
      and (
        exists (
          select 1 from core.usuario_permissoes up
          where up.usuario_id = u.id and up.permissao like modulo || '.%'
        )
        or exists (
          select 1 from core.cargo_permissoes cp
          join core.cargos c on c.id = cp.cargo_id
          where cp.cargo_id = u.cargo_id and c.ativo
            and cp.permissao like modulo || '.%'
        )
      )
  );
$$;


--
-- Name: registrar_teste_integracao(text, boolean, text); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.registrar_teste_integracao(p_sistema text, p_ok boolean, p_mensagem text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if not core.pode_integracao(p_sistema) then
    raise exception 'sem permissão para configurar integrações' using errcode = '42501';
  end if;
  update integracao.credenciais set
    testado_em = now(),
    teste_ok = p_ok,
    teste_mensagem = left(p_mensagem, 2000)
  where sistema = p_sistema;
end;
$$;


--
-- Name: remover_integracao(text); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.remover_integracao(p_sistema text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  anterior jsonb;
begin
  if not core.pode_integracao(p_sistema) then
    raise exception 'sem permissão para configurar integrações' using errcode = '42501';
  end if;
  delete from integracao.credenciais c
    where c.sistema = p_sistema
    returning jsonb_build_object('parametros', c.parametros, 'ativa', c.ativa)
    into anterior;
  if anterior is not null then
    insert into core.auditoria (tabela, registro_id, acao, antes, depois, usuario_id)
    values ('integracao.credenciais', p_sistema, 'delete', anterior, null, (select auth.uid()));
  end if;
end;
$$;


--
-- Name: salvar_integracao(text, jsonb, text, boolean); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.salvar_integracao(p_sistema text, p_parametros jsonb, p_segredo_cifrado text, p_ativa boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  anterior jsonb;
begin
  if not core.pode_integracao(p_sistema) then
    raise exception 'sem permissão para configurar integrações' using errcode = '42501';
  end if;

  select jsonb_build_object('parametros', c.parametros, 'ativa', c.ativa)
    into anterior
    from integracao.credenciais c
    where c.sistema = p_sistema;

  if anterior is null then
    if p_segredo_cifrado is null then
      raise exception 'informe a senha ou o token' using errcode = '22023';
    end if;
    insert into integracao.credenciais
      (sistema, parametros, segredo_cifrado, ativa, configurado_por)
    values
      (p_sistema, coalesce(p_parametros, '{}'), p_segredo_cifrado,
       coalesce(p_ativa, true), (select auth.uid()));
  else
    update integracao.credenciais c set
      parametros = coalesce(p_parametros, '{}'),
      segredo_cifrado = coalesce(p_segredo_cifrado, c.segredo_cifrado),
      ativa = coalesce(p_ativa, c.ativa),
      configurado_por = (select auth.uid()),
      configurado_em = now(),
      testado_em = null,
      teste_ok = null,
      teste_mensagem = null
    where c.sistema = p_sistema;
  end if;

  insert into core.auditoria (tabela, registro_id, acao, antes, depois, usuario_id)
  values (
    'integracao.credenciais',
    p_sistema,
    case when anterior is null then 'insert' else 'update' end,
    anterior,
    jsonb_build_object(
      'parametros', coalesce(p_parametros, '{}'),
      'ativa', coalesce(p_ativa, true),
      'segredo_trocado', p_segredo_cifrado is not null
    ),
    (select auth.uid())
  );
end;
$$;


--
-- Name: saude_integracoes(); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.saude_integracoes() RETURNS TABLE(sistema text, recurso text, status integracao.status_sync, iniciado_em timestamp with time zone, finalizado_em timestamp with time zone, registros integer, ultimo_sucesso timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select distinct on (r.sistema, r.recurso)
    r.sistema,
    r.recurso,
    r.status,
    r.iniciado_em,
    r.finalizado_em,
    r.registros,
    (
      select max(s.finalizado_em)
      from integracao.sync_runs s
      where s.sistema = r.sistema and s.recurso = r.recurso and s.status = 'sucesso'
    )
  from integracao.sync_runs r
  where (select auth.uid()) is not null
  order by r.sistema, r.recurso, r.iniciado_em desc;
$$;


--
-- Name: sem_acento(text); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.sem_acento(t text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select translate(lower(t), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn');
$$;


--
-- Name: set_atualizado_em(); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.set_atualizado_em() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;


--
-- Name: gravar_estacionamento(integer, jsonb, uuid); Type: FUNCTION; Schema: financeiro; Owner: -
--

CREATE FUNCTION financeiro.gravar_estacionamento(p_estacionamento_id integer, p_dias jsonb, p_sync_run_id uuid) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_datas date[];
  n int;
begin
  select coalesce(array_agg((d ->> 'data')::date), '{}')
    into v_datas
    from jsonb_array_elements(p_dias) d;

  delete from financeiro.estacionamento_pagamentos
    where estacionamento_id = p_estacionamento_id and data = any (v_datas);
  delete from financeiro.estacionamento_movimento
    where estacionamento_id = p_estacionamento_id and data = any (v_datas);

  -- Já gravado em outro dia (fora de p_dias): passa para o dia informado.
  -- Dentro de p_dias cada wps_codigo vem uma vez só (a sincronização garante).
  insert into financeiro.estacionamento_pagamentos (
    estacionamento_id, wps_codigo, data, pago_em, tipo_cliente, ticket, recibo,
    forma_pagamento, forma_pagamento_codigo, grupos, valor_bruto,
    valor_desconto, valor_liquido, parcial, terminal, tarifa, sync_run_id
  )
  select
    p_estacionamento_id,
    (p ->> 'wps_codigo')::bigint,
    (d ->> 'data')::date,
    (p ->> 'pago_em')::timestamp,
    p ->> 'tipo_cliente',
    p ->> 'ticket',
    p ->> 'recibo',
    p ->> 'forma_pagamento',
    (p ->> 'forma_pagamento_codigo')::int,
    array(select jsonb_array_elements_text(p -> 'grupos')),
    (p ->> 'valor_bruto')::numeric,
    coalesce((p ->> 'valor_desconto')::numeric, 0),
    (p ->> 'valor_liquido')::numeric,
    coalesce((p ->> 'parcial')::int, 0),
    p ->> 'terminal',
    p ->> 'tarifa',
    p_sync_run_id
  from jsonb_array_elements(p_dias) d,
    jsonb_array_elements(d -> 'pagamentos') p
  on conflict (estacionamento_id, wps_codigo) do update set
    data = excluded.data,
    pago_em = excluded.pago_em,
    tipo_cliente = excluded.tipo_cliente,
    ticket = excluded.ticket,
    recibo = excluded.recibo,
    forma_pagamento = excluded.forma_pagamento,
    forma_pagamento_codigo = excluded.forma_pagamento_codigo,
    grupos = excluded.grupos,
    valor_bruto = excluded.valor_bruto,
    valor_desconto = excluded.valor_desconto,
    valor_liquido = excluded.valor_liquido,
    parcial = excluded.parcial,
    terminal = excluded.terminal,
    tarifa = excluded.tarifa,
    sync_run_id = excluded.sync_run_id;
  get diagnostics n = row_count;

  insert into financeiro.estacionamento_movimento (
    estacionamento_id, data, tipo_veiculo, entradas, saidas, sync_run_id
  )
  select
    p_estacionamento_id,
    (d ->> 'data')::date,
    m ->> 'tipo_veiculo',
    (m ->> 'entradas')::int,
    (m ->> 'saidas')::int,
    p_sync_run_id
  from jsonb_array_elements(p_dias) d,
    jsonb_array_elements(d -> 'movimento') m;

  return n;
end;
$$;


--
-- Name: descontar_resposta(); Type: FUNCTION; Schema: formularios; Owner: -
--

CREATE FUNCTION formularios.descontar_resposta() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  update formularios.formularios
    set total_respostas = greatest(total_respostas - 1, 0),
        ultima_resposta_em = (
          select max(enviada_em) from formularios.respostas where formulario_id = old.formulario_id
        )
    where id = old.formulario_id;
  return old;
end;
$$;


--
-- Name: responder(text, jsonb, jsonb); Type: FUNCTION; Schema: formularios; Owner: -
--

CREATE FUNCTION formularios.responder(p_token text, p_respostas jsonb, p_perguntas jsonb) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  f formularios.formularios%rowtype;
  novo uuid;
begin
  select * into f from formularios.formularios where token = p_token for update;
  if not found then
    raise exception 'formulário não encontrado' using errcode = 'P0002';
  end if;
  if f.situacao <> 'publicado'
    or (f.encerra_em is not null and f.encerra_em <= now())
    or (f.limite_respostas is not null and f.total_respostas >= f.limite_respostas) then
    raise exception 'formulário encerrado' using errcode = 'P0001';
  end if;

  insert into formularios.respostas (formulario_id, respostas, perguntas)
    values (f.id, p_respostas, p_perguntas)
    returning id into novo;

  update formularios.formularios
    set total_respostas = total_respostas + 1,
        ultima_resposta_em = now(),
        situacao = case
          when limite_respostas is not null and total_respostas + 1 >= limite_respostas
            then 'encerrado'
          else situacao
        end
    where id = f.id;
  return novo;
end;
$$;


--
-- Name: desfazer_versao(bigint); Type: FUNCTION; Schema: marketing; Owner: -
--

CREATE FUNCTION marketing.desfazer_versao(p_versao bigint) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v marketing.marca_versoes;
  n int;
begin
  select * into v from marketing.marca_versoes where id = p_versao;
  if v.id is null then
    raise exception 'versão não encontrada' using errcode = 'P0002';
  end if;
  if v.antes is null then
    raise exception 'a versão inicial não tem o que desfazer' using errcode = '22023';
  end if;
  if exists (
    select 1 from marketing.marca_blocos where chave = v.bloco and conteudo = v.antes
  ) then
    raise exception 'o bloco já está como antes desta alteração' using errcode = '22023';
  end if;
  perform set_config('marketing.desfaz', p_versao::text, true);
  update marketing.marca_blocos set conteudo = v.antes where chave = v.bloco;
  get diagnostics n = row_count;
  perform set_config('marketing.desfaz', '', true);
  if n = 0 then
    raise exception 'sem permissão para editar a marca' using errcode = '42501';
  end if;
  return (select versao from marketing.marca_blocos where chave = v.bloco);
end;
$$;


--
-- Name: marca_nova_versao(); Type: FUNCTION; Schema: marketing; Owner: -
--

CREATE FUNCTION marketing.marca_nova_versao() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if new.conteudo is not distinct from old.conteudo then
    return null; -- nada mudou: nem versão nova
  end if;
  new.versao := old.versao + 1;
  new.atualizado_por := (select auth.uid());
  new.atualizado_em := now();
  return new;
end;
$$;


--
-- Name: marca_registrar_versao(); Type: FUNCTION; Schema: marketing; Owner: -
--

CREATE FUNCTION marketing.marca_registrar_versao() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  insert into marketing.marca_versoes (bloco, versao, antes, depois, desfaz, por)
  values (
    new.chave,
    new.versao,
    case when tg_op = 'UPDATE' then old.conteudo end,
    new.conteudo,
    nullif(current_setting('marketing.desfaz', true), '')::bigint,
    (select auth.uid())
  );
  return null;
end;
$$;


--
-- Name: acessa(); Type: FUNCTION; Schema: operacoes; Owner: -
--

CREATE FUNCTION operacoes.acessa() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select core.pode_modulo('operacoes');
$$;


--
-- Name: caixa_sem_termo_externo(); Type: FUNCTION; Schema: operacoes; Owner: -
--

CREATE FUNCTION operacoes.caixa_sem_termo_externo() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if new.ocupante is distinct from old.ocupante then
    new.termo_externo := false;
  end if;
  return new;
end;
$$;


--
-- Name: confirmar_importacao(uuid, text); Type: FUNCTION; Schema: operacoes; Owner: -
--

CREATE FUNCTION operacoes.confirmar_importacao(p_id uuid, p_motivo text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v operacoes.importacoes;
  v_anterior uuid;
begin
  select * into v from operacoes.importacoes where id = p_id for update;
  if not found then
    raise exception 'importação não encontrada' using errcode = 'P0001';
  end if;
  if not operacoes.pode_importar(v.tipo) then
    raise exception 'sem permissão para importar este tipo' using errcode = '42501';
  end if;
  if v.status <> 'previa' then
    raise exception 'só uma prévia pode ser confirmada' using errcode = '22023';
  end if;
  if v.bate is false and nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'os totais não batem com o resumo do arquivo: informe o motivo para confirmar assim mesmo'
      using errcode = '22023';
  end if;

  if v.tipo = 'agua' then
    select id into v_anterior from operacoes.importacoes
      where tipo = 'agua' and status = 'confirmada' and referencia = v.referencia
      for update;
    if v_anterior is not null then
      update operacoes.agua_leituras set vigente = false where importacao_id = v_anterior;
      update operacoes.importacoes set status = 'substituida' where id = v_anterior;
    end if;
    update operacoes.agua_leituras set vigente = true where importacao_id = p_id;
  elsif v.tipo = 'agua_conta' then
    if not exists (select 1 from operacoes.agua_contas where importacao_id = p_id) then
      raise exception 'a prévia não tem a conta lida' using errcode = '22023';
    end if;
    -- A conta da mesma matrícula e mês que valia passa a ser a anterior.
    select c.importacao_id into v_anterior
      from operacoes.agua_contas c
      join operacoes.agua_contas n
        on n.importacao_id = p_id and n.matricula = c.matricula and n.referencia = c.referencia
      where c.vigente
      limit 1;
    if v_anterior is not null then
      perform 1 from operacoes.importacoes where id = v_anterior for update;
      update operacoes.agua_contas set vigente = false where importacao_id = v_anterior;
      update operacoes.importacoes set status = 'substituida' where id = v_anterior;
    end if;
    update operacoes.agua_contas set vigente = true where importacao_id = p_id;
  elsif v.tipo = 'orcamento' then
    update operacoes.orcamento_revisoes r set vigente = false
      where r.vigente and r.obra_id in (
        select obra_id from operacoes.orcamento_revisoes where importacao_id = p_id);
    update operacoes.orcamento_revisoes set vigente = true where importacao_id = p_id;
  end if;

  update operacoes.importacoes set
    status = 'confirmada',
    substitui = coalesce(v_anterior, substitui),
    incompleta = coalesce(v.bate is false, false),
    motivo = case when v.bate is false then btrim(p_motivo) else motivo end,
    confirmado_por = (select auth.uid()),
    confirmado_em = now()
  where id = p_id;
end;
$$;


--
-- Name: desfazer_importacao(uuid); Type: FUNCTION; Schema: operacoes; Owner: -
--

CREATE FUNCTION operacoes.desfazer_importacao(p_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v operacoes.importacoes;
  v_apagadas int := 0;
  v_obra uuid;
begin
  select * into v from operacoes.importacoes where id = p_id for update;
  if not found then
    raise exception 'importação não encontrada' using errcode = 'P0001';
  end if;
  if not operacoes.pode_importar(v.tipo) then
    raise exception 'sem permissão para desfazer esta importação' using errcode = '42501';
  end if;
  if v.status not in ('previa', 'confirmada') then
    raise exception 'esta importação já foi desfeita ou substituída' using errcode = '22023';
  end if;

  -- Sai primeiro (um mês de água confirmado por vez), depois o anterior volta.
  update operacoes.importacoes set
    status = case when v.status = 'previa' then 'cancelada' else 'desfeita' end,
    desfeito_por = (select auth.uid()),
    desfeito_em = now()
  where id = p_id;

  if v.tipo = 'agua' then
    update operacoes.agua_leituras set vigente = false where importacao_id = p_id and vigente;
    delete from operacoes.agua_leituras where importacao_id = p_id;
    get diagnostics v_apagadas = row_count;
    if v.status = 'confirmada' and v.substitui is not null then
      update operacoes.importacoes set status = 'confirmada' where id = v.substitui and status = 'substituida';
      update operacoes.agua_leituras set vigente = true where importacao_id = v.substitui;
    end if;
  elsif v.tipo = 'agua_conta' then
    delete from operacoes.agua_contas where importacao_id = p_id;
    get diagnostics v_apagadas = row_count;
    if v.status = 'confirmada' and v.substitui is not null then
      update operacoes.importacoes set status = 'confirmada' where id = v.substitui and status = 'substituida';
      update operacoes.agua_contas set vigente = true where importacao_id = v.substitui;
    end if;
  elsif v.tipo = 'energisa' then
    delete from operacoes.energia_faturas where importacao_id = p_id;
    get diagnostics v_apagadas = row_count;
  elsif v.tipo = 'orcamento' then
    select obra_id into v_obra from operacoes.orcamento_revisoes where importacao_id = p_id limit 1;
    delete from operacoes.obra_realizado where importacao_id = p_id;
    delete from operacoes.orcamento_revisoes where importacao_id = p_id;
    get diagnostics v_apagadas = row_count;
    if v_obra is not null and not exists (
      select 1 from operacoes.orcamento_revisoes where obra_id = v_obra and vigente
    ) then
      update operacoes.orcamento_revisoes set vigente = true
        where id = (
          select r.id from operacoes.orcamento_revisoes r
          left join operacoes.importacoes i on i.id = r.importacao_id
          where r.obra_id = v_obra and (r.importacao_id is null or i.status = 'confirmada')
          order by r.codigo desc limit 1);
    end if;
  elsif v.tipo = 'limpeza' then
    delete from operacoes.limpeza_meses where importacao_id = p_id;
    get diagnostics v_apagadas = row_count;
  end if;
  return v_apagadas;
end;
$$;


--
-- Name: energia_fatura_vigente(); Type: FUNCTION; Schema: operacoes; Owner: -
--

CREATE FUNCTION operacoes.energia_fatura_vigente() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  new.vigente := new.importacao_id is null or exists (
    select 1 from operacoes.importacoes i
    where i.id = new.importacao_id and i.status = 'confirmada'
  );
  return new;
end;
$$;


--
-- Name: energia_importacao_status(); Type: FUNCTION; Schema: operacoes; Owner: -
--

CREATE FUNCTION operacoes.energia_importacao_status() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  update operacoes.energia_faturas
    set vigente = (new.status = 'confirmada')
    where importacao_id = new.id and vigente is distinct from (new.status = 'confirmada');
  return null;
end;
$$;


--
-- Name: enet_contratos(); Type: FUNCTION; Schema: operacoes; Owner: -
--

CREATE FUNCTION operacoes.enet_contratos() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'bloco', l.bloco,
      'luc', l.luc,
      'nome', l.nome,
      'locatario', btrim(l.locatario),
      'documento', nullif(btrim(coalesce(l.cnpj, '')), ''),
      'contrato', l.contrato,
      'inicio', l.inicio,
      'fim', l.fim
    ) order by l.luc, l.inicio desc nulls last, l.id), '[]'::jsonb)
  from os.lojas l
  where ((select core.pode('operacoes.energia.ver')) or (select core.pode('operacoes.energia.termo')))
    and l.situacao = 'vigente'
    and length(btrim(coalesce(l.locatario, ''))) > 0;
$$;


--
-- Name: gravar_fatura_energisa(uuid, text, text, jsonb, jsonb); Type: FUNCTION; Schema: operacoes; Owner: -
--

CREATE FUNCTION operacoes.gravar_fatura_energisa(p_importacao uuid, p_arquivo text, p_sha256 text, p_fatura jsonb, p_itens jsonb) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  f operacoes.energia_faturas;
  v_id uuid;
begin
  if jsonb_typeof(p_itens) is distinct from 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'a fatura precisa ter itens' using errcode = '22023';
  end if;
  f := jsonb_populate_record(null::operacoes.energia_faturas, p_fatura);
  insert into operacoes.energia_faturas (
    importacao_id, matricula, referencia, vencimento, leitura_anterior_data,
    leitura_atual_data, proxima_leitura, dias, medidor, leitura_anterior,
    leitura_atual, consumo_kwh, valor_consumo, compensado_kwh, valor_compensado,
    injetada_kwh, bandeira, valor_bandeira, iluminacao_publica, icms, pis_cofins,
    total, saldo_kwh, expirar_kwh, classificacao_gd, nota_fiscal, observacao,
    arquivo, sha256, importado_por
  ) values (
    p_importacao, f.matricula, f.referencia, f.vencimento, f.leitura_anterior_data,
    f.leitura_atual_data, f.proxima_leitura, f.dias, f.medidor, f.leitura_anterior,
    f.leitura_atual, coalesce(f.consumo_kwh, 0), coalesce(f.valor_consumo, 0),
    coalesce(f.compensado_kwh, 0), coalesce(f.valor_compensado, 0),
    f.injetada_kwh, f.bandeira, coalesce(f.valor_bandeira, 0),
    coalesce(f.iluminacao_publica, 0), coalesce(f.icms, 0), coalesce(f.pis_cofins, 0),
    f.total, f.saldo_kwh, f.expirar_kwh, f.classificacao_gd, f.nota_fiscal, f.observacao,
    p_arquivo, p_sha256, (select auth.uid())
  )
  returning id into v_id;

  insert into operacoes.energia_fatura_itens (
    fatura_id, ordem, descricao, tipo, origem, mes_geracao, unidade, quantidade,
    preco_unitario, valor, pis_cofins, base_icms, aliquota_icms, icms, tarifa_unitaria
  )
  select v_id, i.ordem, i.descricao, i.tipo, i.origem, i.mes_geracao, i.unidade,
    i.quantidade, i.preco_unitario, i.valor, i.pis_cofins, i.base_icms,
    i.aliquota_icms, i.icms, i.tarifa_unitaria
  from jsonb_populate_recordset(null::operacoes.energia_fatura_itens, p_itens) i;

  return v_id;
end;
$$;


--
-- Name: liberar_caixa(uuid, date, text); Type: FUNCTION; Schema: operacoes; Owner: -
--

CREATE FUNCTION operacoes.liberar_caixa(p_caixa uuid, p_saida date, p_status text DEFAULT 'livre'::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v operacoes.caixas;
begin
  if not (core.pode('operacoes.energia.editar') or (select auth.role()) = 'service_role') then
    raise exception 'sem permissão para editar a caixa' using errcode = '42501';
  end if;
  if p_status not in ('livre', 'reservado') then
    raise exception 'a caixa liberada fica livre ou reservada' using errcode = '22023';
  end if;
  select * into v from operacoes.caixas where id = p_caixa for update;
  if not found then
    raise exception 'caixa não encontrada' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(v.ocupante, ''))) = 0 then
    raise exception 'a caixa não tem ocupante' using errcode = 'P0001';
  end if;
  insert into operacoes.caixa_ocupantes (caixa_id, nome, documento, entrada, saida, origem)
    values (p_caixa, btrim(v.ocupante), v.ocupante_documento, v.ocupante_desde,
            coalesce(p_saida, current_date), coalesce(v.ocupante_origem, 'manual'))
    on conflict (caixa_id, lower(btrim(nome))) do update
      set saida = excluded.saida,
          documento = coalesce(excluded.documento, operacoes.caixa_ocupantes.documento);
  update operacoes.caixas set
    ocupante = null,
    ocupante_documento = null,
    ocupante_desde = null,
    contrato = null,
    ocupante_origem = null,
    status = p_status,
    locatario_novo = false,
    termo_externo = false
  where id = p_caixa;
end;
$$;


--
-- Name: limpeza_aberto(date); Type: FUNCTION; Schema: operacoes; Owner: -
--

CREATE FUNCTION operacoes.limpeza_aberto(p_ref date) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (select 1 from operacoes.limpeza_meses where referencia = p_ref and status = 'aberto');
$$;


--
-- Name: limpeza_enviar(date); Type: FUNCTION; Schema: operacoes; Owner: -
--

CREATE FUNCTION operacoes.limpeza_enviar(p_ref date) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if not core.pode('operacoes.limpeza.fechar') then
    raise exception 'sem permissão para enviar o rateio' using errcode = '42501';
  end if;
  update operacoes.limpeza_meses set
    enviado_por = (select auth.uid()), enviado_em = now()
  where referencia = p_ref and status = 'fechado';
  if not found then
    raise exception 'feche o mês antes de enviar ao Financeiro' using errcode = '22023';
  end if;
end;
$$;


--
-- Name: limpeza_fechar(date); Type: FUNCTION; Schema: operacoes; Owner: -
--

CREATE FUNCTION operacoes.limpeza_fechar(p_ref date) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v operacoes.limpeza_meses;
begin
  if not core.pode('operacoes.limpeza.fechar') then
    raise exception 'sem permissão para fechar o rateio' using errcode = '42501';
  end if;
  select * into v from operacoes.limpeza_meses where referencia = p_ref for update;
  if not found then
    raise exception 'mês não encontrado' using errcode = 'P0001';
  end if;
  if v.status = 'fechado' then
    raise exception 'o mês já está fechado' using errcode = '22023';
  end if;
  if v.valor_base is null or v.func_base is null or v.func_area_comum is null or v.func_rateados is null then
    raise exception 'preencha o valor base e os funcionários antes de fechar' using errcode = '22023';
  end if;
  if not exists (
    select 1 from operacoes.limpeza_minutos
    where referencia = p_ref and limpeza + manutencao > 0
  ) then
    raise exception 'lance os minutos dos blocos antes de fechar' using errcode = '22023';
  end if;
  update operacoes.limpeza_meses set
    status = 'fechado', incompleto = false,
    fechado_por = (select auth.uid()), fechado_em = now()
  where referencia = p_ref;
end;
$$;


--
-- Name: limpeza_gravar_previa(uuid, jsonb); Type: FUNCTION; Schema: operacoes; Owner: -
--

CREATE FUNCTION operacoes.limpeza_gravar_previa(p_importacao uuid, p_meses jsonb) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v operacoes.importacoes;
  m jsonb;
  v_ref date;
  v_incompleto boolean;
  v_n int := 0;
begin
  if not operacoes.pode_importar('limpeza') then
    raise exception 'sem permissão para importar o rateio' using errcode = '42501';
  end if;
  select * into v from operacoes.importacoes where id = p_importacao for update;
  if not found or v.tipo <> 'limpeza' or v.status <> 'previa'
     or v.criado_por is distinct from (select auth.uid()) then
    raise exception 'prévia de importação do rateio não encontrada' using errcode = 'P0001';
  end if;

  for m in select * from jsonb_array_elements(coalesce(p_meses, '[]')) loop
    v_ref := (m ->> 'referencia')::date;
    if exists (select 1 from operacoes.limpeza_meses where referencia = v_ref) then
      raise exception 'o mês % já existe no rateio', to_char(v_ref, 'MM/YYYY')
        using errcode = '22023';
    end if;
    v_incompleto := coalesce((m ->> 'incompleto')::boolean, false);
    insert into operacoes.limpeza_meses (
      referencia, importacao_id, apontamento, valor_base, func_base,
      func_area_comum, func_rateados, regra_bl04, status, incompleto, origem,
      valores_planilha, fechado_por, fechado_em, criado_por
    ) values (
      v_ref, p_importacao, nullif(btrim(m ->> 'apontamento'), ''),
      (m ->> 'valor_base')::numeric, (m ->> 'func_base')::int,
      (m ->> 'func_area_comum')::int, (m ->> 'func_rateados')::int,
      m ->> 'regra_bl04',
      case when v_incompleto then 'aberto' else 'fechado' end,
      v_incompleto, 'importacao', m -> 'valores_planilha',
      case when v_incompleto then null else (select auth.uid()) end,
      case when v_incompleto then null else now() end,
      (select auth.uid())
    );
    insert into operacoes.limpeza_extras (referencia, ordem, descricao, quantidade, valor_unitario, valor)
    select v_ref, (x.ordem - 1)::int, btrim(x.v ->> 'descricao'),
      (x.v ->> 'quantidade')::numeric, (x.v ->> 'valor_unitario')::numeric,
      (x.v ->> 'valor')::numeric
    from jsonb_array_elements(coalesce(m -> 'extras', '[]')) with ordinality as x (v, ordem);
    insert into operacoes.limpeza_minutos (referencia, bloco, limpeza, manutencao)
    select v_ref, x ->> 'bloco', coalesce((x ->> 'limpeza')::int, 0),
      coalesce((x ->> 'manutencao')::int, 0)
    from jsonb_array_elements(coalesce(m -> 'minutos', '[]')) as x;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;


--
-- Name: limpeza_reabrir(date, text); Type: FUNCTION; Schema: operacoes; Owner: -
--

CREATE FUNCTION operacoes.limpeza_reabrir(p_ref date, p_motivo text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if not core.pode('operacoes.limpeza.fechar') then
    raise exception 'sem permissão para reabrir o rateio' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'informe o motivo para reabrir' using errcode = '22023';
  end if;
  update operacoes.limpeza_meses set
    status = 'aberto', enviado_por = null, enviado_em = null,
    reaberto_por = (select auth.uid()), reaberto_em = now(),
    reaberto_motivo = btrim(p_motivo)
  where referencia = p_ref and status = 'fechado';
  if not found then
    raise exception 'só um mês fechado pode ser reaberto' using errcode = '22023';
  end if;
end;
$$;


--
-- Name: limpeza_salvar(date, jsonb); Type: FUNCTION; Schema: operacoes; Owner: -
--

CREATE FUNCTION operacoes.limpeza_salvar(p_ref date, p_dados jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_status text;
begin
  if not (select core.pode('operacoes.limpeza.fechar')) then
    raise exception 'sem permissão para lançar o rateio' using errcode = '42501';
  end if;
  if extract(day from p_ref) <> 1 then
    raise exception 'mês de referência inválido' using errcode = '22023';
  end if;

  select status into v_status from operacoes.limpeza_meses where referencia = p_ref;
  if not found then
    insert into operacoes.limpeza_meses (
      referencia, apontamento, valor_base, base_composicao, func_base,
      func_area_comum, func_rateados, regra_bl04
    ) values (
      p_ref,
      nullif(btrim(p_dados ->> 'apontamento'), ''),
      (p_dados ->> 'valor_base')::numeric,
      nullif(btrim(p_dados ->> 'base_composicao'), ''),
      (p_dados ->> 'func_base')::int,
      (p_dados ->> 'func_area_comum')::int,
      (p_dados ->> 'func_rateados')::int,
      coalesce(p_dados ->> 'regra_bl04', 'separado')
    );
  elsif v_status <> 'aberto' then
    raise exception 'o mês está fechado: reabra para editar' using errcode = '22023';
  else
    update operacoes.limpeza_meses set
      apontamento = nullif(btrim(p_dados ->> 'apontamento'), ''),
      valor_base = (p_dados ->> 'valor_base')::numeric,
      base_composicao = nullif(btrim(p_dados ->> 'base_composicao'), ''),
      func_base = (p_dados ->> 'func_base')::int,
      func_area_comum = (p_dados ->> 'func_area_comum')::int,
      func_rateados = (p_dados ->> 'func_rateados')::int,
      regra_bl04 = coalesce(p_dados ->> 'regra_bl04', regra_bl04)
    where referencia = p_ref;
    if not found then
      raise exception 'o mês está fechado: reabra para editar' using errcode = '22023';
    end if;
  end if;

  delete from operacoes.limpeza_extras where referencia = p_ref;
  insert into operacoes.limpeza_extras (referencia, ordem, descricao, quantidade, valor_unitario, valor)
  select p_ref, (x.ordem - 1)::int, btrim(x.v ->> 'descricao'),
    (x.v ->> 'quantidade')::numeric, (x.v ->> 'valor_unitario')::numeric,
    (x.v ->> 'valor')::numeric
  from jsonb_array_elements(coalesce(p_dados -> 'extras', '[]')) with ordinality as x (v, ordem);

  delete from operacoes.limpeza_minutos where referencia = p_ref;
  insert into operacoes.limpeza_minutos (referencia, bloco, limpeza, manutencao)
  select p_ref, x ->> 'bloco', coalesce((x ->> 'limpeza')::int, 0),
    coalesce((x ->> 'manutencao')::int, 0)
  from jsonb_array_elements(coalesce(p_dados -> 'minutos', '[]')) as x;

  delete from operacoes.limpeza_contrato where referencia = p_ref;
  insert into operacoes.limpeza_contrato (referencia, ordem, descricao, valor, entra_conferencia)
  select p_ref, (x.ordem - 1)::int, btrim(x.v ->> 'descricao'), (x.v ->> 'valor')::numeric,
    coalesce((x.v ->> 'entra_conferencia')::boolean, false)
  from jsonb_array_elements(coalesce(p_dados -> 'contrato', '[]')) with ordinality as x (v, ordem);

  delete from operacoes.limpeza_equipe where referencia = p_ref;
  insert into operacoes.limpeza_equipe (referencia, ordem, nome, funcao, grupo, blocos, turno, minutos_dia)
  select p_ref, (x.ordem - 1)::int, btrim(x.v ->> 'nome'),
    nullif(btrim(x.v ->> 'funcao'), ''), x.v ->> 'grupo',
    coalesce(array(select jsonb_array_elements_text(x.v -> 'blocos')), '{}'),
    nullif(btrim(x.v ->> 'turno'), ''), (x.v ->> 'minutos_dia')::int
  from jsonb_array_elements(coalesce(p_dados -> 'equipe', '[]')) with ordinality as x (v, ordem);
end;
$$;


--
-- Name: pode_importar(text); Type: FUNCTION; Schema: operacoes; Owner: -
--

CREATE FUNCTION operacoes.pode_importar(p_tipo text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select case p_tipo
    when 'agua' then core.pode('operacoes.agua.importar')
    when 'agua_conta' then core.pode('operacoes.agua.importar')
    when 'energisa' then core.pode('operacoes.energia.contas')
    when 'orcamento' then core.pode('operacoes.obras.importar')
    when 'limpeza' then core.pode('operacoes.limpeza.fechar')
    else false
  end;
$$;


--
-- Name: proxima_versao_termo(uuid); Type: FUNCTION; Schema: operacoes; Owner: -
--

CREATE FUNCTION operacoes.proxima_versao_termo(p_caixa uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select coalesce(max(versao), 0) + 1 from operacoes.termos where caixa_id = p_caixa;
$$;


--
-- Name: registrar_termo(uuid, integer, text, text, text, text, text, text, text, integer, text, text, text, text, date, text, text); Type: FUNCTION; Schema: operacoes; Owner: -
--

CREATE FUNCTION operacoes.registrar_termo(p_caixa uuid, p_versao integer, p_locatario text, p_documento text, p_qualificacao text, p_bloco text, p_pavimento text, p_sala text, p_projeto text, p_amperes integer, p_ligacao text, p_armario text, p_rota text, p_observacao_tecnica text, p_data_emissao date, p_pdf text, p_docx text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_proxima int;
  v_id uuid;
  v_pasta text := 'energia/termos/' || p_caixa::text || '/';
begin
  if not core.pode('operacoes.energia.termo') then
    raise exception 'sem permissão para emitir o termo' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_locatario, ''))) = 0
    or length(btrim(coalesce(p_documento, ''))) = 0 then
    raise exception 'informe o locatário e o CPF ou CNPJ' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_bloco, ''))) = 0 or length(btrim(coalesce(p_sala, ''))) = 0 then
    raise exception 'informe o bloco e a sala' using errcode = '22023';
  end if;
  if p_data_emissao is null then
    raise exception 'informe a data de emissão' using errcode = '22023';
  end if;
  if p_pdf is null or left(p_pdf, length(v_pasta)) <> v_pasta
    or (p_docx is not null and left(p_docx, length(v_pasta)) <> v_pasta) then
    raise exception 'arquivo do termo fora da pasta da caixa' using errcode = '22023';
  end if;
  perform 1 from operacoes.caixas where id = p_caixa for update;
  if not found then
    raise exception 'caixa não encontrada' using errcode = 'P0001';
  end if;
  select coalesce(max(versao), 0) + 1 into v_proxima
    from operacoes.termos where caixa_id = p_caixa;
  if p_versao is distinct from v_proxima then
    raise exception 'outro termo desta caixa acabou de ser emitido; gere de novo'
      using errcode = 'P0001';
  end if;
  insert into operacoes.termos (
    caixa_id, versao, locatario, documento, qualificacao, bloco, pavimento, sala,
    projeto, amperes, ligacao, armario, rota, observacao_tecnica, data_emissao, pdf, docx
  ) values (
    p_caixa, p_versao, btrim(p_locatario), btrim(p_documento), nullif(btrim(coalesce(p_qualificacao, '')), ''),
    btrim(p_bloco), nullif(btrim(coalesce(p_pavimento, '')), ''), btrim(p_sala),
    nullif(btrim(coalesce(p_projeto, '')), ''), p_amperes, nullif(btrim(coalesce(p_ligacao, '')), ''),
    nullif(btrim(coalesce(p_armario, '')), ''), nullif(btrim(coalesce(p_rota, '')), ''),
    nullif(btrim(coalesce(p_observacao_tecnica, '')), ''), p_data_emissao, p_pdf, p_docx
  ) returning id into v_id;
  update operacoes.caixas set locatario_novo = false where id = p_caixa;
  return v_id;
end;
$$;


--
-- Name: remover_exemplos(); Type: FUNCTION; Schema: operacoes; Owner: -
--

CREATE FUNCTION operacoes.remover_exemplos() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if not core.pode('operacoes.parametros') then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  delete from operacoes.importacoes where exemplo;
  delete from operacoes.agua_leituras where exemplo;
  delete from operacoes.energia_faturas where exemplo;
  delete from operacoes.energia_unidades u where u.exemplo
    and not exists (select 1 from operacoes.energia_faturas f where f.matricula = u.matricula);
  delete from operacoes.quadros where exemplo;
  delete from operacoes.salas where exemplo;
  delete from operacoes.limpeza_meses where exemplo;
  delete from operacoes.obra_realizado where exemplo;
  delete from operacoes.orcamento_revisoes where exemplo;
  delete from operacoes.obras where exemplo;
  -- Colunas "exemplo" do Diário de Obra vêm de 20261109160600.
  delete from operacoes.diario_relatorios where exemplo;
  delete from operacoes.diario_obras where exemplo;
end;
$$;


--
-- Name: resumo_quadros(); Type: FUNCTION; Schema: operacoes; Owner: -
--

CREATE FUNCTION operacoes.resumo_quadros() RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select coalesce(jsonb_agg(to_jsonb(r) order by r.quadro_id), '[]'::jsonb)
  from (
    select
      q.id as quadro_id,
      count(c.id)::int as caixas,
      (count(c.id) filter (where c.status = 'ocupado'))::int as ocupadas,
      (count(c.id) filter (where c.status = 'reservado'))::int as reservadas,
      (count(c.id) filter (where c.status = 'livre'))::int as livres,
      (count(c.id) filter (
        where c.status = 'ocupado'
          and (c.locatario_novo or (
            not c.termo_externo
            and not exists (select 1 from operacoes.termos t where t.caixa_id = c.id)
          ))
      ))::int as sem_termo,
      (count(c.id) filter (where c.locatario_novo))::int as locatarios_novos
    from operacoes.quadros q
    left join operacoes.caixas c on c.quadro_id = q.id
    group by q.id
  ) r;
$$;


--
-- Name: trocar_locatario(uuid, text, text, date, text, text); Type: FUNCTION; Schema: operacoes; Owner: -
--

CREATE FUNCTION operacoes.trocar_locatario(p_caixa uuid, p_nome text, p_documento text, p_desde date, p_contrato text DEFAULT NULL::text, p_origem text DEFAULT 'manual'::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v operacoes.caixas;
begin
  if not (core.pode('operacoes.energia.editar') or (select auth.role()) = 'service_role') then
    raise exception 'sem permissão para editar a caixa' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_nome, ''))) = 0 then
    raise exception 'informe o novo locatário' using errcode = '22023';
  end if;
  if p_origem not in ('enet', 'manual') then
    raise exception 'origem inválida' using errcode = '22023';
  end if;
  select * into v from operacoes.caixas where id = p_caixa for update;
  if not found then
    raise exception 'caixa não encontrada' using errcode = 'P0001';
  end if;
  if v.ocupante is not null and lower(btrim(v.ocupante)) = lower(btrim(p_nome)) then
    return;
  end if;
  if v.ocupante is not null and btrim(v.ocupante) <> '' then
    insert into operacoes.caixa_ocupantes (caixa_id, nome, documento, entrada, saida, origem)
      values (p_caixa, btrim(v.ocupante), v.ocupante_documento, v.ocupante_desde,
              coalesce(p_desde, current_date), coalesce(v.ocupante_origem, 'manual'))
      on conflict (caixa_id, lower(btrim(nome))) do update set saida = excluded.saida;
  end if;
  update operacoes.caixas set
    ocupante = btrim(p_nome),
    ocupante_documento = nullif(btrim(coalesce(p_documento, '')), ''),
    ocupante_desde = p_desde,
    contrato = p_contrato,
    ocupante_origem = p_origem,
    status = 'ocupado',
    locatario_novo = true
  where id = p_caixa;
end;
$$;


--
-- Name: ve_importacao(text); Type: FUNCTION; Schema: operacoes; Owner: -
--

CREATE FUNCTION operacoes.ve_importacao(p_tipo text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select operacoes.pode_importar(p_tipo) or case p_tipo
    when 'agua' then core.pode('operacoes.agua.ver')
    when 'agua_conta' then core.pode('operacoes.agua.ver')
    when 'energisa' then core.pode('operacoes.energia.contas')
    when 'orcamento' then core.pode('operacoes.obras.ver')
    when 'limpeza' then core.pode('operacoes.limpeza.ver')
    else false
  end;
$$;


--
-- Name: ajustar_numeracao(); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.ajustar_numeracao() RETURNS bigint
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select setval('os.chamado_numero_seq', x.m)
  from (select max(numero) as m from os.chamados) x
  where x.m is not null
    and x.m >= (
      select case when is_called then last_value else last_value - 1 end
      from os.chamado_numero_seq
    );
$$;


--
-- Name: ativos_para_vincular(); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.ativos_para_vincular() RETURNS TABLE(id uuid, codigo text, nome text, local text, situacao os.situacao_ativo)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select a.id, a.codigo, a.nome,
    concat_ws(' · ', a.bloco, l.nome, a.area, a.ponto),
    a.situacao
  from os.ativos a
  left join os.lojas l on l.id = a.loja_id
  where core.pode('os.acessar') and a.situacao <> 'baixado'
  order by a.codigo;
$$;


--
-- Name: carga_das_ordens(uuid, timestamp with time zone, os.status_chamado[], uuid, uuid, os.prioridade, text, timestamp with time zone, timestamp with time zone, uuid); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.carga_das_ordens(p_setor uuid, p_agora timestamp with time zone, p_status os.status_chamado[] DEFAULT NULL::os.status_chamado[], p_categoria uuid DEFAULT NULL::uuid, p_responsavel uuid DEFAULT NULL::uuid, p_prioridade os.prioridade DEFAULT NULL::os.prioridade, p_etiqueta text DEFAULT NULL::text, p_criado_desde timestamp with time zone DEFAULT NULL::timestamp with time zone, p_criado_ate timestamp with time zone DEFAULT NULL::timestamp with time zone, p_aberto_por uuid DEFAULT NULL::uuid) RETURNS TABLE(responsavel_id uuid, abertos integer, atrasados integer)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select
    o.responsavel_id,
    count(*)::int as abertos,
    count(*) filter (where o.prazo < p_agora)::int as atrasados
  from os.ordens o
  where o.setor_id = p_setor
    and o.status in ('aberto', 'em_andamento', 'aguardando')
    and (p_status is null or o.status = any (p_status))
    and (p_categoria is null or o.categoria_id = p_categoria)
    and (p_responsavel is null or o.responsavel_id = p_responsavel)
    and (p_prioridade is null or o.prioridade = p_prioridade)
    and (p_etiqueta is null or o.etiquetas @> array[p_etiqueta])
    and (p_criado_desde is null or o.criado_em >= p_criado_desde)
    and (p_criado_ate is null or o.criado_em <= p_criado_ate)
    and (p_aberto_por is null or o.aberto_por = p_aberto_por)
  group by o.responsavel_id;
$$;


--
-- Name: carga_do_setor(uuid, timestamp with time zone, os.status_chamado[], os.tipo_chamado[], uuid, uuid, os.prioridade, text, timestamp with time zone, timestamp with time zone, uuid); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.carga_do_setor(p_setor uuid, p_agora timestamp with time zone, p_status os.status_chamado[] DEFAULT NULL::os.status_chamado[], p_tipos os.tipo_chamado[] DEFAULT NULL::os.tipo_chamado[], p_categoria uuid DEFAULT NULL::uuid, p_responsavel uuid DEFAULT NULL::uuid, p_prioridade os.prioridade DEFAULT NULL::os.prioridade, p_etiqueta text DEFAULT NULL::text, p_criado_desde timestamp with time zone DEFAULT NULL::timestamp with time zone, p_criado_ate timestamp with time zone DEFAULT NULL::timestamp with time zone, p_aberto_por uuid DEFAULT NULL::uuid) RETURNS TABLE(responsavel_id uuid, abertos integer, atrasados integer)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select
    c.responsavel_id,
    count(*)::int as abertos,
    count(*) filter (where c.prazo < p_agora)::int as atrasados
  from os.chamados c
  where c.setor_id = p_setor
    and c.status in ('aberto', 'em_andamento', 'aguardando')
    and (p_status is null or c.status = any (p_status))
    and (p_tipos is null or c.tipo = any (p_tipos))
    and (p_categoria is null or c.categoria_id = p_categoria)
    and (p_responsavel is null or c.responsavel_id = p_responsavel)
    and (p_prioridade is null or c.prioridade = p_prioridade)
    and (p_etiqueta is null or c.etiquetas @> array[p_etiqueta])
    and (p_criado_desde is null or c.criado_em >= p_criado_desde)
    and (p_criado_ate is null or c.criado_em <= p_criado_ate)
    and (p_aberto_por is null or c.aberto_por = p_aberto_por)
  group by c.responsavel_id;
$$;


--
-- Name: ciclo_do_chamado(); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.ciclo_do_chamado() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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


--
-- Name: ciclo_do_destino(); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.ciclo_do_destino() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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


--
-- Name: desfazer_saida_ativo(uuid, text); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.desfazer_saida_ativo(p_saida uuid, p_motivo text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v os.ativo_saidas;
begin
  if not core.pode('os.ativos_saida') then
    raise exception 'sem permissão para desfazer a saída' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'informe o motivo para desfazer' using errcode = '22023';
  end if;
  select * into v from os.ativo_saidas where id = p_saida for update;
  if not found or v.desfeita_em is not null then
    raise exception 'saída não encontrada ou já desfeita' using errcode = 'P0001';
  end if;
  update os.ativo_saidas set
    desfeita_por = (select auth.uid()), desfeita_em = now(), desfeita_motivo = btrim(p_motivo)
  where id = p_saida;
  update os.ativos set situacao = v.situacao_anterior, baixa_data = null, baixa_motivo = null
  where id = v.ativo_id;
  update os.planos_preventivos set ativo = true
  where id = any (v.planos_pausados) and ativo_id = v.ativo_id and not ativo;
end;
$$;


--
-- Name: edita_chamado(uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.edita_chamado(p_id uuid, p_setor uuid, p_aberto_por uuid, p_responsavel uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select core.pode('os.acessar')
    and os.ve_chamado(p_id, p_setor, p_aberto_por, p_responsavel)
    and (
      p_aberto_por = (select auth.uid())
      or p_responsavel = (select auth.uid())
      or p_setor in (select os.meus_setores())
      or os.gerencia(p_setor)
      or os.envolvido(p_id)
    );
$$;


--
-- Name: envolvido(uuid); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.envolvido(p_chamado uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: envolvido_na_ordem(uuid); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.envolvido_na_ordem(p_ordem uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: gerencia(uuid); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.gerencia(p_setor uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select core.pode('os.gerenciar_setor')
    and (core.pode('os.todos_setores') or p_setor in (select os.meus_setores()));
$$;


--
-- Name: gravar_calculo_os(uuid, jsonb); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.gravar_calculo_os(p_ordem uuid, p_resultado jsonb) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: leitores_dos_avisos(uuid[]); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.leitores_dos_avisos(p_chamados uuid[]) RETURNS TABLE(chamado_id uuid, usuario_id uuid)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  with c as (
    select id, setor_id, responsavel_id, aberto_por,
      exists (select 1 from os.destinatarios d where d.chamado_id = id) as com_destinos
    from os.chamados
    where id = any (p_chamados) and tipo = 'aviso' and os.pode_ver_chamado(id)
  ),
  pessoas as (
    select c.id, d.usuario_id
    from c join os.destinatarios d on d.chamado_id = c.id
    where d.usuario_id is not null
    union
    select c.id, m.usuario_id
    from c
    join os.destinatarios d on d.chamado_id = c.id and d.usuario_id is null
    join os.setor_membros m on m.setor_id = d.setor_id
    union
    select c.id, c.responsavel_id from c
    where not c.com_destinos and c.responsavel_id is not null
    union
    select c.id, m.usuario_id
    from c join os.setor_membros m on m.setor_id = c.setor_id
    where not c.com_destinos and c.responsavel_id is null
  )
  select p.id, p.usuario_id
  from pessoas p
  join c on c.id = p.id
  join core.usuarios u on u.id = p.usuario_id and u.ativo
  where p.usuario_id is distinct from c.aberto_por;
$$;


--
-- Name: liberar_ativo_da_os(); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.liberar_ativo_da_os() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: chamado_numero_seq; Type: SEQUENCE; Schema: os; Owner: -
--

CREATE SEQUENCE os.chamado_numero_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: chamados; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.chamados (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    numero bigint DEFAULT nextval('os.chamado_numero_seq'::regclass) NOT NULL,
    tipo os.tipo_chamado NOT NULL,
    titulo text NOT NULL,
    descricao text,
    setor_id uuid NOT NULL,
    categoria_id uuid,
    status os.status_chamado DEFAULT 'aberto'::os.status_chamado NOT NULL,
    prioridade os.prioridade DEFAULT 'media'::os.prioridade NOT NULL,
    origem os.origem_chamado DEFAULT 'sistema'::os.origem_chamado NOT NULL,
    pessoal boolean DEFAULT false NOT NULL,
    precisa_confirmacao boolean DEFAULT true NOT NULL,
    aberto_por uuid,
    solicitante_nome text,
    solicitante_telefone text,
    responsavel_id uuid,
    prazo timestamp with time zone,
    loja_id uuid,
    ativo_id uuid,
    vistoria_id uuid,
    ambiente_id uuid,
    vinculado_a_id uuid,
    campos jsonb DEFAULT '{}'::jsonb NOT NULL,
    etiquetas text[] DEFAULT '{}'::text[] NOT NULL,
    checklist jsonb DEFAULT '[]'::jsonb NOT NULL,
    primeira_resposta_em timestamp with time zone,
    iniciado_em timestamp with time zone,
    aguardando_desde timestamp with time zone,
    aguardando_tipo os.motivo_aguardando,
    aguardando_motivo text,
    aguardando_min integer DEFAULT 0 NOT NULL,
    concluido_em timestamp with time zone,
    concluido_por uuid,
    fechado_em timestamp with time zone,
    fechado_por uuid,
    fechado_automatico boolean DEFAULT false NOT NULL,
    cancelado_em timestamp with time zone,
    cancelado_por uuid,
    motivo_cancelamento text,
    reaberto_vezes integer DEFAULT 0 NOT NULL,
    ultimo_motivo_reabertura text,
    solucao text,
    causa_falha text,
    avaliacao smallint,
    avaliacao_comentario text,
    avaliado_em timestamp with time zone,
    recorrencia jsonb,
    serie_id uuid,
    serie_data date,
    legado_origem text,
    legado_id text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    destinos_em_ordem boolean DEFAULT false NOT NULL,
    acao_url text,
    acao_rotulo text,
    conclusao_externa boolean DEFAULT false NOT NULL,
    origem_modulo text,
    origem_ref text,
    CONSTRAINT chamados_acao_rotulo_check CHECK (((btrim(acao_rotulo) <> ''::text) AND (length(acao_rotulo) <= 80))),
    CONSTRAINT chamados_acao_url_check CHECK (((acao_url ~ '^/([^/\\[:space:]][^[:space:]]*)?$'::text) AND (length(acao_url) <= 500))),
    CONSTRAINT chamados_aguardando_min_check CHECK ((aguardando_min >= 0)),
    CONSTRAINT chamados_avaliacao_check CHECK (((avaliacao >= 1) AND (avaliacao <= 5))),
    CONSTRAINT chamados_campos_check CHECK ((jsonb_typeof(campos) = 'object'::text)),
    CONSTRAINT chamados_check CHECK (((status <> 'aguardando'::os.status_chamado) OR (aguardando_tipo IS NOT NULL))),
    CONSTRAINT chamados_check1 CHECK (((status <> 'cancelado'::os.status_chamado) OR (NULLIF(btrim(motivo_cancelamento), ''::text) IS NOT NULL))),
    CONSTRAINT chamados_checklist_check CHECK ((jsonb_typeof(checklist) = 'array'::text)),
    CONSTRAINT chamados_conclusao_externa_tem_acao CHECK (((NOT conclusao_externa) OR (acao_url IS NOT NULL))),
    CONSTRAINT chamados_origem_modulo_check CHECK ((origem_modulo ~ '^[a-z][a-z0-9_]*$'::text)),
    CONSTRAINT chamados_origem_ref_check CHECK (((btrim(origem_ref) <> ''::text) AND (length(origem_ref) <= 200))),
    CONSTRAINT chamados_origem_ref_tem_modulo CHECK (((origem_ref IS NULL) OR (origem_modulo IS NOT NULL))),
    CONSTRAINT chamados_sem_os CHECK ((tipo <> 'os'::os.tipo_chamado)),
    CONSTRAINT chamados_titulo_check CHECK ((btrim(titulo) <> ''::text))
);


--
-- Name: lido_por_mim(os.chamados); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.lido_por_mim(c os.chamados) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1 from os.leituras l
    where l.chamado_id = c.id and l.usuario_id = (select auth.uid())
  );
$$;


--
-- Name: limpar_campos_de_modulo(); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.limpar_campos_de_modulo() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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


--
-- Name: manter_baixa_da_saida(); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.manter_baixa_da_saida() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: meus_chamados_envolvidos(); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.meus_chamados_envolvidos() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER ROWS 100
    SET search_path TO ''
    AS $$
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


--
-- Name: meus_setores(); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.meus_setores() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select m.setor_id
  from os.setor_membros m
  join core.usuarios u on u.id = m.usuario_id
  where m.usuario_id = (select auth.uid()) and u.ativo;
$$;


--
-- Name: minhas_ordens_envolvidas(); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.minhas_ordens_envolvidas() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER ROWS 100
    SET search_path TO ''
    AS $$
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


--
-- Name: pausar_planos_na_saida(); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.pausar_planos_na_saida() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: pessoas(); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.pessoas() RETURNS TABLE(id uuid, nome text, setores uuid[])
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: pode_editar_chamado(uuid); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.pode_editar_chamado(p_chamado uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1 from os.chamados c
    where c.id = p_chamado
      and os.edita_chamado(c.id, c.setor_id, c.aberto_por, c.responsavel_id)
  );
$$;


--
-- Name: pode_editar_ordem(uuid); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.pode_editar_ordem(p_ordem uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: pode_ver_chamado(uuid); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.pode_ver_chamado(p_chamado uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1 from os.chamados c
    where c.id = p_chamado
      and os.ve_chamado(c.id, c.setor_id, c.aberto_por, c.responsavel_id)
  );
$$;


--
-- Name: pode_ver_ordem(uuid); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.pode_ver_ordem(p_ordem uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: proximo_codigo_vistoria(); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.proximo_codigo_vistoria() RETURNS text
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
  select 'ARP' || lpad(n::text, greatest(2, length(n::text)), '0')
  from (
    select coalesce(max(substring(codigo from '^ARP(\d+)$')::int), 0) + 1 as n
    from os.vistorias
  ) as proximo;
$_$;


--
-- Name: recusar_ativo_baixado(); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.recusar_ativo_baixado() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: registrar_saida_ativo(uuid, text, date, text, numeric, text, text, text, text, uuid, text, boolean, text, text, text[]); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.registrar_saida_ativo(p_ativo uuid, p_tipo text, p_data date, p_quantidade text, p_valor numeric, p_forma text, p_recebido_por text, p_destinatario text, p_documento text, p_responsavel uuid, p_motivo text, p_nf boolean, p_nf_numero text, p_observacoes text, p_anexos text[] DEFAULT '{}'::text[]) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v os.ativos;
  v_id uuid;
begin
  if not core.pode('os.ativos_saida') then
    raise exception 'sem permissão para registrar a saída do ativo' using errcode = '42501';
  end if;
  select * into v from os.ativos where id = p_ativo for update;
  if not found then
    raise exception 'ativo não encontrado' using errcode = 'P0001';
  end if;
  if v.situacao = 'baixado' then
    raise exception 'o ativo já está baixado' using errcode = '22023';
  end if;
  insert into os.ativo_saidas (ativo_id, tipo, data, quantidade, valor, forma_recebimento,
    recebido_por, destinatario_nome, destinatario_documento, responsavel_id, motivo,
    nota_fiscal, nota_fiscal_numero, observacoes, anexos, situacao_anterior)
  values (p_ativo, btrim(p_tipo), p_data, nullif(btrim(coalesce(p_quantidade, '')), ''), p_valor,
    nullif(btrim(coalesce(p_forma, '')), ''), nullif(btrim(coalesce(p_recebido_por, '')), ''),
    nullif(btrim(coalesce(p_destinatario, '')), ''), nullif(btrim(coalesce(p_documento, '')), ''),
    p_responsavel, nullif(btrim(coalesce(p_motivo, '')), ''), coalesce(p_nf, false),
    nullif(btrim(coalesce(p_nf_numero, '')), ''), nullif(btrim(coalesce(p_observacoes, '')), ''),
    coalesce(p_anexos, '{}'), v.situacao)
  returning id into v_id;
  update os.ativos set
    situacao = 'baixado',
    baixa_data = p_data,
    baixa_motivo = case lower(btrim(p_tipo))
      when 'venda' then 'Vendido'
      when 'doação' then 'Doado'
      when 'descarte' then 'Descartado'
      when 'devolução' then 'Devolvido'
      else btrim(p_tipo)
    end
  where id = p_ativo;
  return v_id;
end;
$$;


--
-- Name: registrar_saida_sobra(text, uuid, text, text, text, date, text, numeric, text, text, text, text, uuid, text, boolean, text, text, text[]); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.registrar_saida_sobra(p_nome text, p_categoria uuid, p_bloco text, p_area text, p_tipo text, p_data date, p_quantidade text, p_valor numeric, p_forma text, p_recebido_por text, p_destinatario text, p_documento text, p_responsavel uuid, p_motivo text, p_nf boolean, p_nf_numero text, p_observacoes text, p_anexos text[] DEFAULT '{}'::text[]) RETURNS TABLE(ativo_id uuid, saida_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: registrar_situacao_ativo(); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.registrar_situacao_ativo() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: remarcar_bloqueados(); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.remarcar_bloqueados() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  update os.agendamentos set status = 'remarcar'
    where agenda_id = new.agenda_id and status = 'marcado'
      and inicio < new.fim and fim > new.inicio;
  return null;
end;
$$;


--
-- Name: reservar_horario(uuid, timestamp with time zone, timestamp with time zone, uuid, uuid, text); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.reservar_horario(p_agenda uuid, p_inicio timestamp with time zone, p_fim timestamp with time zone, p_loja uuid, p_chamado uuid, p_observacao text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: respeitar_ordem_do_destino(); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.respeitar_ordem_do_destino() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: resumo_ativos(date); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.resumo_ativos(p_desde date) RETURNS TABLE(ativo_id uuid, custo_periodo numeric, custo_total numeric, corretivas_periodo bigint, preventivas_periodo bigint, os_abertas bigint, ultima_os timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: sincronizar_destinos(); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.sincronizar_destinos() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: todos_leram(os.chamados); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.todos_leram(c os.chamados) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select not exists (
    select 1 from os.leitores_dos_avisos(array[c.id]) p
    where not exists (
      select 1 from os.leituras l
      where l.chamado_id = c.id and l.usuario_id = p.usuario_id
    )
  );
$$;


--
-- Name: travar_destino_externo(); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.travar_destino_externo() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: validar_categoria(); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.validar_categoria() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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


--
-- Name: validar_chamado(); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.validar_chamado() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: ve_chamado(uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: os; Owner: -
--

CREATE FUNCTION os.ve_chamado(p_id uuid, p_setor uuid, p_aberto_por uuid, p_responsavel uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: ano_finalizado(integer); Type: FUNCTION; Schema: rh; Owner: -
--

CREATE FUNCTION rh.ano_finalizado(p_ano integer) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1 from rh.orcamentos_anuais o
    where o.ano = p_ano and o.finalizado_em is not null
  );
$$;


--
-- Name: banco_horas_em_reais(date); Type: FUNCTION; Schema: rh; Owner: -
--

CREATE FUNCTION rh.banco_horas_em_reais(p_competencia date) RETURNS TABLE(departamento_id uuid, colaboradores bigint, positivo_min bigint, sem_salario bigint, valor numeric, folha date, adicional_pct numeric)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  -- Vigente no mês; sem nenhum, a primeira configuração.
  with adicional as (
    select pe.banco_horas_adicional_pct as pct
    from rh.parametros_empresa pe
    order by (pe.vigente_desde <= p_competencia) desc,
      case when pe.vigente_desde <= p_competencia then pe.vigente_desde end desc,
      pe.vigente_desde
    limit 1
  ),
  ultima as (
    select max(c.competencia) as competencia
    from rh.custos_colaborador c
    where c.competencia <= p_competencia
  ),
  linhas as (
    select p.departamento_id, p.banco_saldo_min, c.salario_hora
    from rh.ponto_mensal p
    left join rh.custos_colaborador c
      on c.colaborador_id = p.colaborador_id
     and c.competencia = (select u.competencia from ultima u)
    where p.competencia = p_competencia and p.banco_saldo_min > 0
  )
  select
    l.departamento_id,
    count(*),
    sum(l.banco_saldo_min),
    count(*) filter (where l.salario_hora is null),
    round(
      sum(l.banco_saldo_min / 60.0 * l.salario_hora)
        * (1 + (select a.pct from adicional a) / 100),
      2),
    (select u.competencia from ultima u),
    (select a.pct from adicional a)
  from linhas l
  where core.pode('rh.custo_pessoal')
  group by l.departamento_id;
$$;


--
-- Name: conferir_ciclo_banco(); Type: FUNCTION; Schema: rh; Owner: -
--

CREATE FUNCTION rh.conferir_ciclo_banco() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.finalizado_em is not null then
    raise exception 'o ciclo do banco de horas de % a % já foi finalizado e não muda',
      to_char(old.inicio, 'DD/MM/YYYY'), to_char(old.fim, 'DD/MM/YYYY');
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  if tg_op = 'INSERT' and new.fim > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'o ciclo só pode ser fechado a partir de %',
      to_char(new.fim, 'DD/MM/YYYY');
  end if;
  return new;
end;
$$;


--
-- Name: conferir_gasto(); Type: FUNCTION; Schema: rh; Owner: -
--

CREATE FUNCTION rh.conferir_gasto() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if tg_op in ('UPDATE', 'DELETE')
     and rh.ano_finalizado(extract(year from old.data)::int) then
    raise exception 'o orçamento de % já foi finalizado: os gastos dele não mudam',
      extract(year from old.data)::int;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  if rh.ano_finalizado(extract(year from new.data)::int) then
    raise exception 'o orçamento de % já foi finalizado: não entra gasto nesse ano',
      extract(year from new.data)::int;
  end if;
  -- Sem categoria, quem barra é o not null (mensagem certa).
  if new.categoria_id is not null
     and (tg_op = 'INSERT' or new.categoria_id is distinct from old.categoria_id)
     and not exists (
       select 1 from rh.categorias_gasto c
       where c.id = new.categoria_id and c.ativa
     ) then
    raise exception 'categoria desativada: escolha outra da lista';
  end if;
  return new;
end;
$$;


--
-- Name: custo_agregado(date, date); Type: FUNCTION; Schema: rh; Owner: -
--

CREATE FUNCTION rh.custo_agregado(inicio date, fim date) RETURNS TABLE(competencia date, departamento_id uuid, cargo_id uuid, tipo_contrato rh.tipo_contrato, colaboradores bigint, remuneracao numeric, encargos numeric, provisoes numeric, beneficios numeric, rescisao numeric, reembolsos numeric, custo_total numeric, sem_valor bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select
    c.competencia, c.departamento_id, c.cargo_id, c.tipo_contrato,
    count(*),
    sum(c.remuneracao), sum(c.encargos),
    sum(c.provisao_13 + c.provisao_ferias + c.multa_rescisoria),
    sum(c.beneficios), sum(c.rescisao), sum(c.reembolsos), sum(c.custo_total),
    count(*) filter (
      where not c.valor_informado
        and x.admissao <= (c.competencia + interval '1 month - 1 day')::date
        and (x.desligamento is null
          or x.desligamento > (c.competencia + interval '1 month - 1 day')::date)
    )
  from rh.custos_colaborador c
  join rh.colaboradores x on x.id = c.colaborador_id
  where core.pode('rh.custo_pessoal')
    and c.competencia between inicio and fim
  group by 1, 2, 3, 4;
$$;


--
-- Name: excluir_folha(uuid); Type: FUNCTION; Schema: rh; Owner: -
--

CREATE FUNCTION rh.excluir_folha(p_folha_id uuid) RETURNS date
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_folha rh.folhas;
begin
  if not core.pode('rh.folha') then
    raise exception 'Você não tem permissão para excluir a folha'
      using errcode = '42501';
  end if;

  select * into v_folha from rh.folhas where id = p_folha_id for update;
  if not found then
    raise exception 'Folha não encontrada';
  end if;
  if v_folha.status = 'fechada' then
    raise exception 'A folha de % está fechada e não pode ser excluída',
      to_char(v_folha.competencia, 'MM/YYYY');
  end if;

  -- Sem folha, o custo do mês não tem de onde vir.
  delete from rh.custos_colaborador where competencia = v_folha.competencia;
  delete from rh.folhas where id = p_folha_id;

  update core.importacoes
  set status = 'revertida'
  where tipo = 'folha' and referencia = v_folha.competencia and status = 'confirmada';

  insert into core.auditoria (tabela, registro_id, acao, antes, depois, usuario_id)
  values (
    'rh.folhas',
    p_folha_id::text,
    'delete',
    jsonb_build_object(
      'competencia', v_folha.competencia,
      'importacao_id', v_folha.importacao_id,
      'ficticia', v_folha.ficticia
    ),
    null,
    (select auth.uid())
  );

  return v_folha.competencia;
end;
$$;


--
-- Name: banco_horas_ciclos; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.banco_horas_ciclos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inicio date NOT NULL,
    fim date NOT NULL,
    finalizado_em timestamp with time zone,
    finalizado_por uuid,
    total_saldo_min integer,
    total_calculado numeric(14,2),
    total_realizado numeric(14,2),
    criado_por uuid DEFAULT auth.uid(),
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT banco_horas_ciclos_check CHECK ((fim > inicio)),
    CONSTRAINT banco_horas_ciclos_check1 CHECK (((finalizado_em IS NULL) = (total_saldo_min IS NULL)))
);


--
-- Name: finalizar_ciclo_banco(uuid); Type: FUNCTION; Schema: rh; Owner: -
--

CREATE FUNCTION rh.finalizar_ciclo_banco(p_ciclo uuid) RETURNS rh.banco_horas_ciclos
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  c rh.banco_horas_ciclos;
  sem_acao int;
  prox record;
  mes date := date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
begin
  if not (select rh.pode_fechar_banco()) then
    raise exception 'sem permissão para finalizar o ciclo do banco de horas'
      using errcode = '42501';
  end if;
  select * into c from rh.banco_horas_ciclos where id = p_ciclo for update;
  if not found then
    raise exception 'ciclo do banco de horas não encontrado';
  end if;
  if c.finalizado_em is not null then
    raise exception 'o ciclo já foi finalizado';
  end if;
  select count(*) into sem_acao from rh.banco_horas_fechamentos f
    where f.ciclo_id = p_ciclo and f.saldo_min <> 0 and f.acao is null;
  if sem_acao > 0 then
    raise exception 'escolha a ação de % pessoa(s) com saldo antes de finalizar', sem_acao;
  end if;

  update rh.banco_horas_ciclos
    set finalizado_em = now(),
        finalizado_por = auth.uid(),
        total_saldo_min = coalesce((select sum(f.saldo_min) from rh.banco_horas_fechamentos f where f.ciclo_id = p_ciclo), 0),
        total_calculado = (select sum(f.valor_calculado) from rh.banco_horas_fechamentos f where f.ciclo_id = p_ciclo),
        total_realizado = (select sum(f.valor_realizado) from rh.banco_horas_fechamentos f where f.ciclo_id = p_ciclo)
    where id = p_ciclo
    returning * into c;

  select * into prox from rh.proximo_ciclo_banco(c.inicio, c.fim);
  insert into rh.parametros_empresa (
    vigente_desde, regime_tributario, rat_pct, fap,
    banco_horas_inicio, banco_horas_fim, banco_horas_adicional_pct
  )
  select mes, p.regime_tributario, p.rat_pct, p.fap,
    prox.inicio, prox.fim, p.banco_horas_adicional_pct
  from rh.parametros_empresa p
  order by (p.vigente_desde <= mes) desc,
    case when p.vigente_desde <= mes then p.vigente_desde end desc,
    p.vigente_desde
  limit 1
  on conflict (vigente_desde) do update
    set banco_horas_inicio = excluded.banco_horas_inicio,
        banco_horas_fim = excluded.banco_horas_fim;
  return c;
end;
$$;


--
-- Name: orcamentos_anuais; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.orcamentos_anuais (
    ano integer NOT NULL,
    valor numeric(14,2) NOT NULL,
    origem text DEFAULT 'enet'::text NOT NULL,
    recebido_em timestamp with time zone DEFAULT now() NOT NULL,
    finalizado_em timestamp with time zone,
    finalizado_por uuid,
    total_gasto numeric(14,2),
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT orcamentos_anuais_ano_check CHECK (((ano >= 2000) AND (ano <= 2100))),
    CONSTRAINT orcamentos_anuais_check CHECK (((finalizado_em IS NULL) = (total_gasto IS NULL))),
    CONSTRAINT orcamentos_anuais_origem_check CHECK ((origem = 'enet'::text)),
    CONSTRAINT orcamentos_anuais_valor_check CHECK ((valor >= (0)::numeric))
);


--
-- Name: finalizar_orcamento(integer); Type: FUNCTION; Schema: rh; Owner: -
--

CREATE FUNCTION rh.finalizar_orcamento(p_ano integer) RETURNS rh.orcamentos_anuais
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  o rh.orcamentos_anuais;
begin
  if not (select core.pode('rh.orcamento.lancar')) then
    raise exception 'sem permissão para finalizar o orçamento' using errcode = '42501';
  end if;
  select * into o from rh.orcamentos_anuais where ano = p_ano for update;
  if not found then
    raise exception 'o orçamento de % ainda não chegou do ERP', p_ano;
  end if;
  if o.finalizado_em is not null then
    raise exception 'o orçamento de % já foi finalizado', p_ano;
  end if;
  update rh.orcamentos_anuais
    set finalizado_em = now(),
        finalizado_por = auth.uid(),
        total_gasto = coalesce((
          select sum(g.valor) from rh.gastos g
          where g.data >= make_date(p_ano, 1, 1) and g.data < make_date(p_ano + 1, 1, 1)
        ), 0)
    where ano = p_ano
    returning * into o;
  return o;
end;
$$;


--
-- Name: gravar_custos(date, jsonb); Type: FUNCTION; Schema: rh; Owner: -
--

CREATE FUNCTION rh.gravar_custos(p_competencia date, p_linhas jsonb) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  n int;
begin
  if exists (
    select 1 from rh.folhas where competencia = p_competencia and status = 'fechada'
  ) then
    raise exception 'A folha de % está fechada: o custo não é recalculado',
      to_char(p_competencia, 'MM/YYYY');
  end if;

  delete from rh.custos_colaborador where competencia = p_competencia;

  insert into rh.custos_colaborador (
    competencia, colaborador_id, departamento_id, cargo_id, tipo_contrato,
    remuneracao, encargos, provisao_13, provisao_ferias, multa_rescisoria,
    beneficios, rescisao, reembolsos, custo_total, jornada_min, custo_hora,
    salario_hora, memoria, valor_informado
  )
  select
    p_competencia,
    (l ->> 'colaborador_id')::uuid,
    (l ->> 'departamento_id')::uuid,
    (l ->> 'cargo_id')::uuid,
    (l ->> 'tipo_contrato')::rh.tipo_contrato,
    (l ->> 'remuneracao')::numeric,
    (l ->> 'encargos')::numeric,
    (l ->> 'provisao_13')::numeric,
    (l ->> 'provisao_ferias')::numeric,
    (l ->> 'multa_rescisoria')::numeric,
    (l ->> 'beneficios')::numeric,
    (l ->> 'rescisao')::numeric,
    (l ->> 'reembolsos')::numeric,
    (l ->> 'custo_total')::numeric,
    (l ->> 'jornada_min')::int,
    (l ->> 'custo_hora')::numeric,
    (l ->> 'salario_hora')::numeric,
    l -> 'memoria',
    coalesce((l ->> 'valor_informado')::boolean, true)
  from jsonb_array_elements(p_linhas) l;

  get diagnostics n = row_count;
  return n;
end;
$$;


--
-- Name: importar_folha(uuid, jsonb, jsonb, boolean); Type: FUNCTION; Schema: rh; Owner: -
--

CREATE FUNCTION rh.importar_folha(p_importacao_id uuid, p_folha jsonb, p_departamentos jsonb DEFAULT '{}'::jsonb, p_substituir boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_competencia date := (p_folha ->> 'competencia')::date;
  v_importacao core.importacoes;
  v_existente rh.folhas;
  v_folha_id uuid;
  v_colaboradores int;
  v_fora_do_copiloto int;
  v_novas_rubricas int;
  v_novos_departamentos int;
  v_novos_cargos int;
begin
  if not core.pode('rh.folha') then
    raise exception 'sem permissão para importar a folha' using errcode = '42501';
  end if;

  select * into v_importacao from core.importacoes where id = p_importacao_id for update;
  if v_importacao.id is null or v_importacao.tipo <> 'folha' then
    raise exception 'importação não encontrada';
  end if;
  if v_importacao.status <> 'previa' then
    raise exception 'esta importação já foi %', v_importacao.status;
  end if;
  if v_importacao.referencia <> v_competencia then
    raise exception 'a competência do arquivo (%) é diferente da prévia (%)',
      to_char(v_competencia, 'MM/YYYY'), to_char(v_importacao.referencia, 'MM/YYYY');
  end if;

  select * into v_existente from rh.folhas where competencia = v_competencia for update;
  if v_existente.id is not null then
    if v_existente.status = 'fechada' then
      raise exception 'a folha de % está fechada e não pode ser substituída', to_char(v_competencia, 'MM/YYYY');
    end if;
    if not p_substituir then
      raise exception 'já existe folha de %; confirme a substituição', to_char(v_competencia, 'MM/YYYY');
    end if;
    delete from rh.folhas where id = v_existente.id; -- leva pessoas e rubricas (cascade)
  end if;

  update rh.departamentos d
  set codigo_folha = m.key::int
  from jsonb_each_text(p_departamentos) m
  where d.id = m.value::uuid and d.codigo_folha is null;

  insert into rh.departamentos (nome, codigo_folha)
  select distinct 'Departamento ' || (c ->> 'departamento_codigo'), (c ->> 'departamento_codigo')::int
  from jsonb_array_elements(p_folha -> 'colaboradores') c
  where c ->> 'departamento_codigo' is not null
  on conflict (codigo_folha) do nothing;
  get diagnostics v_novos_departamentos = row_count;

  insert into rh.cargos (nome, codigo_folha, cbo)
  select distinct on ((c ->> 'cargo_codigo')::int)
    c ->> 'cargo_nome', (c ->> 'cargo_codigo')::int, c ->> 'cbo'
  from jsonb_array_elements(p_folha -> 'colaboradores') c
  where c ->> 'cargo_codigo' is not null
  on conflict (codigo_folha) do nothing;
  get diagnostics v_novos_cargos = row_count;

  insert into rh.rubricas (codigo, descricao)
  select distinct on ((r ->> 'codigo')::int) (r ->> 'codigo')::int, r ->> 'descricao'
  from jsonb_array_elements(p_folha -> 'colaboradores') c,
       jsonb_array_elements(c -> 'rubricas') r
  on conflict (codigo) do nothing;
  get diagnostics v_novas_rubricas = row_count;

  select count(*) into v_fora_do_copiloto
  from jsonb_array_elements(p_folha -> 'colaboradores') c
  where not exists (
    select 1 from rh.colaboradores x where x.matricula = (c ->> 'matricula')::int
  );

  -- A folha manda no cargo; admissão e departamento só preenchem o que estiver
  -- vazio. Nome e tipo de contrato são do Copiloto.
  update rh.colaboradores x set
    cargo_id = (select g.id from rh.cargos g where g.codigo_folha = (c ->> 'cargo_codigo')::int),
    admissao = coalesce(x.admissao, (c ->> 'admissao')::date),
    departamento_id = coalesce(
      x.departamento_id,
      (select d.id from rh.departamentos d where d.codigo_folha = (c ->> 'departamento_codigo')::int)
    )
  from jsonb_array_elements(p_folha -> 'colaboradores') c
  where x.matricula = (c ->> 'matricula')::int;

  insert into rh.folhas (competencia, importacao_id, resumo_empresa, ficticia)
  values (
    v_competencia,
    p_importacao_id,
    coalesce(p_folha -> 'resumo_empresa', '{}'),
    coalesce((p_folha ->> 'ficticia')::boolean, false)
  )
  returning id into v_folha_id;

  insert into rh.folha_colaboradores (
    folha_id, colaborador_id, situacao, tipo_contrato, departamento_codigo_folha,
    departamento_id, cargo_id, horas_mes_min, salario, base_inss, base_fgts,
    valor_fgts, liquido
  )
  select
    v_folha_id,
    x.id,
    (c ->> 'situacao')::rh.situacao_folha,
    (c ->> 'tipo_contrato')::rh.tipo_contrato,
    (c ->> 'departamento_codigo')::int,
    (select d.id from rh.departamentos d where d.codigo_folha = (c ->> 'departamento_codigo')::int),
    (select g.id from rh.cargos g where g.codigo_folha = (c ->> 'cargo_codigo')::int),
    round((c ->> 'horas_mes')::numeric * 60)::int,
    (c ->> 'salario')::numeric,
    (c ->> 'base_inss')::numeric,
    (c ->> 'base_fgts')::numeric,
    (c ->> 'valor_fgts')::numeric,
    (c ->> 'liquido')::numeric
  from jsonb_array_elements(p_folha -> 'colaboradores') c
  join rh.colaboradores x on x.matricula = (c ->> 'matricula')::int;
  get diagnostics v_colaboradores = row_count;

  insert into rh.folha_rubricas (folha_id, colaborador_id, rubrica_codigo, natureza, referencia, valor)
  select
    v_folha_id,
    x.id,
    (r ->> 'codigo')::int,
    (r ->> 'natureza')::rh.natureza_rubrica,
    (r ->> 'referencia')::numeric,
    (r ->> 'valor')::numeric
  from jsonb_array_elements(p_folha -> 'colaboradores') c
  join rh.colaboradores x on x.matricula = (c ->> 'matricula')::int
  cross join jsonb_array_elements(c -> 'rubricas') r;

  update core.importacoes
  set status = 'substituida'
  where tipo = 'folha' and referencia = v_competencia and status = 'confirmada';

  update core.importacoes
  set status = 'confirmada', confirmado_por = (select auth.uid()), confirmado_em = now()
  where id = p_importacao_id;

  return jsonb_build_object(
    'folha_id', v_folha_id,
    'colaboradores', v_colaboradores,
    'fora_do_copiloto', v_fora_do_copiloto,
    'rubricas_novas', v_novas_rubricas,
    'departamentos_novos', v_novos_departamentos,
    'cargos_novos', v_novos_cargos
  );
end;
$$;


--
-- Name: importar_tabela_plano(uuid, uuid, numeric, jsonb, jsonb); Type: FUNCTION; Schema: rh; Owner: -
--

CREATE FUNCTION rh.importar_tabela_plano(p_importacao_id uuid, p_beneficio_id uuid, p_reajuste_pct numeric, p_faixas jsonb, p_coparticipacao jsonb) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_imp core.importacoes;
  v_tabela uuid;
begin
  if not core.pode('rh.beneficios') then
    raise exception 'Você não tem permissão para importar a tabela do plano'
      using errcode = '42501';
  end if;

  select * into v_imp from core.importacoes where id = p_importacao_id for update;
  if not found or v_imp.tipo <> 'plano_saude' then
    raise exception 'Importação não encontrada. Envie o arquivo de novo';
  end if;
  if v_imp.status <> 'previa' then
    raise exception 'Esta prévia já foi usada. Envie o arquivo de novo';
  end if;
  if not exists (
    select 1 from rh.beneficios
    where id = p_beneficio_id and tipo in ('plano_saude', 'odonto')
  ) then
    raise exception 'Escolha um benefício do tipo plano de saúde ou odonto';
  end if;

  -- Mesma vigência do mesmo benefício: a nova substitui a anterior.
  update core.importacoes i
    set status = 'substituida'
    from rh.plano_tabelas t
    where t.beneficio_id = p_beneficio_id
      and t.vigente_desde = v_imp.referencia
      and t.importacao_id = i.id
      and i.status = 'confirmada';
  delete from rh.plano_tabelas
    where beneficio_id = p_beneficio_id and vigente_desde = v_imp.referencia;

  insert into rh.plano_tabelas (beneficio_id, vigente_desde, reajuste_pct, importacao_id)
    values (p_beneficio_id, v_imp.referencia, p_reajuste_pct, p_importacao_id)
    returning id into v_tabela;

  insert into rh.plano_faixas_etarias (tabela_id, idade_min, idade_max, mensalidade)
    select v_tabela, f.idade_min, f.idade_max, f.mensalidade
    from jsonb_to_recordset(p_faixas)
      as f(idade_min int, idade_max int, mensalidade numeric);

  insert into rh.plano_coparticipacao (
    tabela_id, meses_min, meses_max, colaborador_pct, colaborador_valor_fixo
  )
    select v_tabela, c.meses_min, c.meses_max, c.colaborador_pct, c.colaborador_valor_fixo
    from jsonb_to_recordset(p_coparticipacao)
      as c(meses_min int, meses_max int, colaborador_pct numeric, colaborador_valor_fixo numeric);

  begin
    update core.importacoes
      set status = 'confirmada', confirmado_por = (select auth.uid()), confirmado_em = now()
      where id = p_importacao_id;
  exception when unique_violation then
    raise exception 'Já existe outra tabela confirmada com vigência em %. Escolha outro mês de vigência',
      to_char(v_imp.referencia, 'MM/YYYY');
  end;

  return v_tabela;
end;
$$;


--
-- Name: pode_fechar_banco(); Type: FUNCTION; Schema: rh; Owner: -
--

CREATE FUNCTION rh.pode_fechar_banco() RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select core.pode('rh.parametros') and core.pode('rh.custo_pessoal.individual');
$$;


--
-- Name: ponto_dos_dias(date, date); Type: FUNCTION; Schema: rh; Owner: -
--

CREATE FUNCTION rh.ponto_dos_dias(de date, ate date) RETURNS TABLE(colaborador_id uuid, nome text, matricula integer, departamento_id uuid, departamento text, primeiro_dia date, previstas_min bigint, faltas_min bigint, atrasos_min bigint, faltas_dias bigint, abonos_min jsonb, extras_min jsonb, noturnas_min bigint, banco_saldo_min integer, banco_creditos_min bigint, banco_debitos_min bigint)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $_$
  with dias as (
    select d.*
    from rh.ponto_diario d
    join rh.colaboradores c on c.id = d.colaborador_id
    where d.data between de and ate
      and not c.fora_do_ponto
  ),
  -- Cada coluna de abono/extra: total e o dia em que apareceu primeiro.
  colunas as (
    select x.colaborador_id, 'abonos' as campo, e.key as coluna,
      sum(e.value::numeric) as minutos, min(x.data) as desde
    from dias x, jsonb_each_text(x.abonos_min) e
    group by 1, 2, 3
    union all
    select x.colaborador_id, 'extras', e.key,
      sum(e.value::numeric), min(x.data)
    from dias x, jsonb_each_text(x.extras_min) e
    group by 1, 2, 3
  ),
  pares as (
    select k.colaborador_id, k.campo,
      jsonb_agg(
        jsonb_build_array(k.coluna, k.minutos)
        order by k.desde, octet_length(k.coluna), k.coluna collate "C"
      ) as lista
    from colunas k
    group by 1, 2
  ),
  totais as (
    select x.colaborador_id,
      min(x.data) as primeiro_dia,
      sum(x.previstas_min) as previstas_min,
      sum(x.faltas_min) as faltas_min,
      sum(x.atrasos_min) as atrasos_min,
      count(*) filter (
        where upper(regexp_replace(coalesce(x.ocorrencia, ''), '^\s+|\s+$', '', 'g')) = 'FALTA'
      ) as faltas_dias,
      sum(x.noturnas_min) as noturnas_min,
      (array_agg(x.banco_saldo_min order by x.data desc))[1] as banco_saldo_min,
      sum(x.banco_creditos_min) as banco_creditos_min,
      sum(x.banco_debitos_min) as banco_debitos_min
    from dias x
    group by x.colaborador_id
  )
  select
    t.colaborador_id, c.nome, c.matricula, c.departamento_id, dep.nome,
    t.primeiro_dia, t.previstas_min, t.faltas_min, t.atrasos_min, t.faltas_dias,
    coalesce(a.lista, '[]'::jsonb), coalesce(e.lista, '[]'::jsonb),
    t.noturnas_min, t.banco_saldo_min, t.banco_creditos_min, t.banco_debitos_min
  from totais t
  join rh.colaboradores c on c.id = t.colaborador_id
  left join rh.departamentos dep on dep.id = c.departamento_id
  left join pares a on a.colaborador_id = t.colaborador_id and a.campo = 'abonos'
  left join pares e on e.colaborador_id = t.colaborador_id and e.campo = 'extras';
$_$;


--
-- Name: proximo_ciclo_banco(date, date); Type: FUNCTION; Schema: rh; Owner: -
--

CREATE FUNCTION rh.proximo_ciclo_banco(p_inicio date, p_fim date) RETURNS TABLE(inicio date, fim date)
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  with d as (
    select p_fim + 1 as novo,
      (extract(year from age(p_fim + 1, p_inicio)) * 12
        + extract(month from age(p_fim + 1, p_inicio)))::int as meses
  )
  select d.novo,
    case when d.meses > 0
      then (d.novo + make_interval(months => d.meses))::date - 1
      else d.novo + (p_fim - p_inicio)
    end
  from d;
$$;


--
-- Name: quadro_mensal(date, date); Type: FUNCTION; Schema: rh; Owner: -
--

CREATE FUNCTION rh.quadro_mensal(inicio date, fim date) RETURNS TABLE(competencia date, departamento_id uuid, tipo_contrato rh.tipo_contrato, situacao rh.situacao_folha, colaboradores bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select f.competencia, fc.departamento_id, fc.tipo_contrato, fc.situacao, count(*)
  from rh.folha_colaboradores fc
  join rh.folhas f on f.id = fc.folha_id
  where core.pode_modulo('rh')
    and f.competencia between inicio and fim
  group by 1, 2, 3, 4;
$$;


--
-- Name: salvar_faixas_plano(uuid, jsonb); Type: FUNCTION; Schema: rh; Owner: -
--

CREATE FUNCTION rh.salvar_faixas_plano(p_tabela_id uuid, p_faixas jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if not core.pode('rh.beneficios') then
    raise exception 'Você não tem permissão para editar a tabela do plano'
      using errcode = '42501';
  end if;

  perform 1 from rh.plano_tabelas where id = p_tabela_id for update;
  if not found then
    raise exception 'Tabela do plano não encontrada';
  end if;
  if jsonb_typeof(p_faixas) <> 'array' or jsonb_array_length(p_faixas) = 0 then
    raise exception 'Informe ao menos uma faixa';
  end if;

  delete from rh.plano_faixas_etarias where tabela_id = p_tabela_id;
  insert into rh.plano_faixas_etarias (tabela_id, idade_min, idade_max, mensalidade)
    select p_tabela_id, f.idade_min, f.idade_max, f.mensalidade
    from jsonb_to_recordset(p_faixas)
      as f(idade_min int, idade_max int, mensalidade numeric);

  if exists (
    select 1
    from rh.plano_faixas_etarias a
    join rh.plano_faixas_etarias b
      on b.tabela_id = a.tabela_id and b.idade_min > a.idade_min
    where a.tabela_id = p_tabela_id
      and (a.idade_max is null or a.idade_max >= b.idade_min)
  ) then
    raise exception 'Faixas sobrepostas. Confira as idades';
  end if;

  -- Marca a tabela como alterada (e registra na auditoria dela).
  update rh.plano_tabelas set atualizado_em = now() where id = p_tabela_id;
end;
$$;


--
-- Name: salvar_pessoa_folha(uuid, uuid, jsonb, jsonb); Type: FUNCTION; Schema: rh; Owner: -
--

CREATE FUNCTION rh.salvar_pessoa_folha(p_folha_id uuid, p_colaborador_id uuid, p_pessoa jsonb, p_rubricas jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_folha rh.folhas;
  v_pessoa rh.folha_colaboradores;
  v_codigo int;
  v_rubricas_antes jsonb;
begin
  if not core.pode('rh.folha') then
    raise exception 'Você não tem permissão para editar a folha'
      using errcode = '42501';
  end if;

  select * into v_folha from rh.folhas where id = p_folha_id for update;
  if not found then
    raise exception 'Folha não encontrada';
  end if;
  if v_folha.status = 'fechada' then
    raise exception 'A folha de % está fechada e não pode ser editada',
      to_char(v_folha.competencia, 'MM/YYYY');
  end if;

  select * into v_pessoa from rh.folha_colaboradores
    where folha_id = p_folha_id and colaborador_id = p_colaborador_id;
  if not found then
    raise exception 'Esta pessoa não está na folha';
  end if;
  if jsonb_typeof(p_rubricas) is distinct from 'array' then
    raise exception 'Rubricas inválidas';
  end if;

  select r.codigo into v_codigo
    from jsonb_to_recordset(p_rubricas) as r(codigo int)
    where not exists (select 1 from rh.rubricas x where x.codigo = r.codigo)
    limit 1;
  if found then
    raise exception 'A rubrica % não está cadastrada', v_codigo;
  end if;

  select coalesce(jsonb_agg(rubrica_codigo order by rubrica_codigo), '[]')
    into v_rubricas_antes
    from rh.folha_rubricas
    where folha_id = p_folha_id and colaborador_id = p_colaborador_id;

  update rh.folha_colaboradores set
    tipo_contrato = (p_pessoa ->> 'tipo_contrato')::rh.tipo_contrato,
    departamento_id = (p_pessoa ->> 'departamento_id')::uuid,
    cargo_id = (p_pessoa ->> 'cargo_id')::uuid,
    horas_mes_min = (p_pessoa ->> 'horas_mes_min')::int,
    salario = (p_pessoa ->> 'salario')::numeric
  where folha_id = p_folha_id and colaborador_id = p_colaborador_id;

  delete from rh.folha_rubricas
    where folha_id = p_folha_id and colaborador_id = p_colaborador_id;
  insert into rh.folha_rubricas (folha_id, colaborador_id, rubrica_codigo, natureza, referencia, valor)
    select p_folha_id, p_colaborador_id, r.codigo, r.natureza, r.referencia, r.valor
    from jsonb_to_recordset(p_rubricas)
      as r(codigo int, natureza rh.natureza_rubrica, referencia numeric, valor numeric);

  -- O líquido acompanha as rubricas.
  update rh.folha_colaboradores set liquido = (
    select coalesce(sum(case natureza when 'provento' then valor when 'desconto' then -valor else 0 end), 0)
    from rh.folha_rubricas
    where folha_id = p_folha_id and colaborador_id = p_colaborador_id
  )
  where folha_id = p_folha_id and colaborador_id = p_colaborador_id;

  update rh.folhas set atualizado_em = now() where id = p_folha_id;

  insert into core.auditoria (tabela, registro_id, acao, antes, depois, usuario_id)
  values (
    'rh.folha_colaboradores',
    p_folha_id || ':' || p_colaborador_id,
    'update',
    jsonb_build_object(
      'tipo_contrato', v_pessoa.tipo_contrato,
      'departamento_id', v_pessoa.departamento_id,
      'cargo_id', v_pessoa.cargo_id,
      'horas_mes_min', v_pessoa.horas_mes_min,
      'rubricas', v_rubricas_antes
    ),
    jsonb_build_object(
      'tipo_contrato', p_pessoa ->> 'tipo_contrato',
      'departamento_id', p_pessoa ->> 'departamento_id',
      'cargo_id', p_pessoa ->> 'cargo_id',
      'horas_mes_min', (p_pessoa ->> 'horas_mes_min')::int,
      'salario_alterado', (p_pessoa ->> 'salario')::numeric is distinct from v_pessoa.salario,
      'rubricas', (
        select coalesce(jsonb_agg(r.codigo order by r.codigo), '[]')
        from jsonb_to_recordset(p_rubricas) as r(codigo int)
      )
    ),
    (select auth.uid())
  );
end;
$$;


--
-- Name: socios(); Type: FUNCTION; Schema: rh; Owner: -
--

CREATE FUNCTION rh.socios() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select x.id
  from rh.colaboradores x
  where (select core.pode_modulo('rh'))
    and x.tipo_contrato = 'pro_labore'
  union
  select fc.colaborador_id
  from rh.folha_colaboradores fc
  where (select core.pode_modulo('rh'))
    and fc.tipo_contrato = 'pro_labore'
  union
  select fr.colaborador_id
  from rh.folha_rubricas fr
  join rh.rubricas r on r.codigo = fr.rubrica_codigo
  where (select core.pode_modulo('rh'))
    and r.grupo = 'pro_labore';
$$;


--
-- Name: travar_fechamento_banco(); Type: FUNCTION; Schema: rh; Owner: -
--

CREATE FUNCTION rh.travar_fechamento_banco() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if exists (
    select 1 from rh.banco_horas_ciclos c
    where c.id = (case when tg_op = 'DELETE' then old.ciclo_id else new.ciclo_id end)
      and c.finalizado_em is not null
  ) or (tg_op = 'UPDATE' and exists (
    select 1 from rh.banco_horas_ciclos c
    where c.id = old.ciclo_id and c.finalizado_em is not null
  )) then
    raise exception 'o ciclo do banco de horas já foi finalizado: o fechamento é só leitura';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;


--
-- Name: travar_orcamento_finalizado(); Type: FUNCTION; Schema: rh; Owner: -
--

CREATE FUNCTION rh.travar_orcamento_finalizado() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if old.finalizado_em is not null then
    raise exception 'o orçamento de % já foi finalizado e não muda', old.ano;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;


--
-- Name: acessa(); Type: FUNCTION; Schema: sustentabilidade; Owner: -
--

CREATE FUNCTION sustentabilidade.acessa() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select core.pode_modulo('sustentabilidade');
$$;


--
-- Name: confirmar_importacao(uuid); Type: FUNCTION; Schema: sustentabilidade; Owner: -
--

CREATE FUNCTION sustentabilidade.confirmar_importacao(p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v sustentabilidade.importacoes;
begin
  select * into v from sustentabilidade.importacoes where id = p_id for update;
  if not found then
    raise exception 'importação não encontrada' using errcode = 'P0001';
  end if;
  if not core.pode('sustentabilidade.importar') then
    raise exception 'sem permissão para importar' using errcode = '42501';
  end if;
  if v.status <> 'previa' then
    raise exception 'esta importação não é mais uma prévia' using errcode = '22023';
  end if;
  if v.substitui is not null then
    delete from sustentabilidade.lancamentos where importacao_id = v.substitui;
    delete from sustentabilidade.entrevistas where importacao_id = v.substitui;
    update sustentabilidade.importacoes set status = 'substituida'
      where id = v.substitui and status = 'confirmada';
  end if;
  update sustentabilidade.importacoes
    set status = 'confirmada', confirmado_por = (select auth.uid()), confirmado_em = now()
    where id = p_id;
end;
$$;


--
-- Name: contratos_marcar(); Type: FUNCTION; Schema: sustentabilidade; Owner: -
--

CREATE FUNCTION sustentabilidade.contratos_marcar() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if new.ativacao_corrigida is distinct from old.ativacao_corrigida then
    if new.ativacao_corrigida is null then
      new.ativacao_corrigida_por := null;
      new.ativacao_corrigida_em := null;
      new.ativacao_corrigida_motivo := null;
    else
      new.ativacao_corrigida_por := (select auth.uid());
      new.ativacao_corrigida_em := now();
    end if;
  end if;
  if new.dispensada_motivo is distinct from old.dispensada_motivo then
    if new.dispensada_motivo is null then
      new.dispensada_por := null;
      new.dispensada_em := null;
    else
      new.dispensada_por := (select auth.uid());
      new.dispensada_em := coalesce(old.dispensada_em, now());
    end if;
  end if;
  return new;
end;
$$;


--
-- Name: desfazer_importacao(uuid); Type: FUNCTION; Schema: sustentabilidade; Owner: -
--

CREATE FUNCTION sustentabilidade.desfazer_importacao(p_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v sustentabilidade.importacoes;
  v_n int;
  v_total int := 0;
begin
  select * into v from sustentabilidade.importacoes where id = p_id for update;
  if not found then
    raise exception 'importação não encontrada' using errcode = 'P0001';
  end if;
  if not core.pode('sustentabilidade.importar') then
    raise exception 'sem permissão para desfazer esta importação' using errcode = '42501';
  end if;
  if v.status not in ('previa', 'confirmada') then
    raise exception 'esta importação já foi desfeita ou substituída' using errcode = '22023';
  end if;

  delete from sustentabilidade.lancamentos where importacao_id = p_id;
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;
  delete from sustentabilidade.entrevistas where importacao_id = p_id;
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;
  -- Nome de lista que veio com ela e que nenhum lançamento que ficou usa.
  delete from sustentabilidade.cadastros_lista c
    where c.importacao_id = p_id and not exists (
      select 1 from sustentabilidade.lancamentos l
      where l.programa_id = c.programa_id
        and l.valores ->> c.campo_id in (c.valor, c.id::text));

  update sustentabilidade.importacoes
    set status = 'desfeita', desfeito_por = (select auth.uid()), desfeito_em = now()
    where id = p_id;
  return v_total;
end;
$$;


--
-- Name: entrevistas_resumo(); Type: FUNCTION; Schema: sustentabilidade; Owner: -
--

CREATE FUNCTION sustentabilidade.entrevistas_resumo() RETURNS TABLE(id uuid, contrato_id uuid, lucs text[], cliente_doc text, data date, tipo text, setor text, formulario_versao integer, origem text, entrevistador_id uuid, chamado_id uuid, valida_ate date, tem_pdf boolean, exemplo boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select e.id, e.contrato_id, e.lucs, e.cliente_doc, e.data, e.tipo, e.setor,
    e.formulario_versao, e.origem, e.entrevistador_id, e.chamado_id, e.valida_ate,
    e.pdf is not null, e.exemplo
  from sustentabilidade.entrevistas e
  where e.situacao = 'salva'
    and (select sustentabilidade.pode_alguma(
      'entrevistas.ver', 'entrevistas.aplicar', 'entrevistas.respostas',
      'entrevistas.dispensar', 'clube.ver', 'clube.editar', 'painel'));
$$;


--
-- Name: itens_da_definicao(jsonb); Type: FUNCTION; Schema: sustentabilidade; Owner: -
--

CREATE FUNCTION sustentabilidade.itens_da_definicao(p_definicao jsonb) RETURNS TABLE(pergunta_id text, opcao_id text)
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select p ->> 'id', null::text
  from jsonb_array_elements(p_definicao -> 'secoes') s,
       jsonb_array_elements(s -> 'perguntas') p
  union all
  select p ->> 'id', o ->> 'id'
  from jsonb_array_elements(p_definicao -> 'secoes') s,
       jsonb_array_elements(s -> 'perguntas') p,
       jsonb_array_elements(p -> 'opcoes') o;
$$;


--
-- Name: lancamento_do_programa(); Type: FUNCTION; Schema: sustentabilidade; Owner: -
--

CREATE FUNCTION sustentabilidade.lancamento_do_programa() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if not exists (
    select 1 from sustentabilidade.formularios f
    where f.id = new.formulario_id and f.programa_id = new.programa_id
  ) then
    raise exception 'o formulário não é deste programa' using errcode = '23514';
  end if;
  return new;
end;
$$;


--
-- Name: liberar_substituida(uuid); Type: FUNCTION; Schema: sustentabilidade; Owner: -
--

CREATE FUNCTION sustentabilidade.liberar_substituida(p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v sustentabilidade.importacoes;
begin
  select * into v from sustentabilidade.importacoes where id = p_id for update;
  if not found then
    raise exception 'importação não encontrada' using errcode = 'P0001';
  end if;
  if not core.pode('sustentabilidade.importar') then
    raise exception 'sem permissão para importar' using errcode = '42501';
  end if;
  if v.status <> 'previa' then
    raise exception 'esta importação não é mais uma prévia' using errcode = '22023';
  end if;
  if v.substitui is null then
    return;
  end if;
  perform 1 from sustentabilidade.importacoes where id = v.substitui for update;
  delete from sustentabilidade.lancamentos where importacao_id = v.substitui;
  delete from sustentabilidade.entrevistas where importacao_id = v.substitui;
  update sustentabilidade.importacoes set status = 'substituida'
    where id = v.substitui and status = 'confirmada';
end;
$$;


--
-- Name: link_desligado_fica(); Type: FUNCTION; Schema: sustentabilidade; Owner: -
--

CREATE FUNCTION sustentabilidade.link_desligado_fica() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if old.desligado_em is not null then
    raise exception 'link desligado não pode ser religado; gere um link novo' using errcode = '22023';
  end if;
  return new;
end;
$$;


--
-- Name: meus_programas(); Type: FUNCTION; Schema: sustentabilidade; Owner: -
--

CREATE FUNCTION sustentabilidade.meus_programas() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $_$
  select substring(m from 27)::uuid
  from core.minhas_permissoes() m
  where m ~ '^sustentabilidade\.programa\.[0-9a-f-]{36}$';
$_$;


--
-- Name: pode_alguma(text[]); Type: FUNCTION; Schema: sustentabilidade; Owner: -
--

CREATE FUNCTION sustentabilidade.pode_alguma(VARIADIC p text[]) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1 from core.minhas_permissoes() m
    where m like 'sustentabilidade.%' and substring(m from 18) = any (p)
  );
$$;


--
-- Name: programa_permissao(); Type: FUNCTION; Schema: sustentabilidade; Owner: -
--

CREATE FUNCTION sustentabilidade.programa_permissao() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if tg_op = 'DELETE' then
    delete from core.permissoes where codigo = 'sustentabilidade.programa.' || old.id;
    return old;
  end if;
  if tg_op = 'INSERT' then
    insert into core.permissoes (codigo, descricao)
      values ('sustentabilidade.programa.' || new.id, 'Programa – lançar: ' || new.nome);
    insert into core.cargo_permissoes (cargo_id, permissao)
      select c.id, 'sustentabilidade.programa.' || new.id
      from core.cargos c where c.nome = 'Administrador'
    on conflict do nothing;
  elsif new.nome is distinct from old.nome then
    update core.permissoes set descricao = 'Programa – lançar: ' || new.nome
      where codigo = 'sustentabilidade.programa.' || new.id;
  end if;
  return new;
end;
$$;


--
-- Name: publicar_formulario(uuid, text); Type: FUNCTION; Schema: sustentabilidade; Owner: -
--

CREATE FUNCTION sustentabilidade.publicar_formulario(p_id uuid, p_resumo text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  f sustentabilidade.formularios;
  v_lista text;
  v_versao int;
begin
  select * into f from sustentabilidade.formularios where id = p_id for update;
  if not found then
    raise exception 'formulário não encontrado' using errcode = 'P0001';
  end if;
  if not core.pode(case f.tipo
      when 'questionario' then 'sustentabilidade.entrevistas.questionario'
      else 'sustentabilidade.programas.gerenciar' end) then
    raise exception 'sem permissão para publicar este formulário' using errcode = '42501';
  end if;
  if coalesce(btrim(p_resumo), '') = '' then
    raise exception 'informe o resumo da versão' using errcode = '22023';
  end if;

  select string_agg(u.pergunta_id || coalesce(' (opção ' || u.opcao_id || ')', ''), ', '
           order by u.pergunta_id, u.opcao_id nulls first)
    into v_lista
  from sustentabilidade.uso_do_formulario(p_id) u
  where u.usos > 0 and not exists (
    select 1 from sustentabilidade.itens_da_definicao(f.rascunho) i
    where i.pergunta_id = u.pergunta_id and i.opcao_id is not distinct from u.opcao_id);
  if v_lista is not null then
    raise exception 'já tem respostas ou lançamentos e só pode ser inativado: %', v_lista
      using errcode = '23503';
  end if;

  select string_agg(distinct pi.campo_id, ', ') into v_lista
  from sustentabilidade.programa_indicadores pi
  where pi.formulario_id = p_id and pi.campo_id is not null and not exists (
    select 1 from sustentabilidade.itens_da_definicao(f.rascunho) i
    where i.pergunta_id = pi.campo_id);
  if v_lista is not null then
    raise exception 'campo usado por indicador só pode ser inativado: %', v_lista
      using errcode = '23503';
  end if;

  if f.versao_publicada > 0 and not core.pode('sustentabilidade.formularios.excluir') then
    select string_agg(a.pergunta_id || coalesce(' (opção ' || a.opcao_id || ')', ''), ', '
             order by a.pergunta_id, a.opcao_id nulls first)
      into v_lista
    from sustentabilidade.formulario_versoes v,
         sustentabilidade.itens_da_definicao(v.definicao) a
    where v.formulario_id = p_id and v.versao = f.versao_publicada and not exists (
      select 1 from sustentabilidade.itens_da_definicao(f.rascunho) i
      where i.pergunta_id = a.pergunta_id and i.opcao_id is not distinct from a.opcao_id);
    if v_lista is not null then
      raise exception 'excluir pergunta ou opção exige a permissão de excluir (sem ela, só inativar): %', v_lista
        using errcode = '42501';
    end if;
  end if;

  v_versao := f.versao_publicada + 1;
  insert into sustentabilidade.formulario_versoes (formulario_id, versao, definicao, resumo, publicado_por)
    values (p_id, v_versao, f.rascunho, btrim(p_resumo), (select auth.uid()));
  update sustentabilidade.formularios
    set versao_publicada = v_versao, rascunho_alterado = false
    where id = p_id;
  return v_versao;
end;
$$;


--
-- Name: remover_exemplos(); Type: FUNCTION; Schema: sustentabilidade; Owner: -
--

CREATE FUNCTION sustentabilidade.remover_exemplos() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if not core.pode('sustentabilidade.parametros') then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  delete from sustentabilidade.lancamentos where exemplo;
  delete from sustentabilidade.entrevistas where exemplo;
  delete from sustentabilidade.programa_indicadores i using sustentabilidade.programas p
    where p.id = i.programa_id and p.exemplo
      and not exists (select 1 from sustentabilidade.lancamentos l where l.programa_id = p.id);
  delete from sustentabilidade.formularios f
    where f.exemplo
      and not exists (select 1 from sustentabilidade.lancamentos l where l.formulario_id = f.id)
      and not exists (select 1 from sustentabilidade.programa_indicadores i where i.formulario_id = f.id)
      and (f.tipo <> 'questionario' or not exists (select 1 from sustentabilidade.entrevistas));
  delete from sustentabilidade.programas p
    where p.exemplo
      and not exists (select 1 from sustentabilidade.lancamentos l where l.programa_id = p.id)
      and not exists (select 1 from sustentabilidade.formularios f where f.programa_id = p.id);
  delete from sustentabilidade.participantes where exemplo;
  delete from sustentabilidade.rondas where exemplo;
  delete from sustentabilidade.coletores c
    where c.exemplo
      and not exists (select 1 from sustentabilidade.ronda_itens i where i.coletor_id = c.id);
  delete from sustentabilidade.rcc_notas where exemplo;
  delete from sustentabilidade.rcc_precos where exemplo;
  delete from sustentabilidade.marcos where exemplo;
  delete from sustentabilidade.contratos c
    where c.exemplo
      and not exists (select 1 from sustentabilidade.entrevistas e where e.contrato_id = c.id)
      and not exists (
        select 1 from sustentabilidade.entrevista_transferencias t
        where t.de_contrato_id = c.id or t.para_contrato_id = c.id);
end;
$$;


--
-- Name: uso_do_formulario(uuid); Type: FUNCTION; Schema: sustentabilidade; Owner: -
--

CREATE FUNCTION sustentabilidade.uso_do_formulario(p_id uuid) RETURNS TABLE(pergunta_id text, opcao_id text, usos bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  with f as (
    select id, tipo, rascunho from sustentabilidade.formularios
    where id = p_id and (select sustentabilidade.acessa())
  ),
  itens as (
    select distinct i.pergunta_id, i.opcao_id
    from (
      select rascunho as d from f
      union all
      select v.definicao from sustentabilidade.formulario_versoes v join f on f.id = v.formulario_id
    ) d, sustentabilidade.itens_da_definicao(d.d) i
    where i.pergunta_id is not null
  ),
  respostas as (
    select e.respostas as r
    from sustentabilidade.entrevistas e, f
    where f.tipo = 'questionario' and e.situacao = 'salva'
    union all
    select l.valores || coalesce(lv.valores, '{}'::jsonb)
    from sustentabilidade.lancamentos l
    join f on f.id = l.formulario_id
    left join sustentabilidade.lancamento_valores lv on lv.lancamento_id = l.id
  )
  select i.pergunta_id, i.opcao_id,
    (select count(*) from respostas x
     where case
       when i.opcao_id is null then
         coalesce(x.r -> i.pergunta_id, 'null'::jsonb) not in ('null'::jsonb, '""'::jsonb, '[]'::jsonb, '{}'::jsonb)
       else case jsonb_typeof(x.r -> i.pergunta_id)
         when 'string' then x.r ->> i.pergunta_id = i.opcao_id
         when 'array' then (x.r -> i.pergunta_id) ? i.opcao_id
         when 'object' then (x.r -> i.pergunta_id) ? i.opcao_id
         else false
       end
     end)
  from itens i;
$$;


--
-- Name: versao_imutavel(); Type: FUNCTION; Schema: sustentabilidade; Owner: -
--

CREATE FUNCTION sustentabilidade.versao_imutavel() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if tg_op = 'UPDATE' then
    -- "on delete set null" de quem publicou é a única mudança aceita.
    if new.formulario_id = old.formulario_id and new.versao = old.versao
       and new.definicao = old.definicao and new.resumo = old.resumo
       and new.publicado_em = old.publicado_em and new.publicado_por is null then
      return new;
    end if;
    raise exception 'versão publicada não pode ser alterada' using errcode = '42501';
  end if;
  if exists (select 1 from sustentabilidade.formularios f where f.id = old.formulario_id) then
    raise exception 'versão publicada não pode ser apagada' using errcode = '42501';
  end if;
  return old;
end;
$$;


--
-- Name: itens; Type: TABLE; Schema: calendario; Owner: -
--

CREATE TABLE calendario.itens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo_id uuid NOT NULL,
    titulo text NOT NULL,
    descricao text,
    local text,
    inicio date NOT NULL,
    fim date NOT NULL,
    hora_inicio time without time zone,
    hora_fim time without time zone,
    responsavel_id uuid,
    concluido_em timestamp with time zone,
    concluido_por uuid,
    recorrencia text,
    recorrencia_ate date,
    visibilidade text DEFAULT 'todos'::text NOT NULL,
    setores uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    cargos uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    usuarios uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    criado_por uuid DEFAULT auth.uid(),
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT itens_check CHECK (((fim >= inicio) AND ((fim - inicio) <= 366))),
    CONSTRAINT itens_check1 CHECK (((hora_fim IS NULL) OR (hora_inicio IS NOT NULL))),
    CONSTRAINT itens_check2 CHECK (((hora_fim IS NULL) OR (fim > inicio) OR (hora_fim > hora_inicio))),
    CONSTRAINT itens_check3 CHECK (((recorrencia IS NOT NULL) OR (recorrencia_ate IS NULL))),
    CONSTRAINT itens_check4 CHECK (((recorrencia_ate IS NULL) OR (recorrencia_ate >= inicio))),
    CONSTRAINT itens_check5 CHECK (((recorrencia IS NULL) OR (concluido_em IS NULL))),
    CONSTRAINT itens_check6 CHECK (((visibilidade <> 'restrito'::text) OR (((cardinality(setores) + cardinality(cargos)) + cardinality(usuarios)) > 0))),
    CONSTRAINT itens_check7 CHECK (((cardinality(setores) <= 50) AND (cardinality(cargos) <= 50) AND (cardinality(usuarios) <= 200))),
    CONSTRAINT itens_descricao_check CHECK ((length(descricao) <= 4000)),
    CONSTRAINT itens_local_check CHECK ((length(local) <= 200)),
    CONSTRAINT itens_recorrencia_check CHECK ((recorrencia = ANY (ARRAY['diaria'::text, 'semanal'::text, 'mensal'::text, 'anual'::text]))),
    CONSTRAINT itens_titulo_check CHECK (((length(btrim(titulo)) >= 1) AND (length(btrim(titulo)) <= 160))),
    CONSTRAINT itens_visibilidade_check CHECK ((visibilidade = ANY (ARRAY['todos'::text, 'restrito'::text, 'privado'::text])))
);


--
-- Name: tipos; Type: TABLE; Schema: calendario; Owner: -
--

CREATE TABLE calendario.tipos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    descricao text,
    cor text NOT NULL,
    icone text DEFAULT 'evento'::text NOT NULL,
    usa_horario boolean DEFAULT true NOT NULL,
    usa_periodo boolean DEFAULT false NOT NULL,
    usa_local boolean DEFAULT true NOT NULL,
    usa_responsavel boolean DEFAULT false NOT NULL,
    usa_conclusao boolean DEFAULT false NOT NULL,
    usa_recorrencia boolean DEFAULT true NOT NULL,
    visibilidade_padrao text DEFAULT 'todos'::text NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tipos_cor_check CHECK ((cor ~ '^#[0-9a-f]{6}$'::text)),
    CONSTRAINT tipos_descricao_check CHECK ((length(descricao) <= 200)),
    CONSTRAINT tipos_icone_check CHECK ((icone ~ '^[a-z_]{1,30}$'::text)),
    CONSTRAINT tipos_nome_check CHECK (((length(btrim(nome)) >= 1) AND (length(btrim(nome)) <= 40))),
    CONSTRAINT tipos_visibilidade_padrao_check CHECK ((visibilidade_padrao = ANY (ARRAY['todos'::text, 'restrito'::text, 'privado'::text])))
);


--
-- Name: censo_convites; Type: TABLE; Schema: comercial; Owner: -
--

CREATE TABLE comercial.censo_convites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rodada_id uuid NOT NULL,
    token text DEFAULT replace(((gen_random_uuid())::text || (gen_random_uuid())::text), '-'::text, ''::text) NOT NULL,
    locatario_enet_id text,
    empresa_nome text NOT NULL,
    luc text,
    bloco text,
    enviado_em timestamp with time zone,
    criado_por uuid DEFAULT auth.uid(),
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    exemplo boolean DEFAULT false NOT NULL,
    CONSTRAINT censo_convites_empresa_nome_check CHECK ((btrim(empresa_nome) <> ''::text)),
    CONSTRAINT censo_convites_token_check CHECK ((length(token) >= 32))
);


--
-- Name: censo_respostas; Type: TABLE; Schema: comercial; Owner: -
--

CREATE TABLE comercial.censo_respostas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rodada_id uuid NOT NULL,
    convite_id uuid,
    locatario_enet_id text,
    luc text,
    email text,
    bloco text,
    segmento text,
    empresa_nome text NOT NULL,
    colaboradores integer,
    visitantes_dia integer,
    ticket numeric(14,2),
    mensalidade boolean,
    dias_uso integer,
    conversoes_dia integer,
    expectativas text[] DEFAULT '{}'::text[] NOT NULL,
    sugestao text,
    ticket_ajustado numeric(14,4),
    considerada boolean DEFAULT true NOT NULL,
    origem text DEFAULT 'link'::text NOT NULL,
    lancada_por uuid,
    respondida_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    importacao_id uuid,
    exemplo boolean DEFAULT false NOT NULL,
    CONSTRAINT censo_respostas_check CHECK (((mensalidade IS TRUE) OR (dias_uso IS NULL))),
    CONSTRAINT censo_respostas_colaboradores_check CHECK ((colaboradores >= 0)),
    CONSTRAINT censo_respostas_conversoes_dia_check CHECK ((conversoes_dia >= 0)),
    CONSTRAINT censo_respostas_dias_uso_check CHECK (((dias_uso >= 1) AND (dias_uso <= 31))),
    CONSTRAINT censo_respostas_empresa_nome_check CHECK ((btrim(empresa_nome) <> ''::text)),
    CONSTRAINT censo_respostas_origem_check CHECK ((origem = ANY (ARRAY['link'::text, 'presencial'::text, 'importacao'::text]))),
    CONSTRAINT censo_respostas_ticket_ajustado_check CHECK ((ticket_ajustado >= (0)::numeric)),
    CONSTRAINT censo_respostas_ticket_check CHECK ((ticket >= (0)::numeric)),
    CONSTRAINT censo_respostas_visitantes_dia_check CHECK ((visitantes_dia >= 0))
);


--
-- Name: censo_rodadas; Type: TABLE; Schema: comercial; Owner: -
--

CREATE TABLE comercial.censo_rodadas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    inicio date NOT NULL,
    fim date NOT NULL,
    situacao text DEFAULT 'aberta'::text NOT NULL,
    criada_por uuid DEFAULT auth.uid(),
    criada_em timestamp with time zone DEFAULT now() NOT NULL,
    encerrada_por uuid,
    encerrada_em timestamp with time zone,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    importacao_id uuid,
    exemplo boolean DEFAULT false NOT NULL,
    CONSTRAINT censo_rodadas_check CHECK ((fim >= inicio)),
    CONSTRAINT censo_rodadas_nome_check CHECK ((btrim(nome) <> ''::text)),
    CONSTRAINT censo_rodadas_situacao_check CHECK ((situacao = ANY (ARRAY['aberta'::text, 'encerrada'::text])))
);


--
-- Name: censo_sugestao_temas; Type: TABLE; Schema: comercial; Owner: -
--

CREATE TABLE comercial.censo_sugestao_temas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tema_id uuid NOT NULL,
    resposta_id uuid,
    contato_id uuid,
    trecho text,
    origem text DEFAULT 'manual'::text NOT NULL,
    movido_por uuid,
    movido_em timestamp with time zone,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    exemplo boolean DEFAULT false NOT NULL,
    CONSTRAINT censo_sugestao_temas_check CHECK (((resposta_id IS NULL) <> (contato_id IS NULL))),
    CONSTRAINT censo_sugestao_temas_origem_check CHECK ((origem = ANY (ARRAY['manual'::text, 'ia'::text, 'importacao'::text])))
);


--
-- Name: censo_temas; Type: TABLE; Schema: comercial; Owner: -
--

CREATE TABLE comercial.censo_temas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    exemplo boolean DEFAULT false NOT NULL,
    CONSTRAINT censo_temas_nome_check CHECK ((btrim(nome) <> ''::text))
);


--
-- Name: contatos; Type: TABLE; Schema: comercial; Owner: -
--

CREATE TABLE comercial.contatos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    data date DEFAULT CURRENT_DATE NOT NULL,
    locatario_enet_id text,
    locatario_nome text NOT NULL,
    contrato_enet_id text,
    luc text,
    bloco text,
    tipo text NOT NULL,
    canal text NOT NULL,
    descricao text NOT NULL,
    precisa_outro_setor boolean DEFAULT false NOT NULL,
    registrado_por uuid DEFAULT auth.uid(),
    registrado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    importacao_id uuid,
    exemplo boolean DEFAULT false NOT NULL,
    CONSTRAINT contatos_canal_check CHECK ((btrim(canal) <> ''::text)),
    CONSTRAINT contatos_descricao_check CHECK ((btrim(descricao) <> ''::text)),
    CONSTRAINT contatos_locatario_nome_check CHECK ((btrim(locatario_nome) <> ''::text)),
    CONSTRAINT contatos_tipo_check CHECK ((btrim(tipo) <> ''::text))
);


--
-- Name: contrato_anexos; Type: TABLE; Schema: comercial; Owner: -
--

CREATE TABLE comercial.contrato_anexos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contrato_id uuid NOT NULL,
    tipo text NOT NULL,
    arquivo_path text NOT NULL,
    arquivo_nome text NOT NULL,
    tamanho bigint,
    tipo_mime text,
    enviado_por uuid DEFAULT auth.uid(),
    enviado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contrato_anexos_tamanho_check CHECK ((tamanho >= 0)),
    CONSTRAINT contrato_anexos_tipo_check CHECK ((tipo = ANY (ARRAY['planta'::text, 'vistoria'::text, 'garantia'::text, 'comprovante_caucao'::text, 'comprovante_capitalizacao'::text, 'apolice'::text, 'credencial'::text, 'outro'::text])))
);


--
-- Name: contrato_kit; Type: TABLE; Schema: comercial; Owner: -
--

CREATE TABLE comercial.contrato_kit (
    contrato_id uuid NOT NULL,
    versao_id uuid NOT NULL
);


--
-- Name: contrato_versoes; Type: TABLE; Schema: comercial; Owner: -
--

CREATE TABLE comercial.contrato_versoes (
    id bigint NOT NULL,
    contrato_id uuid NOT NULL,
    versao integer NOT NULL,
    status text NOT NULL,
    etapa_atual integer NOT NULL,
    conteudo jsonb NOT NULL,
    por uuid,
    em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contrato_versoes_id_seq; Type: SEQUENCE; Schema: comercial; Owner: -
--

ALTER TABLE comercial.contrato_versoes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME comercial.contrato_versoes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: contratos; Type: TABLE; Schema: comercial; Owner: -
--

CREATE TABLE comercial.contratos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo text NOT NULL,
    status text DEFAULT 'rascunho'::text NOT NULL,
    versao integer DEFAULT 1 NOT NULL,
    etapa_atual integer DEFAULT 1 NOT NULL,
    lucs text[] DEFAULT '{}'::text[] NOT NULL,
    bloco text,
    area_m2 numeric(10,2),
    locatario_nome text,
    parte_tipo text,
    garantia text,
    aluguel numeric(14,2),
    inicio date,
    termino date,
    dados jsonb DEFAULT '{}'::jsonb NOT NULL,
    ficha_id uuid,
    contrato_enet_id text,
    criado_por uuid DEFAULT auth.uid(),
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_por uuid,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    gerado_por uuid,
    gerado_em timestamp with time zone,
    exemplo boolean DEFAULT false NOT NULL,
    CONSTRAINT contratos_aluguel_check CHECK ((aluguel >= (0)::numeric)),
    CONSTRAINT contratos_area_m2_check CHECK ((area_m2 >= (0)::numeric)),
    CONSTRAINT contratos_dados_check CHECK ((jsonb_typeof(dados) = 'object'::text)),
    CONSTRAINT contratos_etapa_atual_check CHECK (((etapa_atual >= 1) AND (etapa_atual <= 8))),
    CONSTRAINT contratos_garantia_check CHECK ((garantia = ANY (ARRAY['fiador'::text, 'capitalizacao'::text, 'seguro_fianca'::text, 'caucao'::text, 'sem_garantia'::text]))),
    CONSTRAINT contratos_parte_tipo_check CHECK ((parte_tipo = ANY (ARRAY['pf'::text, 'pj'::text]))),
    CONSTRAINT contratos_status_check CHECK ((status = ANY (ARRAY['rascunho'::text, 'pronto'::text, 'gerado'::text]))),
    CONSTRAINT contratos_tipo_check CHECK ((tipo = ANY (ARRAY['contrato'::text, 'distrato'::text]))),
    CONSTRAINT contratos_versao_check CHECK ((versao >= 1))
);


--
-- Name: faixas_evento; Type: TABLE; Schema: comercial; Owner: -
--

CREATE TABLE comercial.faixas_evento (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ordem integer NOT NULL,
    nome text NOT NULL,
    area_de numeric(10,2) NOT NULL,
    area_ate numeric(10,2) NOT NULL,
    fixo boolean DEFAULT false NOT NULL,
    valor_comum numeric(14,2) NOT NULL,
    valor_sazonal numeric(14,2) NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT faixas_evento_area_de_check CHECK ((area_de >= (0)::numeric)),
    CONSTRAINT faixas_evento_check CHECK ((area_ate > area_de)),
    CONSTRAINT faixas_evento_nome_check CHECK ((btrim(nome) <> ''::text)),
    CONSTRAINT faixas_evento_valor_comum_check CHECK ((valor_comum >= (0)::numeric)),
    CONSTRAINT faixas_evento_valor_sazonal_check CHECK ((valor_sazonal >= (0)::numeric))
);


--
-- Name: ficha_acessos; Type: TABLE; Schema: comercial; Owner: -
--

CREATE TABLE comercial.ficha_acessos (
    id bigint NOT NULL,
    ficha_id uuid NOT NULL,
    usuario_id uuid DEFAULT auth.uid() NOT NULL,
    acao text DEFAULT 'abriu'::text NOT NULL,
    em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ficha_acessos_acao_check CHECK ((acao = ANY (ARRAY['abriu'::text, 'pdf'::text, 'documento'::text])))
);


--
-- Name: ficha_acessos_id_seq; Type: SEQUENCE; Schema: comercial; Owner: -
--

ALTER TABLE comercial.ficha_acessos ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME comercial.ficha_acessos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ficha_dados; Type: TABLE; Schema: comercial; Owner: -
--

CREATE TABLE comercial.ficha_dados (
    ficha_id uuid NOT NULL,
    documento text,
    respostas jsonb DEFAULT '{}'::jsonb NOT NULL,
    assinatura_nome text,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ficha_dados_documento_check CHECK ((documento ~ '^[0-9]{11}([0-9]{3})?$'::text)),
    CONSTRAINT ficha_dados_respostas_check CHECK ((jsonb_typeof(respostas) = 'object'::text))
);


--
-- Name: ficha_documentos; Type: TABLE; Schema: comercial; Owner: -
--

CREATE TABLE comercial.ficha_documentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ficha_id uuid NOT NULL,
    documento text NOT NULL,
    arquivo_path text NOT NULL,
    arquivo_nome text NOT NULL,
    tamanho bigint,
    tipo_mime text,
    enviado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ficha_documentos_documento_check CHECK ((btrim(documento) <> ''::text)),
    CONSTRAINT ficha_documentos_tamanho_check CHECK ((tamanho >= 0))
);


--
-- Name: fichas; Type: TABLE; Schema: comercial; Owner: -
--

CREATE TABLE comercial.fichas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token text DEFAULT replace(((gen_random_uuid())::text || (gen_random_uuid())::text), '-'::text, ''::text) NOT NULL,
    tipo text,
    situacao text DEFAULT 'em_preenchimento'::text NOT NULL,
    luc text,
    nome text,
    ficha_principal_id uuid,
    origem text DEFAULT 'sistema'::text NOT NULL,
    gerada_por uuid DEFAULT auth.uid(),
    gerada_em timestamp with time zone DEFAULT now() NOT NULL,
    expira_em timestamp with time zone,
    iniciada_em timestamp with time zone,
    consentimento_em timestamp with time zone,
    recebida_em timestamp with time zone,
    usada_em timestamp with time zone,
    ultimo_acesso_em timestamp with time zone,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    importacao_id uuid,
    exemplo boolean DEFAULT false NOT NULL,
    cancelada_em timestamp with time zone,
    rd_oportunidade text,
    CONSTRAINT fichas_cancelada_em_preenchimento CHECK (((cancelada_em IS NULL) OR (situacao = 'em_preenchimento'::text))),
    CONSTRAINT fichas_check CHECK (((situacao = 'em_preenchimento'::text) OR ((consentimento_em IS NOT NULL) AND (recebida_em IS NOT NULL)))),
    CONSTRAINT fichas_origem_check CHECK ((origem = ANY (ARRAY['sistema'::text, 'google_forms'::text]))),
    CONSTRAINT fichas_rd_oportunidade_check CHECK (((rd_oportunidade IS NULL) OR (length(rd_oportunidade) <= 200))),
    CONSTRAINT fichas_situacao_check CHECK ((situacao = ANY (ARRAY['em_preenchimento'::text, 'recebida'::text, 'usada'::text]))),
    CONSTRAINT fichas_tipo_check CHECK ((tipo = ANY (ARRAY['pj'::text, 'pf'::text, 'fiador'::text]))),
    CONSTRAINT fichas_token_check CHECK ((length(token) >= 32))
);


--
-- Name: fontes_de_para; Type: TABLE; Schema: comercial; Owner: -
--

CREATE TABLE comercial.fontes_de_para (
    fonte_rd text NOT NULL,
    fonte_ajustada text NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fontes_de_para_fonte_ajustada_check CHECK ((btrim(fonte_ajustada) <> ''::text)),
    CONSTRAINT fontes_de_para_fonte_rd_check CHECK ((btrim(fonte_rd) <> ''::text))
);


--
-- Name: importacoes; Type: TABLE; Schema: comercial; Owner: -
--

CREATE TABLE comercial.importacoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo text NOT NULL,
    arquivo_nome text NOT NULL,
    arquivo_path text,
    arquivo_sha256 text NOT NULL,
    linhas integer DEFAULT 0 NOT NULL,
    duplicadas integer DEFAULT 0 NOT NULL,
    com_aviso integer DEFAULT 0 NOT NULL,
    avisos jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'previa'::text NOT NULL,
    enviado_por uuid,
    confirmado_por uuid,
    confirmado_em timestamp with time zone,
    desfeito_por uuid,
    desfeito_em timestamp with time zone,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT importacoes_avisos_check CHECK ((jsonb_typeof(avisos) = 'array'::text)),
    CONSTRAINT importacoes_com_aviso_check CHECK ((com_aviso >= 0)),
    CONSTRAINT importacoes_duplicadas_check CHECK ((duplicadas >= 0)),
    CONSTRAINT importacoes_linhas_check CHECK ((linhas >= 0)),
    CONSTRAINT importacoes_status_check CHECK ((status = ANY (ARRAY['previa'::text, 'confirmando'::text, 'confirmada'::text, 'desfeita'::text]))),
    CONSTRAINT importacoes_tipo_check CHECK ((tipo = ANY (ARRAY['censo'::text, 'fichas'::text, 'pesquisa'::text, 'contatos'::text])))
);


--
-- Name: kit_documentos; Type: TABLE; Schema: comercial; Owner: -
--

CREATE TABLE comercial.kit_documentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    categoria text NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    blocos text[] DEFAULT '{}'::text[] NOT NULL,
    todo_contrato boolean DEFAULT false NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT kit_documentos_categoria_check CHECK ((btrim(categoria) <> ''::text)),
    CONSTRAINT kit_documentos_nome_check CHECK ((btrim(nome) <> ''::text))
);


--
-- Name: kit_versoes; Type: TABLE; Schema: comercial; Owner: -
--

CREATE TABLE comercial.kit_versoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    documento_id uuid NOT NULL,
    versao text NOT NULL,
    data date,
    validade date,
    paginas integer,
    arquivo_path text,
    arquivo_nome text,
    tamanho bigint,
    atual boolean DEFAULT true NOT NULL,
    enviado_por uuid DEFAULT auth.uid(),
    enviado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT kit_versoes_paginas_check CHECK ((paginas > 0)),
    CONSTRAINT kit_versoes_tamanho_check CHECK ((tamanho >= 0)),
    CONSTRAINT kit_versoes_versao_check CHECK ((btrim(versao) <> ''::text))
);


--
-- Name: listas; Type: TABLE; Schema: comercial; Owner: -
--

CREATE TABLE comercial.listas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lista text NOT NULL,
    valor text NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    extra jsonb DEFAULT '{}'::jsonb NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT listas_extra_check CHECK ((jsonb_typeof(extra) = 'object'::text)),
    CONSTRAINT listas_lista_check CHECK ((lista = ANY (ARRAY['fonte_ajustada'::text, 'tipo_contato'::text, 'canal_contato'::text, 'censo_bloco'::text, 'censo_segmento'::text, 'censo_expectativa'::text, 'pesquisa_bairro'::text, 'pesquisa_tipo'::text, 'ficha_documento_pf'::text, 'ficha_documento_pj'::text, 'ficha_documento_fiador'::text, 'evento_observacao'::text, 'kit_categoria'::text]))),
    CONSTRAINT listas_valor_check CHECK ((btrim(valor) <> ''::text))
);


--
-- Name: ocupacao_fotos; Type: TABLE; Schema: comercial; Owner: -
--

CREATE TABLE comercial.ocupacao_fotos (
    mes core.competencia NOT NULL,
    lucs integer NOT NULL,
    lucs_locados integer NOT NULL,
    abl_total numeric(12,2) NOT NULL,
    abl_locada numeric(12,2) NOT NULL,
    clientes_ativos integer,
    por_bloco jsonb DEFAULT '{}'::jsonb NOT NULL,
    por_tipo jsonb DEFAULT '{}'::jsonb NOT NULL,
    gravada_em timestamp with time zone DEFAULT now() NOT NULL,
    exemplo boolean DEFAULT false NOT NULL,
    CONSTRAINT ocupacao_fotos_abl_locada_check CHECK ((abl_locada >= (0)::numeric)),
    CONSTRAINT ocupacao_fotos_abl_total_check CHECK ((abl_total >= (0)::numeric)),
    CONSTRAINT ocupacao_fotos_clientes_ativos_check CHECK ((clientes_ativos >= 0)),
    CONSTRAINT ocupacao_fotos_lucs_check CHECK ((lucs >= 0)),
    CONSTRAINT ocupacao_fotos_lucs_locados_check CHECK ((lucs_locados >= 0)),
    CONSTRAINT ocupacao_fotos_por_bloco_check CHECK ((jsonb_typeof(por_bloco) = 'object'::text)),
    CONSTRAINT ocupacao_fotos_por_tipo_check CHECK ((jsonb_typeof(por_tipo) = 'object'::text))
);


--
-- Name: parametros; Type: TABLE; Schema: comercial; Owner: -
--

CREATE TABLE comercial.parametros (
    id boolean DEFAULT true NOT NULL,
    funil_padrao text DEFAULT 'Comercial - Espaço Arp'::text NOT NULL,
    transferencia_dias integer DEFAULT 30 NOT NULL,
    curva_a_pct numeric(5,2) DEFAULT 70 NOT NULL,
    curva_b_pct numeric(5,2) DEFAULT 90 NOT NULL,
    vencimento_faixa1_dias integer DEFAULT 30 NOT NULL,
    vencimento_faixa2_dias integer DEFAULT 90 NOT NULL,
    lembrete_aniversario_dias integer DEFAULT 3 NOT NULL,
    reajuste_previsto_dias integer DEFAULT 60 NOT NULL,
    empreendimento_nome text DEFAULT 'ARP'::text NOT NULL,
    endereco_cep text DEFAULT '28613-001'::text NOT NULL,
    endereco_logradouro text DEFAULT 'Av. Conselheiro Julius Arp'::text NOT NULL,
    endereco_numero text DEFAULT '80'::text NOT NULL,
    endereco_complemento text,
    endereco_bairro text DEFAULT 'Centro'::text NOT NULL,
    endereco_cidade text DEFAULT 'Nova Friburgo'::text NOT NULL,
    endereco_uf text DEFAULT 'RJ'::text NOT NULL,
    indice_padrao text DEFAULT 'IGPM'::text NOT NULL,
    dia_vencimento_padrao integer DEFAULT 10 NOT NULL,
    caucao_alugueis numeric(5,2) DEFAULT 3 NOT NULL,
    caucao_prazo_dias integer DEFAULT 5 NOT NULL,
    capitalizacao_prazo_dias integer DEFAULT 7 NOT NULL,
    nc004_versao text DEFAULT 'JUL/26'::text NOT NULL,
    obras_tapume_dias integer DEFAULT 7 NOT NULL,
    obras_retirada_dias integer DEFAULT 60 NOT NULL,
    obras_projetos_dias integer DEFAULT 60 NOT NULL,
    multa_alugueis numeric(5,2) DEFAULT 3 NOT NULL,
    vaga_promocional_padrao integer DEFAULT 1 NOT NULL,
    consumo_agua_padrao boolean DEFAULT true NOT NULL,
    entrega_tipo_imovel text DEFAULT 'Loja'::text NOT NULL,
    entrega_padrao text DEFAULT 'Shell / infraestrutura básica'::text NOT NULL,
    entrega_prazo_implantacao_dias integer DEFAULT 60 NOT NULL,
    obrigatorios_garantia jsonb DEFAULT '{}'::jsonb NOT NULL,
    ficha_boas_vindas text DEFAULT ''::text NOT NULL,
    ficha_termo_lgpd text DEFAULT ''::text NOT NULL,
    ficha_validade_dias integer DEFAULT 30 NOT NULL,
    censo_dias_mensalidade integer DEFAULT 22 NOT NULL,
    kit_aviso_dias integer DEFAULT 60 NOT NULL,
    evento_reajuste_pct numeric(5,2) DEFAULT 10 NOT NULL,
    evento_desconto_pct numeric(5,2) DEFAULT 30 NOT NULL,
    evento_pessoas_por_seguranca integer DEFAULT 100 NOT NULL,
    evento_m2_por_agente integer DEFAULT 200 NOT NULL,
    evento_fechamento_dias_uteis integer DEFAULT 30 NOT NULL,
    evento_validade_dias integer DEFAULT 30 NOT NULL,
    evento_horario text DEFAULT '10h às 22h'::text NOT NULL,
    evento_condicao_pagamento text DEFAULT '50% na reserva e 50% 48h antes da realização'::text NOT NULL,
    evento_montagem text DEFAULT 'Dia anterior, a partir das 19h'::text NOT NULL,
    evento_desmontagem text DEFAULT 'Liberar até 02h após o final da ação'::text NOT NULL,
    evento_area_texto text DEFAULT 'Partes demarcadas em planta anexa'::text NOT NULL,
    evento_notas text[] DEFAULT '{}'::text[] NOT NULL,
    pesquisa_faixas_m2 numeric[] DEFAULT '{30,50,80,100}'::numeric[] NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT parametros_capitalizacao_prazo_dias_check CHECK ((capitalizacao_prazo_dias >= 0)),
    CONSTRAINT parametros_caucao_alugueis_check CHECK ((caucao_alugueis > (0)::numeric)),
    CONSTRAINT parametros_caucao_prazo_dias_check CHECK ((caucao_prazo_dias >= 0)),
    CONSTRAINT parametros_censo_dias_mensalidade_check CHECK (((censo_dias_mensalidade >= 1) AND (censo_dias_mensalidade <= 31))),
    CONSTRAINT parametros_check CHECK ((curva_a_pct < curva_b_pct)),
    CONSTRAINT parametros_check1 CHECK ((vencimento_faixa1_dias < vencimento_faixa2_dias)),
    CONSTRAINT parametros_curva_a_pct_check CHECK (((curva_a_pct > (0)::numeric) AND (curva_a_pct < (100)::numeric))),
    CONSTRAINT parametros_curva_b_pct_check CHECK (((curva_b_pct > (0)::numeric) AND (curva_b_pct < (100)::numeric))),
    CONSTRAINT parametros_dia_vencimento_padrao_check CHECK (((dia_vencimento_padrao >= 1) AND (dia_vencimento_padrao <= 31))),
    CONSTRAINT parametros_empreendimento_nome_check CHECK ((btrim(empreendimento_nome) <> ''::text)),
    CONSTRAINT parametros_endereco_uf_check CHECK ((endereco_uf ~ '^[A-Z]{2}$'::text)),
    CONSTRAINT parametros_entrega_prazo_implantacao_dias_check CHECK ((entrega_prazo_implantacao_dias >= 0)),
    CONSTRAINT parametros_evento_desconto_pct_check CHECK (((evento_desconto_pct >= (0)::numeric) AND (evento_desconto_pct <= (100)::numeric))),
    CONSTRAINT parametros_evento_fechamento_dias_uteis_check CHECK ((evento_fechamento_dias_uteis >= 0)),
    CONSTRAINT parametros_evento_m2_por_agente_check CHECK ((evento_m2_por_agente > 0)),
    CONSTRAINT parametros_evento_pessoas_por_seguranca_check CHECK ((evento_pessoas_por_seguranca > 0)),
    CONSTRAINT parametros_evento_validade_dias_check CHECK ((evento_validade_dias > 0)),
    CONSTRAINT parametros_ficha_validade_dias_check CHECK (((ficha_validade_dias >= 1) AND (ficha_validade_dias <= 365))),
    CONSTRAINT parametros_funil_padrao_check CHECK ((btrim(funil_padrao) <> ''::text)),
    CONSTRAINT parametros_id_check CHECK (id),
    CONSTRAINT parametros_indice_padrao_check CHECK ((indice_padrao = ANY (ARRAY['IGPM'::text, 'IPCA'::text]))),
    CONSTRAINT parametros_kit_aviso_dias_check CHECK (((kit_aviso_dias >= 0) AND (kit_aviso_dias <= 365))),
    CONSTRAINT parametros_lembrete_aniversario_dias_check CHECK (((lembrete_aniversario_dias >= 0) AND (lembrete_aniversario_dias <= 60))),
    CONSTRAINT parametros_multa_alugueis_check CHECK ((multa_alugueis >= (0)::numeric)),
    CONSTRAINT parametros_nc004_versao_check CHECK ((btrim(nc004_versao) <> ''::text)),
    CONSTRAINT parametros_obras_projetos_dias_check CHECK ((obras_projetos_dias >= 0)),
    CONSTRAINT parametros_obras_retirada_dias_check CHECK ((obras_retirada_dias >= 0)),
    CONSTRAINT parametros_obras_tapume_dias_check CHECK ((obras_tapume_dias >= 0)),
    CONSTRAINT parametros_obrigatorios_garantia_check CHECK ((jsonb_typeof(obrigatorios_garantia) = 'object'::text)),
    CONSTRAINT parametros_pesquisa_faixas_m2_check CHECK ((cardinality(pesquisa_faixas_m2) > 0)),
    CONSTRAINT parametros_reajuste_previsto_dias_check CHECK (((reajuste_previsto_dias >= 1) AND (reajuste_previsto_dias <= 365))),
    CONSTRAINT parametros_transferencia_dias_check CHECK (((transferencia_dias >= 0) AND (transferencia_dias <= 365))),
    CONSTRAINT parametros_vaga_promocional_padrao_check CHECK ((vaga_promocional_padrao >= 0)),
    CONSTRAINT parametros_vencimento_faixa1_dias_check CHECK ((vencimento_faixa1_dias > 0)),
    CONSTRAINT parametros_vencimento_faixa2_dias_check CHECK ((vencimento_faixa2_dias > 0))
);


--
-- Name: pesquisa_imoveis; Type: TABLE; Schema: comercial; Owner: -
--

CREATE TABLE comercial.pesquisa_imoveis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    data_pesquisa date NOT NULL,
    endereco text NOT NULL,
    cep text,
    bairro text NOT NULL,
    tipo text NOT NULL,
    area_m2 numeric(10,2) NOT NULL,
    aluguel numeric(14,2) NOT NULL,
    condominio numeric(14,2),
    iptu numeric(14,2),
    vagas integer,
    observacao text,
    fonte text,
    valor_m2 numeric GENERATED ALWAYS AS ((aluguel / area_m2)) STORED,
    custo_total numeric GENERATED ALWAYS AS (((aluguel + COALESCE(condominio, (0)::numeric)) + COALESCE(iptu, (0)::numeric))) STORED,
    custo_m2 numeric GENERATED ALWAYS AS ((((aluguel + COALESCE(condominio, (0)::numeric)) + COALESCE(iptu, (0)::numeric)) / area_m2)) STORED,
    criado_por uuid DEFAULT auth.uid(),
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    importacao_id uuid,
    exemplo boolean DEFAULT false NOT NULL,
    CONSTRAINT pesquisa_imoveis_aluguel_check CHECK ((aluguel >= (0)::numeric)),
    CONSTRAINT pesquisa_imoveis_area_m2_check CHECK ((area_m2 > (0)::numeric)),
    CONSTRAINT pesquisa_imoveis_bairro_check CHECK ((btrim(bairro) <> ''::text)),
    CONSTRAINT pesquisa_imoveis_cep_check CHECK ((cep ~ '^[0-9]{5}-?[0-9]{3}$'::text)),
    CONSTRAINT pesquisa_imoveis_condominio_check CHECK ((condominio >= (0)::numeric)),
    CONSTRAINT pesquisa_imoveis_endereco_check CHECK ((btrim(endereco) <> ''::text)),
    CONSTRAINT pesquisa_imoveis_iptu_check CHECK ((iptu >= (0)::numeric)),
    CONSTRAINT pesquisa_imoveis_tipo_check CHECK ((btrim(tipo) <> ''::text)),
    CONSTRAINT pesquisa_imoveis_vagas_check CHECK ((vagas >= 0))
);


--
-- Name: propostas_evento; Type: TABLE; Schema: comercial; Owner: -
--

CREATE TABLE comercial.propostas_evento (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente text NOT NULL,
    data_evento date,
    data_evento_fim date,
    horario text,
    tipo_data text DEFAULT 'comum'::text NOT NULL,
    area_m2 numeric(10,2) NOT NULL,
    dias integer DEFAULT 1 NOT NULL,
    pessoas integer,
    desconto_pct numeric(5,2) DEFAULT 0 NOT NULL,
    valor_original numeric(14,2) NOT NULL,
    valor_parceria numeric(14,2) NOT NULL,
    desconto_primeira_edicao numeric(14,2) DEFAULT 0 NOT NULL,
    valor_final numeric(14,2) NOT NULL,
    segurancas integer,
    agentes_limpeza integer,
    condicao_pagamento text,
    montagem text,
    desmontagem text,
    fechamento_ate date,
    area_evento text,
    notas text[] DEFAULT '{}'::text[] NOT NULL,
    observacoes text[] DEFAULT '{}'::text[] NOT NULL,
    validade date,
    status text DEFAULT 'rascunho'::text NOT NULL,
    oportunidade_rd text,
    calculo jsonb DEFAULT '{}'::jsonb NOT NULL,
    criado_por uuid DEFAULT auth.uid(),
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    exemplo boolean DEFAULT false NOT NULL,
    CONSTRAINT propostas_evento_agentes_limpeza_check CHECK ((agentes_limpeza >= 0)),
    CONSTRAINT propostas_evento_area_m2_check CHECK ((area_m2 > (0)::numeric)),
    CONSTRAINT propostas_evento_calculo_check CHECK ((jsonb_typeof(calculo) = 'object'::text)),
    CONSTRAINT propostas_evento_check CHECK (((data_evento_fim IS NULL) OR (data_evento IS NULL) OR (data_evento_fim >= data_evento))),
    CONSTRAINT propostas_evento_cliente_check CHECK ((btrim(cliente) <> ''::text)),
    CONSTRAINT propostas_evento_desconto_pct_check CHECK (((desconto_pct >= (0)::numeric) AND (desconto_pct <= (100)::numeric))),
    CONSTRAINT propostas_evento_desconto_primeira_edicao_check CHECK ((desconto_primeira_edicao >= (0)::numeric)),
    CONSTRAINT propostas_evento_dias_check CHECK ((dias > 0)),
    CONSTRAINT propostas_evento_pessoas_check CHECK ((pessoas >= 0)),
    CONSTRAINT propostas_evento_segurancas_check CHECK ((segurancas >= 0)),
    CONSTRAINT propostas_evento_status_check CHECK ((status = ANY (ARRAY['rascunho'::text, 'enviada'::text, 'fechada'::text, 'perdida'::text]))),
    CONSTRAINT propostas_evento_tipo_data_check CHECK ((tipo_data = ANY (ARRAY['comum'::text, 'sazonal'::text]))),
    CONSTRAINT propostas_evento_valor_final_check CHECK ((valor_final >= (0)::numeric)),
    CONSTRAINT propostas_evento_valor_original_check CHECK ((valor_original >= (0)::numeric)),
    CONSTRAINT propostas_evento_valor_parceria_check CHECK ((valor_parceria >= (0)::numeric))
);


--
-- Name: rd_oportunidades; Type: TABLE; Schema: comercial; Owner: -
--

CREATE TABLE comercial.rd_oportunidades (
    id text NOT NULL,
    dados jsonb NOT NULL,
    contatos jsonb DEFAULT '[]'::jsonb NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tipos_luc; Type: TABLE; Schema: comercial; Owner: -
--

CREATE TABLE comercial.tipos_luc (
    tipo text NOT NULL,
    conta_ocupacao boolean DEFAULT true NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    receita text,
    CONSTRAINT tipos_luc_receita_check CHECK ((receita = ANY (ARRAY['midia'::text, 'eventos'::text]))),
    CONSTRAINT tipos_luc_tipo_check CHECK ((btrim(tipo) <> ''::text))
);


--
-- Name: COLUMN tipos_luc.receita; Type: COMMENT; Schema: comercial; Owner: -
--

COMMENT ON COLUMN comercial.tipos_luc.receita IS 'Linha do Painel em que o faturamento deste tipo entra: midia, eventos ou nenhuma (null).';


--
-- Name: auditoria; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.auditoria (
    id bigint NOT NULL,
    tabela text NOT NULL,
    registro_id text NOT NULL,
    acao text NOT NULL,
    antes jsonb,
    depois jsonb,
    usuario_id uuid,
    em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT auditoria_acao_check CHECK ((acao = ANY (ARRAY['insert'::text, 'update'::text, 'delete'::text])))
);


--
-- Name: auditoria_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.auditoria ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.auditoria_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: cargo_permissoes; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.cargo_permissoes (
    cargo_id uuid NOT NULL,
    permissao text NOT NULL
);


--
-- Name: cargos; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.cargos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    descricao text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    CONSTRAINT cargos_nome_check CHECK ((btrim(nome) <> ''::text))
);


--
-- Name: empresa; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.empresa (
    id boolean DEFAULT true NOT NULL,
    nome text NOT NULL,
    razao_social text,
    cnpj text,
    email text,
    telefone text,
    site text,
    endereco text,
    cidade text,
    uf text,
    cep text,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT empresa_cep_check CHECK ((cep ~ '^[0-9]{8}$'::text)),
    CONSTRAINT empresa_cnpj_check CHECK ((cnpj ~ '^[0-9]{14}$'::text)),
    CONSTRAINT empresa_id_check CHECK (id),
    CONSTRAINT empresa_nome_check CHECK ((btrim(nome) <> ''::text)),
    CONSTRAINT empresa_uf_check CHECK ((uf ~ '^[A-Z]{2}$'::text))
);


--
-- Name: importacoes; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.importacoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo core.tipo_importacao NOT NULL,
    referencia core.competencia NOT NULL,
    arquivo_nome text NOT NULL,
    arquivo_path text NOT NULL,
    arquivo_sha256 text NOT NULL,
    status core.status_importacao DEFAULT 'previa'::core.status_importacao NOT NULL,
    avisos jsonb DEFAULT '[]'::jsonb NOT NULL,
    enviado_por uuid,
    confirmado_por uuid,
    confirmado_em timestamp with time zone,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: logs; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.logs (
    id bigint NOT NULL,
    em timestamp with time zone DEFAULT now() NOT NULL,
    usuario_id uuid,
    modulo text NOT NULL,
    evento text NOT NULL,
    descricao text NOT NULL,
    detalhes jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT logs_descricao_check CHECK ((btrim(descricao) <> ''::text)),
    CONSTRAINT logs_evento_check CHECK ((evento ~ '^[a-z_]+$'::text)),
    CONSTRAINT logs_modulo_check CHECK ((modulo = ANY (ARRAY['acesso'::text, 'admin'::text, 'rh'::text, 'financeiro'::text, 'integracoes'::text, 'os'::text, 'comercial'::text, 'operacoes'::text, 'sustentabilidade'::text])))
);


--
-- Name: logs_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.logs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: metas; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.metas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    indicador text NOT NULL,
    direcao core.direcao_meta NOT NULL,
    meta numeric NOT NULL,
    limite_atencao numeric,
    vigente_desde core.competencia NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT metas_indicador_check CHECK ((indicador ~ '^[a-z_]+\.[a-z0-9_]+$'::text))
);


--
-- Name: permissoes; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.permissoes (
    codigo text NOT NULL,
    descricao text NOT NULL
);


--
-- Name: preferencias; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.preferencias (
    usuario_id uuid NOT NULL,
    chave text NOT NULL,
    valor jsonb NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: usuario_permissoes; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.usuario_permissoes (
    usuario_id uuid NOT NULL,
    permissao text NOT NULL,
    concedida_por uuid,
    concedida_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: usuarios; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.usuarios (
    id uuid NOT NULL,
    nome text NOT NULL,
    email text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    cargo_id uuid
);


--
-- Name: estacionamento_movimento; Type: TABLE; Schema: financeiro; Owner: -
--

CREATE TABLE financeiro.estacionamento_movimento (
    estacionamento_id integer NOT NULL,
    data date NOT NULL,
    tipo_veiculo text NOT NULL,
    entradas integer DEFAULT 0 NOT NULL,
    saidas integer DEFAULT 0 NOT NULL,
    sync_run_id uuid,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT estacionamento_movimento_entradas_check CHECK ((entradas >= 0)),
    CONSTRAINT estacionamento_movimento_saidas_check CHECK ((saidas >= 0))
);


--
-- Name: estacionamento_pagamentos; Type: TABLE; Schema: financeiro; Owner: -
--

CREATE TABLE financeiro.estacionamento_pagamentos (
    estacionamento_id integer NOT NULL,
    wps_codigo bigint NOT NULL,
    data date NOT NULL,
    pago_em timestamp without time zone NOT NULL,
    tipo_cliente text NOT NULL,
    ticket text,
    recibo text NOT NULL,
    forma_pagamento text NOT NULL,
    forma_pagamento_codigo integer NOT NULL,
    grupos text[] NOT NULL,
    valor_bruto numeric(14,2) NOT NULL,
    valor_desconto numeric(14,2) DEFAULT 0 NOT NULL,
    valor_liquido numeric(14,2) NOT NULL,
    parcial integer DEFAULT 0 NOT NULL,
    terminal text,
    tarifa text,
    sync_run_id uuid,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT estacionamento_pagamentos_grupos_check CHECK ((cardinality(grupos) > 0))
);


--
-- Name: formularios; Type: TABLE; Schema: formularios; Owner: -
--

CREATE TABLE formularios.formularios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    descricao text DEFAULT ''::text NOT NULL,
    campos jsonb DEFAULT '[]'::jsonb NOT NULL,
    mensagem_final text DEFAULT ''::text NOT NULL,
    situacao text DEFAULT 'rascunho'::text NOT NULL,
    token text DEFAULT replace(((gen_random_uuid())::text || (gen_random_uuid())::text), '-'::text, ''::text) NOT NULL,
    encerra_em timestamp with time zone,
    limite_respostas integer,
    total_respostas integer DEFAULT 0 NOT NULL,
    ultima_resposta_em timestamp with time zone,
    criado_por uuid DEFAULT auth.uid(),
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    publicado_em timestamp with time zone,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    cor text DEFAULT 'grafite'::text NOT NULL,
    paginas boolean DEFAULT false NOT NULL,
    redirecionar_para text,
    CONSTRAINT formularios_campos_check CHECK ((jsonb_typeof(campos) = 'array'::text)),
    CONSTRAINT formularios_cor_check CHECK ((cor = ANY (ARRAY['grafite'::text, 'azul'::text, 'verde'::text, 'vinho'::text, 'laranja'::text, 'roxo'::text]))),
    CONSTRAINT formularios_descricao_check CHECK ((length(descricao) <= 5000)),
    CONSTRAINT formularios_limite_respostas_check CHECK (((limite_respostas IS NULL) OR (limite_respostas > 0))),
    CONSTRAINT formularios_mensagem_final_check CHECK ((length(mensagem_final) <= 2000)),
    CONSTRAINT formularios_redirecionar_para_check CHECK (((redirecionar_para IS NULL) OR ((redirecionar_para ~ '^https://[^\s]+$'::text) AND (length(redirecionar_para) <= 500)))),
    CONSTRAINT formularios_situacao_check CHECK ((situacao = ANY (ARRAY['rascunho'::text, 'publicado'::text, 'encerrado'::text]))),
    CONSTRAINT formularios_titulo_check CHECK (((btrim(titulo) <> ''::text) AND (length(titulo) <= 200))),
    CONSTRAINT formularios_token_check CHECK ((token ~ '^[A-Za-z0-9_-]{32,128}$'::text)),
    CONSTRAINT formularios_total_respostas_check CHECK ((total_respostas >= 0))
);


--
-- Name: respostas; Type: TABLE; Schema: formularios; Owner: -
--

CREATE TABLE formularios.respostas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    formulario_id uuid NOT NULL,
    respostas jsonb NOT NULL,
    perguntas jsonb DEFAULT '{}'::jsonb NOT NULL,
    enviada_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT respostas_perguntas_check CHECK ((jsonb_typeof(perguntas) = 'object'::text)),
    CONSTRAINT respostas_respostas_check CHECK ((jsonb_typeof(respostas) = 'object'::text))
);


--
-- Name: camera_contagens; Type: TABLE; Schema: integracao; Owner: -
--

CREATE TABLE integracao.camera_contagens (
    deviceid text NOT NULL,
    inicio timestamp with time zone NOT NULL,
    fim timestamp with time zone NOT NULL,
    entradas integer NOT NULL,
    saidas integer NOT NULL,
    recebido_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT camera_contagens_check CHECK ((fim >= inicio)),
    CONSTRAINT camera_contagens_entradas_check CHECK ((entradas >= 0)),
    CONSTRAINT camera_contagens_saidas_check CHECK ((saidas >= 0))
);


--
-- Name: cameras; Type: TABLE; Schema: integracao; Owner: -
--

CREATE TABLE integracao.cameras (
    deviceid text NOT NULL,
    ultimo_contato timestamp with time zone DEFAULT now() NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cameras_deviceid_check CHECK ((deviceid ~ '^[A-Za-z0-9_.-]{1,64}$'::text))
);


--
-- Name: credenciais; Type: TABLE; Schema: integracao; Owner: -
--

CREATE TABLE integracao.credenciais (
    sistema text NOT NULL,
    parametros jsonb DEFAULT '{}'::jsonb NOT NULL,
    segredo_cifrado text NOT NULL,
    ativa boolean DEFAULT true NOT NULL,
    configurado_por uuid,
    configurado_em timestamp with time zone DEFAULT now() NOT NULL,
    testado_em timestamp with time zone,
    teste_ok boolean,
    teste_mensagem text,
    CONSTRAINT credenciais_sistema_check CHECK ((sistema = ANY (ARRAY['secullum'::text, 'wps'::text, 'diario_de_obras'::text, 'copiloto_rh'::text, 'rd_crm'::text, 'cameras'::text, 'mkt_google'::text, 'mkt_youtube'::text, 'mkt_meta'::text, 'mkt_tiktok'::text, 'mkt_rd_station'::text, 'mkt_asana'::text, 'mkt_site'::text])))
);


--
-- Name: cursores; Type: TABLE; Schema: integracao; Owner: -
--

CREATE TABLE integracao.cursores (
    sistema text NOT NULL,
    recurso text NOT NULL,
    cursor jsonb NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: registros_brutos; Type: TABLE; Schema: integracao; Owner: -
--

CREATE TABLE integracao.registros_brutos (
    sistema text NOT NULL,
    recurso text NOT NULL,
    chave_externa text NOT NULL,
    payload jsonb NOT NULL,
    hash text NOT NULL,
    sync_run_id uuid,
    recebido_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sync_runs; Type: TABLE; Schema: integracao; Owner: -
--

CREATE TABLE integracao.sync_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sistema text NOT NULL,
    recurso text NOT NULL,
    iniciado_em timestamp with time zone DEFAULT now() NOT NULL,
    finalizado_em timestamp with time zone,
    status integracao.status_sync DEFAULT 'rodando'::integracao.status_sync NOT NULL,
    cursor_antes jsonb,
    cursor_depois jsonb,
    registros integer DEFAULT 0 NOT NULL,
    erro text,
    CONSTRAINT sync_runs_check CHECK (((status = 'rodando'::integracao.status_sync) = (finalizado_em IS NULL)))
);


--
-- Name: benchmark; Type: TABLE; Schema: marketing; Owner: -
--

CREATE TABLE marketing.benchmark (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    cidade text,
    instagram text,
    site text,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT benchmark_instagram_check CHECK (((instagram IS NULL) OR (instagram ~ '^[A-Za-z0-9._]{1,30}$'::text))),
    CONSTRAINT benchmark_nome_check CHECK ((btrim(nome) <> ''::text))
);


--
-- Name: landing_pages; Type: TABLE; Schema: marketing; Owner: -
--

CREATE TABLE marketing.landing_pages (
    identificador text NOT NULL,
    nome text NOT NULL,
    interesse text,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT landing_pages_identificador_check CHECK ((btrim(identificador) <> ''::text)),
    CONSTRAINT landing_pages_interesse_check CHECK ((interesse = ANY (ARRAY['evento'::text, 'locacao'::text, 'outro'::text])))
);


--
-- Name: locatarios; Type: TABLE; Schema: marketing; Owner: -
--

CREATE TABLE marketing.locatarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    categoria text NOT NULL,
    perfil_url text,
    forma_acesso text DEFAULT 'sem_acesso'::text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    entrada_em date DEFAULT CURRENT_DATE NOT NULL,
    saida_em date,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT locatarios_categoria_check CHECK ((btrim(categoria) <> ''::text)),
    CONSTRAINT locatarios_check CHECK (((saida_em IS NULL) OR (saida_em >= entrada_em))),
    CONSTRAINT locatarios_forma_acesso_check CHECK ((forma_acesso = ANY (ARRAY['gerente'::text, 'consulta_publica'::text, 'sem_acesso'::text]))),
    CONSTRAINT locatarios_nome_check CHECK ((btrim(nome) <> ''::text))
);


--
-- Name: marca_arquivos; Type: TABLE; Schema: marketing; Owner: -
--

CREATE TABLE marketing.marca_arquivos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    grupo text NOT NULL,
    titulo text NOT NULL,
    descricao text,
    arquivo_nome text,
    arquivo_path text,
    tamanho bigint,
    tipo_mime text,
    versao integer DEFAULT 1 NOT NULL,
    atual boolean DEFAULT true NOT NULL,
    enviado_por uuid,
    enviado_em timestamp with time zone DEFAULT now() NOT NULL,
    referencia boolean DEFAULT false NOT NULL,
    CONSTRAINT marca_arquivos_grupo_check CHECK ((grupo ~ '^[a-z0-9_]+$'::text)),
    CONSTRAINT marca_arquivos_tamanho_check CHECK (((tamanho IS NULL) OR (tamanho >= 0)))
);


--
-- Name: marca_blocos; Type: TABLE; Schema: marketing; Owner: -
--

CREATE TABLE marketing.marca_blocos (
    chave text NOT NULL,
    aba text NOT NULL,
    titulo text NOT NULL,
    descricao text,
    tipo text NOT NULL,
    ordem integer NOT NULL,
    conteudo jsonb NOT NULL,
    versao integer DEFAULT 1 NOT NULL,
    atualizado_por uuid,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT marca_blocos_aba_check CHECK ((aba = ANY (ARRAY['plataforma'::text, 'tom_de_voz'::text, 'publico'::text, 'identidade'::text]))),
    CONSTRAINT marca_blocos_chave_check CHECK ((chave ~ '^[a-z_]+$'::text)),
    CONSTRAINT marca_blocos_check CHECK (
CASE tipo
    WHEN 'texto'::text THEN (jsonb_typeof((conteudo -> 'texto'::text)) = 'string'::text)
    ELSE (jsonb_typeof((conteudo -> 'itens'::text)) = 'array'::text)
END),
    CONSTRAINT marca_blocos_tipo_check CHECK ((tipo = ANY (ARRAY['texto'::text, 'lista'::text, 'cores'::text])))
);


--
-- Name: marca_versoes; Type: TABLE; Schema: marketing; Owner: -
--

CREATE TABLE marketing.marca_versoes (
    id bigint NOT NULL,
    bloco text NOT NULL,
    versao integer NOT NULL,
    antes jsonb,
    depois jsonb NOT NULL,
    desfaz bigint,
    por uuid,
    em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: marca_versoes_id_seq; Type: SEQUENCE; Schema: marketing; Owner: -
--

ALTER TABLE marketing.marca_versoes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME marketing.marca_versoes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: parametros; Type: TABLE; Schema: marketing; Owner: -
--

CREATE TABLE marketing.parametros (
    id boolean DEFAULT true NOT NULL,
    estrelas_reclamacao integer[] DEFAULT '{1,2}'::integer[] NOT NULL,
    janela_reputacao_dias integer DEFAULT 30 NOT NULL,
    reclamacoes_atencao integer DEFAULT 1 NOT NULL,
    reclamacoes_alerta integer DEFAULT 3 NOT NULL,
    nota_atencao numeric(3,2) DEFAULT 3.5 NOT NULL,
    asana_projetos_marketing text[] DEFAULT '{}'::text[] NOT NULL,
    asana_projeto_calendario text,
    asana_projeto_ronda text,
    asana_tag_locatario text,
    asana_tag_terceiro text,
    asana_tag_gratuita text,
    asana_tag_paga text,
    sinalizacao_antiga_dias integer DEFAULT 15 NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    quadros_ocultos text[] DEFAULT '{}'::text[] NOT NULL,
    termos_marca text[] DEFAULT '{arp}'::text[] NOT NULL,
    CONSTRAINT parametros_check CHECK ((reclamacoes_alerta > reclamacoes_atencao)),
    CONSTRAINT parametros_estrelas_reclamacao_check CHECK (((cardinality(estrelas_reclamacao) > 0) AND (estrelas_reclamacao <@ '{1,2,3,4,5}'::integer[]))),
    CONSTRAINT parametros_id_check CHECK (id),
    CONSTRAINT parametros_janela_reputacao_dias_check CHECK (((janela_reputacao_dias >= 1) AND (janela_reputacao_dias <= 365))),
    CONSTRAINT parametros_nota_atencao_check CHECK (((nota_atencao >= (1)::numeric) AND (nota_atencao <= (5)::numeric))),
    CONSTRAINT parametros_quadros_ocultos_check CHECK ((cardinality(quadros_ocultos) <= 200)),
    CONSTRAINT parametros_reclamacoes_alerta_check CHECK ((reclamacoes_alerta >= 1)),
    CONSTRAINT parametros_reclamacoes_atencao_check CHECK ((reclamacoes_atencao >= 1)),
    CONSTRAINT parametros_sinalizacao_antiga_dias_check CHECK ((sinalizacao_antiga_dias >= 1)),
    CONSTRAINT parametros_termos_marca_check CHECK (((cardinality(termos_marca) >= 1) AND (cardinality(termos_marca) <= 20)))
);


--
-- Name: rd_contatos; Type: TABLE; Schema: marketing; Owner: -
--

CREATE TABLE marketing.rd_contatos (
    uuid text NOT NULL,
    nome text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    telefone text DEFAULT ''::text NOT NULL,
    cidade text DEFAULT ''::text NOT NULL,
    uf text DEFAULT ''::text NOT NULL,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    etapa text DEFAULT ''::text NOT NULL,
    criado_em timestamp with time zone,
    ultima_conversao timestamp with time zone,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rd_conversoes; Type: TABLE; Schema: marketing; Owner: -
--

CREATE TABLE marketing.rd_conversoes (
    id text NOT NULL,
    contato_uuid text NOT NULL,
    identificador text NOT NULL,
    convertido_em timestamp with time zone NOT NULL,
    origem text DEFAULT ''::text NOT NULL,
    meio text DEFAULT ''::text NOT NULL,
    campanha text DEFAULT ''::text NOT NULL
);


--
-- Name: rd_landing_pages_dia; Type: TABLE; Schema: marketing; Owner: -
--

CREATE TABLE marketing.rd_landing_pages_dia (
    identificador text NOT NULL,
    dia date NOT NULL,
    nome text DEFAULT ''::text NOT NULL,
    visitas integer DEFAULT 0 NOT NULL,
    conversoes integer DEFAULT 0 NOT NULL,
    CONSTRAINT rd_landing_pages_dia_conversoes_check CHECK ((conversoes >= 0)),
    CONSTRAINT rd_landing_pages_dia_visitas_check CHECK ((visitas >= 0))
);


--
-- Name: redes_dia; Type: TABLE; Schema: marketing; Owner: -
--

CREATE TABLE marketing.redes_dia (
    rede text NOT NULL,
    dia date NOT NULL,
    seguidores integer,
    alcance integer,
    visualizacoes integer,
    contas_engajadas integer,
    interacoes integer,
    toques_links integer,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT redes_dia_alcance_check CHECK ((alcance >= 0)),
    CONSTRAINT redes_dia_contas_engajadas_check CHECK ((contas_engajadas >= 0)),
    CONSTRAINT redes_dia_interacoes_check CHECK ((interacoes >= 0)),
    CONSTRAINT redes_dia_rede_check CHECK ((rede = ANY (ARRAY['instagram'::text, 'facebook'::text]))),
    CONSTRAINT redes_dia_seguidores_check CHECK ((seguidores >= 0)),
    CONSTRAINT redes_dia_toques_links_check CHECK ((toques_links >= 0)),
    CONSTRAINT redes_dia_visualizacoes_check CHECK ((visualizacoes >= 0))
);


--
-- Name: regras_alerta; Type: TABLE; Schema: marketing; Owner: -
--

CREATE TABLE marketing.regras_alerta (
    regra text NOT NULL,
    limite numeric,
    nivel text NOT NULL,
    ativa boolean DEFAULT true NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT regras_alerta_limite_check CHECK (((limite IS NULL) OR (limite >= (0)::numeric))),
    CONSTRAINT regras_alerta_nivel_check CHECK ((nivel = ANY (ARRAY['urgente'::text, 'atencao'::text, 'aviso'::text]))),
    CONSTRAINT regras_alerta_regra_check CHECK ((regra = ANY (ARRAY['sinalizacoes_abertas'::text, 'locatario_em_alerta'::text, 'avaliacao_sem_resposta'::text, 'custo_por_lead_acima_meta'::text, 'campanha_sem_lead'::text, 'avaliacoes_abaixo_do_ritmo'::text, 'tarefa_atrasada'::text, 'landing_page_sem_tipo'::text])))
);


--
-- Name: ronda_codigos; Type: TABLE; Schema: marketing; Owner: -
--

CREATE TABLE marketing.ronda_codigos (
    codigo text NOT NULL,
    descricao text NOT NULL,
    area text NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ronda_codigos_area_check CHECK ((area = ANY (ARRAY['marketing'::text, 'operacoes'::text]))),
    CONSTRAINT ronda_codigos_codigo_check CHECK ((codigo ~ '^[A-Z0-9]{1,5}$'::text))
);


--
-- Name: temas; Type: TABLE; Schema: marketing; Owner: -
--

CREATE TABLE marketing.temas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT temas_nome_check CHECK ((btrim(nome) <> ''::text))
);


--
-- Name: agua_contas; Type: TABLE; Schema: operacoes; Owner: -
--

CREATE TABLE operacoes.agua_contas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    importacao_id uuid NOT NULL,
    vigente boolean DEFAULT false NOT NULL,
    referencia date NOT NULL,
    matricula text NOT NULL,
    vencimento date,
    data_anterior date,
    data_atual date,
    leitura_anterior numeric(14,3),
    leitura_atual numeric(14,3),
    consumo_m3 numeric(14,3),
    valor_agua numeric(14,2),
    valor_esgoto numeric(14,2),
    total numeric(14,2) NOT NULL,
    observacao text,
    exemplo boolean DEFAULT false NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agua_contas_check CHECK (((data_anterior IS NULL) OR (data_atual IS NULL) OR (data_anterior <= data_atual))),
    CONSTRAINT agua_contas_consumo_m3_check CHECK ((consumo_m3 >= (0)::numeric)),
    CONSTRAINT agua_contas_matricula_check CHECK (((length(btrim(matricula)) >= 1) AND (length(btrim(matricula)) <= 40))),
    CONSTRAINT agua_contas_observacao_check CHECK ((length(observacao) <= 500)),
    CONSTRAINT agua_contas_referencia_check CHECK ((EXTRACT(day FROM referencia) = (1)::numeric)),
    CONSTRAINT agua_contas_total_check CHECK ((total >= (0)::numeric)),
    CONSTRAINT agua_contas_valor_agua_check CHECK ((valor_agua >= (0)::numeric)),
    CONSTRAINT agua_contas_valor_esgoto_check CHECK ((valor_esgoto >= (0)::numeric))
);


--
-- Name: agua_leituras; Type: TABLE; Schema: operacoes; Owner: -
--

CREATE TABLE operacoes.agua_leituras (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    importacao_id uuid NOT NULL,
    vigente boolean DEFAULT false NOT NULL,
    referencia date NOT NULL,
    bloco text NOT NULL,
    sala text DEFAULT ''::text NOT NULL,
    cliente text DEFAULT ''::text NOT NULL,
    hidrometro text NOT NULL,
    data_anterior date,
    leitura_anterior numeric(14,3),
    data_atual date,
    leitura_atual numeric(14,3),
    dias integer,
    consumo numeric(14,3) DEFAULT 0 NOT NULL,
    volume_faturado numeric(14,3) DEFAULT 0 NOT NULL,
    tipo text NOT NULL,
    foto text,
    linha_arquivo integer,
    exemplo boolean DEFAULT false NOT NULL,
    CONSTRAINT agua_leituras_bloco_check CHECK ((bloco ~ '^\d{2}$'::text)),
    CONSTRAINT agua_leituras_dias_check CHECK ((dias >= 0)),
    CONSTRAINT agua_leituras_hidrometro_check CHECK (((length(btrim(hidrometro)) >= 1) AND (length(btrim(hidrometro)) <= 40))),
    CONSTRAINT agua_leituras_referencia_check CHECK ((EXTRACT(day FROM referencia) = (1)::numeric)),
    CONSTRAINT agua_leituras_tipo_check CHECK ((tipo = ANY (ARRAY['FATURADO'::text, 'MINIMO'::text, 'ZERO'::text, 'REFATURADO'::text])))
);


--
-- Name: agua_valores; Type: TABLE; Schema: operacoes; Owner: -
--

CREATE TABLE operacoes.agua_valores (
    leitura_id uuid NOT NULL,
    valor numeric(14,2) NOT NULL
);


--
-- Name: agua_vinculos; Type: TABLE; Schema: operacoes; Owner: -
--

CREATE TABLE operacoes.agua_vinculos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hidrometro text NOT NULL,
    desde date NOT NULL,
    bloco text NOT NULL,
    sala text NOT NULL,
    motivo text NOT NULL,
    criado_por uuid DEFAULT auth.uid(),
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agua_vinculos_bloco_check CHECK ((bloco ~ '^\d{2}$'::text)),
    CONSTRAINT agua_vinculos_desde_check CHECK ((EXTRACT(day FROM desde) = (1)::numeric)),
    CONSTRAINT agua_vinculos_motivo_check CHECK (((length(btrim(motivo)) >= 3) AND (length(btrim(motivo)) <= 500)))
);


--
-- Name: caixa_ocupantes; Type: TABLE; Schema: operacoes; Owner: -
--

CREATE TABLE operacoes.caixa_ocupantes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    caixa_id uuid NOT NULL,
    nome text NOT NULL,
    documento text,
    entrada date,
    saida date,
    origem text DEFAULT 'manual'::text NOT NULL,
    criado_por uuid DEFAULT auth.uid(),
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT caixa_ocupantes_nome_check CHECK (((length(btrim(nome)) >= 1) AND (length(btrim(nome)) <= 200))),
    CONSTRAINT caixa_ocupantes_origem_check CHECK ((origem = ANY (ARRAY['enet'::text, 'manual'::text, 'importacao'::text])))
);


--
-- Name: caixas; Type: TABLE; Schema: operacoes; Owner: -
--

CREATE TABLE operacoes.caixas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quadro_id uuid NOT NULL,
    numero text NOT NULL,
    numero_antigo text,
    lado text DEFAULT 'esquerdo'::text NOT NULL,
    coluna integer DEFAULT 1 NOT NULL,
    linha integer DEFAULT 1 NOT NULL,
    rota text,
    sala_id uuid,
    salas_texto text,
    pavimento text,
    status text DEFAULT 'livre'::text NOT NULL,
    ocupante text,
    ocupante_documento text,
    ocupante_desde date,
    contrato text,
    ocupante_origem text,
    locatario_novo boolean DEFAULT false NOT NULL,
    disjuntor_amperes integer,
    ligacao text,
    disjuntor_texto text,
    medidor_situacao text,
    medidor_numero text,
    modulo text,
    observacoes text,
    exemplo boolean DEFAULT false NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    termo_externo boolean DEFAULT false NOT NULL,
    CONSTRAINT caixas_coluna_check CHECK ((coluna > 0)),
    CONSTRAINT caixas_disjuntor_amperes_check CHECK ((disjuntor_amperes > 0)),
    CONSTRAINT caixas_lado_check CHECK ((lado = ANY (ARRAY['esquerdo'::text, 'direito'::text]))),
    CONSTRAINT caixas_ligacao_check CHECK ((ligacao = ANY (ARRAY['Monofásica'::text, 'Bifásica'::text, 'Trifásica'::text]))),
    CONSTRAINT caixas_linha_check CHECK ((linha > 0)),
    CONSTRAINT caixas_numero_check CHECK (((length(btrim(numero)) >= 1) AND (length(btrim(numero)) <= 30))),
    CONSTRAINT caixas_ocupante_origem_check CHECK ((ocupante_origem = ANY (ARRAY['enet'::text, 'manual'::text, 'importacao'::text]))),
    CONSTRAINT caixas_status_check CHECK ((status = ANY (ARRAY['ocupado'::text, 'reservado'::text, 'livre'::text])))
);


--
-- Name: COLUMN caixas.termo_externo; Type: COMMENT; Schema: operacoes; Owner: -
--

COMMENT ON COLUMN operacoes.caixas.termo_externo IS 'Termo emitido fora do sistema (carga inicial); vale até a troca de locatário';


--
-- Name: diario_cadastros; Type: TABLE; Schema: operacoes; Owner: -
--

CREATE TABLE operacoes.diario_cadastros (
    id boolean DEFAULT true NOT NULL,
    empresa jsonb,
    cadastros jsonb,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT diario_cadastros_id_check CHECK (id)
);


--
-- Name: diario_obras; Type: TABLE; Schema: operacoes; Owner: -
--

CREATE TABLE operacoes.diario_obras (
    id text NOT NULL,
    nome text NOT NULL,
    status_id integer NOT NULL,
    grupo text,
    responsavel text,
    data_inicio date,
    data_fim date,
    prazo_contratual integer,
    prazo_decorrido integer,
    prazo_a_vencer integer,
    realizado numeric(7,2),
    tarefas jsonb,
    dados jsonb NOT NULL,
    lista_de_tarefas jsonb,
    modificado_no_app timestamp without time zone,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    exemplo boolean DEFAULT false NOT NULL
);


--
-- Name: diario_relatorios; Type: TABLE; Schema: operacoes; Owner: -
--

CREATE TABLE operacoes.diario_relatorios (
    id text NOT NULL,
    obra_id text NOT NULL,
    numero integer NOT NULL,
    data date NOT NULL,
    data_fim date,
    status_id integer NOT NULL,
    modelo text,
    autor text,
    autor_cargo text,
    app text,
    criado_no_app timestamp without time zone,
    dados jsonb,
    modificado_no_app timestamp without time zone,
    detalhado_em timestamp with time zone,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    exemplo boolean DEFAULT false NOT NULL,
    autor_id text,
    modelo_id text,
    resumo jsonb
);


--
-- Name: energia_fatura_itens; Type: TABLE; Schema: operacoes; Owner: -
--

CREATE TABLE operacoes.energia_fatura_itens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fatura_id uuid NOT NULL,
    ordem integer NOT NULL,
    descricao text NOT NULL,
    tipo text NOT NULL,
    origem text,
    mes_geracao date,
    quantidade numeric(14,2),
    valor numeric(14,2) NOT NULL,
    pis_cofins numeric(14,2),
    icms numeric(14,2),
    unidade text,
    preco_unitario numeric(14,6),
    base_icms numeric(14,2),
    aliquota_icms numeric(6,2),
    tarifa_unitaria numeric(14,6),
    CONSTRAINT energia_fatura_itens_origem_check CHECK ((origem = ANY (ARRAY['oUC'::text, 'mUC'::text]))),
    CONSTRAINT energia_fatura_itens_tipo_check CHECK ((tipo = ANY (ARRAY['consumo'::text, 'injetada'::text, 'bandeira'::text, 'iluminacao'::text, 'outro'::text]))),
    CONSTRAINT energia_fatura_itens_unidade_check CHECK ((length(unidade) <= 20))
);


--
-- Name: energia_faturas; Type: TABLE; Schema: operacoes; Owner: -
--

CREATE TABLE operacoes.energia_faturas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    importacao_id uuid,
    matricula text NOT NULL,
    referencia date NOT NULL,
    vencimento date,
    leitura_anterior_data date,
    leitura_atual_data date,
    proxima_leitura date,
    dias integer,
    medidor text,
    leitura_anterior numeric(14,2),
    leitura_atual numeric(14,2),
    consumo_kwh numeric(14,2) DEFAULT 0 NOT NULL,
    valor_consumo numeric(14,2) DEFAULT 0 NOT NULL,
    compensado_kwh numeric(14,2) DEFAULT 0 NOT NULL,
    valor_compensado numeric(14,2) DEFAULT 0 NOT NULL,
    bandeira text,
    valor_bandeira numeric(14,2) DEFAULT 0 NOT NULL,
    iluminacao_publica numeric(14,2) DEFAULT 0 NOT NULL,
    icms numeric(14,2) DEFAULT 0 NOT NULL,
    pis_cofins numeric(14,2) DEFAULT 0 NOT NULL,
    total numeric(14,2) NOT NULL,
    saldo_kwh numeric(14,2),
    expirar_kwh numeric(14,2),
    classificacao_gd text,
    nota_fiscal text,
    observacao text,
    arquivo text,
    sha256 text,
    exemplo boolean DEFAULT false NOT NULL,
    importado_por uuid DEFAULT auth.uid(),
    importado_em timestamp with time zone DEFAULT now() NOT NULL,
    injetada_kwh numeric(14,2),
    vigente boolean DEFAULT false NOT NULL,
    CONSTRAINT energia_faturas_injetada_kwh_check CHECK ((injetada_kwh >= (0)::numeric)),
    CONSTRAINT energia_faturas_referencia_check CHECK ((EXTRACT(day FROM referencia) = (1)::numeric))
);


--
-- Name: energia_unidades; Type: TABLE; Schema: operacoes; Owner: -
--

CREATE TABLE operacoes.energia_unidades (
    matricula text NOT NULL,
    endereco text,
    apelido text,
    classificacao text,
    ligacao text,
    papel text DEFAULT 'consome'::text NOT NULL,
    ativa boolean DEFAULT true NOT NULL,
    exemplo boolean DEFAULT false NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT energia_unidades_matricula_check CHECK ((matricula ~ '^\d{6,12}$'::text)),
    CONSTRAINT energia_unidades_papel_check CHECK ((papel = ANY (ARRAY['consome'::text, 'gera'::text, 'gera_e_consome'::text])))
);


--
-- Name: hidrometros; Type: TABLE; Schema: operacoes; Owner: -
--

CREATE TABLE operacoes.hidrometros (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    numero text NOT NULL,
    bloco text NOT NULL,
    sala text DEFAULT ''::text NOT NULL,
    sala_id uuid,
    descricao text,
    ativo boolean DEFAULT true NOT NULL,
    observacoes text,
    exemplo boolean DEFAULT false NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hidrometros_bloco_check CHECK ((bloco ~ '^\d{2}$'::text)),
    CONSTRAINT hidrometros_descricao_check CHECK ((length(descricao) <= 120)),
    CONSTRAINT hidrometros_numero_check CHECK (((length(btrim(numero)) >= 1) AND (length(btrim(numero)) <= 40))),
    CONSTRAINT hidrometros_observacoes_check CHECK ((length(observacoes) <= 500)),
    CONSTRAINT hidrometros_sala_check CHECK ((length(sala) <= 40))
);


--
-- Name: importacao_valores; Type: TABLE; Schema: operacoes; Owner: -
--

CREATE TABLE operacoes.importacao_valores (
    importacao_id uuid NOT NULL,
    valor_arquivo numeric(14,2),
    valor_lido numeric(14,2),
    por_bloco jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: importacoes; Type: TABLE; Schema: operacoes; Owner: -
--

CREATE TABLE operacoes.importacoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo text NOT NULL,
    status text DEFAULT 'previa'::text NOT NULL,
    referencia text NOT NULL,
    arquivos jsonb DEFAULT '[]'::jsonb NOT NULL,
    resumo jsonb DEFAULT '{}'::jsonb NOT NULL,
    avisos jsonb DEFAULT '[]'::jsonb NOT NULL,
    bate boolean,
    incompleta boolean DEFAULT false NOT NULL,
    motivo text,
    substitui uuid,
    exemplo boolean DEFAULT false NOT NULL,
    criado_por uuid DEFAULT auth.uid(),
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    confirmado_por uuid,
    confirmado_em timestamp with time zone,
    desfeito_por uuid,
    desfeito_em timestamp with time zone,
    CONSTRAINT importacoes_check CHECK (((NOT incompleta) OR (motivo IS NOT NULL))),
    CONSTRAINT importacoes_motivo_check CHECK ((length(motivo) <= 500)),
    CONSTRAINT importacoes_status_check CHECK ((status = ANY (ARRAY['previa'::text, 'confirmada'::text, 'desfeita'::text, 'substituida'::text, 'cancelada'::text]))),
    CONSTRAINT importacoes_tipo_check CHECK ((tipo = ANY (ARRAY['agua'::text, 'energisa'::text, 'orcamento'::text, 'limpeza'::text, 'agua_conta'::text])))
);


--
-- Name: limpeza_anexos; Type: TABLE; Schema: operacoes; Owner: -
--

CREATE TABLE operacoes.limpeza_anexos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    referencia date NOT NULL,
    nome text NOT NULL,
    caminho text NOT NULL,
    tipo text DEFAULT 'outro'::text NOT NULL,
    enviado_por uuid DEFAULT auth.uid(),
    enviado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT limpeza_anexos_tipo_check CHECK ((tipo = ANY (ARRAY['medicao'::text, 'apontamento'::text, 'outro'::text])))
);


--
-- Name: limpeza_contrato; Type: TABLE; Schema: operacoes; Owner: -
--

CREATE TABLE operacoes.limpeza_contrato (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    referencia date NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    descricao text NOT NULL,
    valor numeric(14,2) NOT NULL,
    entra_conferencia boolean DEFAULT false NOT NULL,
    CONSTRAINT limpeza_contrato_descricao_check CHECK (((length(btrim(descricao)) >= 1) AND (length(btrim(descricao)) <= 200)))
);


--
-- Name: limpeza_equipe; Type: TABLE; Schema: operacoes; Owner: -
--

CREATE TABLE operacoes.limpeza_equipe (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    referencia date NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    nome text NOT NULL,
    funcao text,
    grupo text NOT NULL,
    blocos text[] DEFAULT '{}'::text[] NOT NULL,
    turno text,
    minutos_dia integer,
    CONSTRAINT limpeza_equipe_grupo_check CHECK ((grupo = ANY (ARRAY['area_comum'::text, 'blocos'::text, 'banheiros'::text, 'externo'::text]))),
    CONSTRAINT limpeza_equipe_minutos_dia_check CHECK ((minutos_dia >= 0)),
    CONSTRAINT limpeza_equipe_nome_check CHECK (((length(btrim(nome)) >= 1) AND (length(btrim(nome)) <= 120)))
);


--
-- Name: limpeza_extras; Type: TABLE; Schema: operacoes; Owner: -
--

CREATE TABLE operacoes.limpeza_extras (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    referencia date NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    descricao text NOT NULL,
    quantidade numeric(10,2),
    valor_unitario numeric(14,2),
    valor numeric(14,2) NOT NULL,
    CONSTRAINT limpeza_extras_descricao_check CHECK (((length(btrim(descricao)) >= 1) AND (length(btrim(descricao)) <= 200)))
);


--
-- Name: limpeza_meses; Type: TABLE; Schema: operacoes; Owner: -
--

CREATE TABLE operacoes.limpeza_meses (
    referencia date NOT NULL,
    importacao_id uuid,
    apontamento text,
    valor_base numeric(14,2),
    base_composicao text,
    func_base integer,
    func_area_comum integer,
    func_rateados integer,
    regra_bl04 text DEFAULT 'separado'::text NOT NULL,
    status text DEFAULT 'aberto'::text NOT NULL,
    incompleto boolean DEFAULT false NOT NULL,
    origem text DEFAULT 'tela'::text NOT NULL,
    valores_planilha jsonb,
    fechado_por uuid,
    fechado_em timestamp with time zone,
    reaberto_por uuid,
    reaberto_em timestamp with time zone,
    reaberto_motivo text,
    enviado_por uuid,
    enviado_em timestamp with time zone,
    exemplo boolean DEFAULT false NOT NULL,
    criado_por uuid DEFAULT auth.uid(),
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT limpeza_meses_check CHECK (((status = 'aberto'::text) OR ((fechado_em IS NOT NULL) AND (NOT incompleto)))),
    CONSTRAINT limpeza_meses_check1 CHECK (((enviado_em IS NULL) OR (status = 'fechado'::text))),
    CONSTRAINT limpeza_meses_func_area_comum_check CHECK ((func_area_comum >= 0)),
    CONSTRAINT limpeza_meses_func_base_check CHECK ((func_base > 0)),
    CONSTRAINT limpeza_meses_func_rateados_check CHECK ((func_rateados >= 0)),
    CONSTRAINT limpeza_meses_origem_check CHECK ((origem = ANY (ARRAY['tela'::text, 'importacao'::text]))),
    CONSTRAINT limpeza_meses_referencia_check CHECK ((EXTRACT(day FROM referencia) = (1)::numeric)),
    CONSTRAINT limpeza_meses_regra_bl04_check CHECK ((regra_bl04 = ANY (ARRAY['separado'::text, 'area_comum'::text]))),
    CONSTRAINT limpeza_meses_status_check CHECK ((status = ANY (ARRAY['aberto'::text, 'fechado'::text]))),
    CONSTRAINT limpeza_meses_valor_base_check CHECK ((valor_base >= (0)::numeric))
);


--
-- Name: limpeza_minutos; Type: TABLE; Schema: operacoes; Owner: -
--

CREATE TABLE operacoes.limpeza_minutos (
    referencia date NOT NULL,
    bloco text NOT NULL,
    limpeza integer DEFAULT 0 NOT NULL,
    manutencao integer DEFAULT 0 NOT NULL,
    CONSTRAINT limpeza_minutos_bloco_check CHECK ((bloco ~ '^\d{2}$'::text)),
    CONSTRAINT limpeza_minutos_limpeza_check CHECK ((limpeza >= 0)),
    CONSTRAINT limpeza_minutos_manutencao_check CHECK ((manutencao >= 0))
);


--
-- Name: obra_realizado; Type: TABLE; Schema: operacoes; Owner: -
--

CREATE TABLE operacoes.obra_realizado (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    obra_id uuid NOT NULL,
    etapa text NOT NULL,
    mes date NOT NULL,
    valor numeric(16,2) NOT NULL,
    descricao text,
    anexo text,
    origem text DEFAULT 'tela'::text NOT NULL,
    importacao_id uuid,
    exemplo boolean DEFAULT false NOT NULL,
    lancado_por uuid DEFAULT auth.uid(),
    lancado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT obra_realizado_mes_check CHECK ((EXTRACT(day FROM mes) = (1)::numeric)),
    CONSTRAINT obra_realizado_origem_check CHECK ((origem = ANY (ARRAY['tela'::text, 'planilha'::text])))
);


--
-- Name: obras; Type: TABLE; Schema: operacoes; Owner: -
--

CREATE TABLE operacoes.obras (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    responsavel text,
    diario_obra_id text,
    ativa boolean DEFAULT true NOT NULL,
    exemplo boolean DEFAULT false NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT obras_nome_check CHECK (((length(btrim(nome)) >= 1) AND (length(btrim(nome)) <= 120)))
);


--
-- Name: orcamento_etapas; Type: TABLE; Schema: operacoes; Owner: -
--

CREATE TABLE operacoes.orcamento_etapas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    revisao_id uuid NOT NULL,
    ordem integer NOT NULL,
    nome text NOT NULL,
    observacao text
);


--
-- Name: orcamento_previsto; Type: TABLE; Schema: operacoes; Owner: -
--

CREATE TABLE operacoes.orcamento_previsto (
    etapa_id uuid NOT NULL,
    mes date NOT NULL,
    valor numeric(16,2) NOT NULL,
    CONSTRAINT orcamento_previsto_mes_check CHECK ((EXTRACT(day FROM mes) = (1)::numeric))
);


--
-- Name: orcamento_revisoes; Type: TABLE; Schema: operacoes; Owner: -
--

CREATE TABLE operacoes.orcamento_revisoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    obra_id uuid NOT NULL,
    importacao_id uuid,
    codigo text NOT NULL,
    data date,
    titulo text,
    total numeric(16,2) NOT NULL,
    total_arquivo numeric(16,2),
    vigente boolean DEFAULT false NOT NULL,
    exemplo boolean DEFAULT false NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT orcamento_revisoes_codigo_check CHECK ((codigo ~ '^R\d{2}$'::text))
);


--
-- Name: parametros; Type: TABLE; Schema: operacoes; Owner: -
--

CREATE TABLE operacoes.parametros (
    id boolean DEFAULT true NOT NULL,
    agua_limite_m3 numeric(10,2) DEFAULT 30 NOT NULL,
    agua_tolerancia numeric(10,2) DEFAULT 0.01 NOT NULL,
    agua_blocos text[] DEFAULT '{01,02,04,05,09,10,11,12,14,16,85}'::text[] NOT NULL,
    agua_parceiro text DEFAULT 'Parceiro de gestão hídrica'::text NOT NULL,
    agua_modelo jsonb DEFAULT '{}'::jsonb NOT NULL,
    termo_razao_social text DEFAULT 'ARP EMPREENDIMENTOS IMOBILIÁRIOS LTDA'::text NOT NULL,
    termo_cnpj text DEFAULT '33.111.139/0001-61'::text NOT NULL,
    termo_endereco text DEFAULT 'Av. Conselheiro Julius Arp, nº 80, Centro, Nova Friburgo/RJ'::text NOT NULL,
    termo_cidade text DEFAULT 'Nova Friburgo'::text NOT NULL,
    termo_qualificacao_cpf text DEFAULT 'pessoa física, locatária'::text NOT NULL,
    termo_qualificacao_cnpj text DEFAULT 'pessoa jurídica, locatária'::text NOT NULL,
    termo_nome_arquivo text DEFAULT 'TERMO DE AUTORIZACAO DE ENERGIA - BL[bloco] - [sala] - [LOCATARIO]'::text NOT NULL,
    energia_disjuntores text[] DEFAULT '{"40A Monofásico","40A Bifásico","40A Trifásico","50A Trifásico","70A Trifásico"}'::text[] NOT NULL,
    energia_ligacoes text[] DEFAULT '{Monofásica,Bifásica,Trifásica}'::text[] NOT NULL,
    energia_medidor_situacoes text[] DEFAULT '{"Medidor ativo","Chicote de espera","Cabos de espera","Tampa cega",Outro}'::text[] NOT NULL,
    energia_alerta_pct numeric(6,2) DEFAULT 20 NOT NULL,
    solar_fonte text DEFAULT 'a_confirmar'::text NOT NULL,
    limpeza_empresa text DEFAULT 'Black Star'::text NOT NULL,
    limpeza_func_base integer DEFAULT 9 NOT NULL,
    limpeza_func_area_comum integer DEFAULT 5 NOT NULL,
    limpeza_func_rateados integer DEFAULT 4 NOT NULL,
    limpeza_blocos text[] DEFAULT '{01,02,04,05,09,10,11}'::text[] NOT NULL,
    limpeza_dia_util_envio integer DEFAULT 5 NOT NULL,
    limpeza_extras_padrao jsonb DEFAULT '[]'::jsonb NOT NULL,
    obras_intervalo_min integer DEFAULT 60 NOT NULL,
    obras_dias_relatorio integer[] DEFAULT '{1,2,3,4,5,6}'::integer[] NOT NULL,
    obras_limite_desvio numeric(6,2) DEFAULT '-10'::integer NOT NULL,
    obras_limite_orcamento_pct numeric(6,2) DEFAULT 10 NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_por uuid DEFAULT auth.uid(),
    agua_variacao_pct numeric(6,2) DEFAULT 50 NOT NULL,
    agua_variacao_meses integer DEFAULT 3 NOT NULL,
    agua_variacao_min_m3 numeric(10,2) DEFAULT 5 NOT NULL,
    CONSTRAINT parametros_agua_limite_m3_check CHECK ((agua_limite_m3 > (0)::numeric)),
    CONSTRAINT parametros_agua_tolerancia_check CHECK ((agua_tolerancia >= (0)::numeric)),
    CONSTRAINT parametros_agua_variacao_meses_check CHECK (((agua_variacao_meses >= 1) AND (agua_variacao_meses <= 12))),
    CONSTRAINT parametros_agua_variacao_min_m3_check CHECK ((agua_variacao_min_m3 >= (0)::numeric)),
    CONSTRAINT parametros_agua_variacao_pct_check CHECK ((agua_variacao_pct > (0)::numeric)),
    CONSTRAINT parametros_check CHECK (((limpeza_func_area_comum + limpeza_func_rateados) <= limpeza_func_base)),
    CONSTRAINT parametros_energia_alerta_pct_check CHECK ((energia_alerta_pct > (0)::numeric)),
    CONSTRAINT parametros_id_check CHECK (id),
    CONSTRAINT parametros_limpeza_dia_util_envio_check CHECK (((limpeza_dia_util_envio >= 1) AND (limpeza_dia_util_envio <= 20))),
    CONSTRAINT parametros_limpeza_func_area_comum_check CHECK ((limpeza_func_area_comum >= 0)),
    CONSTRAINT parametros_limpeza_func_base_check CHECK ((limpeza_func_base > 0)),
    CONSTRAINT parametros_limpeza_func_rateados_check CHECK ((limpeza_func_rateados >= 0)),
    CONSTRAINT parametros_obras_intervalo_min_check CHECK ((obras_intervalo_min = ANY (ARRAY[30, 60, 240]))),
    CONSTRAINT parametros_obras_limite_orcamento_pct_check CHECK ((obras_limite_orcamento_pct >= (0)::numeric)),
    CONSTRAINT parametros_solar_fonte_check CHECK ((solar_fonte = ANY (ARRAY['a_confirmar'::text, 'inversor'::text, 'planilha'::text, 'fatura_geradora'::text])))
);


--
-- Name: quadros; Type: TABLE; Schema: operacoes; Owner: -
--

CREATE TABLE operacoes.quadros (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo text NOT NULL,
    nome text NOT NULL,
    bloco text NOT NULL,
    projeto text,
    subestacao text,
    roteiro_base text,
    armario text,
    disjuntor_geral text,
    espacos integer,
    observacoes text,
    fotos text[] DEFAULT '{}'::text[] NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    exemplo boolean DEFAULT false NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quadros_bloco_check CHECK ((bloco ~ '^\d{2}$'::text)),
    CONSTRAINT quadros_espacos_check CHECK ((espacos > 0)),
    CONSTRAINT quadros_nome_check CHECK (((length(btrim(nome)) >= 1) AND (length(btrim(nome)) <= 80)))
);


--
-- Name: salas; Type: TABLE; Schema: operacoes; Owner: -
--

CREATE TABLE operacoes.salas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo text NOT NULL,
    bloco text NOT NULL,
    sala text NOT NULL,
    pavimento text,
    armario text,
    projeto text,
    disjuntor text,
    rota text,
    observacoes text,
    exemplo boolean DEFAULT false NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT salas_bloco_check CHECK ((bloco ~ '^\d{2}$'::text))
);


--
-- Name: termos; Type: TABLE; Schema: operacoes; Owner: -
--

CREATE TABLE operacoes.termos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    caixa_id uuid NOT NULL,
    versao integer NOT NULL,
    locatario text NOT NULL,
    documento text NOT NULL,
    qualificacao text,
    bloco text NOT NULL,
    pavimento text,
    sala text NOT NULL,
    projeto text,
    amperes integer,
    ligacao text,
    armario text,
    rota text,
    observacao_tecnica text,
    data_emissao date NOT NULL,
    pdf text NOT NULL,
    docx text,
    emitido_por uuid DEFAULT auth.uid(),
    emitido_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT termos_versao_check CHECK ((versao > 0))
);


--
-- Name: agenda_bloqueios; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.agenda_bloqueios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agenda_id uuid NOT NULL,
    inicio timestamp with time zone NOT NULL,
    fim timestamp with time zone NOT NULL,
    motivo text NOT NULL,
    criado_por uuid,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agenda_bloqueios_check CHECK ((inicio < fim)),
    CONSTRAINT agenda_bloqueios_motivo_check CHECK ((btrim(motivo) <> ''::text))
);


--
-- Name: agendamentos; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.agendamentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agenda_id uuid NOT NULL,
    chamado_id uuid,
    loja_id uuid,
    inicio timestamp with time zone NOT NULL,
    fim timestamp with time zone NOT NULL,
    status os.status_agendamento DEFAULT 'marcado'::os.status_agendamento NOT NULL,
    observacao text,
    criado_por uuid,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agendamentos_check CHECK ((inicio < fim))
);


--
-- Name: agendas; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.agendas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    hora_inicio time without time zone NOT NULL,
    hora_fim time without time zone NOT NULL,
    duracao_min integer DEFAULT 60 NOT NULL,
    limite_por_dia integer NOT NULL,
    antecedencia_dias integer DEFAULT 30 NOT NULL,
    dias_semana integer[] DEFAULT '{1,2,3,4,5,6}'::integer[] NOT NULL,
    orientacao text,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agendas_antecedencia_dias_check CHECK (((antecedencia_dias >= 1) AND (antecedencia_dias <= 180))),
    CONSTRAINT agendas_check CHECK ((hora_inicio < hora_fim)),
    CONSTRAINT agendas_duracao_min_check CHECK (((duracao_min >= 15) AND (duracao_min <= 720))),
    CONSTRAINT agendas_limite_por_dia_check CHECK ((limite_por_dia > 0)),
    CONSTRAINT agendas_nome_check CHECK ((btrim(nome) <> ''::text))
);


--
-- Name: anexos; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.anexos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chamado_id uuid,
    evento_id bigint,
    vistoria_id uuid,
    ambiente_id uuid,
    ativo_id uuid,
    categoria text DEFAULT 'anexo'::text NOT NULL,
    nome text NOT NULL,
    path text NOT NULL,
    mime text,
    tamanho integer,
    visivel_lojista boolean DEFAULT false NOT NULL,
    enviado_por uuid,
    enviado_por_nome text,
    em timestamp with time zone DEFAULT now() NOT NULL,
    ordem_id uuid,
    CONSTRAINT anexos_categoria_check CHECK ((categoria = ANY (ARRAY['foto'::text, 'antes'::text, 'depois'::text, 'anexo'::text, 'assinatura'::text, 'laudo'::text, 'orcamento'::text, 'manual'::text, 'nota_fiscal'::text]))),
    CONSTRAINT anexos_chamado_ou_ordem CHECK ((num_nonnulls(chamado_id, ordem_id) <= 1)),
    CONSTRAINT anexos_dono CHECK ((num_nonnulls(chamado_id, ordem_id, vistoria_id, ambiente_id, ativo_id) >= 1))
);


--
-- Name: ativo_categorias; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.ativo_categorias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    vida_util_padrao_anos numeric(5,1),
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ativo_categorias_nome_check CHECK ((btrim(nome) <> ''::text)),
    CONSTRAINT ativo_categorias_vida_util_padrao_anos_check CHECK ((vida_util_padrao_anos > (0)::numeric))
);


--
-- Name: ativo_codigo_seq; Type: SEQUENCE; Schema: os; Owner: -
--

CREATE SEQUENCE os.ativo_codigo_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ativo_saidas; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.ativo_saidas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ativo_id uuid NOT NULL,
    tipo text NOT NULL,
    data date NOT NULL,
    quantidade text,
    valor numeric(14,2),
    forma_recebimento text,
    recebido_por text,
    destinatario_nome text,
    destinatario_documento text,
    responsavel_id uuid,
    motivo text,
    nota_fiscal boolean DEFAULT false NOT NULL,
    nota_fiscal_numero text,
    observacoes text,
    anexos text[] DEFAULT '{}'::text[] NOT NULL,
    situacao_anterior os.situacao_ativo NOT NULL,
    planos_pausados uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    registrado_por uuid DEFAULT auth.uid(),
    registrado_em timestamp with time zone DEFAULT now() NOT NULL,
    desfeita_por uuid,
    desfeita_em timestamp with time zone,
    desfeita_motivo text,
    CONSTRAINT ativo_saidas_check CHECK (((tipo <> 'Venda'::text) OR (valor IS NOT NULL))),
    CONSTRAINT ativo_saidas_check1 CHECK (((NOT nota_fiscal) OR (nota_fiscal_numero IS NOT NULL))),
    CONSTRAINT ativo_saidas_check2 CHECK (((desfeita_em IS NULL) OR (desfeita_motivo IS NOT NULL))),
    CONSTRAINT ativo_saidas_tipo_check CHECK (((length(btrim(tipo)) >= 1) AND (length(btrim(tipo)) <= 40))),
    CONSTRAINT ativo_saidas_valor_check CHECK ((valor >= (0)::numeric))
);


--
-- Name: ativo_situacoes; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.ativo_situacoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ativo_id uuid NOT NULL,
    situacao os.situacao_ativo NOT NULL,
    desde timestamp with time zone DEFAULT now() NOT NULL,
    ate timestamp with time zone,
    usuario_id uuid
);


--
-- Name: ativos; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.ativos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo text DEFAULT ('AT-'::text || lpad((nextval('os.ativo_codigo_seq'::regclass))::text, 4, '0'::text)) NOT NULL,
    nome text NOT NULL,
    categoria_id uuid,
    fabricante text,
    modelo text,
    numero_serie text,
    bloco text,
    loja_id uuid,
    area text,
    ponto text,
    compra_data date,
    compra_valor numeric(14,2),
    garantia_fim date,
    fornecedor_id uuid,
    valor_reposicao numeric(14,2),
    vida_util_anos numeric(5,1),
    situacao os.situacao_ativo DEFAULT 'em_uso'::os.situacao_ativo NOT NULL,
    baixa_data date,
    baixa_motivo text,
    setor_id uuid,
    responsavel_id uuid,
    observacao text,
    legado_id text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ativos_check CHECK (((situacao <> 'baixado'::os.situacao_ativo) OR ((baixa_data IS NOT NULL) AND (baixa_motivo IS NOT NULL)))),
    CONSTRAINT ativos_compra_valor_check CHECK ((compra_valor >= (0)::numeric)),
    CONSTRAINT ativos_nome_check CHECK ((btrim(nome) <> ''::text)),
    CONSTRAINT ativos_valor_reposicao_check CHECK ((valor_reposicao > (0)::numeric)),
    CONSTRAINT ativos_vida_util_anos_check CHECK ((vida_util_anos > (0)::numeric))
);


--
-- Name: categorias; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.categorias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    setor_id uuid NOT NULL,
    pai_id uuid,
    nome text NOT NULL,
    icone text DEFAULT 'tag'::text NOT NULL,
    cor text,
    ordem integer DEFAULT 0 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    tipo_padrao os.tipo_chamado DEFAULT 'solicitacao'::os.tipo_chamado NOT NULL,
    responsavel_padrao_id uuid,
    prioridade_padrao os.prioridade DEFAULT 'media'::os.prioridade NOT NULL,
    prazo_valor integer,
    prazo_unidade os.unidade_prazo DEFAULT 'dias_uteis'::os.unidade_prazo NOT NULL,
    resposta_horas integer,
    precisa_confirmacao boolean DEFAULT true NOT NULL,
    registrar_tempo boolean DEFAULT false NOT NULL,
    vincular_ativo boolean DEFAULT false NOT NULL,
    vincular_loja boolean DEFAULT false NOT NULL,
    agenda_id uuid,
    preventiva boolean DEFAULT false NOT NULL,
    prazo_terceirizado_dias integer,
    campos jsonb DEFAULT '[]'::jsonb NOT NULL,
    checklist jsonb DEFAULT '[]'::jsonb NOT NULL,
    no_portal boolean DEFAULT false NOT NULL,
    orientacao_portal text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT categorias_campos_check CHECK ((jsonb_typeof(campos) = 'array'::text)),
    CONSTRAINT categorias_checklist_check CHECK ((jsonb_typeof(checklist) = 'array'::text)),
    CONSTRAINT categorias_cor_check CHECK ((cor ~ '^#[0-9a-fA-F]{6}$'::text)),
    CONSTRAINT categorias_nome_check CHECK ((btrim(nome) <> ''::text)),
    CONSTRAINT categorias_prazo_terceirizado_dias_check CHECK ((prazo_terceirizado_dias > 0)),
    CONSTRAINT categorias_prazo_valor_check CHECK ((prazo_valor > 0)),
    CONSTRAINT categorias_resposta_horas_check CHECK ((resposta_horas > 0))
);


--
-- Name: contatos; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.contatos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    telefone text NOT NULL,
    empresa text,
    observacao text,
    legado_id text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contatos_nome_check CHECK ((btrim(nome) <> ''::text)),
    CONSTRAINT contatos_telefone_check CHECK ((btrim(telefone) <> ''::text))
);


--
-- Name: destinatarios; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.destinatarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chamado_id uuid,
    setor_id uuid,
    usuario_id uuid,
    titulo text,
    prazo timestamp with time zone,
    status os.status_destino DEFAULT 'aberto'::os.status_destino NOT NULL,
    responsavel_id uuid,
    lido_em timestamp with time zone,
    concluido_em timestamp with time zone,
    concluido_por uuid,
    observacao text,
    ordem integer DEFAULT 0 NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    ordem_id uuid,
    CONSTRAINT destinatarios_check CHECK ((num_nonnulls(setor_id, usuario_id) >= 1)),
    CONSTRAINT destinatarios_dono CHECK ((num_nonnulls(chamado_id, ordem_id) = 1))
);


--
-- Name: disparos; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.disparos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    modelo_id uuid NOT NULL,
    loja_id uuid NOT NULL,
    chamado_id uuid,
    automatico boolean DEFAULT false NOT NULL,
    disparado_por uuid,
    em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: empresas; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.empresas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    cnpj text,
    contato text,
    telefone text,
    email text,
    servicos text,
    prazo_retorno_dias integer,
    ativo boolean DEFAULT true NOT NULL,
    legado_id text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT empresas_nome_check CHECK ((btrim(nome) <> ''::text)),
    CONSTRAINT empresas_prazo_retorno_dias_check CHECK ((prazo_retorno_dias > 0))
);


--
-- Name: eventos; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.eventos (
    id bigint NOT NULL,
    chamado_id uuid,
    tipo text NOT NULL,
    texto text,
    dados jsonb DEFAULT '{}'::jsonb NOT NULL,
    visivel_lojista boolean DEFAULT false NOT NULL,
    autor_id uuid,
    autor_nome text,
    em timestamp with time zone DEFAULT now() NOT NULL,
    ordem_id uuid,
    CONSTRAINT eventos_dono CHECK ((num_nonnulls(chamado_id, ordem_id) = 1)),
    CONSTRAINT eventos_tipo_check CHECK ((tipo = ANY (ARRAY['criado'::text, 'comentario'::text, 'status'::text, 'alteracao'::text, 'anexo'::text, 'tempo'::text, 'conversao'::text, 'portal'::text, 'terceirizado'::text, 'sistema'::text])))
);


--
-- Name: eventos_id_seq; Type: SEQUENCE; Schema: os; Owner: -
--

ALTER TABLE os.eventos ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME os.eventos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: feriados; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.feriados (
    data date NOT NULL,
    nome text NOT NULL,
    CONSTRAINT feriados_nome_check CHECK ((btrim(nome) <> ''::text))
);


--
-- Name: leituras; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.leituras (
    chamado_id uuid NOT NULL,
    usuario_id uuid DEFAULT auth.uid() NOT NULL,
    lido_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lojas; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.lojas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    enet_id text,
    contrato text,
    luc text NOT NULL,
    nome text NOT NULL,
    locatario text,
    cnpj text,
    bloco text,
    situacao text DEFAULT 'vigente'::text NOT NULL,
    inicio date,
    fim date,
    telefone text,
    tem_vaga boolean,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    tipo_loja text,
    ramo text,
    ativacao date,
    rescisao date,
    piso text,
    rua text,
    CONSTRAINT lojas_luc_check CHECK ((btrim(luc) <> ''::text)),
    CONSTRAINT lojas_nome_check CHECK ((btrim(nome) <> ''::text)),
    CONSTRAINT lojas_situacao_check CHECK ((situacao = ANY (ARRAY['vigente'::text, 'encerrado'::text])))
);


--
-- Name: materiais; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.materiais (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ordem_id uuid NOT NULL,
    descricao text NOT NULL,
    quantidade numeric(12,3) NOT NULL,
    unidade text,
    criado_por uuid,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT materiais_descricao_check CHECK ((btrim(descricao) <> ''::text)),
    CONSTRAINT materiais_quantidade_check CHECK ((quantidade > (0)::numeric))
);


--
-- Name: material_valores; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.material_valores (
    material_id uuid NOT NULL,
    valor_unitario numeric(14,4) NOT NULL,
    CONSTRAINT material_valores_valor_unitario_check CHECK ((valor_unitario >= (0)::numeric))
);


--
-- Name: metas; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.metas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    setor_id uuid,
    categoria_id uuid,
    indicador text NOT NULL,
    meta numeric NOT NULL,
    limite_atencao numeric,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT metas_indicador_check CHECK ((indicador = ANY (ARRAY['pct_no_prazo'::text, 'tempo_medio_horas'::text]))),
    CONSTRAINT metas_limite_atencao_check CHECK ((limite_atencao >= (0)::numeric)),
    CONSTRAINT metas_meta_check CHECK ((meta >= (0)::numeric))
);


--
-- Name: modelo_itens; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.modelo_itens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    modelo_id uuid NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    setor_id uuid NOT NULL,
    categoria_id uuid,
    titulo text NOT NULL,
    descricao text,
    prazo_dias integer DEFAULT 0 NOT NULL,
    responsavel_id uuid,
    condicao text DEFAULT 'sempre'::text NOT NULL,
    acao text DEFAULT 'nenhuma'::text NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT modelo_itens_acao_check CHECK ((acao = ANY (ARRAY['nenhuma'::text, 'vistoria_entrada'::text, 'vistoria_saida'::text, 'portal_gerar'::text, 'portal_cancelar'::text]))),
    CONSTRAINT modelo_itens_condicao_check CHECK ((condicao = ANY (ARRAY['sempre'::text, 'tem_vaga'::text]))),
    CONSTRAINT modelo_itens_titulo_check CHECK ((btrim(titulo) <> ''::text))
);


--
-- Name: modelos; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.modelos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    gatilho text NOT NULL,
    descricao text,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT modelos_gatilho_check CHECK ((gatilho = ANY (ARRAY['entrada'::text, 'saida'::text, 'manual'::text]))),
    CONSTRAINT modelos_nome_check CHECK ((btrim(nome) <> ''::text))
);


--
-- Name: notificacoes; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.notificacoes (
    id bigint NOT NULL,
    usuario_id uuid NOT NULL,
    chamado_id uuid,
    tipo text NOT NULL,
    titulo text NOT NULL,
    texto text,
    href text NOT NULL,
    chave text,
    lida_em timestamp with time zone,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    ordem_id uuid,
    CONSTRAINT notificacoes_tipo_check CHECK ((tipo ~ '^[a-z_]+$'::text))
);


--
-- Name: notificacoes_id_seq; Type: SEQUENCE; Schema: os; Owner: -
--

ALTER TABLE os.notificacoes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME os.notificacoes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ordem_numero_seq; Type: SEQUENCE; Schema: os; Owner: -
--

CREATE SEQUENCE os.ordem_numero_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ordem_profissionais; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.ordem_profissionais (
    ordem_id uuid NOT NULL,
    profissional_id uuid NOT NULL
);


--
-- Name: ordens; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.ordens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    numero bigint DEFAULT nextval('os.ordem_numero_seq'::regclass) NOT NULL,
    tipo os.tipo_chamado DEFAULT 'os'::os.tipo_chamado NOT NULL,
    titulo text NOT NULL,
    descricao text,
    setor_id uuid NOT NULL,
    categoria_id uuid,
    status os.status_chamado DEFAULT 'aberto'::os.status_chamado NOT NULL,
    prioridade os.prioridade DEFAULT 'media'::os.prioridade NOT NULL,
    origem os.origem_chamado DEFAULT 'sistema'::os.origem_chamado NOT NULL,
    pessoal boolean DEFAULT false NOT NULL,
    precisa_confirmacao boolean DEFAULT true NOT NULL,
    aberto_por uuid,
    solicitante_nome text,
    solicitante_telefone text,
    responsavel_id uuid,
    prazo timestamp with time zone,
    loja_id uuid,
    ativo_id uuid,
    vistoria_id uuid,
    ambiente_id uuid,
    vinculado_a_id uuid,
    campos jsonb DEFAULT '{}'::jsonb NOT NULL,
    etiquetas text[] DEFAULT '{}'::text[] NOT NULL,
    checklist jsonb DEFAULT '[]'::jsonb NOT NULL,
    destinos_em_ordem boolean DEFAULT false NOT NULL,
    primeira_resposta_em timestamp with time zone,
    iniciado_em timestamp with time zone,
    aguardando_desde timestamp with time zone,
    aguardando_tipo os.motivo_aguardando,
    aguardando_motivo text,
    aguardando_min integer DEFAULT 0 NOT NULL,
    concluido_em timestamp with time zone,
    concluido_por uuid,
    fechado_em timestamp with time zone,
    fechado_por uuid,
    fechado_automatico boolean DEFAULT false NOT NULL,
    cancelado_em timestamp with time zone,
    cancelado_por uuid,
    motivo_cancelamento text,
    reaberto_vezes integer DEFAULT 0 NOT NULL,
    ultimo_motivo_reabertura text,
    solucao text,
    causa_falha text,
    execucao os.execucao DEFAULT 'interna'::os.execucao NOT NULL,
    local text,
    bloco text,
    empresa_id uuid,
    visita_data date,
    visita_periodo os.periodo_visita,
    prazo_terceirizado timestamp with time zone,
    cobranca_avisada_em timestamp with time zone,
    ativo_parado boolean DEFAULT false NOT NULL,
    rateio boolean DEFAULT false NOT NULL,
    assinatura_nome text,
    assinatura_path text,
    assinado_em timestamp with time zone,
    avaliacao smallint,
    avaliacao_comentario text,
    avaliado_em timestamp with time zone,
    recorrencia jsonb,
    serie_id uuid,
    serie_data date,
    plano_id uuid,
    plano_data date,
    legado_origem text,
    legado_id text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    acao_url text,
    acao_rotulo text,
    conclusao_externa boolean DEFAULT false NOT NULL,
    origem_modulo text,
    origem_ref text,
    CONSTRAINT ordens_acao_rotulo_check CHECK (((btrim(acao_rotulo) <> ''::text) AND (length(acao_rotulo) <= 80))),
    CONSTRAINT ordens_acao_url_check CHECK (((acao_url ~ '^/([^/\\[:space:]][^[:space:]]*)?$'::text) AND (length(acao_url) <= 500))),
    CONSTRAINT ordens_aguardando_min_check CHECK ((aguardando_min >= 0)),
    CONSTRAINT ordens_avaliacao_check CHECK (((avaliacao >= 1) AND (avaliacao <= 5))),
    CONSTRAINT ordens_campos_check CHECK ((jsonb_typeof(campos) = 'object'::text)),
    CONSTRAINT ordens_check CHECK (((status <> 'aguardando'::os.status_chamado) OR (aguardando_tipo IS NOT NULL))),
    CONSTRAINT ordens_check1 CHECK (((status <> 'cancelado'::os.status_chamado) OR (NULLIF(btrim(motivo_cancelamento), ''::text) IS NOT NULL))),
    CONSTRAINT ordens_checklist_check CHECK ((jsonb_typeof(checklist) = 'array'::text)),
    CONSTRAINT ordens_conclusao_externa_tem_acao CHECK (((NOT conclusao_externa) OR (acao_url IS NOT NULL))),
    CONSTRAINT ordens_origem_modulo_check CHECK ((origem_modulo ~ '^[a-z][a-z0-9_]*$'::text)),
    CONSTRAINT ordens_origem_ref_check CHECK (((btrim(origem_ref) <> ''::text) AND (length(origem_ref) <= 200))),
    CONSTRAINT ordens_origem_ref_tem_modulo CHECK (((origem_ref IS NULL) OR (origem_modulo IS NOT NULL))),
    CONSTRAINT ordens_tipo_check CHECK ((tipo = 'os'::os.tipo_chamado)),
    CONSTRAINT ordens_titulo_check CHECK ((btrim(titulo) <> ''::text))
);


--
-- Name: os_custos; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.os_custos (
    ordem_id uuid NOT NULL,
    valor_terceirizado numeric(14,2),
    orcamento_numero text,
    orcamento_aprovado_em timestamp with time zone,
    orcamento_aprovado_por uuid,
    rateio_regra os.regra_rateio,
    rateio_valor numeric(14,4),
    minutos integer,
    minuto_homem integer,
    custo_mao_obra numeric(14,2),
    custo_materiais numeric(14,2),
    custo_total numeric(14,2),
    valor_rateio numeric(14,2),
    completo boolean,
    memoria jsonb DEFAULT '[]'::jsonb NOT NULL,
    calculado_em timestamp with time zone,
    legado_valor numeric(14,2),
    legado_valor_rateio numeric(14,2),
    legado_minutos integer,
    legado_minuto_homem integer,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    outros_custos jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT os_custos_outros_custos_check CHECK ((jsonb_typeof(outros_custos) = 'array'::text)),
    CONSTRAINT os_custos_valor_terceirizado_check CHECK ((valor_terceirizado >= (0)::numeric))
);


--
-- Name: parametros; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.parametros (
    id smallint DEFAULT 1 NOT NULL,
    aceite_dias_uteis integer DEFAULT 3 NOT NULL,
    aviso_vencimento_horas integer DEFAULT 24 NOT NULL,
    confirmacao_alerta_dias integer DEFAULT 2 NOT NULL,
    dias_uteis integer[] DEFAULT '{1,2,3,4,5}'::integer[] NOT NULL,
    expediente_inicio time without time zone DEFAULT '08:00:00'::time without time zone NOT NULL,
    expediente_fim time without time zone DEFAULT '18:00:00'::time without time zone NOT NULL,
    almoco_inicio time without time zone DEFAULT '12:00:00'::time without time zone NOT NULL,
    almoco_fim time without time zone DEFAULT '13:00:00'::time without time zone NOT NULL,
    teto_terceirizado numeric(14,2),
    terceirizado_prazo_dias integer DEFAULT 7 NOT NULL,
    causas_falha text[] DEFAULT '{}'::text[] NOT NULL,
    preventiva_antecedencia_dias integer DEFAULT 7 NOT NULL,
    garantia_aviso_dias integer DEFAULT 60 NOT NULL,
    sinal_peso_avaliar numeric DEFAULT 30 NOT NULL,
    sinal_peso_trocar numeric DEFAULT 60 NOT NULL,
    sinal_corretivas_avaliar integer DEFAULT 3 NOT NULL,
    sinal_corretivas_trocar integer DEFAULT 5 NOT NULL,
    sinal_idade_avaliar_pct numeric DEFAULT 80 NOT NULL,
    sinal_idade_trocar_pct numeric DEFAULT 100 NOT NULL,
    recorrencia_antecedencia_dias integer DEFAULT 3 NOT NULL,
    vistoria_locador text DEFAULT 'ARP EMPREENDIMENTOS IMOBILIÁRIOS'::text NOT NULL,
    vistoria_local text DEFAULT 'Nova Friburgo - RJ'::text NOT NULL,
    vistoria_ambientes text[] DEFAULT '{}'::text[] NOT NULL,
    vistoria_textos jsonb DEFAULT '{}'::jsonb NOT NULL,
    portal_boas_vindas text DEFAULT ''::text NOT NULL,
    mensagens jsonb DEFAULT '{}'::jsonb NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    ativos_saida_tipos text[] DEFAULT '{Venda,Doação,Descarte,Devolução,Outro}'::text[] NOT NULL,
    ativos_saida_formas text[] DEFAULT '{Dinheiro,PIX,Outro}'::text[] NOT NULL,
    CONSTRAINT parametros_aceite_dias_uteis_check CHECK (((aceite_dias_uteis >= 0) AND (aceite_dias_uteis <= 60))),
    CONSTRAINT parametros_ativos_saida_formas_check CHECK (((cardinality(ativos_saida_formas) >= 1) AND (cardinality(ativos_saida_formas) <= 30))),
    CONSTRAINT parametros_ativos_saida_tipos_check CHECK (((cardinality(ativos_saida_tipos) >= 1) AND (cardinality(ativos_saida_tipos) <= 30))),
    CONSTRAINT parametros_aviso_vencimento_horas_check CHECK (((aviso_vencimento_horas >= 1) AND (aviso_vencimento_horas <= 240))),
    CONSTRAINT parametros_check CHECK ((sinal_peso_avaliar < sinal_peso_trocar)),
    CONSTRAINT parametros_check1 CHECK ((sinal_corretivas_avaliar < sinal_corretivas_trocar)),
    CONSTRAINT parametros_check2 CHECK ((sinal_idade_avaliar_pct < sinal_idade_trocar_pct)),
    CONSTRAINT parametros_check3 CHECK ((almoco_inicio < almoco_fim)),
    CONSTRAINT parametros_check4 CHECK ((expediente_inicio < expediente_fim)),
    CONSTRAINT parametros_confirmacao_alerta_dias_check CHECK (((confirmacao_alerta_dias >= 1) AND (confirmacao_alerta_dias <= 60))),
    CONSTRAINT parametros_garantia_aviso_dias_check CHECK (((garantia_aviso_dias >= 0) AND (garantia_aviso_dias <= 365))),
    CONSTRAINT parametros_id_check CHECK ((id = 1)),
    CONSTRAINT parametros_preventiva_antecedencia_dias_check CHECK (((preventiva_antecedencia_dias >= 0) AND (preventiva_antecedencia_dias <= 90))),
    CONSTRAINT parametros_recorrencia_antecedencia_dias_check CHECK (((recorrencia_antecedencia_dias >= 0) AND (recorrencia_antecedencia_dias <= 60))),
    CONSTRAINT parametros_terceirizado_prazo_dias_check CHECK (((terceirizado_prazo_dias >= 1) AND (terceirizado_prazo_dias <= 90))),
    CONSTRAINT parametros_teto_terceirizado_check CHECK ((teto_terceirizado >= (0)::numeric))
);


--
-- Name: participantes; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.participantes (
    chamado_id uuid,
    usuario_id uuid NOT NULL,
    motivo text DEFAULT 'seguindo'::text NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    id bigint NOT NULL,
    ordem_id uuid,
    CONSTRAINT participantes_dono CHECK ((num_nonnulls(chamado_id, ordem_id) = 1)),
    CONSTRAINT participantes_motivo_check CHECK ((motivo = ANY (ARRAY['mencionado'::text, 'seguindo'::text])))
);


--
-- Name: participantes_id_seq; Type: SEQUENCE; Schema: os; Owner: -
--

ALTER TABLE os.participantes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME os.participantes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: planos_preventivos; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.planos_preventivos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ativo_id uuid NOT NULL,
    titulo text NOT NULL,
    descricao text,
    frequencia_dias integer,
    frequencia_meses integer,
    proxima_data date NOT NULL,
    antecedencia_dias integer,
    setor_id uuid NOT NULL,
    categoria_id uuid,
    responsavel_id uuid,
    checklist jsonb DEFAULT '[]'::jsonb NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT planos_preventivos_antecedencia_dias_check CHECK ((antecedencia_dias >= 0)),
    CONSTRAINT planos_preventivos_check CHECK ((num_nonnulls(frequencia_dias, frequencia_meses) = 1)),
    CONSTRAINT planos_preventivos_checklist_check CHECK ((jsonb_typeof(checklist) = 'array'::text)),
    CONSTRAINT planos_preventivos_frequencia_dias_check CHECK ((frequencia_dias > 0)),
    CONSTRAINT planos_preventivos_frequencia_meses_check CHECK ((frequencia_meses > 0)),
    CONSTRAINT planos_preventivos_titulo_check CHECK ((btrim(titulo) <> ''::text))
);


--
-- Name: portal_links; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.portal_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    loja_id uuid NOT NULL,
    token text NOT NULL,
    criado_por uuid,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    enviado_em timestamp with time zone,
    cancelado_em timestamp with time zone,
    cancelado_por uuid,
    ultimo_acesso_em timestamp with time zone,
    CONSTRAINT portal_links_token_check CHECK ((length(token) >= 32))
);


--
-- Name: portal_sessoes; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.portal_sessoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    loja_id uuid NOT NULL,
    token text NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    expira_em timestamp with time zone NOT NULL,
    ultimo_acesso_em timestamp with time zone,
    encerrado_em timestamp with time zone,
    encerrado_por uuid,
    CONSTRAINT portal_sessoes_check CHECK ((criado_em < expira_em)),
    CONSTRAINT portal_sessoes_token_check CHECK ((length(token) >= 32))
);


--
-- Name: portal_tentativas; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.portal_tentativas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ip text NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profissionais; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.profissionais (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    nome text NOT NULL,
    telefone text,
    ativo boolean DEFAULT true NOT NULL,
    legado_id text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profissionais_nome_check CHECK ((btrim(nome) <> ''::text))
);


--
-- Name: sessao_tecnicos; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.sessao_tecnicos (
    sessao_id uuid NOT NULL,
    tecnico_id uuid NOT NULL
);


--
-- Name: sessoes; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.sessoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ordem_id uuid NOT NULL,
    data date NOT NULL,
    inicio time without time zone NOT NULL,
    fim time without time zone,
    almoco_inicio time without time zone,
    almoco_fim time without time zone,
    observacao text,
    criado_por uuid,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sessoes_check CHECK (((almoco_inicio IS NULL) = (almoco_fim IS NULL))),
    CONSTRAINT sessoes_check1 CHECK (((almoco_inicio IS NULL) OR (almoco_inicio < almoco_fim)))
);


--
-- Name: setor_membros; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.setor_membros (
    setor_id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    gestor boolean DEFAULT false NOT NULL
);


--
-- Name: setores; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.setores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    cor text DEFAULT '#2a78d6'::text NOT NULL,
    icone text DEFAULT 'inbox'::text NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT setores_cor_check CHECK ((cor ~ '^#[0-9a-fA-F]{6}$'::text)),
    CONSTRAINT setores_nome_check CHECK ((btrim(nome) <> ''::text))
);


--
-- Name: tecnico_valores; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.tecnico_valores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tecnico_id uuid NOT NULL,
    vigente_desde date NOT NULL,
    valor_minuto numeric(14,6) NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tecnico_valores_valor_minuto_check CHECK ((valor_minuto >= (0)::numeric))
);


--
-- Name: tecnicos; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.tecnicos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    usuario_id uuid,
    setor_id uuid,
    desligado_em date,
    legado_id text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tecnicos_nome_check CHECK ((btrim(nome) <> ''::text))
);


--
-- Name: terceirizado_links; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.terceirizado_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ordem_id uuid NOT NULL,
    token text NOT NULL,
    empresa_id uuid,
    criado_por uuid,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    aceito_em timestamp with time zone,
    recusado_em timestamp with time zone,
    recusa_motivo text,
    chegada_em timestamp with time zone,
    chegada_local jsonb,
    saida_em timestamp with time zone,
    saida_local jsonb,
    solucao text,
    valor_informado numeric(14,2),
    orcamento_numero text,
    terminado_em timestamp with time zone,
    cancelado_em timestamp with time zone,
    ultimo_acesso_em timestamp with time zone,
    assinatura_nome text,
    assinatura_documento text,
    assinatura_path text,
    assinado_em timestamp with time zone,
    CONSTRAINT terceirizado_links_assinatura_completa CHECK (((assinado_em IS NULL) OR ((assinatura_nome IS NOT NULL) AND (assinatura_path IS NOT NULL)))),
    CONSTRAINT terceirizado_links_assinatura_nome_check CHECK ((btrim(assinatura_nome) <> ''::text)),
    CONSTRAINT terceirizado_links_token_check CHECK ((length(token) >= 32)),
    CONSTRAINT terceirizado_links_valor_informado_check CHECK ((valor_informado >= (0)::numeric))
);


--
-- Name: vistoria_ambientes; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.vistoria_ambientes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vistoria_id uuid NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    titulo text NOT NULL,
    resposta os.resposta_ambiente DEFAULT 'respondido'::os.resposta_ambiente NOT NULL,
    descricao text,
    problema boolean DEFAULT false NOT NULL,
    entrada_ambiente_id uuid,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT vistoria_ambientes_titulo_check CHECK ((btrim(titulo) <> ''::text))
);


--
-- Name: vistorias; Type: TABLE; Schema: os; Owner: -
--

CREATE TABLE os.vistorias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo text DEFAULT os.proximo_codigo_vistoria() NOT NULL,
    tipo os.tipo_vistoria NOT NULL,
    status os.status_vistoria DEFAULT 'andamento'::os.status_vistoria NOT NULL,
    rascunho boolean DEFAULT true NOT NULL,
    data date NOT NULL,
    hora time without time zone,
    vistoriador_id uuid,
    vistoriador_nome text NOT NULL,
    locador text NOT NULL,
    loja_id uuid,
    locatario text NOT NULL,
    bloco text NOT NULL,
    unidade text NOT NULL,
    campo_tipo text,
    itens_anteriores text,
    observacao text DEFAULT ''::text NOT NULL,
    consideracoes text,
    termo text DEFAULT ''::text NOT NULL,
    local_data text DEFAULT ''::text NOT NULL,
    entrada_id uuid,
    comparar_no_laudo boolean DEFAULT false NOT NULL,
    assinatura_locador_path text,
    assinatura_locatario_path text,
    assinado_em timestamp with time zone,
    legado_id text,
    criado_por uuid,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    assinatura_token text,
    assinatura_enviada_em timestamp with time zone,
    locatario_assinatura_nome text,
    locatario_assinatura_documento text,
    locatario_assinado_em timestamp with time zone,
    CONSTRAINT vistorias_assinatura_token_check CHECK ((length(assinatura_token) >= 32)),
    CONSTRAINT vistorias_campo_tipo_check CHECK ((campo_tipo = ANY (ARRAY['sim'::text, 'nao'::text, 'nao_se_aplica'::text]))),
    CONSTRAINT vistorias_codigo_check CHECK ((btrim(codigo) <> ''::text)),
    CONSTRAINT vistorias_vistoriador_nome_check CHECK ((btrim(vistoriador_nome) <> ''::text))
);


--
-- Name: afastamentos; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.afastamentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    colaborador_id uuid NOT NULL,
    inicio date NOT NULL,
    fim date NOT NULL,
    motivo text,
    justificativa text,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    secullum_id integer,
    CONSTRAINT afastamentos_check CHECK ((fim >= inicio))
);


--
-- Name: banco_horas_fechamentos; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.banco_horas_fechamentos (
    ciclo_id uuid NOT NULL,
    colaborador_id uuid NOT NULL,
    saldo_min integer NOT NULL,
    salario_hora numeric(14,4),
    valor_calculado numeric(14,2),
    acao text,
    valor_realizado numeric(14,2),
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT banco_horas_fechamentos_acao_check CHECK ((acao = ANY (ARRAY['pago'::text, 'descontado'::text, 'abonado'::text])))
);


--
-- Name: beneficio_contratos; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.beneficio_contratos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    beneficio_id uuid NOT NULL,
    tipo_contrato rh.tipo_contrato NOT NULL,
    desde date NOT NULL,
    ate date,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT beneficio_contratos_check CHECK (((ate IS NULL) OR (ate >= desde)))
);


--
-- Name: beneficio_totais_mensais; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.beneficio_totais_mensais (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    beneficio_id uuid NOT NULL,
    competencia core.competencia NOT NULL,
    valor numeric(14,2) NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT beneficio_totais_mensais_valor_check CHECK ((valor >= (0)::numeric))
);


--
-- Name: beneficio_valores_mensais; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.beneficio_valores_mensais (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    beneficio_id uuid NOT NULL,
    colaborador_id uuid NOT NULL,
    competencia core.competencia NOT NULL,
    valor numeric(14,2) NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT beneficio_valores_mensais_valor_check CHECK ((valor >= (0)::numeric))
);


--
-- Name: beneficios; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.beneficios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    tipo rh.tipo_beneficio NOT NULL,
    valor_padrao numeric(14,2),
    rubricas_desconto integer[] DEFAULT '{}'::integer[] NOT NULL,
    rubricas_desconto_dependente integer[] DEFAULT '{}'::integer[] NOT NULL,
    dependente_regra rh.regra_dependente DEFAULT 'nao_paga'::rh.regra_dependente NOT NULL,
    dependente_valor numeric(14,2),
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    valor_por_mes boolean DEFAULT false NOT NULL,
    forma_calculo text DEFAULT 'por_funcionario'::text NOT NULL,
    dividir_entre text,
    dividir_departamento_id uuid,
    CONSTRAINT beneficio_rateado_com_valor CHECK (((forma_calculo <> 'rateado'::text) OR valor_por_mes OR (valor_padrao IS NOT NULL))),
    CONSTRAINT beneficio_rateio CHECK ((((forma_calculo = 'rateado'::text) = (dividir_entre IS NOT NULL)) AND ((dividir_departamento_id IS NOT NULL) = COALESCE((dividir_entre = 'departamento'::text), false)))),
    CONSTRAINT beneficios_check CHECK (((dependente_regra = 'nao_paga'::rh.regra_dependente) = (dependente_valor IS NULL))),
    CONSTRAINT beneficios_dependente_valor_check CHECK ((dependente_valor >= (0)::numeric)),
    CONSTRAINT beneficios_dividir_entre_check CHECK ((dividir_entre = ANY (ARRAY['ativos'::text, 'ativos_nao_afastados'::text, 'departamento'::text]))),
    CONSTRAINT beneficios_forma_calculo_check CHECK ((forma_calculo = ANY (ARRAY['por_funcionario'::text, 'rateado'::text]))),
    CONSTRAINT beneficios_valor_padrao_check CHECK ((valor_padrao >= (0)::numeric))
);


--
-- Name: COLUMN beneficios.valor_padrao; Type: COMMENT; Schema: rh; Owner: -
--

COMMENT ON COLUMN rh.beneficios.valor_padrao IS 'Valor mensal cheio por pessoa; no rateado, o valor total do mês. Null em plano e odonto (tabela de faixas) e no que varia por mês.';


--
-- Name: cargos; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.cargos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    codigo_folha integer,
    cbo text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: categorias_gasto; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.categorias_gasto (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    ativa boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT categorias_gasto_nome_check CHECK (((length(btrim(nome)) >= 1) AND (length(btrim(nome)) <= 60)))
);


--
-- Name: colaborador_beneficios; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.colaborador_beneficios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    colaborador_id uuid NOT NULL,
    beneficio_id uuid NOT NULL,
    valor_manual numeric(14,2),
    desde date NOT NULL,
    ate date,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT colaborador_beneficios_check CHECK (((ate IS NULL) OR (ate >= desde))),
    CONSTRAINT colaborador_beneficios_valor_manual_check CHECK ((valor_manual >= (0)::numeric))
);


--
-- Name: colaboradores; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.colaboradores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    matricula integer,
    nome text NOT NULL,
    nascimento date,
    admissao date,
    desligamento date,
    motivo_desligamento_id uuid,
    tipo_contrato rh.tipo_contrato,
    departamento_id uuid,
    cargo_id uuid,
    secullum_id integer,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    copiloto_id uuid NOT NULL,
    situacao_copiloto text,
    motivo_desligamento_copiloto text,
    decisao_desligamento_copiloto text,
    fora_do_ponto boolean DEFAULT false NOT NULL,
    CONSTRAINT colaboradores_check CHECK (((desligamento IS NULL) OR (admissao IS NULL) OR (desligamento >= admissao)))
);


--
-- Name: custos_colaborador; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.custos_colaborador (
    competencia core.competencia NOT NULL,
    colaborador_id uuid NOT NULL,
    departamento_id uuid,
    cargo_id uuid,
    tipo_contrato rh.tipo_contrato NOT NULL,
    remuneracao numeric(14,2) DEFAULT 0 NOT NULL,
    encargos numeric(14,2) DEFAULT 0 NOT NULL,
    provisao_13 numeric(14,2) DEFAULT 0 NOT NULL,
    provisao_ferias numeric(14,2) DEFAULT 0 NOT NULL,
    multa_rescisoria numeric(14,2) DEFAULT 0 NOT NULL,
    beneficios numeric(14,2) DEFAULT 0 NOT NULL,
    rescisao numeric(14,2) DEFAULT 0 NOT NULL,
    reembolsos numeric(14,2) DEFAULT 0 NOT NULL,
    custo_total numeric(14,2) NOT NULL,
    jornada_min integer,
    custo_hora numeric(14,4),
    salario_hora numeric(14,4),
    memoria jsonb NOT NULL,
    calculado_em timestamp with time zone DEFAULT now() NOT NULL,
    valor_informado boolean DEFAULT true NOT NULL,
    CONSTRAINT custos_colaborador_check CHECK ((custo_total = (((((((remuneracao + encargos) + provisao_13) + provisao_ferias) + multa_rescisoria) + beneficios) + rescisao) - reembolsos))),
    CONSTRAINT custos_colaborador_jornada_min_check CHECK ((jornada_min > 0))
);


--
-- Name: dados_financeiros_mensais; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.dados_financeiros_mensais (
    competencia core.competencia NOT NULL,
    faturamento_bruto numeric(14,2),
    custo_despesa_total numeric(14,2),
    custos_operacionais_sem_pessoal numeric(14,2),
    lucro numeric(14,2),
    endomarketing numeric(14,2),
    origem rh.origem_valor DEFAULT 'manual'::rh.origem_valor NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: departamentos; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.departamentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    codigo_folha integer,
    secullum_id integer,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dependentes; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.dependentes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    colaborador_id uuid NOT NULL,
    nome text NOT NULL,
    nascimento date,
    tem_plano boolean DEFAULT false NOT NULL,
    tem_odonto boolean DEFAULT false NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    copiloto_id uuid NOT NULL,
    parentesco text
);


--
-- Name: encargos_por_contrato; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.encargos_por_contrato (
    tipo_contrato rh.tipo_contrato NOT NULL,
    vigente_desde core.competencia NOT NULL,
    inss_patronal_pct numeric(7,3) NOT NULL,
    terceiros_pct numeric(7,3) NOT NULL,
    fgts_pct numeric(7,3) NOT NULL,
    aplica_rat boolean NOT NULL,
    provisiona_13 boolean NOT NULL,
    provisiona_ferias boolean NOT NULL,
    multa_rescisoria_pct numeric(7,3) NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    provisiona_recesso boolean DEFAULT false NOT NULL,
    CONSTRAINT encargos_por_contrato_fgts_pct_check CHECK ((fgts_pct >= (0)::numeric)),
    CONSTRAINT encargos_por_contrato_inss_patronal_pct_check CHECK ((inss_patronal_pct >= (0)::numeric)),
    CONSTRAINT encargos_por_contrato_multa_rescisoria_pct_check CHECK ((multa_rescisoria_pct >= (0)::numeric)),
    CONSTRAINT encargos_por_contrato_terceiros_pct_check CHECK ((terceiros_pct >= (0)::numeric))
);


--
-- Name: folha_colaboradores; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.folha_colaboradores (
    folha_id uuid NOT NULL,
    colaborador_id uuid NOT NULL,
    situacao rh.situacao_folha NOT NULL,
    tipo_contrato rh.tipo_contrato NOT NULL,
    departamento_codigo_folha integer,
    departamento_id uuid,
    cargo_id uuid,
    horas_mes_min integer,
    salario numeric(14,2),
    base_inss numeric(14,2),
    base_fgts numeric(14,2),
    valor_fgts numeric(14,2),
    liquido numeric(14,2)
);


--
-- Name: folha_rubricas; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.folha_rubricas (
    id bigint NOT NULL,
    folha_id uuid NOT NULL,
    colaborador_id uuid NOT NULL,
    rubrica_codigo integer NOT NULL,
    natureza rh.natureza_rubrica NOT NULL,
    referencia numeric(14,4),
    valor numeric(14,2) NOT NULL
);


--
-- Name: folha_rubricas_id_seq; Type: SEQUENCE; Schema: rh; Owner: -
--

ALTER TABLE rh.folha_rubricas ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rh.folha_rubricas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: folhas; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.folhas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    competencia core.competencia NOT NULL,
    importacao_id uuid,
    resumo_empresa jsonb DEFAULT '{}'::jsonb NOT NULL,
    status rh.status_folha DEFAULT 'importada'::rh.status_folha NOT NULL,
    ficticia boolean DEFAULT false NOT NULL,
    fechada_por uuid,
    fechada_em timestamp with time zone,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT folhas_check CHECK (((status = 'fechada'::rh.status_folha) = (fechada_em IS NOT NULL)))
);


--
-- Name: gastos; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.gastos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    data date NOT NULL,
    valor numeric(14,2) NOT NULL,
    categoria_id uuid NOT NULL,
    descricao text NOT NULL,
    finalidade text NOT NULL,
    observacao text,
    criado_por uuid DEFAULT auth.uid(),
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT gastos_descricao_check CHECK (((length(btrim(descricao)) >= 1) AND (length(btrim(descricao)) <= 200))),
    CONSTRAINT gastos_finalidade_check CHECK (((length(btrim(finalidade)) >= 1) AND (length(btrim(finalidade)) <= 200))),
    CONSTRAINT gastos_observacao_check CHECK ((length(observacao) <= 1000)),
    CONSTRAINT gastos_valor_check CHECK ((valor > (0)::numeric))
);


--
-- Name: jornadas; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.jornadas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    departamento_id uuid,
    cargo_id uuid,
    colaborador_id uuid,
    horas_mes_min integer NOT NULL,
    vigente_desde core.competencia NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT jornadas_check CHECK ((num_nonnulls(departamento_id, cargo_id, colaborador_id) <= 1)),
    CONSTRAINT jornadas_horas_mes_min_check CHECK ((horas_mes_min > 0))
);


--
-- Name: motivos_desligamento; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.motivos_desligamento (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    secullum_id integer,
    descricao text NOT NULL,
    tipo_turnover text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notas_pj; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.notas_pj (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    competencia core.competencia NOT NULL,
    colaborador_id uuid NOT NULL,
    numero_documento text NOT NULL,
    valor numeric(14,2) NOT NULL,
    origem rh.origem_valor DEFAULT 'manual'::rh.origem_valor NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notas_pj_valor_check CHECK ((valor >= (0)::numeric))
);


--
-- Name: parametros_empresa; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.parametros_empresa (
    vigente_desde core.competencia NOT NULL,
    regime_tributario text,
    rat_pct numeric(7,3) NOT NULL,
    fap numeric(5,4) NOT NULL,
    banco_horas_inicio date NOT NULL,
    banco_horas_fim date NOT NULL,
    banco_horas_adicional_pct numeric(7,3) DEFAULT 50 NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT parametros_empresa_banco_horas_adicional_pct_check CHECK ((banco_horas_adicional_pct >= (0)::numeric)),
    CONSTRAINT parametros_empresa_check CHECK ((banco_horas_fim > banco_horas_inicio)),
    CONSTRAINT parametros_empresa_fap_check CHECK (((fap >= 0.5) AND (fap <= (2)::numeric))),
    CONSTRAINT parametros_empresa_rat_pct_check CHECK (((rat_pct >= (0)::numeric) AND (rat_pct <= (3)::numeric)))
);


--
-- Name: parametros_turnover; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.parametros_turnover (
    id boolean DEFAULT true NOT NULL,
    formula_geral text DEFAULT '((desligamentos_voluntarios + desligamentos_involuntarios + desligamentos_acordo) / total_colaboradores_inicio_mes) * 100'::text NOT NULL,
    formula_voluntario text,
    formula_involuntario text,
    formula_acordo text,
    acordo_conta_como text DEFAULT 'voluntario'::text NOT NULL,
    motivos_voluntarios text[] DEFAULT ARRAY['pedido_demissao'::text, 'rescisao_indireta'::text, 'antecipada_termo_empregado'::text, 'aposentadoria_idade'::text, 'aposentadoria_invalidez'::text, 'aposentadoria_compulsoria'::text] NOT NULL,
    motivos_involuntarios text[] DEFAULT ARRAY['sem_justa_causa'::text, 'justa_causa'::text, 'antecipada_termo_empregador'::text] NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT parametros_turnover_acordo_conta_como_check CHECK ((acordo_conta_como = ANY (ARRAY['voluntario'::text, 'involuntario'::text, 'separado'::text]))),
    CONSTRAINT parametros_turnover_id_check CHECK (id)
);


--
-- Name: plano_coparticipacao; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.plano_coparticipacao (
    tabela_id uuid NOT NULL,
    meses_min integer NOT NULL,
    meses_max integer,
    colaborador_pct numeric(7,3),
    colaborador_valor_fixo numeric(14,2),
    CONSTRAINT plano_coparticipacao_check CHECK (((meses_max IS NULL) OR (meses_max >= meses_min))),
    CONSTRAINT plano_coparticipacao_check1 CHECK ((num_nonnulls(colaborador_pct, colaborador_valor_fixo) = 1)),
    CONSTRAINT plano_coparticipacao_colaborador_pct_check CHECK (((colaborador_pct >= (0)::numeric) AND (colaborador_pct <= (100)::numeric))),
    CONSTRAINT plano_coparticipacao_colaborador_valor_fixo_check CHECK ((colaborador_valor_fixo >= (0)::numeric)),
    CONSTRAINT plano_coparticipacao_meses_min_check CHECK ((meses_min >= 0))
);


--
-- Name: plano_faixas_etarias; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.plano_faixas_etarias (
    tabela_id uuid NOT NULL,
    idade_min integer NOT NULL,
    idade_max integer,
    mensalidade numeric(14,2) NOT NULL,
    CONSTRAINT plano_faixas_etarias_check CHECK (((idade_max IS NULL) OR (idade_max >= idade_min))),
    CONSTRAINT plano_faixas_etarias_idade_min_check CHECK ((idade_min >= 0)),
    CONSTRAINT plano_faixas_etarias_mensalidade_check CHECK ((mensalidade >= (0)::numeric))
);


--
-- Name: plano_tabelas; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.plano_tabelas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    beneficio_id uuid NOT NULL,
    vigente_desde core.competencia NOT NULL,
    reajuste_pct numeric(7,3),
    importacao_id uuid,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ponto_diario; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.ponto_diario (
    colaborador_id uuid NOT NULL,
    data date NOT NULL,
    competencia core.competencia NOT NULL,
    batidas jsonb DEFAULT '[]'::jsonb NOT NULL,
    ocorrencia text,
    previstas_min integer DEFAULT 0 NOT NULL,
    normais_min integer DEFAULT 0 NOT NULL,
    faltas_min integer DEFAULT 0 NOT NULL,
    atrasos_min integer DEFAULT 0 NOT NULL,
    abonos_min jsonb DEFAULT '{}'::jsonb NOT NULL,
    extras_min jsonb DEFAULT '{}'::jsonb NOT NULL,
    noturnas_min integer DEFAULT 0 NOT NULL,
    banco_saldo_min integer DEFAULT 0 NOT NULL,
    banco_creditos_min integer DEFAULT 0 NOT NULL,
    banco_debitos_min integer DEFAULT 0 NOT NULL,
    sync_run_id uuid,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ponto_diario_batidas_check CHECK ((jsonb_typeof(batidas) = 'array'::text)),
    CONSTRAINT ponto_diario_check CHECK (((date_trunc('month'::text, (data)::timestamp with time zone))::date = (competencia)::date))
);


--
-- Name: ponto_mensal; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.ponto_mensal (
    competencia core.competencia NOT NULL,
    colaborador_id uuid NOT NULL,
    departamento_id uuid,
    previstas_min integer DEFAULT 0 NOT NULL,
    normais_min integer DEFAULT 0 NOT NULL,
    faltas_min integer DEFAULT 0 NOT NULL,
    atrasos_min integer DEFAULT 0 NOT NULL,
    faltas_dias numeric(6,2) DEFAULT 0 NOT NULL,
    abonos_min jsonb DEFAULT '{}'::jsonb NOT NULL,
    banco_saldo_min integer DEFAULT 0 NOT NULL,
    banco_creditos_min integer DEFAULT 0 NOT NULL,
    banco_debitos_min integer DEFAULT 0 NOT NULL,
    sync_run_id uuid,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    extras_min jsonb DEFAULT '{}'::jsonb NOT NULL,
    noturnas_min integer DEFAULT 0 NOT NULL,
    dsr_debito_min integer DEFAULT 0 NOT NULL
);


--
-- Name: rubricas; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.rubricas (
    codigo integer NOT NULL,
    descricao text NOT NULL,
    grupo rh.grupo_rubrica DEFAULT 'nao_classificada'::rh.grupo_rubrica NOT NULL,
    classificada_por uuid,
    classificada_em timestamp with time zone,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: valores_pj; Type: TABLE; Schema: rh; Owner: -
--

CREATE TABLE rh.valores_pj (
    colaborador_id uuid NOT NULL,
    valor numeric(14,2) NOT NULL,
    sync_run_id uuid,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT valores_pj_valor_check CHECK ((valor >= (0)::numeric))
);


--
-- Name: acoes; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.acoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    participante_id uuid NOT NULL,
    data date NOT NULL,
    tipo text NOT NULL,
    observacao text,
    criado_por uuid DEFAULT auth.uid(),
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT acoes_observacao_check CHECK ((length(observacao) <= 1000)),
    CONSTRAINT acoes_tipo_check CHECK ((btrim(tipo) <> ''::text))
);


--
-- Name: cadastros_lista; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.cadastros_lista (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    programa_id uuid NOT NULL,
    campo_id text NOT NULL,
    valor text NOT NULL,
    normalizado text NOT NULL,
    importacao_id uuid,
    criado_por uuid DEFAULT auth.uid(),
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cadastros_lista_normalizado_check CHECK ((btrim(normalizado) <> ''::text)),
    CONSTRAINT cadastros_lista_valor_check CHECK (((length(btrim(valor)) >= 1) AND (length(btrim(valor)) <= 200)))
);


--
-- Name: coletores; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.coletores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    local text NOT NULL,
    cor text NOT NULL,
    conteineres integer DEFAULT 1 NOT NULL,
    capacidade_l numeric(10,2),
    ativo boolean DEFAULT true NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    exemplo boolean DEFAULT false NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coletores_capacidade_l_check CHECK ((capacidade_l > (0)::numeric)),
    CONSTRAINT coletores_conteineres_check CHECK ((conteineres > 0)),
    CONSTRAINT coletores_cor_check CHECK ((cor = ANY (ARRAY['preto'::text, 'azul'::text]))),
    CONSTRAINT coletores_local_check CHECK (((length(btrim(local)) >= 1) AND (length(btrim(local)) <= 120)))
);


--
-- Name: consolidado_valores; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.consolidado_valores (
    ano integer NOT NULL,
    totais jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT consolidado_valores_totais_check CHECK ((jsonb_typeof(totais) = 'object'::text))
);


--
-- Name: consolidados; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.consolidados (
    ano integer NOT NULL,
    totais jsonb DEFAULT '{}'::jsonb NOT NULL,
    situacao text DEFAULT 'fechado'::text NOT NULL,
    fechado_por uuid DEFAULT auth.uid(),
    fechado_em timestamp with time zone DEFAULT now() NOT NULL,
    reaberto_por uuid,
    reaberto_em timestamp with time zone,
    reaberto_motivo text,
    CONSTRAINT consolidados_ano_check CHECK (((ano >= 2000) AND (ano <= 2100))),
    CONSTRAINT consolidados_check CHECK (((situacao <> 'reaberto'::text) OR ((reaberto_em IS NOT NULL) AND (reaberto_motivo IS NOT NULL)))),
    CONSTRAINT consolidados_reaberto_motivo_check CHECK ((length(reaberto_motivo) <= 500)),
    CONSTRAINT consolidados_situacao_check CHECK ((situacao = ANY (ARRAY['fechado'::text, 'reaberto'::text]))),
    CONSTRAINT consolidados_totais_check CHECK ((jsonb_typeof(totais) = 'object'::text))
);


--
-- Name: contratos; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.contratos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    loja_id uuid,
    contrato text,
    cliente_nome text NOT NULL,
    cliente_doc text,
    lucs text[] DEFAULT '{}'::text[] NOT NULL,
    bloco text,
    tipo_loja text,
    ramo text,
    ativacao date,
    inicio date,
    rescisao date,
    situacao text DEFAULT 'vigente'::text NOT NULL,
    sincronizado_em timestamp with time zone,
    ativacao_corrigida date,
    ativacao_corrigida_por uuid,
    ativacao_corrigida_em timestamp with time zone,
    ativacao_corrigida_motivo text,
    validade_meses_especifica integer,
    dispensada_em timestamp with time zone,
    dispensada_por uuid,
    dispensada_motivo text,
    chamado_id uuid,
    exemplo boolean DEFAULT false NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contratos_ativacao_corrigida_motivo_check CHECK ((length(ativacao_corrigida_motivo) <= 500)),
    CONSTRAINT contratos_check CHECK (((dispensada_em IS NULL) = (dispensada_motivo IS NULL))),
    CONSTRAINT contratos_check1 CHECK (((ativacao_corrigida IS NULL) OR (ativacao_corrigida_motivo IS NOT NULL))),
    CONSTRAINT contratos_cliente_doc_check CHECK ((cliente_doc ~ '^\d*$'::text)),
    CONSTRAINT contratos_cliente_nome_check CHECK ((btrim(cliente_nome) <> ''::text)),
    CONSTRAINT contratos_dispensada_motivo_check CHECK ((length(dispensada_motivo) <= 500)),
    CONSTRAINT contratos_situacao_check CHECK ((situacao = ANY (ARRAY['vigente'::text, 'encerrado'::text]))),
    CONSTRAINT contratos_validade_meses_especifica_check CHECK ((validade_meses_especifica > 0))
);


--
-- Name: contribuicao_valores; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.contribuicao_valores (
    contribuicao_id uuid NOT NULL,
    valor numeric(14,2) NOT NULL,
    CONSTRAINT contribuicao_valores_valor_check CHECK ((valor >= (0)::numeric))
);


--
-- Name: contribuicoes; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.contribuicoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    participante_id uuid NOT NULL,
    data date NOT NULL,
    forma text NOT NULL,
    competencia date NOT NULL,
    observacao text,
    criado_por uuid DEFAULT auth.uid(),
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contribuicoes_competencia_check CHECK ((EXTRACT(day FROM competencia) = (1)::numeric)),
    CONSTRAINT contribuicoes_forma_check CHECK ((btrim(forma) <> ''::text)),
    CONSTRAINT contribuicoes_observacao_check CHECK ((length(observacao) <= 1000))
);


--
-- Name: entrevista_transferencias; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.entrevista_transferencias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entrevista_id uuid NOT NULL,
    de_contrato_id uuid NOT NULL,
    para_contrato_id uuid NOT NULL,
    motivo text NOT NULL,
    quem uuid DEFAULT auth.uid(),
    quando timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT entrevista_transferencias_check CHECK ((de_contrato_id <> para_contrato_id)),
    CONSTRAINT entrevista_transferencias_motivo_check CHECK (((length(btrim(motivo)) >= 3) AND (length(btrim(motivo)) <= 500)))
);


--
-- Name: entrevistas; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.entrevistas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contrato_id uuid NOT NULL,
    lucs text[] DEFAULT '{}'::text[] NOT NULL,
    cliente_doc text,
    data date NOT NULL,
    tipo text DEFAULT 'primeira'::text NOT NULL,
    setor text,
    formulario_versao integer NOT NULL,
    respostas jsonb DEFAULT '{}'::jsonb NOT NULL,
    situacao text DEFAULT 'rascunho'::text NOT NULL,
    rascunho_chave uuid,
    respondente_nome text,
    assinatura_respondente text,
    assinatura_entrevistador text,
    pdf text,
    anexos jsonb DEFAULT '[]'::jsonb NOT NULL,
    origem text DEFAULT 'sistema'::text NOT NULL,
    entrevistador_id uuid DEFAULT auth.uid(),
    chamado_id uuid,
    valida_ate date,
    importacao_id uuid,
    exemplo boolean DEFAULT false NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT entrevistas_check CHECK (((pdf IS NULL) OR (pdf ~~ (('entrevistas/'::text || id) || '/%'::text)))),
    CONSTRAINT entrevistas_check1 CHECK (((assinatura_respondente IS NULL) OR (assinatura_respondente ~~ (('entrevistas/'::text || id) || '/%'::text)))),
    CONSTRAINT entrevistas_check2 CHECK (((assinatura_entrevistador IS NULL) OR (assinatura_entrevistador ~~ (('entrevistas/'::text || id) || '/%'::text)))),
    CONSTRAINT entrevistas_check3 CHECK (((jsonb_typeof(anexos) = 'array'::text) AND (NOT jsonb_path_exists(anexos, '$[*]?(!(@."caminho" starts with $"p"))'::jsonpath, jsonb_build_object('p', (('entrevistas/'::text || id) || '/anexos/'::text)))))),
    CONSTRAINT entrevistas_formulario_versao_check CHECK ((formulario_versao > 0)),
    CONSTRAINT entrevistas_origem_check CHECK ((origem = ANY (ARRAY['sistema'::text, 'forms'::text, 'papel'::text]))),
    CONSTRAINT entrevistas_respostas_check CHECK ((jsonb_typeof(respostas) = 'object'::text)),
    CONSTRAINT entrevistas_situacao_check CHECK ((situacao = ANY (ARRAY['rascunho'::text, 'salva'::text]))),
    CONSTRAINT entrevistas_tipo_check CHECK ((tipo = ANY (ARRAY['primeira'::text, 'atualizacao'::text])))
);


--
-- Name: equivalencias; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.equivalencias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    fator numeric NOT NULL,
    unidade text,
    confirmado boolean DEFAULT false NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT equivalencias_fator_check CHECK ((fator > (0)::numeric)),
    CONSTRAINT equivalencias_nome_check CHECK ((btrim(nome) <> ''::text))
);


--
-- Name: formulario_alteracoes; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.formulario_alteracoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    formulario_id uuid NOT NULL,
    quando timestamp with time zone DEFAULT now() NOT NULL,
    quem uuid DEFAULT auth.uid(),
    descricao text NOT NULL,
    antes jsonb,
    depois jsonb,
    CONSTRAINT formulario_alteracoes_descricao_check CHECK (((length(btrim(descricao)) >= 1) AND (length(btrim(descricao)) <= 500)))
);


--
-- Name: formulario_versoes; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.formulario_versoes (
    formulario_id uuid NOT NULL,
    versao integer NOT NULL,
    definicao jsonb NOT NULL,
    resumo text NOT NULL,
    publicado_por uuid DEFAULT auth.uid(),
    publicado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT formulario_versoes_definicao_check CHECK ((jsonb_typeof((definicao -> 'secoes'::text)) = 'array'::text)),
    CONSTRAINT formulario_versoes_resumo_check CHECK (((length(btrim(resumo)) >= 1) AND (length(btrim(resumo)) <= 500))),
    CONSTRAINT formulario_versoes_versao_check CHECK ((versao > 0))
);


--
-- Name: formularios; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.formularios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo text NOT NULL,
    programa_id uuid,
    nome text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    versao_publicada integer DEFAULT 0 NOT NULL,
    rascunho jsonb DEFAULT '{"secoes": []}'::jsonb NOT NULL,
    rascunho_alterado boolean DEFAULT false NOT NULL,
    exemplo boolean DEFAULT false NOT NULL,
    criado_por uuid DEFAULT auth.uid(),
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT formularios_check CHECK (((tipo = 'questionario'::text) = (programa_id IS NULL))),
    CONSTRAINT formularios_nome_check CHECK (((length(btrim(nome)) >= 1) AND (length(btrim(nome)) <= 120))),
    CONSTRAINT formularios_rascunho_check CHECK ((jsonb_typeof((rascunho -> 'secoes'::text)) = 'array'::text)),
    CONSTRAINT formularios_tipo_check CHECK ((tipo = ANY (ARRAY['questionario'::text, 'programa'::text]))),
    CONSTRAINT formularios_versao_publicada_check CHECK ((versao_publicada >= 0))
);


--
-- Name: importacoes; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.importacoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo text NOT NULL,
    status text DEFAULT 'previa'::text NOT NULL,
    arquivo jsonb DEFAULT '{}'::jsonb NOT NULL,
    sha256 text,
    resumo jsonb DEFAULT '{}'::jsonb NOT NULL,
    avisos jsonb DEFAULT '[]'::jsonb NOT NULL,
    decisoes jsonb DEFAULT '{}'::jsonb NOT NULL,
    substitui uuid,
    criado_por uuid DEFAULT auth.uid(),
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    confirmado_por uuid,
    confirmado_em timestamp with time zone,
    desfeito_por uuid,
    desfeito_em timestamp with time zone,
    CONSTRAINT importacoes_status_check CHECK ((status = ANY (ARRAY['previa'::text, 'confirmada'::text, 'desfeita'::text, 'substituida'::text]))),
    CONSTRAINT importacoes_tipo_check CHECK ((tipo = ANY (ARRAY['entrevistas'::text, 'atracoes'::text, 'produtores'::text, 'ecocopos'::text, 'quiosque'::text, 'tour'::text])))
);


--
-- Name: lancamento_valores; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.lancamento_valores (
    lancamento_id uuid NOT NULL,
    valores jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT lancamento_valores_valores_check CHECK ((jsonb_typeof(valores) = 'object'::text))
);


--
-- Name: lancamentos; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.lancamentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    programa_id uuid NOT NULL,
    formulario_id uuid NOT NULL,
    formulario_versao integer NOT NULL,
    data date NOT NULL,
    valores jsonb DEFAULT '{}'::jsonb NOT NULL,
    origem text DEFAULT 'equipe'::text NOT NULL,
    link_id uuid,
    lancado_por uuid DEFAULT auth.uid(),
    importacao_id uuid,
    exemplo boolean DEFAULT false NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lancamentos_check CHECK (((link_id IS NULL) OR (origem = 'link'::text))),
    CONSTRAINT lancamentos_origem_check CHECK ((origem = ANY (ARRAY['equipe'::text, 'link'::text, 'importacao'::text]))),
    CONSTRAINT lancamentos_valores_check CHECK ((jsonb_typeof(valores) = 'object'::text))
);


--
-- Name: marcos; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.marcos (
    indicador text NOT NULL,
    ano integer NOT NULL,
    valor numeric NOT NULL,
    exemplo boolean DEFAULT false NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT marcos_ano_check CHECK (((ano >= 2000) AND (ano <= 2100))),
    CONSTRAINT marcos_indicador_check CHECK ((indicador ~ '^[a-z0-9_]+$'::text))
);


--
-- Name: parametros; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.parametros (
    id boolean DEFAULT true NOT NULL,
    meses_primeira_entrevista integer DEFAULT 6 NOT NULL,
    validade_padrao_meses integer DEFAULT 24 NOT NULL,
    aviso_dias integer DEFAULT 30 NOT NULL,
    tipos_loja_dispensados text[] DEFAULT '{"Área Publicitária"}'::text[] NOT NULL,
    data_inauguracao text DEFAULT 'ativacao'::text NOT NULL,
    motivos_dispensa text[] DEFAULT '{"Contrato temporário","Ativação de marca",Outro}'::text[] NOT NULL,
    clube_formas text[] DEFAULT '{Pagante,"Contribui com resíduos","Engajado em ações","Certificado (selo)"}'::text[] NOT NULL,
    termo_validade_meses integer DEFAULT 12 NOT NULL,
    termo_aviso_dias integer DEFAULT 30 NOT NULL,
    formas_contribuicao text[] DEFAULT '{PIX,Dinheiro,Material,Serviço}'::text[] NOT NULL,
    tipos_acao text[] DEFAULT '{"Entrega de resíduos",Oficina,Evento,Outra}'::text[] NOT NULL,
    limite_ocupacao_pct integer DEFAULT 90 NOT NULL,
    recolhimento_setor_id uuid,
    rcc_empresas text[] DEFAULT '{}'::text[] NOT NULL,
    areas_impacto text[] DEFAULT '{Ambiental,Social,Turismo,"Economia local"}'::text[] NOT NULL,
    grupos_impacto text[] DEFAULT '{"Pessoas impactadas","Volume reciclado",Oficinas,"Produtores locais"}'::text[] NOT NULL,
    cobranca_dia integer DEFAULT 5 NOT NULL,
    unidades text[] DEFAULT '{"saco de 5 L","saco de 50 L","saco de 100 L","saco de 200 L",litros,kg}'::text[] NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_por uuid DEFAULT auth.uid(),
    CONSTRAINT parametros_aviso_dias_check CHECK ((aviso_dias >= 0)),
    CONSTRAINT parametros_cobranca_dia_check CHECK (((cobranca_dia >= 1) AND (cobranca_dia <= 28))),
    CONSTRAINT parametros_data_inauguracao_check CHECK ((data_inauguracao = ANY (ARRAY['ativacao'::text, 'inicio'::text]))),
    CONSTRAINT parametros_id_check CHECK (id),
    CONSTRAINT parametros_limite_ocupacao_pct_check CHECK (((limite_ocupacao_pct >= 1) AND (limite_ocupacao_pct <= 100))),
    CONSTRAINT parametros_meses_primeira_entrevista_check CHECK ((meses_primeira_entrevista >= 0)),
    CONSTRAINT parametros_termo_aviso_dias_check CHECK ((termo_aviso_dias >= 0)),
    CONSTRAINT parametros_termo_validade_meses_check CHECK ((termo_validade_meses > 0)),
    CONSTRAINT parametros_validade_padrao_meses_check CHECK ((validade_padrao_meses > 0))
);


--
-- Name: parametros_valores; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.parametros_valores (
    id boolean DEFAULT true NOT NULL,
    tour_custo_album numeric(14,2) DEFAULT 2.48 NOT NULL,
    tour_custo_copo numeric(14,2) DEFAULT 2.92 NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT parametros_valores_id_check CHECK (id),
    CONSTRAINT parametros_valores_tour_custo_album_check CHECK ((tour_custo_album >= (0)::numeric)),
    CONSTRAINT parametros_valores_tour_custo_copo_check CHECK ((tour_custo_copo >= (0)::numeric))
);


--
-- Name: participante_contatos; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.participante_contatos (
    participante_id uuid NOT NULL,
    email text,
    telefone text,
    contato text,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: participante_valores; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.participante_valores (
    participante_id uuid NOT NULL,
    valor_combinado_mes numeric(14,2) NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT participante_valores_valor_combinado_mes_check CHECK ((valor_combinado_mes >= (0)::numeric))
);


--
-- Name: participantes; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.participantes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_doc text NOT NULL,
    nome text NOT NULL,
    locatario_manual boolean DEFAULT false NOT NULL,
    formas text[] DEFAULT '{}'::text[] NOT NULL,
    saiu_em date,
    saiu_motivo text,
    interesse boolean DEFAULT false NOT NULL,
    exemplo boolean DEFAULT false NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT participantes_check CHECK (((saiu_em IS NULL) OR (saiu_motivo IS NOT NULL))),
    CONSTRAINT participantes_cliente_doc_check CHECK ((cliente_doc ~ '^\d{11}$|^\d{14}$'::text)),
    CONSTRAINT participantes_nome_check CHECK (((length(btrim(nome)) >= 1) AND (length(btrim(nome)) <= 200))),
    CONSTRAINT participantes_saiu_motivo_check CHECK ((length(saiu_motivo) <= 500))
);


--
-- Name: programa_contatos; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.programa_contatos (
    programa_id uuid NOT NULL,
    email text,
    telefone text,
    contato text,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: programa_indicadores; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.programa_indicadores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    programa_id uuid NOT NULL,
    nome text NOT NULL,
    formulario_id uuid NOT NULL,
    campo_id text,
    calculo text NOT NULL,
    filtro jsonb,
    percentual_valor text,
    unidade text,
    grupo text,
    mostrar_painel boolean DEFAULT false NOT NULL,
    em_reais boolean DEFAULT false NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT programa_indicadores_calculo_check CHECK ((calculo = ANY (ARRAY['soma'::text, 'contagem'::text, 'contagem_distintos'::text, 'media'::text, 'percentual'::text]))),
    CONSTRAINT programa_indicadores_check CHECK (((calculo = 'contagem'::text) OR (campo_id IS NOT NULL))),
    CONSTRAINT programa_indicadores_check1 CHECK (((calculo <> 'percentual'::text) OR (percentual_valor IS NOT NULL))),
    CONSTRAINT programa_indicadores_filtro_check CHECK (((filtro IS NULL) OR ((filtro ? 'campo_id'::text) AND (filtro ? 'valor'::text)))),
    CONSTRAINT programa_indicadores_nome_check CHECK (((length(btrim(nome)) >= 1) AND (length(btrim(nome)) <= 120)))
);


--
-- Name: programa_links; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.programa_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    programa_id uuid NOT NULL,
    token_hash text NOT NULL,
    criado_por uuid DEFAULT auth.uid(),
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    desligado_em timestamp with time zone,
    desligado_por uuid,
    ultimo_acesso_em timestamp with time zone,
    CONSTRAINT programa_links_token_hash_check CHECK ((token_hash ~ '^[0-9a-f]{64}$'::text))
);


--
-- Name: programas; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.programas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    descricao text,
    area text,
    parceiro_nome text,
    parceiro_doc text,
    inicio date,
    fim date,
    frequencia text DEFAULT 'mensal'::text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    exemplo boolean DEFAULT false NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT programas_check CHECK (((fim IS NULL) OR (inicio IS NULL) OR (fim >= inicio))),
    CONSTRAINT programas_frequencia_check CHECK ((frequencia = ANY (ARRAY['mensal'::text, 'evento'::text]))),
    CONSTRAINT programas_nome_check CHECK (((length(btrim(nome)) >= 1) AND (length(btrim(nome)) <= 120))),
    CONSTRAINT programas_parceiro_doc_check CHECK ((parceiro_doc ~ '^\d*$'::text))
);


--
-- Name: rcc_fatores; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.rcc_fatores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vigente_desde date NOT NULL,
    toneladas_por_cacamba numeric(8,3) NOT NULL,
    volume_m3 numeric(8,3) NOT NULL,
    criado_por uuid DEFAULT auth.uid(),
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rcc_fatores_toneladas_por_cacamba_check CHECK ((toneladas_por_cacamba > (0)::numeric)),
    CONSTRAINT rcc_fatores_volume_m3_check CHECK ((volume_m3 > (0)::numeric))
);


--
-- Name: rcc_nota_valores; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.rcc_nota_valores (
    nota_id uuid NOT NULL,
    valor_total numeric(14,2) NOT NULL,
    CONSTRAINT rcc_nota_valores_valor_total_check CHECK ((valor_total >= (0)::numeric))
);


--
-- Name: rcc_notas; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.rcc_notas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    competencia date NOT NULL,
    empresa text NOT NULL,
    numero text NOT NULL,
    pdf text NOT NULL,
    cacambas_a integer DEFAULT 0 NOT NULL,
    cacambas_b integer DEFAULT 0 NOT NULL,
    chamado_id uuid,
    lancado_por uuid DEFAULT auth.uid(),
    exemplo boolean DEFAULT false NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rcc_notas_cacambas_a_check CHECK ((cacambas_a >= 0)),
    CONSTRAINT rcc_notas_cacambas_b_check CHECK ((cacambas_b >= 0)),
    CONSTRAINT rcc_notas_check CHECK (((cacambas_a + cacambas_b) > 0)),
    CONSTRAINT rcc_notas_competencia_check CHECK ((EXTRACT(day FROM competencia) = (1)::numeric)),
    CONSTRAINT rcc_notas_empresa_check CHECK ((btrim(empresa) <> ''::text)),
    CONSTRAINT rcc_notas_numero_check CHECK ((btrim(numero) <> ''::text)),
    CONSTRAINT rcc_notas_pdf_check CHECK ((pdf ~~ 'rcc/%'::text))
);


--
-- Name: rcc_precos; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.rcc_precos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vigente_desde date NOT NULL,
    preco_a numeric(14,2) NOT NULL,
    preco_b numeric(14,2) NOT NULL,
    exemplo boolean DEFAULT false NOT NULL,
    criado_por uuid DEFAULT auth.uid(),
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rcc_precos_preco_a_check CHECK ((preco_a >= (0)::numeric)),
    CONSTRAINT rcc_precos_preco_b_check CHECK ((preco_b >= (0)::numeric))
);


--
-- Name: ronda_itens; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.ronda_itens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ronda_id uuid NOT NULL,
    coletor_id uuid NOT NULL,
    conteineres integer NOT NULL,
    ocupacao_pct integer NOT NULL,
    observacao text,
    foto text,
    CONSTRAINT ronda_itens_conteineres_check CHECK ((conteineres >= 0)),
    CONSTRAINT ronda_itens_foto_check CHECK ((foto ~~ 'rondas/%'::text)),
    CONSTRAINT ronda_itens_observacao_check CHECK ((length(observacao) <= 1000)),
    CONSTRAINT ronda_itens_ocupacao_pct_check CHECK ((((ocupacao_pct >= 0) AND (ocupacao_pct <= 100)) AND ((ocupacao_pct % 10) = 0)))
);


--
-- Name: rondas; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.rondas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    data_hora timestamp with time zone DEFAULT now() NOT NULL,
    chamado_id uuid,
    observacao text,
    foto text,
    lancado_por uuid DEFAULT auth.uid(),
    exemplo boolean DEFAULT false NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rondas_foto_check CHECK ((foto ~~ 'rondas/%'::text)),
    CONSTRAINT rondas_observacao_check CHECK ((length(observacao) <= 1000))
);


--
-- Name: setor_validades; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.setor_validades (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    setor text NOT NULL,
    meses integer NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT setor_validades_meses_check CHECK ((meses > 0)),
    CONSTRAINT setor_validades_setor_check CHECK ((btrim(setor) <> ''::text))
);


--
-- Name: termos; Type: TABLE; Schema: sustentabilidade; Owner: -
--

CREATE TABLE sustentabilidade.termos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    participante_id uuid NOT NULL,
    ano integer NOT NULL,
    assinado_em date NOT NULL,
    valido_ate date NOT NULL,
    arquivo text,
    assinatura text,
    chamado_id uuid,
    criado_por uuid DEFAULT auth.uid(),
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT termos_ano_check CHECK (((ano >= 2000) AND (ano <= 2100))),
    CONSTRAINT termos_check CHECK ((valido_ate >= assinado_em)),
    CONSTRAINT termos_check1 CHECK (((arquivo IS NULL) OR (arquivo ~~ (('clube/termos/'::text || participante_id) || '/%'::text)))),
    CONSTRAINT termos_check2 CHECK (((assinatura IS NULL) OR (assinatura ~~ (('clube/termos/'::text || participante_id) || '/%'::text))))
);


--
-- Name: itens itens_pkey; Type: CONSTRAINT; Schema: calendario; Owner: -
--

ALTER TABLE ONLY calendario.itens
    ADD CONSTRAINT itens_pkey PRIMARY KEY (id);


--
-- Name: tipos tipos_pkey; Type: CONSTRAINT; Schema: calendario; Owner: -
--

ALTER TABLE ONLY calendario.tipos
    ADD CONSTRAINT tipos_pkey PRIMARY KEY (id);


--
-- Name: censo_convites censo_convites_pkey; Type: CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.censo_convites
    ADD CONSTRAINT censo_convites_pkey PRIMARY KEY (id);


--
-- Name: censo_convites censo_convites_token_key; Type: CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.censo_convites
    ADD CONSTRAINT censo_convites_token_key UNIQUE (token);


--
-- Name: censo_respostas censo_respostas_convite_id_key; Type: CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.censo_respostas
    ADD CONSTRAINT censo_respostas_convite_id_key UNIQUE (convite_id);


--
-- Name: censo_respostas censo_respostas_pkey; Type: CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.censo_respostas
    ADD CONSTRAINT censo_respostas_pkey PRIMARY KEY (id);


--
-- Name: censo_rodadas censo_rodadas_pkey; Type: CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.censo_rodadas
    ADD CONSTRAINT censo_rodadas_pkey PRIMARY KEY (id);


--
-- Name: censo_sugestao_temas censo_sugestao_temas_pkey; Type: CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.censo_sugestao_temas
    ADD CONSTRAINT censo_sugestao_temas_pkey PRIMARY KEY (id);


--
-- Name: censo_temas censo_temas_pkey; Type: CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.censo_temas
    ADD CONSTRAINT censo_temas_pkey PRIMARY KEY (id);


--
-- Name: contatos contatos_pkey; Type: CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.contatos
    ADD CONSTRAINT contatos_pkey PRIMARY KEY (id);


--
-- Name: contrato_anexos contrato_anexos_pkey; Type: CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.contrato_anexos
    ADD CONSTRAINT contrato_anexos_pkey PRIMARY KEY (id);


--
-- Name: contrato_kit contrato_kit_pkey; Type: CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.contrato_kit
    ADD CONSTRAINT contrato_kit_pkey PRIMARY KEY (contrato_id, versao_id);


--
-- Name: contrato_versoes contrato_versoes_pkey; Type: CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.contrato_versoes
    ADD CONSTRAINT contrato_versoes_pkey PRIMARY KEY (id);


--
-- Name: contratos contratos_pkey; Type: CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.contratos
    ADD CONSTRAINT contratos_pkey PRIMARY KEY (id);


--
-- Name: faixas_evento faixas_evento_ordem_key; Type: CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.faixas_evento
    ADD CONSTRAINT faixas_evento_ordem_key UNIQUE (ordem);


--
-- Name: faixas_evento faixas_evento_pkey; Type: CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.faixas_evento
    ADD CONSTRAINT faixas_evento_pkey PRIMARY KEY (id);


--
-- Name: ficha_acessos ficha_acessos_pkey; Type: CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.ficha_acessos
    ADD CONSTRAINT ficha_acessos_pkey PRIMARY KEY (id);


--
-- Name: ficha_dados ficha_dados_pkey; Type: CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.ficha_dados
    ADD CONSTRAINT ficha_dados_pkey PRIMARY KEY (ficha_id);


--
-- Name: ficha_documentos ficha_documentos_pkey; Type: CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.ficha_documentos
    ADD CONSTRAINT ficha_documentos_pkey PRIMARY KEY (id);


--
-- Name: fichas fichas_pkey; Type: CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.fichas
    ADD CONSTRAINT fichas_pkey PRIMARY KEY (id);


--
-- Name: fichas fichas_token_key; Type: CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.fichas
    ADD CONSTRAINT fichas_token_key UNIQUE (token);


--
-- Name: fontes_de_para fontes_de_para_pkey; Type: CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.fontes_de_para
    ADD CONSTRAINT fontes_de_para_pkey PRIMARY KEY (fonte_rd);


--
-- Name: importacoes importacoes_pkey; Type: CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.importacoes
    ADD CONSTRAINT importacoes_pkey PRIMARY KEY (id);


--
-- Name: kit_documentos kit_documentos_pkey; Type: CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.kit_documentos
    ADD CONSTRAINT kit_documentos_pkey PRIMARY KEY (id);


--
-- Name: kit_versoes kit_versoes_pkey; Type: CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.kit_versoes
    ADD CONSTRAINT kit_versoes_pkey PRIMARY KEY (id);


--
-- Name: listas listas_pkey; Type: CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.listas
    ADD CONSTRAINT listas_pkey PRIMARY KEY (id);


--
-- Name: ocupacao_fotos ocupacao_fotos_pkey; Type: CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.ocupacao_fotos
    ADD CONSTRAINT ocupacao_fotos_pkey PRIMARY KEY (mes);


--
-- Name: parametros parametros_pkey; Type: CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.parametros
    ADD CONSTRAINT parametros_pkey PRIMARY KEY (id);


--
-- Name: pesquisa_imoveis pesquisa_imoveis_pkey; Type: CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.pesquisa_imoveis
    ADD CONSTRAINT pesquisa_imoveis_pkey PRIMARY KEY (id);


--
-- Name: propostas_evento propostas_evento_pkey; Type: CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.propostas_evento
    ADD CONSTRAINT propostas_evento_pkey PRIMARY KEY (id);


--
-- Name: rd_oportunidades rd_oportunidades_pkey; Type: CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.rd_oportunidades
    ADD CONSTRAINT rd_oportunidades_pkey PRIMARY KEY (id);


--
-- Name: tipos_luc tipos_luc_pkey; Type: CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.tipos_luc
    ADD CONSTRAINT tipos_luc_pkey PRIMARY KEY (tipo);


--
-- Name: auditoria auditoria_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.auditoria
    ADD CONSTRAINT auditoria_pkey PRIMARY KEY (id);


--
-- Name: cargo_permissoes cargo_permissoes_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cargo_permissoes
    ADD CONSTRAINT cargo_permissoes_pkey PRIMARY KEY (cargo_id, permissao);


--
-- Name: cargos cargos_nome_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cargos
    ADD CONSTRAINT cargos_nome_key UNIQUE (nome);


--
-- Name: cargos cargos_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cargos
    ADD CONSTRAINT cargos_pkey PRIMARY KEY (id);


--
-- Name: empresa empresa_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresa
    ADD CONSTRAINT empresa_pkey PRIMARY KEY (id);


--
-- Name: importacoes importacoes_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.importacoes
    ADD CONSTRAINT importacoes_pkey PRIMARY KEY (id);


--
-- Name: logs logs_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.logs
    ADD CONSTRAINT logs_pkey PRIMARY KEY (id);


--
-- Name: metas metas_indicador_vigente_desde_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.metas
    ADD CONSTRAINT metas_indicador_vigente_desde_key UNIQUE (indicador, vigente_desde);


--
-- Name: metas metas_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.metas
    ADD CONSTRAINT metas_pkey PRIMARY KEY (id);


--
-- Name: permissoes permissoes_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.permissoes
    ADD CONSTRAINT permissoes_pkey PRIMARY KEY (codigo);


--
-- Name: preferencias preferencias_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.preferencias
    ADD CONSTRAINT preferencias_pkey PRIMARY KEY (usuario_id, chave);


--
-- Name: usuario_permissoes usuario_permissoes_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.usuario_permissoes
    ADD CONSTRAINT usuario_permissoes_pkey PRIMARY KEY (usuario_id, permissao);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: estacionamento_movimento estacionamento_movimento_pkey; Type: CONSTRAINT; Schema: financeiro; Owner: -
--

ALTER TABLE ONLY financeiro.estacionamento_movimento
    ADD CONSTRAINT estacionamento_movimento_pkey PRIMARY KEY (estacionamento_id, data, tipo_veiculo);


--
-- Name: estacionamento_pagamentos estacionamento_pagamentos_pkey; Type: CONSTRAINT; Schema: financeiro; Owner: -
--

ALTER TABLE ONLY financeiro.estacionamento_pagamentos
    ADD CONSTRAINT estacionamento_pagamentos_pkey PRIMARY KEY (estacionamento_id, wps_codigo);


--
-- Name: formularios formularios_pkey; Type: CONSTRAINT; Schema: formularios; Owner: -
--

ALTER TABLE ONLY formularios.formularios
    ADD CONSTRAINT formularios_pkey PRIMARY KEY (id);


--
-- Name: formularios formularios_token_key; Type: CONSTRAINT; Schema: formularios; Owner: -
--

ALTER TABLE ONLY formularios.formularios
    ADD CONSTRAINT formularios_token_key UNIQUE (token);


--
-- Name: respostas respostas_pkey; Type: CONSTRAINT; Schema: formularios; Owner: -
--

ALTER TABLE ONLY formularios.respostas
    ADD CONSTRAINT respostas_pkey PRIMARY KEY (id);


--
-- Name: camera_contagens camera_contagens_pkey; Type: CONSTRAINT; Schema: integracao; Owner: -
--

ALTER TABLE ONLY integracao.camera_contagens
    ADD CONSTRAINT camera_contagens_pkey PRIMARY KEY (deviceid, inicio);


--
-- Name: cameras cameras_pkey; Type: CONSTRAINT; Schema: integracao; Owner: -
--

ALTER TABLE ONLY integracao.cameras
    ADD CONSTRAINT cameras_pkey PRIMARY KEY (deviceid);


--
-- Name: credenciais credenciais_pkey; Type: CONSTRAINT; Schema: integracao; Owner: -
--

ALTER TABLE ONLY integracao.credenciais
    ADD CONSTRAINT credenciais_pkey PRIMARY KEY (sistema);


--
-- Name: cursores cursores_pkey; Type: CONSTRAINT; Schema: integracao; Owner: -
--

ALTER TABLE ONLY integracao.cursores
    ADD CONSTRAINT cursores_pkey PRIMARY KEY (sistema, recurso);


--
-- Name: registros_brutos registros_brutos_pkey; Type: CONSTRAINT; Schema: integracao; Owner: -
--

ALTER TABLE ONLY integracao.registros_brutos
    ADD CONSTRAINT registros_brutos_pkey PRIMARY KEY (sistema, recurso, chave_externa);


--
-- Name: sync_runs sync_runs_pkey; Type: CONSTRAINT; Schema: integracao; Owner: -
--

ALTER TABLE ONLY integracao.sync_runs
    ADD CONSTRAINT sync_runs_pkey PRIMARY KEY (id);


--
-- Name: benchmark benchmark_pkey; Type: CONSTRAINT; Schema: marketing; Owner: -
--

ALTER TABLE ONLY marketing.benchmark
    ADD CONSTRAINT benchmark_pkey PRIMARY KEY (id);


--
-- Name: landing_pages landing_pages_pkey; Type: CONSTRAINT; Schema: marketing; Owner: -
--

ALTER TABLE ONLY marketing.landing_pages
    ADD CONSTRAINT landing_pages_pkey PRIMARY KEY (identificador);


--
-- Name: locatarios locatarios_pkey; Type: CONSTRAINT; Schema: marketing; Owner: -
--

ALTER TABLE ONLY marketing.locatarios
    ADD CONSTRAINT locatarios_pkey PRIMARY KEY (id);


--
-- Name: marca_arquivos marca_arquivos_grupo_versao_key; Type: CONSTRAINT; Schema: marketing; Owner: -
--

ALTER TABLE ONLY marketing.marca_arquivos
    ADD CONSTRAINT marca_arquivos_grupo_versao_key UNIQUE (grupo, versao);


--
-- Name: marca_arquivos marca_arquivos_pkey; Type: CONSTRAINT; Schema: marketing; Owner: -
--

ALTER TABLE ONLY marketing.marca_arquivos
    ADD CONSTRAINT marca_arquivos_pkey PRIMARY KEY (id);


--
-- Name: marca_blocos marca_blocos_pkey; Type: CONSTRAINT; Schema: marketing; Owner: -
--

ALTER TABLE ONLY marketing.marca_blocos
    ADD CONSTRAINT marca_blocos_pkey PRIMARY KEY (chave);


--
-- Name: marca_versoes marca_versoes_bloco_versao_key; Type: CONSTRAINT; Schema: marketing; Owner: -
--

ALTER TABLE ONLY marketing.marca_versoes
    ADD CONSTRAINT marca_versoes_bloco_versao_key UNIQUE (bloco, versao);


--
-- Name: marca_versoes marca_versoes_pkey; Type: CONSTRAINT; Schema: marketing; Owner: -
--

ALTER TABLE ONLY marketing.marca_versoes
    ADD CONSTRAINT marca_versoes_pkey PRIMARY KEY (id);


--
-- Name: parametros parametros_pkey; Type: CONSTRAINT; Schema: marketing; Owner: -
--

ALTER TABLE ONLY marketing.parametros
    ADD CONSTRAINT parametros_pkey PRIMARY KEY (id);


--
-- Name: rd_contatos rd_contatos_pkey; Type: CONSTRAINT; Schema: marketing; Owner: -
--

ALTER TABLE ONLY marketing.rd_contatos
    ADD CONSTRAINT rd_contatos_pkey PRIMARY KEY (uuid);


--
-- Name: rd_conversoes rd_conversoes_pkey; Type: CONSTRAINT; Schema: marketing; Owner: -
--

ALTER TABLE ONLY marketing.rd_conversoes
    ADD CONSTRAINT rd_conversoes_pkey PRIMARY KEY (id);


--
-- Name: rd_landing_pages_dia rd_landing_pages_dia_pkey; Type: CONSTRAINT; Schema: marketing; Owner: -
--

ALTER TABLE ONLY marketing.rd_landing_pages_dia
    ADD CONSTRAINT rd_landing_pages_dia_pkey PRIMARY KEY (identificador, dia);


--
-- Name: redes_dia redes_dia_pkey; Type: CONSTRAINT; Schema: marketing; Owner: -
--

ALTER TABLE ONLY marketing.redes_dia
    ADD CONSTRAINT redes_dia_pkey PRIMARY KEY (rede, dia);


--
-- Name: regras_alerta regras_alerta_pkey; Type: CONSTRAINT; Schema: marketing; Owner: -
--

ALTER TABLE ONLY marketing.regras_alerta
    ADD CONSTRAINT regras_alerta_pkey PRIMARY KEY (regra);


--
-- Name: ronda_codigos ronda_codigos_pkey; Type: CONSTRAINT; Schema: marketing; Owner: -
--

ALTER TABLE ONLY marketing.ronda_codigos
    ADD CONSTRAINT ronda_codigos_pkey PRIMARY KEY (codigo);


--
-- Name: temas temas_pkey; Type: CONSTRAINT; Schema: marketing; Owner: -
--

ALTER TABLE ONLY marketing.temas
    ADD CONSTRAINT temas_pkey PRIMARY KEY (id);


--
-- Name: agua_contas agua_contas_pkey; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.agua_contas
    ADD CONSTRAINT agua_contas_pkey PRIMARY KEY (id);


--
-- Name: agua_leituras agua_leituras_pkey; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.agua_leituras
    ADD CONSTRAINT agua_leituras_pkey PRIMARY KEY (id);


--
-- Name: agua_valores agua_valores_pkey; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.agua_valores
    ADD CONSTRAINT agua_valores_pkey PRIMARY KEY (leitura_id);


--
-- Name: agua_vinculos agua_vinculos_hidrometro_desde_key; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.agua_vinculos
    ADD CONSTRAINT agua_vinculos_hidrometro_desde_key UNIQUE (hidrometro, desde);


--
-- Name: agua_vinculos agua_vinculos_pkey; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.agua_vinculos
    ADD CONSTRAINT agua_vinculos_pkey PRIMARY KEY (id);


--
-- Name: caixa_ocupantes caixa_ocupantes_pkey; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.caixa_ocupantes
    ADD CONSTRAINT caixa_ocupantes_pkey PRIMARY KEY (id);


--
-- Name: caixas caixas_pkey; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.caixas
    ADD CONSTRAINT caixas_pkey PRIMARY KEY (id);


--
-- Name: caixas caixas_quadro_id_numero_key; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.caixas
    ADD CONSTRAINT caixas_quadro_id_numero_key UNIQUE (quadro_id, numero);


--
-- Name: diario_cadastros diario_cadastros_pkey; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.diario_cadastros
    ADD CONSTRAINT diario_cadastros_pkey PRIMARY KEY (id);


--
-- Name: diario_obras diario_obras_pkey; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.diario_obras
    ADD CONSTRAINT diario_obras_pkey PRIMARY KEY (id);


--
-- Name: diario_relatorios diario_relatorios_pkey; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.diario_relatorios
    ADD CONSTRAINT diario_relatorios_pkey PRIMARY KEY (id);


--
-- Name: energia_fatura_itens energia_fatura_itens_pkey; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.energia_fatura_itens
    ADD CONSTRAINT energia_fatura_itens_pkey PRIMARY KEY (id);


--
-- Name: energia_faturas energia_faturas_matricula_referencia_key; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.energia_faturas
    ADD CONSTRAINT energia_faturas_matricula_referencia_key UNIQUE (matricula, referencia);


--
-- Name: energia_faturas energia_faturas_pkey; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.energia_faturas
    ADD CONSTRAINT energia_faturas_pkey PRIMARY KEY (id);


--
-- Name: energia_faturas energia_faturas_sha256_key; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.energia_faturas
    ADD CONSTRAINT energia_faturas_sha256_key UNIQUE (sha256);


--
-- Name: energia_unidades energia_unidades_pkey; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.energia_unidades
    ADD CONSTRAINT energia_unidades_pkey PRIMARY KEY (matricula);


--
-- Name: hidrometros hidrometros_numero_key; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.hidrometros
    ADD CONSTRAINT hidrometros_numero_key UNIQUE (numero);


--
-- Name: hidrometros hidrometros_pkey; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.hidrometros
    ADD CONSTRAINT hidrometros_pkey PRIMARY KEY (id);


--
-- Name: importacao_valores importacao_valores_pkey; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.importacao_valores
    ADD CONSTRAINT importacao_valores_pkey PRIMARY KEY (importacao_id);


--
-- Name: importacoes importacoes_pkey; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.importacoes
    ADD CONSTRAINT importacoes_pkey PRIMARY KEY (id);


--
-- Name: limpeza_anexos limpeza_anexos_pkey; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.limpeza_anexos
    ADD CONSTRAINT limpeza_anexos_pkey PRIMARY KEY (id);


--
-- Name: limpeza_contrato limpeza_contrato_pkey; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.limpeza_contrato
    ADD CONSTRAINT limpeza_contrato_pkey PRIMARY KEY (id);


--
-- Name: limpeza_equipe limpeza_equipe_pkey; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.limpeza_equipe
    ADD CONSTRAINT limpeza_equipe_pkey PRIMARY KEY (id);


--
-- Name: limpeza_extras limpeza_extras_pkey; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.limpeza_extras
    ADD CONSTRAINT limpeza_extras_pkey PRIMARY KEY (id);


--
-- Name: limpeza_meses limpeza_meses_pkey; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.limpeza_meses
    ADD CONSTRAINT limpeza_meses_pkey PRIMARY KEY (referencia);


--
-- Name: limpeza_minutos limpeza_minutos_pkey; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.limpeza_minutos
    ADD CONSTRAINT limpeza_minutos_pkey PRIMARY KEY (referencia, bloco);


--
-- Name: obra_realizado obra_realizado_pkey; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.obra_realizado
    ADD CONSTRAINT obra_realizado_pkey PRIMARY KEY (id);


--
-- Name: obras obras_pkey; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.obras
    ADD CONSTRAINT obras_pkey PRIMARY KEY (id);


--
-- Name: orcamento_etapas orcamento_etapas_pkey; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.orcamento_etapas
    ADD CONSTRAINT orcamento_etapas_pkey PRIMARY KEY (id);


--
-- Name: orcamento_etapas orcamento_etapas_revisao_id_ordem_key; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.orcamento_etapas
    ADD CONSTRAINT orcamento_etapas_revisao_id_ordem_key UNIQUE (revisao_id, ordem);


--
-- Name: orcamento_previsto orcamento_previsto_pkey; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.orcamento_previsto
    ADD CONSTRAINT orcamento_previsto_pkey PRIMARY KEY (etapa_id, mes);


--
-- Name: orcamento_revisoes orcamento_revisoes_obra_id_codigo_key; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.orcamento_revisoes
    ADD CONSTRAINT orcamento_revisoes_obra_id_codigo_key UNIQUE (obra_id, codigo);


--
-- Name: orcamento_revisoes orcamento_revisoes_pkey; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.orcamento_revisoes
    ADD CONSTRAINT orcamento_revisoes_pkey PRIMARY KEY (id);


--
-- Name: parametros parametros_pkey; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.parametros
    ADD CONSTRAINT parametros_pkey PRIMARY KEY (id);


--
-- Name: quadros quadros_codigo_key; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.quadros
    ADD CONSTRAINT quadros_codigo_key UNIQUE (codigo);


--
-- Name: quadros quadros_pkey; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.quadros
    ADD CONSTRAINT quadros_pkey PRIMARY KEY (id);


--
-- Name: salas salas_codigo_key; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.salas
    ADD CONSTRAINT salas_codigo_key UNIQUE (codigo);


--
-- Name: salas salas_pkey; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.salas
    ADD CONSTRAINT salas_pkey PRIMARY KEY (id);


--
-- Name: termos termos_caixa_id_versao_key; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.termos
    ADD CONSTRAINT termos_caixa_id_versao_key UNIQUE (caixa_id, versao);


--
-- Name: termos termos_pkey; Type: CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.termos
    ADD CONSTRAINT termos_pkey PRIMARY KEY (id);


--
-- Name: agenda_bloqueios agenda_bloqueios_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.agenda_bloqueios
    ADD CONSTRAINT agenda_bloqueios_pkey PRIMARY KEY (id);


--
-- Name: agendamentos agendamentos_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.agendamentos
    ADD CONSTRAINT agendamentos_pkey PRIMARY KEY (id);


--
-- Name: agendas agendas_nome_key; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.agendas
    ADD CONSTRAINT agendas_nome_key UNIQUE (nome);


--
-- Name: agendas agendas_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.agendas
    ADD CONSTRAINT agendas_pkey PRIMARY KEY (id);


--
-- Name: anexos anexos_path_key; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.anexos
    ADD CONSTRAINT anexos_path_key UNIQUE (path);


--
-- Name: anexos anexos_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.anexos
    ADD CONSTRAINT anexos_pkey PRIMARY KEY (id);


--
-- Name: ativo_categorias ativo_categorias_nome_key; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ativo_categorias
    ADD CONSTRAINT ativo_categorias_nome_key UNIQUE (nome);


--
-- Name: ativo_categorias ativo_categorias_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ativo_categorias
    ADD CONSTRAINT ativo_categorias_pkey PRIMARY KEY (id);


--
-- Name: ativo_saidas ativo_saidas_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ativo_saidas
    ADD CONSTRAINT ativo_saidas_pkey PRIMARY KEY (id);


--
-- Name: ativo_situacoes ativo_situacoes_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ativo_situacoes
    ADD CONSTRAINT ativo_situacoes_pkey PRIMARY KEY (id);


--
-- Name: ativos ativos_codigo_key; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ativos
    ADD CONSTRAINT ativos_codigo_key UNIQUE (codigo);


--
-- Name: ativos ativos_legado_id_key; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ativos
    ADD CONSTRAINT ativos_legado_id_key UNIQUE (legado_id);


--
-- Name: ativos ativos_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ativos
    ADD CONSTRAINT ativos_pkey PRIMARY KEY (id);


--
-- Name: categorias categorias_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.categorias
    ADD CONSTRAINT categorias_pkey PRIMARY KEY (id);


--
-- Name: categorias categorias_setor_id_pai_id_nome_key; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.categorias
    ADD CONSTRAINT categorias_setor_id_pai_id_nome_key UNIQUE NULLS NOT DISTINCT (setor_id, pai_id, nome);


--
-- Name: ordem_profissionais chamado_profissionais_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ordem_profissionais
    ADD CONSTRAINT chamado_profissionais_pkey PRIMARY KEY (ordem_id, profissional_id);


--
-- Name: chamados chamados_legado_origem_legado_id_key; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.chamados
    ADD CONSTRAINT chamados_legado_origem_legado_id_key UNIQUE (legado_origem, legado_id);


--
-- Name: chamados chamados_numero_key; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.chamados
    ADD CONSTRAINT chamados_numero_key UNIQUE (numero);


--
-- Name: chamados chamados_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.chamados
    ADD CONSTRAINT chamados_pkey PRIMARY KEY (id);


--
-- Name: chamados chamados_serie_id_serie_data_key; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.chamados
    ADD CONSTRAINT chamados_serie_id_serie_data_key UNIQUE (serie_id, serie_data);


--
-- Name: contatos contatos_legado_id_key; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.contatos
    ADD CONSTRAINT contatos_legado_id_key UNIQUE (legado_id);


--
-- Name: contatos contatos_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.contatos
    ADD CONSTRAINT contatos_pkey PRIMARY KEY (id);


--
-- Name: destinatarios destinatarios_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.destinatarios
    ADD CONSTRAINT destinatarios_pkey PRIMARY KEY (id);


--
-- Name: disparos disparos_modelo_id_loja_id_key; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.disparos
    ADD CONSTRAINT disparos_modelo_id_loja_id_key UNIQUE (modelo_id, loja_id);


--
-- Name: disparos disparos_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.disparos
    ADD CONSTRAINT disparos_pkey PRIMARY KEY (id);


--
-- Name: empresas empresas_legado_id_key; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.empresas
    ADD CONSTRAINT empresas_legado_id_key UNIQUE (legado_id);


--
-- Name: empresas empresas_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.empresas
    ADD CONSTRAINT empresas_pkey PRIMARY KEY (id);


--
-- Name: eventos eventos_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.eventos
    ADD CONSTRAINT eventos_pkey PRIMARY KEY (id);


--
-- Name: feriados feriados_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.feriados
    ADD CONSTRAINT feriados_pkey PRIMARY KEY (data);


--
-- Name: leituras leituras_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.leituras
    ADD CONSTRAINT leituras_pkey PRIMARY KEY (chamado_id, usuario_id);


--
-- Name: lojas lojas_enet_id_key; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.lojas
    ADD CONSTRAINT lojas_enet_id_key UNIQUE (enet_id);


--
-- Name: lojas lojas_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.lojas
    ADD CONSTRAINT lojas_pkey PRIMARY KEY (id);


--
-- Name: materiais materiais_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.materiais
    ADD CONSTRAINT materiais_pkey PRIMARY KEY (id);


--
-- Name: material_valores material_valores_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.material_valores
    ADD CONSTRAINT material_valores_pkey PRIMARY KEY (material_id);


--
-- Name: metas metas_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.metas
    ADD CONSTRAINT metas_pkey PRIMARY KEY (id);


--
-- Name: metas metas_setor_id_categoria_id_indicador_key; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.metas
    ADD CONSTRAINT metas_setor_id_categoria_id_indicador_key UNIQUE NULLS NOT DISTINCT (setor_id, categoria_id, indicador);


--
-- Name: modelo_itens modelo_itens_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.modelo_itens
    ADD CONSTRAINT modelo_itens_pkey PRIMARY KEY (id);


--
-- Name: modelos modelos_nome_key; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.modelos
    ADD CONSTRAINT modelos_nome_key UNIQUE (nome);


--
-- Name: modelos modelos_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.modelos
    ADD CONSTRAINT modelos_pkey PRIMARY KEY (id);


--
-- Name: notificacoes notificacoes_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.notificacoes
    ADD CONSTRAINT notificacoes_pkey PRIMARY KEY (id);


--
-- Name: notificacoes notificacoes_usuario_id_chave_key; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.notificacoes
    ADD CONSTRAINT notificacoes_usuario_id_chave_key UNIQUE (usuario_id, chave);


--
-- Name: ordens ordens_legado_origem_legado_id_key; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ordens
    ADD CONSTRAINT ordens_legado_origem_legado_id_key UNIQUE (legado_origem, legado_id);


--
-- Name: ordens ordens_numero_key; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ordens
    ADD CONSTRAINT ordens_numero_key UNIQUE (numero);


--
-- Name: ordens ordens_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ordens
    ADD CONSTRAINT ordens_pkey PRIMARY KEY (id);


--
-- Name: ordens ordens_plano_id_plano_data_key; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ordens
    ADD CONSTRAINT ordens_plano_id_plano_data_key UNIQUE (plano_id, plano_data);


--
-- Name: ordens ordens_serie_id_serie_data_key; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ordens
    ADD CONSTRAINT ordens_serie_id_serie_data_key UNIQUE (serie_id, serie_data);


--
-- Name: os_custos os_custos_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.os_custos
    ADD CONSTRAINT os_custos_pkey PRIMARY KEY (ordem_id);


--
-- Name: parametros parametros_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.parametros
    ADD CONSTRAINT parametros_pkey PRIMARY KEY (id);


--
-- Name: participantes participantes_chamado_usuario; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.participantes
    ADD CONSTRAINT participantes_chamado_usuario UNIQUE (chamado_id, usuario_id);


--
-- Name: participantes participantes_ordem_usuario; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.participantes
    ADD CONSTRAINT participantes_ordem_usuario UNIQUE (ordem_id, usuario_id);


--
-- Name: participantes participantes_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.participantes
    ADD CONSTRAINT participantes_pkey PRIMARY KEY (id);


--
-- Name: planos_preventivos planos_preventivos_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.planos_preventivos
    ADD CONSTRAINT planos_preventivos_pkey PRIMARY KEY (id);


--
-- Name: portal_links portal_links_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.portal_links
    ADD CONSTRAINT portal_links_pkey PRIMARY KEY (id);


--
-- Name: portal_links portal_links_token_key; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.portal_links
    ADD CONSTRAINT portal_links_token_key UNIQUE (token);


--
-- Name: portal_sessoes portal_sessoes_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.portal_sessoes
    ADD CONSTRAINT portal_sessoes_pkey PRIMARY KEY (id);


--
-- Name: portal_sessoes portal_sessoes_token_key; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.portal_sessoes
    ADD CONSTRAINT portal_sessoes_token_key UNIQUE (token);


--
-- Name: portal_tentativas portal_tentativas_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.portal_tentativas
    ADD CONSTRAINT portal_tentativas_pkey PRIMARY KEY (id);


--
-- Name: profissionais profissionais_legado_id_key; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.profissionais
    ADD CONSTRAINT profissionais_legado_id_key UNIQUE (legado_id);


--
-- Name: profissionais profissionais_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.profissionais
    ADD CONSTRAINT profissionais_pkey PRIMARY KEY (id);


--
-- Name: sessao_tecnicos sessao_tecnicos_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.sessao_tecnicos
    ADD CONSTRAINT sessao_tecnicos_pkey PRIMARY KEY (sessao_id, tecnico_id);


--
-- Name: sessoes sessoes_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.sessoes
    ADD CONSTRAINT sessoes_pkey PRIMARY KEY (id);


--
-- Name: setor_membros setor_membros_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.setor_membros
    ADD CONSTRAINT setor_membros_pkey PRIMARY KEY (setor_id, usuario_id);


--
-- Name: setores setores_nome_key; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.setores
    ADD CONSTRAINT setores_nome_key UNIQUE (nome);


--
-- Name: setores setores_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.setores
    ADD CONSTRAINT setores_pkey PRIMARY KEY (id);


--
-- Name: tecnico_valores tecnico_valores_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.tecnico_valores
    ADD CONSTRAINT tecnico_valores_pkey PRIMARY KEY (id);


--
-- Name: tecnico_valores tecnico_valores_tecnico_id_vigente_desde_key; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.tecnico_valores
    ADD CONSTRAINT tecnico_valores_tecnico_id_vigente_desde_key UNIQUE (tecnico_id, vigente_desde);


--
-- Name: tecnicos tecnicos_legado_id_key; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.tecnicos
    ADD CONSTRAINT tecnicos_legado_id_key UNIQUE (legado_id);


--
-- Name: tecnicos tecnicos_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.tecnicos
    ADD CONSTRAINT tecnicos_pkey PRIMARY KEY (id);


--
-- Name: tecnicos tecnicos_usuario_id_key; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.tecnicos
    ADD CONSTRAINT tecnicos_usuario_id_key UNIQUE (usuario_id);


--
-- Name: terceirizado_links terceirizado_links_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.terceirizado_links
    ADD CONSTRAINT terceirizado_links_pkey PRIMARY KEY (id);


--
-- Name: terceirizado_links terceirizado_links_token_key; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.terceirizado_links
    ADD CONSTRAINT terceirizado_links_token_key UNIQUE (token);


--
-- Name: vistoria_ambientes vistoria_ambientes_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.vistoria_ambientes
    ADD CONSTRAINT vistoria_ambientes_pkey PRIMARY KEY (id);


--
-- Name: vistorias vistorias_assinatura_token_key; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.vistorias
    ADD CONSTRAINT vistorias_assinatura_token_key UNIQUE (assinatura_token);


--
-- Name: vistorias vistorias_codigo_key; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.vistorias
    ADD CONSTRAINT vistorias_codigo_key UNIQUE (codigo);


--
-- Name: vistorias vistorias_legado_id_key; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.vistorias
    ADD CONSTRAINT vistorias_legado_id_key UNIQUE (legado_id);


--
-- Name: vistorias vistorias_pkey; Type: CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.vistorias
    ADD CONSTRAINT vistorias_pkey PRIMARY KEY (id);


--
-- Name: afastamentos afastamentos_colaborador_id_inicio_justificativa_key; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.afastamentos
    ADD CONSTRAINT afastamentos_colaborador_id_inicio_justificativa_key UNIQUE NULLS NOT DISTINCT (colaborador_id, inicio, justificativa);


--
-- Name: afastamentos afastamentos_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.afastamentos
    ADD CONSTRAINT afastamentos_pkey PRIMARY KEY (id);


--
-- Name: afastamentos afastamentos_secullum_id_key; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.afastamentos
    ADD CONSTRAINT afastamentos_secullum_id_key UNIQUE (secullum_id);


--
-- Name: banco_horas_ciclos banco_horas_ciclos_inicio_key; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.banco_horas_ciclos
    ADD CONSTRAINT banco_horas_ciclos_inicio_key UNIQUE (inicio);


--
-- Name: banco_horas_ciclos banco_horas_ciclos_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.banco_horas_ciclos
    ADD CONSTRAINT banco_horas_ciclos_pkey PRIMARY KEY (id);


--
-- Name: banco_horas_fechamentos banco_horas_fechamentos_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.banco_horas_fechamentos
    ADD CONSTRAINT banco_horas_fechamentos_pkey PRIMARY KEY (ciclo_id, colaborador_id);


--
-- Name: beneficio_contratos beneficio_contratos_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.beneficio_contratos
    ADD CONSTRAINT beneficio_contratos_pkey PRIMARY KEY (id);


--
-- Name: beneficio_totais_mensais beneficio_totais_mensais_beneficio_id_competencia_key; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.beneficio_totais_mensais
    ADD CONSTRAINT beneficio_totais_mensais_beneficio_id_competencia_key UNIQUE (beneficio_id, competencia);


--
-- Name: beneficio_totais_mensais beneficio_totais_mensais_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.beneficio_totais_mensais
    ADD CONSTRAINT beneficio_totais_mensais_pkey PRIMARY KEY (id);


--
-- Name: beneficio_valores_mensais beneficio_valores_mensais_beneficio_id_colaborador_id_compe_key; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.beneficio_valores_mensais
    ADD CONSTRAINT beneficio_valores_mensais_beneficio_id_colaborador_id_compe_key UNIQUE (beneficio_id, colaborador_id, competencia);


--
-- Name: beneficio_valores_mensais beneficio_valores_mensais_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.beneficio_valores_mensais
    ADD CONSTRAINT beneficio_valores_mensais_pkey PRIMARY KEY (id);


--
-- Name: beneficios beneficios_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.beneficios
    ADD CONSTRAINT beneficios_pkey PRIMARY KEY (id);


--
-- Name: cargos cargos_codigo_folha_key; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.cargos
    ADD CONSTRAINT cargos_codigo_folha_key UNIQUE (codigo_folha);


--
-- Name: cargos cargos_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.cargos
    ADD CONSTRAINT cargos_pkey PRIMARY KEY (id);


--
-- Name: categorias_gasto categorias_gasto_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.categorias_gasto
    ADD CONSTRAINT categorias_gasto_pkey PRIMARY KEY (id);


--
-- Name: colaborador_beneficios colaborador_beneficios_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.colaborador_beneficios
    ADD CONSTRAINT colaborador_beneficios_pkey PRIMARY KEY (id);


--
-- Name: colaboradores colaboradores_copiloto_id_key; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.colaboradores
    ADD CONSTRAINT colaboradores_copiloto_id_key UNIQUE (copiloto_id);


--
-- Name: colaboradores colaboradores_matricula_key; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.colaboradores
    ADD CONSTRAINT colaboradores_matricula_key UNIQUE (matricula);


--
-- Name: colaboradores colaboradores_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.colaboradores
    ADD CONSTRAINT colaboradores_pkey PRIMARY KEY (id);


--
-- Name: colaboradores colaboradores_secullum_id_key; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.colaboradores
    ADD CONSTRAINT colaboradores_secullum_id_key UNIQUE (secullum_id);


--
-- Name: custos_colaborador custos_colaborador_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.custos_colaborador
    ADD CONSTRAINT custos_colaborador_pkey PRIMARY KEY (competencia, colaborador_id);


--
-- Name: dados_financeiros_mensais dados_financeiros_mensais_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.dados_financeiros_mensais
    ADD CONSTRAINT dados_financeiros_mensais_pkey PRIMARY KEY (competencia);


--
-- Name: departamentos departamentos_codigo_folha_key; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.departamentos
    ADD CONSTRAINT departamentos_codigo_folha_key UNIQUE (codigo_folha);


--
-- Name: departamentos departamentos_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.departamentos
    ADD CONSTRAINT departamentos_pkey PRIMARY KEY (id);


--
-- Name: departamentos departamentos_secullum_id_key; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.departamentos
    ADD CONSTRAINT departamentos_secullum_id_key UNIQUE (secullum_id);


--
-- Name: dependentes dependentes_copiloto_id_key; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.dependentes
    ADD CONSTRAINT dependentes_copiloto_id_key UNIQUE (copiloto_id);


--
-- Name: dependentes dependentes_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.dependentes
    ADD CONSTRAINT dependentes_pkey PRIMARY KEY (id);


--
-- Name: encargos_por_contrato encargos_por_contrato_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.encargos_por_contrato
    ADD CONSTRAINT encargos_por_contrato_pkey PRIMARY KEY (tipo_contrato, vigente_desde);


--
-- Name: folha_colaboradores folha_colaboradores_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.folha_colaboradores
    ADD CONSTRAINT folha_colaboradores_pkey PRIMARY KEY (folha_id, colaborador_id);


--
-- Name: folha_rubricas folha_rubricas_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.folha_rubricas
    ADD CONSTRAINT folha_rubricas_pkey PRIMARY KEY (id);


--
-- Name: folhas folhas_competencia_key; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.folhas
    ADD CONSTRAINT folhas_competencia_key UNIQUE (competencia);


--
-- Name: folhas folhas_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.folhas
    ADD CONSTRAINT folhas_pkey PRIMARY KEY (id);


--
-- Name: gastos gastos_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.gastos
    ADD CONSTRAINT gastos_pkey PRIMARY KEY (id);


--
-- Name: jornadas jornadas_departamento_id_cargo_id_colaborador_id_vigente_de_key; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.jornadas
    ADD CONSTRAINT jornadas_departamento_id_cargo_id_colaborador_id_vigente_de_key UNIQUE NULLS NOT DISTINCT (departamento_id, cargo_id, colaborador_id, vigente_desde);


--
-- Name: jornadas jornadas_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.jornadas
    ADD CONSTRAINT jornadas_pkey PRIMARY KEY (id);


--
-- Name: motivos_desligamento motivos_desligamento_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.motivos_desligamento
    ADD CONSTRAINT motivos_desligamento_pkey PRIMARY KEY (id);


--
-- Name: motivos_desligamento motivos_desligamento_secullum_id_key; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.motivos_desligamento
    ADD CONSTRAINT motivos_desligamento_secullum_id_key UNIQUE (secullum_id);


--
-- Name: notas_pj notas_pj_competencia_colaborador_id_numero_documento_key; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.notas_pj
    ADD CONSTRAINT notas_pj_competencia_colaborador_id_numero_documento_key UNIQUE (competencia, colaborador_id, numero_documento);


--
-- Name: notas_pj notas_pj_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.notas_pj
    ADD CONSTRAINT notas_pj_pkey PRIMARY KEY (id);


--
-- Name: orcamentos_anuais orcamentos_anuais_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.orcamentos_anuais
    ADD CONSTRAINT orcamentos_anuais_pkey PRIMARY KEY (ano);


--
-- Name: parametros_empresa parametros_empresa_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.parametros_empresa
    ADD CONSTRAINT parametros_empresa_pkey PRIMARY KEY (vigente_desde);


--
-- Name: parametros_turnover parametros_turnover_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.parametros_turnover
    ADD CONSTRAINT parametros_turnover_pkey PRIMARY KEY (id);


--
-- Name: plano_coparticipacao plano_coparticipacao_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.plano_coparticipacao
    ADD CONSTRAINT plano_coparticipacao_pkey PRIMARY KEY (tabela_id, meses_min);


--
-- Name: plano_faixas_etarias plano_faixas_etarias_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.plano_faixas_etarias
    ADD CONSTRAINT plano_faixas_etarias_pkey PRIMARY KEY (tabela_id, idade_min);


--
-- Name: plano_tabelas plano_tabelas_beneficio_id_vigente_desde_key; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.plano_tabelas
    ADD CONSTRAINT plano_tabelas_beneficio_id_vigente_desde_key UNIQUE (beneficio_id, vigente_desde);


--
-- Name: plano_tabelas plano_tabelas_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.plano_tabelas
    ADD CONSTRAINT plano_tabelas_pkey PRIMARY KEY (id);


--
-- Name: ponto_diario ponto_diario_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.ponto_diario
    ADD CONSTRAINT ponto_diario_pkey PRIMARY KEY (colaborador_id, data);


--
-- Name: ponto_mensal ponto_mensal_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.ponto_mensal
    ADD CONSTRAINT ponto_mensal_pkey PRIMARY KEY (competencia, colaborador_id);


--
-- Name: rubricas rubricas_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.rubricas
    ADD CONSTRAINT rubricas_pkey PRIMARY KEY (codigo);


--
-- Name: valores_pj valores_pj_pkey; Type: CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.valores_pj
    ADD CONSTRAINT valores_pj_pkey PRIMARY KEY (colaborador_id);


--
-- Name: acoes acoes_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.acoes
    ADD CONSTRAINT acoes_pkey PRIMARY KEY (id);


--
-- Name: cadastros_lista cadastros_lista_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.cadastros_lista
    ADD CONSTRAINT cadastros_lista_pkey PRIMARY KEY (id);


--
-- Name: cadastros_lista cadastros_lista_programa_id_campo_id_normalizado_key; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.cadastros_lista
    ADD CONSTRAINT cadastros_lista_programa_id_campo_id_normalizado_key UNIQUE (programa_id, campo_id, normalizado);


--
-- Name: coletores coletores_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.coletores
    ADD CONSTRAINT coletores_pkey PRIMARY KEY (id);


--
-- Name: consolidado_valores consolidado_valores_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.consolidado_valores
    ADD CONSTRAINT consolidado_valores_pkey PRIMARY KEY (ano);


--
-- Name: consolidados consolidados_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.consolidados
    ADD CONSTRAINT consolidados_pkey PRIMARY KEY (ano);


--
-- Name: contratos contratos_loja_id_key; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.contratos
    ADD CONSTRAINT contratos_loja_id_key UNIQUE (loja_id);


--
-- Name: contratos contratos_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.contratos
    ADD CONSTRAINT contratos_pkey PRIMARY KEY (id);


--
-- Name: contribuicao_valores contribuicao_valores_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.contribuicao_valores
    ADD CONSTRAINT contribuicao_valores_pkey PRIMARY KEY (contribuicao_id);


--
-- Name: contribuicoes contribuicoes_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.contribuicoes
    ADD CONSTRAINT contribuicoes_pkey PRIMARY KEY (id);


--
-- Name: entrevista_transferencias entrevista_transferencias_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.entrevista_transferencias
    ADD CONSTRAINT entrevista_transferencias_pkey PRIMARY KEY (id);


--
-- Name: entrevistas entrevistas_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.entrevistas
    ADD CONSTRAINT entrevistas_pkey PRIMARY KEY (id);


--
-- Name: entrevistas entrevistas_rascunho_chave_key; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.entrevistas
    ADD CONSTRAINT entrevistas_rascunho_chave_key UNIQUE (rascunho_chave);


--
-- Name: equivalencias equivalencias_nome_key; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.equivalencias
    ADD CONSTRAINT equivalencias_nome_key UNIQUE (nome);


--
-- Name: equivalencias equivalencias_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.equivalencias
    ADD CONSTRAINT equivalencias_pkey PRIMARY KEY (id);


--
-- Name: formulario_alteracoes formulario_alteracoes_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.formulario_alteracoes
    ADD CONSTRAINT formulario_alteracoes_pkey PRIMARY KEY (id);


--
-- Name: formulario_versoes formulario_versoes_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.formulario_versoes
    ADD CONSTRAINT formulario_versoes_pkey PRIMARY KEY (formulario_id, versao);


--
-- Name: formularios formularios_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.formularios
    ADD CONSTRAINT formularios_pkey PRIMARY KEY (id);


--
-- Name: importacoes importacoes_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.importacoes
    ADD CONSTRAINT importacoes_pkey PRIMARY KEY (id);


--
-- Name: lancamento_valores lancamento_valores_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.lancamento_valores
    ADD CONSTRAINT lancamento_valores_pkey PRIMARY KEY (lancamento_id);


--
-- Name: lancamentos lancamentos_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.lancamentos
    ADD CONSTRAINT lancamentos_pkey PRIMARY KEY (id);


--
-- Name: marcos marcos_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.marcos
    ADD CONSTRAINT marcos_pkey PRIMARY KEY (indicador, ano);


--
-- Name: parametros parametros_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.parametros
    ADD CONSTRAINT parametros_pkey PRIMARY KEY (id);


--
-- Name: parametros_valores parametros_valores_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.parametros_valores
    ADD CONSTRAINT parametros_valores_pkey PRIMARY KEY (id);


--
-- Name: participante_contatos participante_contatos_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.participante_contatos
    ADD CONSTRAINT participante_contatos_pkey PRIMARY KEY (participante_id);


--
-- Name: participante_valores participante_valores_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.participante_valores
    ADD CONSTRAINT participante_valores_pkey PRIMARY KEY (participante_id);


--
-- Name: participantes participantes_cliente_doc_key; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.participantes
    ADD CONSTRAINT participantes_cliente_doc_key UNIQUE (cliente_doc);


--
-- Name: participantes participantes_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.participantes
    ADD CONSTRAINT participantes_pkey PRIMARY KEY (id);


--
-- Name: programa_contatos programa_contatos_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.programa_contatos
    ADD CONSTRAINT programa_contatos_pkey PRIMARY KEY (programa_id);


--
-- Name: programa_indicadores programa_indicadores_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.programa_indicadores
    ADD CONSTRAINT programa_indicadores_pkey PRIMARY KEY (id);


--
-- Name: programa_links programa_links_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.programa_links
    ADD CONSTRAINT programa_links_pkey PRIMARY KEY (id);


--
-- Name: programa_links programa_links_token_hash_key; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.programa_links
    ADD CONSTRAINT programa_links_token_hash_key UNIQUE (token_hash);


--
-- Name: programas programas_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.programas
    ADD CONSTRAINT programas_pkey PRIMARY KEY (id);


--
-- Name: rcc_fatores rcc_fatores_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.rcc_fatores
    ADD CONSTRAINT rcc_fatores_pkey PRIMARY KEY (id);


--
-- Name: rcc_fatores rcc_fatores_vigente_desde_key; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.rcc_fatores
    ADD CONSTRAINT rcc_fatores_vigente_desde_key UNIQUE (vigente_desde);


--
-- Name: rcc_nota_valores rcc_nota_valores_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.rcc_nota_valores
    ADD CONSTRAINT rcc_nota_valores_pkey PRIMARY KEY (nota_id);


--
-- Name: rcc_notas rcc_notas_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.rcc_notas
    ADD CONSTRAINT rcc_notas_pkey PRIMARY KEY (id);


--
-- Name: rcc_precos rcc_precos_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.rcc_precos
    ADD CONSTRAINT rcc_precos_pkey PRIMARY KEY (id);


--
-- Name: rcc_precos rcc_precos_vigente_desde_key; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.rcc_precos
    ADD CONSTRAINT rcc_precos_vigente_desde_key UNIQUE (vigente_desde);


--
-- Name: ronda_itens ronda_itens_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.ronda_itens
    ADD CONSTRAINT ronda_itens_pkey PRIMARY KEY (id);


--
-- Name: ronda_itens ronda_itens_ronda_id_coletor_id_key; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.ronda_itens
    ADD CONSTRAINT ronda_itens_ronda_id_coletor_id_key UNIQUE (ronda_id, coletor_id);


--
-- Name: rondas rondas_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.rondas
    ADD CONSTRAINT rondas_pkey PRIMARY KEY (id);


--
-- Name: setor_validades setor_validades_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.setor_validades
    ADD CONSTRAINT setor_validades_pkey PRIMARY KEY (id);


--
-- Name: setor_validades setor_validades_setor_key; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.setor_validades
    ADD CONSTRAINT setor_validades_setor_key UNIQUE (setor);


--
-- Name: termos termos_participante_id_ano_key; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.termos
    ADD CONSTRAINT termos_participante_id_ano_key UNIQUE (participante_id, ano);


--
-- Name: termos termos_pkey; Type: CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.termos
    ADD CONSTRAINT termos_pkey PRIMARY KEY (id);


--
-- Name: itens_cargos; Type: INDEX; Schema: calendario; Owner: -
--

CREATE INDEX itens_cargos ON calendario.itens USING gin (cargos);


--
-- Name: itens_concluido_por; Type: INDEX; Schema: calendario; Owner: -
--

CREATE INDEX itens_concluido_por ON calendario.itens USING btree (concluido_por);


--
-- Name: itens_criado_por; Type: INDEX; Schema: calendario; Owner: -
--

CREATE INDEX itens_criado_por ON calendario.itens USING btree (criado_por);


--
-- Name: itens_fim; Type: INDEX; Schema: calendario; Owner: -
--

CREATE INDEX itens_fim ON calendario.itens USING btree (fim);


--
-- Name: itens_inicio; Type: INDEX; Schema: calendario; Owner: -
--

CREATE INDEX itens_inicio ON calendario.itens USING btree (inicio);


--
-- Name: itens_recorrentes; Type: INDEX; Schema: calendario; Owner: -
--

CREATE INDEX itens_recorrentes ON calendario.itens USING btree (recorrencia_ate) WHERE (recorrencia IS NOT NULL);


--
-- Name: itens_responsavel; Type: INDEX; Schema: calendario; Owner: -
--

CREATE INDEX itens_responsavel ON calendario.itens USING btree (responsavel_id);


--
-- Name: itens_setores; Type: INDEX; Schema: calendario; Owner: -
--

CREATE INDEX itens_setores ON calendario.itens USING gin (setores);


--
-- Name: itens_tipo; Type: INDEX; Schema: calendario; Owner: -
--

CREATE INDEX itens_tipo ON calendario.itens USING btree (tipo_id);


--
-- Name: itens_usuarios; Type: INDEX; Schema: calendario; Owner: -
--

CREATE INDEX itens_usuarios ON calendario.itens USING gin (usuarios);


--
-- Name: tipos_nome; Type: INDEX; Schema: calendario; Owner: -
--

CREATE UNIQUE INDEX tipos_nome ON calendario.tipos USING btree (lower(btrim(nome)));


--
-- Name: tipos_ordem; Type: INDEX; Schema: calendario; Owner: -
--

CREATE INDEX tipos_ordem ON calendario.tipos USING btree (ordem, nome);


--
-- Name: censo_convites_bloco; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX censo_convites_bloco ON comercial.censo_convites USING btree (rodada_id, bloco);


--
-- Name: censo_convites_criado_por; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX censo_convites_criado_por ON comercial.censo_convites USING btree (criado_por);


--
-- Name: censo_convites_empresa; Type: INDEX; Schema: comercial; Owner: -
--

CREATE UNIQUE INDEX censo_convites_empresa ON comercial.censo_convites USING btree (rodada_id, locatario_enet_id);


--
-- Name: censo_respostas_importacao; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX censo_respostas_importacao ON comercial.censo_respostas USING btree (importacao_id);


--
-- Name: censo_respostas_lancada_por; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX censo_respostas_lancada_por ON comercial.censo_respostas USING btree (lancada_por);


--
-- Name: censo_respostas_rodada; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX censo_respostas_rodada ON comercial.censo_respostas USING btree (rodada_id, bloco, segmento);


--
-- Name: censo_respostas_uma_por_empresa; Type: INDEX; Schema: comercial; Owner: -
--

CREATE UNIQUE INDEX censo_respostas_uma_por_empresa ON comercial.censo_respostas USING btree (rodada_id, COALESCE(locatario_enet_id, lower(btrim(empresa_nome)))) WHERE considerada;


--
-- Name: censo_rodadas_criada_por; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX censo_rodadas_criada_por ON comercial.censo_rodadas USING btree (criada_por);


--
-- Name: censo_rodadas_encerrada_por; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX censo_rodadas_encerrada_por ON comercial.censo_rodadas USING btree (encerrada_por);


--
-- Name: censo_rodadas_importacao; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX censo_rodadas_importacao ON comercial.censo_rodadas USING btree (importacao_id);


--
-- Name: censo_rodadas_inicio; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX censo_rodadas_inicio ON comercial.censo_rodadas USING btree (inicio DESC);


--
-- Name: censo_rodadas_nome; Type: INDEX; Schema: comercial; Owner: -
--

CREATE UNIQUE INDEX censo_rodadas_nome ON comercial.censo_rodadas USING btree (lower(btrim(nome)));


--
-- Name: censo_sugestao_temas_contato; Type: INDEX; Schema: comercial; Owner: -
--

CREATE UNIQUE INDEX censo_sugestao_temas_contato ON comercial.censo_sugestao_temas USING btree (contato_id, tema_id);


--
-- Name: censo_sugestao_temas_movido_por; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX censo_sugestao_temas_movido_por ON comercial.censo_sugestao_temas USING btree (movido_por);


--
-- Name: censo_sugestao_temas_resposta; Type: INDEX; Schema: comercial; Owner: -
--

CREATE UNIQUE INDEX censo_sugestao_temas_resposta ON comercial.censo_sugestao_temas USING btree (resposta_id, tema_id);


--
-- Name: censo_sugestao_temas_tema; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX censo_sugestao_temas_tema ON comercial.censo_sugestao_temas USING btree (tema_id);


--
-- Name: censo_temas_nome; Type: INDEX; Schema: comercial; Owner: -
--

CREATE UNIQUE INDEX censo_temas_nome ON comercial.censo_temas USING btree (lower(btrim(nome)));


--
-- Name: contatos_bloco; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX contatos_bloco ON comercial.contatos USING btree (bloco);


--
-- Name: contatos_contrato; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX contatos_contrato ON comercial.contatos USING btree (contrato_enet_id);


--
-- Name: contatos_data; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX contatos_data ON comercial.contatos USING btree (data DESC);


--
-- Name: contatos_importacao; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX contatos_importacao ON comercial.contatos USING btree (importacao_id);


--
-- Name: contatos_locatario; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX contatos_locatario ON comercial.contatos USING btree (locatario_enet_id);


--
-- Name: contatos_registrado_por; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX contatos_registrado_por ON comercial.contatos USING btree (registrado_por);


--
-- Name: contatos_tipo; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX contatos_tipo ON comercial.contatos USING btree (tipo);


--
-- Name: contrato_anexos_contrato; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX contrato_anexos_contrato ON comercial.contrato_anexos USING btree (contrato_id);


--
-- Name: contrato_anexos_enviado_por; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX contrato_anexos_enviado_por ON comercial.contrato_anexos USING btree (enviado_por);


--
-- Name: contrato_kit_versao; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX contrato_kit_versao ON comercial.contrato_kit USING btree (versao_id);


--
-- Name: contrato_versoes_contrato; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX contrato_versoes_contrato ON comercial.contrato_versoes USING btree (contrato_id, em DESC);


--
-- Name: contrato_versoes_por; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX contrato_versoes_por ON comercial.contrato_versoes USING btree (por);


--
-- Name: contratos_atualizado_em; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX contratos_atualizado_em ON comercial.contratos USING btree (atualizado_em DESC);


--
-- Name: contratos_atualizado_por; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX contratos_atualizado_por ON comercial.contratos USING btree (atualizado_por);


--
-- Name: contratos_bloco; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX contratos_bloco ON comercial.contratos USING btree (bloco);


--
-- Name: contratos_criado_por; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX contratos_criado_por ON comercial.contratos USING btree (criado_por);


--
-- Name: contratos_enet; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX contratos_enet ON comercial.contratos USING btree (contrato_enet_id);


--
-- Name: contratos_ficha; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX contratos_ficha ON comercial.contratos USING btree (ficha_id);


--
-- Name: contratos_filtros; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX contratos_filtros ON comercial.contratos USING btree (tipo, status);


--
-- Name: contratos_garantia; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX contratos_garantia ON comercial.contratos USING btree (garantia);


--
-- Name: contratos_gerado_em; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX contratos_gerado_em ON comercial.contratos USING btree (gerado_em);


--
-- Name: contratos_gerado_por; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX contratos_gerado_por ON comercial.contratos USING btree (gerado_por);


--
-- Name: contratos_lucs; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX contratos_lucs ON comercial.contratos USING gin (lucs);


--
-- Name: ficha_acessos_ficha; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX ficha_acessos_ficha ON comercial.ficha_acessos USING btree (ficha_id, em DESC);


--
-- Name: ficha_acessos_usuario; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX ficha_acessos_usuario ON comercial.ficha_acessos USING btree (usuario_id);


--
-- Name: ficha_dados_documento; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX ficha_dados_documento ON comercial.ficha_dados USING btree (documento);


--
-- Name: ficha_documentos_ficha; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX ficha_documentos_ficha ON comercial.ficha_documentos USING btree (ficha_id);


--
-- Name: fichas_gerada_em; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX fichas_gerada_em ON comercial.fichas USING btree (gerada_em DESC);


--
-- Name: fichas_gerada_por; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX fichas_gerada_por ON comercial.fichas USING btree (gerada_por);


--
-- Name: fichas_importacao; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX fichas_importacao ON comercial.fichas USING btree (importacao_id);


--
-- Name: fichas_luc; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX fichas_luc ON comercial.fichas USING btree (luc);


--
-- Name: fichas_nome; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX fichas_nome ON comercial.fichas USING btree (lower(nome));


--
-- Name: fichas_principal; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX fichas_principal ON comercial.fichas USING btree (ficha_principal_id);


--
-- Name: fichas_situacao; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX fichas_situacao ON comercial.fichas USING btree (situacao, tipo);


--
-- Name: fontes_de_para_ajustada; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX fontes_de_para_ajustada ON comercial.fontes_de_para USING btree (fonte_ajustada);


--
-- Name: importacoes_confirmado_por; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX importacoes_confirmado_por ON comercial.importacoes USING btree (confirmado_por);


--
-- Name: importacoes_criado_em; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX importacoes_criado_em ON comercial.importacoes USING btree (criado_em DESC);


--
-- Name: importacoes_desfeito_por; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX importacoes_desfeito_por ON comercial.importacoes USING btree (desfeito_por);


--
-- Name: importacoes_enviado_por; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX importacoes_enviado_por ON comercial.importacoes USING btree (enviado_por);


--
-- Name: importacoes_uma_confirmada; Type: INDEX; Schema: comercial; Owner: -
--

CREATE UNIQUE INDEX importacoes_uma_confirmada ON comercial.importacoes USING btree (tipo, arquivo_sha256) WHERE (status = 'confirmada'::text);


--
-- Name: kit_documentos_blocos; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX kit_documentos_blocos ON comercial.kit_documentos USING gin (blocos);


--
-- Name: kit_documentos_categoria; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX kit_documentos_categoria ON comercial.kit_documentos USING btree (categoria, ordem);


--
-- Name: kit_documentos_nome; Type: INDEX; Schema: comercial; Owner: -
--

CREATE UNIQUE INDEX kit_documentos_nome ON comercial.kit_documentos USING btree (lower(btrim(nome)));


--
-- Name: kit_versoes_documento; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX kit_versoes_documento ON comercial.kit_versoes USING btree (documento_id, enviado_em DESC);


--
-- Name: kit_versoes_enviado_por; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX kit_versoes_enviado_por ON comercial.kit_versoes USING btree (enviado_por);


--
-- Name: kit_versoes_uma_atual; Type: INDEX; Schema: comercial; Owner: -
--

CREATE UNIQUE INDEX kit_versoes_uma_atual ON comercial.kit_versoes USING btree (documento_id) WHERE atual;


--
-- Name: kit_versoes_validade; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX kit_versoes_validade ON comercial.kit_versoes USING btree (validade) WHERE atual;


--
-- Name: listas_ordem; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX listas_ordem ON comercial.listas USING btree (lista, ordem);


--
-- Name: listas_valor; Type: INDEX; Schema: comercial; Owner: -
--

CREATE UNIQUE INDEX listas_valor ON comercial.listas USING btree (lista, lower(btrim(valor)));


--
-- Name: pesquisa_imoveis_area; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX pesquisa_imoveis_area ON comercial.pesquisa_imoveis USING btree (area_m2);


--
-- Name: pesquisa_imoveis_criado_por; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX pesquisa_imoveis_criado_por ON comercial.pesquisa_imoveis USING btree (criado_por);


--
-- Name: pesquisa_imoveis_data; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX pesquisa_imoveis_data ON comercial.pesquisa_imoveis USING btree (data_pesquisa DESC);


--
-- Name: pesquisa_imoveis_filtros; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX pesquisa_imoveis_filtros ON comercial.pesquisa_imoveis USING btree (tipo, bairro);


--
-- Name: pesquisa_imoveis_importacao; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX pesquisa_imoveis_importacao ON comercial.pesquisa_imoveis USING btree (importacao_id);


--
-- Name: propostas_evento_criado_em; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX propostas_evento_criado_em ON comercial.propostas_evento USING btree (criado_em DESC);


--
-- Name: propostas_evento_criado_por; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX propostas_evento_criado_por ON comercial.propostas_evento USING btree (criado_por);


--
-- Name: propostas_evento_data; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX propostas_evento_data ON comercial.propostas_evento USING btree (data_evento);


--
-- Name: propostas_evento_status; Type: INDEX; Schema: comercial; Owner: -
--

CREATE INDEX propostas_evento_status ON comercial.propostas_evento USING btree (status);


--
-- Name: auditoria_em; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX auditoria_em ON core.auditoria USING btree (em DESC);


--
-- Name: auditoria_tabela_registro; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX auditoria_tabela_registro ON core.auditoria USING btree (tabela, registro_id, em DESC);


--
-- Name: cargo_permissoes_permissao; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX cargo_permissoes_permissao ON core.cargo_permissoes USING btree (permissao);


--
-- Name: importacoes_confirmado_por; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX importacoes_confirmado_por ON core.importacoes USING btree (confirmado_por) WHERE (confirmado_por IS NOT NULL);


--
-- Name: importacoes_enviado_por; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX importacoes_enviado_por ON core.importacoes USING btree (enviado_por) WHERE (enviado_por IS NOT NULL);


--
-- Name: importacoes_uma_confirmada; Type: INDEX; Schema: core; Owner: -
--

CREATE UNIQUE INDEX importacoes_uma_confirmada ON core.importacoes USING btree (tipo, referencia) WHERE (status = 'confirmada'::core.status_importacao);


--
-- Name: logs_em; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX logs_em ON core.logs USING btree (em DESC);


--
-- Name: usuario_permissoes_concedida_por; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX usuario_permissoes_concedida_por ON core.usuario_permissoes USING btree (concedida_por) WHERE (concedida_por IS NOT NULL);


--
-- Name: usuario_permissoes_permissao; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX usuario_permissoes_permissao ON core.usuario_permissoes USING btree (permissao);


--
-- Name: usuarios_cargo; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX usuarios_cargo ON core.usuarios USING btree (cargo_id);


--
-- Name: estacionamento_movimento_sync_run; Type: INDEX; Schema: financeiro; Owner: -
--

CREATE INDEX estacionamento_movimento_sync_run ON financeiro.estacionamento_movimento USING btree (sync_run_id) WHERE (sync_run_id IS NOT NULL);


--
-- Name: estacionamento_pagamentos_data; Type: INDEX; Schema: financeiro; Owner: -
--

CREATE INDEX estacionamento_pagamentos_data ON financeiro.estacionamento_pagamentos USING btree (estacionamento_id, data);


--
-- Name: estacionamento_pagamentos_sync_run; Type: INDEX; Schema: financeiro; Owner: -
--

CREATE INDEX estacionamento_pagamentos_sync_run ON financeiro.estacionamento_pagamentos USING btree (sync_run_id) WHERE (sync_run_id IS NOT NULL);


--
-- Name: formularios_atualizado_em; Type: INDEX; Schema: formularios; Owner: -
--

CREATE INDEX formularios_atualizado_em ON formularios.formularios USING btree (atualizado_em DESC);


--
-- Name: formularios_criado_por; Type: INDEX; Schema: formularios; Owner: -
--

CREATE INDEX formularios_criado_por ON formularios.formularios USING btree (criado_por);


--
-- Name: formularios_situacao; Type: INDEX; Schema: formularios; Owner: -
--

CREATE INDEX formularios_situacao ON formularios.formularios USING btree (situacao);


--
-- Name: respostas_formulario; Type: INDEX; Schema: formularios; Owner: -
--

CREATE INDEX respostas_formulario ON formularios.respostas USING btree (formulario_id, enviada_em DESC);


--
-- Name: camera_contagens_inicio; Type: INDEX; Schema: integracao; Owner: -
--

CREATE INDEX camera_contagens_inicio ON integracao.camera_contagens USING btree (inicio);


--
-- Name: credenciais_configurado_por; Type: INDEX; Schema: integracao; Owner: -
--

CREATE INDEX credenciais_configurado_por ON integracao.credenciais USING btree (configurado_por) WHERE (configurado_por IS NOT NULL);


--
-- Name: registros_brutos_sync_run; Type: INDEX; Schema: integracao; Owner: -
--

CREATE INDEX registros_brutos_sync_run ON integracao.registros_brutos USING btree (sync_run_id) WHERE (sync_run_id IS NOT NULL);


--
-- Name: sync_runs_recentes; Type: INDEX; Schema: integracao; Owner: -
--

CREATE INDEX sync_runs_recentes ON integracao.sync_runs USING btree (sistema, recurso, iniciado_em DESC);


--
-- Name: sync_runs_uma_rodando; Type: INDEX; Schema: integracao; Owner: -
--

CREATE UNIQUE INDEX sync_runs_uma_rodando ON integracao.sync_runs USING btree (sistema, recurso) WHERE (status = 'rodando'::integracao.status_sync);


--
-- Name: benchmark_nome; Type: INDEX; Schema: marketing; Owner: -
--

CREATE UNIQUE INDEX benchmark_nome ON marketing.benchmark USING btree (lower(btrim(nome)));


--
-- Name: locatarios_nome; Type: INDEX; Schema: marketing; Owner: -
--

CREATE UNIQUE INDEX locatarios_nome ON marketing.locatarios USING btree (lower(btrim(nome)));


--
-- Name: marca_arquivos_enviado_por; Type: INDEX; Schema: marketing; Owner: -
--

CREATE INDEX marca_arquivos_enviado_por ON marketing.marca_arquivos USING btree (enviado_por);


--
-- Name: marca_arquivos_um_atual; Type: INDEX; Schema: marketing; Owner: -
--

CREATE UNIQUE INDEX marca_arquivos_um_atual ON marketing.marca_arquivos USING btree (grupo) WHERE atual;


--
-- Name: marca_blocos_aba; Type: INDEX; Schema: marketing; Owner: -
--

CREATE INDEX marca_blocos_aba ON marketing.marca_blocos USING btree (aba, ordem);


--
-- Name: marca_blocos_atualizado_por; Type: INDEX; Schema: marketing; Owner: -
--

CREATE INDEX marca_blocos_atualizado_por ON marketing.marca_blocos USING btree (atualizado_por);


--
-- Name: marca_versoes_desfaz; Type: INDEX; Schema: marketing; Owner: -
--

CREATE INDEX marca_versoes_desfaz ON marketing.marca_versoes USING btree (desfaz);


--
-- Name: marca_versoes_em; Type: INDEX; Schema: marketing; Owner: -
--

CREATE INDEX marca_versoes_em ON marketing.marca_versoes USING btree (em DESC);


--
-- Name: marca_versoes_por; Type: INDEX; Schema: marketing; Owner: -
--

CREATE INDEX marca_versoes_por ON marketing.marca_versoes USING btree (por);


--
-- Name: rd_conversoes_contato; Type: INDEX; Schema: marketing; Owner: -
--

CREATE INDEX rd_conversoes_contato ON marketing.rd_conversoes USING btree (contato_uuid);


--
-- Name: rd_conversoes_data; Type: INDEX; Schema: marketing; Owner: -
--

CREATE INDEX rd_conversoes_data ON marketing.rd_conversoes USING btree (convertido_em);


--
-- Name: temas_nome; Type: INDEX; Schema: marketing; Owner: -
--

CREATE UNIQUE INDEX temas_nome ON marketing.temas USING btree (lower(btrim(nome)));


--
-- Name: agua_contas_importacao; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX agua_contas_importacao ON operacoes.agua_contas USING btree (importacao_id);


--
-- Name: agua_contas_vigente; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE UNIQUE INDEX agua_contas_vigente ON operacoes.agua_contas USING btree (referencia, matricula) WHERE vigente;


--
-- Name: agua_leituras_hidrometro; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX agua_leituras_hidrometro ON operacoes.agua_leituras USING btree (hidrometro, referencia) WHERE vigente;


--
-- Name: agua_leituras_importacao; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX agua_leituras_importacao ON operacoes.agua_leituras USING btree (importacao_id);


--
-- Name: agua_leituras_mes; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX agua_leituras_mes ON operacoes.agua_leituras USING btree (referencia, bloco) WHERE vigente;


--
-- Name: agua_leituras_unica; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE UNIQUE INDEX agua_leituras_unica ON operacoes.agua_leituras USING btree (referencia, hidrometro, bloco, sala) WHERE vigente;


--
-- Name: agua_vinculos_criado_por; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX agua_vinculos_criado_por ON operacoes.agua_vinculos USING btree (criado_por);


--
-- Name: caixa_ocupantes_criado_por; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX caixa_ocupantes_criado_por ON operacoes.caixa_ocupantes USING btree (criado_por);


--
-- Name: caixa_ocupantes_nome; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE UNIQUE INDEX caixa_ocupantes_nome ON operacoes.caixa_ocupantes USING btree (caixa_id, lower(btrim(nome)));


--
-- Name: caixas_sala; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX caixas_sala ON operacoes.caixas USING btree (sala_id);


--
-- Name: caixas_status; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX caixas_status ON operacoes.caixas USING btree (quadro_id, status);


--
-- Name: diario_obras_exemplo; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX diario_obras_exemplo ON operacoes.diario_obras USING btree (id) WHERE exemplo;


--
-- Name: diario_relatorios_autor; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX diario_relatorios_autor ON operacoes.diario_relatorios USING btree (autor_id);


--
-- Name: diario_relatorios_data; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX diario_relatorios_data ON operacoes.diario_relatorios USING btree (data DESC);


--
-- Name: diario_relatorios_obra; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX diario_relatorios_obra ON operacoes.diario_relatorios USING btree (obra_id, data DESC);


--
-- Name: diario_relatorios_sem_detalhe; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX diario_relatorios_sem_detalhe ON operacoes.diario_relatorios USING btree (obra_id) WHERE (dados IS NULL);


--
-- Name: diario_relatorios_status; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX diario_relatorios_status ON operacoes.diario_relatorios USING btree (status_id);


--
-- Name: energia_fatura_itens_fatura; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX energia_fatura_itens_fatura ON operacoes.energia_fatura_itens USING btree (fatura_id, ordem);


--
-- Name: energia_faturas_importacao; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX energia_faturas_importacao ON operacoes.energia_faturas USING btree (importacao_id);


--
-- Name: energia_faturas_importado_por; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX energia_faturas_importado_por ON operacoes.energia_faturas USING btree (importado_por);


--
-- Name: energia_faturas_referencia; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX energia_faturas_referencia ON operacoes.energia_faturas USING btree (referencia);


--
-- Name: energia_faturas_vigentes; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX energia_faturas_vigentes ON operacoes.energia_faturas USING btree (referencia, matricula) WHERE vigente;


--
-- Name: hidrometros_bloco; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX hidrometros_bloco ON operacoes.hidrometros USING btree (bloco, sala);


--
-- Name: hidrometros_sala_id; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX hidrometros_sala_id ON operacoes.hidrometros USING btree (sala_id);


--
-- Name: importacoes_agua_vigente; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE UNIQUE INDEX importacoes_agua_vigente ON operacoes.importacoes USING btree (referencia) WHERE ((tipo = 'agua'::text) AND (status = 'confirmada'::text));


--
-- Name: importacoes_confirmado_por; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX importacoes_confirmado_por ON operacoes.importacoes USING btree (confirmado_por);


--
-- Name: importacoes_criado_por; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX importacoes_criado_por ON operacoes.importacoes USING btree (criado_por);


--
-- Name: importacoes_desfeito_por; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX importacoes_desfeito_por ON operacoes.importacoes USING btree (desfeito_por);


--
-- Name: importacoes_substitui; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX importacoes_substitui ON operacoes.importacoes USING btree (substitui);


--
-- Name: importacoes_tipo; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX importacoes_tipo ON operacoes.importacoes USING btree (tipo, criado_em DESC);


--
-- Name: limpeza_anexos_enviado_por; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX limpeza_anexos_enviado_por ON operacoes.limpeza_anexos USING btree (enviado_por);


--
-- Name: limpeza_anexos_mes; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX limpeza_anexos_mes ON operacoes.limpeza_anexos USING btree (referencia);


--
-- Name: limpeza_contrato_mes; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX limpeza_contrato_mes ON operacoes.limpeza_contrato USING btree (referencia, ordem);


--
-- Name: limpeza_equipe_mes; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX limpeza_equipe_mes ON operacoes.limpeza_equipe USING btree (referencia, ordem);


--
-- Name: limpeza_extras_mes; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX limpeza_extras_mes ON operacoes.limpeza_extras USING btree (referencia, ordem);


--
-- Name: limpeza_meses_criado_por; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX limpeza_meses_criado_por ON operacoes.limpeza_meses USING btree (criado_por);


--
-- Name: limpeza_meses_enviado_por; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX limpeza_meses_enviado_por ON operacoes.limpeza_meses USING btree (enviado_por);


--
-- Name: limpeza_meses_fechado_por; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX limpeza_meses_fechado_por ON operacoes.limpeza_meses USING btree (fechado_por);


--
-- Name: limpeza_meses_importacao; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX limpeza_meses_importacao ON operacoes.limpeza_meses USING btree (importacao_id);


--
-- Name: limpeza_meses_reaberto_por; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX limpeza_meses_reaberto_por ON operacoes.limpeza_meses USING btree (reaberto_por);


--
-- Name: obra_realizado_importacao; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX obra_realizado_importacao ON operacoes.obra_realizado USING btree (importacao_id);


--
-- Name: obra_realizado_lancado_por; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX obra_realizado_lancado_por ON operacoes.obra_realizado USING btree (lancado_por);


--
-- Name: obra_realizado_obra; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX obra_realizado_obra ON operacoes.obra_realizado USING btree (obra_id, mes);


--
-- Name: obras_diario_obra; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE UNIQUE INDEX obras_diario_obra ON operacoes.obras USING btree (diario_obra_id) WHERE (diario_obra_id IS NOT NULL);


--
-- Name: obras_nome; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE UNIQUE INDEX obras_nome ON operacoes.obras USING btree (lower(btrim(nome)));


--
-- Name: orcamento_revisoes_importacao; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX orcamento_revisoes_importacao ON operacoes.orcamento_revisoes USING btree (importacao_id);


--
-- Name: orcamento_revisoes_vigente; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE UNIQUE INDEX orcamento_revisoes_vigente ON operacoes.orcamento_revisoes USING btree (obra_id) WHERE vigente;


--
-- Name: quadros_bloco; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX quadros_bloco ON operacoes.quadros USING btree (bloco, ordem);


--
-- Name: salas_bloco; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX salas_bloco ON operacoes.salas USING btree (bloco, sala);


--
-- Name: termos_emitido_por; Type: INDEX; Schema: operacoes; Owner: -
--

CREATE INDEX termos_emitido_por ON operacoes.termos USING btree (emitido_por);


--
-- Name: agenda_bloqueios_agenda; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX agenda_bloqueios_agenda ON os.agenda_bloqueios USING btree (agenda_id);


--
-- Name: agenda_bloqueios_criado_por; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX agenda_bloqueios_criado_por ON os.agenda_bloqueios USING btree (criado_por) WHERE (criado_por IS NOT NULL);


--
-- Name: agendamentos_agenda; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX agendamentos_agenda ON os.agendamentos USING btree (agenda_id, inicio);


--
-- Name: agendamentos_chamado; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX agendamentos_chamado ON os.agendamentos USING btree (chamado_id) WHERE (chamado_id IS NOT NULL);


--
-- Name: agendamentos_criado_por; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX agendamentos_criado_por ON os.agendamentos USING btree (criado_por) WHERE (criado_por IS NOT NULL);


--
-- Name: agendamentos_inicio; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX agendamentos_inicio ON os.agendamentos USING btree (inicio);


--
-- Name: agendamentos_loja; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX agendamentos_loja ON os.agendamentos USING btree (loja_id) WHERE (loja_id IS NOT NULL);


--
-- Name: anexos_ambiente; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX anexos_ambiente ON os.anexos USING btree (ambiente_id);


--
-- Name: anexos_ativo; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX anexos_ativo ON os.anexos USING btree (ativo_id);


--
-- Name: anexos_chamado; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX anexos_chamado ON os.anexos USING btree (chamado_id);


--
-- Name: anexos_enviado_por; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX anexos_enviado_por ON os.anexos USING btree (enviado_por) WHERE (enviado_por IS NOT NULL);


--
-- Name: anexos_evento; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX anexos_evento ON os.anexos USING btree (evento_id) WHERE (evento_id IS NOT NULL);


--
-- Name: anexos_ordem; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX anexos_ordem ON os.anexos USING btree (ordem_id) WHERE (ordem_id IS NOT NULL);


--
-- Name: anexos_vistoria; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX anexos_vistoria ON os.anexos USING btree (vistoria_id) WHERE (vistoria_id IS NOT NULL);


--
-- Name: ativo_saidas_ativa; Type: INDEX; Schema: os; Owner: -
--

CREATE UNIQUE INDEX ativo_saidas_ativa ON os.ativo_saidas USING btree (ativo_id) WHERE (desfeita_em IS NULL);


--
-- Name: ativo_saidas_ativo; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ativo_saidas_ativo ON os.ativo_saidas USING btree (ativo_id, registrado_em DESC);


--
-- Name: ativo_saidas_data; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ativo_saidas_data ON os.ativo_saidas USING btree (data DESC);


--
-- Name: ativo_saidas_desfeita_por; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ativo_saidas_desfeita_por ON os.ativo_saidas USING btree (desfeita_por);


--
-- Name: ativo_saidas_registrado_por; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ativo_saidas_registrado_por ON os.ativo_saidas USING btree (registrado_por);


--
-- Name: ativo_saidas_responsavel; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ativo_saidas_responsavel ON os.ativo_saidas USING btree (responsavel_id);


--
-- Name: ativo_saidas_tipo; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ativo_saidas_tipo ON os.ativo_saidas USING btree (tipo, data DESC);


--
-- Name: ativo_situacoes_ativo; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ativo_situacoes_ativo ON os.ativo_situacoes USING btree (ativo_id, desde);


--
-- Name: ativos_categoria; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ativos_categoria ON os.ativos USING btree (categoria_id);


--
-- Name: ativos_fornecedor; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ativos_fornecedor ON os.ativos USING btree (fornecedor_id) WHERE (fornecedor_id IS NOT NULL);


--
-- Name: ativos_loja; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ativos_loja ON os.ativos USING btree (loja_id) WHERE (loja_id IS NOT NULL);


--
-- Name: ativos_responsavel; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ativos_responsavel ON os.ativos USING btree (responsavel_id) WHERE (responsavel_id IS NOT NULL);


--
-- Name: ativos_setor; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ativos_setor ON os.ativos USING btree (setor_id) WHERE (setor_id IS NOT NULL);


--
-- Name: categorias_agenda; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX categorias_agenda ON os.categorias USING btree (agenda_id) WHERE (agenda_id IS NOT NULL);


--
-- Name: categorias_pai; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX categorias_pai ON os.categorias USING btree (pai_id) WHERE (pai_id IS NOT NULL);


--
-- Name: categorias_responsavel_padrao; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX categorias_responsavel_padrao ON os.categorias USING btree (responsavel_padrao_id) WHERE (responsavel_padrao_id IS NOT NULL);


--
-- Name: categorias_setor; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX categorias_setor ON os.categorias USING btree (setor_id);


--
-- Name: chamados_aberto_por; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX chamados_aberto_por ON os.chamados USING btree (aberto_por, status);


--
-- Name: chamados_ambiente; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX chamados_ambiente ON os.chamados USING btree (ambiente_id) WHERE (ambiente_id IS NOT NULL);


--
-- Name: chamados_ativo; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX chamados_ativo ON os.chamados USING btree (ativo_id);


--
-- Name: chamados_cancelado; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX chamados_cancelado ON os.chamados USING btree (cancelado_em) WHERE (cancelado_em IS NOT NULL);


--
-- Name: chamados_cancelado_por; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX chamados_cancelado_por ON os.chamados USING btree (cancelado_por) WHERE (cancelado_por IS NOT NULL);


--
-- Name: chamados_categoria; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX chamados_categoria ON os.chamados USING btree (categoria_id);


--
-- Name: chamados_concluido; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX chamados_concluido ON os.chamados USING btree (concluido_em) WHERE (concluido_em IS NOT NULL);


--
-- Name: chamados_concluido_por; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX chamados_concluido_por ON os.chamados USING btree (concluido_por) WHERE (concluido_por IS NOT NULL);


--
-- Name: chamados_criado; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX chamados_criado ON os.chamados USING btree (criado_em DESC);


--
-- Name: chamados_fechado; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX chamados_fechado ON os.chamados USING btree (fechado_em) WHERE (fechado_em IS NOT NULL);


--
-- Name: chamados_fechado_por; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX chamados_fechado_por ON os.chamados USING btree (fechado_por) WHERE (fechado_por IS NOT NULL);


--
-- Name: chamados_lista_criado; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX chamados_lista_criado ON os.chamados USING btree (criado_em DESC, id);


--
-- Name: chamados_lista_prazo; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX chamados_lista_prazo ON os.chamados USING btree (prazo, id);


--
-- Name: chamados_lista_status; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX chamados_lista_status ON os.chamados USING btree (status, prazo);


--
-- Name: chamados_loja; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX chamados_loja ON os.chamados USING btree (loja_id);


--
-- Name: chamados_origem_aberto; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX chamados_origem_aberto ON os.chamados USING btree (origem_modulo, origem_ref) WHERE ((origem_modulo IS NOT NULL) AND (status = ANY (ARRAY['aberto'::os.status_chamado, 'em_andamento'::os.status_chamado, 'aguardando'::os.status_chamado])));


--
-- Name: chamados_prazo; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX chamados_prazo ON os.chamados USING btree (prazo) WHERE (status = ANY (ARRAY['aberto'::os.status_chamado, 'em_andamento'::os.status_chamado, 'aguardando'::os.status_chamado]));


--
-- Name: chamados_responsavel; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX chamados_responsavel ON os.chamados USING btree (responsavel_id, status);


--
-- Name: chamados_setor_status; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX chamados_setor_status ON os.chamados USING btree (setor_id, status);


--
-- Name: chamados_vinculado_a; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX chamados_vinculado_a ON os.chamados USING btree (vinculado_a_id) WHERE (vinculado_a_id IS NOT NULL);


--
-- Name: chamados_vistoria; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX chamados_vistoria ON os.chamados USING btree (vistoria_id) WHERE (vistoria_id IS NOT NULL);


--
-- Name: destinatarios_chamado; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX destinatarios_chamado ON os.destinatarios USING btree (chamado_id);


--
-- Name: destinatarios_concluido_por; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX destinatarios_concluido_por ON os.destinatarios USING btree (concluido_por) WHERE (concluido_por IS NOT NULL);


--
-- Name: destinatarios_ordem; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX destinatarios_ordem ON os.destinatarios USING btree (ordem_id) WHERE (ordem_id IS NOT NULL);


--
-- Name: destinatarios_responsavel; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX destinatarios_responsavel ON os.destinatarios USING btree (responsavel_id) WHERE (responsavel_id IS NOT NULL);


--
-- Name: destinatarios_setor; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX destinatarios_setor ON os.destinatarios USING btree (setor_id);


--
-- Name: destinatarios_usuario; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX destinatarios_usuario ON os.destinatarios USING btree (usuario_id);


--
-- Name: disparos_chamado; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX disparos_chamado ON os.disparos USING btree (chamado_id) WHERE (chamado_id IS NOT NULL);


--
-- Name: disparos_disparado_por; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX disparos_disparado_por ON os.disparos USING btree (disparado_por) WHERE (disparado_por IS NOT NULL);


--
-- Name: disparos_loja; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX disparos_loja ON os.disparos USING btree (loja_id);


--
-- Name: eventos_autor; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX eventos_autor ON os.eventos USING btree (autor_id) WHERE (autor_id IS NOT NULL);


--
-- Name: eventos_chamado; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX eventos_chamado ON os.eventos USING btree (chamado_id, em);


--
-- Name: eventos_ordem; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX eventos_ordem ON os.eventos USING btree (ordem_id, em) WHERE (ordem_id IS NOT NULL);


--
-- Name: leituras_usuario; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX leituras_usuario ON os.leituras USING btree (usuario_id);


--
-- Name: lojas_cnpj_vigente; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX lojas_cnpj_vigente ON os.lojas USING btree (cnpj) WHERE (situacao = 'vigente'::text);


--
-- Name: lojas_luc; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX lojas_luc ON os.lojas USING btree (luc);


--
-- Name: materiais_criado_por; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX materiais_criado_por ON os.materiais USING btree (criado_por) WHERE (criado_por IS NOT NULL);


--
-- Name: materiais_ordem; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX materiais_ordem ON os.materiais USING btree (ordem_id);


--
-- Name: metas_categoria; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX metas_categoria ON os.metas USING btree (categoria_id) WHERE (categoria_id IS NOT NULL);


--
-- Name: modelo_itens_categoria; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX modelo_itens_categoria ON os.modelo_itens USING btree (categoria_id) WHERE (categoria_id IS NOT NULL);


--
-- Name: modelo_itens_modelo; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX modelo_itens_modelo ON os.modelo_itens USING btree (modelo_id);


--
-- Name: modelo_itens_responsavel; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX modelo_itens_responsavel ON os.modelo_itens USING btree (responsavel_id) WHERE (responsavel_id IS NOT NULL);


--
-- Name: modelo_itens_setor; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX modelo_itens_setor ON os.modelo_itens USING btree (setor_id) WHERE (setor_id IS NOT NULL);


--
-- Name: notificacoes_chamado; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX notificacoes_chamado ON os.notificacoes USING btree (chamado_id) WHERE (chamado_id IS NOT NULL);


--
-- Name: notificacoes_ordem; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX notificacoes_ordem ON os.notificacoes USING btree (ordem_id) WHERE (ordem_id IS NOT NULL);


--
-- Name: notificacoes_usuario; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX notificacoes_usuario ON os.notificacoes USING btree (usuario_id, criado_em DESC);


--
-- Name: ordem_profissionais_profissional; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ordem_profissionais_profissional ON os.ordem_profissionais USING btree (profissional_id);


--
-- Name: ordens_aberto_por; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ordens_aberto_por ON os.ordens USING btree (aberto_por, status);


--
-- Name: ordens_ambiente; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ordens_ambiente ON os.ordens USING btree (ambiente_id) WHERE (ambiente_id IS NOT NULL);


--
-- Name: ordens_ativo; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ordens_ativo ON os.ordens USING btree (ativo_id) WHERE (ativo_id IS NOT NULL);


--
-- Name: ordens_cancelado; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ordens_cancelado ON os.ordens USING btree (cancelado_em) WHERE (cancelado_em IS NOT NULL);


--
-- Name: ordens_cancelado_por; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ordens_cancelado_por ON os.ordens USING btree (cancelado_por) WHERE (cancelado_por IS NOT NULL);


--
-- Name: ordens_categoria; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ordens_categoria ON os.ordens USING btree (categoria_id);


--
-- Name: ordens_concluido; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ordens_concluido ON os.ordens USING btree (concluido_em) WHERE (concluido_em IS NOT NULL);


--
-- Name: ordens_concluido_por; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ordens_concluido_por ON os.ordens USING btree (concluido_por) WHERE (concluido_por IS NOT NULL);


--
-- Name: ordens_empresa; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ordens_empresa ON os.ordens USING btree (empresa_id) WHERE (empresa_id IS NOT NULL);


--
-- Name: ordens_fechado; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ordens_fechado ON os.ordens USING btree (fechado_em) WHERE (fechado_em IS NOT NULL);


--
-- Name: ordens_fechado_por; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ordens_fechado_por ON os.ordens USING btree (fechado_por) WHERE (fechado_por IS NOT NULL);


--
-- Name: ordens_lista_criado; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ordens_lista_criado ON os.ordens USING btree (criado_em DESC, id);


--
-- Name: ordens_lista_prazo; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ordens_lista_prazo ON os.ordens USING btree (prazo, id);


--
-- Name: ordens_lista_status; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ordens_lista_status ON os.ordens USING btree (status, prazo);


--
-- Name: ordens_loja; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ordens_loja ON os.ordens USING btree (loja_id) WHERE (loja_id IS NOT NULL);


--
-- Name: ordens_plano; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ordens_plano ON os.ordens USING btree (plano_id) WHERE (plano_id IS NOT NULL);


--
-- Name: ordens_responsavel; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ordens_responsavel ON os.ordens USING btree (responsavel_id, status);


--
-- Name: ordens_setor_status; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ordens_setor_status ON os.ordens USING btree (setor_id, status);


--
-- Name: ordens_vinculado_a; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ordens_vinculado_a ON os.ordens USING btree (vinculado_a_id) WHERE (vinculado_a_id IS NOT NULL);


--
-- Name: ordens_visita; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ordens_visita ON os.ordens USING btree (visita_data) WHERE (visita_data IS NOT NULL);


--
-- Name: ordens_vistoria; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX ordens_vistoria ON os.ordens USING btree (vistoria_id) WHERE (vistoria_id IS NOT NULL);


--
-- Name: os_custos_aprovado_por; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX os_custos_aprovado_por ON os.os_custos USING btree (orcamento_aprovado_por) WHERE (orcamento_aprovado_por IS NOT NULL);


--
-- Name: participantes_usuario; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX participantes_usuario ON os.participantes USING btree (usuario_id);


--
-- Name: planos_ativo; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX planos_ativo ON os.planos_preventivos USING btree (ativo_id);


--
-- Name: planos_preventivos_categoria; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX planos_preventivos_categoria ON os.planos_preventivos USING btree (categoria_id) WHERE (categoria_id IS NOT NULL);


--
-- Name: planos_preventivos_proxima; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX planos_preventivos_proxima ON os.planos_preventivos USING btree (proxima_data) WHERE ativo;


--
-- Name: planos_preventivos_responsavel; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX planos_preventivos_responsavel ON os.planos_preventivos USING btree (responsavel_id) WHERE (responsavel_id IS NOT NULL);


--
-- Name: planos_preventivos_setor; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX planos_preventivos_setor ON os.planos_preventivos USING btree (setor_id);


--
-- Name: portal_links_cancelado_por; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX portal_links_cancelado_por ON os.portal_links USING btree (cancelado_por) WHERE (cancelado_por IS NOT NULL);


--
-- Name: portal_links_criado_por; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX portal_links_criado_por ON os.portal_links USING btree (criado_por) WHERE (criado_por IS NOT NULL);


--
-- Name: portal_links_um_ativo; Type: INDEX; Schema: os; Owner: -
--

CREATE UNIQUE INDEX portal_links_um_ativo ON os.portal_links USING btree (loja_id) WHERE (cancelado_em IS NULL);


--
-- Name: portal_sessoes_encerrado_por; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX portal_sessoes_encerrado_por ON os.portal_sessoes USING btree (encerrado_por) WHERE (encerrado_por IS NOT NULL);


--
-- Name: portal_sessoes_loja; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX portal_sessoes_loja ON os.portal_sessoes USING btree (loja_id);


--
-- Name: portal_tentativas_ip; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX portal_tentativas_ip ON os.portal_tentativas USING btree (ip, criado_em);


--
-- Name: profissionais_empresa; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX profissionais_empresa ON os.profissionais USING btree (empresa_id);


--
-- Name: sessao_tecnicos_tecnico; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX sessao_tecnicos_tecnico ON os.sessao_tecnicos USING btree (tecnico_id);


--
-- Name: sessoes_criado_por; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX sessoes_criado_por ON os.sessoes USING btree (criado_por) WHERE (criado_por IS NOT NULL);


--
-- Name: sessoes_ordem; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX sessoes_ordem ON os.sessoes USING btree (ordem_id, data);


--
-- Name: setor_membros_usuario; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX setor_membros_usuario ON os.setor_membros USING btree (usuario_id);


--
-- Name: tecnicos_setor; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX tecnicos_setor ON os.tecnicos USING btree (setor_id) WHERE (setor_id IS NOT NULL);


--
-- Name: terceirizado_links_criado_em; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX terceirizado_links_criado_em ON os.terceirizado_links USING btree (criado_em);


--
-- Name: terceirizado_links_criado_por; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX terceirizado_links_criado_por ON os.terceirizado_links USING btree (criado_por) WHERE (criado_por IS NOT NULL);


--
-- Name: terceirizado_links_empresa; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX terceirizado_links_empresa ON os.terceirizado_links USING btree (empresa_id) WHERE (empresa_id IS NOT NULL);


--
-- Name: terceirizado_links_um_ativo; Type: INDEX; Schema: os; Owner: -
--

CREATE UNIQUE INDEX terceirizado_links_um_ativo ON os.terceirizado_links USING btree (ordem_id) WHERE (cancelado_em IS NULL);


--
-- Name: vistoria_ambientes_entrada; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX vistoria_ambientes_entrada ON os.vistoria_ambientes USING btree (entrada_ambiente_id) WHERE (entrada_ambiente_id IS NOT NULL);


--
-- Name: vistoria_ambientes_vistoria; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX vistoria_ambientes_vistoria ON os.vistoria_ambientes USING btree (vistoria_id, ordem);


--
-- Name: vistorias_criado_por; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX vistorias_criado_por ON os.vistorias USING btree (criado_por) WHERE (criado_por IS NOT NULL);


--
-- Name: vistorias_data; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX vistorias_data ON os.vistorias USING btree (data);


--
-- Name: vistorias_entrada; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX vistorias_entrada ON os.vistorias USING btree (entrada_id) WHERE (entrada_id IS NOT NULL);


--
-- Name: vistorias_loja; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX vistorias_loja ON os.vistorias USING btree (loja_id) WHERE (loja_id IS NOT NULL);


--
-- Name: vistorias_vistoriador; Type: INDEX; Schema: os; Owner: -
--

CREATE INDEX vistorias_vistoriador ON os.vistorias USING btree (vistoriador_id) WHERE (vistoriador_id IS NOT NULL);


--
-- Name: afastamentos_fim; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX afastamentos_fim ON rh.afastamentos USING btree (fim);


--
-- Name: beneficio_contratos_aberto; Type: INDEX; Schema: rh; Owner: -
--

CREATE UNIQUE INDEX beneficio_contratos_aberto ON rh.beneficio_contratos USING btree (beneficio_id, tipo_contrato) WHERE (ate IS NULL);


--
-- Name: beneficio_contratos_beneficio; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX beneficio_contratos_beneficio ON rh.beneficio_contratos USING btree (beneficio_id);


--
-- Name: beneficio_valores_mensais_colaborador; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX beneficio_valores_mensais_colaborador ON rh.beneficio_valores_mensais USING btree (colaborador_id);


--
-- Name: categorias_gasto_nome; Type: INDEX; Schema: rh; Owner: -
--

CREATE UNIQUE INDEX categorias_gasto_nome ON rh.categorias_gasto USING btree (lower(btrim(nome)));


--
-- Name: colaborador_beneficios_beneficio; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX colaborador_beneficios_beneficio ON rh.colaborador_beneficios USING btree (beneficio_id);


--
-- Name: colaborador_beneficios_colaborador; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX colaborador_beneficios_colaborador ON rh.colaborador_beneficios USING btree (colaborador_id);


--
-- Name: colaboradores_cargo; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX colaboradores_cargo ON rh.colaboradores USING btree (cargo_id) WHERE (cargo_id IS NOT NULL);


--
-- Name: colaboradores_departamento; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX colaboradores_departamento ON rh.colaboradores USING btree (departamento_id);


--
-- Name: colaboradores_motivo_desligamento; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX colaboradores_motivo_desligamento ON rh.colaboradores USING btree (motivo_desligamento_id) WHERE (motivo_desligamento_id IS NOT NULL);


--
-- Name: colaboradores_nome; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX colaboradores_nome ON rh.colaboradores USING btree (nome);


--
-- Name: custos_colaborador_cargo; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX custos_colaborador_cargo ON rh.custos_colaborador USING btree (cargo_id) WHERE (cargo_id IS NOT NULL);


--
-- Name: custos_colaborador_colaborador; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX custos_colaborador_colaborador ON rh.custos_colaborador USING btree (colaborador_id, competencia DESC);


--
-- Name: custos_colaborador_departamento; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX custos_colaborador_departamento ON rh.custos_colaborador USING btree (competencia, departamento_id);


--
-- Name: custos_colaborador_departamento_id; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX custos_colaborador_departamento_id ON rh.custos_colaborador USING btree (departamento_id) WHERE (departamento_id IS NOT NULL);


--
-- Name: dependentes_colaborador; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX dependentes_colaborador ON rh.dependentes USING btree (colaborador_id);


--
-- Name: folha_colaboradores_cargo; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX folha_colaboradores_cargo ON rh.folha_colaboradores USING btree (cargo_id) WHERE (cargo_id IS NOT NULL);


--
-- Name: folha_colaboradores_colaborador; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX folha_colaboradores_colaborador ON rh.folha_colaboradores USING btree (colaborador_id);


--
-- Name: folha_colaboradores_departamento; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX folha_colaboradores_departamento ON rh.folha_colaboradores USING btree (departamento_id) WHERE (departamento_id IS NOT NULL);


--
-- Name: folha_rubricas_colaborador; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX folha_rubricas_colaborador ON rh.folha_rubricas USING btree (folha_id, colaborador_id);


--
-- Name: folha_rubricas_rubrica; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX folha_rubricas_rubrica ON rh.folha_rubricas USING btree (rubrica_codigo);


--
-- Name: folhas_fechada_por; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX folhas_fechada_por ON rh.folhas USING btree (fechada_por) WHERE (fechada_por IS NOT NULL);


--
-- Name: folhas_importacao; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX folhas_importacao ON rh.folhas USING btree (importacao_id) WHERE (importacao_id IS NOT NULL);


--
-- Name: gastos_categoria; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX gastos_categoria ON rh.gastos USING btree (categoria_id);


--
-- Name: gastos_data; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX gastos_data ON rh.gastos USING btree (data);


--
-- Name: jornadas_cargo; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX jornadas_cargo ON rh.jornadas USING btree (cargo_id) WHERE (cargo_id IS NOT NULL);


--
-- Name: jornadas_colaborador; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX jornadas_colaborador ON rh.jornadas USING btree (colaborador_id) WHERE (colaborador_id IS NOT NULL);


--
-- Name: notas_pj_colaborador; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX notas_pj_colaborador ON rh.notas_pj USING btree (colaborador_id);


--
-- Name: plano_tabelas_importacao; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX plano_tabelas_importacao ON rh.plano_tabelas USING btree (importacao_id) WHERE (importacao_id IS NOT NULL);


--
-- Name: ponto_diario_data; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX ponto_diario_data ON rh.ponto_diario USING btree (data);


--
-- Name: ponto_diario_sync_run; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX ponto_diario_sync_run ON rh.ponto_diario USING btree (sync_run_id) WHERE (sync_run_id IS NOT NULL);


--
-- Name: ponto_mensal_colaborador; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX ponto_mensal_colaborador ON rh.ponto_mensal USING btree (colaborador_id, competencia DESC);


--
-- Name: ponto_mensal_departamento; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX ponto_mensal_departamento ON rh.ponto_mensal USING btree (departamento_id) WHERE (departamento_id IS NOT NULL);


--
-- Name: ponto_mensal_sync_run; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX ponto_mensal_sync_run ON rh.ponto_mensal USING btree (sync_run_id) WHERE (sync_run_id IS NOT NULL);


--
-- Name: rubricas_classificada_por; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX rubricas_classificada_por ON rh.rubricas USING btree (classificada_por) WHERE (classificada_por IS NOT NULL);


--
-- Name: valores_pj_sync_run; Type: INDEX; Schema: rh; Owner: -
--

CREATE INDEX valores_pj_sync_run ON rh.valores_pj USING btree (sync_run_id) WHERE (sync_run_id IS NOT NULL);


--
-- Name: acoes_criado_por; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX acoes_criado_por ON sustentabilidade.acoes USING btree (criado_por);


--
-- Name: acoes_data; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX acoes_data ON sustentabilidade.acoes USING btree (data);


--
-- Name: acoes_participante; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX acoes_participante ON sustentabilidade.acoes USING btree (participante_id, data DESC);


--
-- Name: cadastros_lista_criado_por; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX cadastros_lista_criado_por ON sustentabilidade.cadastros_lista USING btree (criado_por);


--
-- Name: cadastros_lista_importacao; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX cadastros_lista_importacao ON sustentabilidade.cadastros_lista USING btree (importacao_id);


--
-- Name: coletores_ordem; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX coletores_ordem ON sustentabilidade.coletores USING btree (ativo, ordem);


--
-- Name: consolidados_fechado_por; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX consolidados_fechado_por ON sustentabilidade.consolidados USING btree (fechado_por);


--
-- Name: consolidados_reaberto_por; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX consolidados_reaberto_por ON sustentabilidade.consolidados USING btree (reaberto_por);


--
-- Name: contratos_bloco; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX contratos_bloco ON sustentabilidade.contratos USING btree (bloco);


--
-- Name: contratos_chamado; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX contratos_chamado ON sustentabilidade.contratos USING btree (chamado_id);


--
-- Name: contratos_cliente_doc; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX contratos_cliente_doc ON sustentabilidade.contratos USING btree (cliente_doc);


--
-- Name: contratos_corrigida_por; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX contratos_corrigida_por ON sustentabilidade.contratos USING btree (ativacao_corrigida_por);


--
-- Name: contratos_dispensada_por; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX contratos_dispensada_por ON sustentabilidade.contratos USING btree (dispensada_por);


--
-- Name: contratos_situacao; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX contratos_situacao ON sustentabilidade.contratos USING btree (situacao, tipo_loja);


--
-- Name: contribuicoes_competencia; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX contribuicoes_competencia ON sustentabilidade.contribuicoes USING btree (competencia);


--
-- Name: contribuicoes_criado_por; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX contribuicoes_criado_por ON sustentabilidade.contribuicoes USING btree (criado_por);


--
-- Name: contribuicoes_participante; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX contribuicoes_participante ON sustentabilidade.contribuicoes USING btree (participante_id, data DESC);


--
-- Name: entrevista_transferencias_de; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX entrevista_transferencias_de ON sustentabilidade.entrevista_transferencias USING btree (de_contrato_id);


--
-- Name: entrevista_transferencias_entrevista; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX entrevista_transferencias_entrevista ON sustentabilidade.entrevista_transferencias USING btree (entrevista_id);


--
-- Name: entrevista_transferencias_para; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX entrevista_transferencias_para ON sustentabilidade.entrevista_transferencias USING btree (para_contrato_id);


--
-- Name: entrevista_transferencias_quem; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX entrevista_transferencias_quem ON sustentabilidade.entrevista_transferencias USING btree (quem);


--
-- Name: entrevistas_chamado; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX entrevistas_chamado ON sustentabilidade.entrevistas USING btree (chamado_id);


--
-- Name: entrevistas_cliente_doc; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX entrevistas_cliente_doc ON sustentabilidade.entrevistas USING btree (cliente_doc);


--
-- Name: entrevistas_contrato; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX entrevistas_contrato ON sustentabilidade.entrevistas USING btree (contrato_id, data DESC);


--
-- Name: entrevistas_data; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX entrevistas_data ON sustentabilidade.entrevistas USING btree (data DESC);


--
-- Name: entrevistas_entrevistador; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX entrevistas_entrevistador ON sustentabilidade.entrevistas USING btree (entrevistador_id);


--
-- Name: entrevistas_importacao; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX entrevistas_importacao ON sustentabilidade.entrevistas USING btree (importacao_id);


--
-- Name: entrevistas_unica; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE UNIQUE INDEX entrevistas_unica ON sustentabilidade.entrevistas USING btree (contrato_id, data) WHERE (situacao = 'salva'::text);


--
-- Name: entrevistas_valida_ate; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX entrevistas_valida_ate ON sustentabilidade.entrevistas USING btree (valida_ate) WHERE (situacao = 'salva'::text);


--
-- Name: formulario_alteracoes_formulario; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX formulario_alteracoes_formulario ON sustentabilidade.formulario_alteracoes USING btree (formulario_id, quando DESC);


--
-- Name: formulario_alteracoes_quem; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX formulario_alteracoes_quem ON sustentabilidade.formulario_alteracoes USING btree (quem);


--
-- Name: formulario_versoes_publicado_por; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX formulario_versoes_publicado_por ON sustentabilidade.formulario_versoes USING btree (publicado_por);


--
-- Name: formularios_criado_por; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX formularios_criado_por ON sustentabilidade.formularios USING btree (criado_por);


--
-- Name: formularios_programa; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX formularios_programa ON sustentabilidade.formularios USING btree (programa_id);


--
-- Name: formularios_questionario; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE UNIQUE INDEX formularios_questionario ON sustentabilidade.formularios USING btree (tipo) WHERE (tipo = 'questionario'::text);


--
-- Name: importacoes_confirmado_por; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX importacoes_confirmado_por ON sustentabilidade.importacoes USING btree (confirmado_por);


--
-- Name: importacoes_criado_por; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX importacoes_criado_por ON sustentabilidade.importacoes USING btree (criado_por);


--
-- Name: importacoes_desfeito_por; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX importacoes_desfeito_por ON sustentabilidade.importacoes USING btree (desfeito_por);


--
-- Name: importacoes_sha256; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX importacoes_sha256 ON sustentabilidade.importacoes USING btree (sha256);


--
-- Name: importacoes_substitui; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX importacoes_substitui ON sustentabilidade.importacoes USING btree (substitui);


--
-- Name: importacoes_tipo; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX importacoes_tipo ON sustentabilidade.importacoes USING btree (tipo, criado_em DESC);


--
-- Name: lancamentos_data; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX lancamentos_data ON sustentabilidade.lancamentos USING btree (data);


--
-- Name: lancamentos_formulario; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX lancamentos_formulario ON sustentabilidade.lancamentos USING btree (formulario_id, formulario_versao);


--
-- Name: lancamentos_importacao; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX lancamentos_importacao ON sustentabilidade.lancamentos USING btree (importacao_id);


--
-- Name: lancamentos_lancado_por; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX lancamentos_lancado_por ON sustentabilidade.lancamentos USING btree (lancado_por);


--
-- Name: lancamentos_link; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX lancamentos_link ON sustentabilidade.lancamentos USING btree (link_id);


--
-- Name: lancamentos_programa; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX lancamentos_programa ON sustentabilidade.lancamentos USING btree (programa_id, data DESC);


--
-- Name: parametros_atualizado_por; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX parametros_atualizado_por ON sustentabilidade.parametros USING btree (atualizado_por);


--
-- Name: parametros_setor; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX parametros_setor ON sustentabilidade.parametros USING btree (recolhimento_setor_id);


--
-- Name: participantes_nome; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX participantes_nome ON sustentabilidade.participantes USING btree (nome);


--
-- Name: programa_indicadores_formulario; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX programa_indicadores_formulario ON sustentabilidade.programa_indicadores USING btree (formulario_id);


--
-- Name: programa_indicadores_grupo; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX programa_indicadores_grupo ON sustentabilidade.programa_indicadores USING btree (grupo) WHERE mostrar_painel;


--
-- Name: programa_indicadores_programa; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX programa_indicadores_programa ON sustentabilidade.programa_indicadores USING btree (programa_id, ordem);


--
-- Name: programa_links_ativo; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE UNIQUE INDEX programa_links_ativo ON sustentabilidade.programa_links USING btree (programa_id) WHERE (desligado_em IS NULL);


--
-- Name: programa_links_criado_por; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX programa_links_criado_por ON sustentabilidade.programa_links USING btree (criado_por);


--
-- Name: programa_links_desligado_por; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX programa_links_desligado_por ON sustentabilidade.programa_links USING btree (desligado_por);


--
-- Name: programa_links_programa; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX programa_links_programa ON sustentabilidade.programa_links USING btree (programa_id);


--
-- Name: programas_ativo; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX programas_ativo ON sustentabilidade.programas USING btree (ativo, nome);


--
-- Name: programas_nome; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE UNIQUE INDEX programas_nome ON sustentabilidade.programas USING btree (lower(btrim(nome)));


--
-- Name: rcc_fatores_criado_por; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX rcc_fatores_criado_por ON sustentabilidade.rcc_fatores USING btree (criado_por);


--
-- Name: rcc_notas_chamado; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX rcc_notas_chamado ON sustentabilidade.rcc_notas USING btree (chamado_id);


--
-- Name: rcc_notas_competencia; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX rcc_notas_competencia ON sustentabilidade.rcc_notas USING btree (competencia DESC);


--
-- Name: rcc_notas_empresa; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX rcc_notas_empresa ON sustentabilidade.rcc_notas USING btree (empresa);


--
-- Name: rcc_notas_lancado_por; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX rcc_notas_lancado_por ON sustentabilidade.rcc_notas USING btree (lancado_por);


--
-- Name: rcc_precos_criado_por; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX rcc_precos_criado_por ON sustentabilidade.rcc_precos USING btree (criado_por);


--
-- Name: ronda_itens_coletor; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX ronda_itens_coletor ON sustentabilidade.ronda_itens USING btree (coletor_id);


--
-- Name: rondas_chamado; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX rondas_chamado ON sustentabilidade.rondas USING btree (chamado_id);


--
-- Name: rondas_data; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX rondas_data ON sustentabilidade.rondas USING btree (data_hora DESC);


--
-- Name: rondas_lancado_por; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX rondas_lancado_por ON sustentabilidade.rondas USING btree (lancado_por);


--
-- Name: termos_chamado; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX termos_chamado ON sustentabilidade.termos USING btree (chamado_id);


--
-- Name: termos_criado_por; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX termos_criado_por ON sustentabilidade.termos USING btree (criado_por);


--
-- Name: termos_valido_ate; Type: INDEX; Schema: sustentabilidade; Owner: -
--

CREATE INDEX termos_valido_ate ON sustentabilidade.termos USING btree (valido_ate);


--
-- Name: itens atualizado_em; Type: TRIGGER; Schema: calendario; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON calendario.itens FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: tipos atualizado_em; Type: TRIGGER; Schema: calendario; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON calendario.tipos FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: itens auditoria; Type: TRIGGER; Schema: calendario; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON calendario.itens FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: tipos auditoria; Type: TRIGGER; Schema: calendario; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON calendario.tipos FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: contratos antes_de_gravar; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER antes_de_gravar BEFORE INSERT OR UPDATE ON comercial.contratos FOR EACH ROW EXECUTE FUNCTION comercial.contrato_antes_de_gravar();


--
-- Name: censo_respostas atualizado_em; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON comercial.censo_respostas FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: censo_rodadas atualizado_em; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON comercial.censo_rodadas FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: censo_temas atualizado_em; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON comercial.censo_temas FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: contatos atualizado_em; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON comercial.contatos FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: faixas_evento atualizado_em; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON comercial.faixas_evento FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: ficha_dados atualizado_em; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON comercial.ficha_dados FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: fichas atualizado_em; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON comercial.fichas FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: fontes_de_para atualizado_em; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON comercial.fontes_de_para FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: importacoes atualizado_em; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON comercial.importacoes FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: kit_documentos atualizado_em; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON comercial.kit_documentos FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: kit_versoes atualizado_em; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON comercial.kit_versoes FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: listas atualizado_em; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON comercial.listas FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: parametros atualizado_em; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON comercial.parametros FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: pesquisa_imoveis atualizado_em; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON comercial.pesquisa_imoveis FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: propostas_evento atualizado_em; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON comercial.propostas_evento FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: tipos_luc atualizado_em; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON comercial.tipos_luc FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: censo_sugestao_temas auditoria; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON comercial.censo_sugestao_temas FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: censo_temas auditoria; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON comercial.censo_temas FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: faixas_evento auditoria; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON comercial.faixas_evento FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: fontes_de_para auditoria; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON comercial.fontes_de_para FOR EACH ROW EXECUTE FUNCTION core.auditar('fonte_rd');


--
-- Name: importacoes auditoria; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON comercial.importacoes FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: kit_documentos auditoria; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON comercial.kit_documentos FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: kit_versoes auditoria; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON comercial.kit_versoes FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: listas auditoria; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON comercial.listas FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: parametros auditoria; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON comercial.parametros FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: pesquisa_imoveis auditoria; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON comercial.pesquisa_imoveis FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: propostas_evento auditoria; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON comercial.propostas_evento FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: tipos_luc auditoria; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON comercial.tipos_luc FOR EACH ROW EXECUTE FUNCTION core.auditar('tipo');


--
-- Name: censo_respostas conferir; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER conferir BEFORE INSERT OR UPDATE ON comercial.censo_respostas FOR EACH ROW EXECUTE FUNCTION comercial.censo_resposta_conferir();


--
-- Name: contratos conferir; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER conferir BEFORE INSERT OR UPDATE ON comercial.contratos FOR EACH ROW EXECUTE FUNCTION comercial.contrato_conferir();


--
-- Name: censo_sugestao_temas movida; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER movida BEFORE UPDATE ON comercial.censo_sugestao_temas FOR EACH ROW EXECUTE FUNCTION comercial.sugestao_movida();


--
-- Name: kit_versoes nova_versao; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER nova_versao BEFORE INSERT ON comercial.kit_versoes FOR EACH ROW EXECUTE FUNCTION comercial.kit_nova_versao();


--
-- Name: contratos registrar_versao; Type: TRIGGER; Schema: comercial; Owner: -
--

CREATE TRIGGER registrar_versao AFTER INSERT OR UPDATE ON comercial.contratos FOR EACH ROW EXECUTE FUNCTION comercial.contrato_registrar_versao();


--
-- Name: cargos atualizado_em; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON core.cargos FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: empresa atualizado_em; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON core.empresa FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: importacoes atualizado_em; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON core.importacoes FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: metas atualizado_em; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON core.metas FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: preferencias atualizado_em; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON core.preferencias FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: usuarios atualizado_em; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON core.usuarios FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: cargo_permissoes auditoria; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON core.cargo_permissoes FOR EACH ROW EXECUTE FUNCTION core.auditar('cargo_id', 'permissao');


--
-- Name: cargos auditoria; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON core.cargos FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: empresa auditoria; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER auditoria AFTER UPDATE ON core.empresa FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: importacoes auditoria; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON core.importacoes FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: metas auditoria; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON core.metas FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: usuario_permissoes auditoria; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON core.usuario_permissoes FOR EACH ROW EXECUTE FUNCTION core.auditar('usuario_id', 'permissao');


--
-- Name: usuarios auditoria; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER auditoria AFTER DELETE OR UPDATE ON core.usuarios FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: cargo_permissoes um_administrador; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER um_administrador AFTER DELETE ON core.cargo_permissoes FOR EACH STATEMENT EXECUTE FUNCTION core.garantir_um_administrador();


--
-- Name: cargos um_administrador; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER um_administrador AFTER UPDATE OF ativo ON core.cargos FOR EACH STATEMENT EXECUTE FUNCTION core.garantir_um_administrador();


--
-- Name: usuario_permissoes um_administrador; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER um_administrador AFTER DELETE ON core.usuario_permissoes FOR EACH STATEMENT EXECUTE FUNCTION core.garantir_um_administrador();


--
-- Name: usuarios um_administrador; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER um_administrador AFTER DELETE OR UPDATE OF ativo, cargo_id ON core.usuarios FOR EACH STATEMENT EXECUTE FUNCTION core.garantir_um_administrador();


--
-- Name: estacionamento_movimento atualizado_em; Type: TRIGGER; Schema: financeiro; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON financeiro.estacionamento_movimento FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: estacionamento_pagamentos atualizado_em; Type: TRIGGER; Schema: financeiro; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON financeiro.estacionamento_pagamentos FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: formularios atualizado_em; Type: TRIGGER; Schema: formularios; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON formularios.formularios FOR EACH ROW WHEN (((to_jsonb(old.*) - ARRAY['total_respostas'::text, 'ultima_resposta_em'::text, 'atualizado_em'::text]) IS DISTINCT FROM (to_jsonb(new.*) - ARRAY['total_respostas'::text, 'ultima_resposta_em'::text, 'atualizado_em'::text]))) EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: formularios auditoria; Type: TRIGGER; Schema: formularios; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE ON formularios.formularios FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: formularios auditoria_edicao; Type: TRIGGER; Schema: formularios; Owner: -
--

CREATE TRIGGER auditoria_edicao AFTER UPDATE ON formularios.formularios FOR EACH ROW WHEN (((to_jsonb(old.*) - ARRAY['total_respostas'::text, 'ultima_resposta_em'::text, 'atualizado_em'::text]) IS DISTINCT FROM (to_jsonb(new.*) - ARRAY['total_respostas'::text, 'ultima_resposta_em'::text, 'atualizado_em'::text]))) EXECUTE FUNCTION core.auditar('id');


--
-- Name: respostas descontar; Type: TRIGGER; Schema: formularios; Owner: -
--

CREATE TRIGGER descontar AFTER DELETE ON formularios.respostas FOR EACH ROW EXECUTE FUNCTION formularios.descontar_resposta();


--
-- Name: benchmark atualizado_em; Type: TRIGGER; Schema: marketing; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON marketing.benchmark FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: landing_pages atualizado_em; Type: TRIGGER; Schema: marketing; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON marketing.landing_pages FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: locatarios atualizado_em; Type: TRIGGER; Schema: marketing; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON marketing.locatarios FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: parametros atualizado_em; Type: TRIGGER; Schema: marketing; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON marketing.parametros FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: regras_alerta atualizado_em; Type: TRIGGER; Schema: marketing; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON marketing.regras_alerta FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: ronda_codigos atualizado_em; Type: TRIGGER; Schema: marketing; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON marketing.ronda_codigos FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: temas atualizado_em; Type: TRIGGER; Schema: marketing; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON marketing.temas FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: benchmark auditoria; Type: TRIGGER; Schema: marketing; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON marketing.benchmark FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: landing_pages auditoria; Type: TRIGGER; Schema: marketing; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON marketing.landing_pages FOR EACH ROW EXECUTE FUNCTION core.auditar('identificador');


--
-- Name: locatarios auditoria; Type: TRIGGER; Schema: marketing; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON marketing.locatarios FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: marca_arquivos auditoria; Type: TRIGGER; Schema: marketing; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON marketing.marca_arquivos FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: parametros auditoria; Type: TRIGGER; Schema: marketing; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON marketing.parametros FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: regras_alerta auditoria; Type: TRIGGER; Schema: marketing; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON marketing.regras_alerta FOR EACH ROW EXECUTE FUNCTION core.auditar('regra');


--
-- Name: ronda_codigos auditoria; Type: TRIGGER; Schema: marketing; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON marketing.ronda_codigos FOR EACH ROW EXECUTE FUNCTION core.auditar('codigo');


--
-- Name: temas auditoria; Type: TRIGGER; Schema: marketing; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON marketing.temas FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: marca_blocos nova_versao; Type: TRIGGER; Schema: marketing; Owner: -
--

CREATE TRIGGER nova_versao BEFORE UPDATE ON marketing.marca_blocos FOR EACH ROW EXECUTE FUNCTION marketing.marca_nova_versao();


--
-- Name: marca_blocos registrar_versao; Type: TRIGGER; Schema: marketing; Owner: -
--

CREATE TRIGGER registrar_versao AFTER INSERT OR UPDATE ON marketing.marca_blocos FOR EACH ROW EXECUTE FUNCTION marketing.marca_registrar_versao();


--
-- Name: agua_contas atualizado_em; Type: TRIGGER; Schema: operacoes; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON operacoes.agua_contas FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: caixas atualizado_em; Type: TRIGGER; Schema: operacoes; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON operacoes.caixas FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: hidrometros atualizado_em; Type: TRIGGER; Schema: operacoes; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON operacoes.hidrometros FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: limpeza_meses atualizado_em; Type: TRIGGER; Schema: operacoes; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON operacoes.limpeza_meses FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: parametros atualizado_em; Type: TRIGGER; Schema: operacoes; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON operacoes.parametros FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: quadros atualizado_em; Type: TRIGGER; Schema: operacoes; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON operacoes.quadros FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: salas atualizado_em; Type: TRIGGER; Schema: operacoes; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON operacoes.salas FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: agua_contas auditoria; Type: TRIGGER; Schema: operacoes; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON operacoes.agua_contas FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: agua_leituras auditoria; Type: TRIGGER; Schema: operacoes; Owner: -
--

CREATE TRIGGER auditoria AFTER UPDATE ON operacoes.agua_leituras FOR EACH ROW WHEN ((old.vigente AND new.vigente)) EXECUTE FUNCTION core.auditar('id');


--
-- Name: agua_valores auditoria; Type: TRIGGER; Schema: operacoes; Owner: -
--

CREATE TRIGGER auditoria AFTER UPDATE ON operacoes.agua_valores FOR EACH ROW WHEN ((old.valor IS DISTINCT FROM new.valor)) EXECUTE FUNCTION core.auditar('leitura_id');


--
-- Name: agua_vinculos auditoria; Type: TRIGGER; Schema: operacoes; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON operacoes.agua_vinculos FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: caixas auditoria; Type: TRIGGER; Schema: operacoes; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON operacoes.caixas FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: hidrometros auditoria; Type: TRIGGER; Schema: operacoes; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON operacoes.hidrometros FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: importacoes auditoria; Type: TRIGGER; Schema: operacoes; Owner: -
--

CREATE TRIGGER auditoria AFTER UPDATE ON operacoes.importacoes FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: limpeza_meses auditoria; Type: TRIGGER; Schema: operacoes; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON operacoes.limpeza_meses FOR EACH ROW EXECUTE FUNCTION core.auditar('referencia');


--
-- Name: obra_realizado auditoria; Type: TRIGGER; Schema: operacoes; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON operacoes.obra_realizado FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: parametros auditoria; Type: TRIGGER; Schema: operacoes; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON operacoes.parametros FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: quadros auditoria; Type: TRIGGER; Schema: operacoes; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON operacoes.quadros FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: salas auditoria; Type: TRIGGER; Schema: operacoes; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON operacoes.salas FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: termos auditoria; Type: TRIGGER; Schema: operacoes; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON operacoes.termos FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: agua_leituras auditoria_exclusao; Type: TRIGGER; Schema: operacoes; Owner: -
--

CREATE TRIGGER auditoria_exclusao AFTER DELETE ON operacoes.agua_leituras FOR EACH ROW WHEN (old.vigente) EXECUTE FUNCTION core.auditar('id');


--
-- Name: importacoes energia_vigente; Type: TRIGGER; Schema: operacoes; Owner: -
--

CREATE TRIGGER energia_vigente AFTER UPDATE OF status ON operacoes.importacoes FOR EACH ROW WHEN (((new.tipo = 'energisa'::text) AND (old.status IS DISTINCT FROM new.status))) EXECUTE FUNCTION operacoes.energia_importacao_status();


--
-- Name: caixas termo_externo; Type: TRIGGER; Schema: operacoes; Owner: -
--

CREATE TRIGGER termo_externo BEFORE UPDATE OF ocupante ON operacoes.caixas FOR EACH ROW EXECUTE FUNCTION operacoes.caixa_sem_termo_externo();


--
-- Name: energia_faturas vigente; Type: TRIGGER; Schema: operacoes; Owner: -
--

CREATE TRIGGER vigente BEFORE INSERT ON operacoes.energia_faturas FOR EACH ROW EXECUTE FUNCTION operacoes.energia_fatura_vigente();


--
-- Name: chamados ativo_baixado; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER ativo_baixado BEFORE INSERT OR UPDATE OF ativo_id ON os.chamados FOR EACH ROW EXECUTE FUNCTION os.recusar_ativo_baixado();


--
-- Name: ordens ativo_baixado; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER ativo_baixado BEFORE INSERT OR UPDATE OF ativo_id ON os.ordens FOR EACH ROW EXECUTE FUNCTION os.recusar_ativo_baixado();


--
-- Name: agendamentos atualizado_em; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON os.agendamentos FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: agendas atualizado_em; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON os.agendas FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: ativo_categorias atualizado_em; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON os.ativo_categorias FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: ativos atualizado_em; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON os.ativos FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: categorias atualizado_em; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON os.categorias FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: chamados atualizado_em; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON os.chamados FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: contatos atualizado_em; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON os.contatos FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: destinatarios atualizado_em; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON os.destinatarios FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: empresas atualizado_em; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON os.empresas FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: lojas atualizado_em; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON os.lojas FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: metas atualizado_em; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON os.metas FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: modelo_itens atualizado_em; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON os.modelo_itens FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: modelos atualizado_em; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON os.modelos FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: ordens atualizado_em; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON os.ordens FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: os_custos atualizado_em; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON os.os_custos FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: parametros atualizado_em; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON os.parametros FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: planos_preventivos atualizado_em; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON os.planos_preventivos FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: profissionais atualizado_em; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON os.profissionais FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: sessoes atualizado_em; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON os.sessoes FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: setores atualizado_em; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON os.setores FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: tecnicos atualizado_em; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON os.tecnicos FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: vistoria_ambientes atualizado_em; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON os.vistoria_ambientes FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: vistorias atualizado_em; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON os.vistorias FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: agenda_bloqueios auditoria; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON os.agenda_bloqueios FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: agendas auditoria; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON os.agendas FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: ativo_categorias auditoria; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON os.ativo_categorias FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: ativo_saidas auditoria; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON os.ativo_saidas FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: ativos auditoria; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON os.ativos FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: categorias auditoria; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON os.categorias FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: chamados auditoria; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON os.chamados FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: contatos auditoria; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON os.contatos FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: empresas auditoria; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON os.empresas FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: feriados auditoria; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON os.feriados FOR EACH ROW EXECUTE FUNCTION core.auditar('data');


--
-- Name: lojas auditoria; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON os.lojas FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: material_valores auditoria; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON os.material_valores FOR EACH ROW EXECUTE FUNCTION core.auditar('material_id');


--
-- Name: metas auditoria; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON os.metas FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: modelo_itens auditoria; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON os.modelo_itens FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: modelos auditoria; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON os.modelos FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: ordens auditoria; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON os.ordens FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: os_custos auditoria; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON os.os_custos FOR EACH ROW EXECUTE FUNCTION core.auditar('ordem_id');


--
-- Name: parametros auditoria; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER auditoria AFTER UPDATE ON os.parametros FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: planos_preventivos auditoria; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON os.planos_preventivos FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: profissionais auditoria; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON os.profissionais FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: setor_membros auditoria; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON os.setor_membros FOR EACH ROW EXECUTE FUNCTION core.auditar('setor_id', 'usuario_id');


--
-- Name: setores auditoria; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON os.setores FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: tecnico_valores auditoria; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON os.tecnico_valores FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: tecnicos auditoria; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON os.tecnicos FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: vistorias auditoria; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON os.vistorias FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: chamados ciclo; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER ciclo BEFORE UPDATE OF status ON os.chamados FOR EACH ROW EXECUTE FUNCTION os.ciclo_do_chamado();


--
-- Name: destinatarios ciclo; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER ciclo BEFORE UPDATE OF status ON os.destinatarios FOR EACH ROW EXECUTE FUNCTION os.ciclo_do_destino();


--
-- Name: ordens ciclo; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER ciclo BEFORE UPDATE OF status ON os.ordens FOR EACH ROW EXECUTE FUNCTION os.ciclo_do_chamado();


--
-- Name: ordens liberar_ativo; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER liberar_ativo AFTER UPDATE OF status ON os.ordens FOR EACH ROW EXECUTE FUNCTION os.liberar_ativo_da_os();


--
-- Name: chamados limpar_campos_de_modulo; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER limpar_campos_de_modulo BEFORE INSERT ON os.chamados FOR EACH ROW EXECUTE FUNCTION os.limpar_campos_de_modulo();


--
-- Name: ordens limpar_campos_de_modulo; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER limpar_campos_de_modulo BEFORE INSERT ON os.ordens FOR EACH ROW EXECUTE FUNCTION os.limpar_campos_de_modulo();


--
-- Name: ativos manter_baixa_da_saida; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER manter_baixa_da_saida BEFORE UPDATE OF situacao ON os.ativos FOR EACH ROW EXECUTE FUNCTION os.manter_baixa_da_saida();


--
-- Name: ativo_saidas pausar_planos; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER pausar_planos BEFORE INSERT ON os.ativo_saidas FOR EACH ROW EXECUTE FUNCTION os.pausar_planos_na_saida();


--
-- Name: agenda_bloqueios remarcar; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER remarcar AFTER INSERT ON os.agenda_bloqueios FOR EACH ROW EXECUTE FUNCTION os.remarcar_bloqueados();


--
-- Name: destinatarios respeitar_ordem; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER respeitar_ordem BEFORE UPDATE OF status ON os.destinatarios FOR EACH ROW EXECUTE FUNCTION os.respeitar_ordem_do_destino();


--
-- Name: destinatarios sincronizar; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER sincronizar AFTER UPDATE OF status ON os.destinatarios FOR EACH ROW EXECUTE FUNCTION os.sincronizar_destinos();


--
-- Name: ativos situacao; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER situacao AFTER INSERT OR UPDATE OF situacao ON os.ativos FOR EACH ROW EXECUTE FUNCTION os.registrar_situacao_ativo();


--
-- Name: destinatarios travar_destino_externo; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER travar_destino_externo BEFORE UPDATE OF status ON os.destinatarios FOR EACH ROW EXECUTE FUNCTION os.travar_destino_externo();


--
-- Name: categorias validar; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER validar BEFORE INSERT OR UPDATE ON os.categorias FOR EACH ROW EXECUTE FUNCTION os.validar_categoria();


--
-- Name: chamados validar; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER validar BEFORE UPDATE ON os.chamados FOR EACH ROW EXECUTE FUNCTION os.validar_chamado();


--
-- Name: ordens validar; Type: TRIGGER; Schema: os; Owner: -
--

CREATE TRIGGER validar BEFORE UPDATE ON os.ordens FOR EACH ROW EXECUTE FUNCTION os.validar_chamado();


--
-- Name: afastamentos atualizado_em; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON rh.afastamentos FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: banco_horas_ciclos atualizado_em; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON rh.banco_horas_ciclos FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: banco_horas_fechamentos atualizado_em; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON rh.banco_horas_fechamentos FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: beneficio_contratos atualizado_em; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON rh.beneficio_contratos FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: beneficio_totais_mensais atualizado_em; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON rh.beneficio_totais_mensais FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: beneficio_valores_mensais atualizado_em; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON rh.beneficio_valores_mensais FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: beneficios atualizado_em; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON rh.beneficios FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: cargos atualizado_em; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON rh.cargos FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: categorias_gasto atualizado_em; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON rh.categorias_gasto FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: colaborador_beneficios atualizado_em; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON rh.colaborador_beneficios FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: colaboradores atualizado_em; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON rh.colaboradores FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: dados_financeiros_mensais atualizado_em; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON rh.dados_financeiros_mensais FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: departamentos atualizado_em; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON rh.departamentos FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: dependentes atualizado_em; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON rh.dependentes FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: encargos_por_contrato atualizado_em; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON rh.encargos_por_contrato FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: folhas atualizado_em; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON rh.folhas FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: gastos atualizado_em; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON rh.gastos FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: jornadas atualizado_em; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON rh.jornadas FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: motivos_desligamento atualizado_em; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON rh.motivos_desligamento FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: notas_pj atualizado_em; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON rh.notas_pj FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: orcamentos_anuais atualizado_em; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON rh.orcamentos_anuais FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: parametros_empresa atualizado_em; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON rh.parametros_empresa FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: parametros_turnover atualizado_em; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON rh.parametros_turnover FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: plano_tabelas atualizado_em; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON rh.plano_tabelas FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: ponto_diario atualizado_em; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON rh.ponto_diario FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: ponto_mensal atualizado_em; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON rh.ponto_mensal FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: rubricas atualizado_em; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON rh.rubricas FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: valores_pj atualizado_em; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON rh.valores_pj FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: banco_horas_ciclos auditoria; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON rh.banco_horas_ciclos FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: banco_horas_fechamentos auditoria; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON rh.banco_horas_fechamentos FOR EACH ROW EXECUTE FUNCTION core.auditar('ciclo_id', 'colaborador_id');


--
-- Name: beneficio_contratos auditoria; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON rh.beneficio_contratos FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: beneficio_totais_mensais auditoria; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON rh.beneficio_totais_mensais FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: beneficio_valores_mensais auditoria; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON rh.beneficio_valores_mensais FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: beneficios auditoria; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON rh.beneficios FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: categorias_gasto auditoria; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON rh.categorias_gasto FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: colaborador_beneficios auditoria; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON rh.colaborador_beneficios FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: dados_financeiros_mensais auditoria; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON rh.dados_financeiros_mensais FOR EACH ROW EXECUTE FUNCTION core.auditar('competencia');


--
-- Name: departamentos auditoria; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON rh.departamentos FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: encargos_por_contrato auditoria; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON rh.encargos_por_contrato FOR EACH ROW EXECUTE FUNCTION core.auditar('tipo_contrato', 'vigente_desde');


--
-- Name: gastos auditoria; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON rh.gastos FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: jornadas auditoria; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON rh.jornadas FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: motivos_desligamento auditoria; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON rh.motivos_desligamento FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: orcamentos_anuais auditoria; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON rh.orcamentos_anuais FOR EACH ROW EXECUTE FUNCTION core.auditar('ano');


--
-- Name: parametros_empresa auditoria; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON rh.parametros_empresa FOR EACH ROW EXECUTE FUNCTION core.auditar('vigente_desde');


--
-- Name: parametros_turnover auditoria; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON rh.parametros_turnover FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: plano_faixas_etarias auditoria; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON rh.plano_faixas_etarias FOR EACH ROW EXECUTE FUNCTION core.auditar('tabela_id', 'idade_min');


--
-- Name: plano_tabelas auditoria; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON rh.plano_tabelas FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: rubricas auditoria; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON rh.rubricas FOR EACH ROW EXECUTE FUNCTION core.auditar('codigo');


--
-- Name: colaboradores auditoria_fora_do_ponto; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER auditoria_fora_do_ponto AFTER UPDATE OF fora_do_ponto ON rh.colaboradores FOR EACH ROW WHEN ((old.fora_do_ponto IS DISTINCT FROM new.fora_do_ponto)) EXECUTE FUNCTION core.auditar('id');


--
-- Name: banco_horas_ciclos conferir; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER conferir BEFORE INSERT OR DELETE OR UPDATE ON rh.banco_horas_ciclos FOR EACH ROW EXECUTE FUNCTION rh.conferir_ciclo_banco();


--
-- Name: gastos conferir; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER conferir BEFORE INSERT OR DELETE OR UPDATE ON rh.gastos FOR EACH ROW EXECUTE FUNCTION rh.conferir_gasto();


--
-- Name: banco_horas_fechamentos travar; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER travar BEFORE INSERT OR DELETE OR UPDATE ON rh.banco_horas_fechamentos FOR EACH ROW EXECUTE FUNCTION rh.travar_fechamento_banco();


--
-- Name: orcamentos_anuais travar; Type: TRIGGER; Schema: rh; Owner: -
--

CREATE TRIGGER travar BEFORE DELETE OR UPDATE ON rh.orcamentos_anuais FOR EACH ROW EXECUTE FUNCTION rh.travar_orcamento_finalizado();


--
-- Name: coletores atualizado_em; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON sustentabilidade.coletores FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: contratos atualizado_em; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON sustentabilidade.contratos FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: entrevistas atualizado_em; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON sustentabilidade.entrevistas FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: equivalencias atualizado_em; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON sustentabilidade.equivalencias FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: formularios atualizado_em; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON sustentabilidade.formularios FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: lancamentos atualizado_em; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON sustentabilidade.lancamentos FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: marcos atualizado_em; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON sustentabilidade.marcos FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: parametros atualizado_em; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON sustentabilidade.parametros FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: parametros_valores atualizado_em; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON sustentabilidade.parametros_valores FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: participante_contatos atualizado_em; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON sustentabilidade.participante_contatos FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: participante_valores atualizado_em; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON sustentabilidade.participante_valores FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: participantes atualizado_em; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON sustentabilidade.participantes FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: programa_contatos atualizado_em; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON sustentabilidade.programa_contatos FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: programa_indicadores atualizado_em; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON sustentabilidade.programa_indicadores FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: programas atualizado_em; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON sustentabilidade.programas FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: rcc_notas atualizado_em; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON sustentabilidade.rcc_notas FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: rondas atualizado_em; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON sustentabilidade.rondas FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: setor_validades atualizado_em; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER atualizado_em BEFORE UPDATE ON sustentabilidade.setor_validades FOR EACH ROW EXECUTE FUNCTION core.set_atualizado_em();


--
-- Name: acoes auditoria; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON sustentabilidade.acoes FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: coletores auditoria; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON sustentabilidade.coletores FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: consolidado_valores auditoria; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON sustentabilidade.consolidado_valores FOR EACH ROW EXECUTE FUNCTION core.auditar('ano');


--
-- Name: consolidados auditoria; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON sustentabilidade.consolidados FOR EACH ROW EXECUTE FUNCTION core.auditar('ano');


--
-- Name: contratos auditoria; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria AFTER UPDATE OF ativacao_corrigida, ativacao_corrigida_motivo, validade_meses_especifica, dispensada_motivo ON sustentabilidade.contratos FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: contribuicao_valores auditoria; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON sustentabilidade.contribuicao_valores FOR EACH ROW EXECUTE FUNCTION core.auditar('contribuicao_id');


--
-- Name: contribuicoes auditoria; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON sustentabilidade.contribuicoes FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: entrevistas auditoria; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria AFTER UPDATE ON sustentabilidade.entrevistas FOR EACH ROW WHEN (((old.situacao = 'salva'::text) OR (new.situacao = 'salva'::text))) EXECUTE FUNCTION core.auditar('id');


--
-- Name: equivalencias auditoria; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON sustentabilidade.equivalencias FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: formulario_versoes auditoria; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT ON sustentabilidade.formulario_versoes FOR EACH ROW EXECUTE FUNCTION core.auditar('formulario_id', 'versao');


--
-- Name: formularios auditoria; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE OF nome, ativo, versao_publicada ON sustentabilidade.formularios FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: importacoes auditoria; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria AFTER UPDATE ON sustentabilidade.importacoes FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: lancamento_valores auditoria; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria AFTER DELETE OR UPDATE ON sustentabilidade.lancamento_valores FOR EACH ROW EXECUTE FUNCTION core.auditar('lancamento_id');


--
-- Name: lancamentos auditoria; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria AFTER DELETE OR UPDATE ON sustentabilidade.lancamentos FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: marcos auditoria; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON sustentabilidade.marcos FOR EACH ROW EXECUTE FUNCTION core.auditar('indicador', 'ano');


--
-- Name: parametros auditoria; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON sustentabilidade.parametros FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: parametros_valores auditoria; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON sustentabilidade.parametros_valores FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: participante_contatos auditoria; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON sustentabilidade.participante_contatos FOR EACH ROW EXECUTE FUNCTION core.auditar('participante_id');


--
-- Name: participante_valores auditoria; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON sustentabilidade.participante_valores FOR EACH ROW EXECUTE FUNCTION core.auditar('participante_id');


--
-- Name: participantes auditoria; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON sustentabilidade.participantes FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: programa_contatos auditoria; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON sustentabilidade.programa_contatos FOR EACH ROW EXECUTE FUNCTION core.auditar('programa_id');


--
-- Name: programa_indicadores auditoria; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON sustentabilidade.programa_indicadores FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: programa_links auditoria; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON sustentabilidade.programa_links FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: programas auditoria; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON sustentabilidade.programas FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: rcc_fatores auditoria; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON sustentabilidade.rcc_fatores FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: rcc_nota_valores auditoria; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON sustentabilidade.rcc_nota_valores FOR EACH ROW EXECUTE FUNCTION core.auditar('nota_id');


--
-- Name: rcc_notas auditoria; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON sustentabilidade.rcc_notas FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: rcc_precos auditoria; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON sustentabilidade.rcc_precos FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: ronda_itens auditoria; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria AFTER DELETE OR UPDATE ON sustentabilidade.ronda_itens FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: rondas auditoria; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria AFTER DELETE OR UPDATE ON sustentabilidade.rondas FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: setor_validades auditoria; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON sustentabilidade.setor_validades FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: termos auditoria; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria AFTER INSERT OR DELETE OR UPDATE ON sustentabilidade.termos FOR EACH ROW EXECUTE FUNCTION core.auditar('id');


--
-- Name: entrevistas auditoria_exclusao; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER auditoria_exclusao AFTER DELETE ON sustentabilidade.entrevistas FOR EACH ROW WHEN ((old.situacao = 'salva'::text)) EXECUTE FUNCTION core.auditar('id');


--
-- Name: lancamentos do_programa; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER do_programa BEFORE INSERT OR UPDATE OF programa_id, formulario_id ON sustentabilidade.lancamentos FOR EACH ROW EXECUTE FUNCTION sustentabilidade.lancamento_do_programa();


--
-- Name: formulario_versoes imutavel; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER imutavel BEFORE DELETE OR UPDATE ON sustentabilidade.formulario_versoes FOR EACH ROW EXECUTE FUNCTION sustentabilidade.versao_imutavel();


--
-- Name: programa_links link_desligado_fica; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER link_desligado_fica BEFORE UPDATE OF desligado_em, desligado_por ON sustentabilidade.programa_links FOR EACH ROW EXECUTE FUNCTION sustentabilidade.link_desligado_fica();


--
-- Name: contratos marcar; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER marcar BEFORE UPDATE ON sustentabilidade.contratos FOR EACH ROW EXECUTE FUNCTION sustentabilidade.contratos_marcar();


--
-- Name: programas permissao; Type: TRIGGER; Schema: sustentabilidade; Owner: -
--

CREATE TRIGGER permissao AFTER INSERT OR DELETE OR UPDATE OF nome ON sustentabilidade.programas FOR EACH ROW EXECUTE FUNCTION sustentabilidade.programa_permissao();


--
-- Name: itens itens_concluido_por_fkey; Type: FK CONSTRAINT; Schema: calendario; Owner: -
--

ALTER TABLE ONLY calendario.itens
    ADD CONSTRAINT itens_concluido_por_fkey FOREIGN KEY (concluido_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: itens itens_criado_por_fkey; Type: FK CONSTRAINT; Schema: calendario; Owner: -
--

ALTER TABLE ONLY calendario.itens
    ADD CONSTRAINT itens_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: itens itens_responsavel_id_fkey; Type: FK CONSTRAINT; Schema: calendario; Owner: -
--

ALTER TABLE ONLY calendario.itens
    ADD CONSTRAINT itens_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: itens itens_tipo_id_fkey; Type: FK CONSTRAINT; Schema: calendario; Owner: -
--

ALTER TABLE ONLY calendario.itens
    ADD CONSTRAINT itens_tipo_id_fkey FOREIGN KEY (tipo_id) REFERENCES calendario.tipos(id) ON DELETE RESTRICT;


--
-- Name: censo_convites censo_convites_criado_por_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.censo_convites
    ADD CONSTRAINT censo_convites_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: censo_convites censo_convites_rodada_id_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.censo_convites
    ADD CONSTRAINT censo_convites_rodada_id_fkey FOREIGN KEY (rodada_id) REFERENCES comercial.censo_rodadas(id) ON DELETE CASCADE;


--
-- Name: censo_respostas censo_respostas_convite_id_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.censo_respostas
    ADD CONSTRAINT censo_respostas_convite_id_fkey FOREIGN KEY (convite_id) REFERENCES comercial.censo_convites(id) ON DELETE SET NULL;


--
-- Name: censo_respostas censo_respostas_importacao_id_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.censo_respostas
    ADD CONSTRAINT censo_respostas_importacao_id_fkey FOREIGN KEY (importacao_id) REFERENCES comercial.importacoes(id);


--
-- Name: censo_respostas censo_respostas_lancada_por_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.censo_respostas
    ADD CONSTRAINT censo_respostas_lancada_por_fkey FOREIGN KEY (lancada_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: censo_respostas censo_respostas_rodada_id_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.censo_respostas
    ADD CONSTRAINT censo_respostas_rodada_id_fkey FOREIGN KEY (rodada_id) REFERENCES comercial.censo_rodadas(id) ON DELETE CASCADE;


--
-- Name: censo_rodadas censo_rodadas_criada_por_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.censo_rodadas
    ADD CONSTRAINT censo_rodadas_criada_por_fkey FOREIGN KEY (criada_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: censo_rodadas censo_rodadas_encerrada_por_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.censo_rodadas
    ADD CONSTRAINT censo_rodadas_encerrada_por_fkey FOREIGN KEY (encerrada_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: censo_rodadas censo_rodadas_importacao_id_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.censo_rodadas
    ADD CONSTRAINT censo_rodadas_importacao_id_fkey FOREIGN KEY (importacao_id) REFERENCES comercial.importacoes(id);


--
-- Name: censo_sugestao_temas censo_sugestao_temas_contato_id_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.censo_sugestao_temas
    ADD CONSTRAINT censo_sugestao_temas_contato_id_fkey FOREIGN KEY (contato_id) REFERENCES comercial.contatos(id) ON DELETE CASCADE;


--
-- Name: censo_sugestao_temas censo_sugestao_temas_movido_por_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.censo_sugestao_temas
    ADD CONSTRAINT censo_sugestao_temas_movido_por_fkey FOREIGN KEY (movido_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: censo_sugestao_temas censo_sugestao_temas_resposta_id_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.censo_sugestao_temas
    ADD CONSTRAINT censo_sugestao_temas_resposta_id_fkey FOREIGN KEY (resposta_id) REFERENCES comercial.censo_respostas(id) ON DELETE CASCADE;


--
-- Name: censo_sugestao_temas censo_sugestao_temas_tema_id_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.censo_sugestao_temas
    ADD CONSTRAINT censo_sugestao_temas_tema_id_fkey FOREIGN KEY (tema_id) REFERENCES comercial.censo_temas(id) ON DELETE CASCADE;


--
-- Name: contatos contatos_importacao_id_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.contatos
    ADD CONSTRAINT contatos_importacao_id_fkey FOREIGN KEY (importacao_id) REFERENCES comercial.importacoes(id);


--
-- Name: contatos contatos_registrado_por_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.contatos
    ADD CONSTRAINT contatos_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: contrato_anexos contrato_anexos_contrato_id_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.contrato_anexos
    ADD CONSTRAINT contrato_anexos_contrato_id_fkey FOREIGN KEY (contrato_id) REFERENCES comercial.contratos(id) ON DELETE CASCADE;


--
-- Name: contrato_anexos contrato_anexos_enviado_por_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.contrato_anexos
    ADD CONSTRAINT contrato_anexos_enviado_por_fkey FOREIGN KEY (enviado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: contrato_kit contrato_kit_contrato_id_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.contrato_kit
    ADD CONSTRAINT contrato_kit_contrato_id_fkey FOREIGN KEY (contrato_id) REFERENCES comercial.contratos(id) ON DELETE CASCADE;


--
-- Name: contrato_kit contrato_kit_versao_id_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.contrato_kit
    ADD CONSTRAINT contrato_kit_versao_id_fkey FOREIGN KEY (versao_id) REFERENCES comercial.kit_versoes(id);


--
-- Name: contrato_versoes contrato_versoes_contrato_id_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.contrato_versoes
    ADD CONSTRAINT contrato_versoes_contrato_id_fkey FOREIGN KEY (contrato_id) REFERENCES comercial.contratos(id) ON DELETE CASCADE;


--
-- Name: contrato_versoes contrato_versoes_por_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.contrato_versoes
    ADD CONSTRAINT contrato_versoes_por_fkey FOREIGN KEY (por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: contratos contratos_atualizado_por_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.contratos
    ADD CONSTRAINT contratos_atualizado_por_fkey FOREIGN KEY (atualizado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: contratos contratos_criado_por_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.contratos
    ADD CONSTRAINT contratos_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: contratos contratos_ficha_id_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.contratos
    ADD CONSTRAINT contratos_ficha_id_fkey FOREIGN KEY (ficha_id) REFERENCES comercial.fichas(id) ON DELETE SET NULL;


--
-- Name: contratos contratos_gerado_por_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.contratos
    ADD CONSTRAINT contratos_gerado_por_fkey FOREIGN KEY (gerado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: ficha_acessos ficha_acessos_ficha_id_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.ficha_acessos
    ADD CONSTRAINT ficha_acessos_ficha_id_fkey FOREIGN KEY (ficha_id) REFERENCES comercial.fichas(id) ON DELETE CASCADE;


--
-- Name: ficha_acessos ficha_acessos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.ficha_acessos
    ADD CONSTRAINT ficha_acessos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES core.usuarios(id) ON DELETE CASCADE;


--
-- Name: ficha_dados ficha_dados_ficha_id_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.ficha_dados
    ADD CONSTRAINT ficha_dados_ficha_id_fkey FOREIGN KEY (ficha_id) REFERENCES comercial.fichas(id) ON DELETE CASCADE;


--
-- Name: ficha_documentos ficha_documentos_ficha_id_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.ficha_documentos
    ADD CONSTRAINT ficha_documentos_ficha_id_fkey FOREIGN KEY (ficha_id) REFERENCES comercial.fichas(id) ON DELETE CASCADE;


--
-- Name: fichas fichas_ficha_principal_id_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.fichas
    ADD CONSTRAINT fichas_ficha_principal_id_fkey FOREIGN KEY (ficha_principal_id) REFERENCES comercial.fichas(id) ON DELETE SET NULL;


--
-- Name: fichas fichas_gerada_por_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.fichas
    ADD CONSTRAINT fichas_gerada_por_fkey FOREIGN KEY (gerada_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: fichas fichas_importacao_id_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.fichas
    ADD CONSTRAINT fichas_importacao_id_fkey FOREIGN KEY (importacao_id) REFERENCES comercial.importacoes(id);


--
-- Name: importacoes importacoes_confirmado_por_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.importacoes
    ADD CONSTRAINT importacoes_confirmado_por_fkey FOREIGN KEY (confirmado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: importacoes importacoes_desfeito_por_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.importacoes
    ADD CONSTRAINT importacoes_desfeito_por_fkey FOREIGN KEY (desfeito_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: importacoes importacoes_enviado_por_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.importacoes
    ADD CONSTRAINT importacoes_enviado_por_fkey FOREIGN KEY (enviado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: kit_versoes kit_versoes_documento_id_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.kit_versoes
    ADD CONSTRAINT kit_versoes_documento_id_fkey FOREIGN KEY (documento_id) REFERENCES comercial.kit_documentos(id) ON DELETE CASCADE;


--
-- Name: kit_versoes kit_versoes_enviado_por_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.kit_versoes
    ADD CONSTRAINT kit_versoes_enviado_por_fkey FOREIGN KEY (enviado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: pesquisa_imoveis pesquisa_imoveis_criado_por_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.pesquisa_imoveis
    ADD CONSTRAINT pesquisa_imoveis_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: pesquisa_imoveis pesquisa_imoveis_importacao_id_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.pesquisa_imoveis
    ADD CONSTRAINT pesquisa_imoveis_importacao_id_fkey FOREIGN KEY (importacao_id) REFERENCES comercial.importacoes(id);


--
-- Name: propostas_evento propostas_evento_criado_por_fkey; Type: FK CONSTRAINT; Schema: comercial; Owner: -
--

ALTER TABLE ONLY comercial.propostas_evento
    ADD CONSTRAINT propostas_evento_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: cargo_permissoes cargo_permissoes_cargo_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cargo_permissoes
    ADD CONSTRAINT cargo_permissoes_cargo_id_fkey FOREIGN KEY (cargo_id) REFERENCES core.cargos(id) ON DELETE CASCADE;


--
-- Name: cargo_permissoes cargo_permissoes_permissao_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cargo_permissoes
    ADD CONSTRAINT cargo_permissoes_permissao_fkey FOREIGN KEY (permissao) REFERENCES core.permissoes(codigo) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: importacoes importacoes_confirmado_por_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.importacoes
    ADD CONSTRAINT importacoes_confirmado_por_fkey FOREIGN KEY (confirmado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: importacoes importacoes_enviado_por_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.importacoes
    ADD CONSTRAINT importacoes_enviado_por_fkey FOREIGN KEY (enviado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: preferencias preferencias_usuario_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.preferencias
    ADD CONSTRAINT preferencias_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES core.usuarios(id) ON DELETE CASCADE;


--
-- Name: usuario_permissoes usuario_permissoes_concedida_por_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.usuario_permissoes
    ADD CONSTRAINT usuario_permissoes_concedida_por_fkey FOREIGN KEY (concedida_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: usuario_permissoes usuario_permissoes_permissao_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.usuario_permissoes
    ADD CONSTRAINT usuario_permissoes_permissao_fkey FOREIGN KEY (permissao) REFERENCES core.permissoes(codigo) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: usuario_permissoes usuario_permissoes_usuario_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.usuario_permissoes
    ADD CONSTRAINT usuario_permissoes_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES core.usuarios(id) ON DELETE CASCADE;


--
-- Name: usuarios usuarios_cargo_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.usuarios
    ADD CONSTRAINT usuarios_cargo_id_fkey FOREIGN KEY (cargo_id) REFERENCES core.cargos(id) ON DELETE SET NULL;


--
-- Name: usuarios usuarios_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.usuarios
    ADD CONSTRAINT usuarios_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: estacionamento_movimento estacionamento_movimento_sync_run_id_fkey; Type: FK CONSTRAINT; Schema: financeiro; Owner: -
--

ALTER TABLE ONLY financeiro.estacionamento_movimento
    ADD CONSTRAINT estacionamento_movimento_sync_run_id_fkey FOREIGN KEY (sync_run_id) REFERENCES integracao.sync_runs(id) ON DELETE SET NULL;


--
-- Name: estacionamento_pagamentos estacionamento_pagamentos_sync_run_id_fkey; Type: FK CONSTRAINT; Schema: financeiro; Owner: -
--

ALTER TABLE ONLY financeiro.estacionamento_pagamentos
    ADD CONSTRAINT estacionamento_pagamentos_sync_run_id_fkey FOREIGN KEY (sync_run_id) REFERENCES integracao.sync_runs(id) ON DELETE SET NULL;


--
-- Name: formularios formularios_criado_por_fkey; Type: FK CONSTRAINT; Schema: formularios; Owner: -
--

ALTER TABLE ONLY formularios.formularios
    ADD CONSTRAINT formularios_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: respostas respostas_formulario_id_fkey; Type: FK CONSTRAINT; Schema: formularios; Owner: -
--

ALTER TABLE ONLY formularios.respostas
    ADD CONSTRAINT respostas_formulario_id_fkey FOREIGN KEY (formulario_id) REFERENCES formularios.formularios(id) ON DELETE CASCADE;


--
-- Name: camera_contagens camera_contagens_deviceid_fkey; Type: FK CONSTRAINT; Schema: integracao; Owner: -
--

ALTER TABLE ONLY integracao.camera_contagens
    ADD CONSTRAINT camera_contagens_deviceid_fkey FOREIGN KEY (deviceid) REFERENCES integracao.cameras(deviceid) ON DELETE CASCADE;


--
-- Name: credenciais credenciais_configurado_por_fkey; Type: FK CONSTRAINT; Schema: integracao; Owner: -
--

ALTER TABLE ONLY integracao.credenciais
    ADD CONSTRAINT credenciais_configurado_por_fkey FOREIGN KEY (configurado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: registros_brutos registros_brutos_sync_run_id_fkey; Type: FK CONSTRAINT; Schema: integracao; Owner: -
--

ALTER TABLE ONLY integracao.registros_brutos
    ADD CONSTRAINT registros_brutos_sync_run_id_fkey FOREIGN KEY (sync_run_id) REFERENCES integracao.sync_runs(id) ON DELETE SET NULL;


--
-- Name: marca_arquivos marca_arquivos_enviado_por_fkey; Type: FK CONSTRAINT; Schema: marketing; Owner: -
--

ALTER TABLE ONLY marketing.marca_arquivos
    ADD CONSTRAINT marca_arquivos_enviado_por_fkey FOREIGN KEY (enviado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: marca_blocos marca_blocos_atualizado_por_fkey; Type: FK CONSTRAINT; Schema: marketing; Owner: -
--

ALTER TABLE ONLY marketing.marca_blocos
    ADD CONSTRAINT marca_blocos_atualizado_por_fkey FOREIGN KEY (atualizado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: marca_versoes marca_versoes_bloco_fkey; Type: FK CONSTRAINT; Schema: marketing; Owner: -
--

ALTER TABLE ONLY marketing.marca_versoes
    ADD CONSTRAINT marca_versoes_bloco_fkey FOREIGN KEY (bloco) REFERENCES marketing.marca_blocos(chave) ON DELETE CASCADE;


--
-- Name: marca_versoes marca_versoes_desfaz_fkey; Type: FK CONSTRAINT; Schema: marketing; Owner: -
--

ALTER TABLE ONLY marketing.marca_versoes
    ADD CONSTRAINT marca_versoes_desfaz_fkey FOREIGN KEY (desfaz) REFERENCES marketing.marca_versoes(id) ON DELETE SET NULL;


--
-- Name: marca_versoes marca_versoes_por_fkey; Type: FK CONSTRAINT; Schema: marketing; Owner: -
--

ALTER TABLE ONLY marketing.marca_versoes
    ADD CONSTRAINT marca_versoes_por_fkey FOREIGN KEY (por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: rd_conversoes rd_conversoes_contato_uuid_fkey; Type: FK CONSTRAINT; Schema: marketing; Owner: -
--

ALTER TABLE ONLY marketing.rd_conversoes
    ADD CONSTRAINT rd_conversoes_contato_uuid_fkey FOREIGN KEY (contato_uuid) REFERENCES marketing.rd_contatos(uuid) ON DELETE CASCADE;


--
-- Name: agua_contas agua_contas_importacao_id_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.agua_contas
    ADD CONSTRAINT agua_contas_importacao_id_fkey FOREIGN KEY (importacao_id) REFERENCES operacoes.importacoes(id) ON DELETE CASCADE;


--
-- Name: agua_leituras agua_leituras_importacao_id_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.agua_leituras
    ADD CONSTRAINT agua_leituras_importacao_id_fkey FOREIGN KEY (importacao_id) REFERENCES operacoes.importacoes(id) ON DELETE CASCADE;


--
-- Name: agua_valores agua_valores_leitura_id_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.agua_valores
    ADD CONSTRAINT agua_valores_leitura_id_fkey FOREIGN KEY (leitura_id) REFERENCES operacoes.agua_leituras(id) ON DELETE CASCADE;


--
-- Name: agua_vinculos agua_vinculos_criado_por_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.agua_vinculos
    ADD CONSTRAINT agua_vinculos_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: caixa_ocupantes caixa_ocupantes_caixa_id_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.caixa_ocupantes
    ADD CONSTRAINT caixa_ocupantes_caixa_id_fkey FOREIGN KEY (caixa_id) REFERENCES operacoes.caixas(id) ON DELETE CASCADE;


--
-- Name: caixa_ocupantes caixa_ocupantes_criado_por_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.caixa_ocupantes
    ADD CONSTRAINT caixa_ocupantes_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: caixas caixas_quadro_id_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.caixas
    ADD CONSTRAINT caixas_quadro_id_fkey FOREIGN KEY (quadro_id) REFERENCES operacoes.quadros(id) ON DELETE CASCADE;


--
-- Name: caixas caixas_sala_id_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.caixas
    ADD CONSTRAINT caixas_sala_id_fkey FOREIGN KEY (sala_id) REFERENCES operacoes.salas(id) ON DELETE SET NULL;


--
-- Name: diario_relatorios diario_relatorios_obra_id_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.diario_relatorios
    ADD CONSTRAINT diario_relatorios_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES operacoes.diario_obras(id) ON DELETE CASCADE;


--
-- Name: energia_fatura_itens energia_fatura_itens_fatura_id_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.energia_fatura_itens
    ADD CONSTRAINT energia_fatura_itens_fatura_id_fkey FOREIGN KEY (fatura_id) REFERENCES operacoes.energia_faturas(id) ON DELETE CASCADE;


--
-- Name: energia_faturas energia_faturas_importacao_id_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.energia_faturas
    ADD CONSTRAINT energia_faturas_importacao_id_fkey FOREIGN KEY (importacao_id) REFERENCES operacoes.importacoes(id) ON DELETE CASCADE;


--
-- Name: energia_faturas energia_faturas_importado_por_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.energia_faturas
    ADD CONSTRAINT energia_faturas_importado_por_fkey FOREIGN KEY (importado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: energia_faturas energia_faturas_matricula_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.energia_faturas
    ADD CONSTRAINT energia_faturas_matricula_fkey FOREIGN KEY (matricula) REFERENCES operacoes.energia_unidades(matricula) ON DELETE RESTRICT;


--
-- Name: hidrometros hidrometros_sala_id_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.hidrometros
    ADD CONSTRAINT hidrometros_sala_id_fkey FOREIGN KEY (sala_id) REFERENCES operacoes.salas(id) ON DELETE SET NULL;


--
-- Name: importacao_valores importacao_valores_importacao_id_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.importacao_valores
    ADD CONSTRAINT importacao_valores_importacao_id_fkey FOREIGN KEY (importacao_id) REFERENCES operacoes.importacoes(id) ON DELETE CASCADE;


--
-- Name: importacoes importacoes_confirmado_por_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.importacoes
    ADD CONSTRAINT importacoes_confirmado_por_fkey FOREIGN KEY (confirmado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: importacoes importacoes_criado_por_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.importacoes
    ADD CONSTRAINT importacoes_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: importacoes importacoes_desfeito_por_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.importacoes
    ADD CONSTRAINT importacoes_desfeito_por_fkey FOREIGN KEY (desfeito_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: importacoes importacoes_substitui_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.importacoes
    ADD CONSTRAINT importacoes_substitui_fkey FOREIGN KEY (substitui) REFERENCES operacoes.importacoes(id) ON DELETE SET NULL;


--
-- Name: limpeza_anexos limpeza_anexos_enviado_por_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.limpeza_anexos
    ADD CONSTRAINT limpeza_anexos_enviado_por_fkey FOREIGN KEY (enviado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: limpeza_anexos limpeza_anexos_referencia_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.limpeza_anexos
    ADD CONSTRAINT limpeza_anexos_referencia_fkey FOREIGN KEY (referencia) REFERENCES operacoes.limpeza_meses(referencia) ON DELETE CASCADE;


--
-- Name: limpeza_contrato limpeza_contrato_referencia_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.limpeza_contrato
    ADD CONSTRAINT limpeza_contrato_referencia_fkey FOREIGN KEY (referencia) REFERENCES operacoes.limpeza_meses(referencia) ON DELETE CASCADE;


--
-- Name: limpeza_equipe limpeza_equipe_referencia_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.limpeza_equipe
    ADD CONSTRAINT limpeza_equipe_referencia_fkey FOREIGN KEY (referencia) REFERENCES operacoes.limpeza_meses(referencia) ON DELETE CASCADE;


--
-- Name: limpeza_extras limpeza_extras_referencia_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.limpeza_extras
    ADD CONSTRAINT limpeza_extras_referencia_fkey FOREIGN KEY (referencia) REFERENCES operacoes.limpeza_meses(referencia) ON DELETE CASCADE;


--
-- Name: limpeza_meses limpeza_meses_criado_por_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.limpeza_meses
    ADD CONSTRAINT limpeza_meses_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: limpeza_meses limpeza_meses_enviado_por_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.limpeza_meses
    ADD CONSTRAINT limpeza_meses_enviado_por_fkey FOREIGN KEY (enviado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: limpeza_meses limpeza_meses_fechado_por_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.limpeza_meses
    ADD CONSTRAINT limpeza_meses_fechado_por_fkey FOREIGN KEY (fechado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: limpeza_meses limpeza_meses_importacao_id_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.limpeza_meses
    ADD CONSTRAINT limpeza_meses_importacao_id_fkey FOREIGN KEY (importacao_id) REFERENCES operacoes.importacoes(id) ON DELETE CASCADE;


--
-- Name: limpeza_meses limpeza_meses_reaberto_por_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.limpeza_meses
    ADD CONSTRAINT limpeza_meses_reaberto_por_fkey FOREIGN KEY (reaberto_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: limpeza_minutos limpeza_minutos_referencia_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.limpeza_minutos
    ADD CONSTRAINT limpeza_minutos_referencia_fkey FOREIGN KEY (referencia) REFERENCES operacoes.limpeza_meses(referencia) ON DELETE CASCADE;


--
-- Name: obra_realizado obra_realizado_importacao_id_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.obra_realizado
    ADD CONSTRAINT obra_realizado_importacao_id_fkey FOREIGN KEY (importacao_id) REFERENCES operacoes.importacoes(id) ON DELETE CASCADE;


--
-- Name: obra_realizado obra_realizado_lancado_por_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.obra_realizado
    ADD CONSTRAINT obra_realizado_lancado_por_fkey FOREIGN KEY (lancado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: obra_realizado obra_realizado_obra_id_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.obra_realizado
    ADD CONSTRAINT obra_realizado_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES operacoes.obras(id) ON DELETE CASCADE;


--
-- Name: orcamento_etapas orcamento_etapas_revisao_id_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.orcamento_etapas
    ADD CONSTRAINT orcamento_etapas_revisao_id_fkey FOREIGN KEY (revisao_id) REFERENCES operacoes.orcamento_revisoes(id) ON DELETE CASCADE;


--
-- Name: orcamento_previsto orcamento_previsto_etapa_id_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.orcamento_previsto
    ADD CONSTRAINT orcamento_previsto_etapa_id_fkey FOREIGN KEY (etapa_id) REFERENCES operacoes.orcamento_etapas(id) ON DELETE CASCADE;


--
-- Name: orcamento_revisoes orcamento_revisoes_importacao_id_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.orcamento_revisoes
    ADD CONSTRAINT orcamento_revisoes_importacao_id_fkey FOREIGN KEY (importacao_id) REFERENCES operacoes.importacoes(id) ON DELETE CASCADE;


--
-- Name: orcamento_revisoes orcamento_revisoes_obra_id_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.orcamento_revisoes
    ADD CONSTRAINT orcamento_revisoes_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES operacoes.obras(id) ON DELETE CASCADE;


--
-- Name: parametros parametros_atualizado_por_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.parametros
    ADD CONSTRAINT parametros_atualizado_por_fkey FOREIGN KEY (atualizado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: termos termos_caixa_id_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.termos
    ADD CONSTRAINT termos_caixa_id_fkey FOREIGN KEY (caixa_id) REFERENCES operacoes.caixas(id) ON DELETE CASCADE;


--
-- Name: termos termos_emitido_por_fkey; Type: FK CONSTRAINT; Schema: operacoes; Owner: -
--

ALTER TABLE ONLY operacoes.termos
    ADD CONSTRAINT termos_emitido_por_fkey FOREIGN KEY (emitido_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: agenda_bloqueios agenda_bloqueios_agenda_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.agenda_bloqueios
    ADD CONSTRAINT agenda_bloqueios_agenda_id_fkey FOREIGN KEY (agenda_id) REFERENCES os.agendas(id) ON DELETE CASCADE;


--
-- Name: agenda_bloqueios agenda_bloqueios_criado_por_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.agenda_bloqueios
    ADD CONSTRAINT agenda_bloqueios_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: agendamentos agendamentos_agenda_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.agendamentos
    ADD CONSTRAINT agendamentos_agenda_id_fkey FOREIGN KEY (agenda_id) REFERENCES os.agendas(id) ON DELETE CASCADE;


--
-- Name: agendamentos agendamentos_chamado_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.agendamentos
    ADD CONSTRAINT agendamentos_chamado_id_fkey FOREIGN KEY (chamado_id) REFERENCES os.chamados(id) ON DELETE CASCADE;


--
-- Name: agendamentos agendamentos_criado_por_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.agendamentos
    ADD CONSTRAINT agendamentos_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: agendamentos agendamentos_loja_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.agendamentos
    ADD CONSTRAINT agendamentos_loja_id_fkey FOREIGN KEY (loja_id) REFERENCES os.lojas(id) ON DELETE SET NULL;


--
-- Name: anexos anexos_ambiente_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.anexos
    ADD CONSTRAINT anexos_ambiente_id_fkey FOREIGN KEY (ambiente_id) REFERENCES os.vistoria_ambientes(id) ON DELETE CASCADE;


--
-- Name: anexos anexos_ativo_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.anexos
    ADD CONSTRAINT anexos_ativo_id_fkey FOREIGN KEY (ativo_id) REFERENCES os.ativos(id) ON DELETE CASCADE;


--
-- Name: anexos anexos_chamado_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.anexos
    ADD CONSTRAINT anexos_chamado_id_fkey FOREIGN KEY (chamado_id) REFERENCES os.chamados(id) ON DELETE CASCADE;


--
-- Name: anexos anexos_enviado_por_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.anexos
    ADD CONSTRAINT anexos_enviado_por_fkey FOREIGN KEY (enviado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: anexos anexos_evento_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.anexos
    ADD CONSTRAINT anexos_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES os.eventos(id) ON DELETE SET NULL;


--
-- Name: anexos anexos_ordem_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.anexos
    ADD CONSTRAINT anexos_ordem_id_fkey FOREIGN KEY (ordem_id) REFERENCES os.ordens(id) ON DELETE CASCADE;


--
-- Name: anexos anexos_vistoria_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.anexos
    ADD CONSTRAINT anexos_vistoria_id_fkey FOREIGN KEY (vistoria_id) REFERENCES os.vistorias(id) ON DELETE CASCADE;


--
-- Name: ativo_saidas ativo_saidas_ativo_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ativo_saidas
    ADD CONSTRAINT ativo_saidas_ativo_id_fkey FOREIGN KEY (ativo_id) REFERENCES os.ativos(id) ON DELETE CASCADE;


--
-- Name: ativo_saidas ativo_saidas_desfeita_por_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ativo_saidas
    ADD CONSTRAINT ativo_saidas_desfeita_por_fkey FOREIGN KEY (desfeita_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: ativo_saidas ativo_saidas_registrado_por_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ativo_saidas
    ADD CONSTRAINT ativo_saidas_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: ativo_saidas ativo_saidas_responsavel_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ativo_saidas
    ADD CONSTRAINT ativo_saidas_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: ativo_situacoes ativo_situacoes_ativo_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ativo_situacoes
    ADD CONSTRAINT ativo_situacoes_ativo_id_fkey FOREIGN KEY (ativo_id) REFERENCES os.ativos(id) ON DELETE CASCADE;


--
-- Name: ativos ativos_categoria_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ativos
    ADD CONSTRAINT ativos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES os.ativo_categorias(id) ON DELETE SET NULL;


--
-- Name: ativos ativos_fornecedor_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ativos
    ADD CONSTRAINT ativos_fornecedor_id_fkey FOREIGN KEY (fornecedor_id) REFERENCES os.empresas(id) ON DELETE SET NULL;


--
-- Name: ativos ativos_loja_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ativos
    ADD CONSTRAINT ativos_loja_id_fkey FOREIGN KEY (loja_id) REFERENCES os.lojas(id) ON DELETE SET NULL;


--
-- Name: ativos ativos_responsavel_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ativos
    ADD CONSTRAINT ativos_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: ativos ativos_setor_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ativos
    ADD CONSTRAINT ativos_setor_id_fkey FOREIGN KEY (setor_id) REFERENCES os.setores(id) ON DELETE SET NULL;


--
-- Name: categorias categorias_agenda_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.categorias
    ADD CONSTRAINT categorias_agenda_id_fkey FOREIGN KEY (agenda_id) REFERENCES os.agendas(id) ON DELETE SET NULL;


--
-- Name: categorias categorias_pai_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.categorias
    ADD CONSTRAINT categorias_pai_id_fkey FOREIGN KEY (pai_id) REFERENCES os.categorias(id) ON DELETE CASCADE;


--
-- Name: categorias categorias_responsavel_padrao_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.categorias
    ADD CONSTRAINT categorias_responsavel_padrao_id_fkey FOREIGN KEY (responsavel_padrao_id) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: categorias categorias_setor_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.categorias
    ADD CONSTRAINT categorias_setor_id_fkey FOREIGN KEY (setor_id) REFERENCES os.setores(id) ON DELETE CASCADE;


--
-- Name: ordem_profissionais chamado_profissionais_profissional_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ordem_profissionais
    ADD CONSTRAINT chamado_profissionais_profissional_id_fkey FOREIGN KEY (profissional_id) REFERENCES os.profissionais(id) ON DELETE CASCADE;


--
-- Name: chamados chamados_aberto_por_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.chamados
    ADD CONSTRAINT chamados_aberto_por_fkey FOREIGN KEY (aberto_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: chamados chamados_ambiente_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.chamados
    ADD CONSTRAINT chamados_ambiente_id_fkey FOREIGN KEY (ambiente_id) REFERENCES os.vistoria_ambientes(id) ON DELETE SET NULL;


--
-- Name: chamados chamados_ativo_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.chamados
    ADD CONSTRAINT chamados_ativo_id_fkey FOREIGN KEY (ativo_id) REFERENCES os.ativos(id) ON DELETE SET NULL;


--
-- Name: chamados chamados_cancelado_por_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.chamados
    ADD CONSTRAINT chamados_cancelado_por_fkey FOREIGN KEY (cancelado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: chamados chamados_categoria_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.chamados
    ADD CONSTRAINT chamados_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES os.categorias(id) ON DELETE SET NULL;


--
-- Name: chamados chamados_concluido_por_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.chamados
    ADD CONSTRAINT chamados_concluido_por_fkey FOREIGN KEY (concluido_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: chamados chamados_fechado_por_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.chamados
    ADD CONSTRAINT chamados_fechado_por_fkey FOREIGN KEY (fechado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: chamados chamados_loja_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.chamados
    ADD CONSTRAINT chamados_loja_id_fkey FOREIGN KEY (loja_id) REFERENCES os.lojas(id) ON DELETE SET NULL;


--
-- Name: chamados chamados_responsavel_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.chamados
    ADD CONSTRAINT chamados_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: chamados chamados_setor_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.chamados
    ADD CONSTRAINT chamados_setor_id_fkey FOREIGN KEY (setor_id) REFERENCES os.setores(id);


--
-- Name: chamados chamados_vinculado_a_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.chamados
    ADD CONSTRAINT chamados_vinculado_a_id_fkey FOREIGN KEY (vinculado_a_id) REFERENCES os.chamados(id) ON DELETE SET NULL;


--
-- Name: chamados chamados_vistoria_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.chamados
    ADD CONSTRAINT chamados_vistoria_id_fkey FOREIGN KEY (vistoria_id) REFERENCES os.vistorias(id) ON DELETE SET NULL;


--
-- Name: destinatarios destinatarios_chamado_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.destinatarios
    ADD CONSTRAINT destinatarios_chamado_id_fkey FOREIGN KEY (chamado_id) REFERENCES os.chamados(id) ON DELETE CASCADE;


--
-- Name: destinatarios destinatarios_concluido_por_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.destinatarios
    ADD CONSTRAINT destinatarios_concluido_por_fkey FOREIGN KEY (concluido_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: destinatarios destinatarios_ordem_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.destinatarios
    ADD CONSTRAINT destinatarios_ordem_id_fkey FOREIGN KEY (ordem_id) REFERENCES os.ordens(id) ON DELETE CASCADE;


--
-- Name: destinatarios destinatarios_responsavel_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.destinatarios
    ADD CONSTRAINT destinatarios_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: destinatarios destinatarios_setor_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.destinatarios
    ADD CONSTRAINT destinatarios_setor_id_fkey FOREIGN KEY (setor_id) REFERENCES os.setores(id) ON DELETE CASCADE;


--
-- Name: destinatarios destinatarios_usuario_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.destinatarios
    ADD CONSTRAINT destinatarios_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES core.usuarios(id) ON DELETE CASCADE;


--
-- Name: disparos disparos_chamado_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.disparos
    ADD CONSTRAINT disparos_chamado_id_fkey FOREIGN KEY (chamado_id) REFERENCES os.chamados(id) ON DELETE SET NULL;


--
-- Name: disparos disparos_disparado_por_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.disparos
    ADD CONSTRAINT disparos_disparado_por_fkey FOREIGN KEY (disparado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: disparos disparos_loja_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.disparos
    ADD CONSTRAINT disparos_loja_id_fkey FOREIGN KEY (loja_id) REFERENCES os.lojas(id) ON DELETE CASCADE;


--
-- Name: disparos disparos_modelo_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.disparos
    ADD CONSTRAINT disparos_modelo_id_fkey FOREIGN KEY (modelo_id) REFERENCES os.modelos(id) ON DELETE CASCADE;


--
-- Name: eventos eventos_autor_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.eventos
    ADD CONSTRAINT eventos_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: eventos eventos_chamado_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.eventos
    ADD CONSTRAINT eventos_chamado_id_fkey FOREIGN KEY (chamado_id) REFERENCES os.chamados(id) ON DELETE CASCADE;


--
-- Name: eventos eventos_ordem_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.eventos
    ADD CONSTRAINT eventos_ordem_id_fkey FOREIGN KEY (ordem_id) REFERENCES os.ordens(id) ON DELETE CASCADE;


--
-- Name: leituras leituras_chamado_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.leituras
    ADD CONSTRAINT leituras_chamado_id_fkey FOREIGN KEY (chamado_id) REFERENCES os.chamados(id) ON DELETE CASCADE;


--
-- Name: leituras leituras_usuario_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.leituras
    ADD CONSTRAINT leituras_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES core.usuarios(id) ON DELETE CASCADE;


--
-- Name: materiais materiais_criado_por_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.materiais
    ADD CONSTRAINT materiais_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: materiais materiais_ordem_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.materiais
    ADD CONSTRAINT materiais_ordem_id_fkey FOREIGN KEY (ordem_id) REFERENCES os.ordens(id) ON DELETE CASCADE;


--
-- Name: material_valores material_valores_material_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.material_valores
    ADD CONSTRAINT material_valores_material_id_fkey FOREIGN KEY (material_id) REFERENCES os.materiais(id) ON DELETE CASCADE;


--
-- Name: metas metas_categoria_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.metas
    ADD CONSTRAINT metas_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES os.categorias(id) ON DELETE CASCADE;


--
-- Name: metas metas_setor_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.metas
    ADD CONSTRAINT metas_setor_id_fkey FOREIGN KEY (setor_id) REFERENCES os.setores(id) ON DELETE CASCADE;


--
-- Name: modelo_itens modelo_itens_categoria_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.modelo_itens
    ADD CONSTRAINT modelo_itens_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES os.categorias(id) ON DELETE SET NULL;


--
-- Name: modelo_itens modelo_itens_modelo_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.modelo_itens
    ADD CONSTRAINT modelo_itens_modelo_id_fkey FOREIGN KEY (modelo_id) REFERENCES os.modelos(id) ON DELETE CASCADE;


--
-- Name: modelo_itens modelo_itens_responsavel_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.modelo_itens
    ADD CONSTRAINT modelo_itens_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: modelo_itens modelo_itens_setor_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.modelo_itens
    ADD CONSTRAINT modelo_itens_setor_id_fkey FOREIGN KEY (setor_id) REFERENCES os.setores(id) ON DELETE CASCADE;


--
-- Name: notificacoes notificacoes_chamado_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.notificacoes
    ADD CONSTRAINT notificacoes_chamado_id_fkey FOREIGN KEY (chamado_id) REFERENCES os.chamados(id) ON DELETE CASCADE;


--
-- Name: notificacoes notificacoes_ordem_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.notificacoes
    ADD CONSTRAINT notificacoes_ordem_id_fkey FOREIGN KEY (ordem_id) REFERENCES os.ordens(id) ON DELETE CASCADE;


--
-- Name: notificacoes notificacoes_usuario_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.notificacoes
    ADD CONSTRAINT notificacoes_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES core.usuarios(id) ON DELETE CASCADE;


--
-- Name: ordem_profissionais ordem_profissionais_ordem_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ordem_profissionais
    ADD CONSTRAINT ordem_profissionais_ordem_id_fkey FOREIGN KEY (ordem_id) REFERENCES os.ordens(id) ON DELETE CASCADE;


--
-- Name: ordens ordens_aberto_por_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ordens
    ADD CONSTRAINT ordens_aberto_por_fkey FOREIGN KEY (aberto_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: ordens ordens_ambiente_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ordens
    ADD CONSTRAINT ordens_ambiente_id_fkey FOREIGN KEY (ambiente_id) REFERENCES os.vistoria_ambientes(id) ON DELETE SET NULL;


--
-- Name: ordens ordens_ativo_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ordens
    ADD CONSTRAINT ordens_ativo_id_fkey FOREIGN KEY (ativo_id) REFERENCES os.ativos(id) ON DELETE SET NULL;


--
-- Name: ordens ordens_cancelado_por_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ordens
    ADD CONSTRAINT ordens_cancelado_por_fkey FOREIGN KEY (cancelado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: ordens ordens_categoria_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ordens
    ADD CONSTRAINT ordens_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES os.categorias(id) ON DELETE SET NULL;


--
-- Name: ordens ordens_concluido_por_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ordens
    ADD CONSTRAINT ordens_concluido_por_fkey FOREIGN KEY (concluido_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: ordens ordens_empresa_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ordens
    ADD CONSTRAINT ordens_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES os.empresas(id) ON DELETE SET NULL;


--
-- Name: ordens ordens_fechado_por_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ordens
    ADD CONSTRAINT ordens_fechado_por_fkey FOREIGN KEY (fechado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: ordens ordens_loja_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ordens
    ADD CONSTRAINT ordens_loja_id_fkey FOREIGN KEY (loja_id) REFERENCES os.lojas(id) ON DELETE SET NULL;


--
-- Name: ordens ordens_plano_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ordens
    ADD CONSTRAINT ordens_plano_id_fkey FOREIGN KEY (plano_id) REFERENCES os.planos_preventivos(id) ON DELETE SET NULL;


--
-- Name: ordens ordens_responsavel_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ordens
    ADD CONSTRAINT ordens_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: ordens ordens_setor_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ordens
    ADD CONSTRAINT ordens_setor_id_fkey FOREIGN KEY (setor_id) REFERENCES os.setores(id);


--
-- Name: ordens ordens_vinculado_a_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ordens
    ADD CONSTRAINT ordens_vinculado_a_id_fkey FOREIGN KEY (vinculado_a_id) REFERENCES os.chamados(id) ON DELETE SET NULL;


--
-- Name: ordens ordens_vistoria_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.ordens
    ADD CONSTRAINT ordens_vistoria_id_fkey FOREIGN KEY (vistoria_id) REFERENCES os.vistorias(id) ON DELETE SET NULL;


--
-- Name: os_custos os_custos_orcamento_aprovado_por_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.os_custos
    ADD CONSTRAINT os_custos_orcamento_aprovado_por_fkey FOREIGN KEY (orcamento_aprovado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: os_custos os_custos_ordem_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.os_custos
    ADD CONSTRAINT os_custos_ordem_id_fkey FOREIGN KEY (ordem_id) REFERENCES os.ordens(id) ON DELETE CASCADE;


--
-- Name: participantes participantes_chamado_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.participantes
    ADD CONSTRAINT participantes_chamado_id_fkey FOREIGN KEY (chamado_id) REFERENCES os.chamados(id) ON DELETE CASCADE;


--
-- Name: participantes participantes_ordem_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.participantes
    ADD CONSTRAINT participantes_ordem_id_fkey FOREIGN KEY (ordem_id) REFERENCES os.ordens(id) ON DELETE CASCADE;


--
-- Name: participantes participantes_usuario_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.participantes
    ADD CONSTRAINT participantes_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES core.usuarios(id) ON DELETE CASCADE;


--
-- Name: planos_preventivos planos_preventivos_ativo_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.planos_preventivos
    ADD CONSTRAINT planos_preventivos_ativo_id_fkey FOREIGN KEY (ativo_id) REFERENCES os.ativos(id) ON DELETE CASCADE;


--
-- Name: planos_preventivos planos_preventivos_categoria_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.planos_preventivos
    ADD CONSTRAINT planos_preventivos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES os.categorias(id) ON DELETE SET NULL;


--
-- Name: planos_preventivos planos_preventivos_responsavel_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.planos_preventivos
    ADD CONSTRAINT planos_preventivos_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: planos_preventivos planos_preventivos_setor_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.planos_preventivos
    ADD CONSTRAINT planos_preventivos_setor_id_fkey FOREIGN KEY (setor_id) REFERENCES os.setores(id) ON DELETE CASCADE;


--
-- Name: portal_links portal_links_cancelado_por_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.portal_links
    ADD CONSTRAINT portal_links_cancelado_por_fkey FOREIGN KEY (cancelado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: portal_links portal_links_criado_por_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.portal_links
    ADD CONSTRAINT portal_links_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: portal_links portal_links_loja_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.portal_links
    ADD CONSTRAINT portal_links_loja_id_fkey FOREIGN KEY (loja_id) REFERENCES os.lojas(id) ON DELETE CASCADE;


--
-- Name: portal_sessoes portal_sessoes_encerrado_por_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.portal_sessoes
    ADD CONSTRAINT portal_sessoes_encerrado_por_fkey FOREIGN KEY (encerrado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: portal_sessoes portal_sessoes_loja_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.portal_sessoes
    ADD CONSTRAINT portal_sessoes_loja_id_fkey FOREIGN KEY (loja_id) REFERENCES os.lojas(id) ON DELETE CASCADE;


--
-- Name: profissionais profissionais_empresa_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.profissionais
    ADD CONSTRAINT profissionais_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES os.empresas(id) ON DELETE CASCADE;


--
-- Name: sessao_tecnicos sessao_tecnicos_sessao_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.sessao_tecnicos
    ADD CONSTRAINT sessao_tecnicos_sessao_id_fkey FOREIGN KEY (sessao_id) REFERENCES os.sessoes(id) ON DELETE CASCADE;


--
-- Name: sessao_tecnicos sessao_tecnicos_tecnico_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.sessao_tecnicos
    ADD CONSTRAINT sessao_tecnicos_tecnico_id_fkey FOREIGN KEY (tecnico_id) REFERENCES os.tecnicos(id);


--
-- Name: sessoes sessoes_criado_por_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.sessoes
    ADD CONSTRAINT sessoes_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: sessoes sessoes_ordem_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.sessoes
    ADD CONSTRAINT sessoes_ordem_id_fkey FOREIGN KEY (ordem_id) REFERENCES os.ordens(id) ON DELETE CASCADE;


--
-- Name: setor_membros setor_membros_setor_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.setor_membros
    ADD CONSTRAINT setor_membros_setor_id_fkey FOREIGN KEY (setor_id) REFERENCES os.setores(id) ON DELETE CASCADE;


--
-- Name: setor_membros setor_membros_usuario_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.setor_membros
    ADD CONSTRAINT setor_membros_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES core.usuarios(id) ON DELETE CASCADE;


--
-- Name: tecnico_valores tecnico_valores_tecnico_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.tecnico_valores
    ADD CONSTRAINT tecnico_valores_tecnico_id_fkey FOREIGN KEY (tecnico_id) REFERENCES os.tecnicos(id) ON DELETE CASCADE;


--
-- Name: tecnicos tecnicos_setor_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.tecnicos
    ADD CONSTRAINT tecnicos_setor_id_fkey FOREIGN KEY (setor_id) REFERENCES os.setores(id) ON DELETE SET NULL;


--
-- Name: tecnicos tecnicos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.tecnicos
    ADD CONSTRAINT tecnicos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: terceirizado_links terceirizado_links_criado_por_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.terceirizado_links
    ADD CONSTRAINT terceirizado_links_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: terceirizado_links terceirizado_links_empresa_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.terceirizado_links
    ADD CONSTRAINT terceirizado_links_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES os.empresas(id) ON DELETE SET NULL;


--
-- Name: terceirizado_links terceirizado_links_ordem_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.terceirizado_links
    ADD CONSTRAINT terceirizado_links_ordem_id_fkey FOREIGN KEY (ordem_id) REFERENCES os.ordens(id) ON DELETE CASCADE;


--
-- Name: vistoria_ambientes vistoria_ambientes_entrada_ambiente_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.vistoria_ambientes
    ADD CONSTRAINT vistoria_ambientes_entrada_ambiente_id_fkey FOREIGN KEY (entrada_ambiente_id) REFERENCES os.vistoria_ambientes(id) ON DELETE SET NULL;


--
-- Name: vistoria_ambientes vistoria_ambientes_vistoria_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.vistoria_ambientes
    ADD CONSTRAINT vistoria_ambientes_vistoria_id_fkey FOREIGN KEY (vistoria_id) REFERENCES os.vistorias(id) ON DELETE CASCADE;


--
-- Name: vistorias vistorias_criado_por_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.vistorias
    ADD CONSTRAINT vistorias_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: vistorias vistorias_entrada_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.vistorias
    ADD CONSTRAINT vistorias_entrada_id_fkey FOREIGN KEY (entrada_id) REFERENCES os.vistorias(id) ON DELETE SET NULL;


--
-- Name: vistorias vistorias_loja_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.vistorias
    ADD CONSTRAINT vistorias_loja_id_fkey FOREIGN KEY (loja_id) REFERENCES os.lojas(id) ON DELETE SET NULL;


--
-- Name: vistorias vistorias_vistoriador_id_fkey; Type: FK CONSTRAINT; Schema: os; Owner: -
--

ALTER TABLE ONLY os.vistorias
    ADD CONSTRAINT vistorias_vistoriador_id_fkey FOREIGN KEY (vistoriador_id) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: afastamentos afastamentos_colaborador_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.afastamentos
    ADD CONSTRAINT afastamentos_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES rh.colaboradores(id) ON DELETE CASCADE;


--
-- Name: banco_horas_ciclos banco_horas_ciclos_criado_por_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.banco_horas_ciclos
    ADD CONSTRAINT banco_horas_ciclos_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: banco_horas_ciclos banco_horas_ciclos_finalizado_por_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.banco_horas_ciclos
    ADD CONSTRAINT banco_horas_ciclos_finalizado_por_fkey FOREIGN KEY (finalizado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: banco_horas_fechamentos banco_horas_fechamentos_ciclo_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.banco_horas_fechamentos
    ADD CONSTRAINT banco_horas_fechamentos_ciclo_id_fkey FOREIGN KEY (ciclo_id) REFERENCES rh.banco_horas_ciclos(id) ON DELETE CASCADE;


--
-- Name: banco_horas_fechamentos banco_horas_fechamentos_colaborador_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.banco_horas_fechamentos
    ADD CONSTRAINT banco_horas_fechamentos_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES rh.colaboradores(id) ON DELETE RESTRICT;


--
-- Name: beneficio_contratos beneficio_contratos_beneficio_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.beneficio_contratos
    ADD CONSTRAINT beneficio_contratos_beneficio_id_fkey FOREIGN KEY (beneficio_id) REFERENCES rh.beneficios(id) ON DELETE RESTRICT;


--
-- Name: beneficio_totais_mensais beneficio_totais_mensais_beneficio_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.beneficio_totais_mensais
    ADD CONSTRAINT beneficio_totais_mensais_beneficio_id_fkey FOREIGN KEY (beneficio_id) REFERENCES rh.beneficios(id) ON DELETE RESTRICT;


--
-- Name: beneficio_valores_mensais beneficio_valores_mensais_beneficio_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.beneficio_valores_mensais
    ADD CONSTRAINT beneficio_valores_mensais_beneficio_id_fkey FOREIGN KEY (beneficio_id) REFERENCES rh.beneficios(id) ON DELETE RESTRICT;


--
-- Name: beneficio_valores_mensais beneficio_valores_mensais_colaborador_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.beneficio_valores_mensais
    ADD CONSTRAINT beneficio_valores_mensais_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES rh.colaboradores(id) ON DELETE CASCADE;


--
-- Name: beneficios beneficios_dividir_departamento_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.beneficios
    ADD CONSTRAINT beneficios_dividir_departamento_id_fkey FOREIGN KEY (dividir_departamento_id) REFERENCES rh.departamentos(id) ON DELETE RESTRICT;


--
-- Name: colaborador_beneficios colaborador_beneficios_beneficio_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.colaborador_beneficios
    ADD CONSTRAINT colaborador_beneficios_beneficio_id_fkey FOREIGN KEY (beneficio_id) REFERENCES rh.beneficios(id) ON DELETE RESTRICT;


--
-- Name: colaborador_beneficios colaborador_beneficios_colaborador_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.colaborador_beneficios
    ADD CONSTRAINT colaborador_beneficios_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES rh.colaboradores(id) ON DELETE CASCADE;


--
-- Name: colaboradores colaboradores_cargo_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.colaboradores
    ADD CONSTRAINT colaboradores_cargo_id_fkey FOREIGN KEY (cargo_id) REFERENCES rh.cargos(id) ON DELETE SET NULL;


--
-- Name: colaboradores colaboradores_departamento_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.colaboradores
    ADD CONSTRAINT colaboradores_departamento_id_fkey FOREIGN KEY (departamento_id) REFERENCES rh.departamentos(id) ON DELETE SET NULL;


--
-- Name: colaboradores colaboradores_motivo_desligamento_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.colaboradores
    ADD CONSTRAINT colaboradores_motivo_desligamento_id_fkey FOREIGN KEY (motivo_desligamento_id) REFERENCES rh.motivos_desligamento(id) ON DELETE SET NULL;


--
-- Name: custos_colaborador custos_colaborador_cargo_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.custos_colaborador
    ADD CONSTRAINT custos_colaborador_cargo_id_fkey FOREIGN KEY (cargo_id) REFERENCES rh.cargos(id) ON DELETE SET NULL;


--
-- Name: custos_colaborador custos_colaborador_colaborador_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.custos_colaborador
    ADD CONSTRAINT custos_colaborador_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES rh.colaboradores(id) ON DELETE RESTRICT;


--
-- Name: custos_colaborador custos_colaborador_departamento_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.custos_colaborador
    ADD CONSTRAINT custos_colaborador_departamento_id_fkey FOREIGN KEY (departamento_id) REFERENCES rh.departamentos(id) ON DELETE SET NULL;


--
-- Name: dependentes dependentes_colaborador_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.dependentes
    ADD CONSTRAINT dependentes_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES rh.colaboradores(id) ON DELETE CASCADE;


--
-- Name: folha_colaboradores folha_colaboradores_cargo_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.folha_colaboradores
    ADD CONSTRAINT folha_colaboradores_cargo_id_fkey FOREIGN KEY (cargo_id) REFERENCES rh.cargos(id) ON DELETE SET NULL;


--
-- Name: folha_colaboradores folha_colaboradores_colaborador_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.folha_colaboradores
    ADD CONSTRAINT folha_colaboradores_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES rh.colaboradores(id) ON DELETE RESTRICT;


--
-- Name: folha_colaboradores folha_colaboradores_departamento_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.folha_colaboradores
    ADD CONSTRAINT folha_colaboradores_departamento_id_fkey FOREIGN KEY (departamento_id) REFERENCES rh.departamentos(id) ON DELETE SET NULL;


--
-- Name: folha_colaboradores folha_colaboradores_folha_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.folha_colaboradores
    ADD CONSTRAINT folha_colaboradores_folha_id_fkey FOREIGN KEY (folha_id) REFERENCES rh.folhas(id) ON DELETE CASCADE;


--
-- Name: folha_rubricas folha_rubricas_folha_id_colaborador_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.folha_rubricas
    ADD CONSTRAINT folha_rubricas_folha_id_colaborador_id_fkey FOREIGN KEY (folha_id, colaborador_id) REFERENCES rh.folha_colaboradores(folha_id, colaborador_id) ON DELETE CASCADE;


--
-- Name: folha_rubricas folha_rubricas_rubrica_codigo_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.folha_rubricas
    ADD CONSTRAINT folha_rubricas_rubrica_codigo_fkey FOREIGN KEY (rubrica_codigo) REFERENCES rh.rubricas(codigo) ON DELETE RESTRICT;


--
-- Name: folhas folhas_fechada_por_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.folhas
    ADD CONSTRAINT folhas_fechada_por_fkey FOREIGN KEY (fechada_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: folhas folhas_importacao_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.folhas
    ADD CONSTRAINT folhas_importacao_id_fkey FOREIGN KEY (importacao_id) REFERENCES core.importacoes(id) ON DELETE SET NULL;


--
-- Name: gastos gastos_categoria_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.gastos
    ADD CONSTRAINT gastos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES rh.categorias_gasto(id) ON DELETE RESTRICT;


--
-- Name: gastos gastos_criado_por_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.gastos
    ADD CONSTRAINT gastos_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: jornadas jornadas_cargo_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.jornadas
    ADD CONSTRAINT jornadas_cargo_id_fkey FOREIGN KEY (cargo_id) REFERENCES rh.cargos(id) ON DELETE CASCADE;


--
-- Name: jornadas jornadas_colaborador_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.jornadas
    ADD CONSTRAINT jornadas_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES rh.colaboradores(id) ON DELETE CASCADE;


--
-- Name: jornadas jornadas_departamento_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.jornadas
    ADD CONSTRAINT jornadas_departamento_id_fkey FOREIGN KEY (departamento_id) REFERENCES rh.departamentos(id) ON DELETE CASCADE;


--
-- Name: notas_pj notas_pj_colaborador_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.notas_pj
    ADD CONSTRAINT notas_pj_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES rh.colaboradores(id) ON DELETE RESTRICT;


--
-- Name: orcamentos_anuais orcamentos_anuais_finalizado_por_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.orcamentos_anuais
    ADD CONSTRAINT orcamentos_anuais_finalizado_por_fkey FOREIGN KEY (finalizado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: plano_coparticipacao plano_coparticipacao_tabela_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.plano_coparticipacao
    ADD CONSTRAINT plano_coparticipacao_tabela_id_fkey FOREIGN KEY (tabela_id) REFERENCES rh.plano_tabelas(id) ON DELETE CASCADE;


--
-- Name: plano_faixas_etarias plano_faixas_etarias_tabela_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.plano_faixas_etarias
    ADD CONSTRAINT plano_faixas_etarias_tabela_id_fkey FOREIGN KEY (tabela_id) REFERENCES rh.plano_tabelas(id) ON DELETE CASCADE;


--
-- Name: plano_tabelas plano_tabelas_beneficio_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.plano_tabelas
    ADD CONSTRAINT plano_tabelas_beneficio_id_fkey FOREIGN KEY (beneficio_id) REFERENCES rh.beneficios(id) ON DELETE RESTRICT;


--
-- Name: plano_tabelas plano_tabelas_importacao_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.plano_tabelas
    ADD CONSTRAINT plano_tabelas_importacao_id_fkey FOREIGN KEY (importacao_id) REFERENCES core.importacoes(id) ON DELETE SET NULL;


--
-- Name: ponto_diario ponto_diario_colaborador_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.ponto_diario
    ADD CONSTRAINT ponto_diario_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES rh.colaboradores(id) ON DELETE CASCADE;


--
-- Name: ponto_diario ponto_diario_sync_run_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.ponto_diario
    ADD CONSTRAINT ponto_diario_sync_run_id_fkey FOREIGN KEY (sync_run_id) REFERENCES integracao.sync_runs(id) ON DELETE SET NULL;


--
-- Name: ponto_mensal ponto_mensal_colaborador_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.ponto_mensal
    ADD CONSTRAINT ponto_mensal_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES rh.colaboradores(id) ON DELETE CASCADE;


--
-- Name: ponto_mensal ponto_mensal_departamento_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.ponto_mensal
    ADD CONSTRAINT ponto_mensal_departamento_id_fkey FOREIGN KEY (departamento_id) REFERENCES rh.departamentos(id) ON DELETE SET NULL;


--
-- Name: ponto_mensal ponto_mensal_sync_run_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.ponto_mensal
    ADD CONSTRAINT ponto_mensal_sync_run_id_fkey FOREIGN KEY (sync_run_id) REFERENCES integracao.sync_runs(id) ON DELETE SET NULL;


--
-- Name: rubricas rubricas_classificada_por_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.rubricas
    ADD CONSTRAINT rubricas_classificada_por_fkey FOREIGN KEY (classificada_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: valores_pj valores_pj_colaborador_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.valores_pj
    ADD CONSTRAINT valores_pj_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES rh.colaboradores(id) ON DELETE CASCADE;


--
-- Name: valores_pj valores_pj_sync_run_id_fkey; Type: FK CONSTRAINT; Schema: rh; Owner: -
--

ALTER TABLE ONLY rh.valores_pj
    ADD CONSTRAINT valores_pj_sync_run_id_fkey FOREIGN KEY (sync_run_id) REFERENCES integracao.sync_runs(id) ON DELETE SET NULL;


--
-- Name: acoes acoes_criado_por_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.acoes
    ADD CONSTRAINT acoes_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: acoes acoes_participante_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.acoes
    ADD CONSTRAINT acoes_participante_id_fkey FOREIGN KEY (participante_id) REFERENCES sustentabilidade.participantes(id) ON DELETE CASCADE;


--
-- Name: cadastros_lista cadastros_lista_criado_por_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.cadastros_lista
    ADD CONSTRAINT cadastros_lista_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: cadastros_lista cadastros_lista_importacao_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.cadastros_lista
    ADD CONSTRAINT cadastros_lista_importacao_id_fkey FOREIGN KEY (importacao_id) REFERENCES sustentabilidade.importacoes(id) ON DELETE SET NULL;


--
-- Name: cadastros_lista cadastros_lista_programa_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.cadastros_lista
    ADD CONSTRAINT cadastros_lista_programa_id_fkey FOREIGN KEY (programa_id) REFERENCES sustentabilidade.programas(id) ON DELETE CASCADE;


--
-- Name: consolidado_valores consolidado_valores_ano_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.consolidado_valores
    ADD CONSTRAINT consolidado_valores_ano_fkey FOREIGN KEY (ano) REFERENCES sustentabilidade.consolidados(ano) ON DELETE CASCADE;


--
-- Name: consolidados consolidados_fechado_por_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.consolidados
    ADD CONSTRAINT consolidados_fechado_por_fkey FOREIGN KEY (fechado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: consolidados consolidados_reaberto_por_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.consolidados
    ADD CONSTRAINT consolidados_reaberto_por_fkey FOREIGN KEY (reaberto_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: contratos contratos_ativacao_corrigida_por_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.contratos
    ADD CONSTRAINT contratos_ativacao_corrigida_por_fkey FOREIGN KEY (ativacao_corrigida_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: contratos contratos_chamado_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.contratos
    ADD CONSTRAINT contratos_chamado_id_fkey FOREIGN KEY (chamado_id) REFERENCES os.chamados(id) ON DELETE SET NULL;


--
-- Name: contratos contratos_dispensada_por_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.contratos
    ADD CONSTRAINT contratos_dispensada_por_fkey FOREIGN KEY (dispensada_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: contratos contratos_loja_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.contratos
    ADD CONSTRAINT contratos_loja_id_fkey FOREIGN KEY (loja_id) REFERENCES os.lojas(id) ON DELETE SET NULL;


--
-- Name: contribuicao_valores contribuicao_valores_contribuicao_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.contribuicao_valores
    ADD CONSTRAINT contribuicao_valores_contribuicao_id_fkey FOREIGN KEY (contribuicao_id) REFERENCES sustentabilidade.contribuicoes(id) ON DELETE CASCADE;


--
-- Name: contribuicoes contribuicoes_criado_por_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.contribuicoes
    ADD CONSTRAINT contribuicoes_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: contribuicoes contribuicoes_participante_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.contribuicoes
    ADD CONSTRAINT contribuicoes_participante_id_fkey FOREIGN KEY (participante_id) REFERENCES sustentabilidade.participantes(id) ON DELETE CASCADE;


--
-- Name: entrevista_transferencias entrevista_transferencias_de_contrato_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.entrevista_transferencias
    ADD CONSTRAINT entrevista_transferencias_de_contrato_id_fkey FOREIGN KEY (de_contrato_id) REFERENCES sustentabilidade.contratos(id) ON DELETE RESTRICT;


--
-- Name: entrevista_transferencias entrevista_transferencias_entrevista_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.entrevista_transferencias
    ADD CONSTRAINT entrevista_transferencias_entrevista_id_fkey FOREIGN KEY (entrevista_id) REFERENCES sustentabilidade.entrevistas(id) ON DELETE CASCADE;


--
-- Name: entrevista_transferencias entrevista_transferencias_para_contrato_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.entrevista_transferencias
    ADD CONSTRAINT entrevista_transferencias_para_contrato_id_fkey FOREIGN KEY (para_contrato_id) REFERENCES sustentabilidade.contratos(id) ON DELETE RESTRICT;


--
-- Name: entrevista_transferencias entrevista_transferencias_quem_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.entrevista_transferencias
    ADD CONSTRAINT entrevista_transferencias_quem_fkey FOREIGN KEY (quem) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: entrevistas entrevistas_chamado_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.entrevistas
    ADD CONSTRAINT entrevistas_chamado_id_fkey FOREIGN KEY (chamado_id) REFERENCES os.chamados(id) ON DELETE SET NULL;


--
-- Name: entrevistas entrevistas_contrato_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.entrevistas
    ADD CONSTRAINT entrevistas_contrato_id_fkey FOREIGN KEY (contrato_id) REFERENCES sustentabilidade.contratos(id) ON DELETE RESTRICT;


--
-- Name: entrevistas entrevistas_entrevistador_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.entrevistas
    ADD CONSTRAINT entrevistas_entrevistador_id_fkey FOREIGN KEY (entrevistador_id) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: entrevistas entrevistas_importacao_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.entrevistas
    ADD CONSTRAINT entrevistas_importacao_id_fkey FOREIGN KEY (importacao_id) REFERENCES sustentabilidade.importacoes(id) ON DELETE SET NULL;


--
-- Name: formulario_alteracoes formulario_alteracoes_formulario_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.formulario_alteracoes
    ADD CONSTRAINT formulario_alteracoes_formulario_id_fkey FOREIGN KEY (formulario_id) REFERENCES sustentabilidade.formularios(id) ON DELETE CASCADE;


--
-- Name: formulario_alteracoes formulario_alteracoes_quem_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.formulario_alteracoes
    ADD CONSTRAINT formulario_alteracoes_quem_fkey FOREIGN KEY (quem) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: formulario_versoes formulario_versoes_formulario_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.formulario_versoes
    ADD CONSTRAINT formulario_versoes_formulario_id_fkey FOREIGN KEY (formulario_id) REFERENCES sustentabilidade.formularios(id) ON DELETE CASCADE;


--
-- Name: formulario_versoes formulario_versoes_publicado_por_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.formulario_versoes
    ADD CONSTRAINT formulario_versoes_publicado_por_fkey FOREIGN KEY (publicado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: formularios formularios_criado_por_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.formularios
    ADD CONSTRAINT formularios_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: formularios formularios_programa_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.formularios
    ADD CONSTRAINT formularios_programa_id_fkey FOREIGN KEY (programa_id) REFERENCES sustentabilidade.programas(id) ON DELETE CASCADE;


--
-- Name: importacoes importacoes_confirmado_por_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.importacoes
    ADD CONSTRAINT importacoes_confirmado_por_fkey FOREIGN KEY (confirmado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: importacoes importacoes_criado_por_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.importacoes
    ADD CONSTRAINT importacoes_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: importacoes importacoes_desfeito_por_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.importacoes
    ADD CONSTRAINT importacoes_desfeito_por_fkey FOREIGN KEY (desfeito_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: importacoes importacoes_substitui_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.importacoes
    ADD CONSTRAINT importacoes_substitui_fkey FOREIGN KEY (substitui) REFERENCES sustentabilidade.importacoes(id) ON DELETE SET NULL;


--
-- Name: lancamento_valores lancamento_valores_lancamento_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.lancamento_valores
    ADD CONSTRAINT lancamento_valores_lancamento_id_fkey FOREIGN KEY (lancamento_id) REFERENCES sustentabilidade.lancamentos(id) ON DELETE CASCADE;


--
-- Name: lancamentos lancamentos_formulario_id_formulario_versao_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.lancamentos
    ADD CONSTRAINT lancamentos_formulario_id_formulario_versao_fkey FOREIGN KEY (formulario_id, formulario_versao) REFERENCES sustentabilidade.formulario_versoes(formulario_id, versao) ON DELETE RESTRICT;


--
-- Name: lancamentos lancamentos_importacao_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.lancamentos
    ADD CONSTRAINT lancamentos_importacao_id_fkey FOREIGN KEY (importacao_id) REFERENCES sustentabilidade.importacoes(id) ON DELETE SET NULL;


--
-- Name: lancamentos lancamentos_lancado_por_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.lancamentos
    ADD CONSTRAINT lancamentos_lancado_por_fkey FOREIGN KEY (lancado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: lancamentos lancamentos_link_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.lancamentos
    ADD CONSTRAINT lancamentos_link_id_fkey FOREIGN KEY (link_id) REFERENCES sustentabilidade.programa_links(id) ON DELETE SET NULL;


--
-- Name: lancamentos lancamentos_programa_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.lancamentos
    ADD CONSTRAINT lancamentos_programa_id_fkey FOREIGN KEY (programa_id) REFERENCES sustentabilidade.programas(id) ON DELETE RESTRICT;


--
-- Name: parametros parametros_atualizado_por_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.parametros
    ADD CONSTRAINT parametros_atualizado_por_fkey FOREIGN KEY (atualizado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: parametros parametros_recolhimento_setor_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.parametros
    ADD CONSTRAINT parametros_recolhimento_setor_id_fkey FOREIGN KEY (recolhimento_setor_id) REFERENCES os.setores(id) ON DELETE SET NULL;


--
-- Name: participante_contatos participante_contatos_participante_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.participante_contatos
    ADD CONSTRAINT participante_contatos_participante_id_fkey FOREIGN KEY (participante_id) REFERENCES sustentabilidade.participantes(id) ON DELETE CASCADE;


--
-- Name: participante_valores participante_valores_participante_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.participante_valores
    ADD CONSTRAINT participante_valores_participante_id_fkey FOREIGN KEY (participante_id) REFERENCES sustentabilidade.participantes(id) ON DELETE CASCADE;


--
-- Name: programa_contatos programa_contatos_programa_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.programa_contatos
    ADD CONSTRAINT programa_contatos_programa_id_fkey FOREIGN KEY (programa_id) REFERENCES sustentabilidade.programas(id) ON DELETE CASCADE;


--
-- Name: programa_indicadores programa_indicadores_formulario_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.programa_indicadores
    ADD CONSTRAINT programa_indicadores_formulario_id_fkey FOREIGN KEY (formulario_id) REFERENCES sustentabilidade.formularios(id) ON DELETE RESTRICT;


--
-- Name: programa_indicadores programa_indicadores_programa_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.programa_indicadores
    ADD CONSTRAINT programa_indicadores_programa_id_fkey FOREIGN KEY (programa_id) REFERENCES sustentabilidade.programas(id) ON DELETE CASCADE;


--
-- Name: programa_links programa_links_criado_por_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.programa_links
    ADD CONSTRAINT programa_links_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: programa_links programa_links_desligado_por_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.programa_links
    ADD CONSTRAINT programa_links_desligado_por_fkey FOREIGN KEY (desligado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: programa_links programa_links_programa_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.programa_links
    ADD CONSTRAINT programa_links_programa_id_fkey FOREIGN KEY (programa_id) REFERENCES sustentabilidade.programas(id) ON DELETE CASCADE;


--
-- Name: rcc_fatores rcc_fatores_criado_por_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.rcc_fatores
    ADD CONSTRAINT rcc_fatores_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: rcc_nota_valores rcc_nota_valores_nota_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.rcc_nota_valores
    ADD CONSTRAINT rcc_nota_valores_nota_id_fkey FOREIGN KEY (nota_id) REFERENCES sustentabilidade.rcc_notas(id) ON DELETE CASCADE;


--
-- Name: rcc_notas rcc_notas_chamado_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.rcc_notas
    ADD CONSTRAINT rcc_notas_chamado_id_fkey FOREIGN KEY (chamado_id) REFERENCES os.chamados(id) ON DELETE SET NULL;


--
-- Name: rcc_notas rcc_notas_lancado_por_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.rcc_notas
    ADD CONSTRAINT rcc_notas_lancado_por_fkey FOREIGN KEY (lancado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: rcc_precos rcc_precos_criado_por_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.rcc_precos
    ADD CONSTRAINT rcc_precos_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: ronda_itens ronda_itens_coletor_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.ronda_itens
    ADD CONSTRAINT ronda_itens_coletor_id_fkey FOREIGN KEY (coletor_id) REFERENCES sustentabilidade.coletores(id) ON DELETE RESTRICT;


--
-- Name: ronda_itens ronda_itens_ronda_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.ronda_itens
    ADD CONSTRAINT ronda_itens_ronda_id_fkey FOREIGN KEY (ronda_id) REFERENCES sustentabilidade.rondas(id) ON DELETE CASCADE;


--
-- Name: rondas rondas_chamado_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.rondas
    ADD CONSTRAINT rondas_chamado_id_fkey FOREIGN KEY (chamado_id) REFERENCES os.chamados(id) ON DELETE SET NULL;


--
-- Name: rondas rondas_lancado_por_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.rondas
    ADD CONSTRAINT rondas_lancado_por_fkey FOREIGN KEY (lancado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: termos termos_chamado_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.termos
    ADD CONSTRAINT termos_chamado_id_fkey FOREIGN KEY (chamado_id) REFERENCES os.chamados(id) ON DELETE SET NULL;


--
-- Name: termos termos_criado_por_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.termos
    ADD CONSTRAINT termos_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: termos termos_participante_id_fkey; Type: FK CONSTRAINT; Schema: sustentabilidade; Owner: -
--

ALTER TABLE ONLY sustentabilidade.termos
    ADD CONSTRAINT termos_participante_id_fkey FOREIGN KEY (participante_id) REFERENCES sustentabilidade.participantes(id) ON DELETE CASCADE;


--
-- Name: itens criar; Type: POLICY; Schema: calendario; Owner: -
--

CREATE POLICY criar ON calendario.itens FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('calendario.criar'::text) AS pode) AND (criado_por = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM calendario.tipos t
  WHERE ((t.id = itens.tipo_id) AND t.ativo)))));


--
-- Name: tipos criar; Type: POLICY; Schema: calendario; Owner: -
--

CREATE POLICY criar ON calendario.tipos FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('calendario.configurar'::text) AS pode));


--
-- Name: itens editar; Type: POLICY; Schema: calendario; Owner: -
--

CREATE POLICY editar ON calendario.itens FOR UPDATE TO authenticated USING (((( SELECT core.pode('calendario.criar'::text) AS pode) AND (criado_por = ( SELECT auth.uid() AS uid))) OR (( SELECT core.pode('calendario.editar_todos'::text) AS pode) AND (visibilidade <> 'privado'::text)))) WITH CHECK (((EXISTS ( SELECT 1
   FROM calendario.tipos t
  WHERE ((t.id = itens.tipo_id) AND t.ativo))) AND ((( SELECT core.pode('calendario.criar'::text) AS pode) AND (criado_por = ( SELECT auth.uid() AS uid))) OR ( SELECT core.pode('calendario.editar_todos'::text) AS pode))));


--
-- Name: tipos editar; Type: POLICY; Schema: calendario; Owner: -
--

CREATE POLICY editar ON calendario.tipos FOR UPDATE TO authenticated USING (( SELECT core.pode('calendario.configurar'::text) AS pode)) WITH CHECK (( SELECT core.pode('calendario.configurar'::text) AS pode));


--
-- Name: itens excluir; Type: POLICY; Schema: calendario; Owner: -
--

CREATE POLICY excluir ON calendario.itens FOR DELETE TO authenticated USING (((( SELECT core.pode('calendario.criar'::text) AS pode) AND (criado_por = ( SELECT auth.uid() AS uid))) OR (( SELECT core.pode('calendario.editar_todos'::text) AS pode) AND (visibilidade <> 'privado'::text))));


--
-- Name: tipos excluir; Type: POLICY; Schema: calendario; Owner: -
--

CREATE POLICY excluir ON calendario.tipos FOR DELETE TO authenticated USING (( SELECT core.pode('calendario.configurar'::text) AS pode));


--
-- Name: itens; Type: ROW SECURITY; Schema: calendario; Owner: -
--

ALTER TABLE calendario.itens ENABLE ROW LEVEL SECURITY;

--
-- Name: tipos; Type: ROW SECURITY; Schema: calendario; Owner: -
--

ALTER TABLE calendario.tipos ENABLE ROW LEVEL SECURITY;

--
-- Name: itens ver; Type: POLICY; Schema: calendario; Owner: -
--

CREATE POLICY ver ON calendario.itens FOR SELECT TO authenticated USING ((( SELECT core.pode('calendario.ver'::text) AS pode) AND ((visibilidade = 'todos'::text) OR (criado_por = ( SELECT auth.uid() AS uid)) OR (responsavel_id = ( SELECT auth.uid() AS uid)) OR ((visibilidade = 'restrito'::text) AND (( SELECT core.pode('calendario.ver_todos'::text) AS pode) OR (usuarios && ARRAY[( SELECT auth.uid() AS uid)]) OR (setores && ARRAY( SELECT os.meus_setores() AS meus_setores)) OR (cargos && ARRAY( SELECT calendario.meu_cargo() AS meu_cargo)))))));


--
-- Name: tipos ver; Type: POLICY; Schema: calendario; Owner: -
--

CREATE POLICY ver ON calendario.tipos FOR SELECT TO authenticated USING ((( SELECT core.pode('calendario.ver'::text) AS pode) OR ( SELECT core.pode('calendario.configurar'::text) AS pode)));


--
-- Name: censo_rodadas abrir; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY abrir ON comercial.censo_rodadas FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('comercial.censo.aplicar'::text) AS pode));


--
-- Name: importacoes atualizar; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY atualizar ON comercial.importacoes FOR UPDATE TO authenticated USING (
CASE tipo
    WHEN 'censo'::text THEN ( SELECT core.pode('comercial.censo.importar'::text) AS pode)
    WHEN 'fichas'::text THEN ( SELECT core.pode('comercial.formulario.ver'::text) AS pode)
    WHEN 'pesquisa'::text THEN ( SELECT core.pode('comercial.pesquisa.editar'::text) AS pode)
    WHEN 'contatos'::text THEN ( SELECT core.pode('comercial.relacionamento.registrar'::text) AS pode)
    ELSE false
END) WITH CHECK (
CASE tipo
    WHEN 'censo'::text THEN ( SELECT core.pode('comercial.censo.importar'::text) AS pode)
    WHEN 'fichas'::text THEN ( SELECT core.pode('comercial.formulario.ver'::text) AS pode)
    WHEN 'pesquisa'::text THEN ( SELECT core.pode('comercial.pesquisa.editar'::text) AS pode)
    WHEN 'contatos'::text THEN ( SELECT core.pode('comercial.relacionamento.registrar'::text) AS pode)
    ELSE false
END);


--
-- Name: censo_convites; Type: ROW SECURITY; Schema: comercial; Owner: -
--

ALTER TABLE comercial.censo_convites ENABLE ROW LEVEL SECURITY;

--
-- Name: censo_respostas; Type: ROW SECURITY; Schema: comercial; Owner: -
--

ALTER TABLE comercial.censo_respostas ENABLE ROW LEVEL SECURITY;

--
-- Name: censo_rodadas; Type: ROW SECURITY; Schema: comercial; Owner: -
--

ALTER TABLE comercial.censo_rodadas ENABLE ROW LEVEL SECURITY;

--
-- Name: censo_sugestao_temas; Type: ROW SECURITY; Schema: comercial; Owner: -
--

ALTER TABLE comercial.censo_sugestao_temas ENABLE ROW LEVEL SECURITY;

--
-- Name: censo_temas; Type: ROW SECURITY; Schema: comercial; Owner: -
--

ALTER TABLE comercial.censo_temas ENABLE ROW LEVEL SECURITY;

--
-- Name: contatos; Type: ROW SECURITY; Schema: comercial; Owner: -
--

ALTER TABLE comercial.contatos ENABLE ROW LEVEL SECURITY;

--
-- Name: contrato_anexos; Type: ROW SECURITY; Schema: comercial; Owner: -
--

ALTER TABLE comercial.contrato_anexos ENABLE ROW LEVEL SECURITY;

--
-- Name: contrato_kit; Type: ROW SECURITY; Schema: comercial; Owner: -
--

ALTER TABLE comercial.contrato_kit ENABLE ROW LEVEL SECURITY;

--
-- Name: contrato_versoes; Type: ROW SECURITY; Schema: comercial; Owner: -
--

ALTER TABLE comercial.contrato_versoes ENABLE ROW LEVEL SECURITY;

--
-- Name: contratos; Type: ROW SECURITY; Schema: comercial; Owner: -
--

ALTER TABLE comercial.contratos ENABLE ROW LEVEL SECURITY;

--
-- Name: contratos criar; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY criar ON comercial.contratos FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('comercial.contratos.editar'::text) AS pode) AND (criado_por = ( SELECT auth.uid() AS uid)) AND (status <> 'gerado'::text)));


--
-- Name: censo_convites editar; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY editar ON comercial.censo_convites FOR UPDATE TO authenticated USING (( SELECT core.pode('comercial.censo.aplicar'::text) AS pode)) WITH CHECK (( SELECT core.pode('comercial.censo.aplicar'::text) AS pode));


--
-- Name: censo_respostas editar; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY editar ON comercial.censo_respostas FOR UPDATE TO authenticated USING ((( SELECT core.pode('comercial.censo.aplicar'::text) AS pode) OR ( SELECT core.pode('comercial.censo.importar'::text) AS pode))) WITH CHECK ((( SELECT core.pode('comercial.censo.aplicar'::text) AS pode) OR ( SELECT core.pode('comercial.censo.importar'::text) AS pode)));


--
-- Name: censo_rodadas editar; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY editar ON comercial.censo_rodadas FOR UPDATE TO authenticated USING (( SELECT core.pode('comercial.censo.aplicar'::text) AS pode)) WITH CHECK (( SELECT core.pode('comercial.censo.aplicar'::text) AS pode));


--
-- Name: censo_temas editar; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY editar ON comercial.censo_temas FOR UPDATE TO authenticated USING (( SELECT core.pode('comercial.censo.aplicar'::text) AS pode)) WITH CHECK (( SELECT core.pode('comercial.censo.aplicar'::text) AS pode));


--
-- Name: contatos editar; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY editar ON comercial.contatos FOR UPDATE TO authenticated USING ((( SELECT core.pode('comercial.relacionamento.registrar'::text) AS pode) AND (registrado_por = ( SELECT auth.uid() AS uid)))) WITH CHECK ((( SELECT core.pode('comercial.relacionamento.registrar'::text) AS pode) AND (registrado_por = ( SELECT auth.uid() AS uid))));


--
-- Name: contratos editar; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY editar ON comercial.contratos FOR UPDATE TO authenticated USING ((( SELECT core.pode('comercial.contratos.editar'::text) AS pode) OR ( SELECT core.pode('comercial.contratos.gerar'::text) AS pode))) WITH CHECK (
CASE
    WHEN (status = 'gerado'::text) THEN ( SELECT core.pode('comercial.contratos.gerar'::text) AS pode)
    ELSE ( SELECT core.pode('comercial.contratos.editar'::text) AS pode)
END);


--
-- Name: faixas_evento editar; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY editar ON comercial.faixas_evento FOR UPDATE TO authenticated USING (( SELECT core.pode('comercial.parametros.editar'::text) AS pode)) WITH CHECK (( SELECT core.pode('comercial.parametros.editar'::text) AS pode));


--
-- Name: ficha_dados editar; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY editar ON comercial.ficha_dados FOR UPDATE TO authenticated USING (( SELECT core.pode('comercial.formulario.ver'::text) AS pode)) WITH CHECK (( SELECT core.pode('comercial.formulario.ver'::text) AS pode));


--
-- Name: fichas editar; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY editar ON comercial.fichas FOR UPDATE TO authenticated USING ((( SELECT core.pode('comercial.formulario.link'::text) AS pode) OR ( SELECT core.pode('comercial.formulario.ver'::text) AS pode))) WITH CHECK ((( SELECT core.pode('comercial.formulario.link'::text) AS pode) OR ( SELECT core.pode('comercial.formulario.ver'::text) AS pode)));


--
-- Name: fontes_de_para editar; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY editar ON comercial.fontes_de_para FOR UPDATE TO authenticated USING (( SELECT core.pode('comercial.parametros.editar'::text) AS pode)) WITH CHECK (( SELECT core.pode('comercial.parametros.editar'::text) AS pode));


--
-- Name: kit_documentos editar; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY editar ON comercial.kit_documentos FOR UPDATE TO authenticated USING (( SELECT core.pode('comercial.kit.editar'::text) AS pode)) WITH CHECK (( SELECT core.pode('comercial.kit.editar'::text) AS pode));


--
-- Name: kit_versoes editar; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY editar ON comercial.kit_versoes FOR UPDATE TO authenticated USING (( SELECT core.pode('comercial.kit.editar'::text) AS pode)) WITH CHECK (( SELECT core.pode('comercial.kit.editar'::text) AS pode));


--
-- Name: listas editar; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY editar ON comercial.listas FOR UPDATE TO authenticated USING (( SELECT core.pode('comercial.parametros.editar'::text) AS pode)) WITH CHECK (( SELECT core.pode('comercial.parametros.editar'::text) AS pode));


--
-- Name: parametros editar; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY editar ON comercial.parametros FOR UPDATE TO authenticated USING (( SELECT core.pode('comercial.parametros.editar'::text) AS pode)) WITH CHECK (( SELECT core.pode('comercial.parametros.editar'::text) AS pode));


--
-- Name: pesquisa_imoveis editar; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY editar ON comercial.pesquisa_imoveis FOR UPDATE TO authenticated USING (( SELECT core.pode('comercial.pesquisa.editar'::text) AS pode)) WITH CHECK (( SELECT core.pode('comercial.pesquisa.editar'::text) AS pode));


--
-- Name: propostas_evento editar; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY editar ON comercial.propostas_evento FOR UPDATE TO authenticated USING (( SELECT core.pode('comercial.eventos.editar'::text) AS pode)) WITH CHECK (( SELECT core.pode('comercial.eventos.editar'::text) AS pode));


--
-- Name: tipos_luc editar; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY editar ON comercial.tipos_luc FOR UPDATE TO authenticated USING (( SELECT core.pode('comercial.parametros.editar'::text) AS pode)) WITH CHECK (( SELECT core.pode('comercial.parametros.editar'::text) AS pode));


--
-- Name: importacoes enviar; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY enviar ON comercial.importacoes FOR INSERT TO authenticated WITH CHECK (((enviado_por = ( SELECT auth.uid() AS uid)) AND
CASE tipo
    WHEN 'censo'::text THEN ( SELECT core.pode('comercial.censo.importar'::text) AS pode)
    WHEN 'fichas'::text THEN ( SELECT core.pode('comercial.formulario.ver'::text) AS pode)
    WHEN 'pesquisa'::text THEN ( SELECT core.pode('comercial.pesquisa.editar'::text) AS pode)
    WHEN 'contatos'::text THEN ( SELECT core.pode('comercial.relacionamento.registrar'::text) AS pode)
    ELSE false
END));


--
-- Name: censo_convites excluir; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY excluir ON comercial.censo_convites FOR DELETE TO authenticated USING (( SELECT core.pode('comercial.censo.aplicar'::text) AS pode));


--
-- Name: censo_sugestao_temas excluir; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY excluir ON comercial.censo_sugestao_temas FOR DELETE TO authenticated USING (( SELECT core.pode('comercial.censo.aplicar'::text) AS pode));


--
-- Name: censo_temas excluir; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY excluir ON comercial.censo_temas FOR DELETE TO authenticated USING (( SELECT core.pode('comercial.censo.aplicar'::text) AS pode));


--
-- Name: contatos excluir; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY excluir ON comercial.contatos FOR DELETE TO authenticated USING ((( SELECT core.pode('comercial.relacionamento.registrar'::text) AS pode) AND (registrado_por = ( SELECT auth.uid() AS uid))));


--
-- Name: contrato_anexos excluir; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY excluir ON comercial.contrato_anexos FOR DELETE TO authenticated USING (( SELECT core.pode('comercial.contratos.editar'::text) AS pode));


--
-- Name: contrato_kit excluir; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY excluir ON comercial.contrato_kit FOR DELETE TO authenticated USING (( SELECT core.pode('comercial.contratos.editar'::text) AS pode));


--
-- Name: contratos excluir; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY excluir ON comercial.contratos FOR DELETE TO authenticated USING ((( SELECT core.pode('comercial.contratos.editar'::text) AS pode) AND (status = 'rascunho'::text)));


--
-- Name: faixas_evento excluir; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY excluir ON comercial.faixas_evento FOR DELETE TO authenticated USING (( SELECT core.pode('comercial.parametros.editar'::text) AS pode));


--
-- Name: fichas excluir; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY excluir ON comercial.fichas FOR DELETE TO authenticated USING ((( SELECT core.pode('comercial.formulario.link'::text) AS pode) AND (situacao = 'em_preenchimento'::text)));


--
-- Name: fontes_de_para excluir; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY excluir ON comercial.fontes_de_para FOR DELETE TO authenticated USING (( SELECT core.pode('comercial.parametros.editar'::text) AS pode));


--
-- Name: listas excluir; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY excluir ON comercial.listas FOR DELETE TO authenticated USING (( SELECT core.pode('comercial.parametros.editar'::text) AS pode));


--
-- Name: pesquisa_imoveis excluir; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY excluir ON comercial.pesquisa_imoveis FOR DELETE TO authenticated USING (( SELECT core.pode('comercial.pesquisa.editar'::text) AS pode));


--
-- Name: propostas_evento excluir; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY excluir ON comercial.propostas_evento FOR DELETE TO authenticated USING (( SELECT core.pode('comercial.eventos.editar'::text) AS pode));


--
-- Name: tipos_luc excluir; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY excluir ON comercial.tipos_luc FOR DELETE TO authenticated USING (( SELECT core.pode('comercial.parametros.editar'::text) AS pode));


--
-- Name: faixas_evento; Type: ROW SECURITY; Schema: comercial; Owner: -
--

ALTER TABLE comercial.faixas_evento ENABLE ROW LEVEL SECURITY;

--
-- Name: ficha_acessos; Type: ROW SECURITY; Schema: comercial; Owner: -
--

ALTER TABLE comercial.ficha_acessos ENABLE ROW LEVEL SECURITY;

--
-- Name: ficha_dados; Type: ROW SECURITY; Schema: comercial; Owner: -
--

ALTER TABLE comercial.ficha_dados ENABLE ROW LEVEL SECURITY;

--
-- Name: ficha_documentos; Type: ROW SECURITY; Schema: comercial; Owner: -
--

ALTER TABLE comercial.ficha_documentos ENABLE ROW LEVEL SECURITY;

--
-- Name: fichas; Type: ROW SECURITY; Schema: comercial; Owner: -
--

ALTER TABLE comercial.fichas ENABLE ROW LEVEL SECURITY;

--
-- Name: fontes_de_para; Type: ROW SECURITY; Schema: comercial; Owner: -
--

ALTER TABLE comercial.fontes_de_para ENABLE ROW LEVEL SECURITY;

--
-- Name: censo_convites gerar; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY gerar ON comercial.censo_convites FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('comercial.censo.aplicar'::text) AS pode));


--
-- Name: fichas gerar; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY gerar ON comercial.fichas FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('comercial.formulario.link'::text) AS pode) AND (gerada_por = ( SELECT auth.uid() AS uid)) AND (situacao = 'em_preenchimento'::text)));


--
-- Name: importacoes; Type: ROW SECURITY; Schema: comercial; Owner: -
--

ALTER TABLE comercial.importacoes ENABLE ROW LEVEL SECURITY;

--
-- Name: censo_sugestao_temas incluir; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY incluir ON comercial.censo_sugestao_temas FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('comercial.censo.aplicar'::text) AS pode));


--
-- Name: censo_temas incluir; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY incluir ON comercial.censo_temas FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('comercial.censo.aplicar'::text) AS pode));


--
-- Name: contrato_anexos incluir; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY incluir ON comercial.contrato_anexos FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('comercial.contratos.editar'::text) AS pode) AND (enviado_por = ( SELECT auth.uid() AS uid))));


--
-- Name: contrato_kit incluir; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY incluir ON comercial.contrato_kit FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('comercial.contratos.editar'::text) AS pode));


--
-- Name: faixas_evento incluir; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY incluir ON comercial.faixas_evento FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('comercial.parametros.editar'::text) AS pode));


--
-- Name: ficha_dados incluir; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY incluir ON comercial.ficha_dados FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('comercial.formulario.ver'::text) AS pode));


--
-- Name: fontes_de_para incluir; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY incluir ON comercial.fontes_de_para FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('comercial.parametros.editar'::text) AS pode));


--
-- Name: kit_documentos incluir; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY incluir ON comercial.kit_documentos FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('comercial.kit.editar'::text) AS pode));


--
-- Name: kit_versoes incluir; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY incluir ON comercial.kit_versoes FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('comercial.kit.editar'::text) AS pode));


--
-- Name: listas incluir; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY incluir ON comercial.listas FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('comercial.parametros.editar'::text) AS pode));


--
-- Name: pesquisa_imoveis incluir; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY incluir ON comercial.pesquisa_imoveis FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('comercial.pesquisa.editar'::text) AS pode));


--
-- Name: propostas_evento incluir; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY incluir ON comercial.propostas_evento FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('comercial.eventos.editar'::text) AS pode));


--
-- Name: tipos_luc incluir; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY incluir ON comercial.tipos_luc FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('comercial.parametros.editar'::text) AS pode));


--
-- Name: kit_documentos; Type: ROW SECURITY; Schema: comercial; Owner: -
--

ALTER TABLE comercial.kit_documentos ENABLE ROW LEVEL SECURITY;

--
-- Name: kit_versoes; Type: ROW SECURITY; Schema: comercial; Owner: -
--

ALTER TABLE comercial.kit_versoes ENABLE ROW LEVEL SECURITY;

--
-- Name: censo_respostas lancar; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY lancar ON comercial.censo_respostas FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('comercial.censo.aplicar'::text) AS pode) AND (origem = 'presencial'::text) AND (lancada_por = ( SELECT auth.uid() AS uid))));


--
-- Name: listas; Type: ROW SECURITY; Schema: comercial; Owner: -
--

ALTER TABLE comercial.listas ENABLE ROW LEVEL SECURITY;

--
-- Name: censo_sugestao_temas mover; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY mover ON comercial.censo_sugestao_temas FOR UPDATE TO authenticated USING (( SELECT core.pode('comercial.censo.aplicar'::text) AS pode)) WITH CHECK (( SELECT core.pode('comercial.censo.aplicar'::text) AS pode));


--
-- Name: ocupacao_fotos; Type: ROW SECURITY; Schema: comercial; Owner: -
--

ALTER TABLE comercial.ocupacao_fotos ENABLE ROW LEVEL SECURITY;

--
-- Name: parametros; Type: ROW SECURITY; Schema: comercial; Owner: -
--

ALTER TABLE comercial.parametros ENABLE ROW LEVEL SECURITY;

--
-- Name: pesquisa_imoveis; Type: ROW SECURITY; Schema: comercial; Owner: -
--

ALTER TABLE comercial.pesquisa_imoveis ENABLE ROW LEVEL SECURITY;

--
-- Name: propostas_evento; Type: ROW SECURITY; Schema: comercial; Owner: -
--

ALTER TABLE comercial.propostas_evento ENABLE ROW LEVEL SECURITY;

--
-- Name: rd_oportunidades; Type: ROW SECURITY; Schema: comercial; Owner: -
--

ALTER TABLE comercial.rd_oportunidades ENABLE ROW LEVEL SECURITY;

--
-- Name: contatos registrar; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY registrar ON comercial.contatos FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('comercial.relacionamento.registrar'::text) AS pode) AND (registrado_por = ( SELECT auth.uid() AS uid))));


--
-- Name: ficha_acessos registrar; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY registrar ON comercial.ficha_acessos FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('comercial.formulario.ver'::text) AS pode) AND (usuario_id = ( SELECT auth.uid() AS uid))));


--
-- Name: tipos_luc; Type: ROW SECURITY; Schema: comercial; Owner: -
--

ALTER TABLE comercial.tipos_luc ENABLE ROW LEVEL SECURITY;

--
-- Name: censo_convites ver; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY ver ON comercial.censo_convites FOR SELECT TO authenticated USING (( SELECT core.pode('comercial.censo.aplicar'::text) AS pode));


--
-- Name: censo_respostas ver; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY ver ON comercial.censo_respostas FOR SELECT TO authenticated USING ((( SELECT core.pode('comercial.censo.ver'::text) AS pode) OR ( SELECT core.pode('comercial.censo.aplicar'::text) AS pode) OR ( SELECT core.pode('comercial.censo.importar'::text) AS pode)));


--
-- Name: censo_rodadas ver; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY ver ON comercial.censo_rodadas FOR SELECT TO authenticated USING ((( SELECT core.pode('comercial.censo.ver'::text) AS pode) OR ( SELECT core.pode('comercial.censo.aplicar'::text) AS pode) OR ( SELECT core.pode('comercial.censo.importar'::text) AS pode)));


--
-- Name: censo_sugestao_temas ver; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY ver ON comercial.censo_sugestao_temas FOR SELECT TO authenticated USING ((( SELECT core.pode('comercial.censo.ver'::text) AS pode) OR ( SELECT core.pode('comercial.censo.aplicar'::text) AS pode)));


--
-- Name: censo_temas ver; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY ver ON comercial.censo_temas FOR SELECT TO authenticated USING ((( SELECT core.pode('comercial.censo.ver'::text) AS pode) OR ( SELECT core.pode('comercial.censo.aplicar'::text) AS pode)));


--
-- Name: contatos ver; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY ver ON comercial.contatos FOR SELECT TO authenticated USING ((( SELECT core.pode('comercial.relacionamento.ver'::text) AS pode) OR (( SELECT core.pode('comercial.censo.ver'::text) AS pode) AND (tipo = ANY (ARRAY( SELECT l.valor
   FROM comercial.listas l
  WHERE ((l.lista = 'tipo_contato'::text) AND ((l.extra ->> 'feedback'::text))::boolean)))))));


--
-- Name: contrato_anexos ver; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY ver ON comercial.contrato_anexos FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM comercial.contratos c
  WHERE (c.id = contrato_anexos.contrato_id))));


--
-- Name: contrato_kit ver; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY ver ON comercial.contrato_kit FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM comercial.contratos c
  WHERE (c.id = contrato_kit.contrato_id))));


--
-- Name: contrato_versoes ver; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY ver ON comercial.contrato_versoes FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM comercial.contratos c
  WHERE (c.id = contrato_versoes.contrato_id))));


--
-- Name: contratos ver; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY ver ON comercial.contratos FOR SELECT TO authenticated USING ((( SELECT core.pode('comercial.contratos.ver'::text) AS pode) OR ( SELECT core.pode('comercial.contratos.editar'::text) AS pode) OR ( SELECT core.pode('comercial.contratos.gerar'::text) AS pode)));


--
-- Name: faixas_evento ver; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY ver ON comercial.faixas_evento FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('comercial'::text) AS pode_modulo));


--
-- Name: ficha_acessos ver; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY ver ON comercial.ficha_acessos FOR SELECT TO authenticated USING (( SELECT core.pode('comercial.formulario.ver'::text) AS pode));


--
-- Name: ficha_dados ver; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY ver ON comercial.ficha_dados FOR SELECT TO authenticated USING (( SELECT core.pode('comercial.formulario.ver'::text) AS pode));


--
-- Name: ficha_documentos ver; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY ver ON comercial.ficha_documentos FOR SELECT TO authenticated USING (( SELECT core.pode('comercial.formulario.ver'::text) AS pode));


--
-- Name: fichas ver; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY ver ON comercial.fichas FOR SELECT TO authenticated USING ((( SELECT core.pode('comercial.formulario.ver'::text) AS pode) OR ( SELECT core.pode('comercial.formulario.link'::text) AS pode) OR ( SELECT core.pode('comercial.contratos.editar'::text) AS pode)));


--
-- Name: fontes_de_para ver; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY ver ON comercial.fontes_de_para FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('comercial'::text) AS pode_modulo));


--
-- Name: importacoes ver; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY ver ON comercial.importacoes FOR SELECT TO authenticated USING (
CASE tipo
    WHEN 'censo'::text THEN ( SELECT core.pode('comercial.censo.importar'::text) AS pode)
    WHEN 'fichas'::text THEN ( SELECT core.pode('comercial.formulario.ver'::text) AS pode)
    WHEN 'pesquisa'::text THEN ( SELECT core.pode('comercial.pesquisa.editar'::text) AS pode)
    WHEN 'contatos'::text THEN ( SELECT core.pode('comercial.relacionamento.registrar'::text) AS pode)
    ELSE false
END);


--
-- Name: kit_documentos ver; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY ver ON comercial.kit_documentos FOR SELECT TO authenticated USING ((( SELECT core.pode('comercial.kit.ver'::text) AS pode) OR ( SELECT core.pode('comercial.contratos.ver'::text) AS pode) OR ( SELECT core.pode('comercial.contratos.editar'::text) AS pode)));


--
-- Name: kit_versoes ver; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY ver ON comercial.kit_versoes FOR SELECT TO authenticated USING ((( SELECT core.pode('comercial.kit.ver'::text) AS pode) OR ( SELECT core.pode('comercial.contratos.ver'::text) AS pode) OR ( SELECT core.pode('comercial.contratos.editar'::text) AS pode)));


--
-- Name: listas ver; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY ver ON comercial.listas FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('comercial'::text) AS pode_modulo));


--
-- Name: ocupacao_fotos ver; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY ver ON comercial.ocupacao_fotos FOR SELECT TO authenticated USING ((( SELECT core.pode('comercial.ocupacao.ver'::text) AS pode) OR ( SELECT core.pode('comercial.painel.ver'::text) AS pode)));


--
-- Name: parametros ver; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY ver ON comercial.parametros FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('comercial'::text) AS pode_modulo));


--
-- Name: pesquisa_imoveis ver; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY ver ON comercial.pesquisa_imoveis FOR SELECT TO authenticated USING ((( SELECT core.pode('comercial.pesquisa.ver'::text) AS pode) OR ( SELECT core.pode('comercial.pesquisa.editar'::text) AS pode)));


--
-- Name: propostas_evento ver; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY ver ON comercial.propostas_evento FOR SELECT TO authenticated USING ((( SELECT core.pode('comercial.eventos.ver'::text) AS pode) OR ( SELECT core.pode('comercial.eventos.editar'::text) AS pode)));


--
-- Name: rd_oportunidades ver; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY ver ON comercial.rd_oportunidades FOR SELECT TO authenticated USING ((( SELECT core.pode('comercial.funil.ver'::text) AS pode) OR ( SELECT core.pode('comercial.painel.ver'::text) AS pode) OR ( SELECT core.pode('comercial.parametros.editar'::text) AS pode)));


--
-- Name: tipos_luc ver; Type: POLICY; Schema: comercial; Owner: -
--

CREATE POLICY ver ON comercial.tipos_luc FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('comercial'::text) AS pode_modulo));


--
-- Name: cargos apagar; Type: POLICY; Schema: core; Owner: -
--

CREATE POLICY apagar ON core.cargos FOR DELETE TO authenticated USING (( SELECT core.pode('admin.usuarios'::text) AS pode));


--
-- Name: importacoes atualizar; Type: POLICY; Schema: core; Owner: -
--

CREATE POLICY atualizar ON core.importacoes FOR UPDATE TO authenticated USING (
CASE tipo
    WHEN 'folha'::core.tipo_importacao THEN ( SELECT core.pode('rh.folha'::text) AS pode)
    WHEN 'plano_saude'::core.tipo_importacao THEN ( SELECT core.pode('rh.beneficios'::text) AS pode)
    ELSE NULL::boolean
END) WITH CHECK (
CASE tipo
    WHEN 'folha'::core.tipo_importacao THEN ( SELECT core.pode('rh.folha'::text) AS pode)
    WHEN 'plano_saude'::core.tipo_importacao THEN ( SELECT core.pode('rh.beneficios'::text) AS pode)
    ELSE NULL::boolean
END);


--
-- Name: auditoria; Type: ROW SECURITY; Schema: core; Owner: -
--

ALTER TABLE core.auditoria ENABLE ROW LEVEL SECURITY;

--
-- Name: cargo_permissoes; Type: ROW SECURITY; Schema: core; Owner: -
--

ALTER TABLE core.cargo_permissoes ENABLE ROW LEVEL SECURITY;

--
-- Name: cargos; Type: ROW SECURITY; Schema: core; Owner: -
--

ALTER TABLE core.cargos ENABLE ROW LEVEL SECURITY;

--
-- Name: cargo_permissoes conceder; Type: POLICY; Schema: core; Owner: -
--

CREATE POLICY conceder ON core.cargo_permissoes FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('admin.usuarios'::text) AS pode));


--
-- Name: usuario_permissoes conceder; Type: POLICY; Schema: core; Owner: -
--

CREATE POLICY conceder ON core.usuario_permissoes FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('admin.usuarios'::text) AS pode));


--
-- Name: cargos criar; Type: POLICY; Schema: core; Owner: -
--

CREATE POLICY criar ON core.cargos FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('admin.usuarios'::text) AS pode));


--
-- Name: cargos editar; Type: POLICY; Schema: core; Owner: -
--

CREATE POLICY editar ON core.cargos FOR UPDATE TO authenticated USING (( SELECT core.pode('admin.usuarios'::text) AS pode)) WITH CHECK (( SELECT core.pode('admin.usuarios'::text) AS pode));


--
-- Name: empresa editar; Type: POLICY; Schema: core; Owner: -
--

CREATE POLICY editar ON core.empresa FOR UPDATE TO authenticated USING (( SELECT core.pode('admin.empresa'::text) AS pode)) WITH CHECK (( SELECT core.pode('admin.empresa'::text) AS pode));


--
-- Name: metas editar; Type: POLICY; Schema: core; Owner: -
--

CREATE POLICY editar ON core.metas TO authenticated USING ((((indicador ~~ 'rh.%'::text) AND ( SELECT core.pode('rh.parametros'::text) AS pode)) OR ((indicador ~~ 'financeiro.%'::text) AND ( SELECT core.pode('financeiro.importacao_parametros'::text) AS pode)) OR ((indicador ~~ 'marketing.%'::text) AND ( SELECT core.pode('marketing.parametros'::text) AS pode)) OR ((indicador ~~ 'comercial.%'::text) AND ( SELECT core.pode('comercial.painel.metas'::text) AS pode)) OR ((indicador ~~ 'sustentabilidade.%'::text) AND ( SELECT core.pode('sustentabilidade.parametros'::text) AS pode)))) WITH CHECK ((((indicador ~~ 'rh.%'::text) AND ( SELECT core.pode('rh.parametros'::text) AS pode)) OR ((indicador ~~ 'financeiro.%'::text) AND ( SELECT core.pode('financeiro.importacao_parametros'::text) AS pode)) OR ((indicador ~~ 'marketing.%'::text) AND ( SELECT core.pode('marketing.parametros'::text) AS pode)) OR ((indicador ~~ 'comercial.%'::text) AND ( SELECT core.pode('comercial.painel.metas'::text) AS pode)) OR ((indicador ~~ 'sustentabilidade.%'::text) AND ( SELECT core.pode('sustentabilidade.parametros'::text) AS pode))));


--
-- Name: empresa; Type: ROW SECURITY; Schema: core; Owner: -
--

ALTER TABLE core.empresa ENABLE ROW LEVEL SECURITY;

--
-- Name: importacoes enviar; Type: POLICY; Schema: core; Owner: -
--

CREATE POLICY enviar ON core.importacoes FOR INSERT TO authenticated WITH CHECK ((
CASE tipo
    WHEN 'folha'::core.tipo_importacao THEN ( SELECT core.pode('rh.folha'::text) AS pode)
    WHEN 'plano_saude'::core.tipo_importacao THEN ( SELECT core.pode('rh.beneficios'::text) AS pode)
    ELSE NULL::boolean
END AND (enviado_por = ( SELECT auth.uid() AS uid))));


--
-- Name: usuarios excluir; Type: POLICY; Schema: core; Owner: -
--

CREATE POLICY excluir ON core.usuarios FOR DELETE TO authenticated USING ((( SELECT core.pode('admin.usuarios'::text) AS pode) AND (id <> ( SELECT auth.uid() AS uid))));


--
-- Name: usuarios gerenciar; Type: POLICY; Schema: core; Owner: -
--

CREATE POLICY gerenciar ON core.usuarios FOR UPDATE TO authenticated USING (( SELECT core.pode('admin.usuarios'::text) AS pode)) WITH CHECK (( SELECT core.pode('admin.usuarios'::text) AS pode));


--
-- Name: importacoes; Type: ROW SECURITY; Schema: core; Owner: -
--

ALTER TABLE core.importacoes ENABLE ROW LEVEL SECURITY;

--
-- Name: logs; Type: ROW SECURITY; Schema: core; Owner: -
--

ALTER TABLE core.logs ENABLE ROW LEVEL SECURITY;

--
-- Name: metas; Type: ROW SECURITY; Schema: core; Owner: -
--

ALTER TABLE core.metas ENABLE ROW LEVEL SECURITY;

--
-- Name: permissoes; Type: ROW SECURITY; Schema: core; Owner: -
--

ALTER TABLE core.permissoes ENABLE ROW LEVEL SECURITY;

--
-- Name: preferencias; Type: ROW SECURITY; Schema: core; Owner: -
--

ALTER TABLE core.preferencias ENABLE ROW LEVEL SECURITY;

--
-- Name: preferencias proprias; Type: POLICY; Schema: core; Owner: -
--

CREATE POLICY proprias ON core.preferencias TO authenticated USING ((usuario_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((usuario_id = ( SELECT auth.uid() AS uid)));


--
-- Name: cargo_permissoes revogar; Type: POLICY; Schema: core; Owner: -
--

CREATE POLICY revogar ON core.cargo_permissoes FOR DELETE TO authenticated USING (( SELECT core.pode('admin.usuarios'::text) AS pode));


--
-- Name: usuario_permissoes revogar; Type: POLICY; Schema: core; Owner: -
--

CREATE POLICY revogar ON core.usuario_permissoes FOR DELETE TO authenticated USING (( SELECT core.pode('admin.usuarios'::text) AS pode));


--
-- Name: usuario_permissoes; Type: ROW SECURITY; Schema: core; Owner: -
--

ALTER TABLE core.usuario_permissoes ENABLE ROW LEVEL SECURITY;

--
-- Name: usuarios; Type: ROW SECURITY; Schema: core; Owner: -
--

ALTER TABLE core.usuarios ENABLE ROW LEVEL SECURITY;

--
-- Name: auditoria ver; Type: POLICY; Schema: core; Owner: -
--

CREATE POLICY ver ON core.auditoria FOR SELECT TO authenticated USING ((( SELECT core.pode('admin.historico'::text) AS pode) OR
CASE
    WHEN (tabela ~~ 'rh.%'::text) THEN ( SELECT core.pode('rh.parametros'::text) AS pode)
    WHEN (tabela = 'os.feriados'::text) THEN (( SELECT core.pode('os.historico'::text) AS pode) OR ( SELECT core.pode('comercial.parametros.editar'::text) AS pode))
    WHEN (tabela ~~ 'os.%'::text) THEN ( SELECT core.pode('os.historico'::text) AS pode)
    WHEN (tabela ~~ 'marketing.%'::text) THEN ( SELECT core.pode('marketing.parametros'::text) AS pode)
    WHEN (tabela ~~ 'comercial.%'::text) THEN ( SELECT core.pode('comercial.parametros.editar'::text) AS pode)
    WHEN (tabela = 'core.metas'::text) THEN (( SELECT core.pode('rh.parametros'::text) AS pode) OR ( SELECT core.pode('financeiro.importacao_parametros'::text) AS pode) OR ( SELECT core.pode('marketing.parametros'::text) AS pode) OR ( SELECT core.pode('comercial.painel.metas'::text) AS pode))
    WHEN (tabela = ANY (ARRAY['core.usuario_permissoes'::text, 'core.usuarios'::text, 'core.cargos'::text, 'core.cargo_permissoes'::text])) THEN ( SELECT core.pode('admin.usuarios'::text) AS pode)
    WHEN (tabela = 'core.empresa'::text) THEN ( SELECT core.pode('admin.empresa'::text) AS pode)
    WHEN (tabela = 'integracao.credenciais'::text) THEN ( SELECT core.pode('admin.integracoes'::text) AS pode)
    ELSE false
END));


--
-- Name: cargo_permissoes ver; Type: POLICY; Schema: core; Owner: -
--

CREATE POLICY ver ON core.cargo_permissoes FOR SELECT TO authenticated USING ((( SELECT core.pode('admin.usuarios'::text) AS pode) OR (cargo_id = ( SELECT u.cargo_id
   FROM core.usuarios u
  WHERE (u.id = ( SELECT auth.uid() AS uid))))));


--
-- Name: cargos ver; Type: POLICY; Schema: core; Owner: -
--

CREATE POLICY ver ON core.cargos FOR SELECT TO authenticated USING ((( SELECT core.pode('admin.usuarios'::text) AS pode) OR (id = ( SELECT u.cargo_id
   FROM core.usuarios u
  WHERE (u.id = ( SELECT auth.uid() AS uid))))));


--
-- Name: empresa ver; Type: POLICY; Schema: core; Owner: -
--

CREATE POLICY ver ON core.empresa FOR SELECT TO authenticated USING (true);


--
-- Name: importacoes ver; Type: POLICY; Schema: core; Owner: -
--

CREATE POLICY ver ON core.importacoes FOR SELECT TO authenticated USING (
CASE tipo
    WHEN 'folha'::core.tipo_importacao THEN ( SELECT core.pode('rh.folha'::text) AS pode)
    WHEN 'plano_saude'::core.tipo_importacao THEN ( SELECT core.pode('rh.beneficios'::text) AS pode)
    ELSE NULL::boolean
END);


--
-- Name: logs ver; Type: POLICY; Schema: core; Owner: -
--

CREATE POLICY ver ON core.logs FOR SELECT TO authenticated USING (( SELECT core.pode('admin.historico'::text) AS pode));


--
-- Name: metas ver; Type: POLICY; Schema: core; Owner: -
--

CREATE POLICY ver ON core.metas FOR SELECT TO authenticated USING (
CASE split_part(indicador, '.'::text, 1)
    WHEN 'rh'::text THEN ( SELECT core.pode_modulo('rh'::text) AS pode_modulo)
    WHEN 'financeiro'::text THEN ( SELECT core.pode_modulo('financeiro'::text) AS pode_modulo)
    WHEN 'os'::text THEN ( SELECT core.pode_modulo('os'::text) AS pode_modulo)
    WHEN 'marketing'::text THEN ( SELECT core.pode_modulo('marketing'::text) AS pode_modulo)
    WHEN 'comercial'::text THEN (( SELECT core.pode('comercial.painel.ver'::text) AS pode) OR ( SELECT core.pode('comercial.painel.metas'::text) AS pode))
    ELSE core.pode_modulo(split_part(indicador, '.'::text, 1))
END);


--
-- Name: permissoes ver; Type: POLICY; Schema: core; Owner: -
--

CREATE POLICY ver ON core.permissoes FOR SELECT TO authenticated USING (true);


--
-- Name: usuario_permissoes ver; Type: POLICY; Schema: core; Owner: -
--

CREATE POLICY ver ON core.usuario_permissoes FOR SELECT TO authenticated USING (((usuario_id = ( SELECT auth.uid() AS uid)) OR ( SELECT core.pode('admin.usuarios'::text) AS pode)));


--
-- Name: usuarios ver; Type: POLICY; Schema: core; Owner: -
--

CREATE POLICY ver ON core.usuarios FOR SELECT TO authenticated USING (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT core.pode('admin.usuarios'::text) AS pode)));


--
-- Name: estacionamento_movimento; Type: ROW SECURITY; Schema: financeiro; Owner: -
--

ALTER TABLE financeiro.estacionamento_movimento ENABLE ROW LEVEL SECURITY;

--
-- Name: estacionamento_pagamentos; Type: ROW SECURITY; Schema: financeiro; Owner: -
--

ALTER TABLE financeiro.estacionamento_pagamentos ENABLE ROW LEVEL SECURITY;

--
-- Name: estacionamento_movimento ver; Type: POLICY; Schema: financeiro; Owner: -
--

CREATE POLICY ver ON financeiro.estacionamento_movimento FOR SELECT TO authenticated USING ((( SELECT core.pode('financeiro.painel'::text) AS pode) OR ( SELECT core.pode('financeiro.fluxo_de_caixa'::text) AS pode) OR ( SELECT core.pode('financeiro.performance_capital'::text) AS pode)));


--
-- Name: estacionamento_pagamentos ver; Type: POLICY; Schema: financeiro; Owner: -
--

CREATE POLICY ver ON financeiro.estacionamento_pagamentos FOR SELECT TO authenticated USING ((( SELECT core.pode('financeiro.painel'::text) AS pode) OR ( SELECT core.pode('financeiro.fluxo_de_caixa'::text) AS pode) OR ( SELECT core.pode('financeiro.performance_capital'::text) AS pode)));


--
-- Name: formularios criar; Type: POLICY; Schema: formularios; Owner: -
--

CREATE POLICY criar ON formularios.formularios FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('formularios.editar'::text) AS pode) AND (criado_por = ( SELECT auth.uid() AS uid))));


--
-- Name: formularios editar; Type: POLICY; Schema: formularios; Owner: -
--

CREATE POLICY editar ON formularios.formularios FOR UPDATE TO authenticated USING (( SELECT core.pode('formularios.editar'::text) AS pode)) WITH CHECK (( SELECT core.pode('formularios.editar'::text) AS pode));


--
-- Name: formularios excluir; Type: POLICY; Schema: formularios; Owner: -
--

CREATE POLICY excluir ON formularios.formularios FOR DELETE TO authenticated USING (( SELECT core.pode('formularios.editar'::text) AS pode));


--
-- Name: respostas excluir; Type: POLICY; Schema: formularios; Owner: -
--

CREATE POLICY excluir ON formularios.respostas FOR DELETE TO authenticated USING (( SELECT core.pode('formularios.editar'::text) AS pode));


--
-- Name: formularios; Type: ROW SECURITY; Schema: formularios; Owner: -
--

ALTER TABLE formularios.formularios ENABLE ROW LEVEL SECURITY;

--
-- Name: respostas; Type: ROW SECURITY; Schema: formularios; Owner: -
--

ALTER TABLE formularios.respostas ENABLE ROW LEVEL SECURITY;

--
-- Name: formularios ver; Type: POLICY; Schema: formularios; Owner: -
--

CREATE POLICY ver ON formularios.formularios FOR SELECT TO authenticated USING ((( SELECT core.pode('formularios.ver'::text) AS pode) OR ( SELECT core.pode('formularios.editar'::text) AS pode)));


--
-- Name: respostas ver; Type: POLICY; Schema: formularios; Owner: -
--

CREATE POLICY ver ON formularios.respostas FOR SELECT TO authenticated USING ((( SELECT core.pode('formularios.ver'::text) AS pode) OR ( SELECT core.pode('formularios.editar'::text) AS pode)));


--
-- Name: camera_contagens; Type: ROW SECURITY; Schema: integracao; Owner: -
--

ALTER TABLE integracao.camera_contagens ENABLE ROW LEVEL SECURITY;

--
-- Name: cameras; Type: ROW SECURITY; Schema: integracao; Owner: -
--

ALTER TABLE integracao.cameras ENABLE ROW LEVEL SECURITY;

--
-- Name: credenciais; Type: ROW SECURITY; Schema: integracao; Owner: -
--

ALTER TABLE integracao.credenciais ENABLE ROW LEVEL SECURITY;

--
-- Name: cursores; Type: ROW SECURITY; Schema: integracao; Owner: -
--

ALTER TABLE integracao.cursores ENABLE ROW LEVEL SECURITY;

--
-- Name: registros_brutos; Type: ROW SECURITY; Schema: integracao; Owner: -
--

ALTER TABLE integracao.registros_brutos ENABLE ROW LEVEL SECURITY;

--
-- Name: sync_runs; Type: ROW SECURITY; Schema: integracao; Owner: -
--

ALTER TABLE integracao.sync_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: benchmark; Type: ROW SECURITY; Schema: marketing; Owner: -
--

ALTER TABLE marketing.benchmark ENABLE ROW LEVEL SECURITY;

--
-- Name: benchmark editar; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY editar ON marketing.benchmark FOR UPDATE TO authenticated USING (( SELECT core.pode('marketing.parametros'::text) AS pode)) WITH CHECK (( SELECT core.pode('marketing.parametros'::text) AS pode));


--
-- Name: landing_pages editar; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY editar ON marketing.landing_pages FOR UPDATE TO authenticated USING (( SELECT core.pode('marketing.parametros'::text) AS pode)) WITH CHECK (( SELECT core.pode('marketing.parametros'::text) AS pode));


--
-- Name: locatarios editar; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY editar ON marketing.locatarios FOR UPDATE TO authenticated USING (( SELECT core.pode('marketing.parametros'::text) AS pode)) WITH CHECK (( SELECT core.pode('marketing.parametros'::text) AS pode));


--
-- Name: marca_blocos editar; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY editar ON marketing.marca_blocos FOR UPDATE TO authenticated USING (( SELECT core.pode('marketing.marca.editar'::text) AS pode)) WITH CHECK (( SELECT core.pode('marketing.marca.editar'::text) AS pode));


--
-- Name: parametros editar; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY editar ON marketing.parametros FOR UPDATE TO authenticated USING (( SELECT core.pode('marketing.parametros'::text) AS pode)) WITH CHECK (( SELECT core.pode('marketing.parametros'::text) AS pode));


--
-- Name: regras_alerta editar; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY editar ON marketing.regras_alerta FOR UPDATE TO authenticated USING (( SELECT core.pode('marketing.parametros'::text) AS pode)) WITH CHECK (( SELECT core.pode('marketing.parametros'::text) AS pode));


--
-- Name: ronda_codigos editar; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY editar ON marketing.ronda_codigos FOR UPDATE TO authenticated USING (( SELECT core.pode('marketing.parametros'::text) AS pode)) WITH CHECK (( SELECT core.pode('marketing.parametros'::text) AS pode));


--
-- Name: temas editar; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY editar ON marketing.temas FOR UPDATE TO authenticated USING (( SELECT core.pode('marketing.parametros'::text) AS pode)) WITH CHECK (( SELECT core.pode('marketing.parametros'::text) AS pode));


--
-- Name: landing_pages excluir; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY excluir ON marketing.landing_pages FOR DELETE TO authenticated USING (( SELECT core.pode('marketing.parametros'::text) AS pode));


--
-- Name: locatarios excluir; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY excluir ON marketing.locatarios FOR DELETE TO authenticated USING (( SELECT core.pode('marketing.parametros'::text) AS pode));


--
-- Name: ronda_codigos excluir; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY excluir ON marketing.ronda_codigos FOR DELETE TO authenticated USING (( SELECT core.pode('marketing.parametros'::text) AS pode));


--
-- Name: temas excluir; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY excluir ON marketing.temas FOR DELETE TO authenticated USING (( SELECT core.pode('marketing.parametros'::text) AS pode));


--
-- Name: benchmark incluir; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY incluir ON marketing.benchmark FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('marketing.parametros'::text) AS pode));


--
-- Name: landing_pages incluir; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY incluir ON marketing.landing_pages FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('marketing.parametros'::text) AS pode));


--
-- Name: locatarios incluir; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY incluir ON marketing.locatarios FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('marketing.parametros'::text) AS pode));


--
-- Name: ronda_codigos incluir; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY incluir ON marketing.ronda_codigos FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('marketing.parametros'::text) AS pode));


--
-- Name: temas incluir; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY incluir ON marketing.temas FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('marketing.parametros'::text) AS pode));


--
-- Name: landing_pages; Type: ROW SECURITY; Schema: marketing; Owner: -
--

ALTER TABLE marketing.landing_pages ENABLE ROW LEVEL SECURITY;

--
-- Name: locatarios; Type: ROW SECURITY; Schema: marketing; Owner: -
--

ALTER TABLE marketing.locatarios ENABLE ROW LEVEL SECURITY;

--
-- Name: marca_arquivos; Type: ROW SECURITY; Schema: marketing; Owner: -
--

ALTER TABLE marketing.marca_arquivos ENABLE ROW LEVEL SECURITY;

--
-- Name: marca_blocos; Type: ROW SECURITY; Schema: marketing; Owner: -
--

ALTER TABLE marketing.marca_blocos ENABLE ROW LEVEL SECURITY;

--
-- Name: marca_versoes; Type: ROW SECURITY; Schema: marketing; Owner: -
--

ALTER TABLE marketing.marca_versoes ENABLE ROW LEVEL SECURITY;

--
-- Name: parametros; Type: ROW SECURITY; Schema: marketing; Owner: -
--

ALTER TABLE marketing.parametros ENABLE ROW LEVEL SECURITY;

--
-- Name: rd_contatos; Type: ROW SECURITY; Schema: marketing; Owner: -
--

ALTER TABLE marketing.rd_contatos ENABLE ROW LEVEL SECURITY;

--
-- Name: rd_conversoes; Type: ROW SECURITY; Schema: marketing; Owner: -
--

ALTER TABLE marketing.rd_conversoes ENABLE ROW LEVEL SECURITY;

--
-- Name: rd_landing_pages_dia; Type: ROW SECURITY; Schema: marketing; Owner: -
--

ALTER TABLE marketing.rd_landing_pages_dia ENABLE ROW LEVEL SECURITY;

--
-- Name: redes_dia; Type: ROW SECURITY; Schema: marketing; Owner: -
--

ALTER TABLE marketing.redes_dia ENABLE ROW LEVEL SECURITY;

--
-- Name: regras_alerta; Type: ROW SECURITY; Schema: marketing; Owner: -
--

ALTER TABLE marketing.regras_alerta ENABLE ROW LEVEL SECURITY;

--
-- Name: benchmark remover; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY remover ON marketing.benchmark FOR DELETE TO authenticated USING (( SELECT core.pode('marketing.parametros'::text) AS pode));


--
-- Name: ronda_codigos; Type: ROW SECURITY; Schema: marketing; Owner: -
--

ALTER TABLE marketing.ronda_codigos ENABLE ROW LEVEL SECURITY;

--
-- Name: temas; Type: ROW SECURITY; Schema: marketing; Owner: -
--

ALTER TABLE marketing.temas ENABLE ROW LEVEL SECURITY;

--
-- Name: benchmark ver; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY ver ON marketing.benchmark FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('marketing'::text) AS pode_modulo));


--
-- Name: landing_pages ver; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY ver ON marketing.landing_pages FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('marketing'::text) AS pode_modulo));


--
-- Name: locatarios ver; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY ver ON marketing.locatarios FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('marketing'::text) AS pode_modulo));


--
-- Name: marca_arquivos ver; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY ver ON marketing.marca_arquivos FOR SELECT TO authenticated USING (( SELECT core.pode('marketing.marca'::text) AS pode));


--
-- Name: marca_blocos ver; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY ver ON marketing.marca_blocos FOR SELECT TO authenticated USING (( SELECT core.pode('marketing.marca'::text) AS pode));


--
-- Name: marca_versoes ver; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY ver ON marketing.marca_versoes FOR SELECT TO authenticated USING (( SELECT core.pode('marketing.marca'::text) AS pode));


--
-- Name: parametros ver; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY ver ON marketing.parametros FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('marketing'::text) AS pode_modulo));


--
-- Name: rd_contatos ver; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY ver ON marketing.rd_contatos FOR SELECT TO authenticated USING (( SELECT core.pode('marketing.site'::text) AS pode));


--
-- Name: rd_conversoes ver; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY ver ON marketing.rd_conversoes FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('marketing'::text) AS pode_modulo));


--
-- Name: rd_landing_pages_dia ver; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY ver ON marketing.rd_landing_pages_dia FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('marketing'::text) AS pode_modulo));


--
-- Name: redes_dia ver; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY ver ON marketing.redes_dia FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('marketing'::text) AS pode_modulo));


--
-- Name: regras_alerta ver; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY ver ON marketing.regras_alerta FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('marketing'::text) AS pode_modulo));


--
-- Name: ronda_codigos ver; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY ver ON marketing.ronda_codigos FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('marketing'::text) AS pode_modulo));


--
-- Name: temas ver; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY ver ON marketing.temas FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('marketing'::text) AS pode_modulo));


--
-- Name: agua_contas; Type: ROW SECURITY; Schema: operacoes; Owner: -
--

ALTER TABLE operacoes.agua_contas ENABLE ROW LEVEL SECURITY;

--
-- Name: agua_leituras; Type: ROW SECURITY; Schema: operacoes; Owner: -
--

ALTER TABLE operacoes.agua_leituras ENABLE ROW LEVEL SECURITY;

--
-- Name: agua_valores; Type: ROW SECURITY; Schema: operacoes; Owner: -
--

ALTER TABLE operacoes.agua_valores ENABLE ROW LEVEL SECURITY;

--
-- Name: agua_vinculos; Type: ROW SECURITY; Schema: operacoes; Owner: -
--

ALTER TABLE operacoes.agua_vinculos ENABLE ROW LEVEL SECURITY;

--
-- Name: caixa_ocupantes; Type: ROW SECURITY; Schema: operacoes; Owner: -
--

ALTER TABLE operacoes.caixa_ocupantes ENABLE ROW LEVEL SECURITY;

--
-- Name: caixas; Type: ROW SECURITY; Schema: operacoes; Owner: -
--

ALTER TABLE operacoes.caixas ENABLE ROW LEVEL SECURITY;

--
-- Name: agua_contas criar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY criar ON operacoes.agua_contas FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('operacoes.agua.importar'::text) AS pode) AND (NOT vigente) AND (NOT exemplo) AND (EXISTS ( SELECT 1
   FROM operacoes.importacoes i
  WHERE ((i.id = agua_contas.importacao_id) AND (i.tipo = 'agua_conta'::text) AND (i.status = 'previa'::text) AND (i.criado_por = ( SELECT auth.uid() AS uid)))))));


--
-- Name: agua_leituras criar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY criar ON operacoes.agua_leituras FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('operacoes.agua.importar'::text) AS pode) AND (NOT vigente) AND (NOT exemplo) AND (EXISTS ( SELECT 1
   FROM operacoes.importacoes i
  WHERE ((i.id = agua_leituras.importacao_id) AND (i.tipo = 'agua'::text) AND (i.status = 'previa'::text) AND (i.criado_por = ( SELECT auth.uid() AS uid)))))));


--
-- Name: agua_valores criar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY criar ON operacoes.agua_valores FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM (operacoes.agua_leituras l
     JOIN operacoes.importacoes i ON ((i.id = l.importacao_id)))
  WHERE ((l.id = agua_valores.leitura_id) AND (i.status = 'previa'::text) AND (i.criado_por = ( SELECT auth.uid() AS uid))))));


--
-- Name: agua_vinculos criar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY criar ON operacoes.agua_vinculos FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('operacoes.agua.vinculo'::text) AS pode) AND (criado_por = ( SELECT auth.uid() AS uid))));


--
-- Name: caixas criar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY criar ON operacoes.caixas FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('operacoes.energia.editar'::text) AS pode));


--
-- Name: energia_fatura_itens criar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY criar ON operacoes.energia_fatura_itens FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM (operacoes.energia_faturas f
     JOIN operacoes.importacoes i ON ((i.id = f.importacao_id)))
  WHERE ((f.id = energia_fatura_itens.fatura_id) AND (i.status = 'previa'::text) AND (i.criado_por = ( SELECT auth.uid() AS uid))))));


--
-- Name: energia_faturas criar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY criar ON operacoes.energia_faturas FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('operacoes.energia.contas'::text) AS pode) AND (NOT exemplo) AND (importado_por = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM operacoes.importacoes i
  WHERE ((i.id = energia_faturas.importacao_id) AND (i.tipo = 'energisa'::text) AND (i.status = 'previa'::text) AND (i.criado_por = ( SELECT auth.uid() AS uid)))))));


--
-- Name: energia_unidades criar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY criar ON operacoes.energia_unidades FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('operacoes.energia.contas'::text) AS pode) OR ( SELECT core.pode('operacoes.parametros'::text) AS pode)));


--
-- Name: hidrometros criar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY criar ON operacoes.hidrometros FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('operacoes.agua.importar'::text) AS pode) OR ( SELECT core.pode('operacoes.agua.vinculo'::text) AS pode)));


--
-- Name: importacao_valores criar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY criar ON operacoes.importacao_valores FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM operacoes.importacoes i
  WHERE ((i.id = importacao_valores.importacao_id) AND (i.status = 'previa'::text) AND (i.criado_por = ( SELECT auth.uid() AS uid))))));


--
-- Name: importacoes criar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY criar ON operacoes.importacoes FOR INSERT TO authenticated WITH CHECK ((( SELECT operacoes.pode_importar(importacoes.tipo) AS pode_importar) AND (status = 'previa'::text) AND (criado_por = ( SELECT auth.uid() AS uid)) AND (NOT exemplo)));


--
-- Name: limpeza_anexos criar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY criar ON operacoes.limpeza_anexos FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('operacoes.limpeza.fechar'::text) AS pode) AND (enviado_por = ( SELECT auth.uid() AS uid))));


--
-- Name: limpeza_contrato criar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY criar ON operacoes.limpeza_contrato FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('operacoes.limpeza.fechar'::text) AS pode) AND operacoes.limpeza_aberto(referencia)));


--
-- Name: limpeza_equipe criar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY criar ON operacoes.limpeza_equipe FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('operacoes.limpeza.fechar'::text) AS pode) AND operacoes.limpeza_aberto(referencia)));


--
-- Name: limpeza_extras criar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY criar ON operacoes.limpeza_extras FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('operacoes.limpeza.fechar'::text) AS pode) AND operacoes.limpeza_aberto(referencia)));


--
-- Name: limpeza_meses criar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY criar ON operacoes.limpeza_meses FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('operacoes.limpeza.fechar'::text) AS pode) AND (status = 'aberto'::text) AND (NOT exemplo) AND (enviado_em IS NULL) AND (fechado_em IS NULL)));


--
-- Name: limpeza_minutos criar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY criar ON operacoes.limpeza_minutos FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('operacoes.limpeza.fechar'::text) AS pode) AND operacoes.limpeza_aberto(referencia)));


--
-- Name: obra_realizado criar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY criar ON operacoes.obra_realizado FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('operacoes.obras.importar'::text) AS pode) AND (NOT exemplo) AND (lancado_por = ( SELECT auth.uid() AS uid))));


--
-- Name: obras criar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY criar ON operacoes.obras FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('operacoes.obras.importar'::text) AS pode) AND (NOT exemplo)));


--
-- Name: orcamento_etapas criar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY criar ON operacoes.orcamento_etapas FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM (operacoes.orcamento_revisoes r
     JOIN operacoes.importacoes i ON ((i.id = r.importacao_id)))
  WHERE ((r.id = orcamento_etapas.revisao_id) AND (i.status = 'previa'::text) AND (i.criado_por = ( SELECT auth.uid() AS uid))))));


--
-- Name: orcamento_previsto criar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY criar ON operacoes.orcamento_previsto FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM ((operacoes.orcamento_etapas e
     JOIN operacoes.orcamento_revisoes r ON ((r.id = e.revisao_id)))
     JOIN operacoes.importacoes i ON ((i.id = r.importacao_id)))
  WHERE ((e.id = orcamento_previsto.etapa_id) AND (i.status = 'previa'::text) AND (i.criado_por = ( SELECT auth.uid() AS uid))))));


--
-- Name: orcamento_revisoes criar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY criar ON operacoes.orcamento_revisoes FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('operacoes.obras.importar'::text) AS pode) AND (NOT vigente) AND (NOT exemplo) AND (EXISTS ( SELECT 1
   FROM operacoes.importacoes i
  WHERE ((i.id = orcamento_revisoes.importacao_id) AND (i.tipo = 'orcamento'::text) AND (i.status = 'previa'::text) AND (i.criado_por = ( SELECT auth.uid() AS uid)))))));


--
-- Name: quadros criar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY criar ON operacoes.quadros FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('operacoes.energia.editar'::text) AS pode));


--
-- Name: salas criar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY criar ON operacoes.salas FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('operacoes.energia.editar'::text) AS pode));


--
-- Name: termos criar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY criar ON operacoes.termos FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('operacoes.energia.termo'::text) AS pode) AND (emitido_por = ( SELECT auth.uid() AS uid))));


--
-- Name: diario_cadastros; Type: ROW SECURITY; Schema: operacoes; Owner: -
--

ALTER TABLE operacoes.diario_cadastros ENABLE ROW LEVEL SECURITY;

--
-- Name: diario_obras; Type: ROW SECURITY; Schema: operacoes; Owner: -
--

ALTER TABLE operacoes.diario_obras ENABLE ROW LEVEL SECURITY;

--
-- Name: diario_relatorios; Type: ROW SECURITY; Schema: operacoes; Owner: -
--

ALTER TABLE operacoes.diario_relatorios ENABLE ROW LEVEL SECURITY;

--
-- Name: agua_contas editar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY editar ON operacoes.agua_contas FOR UPDATE TO authenticated USING ((( SELECT core.pode('operacoes.agua.importar'::text) AS pode) AND (vigente OR (EXISTS ( SELECT 1
   FROM operacoes.importacoes i
  WHERE ((i.id = agua_contas.importacao_id) AND (i.status = 'previa'::text) AND (i.criado_por = ( SELECT auth.uid() AS uid)))))))) WITH CHECK (( SELECT core.pode('operacoes.agua.importar'::text) AS pode));


--
-- Name: agua_leituras editar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY editar ON operacoes.agua_leituras FOR UPDATE TO authenticated USING ((( SELECT core.pode('operacoes.agua.importar'::text) AS pode) AND vigente)) WITH CHECK ((( SELECT core.pode('operacoes.agua.importar'::text) AS pode) AND vigente));


--
-- Name: agua_valores editar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY editar ON operacoes.agua_valores FOR UPDATE TO authenticated USING ((( SELECT core.pode('operacoes.agua.importar'::text) AS pode) AND ( SELECT core.pode('operacoes.agua.valores'::text) AS pode) AND (EXISTS ( SELECT 1
   FROM operacoes.agua_leituras l
  WHERE ((l.id = agua_valores.leitura_id) AND l.vigente))))) WITH CHECK ((( SELECT core.pode('operacoes.agua.importar'::text) AS pode) AND ( SELECT core.pode('operacoes.agua.valores'::text) AS pode)));


--
-- Name: caixas editar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY editar ON operacoes.caixas FOR UPDATE TO authenticated USING (( SELECT core.pode('operacoes.energia.editar'::text) AS pode)) WITH CHECK (( SELECT core.pode('operacoes.energia.editar'::text) AS pode));


--
-- Name: energia_unidades editar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY editar ON operacoes.energia_unidades FOR UPDATE TO authenticated USING ((( SELECT core.pode('operacoes.energia.contas'::text) AS pode) OR ( SELECT core.pode('operacoes.parametros'::text) AS pode))) WITH CHECK ((( SELECT core.pode('operacoes.energia.contas'::text) AS pode) OR ( SELECT core.pode('operacoes.parametros'::text) AS pode)));


--
-- Name: hidrometros editar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY editar ON operacoes.hidrometros FOR UPDATE TO authenticated USING ((( SELECT core.pode('operacoes.agua.importar'::text) AS pode) OR ( SELECT core.pode('operacoes.agua.vinculo'::text) AS pode))) WITH CHECK ((( SELECT core.pode('operacoes.agua.importar'::text) AS pode) OR ( SELECT core.pode('operacoes.agua.vinculo'::text) AS pode)));


--
-- Name: importacoes editar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY editar ON operacoes.importacoes FOR UPDATE TO authenticated USING (((status = 'previa'::text) AND (criado_por = ( SELECT auth.uid() AS uid)) AND ( SELECT operacoes.pode_importar(importacoes.tipo) AS pode_importar))) WITH CHECK (((status = 'previa'::text) AND (criado_por = ( SELECT auth.uid() AS uid))));


--
-- Name: limpeza_contrato editar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY editar ON operacoes.limpeza_contrato FOR UPDATE TO authenticated USING ((( SELECT core.pode('operacoes.limpeza.fechar'::text) AS pode) AND operacoes.limpeza_aberto(referencia))) WITH CHECK (operacoes.limpeza_aberto(referencia));


--
-- Name: limpeza_equipe editar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY editar ON operacoes.limpeza_equipe FOR UPDATE TO authenticated USING ((( SELECT core.pode('operacoes.limpeza.fechar'::text) AS pode) AND operacoes.limpeza_aberto(referencia))) WITH CHECK (operacoes.limpeza_aberto(referencia));


--
-- Name: limpeza_extras editar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY editar ON operacoes.limpeza_extras FOR UPDATE TO authenticated USING ((( SELECT core.pode('operacoes.limpeza.fechar'::text) AS pode) AND operacoes.limpeza_aberto(referencia))) WITH CHECK (operacoes.limpeza_aberto(referencia));


--
-- Name: limpeza_meses editar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY editar ON operacoes.limpeza_meses FOR UPDATE TO authenticated USING ((( SELECT core.pode('operacoes.limpeza.fechar'::text) AS pode) AND (status = 'aberto'::text))) WITH CHECK (((status = 'aberto'::text) AND (enviado_em IS NULL)));


--
-- Name: limpeza_minutos editar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY editar ON operacoes.limpeza_minutos FOR UPDATE TO authenticated USING ((( SELECT core.pode('operacoes.limpeza.fechar'::text) AS pode) AND operacoes.limpeza_aberto(referencia))) WITH CHECK (operacoes.limpeza_aberto(referencia));


--
-- Name: obra_realizado editar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY editar ON operacoes.obra_realizado FOR UPDATE TO authenticated USING ((( SELECT core.pode('operacoes.obras.importar'::text) AS pode) AND (origem = 'tela'::text))) WITH CHECK ((( SELECT core.pode('operacoes.obras.importar'::text) AS pode) AND (origem = 'tela'::text)));


--
-- Name: obras editar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY editar ON operacoes.obras FOR UPDATE TO authenticated USING (( SELECT core.pode('operacoes.obras.importar'::text) AS pode)) WITH CHECK (( SELECT core.pode('operacoes.obras.importar'::text) AS pode));


--
-- Name: parametros editar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY editar ON operacoes.parametros FOR UPDATE TO authenticated USING (( SELECT core.pode('operacoes.parametros'::text) AS pode)) WITH CHECK (( SELECT core.pode('operacoes.parametros'::text) AS pode));


--
-- Name: quadros editar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY editar ON operacoes.quadros FOR UPDATE TO authenticated USING (( SELECT core.pode('operacoes.energia.editar'::text) AS pode)) WITH CHECK (( SELECT core.pode('operacoes.energia.editar'::text) AS pode));


--
-- Name: salas editar; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY editar ON operacoes.salas FOR UPDATE TO authenticated USING (( SELECT core.pode('operacoes.energia.editar'::text) AS pode)) WITH CHECK (( SELECT core.pode('operacoes.energia.editar'::text) AS pode));


--
-- Name: energia_fatura_itens; Type: ROW SECURITY; Schema: operacoes; Owner: -
--

ALTER TABLE operacoes.energia_fatura_itens ENABLE ROW LEVEL SECURITY;

--
-- Name: energia_faturas; Type: ROW SECURITY; Schema: operacoes; Owner: -
--

ALTER TABLE operacoes.energia_faturas ENABLE ROW LEVEL SECURITY;

--
-- Name: energia_unidades; Type: ROW SECURITY; Schema: operacoes; Owner: -
--

ALTER TABLE operacoes.energia_unidades ENABLE ROW LEVEL SECURITY;

--
-- Name: agua_leituras excluir; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY excluir ON operacoes.agua_leituras FOR DELETE TO authenticated USING ((( SELECT core.pode('operacoes.agua.importar'::text) AS pode) AND vigente));


--
-- Name: agua_vinculos excluir; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY excluir ON operacoes.agua_vinculos FOR DELETE TO authenticated USING (( SELECT core.pode('operacoes.agua.vinculo'::text) AS pode));


--
-- Name: caixas excluir; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY excluir ON operacoes.caixas FOR DELETE TO authenticated USING (( SELECT core.pode('operacoes.energia.editar'::text) AS pode));


--
-- Name: hidrometros excluir; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY excluir ON operacoes.hidrometros FOR DELETE TO authenticated USING ((( SELECT core.pode('operacoes.agua.importar'::text) AS pode) OR ( SELECT core.pode('operacoes.agua.vinculo'::text) AS pode)));


--
-- Name: limpeza_anexos excluir; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY excluir ON operacoes.limpeza_anexos FOR DELETE TO authenticated USING ((( SELECT core.pode('operacoes.limpeza.fechar'::text) AS pode) AND operacoes.limpeza_aberto(referencia)));


--
-- Name: limpeza_contrato excluir; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY excluir ON operacoes.limpeza_contrato FOR DELETE TO authenticated USING ((( SELECT core.pode('operacoes.limpeza.fechar'::text) AS pode) AND operacoes.limpeza_aberto(referencia)));


--
-- Name: limpeza_equipe excluir; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY excluir ON operacoes.limpeza_equipe FOR DELETE TO authenticated USING ((( SELECT core.pode('operacoes.limpeza.fechar'::text) AS pode) AND operacoes.limpeza_aberto(referencia)));


--
-- Name: limpeza_extras excluir; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY excluir ON operacoes.limpeza_extras FOR DELETE TO authenticated USING ((( SELECT core.pode('operacoes.limpeza.fechar'::text) AS pode) AND operacoes.limpeza_aberto(referencia)));


--
-- Name: limpeza_meses excluir; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY excluir ON operacoes.limpeza_meses FOR DELETE TO authenticated USING ((( SELECT core.pode('operacoes.limpeza.fechar'::text) AS pode) AND (status = 'aberto'::text) AND (origem = 'tela'::text)));


--
-- Name: limpeza_minutos excluir; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY excluir ON operacoes.limpeza_minutos FOR DELETE TO authenticated USING ((( SELECT core.pode('operacoes.limpeza.fechar'::text) AS pode) AND operacoes.limpeza_aberto(referencia)));


--
-- Name: obra_realizado excluir; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY excluir ON operacoes.obra_realizado FOR DELETE TO authenticated USING ((( SELECT core.pode('operacoes.obras.importar'::text) AS pode) AND (origem = 'tela'::text)));


--
-- Name: quadros excluir; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY excluir ON operacoes.quadros FOR DELETE TO authenticated USING (( SELECT core.pode('operacoes.energia.editar'::text) AS pode));


--
-- Name: salas excluir; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY excluir ON operacoes.salas FOR DELETE TO authenticated USING (( SELECT core.pode('operacoes.energia.editar'::text) AS pode));


--
-- Name: hidrometros; Type: ROW SECURITY; Schema: operacoes; Owner: -
--

ALTER TABLE operacoes.hidrometros ENABLE ROW LEVEL SECURITY;

--
-- Name: importacao_valores; Type: ROW SECURITY; Schema: operacoes; Owner: -
--

ALTER TABLE operacoes.importacao_valores ENABLE ROW LEVEL SECURITY;

--
-- Name: importacoes; Type: ROW SECURITY; Schema: operacoes; Owner: -
--

ALTER TABLE operacoes.importacoes ENABLE ROW LEVEL SECURITY;

--
-- Name: limpeza_anexos; Type: ROW SECURITY; Schema: operacoes; Owner: -
--

ALTER TABLE operacoes.limpeza_anexos ENABLE ROW LEVEL SECURITY;

--
-- Name: limpeza_contrato; Type: ROW SECURITY; Schema: operacoes; Owner: -
--

ALTER TABLE operacoes.limpeza_contrato ENABLE ROW LEVEL SECURITY;

--
-- Name: limpeza_equipe; Type: ROW SECURITY; Schema: operacoes; Owner: -
--

ALTER TABLE operacoes.limpeza_equipe ENABLE ROW LEVEL SECURITY;

--
-- Name: limpeza_extras; Type: ROW SECURITY; Schema: operacoes; Owner: -
--

ALTER TABLE operacoes.limpeza_extras ENABLE ROW LEVEL SECURITY;

--
-- Name: limpeza_meses; Type: ROW SECURITY; Schema: operacoes; Owner: -
--

ALTER TABLE operacoes.limpeza_meses ENABLE ROW LEVEL SECURITY;

--
-- Name: limpeza_minutos; Type: ROW SECURITY; Schema: operacoes; Owner: -
--

ALTER TABLE operacoes.limpeza_minutos ENABLE ROW LEVEL SECURITY;

--
-- Name: obra_realizado; Type: ROW SECURITY; Schema: operacoes; Owner: -
--

ALTER TABLE operacoes.obra_realizado ENABLE ROW LEVEL SECURITY;

--
-- Name: obras; Type: ROW SECURITY; Schema: operacoes; Owner: -
--

ALTER TABLE operacoes.obras ENABLE ROW LEVEL SECURITY;

--
-- Name: orcamento_etapas; Type: ROW SECURITY; Schema: operacoes; Owner: -
--

ALTER TABLE operacoes.orcamento_etapas ENABLE ROW LEVEL SECURITY;

--
-- Name: orcamento_previsto; Type: ROW SECURITY; Schema: operacoes; Owner: -
--

ALTER TABLE operacoes.orcamento_previsto ENABLE ROW LEVEL SECURITY;

--
-- Name: orcamento_revisoes; Type: ROW SECURITY; Schema: operacoes; Owner: -
--

ALTER TABLE operacoes.orcamento_revisoes ENABLE ROW LEVEL SECURITY;

--
-- Name: parametros; Type: ROW SECURITY; Schema: operacoes; Owner: -
--

ALTER TABLE operacoes.parametros ENABLE ROW LEVEL SECURITY;

--
-- Name: quadros; Type: ROW SECURITY; Schema: operacoes; Owner: -
--

ALTER TABLE operacoes.quadros ENABLE ROW LEVEL SECURITY;

--
-- Name: salas; Type: ROW SECURITY; Schema: operacoes; Owner: -
--

ALTER TABLE operacoes.salas ENABLE ROW LEVEL SECURITY;

--
-- Name: termos; Type: ROW SECURITY; Schema: operacoes; Owner: -
--

ALTER TABLE operacoes.termos ENABLE ROW LEVEL SECURITY;

--
-- Name: agua_contas ver; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY ver ON operacoes.agua_contas FOR SELECT TO authenticated USING (((vigente AND ( SELECT core.pode('operacoes.agua.valores'::text) AS pode)) OR ( SELECT core.pode('operacoes.agua.importar'::text) AS pode)));


--
-- Name: agua_leituras ver; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY ver ON operacoes.agua_leituras FOR SELECT TO authenticated USING (((vigente AND ( SELECT core.pode('operacoes.agua.ver'::text) AS pode)) OR ( SELECT core.pode('operacoes.agua.importar'::text) AS pode)));


--
-- Name: agua_valores ver; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY ver ON operacoes.agua_valores FOR SELECT TO authenticated USING ((( SELECT core.pode('operacoes.agua.valores'::text) AS pode) AND (EXISTS ( SELECT 1
   FROM operacoes.agua_leituras l
  WHERE (l.id = agua_valores.leitura_id)))));


--
-- Name: agua_vinculos ver; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY ver ON operacoes.agua_vinculos FOR SELECT TO authenticated USING (( SELECT core.pode('operacoes.agua.ver'::text) AS pode));


--
-- Name: caixa_ocupantes ver; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY ver ON operacoes.caixa_ocupantes FOR SELECT TO authenticated USING (( SELECT core.pode('operacoes.energia.historico'::text) AS pode));


--
-- Name: caixas ver; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY ver ON operacoes.caixas FOR SELECT TO authenticated USING (( SELECT core.pode('operacoes.energia.ver'::text) AS pode));


--
-- Name: diario_cadastros ver; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY ver ON operacoes.diario_cadastros FOR SELECT TO authenticated USING (( SELECT core.pode('operacoes.obras.diario'::text) AS pode));


--
-- Name: diario_obras ver; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY ver ON operacoes.diario_obras FOR SELECT TO authenticated USING ((( SELECT core.pode('operacoes.obras.diario'::text) AS pode) OR ( SELECT core.pode('operacoes.painel'::text) AS pode)));


--
-- Name: diario_relatorios ver; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY ver ON operacoes.diario_relatorios FOR SELECT TO authenticated USING ((( SELECT core.pode('operacoes.obras.diario'::text) AS pode) OR ( SELECT core.pode('operacoes.painel'::text) AS pode)));


--
-- Name: energia_fatura_itens ver; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY ver ON operacoes.energia_fatura_itens FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM operacoes.energia_faturas f
  WHERE (f.id = energia_fatura_itens.fatura_id))));


--
-- Name: energia_faturas ver; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY ver ON operacoes.energia_faturas FOR SELECT TO authenticated USING ((( SELECT core.pode('operacoes.energia.contas'::text) AS pode) OR ( SELECT core.pode('operacoes.solar.ver'::text) AS pode)));


--
-- Name: energia_unidades ver; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY ver ON operacoes.energia_unidades FOR SELECT TO authenticated USING ((( SELECT core.pode('operacoes.energia.contas'::text) AS pode) OR ( SELECT core.pode('operacoes.solar.ver'::text) AS pode)));


--
-- Name: hidrometros ver; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY ver ON operacoes.hidrometros FOR SELECT TO authenticated USING ((( SELECT core.pode('operacoes.agua.ver'::text) AS pode) OR ( SELECT core.pode('operacoes.agua.importar'::text) AS pode)));


--
-- Name: importacao_valores ver; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY ver ON operacoes.importacao_valores FOR SELECT TO authenticated USING (( SELECT core.pode('operacoes.agua.valores'::text) AS pode));


--
-- Name: importacoes ver; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY ver ON operacoes.importacoes FOR SELECT TO authenticated USING (( SELECT operacoes.ve_importacao(importacoes.tipo) AS ve_importacao));


--
-- Name: limpeza_anexos ver; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY ver ON operacoes.limpeza_anexos FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM operacoes.limpeza_meses m
  WHERE (m.referencia = limpeza_anexos.referencia))));


--
-- Name: limpeza_contrato ver; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY ver ON operacoes.limpeza_contrato FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM operacoes.limpeza_meses m
  WHERE (m.referencia = limpeza_contrato.referencia))));


--
-- Name: limpeza_equipe ver; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY ver ON operacoes.limpeza_equipe FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM operacoes.limpeza_meses m
  WHERE (m.referencia = limpeza_equipe.referencia))));


--
-- Name: limpeza_extras ver; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY ver ON operacoes.limpeza_extras FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM operacoes.limpeza_meses m
  WHERE (m.referencia = limpeza_extras.referencia))));


--
-- Name: limpeza_meses ver; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY ver ON operacoes.limpeza_meses FOR SELECT TO authenticated USING ((( SELECT core.pode('operacoes.limpeza.ver'::text) AS pode) OR ( SELECT core.pode('operacoes.limpeza.fechar'::text) AS pode)));


--
-- Name: limpeza_minutos ver; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY ver ON operacoes.limpeza_minutos FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM operacoes.limpeza_meses m
  WHERE (m.referencia = limpeza_minutos.referencia))));


--
-- Name: obra_realizado ver; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY ver ON operacoes.obra_realizado FOR SELECT TO authenticated USING (( SELECT core.pode('operacoes.obras.ver'::text) AS pode));


--
-- Name: obras ver; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY ver ON operacoes.obras FOR SELECT TO authenticated USING ((( SELECT core.pode('operacoes.obras.ver'::text) AS pode) OR ( SELECT core.pode('operacoes.obras.diario'::text) AS pode)));


--
-- Name: orcamento_etapas ver; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY ver ON operacoes.orcamento_etapas FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM operacoes.orcamento_revisoes r
  WHERE (r.id = orcamento_etapas.revisao_id))));


--
-- Name: orcamento_previsto ver; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY ver ON operacoes.orcamento_previsto FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM operacoes.orcamento_etapas e
  WHERE (e.id = orcamento_previsto.etapa_id))));


--
-- Name: orcamento_revisoes ver; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY ver ON operacoes.orcamento_revisoes FOR SELECT TO authenticated USING (( SELECT core.pode('operacoes.obras.ver'::text) AS pode));


--
-- Name: parametros ver; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY ver ON operacoes.parametros FOR SELECT TO authenticated USING (( SELECT operacoes.acessa() AS acessa));


--
-- Name: quadros ver; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY ver ON operacoes.quadros FOR SELECT TO authenticated USING (( SELECT core.pode('operacoes.energia.ver'::text) AS pode));


--
-- Name: salas ver; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY ver ON operacoes.salas FOR SELECT TO authenticated USING ((( SELECT core.pode('operacoes.energia.ver'::text) AS pode) OR ( SELECT core.pode('operacoes.agua.ver'::text) AS pode)));


--
-- Name: termos ver; Type: POLICY; Schema: operacoes; Owner: -
--

CREATE POLICY ver ON operacoes.termos FOR SELECT TO authenticated USING (( SELECT core.pode('operacoes.energia.ver'::text) AS pode));


--
-- Name: chamados abrir; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY abrir ON os.chamados FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('os.acessar'::text) AS pode) AND (aberto_por = ( SELECT auth.uid() AS uid))));


--
-- Name: ordens abrir; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY abrir ON os.ordens FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('os.acessar'::text) AS pode) AND (aberto_por = ( SELECT auth.uid() AS uid))));


--
-- Name: agenda_bloqueios; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.agenda_bloqueios ENABLE ROW LEVEL SECURITY;

--
-- Name: agendamentos; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.agendamentos ENABLE ROW LEVEL SECURITY;

--
-- Name: agendas; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.agendas ENABLE ROW LEVEL SECURITY;

--
-- Name: anexos; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.anexos ENABLE ROW LEVEL SECURITY;

--
-- Name: ativo_categorias; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.ativo_categorias ENABLE ROW LEVEL SECURITY;

--
-- Name: ativo_saidas; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.ativo_saidas ENABLE ROW LEVEL SECURITY;

--
-- Name: ativo_situacoes; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.ativo_situacoes ENABLE ROW LEVEL SECURITY;

--
-- Name: ativos; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.ativos ENABLE ROW LEVEL SECURITY;

--
-- Name: categorias; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.categorias ENABLE ROW LEVEL SECURITY;

--
-- Name: chamados; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.chamados ENABLE ROW LEVEL SECURITY;

--
-- Name: contatos; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.contatos ENABLE ROW LEVEL SECURITY;

--
-- Name: categorias criar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY criar ON os.categorias FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('os.acessar'::text) AS pode) AND (pai_id IS NULL) AND (responsavel_padrao_id IS NULL) AND (agenda_id IS NULL) AND (NOT no_portal)));


--
-- Name: empresas criar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY criar ON os.empresas FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('os.acessar'::text) AS pode) AND ativo AND (legado_id IS NULL)));


--
-- Name: destinatarios; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.destinatarios ENABLE ROW LEVEL SECURITY;

--
-- Name: disparos; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.disparos ENABLE ROW LEVEL SECURITY;

--
-- Name: agenda_bloqueios editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.agenda_bloqueios TO authenticated USING (( SELECT core.pode('os.portal_agenda'::text) AS pode)) WITH CHECK (( SELECT core.pode('os.portal_agenda'::text) AS pode));


--
-- Name: agendamentos editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.agendamentos FOR UPDATE TO authenticated USING ((( SELECT core.pode('os.portal_agenda'::text) AS pode) OR (criado_por = ( SELECT auth.uid() AS uid)))) WITH CHECK ((( SELECT core.pode('os.portal_agenda'::text) AS pode) OR (criado_por = ( SELECT auth.uid() AS uid))));


--
-- Name: agendas editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.agendas TO authenticated USING (( SELECT core.pode('os.portal_agenda'::text) AS pode)) WITH CHECK (( SELECT core.pode('os.portal_agenda'::text) AS pode));


--
-- Name: ativo_categorias editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.ativo_categorias TO authenticated USING ((( SELECT core.pode('os.ativos_gerenciar'::text) AS pode) OR ( SELECT core.pode('os.parametros'::text) AS pode))) WITH CHECK ((( SELECT core.pode('os.ativos_gerenciar'::text) AS pode) OR ( SELECT core.pode('os.parametros'::text) AS pode)));


--
-- Name: ativos editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.ativos TO authenticated USING (( SELECT core.pode('os.ativos_gerenciar'::text) AS pode)) WITH CHECK (( SELECT core.pode('os.ativos_gerenciar'::text) AS pode));


--
-- Name: categorias editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.categorias TO authenticated USING (( SELECT core.pode('os.catalogo'::text) AS pode)) WITH CHECK (( SELECT core.pode('os.catalogo'::text) AS pode));


--
-- Name: chamados editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.chamados FOR UPDATE TO authenticated USING ((( SELECT core.pode('os.acessar'::text) AS pode) AND ( SELECT core.pode_modulo('os'::text) AS pode_modulo) AND ((aberto_por = ( SELECT auth.uid() AS uid)) OR (responsavel_id = ( SELECT auth.uid() AS uid)) OR ( SELECT core.pode('os.todos_setores'::text) AS pode) OR ( SELECT core.pode('os.painel_geral'::text) AS pode) OR ((setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) AND ((responsavel_id IS NULL) OR ( SELECT core.pode('os.meu_setor'::text) AS pode) OR ( SELECT core.pode('os.painel_setor'::text) AS pode) OR ( SELECT core.pode('os.gerenciar_setor'::text) AS pode))) OR (id IN ( SELECT os.meus_chamados_envolvidos() AS meus_chamados_envolvidos))) AND ((aberto_por = ( SELECT auth.uid() AS uid)) OR (responsavel_id = ( SELECT auth.uid() AS uid)) OR (setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (id IN ( SELECT os.meus_chamados_envolvidos() AS meus_chamados_envolvidos)) OR ( SELECT core.pode('os.excluir'::text) AS pode)))) WITH CHECK (( SELECT core.pode('os.acessar'::text) AS pode));


--
-- Name: contatos editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.contatos TO authenticated USING ((( SELECT core.pode('os.parametros'::text) AS pode) OR ( SELECT core.pode('os.terceirizados'::text) AS pode))) WITH CHECK ((( SELECT core.pode('os.parametros'::text) AS pode) OR ( SELECT core.pode('os.terceirizados'::text) AS pode)));


--
-- Name: destinatarios editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.destinatarios FOR UPDATE TO authenticated USING (((EXISTS ( SELECT 1
   FROM os.chamados c
  WHERE ((c.id = destinatarios.chamado_id) AND ( SELECT core.pode('os.acessar'::text) AS pode) AND ((c.aberto_por = ( SELECT auth.uid() AS uid)) OR (c.responsavel_id = ( SELECT auth.uid() AS uid)) OR (c.setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (c.id IN ( SELECT os.meus_chamados_envolvidos() AS meus_chamados_envolvidos)))))) OR (EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE ((o.id = destinatarios.ordem_id) AND ( SELECT core.pode('os.acessar'::text) AS pode) AND ((o.aberto_por = ( SELECT auth.uid() AS uid)) OR (o.responsavel_id = ( SELECT auth.uid() AS uid)) OR (o.setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (o.id IN ( SELECT os.minhas_ordens_envolvidas() AS minhas_ordens_envolvidas)))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM os.chamados c
  WHERE ((c.id = destinatarios.chamado_id) AND ( SELECT core.pode('os.acessar'::text) AS pode) AND ((c.aberto_por = ( SELECT auth.uid() AS uid)) OR (c.responsavel_id = ( SELECT auth.uid() AS uid)) OR (c.setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (c.id IN ( SELECT os.meus_chamados_envolvidos() AS meus_chamados_envolvidos)))))) OR (EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE ((o.id = destinatarios.ordem_id) AND ( SELECT core.pode('os.acessar'::text) AS pode) AND ((o.aberto_por = ( SELECT auth.uid() AS uid)) OR (o.responsavel_id = ( SELECT auth.uid() AS uid)) OR (o.setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (o.id IN ( SELECT os.minhas_ordens_envolvidas() AS minhas_ordens_envolvidas))))))));


--
-- Name: empresas editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.empresas TO authenticated USING (( SELECT core.pode('os.terceirizados'::text) AS pode)) WITH CHECK (( SELECT core.pode('os.terceirizados'::text) AS pode));


--
-- Name: feriados editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.feriados TO authenticated USING ((( SELECT core.pode('os.parametros'::text) AS pode) OR ( SELECT core.pode('comercial.parametros.editar'::text) AS pode))) WITH CHECK ((( SELECT core.pode('os.parametros'::text) AS pode) OR ( SELECT core.pode('comercial.parametros.editar'::text) AS pode)));


--
-- Name: lojas editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.lojas TO authenticated USING (( SELECT core.pode('os.portal'::text) AS pode)) WITH CHECK (( SELECT core.pode('os.portal'::text) AS pode));


--
-- Name: materiais editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.materiais FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE ((o.id = materiais.ordem_id) AND ( SELECT core.pode('os.acessar'::text) AS pode) AND ((o.aberto_por = ( SELECT auth.uid() AS uid)) OR (o.responsavel_id = ( SELECT auth.uid() AS uid)) OR (o.setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (o.id IN ( SELECT os.minhas_ordens_envolvidas() AS minhas_ordens_envolvidas))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE ((o.id = materiais.ordem_id) AND ( SELECT core.pode('os.acessar'::text) AS pode) AND ((o.aberto_por = ( SELECT auth.uid() AS uid)) OR (o.responsavel_id = ( SELECT auth.uid() AS uid)) OR (o.setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (o.id IN ( SELECT os.minhas_ordens_envolvidas() AS minhas_ordens_envolvidas)))))));


--
-- Name: material_valores editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.material_valores TO authenticated USING (( SELECT core.pode('os.custos'::text) AS pode)) WITH CHECK (( SELECT core.pode('os.custos'::text) AS pode));


--
-- Name: metas editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.metas TO authenticated USING (( SELECT core.pode('os.parametros'::text) AS pode)) WITH CHECK (( SELECT core.pode('os.parametros'::text) AS pode));


--
-- Name: modelo_itens editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.modelo_itens TO authenticated USING (( SELECT core.pode('os.modelos'::text) AS pode)) WITH CHECK (( SELECT core.pode('os.modelos'::text) AS pode));


--
-- Name: modelos editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.modelos TO authenticated USING (( SELECT core.pode('os.modelos'::text) AS pode)) WITH CHECK (( SELECT core.pode('os.modelos'::text) AS pode));


--
-- Name: ordem_profissionais editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.ordem_profissionais FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE ((o.id = ordem_profissionais.ordem_id) AND ( SELECT core.pode('os.acessar'::text) AS pode) AND ((o.aberto_por = ( SELECT auth.uid() AS uid)) OR (o.responsavel_id = ( SELECT auth.uid() AS uid)) OR (o.setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (o.id IN ( SELECT os.minhas_ordens_envolvidas() AS minhas_ordens_envolvidas))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE ((o.id = ordem_profissionais.ordem_id) AND ( SELECT core.pode('os.acessar'::text) AS pode) AND ((o.aberto_por = ( SELECT auth.uid() AS uid)) OR (o.responsavel_id = ( SELECT auth.uid() AS uid)) OR (o.setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (o.id IN ( SELECT os.minhas_ordens_envolvidas() AS minhas_ordens_envolvidas)))))));


--
-- Name: ordens editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.ordens FOR UPDATE TO authenticated USING ((( SELECT core.pode('os.acessar'::text) AS pode) AND ( SELECT core.pode_modulo('os'::text) AS pode_modulo) AND ((aberto_por = ( SELECT auth.uid() AS uid)) OR (responsavel_id = ( SELECT auth.uid() AS uid)) OR ( SELECT core.pode('os.todos_setores'::text) AS pode) OR ( SELECT core.pode('os.painel_geral'::text) AS pode) OR ((setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) AND ((responsavel_id IS NULL) OR ( SELECT core.pode('os.meu_setor'::text) AS pode) OR ( SELECT core.pode('os.painel_setor'::text) AS pode) OR ( SELECT core.pode('os.gerenciar_setor'::text) AS pode))) OR (id IN ( SELECT os.minhas_ordens_envolvidas() AS minhas_ordens_envolvidas))) AND ((aberto_por = ( SELECT auth.uid() AS uid)) OR (responsavel_id = ( SELECT auth.uid() AS uid)) OR (setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (id IN ( SELECT os.minhas_ordens_envolvidas() AS minhas_ordens_envolvidas))))) WITH CHECK (( SELECT core.pode('os.acessar'::text) AS pode));


--
-- Name: os_custos editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.os_custos FOR UPDATE TO authenticated USING ((( SELECT core.pode('os.custos'::text) AS pode) AND (EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE ((o.id = os_custos.ordem_id) AND ( SELECT core.pode('os.acessar'::text) AS pode) AND ((o.aberto_por = ( SELECT auth.uid() AS uid)) OR (o.responsavel_id = ( SELECT auth.uid() AS uid)) OR (o.setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (o.id IN ( SELECT os.minhas_ordens_envolvidas() AS minhas_ordens_envolvidas)))))))) WITH CHECK ((( SELECT core.pode('os.custos'::text) AS pode) AND (EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE ((o.id = os_custos.ordem_id) AND ( SELECT core.pode('os.acessar'::text) AS pode) AND ((o.aberto_por = ( SELECT auth.uid() AS uid)) OR (o.responsavel_id = ( SELECT auth.uid() AS uid)) OR (o.setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (o.id IN ( SELECT os.minhas_ordens_envolvidas() AS minhas_ordens_envolvidas))))))));


--
-- Name: parametros editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.parametros FOR UPDATE TO authenticated USING (( SELECT core.pode('os.parametros'::text) AS pode)) WITH CHECK (( SELECT core.pode('os.parametros'::text) AS pode));


--
-- Name: participantes editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.participantes FOR UPDATE TO authenticated USING (((EXISTS ( SELECT 1
   FROM os.chamados c
  WHERE (c.id = participantes.chamado_id))) OR (EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE (o.id = participantes.ordem_id))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM os.chamados c
  WHERE (c.id = participantes.chamado_id))) OR (EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE (o.id = participantes.ordem_id)))));


--
-- Name: planos_preventivos editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.planos_preventivos TO authenticated USING (( SELECT core.pode('os.ativos_gerenciar'::text) AS pode)) WITH CHECK (( SELECT core.pode('os.ativos_gerenciar'::text) AS pode));


--
-- Name: portal_links editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.portal_links TO authenticated USING (( SELECT core.pode('os.portal'::text) AS pode)) WITH CHECK (( SELECT core.pode('os.portal'::text) AS pode));


--
-- Name: portal_sessoes editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.portal_sessoes FOR UPDATE TO authenticated USING (( SELECT core.pode('os.portal'::text) AS pode)) WITH CHECK (( SELECT core.pode('os.portal'::text) AS pode));


--
-- Name: profissionais editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.profissionais TO authenticated USING (( SELECT core.pode('os.terceirizados'::text) AS pode)) WITH CHECK (( SELECT core.pode('os.terceirizados'::text) AS pode));


--
-- Name: sessao_tecnicos editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.sessao_tecnicos FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (os.sessoes s
     JOIN os.ordens o ON ((o.id = s.ordem_id)))
  WHERE ((s.id = sessao_tecnicos.sessao_id) AND ( SELECT core.pode('os.acessar'::text) AS pode) AND ((o.aberto_por = ( SELECT auth.uid() AS uid)) OR (o.responsavel_id = ( SELECT auth.uid() AS uid)) OR (o.setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (o.id IN ( SELECT os.minhas_ordens_envolvidas() AS minhas_ordens_envolvidas))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (os.sessoes s
     JOIN os.ordens o ON ((o.id = s.ordem_id)))
  WHERE ((s.id = sessao_tecnicos.sessao_id) AND ( SELECT core.pode('os.acessar'::text) AS pode) AND ((o.aberto_por = ( SELECT auth.uid() AS uid)) OR (o.responsavel_id = ( SELECT auth.uid() AS uid)) OR (o.setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (o.id IN ( SELECT os.minhas_ordens_envolvidas() AS minhas_ordens_envolvidas)))))));


--
-- Name: sessoes editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.sessoes FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE ((o.id = sessoes.ordem_id) AND ( SELECT core.pode('os.acessar'::text) AS pode) AND ((o.aberto_por = ( SELECT auth.uid() AS uid)) OR (o.responsavel_id = ( SELECT auth.uid() AS uid)) OR (o.setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (o.id IN ( SELECT os.minhas_ordens_envolvidas() AS minhas_ordens_envolvidas))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE ((o.id = sessoes.ordem_id) AND ( SELECT core.pode('os.acessar'::text) AS pode) AND ((o.aberto_por = ( SELECT auth.uid() AS uid)) OR (o.responsavel_id = ( SELECT auth.uid() AS uid)) OR (o.setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (o.id IN ( SELECT os.minhas_ordens_envolvidas() AS minhas_ordens_envolvidas)))))));


--
-- Name: setor_membros editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.setor_membros TO authenticated USING (( SELECT core.pode('os.catalogo'::text) AS pode)) WITH CHECK (( SELECT core.pode('os.catalogo'::text) AS pode));


--
-- Name: setores editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.setores TO authenticated USING (( SELECT core.pode('os.catalogo'::text) AS pode)) WITH CHECK (( SELECT core.pode('os.catalogo'::text) AS pode));


--
-- Name: tecnico_valores editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.tecnico_valores TO authenticated USING (( SELECT core.pode('os.parametros'::text) AS pode)) WITH CHECK (( SELECT core.pode('os.parametros'::text) AS pode));


--
-- Name: tecnicos editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.tecnicos TO authenticated USING (( SELECT core.pode('os.parametros'::text) AS pode)) WITH CHECK (( SELECT core.pode('os.parametros'::text) AS pode));


--
-- Name: terceirizado_links editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.terceirizado_links TO authenticated USING (( SELECT core.pode('os.terceirizados'::text) AS pode)) WITH CHECK (( SELECT core.pode('os.terceirizados'::text) AS pode));


--
-- Name: vistoria_ambientes editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.vistoria_ambientes TO authenticated USING (( SELECT core.pode('os.vistorias'::text) AS pode)) WITH CHECK (( SELECT core.pode('os.vistorias'::text) AS pode));


--
-- Name: vistorias editar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY editar ON os.vistorias TO authenticated USING (( SELECT core.pode('os.vistorias'::text) AS pode)) WITH CHECK (( SELECT core.pode('os.vistorias'::text) AS pode));


--
-- Name: empresas; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.empresas ENABLE ROW LEVEL SECURITY;

--
-- Name: anexos enviar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY enviar ON os.anexos FOR INSERT TO authenticated WITH CHECK ((((chamado_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM os.chamados c
  WHERE ((c.id = anexos.chamado_id) AND ( SELECT core.pode('os.acessar'::text) AS pode) AND ((c.aberto_por = ( SELECT auth.uid() AS uid)) OR (c.responsavel_id = ( SELECT auth.uid() AS uid)) OR (c.setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (c.id IN ( SELECT os.meus_chamados_envolvidos() AS meus_chamados_envolvidos))))))) OR ((ordem_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE ((o.id = anexos.ordem_id) AND ( SELECT core.pode('os.acessar'::text) AS pode) AND ((o.aberto_por = ( SELECT auth.uid() AS uid)) OR (o.responsavel_id = ( SELECT auth.uid() AS uid)) OR (o.setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (o.id IN ( SELECT os.minhas_ordens_envolvidas() AS minhas_ordens_envolvidas))))))) OR (((vistoria_id IS NOT NULL) OR (ambiente_id IS NOT NULL)) AND ( SELECT core.pode('os.vistorias'::text) AS pode)) OR ((ativo_id IS NOT NULL) AND ( SELECT core.pode('os.ativos_gerenciar'::text) AS pode))));


--
-- Name: eventos; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.eventos ENABLE ROW LEVEL SECURITY;

--
-- Name: feriados; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.feriados ENABLE ROW LEVEL SECURITY;

--
-- Name: destinatarios incluir; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY incluir ON os.destinatarios FOR INSERT TO authenticated WITH CHECK (((EXISTS ( SELECT 1
   FROM os.chamados c
  WHERE ((c.id = destinatarios.chamado_id) AND ( SELECT core.pode('os.acessar'::text) AS pode) AND ((c.aberto_por = ( SELECT auth.uid() AS uid)) OR (c.responsavel_id = ( SELECT auth.uid() AS uid)) OR (c.setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (c.id IN ( SELECT os.meus_chamados_envolvidos() AS meus_chamados_envolvidos)))))) OR (EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE ((o.id = destinatarios.ordem_id) AND ( SELECT core.pode('os.acessar'::text) AS pode) AND ((o.aberto_por = ( SELECT auth.uid() AS uid)) OR (o.responsavel_id = ( SELECT auth.uid() AS uid)) OR (o.setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (o.id IN ( SELECT os.minhas_ordens_envolvidas() AS minhas_ordens_envolvidas))))))));


--
-- Name: leituras incluir; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY incluir ON os.leituras FOR INSERT TO authenticated WITH CHECK (((usuario_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM os.chamados c
  WHERE ((c.id = leituras.chamado_id) AND (c.tipo = 'aviso'::os.tipo_chamado))))));


--
-- Name: materiais incluir; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY incluir ON os.materiais FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE ((o.id = materiais.ordem_id) AND ( SELECT core.pode('os.acessar'::text) AS pode) AND ((o.aberto_por = ( SELECT auth.uid() AS uid)) OR (o.responsavel_id = ( SELECT auth.uid() AS uid)) OR (o.setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (o.id IN ( SELECT os.minhas_ordens_envolvidas() AS minhas_ordens_envolvidas)))))));


--
-- Name: ordem_profissionais incluir; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY incluir ON os.ordem_profissionais FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE ((o.id = ordem_profissionais.ordem_id) AND ( SELECT core.pode('os.acessar'::text) AS pode) AND ((o.aberto_por = ( SELECT auth.uid() AS uid)) OR (o.responsavel_id = ( SELECT auth.uid() AS uid)) OR (o.setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (o.id IN ( SELECT os.minhas_ordens_envolvidas() AS minhas_ordens_envolvidas)))))));


--
-- Name: os_custos incluir; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY incluir ON os.os_custos FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('os.custos'::text) AS pode) AND (EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE ((o.id = os_custos.ordem_id) AND ( SELECT core.pode('os.acessar'::text) AS pode) AND ((o.aberto_por = ( SELECT auth.uid() AS uid)) OR (o.responsavel_id = ( SELECT auth.uid() AS uid)) OR (o.setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (o.id IN ( SELECT os.minhas_ordens_envolvidas() AS minhas_ordens_envolvidas))))))));


--
-- Name: participantes incluir; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY incluir ON os.participantes FOR INSERT TO authenticated WITH CHECK (((EXISTS ( SELECT 1
   FROM os.chamados c
  WHERE (c.id = participantes.chamado_id))) OR (EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE (o.id = participantes.ordem_id)))));


--
-- Name: sessao_tecnicos incluir; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY incluir ON os.sessao_tecnicos FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM (os.sessoes s
     JOIN os.ordens o ON ((o.id = s.ordem_id)))
  WHERE ((s.id = sessao_tecnicos.sessao_id) AND ( SELECT core.pode('os.acessar'::text) AS pode) AND ((o.aberto_por = ( SELECT auth.uid() AS uid)) OR (o.responsavel_id = ( SELECT auth.uid() AS uid)) OR (o.setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (o.id IN ( SELECT os.minhas_ordens_envolvidas() AS minhas_ordens_envolvidas)))))));


--
-- Name: sessoes incluir; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY incluir ON os.sessoes FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE ((o.id = sessoes.ordem_id) AND ( SELECT core.pode('os.acessar'::text) AS pode) AND ((o.aberto_por = ( SELECT auth.uid() AS uid)) OR (o.responsavel_id = ( SELECT auth.uid() AS uid)) OR (o.setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (o.id IN ( SELECT os.minhas_ordens_envolvidas() AS minhas_ordens_envolvidas)))))));


--
-- Name: leituras; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.leituras ENABLE ROW LEVEL SECURITY;

--
-- Name: notificacoes ler; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ler ON os.notificacoes FOR UPDATE TO authenticated USING ((usuario_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((usuario_id = ( SELECT auth.uid() AS uid)));


--
-- Name: lojas; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.lojas ENABLE ROW LEVEL SECURITY;

--
-- Name: materiais; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.materiais ENABLE ROW LEVEL SECURITY;

--
-- Name: material_valores; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.material_valores ENABLE ROW LEVEL SECURITY;

--
-- Name: metas; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.metas ENABLE ROW LEVEL SECURITY;

--
-- Name: modelo_itens; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.modelo_itens ENABLE ROW LEVEL SECURITY;

--
-- Name: modelos; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.modelos ENABLE ROW LEVEL SECURITY;

--
-- Name: notificacoes; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.notificacoes ENABLE ROW LEVEL SECURITY;

--
-- Name: ordem_profissionais; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.ordem_profissionais ENABLE ROW LEVEL SECURITY;

--
-- Name: ordens; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.ordens ENABLE ROW LEVEL SECURITY;

--
-- Name: os_custos; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.os_custos ENABLE ROW LEVEL SECURITY;

--
-- Name: parametros; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.parametros ENABLE ROW LEVEL SECURITY;

--
-- Name: participantes; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.participantes ENABLE ROW LEVEL SECURITY;

--
-- Name: planos_preventivos; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.planos_preventivos ENABLE ROW LEVEL SECURITY;

--
-- Name: portal_links; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.portal_links ENABLE ROW LEVEL SECURITY;

--
-- Name: portal_sessoes; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.portal_sessoes ENABLE ROW LEVEL SECURITY;

--
-- Name: portal_tentativas; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.portal_tentativas ENABLE ROW LEVEL SECURITY;

--
-- Name: profissionais; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.profissionais ENABLE ROW LEVEL SECURITY;

--
-- Name: notificacoes proprias; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY proprias ON os.notificacoes FOR SELECT TO authenticated USING ((usuario_id = ( SELECT auth.uid() AS uid)));


--
-- Name: eventos registrar; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY registrar ON os.eventos FOR INSERT TO authenticated WITH CHECK ((((EXISTS ( SELECT 1
   FROM os.chamados c
  WHERE (c.id = eventos.chamado_id))) OR (EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE (o.id = eventos.ordem_id)))) AND ((autor_id IS NULL) OR (autor_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: anexos remover; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY remover ON os.anexos FOR DELETE TO authenticated USING (((enviado_por = ( SELECT auth.uid() AS uid)) OR (((vistoria_id IS NOT NULL) OR (ambiente_id IS NOT NULL)) AND ( SELECT core.pode('os.vistorias'::text) AS pode)) OR ((ativo_id IS NOT NULL) AND ( SELECT core.pode('os.ativos_gerenciar'::text) AS pode))));


--
-- Name: destinatarios remover; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY remover ON os.destinatarios FOR DELETE TO authenticated USING (((EXISTS ( SELECT 1
   FROM os.chamados c
  WHERE ((c.id = destinatarios.chamado_id) AND ( SELECT core.pode('os.acessar'::text) AS pode) AND ((c.aberto_por = ( SELECT auth.uid() AS uid)) OR (c.responsavel_id = ( SELECT auth.uid() AS uid)) OR (c.setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (c.id IN ( SELECT os.meus_chamados_envolvidos() AS meus_chamados_envolvidos)))))) OR (EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE ((o.id = destinatarios.ordem_id) AND ( SELECT core.pode('os.acessar'::text) AS pode) AND ((o.aberto_por = ( SELECT auth.uid() AS uid)) OR (o.responsavel_id = ( SELECT auth.uid() AS uid)) OR (o.setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (o.id IN ( SELECT os.minhas_ordens_envolvidas() AS minhas_ordens_envolvidas))))))));


--
-- Name: materiais remover; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY remover ON os.materiais FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE ((o.id = materiais.ordem_id) AND ( SELECT core.pode('os.acessar'::text) AS pode) AND ((o.aberto_por = ( SELECT auth.uid() AS uid)) OR (o.responsavel_id = ( SELECT auth.uid() AS uid)) OR (o.setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (o.id IN ( SELECT os.minhas_ordens_envolvidas() AS minhas_ordens_envolvidas)))))));


--
-- Name: ordem_profissionais remover; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY remover ON os.ordem_profissionais FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE ((o.id = ordem_profissionais.ordem_id) AND ( SELECT core.pode('os.acessar'::text) AS pode) AND ((o.aberto_por = ( SELECT auth.uid() AS uid)) OR (o.responsavel_id = ( SELECT auth.uid() AS uid)) OR (o.setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (o.id IN ( SELECT os.minhas_ordens_envolvidas() AS minhas_ordens_envolvidas)))))));


--
-- Name: os_custos remover; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY remover ON os.os_custos FOR DELETE TO authenticated USING ((( SELECT core.pode('os.custos'::text) AS pode) AND (EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE ((o.id = os_custos.ordem_id) AND ( SELECT core.pode('os.acessar'::text) AS pode) AND ((o.aberto_por = ( SELECT auth.uid() AS uid)) OR (o.responsavel_id = ( SELECT auth.uid() AS uid)) OR (o.setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (o.id IN ( SELECT os.minhas_ordens_envolvidas() AS minhas_ordens_envolvidas))))))));


--
-- Name: participantes remover; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY remover ON os.participantes FOR DELETE TO authenticated USING (((EXISTS ( SELECT 1
   FROM os.chamados c
  WHERE (c.id = participantes.chamado_id))) OR (EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE (o.id = participantes.ordem_id)))));


--
-- Name: sessao_tecnicos remover; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY remover ON os.sessao_tecnicos FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (os.sessoes s
     JOIN os.ordens o ON ((o.id = s.ordem_id)))
  WHERE ((s.id = sessao_tecnicos.sessao_id) AND ( SELECT core.pode('os.acessar'::text) AS pode) AND ((o.aberto_por = ( SELECT auth.uid() AS uid)) OR (o.responsavel_id = ( SELECT auth.uid() AS uid)) OR (o.setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (o.id IN ( SELECT os.minhas_ordens_envolvidas() AS minhas_ordens_envolvidas)))))));


--
-- Name: sessoes remover; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY remover ON os.sessoes FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE ((o.id = sessoes.ordem_id) AND ( SELECT core.pode('os.acessar'::text) AS pode) AND ((o.aberto_por = ( SELECT auth.uid() AS uid)) OR (o.responsavel_id = ( SELECT auth.uid() AS uid)) OR (o.setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (o.id IN ( SELECT os.minhas_ordens_envolvidas() AS minhas_ordens_envolvidas)))))));


--
-- Name: sessao_tecnicos; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.sessao_tecnicos ENABLE ROW LEVEL SECURITY;

--
-- Name: sessoes; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.sessoes ENABLE ROW LEVEL SECURITY;

--
-- Name: setor_membros; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.setor_membros ENABLE ROW LEVEL SECURITY;

--
-- Name: setores; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.setores ENABLE ROW LEVEL SECURITY;

--
-- Name: tecnico_valores; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.tecnico_valores ENABLE ROW LEVEL SECURITY;

--
-- Name: tecnicos; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.tecnicos ENABLE ROW LEVEL SECURITY;

--
-- Name: terceirizado_links; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.terceirizado_links ENABLE ROW LEVEL SECURITY;

--
-- Name: agenda_bloqueios ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.agenda_bloqueios FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('os'::text) AS pode_modulo));


--
-- Name: agendamentos ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.agendamentos FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('os'::text) AS pode_modulo));


--
-- Name: agendas ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.agendas FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('os'::text) AS pode_modulo));


--
-- Name: anexos ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.anexos FOR SELECT TO authenticated USING ((((chamado_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM os.chamados c
  WHERE (c.id = anexos.chamado_id)))) OR ((ordem_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE (o.id = anexos.ordem_id)))) OR (((vistoria_id IS NOT NULL) OR (ambiente_id IS NOT NULL)) AND ( SELECT core.pode('os.vistorias'::text) AS pode)) OR ((ativo_id IS NOT NULL) AND (( SELECT core.pode('os.ativos'::text) AS pode) OR ( SELECT core.pode('os.ativos_gerenciar'::text) AS pode)))));


--
-- Name: ativo_categorias ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.ativo_categorias FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('os'::text) AS pode_modulo));


--
-- Name: ativo_saidas ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.ativo_saidas FOR SELECT TO authenticated USING ((( SELECT core.pode('os.ativos'::text) AS pode) OR ( SELECT core.pode('os.ativos_gerenciar'::text) AS pode) OR ( SELECT core.pode('os.ativos_saida'::text) AS pode)));


--
-- Name: ativo_situacoes ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.ativo_situacoes FOR SELECT TO authenticated USING ((( SELECT core.pode('os.ativos'::text) AS pode) OR ( SELECT core.pode('os.ativos_gerenciar'::text) AS pode)));


--
-- Name: ativos ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.ativos FOR SELECT TO authenticated USING ((( SELECT core.pode('os.ativos'::text) AS pode) OR ( SELECT core.pode('os.ativos_gerenciar'::text) AS pode)));


--
-- Name: categorias ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.categorias FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('os'::text) AS pode_modulo));


--
-- Name: chamados ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.chamados FOR SELECT TO authenticated USING ((( SELECT core.pode_modulo('os'::text) AS pode_modulo) AND ((aberto_por = ( SELECT auth.uid() AS uid)) OR (responsavel_id = ( SELECT auth.uid() AS uid)) OR ( SELECT core.pode('os.todos_setores'::text) AS pode) OR ( SELECT core.pode('os.painel_geral'::text) AS pode) OR ((setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) AND ((responsavel_id IS NULL) OR ( SELECT core.pode('os.meu_setor'::text) AS pode) OR ( SELECT core.pode('os.painel_setor'::text) AS pode) OR ( SELECT core.pode('os.gerenciar_setor'::text) AS pode))) OR (id IN ( SELECT os.meus_chamados_envolvidos() AS meus_chamados_envolvidos)))));


--
-- Name: contatos ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.contatos FOR SELECT TO authenticated USING (( SELECT core.pode('os.acessar'::text) AS pode));


--
-- Name: destinatarios ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.destinatarios FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM os.chamados c
  WHERE (c.id = destinatarios.chamado_id))) OR (EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE (o.id = destinatarios.ordem_id)))));


--
-- Name: disparos ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.disparos FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('os'::text) AS pode_modulo));


--
-- Name: empresas ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.empresas FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('os'::text) AS pode_modulo));


--
-- Name: eventos ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.eventos FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM os.chamados c
  WHERE (c.id = eventos.chamado_id))) OR (EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE (o.id = eventos.ordem_id)))));


--
-- Name: feriados ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.feriados FOR SELECT TO authenticated USING ((( SELECT core.pode_modulo('os'::text) AS pode_modulo) OR ( SELECT core.pode_modulo('comercial'::text) AS pode_modulo) OR ( SELECT core.pode_modulo('operacoes'::text) AS pode_modulo)));


--
-- Name: leituras ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.leituras FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM os.chamados c
  WHERE (c.id = leituras.chamado_id))));


--
-- Name: lojas ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.lojas FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('os'::text) AS pode_modulo));


--
-- Name: materiais ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.materiais FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE (o.id = materiais.ordem_id))));


--
-- Name: material_valores ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.material_valores FOR SELECT TO authenticated USING (( SELECT core.pode('os.custos'::text) AS pode));


--
-- Name: metas ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.metas FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('os'::text) AS pode_modulo));


--
-- Name: modelo_itens ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.modelo_itens FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('os'::text) AS pode_modulo));


--
-- Name: modelos ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.modelos FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('os'::text) AS pode_modulo));


--
-- Name: ordem_profissionais ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.ordem_profissionais FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE (o.id = ordem_profissionais.ordem_id))));


--
-- Name: ordens ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.ordens FOR SELECT TO authenticated USING ((( SELECT core.pode_modulo('os'::text) AS pode_modulo) AND ((aberto_por = ( SELECT auth.uid() AS uid)) OR (responsavel_id = ( SELECT auth.uid() AS uid)) OR ( SELECT core.pode('os.todos_setores'::text) AS pode) OR ( SELECT core.pode('os.painel_geral'::text) AS pode) OR ((setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) AND ((responsavel_id IS NULL) OR ( SELECT core.pode('os.meu_setor'::text) AS pode) OR ( SELECT core.pode('os.painel_setor'::text) AS pode) OR ( SELECT core.pode('os.gerenciar_setor'::text) AS pode))) OR (id IN ( SELECT os.minhas_ordens_envolvidas() AS minhas_ordens_envolvidas)))));


--
-- Name: os_custos ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.os_custos FOR SELECT TO authenticated USING ((( SELECT core.pode('os.custos'::text) AS pode) AND (EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE (o.id = os_custos.ordem_id)))));


--
-- Name: parametros ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.parametros FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('os'::text) AS pode_modulo));


--
-- Name: participantes ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.participantes FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM os.chamados c
  WHERE (c.id = participantes.chamado_id))) OR (EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE (o.id = participantes.ordem_id)))));


--
-- Name: planos_preventivos ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.planos_preventivos FOR SELECT TO authenticated USING ((( SELECT core.pode('os.ativos'::text) AS pode) OR ( SELECT core.pode('os.ativos_gerenciar'::text) AS pode)));


--
-- Name: portal_links ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.portal_links FOR SELECT TO authenticated USING (( SELECT core.pode('os.portal'::text) AS pode));


--
-- Name: portal_sessoes ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.portal_sessoes FOR SELECT TO authenticated USING (( SELECT core.pode('os.portal'::text) AS pode));


--
-- Name: profissionais ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.profissionais FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('os'::text) AS pode_modulo));


--
-- Name: sessao_tecnicos ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.sessao_tecnicos FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (os.sessoes s
     JOIN os.ordens o ON ((o.id = s.ordem_id)))
  WHERE (s.id = sessao_tecnicos.sessao_id))));


--
-- Name: sessoes ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.sessoes FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE (o.id = sessoes.ordem_id))));


--
-- Name: setor_membros ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.setor_membros FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('os'::text) AS pode_modulo));


--
-- Name: setores ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.setores FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('os'::text) AS pode_modulo));


--
-- Name: tecnico_valores ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.tecnico_valores FOR SELECT TO authenticated USING ((( SELECT core.pode('os.custos'::text) AS pode) OR ( SELECT core.pode('os.parametros'::text) AS pode)));


--
-- Name: tecnicos ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.tecnicos FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('os'::text) AS pode_modulo));


--
-- Name: terceirizado_links ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.terceirizado_links FOR SELECT TO authenticated USING ((( SELECT core.pode('os.terceirizados'::text) AS pode) OR (EXISTS ( SELECT 1
   FROM os.ordens o
  WHERE ((o.id = terceirizado_links.ordem_id) AND ( SELECT core.pode('os.acessar'::text) AS pode) AND ((o.aberto_por = ( SELECT auth.uid() AS uid)) OR (o.responsavel_id = ( SELECT auth.uid() AS uid)) OR (o.setor_id = ANY (ARRAY( SELECT os.meus_setores() AS meus_setores))) OR (( SELECT core.pode('os.gerenciar_setor'::text) AS pode) AND ( SELECT core.pode('os.todos_setores'::text) AS pode)) OR (o.id IN ( SELECT os.minhas_ordens_envolvidas() AS minhas_ordens_envolvidas))))))));


--
-- Name: vistoria_ambientes ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.vistoria_ambientes FOR SELECT TO authenticated USING (( SELECT core.pode('os.vistorias'::text) AS pode));


--
-- Name: vistorias ver; Type: POLICY; Schema: os; Owner: -
--

CREATE POLICY ver ON os.vistorias FOR SELECT TO authenticated USING (( SELECT core.pode('os.vistorias'::text) AS pode));


--
-- Name: vistoria_ambientes; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.vistoria_ambientes ENABLE ROW LEVEL SECURITY;

--
-- Name: vistorias; Type: ROW SECURITY; Schema: os; Owner: -
--

ALTER TABLE os.vistorias ENABLE ROW LEVEL SECURITY;

--
-- Name: afastamentos; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.afastamentos ENABLE ROW LEVEL SECURITY;

--
-- Name: banco_horas_ciclos; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.banco_horas_ciclos ENABLE ROW LEVEL SECURITY;

--
-- Name: banco_horas_fechamentos; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.banco_horas_fechamentos ENABLE ROW LEVEL SECURITY;

--
-- Name: beneficio_contratos; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.beneficio_contratos ENABLE ROW LEVEL SECURITY;

--
-- Name: beneficio_totais_mensais; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.beneficio_totais_mensais ENABLE ROW LEVEL SECURITY;

--
-- Name: beneficio_valores_mensais; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.beneficio_valores_mensais ENABLE ROW LEVEL SECURITY;

--
-- Name: beneficios; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.beneficios ENABLE ROW LEVEL SECURITY;

--
-- Name: cargos; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.cargos ENABLE ROW LEVEL SECURITY;

--
-- Name: categorias_gasto; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.categorias_gasto ENABLE ROW LEVEL SECURITY;

--
-- Name: colaborador_beneficios; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.colaborador_beneficios ENABLE ROW LEVEL SECURITY;

--
-- Name: colaboradores; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.colaboradores ENABLE ROW LEVEL SECURITY;

--
-- Name: banco_horas_ciclos criar; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY criar ON rh.banco_horas_ciclos FOR INSERT TO authenticated WITH CHECK (( SELECT rh.pode_fechar_banco() AS pode_fechar_banco));


--
-- Name: banco_horas_fechamentos criar; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY criar ON rh.banco_horas_fechamentos FOR INSERT TO authenticated WITH CHECK (( SELECT rh.pode_fechar_banco() AS pode_fechar_banco));


--
-- Name: categorias_gasto criar; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY criar ON rh.categorias_gasto FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('rh.orcamento.lancar'::text) AS pode));


--
-- Name: gastos criar; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY criar ON rh.gastos FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('rh.orcamento.lancar'::text) AS pode));


--
-- Name: custos_colaborador; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.custos_colaborador ENABLE ROW LEVEL SECURITY;

--
-- Name: dados_financeiros_mensais; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.dados_financeiros_mensais ENABLE ROW LEVEL SECURITY;

--
-- Name: departamentos; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.departamentos ENABLE ROW LEVEL SECURITY;

--
-- Name: dependentes; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.dependentes ENABLE ROW LEVEL SECURITY;

--
-- Name: banco_horas_fechamentos editar; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY editar ON rh.banco_horas_fechamentos FOR UPDATE TO authenticated USING (( SELECT rh.pode_fechar_banco() AS pode_fechar_banco)) WITH CHECK (( SELECT rh.pode_fechar_banco() AS pode_fechar_banco));


--
-- Name: beneficio_contratos editar; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY editar ON rh.beneficio_contratos TO authenticated USING (( SELECT core.pode('rh.beneficios'::text) AS pode)) WITH CHECK (( SELECT core.pode('rh.beneficios'::text) AS pode));


--
-- Name: beneficio_totais_mensais editar; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY editar ON rh.beneficio_totais_mensais TO authenticated USING (( SELECT core.pode('rh.beneficios'::text) AS pode)) WITH CHECK (( SELECT core.pode('rh.beneficios'::text) AS pode));


--
-- Name: beneficio_valores_mensais editar; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY editar ON rh.beneficio_valores_mensais TO authenticated USING (( SELECT core.pode('rh.beneficios'::text) AS pode)) WITH CHECK (( SELECT core.pode('rh.beneficios'::text) AS pode));


--
-- Name: beneficios editar; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY editar ON rh.beneficios TO authenticated USING (( SELECT core.pode('rh.beneficios'::text) AS pode)) WITH CHECK (( SELECT core.pode('rh.beneficios'::text) AS pode));


--
-- Name: cargos editar; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY editar ON rh.cargos TO authenticated USING (( SELECT core.pode('rh.parametros'::text) AS pode)) WITH CHECK (( SELECT core.pode('rh.parametros'::text) AS pode));


--
-- Name: categorias_gasto editar; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY editar ON rh.categorias_gasto FOR UPDATE TO authenticated USING (( SELECT core.pode('rh.orcamento.lancar'::text) AS pode)) WITH CHECK (( SELECT core.pode('rh.orcamento.lancar'::text) AS pode));


--
-- Name: colaborador_beneficios editar; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY editar ON rh.colaborador_beneficios TO authenticated USING (( SELECT core.pode('rh.beneficios'::text) AS pode)) WITH CHECK (( SELECT core.pode('rh.beneficios'::text) AS pode));


--
-- Name: colaboradores editar; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY editar ON rh.colaboradores TO authenticated USING (( SELECT core.pode('rh.parametros'::text) AS pode)) WITH CHECK (( SELECT core.pode('rh.parametros'::text) AS pode));


--
-- Name: dados_financeiros_mensais editar; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY editar ON rh.dados_financeiros_mensais TO authenticated USING (( SELECT core.pode('rh.parametros'::text) AS pode)) WITH CHECK (( SELECT core.pode('rh.parametros'::text) AS pode));


--
-- Name: departamentos editar; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY editar ON rh.departamentos TO authenticated USING (( SELECT core.pode('rh.parametros'::text) AS pode)) WITH CHECK (( SELECT core.pode('rh.parametros'::text) AS pode));


--
-- Name: encargos_por_contrato editar; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY editar ON rh.encargos_por_contrato TO authenticated USING (( SELECT core.pode('rh.parametros'::text) AS pode)) WITH CHECK (( SELECT core.pode('rh.parametros'::text) AS pode));


--
-- Name: folha_colaboradores editar; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY editar ON rh.folha_colaboradores TO authenticated USING (( SELECT core.pode('rh.folha'::text) AS pode)) WITH CHECK (( SELECT core.pode('rh.folha'::text) AS pode));


--
-- Name: folha_rubricas editar; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY editar ON rh.folha_rubricas TO authenticated USING (( SELECT core.pode('rh.folha'::text) AS pode)) WITH CHECK (( SELECT core.pode('rh.folha'::text) AS pode));


--
-- Name: folhas editar; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY editar ON rh.folhas TO authenticated USING (( SELECT core.pode('rh.folha'::text) AS pode)) WITH CHECK (( SELECT core.pode('rh.folha'::text) AS pode));


--
-- Name: gastos editar; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY editar ON rh.gastos FOR UPDATE TO authenticated USING (( SELECT core.pode('rh.orcamento.lancar'::text) AS pode)) WITH CHECK (( SELECT core.pode('rh.orcamento.lancar'::text) AS pode));


--
-- Name: jornadas editar; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY editar ON rh.jornadas TO authenticated USING (( SELECT core.pode('rh.parametros'::text) AS pode)) WITH CHECK (( SELECT core.pode('rh.parametros'::text) AS pode));


--
-- Name: motivos_desligamento editar; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY editar ON rh.motivos_desligamento TO authenticated USING (( SELECT core.pode('rh.parametros'::text) AS pode)) WITH CHECK (( SELECT core.pode('rh.parametros'::text) AS pode));


--
-- Name: notas_pj editar; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY editar ON rh.notas_pj TO authenticated USING (( SELECT core.pode('rh.parametros'::text) AS pode)) WITH CHECK (( SELECT core.pode('rh.parametros'::text) AS pode));


--
-- Name: parametros_empresa editar; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY editar ON rh.parametros_empresa TO authenticated USING (( SELECT core.pode('rh.parametros'::text) AS pode)) WITH CHECK (( SELECT core.pode('rh.parametros'::text) AS pode));


--
-- Name: parametros_turnover editar; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY editar ON rh.parametros_turnover TO authenticated USING (( SELECT core.pode('rh.parametros'::text) AS pode)) WITH CHECK (( SELECT core.pode('rh.parametros'::text) AS pode));


--
-- Name: plano_coparticipacao editar; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY editar ON rh.plano_coparticipacao TO authenticated USING (( SELECT core.pode('rh.beneficios'::text) AS pode)) WITH CHECK (( SELECT core.pode('rh.beneficios'::text) AS pode));


--
-- Name: plano_faixas_etarias editar; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY editar ON rh.plano_faixas_etarias TO authenticated USING (( SELECT core.pode('rh.beneficios'::text) AS pode)) WITH CHECK (( SELECT core.pode('rh.beneficios'::text) AS pode));


--
-- Name: plano_tabelas editar; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY editar ON rh.plano_tabelas TO authenticated USING (( SELECT core.pode('rh.beneficios'::text) AS pode)) WITH CHECK (( SELECT core.pode('rh.beneficios'::text) AS pode));


--
-- Name: rubricas editar; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY editar ON rh.rubricas TO authenticated USING ((( SELECT core.pode('rh.parametros'::text) AS pode) OR ( SELECT core.pode('rh.folha'::text) AS pode))) WITH CHECK ((( SELECT core.pode('rh.parametros'::text) AS pode) OR ( SELECT core.pode('rh.folha'::text) AS pode)));


--
-- Name: encargos_por_contrato; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.encargos_por_contrato ENABLE ROW LEVEL SECURITY;

--
-- Name: banco_horas_ciclos excluir; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY excluir ON rh.banco_horas_ciclos FOR DELETE TO authenticated USING (( SELECT rh.pode_fechar_banco() AS pode_fechar_banco));


--
-- Name: banco_horas_fechamentos excluir; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY excluir ON rh.banco_horas_fechamentos FOR DELETE TO authenticated USING (( SELECT rh.pode_fechar_banco() AS pode_fechar_banco));


--
-- Name: gastos excluir; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY excluir ON rh.gastos FOR DELETE TO authenticated USING (( SELECT core.pode('rh.orcamento.lancar'::text) AS pode));


--
-- Name: folha_colaboradores; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.folha_colaboradores ENABLE ROW LEVEL SECURITY;

--
-- Name: folha_rubricas; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.folha_rubricas ENABLE ROW LEVEL SECURITY;

--
-- Name: folhas; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.folhas ENABLE ROW LEVEL SECURITY;

--
-- Name: gastos; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.gastos ENABLE ROW LEVEL SECURITY;

--
-- Name: jornadas; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.jornadas ENABLE ROW LEVEL SECURITY;

--
-- Name: motivos_desligamento; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.motivos_desligamento ENABLE ROW LEVEL SECURITY;

--
-- Name: notas_pj; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.notas_pj ENABLE ROW LEVEL SECURITY;

--
-- Name: orcamentos_anuais; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.orcamentos_anuais ENABLE ROW LEVEL SECURITY;

--
-- Name: parametros_empresa; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.parametros_empresa ENABLE ROW LEVEL SECURITY;

--
-- Name: parametros_turnover; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.parametros_turnover ENABLE ROW LEVEL SECURITY;

--
-- Name: plano_coparticipacao; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.plano_coparticipacao ENABLE ROW LEVEL SECURITY;

--
-- Name: plano_faixas_etarias; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.plano_faixas_etarias ENABLE ROW LEVEL SECURITY;

--
-- Name: plano_tabelas; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.plano_tabelas ENABLE ROW LEVEL SECURITY;

--
-- Name: ponto_diario; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.ponto_diario ENABLE ROW LEVEL SECURITY;

--
-- Name: ponto_mensal; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.ponto_mensal ENABLE ROW LEVEL SECURITY;

--
-- Name: rubricas; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.rubricas ENABLE ROW LEVEL SECURITY;

--
-- Name: valores_pj; Type: ROW SECURITY; Schema: rh; Owner: -
--

ALTER TABLE rh.valores_pj ENABLE ROW LEVEL SECURITY;

--
-- Name: afastamentos ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.afastamentos FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('rh'::text) AS pode_modulo));


--
-- Name: banco_horas_ciclos ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.banco_horas_ciclos FOR SELECT TO authenticated USING (( SELECT core.pode('rh.custo_pessoal'::text) AS pode));


--
-- Name: banco_horas_fechamentos ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.banco_horas_fechamentos FOR SELECT TO authenticated USING (( SELECT core.pode('rh.custo_pessoal.individual'::text) AS pode));


--
-- Name: beneficio_contratos ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.beneficio_contratos FOR SELECT TO authenticated USING (( SELECT core.pode('rh.beneficios'::text) AS pode));


--
-- Name: beneficio_totais_mensais ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.beneficio_totais_mensais FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('rh'::text) AS pode_modulo));


--
-- Name: beneficio_valores_mensais ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.beneficio_valores_mensais FOR SELECT TO authenticated USING (( SELECT core.pode('rh.beneficios'::text) AS pode));


--
-- Name: beneficios ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.beneficios FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('rh'::text) AS pode_modulo));


--
-- Name: cargos ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.cargos FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('rh'::text) AS pode_modulo));


--
-- Name: categorias_gasto ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.categorias_gasto FOR SELECT TO authenticated USING ((( SELECT core.pode('rh.orcamento'::text) AS pode) OR ( SELECT core.pode('rh.orcamento.lancar'::text) AS pode)));


--
-- Name: colaborador_beneficios ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.colaborador_beneficios FOR SELECT TO authenticated USING (( SELECT core.pode('rh.beneficios'::text) AS pode));


--
-- Name: colaboradores ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.colaboradores FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('rh'::text) AS pode_modulo));


--
-- Name: custos_colaborador ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.custos_colaborador FOR SELECT TO authenticated USING (( SELECT core.pode('rh.custo_pessoal.individual'::text) AS pode));


--
-- Name: dados_financeiros_mensais ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.dados_financeiros_mensais FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('rh'::text) AS pode_modulo));


--
-- Name: departamentos ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.departamentos FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('rh'::text) AS pode_modulo));


--
-- Name: dependentes ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.dependentes FOR SELECT TO authenticated USING (( SELECT core.pode('rh.beneficios'::text) AS pode));


--
-- Name: encargos_por_contrato ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.encargos_por_contrato FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('rh'::text) AS pode_modulo));


--
-- Name: folha_colaboradores ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.folha_colaboradores FOR SELECT TO authenticated USING (( SELECT core.pode('rh.custo_pessoal.individual'::text) AS pode));


--
-- Name: folha_rubricas ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.folha_rubricas FOR SELECT TO authenticated USING (( SELECT core.pode('rh.custo_pessoal.individual'::text) AS pode));


--
-- Name: folhas ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.folhas FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('rh'::text) AS pode_modulo));


--
-- Name: gastos ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.gastos FOR SELECT TO authenticated USING ((( SELECT core.pode('rh.orcamento'::text) AS pode) OR ( SELECT core.pode('rh.orcamento.lancar'::text) AS pode)));


--
-- Name: jornadas ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.jornadas FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('rh'::text) AS pode_modulo));


--
-- Name: motivos_desligamento ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.motivos_desligamento FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('rh'::text) AS pode_modulo));


--
-- Name: notas_pj ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.notas_pj FOR SELECT TO authenticated USING (( SELECT core.pode('rh.custo_pessoal.individual'::text) AS pode));


--
-- Name: orcamentos_anuais ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.orcamentos_anuais FOR SELECT TO authenticated USING ((( SELECT core.pode('rh.orcamento'::text) AS pode) OR ( SELECT core.pode('rh.orcamento.lancar'::text) AS pode)));


--
-- Name: parametros_empresa ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.parametros_empresa FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('rh'::text) AS pode_modulo));


--
-- Name: parametros_turnover ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.parametros_turnover FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('rh'::text) AS pode_modulo));


--
-- Name: plano_coparticipacao ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.plano_coparticipacao FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('rh'::text) AS pode_modulo));


--
-- Name: plano_faixas_etarias ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.plano_faixas_etarias FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('rh'::text) AS pode_modulo));


--
-- Name: plano_tabelas ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.plano_tabelas FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('rh'::text) AS pode_modulo));


--
-- Name: ponto_diario ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.ponto_diario FOR SELECT TO authenticated USING ((( SELECT core.pode('rh.jornada'::text) AS pode) OR ( SELECT core.pode('rh.painel'::text) AS pode) OR ( SELECT core.pode('rh.funcionarios'::text) AS pode)));


--
-- Name: ponto_mensal ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.ponto_mensal FOR SELECT TO authenticated USING ((( SELECT core.pode('rh.jornada'::text) AS pode) OR ( SELECT core.pode('rh.painel'::text) AS pode) OR ( SELECT core.pode('rh.funcionarios'::text) AS pode)));


--
-- Name: rubricas ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.rubricas FOR SELECT TO authenticated USING (( SELECT core.pode_modulo('rh'::text) AS pode_modulo));


--
-- Name: valores_pj ver; Type: POLICY; Schema: rh; Owner: -
--

CREATE POLICY ver ON rh.valores_pj FOR SELECT TO authenticated USING (( SELECT core.pode('rh.custo_pessoal.individual'::text) AS pode));


--
-- Name: acoes; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.acoes ENABLE ROW LEVEL SECURITY;

--
-- Name: cadastros_lista; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.cadastros_lista ENABLE ROW LEVEL SECURITY;

--
-- Name: coletores; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.coletores ENABLE ROW LEVEL SECURITY;

--
-- Name: consolidado_valores; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.consolidado_valores ENABLE ROW LEVEL SECURITY;

--
-- Name: consolidados; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.consolidados ENABLE ROW LEVEL SECURITY;

--
-- Name: contratos; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.contratos ENABLE ROW LEVEL SECURITY;

--
-- Name: contribuicao_valores; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.contribuicao_valores ENABLE ROW LEVEL SECURITY;

--
-- Name: contribuicoes; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.contribuicoes ENABLE ROW LEVEL SECURITY;

--
-- Name: acoes criar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY criar ON sustentabilidade.acoes FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('sustentabilidade.clube.editar'::text) AS pode));


--
-- Name: cadastros_lista criar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY criar ON sustentabilidade.cadastros_lista FOR INSERT TO authenticated WITH CHECK ((( SELECT sustentabilidade.pode_alguma(VARIADIC ARRAY['programas.gerenciar'::text, 'importar'::text]) AS pode_alguma) OR (programa_id IN ( SELECT sustentabilidade.meus_programas() AS meus_programas))));


--
-- Name: coletores criar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY criar ON sustentabilidade.coletores FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('sustentabilidade.parametros'::text) AS pode) AND (NOT exemplo)));


--
-- Name: consolidado_valores criar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY criar ON sustentabilidade.consolidado_valores FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('sustentabilidade.parametros'::text) AS pode) AND ( SELECT core.pode('sustentabilidade.valores'::text) AS pode)));


--
-- Name: consolidados criar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY criar ON sustentabilidade.consolidados FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('sustentabilidade.parametros'::text) AS pode));


--
-- Name: contribuicao_valores criar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY criar ON sustentabilidade.contribuicao_valores FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('sustentabilidade.clube.editar'::text) AS pode));


--
-- Name: contribuicoes criar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY criar ON sustentabilidade.contribuicoes FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('sustentabilidade.clube.editar'::text) AS pode));


--
-- Name: entrevista_transferencias criar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY criar ON sustentabilidade.entrevista_transferencias FOR INSERT TO authenticated WITH CHECK (((quem = ( SELECT auth.uid() AS uid)) AND ( SELECT core.pode('sustentabilidade.entrevistas.dispensar'::text) AS pode)));


--
-- Name: entrevistas criar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY criar ON sustentabilidade.entrevistas FOR INSERT TO authenticated WITH CHECK (((NOT exemplo) AND (((origem = 'sistema'::text) AND (importacao_id IS NULL) AND (entrevistador_id = ( SELECT auth.uid() AS uid)) AND ( SELECT core.pode('sustentabilidade.entrevistas.aplicar'::text) AS pode)) OR ((origem <> 'sistema'::text) AND ( SELECT core.pode('sustentabilidade.importar'::text) AS pode) AND (importacao_id IN ( SELECT i.id
   FROM sustentabilidade.importacoes i
  WHERE ((i.status = 'previa'::text) AND (i.criado_por = ( SELECT auth.uid() AS uid)))))))));


--
-- Name: equivalencias criar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY criar ON sustentabilidade.equivalencias FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('sustentabilidade.parametros'::text) AS pode));


--
-- Name: formulario_alteracoes criar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY criar ON sustentabilidade.formulario_alteracoes FOR INSERT TO authenticated WITH CHECK (((quem = ( SELECT auth.uid() AS uid)) AND ( SELECT sustentabilidade.pode_alguma(VARIADIC ARRAY['entrevistas.questionario'::text, 'programas.gerenciar'::text]) AS pode_alguma)));


--
-- Name: formularios criar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY criar ON sustentabilidade.formularios FOR INSERT TO authenticated WITH CHECK (
CASE tipo
    WHEN 'questionario'::text THEN ( SELECT core.pode('sustentabilidade.entrevistas.questionario'::text) AS pode)
    ELSE ( SELECT core.pode('sustentabilidade.programas.gerenciar'::text) AS pode)
END);


--
-- Name: importacoes criar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY criar ON sustentabilidade.importacoes FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('sustentabilidade.importar'::text) AS pode) AND (status = 'previa'::text) AND (criado_por = ( SELECT auth.uid() AS uid))));


--
-- Name: lancamento_valores criar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY criar ON sustentabilidade.lancamento_valores FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('sustentabilidade.programas.gerenciar'::text) AS pode) OR ( SELECT core.pode('sustentabilidade.importar'::text) AS pode) OR (lancamento_id IN ( SELECT l.id
   FROM sustentabilidade.lancamentos l
  WHERE (l.programa_id IN ( SELECT sustentabilidade.meus_programas() AS meus_programas))))));


--
-- Name: lancamentos criar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY criar ON sustentabilidade.lancamentos FOR INSERT TO authenticated WITH CHECK (((NOT exemplo) AND (((origem = 'equipe'::text) AND (link_id IS NULL) AND (importacao_id IS NULL) AND (lancado_por = ( SELECT auth.uid() AS uid)) AND (( SELECT core.pode('sustentabilidade.programas.gerenciar'::text) AS pode) OR (programa_id IN ( SELECT sustentabilidade.meus_programas() AS meus_programas)))) OR ((origem = 'importacao'::text) AND ( SELECT core.pode('sustentabilidade.importar'::text) AS pode) AND (importacao_id IN ( SELECT i.id
   FROM sustentabilidade.importacoes i
  WHERE ((i.status = 'previa'::text) AND (i.criado_por = ( SELECT auth.uid() AS uid)))))))));


--
-- Name: marcos criar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY criar ON sustentabilidade.marcos FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('sustentabilidade.parametros'::text) AS pode) AND (NOT exemplo)));


--
-- Name: participante_contatos criar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY criar ON sustentabilidade.participante_contatos FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('sustentabilidade.clube.editar'::text) AS pode) AND ( SELECT core.pode('sustentabilidade.contato'::text) AS pode)));


--
-- Name: participante_valores criar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY criar ON sustentabilidade.participante_valores FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('sustentabilidade.clube.editar'::text) AS pode) AND ( SELECT core.pode('sustentabilidade.valores'::text) AS pode)));


--
-- Name: participantes criar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY criar ON sustentabilidade.participantes FOR INSERT TO authenticated WITH CHECK (((NOT exemplo) AND (( SELECT core.pode('sustentabilidade.clube.editar'::text) AS pode) OR (interesse AND (formas = '{}'::text[]) AND ( SELECT core.pode('sustentabilidade.entrevistas.aplicar'::text) AS pode)))));


--
-- Name: programa_contatos criar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY criar ON sustentabilidade.programa_contatos FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('sustentabilidade.programas.gerenciar'::text) AS pode) AND ( SELECT core.pode('sustentabilidade.contato'::text) AS pode)));


--
-- Name: programa_indicadores criar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY criar ON sustentabilidade.programa_indicadores FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('sustentabilidade.programas.gerenciar'::text) AS pode));


--
-- Name: programa_links criar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY criar ON sustentabilidade.programa_links FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('sustentabilidade.programas.gerenciar'::text) AS pode) AND (criado_por = ( SELECT auth.uid() AS uid))));


--
-- Name: programas criar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY criar ON sustentabilidade.programas FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('sustentabilidade.programas.gerenciar'::text) AS pode) AND (NOT exemplo)));


--
-- Name: rcc_fatores criar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY criar ON sustentabilidade.rcc_fatores FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('sustentabilidade.parametros'::text) AS pode));


--
-- Name: rcc_nota_valores criar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY criar ON sustentabilidade.rcc_nota_valores FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('sustentabilidade.rcc'::text) AS pode));


--
-- Name: rcc_notas criar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY criar ON sustentabilidade.rcc_notas FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('sustentabilidade.rcc'::text) AS pode) AND (lancado_por = ( SELECT auth.uid() AS uid)) AND (NOT exemplo)));


--
-- Name: rcc_precos criar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY criar ON sustentabilidade.rcc_precos FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('sustentabilidade.parametros'::text) AS pode) AND ( SELECT core.pode('sustentabilidade.valores'::text) AS pode) AND (NOT exemplo)));


--
-- Name: ronda_itens criar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY criar ON sustentabilidade.ronda_itens FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('sustentabilidade.ronda'::text) AS pode));


--
-- Name: rondas criar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY criar ON sustentabilidade.rondas FOR INSERT TO authenticated WITH CHECK ((( SELECT core.pode('sustentabilidade.ronda'::text) AS pode) AND (lancado_por = ( SELECT auth.uid() AS uid)) AND (NOT exemplo)));


--
-- Name: setor_validades criar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY criar ON sustentabilidade.setor_validades FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('sustentabilidade.parametros'::text) AS pode));


--
-- Name: termos criar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY criar ON sustentabilidade.termos FOR INSERT TO authenticated WITH CHECK (( SELECT core.pode('sustentabilidade.clube.editar'::text) AS pode));


--
-- Name: acoes editar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY editar ON sustentabilidade.acoes FOR UPDATE TO authenticated USING (( SELECT core.pode('sustentabilidade.clube.editar'::text) AS pode)) WITH CHECK (( SELECT core.pode('sustentabilidade.clube.editar'::text) AS pode));


--
-- Name: cadastros_lista editar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY editar ON sustentabilidade.cadastros_lista FOR UPDATE TO authenticated USING (( SELECT core.pode('sustentabilidade.programas.gerenciar'::text) AS pode)) WITH CHECK (( SELECT core.pode('sustentabilidade.programas.gerenciar'::text) AS pode));


--
-- Name: coletores editar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY editar ON sustentabilidade.coletores FOR UPDATE TO authenticated USING (( SELECT core.pode('sustentabilidade.parametros'::text) AS pode)) WITH CHECK (( SELECT core.pode('sustentabilidade.parametros'::text) AS pode));


--
-- Name: consolidado_valores editar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY editar ON sustentabilidade.consolidado_valores FOR UPDATE TO authenticated USING ((( SELECT core.pode('sustentabilidade.parametros'::text) AS pode) AND ( SELECT core.pode('sustentabilidade.valores'::text) AS pode))) WITH CHECK ((( SELECT core.pode('sustentabilidade.parametros'::text) AS pode) AND ( SELECT core.pode('sustentabilidade.valores'::text) AS pode)));


--
-- Name: consolidados editar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY editar ON sustentabilidade.consolidados FOR UPDATE TO authenticated USING (( SELECT core.pode('sustentabilidade.parametros'::text) AS pode)) WITH CHECK (( SELECT core.pode('sustentabilidade.parametros'::text) AS pode));


--
-- Name: contratos editar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY editar ON sustentabilidade.contratos FOR UPDATE TO authenticated USING (( SELECT core.pode('sustentabilidade.entrevistas.dispensar'::text) AS pode)) WITH CHECK (( SELECT core.pode('sustentabilidade.entrevistas.dispensar'::text) AS pode));


--
-- Name: contribuicao_valores editar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY editar ON sustentabilidade.contribuicao_valores FOR UPDATE TO authenticated USING ((( SELECT core.pode('sustentabilidade.clube.editar'::text) AS pode) AND ( SELECT core.pode('sustentabilidade.valores'::text) AS pode))) WITH CHECK ((( SELECT core.pode('sustentabilidade.clube.editar'::text) AS pode) AND ( SELECT core.pode('sustentabilidade.valores'::text) AS pode)));


--
-- Name: contribuicoes editar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY editar ON sustentabilidade.contribuicoes FOR UPDATE TO authenticated USING (( SELECT core.pode('sustentabilidade.clube.editar'::text) AS pode)) WITH CHECK (( SELECT core.pode('sustentabilidade.clube.editar'::text) AS pode));


--
-- Name: entrevistas editar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY editar ON sustentabilidade.entrevistas FOR UPDATE TO authenticated USING ((((situacao = 'rascunho'::text) AND (entrevistador_id = ( SELECT auth.uid() AS uid)) AND ( SELECT core.pode('sustentabilidade.entrevistas.aplicar'::text) AS pode)) OR ( SELECT core.pode('sustentabilidade.entrevistas.dispensar'::text) AS pode))) WITH CHECK (((NOT exemplo) AND (((entrevistador_id = ( SELECT auth.uid() AS uid)) AND ( SELECT core.pode('sustentabilidade.entrevistas.aplicar'::text) AS pode)) OR ( SELECT core.pode('sustentabilidade.entrevistas.dispensar'::text) AS pode))));


--
-- Name: equivalencias editar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY editar ON sustentabilidade.equivalencias FOR UPDATE TO authenticated USING (( SELECT core.pode('sustentabilidade.parametros'::text) AS pode)) WITH CHECK (( SELECT core.pode('sustentabilidade.parametros'::text) AS pode));


--
-- Name: formularios editar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY editar ON sustentabilidade.formularios FOR UPDATE TO authenticated USING (
CASE tipo
    WHEN 'questionario'::text THEN ( SELECT core.pode('sustentabilidade.entrevistas.questionario'::text) AS pode)
    ELSE ( SELECT core.pode('sustentabilidade.programas.gerenciar'::text) AS pode)
END) WITH CHECK (
CASE tipo
    WHEN 'questionario'::text THEN ( SELECT core.pode('sustentabilidade.entrevistas.questionario'::text) AS pode)
    ELSE ( SELECT core.pode('sustentabilidade.programas.gerenciar'::text) AS pode)
END);


--
-- Name: importacoes editar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY editar ON sustentabilidade.importacoes FOR UPDATE TO authenticated USING (((status = 'previa'::text) AND (criado_por = ( SELECT auth.uid() AS uid)) AND ( SELECT core.pode('sustentabilidade.importar'::text) AS pode))) WITH CHECK (((status = 'previa'::text) AND (criado_por = ( SELECT auth.uid() AS uid))));


--
-- Name: lancamento_valores editar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY editar ON sustentabilidade.lancamento_valores FOR UPDATE TO authenticated USING ((( SELECT core.pode('sustentabilidade.valores'::text) AS pode) AND (EXISTS ( SELECT 1
   FROM sustentabilidade.lancamentos l
  WHERE (l.id = lancamento_valores.lancamento_id))))) WITH CHECK (( SELECT core.pode('sustentabilidade.valores'::text) AS pode));


--
-- Name: lancamentos editar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY editar ON sustentabilidade.lancamentos FOR UPDATE TO authenticated USING ((( SELECT core.pode('sustentabilidade.programas.gerenciar'::text) AS pode) OR (programa_id IN ( SELECT sustentabilidade.meus_programas() AS meus_programas)))) WITH CHECK (((NOT exemplo) AND (( SELECT core.pode('sustentabilidade.programas.gerenciar'::text) AS pode) OR (programa_id IN ( SELECT sustentabilidade.meus_programas() AS meus_programas)))));


--
-- Name: marcos editar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY editar ON sustentabilidade.marcos FOR UPDATE TO authenticated USING (( SELECT core.pode('sustentabilidade.parametros'::text) AS pode)) WITH CHECK (( SELECT core.pode('sustentabilidade.parametros'::text) AS pode));


--
-- Name: parametros editar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY editar ON sustentabilidade.parametros FOR UPDATE TO authenticated USING (( SELECT core.pode('sustentabilidade.parametros'::text) AS pode)) WITH CHECK (( SELECT core.pode('sustentabilidade.parametros'::text) AS pode));


--
-- Name: parametros_valores editar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY editar ON sustentabilidade.parametros_valores FOR UPDATE TO authenticated USING ((( SELECT core.pode('sustentabilidade.parametros'::text) AS pode) AND ( SELECT core.pode('sustentabilidade.valores'::text) AS pode))) WITH CHECK ((( SELECT core.pode('sustentabilidade.parametros'::text) AS pode) AND ( SELECT core.pode('sustentabilidade.valores'::text) AS pode)));


--
-- Name: participante_contatos editar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY editar ON sustentabilidade.participante_contatos FOR UPDATE TO authenticated USING ((( SELECT core.pode('sustentabilidade.clube.editar'::text) AS pode) AND ( SELECT core.pode('sustentabilidade.contato'::text) AS pode))) WITH CHECK ((( SELECT core.pode('sustentabilidade.clube.editar'::text) AS pode) AND ( SELECT core.pode('sustentabilidade.contato'::text) AS pode)));


--
-- Name: participante_valores editar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY editar ON sustentabilidade.participante_valores FOR UPDATE TO authenticated USING ((( SELECT core.pode('sustentabilidade.clube.editar'::text) AS pode) AND ( SELECT core.pode('sustentabilidade.valores'::text) AS pode))) WITH CHECK ((( SELECT core.pode('sustentabilidade.clube.editar'::text) AS pode) AND ( SELECT core.pode('sustentabilidade.valores'::text) AS pode)));


--
-- Name: participantes editar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY editar ON sustentabilidade.participantes FOR UPDATE TO authenticated USING (( SELECT core.pode('sustentabilidade.clube.editar'::text) AS pode)) WITH CHECK (( SELECT core.pode('sustentabilidade.clube.editar'::text) AS pode));


--
-- Name: programa_contatos editar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY editar ON sustentabilidade.programa_contatos FOR UPDATE TO authenticated USING ((( SELECT core.pode('sustentabilidade.programas.gerenciar'::text) AS pode) AND ( SELECT core.pode('sustentabilidade.contato'::text) AS pode))) WITH CHECK ((( SELECT core.pode('sustentabilidade.programas.gerenciar'::text) AS pode) AND ( SELECT core.pode('sustentabilidade.contato'::text) AS pode)));


--
-- Name: programa_indicadores editar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY editar ON sustentabilidade.programa_indicadores FOR UPDATE TO authenticated USING (( SELECT core.pode('sustentabilidade.programas.gerenciar'::text) AS pode)) WITH CHECK (( SELECT core.pode('sustentabilidade.programas.gerenciar'::text) AS pode));


--
-- Name: programa_links editar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY editar ON sustentabilidade.programa_links FOR UPDATE TO authenticated USING (( SELECT core.pode('sustentabilidade.programas.gerenciar'::text) AS pode)) WITH CHECK (( SELECT core.pode('sustentabilidade.programas.gerenciar'::text) AS pode));


--
-- Name: programas editar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY editar ON sustentabilidade.programas FOR UPDATE TO authenticated USING (( SELECT core.pode('sustentabilidade.programas.gerenciar'::text) AS pode)) WITH CHECK (( SELECT core.pode('sustentabilidade.programas.gerenciar'::text) AS pode));


--
-- Name: rcc_fatores editar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY editar ON sustentabilidade.rcc_fatores FOR UPDATE TO authenticated USING (( SELECT core.pode('sustentabilidade.parametros'::text) AS pode)) WITH CHECK (( SELECT core.pode('sustentabilidade.parametros'::text) AS pode));


--
-- Name: rcc_nota_valores editar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY editar ON sustentabilidade.rcc_nota_valores FOR UPDATE TO authenticated USING ((( SELECT core.pode('sustentabilidade.rcc'::text) AS pode) AND ( SELECT core.pode('sustentabilidade.valores'::text) AS pode))) WITH CHECK ((( SELECT core.pode('sustentabilidade.rcc'::text) AS pode) AND ( SELECT core.pode('sustentabilidade.valores'::text) AS pode)));


--
-- Name: rcc_notas editar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY editar ON sustentabilidade.rcc_notas FOR UPDATE TO authenticated USING (( SELECT core.pode('sustentabilidade.rcc'::text) AS pode)) WITH CHECK (( SELECT core.pode('sustentabilidade.rcc'::text) AS pode));


--
-- Name: rcc_precos editar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY editar ON sustentabilidade.rcc_precos FOR UPDATE TO authenticated USING ((( SELECT core.pode('sustentabilidade.parametros'::text) AS pode) AND ( SELECT core.pode('sustentabilidade.valores'::text) AS pode))) WITH CHECK ((( SELECT core.pode('sustentabilidade.parametros'::text) AS pode) AND ( SELECT core.pode('sustentabilidade.valores'::text) AS pode)));


--
-- Name: ronda_itens editar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY editar ON sustentabilidade.ronda_itens FOR UPDATE TO authenticated USING (( SELECT core.pode('sustentabilidade.ronda'::text) AS pode)) WITH CHECK (( SELECT core.pode('sustentabilidade.ronda'::text) AS pode));


--
-- Name: rondas editar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY editar ON sustentabilidade.rondas FOR UPDATE TO authenticated USING (( SELECT core.pode('sustentabilidade.ronda'::text) AS pode)) WITH CHECK (( SELECT core.pode('sustentabilidade.ronda'::text) AS pode));


--
-- Name: setor_validades editar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY editar ON sustentabilidade.setor_validades FOR UPDATE TO authenticated USING (( SELECT core.pode('sustentabilidade.parametros'::text) AS pode)) WITH CHECK (( SELECT core.pode('sustentabilidade.parametros'::text) AS pode));


--
-- Name: termos editar; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY editar ON sustentabilidade.termos FOR UPDATE TO authenticated USING (( SELECT core.pode('sustentabilidade.clube.editar'::text) AS pode)) WITH CHECK (( SELECT core.pode('sustentabilidade.clube.editar'::text) AS pode));


--
-- Name: entrevista_transferencias; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.entrevista_transferencias ENABLE ROW LEVEL SECURITY;

--
-- Name: entrevistas; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.entrevistas ENABLE ROW LEVEL SECURITY;

--
-- Name: equivalencias; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.equivalencias ENABLE ROW LEVEL SECURITY;

--
-- Name: acoes excluir; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY excluir ON sustentabilidade.acoes FOR DELETE TO authenticated USING (( SELECT core.pode('sustentabilidade.clube.editar'::text) AS pode));


--
-- Name: cadastros_lista excluir; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY excluir ON sustentabilidade.cadastros_lista FOR DELETE TO authenticated USING (( SELECT core.pode('sustentabilidade.programas.gerenciar'::text) AS pode));


--
-- Name: coletores excluir; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY excluir ON sustentabilidade.coletores FOR DELETE TO authenticated USING (( SELECT core.pode('sustentabilidade.parametros'::text) AS pode));


--
-- Name: contribuicoes excluir; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY excluir ON sustentabilidade.contribuicoes FOR DELETE TO authenticated USING (( SELECT core.pode('sustentabilidade.clube.editar'::text) AS pode));


--
-- Name: entrevistas excluir; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY excluir ON sustentabilidade.entrevistas FOR DELETE TO authenticated USING (((situacao = 'rascunho'::text) AND (entrevistador_id = ( SELECT auth.uid() AS uid)) AND ( SELECT core.pode('sustentabilidade.entrevistas.aplicar'::text) AS pode)));


--
-- Name: equivalencias excluir; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY excluir ON sustentabilidade.equivalencias FOR DELETE TO authenticated USING (( SELECT core.pode('sustentabilidade.parametros'::text) AS pode));


--
-- Name: formularios excluir; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY excluir ON sustentabilidade.formularios FOR DELETE TO authenticated USING (((tipo = 'programa'::text) AND ( SELECT core.pode('sustentabilidade.programas.gerenciar'::text) AS pode) AND ( SELECT core.pode('sustentabilidade.formularios.excluir'::text) AS pode)));


--
-- Name: lancamentos excluir; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY excluir ON sustentabilidade.lancamentos FOR DELETE TO authenticated USING ((( SELECT core.pode('sustentabilidade.programas.gerenciar'::text) AS pode) OR (programa_id IN ( SELECT sustentabilidade.meus_programas() AS meus_programas))));


--
-- Name: marcos excluir; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY excluir ON sustentabilidade.marcos FOR DELETE TO authenticated USING (( SELECT core.pode('sustentabilidade.parametros'::text) AS pode));


--
-- Name: participante_contatos excluir; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY excluir ON sustentabilidade.participante_contatos FOR DELETE TO authenticated USING ((( SELECT core.pode('sustentabilidade.clube.editar'::text) AS pode) AND ( SELECT core.pode('sustentabilidade.contato'::text) AS pode)));


--
-- Name: participante_valores excluir; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY excluir ON sustentabilidade.participante_valores FOR DELETE TO authenticated USING ((( SELECT core.pode('sustentabilidade.clube.editar'::text) AS pode) AND ( SELECT core.pode('sustentabilidade.valores'::text) AS pode)));


--
-- Name: programa_contatos excluir; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY excluir ON sustentabilidade.programa_contatos FOR DELETE TO authenticated USING ((( SELECT core.pode('sustentabilidade.programas.gerenciar'::text) AS pode) AND ( SELECT core.pode('sustentabilidade.contato'::text) AS pode)));


--
-- Name: programa_indicadores excluir; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY excluir ON sustentabilidade.programa_indicadores FOR DELETE TO authenticated USING (( SELECT core.pode('sustentabilidade.programas.gerenciar'::text) AS pode));


--
-- Name: programas excluir; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY excluir ON sustentabilidade.programas FOR DELETE TO authenticated USING (( SELECT core.pode('sustentabilidade.programas.gerenciar'::text) AS pode));


--
-- Name: rcc_fatores excluir; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY excluir ON sustentabilidade.rcc_fatores FOR DELETE TO authenticated USING (( SELECT core.pode('sustentabilidade.parametros'::text) AS pode));


--
-- Name: rcc_nota_valores excluir; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY excluir ON sustentabilidade.rcc_nota_valores FOR DELETE TO authenticated USING (( SELECT core.pode('sustentabilidade.rcc'::text) AS pode));


--
-- Name: rcc_notas excluir; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY excluir ON sustentabilidade.rcc_notas FOR DELETE TO authenticated USING (( SELECT core.pode('sustentabilidade.rcc'::text) AS pode));


--
-- Name: rcc_precos excluir; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY excluir ON sustentabilidade.rcc_precos FOR DELETE TO authenticated USING ((( SELECT core.pode('sustentabilidade.parametros'::text) AS pode) AND ( SELECT core.pode('sustentabilidade.valores'::text) AS pode)));


--
-- Name: ronda_itens excluir; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY excluir ON sustentabilidade.ronda_itens FOR DELETE TO authenticated USING (( SELECT core.pode('sustentabilidade.ronda'::text) AS pode));


--
-- Name: rondas excluir; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY excluir ON sustentabilidade.rondas FOR DELETE TO authenticated USING (( SELECT core.pode('sustentabilidade.ronda'::text) AS pode));


--
-- Name: setor_validades excluir; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY excluir ON sustentabilidade.setor_validades FOR DELETE TO authenticated USING (( SELECT core.pode('sustentabilidade.parametros'::text) AS pode));


--
-- Name: termos excluir; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY excluir ON sustentabilidade.termos FOR DELETE TO authenticated USING (( SELECT core.pode('sustentabilidade.clube.editar'::text) AS pode));


--
-- Name: formulario_alteracoes; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.formulario_alteracoes ENABLE ROW LEVEL SECURITY;

--
-- Name: formulario_versoes; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.formulario_versoes ENABLE ROW LEVEL SECURITY;

--
-- Name: formularios; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.formularios ENABLE ROW LEVEL SECURITY;

--
-- Name: importacoes; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.importacoes ENABLE ROW LEVEL SECURITY;

--
-- Name: lancamento_valores; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.lancamento_valores ENABLE ROW LEVEL SECURITY;

--
-- Name: lancamentos; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.lancamentos ENABLE ROW LEVEL SECURITY;

--
-- Name: marcos; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.marcos ENABLE ROW LEVEL SECURITY;

--
-- Name: parametros; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.parametros ENABLE ROW LEVEL SECURITY;

--
-- Name: parametros_valores; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.parametros_valores ENABLE ROW LEVEL SECURITY;

--
-- Name: participante_contatos; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.participante_contatos ENABLE ROW LEVEL SECURITY;

--
-- Name: participante_valores; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.participante_valores ENABLE ROW LEVEL SECURITY;

--
-- Name: participantes; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.participantes ENABLE ROW LEVEL SECURITY;

--
-- Name: programa_contatos; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.programa_contatos ENABLE ROW LEVEL SECURITY;

--
-- Name: programa_indicadores; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.programa_indicadores ENABLE ROW LEVEL SECURITY;

--
-- Name: programa_links; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.programa_links ENABLE ROW LEVEL SECURITY;

--
-- Name: programas; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.programas ENABLE ROW LEVEL SECURITY;

--
-- Name: rcc_fatores; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.rcc_fatores ENABLE ROW LEVEL SECURITY;

--
-- Name: rcc_nota_valores; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.rcc_nota_valores ENABLE ROW LEVEL SECURITY;

--
-- Name: rcc_notas; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.rcc_notas ENABLE ROW LEVEL SECURITY;

--
-- Name: rcc_precos; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.rcc_precos ENABLE ROW LEVEL SECURITY;

--
-- Name: ronda_itens; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.ronda_itens ENABLE ROW LEVEL SECURITY;

--
-- Name: rondas; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.rondas ENABLE ROW LEVEL SECURITY;

--
-- Name: setor_validades; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.setor_validades ENABLE ROW LEVEL SECURITY;

--
-- Name: termos; Type: ROW SECURITY; Schema: sustentabilidade; Owner: -
--

ALTER TABLE sustentabilidade.termos ENABLE ROW LEVEL SECURITY;

--
-- Name: acoes ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.acoes FOR SELECT TO authenticated USING (( SELECT sustentabilidade.pode_alguma(VARIADIC ARRAY['clube.ver'::text, 'clube.editar'::text]) AS pode_alguma));


--
-- Name: cadastros_lista ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.cadastros_lista FOR SELECT TO authenticated USING ((( SELECT sustentabilidade.pode_alguma(VARIADIC ARRAY['programas.gerenciar'::text, 'painel'::text, 'importar'::text]) AS pode_alguma) OR (programa_id IN ( SELECT sustentabilidade.meus_programas() AS meus_programas))));


--
-- Name: coletores ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.coletores FOR SELECT TO authenticated USING (( SELECT sustentabilidade.acessa() AS acessa));


--
-- Name: consolidado_valores ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.consolidado_valores FOR SELECT TO authenticated USING ((( SELECT core.pode('sustentabilidade.valores'::text) AS pode) AND ( SELECT sustentabilidade.pode_alguma(VARIADIC ARRAY['painel'::text, 'parametros'::text]) AS pode_alguma)));


--
-- Name: consolidados ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.consolidados FOR SELECT TO authenticated USING (( SELECT sustentabilidade.pode_alguma(VARIADIC ARRAY['painel'::text, 'parametros'::text]) AS pode_alguma));


--
-- Name: contratos ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.contratos FOR SELECT TO authenticated USING (( SELECT sustentabilidade.pode_alguma(VARIADIC ARRAY['entrevistas.ver'::text, 'entrevistas.aplicar'::text, 'entrevistas.respostas'::text, 'entrevistas.dispensar'::text, 'clube.ver'::text, 'clube.editar'::text, 'painel'::text, 'importar'::text]) AS pode_alguma));


--
-- Name: contribuicao_valores ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.contribuicao_valores FOR SELECT TO authenticated USING ((( SELECT core.pode('sustentabilidade.valores'::text) AS pode) AND ( SELECT sustentabilidade.pode_alguma(VARIADIC ARRAY['clube.ver'::text, 'clube.editar'::text, 'painel'::text]) AS pode_alguma)));


--
-- Name: contribuicoes ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.contribuicoes FOR SELECT TO authenticated USING (( SELECT sustentabilidade.pode_alguma(VARIADIC ARRAY['clube.ver'::text, 'clube.editar'::text]) AS pode_alguma));


--
-- Name: entrevista_transferencias ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.entrevista_transferencias FOR SELECT TO authenticated USING (( SELECT sustentabilidade.pode_alguma(VARIADIC ARRAY['entrevistas.ver'::text, 'entrevistas.respostas'::text, 'entrevistas.dispensar'::text]) AS pode_alguma));


--
-- Name: entrevistas ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.entrevistas FOR SELECT TO authenticated USING ((( SELECT sustentabilidade.pode_alguma(VARIADIC ARRAY['entrevistas.respostas'::text, 'entrevistas.dispensar'::text]) AS pode_alguma) OR ((entrevistador_id = ( SELECT auth.uid() AS uid)) AND ( SELECT core.pode('sustentabilidade.entrevistas.aplicar'::text) AS pode)) OR ((importacao_id IS NOT NULL) AND ( SELECT core.pode('sustentabilidade.importar'::text) AS pode))));


--
-- Name: equivalencias ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.equivalencias FOR SELECT TO authenticated USING (( SELECT sustentabilidade.pode_alguma(VARIADIC ARRAY['painel'::text, 'parametros'::text]) AS pode_alguma));


--
-- Name: formulario_alteracoes ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.formulario_alteracoes FOR SELECT TO authenticated USING (( SELECT sustentabilidade.pode_alguma(VARIADIC ARRAY['entrevistas.questionario'::text, 'programas.gerenciar'::text]) AS pode_alguma));


--
-- Name: formulario_versoes ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.formulario_versoes FOR SELECT TO authenticated USING (( SELECT sustentabilidade.acessa() AS acessa));


--
-- Name: formularios ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.formularios FOR SELECT TO authenticated USING (( SELECT sustentabilidade.acessa() AS acessa));


--
-- Name: importacoes ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.importacoes FOR SELECT TO authenticated USING (( SELECT core.pode('sustentabilidade.importar'::text) AS pode));


--
-- Name: lancamento_valores ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.lancamento_valores FOR SELECT TO authenticated USING ((( SELECT core.pode('sustentabilidade.valores'::text) AS pode) AND (EXISTS ( SELECT 1
   FROM sustentabilidade.lancamentos l
  WHERE (l.id = lancamento_valores.lancamento_id)))));


--
-- Name: lancamentos ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.lancamentos FOR SELECT TO authenticated USING ((( SELECT sustentabilidade.pode_alguma(VARIADIC ARRAY['programas.gerenciar'::text, 'painel'::text]) AS pode_alguma) OR (programa_id IN ( SELECT sustentabilidade.meus_programas() AS meus_programas)) OR ((importacao_id IS NOT NULL) AND ( SELECT core.pode('sustentabilidade.importar'::text) AS pode))));


--
-- Name: marcos ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.marcos FOR SELECT TO authenticated USING (( SELECT sustentabilidade.pode_alguma(VARIADIC ARRAY['painel'::text, 'parametros'::text]) AS pode_alguma));


--
-- Name: parametros ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.parametros FOR SELECT TO authenticated USING (( SELECT sustentabilidade.acessa() AS acessa));


--
-- Name: parametros_valores ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.parametros_valores FOR SELECT TO authenticated USING (( SELECT core.pode('sustentabilidade.valores'::text) AS pode));


--
-- Name: participante_contatos ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.participante_contatos FOR SELECT TO authenticated USING ((( SELECT core.pode('sustentabilidade.contato'::text) AS pode) AND ( SELECT sustentabilidade.pode_alguma(VARIADIC ARRAY['clube.ver'::text, 'clube.editar'::text]) AS pode_alguma)));


--
-- Name: participante_valores ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.participante_valores FOR SELECT TO authenticated USING ((( SELECT core.pode('sustentabilidade.valores'::text) AS pode) AND ( SELECT sustentabilidade.pode_alguma(VARIADIC ARRAY['clube.ver'::text, 'clube.editar'::text, 'painel'::text]) AS pode_alguma)));


--
-- Name: participantes ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.participantes FOR SELECT TO authenticated USING (( SELECT sustentabilidade.pode_alguma(VARIADIC ARRAY['clube.ver'::text, 'clube.editar'::text, 'painel'::text]) AS pode_alguma));


--
-- Name: programa_contatos ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.programa_contatos FOR SELECT TO authenticated USING ((( SELECT core.pode('sustentabilidade.contato'::text) AS pode) AND (EXISTS ( SELECT 1
   FROM sustentabilidade.programas p
  WHERE (p.id = programa_contatos.programa_id)))));


--
-- Name: programa_indicadores ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.programa_indicadores FOR SELECT TO authenticated USING ((( SELECT sustentabilidade.pode_alguma(VARIADIC ARRAY['programas.gerenciar'::text, 'painel'::text]) AS pode_alguma) OR (programa_id IN ( SELECT sustentabilidade.meus_programas() AS meus_programas))));


--
-- Name: programa_links ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.programa_links FOR SELECT TO authenticated USING (( SELECT core.pode('sustentabilidade.programas.gerenciar'::text) AS pode));


--
-- Name: programas ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.programas FOR SELECT TO authenticated USING ((( SELECT sustentabilidade.pode_alguma(VARIADIC ARRAY['programas.gerenciar'::text, 'painel'::text]) AS pode_alguma) OR (id IN ( SELECT sustentabilidade.meus_programas() AS meus_programas))));


--
-- Name: rcc_fatores ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.rcc_fatores FOR SELECT TO authenticated USING (( SELECT sustentabilidade.pode_alguma(VARIADIC ARRAY['rcc'::text, 'painel'::text, 'parametros'::text]) AS pode_alguma));


--
-- Name: rcc_nota_valores ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.rcc_nota_valores FOR SELECT TO authenticated USING ((( SELECT core.pode('sustentabilidade.valores'::text) AS pode) AND ( SELECT sustentabilidade.pode_alguma(VARIADIC ARRAY['rcc'::text, 'painel'::text]) AS pode_alguma)));


--
-- Name: rcc_notas ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.rcc_notas FOR SELECT TO authenticated USING (( SELECT sustentabilidade.pode_alguma(VARIADIC ARRAY['rcc'::text, 'painel'::text]) AS pode_alguma));


--
-- Name: rcc_precos ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.rcc_precos FOR SELECT TO authenticated USING ((( SELECT core.pode('sustentabilidade.valores'::text) AS pode) AND ( SELECT sustentabilidade.pode_alguma(VARIADIC ARRAY['rcc'::text, 'painel'::text, 'parametros'::text]) AS pode_alguma)));


--
-- Name: ronda_itens ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.ronda_itens FOR SELECT TO authenticated USING (( SELECT sustentabilidade.pode_alguma(VARIADIC ARRAY['ronda'::text, 'painel'::text]) AS pode_alguma));


--
-- Name: rondas ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.rondas FOR SELECT TO authenticated USING (( SELECT sustentabilidade.pode_alguma(VARIADIC ARRAY['ronda'::text, 'painel'::text]) AS pode_alguma));


--
-- Name: setor_validades ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.setor_validades FOR SELECT TO authenticated USING (( SELECT sustentabilidade.acessa() AS acessa));


--
-- Name: termos ver; Type: POLICY; Schema: sustentabilidade; Owner: -
--

CREATE POLICY ver ON sustentabilidade.termos FOR SELECT TO authenticated USING (( SELECT sustentabilidade.pode_alguma(VARIADIC ARRAY['clube.ver'::text, 'clube.editar'::text, 'painel'::text]) AS pode_alguma));


--
-- Name: SCHEMA calendario; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA calendario TO authenticated;
GRANT USAGE ON SCHEMA calendario TO service_role;


--
-- Name: SCHEMA comercial; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA comercial TO authenticated;
GRANT USAGE ON SCHEMA comercial TO service_role;


--
-- Name: SCHEMA core; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA core TO authenticated;
GRANT USAGE ON SCHEMA core TO service_role;


--
-- Name: SCHEMA financeiro; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA financeiro TO authenticated;
GRANT USAGE ON SCHEMA financeiro TO service_role;


--
-- Name: SCHEMA formularios; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA formularios TO authenticated;
GRANT USAGE ON SCHEMA formularios TO service_role;


--
-- Name: SCHEMA integracao; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA integracao TO service_role;


--
-- Name: SCHEMA marketing; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA marketing TO authenticated;
GRANT USAGE ON SCHEMA marketing TO service_role;


--
-- Name: SCHEMA operacoes; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA operacoes TO authenticated;
GRANT USAGE ON SCHEMA operacoes TO service_role;


--
-- Name: SCHEMA os; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA os TO authenticated;
GRANT USAGE ON SCHEMA os TO service_role;


--
-- Name: SCHEMA rh; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA rh TO authenticated;
GRANT USAGE ON SCHEMA rh TO service_role;


--
-- Name: SCHEMA sustentabilidade; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA sustentabilidade TO authenticated;
GRANT USAGE ON SCHEMA sustentabilidade TO service_role;


--
-- Name: FUNCTION concluir(p_item uuid, p_feito boolean); Type: ACL; Schema: calendario; Owner: -
--

REVOKE ALL ON FUNCTION calendario.concluir(p_item uuid, p_feito boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION calendario.concluir(p_item uuid, p_feito boolean) TO authenticated;


--
-- Name: FUNCTION meu_cargo(); Type: ACL; Schema: calendario; Owner: -
--

REVOKE ALL ON FUNCTION calendario.meu_cargo() FROM PUBLIC;
GRANT ALL ON FUNCTION calendario.meu_cargo() TO authenticated;
GRANT ALL ON FUNCTION calendario.meu_cargo() TO service_role;


--
-- Name: FUNCTION desfazer_importacao(p_id uuid); Type: ACL; Schema: comercial; Owner: -
--

REVOKE ALL ON FUNCTION comercial.desfazer_importacao(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION comercial.desfazer_importacao(p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION comercial.desfazer_importacao(p_id uuid) TO service_role;


--
-- Name: FUNCTION gravar_ficha_pelo_link(p_token text, p_tipo text, p_luc text, p_nome text, p_documento text, p_respostas jsonb, p_assinatura text, p_enviar boolean); Type: ACL; Schema: comercial; Owner: -
--

REVOKE ALL ON FUNCTION comercial.gravar_ficha_pelo_link(p_token text, p_tipo text, p_luc text, p_nome text, p_documento text, p_respostas jsonb, p_assinatura text, p_enviar boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION comercial.gravar_ficha_pelo_link(p_token text, p_tipo text, p_luc text, p_nome text, p_documento text, p_respostas jsonb, p_assinatura text, p_enviar boolean) TO service_role;


--
-- Name: FUNCTION pode_importar(p_tipo text); Type: ACL; Schema: comercial; Owner: -
--

REVOKE ALL ON FUNCTION comercial.pode_importar(p_tipo text) FROM PUBLIC;
GRANT ALL ON FUNCTION comercial.pode_importar(p_tipo text) TO authenticated;
GRANT ALL ON FUNCTION comercial.pode_importar(p_tipo text) TO service_role;


--
-- Name: FUNCTION remover_exemplos(); Type: ACL; Schema: comercial; Owner: -
--

REVOKE ALL ON FUNCTION comercial.remover_exemplos() FROM PUBLIC;
GRANT ALL ON FUNCTION comercial.remover_exemplos() TO authenticated;
GRANT ALL ON FUNCTION comercial.remover_exemplos() TO service_role;


--
-- Name: FUNCTION auditar(); Type: ACL; Schema: core; Owner: -
--

GRANT ALL ON FUNCTION core.auditar() TO authenticated;
GRANT ALL ON FUNCTION core.auditar() TO service_role;


--
-- Name: FUNCTION criar_usuario(); Type: ACL; Schema: core; Owner: -
--

GRANT ALL ON FUNCTION core.criar_usuario() TO authenticated;
GRANT ALL ON FUNCTION core.criar_usuario() TO service_role;


--
-- Name: FUNCTION estado_integracoes(); Type: ACL; Schema: core; Owner: -
--

REVOKE ALL ON FUNCTION core.estado_integracoes() FROM PUBLIC;
GRANT ALL ON FUNCTION core.estado_integracoes() TO authenticated;
GRANT ALL ON FUNCTION core.estado_integracoes() TO service_role;


--
-- Name: FUNCTION garantir_um_administrador(); Type: ACL; Schema: core; Owner: -
--

REVOKE ALL ON FUNCTION core.garantir_um_administrador() FROM PUBLIC;


--
-- Name: FUNCTION historico(p_busca text, p_tabelas text[], p_modulo text, p_tipo text, p_usuario uuid, p_de date, p_ate date, p_limite integer, p_deslocamento integer); Type: ACL; Schema: core; Owner: -
--

REVOKE ALL ON FUNCTION core.historico(p_busca text, p_tabelas text[], p_modulo text, p_tipo text, p_usuario uuid, p_de date, p_ate date, p_limite integer, p_deslocamento integer) FROM PUBLIC;
GRANT ALL ON FUNCTION core.historico(p_busca text, p_tabelas text[], p_modulo text, p_tipo text, p_usuario uuid, p_de date, p_ate date, p_limite integer, p_deslocamento integer) TO authenticated;
GRANT ALL ON FUNCTION core.historico(p_busca text, p_tabelas text[], p_modulo text, p_tipo text, p_usuario uuid, p_de date, p_ate date, p_limite integer, p_deslocamento integer) TO service_role;


--
-- Name: FUNCTION historico_autores(); Type: ACL; Schema: core; Owner: -
--

REVOKE ALL ON FUNCTION core.historico_autores() FROM PUBLIC;
GRANT ALL ON FUNCTION core.historico_autores() TO authenticated;
GRANT ALL ON FUNCTION core.historico_autores() TO service_role;


--
-- Name: FUNCTION historico_integracoes(p_limite integer); Type: ACL; Schema: core; Owner: -
--

REVOKE ALL ON FUNCTION core.historico_integracoes(p_limite integer) FROM PUBLIC;
GRANT ALL ON FUNCTION core.historico_integracoes(p_limite integer) TO authenticated;
GRANT ALL ON FUNCTION core.historico_integracoes(p_limite integer) TO service_role;


--
-- Name: FUNCTION integracoes_configuradas(); Type: ACL; Schema: core; Owner: -
--

REVOKE ALL ON FUNCTION core.integracoes_configuradas() FROM PUBLIC;
GRANT ALL ON FUNCTION core.integracoes_configuradas() TO authenticated;
GRANT ALL ON FUNCTION core.integracoes_configuradas() TO service_role;


--
-- Name: FUNCTION minhas_permissoes(); Type: ACL; Schema: core; Owner: -
--

REVOKE ALL ON FUNCTION core.minhas_permissoes() FROM PUBLIC;
GRANT ALL ON FUNCTION core.minhas_permissoes() TO authenticated;
GRANT ALL ON FUNCTION core.minhas_permissoes() TO service_role;


--
-- Name: FUNCTION modulo_da_auditoria(p_tabela text, p_linha jsonb); Type: ACL; Schema: core; Owner: -
--

GRANT ALL ON FUNCTION core.modulo_da_auditoria(p_tabela text, p_linha jsonb) TO authenticated;
GRANT ALL ON FUNCTION core.modulo_da_auditoria(p_tabela text, p_linha jsonb) TO service_role;


--
-- Name: FUNCTION pode(p text); Type: ACL; Schema: core; Owner: -
--

GRANT ALL ON FUNCTION core.pode(p text) TO authenticated;
GRANT ALL ON FUNCTION core.pode(p text) TO service_role;


--
-- Name: FUNCTION pode_importar(t core.tipo_importacao); Type: ACL; Schema: core; Owner: -
--

GRANT ALL ON FUNCTION core.pode_importar(t core.tipo_importacao) TO authenticated;
GRANT ALL ON FUNCTION core.pode_importar(t core.tipo_importacao) TO service_role;


--
-- Name: FUNCTION pode_integracao(p_sistema text); Type: ACL; Schema: core; Owner: -
--

REVOKE ALL ON FUNCTION core.pode_integracao(p_sistema text) FROM PUBLIC;
GRANT ALL ON FUNCTION core.pode_integracao(p_sistema text) TO authenticated;
GRANT ALL ON FUNCTION core.pode_integracao(p_sistema text) TO service_role;


--
-- Name: FUNCTION pode_modulo(modulo text); Type: ACL; Schema: core; Owner: -
--

GRANT ALL ON FUNCTION core.pode_modulo(modulo text) TO authenticated;
GRANT ALL ON FUNCTION core.pode_modulo(modulo text) TO service_role;


--
-- Name: FUNCTION registrar_teste_integracao(p_sistema text, p_ok boolean, p_mensagem text); Type: ACL; Schema: core; Owner: -
--

REVOKE ALL ON FUNCTION core.registrar_teste_integracao(p_sistema text, p_ok boolean, p_mensagem text) FROM PUBLIC;
GRANT ALL ON FUNCTION core.registrar_teste_integracao(p_sistema text, p_ok boolean, p_mensagem text) TO authenticated;
GRANT ALL ON FUNCTION core.registrar_teste_integracao(p_sistema text, p_ok boolean, p_mensagem text) TO service_role;


--
-- Name: FUNCTION remover_integracao(p_sistema text); Type: ACL; Schema: core; Owner: -
--

REVOKE ALL ON FUNCTION core.remover_integracao(p_sistema text) FROM PUBLIC;
GRANT ALL ON FUNCTION core.remover_integracao(p_sistema text) TO authenticated;
GRANT ALL ON FUNCTION core.remover_integracao(p_sistema text) TO service_role;


--
-- Name: FUNCTION salvar_integracao(p_sistema text, p_parametros jsonb, p_segredo_cifrado text, p_ativa boolean); Type: ACL; Schema: core; Owner: -
--

REVOKE ALL ON FUNCTION core.salvar_integracao(p_sistema text, p_parametros jsonb, p_segredo_cifrado text, p_ativa boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION core.salvar_integracao(p_sistema text, p_parametros jsonb, p_segredo_cifrado text, p_ativa boolean) TO authenticated;
GRANT ALL ON FUNCTION core.salvar_integracao(p_sistema text, p_parametros jsonb, p_segredo_cifrado text, p_ativa boolean) TO service_role;


--
-- Name: FUNCTION saude_integracoes(); Type: ACL; Schema: core; Owner: -
--

REVOKE ALL ON FUNCTION core.saude_integracoes() FROM PUBLIC;
GRANT ALL ON FUNCTION core.saude_integracoes() TO authenticated;
GRANT ALL ON FUNCTION core.saude_integracoes() TO service_role;


--
-- Name: FUNCTION sem_acento(t text); Type: ACL; Schema: core; Owner: -
--

GRANT ALL ON FUNCTION core.sem_acento(t text) TO authenticated;
GRANT ALL ON FUNCTION core.sem_acento(t text) TO service_role;


--
-- Name: FUNCTION set_atualizado_em(); Type: ACL; Schema: core; Owner: -
--

GRANT ALL ON FUNCTION core.set_atualizado_em() TO authenticated;
GRANT ALL ON FUNCTION core.set_atualizado_em() TO service_role;


--
-- Name: FUNCTION gravar_estacionamento(p_estacionamento_id integer, p_dias jsonb, p_sync_run_id uuid); Type: ACL; Schema: financeiro; Owner: -
--

REVOKE ALL ON FUNCTION financeiro.gravar_estacionamento(p_estacionamento_id integer, p_dias jsonb, p_sync_run_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION financeiro.gravar_estacionamento(p_estacionamento_id integer, p_dias jsonb, p_sync_run_id uuid) TO service_role;


--
-- Name: FUNCTION responder(p_token text, p_respostas jsonb, p_perguntas jsonb); Type: ACL; Schema: formularios; Owner: -
--

REVOKE ALL ON FUNCTION formularios.responder(p_token text, p_respostas jsonb, p_perguntas jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION formularios.responder(p_token text, p_respostas jsonb, p_perguntas jsonb) TO service_role;


--
-- Name: FUNCTION desfazer_versao(p_versao bigint); Type: ACL; Schema: marketing; Owner: -
--

GRANT ALL ON FUNCTION marketing.desfazer_versao(p_versao bigint) TO authenticated;


--
-- Name: FUNCTION acessa(); Type: ACL; Schema: operacoes; Owner: -
--

REVOKE ALL ON FUNCTION operacoes.acessa() FROM PUBLIC;
GRANT ALL ON FUNCTION operacoes.acessa() TO authenticated;
GRANT ALL ON FUNCTION operacoes.acessa() TO service_role;


--
-- Name: FUNCTION caixa_sem_termo_externo(); Type: ACL; Schema: operacoes; Owner: -
--

REVOKE ALL ON FUNCTION operacoes.caixa_sem_termo_externo() FROM PUBLIC;


--
-- Name: FUNCTION confirmar_importacao(p_id uuid, p_motivo text); Type: ACL; Schema: operacoes; Owner: -
--

REVOKE ALL ON FUNCTION operacoes.confirmar_importacao(p_id uuid, p_motivo text) FROM PUBLIC;
GRANT ALL ON FUNCTION operacoes.confirmar_importacao(p_id uuid, p_motivo text) TO authenticated;


--
-- Name: FUNCTION desfazer_importacao(p_id uuid); Type: ACL; Schema: operacoes; Owner: -
--

REVOKE ALL ON FUNCTION operacoes.desfazer_importacao(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION operacoes.desfazer_importacao(p_id uuid) TO authenticated;


--
-- Name: FUNCTION energia_fatura_vigente(); Type: ACL; Schema: operacoes; Owner: -
--

REVOKE ALL ON FUNCTION operacoes.energia_fatura_vigente() FROM PUBLIC;


--
-- Name: FUNCTION energia_importacao_status(); Type: ACL; Schema: operacoes; Owner: -
--

REVOKE ALL ON FUNCTION operacoes.energia_importacao_status() FROM PUBLIC;


--
-- Name: FUNCTION enet_contratos(); Type: ACL; Schema: operacoes; Owner: -
--

REVOKE ALL ON FUNCTION operacoes.enet_contratos() FROM PUBLIC;
GRANT ALL ON FUNCTION operacoes.enet_contratos() TO authenticated;


--
-- Name: FUNCTION gravar_fatura_energisa(p_importacao uuid, p_arquivo text, p_sha256 text, p_fatura jsonb, p_itens jsonb); Type: ACL; Schema: operacoes; Owner: -
--

REVOKE ALL ON FUNCTION operacoes.gravar_fatura_energisa(p_importacao uuid, p_arquivo text, p_sha256 text, p_fatura jsonb, p_itens jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION operacoes.gravar_fatura_energisa(p_importacao uuid, p_arquivo text, p_sha256 text, p_fatura jsonb, p_itens jsonb) TO authenticated;


--
-- Name: FUNCTION liberar_caixa(p_caixa uuid, p_saida date, p_status text); Type: ACL; Schema: operacoes; Owner: -
--

REVOKE ALL ON FUNCTION operacoes.liberar_caixa(p_caixa uuid, p_saida date, p_status text) FROM PUBLIC;
GRANT ALL ON FUNCTION operacoes.liberar_caixa(p_caixa uuid, p_saida date, p_status text) TO authenticated;
GRANT ALL ON FUNCTION operacoes.liberar_caixa(p_caixa uuid, p_saida date, p_status text) TO service_role;


--
-- Name: FUNCTION limpeza_aberto(p_ref date); Type: ACL; Schema: operacoes; Owner: -
--

REVOKE ALL ON FUNCTION operacoes.limpeza_aberto(p_ref date) FROM PUBLIC;
GRANT ALL ON FUNCTION operacoes.limpeza_aberto(p_ref date) TO authenticated;
GRANT ALL ON FUNCTION operacoes.limpeza_aberto(p_ref date) TO service_role;


--
-- Name: FUNCTION limpeza_enviar(p_ref date); Type: ACL; Schema: operacoes; Owner: -
--

REVOKE ALL ON FUNCTION operacoes.limpeza_enviar(p_ref date) FROM PUBLIC;
GRANT ALL ON FUNCTION operacoes.limpeza_enviar(p_ref date) TO authenticated;


--
-- Name: FUNCTION limpeza_fechar(p_ref date); Type: ACL; Schema: operacoes; Owner: -
--

REVOKE ALL ON FUNCTION operacoes.limpeza_fechar(p_ref date) FROM PUBLIC;
GRANT ALL ON FUNCTION operacoes.limpeza_fechar(p_ref date) TO authenticated;


--
-- Name: FUNCTION limpeza_gravar_previa(p_importacao uuid, p_meses jsonb); Type: ACL; Schema: operacoes; Owner: -
--

REVOKE ALL ON FUNCTION operacoes.limpeza_gravar_previa(p_importacao uuid, p_meses jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION operacoes.limpeza_gravar_previa(p_importacao uuid, p_meses jsonb) TO authenticated;


--
-- Name: FUNCTION limpeza_reabrir(p_ref date, p_motivo text); Type: ACL; Schema: operacoes; Owner: -
--

REVOKE ALL ON FUNCTION operacoes.limpeza_reabrir(p_ref date, p_motivo text) FROM PUBLIC;
GRANT ALL ON FUNCTION operacoes.limpeza_reabrir(p_ref date, p_motivo text) TO authenticated;


--
-- Name: FUNCTION limpeza_salvar(p_ref date, p_dados jsonb); Type: ACL; Schema: operacoes; Owner: -
--

REVOKE ALL ON FUNCTION operacoes.limpeza_salvar(p_ref date, p_dados jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION operacoes.limpeza_salvar(p_ref date, p_dados jsonb) TO authenticated;


--
-- Name: FUNCTION pode_importar(p_tipo text); Type: ACL; Schema: operacoes; Owner: -
--

REVOKE ALL ON FUNCTION operacoes.pode_importar(p_tipo text) FROM PUBLIC;
GRANT ALL ON FUNCTION operacoes.pode_importar(p_tipo text) TO authenticated;
GRANT ALL ON FUNCTION operacoes.pode_importar(p_tipo text) TO service_role;


--
-- Name: FUNCTION proxima_versao_termo(p_caixa uuid); Type: ACL; Schema: operacoes; Owner: -
--

REVOKE ALL ON FUNCTION operacoes.proxima_versao_termo(p_caixa uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION operacoes.proxima_versao_termo(p_caixa uuid) TO authenticated;
GRANT ALL ON FUNCTION operacoes.proxima_versao_termo(p_caixa uuid) TO service_role;


--
-- Name: FUNCTION registrar_termo(p_caixa uuid, p_versao integer, p_locatario text, p_documento text, p_qualificacao text, p_bloco text, p_pavimento text, p_sala text, p_projeto text, p_amperes integer, p_ligacao text, p_armario text, p_rota text, p_observacao_tecnica text, p_data_emissao date, p_pdf text, p_docx text); Type: ACL; Schema: operacoes; Owner: -
--

REVOKE ALL ON FUNCTION operacoes.registrar_termo(p_caixa uuid, p_versao integer, p_locatario text, p_documento text, p_qualificacao text, p_bloco text, p_pavimento text, p_sala text, p_projeto text, p_amperes integer, p_ligacao text, p_armario text, p_rota text, p_observacao_tecnica text, p_data_emissao date, p_pdf text, p_docx text) FROM PUBLIC;
GRANT ALL ON FUNCTION operacoes.registrar_termo(p_caixa uuid, p_versao integer, p_locatario text, p_documento text, p_qualificacao text, p_bloco text, p_pavimento text, p_sala text, p_projeto text, p_amperes integer, p_ligacao text, p_armario text, p_rota text, p_observacao_tecnica text, p_data_emissao date, p_pdf text, p_docx text) TO authenticated;


--
-- Name: FUNCTION remover_exemplos(); Type: ACL; Schema: operacoes; Owner: -
--

REVOKE ALL ON FUNCTION operacoes.remover_exemplos() FROM PUBLIC;
GRANT ALL ON FUNCTION operacoes.remover_exemplos() TO authenticated;


--
-- Name: FUNCTION resumo_quadros(); Type: ACL; Schema: operacoes; Owner: -
--

REVOKE ALL ON FUNCTION operacoes.resumo_quadros() FROM PUBLIC;
GRANT ALL ON FUNCTION operacoes.resumo_quadros() TO authenticated;


--
-- Name: FUNCTION trocar_locatario(p_caixa uuid, p_nome text, p_documento text, p_desde date, p_contrato text, p_origem text); Type: ACL; Schema: operacoes; Owner: -
--

REVOKE ALL ON FUNCTION operacoes.trocar_locatario(p_caixa uuid, p_nome text, p_documento text, p_desde date, p_contrato text, p_origem text) FROM PUBLIC;
GRANT ALL ON FUNCTION operacoes.trocar_locatario(p_caixa uuid, p_nome text, p_documento text, p_desde date, p_contrato text, p_origem text) TO authenticated;
GRANT ALL ON FUNCTION operacoes.trocar_locatario(p_caixa uuid, p_nome text, p_documento text, p_desde date, p_contrato text, p_origem text) TO service_role;


--
-- Name: FUNCTION ve_importacao(p_tipo text); Type: ACL; Schema: operacoes; Owner: -
--

REVOKE ALL ON FUNCTION operacoes.ve_importacao(p_tipo text) FROM PUBLIC;
GRANT ALL ON FUNCTION operacoes.ve_importacao(p_tipo text) TO authenticated;
GRANT ALL ON FUNCTION operacoes.ve_importacao(p_tipo text) TO service_role;


--
-- Name: FUNCTION ajustar_numeracao(); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.ajustar_numeracao() FROM PUBLIC;
GRANT ALL ON FUNCTION os.ajustar_numeracao() TO service_role;


--
-- Name: FUNCTION ativos_para_vincular(); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.ativos_para_vincular() FROM PUBLIC;
GRANT ALL ON FUNCTION os.ativos_para_vincular() TO authenticated;
GRANT ALL ON FUNCTION os.ativos_para_vincular() TO service_role;


--
-- Name: FUNCTION carga_das_ordens(p_setor uuid, p_agora timestamp with time zone, p_status os.status_chamado[], p_categoria uuid, p_responsavel uuid, p_prioridade os.prioridade, p_etiqueta text, p_criado_desde timestamp with time zone, p_criado_ate timestamp with time zone, p_aberto_por uuid); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.carga_das_ordens(p_setor uuid, p_agora timestamp with time zone, p_status os.status_chamado[], p_categoria uuid, p_responsavel uuid, p_prioridade os.prioridade, p_etiqueta text, p_criado_desde timestamp with time zone, p_criado_ate timestamp with time zone, p_aberto_por uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION os.carga_das_ordens(p_setor uuid, p_agora timestamp with time zone, p_status os.status_chamado[], p_categoria uuid, p_responsavel uuid, p_prioridade os.prioridade, p_etiqueta text, p_criado_desde timestamp with time zone, p_criado_ate timestamp with time zone, p_aberto_por uuid) TO authenticated;
GRANT ALL ON FUNCTION os.carga_das_ordens(p_setor uuid, p_agora timestamp with time zone, p_status os.status_chamado[], p_categoria uuid, p_responsavel uuid, p_prioridade os.prioridade, p_etiqueta text, p_criado_desde timestamp with time zone, p_criado_ate timestamp with time zone, p_aberto_por uuid) TO service_role;


--
-- Name: FUNCTION carga_do_setor(p_setor uuid, p_agora timestamp with time zone, p_status os.status_chamado[], p_tipos os.tipo_chamado[], p_categoria uuid, p_responsavel uuid, p_prioridade os.prioridade, p_etiqueta text, p_criado_desde timestamp with time zone, p_criado_ate timestamp with time zone, p_aberto_por uuid); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.carga_do_setor(p_setor uuid, p_agora timestamp with time zone, p_status os.status_chamado[], p_tipos os.tipo_chamado[], p_categoria uuid, p_responsavel uuid, p_prioridade os.prioridade, p_etiqueta text, p_criado_desde timestamp with time zone, p_criado_ate timestamp with time zone, p_aberto_por uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION os.carga_do_setor(p_setor uuid, p_agora timestamp with time zone, p_status os.status_chamado[], p_tipos os.tipo_chamado[], p_categoria uuid, p_responsavel uuid, p_prioridade os.prioridade, p_etiqueta text, p_criado_desde timestamp with time zone, p_criado_ate timestamp with time zone, p_aberto_por uuid) TO authenticated;
GRANT ALL ON FUNCTION os.carga_do_setor(p_setor uuid, p_agora timestamp with time zone, p_status os.status_chamado[], p_tipos os.tipo_chamado[], p_categoria uuid, p_responsavel uuid, p_prioridade os.prioridade, p_etiqueta text, p_criado_desde timestamp with time zone, p_criado_ate timestamp with time zone, p_aberto_por uuid) TO service_role;


--
-- Name: FUNCTION ciclo_do_chamado(); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.ciclo_do_chamado() FROM PUBLIC;


--
-- Name: FUNCTION ciclo_do_destino(); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.ciclo_do_destino() FROM PUBLIC;


--
-- Name: FUNCTION desfazer_saida_ativo(p_saida uuid, p_motivo text); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.desfazer_saida_ativo(p_saida uuid, p_motivo text) FROM PUBLIC;
GRANT ALL ON FUNCTION os.desfazer_saida_ativo(p_saida uuid, p_motivo text) TO authenticated;


--
-- Name: FUNCTION edita_chamado(p_id uuid, p_setor uuid, p_aberto_por uuid, p_responsavel uuid); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.edita_chamado(p_id uuid, p_setor uuid, p_aberto_por uuid, p_responsavel uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION os.edita_chamado(p_id uuid, p_setor uuid, p_aberto_por uuid, p_responsavel uuid) TO authenticated;
GRANT ALL ON FUNCTION os.edita_chamado(p_id uuid, p_setor uuid, p_aberto_por uuid, p_responsavel uuid) TO service_role;


--
-- Name: FUNCTION envolvido(p_chamado uuid); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.envolvido(p_chamado uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION os.envolvido(p_chamado uuid) TO authenticated;
GRANT ALL ON FUNCTION os.envolvido(p_chamado uuid) TO service_role;


--
-- Name: FUNCTION envolvido_na_ordem(p_ordem uuid); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.envolvido_na_ordem(p_ordem uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION os.envolvido_na_ordem(p_ordem uuid) TO authenticated;
GRANT ALL ON FUNCTION os.envolvido_na_ordem(p_ordem uuid) TO service_role;


--
-- Name: FUNCTION gerencia(p_setor uuid); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.gerencia(p_setor uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION os.gerencia(p_setor uuid) TO authenticated;
GRANT ALL ON FUNCTION os.gerencia(p_setor uuid) TO service_role;


--
-- Name: FUNCTION gravar_calculo_os(p_ordem uuid, p_resultado jsonb); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.gravar_calculo_os(p_ordem uuid, p_resultado jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION os.gravar_calculo_os(p_ordem uuid, p_resultado jsonb) TO service_role;


--
-- Name: FUNCTION leitores_dos_avisos(p_chamados uuid[]); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.leitores_dos_avisos(p_chamados uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION os.leitores_dos_avisos(p_chamados uuid[]) TO authenticated;
GRANT ALL ON FUNCTION os.leitores_dos_avisos(p_chamados uuid[]) TO service_role;


--
-- Name: FUNCTION liberar_ativo_da_os(); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.liberar_ativo_da_os() FROM PUBLIC;


--
-- Name: SEQUENCE chamado_numero_seq; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE os.chamado_numero_seq TO authenticated;
GRANT SELECT,USAGE ON SEQUENCE os.chamado_numero_seq TO service_role;


--
-- Name: TABLE chamados; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.chamados TO authenticated;
GRANT ALL ON TABLE os.chamados TO service_role;


--
-- Name: FUNCTION lido_por_mim(c os.chamados); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.lido_por_mim(c os.chamados) FROM PUBLIC;
GRANT ALL ON FUNCTION os.lido_por_mim(c os.chamados) TO authenticated;
GRANT ALL ON FUNCTION os.lido_por_mim(c os.chamados) TO service_role;


--
-- Name: FUNCTION manter_baixa_da_saida(); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.manter_baixa_da_saida() FROM PUBLIC;


--
-- Name: FUNCTION meus_chamados_envolvidos(); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.meus_chamados_envolvidos() FROM PUBLIC;
GRANT ALL ON FUNCTION os.meus_chamados_envolvidos() TO authenticated;
GRANT ALL ON FUNCTION os.meus_chamados_envolvidos() TO service_role;


--
-- Name: FUNCTION meus_setores(); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.meus_setores() FROM PUBLIC;
GRANT ALL ON FUNCTION os.meus_setores() TO authenticated;
GRANT ALL ON FUNCTION os.meus_setores() TO service_role;


--
-- Name: FUNCTION minhas_ordens_envolvidas(); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.minhas_ordens_envolvidas() FROM PUBLIC;
GRANT ALL ON FUNCTION os.minhas_ordens_envolvidas() TO authenticated;
GRANT ALL ON FUNCTION os.minhas_ordens_envolvidas() TO service_role;


--
-- Name: FUNCTION pausar_planos_na_saida(); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.pausar_planos_na_saida() FROM PUBLIC;


--
-- Name: FUNCTION pessoas(); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.pessoas() FROM PUBLIC;
GRANT ALL ON FUNCTION os.pessoas() TO authenticated;
GRANT ALL ON FUNCTION os.pessoas() TO service_role;


--
-- Name: FUNCTION pode_editar_chamado(p_chamado uuid); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.pode_editar_chamado(p_chamado uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION os.pode_editar_chamado(p_chamado uuid) TO authenticated;
GRANT ALL ON FUNCTION os.pode_editar_chamado(p_chamado uuid) TO service_role;


--
-- Name: FUNCTION pode_editar_ordem(p_ordem uuid); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.pode_editar_ordem(p_ordem uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION os.pode_editar_ordem(p_ordem uuid) TO authenticated;
GRANT ALL ON FUNCTION os.pode_editar_ordem(p_ordem uuid) TO service_role;


--
-- Name: FUNCTION pode_ver_chamado(p_chamado uuid); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.pode_ver_chamado(p_chamado uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION os.pode_ver_chamado(p_chamado uuid) TO authenticated;
GRANT ALL ON FUNCTION os.pode_ver_chamado(p_chamado uuid) TO service_role;


--
-- Name: FUNCTION pode_ver_ordem(p_ordem uuid); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.pode_ver_ordem(p_ordem uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION os.pode_ver_ordem(p_ordem uuid) TO authenticated;
GRANT ALL ON FUNCTION os.pode_ver_ordem(p_ordem uuid) TO service_role;


--
-- Name: FUNCTION proximo_codigo_vistoria(); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.proximo_codigo_vistoria() FROM PUBLIC;
GRANT ALL ON FUNCTION os.proximo_codigo_vistoria() TO authenticated;
GRANT ALL ON FUNCTION os.proximo_codigo_vistoria() TO service_role;


--
-- Name: FUNCTION recusar_ativo_baixado(); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.recusar_ativo_baixado() FROM PUBLIC;


--
-- Name: FUNCTION registrar_saida_ativo(p_ativo uuid, p_tipo text, p_data date, p_quantidade text, p_valor numeric, p_forma text, p_recebido_por text, p_destinatario text, p_documento text, p_responsavel uuid, p_motivo text, p_nf boolean, p_nf_numero text, p_observacoes text, p_anexos text[]); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.registrar_saida_ativo(p_ativo uuid, p_tipo text, p_data date, p_quantidade text, p_valor numeric, p_forma text, p_recebido_por text, p_destinatario text, p_documento text, p_responsavel uuid, p_motivo text, p_nf boolean, p_nf_numero text, p_observacoes text, p_anexos text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION os.registrar_saida_ativo(p_ativo uuid, p_tipo text, p_data date, p_quantidade text, p_valor numeric, p_forma text, p_recebido_por text, p_destinatario text, p_documento text, p_responsavel uuid, p_motivo text, p_nf boolean, p_nf_numero text, p_observacoes text, p_anexos text[]) TO authenticated;


--
-- Name: FUNCTION registrar_saida_sobra(p_nome text, p_categoria uuid, p_bloco text, p_area text, p_tipo text, p_data date, p_quantidade text, p_valor numeric, p_forma text, p_recebido_por text, p_destinatario text, p_documento text, p_responsavel uuid, p_motivo text, p_nf boolean, p_nf_numero text, p_observacoes text, p_anexos text[]); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.registrar_saida_sobra(p_nome text, p_categoria uuid, p_bloco text, p_area text, p_tipo text, p_data date, p_quantidade text, p_valor numeric, p_forma text, p_recebido_por text, p_destinatario text, p_documento text, p_responsavel uuid, p_motivo text, p_nf boolean, p_nf_numero text, p_observacoes text, p_anexos text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION os.registrar_saida_sobra(p_nome text, p_categoria uuid, p_bloco text, p_area text, p_tipo text, p_data date, p_quantidade text, p_valor numeric, p_forma text, p_recebido_por text, p_destinatario text, p_documento text, p_responsavel uuid, p_motivo text, p_nf boolean, p_nf_numero text, p_observacoes text, p_anexos text[]) TO authenticated;


--
-- Name: FUNCTION registrar_situacao_ativo(); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.registrar_situacao_ativo() FROM PUBLIC;


--
-- Name: FUNCTION remarcar_bloqueados(); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.remarcar_bloqueados() FROM PUBLIC;


--
-- Name: FUNCTION reservar_horario(p_agenda uuid, p_inicio timestamp with time zone, p_fim timestamp with time zone, p_loja uuid, p_chamado uuid, p_observacao text); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.reservar_horario(p_agenda uuid, p_inicio timestamp with time zone, p_fim timestamp with time zone, p_loja uuid, p_chamado uuid, p_observacao text) FROM PUBLIC;
GRANT ALL ON FUNCTION os.reservar_horario(p_agenda uuid, p_inicio timestamp with time zone, p_fim timestamp with time zone, p_loja uuid, p_chamado uuid, p_observacao text) TO authenticated;
GRANT ALL ON FUNCTION os.reservar_horario(p_agenda uuid, p_inicio timestamp with time zone, p_fim timestamp with time zone, p_loja uuid, p_chamado uuid, p_observacao text) TO service_role;


--
-- Name: FUNCTION resumo_ativos(p_desde date); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.resumo_ativos(p_desde date) FROM PUBLIC;
GRANT ALL ON FUNCTION os.resumo_ativos(p_desde date) TO authenticated;
GRANT ALL ON FUNCTION os.resumo_ativos(p_desde date) TO service_role;


--
-- Name: FUNCTION sincronizar_destinos(); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.sincronizar_destinos() FROM PUBLIC;


--
-- Name: FUNCTION todos_leram(c os.chamados); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.todos_leram(c os.chamados) FROM PUBLIC;
GRANT ALL ON FUNCTION os.todos_leram(c os.chamados) TO authenticated;
GRANT ALL ON FUNCTION os.todos_leram(c os.chamados) TO service_role;


--
-- Name: FUNCTION validar_categoria(); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.validar_categoria() FROM PUBLIC;


--
-- Name: FUNCTION validar_chamado(); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.validar_chamado() FROM PUBLIC;


--
-- Name: FUNCTION ve_chamado(p_id uuid, p_setor uuid, p_aberto_por uuid, p_responsavel uuid); Type: ACL; Schema: os; Owner: -
--

REVOKE ALL ON FUNCTION os.ve_chamado(p_id uuid, p_setor uuid, p_aberto_por uuid, p_responsavel uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION os.ve_chamado(p_id uuid, p_setor uuid, p_aberto_por uuid, p_responsavel uuid) TO authenticated;
GRANT ALL ON FUNCTION os.ve_chamado(p_id uuid, p_setor uuid, p_aberto_por uuid, p_responsavel uuid) TO service_role;


--
-- Name: FUNCTION ano_finalizado(p_ano integer); Type: ACL; Schema: rh; Owner: -
--

GRANT ALL ON FUNCTION rh.ano_finalizado(p_ano integer) TO authenticated;
GRANT ALL ON FUNCTION rh.ano_finalizado(p_ano integer) TO service_role;


--
-- Name: FUNCTION banco_horas_em_reais(p_competencia date); Type: ACL; Schema: rh; Owner: -
--

REVOKE ALL ON FUNCTION rh.banco_horas_em_reais(p_competencia date) FROM PUBLIC;
GRANT ALL ON FUNCTION rh.banco_horas_em_reais(p_competencia date) TO authenticated;
GRANT ALL ON FUNCTION rh.banco_horas_em_reais(p_competencia date) TO service_role;


--
-- Name: FUNCTION custo_agregado(inicio date, fim date); Type: ACL; Schema: rh; Owner: -
--

REVOKE ALL ON FUNCTION rh.custo_agregado(inicio date, fim date) FROM PUBLIC;
GRANT ALL ON FUNCTION rh.custo_agregado(inicio date, fim date) TO authenticated;
GRANT ALL ON FUNCTION rh.custo_agregado(inicio date, fim date) TO service_role;


--
-- Name: FUNCTION excluir_folha(p_folha_id uuid); Type: ACL; Schema: rh; Owner: -
--

REVOKE ALL ON FUNCTION rh.excluir_folha(p_folha_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION rh.excluir_folha(p_folha_id uuid) TO authenticated;
GRANT ALL ON FUNCTION rh.excluir_folha(p_folha_id uuid) TO service_role;


--
-- Name: TABLE banco_horas_ciclos; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT,DELETE ON TABLE rh.banco_horas_ciclos TO authenticated;
GRANT ALL ON TABLE rh.banco_horas_ciclos TO service_role;


--
-- Name: COLUMN banco_horas_ciclos.inicio; Type: ACL; Schema: rh; Owner: -
--

GRANT INSERT(inicio) ON TABLE rh.banco_horas_ciclos TO authenticated;


--
-- Name: COLUMN banco_horas_ciclos.fim; Type: ACL; Schema: rh; Owner: -
--

GRANT INSERT(fim) ON TABLE rh.banco_horas_ciclos TO authenticated;


--
-- Name: FUNCTION finalizar_ciclo_banco(p_ciclo uuid); Type: ACL; Schema: rh; Owner: -
--

REVOKE ALL ON FUNCTION rh.finalizar_ciclo_banco(p_ciclo uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION rh.finalizar_ciclo_banco(p_ciclo uuid) TO authenticated;
GRANT ALL ON FUNCTION rh.finalizar_ciclo_banco(p_ciclo uuid) TO service_role;


--
-- Name: TABLE orcamentos_anuais; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT ON TABLE rh.orcamentos_anuais TO authenticated;
GRANT ALL ON TABLE rh.orcamentos_anuais TO service_role;


--
-- Name: FUNCTION finalizar_orcamento(p_ano integer); Type: ACL; Schema: rh; Owner: -
--

REVOKE ALL ON FUNCTION rh.finalizar_orcamento(p_ano integer) FROM PUBLIC;
GRANT ALL ON FUNCTION rh.finalizar_orcamento(p_ano integer) TO authenticated;
GRANT ALL ON FUNCTION rh.finalizar_orcamento(p_ano integer) TO service_role;


--
-- Name: FUNCTION gravar_custos(p_competencia date, p_linhas jsonb); Type: ACL; Schema: rh; Owner: -
--

REVOKE ALL ON FUNCTION rh.gravar_custos(p_competencia date, p_linhas jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION rh.gravar_custos(p_competencia date, p_linhas jsonb) TO service_role;


--
-- Name: FUNCTION importar_folha(p_importacao_id uuid, p_folha jsonb, p_departamentos jsonb, p_substituir boolean); Type: ACL; Schema: rh; Owner: -
--

REVOKE ALL ON FUNCTION rh.importar_folha(p_importacao_id uuid, p_folha jsonb, p_departamentos jsonb, p_substituir boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION rh.importar_folha(p_importacao_id uuid, p_folha jsonb, p_departamentos jsonb, p_substituir boolean) TO authenticated;
GRANT ALL ON FUNCTION rh.importar_folha(p_importacao_id uuid, p_folha jsonb, p_departamentos jsonb, p_substituir boolean) TO service_role;


--
-- Name: FUNCTION importar_tabela_plano(p_importacao_id uuid, p_beneficio_id uuid, p_reajuste_pct numeric, p_faixas jsonb, p_coparticipacao jsonb); Type: ACL; Schema: rh; Owner: -
--

REVOKE ALL ON FUNCTION rh.importar_tabela_plano(p_importacao_id uuid, p_beneficio_id uuid, p_reajuste_pct numeric, p_faixas jsonb, p_coparticipacao jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION rh.importar_tabela_plano(p_importacao_id uuid, p_beneficio_id uuid, p_reajuste_pct numeric, p_faixas jsonb, p_coparticipacao jsonb) TO authenticated;
GRANT ALL ON FUNCTION rh.importar_tabela_plano(p_importacao_id uuid, p_beneficio_id uuid, p_reajuste_pct numeric, p_faixas jsonb, p_coparticipacao jsonb) TO service_role;


--
-- Name: FUNCTION pode_fechar_banco(); Type: ACL; Schema: rh; Owner: -
--

GRANT ALL ON FUNCTION rh.pode_fechar_banco() TO authenticated;
GRANT ALL ON FUNCTION rh.pode_fechar_banco() TO service_role;


--
-- Name: FUNCTION ponto_dos_dias(de date, ate date); Type: ACL; Schema: rh; Owner: -
--

REVOKE ALL ON FUNCTION rh.ponto_dos_dias(de date, ate date) FROM PUBLIC;
GRANT ALL ON FUNCTION rh.ponto_dos_dias(de date, ate date) TO authenticated;
GRANT ALL ON FUNCTION rh.ponto_dos_dias(de date, ate date) TO service_role;


--
-- Name: FUNCTION proximo_ciclo_banco(p_inicio date, p_fim date); Type: ACL; Schema: rh; Owner: -
--

GRANT ALL ON FUNCTION rh.proximo_ciclo_banco(p_inicio date, p_fim date) TO authenticated;
GRANT ALL ON FUNCTION rh.proximo_ciclo_banco(p_inicio date, p_fim date) TO service_role;


--
-- Name: FUNCTION quadro_mensal(inicio date, fim date); Type: ACL; Schema: rh; Owner: -
--

GRANT ALL ON FUNCTION rh.quadro_mensal(inicio date, fim date) TO authenticated;
GRANT ALL ON FUNCTION rh.quadro_mensal(inicio date, fim date) TO service_role;


--
-- Name: FUNCTION salvar_faixas_plano(p_tabela_id uuid, p_faixas jsonb); Type: ACL; Schema: rh; Owner: -
--

REVOKE ALL ON FUNCTION rh.salvar_faixas_plano(p_tabela_id uuid, p_faixas jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION rh.salvar_faixas_plano(p_tabela_id uuid, p_faixas jsonb) TO authenticated;
GRANT ALL ON FUNCTION rh.salvar_faixas_plano(p_tabela_id uuid, p_faixas jsonb) TO service_role;


--
-- Name: FUNCTION salvar_pessoa_folha(p_folha_id uuid, p_colaborador_id uuid, p_pessoa jsonb, p_rubricas jsonb); Type: ACL; Schema: rh; Owner: -
--

REVOKE ALL ON FUNCTION rh.salvar_pessoa_folha(p_folha_id uuid, p_colaborador_id uuid, p_pessoa jsonb, p_rubricas jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION rh.salvar_pessoa_folha(p_folha_id uuid, p_colaborador_id uuid, p_pessoa jsonb, p_rubricas jsonb) TO authenticated;
GRANT ALL ON FUNCTION rh.salvar_pessoa_folha(p_folha_id uuid, p_colaborador_id uuid, p_pessoa jsonb, p_rubricas jsonb) TO service_role;


--
-- Name: FUNCTION socios(); Type: ACL; Schema: rh; Owner: -
--

REVOKE ALL ON FUNCTION rh.socios() FROM PUBLIC;
GRANT ALL ON FUNCTION rh.socios() TO authenticated;
GRANT ALL ON FUNCTION rh.socios() TO service_role;


--
-- Name: FUNCTION acessa(); Type: ACL; Schema: sustentabilidade; Owner: -
--

REVOKE ALL ON FUNCTION sustentabilidade.acessa() FROM PUBLIC;
GRANT ALL ON FUNCTION sustentabilidade.acessa() TO authenticated;
GRANT ALL ON FUNCTION sustentabilidade.acessa() TO service_role;


--
-- Name: FUNCTION confirmar_importacao(p_id uuid); Type: ACL; Schema: sustentabilidade; Owner: -
--

REVOKE ALL ON FUNCTION sustentabilidade.confirmar_importacao(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION sustentabilidade.confirmar_importacao(p_id uuid) TO authenticated;


--
-- Name: FUNCTION contratos_marcar(); Type: ACL; Schema: sustentabilidade; Owner: -
--

REVOKE ALL ON FUNCTION sustentabilidade.contratos_marcar() FROM PUBLIC;


--
-- Name: FUNCTION desfazer_importacao(p_id uuid); Type: ACL; Schema: sustentabilidade; Owner: -
--

REVOKE ALL ON FUNCTION sustentabilidade.desfazer_importacao(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION sustentabilidade.desfazer_importacao(p_id uuid) TO authenticated;


--
-- Name: FUNCTION entrevistas_resumo(); Type: ACL; Schema: sustentabilidade; Owner: -
--

REVOKE ALL ON FUNCTION sustentabilidade.entrevistas_resumo() FROM PUBLIC;
GRANT ALL ON FUNCTION sustentabilidade.entrevistas_resumo() TO authenticated;


--
-- Name: FUNCTION itens_da_definicao(p_definicao jsonb); Type: ACL; Schema: sustentabilidade; Owner: -
--

REVOKE ALL ON FUNCTION sustentabilidade.itens_da_definicao(p_definicao jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION sustentabilidade.itens_da_definicao(p_definicao jsonb) TO authenticated;
GRANT ALL ON FUNCTION sustentabilidade.itens_da_definicao(p_definicao jsonb) TO service_role;


--
-- Name: FUNCTION lancamento_do_programa(); Type: ACL; Schema: sustentabilidade; Owner: -
--

REVOKE ALL ON FUNCTION sustentabilidade.lancamento_do_programa() FROM PUBLIC;


--
-- Name: FUNCTION liberar_substituida(p_id uuid); Type: ACL; Schema: sustentabilidade; Owner: -
--

REVOKE ALL ON FUNCTION sustentabilidade.liberar_substituida(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION sustentabilidade.liberar_substituida(p_id uuid) TO authenticated;


--
-- Name: FUNCTION link_desligado_fica(); Type: ACL; Schema: sustentabilidade; Owner: -
--

REVOKE ALL ON FUNCTION sustentabilidade.link_desligado_fica() FROM PUBLIC;


--
-- Name: FUNCTION meus_programas(); Type: ACL; Schema: sustentabilidade; Owner: -
--

REVOKE ALL ON FUNCTION sustentabilidade.meus_programas() FROM PUBLIC;
GRANT ALL ON FUNCTION sustentabilidade.meus_programas() TO authenticated;
GRANT ALL ON FUNCTION sustentabilidade.meus_programas() TO service_role;


--
-- Name: FUNCTION pode_alguma(VARIADIC p text[]); Type: ACL; Schema: sustentabilidade; Owner: -
--

REVOKE ALL ON FUNCTION sustentabilidade.pode_alguma(VARIADIC p text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION sustentabilidade.pode_alguma(VARIADIC p text[]) TO authenticated;
GRANT ALL ON FUNCTION sustentabilidade.pode_alguma(VARIADIC p text[]) TO service_role;


--
-- Name: FUNCTION programa_permissao(); Type: ACL; Schema: sustentabilidade; Owner: -
--

REVOKE ALL ON FUNCTION sustentabilidade.programa_permissao() FROM PUBLIC;


--
-- Name: FUNCTION publicar_formulario(p_id uuid, p_resumo text); Type: ACL; Schema: sustentabilidade; Owner: -
--

REVOKE ALL ON FUNCTION sustentabilidade.publicar_formulario(p_id uuid, p_resumo text) FROM PUBLIC;
GRANT ALL ON FUNCTION sustentabilidade.publicar_formulario(p_id uuid, p_resumo text) TO authenticated;


--
-- Name: FUNCTION remover_exemplos(); Type: ACL; Schema: sustentabilidade; Owner: -
--

REVOKE ALL ON FUNCTION sustentabilidade.remover_exemplos() FROM PUBLIC;
GRANT ALL ON FUNCTION sustentabilidade.remover_exemplos() TO authenticated;


--
-- Name: FUNCTION uso_do_formulario(p_id uuid); Type: ACL; Schema: sustentabilidade; Owner: -
--

REVOKE ALL ON FUNCTION sustentabilidade.uso_do_formulario(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION sustentabilidade.uso_do_formulario(p_id uuid) TO authenticated;


--
-- Name: FUNCTION versao_imutavel(); Type: ACL; Schema: sustentabilidade; Owner: -
--

REVOKE ALL ON FUNCTION sustentabilidade.versao_imutavel() FROM PUBLIC;


--
-- Name: TABLE itens; Type: ACL; Schema: calendario; Owner: -
--

GRANT SELECT,DELETE ON TABLE calendario.itens TO authenticated;
GRANT ALL ON TABLE calendario.itens TO service_role;


--
-- Name: COLUMN itens.tipo_id; Type: ACL; Schema: calendario; Owner: -
--

GRANT INSERT(tipo_id),UPDATE(tipo_id) ON TABLE calendario.itens TO authenticated;


--
-- Name: COLUMN itens.titulo; Type: ACL; Schema: calendario; Owner: -
--

GRANT INSERT(titulo),UPDATE(titulo) ON TABLE calendario.itens TO authenticated;


--
-- Name: COLUMN itens.descricao; Type: ACL; Schema: calendario; Owner: -
--

GRANT INSERT(descricao),UPDATE(descricao) ON TABLE calendario.itens TO authenticated;


--
-- Name: COLUMN itens.local; Type: ACL; Schema: calendario; Owner: -
--

GRANT INSERT(local),UPDATE(local) ON TABLE calendario.itens TO authenticated;


--
-- Name: COLUMN itens.inicio; Type: ACL; Schema: calendario; Owner: -
--

GRANT INSERT(inicio),UPDATE(inicio) ON TABLE calendario.itens TO authenticated;


--
-- Name: COLUMN itens.fim; Type: ACL; Schema: calendario; Owner: -
--

GRANT INSERT(fim),UPDATE(fim) ON TABLE calendario.itens TO authenticated;


--
-- Name: COLUMN itens.hora_inicio; Type: ACL; Schema: calendario; Owner: -
--

GRANT INSERT(hora_inicio),UPDATE(hora_inicio) ON TABLE calendario.itens TO authenticated;


--
-- Name: COLUMN itens.hora_fim; Type: ACL; Schema: calendario; Owner: -
--

GRANT INSERT(hora_fim),UPDATE(hora_fim) ON TABLE calendario.itens TO authenticated;


--
-- Name: COLUMN itens.responsavel_id; Type: ACL; Schema: calendario; Owner: -
--

GRANT INSERT(responsavel_id),UPDATE(responsavel_id) ON TABLE calendario.itens TO authenticated;


--
-- Name: COLUMN itens.recorrencia; Type: ACL; Schema: calendario; Owner: -
--

GRANT INSERT(recorrencia),UPDATE(recorrencia) ON TABLE calendario.itens TO authenticated;


--
-- Name: COLUMN itens.recorrencia_ate; Type: ACL; Schema: calendario; Owner: -
--

GRANT INSERT(recorrencia_ate),UPDATE(recorrencia_ate) ON TABLE calendario.itens TO authenticated;


--
-- Name: COLUMN itens.visibilidade; Type: ACL; Schema: calendario; Owner: -
--

GRANT INSERT(visibilidade),UPDATE(visibilidade) ON TABLE calendario.itens TO authenticated;


--
-- Name: COLUMN itens.setores; Type: ACL; Schema: calendario; Owner: -
--

GRANT INSERT(setores),UPDATE(setores) ON TABLE calendario.itens TO authenticated;


--
-- Name: COLUMN itens.cargos; Type: ACL; Schema: calendario; Owner: -
--

GRANT INSERT(cargos),UPDATE(cargos) ON TABLE calendario.itens TO authenticated;


--
-- Name: COLUMN itens.usuarios; Type: ACL; Schema: calendario; Owner: -
--

GRANT INSERT(usuarios),UPDATE(usuarios) ON TABLE calendario.itens TO authenticated;


--
-- Name: TABLE tipos; Type: ACL; Schema: calendario; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE calendario.tipos TO authenticated;
GRANT ALL ON TABLE calendario.tipos TO service_role;


--
-- Name: TABLE censo_convites; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE comercial.censo_convites TO authenticated;
GRANT ALL ON TABLE comercial.censo_convites TO service_role;


--
-- Name: TABLE censo_respostas; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE comercial.censo_respostas TO authenticated;
GRANT ALL ON TABLE comercial.censo_respostas TO service_role;


--
-- Name: TABLE censo_rodadas; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE comercial.censo_rodadas TO authenticated;
GRANT ALL ON TABLE comercial.censo_rodadas TO service_role;


--
-- Name: TABLE censo_sugestao_temas; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE comercial.censo_sugestao_temas TO authenticated;
GRANT ALL ON TABLE comercial.censo_sugestao_temas TO service_role;


--
-- Name: TABLE censo_temas; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE comercial.censo_temas TO authenticated;
GRANT ALL ON TABLE comercial.censo_temas TO service_role;


--
-- Name: TABLE contatos; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE comercial.contatos TO authenticated;
GRANT ALL ON TABLE comercial.contatos TO service_role;


--
-- Name: TABLE contrato_anexos; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT,INSERT,DELETE ON TABLE comercial.contrato_anexos TO authenticated;
GRANT ALL ON TABLE comercial.contrato_anexos TO service_role;


--
-- Name: TABLE contrato_kit; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT,INSERT,DELETE ON TABLE comercial.contrato_kit TO authenticated;
GRANT ALL ON TABLE comercial.contrato_kit TO service_role;


--
-- Name: TABLE contrato_versoes; Type: ACL; Schema: comercial; Owner: -
--

GRANT ALL ON TABLE comercial.contrato_versoes TO service_role;


--
-- Name: COLUMN contrato_versoes.id; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(id) ON TABLE comercial.contrato_versoes TO authenticated;


--
-- Name: COLUMN contrato_versoes.contrato_id; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(contrato_id) ON TABLE comercial.contrato_versoes TO authenticated;


--
-- Name: COLUMN contrato_versoes.versao; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(versao) ON TABLE comercial.contrato_versoes TO authenticated;


--
-- Name: COLUMN contrato_versoes.status; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(status) ON TABLE comercial.contrato_versoes TO authenticated;


--
-- Name: COLUMN contrato_versoes.etapa_atual; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(etapa_atual) ON TABLE comercial.contrato_versoes TO authenticated;


--
-- Name: COLUMN contrato_versoes.por; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(por) ON TABLE comercial.contrato_versoes TO authenticated;


--
-- Name: COLUMN contrato_versoes.em; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(em) ON TABLE comercial.contrato_versoes TO authenticated;


--
-- Name: SEQUENCE contrato_versoes_id_seq; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE comercial.contrato_versoes_id_seq TO authenticated;
GRANT SELECT,USAGE ON SEQUENCE comercial.contrato_versoes_id_seq TO service_role;


--
-- Name: TABLE contratos; Type: ACL; Schema: comercial; Owner: -
--

GRANT INSERT,DELETE,UPDATE ON TABLE comercial.contratos TO authenticated;
GRANT ALL ON TABLE comercial.contratos TO service_role;


--
-- Name: COLUMN contratos.id; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(id) ON TABLE comercial.contratos TO authenticated;


--
-- Name: COLUMN contratos.tipo; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(tipo) ON TABLE comercial.contratos TO authenticated;


--
-- Name: COLUMN contratos.status; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(status) ON TABLE comercial.contratos TO authenticated;


--
-- Name: COLUMN contratos.versao; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(versao) ON TABLE comercial.contratos TO authenticated;


--
-- Name: COLUMN contratos.etapa_atual; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(etapa_atual) ON TABLE comercial.contratos TO authenticated;


--
-- Name: COLUMN contratos.lucs; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(lucs) ON TABLE comercial.contratos TO authenticated;


--
-- Name: COLUMN contratos.bloco; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(bloco) ON TABLE comercial.contratos TO authenticated;


--
-- Name: COLUMN contratos.area_m2; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(area_m2) ON TABLE comercial.contratos TO authenticated;


--
-- Name: COLUMN contratos.locatario_nome; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(locatario_nome) ON TABLE comercial.contratos TO authenticated;


--
-- Name: COLUMN contratos.parte_tipo; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(parte_tipo) ON TABLE comercial.contratos TO authenticated;


--
-- Name: COLUMN contratos.garantia; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(garantia) ON TABLE comercial.contratos TO authenticated;


--
-- Name: COLUMN contratos.inicio; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(inicio) ON TABLE comercial.contratos TO authenticated;


--
-- Name: COLUMN contratos.termino; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(termino) ON TABLE comercial.contratos TO authenticated;


--
-- Name: COLUMN contratos.ficha_id; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(ficha_id) ON TABLE comercial.contratos TO authenticated;


--
-- Name: COLUMN contratos.contrato_enet_id; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(contrato_enet_id) ON TABLE comercial.contratos TO authenticated;


--
-- Name: COLUMN contratos.criado_por; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(criado_por) ON TABLE comercial.contratos TO authenticated;


--
-- Name: COLUMN contratos.criado_em; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(criado_em) ON TABLE comercial.contratos TO authenticated;


--
-- Name: COLUMN contratos.atualizado_por; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(atualizado_por) ON TABLE comercial.contratos TO authenticated;


--
-- Name: COLUMN contratos.atualizado_em; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(atualizado_em) ON TABLE comercial.contratos TO authenticated;


--
-- Name: COLUMN contratos.gerado_por; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(gerado_por) ON TABLE comercial.contratos TO authenticated;


--
-- Name: COLUMN contratos.gerado_em; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(gerado_em) ON TABLE comercial.contratos TO authenticated;


--
-- Name: COLUMN contratos.exemplo; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(exemplo) ON TABLE comercial.contratos TO authenticated;


--
-- Name: TABLE faixas_evento; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE comercial.faixas_evento TO authenticated;
GRANT ALL ON TABLE comercial.faixas_evento TO service_role;


--
-- Name: TABLE ficha_acessos; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT,INSERT ON TABLE comercial.ficha_acessos TO authenticated;
GRANT ALL ON TABLE comercial.ficha_acessos TO service_role;


--
-- Name: SEQUENCE ficha_acessos_id_seq; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE comercial.ficha_acessos_id_seq TO authenticated;
GRANT SELECT,USAGE ON SEQUENCE comercial.ficha_acessos_id_seq TO service_role;


--
-- Name: TABLE ficha_dados; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE comercial.ficha_dados TO authenticated;
GRANT ALL ON TABLE comercial.ficha_dados TO service_role;


--
-- Name: TABLE ficha_documentos; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT ON TABLE comercial.ficha_documentos TO authenticated;
GRANT ALL ON TABLE comercial.ficha_documentos TO service_role;


--
-- Name: TABLE fichas; Type: ACL; Schema: comercial; Owner: -
--

GRANT INSERT,DELETE,UPDATE ON TABLE comercial.fichas TO authenticated;
GRANT ALL ON TABLE comercial.fichas TO service_role;


--
-- Name: COLUMN fichas.id; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(id) ON TABLE comercial.fichas TO authenticated;


--
-- Name: COLUMN fichas.tipo; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(tipo) ON TABLE comercial.fichas TO authenticated;


--
-- Name: COLUMN fichas.situacao; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(situacao) ON TABLE comercial.fichas TO authenticated;


--
-- Name: COLUMN fichas.luc; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(luc) ON TABLE comercial.fichas TO authenticated;


--
-- Name: COLUMN fichas.nome; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(nome) ON TABLE comercial.fichas TO authenticated;


--
-- Name: COLUMN fichas.ficha_principal_id; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(ficha_principal_id) ON TABLE comercial.fichas TO authenticated;


--
-- Name: COLUMN fichas.origem; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(origem) ON TABLE comercial.fichas TO authenticated;


--
-- Name: COLUMN fichas.gerada_por; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(gerada_por) ON TABLE comercial.fichas TO authenticated;


--
-- Name: COLUMN fichas.gerada_em; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(gerada_em) ON TABLE comercial.fichas TO authenticated;


--
-- Name: COLUMN fichas.expira_em; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(expira_em) ON TABLE comercial.fichas TO authenticated;


--
-- Name: COLUMN fichas.iniciada_em; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(iniciada_em) ON TABLE comercial.fichas TO authenticated;


--
-- Name: COLUMN fichas.consentimento_em; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(consentimento_em) ON TABLE comercial.fichas TO authenticated;


--
-- Name: COLUMN fichas.recebida_em; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(recebida_em) ON TABLE comercial.fichas TO authenticated;


--
-- Name: COLUMN fichas.usada_em; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(usada_em) ON TABLE comercial.fichas TO authenticated;


--
-- Name: COLUMN fichas.ultimo_acesso_em; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(ultimo_acesso_em) ON TABLE comercial.fichas TO authenticated;


--
-- Name: COLUMN fichas.atualizado_em; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(atualizado_em) ON TABLE comercial.fichas TO authenticated;


--
-- Name: COLUMN fichas.importacao_id; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(importacao_id) ON TABLE comercial.fichas TO authenticated;


--
-- Name: COLUMN fichas.exemplo; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(exemplo) ON TABLE comercial.fichas TO authenticated;


--
-- Name: COLUMN fichas.cancelada_em; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(cancelada_em) ON TABLE comercial.fichas TO authenticated;


--
-- Name: COLUMN fichas.rd_oportunidade; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(rd_oportunidade) ON TABLE comercial.fichas TO authenticated;


--
-- Name: TABLE fontes_de_para; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE comercial.fontes_de_para TO authenticated;
GRANT ALL ON TABLE comercial.fontes_de_para TO service_role;


--
-- Name: TABLE importacoes; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE comercial.importacoes TO authenticated;
GRANT ALL ON TABLE comercial.importacoes TO service_role;


--
-- Name: TABLE kit_documentos; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE comercial.kit_documentos TO authenticated;
GRANT ALL ON TABLE comercial.kit_documentos TO service_role;


--
-- Name: TABLE kit_versoes; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE comercial.kit_versoes TO authenticated;
GRANT ALL ON TABLE comercial.kit_versoes TO service_role;


--
-- Name: TABLE listas; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE comercial.listas TO authenticated;
GRANT ALL ON TABLE comercial.listas TO service_role;


--
-- Name: TABLE ocupacao_fotos; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT ON TABLE comercial.ocupacao_fotos TO authenticated;
GRANT ALL ON TABLE comercial.ocupacao_fotos TO service_role;


--
-- Name: TABLE parametros; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT,UPDATE ON TABLE comercial.parametros TO authenticated;
GRANT ALL ON TABLE comercial.parametros TO service_role;


--
-- Name: TABLE pesquisa_imoveis; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE comercial.pesquisa_imoveis TO authenticated;
GRANT ALL ON TABLE comercial.pesquisa_imoveis TO service_role;


--
-- Name: TABLE propostas_evento; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE comercial.propostas_evento TO authenticated;
GRANT ALL ON TABLE comercial.propostas_evento TO service_role;


--
-- Name: TABLE rd_oportunidades; Type: ACL; Schema: comercial; Owner: -
--

GRANT ALL ON TABLE comercial.rd_oportunidades TO service_role;


--
-- Name: COLUMN rd_oportunidades.id; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(id) ON TABLE comercial.rd_oportunidades TO authenticated;


--
-- Name: COLUMN rd_oportunidades.dados; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(dados) ON TABLE comercial.rd_oportunidades TO authenticated;


--
-- Name: COLUMN rd_oportunidades.atualizado_em; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT(atualizado_em) ON TABLE comercial.rd_oportunidades TO authenticated;


--
-- Name: TABLE tipos_luc; Type: ACL; Schema: comercial; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE comercial.tipos_luc TO authenticated;
GRANT ALL ON TABLE comercial.tipos_luc TO service_role;


--
-- Name: TABLE auditoria; Type: ACL; Schema: core; Owner: -
--

GRANT SELECT ON TABLE core.auditoria TO authenticated;
GRANT ALL ON TABLE core.auditoria TO service_role;


--
-- Name: SEQUENCE auditoria_id_seq; Type: ACL; Schema: core; Owner: -
--

GRANT USAGE ON SEQUENCE core.auditoria_id_seq TO service_role;


--
-- Name: TABLE cargo_permissoes; Type: ACL; Schema: core; Owner: -
--

GRANT SELECT,INSERT,DELETE ON TABLE core.cargo_permissoes TO authenticated;
GRANT ALL ON TABLE core.cargo_permissoes TO service_role;


--
-- Name: TABLE cargos; Type: ACL; Schema: core; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE core.cargos TO authenticated;
GRANT ALL ON TABLE core.cargos TO service_role;


--
-- Name: TABLE empresa; Type: ACL; Schema: core; Owner: -
--

GRANT SELECT,UPDATE ON TABLE core.empresa TO authenticated;
GRANT ALL ON TABLE core.empresa TO service_role;


--
-- Name: TABLE importacoes; Type: ACL; Schema: core; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE core.importacoes TO authenticated;
GRANT ALL ON TABLE core.importacoes TO service_role;


--
-- Name: TABLE logs; Type: ACL; Schema: core; Owner: -
--

GRANT SELECT ON TABLE core.logs TO authenticated;
GRANT ALL ON TABLE core.logs TO service_role;


--
-- Name: SEQUENCE logs_id_seq; Type: ACL; Schema: core; Owner: -
--

GRANT USAGE ON SEQUENCE core.logs_id_seq TO service_role;


--
-- Name: TABLE metas; Type: ACL; Schema: core; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE core.metas TO authenticated;
GRANT ALL ON TABLE core.metas TO service_role;


--
-- Name: TABLE permissoes; Type: ACL; Schema: core; Owner: -
--

GRANT SELECT ON TABLE core.permissoes TO authenticated;
GRANT ALL ON TABLE core.permissoes TO service_role;


--
-- Name: TABLE preferencias; Type: ACL; Schema: core; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE core.preferencias TO authenticated;
GRANT ALL ON TABLE core.preferencias TO service_role;


--
-- Name: TABLE usuario_permissoes; Type: ACL; Schema: core; Owner: -
--

GRANT SELECT,INSERT,DELETE ON TABLE core.usuario_permissoes TO authenticated;
GRANT ALL ON TABLE core.usuario_permissoes TO service_role;


--
-- Name: TABLE usuarios; Type: ACL; Schema: core; Owner: -
--

GRANT SELECT,DELETE ON TABLE core.usuarios TO authenticated;
GRANT ALL ON TABLE core.usuarios TO service_role;


--
-- Name: COLUMN usuarios.nome; Type: ACL; Schema: core; Owner: -
--

GRANT UPDATE(nome) ON TABLE core.usuarios TO authenticated;


--
-- Name: COLUMN usuarios.ativo; Type: ACL; Schema: core; Owner: -
--

GRANT UPDATE(ativo) ON TABLE core.usuarios TO authenticated;


--
-- Name: COLUMN usuarios.cargo_id; Type: ACL; Schema: core; Owner: -
--

GRANT UPDATE(cargo_id) ON TABLE core.usuarios TO authenticated;


--
-- Name: TABLE estacionamento_movimento; Type: ACL; Schema: financeiro; Owner: -
--

GRANT SELECT ON TABLE financeiro.estacionamento_movimento TO authenticated;
GRANT ALL ON TABLE financeiro.estacionamento_movimento TO service_role;


--
-- Name: TABLE estacionamento_pagamentos; Type: ACL; Schema: financeiro; Owner: -
--

GRANT SELECT ON TABLE financeiro.estacionamento_pagamentos TO authenticated;
GRANT ALL ON TABLE financeiro.estacionamento_pagamentos TO service_role;


--
-- Name: TABLE formularios; Type: ACL; Schema: formularios; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE formularios.formularios TO authenticated;
GRANT ALL ON TABLE formularios.formularios TO service_role;


--
-- Name: TABLE respostas; Type: ACL; Schema: formularios; Owner: -
--

GRANT SELECT,DELETE ON TABLE formularios.respostas TO authenticated;
GRANT ALL ON TABLE formularios.respostas TO service_role;


--
-- Name: TABLE camera_contagens; Type: ACL; Schema: integracao; Owner: -
--

GRANT ALL ON TABLE integracao.camera_contagens TO service_role;


--
-- Name: TABLE cameras; Type: ACL; Schema: integracao; Owner: -
--

GRANT ALL ON TABLE integracao.cameras TO service_role;


--
-- Name: TABLE credenciais; Type: ACL; Schema: integracao; Owner: -
--

GRANT ALL ON TABLE integracao.credenciais TO service_role;


--
-- Name: TABLE cursores; Type: ACL; Schema: integracao; Owner: -
--

GRANT ALL ON TABLE integracao.cursores TO service_role;


--
-- Name: TABLE registros_brutos; Type: ACL; Schema: integracao; Owner: -
--

GRANT ALL ON TABLE integracao.registros_brutos TO service_role;


--
-- Name: TABLE sync_runs; Type: ACL; Schema: integracao; Owner: -
--

GRANT ALL ON TABLE integracao.sync_runs TO service_role;


--
-- Name: TABLE benchmark; Type: ACL; Schema: marketing; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE marketing.benchmark TO authenticated;
GRANT ALL ON TABLE marketing.benchmark TO service_role;


--
-- Name: TABLE landing_pages; Type: ACL; Schema: marketing; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE marketing.landing_pages TO authenticated;
GRANT ALL ON TABLE marketing.landing_pages TO service_role;


--
-- Name: TABLE locatarios; Type: ACL; Schema: marketing; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE marketing.locatarios TO authenticated;
GRANT ALL ON TABLE marketing.locatarios TO service_role;


--
-- Name: TABLE marca_arquivos; Type: ACL; Schema: marketing; Owner: -
--

GRANT SELECT ON TABLE marketing.marca_arquivos TO authenticated;
GRANT ALL ON TABLE marketing.marca_arquivos TO service_role;


--
-- Name: TABLE marca_blocos; Type: ACL; Schema: marketing; Owner: -
--

GRANT SELECT ON TABLE marketing.marca_blocos TO authenticated;
GRANT ALL ON TABLE marketing.marca_blocos TO service_role;


--
-- Name: COLUMN marca_blocos.conteudo; Type: ACL; Schema: marketing; Owner: -
--

GRANT UPDATE(conteudo) ON TABLE marketing.marca_blocos TO authenticated;


--
-- Name: TABLE marca_versoes; Type: ACL; Schema: marketing; Owner: -
--

GRANT SELECT ON TABLE marketing.marca_versoes TO authenticated;
GRANT ALL ON TABLE marketing.marca_versoes TO service_role;


--
-- Name: TABLE parametros; Type: ACL; Schema: marketing; Owner: -
--

GRANT SELECT,UPDATE ON TABLE marketing.parametros TO authenticated;
GRANT ALL ON TABLE marketing.parametros TO service_role;


--
-- Name: TABLE rd_contatos; Type: ACL; Schema: marketing; Owner: -
--

GRANT SELECT ON TABLE marketing.rd_contatos TO authenticated;
GRANT ALL ON TABLE marketing.rd_contatos TO service_role;


--
-- Name: TABLE rd_conversoes; Type: ACL; Schema: marketing; Owner: -
--

GRANT SELECT ON TABLE marketing.rd_conversoes TO authenticated;
GRANT ALL ON TABLE marketing.rd_conversoes TO service_role;


--
-- Name: TABLE rd_landing_pages_dia; Type: ACL; Schema: marketing; Owner: -
--

GRANT SELECT ON TABLE marketing.rd_landing_pages_dia TO authenticated;
GRANT ALL ON TABLE marketing.rd_landing_pages_dia TO service_role;


--
-- Name: TABLE redes_dia; Type: ACL; Schema: marketing; Owner: -
--

GRANT SELECT ON TABLE marketing.redes_dia TO authenticated;
GRANT ALL ON TABLE marketing.redes_dia TO service_role;


--
-- Name: TABLE regras_alerta; Type: ACL; Schema: marketing; Owner: -
--

GRANT SELECT,UPDATE ON TABLE marketing.regras_alerta TO authenticated;
GRANT ALL ON TABLE marketing.regras_alerta TO service_role;


--
-- Name: TABLE ronda_codigos; Type: ACL; Schema: marketing; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE marketing.ronda_codigos TO authenticated;
GRANT ALL ON TABLE marketing.ronda_codigos TO service_role;


--
-- Name: TABLE temas; Type: ACL; Schema: marketing; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE marketing.temas TO authenticated;
GRANT ALL ON TABLE marketing.temas TO service_role;


--
-- Name: TABLE agua_contas; Type: ACL; Schema: operacoes; Owner: -
--

GRANT SELECT ON TABLE operacoes.agua_contas TO authenticated;
GRANT ALL ON TABLE operacoes.agua_contas TO service_role;


--
-- Name: COLUMN agua_contas.importacao_id; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(importacao_id) ON TABLE operacoes.agua_contas TO authenticated;


--
-- Name: COLUMN agua_contas.referencia; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(referencia),UPDATE(referencia) ON TABLE operacoes.agua_contas TO authenticated;


--
-- Name: COLUMN agua_contas.matricula; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(matricula),UPDATE(matricula) ON TABLE operacoes.agua_contas TO authenticated;


--
-- Name: COLUMN agua_contas.vencimento; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(vencimento),UPDATE(vencimento) ON TABLE operacoes.agua_contas TO authenticated;


--
-- Name: COLUMN agua_contas.data_anterior; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(data_anterior),UPDATE(data_anterior) ON TABLE operacoes.agua_contas TO authenticated;


--
-- Name: COLUMN agua_contas.data_atual; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(data_atual),UPDATE(data_atual) ON TABLE operacoes.agua_contas TO authenticated;


--
-- Name: COLUMN agua_contas.leitura_anterior; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(leitura_anterior),UPDATE(leitura_anterior) ON TABLE operacoes.agua_contas TO authenticated;


--
-- Name: COLUMN agua_contas.leitura_atual; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(leitura_atual),UPDATE(leitura_atual) ON TABLE operacoes.agua_contas TO authenticated;


--
-- Name: COLUMN agua_contas.consumo_m3; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(consumo_m3),UPDATE(consumo_m3) ON TABLE operacoes.agua_contas TO authenticated;


--
-- Name: COLUMN agua_contas.valor_agua; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(valor_agua),UPDATE(valor_agua) ON TABLE operacoes.agua_contas TO authenticated;


--
-- Name: COLUMN agua_contas.valor_esgoto; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(valor_esgoto),UPDATE(valor_esgoto) ON TABLE operacoes.agua_contas TO authenticated;


--
-- Name: COLUMN agua_contas.total; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(total),UPDATE(total) ON TABLE operacoes.agua_contas TO authenticated;


--
-- Name: COLUMN agua_contas.observacao; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(observacao),UPDATE(observacao) ON TABLE operacoes.agua_contas TO authenticated;


--
-- Name: TABLE agua_leituras; Type: ACL; Schema: operacoes; Owner: -
--

GRANT SELECT,INSERT,DELETE ON TABLE operacoes.agua_leituras TO authenticated;
GRANT ALL ON TABLE operacoes.agua_leituras TO service_role;


--
-- Name: COLUMN agua_leituras.bloco; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(bloco) ON TABLE operacoes.agua_leituras TO authenticated;


--
-- Name: COLUMN agua_leituras.sala; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(sala) ON TABLE operacoes.agua_leituras TO authenticated;


--
-- Name: COLUMN agua_leituras.cliente; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(cliente) ON TABLE operacoes.agua_leituras TO authenticated;


--
-- Name: COLUMN agua_leituras.hidrometro; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(hidrometro) ON TABLE operacoes.agua_leituras TO authenticated;


--
-- Name: COLUMN agua_leituras.data_anterior; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(data_anterior) ON TABLE operacoes.agua_leituras TO authenticated;


--
-- Name: COLUMN agua_leituras.leitura_anterior; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(leitura_anterior) ON TABLE operacoes.agua_leituras TO authenticated;


--
-- Name: COLUMN agua_leituras.data_atual; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(data_atual) ON TABLE operacoes.agua_leituras TO authenticated;


--
-- Name: COLUMN agua_leituras.leitura_atual; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(leitura_atual) ON TABLE operacoes.agua_leituras TO authenticated;


--
-- Name: COLUMN agua_leituras.dias; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(dias) ON TABLE operacoes.agua_leituras TO authenticated;


--
-- Name: COLUMN agua_leituras.consumo; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(consumo) ON TABLE operacoes.agua_leituras TO authenticated;


--
-- Name: COLUMN agua_leituras.volume_faturado; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(volume_faturado) ON TABLE operacoes.agua_leituras TO authenticated;


--
-- Name: COLUMN agua_leituras.tipo; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(tipo) ON TABLE operacoes.agua_leituras TO authenticated;


--
-- Name: COLUMN agua_leituras.foto; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(foto) ON TABLE operacoes.agua_leituras TO authenticated;


--
-- Name: TABLE agua_valores; Type: ACL; Schema: operacoes; Owner: -
--

GRANT SELECT,INSERT ON TABLE operacoes.agua_valores TO authenticated;
GRANT ALL ON TABLE operacoes.agua_valores TO service_role;


--
-- Name: COLUMN agua_valores.valor; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(valor) ON TABLE operacoes.agua_valores TO authenticated;


--
-- Name: TABLE agua_vinculos; Type: ACL; Schema: operacoes; Owner: -
--

GRANT SELECT,INSERT,DELETE ON TABLE operacoes.agua_vinculos TO authenticated;
GRANT ALL ON TABLE operacoes.agua_vinculos TO service_role;


--
-- Name: TABLE caixa_ocupantes; Type: ACL; Schema: operacoes; Owner: -
--

GRANT SELECT ON TABLE operacoes.caixa_ocupantes TO authenticated;
GRANT ALL ON TABLE operacoes.caixa_ocupantes TO service_role;


--
-- Name: TABLE caixas; Type: ACL; Schema: operacoes; Owner: -
--

GRANT SELECT,INSERT,DELETE ON TABLE operacoes.caixas TO authenticated;
GRANT ALL ON TABLE operacoes.caixas TO service_role;


--
-- Name: COLUMN caixas.numero; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(numero) ON TABLE operacoes.caixas TO authenticated;


--
-- Name: COLUMN caixas.numero_antigo; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(numero_antigo) ON TABLE operacoes.caixas TO authenticated;


--
-- Name: COLUMN caixas.lado; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(lado) ON TABLE operacoes.caixas TO authenticated;


--
-- Name: COLUMN caixas.coluna; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(coluna) ON TABLE operacoes.caixas TO authenticated;


--
-- Name: COLUMN caixas.linha; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(linha) ON TABLE operacoes.caixas TO authenticated;


--
-- Name: COLUMN caixas.rota; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(rota) ON TABLE operacoes.caixas TO authenticated;


--
-- Name: COLUMN caixas.sala_id; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(sala_id) ON TABLE operacoes.caixas TO authenticated;


--
-- Name: COLUMN caixas.salas_texto; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(salas_texto) ON TABLE operacoes.caixas TO authenticated;


--
-- Name: COLUMN caixas.pavimento; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(pavimento) ON TABLE operacoes.caixas TO authenticated;


--
-- Name: COLUMN caixas.status; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(status) ON TABLE operacoes.caixas TO authenticated;


--
-- Name: COLUMN caixas.locatario_novo; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(locatario_novo) ON TABLE operacoes.caixas TO authenticated;


--
-- Name: COLUMN caixas.disjuntor_amperes; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(disjuntor_amperes) ON TABLE operacoes.caixas TO authenticated;


--
-- Name: COLUMN caixas.ligacao; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(ligacao) ON TABLE operacoes.caixas TO authenticated;


--
-- Name: COLUMN caixas.disjuntor_texto; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(disjuntor_texto) ON TABLE operacoes.caixas TO authenticated;


--
-- Name: COLUMN caixas.medidor_situacao; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(medidor_situacao) ON TABLE operacoes.caixas TO authenticated;


--
-- Name: COLUMN caixas.medidor_numero; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(medidor_numero) ON TABLE operacoes.caixas TO authenticated;


--
-- Name: COLUMN caixas.modulo; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(modulo) ON TABLE operacoes.caixas TO authenticated;


--
-- Name: COLUMN caixas.observacoes; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(observacoes) ON TABLE operacoes.caixas TO authenticated;


--
-- Name: COLUMN caixas.termo_externo; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(termo_externo) ON TABLE operacoes.caixas TO authenticated;


--
-- Name: TABLE diario_cadastros; Type: ACL; Schema: operacoes; Owner: -
--

GRANT SELECT ON TABLE operacoes.diario_cadastros TO authenticated;
GRANT ALL ON TABLE operacoes.diario_cadastros TO service_role;


--
-- Name: TABLE diario_obras; Type: ACL; Schema: operacoes; Owner: -
--

GRANT SELECT ON TABLE operacoes.diario_obras TO authenticated;
GRANT ALL ON TABLE operacoes.diario_obras TO service_role;


--
-- Name: TABLE diario_relatorios; Type: ACL; Schema: operacoes; Owner: -
--

GRANT SELECT ON TABLE operacoes.diario_relatorios TO authenticated;
GRANT ALL ON TABLE operacoes.diario_relatorios TO service_role;


--
-- Name: TABLE energia_fatura_itens; Type: ACL; Schema: operacoes; Owner: -
--

GRANT SELECT,INSERT ON TABLE operacoes.energia_fatura_itens TO authenticated;
GRANT ALL ON TABLE operacoes.energia_fatura_itens TO service_role;


--
-- Name: TABLE energia_faturas; Type: ACL; Schema: operacoes; Owner: -
--

GRANT SELECT,INSERT ON TABLE operacoes.energia_faturas TO authenticated;
GRANT ALL ON TABLE operacoes.energia_faturas TO service_role;


--
-- Name: TABLE energia_unidades; Type: ACL; Schema: operacoes; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE operacoes.energia_unidades TO authenticated;
GRANT ALL ON TABLE operacoes.energia_unidades TO service_role;


--
-- Name: TABLE hidrometros; Type: ACL; Schema: operacoes; Owner: -
--

GRANT SELECT,DELETE ON TABLE operacoes.hidrometros TO authenticated;
GRANT ALL ON TABLE operacoes.hidrometros TO service_role;


--
-- Name: COLUMN hidrometros.numero; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(numero),UPDATE(numero) ON TABLE operacoes.hidrometros TO authenticated;


--
-- Name: COLUMN hidrometros.bloco; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(bloco),UPDATE(bloco) ON TABLE operacoes.hidrometros TO authenticated;


--
-- Name: COLUMN hidrometros.sala; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(sala),UPDATE(sala) ON TABLE operacoes.hidrometros TO authenticated;


--
-- Name: COLUMN hidrometros.sala_id; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(sala_id),UPDATE(sala_id) ON TABLE operacoes.hidrometros TO authenticated;


--
-- Name: COLUMN hidrometros.descricao; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(descricao),UPDATE(descricao) ON TABLE operacoes.hidrometros TO authenticated;


--
-- Name: COLUMN hidrometros.ativo; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(ativo),UPDATE(ativo) ON TABLE operacoes.hidrometros TO authenticated;


--
-- Name: COLUMN hidrometros.observacoes; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(observacoes),UPDATE(observacoes) ON TABLE operacoes.hidrometros TO authenticated;


--
-- Name: TABLE importacao_valores; Type: ACL; Schema: operacoes; Owner: -
--

GRANT SELECT,INSERT ON TABLE operacoes.importacao_valores TO authenticated;
GRANT ALL ON TABLE operacoes.importacao_valores TO service_role;


--
-- Name: TABLE importacoes; Type: ACL; Schema: operacoes; Owner: -
--

GRANT SELECT ON TABLE operacoes.importacoes TO authenticated;
GRANT ALL ON TABLE operacoes.importacoes TO service_role;


--
-- Name: COLUMN importacoes.id; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(id) ON TABLE operacoes.importacoes TO authenticated;


--
-- Name: COLUMN importacoes.tipo; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(tipo) ON TABLE operacoes.importacoes TO authenticated;


--
-- Name: COLUMN importacoes.referencia; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(referencia),UPDATE(referencia) ON TABLE operacoes.importacoes TO authenticated;


--
-- Name: COLUMN importacoes.arquivos; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(arquivos),UPDATE(arquivos) ON TABLE operacoes.importacoes TO authenticated;


--
-- Name: COLUMN importacoes.resumo; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(resumo),UPDATE(resumo) ON TABLE operacoes.importacoes TO authenticated;


--
-- Name: COLUMN importacoes.avisos; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(avisos),UPDATE(avisos) ON TABLE operacoes.importacoes TO authenticated;


--
-- Name: COLUMN importacoes.bate; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(bate),UPDATE(bate) ON TABLE operacoes.importacoes TO authenticated;


--
-- Name: COLUMN importacoes.criado_por; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(criado_por) ON TABLE operacoes.importacoes TO authenticated;


--
-- Name: TABLE limpeza_anexos; Type: ACL; Schema: operacoes; Owner: -
--

GRANT SELECT,INSERT,DELETE ON TABLE operacoes.limpeza_anexos TO authenticated;
GRANT ALL ON TABLE operacoes.limpeza_anexos TO service_role;


--
-- Name: TABLE limpeza_contrato; Type: ACL; Schema: operacoes; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE operacoes.limpeza_contrato TO authenticated;
GRANT ALL ON TABLE operacoes.limpeza_contrato TO service_role;


--
-- Name: TABLE limpeza_equipe; Type: ACL; Schema: operacoes; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE operacoes.limpeza_equipe TO authenticated;
GRANT ALL ON TABLE operacoes.limpeza_equipe TO service_role;


--
-- Name: TABLE limpeza_extras; Type: ACL; Schema: operacoes; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE operacoes.limpeza_extras TO authenticated;
GRANT ALL ON TABLE operacoes.limpeza_extras TO service_role;


--
-- Name: TABLE limpeza_meses; Type: ACL; Schema: operacoes; Owner: -
--

GRANT SELECT,DELETE ON TABLE operacoes.limpeza_meses TO authenticated;
GRANT ALL ON TABLE operacoes.limpeza_meses TO service_role;


--
-- Name: COLUMN limpeza_meses.referencia; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(referencia) ON TABLE operacoes.limpeza_meses TO authenticated;


--
-- Name: COLUMN limpeza_meses.apontamento; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(apontamento),UPDATE(apontamento) ON TABLE operacoes.limpeza_meses TO authenticated;


--
-- Name: COLUMN limpeza_meses.valor_base; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(valor_base),UPDATE(valor_base) ON TABLE operacoes.limpeza_meses TO authenticated;


--
-- Name: COLUMN limpeza_meses.base_composicao; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(base_composicao),UPDATE(base_composicao) ON TABLE operacoes.limpeza_meses TO authenticated;


--
-- Name: COLUMN limpeza_meses.func_base; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(func_base),UPDATE(func_base) ON TABLE operacoes.limpeza_meses TO authenticated;


--
-- Name: COLUMN limpeza_meses.func_area_comum; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(func_area_comum),UPDATE(func_area_comum) ON TABLE operacoes.limpeza_meses TO authenticated;


--
-- Name: COLUMN limpeza_meses.func_rateados; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(func_rateados),UPDATE(func_rateados) ON TABLE operacoes.limpeza_meses TO authenticated;


--
-- Name: COLUMN limpeza_meses.regra_bl04; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(regra_bl04),UPDATE(regra_bl04) ON TABLE operacoes.limpeza_meses TO authenticated;


--
-- Name: COLUMN limpeza_meses.criado_por; Type: ACL; Schema: operacoes; Owner: -
--

GRANT INSERT(criado_por) ON TABLE operacoes.limpeza_meses TO authenticated;


--
-- Name: TABLE limpeza_minutos; Type: ACL; Schema: operacoes; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE operacoes.limpeza_minutos TO authenticated;
GRANT ALL ON TABLE operacoes.limpeza_minutos TO service_role;


--
-- Name: TABLE obra_realizado; Type: ACL; Schema: operacoes; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE operacoes.obra_realizado TO authenticated;
GRANT ALL ON TABLE operacoes.obra_realizado TO service_role;


--
-- Name: TABLE obras; Type: ACL; Schema: operacoes; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE operacoes.obras TO authenticated;
GRANT ALL ON TABLE operacoes.obras TO service_role;


--
-- Name: TABLE orcamento_etapas; Type: ACL; Schema: operacoes; Owner: -
--

GRANT SELECT,INSERT ON TABLE operacoes.orcamento_etapas TO authenticated;
GRANT ALL ON TABLE operacoes.orcamento_etapas TO service_role;


--
-- Name: TABLE orcamento_previsto; Type: ACL; Schema: operacoes; Owner: -
--

GRANT SELECT,INSERT ON TABLE operacoes.orcamento_previsto TO authenticated;
GRANT ALL ON TABLE operacoes.orcamento_previsto TO service_role;


--
-- Name: TABLE orcamento_revisoes; Type: ACL; Schema: operacoes; Owner: -
--

GRANT SELECT,INSERT ON TABLE operacoes.orcamento_revisoes TO authenticated;
GRANT ALL ON TABLE operacoes.orcamento_revisoes TO service_role;


--
-- Name: TABLE parametros; Type: ACL; Schema: operacoes; Owner: -
--

GRANT SELECT ON TABLE operacoes.parametros TO authenticated;
GRANT ALL ON TABLE operacoes.parametros TO service_role;


--
-- Name: COLUMN parametros.agua_limite_m3; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(agua_limite_m3) ON TABLE operacoes.parametros TO authenticated;


--
-- Name: COLUMN parametros.agua_tolerancia; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(agua_tolerancia) ON TABLE operacoes.parametros TO authenticated;


--
-- Name: COLUMN parametros.agua_blocos; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(agua_blocos) ON TABLE operacoes.parametros TO authenticated;


--
-- Name: COLUMN parametros.agua_parceiro; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(agua_parceiro) ON TABLE operacoes.parametros TO authenticated;


--
-- Name: COLUMN parametros.agua_modelo; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(agua_modelo) ON TABLE operacoes.parametros TO authenticated;


--
-- Name: COLUMN parametros.termo_razao_social; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(termo_razao_social) ON TABLE operacoes.parametros TO authenticated;


--
-- Name: COLUMN parametros.termo_cnpj; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(termo_cnpj) ON TABLE operacoes.parametros TO authenticated;


--
-- Name: COLUMN parametros.termo_endereco; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(termo_endereco) ON TABLE operacoes.parametros TO authenticated;


--
-- Name: COLUMN parametros.termo_cidade; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(termo_cidade) ON TABLE operacoes.parametros TO authenticated;


--
-- Name: COLUMN parametros.termo_qualificacao_cpf; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(termo_qualificacao_cpf) ON TABLE operacoes.parametros TO authenticated;


--
-- Name: COLUMN parametros.termo_qualificacao_cnpj; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(termo_qualificacao_cnpj) ON TABLE operacoes.parametros TO authenticated;


--
-- Name: COLUMN parametros.termo_nome_arquivo; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(termo_nome_arquivo) ON TABLE operacoes.parametros TO authenticated;


--
-- Name: COLUMN parametros.energia_disjuntores; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(energia_disjuntores) ON TABLE operacoes.parametros TO authenticated;


--
-- Name: COLUMN parametros.energia_ligacoes; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(energia_ligacoes) ON TABLE operacoes.parametros TO authenticated;


--
-- Name: COLUMN parametros.energia_medidor_situacoes; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(energia_medidor_situacoes) ON TABLE operacoes.parametros TO authenticated;


--
-- Name: COLUMN parametros.energia_alerta_pct; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(energia_alerta_pct) ON TABLE operacoes.parametros TO authenticated;


--
-- Name: COLUMN parametros.solar_fonte; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(solar_fonte) ON TABLE operacoes.parametros TO authenticated;


--
-- Name: COLUMN parametros.limpeza_empresa; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(limpeza_empresa) ON TABLE operacoes.parametros TO authenticated;


--
-- Name: COLUMN parametros.limpeza_func_base; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(limpeza_func_base) ON TABLE operacoes.parametros TO authenticated;


--
-- Name: COLUMN parametros.limpeza_func_area_comum; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(limpeza_func_area_comum) ON TABLE operacoes.parametros TO authenticated;


--
-- Name: COLUMN parametros.limpeza_func_rateados; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(limpeza_func_rateados) ON TABLE operacoes.parametros TO authenticated;


--
-- Name: COLUMN parametros.limpeza_blocos; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(limpeza_blocos) ON TABLE operacoes.parametros TO authenticated;


--
-- Name: COLUMN parametros.limpeza_dia_util_envio; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(limpeza_dia_util_envio) ON TABLE operacoes.parametros TO authenticated;


--
-- Name: COLUMN parametros.limpeza_extras_padrao; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(limpeza_extras_padrao) ON TABLE operacoes.parametros TO authenticated;


--
-- Name: COLUMN parametros.obras_intervalo_min; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(obras_intervalo_min) ON TABLE operacoes.parametros TO authenticated;


--
-- Name: COLUMN parametros.obras_dias_relatorio; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(obras_dias_relatorio) ON TABLE operacoes.parametros TO authenticated;


--
-- Name: COLUMN parametros.obras_limite_desvio; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(obras_limite_desvio) ON TABLE operacoes.parametros TO authenticated;


--
-- Name: COLUMN parametros.obras_limite_orcamento_pct; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(obras_limite_orcamento_pct) ON TABLE operacoes.parametros TO authenticated;


--
-- Name: COLUMN parametros.atualizado_por; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(atualizado_por) ON TABLE operacoes.parametros TO authenticated;


--
-- Name: COLUMN parametros.agua_variacao_pct; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(agua_variacao_pct) ON TABLE operacoes.parametros TO authenticated;


--
-- Name: COLUMN parametros.agua_variacao_meses; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(agua_variacao_meses) ON TABLE operacoes.parametros TO authenticated;


--
-- Name: COLUMN parametros.agua_variacao_min_m3; Type: ACL; Schema: operacoes; Owner: -
--

GRANT UPDATE(agua_variacao_min_m3) ON TABLE operacoes.parametros TO authenticated;


--
-- Name: TABLE quadros; Type: ACL; Schema: operacoes; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE operacoes.quadros TO authenticated;
GRANT ALL ON TABLE operacoes.quadros TO service_role;


--
-- Name: TABLE salas; Type: ACL; Schema: operacoes; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE operacoes.salas TO authenticated;
GRANT ALL ON TABLE operacoes.salas TO service_role;


--
-- Name: TABLE termos; Type: ACL; Schema: operacoes; Owner: -
--

GRANT SELECT,INSERT ON TABLE operacoes.termos TO authenticated;
GRANT ALL ON TABLE operacoes.termos TO service_role;


--
-- Name: TABLE agenda_bloqueios; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.agenda_bloqueios TO authenticated;
GRANT ALL ON TABLE os.agenda_bloqueios TO service_role;


--
-- Name: TABLE agendamentos; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.agendamentos TO authenticated;
GRANT ALL ON TABLE os.agendamentos TO service_role;


--
-- Name: TABLE agendas; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.agendas TO authenticated;
GRANT ALL ON TABLE os.agendas TO service_role;


--
-- Name: TABLE anexos; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.anexos TO authenticated;
GRANT ALL ON TABLE os.anexos TO service_role;


--
-- Name: TABLE ativo_categorias; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.ativo_categorias TO authenticated;
GRANT ALL ON TABLE os.ativo_categorias TO service_role;


--
-- Name: SEQUENCE ativo_codigo_seq; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE os.ativo_codigo_seq TO authenticated;
GRANT SELECT,USAGE ON SEQUENCE os.ativo_codigo_seq TO service_role;


--
-- Name: TABLE ativo_saidas; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT ON TABLE os.ativo_saidas TO authenticated;
GRANT ALL ON TABLE os.ativo_saidas TO service_role;


--
-- Name: TABLE ativo_situacoes; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT ON TABLE os.ativo_situacoes TO authenticated;
GRANT ALL ON TABLE os.ativo_situacoes TO service_role;


--
-- Name: TABLE ativos; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.ativos TO authenticated;
GRANT ALL ON TABLE os.ativos TO service_role;


--
-- Name: TABLE categorias; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.categorias TO authenticated;
GRANT ALL ON TABLE os.categorias TO service_role;


--
-- Name: TABLE contatos; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.contatos TO authenticated;
GRANT ALL ON TABLE os.contatos TO service_role;


--
-- Name: TABLE destinatarios; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.destinatarios TO authenticated;
GRANT ALL ON TABLE os.destinatarios TO service_role;


--
-- Name: TABLE disparos; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT ON TABLE os.disparos TO authenticated;
GRANT ALL ON TABLE os.disparos TO service_role;


--
-- Name: TABLE empresas; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.empresas TO authenticated;
GRANT ALL ON TABLE os.empresas TO service_role;


--
-- Name: TABLE eventos; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT ON TABLE os.eventos TO authenticated;
GRANT ALL ON TABLE os.eventos TO service_role;


--
-- Name: SEQUENCE eventos_id_seq; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE os.eventos_id_seq TO authenticated;
GRANT SELECT,USAGE ON SEQUENCE os.eventos_id_seq TO service_role;


--
-- Name: TABLE feriados; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.feriados TO authenticated;
GRANT ALL ON TABLE os.feriados TO service_role;


--
-- Name: TABLE leituras; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT ON TABLE os.leituras TO authenticated;
GRANT ALL ON TABLE os.leituras TO service_role;


--
-- Name: TABLE lojas; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.lojas TO authenticated;
GRANT ALL ON TABLE os.lojas TO service_role;


--
-- Name: TABLE materiais; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.materiais TO authenticated;
GRANT ALL ON TABLE os.materiais TO service_role;


--
-- Name: TABLE material_valores; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.material_valores TO authenticated;
GRANT ALL ON TABLE os.material_valores TO service_role;


--
-- Name: TABLE metas; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.metas TO authenticated;
GRANT ALL ON TABLE os.metas TO service_role;


--
-- Name: TABLE modelo_itens; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.modelo_itens TO authenticated;
GRANT ALL ON TABLE os.modelo_itens TO service_role;


--
-- Name: TABLE modelos; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.modelos TO authenticated;
GRANT ALL ON TABLE os.modelos TO service_role;


--
-- Name: TABLE notificacoes; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT ON TABLE os.notificacoes TO authenticated;
GRANT ALL ON TABLE os.notificacoes TO service_role;


--
-- Name: COLUMN notificacoes.lida_em; Type: ACL; Schema: os; Owner: -
--

GRANT UPDATE(lida_em) ON TABLE os.notificacoes TO authenticated;


--
-- Name: SEQUENCE notificacoes_id_seq; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE os.notificacoes_id_seq TO authenticated;
GRANT SELECT,USAGE ON SEQUENCE os.notificacoes_id_seq TO service_role;


--
-- Name: SEQUENCE ordem_numero_seq; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE os.ordem_numero_seq TO authenticated;
GRANT SELECT,USAGE ON SEQUENCE os.ordem_numero_seq TO service_role;


--
-- Name: TABLE ordem_profissionais; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.ordem_profissionais TO authenticated;
GRANT ALL ON TABLE os.ordem_profissionais TO service_role;


--
-- Name: TABLE ordens; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.ordens TO authenticated;
GRANT ALL ON TABLE os.ordens TO service_role;


--
-- Name: TABLE os_custos; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.os_custos TO authenticated;
GRANT ALL ON TABLE os.os_custos TO service_role;


--
-- Name: TABLE parametros; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,UPDATE ON TABLE os.parametros TO authenticated;
GRANT ALL ON TABLE os.parametros TO service_role;


--
-- Name: TABLE participantes; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.participantes TO authenticated;
GRANT ALL ON TABLE os.participantes TO service_role;


--
-- Name: TABLE planos_preventivos; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.planos_preventivos TO authenticated;
GRANT ALL ON TABLE os.planos_preventivos TO service_role;


--
-- Name: TABLE portal_links; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.portal_links TO authenticated;
GRANT ALL ON TABLE os.portal_links TO service_role;


--
-- Name: TABLE portal_sessoes; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,UPDATE ON TABLE os.portal_sessoes TO authenticated;
GRANT ALL ON TABLE os.portal_sessoes TO service_role;


--
-- Name: TABLE portal_tentativas; Type: ACL; Schema: os; Owner: -
--

GRANT ALL ON TABLE os.portal_tentativas TO service_role;


--
-- Name: TABLE profissionais; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.profissionais TO authenticated;
GRANT ALL ON TABLE os.profissionais TO service_role;


--
-- Name: TABLE sessao_tecnicos; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.sessao_tecnicos TO authenticated;
GRANT ALL ON TABLE os.sessao_tecnicos TO service_role;


--
-- Name: TABLE sessoes; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.sessoes TO authenticated;
GRANT ALL ON TABLE os.sessoes TO service_role;


--
-- Name: TABLE setor_membros; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.setor_membros TO authenticated;
GRANT ALL ON TABLE os.setor_membros TO service_role;


--
-- Name: TABLE setores; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.setores TO authenticated;
GRANT ALL ON TABLE os.setores TO service_role;


--
-- Name: TABLE tecnico_valores; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.tecnico_valores TO authenticated;
GRANT ALL ON TABLE os.tecnico_valores TO service_role;


--
-- Name: TABLE tecnicos; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.tecnicos TO authenticated;
GRANT ALL ON TABLE os.tecnicos TO service_role;


--
-- Name: TABLE terceirizado_links; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.terceirizado_links TO authenticated;
GRANT ALL ON TABLE os.terceirizado_links TO service_role;


--
-- Name: TABLE vistoria_ambientes; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.vistoria_ambientes TO authenticated;
GRANT ALL ON TABLE os.vistoria_ambientes TO service_role;


--
-- Name: TABLE vistorias; Type: ACL; Schema: os; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE os.vistorias TO authenticated;
GRANT ALL ON TABLE os.vistorias TO service_role;


--
-- Name: TABLE afastamentos; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT ON TABLE rh.afastamentos TO authenticated;
GRANT ALL ON TABLE rh.afastamentos TO service_role;


--
-- Name: TABLE banco_horas_fechamentos; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT,DELETE ON TABLE rh.banco_horas_fechamentos TO authenticated;
GRANT ALL ON TABLE rh.banco_horas_fechamentos TO service_role;


--
-- Name: COLUMN banco_horas_fechamentos.ciclo_id; Type: ACL; Schema: rh; Owner: -
--

GRANT INSERT(ciclo_id) ON TABLE rh.banco_horas_fechamentos TO authenticated;


--
-- Name: COLUMN banco_horas_fechamentos.colaborador_id; Type: ACL; Schema: rh; Owner: -
--

GRANT INSERT(colaborador_id) ON TABLE rh.banco_horas_fechamentos TO authenticated;


--
-- Name: COLUMN banco_horas_fechamentos.saldo_min; Type: ACL; Schema: rh; Owner: -
--

GRANT INSERT(saldo_min) ON TABLE rh.banco_horas_fechamentos TO authenticated;


--
-- Name: COLUMN banco_horas_fechamentos.salario_hora; Type: ACL; Schema: rh; Owner: -
--

GRANT INSERT(salario_hora) ON TABLE rh.banco_horas_fechamentos TO authenticated;


--
-- Name: COLUMN banco_horas_fechamentos.valor_calculado; Type: ACL; Schema: rh; Owner: -
--

GRANT INSERT(valor_calculado) ON TABLE rh.banco_horas_fechamentos TO authenticated;


--
-- Name: COLUMN banco_horas_fechamentos.acao; Type: ACL; Schema: rh; Owner: -
--

GRANT INSERT(acao),UPDATE(acao) ON TABLE rh.banco_horas_fechamentos TO authenticated;


--
-- Name: COLUMN banco_horas_fechamentos.valor_realizado; Type: ACL; Schema: rh; Owner: -
--

GRANT INSERT(valor_realizado),UPDATE(valor_realizado) ON TABLE rh.banco_horas_fechamentos TO authenticated;


--
-- Name: TABLE beneficio_contratos; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rh.beneficio_contratos TO authenticated;
GRANT ALL ON TABLE rh.beneficio_contratos TO service_role;


--
-- Name: TABLE beneficio_totais_mensais; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rh.beneficio_totais_mensais TO authenticated;
GRANT ALL ON TABLE rh.beneficio_totais_mensais TO service_role;


--
-- Name: TABLE beneficio_valores_mensais; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rh.beneficio_valores_mensais TO authenticated;
GRANT ALL ON TABLE rh.beneficio_valores_mensais TO service_role;


--
-- Name: TABLE beneficios; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rh.beneficios TO authenticated;
GRANT ALL ON TABLE rh.beneficios TO service_role;


--
-- Name: TABLE cargos; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rh.cargos TO authenticated;
GRANT ALL ON TABLE rh.cargos TO service_role;


--
-- Name: TABLE categorias_gasto; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT ON TABLE rh.categorias_gasto TO authenticated;
GRANT ALL ON TABLE rh.categorias_gasto TO service_role;


--
-- Name: COLUMN categorias_gasto.nome; Type: ACL; Schema: rh; Owner: -
--

GRANT INSERT(nome),UPDATE(nome) ON TABLE rh.categorias_gasto TO authenticated;


--
-- Name: COLUMN categorias_gasto.ativa; Type: ACL; Schema: rh; Owner: -
--

GRANT INSERT(ativa),UPDATE(ativa) ON TABLE rh.categorias_gasto TO authenticated;


--
-- Name: TABLE colaborador_beneficios; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rh.colaborador_beneficios TO authenticated;
GRANT ALL ON TABLE rh.colaborador_beneficios TO service_role;


--
-- Name: TABLE colaboradores; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rh.colaboradores TO authenticated;
GRANT ALL ON TABLE rh.colaboradores TO service_role;


--
-- Name: TABLE custos_colaborador; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT ON TABLE rh.custos_colaborador TO authenticated;
GRANT ALL ON TABLE rh.custos_colaborador TO service_role;


--
-- Name: TABLE dados_financeiros_mensais; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rh.dados_financeiros_mensais TO authenticated;
GRANT ALL ON TABLE rh.dados_financeiros_mensais TO service_role;


--
-- Name: TABLE departamentos; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rh.departamentos TO authenticated;
GRANT ALL ON TABLE rh.departamentos TO service_role;


--
-- Name: TABLE dependentes; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT ON TABLE rh.dependentes TO authenticated;
GRANT ALL ON TABLE rh.dependentes TO service_role;


--
-- Name: TABLE encargos_por_contrato; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rh.encargos_por_contrato TO authenticated;
GRANT ALL ON TABLE rh.encargos_por_contrato TO service_role;


--
-- Name: TABLE folha_colaboradores; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rh.folha_colaboradores TO authenticated;
GRANT ALL ON TABLE rh.folha_colaboradores TO service_role;


--
-- Name: TABLE folha_rubricas; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rh.folha_rubricas TO authenticated;
GRANT ALL ON TABLE rh.folha_rubricas TO service_role;


--
-- Name: SEQUENCE folha_rubricas_id_seq; Type: ACL; Schema: rh; Owner: -
--

GRANT USAGE ON SEQUENCE rh.folha_rubricas_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE rh.folha_rubricas_id_seq TO service_role;


--
-- Name: TABLE folhas; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rh.folhas TO authenticated;
GRANT ALL ON TABLE rh.folhas TO service_role;


--
-- Name: TABLE gastos; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT,DELETE ON TABLE rh.gastos TO authenticated;
GRANT ALL ON TABLE rh.gastos TO service_role;


--
-- Name: COLUMN gastos.data; Type: ACL; Schema: rh; Owner: -
--

GRANT INSERT(data),UPDATE(data) ON TABLE rh.gastos TO authenticated;


--
-- Name: COLUMN gastos.valor; Type: ACL; Schema: rh; Owner: -
--

GRANT INSERT(valor),UPDATE(valor) ON TABLE rh.gastos TO authenticated;


--
-- Name: COLUMN gastos.categoria_id; Type: ACL; Schema: rh; Owner: -
--

GRANT INSERT(categoria_id),UPDATE(categoria_id) ON TABLE rh.gastos TO authenticated;


--
-- Name: COLUMN gastos.descricao; Type: ACL; Schema: rh; Owner: -
--

GRANT INSERT(descricao),UPDATE(descricao) ON TABLE rh.gastos TO authenticated;


--
-- Name: COLUMN gastos.finalidade; Type: ACL; Schema: rh; Owner: -
--

GRANT INSERT(finalidade),UPDATE(finalidade) ON TABLE rh.gastos TO authenticated;


--
-- Name: COLUMN gastos.observacao; Type: ACL; Schema: rh; Owner: -
--

GRANT INSERT(observacao),UPDATE(observacao) ON TABLE rh.gastos TO authenticated;


--
-- Name: TABLE jornadas; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rh.jornadas TO authenticated;
GRANT ALL ON TABLE rh.jornadas TO service_role;


--
-- Name: TABLE motivos_desligamento; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rh.motivos_desligamento TO authenticated;
GRANT ALL ON TABLE rh.motivos_desligamento TO service_role;


--
-- Name: TABLE notas_pj; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rh.notas_pj TO authenticated;
GRANT ALL ON TABLE rh.notas_pj TO service_role;


--
-- Name: TABLE parametros_empresa; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rh.parametros_empresa TO authenticated;
GRANT ALL ON TABLE rh.parametros_empresa TO service_role;


--
-- Name: TABLE parametros_turnover; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rh.parametros_turnover TO authenticated;
GRANT ALL ON TABLE rh.parametros_turnover TO service_role;


--
-- Name: TABLE plano_coparticipacao; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rh.plano_coparticipacao TO authenticated;
GRANT ALL ON TABLE rh.plano_coparticipacao TO service_role;


--
-- Name: TABLE plano_faixas_etarias; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rh.plano_faixas_etarias TO authenticated;
GRANT ALL ON TABLE rh.plano_faixas_etarias TO service_role;


--
-- Name: TABLE plano_tabelas; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rh.plano_tabelas TO authenticated;
GRANT ALL ON TABLE rh.plano_tabelas TO service_role;


--
-- Name: TABLE ponto_diario; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT ON TABLE rh.ponto_diario TO authenticated;
GRANT ALL ON TABLE rh.ponto_diario TO service_role;


--
-- Name: TABLE ponto_mensal; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT ON TABLE rh.ponto_mensal TO authenticated;
GRANT ALL ON TABLE rh.ponto_mensal TO service_role;


--
-- Name: TABLE rubricas; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE rh.rubricas TO authenticated;
GRANT ALL ON TABLE rh.rubricas TO service_role;


--
-- Name: TABLE valores_pj; Type: ACL; Schema: rh; Owner: -
--

GRANT SELECT ON TABLE rh.valores_pj TO authenticated;
GRANT ALL ON TABLE rh.valores_pj TO service_role;


--
-- Name: TABLE acoes; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT,DELETE ON TABLE sustentabilidade.acoes TO authenticated;
GRANT ALL ON TABLE sustentabilidade.acoes TO service_role;


--
-- Name: COLUMN acoes.id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(id) ON TABLE sustentabilidade.acoes TO authenticated;


--
-- Name: COLUMN acoes.participante_id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(participante_id) ON TABLE sustentabilidade.acoes TO authenticated;


--
-- Name: COLUMN acoes.data; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(data),UPDATE(data) ON TABLE sustentabilidade.acoes TO authenticated;


--
-- Name: COLUMN acoes.tipo; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(tipo),UPDATE(tipo) ON TABLE sustentabilidade.acoes TO authenticated;


--
-- Name: COLUMN acoes.observacao; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(observacao),UPDATE(observacao) ON TABLE sustentabilidade.acoes TO authenticated;


--
-- Name: COLUMN acoes.criado_por; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(criado_por) ON TABLE sustentabilidade.acoes TO authenticated;


--
-- Name: TABLE cadastros_lista; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT,DELETE ON TABLE sustentabilidade.cadastros_lista TO authenticated;
GRANT ALL ON TABLE sustentabilidade.cadastros_lista TO service_role;


--
-- Name: COLUMN cadastros_lista.id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(id) ON TABLE sustentabilidade.cadastros_lista TO authenticated;


--
-- Name: COLUMN cadastros_lista.programa_id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(programa_id) ON TABLE sustentabilidade.cadastros_lista TO authenticated;


--
-- Name: COLUMN cadastros_lista.campo_id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(campo_id) ON TABLE sustentabilidade.cadastros_lista TO authenticated;


--
-- Name: COLUMN cadastros_lista.valor; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(valor),UPDATE(valor) ON TABLE sustentabilidade.cadastros_lista TO authenticated;


--
-- Name: COLUMN cadastros_lista.normalizado; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(normalizado),UPDATE(normalizado) ON TABLE sustentabilidade.cadastros_lista TO authenticated;


--
-- Name: COLUMN cadastros_lista.importacao_id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(importacao_id) ON TABLE sustentabilidade.cadastros_lista TO authenticated;


--
-- Name: COLUMN cadastros_lista.criado_por; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(criado_por) ON TABLE sustentabilidade.cadastros_lista TO authenticated;


--
-- Name: TABLE coletores; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT,DELETE ON TABLE sustentabilidade.coletores TO authenticated;
GRANT ALL ON TABLE sustentabilidade.coletores TO service_role;


--
-- Name: COLUMN coletores.local; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(local),UPDATE(local) ON TABLE sustentabilidade.coletores TO authenticated;


--
-- Name: COLUMN coletores.cor; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(cor),UPDATE(cor) ON TABLE sustentabilidade.coletores TO authenticated;


--
-- Name: COLUMN coletores.conteineres; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(conteineres),UPDATE(conteineres) ON TABLE sustentabilidade.coletores TO authenticated;


--
-- Name: COLUMN coletores.capacidade_l; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(capacidade_l),UPDATE(capacidade_l) ON TABLE sustentabilidade.coletores TO authenticated;


--
-- Name: COLUMN coletores.ativo; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(ativo),UPDATE(ativo) ON TABLE sustentabilidade.coletores TO authenticated;


--
-- Name: COLUMN coletores.ordem; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(ordem),UPDATE(ordem) ON TABLE sustentabilidade.coletores TO authenticated;


--
-- Name: TABLE consolidado_valores; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT,INSERT ON TABLE sustentabilidade.consolidado_valores TO authenticated;
GRANT ALL ON TABLE sustentabilidade.consolidado_valores TO service_role;


--
-- Name: COLUMN consolidado_valores.totais; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(totais) ON TABLE sustentabilidade.consolidado_valores TO authenticated;


--
-- Name: TABLE consolidados; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT ON TABLE sustentabilidade.consolidados TO authenticated;
GRANT ALL ON TABLE sustentabilidade.consolidados TO service_role;


--
-- Name: COLUMN consolidados.ano; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(ano) ON TABLE sustentabilidade.consolidados TO authenticated;


--
-- Name: COLUMN consolidados.totais; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(totais),UPDATE(totais) ON TABLE sustentabilidade.consolidados TO authenticated;


--
-- Name: COLUMN consolidados.situacao; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(situacao) ON TABLE sustentabilidade.consolidados TO authenticated;


--
-- Name: COLUMN consolidados.fechado_por; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(fechado_por),UPDATE(fechado_por) ON TABLE sustentabilidade.consolidados TO authenticated;


--
-- Name: COLUMN consolidados.fechado_em; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(fechado_em) ON TABLE sustentabilidade.consolidados TO authenticated;


--
-- Name: COLUMN consolidados.reaberto_por; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(reaberto_por) ON TABLE sustentabilidade.consolidados TO authenticated;


--
-- Name: COLUMN consolidados.reaberto_em; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(reaberto_em) ON TABLE sustentabilidade.consolidados TO authenticated;


--
-- Name: COLUMN consolidados.reaberto_motivo; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(reaberto_motivo) ON TABLE sustentabilidade.consolidados TO authenticated;


--
-- Name: TABLE contratos; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT ON TABLE sustentabilidade.contratos TO authenticated;
GRANT ALL ON TABLE sustentabilidade.contratos TO service_role;


--
-- Name: COLUMN contratos.ativacao_corrigida; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(ativacao_corrigida) ON TABLE sustentabilidade.contratos TO authenticated;


--
-- Name: COLUMN contratos.ativacao_corrigida_motivo; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(ativacao_corrigida_motivo) ON TABLE sustentabilidade.contratos TO authenticated;


--
-- Name: COLUMN contratos.validade_meses_especifica; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(validade_meses_especifica) ON TABLE sustentabilidade.contratos TO authenticated;


--
-- Name: COLUMN contratos.dispensada_motivo; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(dispensada_motivo) ON TABLE sustentabilidade.contratos TO authenticated;


--
-- Name: TABLE contribuicao_valores; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT,INSERT ON TABLE sustentabilidade.contribuicao_valores TO authenticated;
GRANT ALL ON TABLE sustentabilidade.contribuicao_valores TO service_role;


--
-- Name: COLUMN contribuicao_valores.valor; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(valor) ON TABLE sustentabilidade.contribuicao_valores TO authenticated;


--
-- Name: TABLE contribuicoes; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT,DELETE ON TABLE sustentabilidade.contribuicoes TO authenticated;
GRANT ALL ON TABLE sustentabilidade.contribuicoes TO service_role;


--
-- Name: COLUMN contribuicoes.id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(id) ON TABLE sustentabilidade.contribuicoes TO authenticated;


--
-- Name: COLUMN contribuicoes.participante_id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(participante_id) ON TABLE sustentabilidade.contribuicoes TO authenticated;


--
-- Name: COLUMN contribuicoes.data; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(data),UPDATE(data) ON TABLE sustentabilidade.contribuicoes TO authenticated;


--
-- Name: COLUMN contribuicoes.forma; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(forma),UPDATE(forma) ON TABLE sustentabilidade.contribuicoes TO authenticated;


--
-- Name: COLUMN contribuicoes.competencia; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(competencia),UPDATE(competencia) ON TABLE sustentabilidade.contribuicoes TO authenticated;


--
-- Name: COLUMN contribuicoes.observacao; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(observacao),UPDATE(observacao) ON TABLE sustentabilidade.contribuicoes TO authenticated;


--
-- Name: COLUMN contribuicoes.criado_por; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(criado_por) ON TABLE sustentabilidade.contribuicoes TO authenticated;


--
-- Name: TABLE entrevista_transferencias; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT ON TABLE sustentabilidade.entrevista_transferencias TO authenticated;
GRANT ALL ON TABLE sustentabilidade.entrevista_transferencias TO service_role;


--
-- Name: COLUMN entrevista_transferencias.entrevista_id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(entrevista_id) ON TABLE sustentabilidade.entrevista_transferencias TO authenticated;


--
-- Name: COLUMN entrevista_transferencias.de_contrato_id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(de_contrato_id) ON TABLE sustentabilidade.entrevista_transferencias TO authenticated;


--
-- Name: COLUMN entrevista_transferencias.para_contrato_id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(para_contrato_id) ON TABLE sustentabilidade.entrevista_transferencias TO authenticated;


--
-- Name: COLUMN entrevista_transferencias.motivo; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(motivo) ON TABLE sustentabilidade.entrevista_transferencias TO authenticated;


--
-- Name: COLUMN entrevista_transferencias.quem; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(quem) ON TABLE sustentabilidade.entrevista_transferencias TO authenticated;


--
-- Name: TABLE entrevistas; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT,DELETE ON TABLE sustentabilidade.entrevistas TO authenticated;
GRANT ALL ON TABLE sustentabilidade.entrevistas TO service_role;


--
-- Name: COLUMN entrevistas.id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(id) ON TABLE sustentabilidade.entrevistas TO authenticated;


--
-- Name: COLUMN entrevistas.contrato_id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(contrato_id),UPDATE(contrato_id) ON TABLE sustentabilidade.entrevistas TO authenticated;


--
-- Name: COLUMN entrevistas.lucs; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(lucs),UPDATE(lucs) ON TABLE sustentabilidade.entrevistas TO authenticated;


--
-- Name: COLUMN entrevistas.cliente_doc; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(cliente_doc),UPDATE(cliente_doc) ON TABLE sustentabilidade.entrevistas TO authenticated;


--
-- Name: COLUMN entrevistas.data; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(data),UPDATE(data) ON TABLE sustentabilidade.entrevistas TO authenticated;


--
-- Name: COLUMN entrevistas.tipo; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(tipo),UPDATE(tipo) ON TABLE sustentabilidade.entrevistas TO authenticated;


--
-- Name: COLUMN entrevistas.setor; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(setor),UPDATE(setor) ON TABLE sustentabilidade.entrevistas TO authenticated;


--
-- Name: COLUMN entrevistas.formulario_versao; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(formulario_versao) ON TABLE sustentabilidade.entrevistas TO authenticated;


--
-- Name: COLUMN entrevistas.respostas; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(respostas),UPDATE(respostas) ON TABLE sustentabilidade.entrevistas TO authenticated;


--
-- Name: COLUMN entrevistas.situacao; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(situacao),UPDATE(situacao) ON TABLE sustentabilidade.entrevistas TO authenticated;


--
-- Name: COLUMN entrevistas.rascunho_chave; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(rascunho_chave) ON TABLE sustentabilidade.entrevistas TO authenticated;


--
-- Name: COLUMN entrevistas.respondente_nome; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(respondente_nome),UPDATE(respondente_nome) ON TABLE sustentabilidade.entrevistas TO authenticated;


--
-- Name: COLUMN entrevistas.assinatura_respondente; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(assinatura_respondente),UPDATE(assinatura_respondente) ON TABLE sustentabilidade.entrevistas TO authenticated;


--
-- Name: COLUMN entrevistas.assinatura_entrevistador; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(assinatura_entrevistador),UPDATE(assinatura_entrevistador) ON TABLE sustentabilidade.entrevistas TO authenticated;


--
-- Name: COLUMN entrevistas.pdf; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(pdf),UPDATE(pdf) ON TABLE sustentabilidade.entrevistas TO authenticated;


--
-- Name: COLUMN entrevistas.anexos; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(anexos),UPDATE(anexos) ON TABLE sustentabilidade.entrevistas TO authenticated;


--
-- Name: COLUMN entrevistas.origem; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(origem) ON TABLE sustentabilidade.entrevistas TO authenticated;


--
-- Name: COLUMN entrevistas.entrevistador_id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(entrevistador_id) ON TABLE sustentabilidade.entrevistas TO authenticated;


--
-- Name: COLUMN entrevistas.chamado_id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(chamado_id) ON TABLE sustentabilidade.entrevistas TO authenticated;


--
-- Name: COLUMN entrevistas.valida_ate; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(valida_ate),UPDATE(valida_ate) ON TABLE sustentabilidade.entrevistas TO authenticated;


--
-- Name: COLUMN entrevistas.importacao_id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(importacao_id) ON TABLE sustentabilidade.entrevistas TO authenticated;


--
-- Name: TABLE equivalencias; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT,DELETE ON TABLE sustentabilidade.equivalencias TO authenticated;
GRANT ALL ON TABLE sustentabilidade.equivalencias TO service_role;


--
-- Name: COLUMN equivalencias.nome; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(nome),UPDATE(nome) ON TABLE sustentabilidade.equivalencias TO authenticated;


--
-- Name: COLUMN equivalencias.fator; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(fator),UPDATE(fator) ON TABLE sustentabilidade.equivalencias TO authenticated;


--
-- Name: COLUMN equivalencias.unidade; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(unidade),UPDATE(unidade) ON TABLE sustentabilidade.equivalencias TO authenticated;


--
-- Name: COLUMN equivalencias.confirmado; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(confirmado),UPDATE(confirmado) ON TABLE sustentabilidade.equivalencias TO authenticated;


--
-- Name: TABLE formulario_alteracoes; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT ON TABLE sustentabilidade.formulario_alteracoes TO authenticated;
GRANT ALL ON TABLE sustentabilidade.formulario_alteracoes TO service_role;


--
-- Name: COLUMN formulario_alteracoes.formulario_id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(formulario_id) ON TABLE sustentabilidade.formulario_alteracoes TO authenticated;


--
-- Name: COLUMN formulario_alteracoes.quem; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(quem) ON TABLE sustentabilidade.formulario_alteracoes TO authenticated;


--
-- Name: COLUMN formulario_alteracoes.descricao; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(descricao) ON TABLE sustentabilidade.formulario_alteracoes TO authenticated;


--
-- Name: COLUMN formulario_alteracoes.antes; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(antes) ON TABLE sustentabilidade.formulario_alteracoes TO authenticated;


--
-- Name: COLUMN formulario_alteracoes.depois; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(depois) ON TABLE sustentabilidade.formulario_alteracoes TO authenticated;


--
-- Name: TABLE formulario_versoes; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT ON TABLE sustentabilidade.formulario_versoes TO authenticated;
GRANT ALL ON TABLE sustentabilidade.formulario_versoes TO service_role;


--
-- Name: TABLE formularios; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT,DELETE ON TABLE sustentabilidade.formularios TO authenticated;
GRANT ALL ON TABLE sustentabilidade.formularios TO service_role;


--
-- Name: COLUMN formularios.id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(id) ON TABLE sustentabilidade.formularios TO authenticated;


--
-- Name: COLUMN formularios.tipo; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(tipo) ON TABLE sustentabilidade.formularios TO authenticated;


--
-- Name: COLUMN formularios.programa_id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(programa_id) ON TABLE sustentabilidade.formularios TO authenticated;


--
-- Name: COLUMN formularios.nome; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(nome),UPDATE(nome) ON TABLE sustentabilidade.formularios TO authenticated;


--
-- Name: COLUMN formularios.ativo; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(ativo),UPDATE(ativo) ON TABLE sustentabilidade.formularios TO authenticated;


--
-- Name: COLUMN formularios.rascunho; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(rascunho),UPDATE(rascunho) ON TABLE sustentabilidade.formularios TO authenticated;


--
-- Name: COLUMN formularios.rascunho_alterado; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(rascunho_alterado),UPDATE(rascunho_alterado) ON TABLE sustentabilidade.formularios TO authenticated;


--
-- Name: COLUMN formularios.criado_por; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(criado_por) ON TABLE sustentabilidade.formularios TO authenticated;


--
-- Name: TABLE importacoes; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT ON TABLE sustentabilidade.importacoes TO authenticated;
GRANT ALL ON TABLE sustentabilidade.importacoes TO service_role;


--
-- Name: COLUMN importacoes.tipo; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(tipo) ON TABLE sustentabilidade.importacoes TO authenticated;


--
-- Name: COLUMN importacoes.arquivo; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(arquivo) ON TABLE sustentabilidade.importacoes TO authenticated;


--
-- Name: COLUMN importacoes.sha256; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(sha256) ON TABLE sustentabilidade.importacoes TO authenticated;


--
-- Name: COLUMN importacoes.resumo; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(resumo),UPDATE(resumo) ON TABLE sustentabilidade.importacoes TO authenticated;


--
-- Name: COLUMN importacoes.avisos; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(avisos),UPDATE(avisos) ON TABLE sustentabilidade.importacoes TO authenticated;


--
-- Name: COLUMN importacoes.decisoes; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(decisoes),UPDATE(decisoes) ON TABLE sustentabilidade.importacoes TO authenticated;


--
-- Name: COLUMN importacoes.substitui; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(substitui),UPDATE(substitui) ON TABLE sustentabilidade.importacoes TO authenticated;


--
-- Name: COLUMN importacoes.criado_por; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(criado_por) ON TABLE sustentabilidade.importacoes TO authenticated;


--
-- Name: TABLE lancamento_valores; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT,INSERT ON TABLE sustentabilidade.lancamento_valores TO authenticated;
GRANT ALL ON TABLE sustentabilidade.lancamento_valores TO service_role;


--
-- Name: COLUMN lancamento_valores.valores; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(valores) ON TABLE sustentabilidade.lancamento_valores TO authenticated;


--
-- Name: TABLE lancamentos; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT,DELETE ON TABLE sustentabilidade.lancamentos TO authenticated;
GRANT ALL ON TABLE sustentabilidade.lancamentos TO service_role;


--
-- Name: COLUMN lancamentos.id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(id) ON TABLE sustentabilidade.lancamentos TO authenticated;


--
-- Name: COLUMN lancamentos.programa_id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(programa_id) ON TABLE sustentabilidade.lancamentos TO authenticated;


--
-- Name: COLUMN lancamentos.formulario_id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(formulario_id) ON TABLE sustentabilidade.lancamentos TO authenticated;


--
-- Name: COLUMN lancamentos.formulario_versao; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(formulario_versao) ON TABLE sustentabilidade.lancamentos TO authenticated;


--
-- Name: COLUMN lancamentos.data; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(data),UPDATE(data) ON TABLE sustentabilidade.lancamentos TO authenticated;


--
-- Name: COLUMN lancamentos.valores; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(valores),UPDATE(valores) ON TABLE sustentabilidade.lancamentos TO authenticated;


--
-- Name: COLUMN lancamentos.origem; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(origem) ON TABLE sustentabilidade.lancamentos TO authenticated;


--
-- Name: COLUMN lancamentos.lancado_por; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(lancado_por) ON TABLE sustentabilidade.lancamentos TO authenticated;


--
-- Name: COLUMN lancamentos.importacao_id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(importacao_id) ON TABLE sustentabilidade.lancamentos TO authenticated;


--
-- Name: TABLE marcos; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT,DELETE ON TABLE sustentabilidade.marcos TO authenticated;
GRANT ALL ON TABLE sustentabilidade.marcos TO service_role;


--
-- Name: COLUMN marcos.indicador; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(indicador) ON TABLE sustentabilidade.marcos TO authenticated;


--
-- Name: COLUMN marcos.ano; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(ano) ON TABLE sustentabilidade.marcos TO authenticated;


--
-- Name: COLUMN marcos.valor; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(valor),UPDATE(valor) ON TABLE sustentabilidade.marcos TO authenticated;


--
-- Name: TABLE parametros; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT ON TABLE sustentabilidade.parametros TO authenticated;
GRANT ALL ON TABLE sustentabilidade.parametros TO service_role;


--
-- Name: COLUMN parametros.meses_primeira_entrevista; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(meses_primeira_entrevista) ON TABLE sustentabilidade.parametros TO authenticated;


--
-- Name: COLUMN parametros.validade_padrao_meses; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(validade_padrao_meses) ON TABLE sustentabilidade.parametros TO authenticated;


--
-- Name: COLUMN parametros.aviso_dias; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(aviso_dias) ON TABLE sustentabilidade.parametros TO authenticated;


--
-- Name: COLUMN parametros.tipos_loja_dispensados; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(tipos_loja_dispensados) ON TABLE sustentabilidade.parametros TO authenticated;


--
-- Name: COLUMN parametros.data_inauguracao; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(data_inauguracao) ON TABLE sustentabilidade.parametros TO authenticated;


--
-- Name: COLUMN parametros.motivos_dispensa; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(motivos_dispensa) ON TABLE sustentabilidade.parametros TO authenticated;


--
-- Name: COLUMN parametros.clube_formas; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(clube_formas) ON TABLE sustentabilidade.parametros TO authenticated;


--
-- Name: COLUMN parametros.termo_validade_meses; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(termo_validade_meses) ON TABLE sustentabilidade.parametros TO authenticated;


--
-- Name: COLUMN parametros.termo_aviso_dias; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(termo_aviso_dias) ON TABLE sustentabilidade.parametros TO authenticated;


--
-- Name: COLUMN parametros.formas_contribuicao; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(formas_contribuicao) ON TABLE sustentabilidade.parametros TO authenticated;


--
-- Name: COLUMN parametros.tipos_acao; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(tipos_acao) ON TABLE sustentabilidade.parametros TO authenticated;


--
-- Name: COLUMN parametros.limite_ocupacao_pct; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(limite_ocupacao_pct) ON TABLE sustentabilidade.parametros TO authenticated;


--
-- Name: COLUMN parametros.recolhimento_setor_id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(recolhimento_setor_id) ON TABLE sustentabilidade.parametros TO authenticated;


--
-- Name: COLUMN parametros.rcc_empresas; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(rcc_empresas) ON TABLE sustentabilidade.parametros TO authenticated;


--
-- Name: COLUMN parametros.areas_impacto; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(areas_impacto) ON TABLE sustentabilidade.parametros TO authenticated;


--
-- Name: COLUMN parametros.grupos_impacto; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(grupos_impacto) ON TABLE sustentabilidade.parametros TO authenticated;


--
-- Name: COLUMN parametros.cobranca_dia; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(cobranca_dia) ON TABLE sustentabilidade.parametros TO authenticated;


--
-- Name: COLUMN parametros.unidades; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(unidades) ON TABLE sustentabilidade.parametros TO authenticated;


--
-- Name: COLUMN parametros.atualizado_por; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(atualizado_por) ON TABLE sustentabilidade.parametros TO authenticated;


--
-- Name: TABLE parametros_valores; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT ON TABLE sustentabilidade.parametros_valores TO authenticated;
GRANT ALL ON TABLE sustentabilidade.parametros_valores TO service_role;


--
-- Name: COLUMN parametros_valores.tour_custo_album; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(tour_custo_album) ON TABLE sustentabilidade.parametros_valores TO authenticated;


--
-- Name: COLUMN parametros_valores.tour_custo_copo; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(tour_custo_copo) ON TABLE sustentabilidade.parametros_valores TO authenticated;


--
-- Name: TABLE participante_contatos; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT,DELETE ON TABLE sustentabilidade.participante_contatos TO authenticated;
GRANT ALL ON TABLE sustentabilidade.participante_contatos TO service_role;


--
-- Name: COLUMN participante_contatos.participante_id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(participante_id) ON TABLE sustentabilidade.participante_contatos TO authenticated;


--
-- Name: COLUMN participante_contatos.email; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(email),UPDATE(email) ON TABLE sustentabilidade.participante_contatos TO authenticated;


--
-- Name: COLUMN participante_contatos.telefone; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(telefone),UPDATE(telefone) ON TABLE sustentabilidade.participante_contatos TO authenticated;


--
-- Name: COLUMN participante_contatos.contato; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(contato),UPDATE(contato) ON TABLE sustentabilidade.participante_contatos TO authenticated;


--
-- Name: TABLE participante_valores; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT,DELETE ON TABLE sustentabilidade.participante_valores TO authenticated;
GRANT ALL ON TABLE sustentabilidade.participante_valores TO service_role;


--
-- Name: COLUMN participante_valores.participante_id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(participante_id) ON TABLE sustentabilidade.participante_valores TO authenticated;


--
-- Name: COLUMN participante_valores.valor_combinado_mes; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(valor_combinado_mes),UPDATE(valor_combinado_mes) ON TABLE sustentabilidade.participante_valores TO authenticated;


--
-- Name: TABLE participantes; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT ON TABLE sustentabilidade.participantes TO authenticated;
GRANT ALL ON TABLE sustentabilidade.participantes TO service_role;


--
-- Name: COLUMN participantes.id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(id) ON TABLE sustentabilidade.participantes TO authenticated;


--
-- Name: COLUMN participantes.cliente_doc; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(cliente_doc),UPDATE(cliente_doc) ON TABLE sustentabilidade.participantes TO authenticated;


--
-- Name: COLUMN participantes.nome; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(nome),UPDATE(nome) ON TABLE sustentabilidade.participantes TO authenticated;


--
-- Name: COLUMN participantes.locatario_manual; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(locatario_manual),UPDATE(locatario_manual) ON TABLE sustentabilidade.participantes TO authenticated;


--
-- Name: COLUMN participantes.formas; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(formas),UPDATE(formas) ON TABLE sustentabilidade.participantes TO authenticated;


--
-- Name: COLUMN participantes.saiu_em; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(saiu_em),UPDATE(saiu_em) ON TABLE sustentabilidade.participantes TO authenticated;


--
-- Name: COLUMN participantes.saiu_motivo; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(saiu_motivo),UPDATE(saiu_motivo) ON TABLE sustentabilidade.participantes TO authenticated;


--
-- Name: COLUMN participantes.interesse; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(interesse),UPDATE(interesse) ON TABLE sustentabilidade.participantes TO authenticated;


--
-- Name: TABLE programa_contatos; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT,DELETE ON TABLE sustentabilidade.programa_contatos TO authenticated;
GRANT ALL ON TABLE sustentabilidade.programa_contatos TO service_role;


--
-- Name: COLUMN programa_contatos.programa_id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(programa_id) ON TABLE sustentabilidade.programa_contatos TO authenticated;


--
-- Name: COLUMN programa_contatos.email; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(email),UPDATE(email) ON TABLE sustentabilidade.programa_contatos TO authenticated;


--
-- Name: COLUMN programa_contatos.telefone; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(telefone),UPDATE(telefone) ON TABLE sustentabilidade.programa_contatos TO authenticated;


--
-- Name: COLUMN programa_contatos.contato; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(contato),UPDATE(contato) ON TABLE sustentabilidade.programa_contatos TO authenticated;


--
-- Name: TABLE programa_indicadores; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT,DELETE ON TABLE sustentabilidade.programa_indicadores TO authenticated;
GRANT ALL ON TABLE sustentabilidade.programa_indicadores TO service_role;


--
-- Name: COLUMN programa_indicadores.id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(id) ON TABLE sustentabilidade.programa_indicadores TO authenticated;


--
-- Name: COLUMN programa_indicadores.programa_id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(programa_id) ON TABLE sustentabilidade.programa_indicadores TO authenticated;


--
-- Name: COLUMN programa_indicadores.nome; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(nome),UPDATE(nome) ON TABLE sustentabilidade.programa_indicadores TO authenticated;


--
-- Name: COLUMN programa_indicadores.formulario_id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(formulario_id),UPDATE(formulario_id) ON TABLE sustentabilidade.programa_indicadores TO authenticated;


--
-- Name: COLUMN programa_indicadores.campo_id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(campo_id),UPDATE(campo_id) ON TABLE sustentabilidade.programa_indicadores TO authenticated;


--
-- Name: COLUMN programa_indicadores.calculo; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(calculo),UPDATE(calculo) ON TABLE sustentabilidade.programa_indicadores TO authenticated;


--
-- Name: COLUMN programa_indicadores.filtro; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(filtro),UPDATE(filtro) ON TABLE sustentabilidade.programa_indicadores TO authenticated;


--
-- Name: COLUMN programa_indicadores.percentual_valor; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(percentual_valor),UPDATE(percentual_valor) ON TABLE sustentabilidade.programa_indicadores TO authenticated;


--
-- Name: COLUMN programa_indicadores.unidade; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(unidade),UPDATE(unidade) ON TABLE sustentabilidade.programa_indicadores TO authenticated;


--
-- Name: COLUMN programa_indicadores.grupo; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(grupo),UPDATE(grupo) ON TABLE sustentabilidade.programa_indicadores TO authenticated;


--
-- Name: COLUMN programa_indicadores.mostrar_painel; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(mostrar_painel),UPDATE(mostrar_painel) ON TABLE sustentabilidade.programa_indicadores TO authenticated;


--
-- Name: COLUMN programa_indicadores.em_reais; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(em_reais),UPDATE(em_reais) ON TABLE sustentabilidade.programa_indicadores TO authenticated;


--
-- Name: COLUMN programa_indicadores.ativo; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(ativo),UPDATE(ativo) ON TABLE sustentabilidade.programa_indicadores TO authenticated;


--
-- Name: COLUMN programa_indicadores.ordem; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(ordem),UPDATE(ordem) ON TABLE sustentabilidade.programa_indicadores TO authenticated;


--
-- Name: TABLE programa_links; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT ON TABLE sustentabilidade.programa_links TO authenticated;
GRANT ALL ON TABLE sustentabilidade.programa_links TO service_role;


--
-- Name: COLUMN programa_links.id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(id) ON TABLE sustentabilidade.programa_links TO authenticated;


--
-- Name: COLUMN programa_links.programa_id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(programa_id) ON TABLE sustentabilidade.programa_links TO authenticated;


--
-- Name: COLUMN programa_links.token_hash; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(token_hash) ON TABLE sustentabilidade.programa_links TO authenticated;


--
-- Name: COLUMN programa_links.criado_por; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(criado_por) ON TABLE sustentabilidade.programa_links TO authenticated;


--
-- Name: COLUMN programa_links.desligado_em; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(desligado_em) ON TABLE sustentabilidade.programa_links TO authenticated;


--
-- Name: COLUMN programa_links.desligado_por; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(desligado_por) ON TABLE sustentabilidade.programa_links TO authenticated;


--
-- Name: TABLE programas; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT,DELETE ON TABLE sustentabilidade.programas TO authenticated;
GRANT ALL ON TABLE sustentabilidade.programas TO service_role;


--
-- Name: COLUMN programas.id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(id) ON TABLE sustentabilidade.programas TO authenticated;


--
-- Name: COLUMN programas.nome; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(nome),UPDATE(nome) ON TABLE sustentabilidade.programas TO authenticated;


--
-- Name: COLUMN programas.descricao; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(descricao),UPDATE(descricao) ON TABLE sustentabilidade.programas TO authenticated;


--
-- Name: COLUMN programas.area; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(area),UPDATE(area) ON TABLE sustentabilidade.programas TO authenticated;


--
-- Name: COLUMN programas.parceiro_nome; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(parceiro_nome),UPDATE(parceiro_nome) ON TABLE sustentabilidade.programas TO authenticated;


--
-- Name: COLUMN programas.parceiro_doc; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(parceiro_doc),UPDATE(parceiro_doc) ON TABLE sustentabilidade.programas TO authenticated;


--
-- Name: COLUMN programas.inicio; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(inicio),UPDATE(inicio) ON TABLE sustentabilidade.programas TO authenticated;


--
-- Name: COLUMN programas.fim; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(fim),UPDATE(fim) ON TABLE sustentabilidade.programas TO authenticated;


--
-- Name: COLUMN programas.frequencia; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(frequencia),UPDATE(frequencia) ON TABLE sustentabilidade.programas TO authenticated;


--
-- Name: COLUMN programas.ativo; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(ativo),UPDATE(ativo) ON TABLE sustentabilidade.programas TO authenticated;


--
-- Name: TABLE rcc_fatores; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT,DELETE ON TABLE sustentabilidade.rcc_fatores TO authenticated;
GRANT ALL ON TABLE sustentabilidade.rcc_fatores TO service_role;


--
-- Name: COLUMN rcc_fatores.vigente_desde; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(vigente_desde),UPDATE(vigente_desde) ON TABLE sustentabilidade.rcc_fatores TO authenticated;


--
-- Name: COLUMN rcc_fatores.toneladas_por_cacamba; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(toneladas_por_cacamba),UPDATE(toneladas_por_cacamba) ON TABLE sustentabilidade.rcc_fatores TO authenticated;


--
-- Name: COLUMN rcc_fatores.volume_m3; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(volume_m3),UPDATE(volume_m3) ON TABLE sustentabilidade.rcc_fatores TO authenticated;


--
-- Name: COLUMN rcc_fatores.criado_por; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(criado_por) ON TABLE sustentabilidade.rcc_fatores TO authenticated;


--
-- Name: TABLE rcc_nota_valores; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT,INSERT,DELETE ON TABLE sustentabilidade.rcc_nota_valores TO authenticated;
GRANT ALL ON TABLE sustentabilidade.rcc_nota_valores TO service_role;


--
-- Name: COLUMN rcc_nota_valores.valor_total; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(valor_total) ON TABLE sustentabilidade.rcc_nota_valores TO authenticated;


--
-- Name: TABLE rcc_notas; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT,DELETE ON TABLE sustentabilidade.rcc_notas TO authenticated;
GRANT ALL ON TABLE sustentabilidade.rcc_notas TO service_role;


--
-- Name: COLUMN rcc_notas.id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(id) ON TABLE sustentabilidade.rcc_notas TO authenticated;


--
-- Name: COLUMN rcc_notas.competencia; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(competencia),UPDATE(competencia) ON TABLE sustentabilidade.rcc_notas TO authenticated;


--
-- Name: COLUMN rcc_notas.empresa; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(empresa),UPDATE(empresa) ON TABLE sustentabilidade.rcc_notas TO authenticated;


--
-- Name: COLUMN rcc_notas.numero; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(numero),UPDATE(numero) ON TABLE sustentabilidade.rcc_notas TO authenticated;


--
-- Name: COLUMN rcc_notas.pdf; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(pdf),UPDATE(pdf) ON TABLE sustentabilidade.rcc_notas TO authenticated;


--
-- Name: COLUMN rcc_notas.cacambas_a; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(cacambas_a),UPDATE(cacambas_a) ON TABLE sustentabilidade.rcc_notas TO authenticated;


--
-- Name: COLUMN rcc_notas.cacambas_b; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(cacambas_b),UPDATE(cacambas_b) ON TABLE sustentabilidade.rcc_notas TO authenticated;


--
-- Name: COLUMN rcc_notas.chamado_id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(chamado_id) ON TABLE sustentabilidade.rcc_notas TO authenticated;


--
-- Name: COLUMN rcc_notas.lancado_por; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(lancado_por) ON TABLE sustentabilidade.rcc_notas TO authenticated;


--
-- Name: TABLE rcc_precos; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT,DELETE ON TABLE sustentabilidade.rcc_precos TO authenticated;
GRANT ALL ON TABLE sustentabilidade.rcc_precos TO service_role;


--
-- Name: COLUMN rcc_precos.vigente_desde; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(vigente_desde),UPDATE(vigente_desde) ON TABLE sustentabilidade.rcc_precos TO authenticated;


--
-- Name: COLUMN rcc_precos.preco_a; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(preco_a),UPDATE(preco_a) ON TABLE sustentabilidade.rcc_precos TO authenticated;


--
-- Name: COLUMN rcc_precos.preco_b; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(preco_b),UPDATE(preco_b) ON TABLE sustentabilidade.rcc_precos TO authenticated;


--
-- Name: COLUMN rcc_precos.criado_por; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(criado_por) ON TABLE sustentabilidade.rcc_precos TO authenticated;


--
-- Name: TABLE ronda_itens; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT,INSERT,DELETE ON TABLE sustentabilidade.ronda_itens TO authenticated;
GRANT ALL ON TABLE sustentabilidade.ronda_itens TO service_role;


--
-- Name: COLUMN ronda_itens.conteineres; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(conteineres) ON TABLE sustentabilidade.ronda_itens TO authenticated;


--
-- Name: COLUMN ronda_itens.ocupacao_pct; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(ocupacao_pct) ON TABLE sustentabilidade.ronda_itens TO authenticated;


--
-- Name: COLUMN ronda_itens.observacao; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(observacao) ON TABLE sustentabilidade.ronda_itens TO authenticated;


--
-- Name: COLUMN ronda_itens.foto; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT UPDATE(foto) ON TABLE sustentabilidade.ronda_itens TO authenticated;


--
-- Name: TABLE rondas; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT,DELETE ON TABLE sustentabilidade.rondas TO authenticated;
GRANT ALL ON TABLE sustentabilidade.rondas TO service_role;


--
-- Name: COLUMN rondas.id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(id) ON TABLE sustentabilidade.rondas TO authenticated;


--
-- Name: COLUMN rondas.data_hora; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(data_hora),UPDATE(data_hora) ON TABLE sustentabilidade.rondas TO authenticated;


--
-- Name: COLUMN rondas.chamado_id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(chamado_id) ON TABLE sustentabilidade.rondas TO authenticated;


--
-- Name: COLUMN rondas.observacao; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(observacao),UPDATE(observacao) ON TABLE sustentabilidade.rondas TO authenticated;


--
-- Name: COLUMN rondas.foto; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(foto),UPDATE(foto) ON TABLE sustentabilidade.rondas TO authenticated;


--
-- Name: COLUMN rondas.lancado_por; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(lancado_por) ON TABLE sustentabilidade.rondas TO authenticated;


--
-- Name: TABLE setor_validades; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT,DELETE ON TABLE sustentabilidade.setor_validades TO authenticated;
GRANT ALL ON TABLE sustentabilidade.setor_validades TO service_role;


--
-- Name: COLUMN setor_validades.setor; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(setor),UPDATE(setor) ON TABLE sustentabilidade.setor_validades TO authenticated;


--
-- Name: COLUMN setor_validades.meses; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(meses),UPDATE(meses) ON TABLE sustentabilidade.setor_validades TO authenticated;


--
-- Name: TABLE termos; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT SELECT,DELETE ON TABLE sustentabilidade.termos TO authenticated;
GRANT ALL ON TABLE sustentabilidade.termos TO service_role;


--
-- Name: COLUMN termos.id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(id) ON TABLE sustentabilidade.termos TO authenticated;


--
-- Name: COLUMN termos.participante_id; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(participante_id) ON TABLE sustentabilidade.termos TO authenticated;


--
-- Name: COLUMN termos.ano; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(ano),UPDATE(ano) ON TABLE sustentabilidade.termos TO authenticated;


--
-- Name: COLUMN termos.assinado_em; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(assinado_em),UPDATE(assinado_em) ON TABLE sustentabilidade.termos TO authenticated;


--
-- Name: COLUMN termos.valido_ate; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(valido_ate),UPDATE(valido_ate) ON TABLE sustentabilidade.termos TO authenticated;


--
-- Name: COLUMN termos.arquivo; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(arquivo),UPDATE(arquivo) ON TABLE sustentabilidade.termos TO authenticated;


--
-- Name: COLUMN termos.assinatura; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(assinatura),UPDATE(assinatura) ON TABLE sustentabilidade.termos TO authenticated;


--
-- Name: COLUMN termos.criado_por; Type: ACL; Schema: sustentabilidade; Owner: -
--

GRANT INSERT(criado_por) ON TABLE sustentabilidade.termos TO authenticated;


--
-- PostgreSQL database dump complete
--


