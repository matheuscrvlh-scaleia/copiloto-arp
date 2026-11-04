import "server-only";
import { cache } from "react";
import type { Indice } from "@/lib/comercial/fontes";
import { parametros } from "./base";
import { dadosEnet } from "./fontes";
import { indicesAcumulados } from "./publicos";

// Vencimentos de contrato (spec 4.6): ENET (contratos, clientes, LUCs),
// faixas e dias do reajuste previsto dos parâmetros e o acumulado de 12
// meses do IGP-M e do IPCA (Banco Central; null se o serviço caiu, e a
// tela segue sem a estimativa).

export const dadosDosVencimentos = cache(async () => {
  const [enet, p, indices] = await Promise.all([
    dadosEnet(),
    parametros(),
    indicesAcumulados(),
  ]);
  const acumulados: Record<Indice, number | null> = {
    IGPM: indices.IGPM?.acumulado12m ?? null,
    IPCA: indices.IPCA?.acumulado12m ?? null,
  };
  const ate: Record<Indice, string | null> = {
    IGPM: indices.IGPM?.ate ?? null,
    IPCA: indices.IPCA?.ate ?? null,
  };
  return {
    enet,
    faixas: {
      faixa1: p.vencimento_faixa1_dias,
      faixa2: p.vencimento_faixa2_dias,
    },
    diasReajuste: p.reajuste_previsto_dias,
    acumulados,
    ate,
    lucs: new Map(
      enet.lucs.map((l) => [l.numero, { local: l.local, abl: l.abl }]),
    ),
  };
});
