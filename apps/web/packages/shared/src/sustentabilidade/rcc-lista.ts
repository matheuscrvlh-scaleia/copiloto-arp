// Tela de RCC (spec 4.7): cada nota calculada com o fator e o preço vigentes
// na competência dela, filtros, cartões e o resumo por mês (gráfico e Painel).
// Funções puras; a leitura fica em src/server/sustentabilidade/rcc.ts.

import {
  type CacambasDaNota,
  calcularNota,
  fatorVigente,
  type PrecosRcc,
  type ResultadoNota,
  totaisDoPeriodo,
} from "./rcc";

export interface NotaRcc extends CacambasDaNota {
  id: string;
  /** "aaaa-mm-01". */
  competencia: string;
  empresa: string;
  numero: string;
  /** Caminho do PDF em src/server/arquivos. */
  pdf: string;
  /** Valor total da nota (rcc_nota_valores); null sem permissão ou não informado. */
  valorTotal: number | null;
  exemplo: boolean;
}

export interface FatorDoRcc {
  /** "aaaa-mm-dd". */
  vigenteDesde: string;
  toneladasPorCacamba: number;
}

export interface PrecoDoRcc extends PrecosRcc {
  vigenteDesde: string;
}

export type NotaCalculada = NotaRcc &
  ResultadoNota & {
    /** Início da vigência do fator usado (para conferir a conta). */
    fatorDesde: string;
    toneladasPorCacamba: number;
  };

/**
 * Calcula cada nota com o fator vigente na competência. `precos` null = sem
 * permissão de valores (o valor economizado fica null, nunca zero); com
 * permissão e sem preço vigente na competência, também null.
 */
export function calcularNotas(
  notas: readonly NotaRcc[],
  fatores: readonly FatorDoRcc[],
  precos: readonly PrecoDoRcc[] | null,
): NotaCalculada[] {
  return notas.map((n) => {
    const fator = fatorVigente(fatores, n.competencia);
    if (!fator)
      throw new Error(
        `Sem fator de toneladas por caçamba vigente em ${n.competencia.slice(0, 7)}: cadastre nos Parâmetros.`,
      );
    const preco = precos ? fatorVigente(precos, n.competencia) : null;
    return {
      ...n,
      ...calcularNota(n, fator, preco),
      fatorDesde: fator.vigenteDesde,
      toneladasPorCacamba: fator.toneladasPorCacamba,
    };
  });
}

export interface FiltroRcc {
  ano: number;
  /** "" = todas as empresas. */
  empresa: string;
}

export function filtrarNotas<
  T extends Pick<NotaRcc, "competencia" | "empresa">,
>(notas: readonly T[], f: FiltroRcc): T[] {
  return notas.filter(
    (n) =>
      n.competencia.startsWith(`${f.ano}-`) &&
      (!f.empresa || n.empresa === f.empresa),
  );
}

export interface MesRcc {
  /** "aaaa-mm-01". */
  competencia: string;
  cacambasA: number;
  cacambasB: number;
  toneladasA: number;
  toneladasB: number;
  total: number;
  /** % reciclado sobre as somas do mês; null sem caçamba. */
  pctReciclado: number | null;
  /** null: sem permissão de valores ou nota sem preço vigente. */
  valorEconomizado: number | null;
}

/** Soma das notas de cada mês com nota (mês sem nota não aparece: não é zero). */
export function resumoPorMes(notas: readonly NotaCalculada[]): MesRcc[] {
  const meses = new Map<string, NotaCalculada[]>();
  for (const n of notas)
    meses.set(n.competencia, [...(meses.get(n.competencia) ?? []), n]);
  return [...meses.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([competencia, ns]) => {
      const t = totaisDoPeriodo(ns);
      return {
        competencia,
        cacambasA: t.cacambasA,
        cacambasB: t.cacambasB,
        toneladasA: t.toneladasA,
        toneladasB: t.toneladasB,
        total: t.toneladasTotal,
        pctReciclado: t.pctReciclado,
        valorEconomizado: t.valorEconomizado,
      };
    });
}

/** Notas sem valor economizado por falta de preço vigente (com permissão de valores). */
export const semPreco = (notas: readonly NotaCalculada[]): number =>
  notas.filter((n) => n.valorEconomizado === null).length;

/** Caçambas do mês da competência ("aaaa-mm-01" ou "aaaa-mm"). */
export function cacambasDoMes(
  notas: readonly (CacambasDaNota & Pick<NotaRcc, "competencia">)[],
  competencia: string,
): { a: number; b: number } {
  const mes = competencia.slice(0, 7);
  let a = 0;
  let b = 0;
  for (const n of notas)
    if (n.competencia.startsWith(mes)) {
      a += n.cacambasA;
      b += n.cacambasB;
    }
  return { a, b };
}
