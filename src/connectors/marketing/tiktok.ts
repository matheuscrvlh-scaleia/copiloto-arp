import { z } from "zod";
import { ConnectorError, parseWith, requestJson } from "../http";

// TikTok for Business (Marketing API v1.3). A API responde HTTP 200 mesmo no
// erro: o que vale é o "code" do corpo (0 = ok).

const SISTEMA = "mkt_tiktok";
const API_URL = "https://business-api.tiktok.com/open_api/v1.3";

export interface TikTokConfig {
  token: string;
  fetch?: typeof fetch;
}

const envelope = <T extends z.ZodType>(data: T) =>
  z.object({ code: z.number(), message: z.string().default(""), data });

const anuncianteSchema = z.object({
  list: z
    .array(
      z.object({
        name: z.string(),
        currency: z.string().default(""),
        status: z.string().default(""),
      }),
    )
    .default([]),
});

const contaSchema = z.object({
  display_name: z.string().default(""),
  username: z.string().default(""),
  followers_count: z.number().default(0),
});

const autorizadoSchema = z.object({
  access_token: z.string().min(1),
  advertiser_ids: z.array(z.coerce.string()).default([]),
});

/** Corpo da resposta: code diferente de 0 é erro, mesmo com HTTP 200. */
function dados<T extends z.ZodType>(r: unknown, schema: T): z.infer<T> {
  const bruto = parseWith(
    SISTEMA,
    z.object({ code: z.number(), message: z.string().default("") }),
    r,
  );
  if (bruto.code !== 0) {
    // 40001/40100/40105: token inválido ou sem permissão.
    const acesso = [40001, 40100, 40102, 40105].includes(bruto.code);
    throw new ConnectorError(
      `código ${bruto.code}`,
      SISTEMA,
      acesso ? 401 : undefined,
      JSON.stringify({ message: bruto.message }),
    );
  }
  return (parseWith(SISTEMA, envelope(schema), r) as { data: z.infer<T> }).data;
}

export function createTikTokClient(config: TikTokConfig) {
  async function ler<T extends z.ZodType>(
    caminho: string,
    query: Record<string, string>,
    schema: T,
    token = config.token,
  ): Promise<z.infer<T>> {
    const r = await requestJson(SISTEMA, `${API_URL}${caminho}`, {
      headers: { "Access-Token": token },
      query,
      retries: 1,
      fetch: config.fetch,
    });
    return dados(r, schema);
  }

  return {
    async anunciante(advertiserId: string) {
      const d = await ler(
        "/advertiser/info/",
        { advertiser_ids: JSON.stringify([advertiserId]) },
        anuncianteSchema,
      );
      const a = d.list[0];
      if (!a)
        throw new ConnectorError(
          `anunciante ${advertiserId} fora deste token`,
          SISTEMA,
          404,
        );
      return a;
    },
    async contaBusiness(businessId: string, token?: string) {
      return ler(
        "/business/get/",
        {
          business_id: businessId,
          fields: JSON.stringify([
            "display_name",
            "username",
            "followers_count",
          ]),
        },
        contaSchema,
        token,
      );
    },
  };
}

/**
 * Troca o auth_code da autorização do anunciante (vale 1 hora, uma vez só)
 * pelo token de Ads, que não vence, e os anunciantes que ele enxerga.
 */
export async function trocarCodigoTikTok(config: {
  appId: string;
  secret: string;
  authCode: string;
  fetch?: typeof fetch;
}): Promise<{ token: string; anunciantes: string[] }> {
  const r = await requestJson(SISTEMA, `${API_URL}/oauth2/access_token/`, {
    method: "POST",
    body: {
      app_id: config.appId,
      secret: config.secret,
      auth_code: config.authCode,
    },
    retries: 0,
    fetch: config.fetch,
  });
  const d = dados(r, autorizadoSchema);
  return { token: d.access_token, anunciantes: d.advertiser_ids };
}
