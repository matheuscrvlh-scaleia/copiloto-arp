-- operacoes_contas: faturas da Energisa (contas da área comum) e a consulta
-- da energia solar. Complementa o contrato (20261109160000_operacoes.sql).
--
--   * energia_faturas.vigente: a fatura vale (a importação foi confirmada).
--     As linhas da prévia já ficam gravadas e não podem aparecer nas telas;
--     quem só tem operacoes.solar.ver não vê operacoes.importacoes, então o
--     filtro não pode depender de ler a importação. Mantida por gatilho:
--     ao inserir (de acordo com a importação) e quando a importação muda de
--     status (confirmar_importacao / desfazer_importacao).
--   * energia_faturas.injetada_kwh: energia injetada na rede, da linha do
--     medidor (unidade que gera). Base da "geração" quando a fonte da solar
--     for a fatura da unidade geradora (parametros.solar_fonte).
--   * Itens com todas as colunas da tabela "Itens da Fatura".
--   * gravar_fatura_energisa: a fatura e os itens da prévia numa transação
--     só, com a sessão (RLS do contrato vale).

alter table operacoes.energia_faturas
  add column injetada_kwh numeric(14, 2) check (injetada_kwh >= 0),
  add column vigente boolean not null default false;

create index energia_faturas_vigentes on operacoes.energia_faturas (referencia, matricula)
  where vigente;

alter table operacoes.energia_fatura_itens
  add column unidade text check (length(unidade) <= 20),
  add column preco_unitario numeric(14, 6),
  add column base_icms numeric(14, 2),
  add column aliquota_icms numeric(6, 2),
  add column tarifa_unitaria numeric(14, 6);

-- Vigente ao inserir: sem importação (carga feita pelo sistema) ou com a
-- importação já confirmada. A prévia entra sempre como não vigente, seja o
-- que for que o cliente mande.
create function operacoes.energia_fatura_vigente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.vigente := new.importacao_id is null or exists (
    select 1 from operacoes.importacoes i
    where i.id = new.importacao_id and i.status = 'confirmada'
  );
  return new;
end;
$$;

create trigger vigente before insert on operacoes.energia_faturas
  for each row execute function operacoes.energia_fatura_vigente();

-- Confirmar liga, desfazer/substituir desliga (o desfazer também apaga).
create function operacoes.energia_importacao_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update operacoes.energia_faturas
    set vigente = (new.status = 'confirmada')
    where importacao_id = new.id and vigente is distinct from (new.status = 'confirmada');
  return null;
end;
$$;

create trigger energia_vigente after update of status on operacoes.importacoes
  for each row when (new.tipo = 'energisa' and old.status is distinct from new.status)
  execute function operacoes.energia_importacao_status();

-- Grava a fatura lida e os itens da prévia (uma transação). Com a sessão:
-- o RLS do contrato confere a permissão, a prévia de quem grava e o
-- importado_por. Chaves de p_fatura e p_itens = nomes das colunas.
create function operacoes.gravar_fatura_energisa(
  p_importacao uuid,
  p_arquivo text,
  p_sha256 text,
  p_fatura jsonb,
  p_itens jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
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

revoke all on function operacoes.energia_fatura_vigente() from public, anon;
revoke all on function operacoes.energia_importacao_status() from public, anon;
revoke all on function operacoes.gravar_fatura_energisa(uuid, text, text, jsonb, jsonb)
  from public, anon;
grant execute on function operacoes.gravar_fatura_energisa(uuid, text, text, jsonb, jsonb)
  to authenticated;
