import { paraBrasilia } from "@/lib/os/tempo";
import { datasDo, dentro, diaDaSemana, type PeriodoMkt } from "./periodo";

// Público e visitação: o fluxo de pessoas contado pelas câmeras (entradas de
// cada período que a câmera manda, de todas as câmeras somadas). Só números,
// nunca imagem. Dia sem nenhuma contagem é "sem dado" (câmera desligada ou
// ainda não instalada), não zero: as médias contam só os dias com dado.

export interface ContagemCamera {
  deviceid: string;
  /** Instante de início do período (ISO, UTC). */
  inicio: string;
  entradas: number;
}

type Periodo = Pick<PeriodoMkt, "de" | "ate">;

export const DIAS_DA_SEMANA = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;

export const MESES = [
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

/** Entradas por dia de Brasília ("aaaa-mm-dd" → total), de todo o histórico. */
export function entradasPorDia(
  contagens: ContagemCamera[],
): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of contagens) {
    const { data } = paraBrasilia(new Date(c.inicio));
    out.set(data, (out.get(data) ?? 0) + c.entradas);
  }
  return out;
}

/** Os dias do período, com o total ou null (sem dado). */
export function diasDoPeriodo(
  porDia: Map<string, number>,
  p: Periodo,
): { dia: string; entradas: number | null }[] {
  return datasDo(p).map((dia) => ({ dia, entradas: porDia.get(dia) ?? null }));
}

export interface ResumoFluxo {
  /** Soma das entradas nos dias com dado. */
  total: number;
  diasComDado: number;
  diasNoPeriodo: number;
  mediaPorDia: number | null;
  /** Média dos dias úteis (segunda a sexta) e do fim de semana. */
  mediaDiaUtil: number | null;
  mediaFimDeSemana: number | null;
  /** Dia com mais entradas. */
  pico: { dia: string; entradas: number } | null;
}

const media = (v: number[]) =>
  v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;

export function resumoFluxo(
  porDia: Map<string, number>,
  p: Periodo,
): ResumoFluxo {
  const dias = diasDoPeriodo(porDia, p);
  const com = dias.filter(
    (d): d is { dia: string; entradas: number } => d.entradas !== null,
  );
  const util = com.filter((d) => {
    const s = diaDaSemana(d.dia);
    return s >= 1 && s <= 5;
  });
  const fim = com.filter((d) => {
    const s = diaDaSemana(d.dia);
    return s === 0 || s === 6;
  });
  let pico: ResumoFluxo["pico"] = null;
  for (const d of com) if (!pico || d.entradas > pico.entradas) pico = d;
  return {
    total: com.reduce((s, d) => s + d.entradas, 0),
    diasComDado: com.length,
    diasNoPeriodo: dias.length,
    mediaPorDia: media(com.map((d) => d.entradas)),
    mediaDiaUtil: media(util.map((d) => d.entradas)),
    mediaFimDeSemana: media(fim.map((d) => d.entradas)),
    pico,
  };
}

/**
 * Média de entradas em cada hora do dia (0–23) no período, sobre os dias com
 * dado. null na hora em que nenhuma câmera contou.
 */
export function mediaPorHora(
  contagens: ContagemCamera[],
  p: Periodo,
): (number | null)[] {
  const soma = Array<number>(24).fill(0);
  const tem = Array<boolean>(24).fill(false);
  const dias = new Set<string>();
  for (const c of contagens) {
    const { data, hora } = paraBrasilia(new Date(c.inicio));
    if (!dentro(data, p)) continue;
    const h = Number(hora.slice(0, 2));
    soma[h] = (soma[h] ?? 0) + c.entradas;
    tem[h] = true;
    dias.add(data);
  }
  return soma.map((s, h) => (tem[h] && dias.size ? s / dias.size : null));
}

/** Média de entradas por dia da semana (0 = domingo) no período. */
export function mediaPorDiaDaSemana(
  porDia: Map<string, number>,
  p: Periodo,
): (number | null)[] {
  const grupos: number[][] = Array.from({ length: 7 }, () => []);
  for (const d of diasDoPeriodo(porDia, p))
    if (d.entradas !== null) grupos[diaDaSemana(d.dia)]?.push(d.entradas);
  return grupos.map(media);
}

/**
 * Comparativo anual (como a planilha do Marketing): a média de entradas por
 * dia em cada mês, no ano e no anterior; com `diaSemana`, só esse dia.
 */
export function comparativoAnual(
  porDia: Map<string, number>,
  ano: number,
  diaSemana: number | null,
): { mes: string; atual: number | null; anterior: number | null }[] {
  const doMes = (a: number, m: number) => {
    const v: number[] = [];
    const prefixo = `${a}-${String(m + 1).padStart(2, "0")}-`;
    for (const [dia, n] of porDia)
      if (
        dia.startsWith(prefixo) &&
        (diaSemana === null || diaDaSemana(dia) === diaSemana)
      )
        v.push(n);
    return media(v);
  };
  return MESES.map((mes, m) => ({
    mes,
    atual: doMes(ano, m),
    anterior: doMes(ano - 1, m),
  }));
}

/**
 * Incremento em dias de evento: média dos dias com evento contra a dos dias
 * sem evento do mesmo período (só dias com dado). null sem base nos dois.
 */
export function incrementoEmEventos(
  porDia: Map<string, number>,
  p: Periodo,
  diasDeEvento: Set<string>,
): {
  comEvento: number | null;
  semEvento: number | null;
  variacao: number | null;
} {
  const com: number[] = [];
  const sem: number[] = [];
  for (const d of diasDoPeriodo(porDia, p)) {
    if (d.entradas === null) continue;
    (diasDeEvento.has(d.dia) ? com : sem).push(d.entradas);
  }
  const c = media(com);
  const s = media(sem);
  return {
    comEvento: c,
    semEvento: s,
    variacao: c !== null && s ? ((c - s) / s) * 100 : null,
  };
}

/** Dias de evento (inclusive) a partir de eventos com início e fim. */
export function diasComEvento(
  eventos: { inicio: string; fim: string }[],
): Set<string> {
  const out = new Set<string>();
  for (const e of eventos)
    for (const d of datasDo({
      de: e.inicio,
      ate: e.fim < e.inicio ? e.inicio : e.fim,
    }))
      out.add(d);
  return out;
}
