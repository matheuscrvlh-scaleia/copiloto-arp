-- operacoes_quadros: complementos dos quadros de medidores e do termo de
-- autorização de energia (spec 4.5 e 4.6), sobre o contrato de
-- 20261109160000_operacoes.sql.
--
--   * caixas.termo_externo: termo emitido antes do sistema (carga do
--     catálogo, "Tem termo emitido: sim"). A caixa conta como "com termo"
--     até o locatário mudar.
--   * resumo_quadros(): contagem por quadro (caixas, ocupadas, reservadas,
--     livres, sem termo), com o RLS de quem lê (security invoker).
--   * enet_contratos(): contratos vigentes do ENET (os.lojas) para quem vê
--     os quadros ou emite o termo, sem abrir os.lojas ao módulo inteiro.
--   * registrar_termo(): grava a versão do termo e zera "locatário novo sem
--     termo" na mesma transação, para quem só tem operacoes.energia.termo.
--   * liberar_caixa(): o locatário saiu sem outro entrar: vai para o
--     histórico (sigiloso) e a caixa fica livre ou reservada.
--
-- As duas leituras devolvem jsonb (lista de objetos): o servidor confere
-- com Zod antes de usar.

alter table operacoes.caixas
  add column termo_externo boolean not null default false;
comment on column operacoes.caixas.termo_externo is
  'Termo emitido fora do sistema (carga inicial); vale até a troca de locatário';
grant update (termo_externo) on operacoes.caixas to authenticated;

-- O termo da carga era do locatário de antes: trocou o ocupante, deixa de valer.
create function operacoes.caixa_sem_termo_externo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ocupante is distinct from old.ocupante then
    new.termo_externo := false;
  end if;
  return new;
end;
$$;
revoke all on function operacoes.caixa_sem_termo_externo() from public, anon;

create trigger termo_externo before update of ocupante on operacoes.caixas
  for each row execute function operacoes.caixa_sem_termo_externo();

-- ---------------------------------------------------------------------------
-- Resumo por quadro
-- ---------------------------------------------------------------------------

-- Ocupada sem termo: locatário novo (trocado e ainda sem termo) ou nenhum
-- termo, nem no sistema nem na carga. Security invoker: o RLS de quem lê
-- vale para quadros, caixas e termos.
create function operacoes.resumo_quadros()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
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

-- ---------------------------------------------------------------------------
-- ENET: contratos vigentes por sala (só leitura)
-- ---------------------------------------------------------------------------

-- os.lojas só abre para o módulo de Chamados; aqui sai só o que a tela de
-- energia e o termo usam, para quem tem a permissão de ver os quadros ou de
-- emitir o termo. Sem ela, volta vazio (como o RLS).
create function operacoes.enet_contratos()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
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

-- ---------------------------------------------------------------------------
-- Termo: grava a versão e zera "locatário novo sem termo"
-- ---------------------------------------------------------------------------

-- A versão é a que o servidor usou no nome dos arquivos; se outra pessoa
-- emitiu no meio do caminho, recusa (o servidor gera de novo). Os arquivos
-- ficam na pasta da própria caixa.
create function operacoes.registrar_termo(
  p_caixa uuid,
  p_versao int,
  p_locatario text,
  p_documento text,
  p_qualificacao text,
  p_bloco text,
  p_pavimento text,
  p_sala text,
  p_projeto text,
  p_amperes int,
  p_ligacao text,
  p_armario text,
  p_rota text,
  p_observacao_tecnica text,
  p_data_emissao date,
  p_pdf text,
  p_docx text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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

-- ---------------------------------------------------------------------------
-- Caixa liberada: o locatário saiu e ninguém entrou
-- ---------------------------------------------------------------------------

create function operacoes.liberar_caixa(
  p_caixa uuid,
  p_saida date,
  p_status text default 'livre'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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

-- Funções novas nascem com execute para public: fecha e abre só o que vale.
revoke all on function operacoes.enet_contratos() from public, anon;
revoke all on function operacoes.resumo_quadros() from public, anon;
revoke all on function operacoes.registrar_termo(uuid, int, text, text, text, text, text, text,
  text, int, text, text, text, text, date, text, text) from public, anon;
revoke all on function operacoes.liberar_caixa(uuid, date, text) from public, anon;
grant execute on function operacoes.enet_contratos() to authenticated;
grant execute on function operacoes.resumo_quadros() to authenticated;
grant execute on function operacoes.registrar_termo(uuid, int, text, text, text, text, text, text,
  text, int, text, text, text, text, date, text, text) to authenticated;
grant execute on function operacoes.liberar_caixa(uuid, date, text) to authenticated, service_role;
