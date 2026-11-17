-- CO₂ evitado no Painel de Sustentabilidade: geração solar (kWh) × fator de
-- emissão da rede. O fator muda com o tempo (o MCTI publica um por ano), por
-- isso cada valor vale a partir de uma data; o mês usa o fator vigente nele.
-- Configurado em Configurações › Parâmetros › Painel.

create table sustentabilidade.co2_fatores (
  id uuid default gen_random_uuid() not null primary key,
  vigente_desde date not null unique,
  -- kg de CO₂ por kWh (o mesmo número de t CO₂ por MWh).
  kg_por_kwh numeric(8, 5) not null check (kg_por_kwh > 0 and kg_por_kwh < 10),
  criado_por uuid default auth.uid() references core.usuarios (id) on delete set null,
  criado_em timestamptz default now() not null
);

create index co2_fatores_criado_por on sustentabilidade.co2_fatores (criado_por);

create trigger auditoria after insert or delete or update on sustentabilidade.co2_fatores
  for each row execute function core.auditar('id');

alter table sustentabilidade.co2_fatores enable row level security;

create policy ver on sustentabilidade.co2_fatores for select to authenticated
  using ((select sustentabilidade.pode_alguma(variadic array['painel', 'parametros'])));
create policy criar on sustentabilidade.co2_fatores for insert to authenticated
  with check ((select core.pode('sustentabilidade.parametros')));
create policy editar on sustentabilidade.co2_fatores for update to authenticated
  using ((select core.pode('sustentabilidade.parametros')))
  with check ((select core.pode('sustentabilidade.parametros')));
create policy excluir on sustentabilidade.co2_fatores for delete to authenticated
  using ((select core.pode('sustentabilidade.parametros')));

revoke all on sustentabilidade.co2_fatores from public, anon, authenticated;
grant select, delete on sustentabilidade.co2_fatores to authenticated;
grant insert (vigente_desde, kg_por_kwh, criado_por),
  update (vigente_desde, kg_por_kwh) on sustentabilidade.co2_fatores to authenticated;
grant all on sustentabilidade.co2_fatores to service_role;

-- Valor inicial: fator médio anual do SIN de 2023 publicado pelo MCTI
-- (38,5 kg CO₂/MWh = 0,0385 kg/kWh), vigente desde 2025 para o painel
-- também comparar com o ano anterior. Troca-se na tela, criando vigência nova.
insert into sustentabilidade.co2_fatores (vigente_desde, kg_por_kwh)
  values ('2025-01-01', 0.0385);
