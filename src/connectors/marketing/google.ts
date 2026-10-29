import { z } from "zod";
import { ConnectorError, parseWith, requestJson } from "../http";

// Google (Ads, Analytics 4, Search Console, YouTube e Perfil da Empresa).
// Todas usam OAuth com token de atualização: o cliente troca o refresh token
// por um token de acesso (1 hora) e só faz leituras.

/** Versão da Google Ads API; cada uma vale cerca de um ano. */
const VERSAO_ADS = "v25";

export interface GoogleConfig {
  /** Nome do sistema nos erros (ex.: "mkt_ga4"). */
  sistema: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  fetch?: typeof fetch;
}

const tokenSchema = z.object({ access_token: z.string().min(1) });

const numero = z.coerce.number();

const adsClienteSchema = z.object({
  results: z
    .array(
      z.object({
        customer: z.object({
          descriptiveName: z.string().default(""),
          currencyCode: z.string().default(""),
        }),
      }),
    )
    .default([]),
});

const ga4Schema = z.object({
  rows: z
    .array(z.object({ metricValues: z.array(z.object({ value: numero })) }))
    .default([]),
});

const siteSchema = z.object({
  siteUrl: z.string(),
  permissionLevel: z.string(),
});

const canaisSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        snippet: z.object({ title: z.string() }),
        statistics: z.object({ subscriberCount: numero.default(0) }),
      }),
    )
    .default([]),
});

const locaisSchema = z.object({
  locations: z
    .array(z.object({ name: z.string(), title: z.string().default("") }))
    .default([]),
  nextPageToken: z.string().optional(),
});

export function createGoogleClient(config: GoogleConfig) {
  const { sistema } = config;
  let token: Promise<string> | null = null;

  function acesso(): Promise<string> {
    token ??= requestJson(sistema, "https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
        grant_type: "refresh_token",
      }),
      retries: 1,
      fetch: config.fetch,
    }).then((r) => parseWith(sistema, tokenSchema, r).access_token);
    return token;
  }

  async function chamar(
    url: string,
    opts: {
      method?: "GET" | "POST";
      query?: Record<string, string | number | undefined>;
      body?: unknown;
      headers?: Record<string, string>;
    } = {},
  ): Promise<unknown> {
    return requestJson(sistema, url, {
      ...opts,
      headers: { Authorization: `Bearer ${await acesso()}`, ...opts.headers },
      retries: 1,
      fetch: config.fetch,
    });
  }

  return {
    /** Nome e moeda da conta do Google Ads (confirma o token de desenvolvedor). */
    async adsCliente(
      customerId: string,
      developerToken: string,
      loginCustomerId?: string,
    ) {
      const r = await chamar(
        `https://googleads.googleapis.com/${VERSAO_ADS}/customers/${customerId}/googleAds:search`,
        {
          method: "POST",
          body: {
            query:
              "SELECT customer.descriptive_name, customer.currency_code FROM customer LIMIT 1",
          },
          headers: {
            "developer-token": developerToken,
            ...(loginCustomerId
              ? { "login-customer-id": loginCustomerId }
              : {}),
          },
        },
      );
      const c = parseWith(sistema, adsClienteSchema, r).results[0]?.customer;
      if (!c)
        throw new ConnectorError("conta sem dados de cliente", sistema, 404);
      return { nome: c.descriptiveName, moeda: c.currencyCode };
    },

    /** Sessões do GA4 nos últimos `dias` dias (até ontem). */
    async ga4Sessoes(propertyId: string, dias = 7) {
      const r = await chamar(
        `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
        {
          method: "POST",
          body: {
            dateRanges: [{ startDate: `${dias}daysAgo`, endDate: "yesterday" }],
            metrics: [{ name: "sessions" }],
          },
        },
      );
      const linha = parseWith(sistema, ga4Schema, r).rows[0];
      return linha?.metricValues[0]?.value ?? 0;
    },

    /** Nível de acesso à propriedade do Search Console. */
    async searchConsole(siteUrl: string) {
      const r = await chamar(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}`,
      );
      return parseWith(sistema, siteSchema, r);
    },

    /** Canais da conta que autorizou (mine=true). */
    async meusCanais() {
      const r = await chamar("https://www.googleapis.com/youtube/v3/channels", {
        query: { part: "snippet,statistics", mine: "true" },
      });
      return parseWith(sistema, canaisSchema, r).items.map((c) => ({
        id: c.id,
        nome: c.snippet.title,
        inscritos: c.statistics.subscriberCount,
      }));
    },

    /** Locais da conta do Perfil da Empresa (até 100 por página). */
    async locais(accountId: string) {
      const r = await chamar(
        `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${accountId}/locations`,
        { query: { readMask: "name,title", pageSize: 100 } },
      );
      const l = parseWith(sistema, locaisSchema, r);
      return { locais: l.locations, temMais: Boolean(l.nextPageToken) };
    },
  };
}
