// Painel de Sustentabilidade (spec 4.9): "sem dado" em vez de zero,
// variação sobre o mesmo mês do ano anterior, "desde o início" com os marcos
// e o aviso do consolidado anual alterado. Funções puras.

import { formatarNumero } from "../formato";
import { formatarMesNumerico } from "./formatos";

/** Valor formatado, ou "sem dado em mm/aaaa" quando não há (nunca zero). */
export function valorOuSemDado(
  valor: number | null | undefined,
  competencia: string,
  formatar: (v: number) => string = (v) => formatarNumero(v),
): string {
  return valor == null
    ? `sem dado em ${formatarMesNumerico(competencia)}`
    : formatar(valor);
}

/** "2026-11-01" → "2025-11-01". */
export function mesmoMesDoAnoAnterior(competencia: string): string {
  return `${Number(competencia.slice(0, 4)) - 1}${competencia.slice(4)}`;
}

/** Variação em % sobre o anterior; null sem um dos dois ou com anterior 0. */
export function variacao(
  atual: number | null | undefined,
  anterior: number | null | undefined,
): number | null {
  if (atual == null || anterior == null || anterior === 0) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

/**
 * "Desde o início" = marcos (anos antes do sistema) + soma dos anos no
 * sistema. Ano com marco usa o marco (o número oficial), sem somar o do
 * sistema de novo. Null se não há marco nem dado.
 */
export function desdeOInicio(
  marcos: readonly { ano: number; valor: number }[],
  anosNoSistema: readonly { ano: number; valor: number | null }[],
): number | null {
  const comMarco = new Set(marcos.map((m) => m.ano));
  const valores = [
    ...marcos.map((m) => m.valor),
    ...anosNoSistema
      .filter((a) => !comMarco.has(a.ano))
      .map((a) => a.valor)
      .filter((v): v is number => v !== null),
  ];
  return valores.length ? valores.reduce((t, v) => t + v, 0) : null;
}

export type Totais = Readonly<Record<string, number | null>>;

export interface DiferencaDoConsolidado {
  indicador: string;
  consolidado: number | null;
  atual: number | null;
}

/**
 * Ano fechado cujos totais de hoje diferem do consolidado: devolve as
 * diferenças para o aviso (o consolidado não muda até reabrirem). Ano sem
 * consolidado, reaberto ou igual: null.
 */
export function avisoDeConsolidado(
  consolidado: { situacao: string; totais: Totais } | null,
  totaisAtuais: Totais,
): DiferencaDoConsolidado[] | null {
  if (consolidado?.situacao !== "fechado") return null;
  const chaves = new Set([
    ...Object.keys(consolidado.totais),
    ...Object.keys(totaisAtuais),
  ]);
  const diferencas: DiferencaDoConsolidado[] = [];
  for (const indicador of chaves) {
    const antes = consolidado.totais[indicador] ?? null;
    const agora = totaisAtuais[indicador] ?? null;
    const igual =
      antes === null || agora === null
        ? antes === agora
        : Math.abs(antes - agora) < 1e-6;
    if (!igual)
      diferencas.push({ indicador, consolidado: antes, atual: agora });
  }
  return diferencas.length ? diferencas : null;
}
