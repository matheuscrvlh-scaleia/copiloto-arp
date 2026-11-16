// Formatos do módulo Sustentabilidade, sobre os de src/lib/formato.ts.
// Sem valor: "—".

import { formatarNumero, formatarPct } from "@/lib/formato";

/** 1234.5 → "1.234,50" (reais sem o "R$", como nas planilhas da área). */
export function formatarReais(valor: number | null | undefined): string {
  return valor == null ? "—" : formatarNumero(valor, 2);
}

/** 24 → "24,00" (toneladas, 2 casas). */
export function formatarToneladas(valor: number | null | undefined): string {
  return valor == null ? "—" : formatarNumero(valor, 2);
}

/** 15.168 → "15,2%" (percentual de 0 a 100, 1 casa). */
export function formatarPercentual(valor: number | null | undefined): string {
  return formatarPct(valor ?? null, 1);
}

/** "2026-11-01" ou "2026-11" → "11/2026". */
export function formatarMesNumerico(competencia: string): string {
  return `${competencia.slice(5, 7)}/${competencia.slice(0, 4)}`;
}
