// Planejamento orçamentário do RH (spec de 07/11/2026). O orçamento do ano é
// um valor único que vem do ERP; cada gasto abate do orçamento do ano da sua
// data. Funções puras: o servidor lê os gastos e o orçamento, a tela mostra.

export interface GastoDoAno {
  id: string;
  /** aaaa-mm-dd */
  data: string;
  valor: number;
  categoria_id: string;
  categoria: string;
  descricao: string;
  finalidade: string;
  observacao: string | null;
}

export interface MesDoOrcamento {
  /** aaaa-mm-01 */
  competencia: string;
  /** Gasto lançado no mês. */
  gasto: number;
  /** Gasto do ano até o fim do mês. */
  acumulado: number;
  /** Orçamento − acumulado (negativo: passou); null sem orçamento. */
  saldo: number | null;
  /** % do orçamento consumido até o fim do mês; null sem orçamento. */
  consumidoPct: number | null;
}

const arred = (v: number) => Math.round(v * 100) / 100;

/** Ano de uma data aaaa-mm-dd. */
export const anoDe = (data: string) => Number(data.slice(0, 4));

/** Mês (1 a 12) de uma data aaaa-mm-dd. */
export const mesDe = (data: string) => Number(data.slice(5, 7));

/** Os 12 meses do ano, com o gasto, o acumulado e o saldo de cada um. */
export function mesesDoAno(
  ano: number,
  gastos: Pick<GastoDoAno, "data" | "valor">[],
  orcamento: number | null,
): MesDoOrcamento[] {
  const porMes = Array.from({ length: 12 }, () => 0);
  for (const g of gastos) {
    if (anoDe(g.data) !== ano) continue;
    const i = mesDe(g.data) - 1;
    porMes[i] = (porMes[i] ?? 0) + g.valor;
  }
  let acumulado = 0;
  return porMes.map((gasto, i) => {
    acumulado += gasto;
    return {
      competencia: `${ano}-${String(i + 1).padStart(2, "0")}-01`,
      gasto: arred(gasto),
      acumulado: arred(acumulado),
      saldo: orcamento === null ? null : arred(orcamento - acumulado),
      consumidoPct:
        orcamento === null || orcamento <= 0
          ? null
          : (acumulado / orcamento) * 100,
    };
  });
}

export interface TotalDaCategoria {
  categoria_id: string;
  categoria: string;
  total: number;
  lancamentos: number;
}

/** Total por categoria, do maior para o menor. */
export function porCategoria(
  gastos: Pick<GastoDoAno, "categoria_id" | "categoria" | "valor">[],
): TotalDaCategoria[] {
  const mapa = new Map<string, TotalDaCategoria>();
  for (const g of gastos) {
    const t = mapa.get(g.categoria_id) ?? {
      categoria_id: g.categoria_id,
      categoria: g.categoria,
      total: 0,
      lancamentos: 0,
    };
    t.total += g.valor;
    t.lancamentos += 1;
    mapa.set(g.categoria_id, t);
  }
  return [...mapa.values()]
    .map((t) => ({ ...t, total: arred(t.total) }))
    .sort(
      (a, b) => b.total - a.total || a.categoria.localeCompare(b.categoria),
    );
}

export interface FiltroDoOrcamento {
  /** 1 a 12; null: o ano inteiro. */
  mes: number | null;
  categoria: string | null;
}

/** Gastos que o filtro de mês e de categoria deixa (o ano já vem certo). */
export function filtrarGastos<
  T extends Pick<GastoDoAno, "data" | "categoria_id">,
>(gastos: T[], f: FiltroDoOrcamento): T[] {
  return gastos.filter(
    (g) =>
      (f.mes === null || mesDe(g.data) === f.mes) &&
      (f.categoria === null || g.categoria_id === f.categoria),
  );
}

export const soma = (gastos: Pick<GastoDoAno, "valor">[]) =>
  arred(gastos.reduce((s, g) => s + g.valor, 0));

/**
 * Ano em uso: o corrente ou, se ele já foi finalizado, o seguinte (e assim
 * por diante). É o ano que a tela abre e cujo orçamento a sincronização
 * puxa do ERP.
 */
export function anoEmUso(anoAtual: number, finalizados: number[]): number {
  const fechados = new Set(finalizados);
  let ano = anoAtual;
  while (fechados.has(ano)) ano += 1;
  return ano;
}
