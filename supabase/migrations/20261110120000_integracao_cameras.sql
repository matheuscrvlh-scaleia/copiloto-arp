-- Contagem de pessoas das câmeras Intelbras (envio automático da câmera).
-- A câmera manda heartbeat e contagens por POST para /api/cameras/contagem,
-- com usuário e senha do cartão "Câmeras" de Administração › Integrações.
-- Só o servidor (service role) lê e grava, como o resto do schema integracao.

-- Cartão "Câmeras": usuário e senha que as câmeras usam para enviar.
alter table integracao.credenciais drop constraint credenciais_sistema_check;
alter table integracao.credenciais add constraint credenciais_sistema_check
  check (sistema in (
    'secullum', 'wps', 'diario_de_obras', 'copiloto_rh', 'rd_crm', 'cameras',
    'mkt_google', 'mkt_youtube', 'mkt_meta', 'mkt_tiktok', 'mkt_rd_station',
    'mkt_asana', 'mkt_site'
  ));

-- Uma linha por câmera, criada no primeiro envio aceito. A câmera só se
-- identifica pelo deviceid, um nome fixo configurado nela (ARP-ENTRADA...).
create table integracao.cameras (
  deviceid text primary key check (deviceid ~ '^[A-Za-z0-9_.-]{1,64}$'),
  -- Último heartbeat ou contagem recebidos.
  ultimo_contato timestamptz not null default now(),
  criado_em timestamptz not null default now()
);

-- Entradas e saídas de cada período (não são totais acumulados). A câmera
-- reenvia o mesmo período: a chave (deviceid, inicio) faz o reenvio
-- regravar a linha em vez de somar de novo.
create table integracao.camera_contagens (
  deviceid text not null references integracao.cameras (deviceid) on delete cascade,
  inicio timestamptz not null,
  fim timestamptz not null,
  entradas integer not null check (entradas >= 0),
  saidas integer not null check (saidas >= 0),
  recebido_em timestamptz not null default now(),
  primary key (deviceid, inicio),
  check (fim >= inicio)
);

create index camera_contagens_inicio on integracao.camera_contagens (inicio);

alter table integracao.cameras enable row level security;
alter table integracao.camera_contagens enable row level security;

grant all on integracao.cameras, integracao.camera_contagens to service_role;
