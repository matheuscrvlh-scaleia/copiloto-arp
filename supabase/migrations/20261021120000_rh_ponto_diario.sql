-- Funcionários: lista e perfil de cada pessoa, com o ponto dia a dia.
--
-- O /Calcular do Secullum já devolve uma linha por dia (batidas, carga,
-- normais, faltas, atrasos, extras, banco), mas só os totais eram guardados
-- (rh.ponto_mensal). Agora o dia também fica, na mesma chamada: não gasta
-- nada a mais do limite de 100 cálculos por hora.

insert into core.permissoes (codigo, descricao) values
  ('rh.funcionarios', 'Ver a lista de funcionários e o perfil, com as batidas do ponto');

-- Quem já via o ponto (rh.jornada) passa a ver os funcionários; o
-- Administrador tem tudo.
insert into core.cargo_permissoes (cargo_id, permissao)
  select c.id, 'rh.funcionarios'
  from core.cargos c
  where c.nome = 'Administrador'
    or exists (
      select 1 from core.cargo_permissoes cp
      where cp.cargo_id = c.id and cp.permissao = 'rh.jornada'
    );
insert into core.usuario_permissoes (usuario_id, permissao)
  select up.usuario_id, 'rh.funcionarios'
  from core.usuario_permissoes up
  where up.permissao = 'rh.jornada'
on conflict do nothing;

create table rh.ponto_diario (
  colaborador_id uuid not null references rh.colaboradores (id) on delete cascade,
  data date not null,
  competencia core.competencia not null,
  -- ["08:02", "12:00", null, "18:30"]: horários das colunas Entrada 1,
  -- Saída 1, Entrada 2…, na posição da coluna; null onde não houve batida
  -- (o par incompleto fica visível).
  batidas jsonb not null default '[]' check (jsonb_typeof(batidas) = 'array'),
  -- Palavra no lugar das batidas: FOLGA, FERIADO, ATESTAD, EXTERNO, CBH…
  -- (as justificativas dependem da configuração do ponto).
  ocorrencia text,
  previstas_min int not null default 0,       -- Carga
  normais_min int not null default 0,         -- Normais
  faltas_min int not null default 0,          -- Faltas
  atrasos_min int not null default 0,         -- Atras.
  abonos_min jsonb not null default '{}',     -- Abono2, Abono3…
  extras_min jsonb not null default '{}',     -- Ex80%, Ex100%, Extras, ExNot…
  noturnas_min int not null default 0,        -- Not.
  banco_saldo_min int not null default 0,     -- BSaldo (saldo corrente)
  banco_creditos_min int not null default 0,  -- BCred.
  banco_debitos_min int not null default 0,   -- BDeb.
  sync_run_id uuid references integracao.sync_runs (id) on delete set null,
  atualizado_em timestamptz not null default now(),
  primary key (colaborador_id, data),
  check (date_trunc('month', data)::date = competencia)
);

create trigger atualizado_em before update on rh.ponto_diario
  for each row execute function core.set_atualizado_em();

-- Vindo do ponto: só a sincronização grava.
alter table rh.ponto_diario enable row level security;
create policy ver on rh.ponto_diario for select to authenticated
  using (core.pode('rh.funcionarios') or core.pode('rh.jornada'));
grant select on rh.ponto_diario to authenticated;
grant all on rh.ponto_diario to service_role;

-- O perfil mostra o histórico mensal do ponto.
drop policy ver on rh.ponto_mensal;
create policy ver on rh.ponto_mensal for select to authenticated
  using (
    core.pode('rh.jornada') or core.pode('rh.painel') or core.pode('rh.funcionarios')
  );
