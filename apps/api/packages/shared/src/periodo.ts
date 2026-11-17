import {
  competenciaDe,
  fimDoMes,
  formatarData,
  formatarMes,
  isoLocal,
} from "./formato";

// Período das telas: atalhos (hoje, ontem, esta semana, este mês, mês
// passado) ou datas escolhidas. Fica na URL (?periodo=semana ou
// ?de=2026-10-01&ate=2026-10-15) para o link levar o filtro junto.

export const ATALHOS = [
  { valor: "hoje", rotulo: "Hoje" },
  { valor: "ontem", rotulo: "Ontem" },
  { valor: "semana", rotulo: "Esta semana" },
  { valor: "mes", rotulo: "Este mês" },
  { valor: "mes_passado", rotulo: "Mês passado" },
] as const;

export type Atalho = (typeof ATALHOS)[number]["valor"];

export interface Periodo {
  /** aaaa-mm-dd, inclusive. */
  de: string;
  /** aaaa-mm-dd, inclusive. */
  ate: string;
  /** null: datas escolhidas à mão. */
  atalho: Atalho | null;
}

export const PERIODO_PADRAO: Atalho = "mes";

const DATA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** "aaaa-mm-dd" que existe de verdade (31/02 não passa). */
export function dataValida(v: unknown): v is string {
  if (typeof v !== "string" || !DATA.test(v)) return false;
  const [a, m, d] = v.split("-").map(Number) as [number, number, number];
  const data = new Date(a, m - 1, d);
  return data.getMonth() === m - 1 && data.getDate() === d;
}

const dia = (d: Date, mais = 0) =>
  isoLocal(new Date(d.getFullYear(), d.getMonth(), d.getDate() + mais));

export function periodoDoAtalho(atalho: Atalho, hoje = new Date()): Periodo {
  switch (atalho) {
    case "hoje":
      return { de: dia(hoje), ate: dia(hoje), atalho };
    case "ontem":
      return { de: dia(hoje, -1), ate: dia(hoje, -1), atalho };
    case "semana": {
      // Semana de segunda a domingo, até hoje.
      const desdeSegunda = (hoje.getDay() + 6) % 7;
      return { de: dia(hoje, -desdeSegunda), ate: dia(hoje), atalho };
    }
    case "mes":
      return { de: competenciaDe(hoje), ate: dia(hoje), atalho };
    case "mes_passado": {
      const inicio = competenciaDe(
        new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1),
      );
      return { de: inicio, ate: fimDoMes(inicio), atalho };
    }
  }
}

type Valor = string | string[] | undefined;
const um = (v: Valor) => (Array.isArray(v) ? v[0] : v);

/**
 * Lê o período da URL sem confiar nela: atalho conhecido, datas válidas e em
 * ordem (invertidas são trocadas), ou ?mes=aaaa-mm (links antigos) como o mês
 * inteiro. Sem nada válido, vale o padrão (este mês).
 */
export function lerPeriodo(
  busca: Record<string, Valor>,
  hoje = new Date(),
): Periodo {
  const atalho = um(busca.periodo);
  if (ATALHOS.some((a) => a.valor === atalho))
    return periodoDoAtalho(atalho as Atalho, hoje);

  const de = um(busca.de);
  const ate = um(busca.ate);
  if (dataValida(de) && dataValida(ate))
    return de <= ate
      ? { de, ate, atalho: null }
      : { de: ate, ate: de, atalho: null };
  if (dataValida(de)) return { de, ate: de, atalho: null };

  const mes = um(busca.mes);
  if (mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
    const inicio = `${mes}-01`;
    return { de: inicio, ate: fimDoMes(inicio), atalho: null };
  }
  return periodoDoAtalho(PERIODO_PADRAO, hoje);
}

/** Parâmetros de URL do período (os outros filtros ficam como estão). */
export function paramsDoPeriodo(p: Periodo): Record<string, string> {
  return p.atalho ? { periodo: p.atalho } : { de: p.de, ate: p.ate };
}

