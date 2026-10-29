-- Acessos das ferramentas do Marketing (Meta Ads, Google Ads, TikTok, GA4 e
-- Search Console, RD Station, Instagram e Facebook, YouTube, Google Perfil
-- da Empresa e Asana) entram em integracao.credenciais, com prefixo mkt_.
-- Quem tem marketing.parametros configura e testa só essas, em Marketing ›
-- Configurações › Integrações; admin.integracoes continua valendo para todas.

alter table integracao.credenciais drop constraint credenciais_sistema_check;
alter table integracao.credenciais add constraint credenciais_sistema_check
  check (sistema in (
    'secullum', 'wps', 'diario_de_obras', 'copiloto_rh',
    'mkt_meta_ads', 'mkt_google_ads', 'mkt_tiktok', 'mkt_ga4',
    'mkt_rd_station', 'mkt_redes_meta', 'mkt_youtube', 'mkt_google_perfil',
    'mkt_asana'
  ));

create function core.pode_integracao(p_sistema text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select core.pode('admin.integracoes'))
    or (p_sistema like 'mkt\_%' and (select core.pode('marketing.parametros')));
$$;

create or replace function core.integracoes_configuradas()
returns table (
  sistema text,
  parametros jsonb,
  ativa boolean,
  configurado_por text,
  configurado_em timestamptz,
  testado_em timestamptz,
  teste_ok boolean,
  teste_mensagem text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.sistema, c.parametros, c.ativa, u.nome, c.configurado_em,
    c.testado_em, c.teste_ok, c.teste_mensagem
  from integracao.credenciais c
  left join core.usuarios u on u.id = c.configurado_por
  where core.pode_integracao(c.sistema)
  order by c.sistema;
$$;

create or replace function core.salvar_integracao(
  p_sistema text,
  p_parametros jsonb,
  p_segredo_cifrado text,
  p_ativa boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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

create or replace function core.registrar_teste_integracao(
  p_sistema text,
  p_ok boolean,
  p_mensagem text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not core.pode_integracao(p_sistema) then
    raise exception 'sem permissão para configurar integrações' using errcode = '42501';
  end if;
  update integracao.credenciais set
    testado_em = now(),
    teste_ok = p_ok,
    teste_mensagem = left(p_mensagem, 500)
  where sistema = p_sistema;
end;
$$;

create or replace function core.remover_integracao(p_sistema text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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

revoke all on function core.pode_integracao(text) from public, anon;
grant execute on function core.pode_integracao(text) to authenticated, service_role;
