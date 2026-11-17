import { z } from "zod";
import { decimal, inteiro, marcado, texto } from "./campo";
import type { CampoParametro } from "./quadro";

// Bloco "ocupacao" de Comercial › Configurações › Parâmetros.

export const tipoLuc = z.object({
  tipo: texto(80, "informe o tipo de LUC"),
  conta_ocupacao: marcado,
});

export const ESQUEMA_OCUPACAO = z
  .object({
    transferencia_dias: inteiro(0, 365),
    curva_a_pct: decimal(0, 99.99, { maiorQue: true }),
    curva_b_pct: decimal(0, 99.99, { maiorQue: true }),
  })
  .refine((p) => p.curva_b_pct > p.curva_a_pct, {
    path: ["curva_b_pct"],
    message: "precisa ser maior que a faixa A",
  });

export const CAMPOS_OCUPACAO: Record<string, CampoParametro> = {
  transferencia_dias: {
    rotulo: "Dias para considerar transferência",
    bloco: "ocupacao",
  },
  curva_a_pct: { rotulo: "Faixa A da curva até (%)", bloco: "ocupacao" },
  curva_b_pct: { rotulo: "Faixa B da curva até (%)", bloco: "ocupacao" },
};
