import "server-only";
import { createAsanaClient } from "@/connectors/marketing/asana";
import { createGoogleClient } from "@/connectors/marketing/google";
import { createMetaClient, SITUACAO_CONTA } from "@/connectors/marketing/meta";
import { createRdStationClient } from "@/connectors/marketing/rd-station";
import { createSiteClient } from "@/connectors/marketing/site";
import { createTikTokClient } from "@/connectors/marketing/tiktok";
import { formatarData, formatarNumero } from "@/lib/formato";
import {
  escoposFaltando,
  INTEGRACOES,
  type PRODUTOS,
  type Sistema,
  separarSegredos,
} from "@/lib/integracoes";
import { eventosDoSite } from "@/lib/marketing/eventos";
import { somarDias } from "@/lib/marketing/periodo";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import type { Credencial } from "../integracoes";

// Teste de conexão de cada ferramenta do Marketing: uma ou duas leituras
// pequenas que provam que o acesso abre o que o módulo vai ler. Nada é
// gravado nas ferramentas. Google e Meta servem a vários produtos: cada um
// com id preenchido é testado à parte.

type SistemaMkt = Extract<Sistema, `mkt_${string}`>;

export interface TesteDeProduto<S extends keyof typeof PRODUTOS> {
  produto: (typeof PRODUTOS)[S][number];
  testar: () => Promise<string>;
}

/** Parâmetros validados e segredos separados da credencial. */
function abrir(sistema: SistemaMkt, c: Credencial) {
  const def = INTEGRACOES[sistema];
  const p = def.parametros.parse(c.parametros);
  const s = separarSegredos(def, c.segredo);
  return { p: (k: string) => String(p[k] ?? ""), s: (k: string) => s[k] ?? "" };
}

function testesGoogle(c: Credencial): TesteDeProduto<"mkt_google">[] {
  const { p, s } = abrir("mkt_google", c);
  const api = createGoogleClient({
    sistema: "mkt_google",
    clientId: p("client_id"),
    clientSecret: s("client_secret"),
    refreshToken: s("refresh_token"),
  });
  const testes: TesteDeProduto<"mkt_google">[] = [
    {
      produto: "Conta Google",
      async testar() {
        if (!s("refresh_token"))
          throw new Error("falta clicar em Conectar com o Google");
        const conta = await api.conta();
        const faltam = escoposFaltando(conta.escopos);
        if (faltam.length > 0)
          throw new Error(
            `${conta.email || "a conta"} não liberou: ${faltam.join(", ")}`,
          );
        return conta.email || "todas as permissões liberadas";
      },
    },
  ];
  if (p("customer_id"))
    testes.push({
      produto: "Google Ads",
      async testar() {
        const conta = await api.adsCliente(
          p("customer_id"),
          p("login_customer_id") || undefined,
        );
        return `conta “${conta.nome}” (${conta.moeda})`;
      },
    });
  if (p("property_id"))
    testes.push({
      produto: "Analytics 4",
      async testar() {
        const sessoes = await api.ga4Sessoes(p("property_id"));
        return `${formatarNumero(sessoes)} sessões nos últimos 7 dias`;
      },
    });
  if (p("site_url"))
    testes.push({
      produto: "Search Console",
      async testar() {
        const site = await api.searchConsole(p("site_url"));
        if (site.permissionLevel === "siteUnverifiedUser")
          throw new Error(
            `a conta não tem acesso verificado a ${site.siteUrl}`,
          );
        return site.siteUrl;
      },
    });
  if (p("channel_id"))
    testes.push({
      produto: "YouTube",
      async testar() {
        const canais = await api.meusCanais();
        const canal = canais.find((k) => k.id === p("channel_id"));
        if (!canal) {
          const lista = canais.map((k) => `${k.nome} (${k.id})`).join(", ");
          throw new Error(
            `o canal ${p("channel_id")} não é desta conta Google. Canais da conta: ${lista || "nenhum"}`,
          );
        }
        return `canal “${canal.nome}” · ${formatarNumero(canal.inscritos)} inscritos`;
      },
    });
  if (p("account_id"))
    testes.push({
      produto: "Perfil da Empresa",
      async testar() {
        const { locais, temMais } = await api.locais(p("account_id"));
        const total = `${formatarNumero(locais.length)}${temMais ? "+" : ""}`;
        return `${total} ${locais.length === 1 ? "local" : "locais"} na conta`;
      },
    });
  return testes;
}

