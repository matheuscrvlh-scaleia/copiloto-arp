import "server-only";
import { cache } from "react";
import type { FontesEnet, FontesRd } from "@/lib/comercial/fontes";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import { memo } from "@/lib/sorteio";
import { contextoCom } from "./base";
import { gerarEnet } from "./exemplo/enet";
import { gerarRd } from "./exemplo/rd";

// Dados do RD Station (CRM e conversões do Marketing) e do ENET, nos campos
// das APIs (lib/comercial/fontes.ts). Ainda sem API: de exemplo, gerados no
// código e guardados por dia. Quando o conector chegar, só esta fachada
// muda (as telas continuam chamando dadosRd() e dadosEnet()). As telas
// conferem a permissão antes de chamar e tiram o que a pessoa não pode ver
// (contato, valores) antes de mandar ao navegador.

export interface Origem {
  /** true enquanto for dado de exemplo: a tela mostra o selo. */
  exemplo: boolean;
}

export type DadosRd = FontesRd & Origem;
export type DadosEnet = FontesEnet & Origem;

const rdDoDia = memo(gerarRd);
const enetDoDia = memo(gerarEnet);

/** Oportunidades do RD CRM e conversões do RD Marketing. */
export const dadosRd = cache(async (): Promise<DadosRd> => {
  const { hoje } = await contextoCom();
  return { ...rdDoDia(hoje), exemplo: true };
});

/** LUCs, contratos, clientes e contas a receber do ENET. */
export const dadosEnet = cache(async (): Promise<DadosEnet> => {
  const { hoje } = await contextoCom();
  return dadosEnetSemSessao(hoje);
});

/**
 * O mesmo ENET sem sessão, para a rotina (cron) e a ficha pública: quem
 * chama já conferiu o acesso (CRON_SECRET, token) e só usa o necessário.
 */
export async function dadosEnetSemSessao(
  hoje = hojeEmBrasilia(new Date()),
): Promise<DadosEnet> {
  return { ...enetDoDia(hoje), exemplo: true };
}
