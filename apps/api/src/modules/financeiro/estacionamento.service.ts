import {
  type ConsultaDoEstacionamento,
  type RespostaEstacionamento,
  TIPOS_DE_EVENTO,
  type TipoDeEvento,
} from "@arp/shared/financeiro/estacionamento";
import { isoLocal } from "@arp/shared/formato";
import {
  ateNoMaximo,
  descreverPeriodo,
  lerPeriodo,
  periodoAnterior,
} from "@arp/shared/periodo";
import type { Contexto } from "@/contexto";
import { banco } from "@/infra/banco";
import * as repo from "./estacionamento.repository";

const tipoDeEvento = (t: string): TipoDeEvento | undefined =>
  TIPOS_DE_EVENTO.find((x) => x === t);

/** Mensalidades por mês: os 12 últimos meses e os 3 próximos. */
function mesesDasMensalidades(agora: Date) {
  return {
    de: isoLocal(new Date(agora.getFullYear(), agora.getMonth() - 11, 1)),
    ate: isoLocal(new Date(agora.getFullYear(), agora.getMonth() + 4, 0)),
  };
}

/**
 * Tudo da tela do estacionamento no período: receita, fluxo, eventos
 * (benefícios, valet, ocorrências) e mensalistas. Lê em nome de quem está
 * logado (o RLS exige financeiro.estacionamento).
 */
export function estacionamento(
  ctx: Contexto,
  busca: ConsultaDoEstacionamento,
  agora = new Date(),
): Promise<RespostaEstacionamento> {
  const hoje = isoLocal(agora);
  const periodo = ateNoMaximo(lerPeriodo(busca, agora), hoje);
  const anterior = periodoAnterior(periodo);
  const filtros = {
    periodo,
    anterior,
    rotulo: descreverPeriodo(periodo),
    hoje,
  };

  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const garagem = (await repo.garagemAtual(tx)) ?? null;
    const id = garagem?.id ?? 0;
    const i = { estacionamentoId: id, de: periodo.de, ate: periodo.ate };
    const ant = { estacionamentoId: id, de: anterior.de, ate: anterior.ate };
    const meses = mesesDasMensalidades(agora);

    // Uma consulta atrás da outra: a transação tem uma conexão só.
    const receita = await repo.receitaTotais(tx, i);
    const receitaAnt = await repo.receitaTotais(tx, ant);
    const receitaDia = await repo.receitaPorDia(tx, i);
    const porForma = await repo.receitaPorForma(tx, i);
    const porTipo = await repo.receitaPorTipoCliente(tx, i);
    const porTarifa = await repo.receitaPorTarifa(tx, i);

    const fluxo = await repo.fluxoTotais(tx, i);
    const fluxoAnt = await repo.fluxoTotais(tx, ant);
    const fluxoDia = await repo.fluxoPorDia(tx, i);
    const porVeiculo = await repo.fluxoPorVeiculo(tx, i);
    const porHora = await repo.acessosPorHora(tx, i);
    const porCliente = await repo.entradasPor(tx, i, "tipo_cliente");
    const porServico = await repo.entradasPor(tx, i, "servico");
    const cancelados = await repo.ticketsCancelados(tx, i);

    const eventos = await repo.eventosPorTipo(tx, i);
    const categorias = await repo.eventosPorCategoria(tx, i);

    const contratos = await repo.contratosPorSituacao(tx, id);
    const doPeriodo = await repo.mensalidadesDoPeriodo(tx, i);
    const emAtraso = await repo.totalEmAtraso(tx, id, hoje);
    const atrasadas = await repo.parcelasEmAtraso(tx, id, hoje);
    const porMes = await repo.mensalidadesPorMes(tx, id, meses.de, meses.ate);

    const horas = new Map(porHora.map((h) => [h.hora, h]));

    return {
      filtros,
      garagem,
      receita: {
        ...receita,
        anterior: {
          liquida: receitaAnt.liquida,
          pagamentos: receitaAnt.pagamentos,
        },
        por_dia: receitaDia,
        por_forma: porForma,
        por_tipo_cliente: porTipo,
        por_tarifa: porTarifa,
      },
      fluxo: {
        ...fluxo,
        anterior: { entradas: fluxoAnt.entradas },
        por_dia: fluxoDia,
        por_hora: Array.from({ length: 24 }, (_, hora) => ({
          hora,
          entradas: horas.get(hora)?.entradas ?? 0,
          saidas: horas.get(hora)?.saidas ?? 0,
        })),
        por_tipo_cliente: porCliente,
        por_veiculo: porVeiculo,
        por_servico: porServico,
        tickets_cancelados: cancelados.cancelados,
      },
      eventos: eventos.flatMap((e) => {
        const tipo = tipoDeEvento(e.tipo);
        return tipo ? [{ ...e, tipo }] : [];
      }),
      categorias: categorias.flatMap((c) => {
        const tipo = tipoDeEvento(c.tipo);
        return tipo ? [{ ...c, tipo }] : [];
      }),
      mensalistas: {
        contratos,
        ...doPeriodo,
        em_atraso: emAtraso,
        atrasadas,
        por_mes: porMes,
      },
    };
  });
}
