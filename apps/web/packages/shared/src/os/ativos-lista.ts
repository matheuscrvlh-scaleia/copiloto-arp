// Tela de Ativos (lista e "Decisão de troca"): filtros da URL e as partes
// dos filtros que vão ao banco. Regras puras; a consulta fica em
// src/server/os/ativos.ts.

export interface FiltroAtivos {
  visao: "lista" | "decisao";
  q: string;
  /** Categoria; "sem" = sem categoria. */
  cat: string;
  /** Bloco; "sem" = sem bloco. */
  local: string;
  /** "" = em uso, manutenção e parados; "todas" = com os baixados. */
  situacao: string;
  sinal: string;
  incompleto: boolean;
  preventiva: boolean;
}

type Busca = Record<string, string | string[] | undefined>;

const um = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

export function lerFiltroAtivos(sp: Busca): FiltroAtivos {
  return {
    visao: um(sp.visao) === "decisao" ? "decisao" : "lista",
    q: um(sp.q).trim(),
    cat: um(sp.cat),
    local: um(sp.local),
    situacao: um(sp.situacao),
    sinal: um(sp.sinal),
    incompleto: um(sp.incompleto) === "1",
    preventiva: um(sp.preventiva) === "atrasada",
  };
}

/**
 * Cadastro incompleto no banco, igual a `faltasNoCadastro`: sem categoria,
 * sem local (bloco, loja e área vazios), sem compra, reposição ou vida útil.
 */
export const OR_CADASTRO_INCOMPLETO = [
  "categoria_id.is.null",
  "and(or(bloco.is.null,bloco.eq.),loja_id.is.null,or(area.is.null,area.eq.))",
  "compra_data.is.null",
  "valor_reposicao.is.null",
  "valor_reposicao.eq.0",
  "vida_util_anos.is.null",
  "vida_util_anos.eq.0",
].join(",");

/** A busca da lista se o sinal ou a ordem por peso pedem o cálculo de todos. */
export function precisaDoSinal(f: FiltroAtivos): boolean {
  return f.visao === "decisao" || f.sinal !== "";
}
