import { parseWith, requestJson } from "../http";
import { type Empresa, empresaSchema } from "./schemas";

const SISTEMA = "diario_de_obras";
const API_URL = "https://apiexterna.diariodeobra.app/v1";

export interface DiarioDeObrasConfig {
  /** Token da empresa, gerado no app do Diário de Obras. */
  token: string;
  fetch?: typeof fetch;
}

/**
 * Cliente só de leitura (a API externa só tem GET).
 * Limite: 150 requisições por minuto por empresa.
 */
export function createDiarioDeObrasClient(config: DiarioDeObrasConfig) {
  const headers = { token: config.token };

  return {
    async empresa(): Promise<Empresa> {
      const json = await requestJson(SISTEMA, `${API_URL}/empresa`, {
        headers,
        fetch: config.fetch,
      });
      return parseWith(SISTEMA, empresaSchema, json);
    },
  };
}

export type DiarioDeObrasClient = ReturnType<typeof createDiarioDeObrasClient>;
