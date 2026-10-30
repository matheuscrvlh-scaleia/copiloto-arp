-- Instagram e Facebook com dados reais: a sincronização diária da Meta grava
-- uma foto por dia. As APIs só dão o número de seguidores de hoje, então o
-- histórico de seguidores começa no dia da ligação; alcance, visualizações e
-- interações do Instagram a API dá por dia para trás (18 semanas). O
-- Facebook só entrega seguidores (as métricas da página pedem token de
-- página). Números agregados da conta: lê quem tem o módulo (o Painel usa).
-- Só o servidor grava (service role).

create table marketing.redes_dia (
  rede text not null check (rede in ('instagram', 'facebook')),
  dia date not null,
  -- null nos dias antes da primeira foto.
  seguidores int check (seguidores >= 0),
  -- Só Instagram; null no Facebook.
  alcance int check (alcance >= 0),
  visualizacoes int check (visualizacoes >= 0),
  contas_engajadas int check (contas_engajadas >= 0),
  interacoes int check (interacoes >= 0),
  toques_links int check (toques_links >= 0),
  atualizado_em timestamptz not null default now(),
  primary key (rede, dia)
);

alter table marketing.redes_dia enable row level security;

create policy ver on marketing.redes_dia for select to authenticated
  using ((select core.pode_modulo('marketing')));

grant select on marketing.redes_dia to authenticated;
grant all on marketing.redes_dia to service_role;
