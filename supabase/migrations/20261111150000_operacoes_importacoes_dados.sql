-- Importações de Operações: a conta da concessionária de água e a edição do
-- que já foi importado.
--
--   * Tipo novo "agua_conta": a conta do macromedidor (Águas de Nova
--     Friburgo), com o PDF ou a foto da conta guardados como comprovante e os
--     campos lidos dela em operacoes.agua_contas. Uma conta vale por
--     matrícula e mês; importar de novo substitui (a anterior fica guardada e
--     volta se a nova for desfeita), como o mês da água.
--   * Leituras da água importadas podem ser corrigidas ou excluídas uma a
--     uma (e o valor, por quem também vê reais), com auditoria de cada
--     mudança. Só as que valem (vigente): a prévia se refaz enviando de novo.

-- ---------------------------------------------------------------------------
-- Tipo novo
-- ---------------------------------------------------------------------------

alter table operacoes.importacoes drop constraint importacoes_tipo_check;
alter table operacoes.importacoes add constraint importacoes_tipo_check
  check (tipo in ('agua', 'energisa', 'orcamento', 'limpeza', 'agua_conta'));

create table operacoes.agua_contas (
  id uuid primary key default gen_random_uuid(),
  importacao_id uuid not null references operacoes.importacoes (id) on delete cascade,
  -- false enquanto a importação é prévia ou depois que foi desfeita/substituída.
  vigente boolean not null default false,
  referencia date not null check (extract(day from referencia) = 1),
  matricula text not null check (length(btrim(matricula)) between 1 and 40),
  vencimento date,
  data_anterior date,
  data_atual date,
  leitura_anterior numeric(14, 3),
  leitura_atual numeric(14, 3),
  consumo_m3 numeric(14, 3) check (consumo_m3 >= 0),
  valor_agua numeric(14, 2) check (valor_agua >= 0),
  valor_esgoto numeric(14, 2) check (valor_esgoto >= 0),
  total numeric(14, 2) not null check (total >= 0),
  observacao text check (length(observacao) <= 500),
  exemplo boolean not null default false,
  atualizado_em timestamptz not null default now(),
  check (data_anterior is null or data_atual is null or data_anterior <= data_atual)
);
create index agua_contas_importacao on operacoes.agua_contas (importacao_id);
create unique index agua_contas_vigente on operacoes.agua_contas (referencia, matricula)
  where vigente;

create trigger atualizado_em before update on operacoes.agua_contas
  for each row execute function core.set_atualizado_em();
create trigger auditoria after insert or update or delete on operacoes.agua_contas
  for each row execute function core.auditar('id');

-- Leituras e valores corrigidos ou excluídos à mão ficam na auditoria. O
-- que a importação faz (gravar a prévia, confirmar, substituir e desfazer o
-- mês inteiro) não entra: são centenas de linhas por mês, e a própria
-- importação já registra quem fez e quando. Por isso só a leitura que vale
-- e continua valendo (vigente antes e depois) e a exclusão de uma que vale
-- (o desfazer tira a vigência antes de apagar).
create trigger auditoria after update on operacoes.agua_leituras
  for each row when (old.vigente and new.vigente)
  execute function core.auditar('id');
create trigger auditoria_exclusao after delete on operacoes.agua_leituras
  for each row when (old.vigente)
  execute function core.auditar('id');
create trigger auditoria after update on operacoes.agua_valores
  for each row when (old.valor is distinct from new.valor)
  execute function core.auditar('leitura_id');

-- ---------------------------------------------------------------------------
-- Permissões do tipo novo
-- ---------------------------------------------------------------------------

