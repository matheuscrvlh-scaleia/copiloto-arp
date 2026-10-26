-- Desempenho do RLS do schema rh, do bucket importacoes e índices do rh.
-- Nenhuma regra de acesso muda: quem via (ou mexia em) uma linha continua
-- vendo (ou mexendo), e só isso. Valem as últimas definições das políticas,
-- inclusive as de 20261026120100 (valores_pj e beneficio_contratos).
--
-- 1. Chamada de função que não depende da linha vai dentro de `(select ...)`
--    (InitPlan): o Postgres calcula uma vez por consulta, e não uma vez por
--    linha. `core.pode` e `core.pode_modulo` são security definer e não são
--    expandidas no plano.
-- 2. As políticas `for all` de edição continuam `for all`. A regra de edição
--    do rh é só uma permissão (um InitPlan, tão barata quanto a de leitura) e
--    ela também vale no select: quem tem rh.folha lê folha_colaboradores e
--    folha_rubricas por ela, sem rh.custo_pessoal.individual; separar em
--    insert/update/delete mudaria o que essa pessoa vê.
-- 3. rh.socios() fazia duas subconsultas por colaborador (uma delas em
--    folha_rubricas sem índice pelo colaborador). Agora são três conjuntos
--    calculados uma vez e somados (union), com a mesma resposta.
-- 4. Índices nas chaves estrangeiras e nas colunas de filtro e ordem das
--    telas do RH que não tinham. Chave estrangeira que costuma ficar vazia
--    ganha índice parcial (o `on delete` busca `coluna = id`, que o parcial
--    atende).
--
-- supabase/tests/rh-rls.test.ts compara, para vários perfis, o que cada um
-- vê e grava antes e depois desta migration, e confere no plano que a regra
-- virou InitPlan.

-- ---------------------------------------------------------------------------
-- Cadastros e configuração: qualquer permissão do RH lê; editar exige a
-- permissão da área.
-- ---------------------------------------------------------------------------

alter policy ver on rh.departamentos using ((select core.pode_modulo('rh')));
alter policy editar on rh.departamentos
  using ((select core.pode('rh.parametros')))
  with check ((select core.pode('rh.parametros')));

alter policy ver on rh.cargos using ((select core.pode_modulo('rh')));
alter policy editar on rh.cargos
  using ((select core.pode('rh.parametros')))
  with check ((select core.pode('rh.parametros')));

alter policy ver on rh.motivos_desligamento using ((select core.pode_modulo('rh')));
alter policy editar on rh.motivos_desligamento
  using ((select core.pode('rh.parametros')))
  with check ((select core.pode('rh.parametros')));

alter policy ver on rh.colaboradores using ((select core.pode_modulo('rh')));
alter policy editar on rh.colaboradores
  using ((select core.pode('rh.parametros')))
  with check ((select core.pode('rh.parametros')));

alter policy ver on rh.parametros_empresa using ((select core.pode_modulo('rh')));
alter policy editar on rh.parametros_empresa
  using ((select core.pode('rh.parametros')))
  with check ((select core.pode('rh.parametros')));

alter policy ver on rh.encargos_por_contrato using ((select core.pode_modulo('rh')));
alter policy editar on rh.encargos_por_contrato
  using ((select core.pode('rh.parametros')))
  with check ((select core.pode('rh.parametros')));

alter policy ver on rh.jornadas using ((select core.pode_modulo('rh')));
alter policy editar on rh.jornadas
  using ((select core.pode('rh.parametros')))
  with check ((select core.pode('rh.parametros')));

alter policy ver on rh.parametros_turnover using ((select core.pode_modulo('rh')));
alter policy editar on rh.parametros_turnover
  using ((select core.pode('rh.parametros')))
  with check ((select core.pode('rh.parametros')));

alter policy ver on rh.dados_financeiros_mensais using ((select core.pode_modulo('rh')));
alter policy editar on rh.dados_financeiros_mensais
  using ((select core.pode('rh.parametros')))
  with check ((select core.pode('rh.parametros')));

alter policy ver on rh.orcamento_endomarketing using ((select core.pode_modulo('rh')));
alter policy editar on rh.orcamento_endomarketing
  using ((select core.pode('rh.parametros')))
  with check ((select core.pode('rh.parametros')));

alter policy ver on rh.rubricas using ((select core.pode_modulo('rh')));
alter policy editar on rh.rubricas
  using ((select core.pode('rh.parametros')) or (select core.pode('rh.folha')))
  with check ((select core.pode('rh.parametros')) or (select core.pode('rh.folha')));

alter policy ver on rh.afastamentos using ((select core.pode_modulo('rh')));

-- ---------------------------------------------------------------------------
-- Benefícios e plano de saúde
-- ---------------------------------------------------------------------------

