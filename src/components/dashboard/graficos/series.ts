import { formatarMoeda, formatarNumero, formatarPct } from "@/lib/formato";

// Tipos e formatação dos gráficos com várias séries (colunas empilhadas,
// linhas). Os componentes são de cliente e não recebem funções do servidor:
// a unidade diz como escrever o número.

export type CorSerie = 1 | 2 | 3 | 4 | 5 | "neutro";

export interface Serie {
  chave: string;
  rotulo: string;
  /** Posição fixa da categoria na paleta (nunca o ranking). */
  cor: CorSerie;
  /** Um valor por ponto do eixo (null: sem dado naquele ponto). */
  valores: (number | null)[];
}

export interface PontoEixo {
  chave: string;
  /** Rótulo curto do eixo (ex.: "13/10"). */
  rotulo: string;
  /** Título da dica (ex.: "Semana de 13/10 a 19/10"). */
  titulo?: string;
}

export type Unidade = "numero" | "moeda" | "moeda0" | "pct" | "nota";

export function formatar(v: number | null, u: Unidade): string {
  if (v === null || !Number.isFinite(v)) return "—";
  switch (u) {
    case "moeda":
      return formatarMoeda(v);
    case "moeda0":
      return formatarMoeda(v, 0);
    case "pct":
      return formatarPct(v);
    case "nota":
      return formatarNumero(v, 1);
    default:
      return formatarNumero(v);
  }
}

/** Rótulo do eixo, curto: 12.500 → "12,5 mil". */
export function formatarEixo(v: number, u: Unidade): string {
  const curto =
    Math.abs(v) >= 1000
      ? `${formatarNumero(v / 1000, v % 1000 === 0 ? 0 : 1)} mil`
      : formatarNumero(v, u === "nota" ? 1 : 0);
  if (u === "moeda" || u === "moeda0") return `R$ ${curto}`;
  if (u === "pct") return `${curto}%`;
  return curto;
}

export const corDa = (c: CorSerie) =>
  c === "neutro" ? "var(--serie-neutro)" : `var(--serie-${c})`;

/** Legenda das séries (sempre visível com 2 ou mais séries). */
export function itensDaLegenda(series: Serie[]) {
  return series.map((s) => ({
    chave: s.chave,
    rotulo: s.rotulo,
    cor: corDa(s.cor),
  }));
}
