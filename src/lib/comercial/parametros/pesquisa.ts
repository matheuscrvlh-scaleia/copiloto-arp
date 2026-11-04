import { z } from "zod";
import { numeroDigitado } from "./campo";
import type { CampoParametro } from "./quadro";

// Bloco "pesquisa" de Comercial › Configurações › Parâmetros.

/** "30; 50; 80" ou um por linha → [30, 50, 80], crescentes e positivos. */
export const faixasM2 = z.preprocess(
  (v) =>
    String(v ?? "")
      .split(/[;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => numeroDigitado(s) ?? Number.NaN),
  z
    .array(
      z
        .number()
        .finite("informe só números")
        .positive("só números maiores que zero"),
    )
    .min(1, "informe ao menos um limite")
    .max(12, "até 12 limites")
    .refine(
      (ns) => ns.every((n, i) => i === 0 || n > (ns[i - 1] ?? 0)),
      "em ordem crescente, sem repetir",
    ),
);

export const ESQUEMA_PESQUISA = z.object({ pesquisa_faixas_m2: faixasM2 });

export const CAMPOS_PESQUISA: Record<string, CampoParametro> = {
  pesquisa_faixas_m2: { rotulo: "Faixas de tamanho (m²)", bloco: "pesquisa" },
};
