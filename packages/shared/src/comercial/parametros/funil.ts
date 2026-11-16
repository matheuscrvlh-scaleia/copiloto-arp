import { z } from "zod";
import { texto } from "./campo";
import type { CampoParametro } from "./quadro";

// Bloco "funil" de Comercial › Configurações › Parâmetros.

export const fonteDePara = z.object({
  fonte_rd: texto(200, "informe a fonte do RD"),
  fonte_ajustada: texto(120, "escolha a fonte ajustada"),
});

export const ESQUEMA_FUNIL = z.object({
  funil_padrao: texto(120, "escolha o funil padrão"),
});

export const CAMPOS_FUNIL: Record<string, CampoParametro> = {
  funil_padrao: { rotulo: "Funil padrão", bloco: "funil" },
};
