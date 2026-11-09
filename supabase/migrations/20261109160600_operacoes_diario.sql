-- operacoes (Diário de Obra): o que a sincronização precisa além do contrato
-- (20261109160000_operacoes).
--
--   * exemplo: obras e relatórios fictícios até a primeira consulta real ao
--     aplicativo. A sincronização apaga os de exemplo assim que o token
--     responde (src/server/sync/diario-de-obras.ts).
--   * autor_id e modelo_id: os mesmos ids dos filtros da API (usuarioId e
--     modeloDeRelatorioId), para filtrar por id e não pelo nome.
--   * resumo: números de cada relatório calculados na sincronização (efetivo,
--     homem-hora, clima da manhã e da tarde, ocorrências por tipo, fotos e
--     vídeos), para a lista e os gráficos não lerem o relatório inteiro.
--     Formato em src/lib/operacoes/diario.ts (resumoDoRelatorio).
--
-- As tabelas continuam só de leitura para quem usa o sistema (RLS do
-- contrato): só a service role grava.

alter table operacoes.diario_obras
  add column exemplo boolean not null default false;

alter table operacoes.diario_relatorios
  add column exemplo boolean not null default false,
  add column autor_id text,
  add column modelo_id text,
  add column resumo jsonb;

-- Relatórios que ainda esperam o detalhe (a próxima rodada continua deles).
create index diario_relatorios_sem_detalhe on operacoes.diario_relatorios (obra_id)
  where dados is null;
create index diario_relatorios_autor on operacoes.diario_relatorios (autor_id);
create index diario_obras_exemplo on operacoes.diario_obras (id) where exemplo;
