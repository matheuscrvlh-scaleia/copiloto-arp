import { z } from "zod";
import type {
  BuscaLinha,
  Ga4Linha,
  GoogleLinha,
  GoogleTermo,
} from "@/lib/marketing/fontes";
import { ConnectorError, parseWith, requestJson } from "../http";

// Google (Ads, Analytics 4, Search Console, YouTube e Perfil da Empresa).
// Todas usam OAuth com token de atualização: o cliente troca o refresh token
// por um token de acesso (1 hora) e só faz leituras.
//
// Google Ads sem developer token (descontinuado em 09/09/2026; o Google
// ignora o cabeçalho): o nível de acesso é o do projeto do Google Cloud das
// credenciais OAuth. Contas reais exigem o nível Exploração ou acima; em
// "Teste" o Google responde CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION.

/** Versão da Google Ads API; cada uma vale cerca de um ano. */
const VERSAO_ADS = "v26";

export interface GoogleConfig {
  /** Nome do sistema nos erros (ex.: "mkt_ga4"). */
  sistema: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  fetch?: typeof fetch;
}

const tokenSchema = z.object({
  access_token: z.string().min(1),
  /** Escopos que a conta concedeu, separados por espaço. */
  scope: z.string().default(""),
  id_token: z.string().optional(),
});

const codigoSchema = z.object({
  refresh_token: z.string().min(1),
  scope: z.string().default(""),
});

// Só o e-mail do id_token: ele veio direto do Google por HTTPS, então não
// precisa conferir a assinatura.
const idTokenSchema = z.object({ email: z.string().optional() });

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

// Descoberta: o que a conta conectada acessa em cada produto.

const acessiveisSchema = z.object({
  resourceNames: z.array(z.string()).default([]),
});

const clientesAdsSchema = z.object({
  results: z
    .array(
      z.object({
        customerClient: z.object({
          id: z.coerce.string(),
          descriptiveName: z.string().default(""),
          manager: z.boolean().default(false),
        }),
      }),
    )
    .default([]),
});

const resumosGa4Schema = z.object({
  accountSummaries: z
    .array(
      z.object({
        displayName: z.string().default(""),
        propertySummaries: z
          .array(z.object({ property: z.string(), displayName: z.string() }))
          .default([]),
      }),
    )
    .default([]),
});

const sitesSchema = z.object({ siteEntry: z.array(siteSchema).default([]) });

const contasPerfilSchema = z.object({
  accounts: z
    .array(z.object({ name: z.string(), accountName: z.string().default("") }))
    .default([]),
});

// Leituras dos dados. A Google Ads API omite as métricas zeradas e manda os
// int64 em texto: tudo com default 0 e coerção.

const zero = numero.default(0);

const adsCampanhaDiaSchema = z.object({
  results: z
    .array(
      z.object({
        campaign: z.object({
          id: z.coerce.string(),
          name: z.string().default(""),
          advertisingChannelType: z.string().default(""),
          status: z.string().default(""),
        }),
        segments: z.object({ date: z.string() }),
        metrics: z
          .object({
            costMicros: zero,
            impressions: zero,
            clicks: zero,
            ctr: zero,
            averageCpc: zero,
            conversions: zero,
            costPerConversion: zero,
            videoTrueviewViews: zero,
          })
          .default({
            costMicros: 0,
            impressions: 0,
            clicks: 0,
            ctr: 0,
            averageCpc: 0,
            conversions: 0,
            costPerConversion: 0,
            videoTrueviewViews: 0,
          }),
      }),
    )
    .default([]),
  nextPageToken: z.string().optional(),
});

const adsTermoSchema = z.object({
  results: z
    .array(
      z.object({
        campaign: z.object({ id: z.coerce.string() }),
        segments: z.object({ date: z.string() }),
        searchTermView: z.object({ searchTerm: z.string() }),
        metrics: z
          .object({ impressions: zero, clicks: zero, costMicros: zero })
          .default({ impressions: 0, clicks: 0, costMicros: 0 }),
      }),
    )
    .default([]),
  nextPageToken: z.string().optional(),
});

const ga4RelatorioSchema = z.object({
  rows: z
    .array(
      z.object({
        dimensionValues: z.array(z.object({ value: z.string().default("") })),
        metricValues: z.array(z.object({ value: zero })),
      }),
    )
    .default([]),
  rowCount: z.number().int().default(0),
});

