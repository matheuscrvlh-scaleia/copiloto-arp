import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ConnectorError } from "../http";
import { createAsanaClient } from "./asana";
import {
  createGoogleClient,
  revogarGoogle,
  trocarCodigoGoogle,
  urlAutorizacaoGoogle,
} from "./google";
import { createMetaClient } from "./meta";
import { createRdStationClient, trocarCodigoRd } from "./rd-station";
import { createSiteClient } from "./site";
import { createTikTokClient, trocarCodigoTikTok } from "./tiktok";

// Respostas montadas com os exemplos da documentação de cada API.

interface Chamada {
  url: string;
  metodo: string;
  headers: Headers;
  corpo: string;
}

/** fetch falso: devolve as respostas na ordem e guarda as chamadas. */
function falso(respostas: unknown[], chamadas: Chamada[] = []) {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    chamadas.push({
      url: String(url),
      metodo: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      corpo: String(init?.body ?? ""),
    });
    const r = respostas.shift();
    if (r instanceof Response) return r;
    return new Response(JSON.stringify(r), { status: 200 });
  }) as typeof fetch;
}

const TOKEN = { access_token: "acesso", expires_in: 3599 };

describe("google", () => {
  it("troca o refresh token uma vez e lê a conta do Google Ads", async () => {
    const chamadas: Chamada[] = [];
    const api = createGoogleClient({
      sistema: "mkt_google_ads",
      clientId: "id",
      clientSecret: "segredo",
      refreshToken: "refresh",
      fetch: falso(
        [
          TOKEN,
          {
            results: [
              { customer: { descriptiveName: "ARP", currencyCode: "BRL" } },
            ],
          },
        ],
        chamadas,
      ),
    });
    expect(await api.adsCliente("123", "dev", "999")).toEqual({
      nome: "ARP",
      moeda: "BRL",
    });
    expect(chamadas[0]?.url).toBe("https://oauth2.googleapis.com/token");
    expect(chamadas[0]?.corpo).toContain("grant_type=refresh_token");
    expect(chamadas[1]?.url).toMatch(
      /googleads\.googleapis\.com\/v\d+\/customers\/123\/googleAds:search$/,
    );
    expect(chamadas[1]?.headers.get("authorization")).toBe("Bearer acesso");
    expect(chamadas[1]?.headers.get("developer-token")).toBe("dev");
    expect(chamadas[1]?.headers.get("login-customer-id")).toBe("999");
  });

  it("GA4 soma vazio como zero e Search Console codifica a propriedade", async () => {
    const chamadas: Chamada[] = [];
    const api = createGoogleClient({
      sistema: "mkt_ga4",
      clientId: "id",
      clientSecret: "s",
      refreshToken: "r",
      fetch: falso(
        [
          TOKEN,
          { rows: [{ metricValues: [{ value: "1234" }] }] },
          { siteUrl: "sc-domain:arp.com.br", permissionLevel: "siteOwner" },
          {},
        ],
        chamadas,
      ),
    });
    expect(await api.ga4Sessoes("42")).toBe(1234);
    expect((await api.searchConsole("sc-domain:arp.com.br")).siteUrl).toBe(
      "sc-domain:arp.com.br",
    );
    expect(chamadas[2]?.url).toContain("/sites/sc-domain%3Aarp.com.br");
    expect(chamadas.filter((c) => c.url.includes("oauth2"))).toHaveLength(1);
  });

  it("token recusado vira erro 400 com a mensagem do Google", async () => {
    const api = createGoogleClient({
      sistema: "mkt_youtube",
      clientId: "id",
      clientSecret: "s",
      refreshToken: "r",
      fetch: falso([
        new Response(
          JSON.stringify({
            error: "invalid_grant",
            error_description: "Token has been expired or revoked.",
          }),
          { status: 400 },
        ),
      ]),
    });
    const e = await api.meusCanais().catch((x) => x);
    expect(e).toBeInstanceOf(ConnectorError);
    expect(e.status).toBe(400);
    expect(e.detalhe).toContain("expired or revoked");
  });

  it("conta: e-mail do id_token e escopos concedidos, no mesmo token", async () => {
    const payload = Buffer.from(
      JSON.stringify({ email: "marketing@arp.com.br", sub: "1" }),
    ).toString("base64url");
    const chamadas: Chamada[] = [];
    const api = createGoogleClient({
      sistema: "mkt_google",
      clientId: "id",
      clientSecret: "s",
      refreshToken: "r",
      fetch: falso(
        [
          {
            ...TOKEN,
            scope: "openid https://www.googleapis.com/auth/adwords",
            id_token: `cabecalho.${payload}.assinatura`,
          },
          { items: [] },
        ],
        chamadas,
      ),
    });
    expect(await api.conta()).toEqual({
      email: "marketing@arp.com.br",
      escopos: ["openid", "https://www.googleapis.com/auth/adwords"],
    });
    await api.meusCanais();
    expect(chamadas.filter((c) => c.url.includes("oauth2"))).toHaveLength(1);
  });

  it("conta sem id_token: e-mail vazio, sem quebrar", async () => {
    const api = createGoogleClient({
      sistema: "mkt_google",
      clientId: "id",
      clientSecret: "s",
      refreshToken: "r",
      fetch: falso([TOKEN]),
    });
    expect(await api.conta()).toEqual({ email: "", escopos: [] });
  });
});

