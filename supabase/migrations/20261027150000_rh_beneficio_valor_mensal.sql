-- Benefício com valor que varia por mês (ex.: VR pelos dias trabalhados):
-- em vez de um valor manual único, cada pessoa tem um valor lançado por
-- competência. Mês sem lançamento repete o último lançado antes dele; lançar
-- um mês nunca mexe nos anteriores. Os outros benefícios seguem como estão
-- (padrão, manual ou faixa etária).

alter table rh.beneficios
  add column valor_por_mes boolean not null default false;

create table rh.beneficio_valores_mensais (
  id uuid primary key default gen_random_uuid(),
  beneficio_id uuid not null references rh.beneficios (id) on delete restrict,
  colaborador_id uuid not null references rh.colaboradores (id) on delete cascade,
  competencia core.competencia not null,
  valor numeric(14, 2) not null check (valor >= 0),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- Também serve de índice para o benefício (primeira coluna).
  unique (beneficio_id, colaborador_id, competencia)
);

create index beneficio_valores_mensais_colaborador
  on rh.beneficio_valores_mensais (colaborador_id);

create trigger atualizado_em before update on rh.beneficio_valores_mensais
  for each row execute function core.set_atualizado_em();
create trigger auditoria after insert or update or delete on rh.beneficio_valores_mensais
  for each row execute function core.auditar('id');

-- Mesmo acesso dos vínculos: valor de cada pessoa, só com rh.beneficios.
alter table rh.beneficio_valores_mensais enable row level security;
create policy ver on rh.beneficio_valores_mensais for select to authenticated
  using ((select core.pode('rh.beneficios')));
create policy editar on rh.beneficio_valores_mensais for all to authenticated
  using ((select core.pode('rh.beneficios')))
  with check ((select core.pode('rh.beneficios')));
grant select, insert, update, delete on rh.beneficio_valores_mensais to authenticated;
grant all on rh.beneficio_valores_mensais to service_role;