alter policy ver on rh.beneficios using ((select core.pode_modulo('rh')));
alter policy editar on rh.beneficios
  using ((select core.pode('rh.beneficios')))
  with check ((select core.pode('rh.beneficios')));

alter policy ver on rh.colaborador_beneficios using ((select core.pode('rh.beneficios')));
alter policy editar on rh.colaborador_beneficios
  using ((select core.pode('rh.beneficios')))
  with check ((select core.pode('rh.beneficios')));

alter policy ver on rh.beneficio_contratos using ((select core.pode('rh.beneficios')));
alter policy editar on rh.beneficio_contratos
  using ((select core.pode('rh.beneficios')))
  with check ((select core.pode('rh.beneficios')));

alter policy ver on rh.dependentes using ((select core.pode('rh.beneficios')));
alter policy editar on rh.dependentes
  using ((select core.pode('rh.beneficios')))
  with check ((select core.pode('rh.beneficios')));

alter policy ver on rh.plano_tabelas using ((select core.pode_modulo('rh')));
alter policy editar on rh.plano_tabelas
  using ((select core.pode('rh.beneficios')))
  with check ((select core.pode('rh.beneficios')));

alter policy ver on rh.plano_faixas_etarias using ((select core.pode_modulo('rh')));
alter policy editar on rh.plano_faixas_etarias
  using ((select core.pode('rh.beneficios')))
  with check ((select core.pode('rh.beneficios')));

alter policy ver on rh.plano_coparticipacao using ((select core.pode_modulo('rh')));
alter policy editar on rh.plano_coparticipacao
  using ((select core.pode('rh.beneficios')))
  with check ((select core.pode('rh.beneficios')));

-- ---------------------------------------------------------------------------
-- Folha e custo (valores individuais)
-- ---------------------------------------------------------------------------

alter policy ver on rh.folhas using ((select core.pode_modulo('rh')));
alter policy editar on rh.folhas
  using ((select core.pode('rh.folha')))
  with check ((select core.pode('rh.folha')));

alter policy ver on rh.folha_colaboradores
  using ((select core.pode('rh.custo_pessoal.individual')));
alter policy editar on rh.folha_colaboradores
  using ((select core.pode('rh.folha')))
  with check ((select core.pode('rh.folha')));

alter policy ver on rh.folha_rubricas
  using ((select core.pode('rh.custo_pessoal.individual')));
alter policy editar on rh.folha_rubricas
  using ((select core.pode('rh.folha')))
  with check ((select core.pode('rh.folha')));

alter policy ver on rh.custos_colaborador
  using ((select core.pode('rh.custo_pessoal.individual')));

alter policy ver on rh.valores_pj
  using ((select core.pode('rh.custo_pessoal.individual')));

alter policy ver on rh.notas_pj
  using ((select core.pode('rh.custo_pessoal.individual')));
alter policy editar on rh.notas_pj
  using ((select core.pode('rh.parametros')))
  with check ((select core.pode('rh.parametros')));

-- ---------------------------------------------------------------------------
-- Ponto
-- ---------------------------------------------------------------------------

alter policy ver on rh.ponto_mensal
  using (
    (select core.pode('rh.jornada'))
    or (select core.pode('rh.painel'))
    or (select core.pode('rh.funcionarios'))
  );

alter policy ver on rh.ponto_diario
  using (
    (select core.pode('rh.jornada'))
    or (select core.pode('rh.painel'))
    or (select core.pode('rh.funcionarios'))
  );

-- ---------------------------------------------------------------------------
-- Storage: arquivos importados (a pasta diz o tipo; a pasta vem da linha)
-- ---------------------------------------------------------------------------

alter policy importacoes_ver on storage.objects
  using (
    bucket_id = 'importacoes'
    and (
      ((storage.foldername(name))[1] = 'folha' and (select core.pode('rh.folha')))
      or ((storage.foldername(name))[1] = 'plano_saude' and (select core.pode('rh.beneficios')))
    )
  );

alter policy importacoes_enviar on storage.objects
  with check (
    bucket_id = 'importacoes'
    and (
      ((storage.foldername(name))[1] = 'folha' and (select core.pode('rh.folha')))
      or ((storage.foldername(name))[1] = 'plano_saude' and (select core.pode('rh.beneficios')))
    )
  );

-- ---------------------------------------------------------------------------
-- Sócios: os mesmos ids de 20261026120100, por conjuntos. Cada id de
-- folha_colaboradores e de folha_rubricas existe em rh.colaboradores (chave
-- estrangeira), então a soma dos três conjuntos é a lista de antes.
-- ---------------------------------------------------------------------------

create or replace function rh.socios()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
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

