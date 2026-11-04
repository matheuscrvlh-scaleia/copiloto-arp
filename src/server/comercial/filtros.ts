import "server-only";
import { type Busca, filtrosLembrados } from "@/server/preferencias/filtros";
import { type ContextoCom, contextoCom } from "./base";

// Filtros de uma tela do Comercial: os da URL ou, sem nenhum, os últimos
// que a pessoa usou ("?limpar=1" volta ao padrão de cada filtro).

export type { Busca };

export interface FiltrosCom {
  ctx: ContextoCom;
  /** Filtros que valem (URL ou lembrados). */
  busca: Busca;
  /** Query lembrada para a barra colocar na URL (ou null). */
  lembrado: string | null;
  /** Valor de um filtro ("" quando não veio: a tela aplica o padrão). */
  um: (chave: string) => string;
}

/** Lê a sessão: use dentro de <Suspense>. */
export async function lerFiltros(
  tela: string,
  buscaUrl: Busca,
): Promise<FiltrosCom> {
  const [ctx, { busca, lembrado }] = await Promise.all([
    contextoCom(),
    filtrosLembrados("comercial", tela, buscaUrl),
  ]);
  const um = (chave: string) => {
    const v = busca[chave];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  return { ctx, busca, lembrado, um };
}
