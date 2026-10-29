-- As ferramentas do Marketing passam de 9 para 5 acessos: um login do Google
-- (Ads, Analytics 4, Search Console, YouTube e Perfil da Empresa) e um token
-- da Meta (Ads, Facebook e Instagram), mais TikTok, RD Station e Asana. Nada
-- tinha sido salvo com os nomes antigos; o delete só garante a troca.
-- O teste de Google e Meta tem uma linha por produto: a mensagem guardada
-- passa de 500 para 2000 caracteres.

delete from integracao.credenciais
  where sistema in ('mkt_meta_ads', 'mkt_google_ads', 'mkt_ga4',
    'mkt_redes_meta', 'mkt_youtube', 'mkt_google_perfil');

alter table integracao.credenciais drop constraint credenciais_sistema_check;
alter table integracao.credenciais add constraint credenciais_sistema_check
  check (sistema in (
    'secullum', 'wps', 'diario_de_obras', 'copiloto_rh',
    'mkt_google', 'mkt_meta', 'mkt_tiktok', 'mkt_rd_station', 'mkt_asana'
  ));

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
    teste_mensagem = left(p_mensagem, 2000)
  where sistema = p_sistema;
end;
$$;
