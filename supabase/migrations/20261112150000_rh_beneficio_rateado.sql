-- Benefício rateado (tarefas do RH de 06/11/2026, item 1): em vez de um valor
-- por funcionário, um valor total do mês dividido entre as pessoas que entram
-- na divisão naquela competência (ex.: massoterapia de R$ 1.200,00 ÷ 45
-- ativos = R$ 26,67 no custo de cada um). Ninguém é vinculado um por um.
-- O bloco de desconto e dependentes e os benefícios "por funcionário" não
-- mudam.

alter table rh.beneficios
  add column forma_calculo text not null default 'por_funcionario'
    check (forma_calculo in ('por_funcionario', 'rateado')),
  -- Quem entra na divisão (só no rateado): todos os ativos, os ativos não
  -- afastados pelo INSS ou um departamento.
  add column dividir_entre text
    check (dividir_entre in ('ativos', 'ativos_nao_afastados', 'departamento')),
  add column dividir_departamento_id uuid
    references rh.departamentos (id) on delete restrict;

alter table rh.beneficios
  add constraint beneficio_rateio check (
    (forma_calculo = 'rateado') = (dividir_entre is not null)
    and (dividir_departamento_id is not null)
      = coalesce(dividir_entre = 'departamento', false)
  ),
  -- Rateado: o valor total do mês é o valor_padrao, ou o lançado no mês.
  add constraint beneficio_rateado_com_valor check (
    forma_calculo <> 'rateado' or valor_por_mes or valor_padrao is not null
  );

comment on column rh.beneficios.valor_padrao is
  'Valor mensal cheio por pessoa; no rateado, o valor total do mês. Null em plano e odonto (tabela de faixas) e no que varia por mês.';

-- Valor total do mês do benefício rateado que varia por mês. Mês sem
-- lançamento repete o último lançado antes dele (como os valores por pessoa).
create table rh.beneficio_totais_mensais (
  id uuid primary key default gen_random_uuid(),
  beneficio_id uuid not null references rh.beneficios (id) on delete restrict,
  competencia core.competencia not null,
  valor numeric(14, 2) not null check (valor >= 0),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (beneficio_id, competencia)
);

create trigger atualizado_em before update on rh.beneficio_totais_mensais
  for each row execute function core.set_atualizado_em();
create trigger auditoria after insert or update or delete on rh.beneficio_totais_mensais
  for each row execute function core.auditar('id');

-- O total não é de ninguém: lê quem vê o módulo (como o catálogo); grava
-- quem cadastra benefícios.
alter table rh.beneficio_totais_mensais enable row level security;
create policy ver on rh.beneficio_totais_mensais for select to authenticated
  using ((select core.pode_modulo('rh')));
create policy editar on rh.beneficio_totais_mensais for all to authenticated
  using ((select core.pode('rh.beneficios')))
  with check ((select core.pode('rh.beneficios')));
grant select, insert, update, delete on rh.beneficio_totais_mensais to authenticated;
grant all on rh.beneficio_totais_mensais to service_role;