function testesMeta(c: Credencial): TesteDeProduto<"mkt_meta">[] {
  const { p, s } = abrir("mkt_meta", c);
  const api = createMetaClient({ sistema: "mkt_meta", token: s("segredo") });
  const testes: TesteDeProduto<"mkt_meta">[] = [];
  if (p("ad_account_id"))
    testes.push({
      produto: "Meta Ads",
      async testar() {
        const conta = await api.contaDeAnuncios(p("ad_account_id"));
        const situacao =
          SITUACAO_CONTA[conta.account_status] ??
          `situação ${conta.account_status}`;
        return `conta “${conta.name}” (${conta.currency}) · ${situacao}`;
      },
    });
  if (p("page_id"))
    testes.push({
      produto: "Facebook",
      async testar() {
        const pagina = await api.pagina(p("page_id"));
        return `“${pagina.name}” · ${formatarNumero(pagina.followers_count)} seguidores`;
      },
    });
  if (p("instagram_id"))
    testes.push({
      produto: "Instagram",
      async testar() {
        const ig = await api.instagram(p("instagram_id"));
        return `@${ig.username} · ${formatarNumero(ig.followers_count)} seguidores`;
      },
    });
  return testes;
}

export const TESTES_MARKETING: Record<
  SistemaMkt,
  (
    c: Credencial,
  ) => Promise<
    string | TesteDeProduto<"mkt_google">[] | TesteDeProduto<"mkt_meta">[]
  >
> = {
  mkt_google: async (c) => testesGoogle(c),
  mkt_meta: async (c) => testesMeta(c),

  async mkt_tiktok(c) {
    const { p, s } = abrir("mkt_tiktok", c);
    if (!s("segredo"))
      throw new Error(
        "falta autorizar: clique em Conectar com o TikTok (gera o token de Ads)",
      );
    if (!p("advertiser_id"))
      throw new Error(
        "a conta que autorizou não tem acesso a nenhum anunciante: conecte com quem administra os anúncios",
      );
    const a = await createTikTokClient({ token: s("segredo") }).anunciante(
      p("advertiser_id"),
    );
    return `Conectado ao anunciante “${a.name}” (${a.currency})`;
  },

  async mkt_rd_station(c) {
    const { p, s } = abrir("mkt_rd_station", c);
    if (!s("refresh_token"))
      throw new Error(
        "falta autorizar: clique em Conectar com o RD Station (gera o refresh token)",
      );
    const conta = await createRdStationClient({
      clientId: p("client_id"),
      clientSecret: s("client_secret"),
      refreshToken: s("refresh_token"),
    }).conta();
    return `Conectado à conta “${conta.name}”`;
  },

  async mkt_asana(c) {
    const { p, s } = abrir("mkt_asana", c);
    const api = createAsanaClient({ token: s("segredo") });
    const eu = await api.eu();
    const ws = eu.workspaces.find((w) => w.gid === p("workspace_gid"));
    if (!ws) {
      const lista = eu.workspaces.map((w) => `${w.gid} (${w.name})`).join(", ");
      throw new Error(
        `token aceito, mas o workspace ${p("workspace_gid")} não aparece para ${eu.name}. Workspaces: ${lista || "nenhum"}`,
      );
    }
    const { projetos, temMais } = await api.projetos(ws.gid);
    return `Conectado como ${eu.name} no workspace “${ws.name}” · ${formatarNumero(projetos.length)}${temMais ? "+" : ""} projetos ativos`;
  },

  async mkt_site(c) {
    const { p } = abrir("mkt_site", c);
    const eventos = eventosDoSite(
      await createSiteClient({ endpoint: p("endpoint") }).eventos(),
    );
    if (!eventos.length)
      throw new Error("o endereço respondeu, mas sem nenhum evento com data");
    const hoje = hojeEmBrasilia(new Date());
    const futuros = eventos.filter((e) => e.fim >= hoje);
    const em30 = futuros.filter((e) => e.inicio <= somarDias(hoje, 29));
    const [proximo] = futuros;
    return [
      `${formatarNumero(eventos.length)} eventos publicados`,
      `${formatarNumero(em30.length)} nos próximos 30 dias`,
      proximo
        ? `próximo: “${proximo.titulo}” em ${formatarData(proximo.inicio)}`
        : "nenhum evento futuro",
    ].join(" · ");
  },
};