-- ---------------------------------------------------------------------------
-- Ponto de um trecho, somado por pessoa no banco (as telas recebiam um dia
-- por pessoa e somavam no servidor). Mesma regra de somarDias
-- (src/lib/rh/ponto-periodo.ts): soma o movimento, o saldo do banco é o do
-- último dia, dias de falta são os dias marcados FALTA. Abonos e extras vêm
-- como pares [coluna, minutos] na ordem em que a soma no servidor criava as
-- chaves (as do primeiro dia, depois as novas de cada dia). Security invoker:
-- o RLS de ponto_diario, colaboradores e departamentos vale como na leitura
-- direta. Quem o RH tirou do ponto fica fora.
-- ---------------------------------------------------------------------------

create function rh.ponto_dos_dias(de date, ate date)
returns table (
  colaborador_id uuid,
  nome text,
  matricula integer,
  departamento_id uuid,
  departamento text,
  primeiro_dia date,
  previstas_min bigint,
  faltas_min bigint,
  atrasos_min bigint,
  faltas_dias bigint,
  abonos_min jsonb,
  extras_min jsonb,
  noturnas_min bigint,
  banco_saldo_min integer,
  banco_creditos_min bigint,
  banco_debitos_min bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
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
$$;

revoke execute on function rh.ponto_dos_dias(date, date) from public, anon;
grant execute on function rh.ponto_dos_dias(date, date) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Índices
-- Já existiam: colaboradores (departamento_id) e as chaves únicas
-- (matricula, secullum_id, copiloto_id); dependentes, colaborador_beneficios,
-- afastamentos, folha_colaboradores e ponto_diario por colaborador_id; jornadas
-- pela chave (departamento_id, cargo_id, colaborador_id, vigente_desde);
-- plano_tabelas (beneficio_id, vigente_desde); folha_colaboradores
-- (folha_id, colaborador_id); folha_rubricas (folha_id, colaborador_id);
-- custos_colaborador (competencia, colaborador_id) e (competencia,
-- departamento_id); ponto_mensal (competencia, colaborador_id).
-- ---------------------------------------------------------------------------

-- colaboradores: chaves estrangeiras e a ordem das listas.
create index colaboradores_cargo on rh.colaboradores (cargo_id) where cargo_id is not null;
create index colaboradores_motivo_desligamento on rh.colaboradores (motivo_desligamento_id)
  where motivo_desligamento_id is not null;
create index colaboradores_nome on rh.colaboradores (nome);

-- jornadas: a chave começa pelo departamento; cargo e funcionário sozinhos.
create index jornadas_cargo on rh.jornadas (cargo_id) where cargo_id is not null;
create index jornadas_colaborador on rh.jornadas (colaborador_id) where colaborador_id is not null;

-- folha: pessoas por cargo e departamento, rubricas por código (sócios,
-- vínculo pela folha) e quem fechou.
create index folha_colaboradores_cargo on rh.folha_colaboradores (cargo_id)
  where cargo_id is not null;
create index folha_colaboradores_departamento on rh.folha_colaboradores (departamento_id)
  where departamento_id is not null;
create index folha_rubricas_rubrica on rh.folha_rubricas (rubrica_codigo);
create index folhas_importacao on rh.folhas (importacao_id) where importacao_id is not null;
create index folhas_fechada_por on rh.folhas (fechada_por) where fechada_por is not null;
create index rubricas_classificada_por on rh.rubricas (classificada_por)
  where classificada_por is not null;

-- custo: a pessoa mês a mês (perfil do funcionário) e as chaves estrangeiras.
create index custos_colaborador_colaborador on rh.custos_colaborador (colaborador_id, competencia desc);
create index custos_colaborador_cargo on rh.custos_colaborador (cargo_id) where cargo_id is not null;
create index custos_colaborador_departamento_id on rh.custos_colaborador (departamento_id)
  where departamento_id is not null;
create index notas_pj_colaborador on rh.notas_pj (colaborador_id);
create index valores_pj_sync_run on rh.valores_pj (sync_run_id) where sync_run_id is not null;

-- ponto: a pessoa mês a mês, o trecho de todos por data e as chaves.
create index ponto_mensal_colaborador on rh.ponto_mensal (colaborador_id, competencia desc);
create index ponto_mensal_departamento on rh.ponto_mensal (departamento_id)
  where departamento_id is not null;
create index ponto_mensal_sync_run on rh.ponto_mensal (sync_run_id) where sync_run_id is not null;
create index ponto_diario_data on rh.ponto_diario (data);
create index ponto_diario_sync_run on rh.ponto_diario (sync_run_id) where sync_run_id is not null;

-- afastamentos de hoje (início até hoje e fim depois dele).
create index afastamentos_fim on rh.afastamentos (fim);

-- benefícios: o vínculo por benefício (a chave única de beneficio_contratos
-- só cobre os em aberto).
create index colaborador_beneficios_beneficio on rh.colaborador_beneficios (beneficio_id);
create index beneficio_contratos_beneficio on rh.beneficio_contratos (beneficio_id);
create index plano_tabelas_importacao on rh.plano_tabelas (importacao_id)
  where importacao_id is not null;
