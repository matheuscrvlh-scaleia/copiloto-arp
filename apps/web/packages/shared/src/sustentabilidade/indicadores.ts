// Motor dos indicadores dos programas (spec 4.8) e soma por grupo de impacto
// para o painel (4.9). Cada indicador é calculado direto dos lançamentos de
// cada janela (mês ou período). Nunca some meses de "contagem de valores
// diferentes": a mesma produtora em jan e fev é 1 no ano, não 2. Funções puras.
//
// Valores aceitos em `lancamento.valores[campoId]`: number, string, string[]
// (várias opções), { n, u } (número com unidade) e { r: "sim" | "nao", d? }.

import { lerValorBr } from "../formato";
import { normalizar } from "../operacoes/agua-formato";

export type Calculo =
  | "soma"
  | "contagem"
  | "contagem_distintos"
  | "media"
  | "percentual";

export interface DefinicaoIndicador {
  campoId: string;
  calculo: Calculo;
  /** Só os lançamentos com este campo = valor (ex.: tipo = "Oficina"). */
  filtro: { campoId: string; valor: string } | null;
  /** No "percentual": a resposta contada (ex.: público = "Turista"). */
  percentualValor?: string | null;
}

export interface Lancamento {
  /** Data do fato, "aaaa-mm-dd". */
  data: string;
  valores: Readonly<Record<string, unknown>>;
}

const ehObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Número do valor (number, texto "1.234,5" ou { n }); null se não há. */
export function numeroDoValor(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = lerValorBr(v);
    return n !== null && Number.isFinite(n) ? n : null;
  }
  if (ehObjeto(v)) return numeroDoValor(v.n);
  return null;
}

/** Textos do valor, normalizados (sem acento, minúsculo), para comparar. */
export function textosDoValor(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.flatMap(textosDoValor);
  if (typeof v === "string" || typeof v === "number")
    return [normalizar(String(v))].filter(Boolean);
  if (typeof v === "boolean") return [v ? "sim" : "nao"];
  if (ehObjeto(v)) return textosDoValor("r" in v ? v.r : v.n);
  return [];
}

const tem = (l: Lancamento, campoId: string, valor: string) =>
  textosDoValor(l.valores[campoId]).includes(normalizar(valor));

/** Lançamentos que passam no filtro do indicador. */
export function filtrar(
  def: Pick<DefinicaoIndicador, "filtro">,
  lancamentos: readonly Lancamento[],
): Lancamento[] {
  const f = def.filtro;
  return f
    ? lancamentos.filter((l) => tem(l, f.campoId, f.valor))
    : [...lancamentos];
}

/**
 * Valor do indicador sobre um conjunto de lançamentos (uma janela só).
 * Sem nenhum lançamento: null ("sem dado"). Com lançamentos que o filtro
 * tira todos: 0 (houve lançamento, não houve o que contar).
 * - soma: soma dos números do campo.
 * - contagem: cada lançamento conta 1; campo de várias opções conta cada
 *   opção marcada (a mesma produtora em 4 feiras = 4 participações).
 * - contagem_distintos: valores diferentes (sem acento/caixa) da janela.
 * - media: média dos números do campo; null se nenhum.
 * - percentual: lançamentos com campo = `percentualValor` ÷ lançamentos
 *   filtrados, de 0 a 100; null se nenhum.
 */
export function valorDoIndicador(
  def: DefinicaoIndicador,
  lancamentos: readonly Lancamento[],
): number | null {
  if (lancamentos.length === 0) return null;
  const linhas = filtrar(def, lancamentos);
  const campo = (l: Lancamento) => l.valores[def.campoId];
  switch (def.calculo) {
    case "soma":
      return linhas.reduce((t, l) => t + (numeroDoValor(campo(l)) ?? 0), 0);
    case "contagem":
      return linhas.reduce((t, l) => {
        const v = campo(l);
        return t + (Array.isArray(v) ? v.length : 1);
      }, 0);
    case "contagem_distintos":
      return new Set(linhas.flatMap((l) => textosDoValor(campo(l)))).size;
    case "media": {
      const nums = linhas
        .map((l) => numeroDoValor(campo(l)))
        .filter((n): n is number => n !== null);
      return nums.length ? nums.reduce((t, n) => t + n, 0) / nums.length : null;
    }
    case "percentual": {
      if (!linhas.length) return null;
      const alvo = def.percentualValor ?? "";
      const sim = linhas.filter((l) => tem(l, def.campoId, alvo)).length;
      return (sim / linhas.length) * 100;
    }
  }
}

export interface IndicadorCalculado {
  porMes: { competencia: string; valor: number | null }[];
  /** Calculado sobre todos os lançamentos do período, nunca somando meses. */
  periodo: number | null;
}

/**
 * Indicador mês a mês e no período (as `competencias`, "aaaa-mm-01").
 * Lançamentos fora das competências são ignorados.
 */
export function calcularIndicador(
  def: DefinicaoIndicador,
  lancamentos: readonly Lancamento[],
  competencias: readonly string[],
): IndicadorCalculado {
  const meses = new Map(
    competencias.map((c) => [c.slice(0, 7), [] as Lancamento[]]),
  );
  for (const l of lancamentos) meses.get(l.data.slice(0, 7))?.push(l);
  return {
    porMes: competencias.map((c) => ({
      competencia: c,
      valor: valorDoIndicador(def, meses.get(c.slice(0, 7)) ?? []),
    })),
    periodo: valorDoIndicador(def, [...meses.values()].flat()),
  };
}

// ---- Painel: soma por grupo de impacto ----

/** Só "soma" e "contagem" se somam entre indicadores do mesmo grupo. */
export function ehSomavel(calculo: Calculo): boolean {
  return calculo === "soma" || calculo === "contagem";
}

export interface IndicadorDoGrupo {
  nome: string;
  grupo: string | null;
  calculo: Calculo;
  /** Já calculado na mesma janela (mês ou ano) para todos. */
  valor: number | null;
}

export interface TotalDoGrupo {
  grupo: string;
  /** Soma dos indicadores somáveis; null se nenhum tem dado (ou não há). */
  soma: number | null;
  /**
   * Os não somáveis (valores diferentes, média, percentual), mostrados à
   * parte: "1.044 participações · 165 produtores únicos", nunca somados.
   */
  aParte: IndicadorDoGrupo[];
}

/**
 * Totais por grupo de impacto (o painel soma por grupo, não por programa).
 * Indicador sem grupo fica fora. Os valores devem vir da mesma janela,
 * calculados com `calcularIndicador` (o do ano é o `periodo`, não a soma
 * dos meses).
 */
export function somaPorGrupo(
  indicadores: readonly IndicadorDoGrupo[],
): TotalDoGrupo[] {
  const grupos = new Map<string, TotalDoGrupo>();
  for (const i of indicadores) {
    const nome = i.grupo?.trim();
    if (!nome) continue;
    const g = grupos.get(nome) ?? { grupo: nome, soma: null, aParte: [] };
    grupos.set(nome, g);
    if (!ehSomavel(i.calculo)) g.aParte.push(i);
    else if (i.valor !== null) g.soma = (g.soma ?? 0) + i.valor;
  }
  return [...grupos.values()];
}
