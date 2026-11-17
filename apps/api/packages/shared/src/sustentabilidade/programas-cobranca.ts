// Chamado "Cobrar lançamento do parceiro" (spec 4.8 e jornada 5.9). Decisão:
// no dia `cobranca_dia` (Parâmetros, padrão 5) cobra-se o MÊS ANTERIOR — o
// parceiro lança durante o mês, e no dia 5 o mês que passou já devia estar
// lançado ("No dia 5, o SustentArp ainda não lançou"). Cobrar o mês corrente
// no dia 5 cobraria quem ainda tem o mês inteiro para lançar. Se a rotina
// não rodar no dia, roda nos dias seguintes do mesmo mês (a referência do
// chamado evita duplicar). Só programa ativo, mensal e vigente no mês
// cobrado. O chamado vai para a equipe interna (nunca para o parceiro) e
// fecha sozinho quando chega lançamento daquele mês. Funções puras.

export interface ProgramaParaCobrar {
  id: string;
  ativo: boolean;
  frequencia: string;
  /** "aaaa-mm-dd" ou null. */
  inicio: string | null;
  fim: string | null;
}

/** "aaaa-mm" do mês anterior ao de `hoje` ("aaaa-mm-dd"). */
export function mesAnterior(hoje: string): string {
  const [a, m] = hoje.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(a, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Mês cobrado hoje ("aaaa-mm"), ou null antes do dia da cobrança. */
export function mesACobrar(hoje: string, diaCobranca: number): string | null {
  return Number(hoje.slice(8, 10)) >= diaCobranca ? mesAnterior(hoje) : null;
}

/** O programa devia ter lançado no mês ("aaaa-mm")? */
export function deveLancarNoMes(p: ProgramaParaCobrar, mes: string): boolean {
  if (!p.ativo || p.frequencia !== "mensal") return false;
  if (p.inicio && p.inicio.slice(0, 7) > mes) return false;
  if (p.fim && p.fim.slice(0, 7) < mes) return false;
  return true;
}

/**
 * Programas a cobrar hoje: os que deviam lançar no mês cobrado e não têm
 * lançamento com data nesse mês (`lancados` = ids com lançamento no mês).
 */
export function programasACobrar(
  programas: readonly ProgramaParaCobrar[],
  lancados: ReadonlySet<string>,
  hoje: string,
  diaCobranca: number,
): { mes: string | null; programas: string[] } {
  const mes = mesACobrar(hoje, diaCobranca);
  if (!mes) return { mes, programas: [] };
  return {
    mes,
    programas: programas
      .filter((p) => deveLancarNoMes(p, mes) && !lancados.has(p.id))
      .map((p) => p.id),
  };
}

/** Referência do chamado no módulo: "cobranca:<programa>:<aaaa-mm>". */
export const refDaCobranca = (programaId: string, mes: string) =>
  `cobranca:${programaId}:${mes}`;

/** Programa e mês de uma referência de cobrança (null se não for uma). */
export function lerRefDaCobranca(
  ref: string,
): { programaId: string; mes: string } | null {
  const m = /^cobranca:([0-9a-f-]{36}):(\d{4}-\d{2})$/.exec(ref);
  return m ? { programaId: m[1] as string, mes: m[2] as string } : null;
}
