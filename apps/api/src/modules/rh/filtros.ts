import { competenciaDaUrl, competenciaDe, isoLocal } from "@arp/shared/formato";
import {
  ateNoMaximo,
  descreverPeriodo,
  lerPeriodo,
  periodoAnterior,
} from "@arp/shared/periodo";
import type {
  ConsultaDoPeriodo,
  Departamento,
  FiltrosDoPeriodo,
} from "@arp/shared/rh/contratos/comum";
import type { Tx } from "@/infra/banco";
import { departamentosAtivos } from "./dados";

// Filtros das telas do RH lidos da URL, sem confiar nela (filtros.ts do
// antigo). fimConsiderado e mesAnterior estão em @arp/shared/rh/periodo.

/**
 * Lê ?mes= e ?dep= da URL. Mês fora da lista vira o mais recente;
 * departamento desconhecido vira "todos" (telas por competência).
 */
export async function lerFiltros(
  tx: Tx,
  busca: { mes?: string; dep?: string },
  meses: string[],
): Promise<{
  mes: string;
  departamento: string | null;
  departamentos: Departamento[];
}> {
  const deps = await departamentosAtivos(tx);
  const pedido = competenciaDaUrl(busca.mes);
  const mes =
    (pedido && meses.includes(pedido) ? pedido : meses[0]) ??
    competenciaDe(new Date());
  const depPedido = busca.dep ?? null;
  const departamento = deps.some((d) => d.id === depPedido) ? depPedido : null;
  return { mes, departamento, departamentos: deps };
}

/**
 * Lê ?periodo= ou ?de=&ate= (ou ?mes=, dos links antigos) e ?dep= da URL.
 * Data no futuro vira hoje; departamento desconhecido vira "todos".
 */
export async function lerFiltrosDoPeriodo(
  tx: Tx,
  busca: ConsultaDoPeriodo,
  agora = new Date(),
): Promise<FiltrosDoPeriodo> {
  const deps = await departamentosAtivos(tx);
  const hoje = isoLocal(agora);
  const periodo = ateNoMaximo(lerPeriodo(busca, agora), hoje);
  const depPedido = busca.dep ?? null;
  return {
    periodo,
    anterior: periodoAnterior(periodo),
    rotulo: descreverPeriodo(periodo),
    mes: `${periodo.ate.slice(0, 7)}-01`,
    hoje,
    departamento: deps.some((d) => d.id === depPedido) ? depPedido : null,
    departamentos: deps,
  };
}
