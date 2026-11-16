import { z } from "zod";
import { inteiro } from "./campo";
import type { CampoParametro } from "./quadro";

// Bloco "censo" de Comercial › Configurações › Parâmetros.

export const ESQUEMA_CENSO = z.object({
  censo_dias_mensalidade: inteiro(1, 31),
});

export const CAMPOS_CENSO: Record<string, CampoParametro> = {
  censo_dias_mensalidade: {
    rotulo: "Dias de uso padrão para mensalidade",
    bloco: "censo",
  },
};
