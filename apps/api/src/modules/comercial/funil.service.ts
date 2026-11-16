import type { RespostaFunil } from "@arp/shared/comercial/contratos/funil";
import { montarOportunidades } from "@arp/shared/comercial/funil";
import type { Contexto } from "@/contexto";
import { contextoCom, fontesDePara, parametros } from "./base";
import { dadosRd } from "./fontes";

// Leitura do Funil comercial (spec 4.4). Sem comercial.funil.ver_contato o
// contato nem sai daqui; sem comercial.valores.ver, nem os valores.

export async function dadosDoFunil(ctx: Contexto): Promise<RespostaFunil> {
  const { pode, hoje, dadosDe } = contextoCom(ctx);
  const rd = await dadosRd(ctx);
  const dePara = await fontesDePara(ctx);
  const params = await parametros(ctx);
  const podeContato = pode("comercial.funil.ver_contato");
  const podeValores = pode("comercial.valores.ver");
  const mapa = new Map(dePara.map((d) => [d.fonte_rd, d.fonte_ajustada]));
  return {
    hoje,
    dadosDe,
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
}