/** Competências (dia 1) que o período toca, da mais antiga à mais nova. */
export function competenciasDoPeriodo(
  p: Pick<Periodo, "de" | "ate">,
): string[] {
  const lista: string[] = [];
  const [a, m] = p.de.split("-").map(Number) as [number, number];
  for (let i = 0; ; i++) {
    const c = competenciaDe(new Date(a, m - 1 + i, 1));
    if (c > p.ate) return lista;
    lista.push(c);
  }
}

/** O período cobre o mês inteiro da competência? */
export function cobreOMes(p: Pick<Periodo, "de" | "ate">, competencia: string) {
  return p.de <= competencia && p.ate >= fimDoMes(competencia);
}

/** Período inteiro em meses fechados (de dia 1 ao último dia)? */
export function emMesesInteiros(p: Pick<Periodo, "de" | "ate">): boolean {
  return p.de.endsWith("-01") && p.ate === fimDoMes(p.ate);
}

/** Quantos dias o período tem. */
export function diasNoPeriodo(p: Pick<Periodo, "de" | "ate">): number {
  const ms = (d: string) => {
    const [a, m, x] = d.split("-").map(Number) as [number, number, number];
    return Date.UTC(a, m - 1, x);
  };
  return Math.round((ms(p.ate) - ms(p.de)) / 86_400_000) + 1;
}

/**
 * Período imediatamente anterior, para "vs período anterior": em meses
 * inteiros, os mesmos meses antes; senão, o mesmo número de dias antes.
 */
export function periodoAnterior(p: Periodo): Periodo {
  if (emMesesInteiros(p)) {
    const meses = competenciasDoPeriodo(p).length;
    const [a, m] = p.de.split("-").map(Number) as [number, number];
    const de = competenciaDe(new Date(a, m - 1 - meses, 1));
    const ate = fimDoMes(competenciaDe(new Date(a, m - 2, 1)));
    return { de, ate, atalho: null };
  }
  // "Este mês" até hoje compara com o mesmo trecho do mês passado.
  if (p.atalho === "mes") {
    const [a, m, d] = p.ate.split("-").map(Number) as [number, number, number];
    const inicio = competenciaDe(new Date(a, m - 2, 1));
    const fim = fimDoMes(inicio);
    const mesmoDia = `${inicio.slice(0, 8)}${String(d).padStart(2, "0")}`;
    return { de: inicio, ate: mesmoDia < fim ? mesmoDia : fim, atalho: null };
  }
  const n = diasNoPeriodo(p);
  const [a, m, d] = p.de.split("-").map(Number) as [number, number, number];
  return {
    de: isoLocal(new Date(a, m - 1, d - n)),
    ate: isoLocal(new Date(a, m - 1, d - 1)),
    atalho: null,
  };
}

/** "2026-10-01" → "2026-09-30". */
export function diaAnterior(data: string): string {
  const [a, m, d] = data.split("-").map(Number) as [number, number, number];
  return isoLocal(new Date(a, m - 1, d - 1));
}

/** Até onde há dado do dia: ontem (o dia de hoje ainda está em andamento). */
export function ultimoDiaFechado(agora = new Date()): string {
  return dia(agora, -1);
}

/** Limita o fim do período a um dia (ex.: ontem, para dados do dia anterior). */
export function ateNoMaximo(p: Periodo, limite: string): Periodo {
  return p.ate > limite ? { ...p, ate: limite < p.de ? p.de : limite } : p;
}

/** "Hoje", "out/2026", "01/10/2026 a 15/10/2026"… */
export function descreverPeriodo(p: Periodo): string {
  if (p.atalho === "hoje" || p.atalho === "ontem")
    return `${ATALHOS.find((a) => a.valor === p.atalho)?.rotulo} (${formatarData(p.de)})`;
  if (p.de === p.ate) return formatarData(p.de);
  if (emMesesInteiros(p)) {
    const meses = competenciasDoPeriodo(p);
    return meses.length === 1
      ? formatarMes(p.de)
      : `${formatarMes(p.de)} a ${formatarMes(p.ate)}`;
  }
  return `${formatarData(p.de)} a ${formatarData(p.ate)}`;
}
