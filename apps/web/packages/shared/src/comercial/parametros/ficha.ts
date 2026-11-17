import { z } from "zod";
import { inteiro, textoLivre } from "./campo";
import type { CampoParametro } from "./quadro";

// Bloco "ficha" de Comercial › Configurações › Parâmetros.

export const ESQUEMA_FICHA = z.object({
  ficha_boas_vindas: textoLivre(4000),
  ficha_termo_lgpd: textoLivre(4000),
  ficha_validade_dias: inteiro(1, 365),
});

export const CAMPOS_FICHA: Record<string, CampoParametro> = {
  ficha_boas_vindas: { rotulo: "Texto de boas-vindas", bloco: "ficha" },
  ficha_termo_lgpd: { rotulo: "Termo da LGPD", bloco: "ficha" },
  ficha_validade_dias: { rotulo: "Validade do link (dias)", bloco: "ficha" },
};
