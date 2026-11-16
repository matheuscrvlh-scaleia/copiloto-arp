import { z } from "zod";
import { parseWith, requestJson } from "../http";

// RD Station Marketing (API 2.0, OAuth). O refresh token vira um token de
// acesso de 24 horas; o refresh continua valendo até o app ser desautorizado
// (conferido: o RD devolve o mesmo refresh a cada troca). Só leitura.
//
// A API não lista conversões por período: os contatos saem de uma
// segmentação (ordenados pela última conversão) e as conversões, de cada
// contato. Limites do plano Pro: 120 chamadas/min em contatos e
// segmentações; analytics, 60 por hora e só 45 dias para trás.

const SISTEMA = "mkt_rd_station";
const API_URL = "https://api.rd.services";

export interface RdStationConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  fetch?: typeof fetch;
}

const tokenSchema = z.object({ access_token: z.string().min(1) });
const codigoSchema = tokenSchema.extend({ refresh_token: z.string().min(1) });
const contaSchema = z.object({ name: z.string() });

const txt = z
  .string()
  .nullish()
  .transform((v) => v ?? "");

const segmentacoesSchema = z.object({
  segmentations: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      standard: z.boolean().nullish(),
    }),
  ),
});

const contatosSchema = z.object({
  contacts: z.array(
    z.object({
      uuid: z.string(),
      name: txt,
      email: txt,
      phone: txt,
      last_conversion_date: z.string().nullish(),
      created_at: z.string().nullish(),
    }),
  ),
});
export type RdContatoDaSegmentacao = z.infer<
  typeof contatosSchema
>["contacts"][number];

const funilSchema = z.object({ lifecycle_stage: txt });

const eventosSchema = z.array(
  z.object({
    event_type: z.string(),
    event_identifier: z.string(),
    event_timestamp: z.string(),
    payload: z.object({ traffic_source: z.string().nullish() }).nullish(),
  }),
);
export type RdEvento = z.infer<typeof eventosSchema>[number];

const landingPagesSchema = z.array(
  z.object({
    id: z.number(),
    title: txt,
    conversion_identifier: z.string(),
    status: txt,
  }),
);

const analyticsSchema = z.object({
  conversions: z.array(
    z.object({
      asset_identifier: z.string(),
      // O RD manda visitas como texto ("6").
      visits_count: z.coerce.number().int().nonnegative(),
      conversion_count: z.coerce.number().int().nonnegative(),
    }),
  ),
});
export type RdAnalyticsLp = z.infer<
  typeof analyticsSchema
>["conversions"][number];

const QTD_POR_PAGINA = 125;

export function createRdStationClient(config: RdStationConfig) {
  let token: Promise<string> | null = null;

  function acesso(): Promise<string> {
    token ??= requestJson(SISTEMA, `${API_URL}/auth/token`, {
      method: "POST",
      body: {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
      },
      retries: 1,
      fetch: config.fetch,
    }).then((r) => parseWith(SISTEMA, tokenSchema, r).access_token);
    return token;
  }

  async function ler(
    caminho: string,
    query?: Record<string, string | number>,
  ): Promise<unknown> {
    return requestJson(SISTEMA, `${API_URL}${caminho}`, {
      headers: { Authorization: `Bearer ${await acesso()}` },
      query,
      retries: 2,
      fetch: config.fetch,
    });
  }
  const contato = (uuid: string) =>
    `/platform/contacts/uuid:${encodeURIComponent(uuid)}`;

  return {
    /** Nome da conta que autorizou o app. */
    async conta() {
      return parseWith(
        SISTEMA,
        contaSchema,
        await ler("/marketing/account_info"),
      );
    },
    async segmentacoes() {
      return parseWith(
        SISTEMA,
        segmentacoesSchema,
        await ler("/platform/segmentations", { page_size: 100 }),
      ).segmentations;
    },
    /** Uma página de contatos, da última conversão mais nova à mais velha. */
    async contatosDaSegmentacao(id: number, pagina: number) {
      return parseWith(
        SISTEMA,
        contatosSchema,
        await ler(`/platform/segmentations/${id}/contacts`, {
          page: pagina,
          page_size: QTD_POR_PAGINA,
          order: "last_conversion_date:desc",
        }),
      ).contacts;
    },
    porPagina: QTD_POR_PAGINA,
    /** Etapa do funil padrão hoje (Lead, Qualified Lead, Client). */
    async etapa(uuid: string) {
      return parseWith(
        SISTEMA,
        funilSchema,
        await ler(`${contato(uuid)}/funnels/default`),
      ).lifecycle_stage;
    },
    /** Conversões do contato (as mais recentes que o RD devolve). */
    async conversoes(uuid: string) {
      return parseWith(
        SISTEMA,
        eventosSchema,
        await ler(`/platform/contacts/${encodeURIComponent(uuid)}/events`, {
          event_type: "CONVERSION",
        }),
      );
    },
    async landingPages() {
      return parseWith(
        SISTEMA,
        landingPagesSchema,
        await ler("/platform/landing_pages"),
      );
    },
    /** Visitas e conversões de cada landing page num dia ("aaaa-mm-dd"). */
    async analyticsDoDia(dia: string) {
      return parseWith(
        SISTEMA,
        analyticsSchema,
        await ler("/platform/analytics/conversions", {
          start_date: dia,
          end_date: dia,
          "assets_type[]": "LandingPage",
        }),
      ).conversions;
    },
  };
}

/**
 * Troca o code da autorização (vale 1 hora, uma vez só) pelo refresh token.
 * O code chega na URL de callback do app, depois de a conta autorizar.
 */
export async function trocarCodigoRd(config: {
  clientId: string;
  clientSecret: string;
  code: string;
  fetch?: typeof fetch;
}): Promise<string> {
  const r = await requestJson(SISTEMA, `${API_URL}/auth/token`, {
    method: "POST",
    query: { token_by: "code" },
    body: {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: config.code,
    },
    retries: 0,
    fetch: config.fetch,
  });
  return parseWith(SISTEMA, codigoSchema, r).refresh_token;
}
