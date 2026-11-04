import "server-only";
import { cache } from "react";
import type { RdLandingPageComercial } from "@/lib/comercial/fontes";
import {
  montarOportunidades,
  type OportunidadeFunil,
} from "@/lib/comercial/funil";
import { contextoCom, fontesDePara, parametros } from "./base";
import { dadosRd } from "./fontes";

// Leitura do Funil comercial (spec 4.4). Sem comercial.funil.ver_contato o
// contato nem sai daqui; sem comercial.valores.ver, nem os valores.

export interface DadosFunil {
  oportunidades: OportunidadeFunil[];
  /** Nomes das fontes ajustadas do de-para (parâmetros), em ordem. */
  fontesAjustadas: string[];
  landingPages: RdLandingPageComercial[];
  funilPadrao: string;
  /** Por que o RD Station CRM não entregou; null quando leu. */
  aviso: string | null;
  podeContato: boolean;
  podeValores: boolean;
}

export const dadosDoFunil = cache(async (): Promise<DadosFunil> => {
  const { pode, hoje } = await contextoCom();
  if (!pode("comercial.funil.ver"))
    throw new Error("Sem acesso ao Funil comercial.");
  const [rd, dePara, params] = await Promise.all([
    dadosRd(),
    fontesDePara(),
    parametros(),
  ]);
  const podeContato = pode("comercial.funil.ver_contato");
  const podeValores = pode("comercial.valores.ver");
  const mapa = new Map(dePara.map((d) => [d.fonte_rd, d.fonte_ajustada]));
  return {
    oportunidades: montarOportunidades(rd, mapa, hoje, {
      contato: podeContato,
      valores: podeValores,
    }),
    fontesAjustadas: [...new Set(dePara.map((d) => d.fonte_ajustada))].sort(
      (a, b) => a.localeCompare(b, "pt-BR"),
    ),
    landingPages: rd.landingPages,
    funilPadrao: params.funil_padrao,
    aviso: rd.aviso,
    podeContato,
    podeValores,
  };
});
