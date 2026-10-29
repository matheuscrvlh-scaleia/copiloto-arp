-- Público e visitação sai do Marketing por enquanto: a API do WPS só entrega
-- a quantidade de entradas por dia, sem placa nem horário de cada passagem,
-- e a tela dependia disso. Saem a permissão (com os vínculos, em cascata) e
-- os parâmetros do estacionamento. Volta numa migration nova quando o WPS
-- liberar as passagens.

delete from core.permissoes where codigo in ('marketing.publico');

alter table marketing.parametros
  drop column vagas,
  drop column janela_recorrencia_dias;