create or replace function operacoes.pode_importar(p_tipo text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_tipo
    when 'agua' then core.pode('operacoes.agua.importar')
    when 'agua_conta' then core.pode('operacoes.agua.importar')
    when 'energisa' then core.pode('operacoes.energia.contas')
    when 'orcamento' then core.pode('operacoes.obras.importar')
    when 'limpeza' then core.pode('operacoes.limpeza.fechar')
    else false
  end;
$$;

create or replace function operacoes.ve_importacao(p_tipo text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select operacoes.pode_importar(p_tipo) or case p_tipo
    when 'agua' then core.pode('operacoes.agua.ver')
    when 'agua_conta' then core.pode('operacoes.agua.ver')
    when 'energisa' then core.pode('operacoes.energia.contas')
    when 'orcamento' then core.pode('operacoes.obras.ver')
    when 'limpeza' then core.pode('operacoes.limpeza.ver')
    else false
  end;
$$;

-- ---------------------------------------------------------------------------
-- Confirmar e desfazer com o tipo novo (o resto igual ao contrato)
-- ---------------------------------------------------------------------------

create or replace function operacoes.confirmar_importacao(p_id uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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

create or replace function operacoes.desfazer_importacao(p_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
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

-- ---------------------------------------------------------------------------
-- RLS e acessos
-- ---------------------------------------------------------------------------

alter table operacoes.agua_contas enable row level security;

-- A conta tem reais: vê quem vê os valores da água ou quem importa.
create policy ver on operacoes.agua_contas for select to authenticated
  using (
    (vigente and (select core.pode('operacoes.agua.valores')))
    or (select core.pode('operacoes.agua.importar'))
  );
create policy criar on operacoes.agua_contas for insert to authenticated
  with check (
    (select core.pode('operacoes.agua.importar')) and not vigente and not exemplo
    and exists (
      select 1 from operacoes.importacoes i
      where i.id = importacao_id and i.tipo = 'agua_conta' and i.status = 'previa'
        and i.criado_por = (select auth.uid())
    )
  );
-- Corrigir um campo lido: a conta que vale ou a própria prévia.
create policy editar on operacoes.agua_contas for update to authenticated
  using (
    (select core.pode('operacoes.agua.importar'))
    and (vigente or exists (
      select 1 from operacoes.importacoes i
      where i.id = importacao_id and i.status = 'previa' and i.criado_por = (select auth.uid())
    ))
  )
  with check ((select core.pode('operacoes.agua.importar')));

-- Leituras da água: corrigir ou excluir só a que vale, quem importa.
create policy editar on operacoes.agua_leituras for update to authenticated
  using ((select core.pode('operacoes.agua.importar')) and vigente)
  with check ((select core.pode('operacoes.agua.importar')) and vigente);
create policy excluir on operacoes.agua_leituras for delete to authenticated
  using ((select core.pode('operacoes.agua.importar')) and vigente);
-- Valor em reais: quem importa e vê reais.
create policy editar on operacoes.agua_valores for update to authenticated
  using (
    (select core.pode('operacoes.agua.importar')) and (select core.pode('operacoes.agua.valores'))
    and exists (select 1 from operacoes.agua_leituras l where l.id = leitura_id and l.vigente)
  )
  with check ((select core.pode('operacoes.agua.importar')) and (select core.pode('operacoes.agua.valores')));

-- O mês da conta é o que a pessoa confere no formulário da prévia (a
-- sugestão lida do PDF pode errar). A política "editar" de importacoes já
-- limita à prévia de quem a criou.
grant update (referencia) on operacoes.importacoes to authenticated;

grant select on operacoes.agua_contas to authenticated;
grant insert (importacao_id, referencia, matricula, vencimento, data_anterior, data_atual,
  leitura_anterior, leitura_atual, consumo_m3, valor_agua, valor_esgoto, total, observacao)
  on operacoes.agua_contas to authenticated;
grant update (referencia, matricula, vencimento, data_anterior, data_atual, leitura_anterior,
  leitura_atual, consumo_m3, valor_agua, valor_esgoto, total, observacao)
  on operacoes.agua_contas to authenticated;
grant all on operacoes.agua_contas to service_role;

grant update (bloco, sala, cliente, hidrometro, data_anterior, leitura_anterior, data_atual,
  leitura_atual, dias, consumo, volume_faturado, tipo, foto)
  on operacoes.agua_leituras to authenticated;
grant delete on operacoes.agua_leituras to authenticated;
grant update (valor) on operacoes.agua_valores to authenticated;
