import "server-only";
import { cache } from "react";
import { parametros, tiposLuc } from "./base";
import { dadosEnet } from "./fontes";

// Ocupação e estoque (spec 4.5): ENET (LUCs, contratos, clientes) e, dos
// parâmetros, os tipos de LUC que contam na ocupação, o prazo da
// transferência e os limites da curva da carteira. A tela confere
// comercial.ocupacao.ver antes; os valores só saem com comercial.valores.ver.

export const dadosDaOcupacao = cache(async () => {
  const [enet, tipos, p] = await Promise.all([
    dadosEnet(),
    tiposLuc(),
    parametros(),
  ]);
  const contam = new Set(
    tipos.filter((t) => t.conta_ocupacao).map((t) => t.tipo),
  );
  return {
    enet,
    contam,
    transferenciaDias: p.transferencia_dias,
    curva: { a: Number(p.curva_a_pct), b: Number(p.curva_b_pct) },
  };
});
