import "server-only";
import {
  competenciaDaUrl,
  competenciaDe,
  fimDoMes,
  isoLocal,
} from "@/lib/formato";
import {
  ateNoMaximo,
  descreverPeriodo,
  lerPeriodo,
  type Periodo,
  periodoAnterior,
} from "@/lib/periodo";
import { type Departamento, departamentos } from "./dados";

export type Busca = Record<string, string | string[] | undefined>;

/**
 * Lê ?mes= e ?dep= da URL. Mês fora da lista vira o mais recente; departamento
 * desconhecido vira "todos" (nunca confia no que veio na URL).
 */
export async function lerFiltros(busca: Busca, meses: string[]) {
  const deps = await departamentos();
  const pedido = competenciaDaUrl(busca.mes);
  const mes =
    (pedido && meses.includes(pedido) ? pedido : meses[0]) ??
    competenciaDe(new Date());
  const depPedido = typeof busca.dep === "string" ? busca.dep : null;
  const departamento = deps.some((d) => d.id === depPedido) ? depPedido : null;
  return { mes, departamento, departamentos: deps };
}

export interface FiltrosDoPeriodo {
  periodo: Periodo;
  /** Período anterior de mesmo tamanho, para as variações. */
  anterior: Periodo;
  /** "Esta semana (13/10 a 19/10/2026)", "out/2026"… */
  rotulo: string;
  /** Competência do fim do período (metas, gráficos de 12 meses, folha). */
  mes: string;
  /** Hoje (aaaa-mm-dd), limite das datas na tela. */
  hoje: string;
  departamento: string | null;
  departamentos: Departamento[];
}

/**
 * Lê ?periodo= ou ?de=&ate= (ou ?mes=, dos links antigos) e ?dep= da URL.
 * Data no futuro vira hoje; departamento desconhecido vira "todos".
 */
export async function lerFiltrosDoPeriodo(
  busca: Busca,
  agora = new Date(),
): Promise<FiltrosDoPeriodo> {
  const deps = await departamentos();
  const hoje = isoLocal(agora);
  const periodo = ateNoMaximo(lerPeriodo(busca, agora), hoje);
  const depPedido = typeof busca.dep === "string" ? busca.dep : null;
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

/** Último dia considerado no mês: ontem, se for o mês corrente. */
export function fimConsiderado(competencia: string, hoje = new Date()): string {
  const ontem = isoLocal(
    new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1),
  );
  const fim = fimDoMes(competencia);
  return fim < ontem ? fim : ontem;
}

export function mesAnterior(competencia: string): string {
  const [a, m] = competencia.split("-").map(Number) as [number, number];
  return competenciaDe(new Date(a, m - 2, 1));
}
