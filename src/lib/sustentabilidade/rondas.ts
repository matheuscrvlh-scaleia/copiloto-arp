// Rondas dos coletores (spec 4.6): ocupação média por cor ponderada pelos
// contêineres, coletores cheios, rondas no mês e série semanal. Coletor não
// visitado não tem item (nunca vira zero). Funções puras.

import { diaEmBrasilia, somarDias } from "@/lib/comercial/datas";
import { diaDaSemana } from "@/lib/os/tempo";

export type CorColetor = "preto" | "azul";

export interface ItemRonda {
  coletorId: string;
  cor: CorColetor;
  conteineres: number;
  /** 0 a 100, de 10 em 10. */
  ocupacaoPct: number;
}

export interface Ronda {
  /** Timestamp do banco ou "aaaa-mm-dd". */
  dataHora: string;
  itens: readonly ItemRonda[];
}

/**
 * Média dos percentuais da cor, ponderada pelos contêineres. Item com 0
 * contêineres não pesa; sem nenhum item com contêiner, null ("sem dado").
 */
export function ocupacaoMedia(
  itens: readonly ItemRonda[],
  cor: CorColetor,
): number | null {
  let peso = 0;
  let soma = 0;
  for (const i of itens)
    if (i.cor === cor && i.conteineres > 0) {
      peso += i.conteineres;
      soma += i.ocupacaoPct * i.conteineres;
    }
  return peso ? soma / peso : null;
}

/** Itens com ocupação no limite ou acima (alerta e chamado de recolhimento). */
export function coletoresCheios(
  itens: readonly ItemRonda[],
  limitePct: number,
): ItemRonda[] {
  return itens.filter((i) => i.ocupacaoPct >= limitePct);
}

/** Dia da ronda em Brasília (a ronda das 22h do dia 30 é do dia 30). */
export function diaDaRonda(dataHora: string): string {
  return dataHora.length === 10 ? dataHora : diaEmBrasilia(dataHora);
}

/** Rondas no mês da competência ("aaaa-mm-01" ou "aaaa-mm"). */
export function rondasNoMes(
  rondas: readonly Pick<Ronda, "dataHora">[],
  competencia: string,
): number {
  const mes = competencia.slice(0, 7);
  return rondas.filter((r) => diaDaRonda(r.dataHora).startsWith(mes)).length;
}

/** A ronda mais recente (cartões "última ronda"); null sem ronda. */
export function ultimaRonda<R extends Pick<Ronda, "dataHora">>(
  rondas: readonly R[],
): R | null {
  let ultima: R | null = null;
  for (const r of rondas)
    if (!ultima || Date.parse(r.dataHora) > Date.parse(ultima.dataHora))
      ultima = r;
  return ultima;
}

/** Segunda-feira da semana da data. */
export function inicioDaSemana(data: string): string {
  return somarDias(data, -((diaDaSemana(data) + 6) % 7));
}

export interface PontoSemanal {
  /** Segunda-feira da semana. */
  semana: string;
  preto: number | null;
  azul: number | null;
}

/**
 * Ocupação média por semana (segunda a domingo), das `semanas` últimas até
 * a semana de `ate`, juntando os itens de todas as rondas da semana.
 * Semana sem ronda fica null nas duas cores.
 */
export function serieSemanal(
  rondas: readonly Ronda[],
  ate: string,
  semanas: number,
): PontoSemanal[] {
  const ultima = inicioDaSemana(ate);
  const porSemana = new Map<string, ItemRonda[]>();
  for (const r of rondas) {
    const s = inicioDaSemana(diaDaRonda(r.dataHora));
    porSemana.set(s, [...(porSemana.get(s) ?? []), ...r.itens]);
  }
  return Array.from({ length: semanas }, (_, i) => {
    const semana = somarDias(ultima, -7 * (semanas - 1 - i));
    const itens = porSemana.get(semana) ?? [];
    return {
      semana,
      preto: ocupacaoMedia(itens, "preto"),
      azul: ocupacaoMedia(itens, "azul"),
    };
  });
}
