-- Cadastros de Operações: o hidrômetro passa a ter cadastro próprio (antes
-- só existia nas leituras importadas). Cadastra-se o hidrômetro (número,
-- bloco, sala e, se houver, a sala da energia) e depois, na importação, a
-- foto do visor é ligada escolhendo o hidrômetro na lista. A importação da
-- planilha cadastra sozinha o hidrômetro que ainda não estiver na lista.
-- As salas da energia (operacoes.salas) ganham auditoria: agora são
-- editadas na tela de Cadastros.

create table operacoes.hidrometros (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique check (length(btrim(numero)) between 1 and 40),
  bloco text not null check (bloco ~ '^\d{2}$'),
  sala text not null default '' check (length(sala) <= 40),
  sala_id uuid references operacoes.salas (id) on delete set null,
  descricao text check (length(descricao) <= 120),   -- cliente ou uso (ex.: Estoque ARP)
  ativo boolean not null default true,
  observacoes text check (length(observacoes) <= 500),
  exemplo boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index hidrometros_sala_id on operacoes.hidrometros (sala_id);
create index hidrometros_bloco on operacoes.hidrometros (bloco, sala);

create trigger atualizado_em before update on operacoes.hidrometros
  for each row execute function core.set_atualizado_em();
create trigger auditoria after insert or update or delete on operacoes.hidrometros
  for each row execute function core.auditar('id');
create trigger auditoria after insert or update or delete on operacoes.salas
  for each row execute function core.auditar('id');

alter table operacoes.hidrometros enable row level security;

-- Vê quem vê a água; cadastra e edita quem importa a água ou liga
-- hidrômetro a sala.
create policy ver on operacoes.hidrometros for select to authenticated
  using ((select core.pode('operacoes.agua.ver')) or (select core.pode('operacoes.agua.importar')));
create policy criar on operacoes.hidrometros for insert to authenticated
  with check ((select core.pode('operacoes.agua.importar')) or (select core.pode('operacoes.agua.vinculo')));
create policy editar on operacoes.hidrometros for update to authenticated
  using ((select core.pode('operacoes.agua.importar')) or (select core.pode('operacoes.agua.vinculo')))
  with check ((select core.pode('operacoes.agua.importar')) or (select core.pode('operacoes.agua.vinculo')));
create policy excluir on operacoes.hidrometros for delete to authenticated
  using ((select core.pode('operacoes.agua.importar')) or (select core.pode('operacoes.agua.vinculo')));

grant select on operacoes.hidrometros to authenticated;
grant insert (numero, bloco, sala, sala_id, descricao, ativo, observacoes)
  on operacoes.hidrometros to authenticated;
grant update (numero, bloco, sala, sala_id, descricao, ativo, observacoes)
  on operacoes.hidrometros to authenticated;
grant delete on operacoes.hidrometros to authenticated;
grant all on operacoes.hidrometros to service_role;

-- Carga inicial: um cadastro por hidrômetro já importado, com o bloco, a
-- sala e o cliente da leitura mais recente que vale, e a sala da energia de
-- mesmo código (BLxx-sala), quando houver.
insert into operacoes.hidrometros (numero, bloco, sala, sala_id, descricao, exemplo)
select u.hidrometro, u.bloco, left(u.sala, 40), s.id, left(nullif(btrim(u.cliente), ''), 120), u.exemplo
from (
  select distinct on (l.hidrometro) l.hidrometro, l.bloco, coalesce(l.sala, '') sala, l.cliente, l.exemplo
  from operacoes.agua_leituras l
  where l.vigente and length(btrim(l.hidrometro)) between 1 and 40
  order by l.hidrometro, l.referencia desc
) u
left join operacoes.salas s on s.codigo = 'BL' || u.bloco || '-' || u.sala
on conflict (numero) do nothing;
