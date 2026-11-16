// Curva da carteira (aba "Resumo Clientes", spec 4.5): uma linha por
// locatário somando todos os LUCs dele, ordenada pelo aluguel em contrato,
// com % do total, % acumulado e faixa A, B ou C pelos limites dos parâmetros.

export type Faixa = "A" | "B" | "C";
export const FAIXAS: Faixa[] = ["A", "B", "C"];

export interface ContratoDaCarteira {
  cliente: string;
  locatario: string;
  atividade: string;
  abl: number;
  aluguel: number;
}

export interface LinhaCarteira {
  cliente: string;
  locatario: string;
  atividade: string;
  lucs: number;
  m2: number;
  aluguel: number;
  /** null sem m² (só área publicitária). */
  valorM2: number | null;
  /** % do total do aluguel. */
  pct: number;
  /** % acumulado até esta linha. */
  acumulado: number;
  faixa: Faixa;
}

export interface LimitesCurva {
  /** Faixa A até este % acumulado (ex.: 70). */
  a: number;
  /** Faixa B até este % (ex.: 90); acima, C. */
  b: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
// Folga do ponto flutuante: 70,000000001% ainda é A.
const ATE = 1e-9;

export function faixaDo(acumulado: number, l: LimitesCurva): Faixa {
  if (acumulado <= l.a + ATE) return "A";
  if (acumulado <= l.b + ATE) return "B";
  return "C";
}

export function curvaDaCarteira(
  contratos: ContratoDaCarteira[],
  limites: LimitesCurva,
): LinhaCarteira[] {
  const por = new Map<
    string,
    Omit<LinhaCarteira, "pct" | "acumulado" | "faixa" | "valorM2">
  >();
  for (const c of contratos) {
    const x = por.get(c.cliente) ?? {
      cliente: c.cliente,
      locatario: c.locatario,
      atividade: c.atividade,
      lucs: 0,
      m2: 0,
      aluguel: 0,
    };
    x.lucs++;
    x.m2 += c.abl;
    x.aluguel += c.aluguel;
    por.set(c.cliente, x);
  }
  const linhas = [...por.values()].sort(
    (a, b) =>
      b.aluguel - a.aluguel || a.locatario.localeCompare(b.locatario, "pt-BR"),
  );
  const total = linhas.reduce((t, l) => t + l.aluguel, 0);
  let soma = 0;
  return linhas.map((l) => {
    soma += l.aluguel;
    const acumulado = total ? (soma / total) * 100 : 0;
    return {
      ...l,
      m2: r2(l.m2),
      aluguel: r2(l.aluguel),
      valorM2: l.m2 > 0 ? r2(l.aluguel / l.m2) : null,
      pct: total ? (l.aluguel / total) * 100 : 0,
      acumulado,
      faixa: faixaDo(acumulado, limites),
    };
  });
}

export interface Resumo {
  clientes: number;
  lucs: number;
  m2: number;
  aluguel: number;
  pct: number;
}

function resumir(ls: LinhaCarteira[]): Resumo {
  return {
    clientes: ls.length,
    lucs: ls.reduce((t, l) => t + l.lucs, 0),
    m2: r2(ls.reduce((t, l) => t + l.m2, 0)),
    aluguel: r2(ls.reduce((t, l) => t + l.aluguel, 0)),
    pct: ls.reduce((t, l) => t + l.pct, 0),
  };
}

export function resumoPorFaixa(ls: LinhaCarteira[]): Record<Faixa, Resumo> {
  return {
    A: resumir(ls.filter((l) => l.faixa === "A")),
    B: resumir(ls.filter((l) => l.faixa === "B")),
    C: resumir(ls.filter((l) => l.faixa === "C")),
  };
}

export function totalDaCarteira(ls: LinhaCarteira[]): Resumo {
  return resumir(ls);
}

/** Segundo quadro: por atividade, do maior aluguel para o menor. */
export function porAtividade(
  ls: LinhaCarteira[],
): ({ atividade: string } & Resumo)[] {
  const grupos = new Map<string, LinhaCarteira[]>();
  for (const l of ls)
    grupos.set(l.atividade, [...(grupos.get(l.atividade) ?? []), l]);
  return [...grupos]
    .map(([atividade, g]) => ({ atividade, ...resumir(g) }))
    .sort((a, b) => b.aluguel - a.aluguel);
}

/** "até 70%", "70% a 90%", "acima de 90%". */
export function rotuloDaFaixa(f: Faixa, l: LimitesCurva): string {
  const n = (v: number) => String(v).replace(".", ",");
  if (f === "A") return `até ${n(l.a)}%`;
  if (f === "B") return `${n(l.a)}% a ${n(l.b)}%`;
  return `acima de ${n(l.b)}%`;
}
