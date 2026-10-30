import { z } from "zod";
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

  return {
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
