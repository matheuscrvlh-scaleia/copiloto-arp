import "server-only";
import {
  type AtalhoMkt,
  anoAnteriorMkt,
  anteriorMkt,
  descreverPeriodoMkt,
  lerPeriodoMkt,
  type PeriodoMkt,
} from "@/lib/marketing/periodo";
import { type Busca, filtrosLembrados } from "@/server/preferencias/filtros";
import { type ContextoMkt, contextoMkt, landingPages } from "./base";

// Filtros de uma tela do Marketing: o que veio na URL (ou os últimos usados
// pela pessoa), o período e o anterior de mesmo tamanho para a comparação.

export type { Busca };

export interface FiltrosLidos {
  ctx: ContextoMkt;
  /** Configurações que valem (URL ou lembrados). */
  busca: Busca;
  /** Query lembrada para a barra colocar na URL (ou null). */
  lembrado: string | null;
  periodo: PeriodoMkt;
  anterior: PeriodoMkt;
  /** "13/10/2026 a 19/10/2026". */
  rotulo: string;
  /** "semana anterior", "período anterior"… para a variação dos cartões. */
  rotuloAnterior: string;
  /** Comparação contra o mesmo período do ano passado (?comparar=ano). */
  comparar: "" | "ano";
  /** Valor de um filtro de seleção ("" = todos). */
  um: (chave: string) => string;
}

export async function lerFiltros(
  tela: string,
  buscaUrl: Busca,
  padrao: AtalhoMkt,
): Promise<FiltrosLidos> {
  const [ctx, { busca, lembrado }] = await Promise.all([
    contextoMkt(),
    filtrosLembrados("marketing", tela, buscaUrl),
  ]);
  const periodo = lerPeriodoMkt(busca, padrao, ctx.hoje);
  const um = (chave: string) => {
    const v = busca[chave];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  // ?comparar=ano: contra o mesmo período do ano passado.
  const doAno = um("comparar") === "ano";
  const anterior = doAno ? anoAnteriorMkt(periodo) : anteriorMkt(periodo);
  const rotuloAnterior = doAno
    ? `mesmo período de ${anterior.de.slice(0, 4)}`
    : periodo.atalho === "semana_passada" || periodo.atalho === "esta_semana"
      ? "semana anterior"
      : periodo.atalho === "mes" || periodo.atalho === "mes_passado"
        ? "período anterior"
        : periodo.atalho === "fim_de_semana"
          ? "fim de semana anterior"
          : `${descreverPeriodoMkt(anterior)}`;
  return {
    ctx,
    busca,
    lembrado,
    periodo,
    anterior,
    rotulo: descreverPeriodoMkt(periodo),
    rotuloAnterior,
    comparar: doAno ? "ano" : "",
    um,
  };
}

export type Interesse = "evento" | "locacao" | "outro" | "sem_tipo";

export const INTERESSES: Record<Interesse, string> = {
  evento: "Evento",
  locacao: "Locação",
  outro: "Outro",
  sem_tipo: "Sem tipo",
};

/**
 * Interesse de cada landing page pelo cadastro de Configurações. Landing page
 * do RD que não está no cadastro (ou sem interesse) é "Sem tipo".
 */
export async function interesseDasLandingPages(): Promise<
  (identificador: string) => Interesse
> {
  const lps = await landingPages();
  const mapa = new Map(
    lps.map((l) => [l.identificador, l.interesse as Interesse | null]),
  );
  return (id) => mapa.get(id) ?? "sem_tipo";
}
