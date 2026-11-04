import { aniversarioEm, diasEntre, somarMeses } from "@/lib/comercial/datas";
import type { EnetContrato, Indice, Prazo } from "@/lib/comercial/fontes";

// Vencimentos de contrato (spec 4.6): faixa de cada contrato ativo pelos
// dias para vencer (faixas dos parâmetros), período de término e o reajuste
// previsto (estimativa com o acumulado de 12 meses do índice; negativo não
// reajusta, como nos modelos de contrato).

/** Nome do mês (1 a 12) nos filtros de mês de reajuste e de aniversário. */
export const NOMES_DOS_MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

export const nomeDoMes = (m: number) => NOMES_DOS_MESES[m - 1] ?? "";

export type FaixaVencimento =
  | "vencido"
  | "faixa1"
  | "faixa2"
  | "depois"
  | "indeterminado";

export interface Faixas {
  faixa1: number;
  faixa2: number;
}

/** Término menos hoje, em dias (negativo = já venceu); null sem término. */
export function diasParaVencer(
  termino: string | null,
  hoje: string,
): number | null {
  return termino ? diasEntre(hoje, termino) : null;
}

export function faixaDoContrato(
  c: Pick<EnetContrato, "prazo" | "data_termino">,
  hoje: string,
  f: Faixas,
): FaixaVencimento {
  const dias = diasParaVencer(c.data_termino, hoje);
  if (c.prazo === "Indeterminado" || dias === null) return "indeterminado";
  if (dias < 0) return "vencido";
  if (dias <= f.faixa1) return "faixa1";
  if (dias <= f.faixa2) return "faixa2";
  return "depois";
}

/** Rótulos dos cartões com os dias dos parâmetros. */
export function rotulosDasFaixas(f: Faixas): Record<FaixaVencimento, string> {
  return {
    vencido: "Vencidos",
    faixa1: `Vencem em até ${f.faixa1} dias`,
    faixa2: `Vencem de ${f.faixa1 + 1} a ${f.faixa2} dias`,
    depois: `Vencem depois de ${f.faixa2} dias`,
    indeterminado: "Prazo indeterminado",
  };
}

export const PERIODOS_TERMINO = {
  "": "Próximos 12 meses",
  "6m": "Próximos 6 meses",
  "3m": "Próximos 3 meses",
  "24m": "Próximos 24 meses",
  todos: "Todos",
} as const;
export type PeriodoTermino = keyof typeof PERIODOS_TERMINO;

const MESES_DO_PERIODO: Record<Exclude<PeriodoTermino, "todos">, number> = {
  "": 12,
  "6m": 6,
  "3m": 3,
  "24m": 24,
};

/**
 * Entra no período de término: vence até o fim do período (os vencidos
 * entram sempre); o prazo indeterminado, sem término, também entra.
 */
export function noPeriodo(
  c: Pick<EnetContrato, "prazo" | "data_termino">,
  hoje: string,
  p: PeriodoTermino,
): boolean {
  if (p === "todos" || c.prazo === "Indeterminado" || !c.data_termino)
    return true;
  return c.data_termino <= somarMeses(hoje, MESES_DO_PERIODO[p]);
}

/** Data do próximo reajuste: o dia do início no mês de reajuste, hoje ou depois. */
export function proximoReajuste(
  c: Pick<EnetContrato, "data_inicio" | "mes_reajuste">,
  hoje: string,
): string {
  const ano = Number(hoje.slice(0, 4));
  const dia = c.data_inicio.slice(8, 10);
  const mes = String(c.mes_reajuste).padStart(2, "0");
  const neste = aniversarioEm(`2000-${mes}-${dia}`, ano);
  return neste >= hoje ? neste : aniversarioEm(`2000-${mes}-${dia}`, ano + 1);
}

/** Reajuste nos próximos `dias` (de hoje até hoje + dias). */
export function reajusteProximo(
  c: Pick<EnetContrato, "data_inicio" | "mes_reajuste">,
  hoje: string,
  dias: number,
): boolean {
  return diasEntre(hoje, proximoReajuste(c, hoje)) <= dias;
}

/** Aluguel com o acumulado (em %); índice negativo ou zero mantém o valor. */
export function aluguelReajustado(
  aluguel: number,
  acumuladoPct: number,
): number {
  if (acumuladoPct <= 0) return aluguel;
  return Math.round(aluguel * (1 + acumuladoPct / 100) * 100) / 100;
}

export interface LinhaVencimento {
  contrato: string;
  luc: string;
  cliente: string;
  locatario: string;
  bloco: string;
  abl: number;
  inicio: string;
  termino: string | null;
  dias: number | null;
  prazo: Prazo;
  indice: Indice;
  mesReajuste: number;
  proximoReajuste: string;
  faixa: FaixaVencimento;
  /** null sem a permissão de valores. */
  aluguel: number | null;
  /** Só para reajuste nos próximos N dias e com o índice disponível. */
  previsto: { acumulado: number; aluguel: number | null } | null;
}

export interface EntradaVencimentos {
  contratos: EnetContrato[];
  lucs: Map<string, { local: string; abl: number }>;
  hoje: string;
  faixas: Faixas;
  /** Dias do reajuste previsto (parâmetro). */
  diasReajuste: number;
  /** Acumulado de 12 meses em % por índice (null se o serviço caiu). */
  acumulados: Record<Indice, number | null>;
  comValores: boolean;
}

/** Uma linha por contrato ativo hoje. */
export function linhasDeVencimento(e: EntradaVencimentos): LinhaVencimento[] {
  return e.contratos
    .filter(
      (c) =>
        c.data_inicio <= e.hoje &&
        (!c.data_rescisao || c.data_rescisao > e.hoje),
    )
    .map((c) => {
      const l = e.lucs.get(c.luc);
      const acumulado = e.acumulados[c.indice];
      const proximo = proximoReajuste(c, e.hoje);
      const previsto =
        acumulado !== null && reajusteProximo(c, e.hoje, e.diasReajuste)
          ? {
              acumulado,
              aluguel: e.comValores
                ? aluguelReajustado(c.valor_aluguel, acumulado)
                : null,
            }
          : null;
      return {
        contrato: c.codigo,
        luc: c.luc,
        cliente: c.cliente,
        locatario: c.locatario,
        bloco: l?.local ?? "",
        abl: l?.abl ?? 0,
        inicio: c.data_inicio,
        termino: c.data_termino,
        dias: diasParaVencer(c.data_termino, e.hoje),
        prazo: c.prazo,
        indice: c.indice,
        mesReajuste: c.mes_reajuste,
        proximoReajuste: proximo,
        faixa: faixaDoContrato(c, e.hoje, e.faixas),
        aluguel: e.comValores ? c.valor_aluguel : null,
        previsto,
      };
    });
}

export function contarFaixas(
  ls: Pick<LinhaVencimento, "faixa">[],
): Record<FaixaVencimento, number> {
  const n: Record<FaixaVencimento, number> = {
    vencido: 0,
    faixa1: 0,
    faixa2: 0,
    depois: 0,
    indeterminado: 0,
  };
  for (const l of ls) n[l.faixa]++;
  return n;
}
