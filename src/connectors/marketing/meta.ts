import { z } from "zod";
import { parseWith, requestJson } from "../http";

// Meta (Graph API e Marketing API): conta de anúncios, página do Facebook e
// conta profissional do Instagram. Token no header, nunca na URL.

const API_URL = "https://graph.facebook.com/v26.0";

export interface MetaConfig {
  /** Nome do sistema nos erros (ex.: "mkt_meta_ads"). */
  sistema: string;
  token: string;
  fetch?: typeof fetch;
}

/** account_status da conta de anúncios (1 = ativa). */
export const SITUACAO_CONTA: Record<number, string> = {
  1: "ativa",
  2: "desativada",
  3: "com pagamento pendente",
  7: "em análise de risco",
  9: "em período de carência",
  100: "pendente de encerramento",
  101: "encerrada",
};

const contaSchema = z.object({
  name: z.string(),
  account_status: z.number(),
  currency: z.string().default(""),
});

const paginaSchema = z.object({
  name: z.string(),
  followers_count: z.number().default(0),
});

const instagramSchema = z.object({
  username: z.string(),
  followers_count: z.number().default(0),
});

export function createMetaClient(config: MetaConfig) {
  const { sistema } = config;
  const ler = (caminho: string, fields: string) =>
    requestJson(sistema, `${API_URL}/${caminho}`, {
      headers: { Authorization: `Bearer ${config.token}` },
      query: { fields },
      retries: 1,
      fetch: config.fetch,
    });

  return {
    async contaDeAnuncios(adAccountId: string) {
      const r = await ler(`act_${adAccountId}`, "name,account_status,currency");
      return parseWith(sistema, contaSchema, r);
    },
    async pagina(pageId: string) {
      return parseWith(
        sistema,
        paginaSchema,
        await ler(pageId, "name,followers_count"),
      );
    },
    async instagram(instagramId: string) {
      return parseWith(
        sistema,
        instagramSchema,
        await ler(instagramId, "username,followers_count"),
      );
    },
  };
}
