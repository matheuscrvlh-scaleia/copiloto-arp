-- Ponto: horas extras, adicional noturno e DSR descontado, que o /Calcular
-- do Secullum já devolve e não eram guardados.
--
-- As horas extras ficam por coluna do Secullum ({"Ex80%": 120, "Ex100%": 30,
-- "ExNot": 0, …}), como os abonos: os percentuais e os tipos dependem da
-- configuração do ponto, então não ficam fixos no banco nem no código.

alter table rh.ponto_mensal
  add column extras_min jsonb not null default '{}',  -- Ex80%, Ex100%, ExNot, ExInt…
  add column noturnas_min int not null default 0,      -- Not.
  add column dsr_debito_min int not null default 0;    -- DSR.Deb

-- Preenche os meses já sincronizados com o cálculo bruto guardado em
-- integracao.registros_brutos (chave "aaaa-mm-01:<id do Secullum>"), sem
-- chamar a API de novo.

-- "176:00" → 10560; "-12:30" → -750; vazio → 0 (igual a horasEmMinutos).
create function pg_temp.minutos(v text)
returns int
language sql
immutable
as $$
  select case
    when coalesce(btrim(v), '') = '' then 0
    else (case when btrim(v) like '-%' then -1 else 1 end)
      * (split_part(ltrim(btrim(v), '-'), ':', 1)::int * 60
         + split_part(ltrim(btrim(v), '-'), ':', 2)::int)
  end
$$;

with brutos as (
  select
    split_part(b.chave_externa, ':', 1)::date as competencia,
    split_part(b.chave_externa, ':', 2)::int as secullum_id,
    b.payload
  from integracao.registros_brutos b
  where b.sistema = 'secullum' and b.recurso = 'calculo_mensal'
),
colunas as (
  select
    br.competencia,
    br.secullum_id,
    c.nome,
    br.payload -> 'Totais' ->> (c.posicao - 1)::int as total
  from brutos br,
    jsonb_array_elements_text(br.payload -> 'Colunas') with ordinality as c (nome, posicao)
),
por_pessoa as (
  select
    competencia,
    secullum_id,
    coalesce(
      jsonb_object_agg(nome, pg_temp.minutos(total)) filter (where nome ~ '^Ex'),
      '{}'
    ) as extras,
    coalesce(sum(pg_temp.minutos(total)) filter (where nome = 'Not.'), 0) as noturnas,
    coalesce(sum(pg_temp.minutos(total)) filter (where nome = 'DSR.Deb'), 0) as dsr
  from colunas
  group by competencia, secullum_id
)
update rh.ponto_mensal p
set
  extras_min = x.extras,
  noturnas_min = x.noturnas,
  dsr_debito_min = x.dsr
from por_pessoa x
join rh.colaboradores c on c.secullum_id = x.secullum_id
where p.colaborador_id = c.id
  and p.competencia = x.competencia;
