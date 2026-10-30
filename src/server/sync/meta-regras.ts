import { somarDias } from "@/lib/marketing/periodo";

// Regras puras da sincronização da Meta (Instagram e Facebook).

/** Janela das métricas diárias do Instagram (a mesma do módulo: 18 semanas). */
export const JANELA_META_DIAS = 126;
/** Os últimos dias são relidos: a Meta ainda ajusta os números deles. */
export const RELER_DIAS = 3;

/**
 * Dias com métricas do Instagram a ler, do mais novo para o mais velho: os
 * que faltam na janela (até ontem) e sempre os últimos RELER_DIAS.
 */
export function diasDoInstagram(hoje: string, lidos: Set<string>): string[] {
  const dias: string[] = [];
  for (let i = 1; i <= JANELA_META_DIAS; i++) {
    const dia = somarDias(hoje, -i);
    if (i <= RELER_DIAS || !lidos.has(dia)) dias.push(dia);
  }
  return dias;
}
