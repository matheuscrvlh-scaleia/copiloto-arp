// Tela de Rondas (spec 4.6): linhas da lista, filtros, cartões, média por
// local e cor e os pontos do gráfico semanal. Só percentuais (volume em
// litros ou kg só depois da fórmula confirmada). Funções puras.

import {
  type CorColetor,
  coletoresCheios,
  diaDaRonda,
  type ItemRonda,
  ocupacaoMedia,
  type PontoSemanal,
  type Ronda,
  rondasNoMes,
  serieSemanal,
  ultimaRonda,
} from "./rondas";

export interface ItemLido extends ItemRonda {
  /** Id do item (ronda_itens). */
  id: string;
  local: string;
  observacao: string | null;
  foto: string | null;
}

export interface RondaLida extends Ronda {
  id: string;
  itens: readonly ItemLido[];
  /** Nome de quem lançou (null se a pessoa não existe mais ou não é visível). */
  lancadoPor: string | null;
  exemplo: boolean;
}

export interface LinhaRonda {
  chave: string;
  rondaId: string;
  dataHora: string;
  local: string;
  cor: CorColetor;
  conteineres: number;
  ocupacaoPct: number;
  /** Ocupação no limite ou acima (alerta). */
  cheio: boolean;
  lancadoPor: string | null;
  observacao: string | null;
  exemplo: boolean;
}

export type CartaoRondas = "preto" | "azul" | "cheios";
export const CARTOES_RONDAS: readonly CartaoRondas[] = [
  "preto",
  "azul",
  "cheios",
];

export const ehCartaoRondas = (v: string): v is CartaoRondas =>
  (CARTOES_RONDAS as readonly string[]).includes(v);

/** Uma linha por coletor visitado em cada ronda, da mais recente para a mais antiga. */
export function linhasDasRondas(
  rondas: readonly RondaLida[],
  limitePct: number,
): LinhaRonda[] {
  return rondas
    .flatMap((r) =>
      r.itens.map((i) => ({
        chave: i.id,
        rondaId: r.id,
        dataHora: r.dataHora,
        local: i.local,
        cor: i.cor,
        conteineres: i.conteineres,
        ocupacaoPct: i.ocupacaoPct,
        cheio: i.ocupacaoPct >= limitePct,
        lancadoPor: r.lancadoPor,
        observacao: i.observacao,
        exemplo: r.exemplo,
      })),
    )
    .sort(
      (a, b) =>
        Date.parse(b.dataHora) - Date.parse(a.dataHora) ||
        a.local.localeCompare(b.local, "pt-BR") ||
        a.cor.localeCompare(b.cor),
    );
}

export interface FiltroRondas {
  /** aaaa-mm-dd, inclusive (dia de Brasília). */
  de: string;
  ate: string;
  local: string;
  cor: CorColetor | "";
  cartao: CartaoRondas | "";
}

/** Período, local, cor e o filtro do cartão clicado. */
export function filtrarLinhas(
  linhas: readonly LinhaRonda[],
  f: FiltroRondas,
): LinhaRonda[] {
  return linhas.filter((l) => {
    const dia = diaDaRonda(l.dataHora);
    return (
      dia >= f.de &&
      dia <= f.ate &&
      (!f.local || l.local === f.local) &&
      (!f.cor || l.cor === f.cor) &&
      (f.cartao !== "preto" || l.cor === "preto") &&
      (f.cartao !== "azul" || l.cor === "azul") &&
      (f.cartao !== "cheios" || l.cheio)
    );
  });
}

/** Só os itens do local, descartando as rondas que não passaram nele. */
export function rondasDoLocal(
  rondas: readonly RondaLida[],
  local: string,
): RondaLida[] {
  if (!local) return [...rondas];
  return rondas
    .map((r) => ({ ...r, itens: r.itens.filter((i) => i.local === local) }))
    .filter((r) => r.itens.length > 0);
}

export interface ResumoDasRondas {
  /** Dia da última ronda (aaaa-mm-dd); null sem ronda. */
  ultima: string | null;
  /** Ocupação média ponderada (%); null = sem dado. */
  pretos: number | null;
  azuis: number | null;
  /** Coletores no limite ou acima na última ronda. */
  cheios: number;
}

/** Cartões "última ronda" até o dia `ate` (inclusive). */
export function resumoDaUltimaRonda(
  rondas: readonly Ronda[],
  ate: string,
  limitePct: number,
): ResumoDasRondas {
  const ultima = ultimaRonda(
    rondas.filter((r) => diaDaRonda(r.dataHora) <= ate),
  );
  if (!ultima) return { ultima: null, pretos: null, azuis: null, cheios: 0 };
  return {
    ultima: diaDaRonda(ultima.dataHora),
    pretos: ocupacaoMedia(ultima.itens, "preto"),
    azuis: ocupacaoMedia(ultima.itens, "azul"),
    cheios: coletoresCheios(ultima.itens, limitePct).length,
  };
}

/** Rondas no mês do dia `ate`. */
export const rondasDoMes = (rondas: readonly Ronda[], ate: string): number =>
  rondasNoMes(rondas, ate.slice(0, 7));

export interface MediaDoLocal {
  local: string;
  cor: CorColetor;
  /** Rondas em que o coletor foi visitado. */
  rondas: number;
  /** Soma dos contêineres encontrados em todas as visitas. */
  conteineres: number;
  /** Média ponderada pelos contêineres (%); null sem contêiner. */
  ocupacaoMedia: number | null;
  /** Maior ocupação do período. */
  maxima: number;
}

/** Média do período por local e cor, ponderada pelos contêineres. */
export function mediaPorLocalECor(
  linhas: readonly LinhaRonda[],
): MediaDoLocal[] {
  const grupos = new Map<string, LinhaRonda[]>();
  for (const l of linhas) {
    const k = `${l.local}\u0000${l.cor}`;
    grupos.set(k, [...(grupos.get(k) ?? []), l]);
  }
  return [...grupos.values()]
    .map((ls) => {
      const itens: ItemRonda[] = ls.map((l) => ({
        coletorId: l.local,
        cor: l.cor,
        conteineres: l.conteineres,
        ocupacaoPct: l.ocupacaoPct,
      }));
      const primeira = ls[0] as LinhaRonda;
      return {
        local: primeira.local,
        cor: primeira.cor,
        rondas: new Set(ls.map((l) => l.rondaId)).size,
        conteineres: ls.reduce((t, l) => t + l.conteineres, 0),
        ocupacaoMedia: ocupacaoMedia(itens, primeira.cor),
        maxima: Math.max(...ls.map((l) => l.ocupacaoPct)),
      };
    })
    .sort(
      (a, b) =>
        a.cor.localeCompare(b.cor) || a.local.localeCompare(b.local, "pt-BR"),
    );
}

/** Ocupação média do período inteiro, por cor (a linha "Total" da média). */
export function mediaGeralPorCor(
  linhas: readonly LinhaRonda[],
  cor: CorColetor,
): number | null {
  return ocupacaoMedia(
    linhas.map((l) => ({
      coletorId: l.local,
      cor: l.cor,
      conteineres: l.conteineres,
      ocupacaoPct: l.ocupacaoPct,
    })),
    cor,
  );
}

/** As 12 semanas até a de `ate` (pretos e azuis), do gráfico. */
export function semanasDoGrafico(
  rondas: readonly Ronda[],
  ate: string,
  semanas = 12,
): PontoSemanal[] {
  return serieSemanal(rondas, ate, semanas);
}