describe("google: autorização", () => {
  it("URL pede acesso offline, consent, escopos e PKCE S256", () => {
    const u = new URL(
      urlAutorizacaoGoogle({
        clientId: "app.apps.googleusercontent.com",
        redirectUri: "http://localhost:3000/api/integracoes/google/callback",
        escopos: ["openid", "https://www.googleapis.com/auth/adwords"],
        state: "st",
        desafio: "dsf",
      }),
    );
    expect(u.origin + u.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(Object.fromEntries(u.searchParams)).toEqual({
      client_id: "app.apps.googleusercontent.com",
      redirect_uri: "http://localhost:3000/api/integracoes/google/callback",
      response_type: "code",
      scope: "openid https://www.googleapis.com/auth/adwords",
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state: "st",
      code_challenge: "dsf",
      code_challenge_method: "S256",
    });
  });

  it("troca o code (com o verificador) pelo refresh token e os escopos", async () => {
    const chamadas: Chamada[] = [];
    const r = await trocarCodigoGoogle({
      clientId: "id",
      clientSecret: "s",
      code: "4/abc",
      redirectUri: "http://localhost:3000/api/integracoes/google/callback",
      verificador: "ver",
      fetch: falso(
        [{ ...TOKEN, refresh_token: "1//novo", scope: "openid email" }],
        chamadas,
      ),
    });
    expect(r).toEqual({
      refreshToken: "1//novo",
      escopos: ["openid", "email"],
    });
    const corpo = new URLSearchParams(chamadas[0]?.corpo);
    expect(corpo.get("grant_type")).toBe("authorization_code");
    expect(corpo.get("code_verifier")).toBe("ver");
    expect(corpo.get("redirect_uri")).toContain("/api/integracoes/google/");
  });

  it("sem refresh token na resposta é erro (não salva acesso de 1 hora)", async () => {
    const e = await trocarCodigoGoogle({
      clientId: "id",
      clientSecret: "s",
      code: "c",
      redirectUri: "http://localhost:3000/x",
      verificador: "v",
      fetch: falso([TOKEN]),
    }).catch((x) => x);
    expect(e).toBeInstanceOf(ConnectorError);
  });

  it("revogar token já revogado (400) não é erro; 500 é", async () => {
    const chamadas: Chamada[] = [];
    await revogarGoogle(
      "1//r",
      falso(
        [new Response('{"error":"invalid_token"}', { status: 400 })],
        chamadas,
      ),
    );
    expect(chamadas[0]?.url).toBe("https://oauth2.googleapis.com/revoke");
    expect(chamadas[0]?.corpo).toBe("token=1%2F%2Fr");
    const e = await revogarGoogle(
      "1//r",
      falso([
        new Response("", { status: 500 }),
        new Response("", { status: 500 }),
      ]),
    ).catch((x) => x);
    expect(e).toBeInstanceOf(ConnectorError);
  });
});

describe("meta", () => {
  it("manda o token no header e lê conta, página e Instagram", async () => {
    const chamadas: Chamada[] = [];
    const api = createMetaClient({
      sistema: "mkt_meta_ads",
      token: "tk",
      fetch: falso(
        [
          { name: "ARP", account_status: 1, currency: "BRL", id: "act_1" },
          { name: "ARP", followers_count: 1500, id: "9" },
        ],
        chamadas,
      ),
    });
    expect((await api.contaDeAnuncios("1")).name).toBe("ARP");
    expect((await api.pagina("9")).followers_count).toBe(1500);
    expect(chamadas[0]?.url).toMatch(/graph\.facebook\.com\/v[\d.]+\/act_1\?/);
    expect(chamadas[0]?.url).not.toContain("tk");
    expect(chamadas[0]?.headers.get("authorization")).toBe("Bearer tk");
  });

  it("insights: segue o cursor e converte os números que vêm em texto", async () => {
    const chamadas: Chamada[] = [];
    const linha = (dia: string) => ({
      campaign_id: "c1",
      date_start: dia,
      date_stop: dia,
      spend: "9.89",
      impressions: "2486",
      reach: "2327",
      frequency: "1.068",
      clicks: "135",
      inline_link_clicks: "0",
      ctr: "5.43",
      cpc: "0.07",
      cpm: "3.97",
      actions: [{ action_type: "lead", value: "2" }],
    });
    const api = createMetaClient({
      sistema: "mkt_meta",
      token: "tk",
      fetch: falso(
        [
          {
            data: [linha("2026-10-01")],
            paging: { cursors: { after: "AA" }, next: "https://x" },
          },
          { data: [linha("2026-10-02")], paging: { cursors: { after: "BB" } } },
        ],
        chamadas,
      ),
    });
    const r = await api.insights("1", "2026-10-01", "2026-10-02");
    expect(r).toHaveLength(2);
    expect(r[0]?.spend).toBe(9.89);
    expect(r[0]?.actions).toEqual([{ action_type: "lead", value: 2 }]);
    expect(r[0]?.cost_per_action_type).toEqual([]);
    expect(chamadas[1]?.url).toContain("after=AA");
    expect(chamadas[0]?.url).toContain("time_increment=1");
  });

  it("estado sem o sufixo (state) e demografia por cidade e idade", async () => {
    const api = createMetaClient({
      sistema: "mkt_meta",
      token: "tk",
      fetch: falso([
        {
          data: [
            {
              campaign_id: "c1",
              date_start: "2026-10-01",
              region: "Rio de Janeiro (state)",
              spend: "1",
              impressions: "10",
              inline_link_clicks: "1",
            },
          ],
        },
        {
          data: [
            {
              total_value: {
                breakdowns: [
                  {
                    results: [
                      {
                        dimension_values: [
                          "Nova Friburgo, Rio de Janeiro (state)",
                        ],
                        value: 33655,
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
        {
          data: [
            {
              total_value: {
                breakdowns: [
                  { results: [{ dimension_values: ["25-34"], value: 12690 }] },
                ],
              },
            },
          ],
        },
        {
          data: [
            {
              total_value: {
                breakdowns: [
                  { results: [{ dimension_values: ["F"], value: 21000 }] },
                ],
              },
            },
          ],
        },
      ]),
    });
    const q = await api.quebras("1", "2026-10-01", "2026-10-01", "region");
    expect(q[0]?.region).toBe("Rio de Janeiro");
    expect(await api.instagramDemografia("9")).toEqual([
      {
        breakdown: "city",
        dimension_value: "Nova Friburgo, Rio de Janeiro",
        value: 33655,
      },
      { breakdown: "age", dimension_value: "25-34", value: 12690 },
      { breakdown: "gender", dimension_value: "F", value: 21000 },
    ]);
  });

  it("posts: para no primeiro anterior à janela e lê as métricas aninhadas", async () => {
    const midia = (id: string, ts: string) => ({
      id,
      media_type: "VIDEO",
      media_product_type: "REELS",
      timestamp: ts,
      like_count: 4,
      comments_count: 1,
      insights: {
        data: [
          { name: "reach", values: [{ value: 1059 }] },
          { name: "views", values: [{ value: 1554 }] },
        ],
      },
    });
    const chamadas: Chamada[] = [];
    const api = createMetaClient({
      sistema: "mkt_meta",
      token: "tk",
      fetch: falso(
        [
          {
            data: [
              midia("1", "2026-10-29T21:02:55+0000"),
              midia("2", "2026-06-01T10:00:00+0000"),
            ],
            paging: { cursors: { after: "AA" }, next: "https://x" },
          },
        ],
        chamadas,
      ),
    });
    const posts = await api.instagramPosts("9", "2026-06-26");
    expect(chamadas).toHaveLength(1);
    expect(posts.map((p) => [p.id, p.reach, p.views, p.saved])).toEqual([
      ["1", 1059, 1554, 0],
    ]);
  });
});

describe("tiktok", () => {
  it("lê o anunciante e trata code diferente de 0 como erro", async () => {
    const chamadas: Chamada[] = [];
    const ok = createTikTokClient({
      token: "tk",
      fetch: falso(
        [
          {
            code: 0,
            message: "OK",
            data: { list: [{ name: "ARP", currency: "BRL" }] },
          },
        ],
        chamadas,
      ),
    });
    expect((await ok.anunciante("7")).name).toBe("ARP");
    expect(chamadas[0]?.headers.get("access-token")).toBe("tk");
    expect(decodeURIComponent(chamadas[0]?.url ?? "")).toContain(
      'advertiser_ids=["7"]',
    );

    const recusado = createTikTokClient({
      token: "x",
      fetch: falso([
        { code: 40105, message: "Access token is incorrect", data: {} },
      ]),
    });
    const e = await recusado.anunciante("7").catch((x) => x);
    expect(e).toBeInstanceOf(ConnectorError);
    expect(e.status).toBe(401);
    expect(e.detalhe).toContain("Access token is incorrect");
  });

  it("troca o auth_code pelo token de Ads e os anunciantes, uma tentativa só", async () => {
    const chamadas: Chamada[] = [];
    const r = await trocarCodigoTikTok({
      appId: "app",
      secret: "s",
      authCode: "c0de",
      fetch: falso(
        [
          {
            code: 0,
            message: "OK",
            data: {
              access_token: "tk",
              advertiser_ids: [7, "8"],
              scope: [4],
            },
          },
        ],
        chamadas,
      ),
    });
    expect(r).toEqual({ token: "tk", anunciantes: ["7", "8"] });
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]?.metodo).toBe("POST");
    expect(chamadas[0]?.url).toBe(
      "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/",
    );
    expect(JSON.parse(chamadas[0]?.corpo ?? "")).toEqual({
      app_id: "app",
      secret: "s",
      auth_code: "c0de",
    });

    await expect(
      trocarCodigoTikTok({
        appId: "app",
        secret: "s",
        authCode: "velho",
        fetch: falso([
          { code: 40002, message: "auth_code is invalid", data: {} },
        ]),
      }),
    ).rejects.toBeInstanceOf(ConnectorError);
  });
});

describe("rd station", () => {
  it("troca o refresh token e lê a conta", async () => {
    const chamadas: Chamada[] = [];
    const api = createRdStationClient({
      clientId: "c",
      clientSecret: "s",
      refreshToken: "r",
      fetch: falso([TOKEN, { name: "ARP Shopping" }], chamadas),
    });
    expect((await api.conta()).name).toBe("ARP Shopping");
    expect(JSON.parse(chamadas[0]?.corpo ?? "")).toEqual({
      client_id: "c",
      client_secret: "s",
      refresh_token: "r",
    });
    expect(chamadas[1]?.headers.get("authorization")).toBe("Bearer acesso");
  });
});

describe("asana", () => {
  it("lê o usuário, os workspaces e os projetos ativos", async () => {
    const chamadas: Chamada[] = [];
    const api = createAsanaClient({
      token: "pat",
      fetch: falso(
        [
          {
            data: {
              gid: "1",
              name: "Daniel",
              workspaces: [{ gid: "10", name: "ARP" }],
            },
          },
          {
            data: [{ gid: "p1", name: "Marketing" }],
            next_page: { offset: "x", path: "/projects", uri: "u" },
          },
        ],
        chamadas,
      ),
    });
    expect((await api.eu()).workspaces[0]?.gid).toBe("10");
    expect(await api.projetos("10")).toEqual({
      projetos: [{ gid: "p1", name: "Marketing" }],
      temMais: true,
    });
    expect(chamadas[1]?.url).toContain("archived=false");
  });

  it("segue as páginas dos projetos, arquivados inclusive", async () => {
    const chamadas: Chamada[] = [];
    const api = createAsanaClient({
      token: "pat",
      fetch: falso(
        [
          {
            data: [{ gid: "p1", name: "Marketing", archived: false }],
            next_page: { offset: "abc", path: "/projects", uri: "u" },
          },
          {
            data: [{ gid: "p2", name: "Velho", archived: true }],
            next_page: null,
          },
        ],
        chamadas,
      ),
    });
    expect(await api.todosOsProjetos("10")).toEqual([
      { gid: "p1", name: "Marketing", archived: false },
      { gid: "p2", name: "Velho", archived: true },
    ]);
    expect(new URL(chamadas[0]?.url ?? "").searchParams.has("archived")).toBe(
      false,
    );
    expect(new URL(chamadas[1]?.url ?? "").searchParams.get("offset")).toBe(
      "abc",
    );
  });

  it("tarefas: seção do projeto lido primeiro, campos vazios fora, notas quando pedidas", async () => {
    const chamadas: Chamada[] = [];
    const api = createAsanaClient({
      token: "pat",
      fetch: falso(
        [
          {
            data: [
              {
                gid: "t1",
                name: "S14",
                notes: "Problema: TV desligada",
                projects: [
                  { gid: "outro", name: "Outro" },
                  { gid: "ronda", name: "Reporte ambiência" },
                ],
                memberships: [
                  { project: { gid: "outro" }, section: { name: "A fazer" } },
                  { project: { gid: "ronda" }, section: { name: "Outubro" } },
                ],
                assignee: null,
                created_at: "2026-07-02T18:42:25.062Z",
                due_on: "2026-09-02",
                start_on: null,
                completed: false,
                completed_at: null,
                tags: [],
                custom_fields: [
                  { name: "Local", display_value: "BL 11" },
                  { name: "Orçamento", display_value: null },
                ],
                permalink_url: "https://app.asana.com/1/x/task/t1",
              },
            ],
            next_page: null,
          },
        ],
        chamadas,
      ),
    });
    const [t] = await api.tarefas("ronda", "2025-10-01T00:00:00.000Z", true);
    expect(t?.memberships[0]?.section.name).toBe("Outubro");
    expect(t?.custom_fields).toEqual([
      { name: "Local", display_value: "BL 11" },
    ]);
    expect(t?.notes).toBe("Problema: TV desligada");
    const url = new URL(chamadas[0]?.url ?? "");
    expect(url.pathname).toBe("/api/1.0/projects/ronda/tasks");
    expect(url.searchParams.get("completed_since")).toBe(
      "2025-10-01T00:00:00.000Z",
    );
    expect(url.searchParams.get("opt_fields")).toContain(",notes");
    expect(chamadas[0]?.headers.get("authorization")).toBe("Bearer pat");
  });
});

describe("site (WordPress)", () => {
  const evento = (id: number) => ({
    id,
    link: `https://www.espacoarp.com.br/evento/${id}/`,
    title: { rendered: "Show" },
    acf: { evento_tipo: "date", evento_data_hora: "2026-11-02 14:00:00" },
  });
  /** Página além da última: o WordPress responde 400. */
  const alem = () =>
    new Response(JSON.stringify({ code: "rest_post_invalid_page_number" }), {
      status: 400,
    });

  it("lê a 1ª página e as outras em lote, até a última, com os parâmetros do endereço", async () => {
    const chamadas: Chamada[] = [];
    const api = createSiteClient({
      endpoint:
        "https://www.espacoarp.com.br/wp-json/wp/v2/evento?per_page=2&page=1&_embed=wp:featuredmedia",
      fetch: falso(
        [
          [evento(1), evento(2)],
          [evento(3), { ...evento(4), acf: [] }],
          [evento(5)],
          alem(),
          alem(),
          alem(),
        ],
        chamadas,
      ),
    });
    expect((await api.eventos()).map((e) => e.id)).toEqual([1, 2, 3, 4, 5]);
    expect(
      chamadas.map((c) => new URL(c.url).searchParams.get("page")),
    ).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(chamadas[0]?.url).toContain("_embed=wp%3Afeaturedmedia");
  });

  it("página além da última (400 do WordPress) encerra a leitura", async () => {
    const api = createSiteClient({
      endpoint: "https://x.com.br/wp-json/wp/v2/evento?per_page=1",
      fetch: falso([[evento(1)], alem(), alem(), alem(), alem(), alem()]),
    });
    expect(await api.eventos()).toHaveLength(1);
  });

  it("formato inesperado vira erro do conector", async () => {
    const api = createSiteClient({
      endpoint: "https://x.com.br/wp-json/wp/v2/evento",
      fetch: falso([{ code: "rest_no_route" }]),
    });
    await expect(api.eventos()).rejects.toBeInstanceOf(ConnectorError);
  });
});

describe("rd station: autorização", () => {
  it("troca o code pelo refresh token, uma tentativa só", async () => {
    const chamadas: Chamada[] = [];
    const refresh = await trocarCodigoRd({
      clientId: "id",
      clientSecret: "segredo",
      code: "c0de",
      fetch: falso(
        [{ access_token: "a", expires_in: 86400, refresh_token: "r" }],
        chamadas,
      ),
    });
    expect(refresh).toBe("r");
    expect(chamadas[0]?.url).toBe(
      "https://api.rd.services/auth/token?token_by=code",
    );
    expect(JSON.parse(chamadas[0]?.corpo ?? "")).toEqual({
      client_id: "id",
      client_secret: "segredo",
      code: "c0de",
    });
  });

  it("code expirado vira erro do conector", async () => {
    await expect(
      trocarCodigoRd({
        clientId: "id",
        clientSecret: "segredo",
        code: "velho",
        fetch: falso([
          new Response(
            JSON.stringify({ errors: [{ error_type: "EXPIRED_CODE_GRANT" }] }),
            { status: 401 },
          ),
        ]),
      }),
    ).rejects.toBeInstanceOf(ConnectorError);
  });
});

describe("google: só leitura", () => {
  it("o escopo adwords permite escrita: o conector nunca chama mutate", () => {
    const fonte = readFileSync(new URL("./google.ts", import.meta.url), "utf8");
    expect(fonte).not.toMatch(/mutate/i);
  });
});

describe("google: descoberta", () => {
  const cliente = (respostas: unknown[], chamadas: Chamada[] = []) =>
    createGoogleClient({
      sistema: "mkt_google",
      clientId: "id",
      clientSecret: "s",
      refreshToken: "r",
      fetch: falso([TOKEN, ...respostas], chamadas),
    });

  it("Ads: contas diretas e filhas da MCC, sem MCC e sem repetir", async () => {
    const chamadas: Chamada[] = [];
    const api = cliente(
      [
        { resourceNames: ["customers/111", "customers/999"] },
        {
          results: [
            {
              customerClient: {
                id: "111",
                descriptiveName: "ARP",
                manager: false,
              },
            },
          ],
        },
        {
          results: [
            {
              customerClient: {
                id: "999",
                descriptiveName: "Agência",
                manager: true,
              },
            },
            {
              customerClient: {
                id: "111",
                descriptiveName: "ARP",
                manager: false,
              },
            },
            {
              customerClient: {
                id: "222",
                descriptiveName: "ARP Eventos",
                manager: false,
              },
            },
          ],
        },
      ],
      chamadas,
    );
    expect(await api.contasAds("dev")).toEqual([
      { id: "111", nome: "ARP", login: "" },
      { id: "222", nome: "ARP Eventos", login: "999" },
    ]);
    expect(chamadas[1]?.url).toMatch(/\/customers:listAccessibleCustomers$/);
    expect(chamadas[1]?.headers.get("developer-token")).toBe("dev");
    expect(chamadas[3]?.headers.get("login-customer-id")).toBe("999");
    expect(chamadas[3]?.corpo).toContain("FROM customer_client");
  });

  it("Ads: conta que falha fica de fora, as outras seguem", async () => {
    const api = cliente([
      { resourceNames: ["customers/1", "customers/2"] },
      new Response('{"error":{"message":"cancelada"}}', { status: 403 }),
      {
        results: [
          { customerClient: { id: "2", descriptiveName: "B", manager: false } },
        ],
      },
    ]);
    expect(await api.contasAds("dev")).toEqual([
      { id: "2", nome: "B", login: "" },
    ]);
  });

  it("GA4, Search Console (só verificadas) e Perfil da Empresa", async () => {
    const api = cliente([
      {
        accountSummaries: [
          {
            displayName: "ARP",
            propertySummaries: [
              { property: "properties/42", displayName: "Site" },
            ],
          },
        ],
      },
      {
        siteEntry: [
          { siteUrl: "sc-domain:arp.com.br", permissionLevel: "siteOwner" },
          { siteUrl: "https://x.com/", permissionLevel: "siteUnverifiedUser" },
        ],
      },
      {},
      { accounts: [{ name: "accounts/7", accountName: "ARP" }] },
    ]);
    expect(await api.propriedadesGa4()).toEqual([
      { id: "42", nome: "Site", conta: "ARP" },
    ]);
    expect(await api.sitesSearchConsole()).toEqual(["sc-domain:arp.com.br"]);
    expect(await api.sitesSearchConsole()).toEqual([]);
    expect(await api.contasPerfil()).toEqual([{ id: "7", nome: "ARP" }]);
  });
});
