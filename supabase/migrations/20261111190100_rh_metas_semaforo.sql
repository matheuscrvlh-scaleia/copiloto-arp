-- Conferência de 07/11/2026 (folha de out/2026): a meta do absenteísmo
-- estava em 10% (referência: 2,5%) e nenhum indicador do RH tinha a faixa
-- "Atenção até", então o semáforo não tinha amarelo. A faixa sai em 1,5 vez a
-- meta (absenteísmo: até 3,75%); a Gestora ajusta em Parâmetros › Metas e semáforo.

update core.metas set meta = 2.5
  where indicador = 'rh.absenteismo' and meta = 10;

update core.metas
  set limite_atencao = meta * 1.5
  where indicador in ('rh.absenteismo', 'rh.turnover', 'rh.custo_sobre_receita', 'rh.banco_horas_positivo')
    and limite_atencao is null;
