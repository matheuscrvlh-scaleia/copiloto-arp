import { z } from "zod";
import { inteiro } from "./campo";
import type { CampoParametro } from "./quadro";

// Bloco "kit" de Comercial › Configurações › Parâmetros.

export const ESQUEMA_KIT = z.object({ kit_aviso_dias: inteiro(0, 365) });

export const CAMPOS_KIT: Record<string, CampoParametro> = {
  kit_aviso_dias: { rotulo: "Aviso de validade (dias antes)", bloco: "kit" },
};