const buscasSchema = z.object({
  rows: z
    .array(
      z.object({
        keys: z.array(z.string()),
        clicks: zero,
        impressions: zero,
        ctr: zero,
        position: zero,
      }),
    )
    .default([]),
});

/** Dimensões e métricas do GA4, na ordem de Ga4Linha. */
const GA4_DIMENSOES = [
  "date",
  "sessionDefaultChannelGroup",
  "sessionSourceMedium",
  "sessionCampaignName",
  "deviceCategory",
] as const;
const GA4_METRICAS = [
  "sessions",
  "totalUsers",
  "newUsers",
  "engagedSessions",
  "engagementRate",
  "averageSessionDuration",
  "screenPageViews",
  "keyEvents",
] as const;
/** Linhas por página do GA4 e do Search Console. */
const POR_PAGINA_GA4 = 100_000;
const POR_PAGINA_BUSCAS = 25_000;
/** Teto de páginas: a janela do módulo (18 semanas) cabe com folga. */
const MAX_PAGINAS = 20;

/** "20260905" → "2026-09-05". */
const dataGa4 = (v: string) =>
  /^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6)}` : v;

/** Conta de anúncio que a conta Google alcança; `login` é a MCC, se for por ela. */
export interface ContaAds {
  id: string;
  nome: string;
  login: string;
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Tela de autorização do Google. offline + consent: sempre volta um refresh
 * token. PKCE: o `desafio` é o S256 do verificador que só o servidor guarda.
 */
export function urlAutorizacaoGoogle(config: {
  clientId: string;
  redirectUri: string;
  escopos: readonly string[];
  state: string;
  desafio: string;
}): string {
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: config.escopos.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: config.state,
    code_challenge: config.desafio,
    code_challenge_method: "S256",
  }).toString();
  return u.toString();
}

/** Troca o code da volta da autorização pelo refresh token. */
export async function trocarCodigoGoogle(config: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  verificador: string;
  fetch?: typeof fetch;
}): Promise<{ refreshToken: string; escopos: string[] }> {
  const r = await requestJson("mkt_google", TOKEN_URL, {
    method: "POST",
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: config.code,
      code_verifier: config.verificador,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
    retries: 0,
    fetch: config.fetch,
  });
  const t = parseWith("mkt_google", codigoSchema, r);
  return {
    refreshToken: t.refresh_token,
    escopos: t.scope.split(" ").filter(Boolean),
  };
}

/** Revoga o acesso no Google (o app some da conta). Já revogado: nada a fazer. */
export async function revogarGoogle(
  token: string,
  f?: typeof fetch,
): Promise<void> {
  try {
    await requestJson("mkt_google", "https://oauth2.googleapis.com/revoke", {
      method: "POST",
      body: new URLSearchParams({ token }),
      retries: 1,
      fetch: f,
    });
  } catch (erro) {
    if (!(erro instanceof ConnectorError && erro.status === 400)) throw erro;
  }
}

function emailDoIdToken(idToken: string | undefined): string {
  const payload = idToken?.split(".")[1];
  if (!payload) return "";
  try {
    const r = idTokenSchema.safeParse(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
    );
    return r.data?.email ?? "";
  } catch {
    return "";
  }
}

export function createGoogleClient(config: GoogleConfig) {
  const { sistema } = config;
  let token: Promise<z.infer<typeof tokenSchema>> | null = null;

  function renovar() {
    token ??= requestJson(sistema, TOKEN_URL, {
      method: "POST",
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
        grant_type: "refresh_token",
      }),
      retries: 1,
      fetch: config.fetch,
    }).then((r) => parseWith(sistema, tokenSchema, r));
    return token;
  }

  const acesso = async () => (await renovar()).access_token;

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

  /** GAQL com todas as páginas (a API devolve até 10 mil linhas por página). */
  async function gaql<T extends { nextPageToken?: string }>(
    customerId: string,
    loginCustomerId: string | undefined,
    query: string,
    schema: z.ZodType<T>,
  ): Promise<T[]> {
    const paginas: T[] = [];
    let pageToken: string | undefined;
    for (let n = 0; n < MAX_PAGINAS; n++) {
      const r = await chamar(
        `https://googleads.googleapis.com/${VERSAO_ADS}/customers/${customerId}/googleAds:search`,
        {
          method: "POST",
          body: { query, ...(pageToken ? { pageToken } : {}) },
          headers: loginCustomerId
            ? { "login-customer-id": loginCustomerId }
            : {},
        },
      );
      const p = parseWith(sistema, schema, r);
      paginas.push(p);
      pageToken = p.nextPageToken;
      if (!pageToken) break;
    }
    return paginas;
  }

  return {
    /**
     * Campanhas por dia (aaaa-mm-dd, inclusive), só os dias com impressão.
     * video_views saiu da API (v26): vem de video_trueview_views.
     */
    async adsCampanhasPorDia(
      customerId: string,
      desde: string,
      ate: string,
      loginCustomerId?: string,
    ): Promise<GoogleLinha[]> {
      const paginas = await gaql(
        customerId,
        loginCustomerId,
        `SELECT campaign.id, campaign.name, campaign.advertising_channel_type, campaign.status, segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc, metrics.conversions, metrics.cost_per_conversion, metrics.video_trueview_views FROM campaign WHERE segments.date BETWEEN '${desde}' AND '${ate}' AND metrics.impressions > 0`,
        adsCampanhaDiaSchema,
      );
      return paginas.flatMap((p) =>
        p.results.map(({ campaign: c, segments, metrics: m }) => ({
          campaign: {
            id: c.id,
            name: c.name,
            advertising_channel_type: c.advertisingChannelType,
            status: c.status,
          },
          segments: { date: segments.date },
          metrics: {
            cost_micros: m.costMicros,
            impressions: m.impressions,
            clicks: m.clicks,
            ctr: m.ctr,
            average_cpc: m.averageCpc,
            conversions: m.conversions,
            cost_per_conversion: m.costPerConversion,
            video_views: m.videoTrueviewViews,
          },
        })),
      );
    },

    /** Termos de pesquisa que dispararam os anúncios, por campanha e dia. */
    async adsTermos(
      customerId: string,
      desde: string,
      ate: string,
      loginCustomerId?: string,
    ): Promise<GoogleTermo[]> {
      const paginas = await gaql(
        customerId,
        loginCustomerId,
        `SELECT campaign.id, segments.date, search_term_view.search_term, metrics.impressions, metrics.clicks, metrics.cost_micros FROM search_term_view WHERE segments.date BETWEEN '${desde}' AND '${ate}'`,
        adsTermoSchema,
      );
      return paginas.flatMap((p) =>
        p.results.map((t) => ({
          campaign_id: t.campaign.id,
          segments: { date: t.segments.date },
          search_term_view: { search_term: t.searchTermView.searchTerm },
          metrics: {
            impressions: t.metrics.impressions,
            clicks: t.metrics.clicks,
            cost_micros: t.metrics.costMicros,
          },
        })),
      );
    },

    /** Sessões do GA4 por dia × canal × origem/mídia × campanha × dispositivo. */
    async ga4Relatorio(
      propertyId: string,
      desde: string,
      ate: string,
    ): Promise<Ga4Linha[]> {
      const linhas: Ga4Linha[] = [];
      for (let n = 0; n < MAX_PAGINAS; n++) {
        const r = await chamar(
          `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
          {
            method: "POST",
            body: {
              dateRanges: [{ startDate: desde, endDate: ate }],
              dimensions: GA4_DIMENSOES.map((name) => ({ name })),
              metrics: GA4_METRICAS.map((name) => ({ name })),
              limit: POR_PAGINA_GA4,
              offset: linhas.length,
            },
          },
        );
        const p = parseWith(sistema, ga4RelatorioSchema, r);
        for (const { dimensionValues: d, metricValues: m } of p.rows) {
          const dim = (i: number) => d[i]?.value ?? "";
          const met = (i: number) => m[i]?.value ?? 0;
          linhas.push({
            date: dataGa4(dim(0)),
            sessionDefaultChannelGroup: dim(1),
            sessionSourceMedium: dim(2),
            sessionCampaignName: dim(3),
            deviceCategory: dim(4),
            sessions: met(0),
            totalUsers: met(1),
            newUsers: met(2),
            engagedSessions: met(3),
            engagementRate: met(4),
            averageSessionDuration: met(5),
            screenPageViews: met(6),
            keyEvents: met(7),
          });
        }
        if (p.rows.length === 0 || linhas.length >= p.rowCount) break;
      }
      return linhas;
    },

    /** Buscas do Search Console por dia × termo × página. */
    async buscas(
      siteUrl: string,
      desde: string,
      ate: string,
    ): Promise<BuscaLinha[]> {
      const linhas: BuscaLinha[] = [];
      for (let n = 0; n < MAX_PAGINAS; n++) {
        const r = await chamar(
          `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
          {
            method: "POST",
            body: {
              startDate: desde,
              endDate: ate,
              dimensions: ["date", "query", "page"],
              rowLimit: POR_PAGINA_BUSCAS,
              startRow: linhas.length,
            },
          },
        );
        const p = parseWith(sistema, buscasSchema, r);
        for (const b of p.rows) {
          const [date = "", query = "", page = ""] = b.keys;
          linhas.push({
            date,
            query,
            page,
            clicks: b.clicks,
            impressions: b.impressions,
            ctr: b.ctr,
            position: b.position,
          });
        }
        if (p.rows.length < POR_PAGINA_BUSCAS) break;
      }
      return linhas;
    },

    /** Conta que autorizou e os escopos que ela concedeu. */
    async conta() {
      const t = await renovar();
      return {
        email: emailDoIdToken(t.id_token),
        escopos: t.scope.split(" ").filter(Boolean),
      };
    },

    /** Nome e moeda da conta do Google Ads (confirma o acesso à conta). */
    async adsCliente(customerId: string, loginCustomerId?: string) {
      const r = await chamar(
        `https://googleads.googleapis.com/${VERSAO_ADS}/customers/${customerId}/googleAds:search`,
        {
          method: "POST",
          body: {
            query:
              "SELECT customer.descriptive_name, customer.currency_code FROM customer LIMIT 1",
          },
          headers: loginCustomerId
            ? { "login-customer-id": loginCustomerId }
            : {},
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

    /**
     * Contas de anúncio (não MCC) que a conta alcança: as diretas e as
     * filhas de cada MCC (pela MCC, com login-customer-id). Uma conta que
     * falha (cancelada, sem acesso) fica de fora.
     */
    async contasAds(): Promise<ContaAds[]> {
      const base = `https://googleads.googleapis.com/${VERSAO_ADS}/customers`;
      const r = await chamar(`${base}:listAccessibleCustomers`);
      const raizes = parseWith(sistema, acessiveisSchema, r)
        .resourceNames.map((n) => n.replace(/^customers\//, ""))
        .slice(0, 20);
      const porRaiz = await Promise.allSettled(
        raizes.map(async (raiz) => {
          const c = await chamar(`${base}/${raiz}/googleAds:search`, {
            method: "POST",
            body: {
              query:
                "SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager FROM customer_client WHERE customer_client.level <= 1 AND customer_client.status = 'ENABLED'",
            },
            headers: { "login-customer-id": raiz },
          });
          return parseWith(sistema, clientesAdsSchema, c).results.map(
            ({ customerClient: k }) => ({
              id: k.id,
              nome: k.descriptiveName,
              manager: k.manager,
              login: k.id === raiz ? "" : raiz,
            }),
          );
        }),
      );
      // A mesma conta pode vir direta e por uma MCC: fica a direta.
      const contas = new Map<string, ContaAds>();
      for (const p of porRaiz) {
        if (p.status !== "fulfilled") continue;
        for (const k of p.value) {
          if (k.manager) continue;
          const atual = contas.get(k.id);
          if (!atual || (atual.login && !k.login))
            contas.set(k.id, { id: k.id, nome: k.nome, login: k.login });
        }
      }
      return [...contas.values()];
    },

    /** Propriedades do GA4, com o nome da conta do Analytics. */
    async propriedadesGa4() {
      const r = await chamar(
        "https://analyticsadmin.googleapis.com/v1beta/accountSummaries",
        { query: { pageSize: 200 } },
      );
      return parseWith(sistema, resumosGa4Schema, r).accountSummaries.flatMap(
        (conta) =>
          conta.propertySummaries.map((p) => ({
            id: p.property.replace(/^properties\//, ""),
            nome: p.displayName,
            conta: conta.displayName,
          })),
      );
    },

    /** Propriedades verificadas do Search Console. */
    async sitesSearchConsole() {
      const r = await chamar("https://www.googleapis.com/webmasters/v3/sites");
      return parseWith(sistema, sitesSchema, r)
        .siteEntry.filter((s) => s.permissionLevel !== "siteUnverifiedUser")
        .map((s) => s.siteUrl);
    },

    /** Contas do Perfil da Empresa (exige o acesso aprovado pelo Google). */
    async contasPerfil() {
      const r = await chamar(
        "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
        { query: { pageSize: 20 } },
      );
      return parseWith(sistema, contasPerfilSchema, r).accounts.map((a) => ({
        id: a.name.replace(/^accounts\//, ""),
        nome: a.accountName,
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
