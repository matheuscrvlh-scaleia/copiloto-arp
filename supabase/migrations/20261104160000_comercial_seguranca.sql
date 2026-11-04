-- Comercial: correções de segurança e consistência da revisão.
--
-- 1. O token da ficha não sai pela API: a sessão lê todas as colunas de
--    comercial.fichas menos "token" (o servidor entrega o link depois de
--    conferir comercial.formulario.link).
-- 2. Valores do contrato (aluguel, dados com as condições, a cópia da linha
--    em contrato_versoes.conteudo) não saem pela API: o servidor lê pela
--    service role depois do RLS do contrato e só manda com
--    comercial.valores.ver.
-- 3. Ficha pelo link gravada numa transação (comercial.gravar_ficha_pelo_link).
-- 4. Confirmação de importação reserva a prévia (status "confirmando").
-- 6. "Gerado" só a partir de "pronto" (passou pela Revisão).
-- 7. A ficha do contrato tem que existir, já ter sido recebida (recebida ou
--    usada; a lista da etapa Partes mostra as duas) e ser visível a quem grava.
-- 9 e 10. remover_exemplos() não apaga tema do Censo com sugestão real e
--    apaga as fotos de ocupação de exemplo (nova coluna exemplo).
--
-- Coluna nova em comercial.fichas, comercial.contratos ou
-- comercial.contrato_versoes precisa de "grant select (coluna)" para a sessão.

-- ---------------------------------------------------------------------------
-- 1 e 2. Colunas que a sessão lê
-- ---------------------------------------------------------------------------

revoke select on comercial.fichas from authenticated;
grant select (
  id, tipo, situacao, luc, nome, ficha_principal_id, origem, gerada_por, gerada_em,
  expira_em, iniciada_em, consentimento_em, recebida_em, usada_em, ultimo_acesso_em,
  atualizado_em, importacao_id, exemplo, cancelada_em, rd_oportunidade
) on comercial.fichas to authenticated;

revoke select on comercial.contratos from authenticated;
grant select (
  id, tipo, status, versao, etapa_atual, lucs, bloco, area_m2, locatario_nome,
  parte_tipo, garantia, inicio, termino, ficha_id, contrato_enet_id, criado_por,
  criado_em, atualizado_por, atualizado_em, gerado_por, gerado_em, exemplo
) on comercial.contratos to authenticated;

revoke select on comercial.contrato_versoes from authenticated;
grant select (id, contrato_id, versao, status, etapa_atual, por, em)
  on comercial.contrato_versoes to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Ficha pelo link: confere o token e grava ficha e respostas juntas. A
-- linha da ficha fica travada pelo update: duas abas não se sobrepõem e
-- nada é gravado depois de enviada, vencida ou cancelada.
-- ---------------------------------------------------------------------------

create function comercial.gravar_ficha_pelo_link(
  p_token text,
  p_tipo text,
  p_luc text,
  p_nome text,
  p_documento text,
  p_respostas jsonb,
  p_assinatura text,
  p_enviar boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
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

revoke execute on function comercial.gravar_ficha_pelo_link(text, text, text, text, text, jsonb, text, boolean)
  from public, anon, authenticated;
grant execute on function comercial.gravar_ficha_pelo_link(text, text, text, text, text, jsonb, text, boolean)
  to service_role;

-- ---------------------------------------------------------------------------
-- 4. Importação: "confirmando" reserva a prévia enquanto grava; o desfazer
-- também limpa uma confirmação que falhou no meio.
-- ---------------------------------------------------------------------------

alter table comercial.importacoes drop constraint importacoes_status_check;
alter table comercial.importacoes add constraint importacoes_status_check
  check (status in ('previa', 'confirmando', 'confirmada', 'desfeita'));

create or replace function comercial.desfazer_importacao(p_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
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

-- ---------------------------------------------------------------------------
-- 6 e 7. Contrato: gerado só depois de pronto; ficha recebida e visível.
-- Sem security definer: a ficha é procurada com o RLS de quem grava.
-- ---------------------------------------------------------------------------

create function comercial.contrato_conferir()
returns trigger
language plpgsql
set search_path = ''
as $$
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

create trigger conferir before insert or update on comercial.contratos
  for each row execute function comercial.contrato_conferir();

-- ---------------------------------------------------------------------------
-- 10. Fotos de ocupação tiradas do ENET de exemplo
-- ---------------------------------------------------------------------------

alter table comercial.ocupacao_fotos add column exemplo boolean not null default false;

-- ---------------------------------------------------------------------------
-- 9 e 10. Remover dados de exemplo
-- ---------------------------------------------------------------------------

create or replace function comercial.remover_exemplos()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
