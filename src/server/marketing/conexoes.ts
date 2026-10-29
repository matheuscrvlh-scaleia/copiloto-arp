import "server-only";
import { createAsanaClient } from "@/connectors/marketing/asana";
import { createGoogleClient } from "@/connectors/marketing/google";
import { createMetaClient, SITUACAO_CONTA } from "@/connectors/marketing/meta";
import { createRdStationClient } from "@/connectors/marketing/rd-station";
import { createTikTokClient } from "@/connectors/marketing/tiktok";
import { formatarNumero } from "@/lib/formato";
import { INTEGRACOES, type Sistema, separarSegredos } from "@/lib/integracoes";
import type { Credencial } from "../integracoes";

// Teste de conexão de cada ferramenta do Marketing: uma ou duas leituras
// pequenas que provam que o acesso abre o que o módulo vai ler. Nada é
// gravado nas ferramentas.

type SistemaMkt = Extract<Sistema, `mkt_${string}`>;

/** Parâmetros validados e segredos separados da credencial. */
function abrir(sistema: SistemaMkt, c: Credencial) {
  const def = INTEGRACOES[sistema];
  const p = def.parametros.parse(c.parametros);
  const s = separarSegredos(def, c.segredo);
  return { p: (k: string) => String(p[k] ?? ""), s: (k: string) => s[k] ?? "" };
}

function google(sistema: SistemaMkt, c: Credencial) {
  const { p, s } = abrir(sistema, c);
  return {
    p,
    s,
    api: createGoogleClient({
      sistema,
      clientId: p("client_id"),
      clientSecret: s("client_secret"),
      refreshToken: s("refresh_token"),
    }),
  };
}

export const TESTES_MARKETING: Record<
  SistemaMkt,
  (c: Credencial) => Promise<string>
> = {
  async mkt_meta_ads(c) {
    const { p, s } = abrir("mkt_meta_ads", c);
    const conta = await createMetaClient({
      sistema: "mkt_meta_ads",
      token: s("segredo"),
    }).contaDeAnuncios(p("ad_account_id"));
    const situacao =
      SITUACAO_CONTA[conta.account_status] ??
      `situação ${conta.account_status}`;
    return `Conectado à conta de anúncios “${conta.name}” (${conta.currency}) · ${situacao}`;
  },

  async mkt_google_ads(c) {
    const { p, s, api } = google("mkt_google_ads", c);
    const conta = await api.adsCliente(
      p("customer_id"),
      s("developer_token"),
      p("login_customer_id") || undefined,
    );
    return `Conectado à conta “${conta.nome}” (${conta.moeda})`;
  },

  async mkt_tiktok(c) {
    const { p, s } = abrir("mkt_tiktok", c);
    const api = createTikTokClient({ token: s("segredo") });
    const a = await api.anunciante(p("advertiser_id"));
    const partes = [`Conectado ao anunciante “${a.name}” (${a.currency})`];
    if (p("business_id")) {
      const conta = await api.contaBusiness(
        p("business_id"),
        s("token_conta") || undefined,
      );
      partes.push(
        `conta “${conta.display_name || conta.username}” com ${formatarNumero(conta.followers_count)} seguidores`,
      );
    } else {
      partes.push("sem conta Business");
    }
    return partes.join(" · ");
  },

  async mkt_ga4(c) {
    const { p, api } = google("mkt_ga4", c);
    const sessoes = await api.ga4Sessoes(p("property_id"));
    const site = await api.searchConsole(p("site_url"));
    if (site.permissionLevel === "siteUnverifiedUser")
      throw new Error(
        `GA4 ok, mas a conta não tem acesso verificado a ${site.siteUrl} no Search Console`,
      );
    return `GA4: ${formatarNumero(sessoes)} sessões nos últimos 7 dias · Search Console: ${site.siteUrl}`;
  },

  async mkt_rd_station(c) {
    const { p, s } = abrir("mkt_rd_station", c);
    const conta = await createRdStationClient({
      clientId: p("client_id"),
      clientSecret: s("client_secret"),
      refreshToken: s("refresh_token"),
    }).conta();
    return `Conectado à conta “${conta.name}”`;
  },

  async mkt_redes_meta(c) {
    const { p, s } = abrir("mkt_redes_meta", c);
    const api = createMetaClient({
      sistema: "mkt_redes_meta",
      token: s("segredo"),
    });
    const [pagina, ig] = await Promise.all([
      api.pagina(p("page_id")),
      api.instagram(p("instagram_id")),
    ]);
    return `Facebook “${pagina.name}” com ${formatarNumero(pagina.followers_count)} seguidores · Instagram @${ig.username} com ${formatarNumero(ig.followers_count)}`;
  },

  async mkt_youtube(c) {
    const { p, api } = google("mkt_youtube", c);
    const canais = await api.meusCanais();
    const canal = canais.find((k) => k.id === p("channel_id"));
    if (!canal) {
      const lista = canais.map((k) => `${k.nome} (${k.id})`).join(", ");
      throw new Error(
        `login aceito, mas o canal ${p("channel_id")} não é desta conta Google. Canais da conta: ${lista || "nenhum"}`,
      );
    }
    return `Conectado ao canal “${canal.nome}” · ${formatarNumero(canal.inscritos)} inscritos`;
  },

  async mkt_google_perfil(c) {
    const { p, api } = google("mkt_google_perfil", c);
    const { locais, temMais } = await api.locais(p("account_id"));
    const total = `${formatarNumero(locais.length)}${temMais ? "+" : ""}`;
    const nomes = locais
      .slice(0, 3)
      .map((l) => l.title)
      .join(", ");
    return `Conectado · ${total} ${locais.length === 1 ? "local" : "locais"} na conta${nomes ? ` (${nomes}${locais.length > 3 ? "…" : ""})` : ""}`;
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
};
