import { buscaNoOr } from "./filtro-postgrest";

// Aba "Links das lojas" do Portal e a lista de Lojas (contratos): filtros
// da URL e a busca que vai ao banco. Regras puras; as consultas ficam em
// src/server/os/portal.ts e src/server/os/lojas.ts.

export const FILTROS_PORTAL = {
  com_link: "Com link",
  sem_link: "Sem link",
  pedidos: "Com pedidos no mês",
  avaliadas: "Avaliadas",
} as const;
export type FiltroPortal = keyof typeof FILTROS_PORTAL;

export const SITUACOES_LOJA = {
  vigente: "Vigentes",
  encerrado: "Encerradas",
  todas: "Todas",
} as const;
export type SituacaoLoja = keyof typeof SITUACOES_LOJA;

type Busca = Record<string, string | string[] | undefined>;

const um = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

export function lerFiltroPortal(sp: Busca): {
  f: FiltroPortal | null;
  q: string;
} {
  const f = um(sp.f);
  return {
    f: Object.hasOwn(FILTROS_PORTAL, f) ? (f as FiltroPortal) : null,
    q: um(sp.q).slice(0, 80),
  };
}

export function lerFiltroLojas(sp: Busca): { s: SituacaoLoja; q: string } {
  const s = um(sp.s);
  return {
    s: Object.hasOwn(SITUACOES_LOJA, s) ? (s as SituacaoLoja) : "vigente",
    q: um(sp.q).slice(0, 80),
  };
}

/** Busca das lojas: LUC, nome e bloco (e, nos contratos, locatário e CNPJ). */
export function buscaDeLojas(q: string, contratos = false): string | null {
  return buscaNoOr(
    q,
    contratos
      ? ["luc", "nome", "bloco", "locatario", "cnpj"]
      : ["luc", "nome", "bloco"],
  );
}
