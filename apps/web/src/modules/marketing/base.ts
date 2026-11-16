import { metaVigente } from "@arp/shared/indicadores";
import type {
  IndicadorMkt,
  LandingPage,
  MetaMkt,
} from "@arp/shared/marketing/contratos/base";
import {
  type AtalhoMkt,
  anoAnteriorMkt,
  anteriorMkt,
  descreverPeriodoMkt,
  lerPeriodoMkt,
  type PeriodoMkt,
} from "@arp/shared/marketing/periodo";
import { hojeEmBrasilia } from "@arp/shared/os/tempo";
import type { Permissao } from "@arp/shared/permissions";
import { useMemo } from "react";
import { type Usuario, useSessao } from "@/lib/sessao";
import { type Busca, useFiltrosLembrados } from "@/modules/shell/api";

// Base das telas do Marketing: quem está logado, "hoje" e os filtros de cada
// tela (o que veio na URL ou os últimos usados pela pessoa), com o período e
// o anterior de mesmo tamanho para a comparação.

export type { Busca };

export interface ContextoMkt {
  usuario: Usuario;
  pode: (p: Permissao) => boolean;
  /** "aaaa-mm-dd" de hoje em Brasília. */
  hoje: string;
  /**
   * Quando os dados foram atualizados ("Dados de dd/mm/aaaa às hh:mm"). No
   * mockup, a sincronização diária das 06h de hoje.
   */
  dadosDe: string;
}

/** Usuário, permissões e a data de hoje. */
export function useContextoMkt(): ContextoMkt {
  const { usuario, pode } = useSessao();
  return useMemo(() => {
    const hoje = hojeEmBrasilia(new Date());
    const [a, m, d] = hoje.split("-");
    return {
      usuario,
      pode: (p: Permissao) => pode(p),
      hoje,
      dadosDe: `Dados de ${d}/${m}/${a} às 06:00`,
    };
  }, [usuario, pode]);
}

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

/** Os filtros da tela; null enquanto a API responde os lembrados. */
export function useFiltrosMkt(
  tela: string,
  padrao: AtalhoMkt,
): FiltrosLidos | null {
  const ctx = useContextoMkt();
  const { busca, lembrado, pronto } = useFiltrosLembrados("marketing", tela);
  return useMemo(
    () => (pronto ? lerFiltrosMkt(ctx, busca, lembrado, padrao) : null),
    [ctx, busca, lembrado, pronto, padrao],
  );
}

/** Os filtros de uma busca já conhecida (sem os lembrados). */
export function lerFiltrosMkt(
  ctx: ContextoMkt,
  busca: Busca,
  lembrado: string | null,
  padrao: AtalhoMkt,
): FiltrosLidos {
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

const ehInteresse = (v: string | null): v is Interesse =>
  v !== null && v in INTERESSES;

/**
 * Interesse de cada landing page pelo cadastro de Configurações. Landing page
 * do RD que não está no cadastro (ou sem interesse) é "Sem tipo".
 */
export function interesseDasLandingPages(
  lps: LandingPage[],
): (identificador: string) => Interesse {
  const mapa = new Map(
    lps.map((l) => [
      l.identificador,
      ehInteresse(l.interesse) ? l.interesse : null,
    ]),
  );
  return (id) => mapa.get(id) ?? "sem_tipo";
}

/** Meta que vale no mês ("aaaa-mm-01"): a última com vigência até ele. */
export function metaMkt(
  metas: MetaMkt[],
  indicador: IndicadorMkt,
  mes: string,
): MetaMkt | null {
  return metaVigente(metas, indicador, mes);
}
