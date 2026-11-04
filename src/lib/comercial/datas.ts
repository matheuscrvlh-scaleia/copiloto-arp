import { diaDaSemana, somarDias, ultimoDiaDoMes } from "@/lib/os/tempo";

// Datas do Comercial ("aaaa-mm-dd", horário de Brasília): meses de contrato,
// aniversários e dias úteis. Os feriados (nacionais da BrasilAPI e os de
// Nova Friburgo dos parâmetros) e os dias da semana úteis chegam de fora.

export { diasEntre, somarDias } from "@/lib/os/tempo";

const partes = (data: string) =>
  data.split("-").map(Number) as [number, number, number];

const montar = (a: number, m: number, d: number) =>
  `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/**
 * Soma meses mantendo o dia; se o mês não tem o dia, fica no último
 * (31/01 + 1 mês = 28/02).
 */
export function somarMeses(data: string, n: number): string {
  const [a, m, d] = partes(data);
  const total = a * 12 + (m - 1) + n;
  const ano = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  return montar(ano, mes, Math.min(d, ultimoDiaDoMes(ano, mes)));
}

/** Meses completos de `de` até `ate` (negativo se `ate` vem antes). */
export function mesesCompletos(de: string, ate: string): number {
  if (ate < de) return -mesesCompletos(ate, de);
  const [a1, m1] = partes(de);
  const [a2, m2] = partes(ate);
  let n = (a2 - a1) * 12 + (m2 - m1);
  if (somarMeses(de, n) > ate) n--;
  return n;
}

/** Anos completos (ex.: anos de contrato na ARP). */
export function anosCompletos(de: string, ate: string): number {
  return Math.trunc(mesesCompletos(de, ate) / 12);
}

/** O dia e o mês de `data` no ano dado (29/02 vira 28/02 fora do bissexto). */
export function aniversarioEm(data: string, ano: number): string {
  const [, m, d] = partes(data);
  return montar(ano, m, Math.min(d, ultimoDiaDoMes(ano, m)));
}

/** "aaaa-mm-01" de cada mês de `de` até `ate`, inclusive. */
export function competenciasEntre(de: string, ate: string): string[] {
  const fim = `${ate.slice(0, 7)}-01`;
  const lista: string[] = [];
  for (let c = `${de.slice(0, 7)}-01`; c <= fim; c = somarMeses(c, 1))
    lista.push(c);
  return lista;
}

/** Último dia do mês da data ("2026-02-10" → "2026-02-28"). */
export function fimDoMesDe(data: string): string {
  const [a, m] = partes(data);
  return montar(a, m, ultimoDiaDoMes(a, m));
}

export interface CalendarioUtil {
  /** "aaaa-mm-dd" dos feriados (nacionais e locais). */
  feriados: ReadonlySet<string>;
  /** Dias da semana úteis: 0 = domingo … 6 = sábado. */
  diasUteis: readonly number[];
}

export function ehDiaUtil(data: string, cal: CalendarioUtil): boolean {
  return cal.diasUteis.includes(diaDaSemana(data)) && !cal.feriados.has(data);
}

/** O n-ésimo dia útil depois de `data` (n = 0 devolve a própria data). */
export function somarDiasUteis(
  data: string,
  n: number,
  cal: CalendarioUtil,
): string {
  if (cal.diasUteis.length === 0) throw new Error("Calendário sem dias úteis");
  let d = data;
  for (let faltam = n; faltam > 0; ) {
    d = somarDias(d, 1);
    if (ehDiaUtil(d, cal)) faltam--;
  }
  return d;
}

/** Dias úteis depois de `de` até `ate`, inclusive (0 se `ate` não vem depois). */
export function diasUteisEntre(
  de: string,
  ate: string,
  cal: CalendarioUtil,
): number {
  let n = 0;
  for (let d = somarDias(de, 1); d <= ate; d = somarDias(d, 1))
    if (ehDiaUtil(d, cal)) n++;
  return n;
}
