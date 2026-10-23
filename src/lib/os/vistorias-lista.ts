import { dataValida } from "@/lib/periodo";
import { limitesDoMes } from "./filtro-postgrest";

// Tela de Vistorias: filtros da URL e o que cada cartão pede ao banco.
// Regras puras; a consulta fica em src/server/os/vistorias.ts.

export const CARTOES_VISTORIA = {
  andamento: "Em andamento",
  assinatura: "Aguardando assinatura",
  concluidas: "Concluídas no mês",
  com_os: "Com OS gerada",
} as const;
export type CartaoVistoria = keyof typeof CARTOES_VISTORIA;

export interface FiltroVistorias {
  q: string;
  tipo: string;
  status: string;
  /** Id do vistoriador ou, sem cadastro (importadas), o nome. */
  vistoriador: string;
  /** Bloco; "sem" = sem bloco. */
  bloco: string;
  de: string;
  ate: string;
  cartao: CartaoVistoria | "";
}

type Busca = Record<string, string | string[] | undefined>;

const um = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

export function lerFiltroVistorias(sp: Busca): FiltroVistorias {
  const cartao = um(sp.cartao);
  return {
    q: um(sp.q).trim(),
    tipo: um(sp.tipo),
    status: um(sp.status),
    vistoriador: um(sp.vistoriador),
    bloco: um(sp.bloco),
    de: dataValida(um(sp.de)) ? um(sp.de) : "",
    ate: dataValida(um(sp.ate)) ? um(sp.ate) : "",
    cartao: Object.hasOwn(CARTOES_VISTORIA, cartao)
      ? (cartao as CartaoVistoria)
      : "",
  };
}

/** Valor do filtro de vistoriador de uma vistoria (id ou nome). */
export const vistoriadorDe = (v: {
  vistoriador_id: string | null;
  vistoriador_nome: string;
}) => v.vistoriador_id ?? v.vistoriador_nome;

export const ehUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/**
 * O cartão no banco, igual a `situacaoDaVistoria`: finalizada (nem em
 * andamento nem cancelada) é concluída com as duas assinaturas ou quando
 * veio do sistema antigo; sem elas, aguarda assinatura.
 */
export interface CriterioVistoria {
  status?: string;
  /** Status fora da lista. */
  semStatus?: string[];
  /** Filtro do `.or()` (assinaturas, legado). */
  ou?: string;
  legadoNulo?: true;
  /** Data da vistoria neste intervalo (aaaa-mm-dd, fim exclusivo). */
  dataEntre?: { de: string; ate: string };
  /** Algum ambiente virou OS. */
  comOS?: true;
}

const FINALIZADA = ["cancelado", "andamento"];

export function criterioDoCartaoVistoria(
  c: CartaoVistoria,
  hoje: string,
): CriterioVistoria {
  switch (c) {
    case "andamento":
      return { status: "andamento" };
    case "assinatura":
      return {
        semStatus: FINALIZADA,
        legadoNulo: true,
        ou: "assinatura_locador_path.is.null,assinatura_locatario_path.is.null",
      };
    case "concluidas": {
      const mes = limitesDoMes(hoje);
      return {
        semStatus: FINALIZADA,
        ou: "legado_id.not.is.null,and(assinatura_locador_path.not.is.null,assinatura_locatario_path.not.is.null)",
        dataEntre: { de: mes.de.slice(0, 10), ate: mes.ate.slice(0, 10) },
      };
    }
    case "com_os":
      return { comOS: true };
  }
}
