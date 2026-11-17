import { z } from "zod";
import { inteiro, texto } from "./campo";
import type { CampoParametro } from "./quadro";

// Bloco "censo" de Comercial › Configurações › Parâmetros.

export const ESQUEMA_CENSO = z.object({
  censo_dias_mensalidade: inteiro(1, 31),
  formulario_texto_convite: texto(1000, "escreva o texto do convite"),
});

export const CAMPOS_CENSO: Record<string, CampoParametro> = {
  censo_dias_mensalidade: {
    rotulo: "Dias de uso padrão para mensalidade",
    bloco: "censo",
  },
  formulario_texto_convite: {
    rotulo: "Texto do convite (WhatsApp)",
    bloco: "censo",
  },
};
