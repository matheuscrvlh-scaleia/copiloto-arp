import { z } from "zod";
import type {
  InstagramDemografia,
  InstagramPost,
  MetaCampanha,
  MetaInsight,
  MetaQuebra,
} from "@/lib/marketing/fontes";
import { parseWith, requestJson } from "../http";

// Meta (Graph API e Marketing API): conta de anúncios, página do Facebook e
// conta profissional do Instagram. Token no header, nunca na URL. Só leitura.
// Os números chegam como texto em vários campos: viram número aqui.

const API_URL = "https://graph.facebook.com/v26.0";
/** Itens por página (o máximo que a API aceita sem reclamar). */
const POR_PAGINA = 500;

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
  media_count: z.number().default(0),
});

const num = z.coerce.number().default(0);

const paginado = <T extends z.ZodType>(item: T) =>
  z.object({
    data: z.array(item),
    paging: z
      .object({
        cursors: z.object({ after: z.string().optional() }).optional(),
        next: z.string().optional(),
      })
      .optional(),
  });

const acoesSchema = z
  .array(z.object({ action_type: z.string(), value: num }))
  .default([]);

const insightSchema = z.object({
  campaign_id: z.string(),
  date_start: z.string(),
  spend: num,
  impressions: num,
  reach: num,
  frequency: num,
  clicks: num,
  inline_link_clicks: num,
  ctr: num,
  cpc: num,
  cpm: num,
  actions: acoesSchema,
  cost_per_action_type: acoesSchema,
});

const quebraSchema = z.object({
  campaign_id: z.string(),
  date_start: z.string(),
  publisher_platform: z.string().optional(),
  region: z.string().optional(),
  spend: num,
  impressions: num,
  inline_link_clicks: num,
});

const nomes = z
  .object({ data: z.array(z.object({ name: z.string() })) })
  .optional();

const campanhaSchema = z.object({
  id: z.string(),
  name: z.string(),
  objective: z.string().default(""),
  effective_status: z.string().default(""),
  adsets: z
    .object({
      data: z.array(z.object({ name: z.string(), ads: nomes })),
    })
    .optional(),
});

const valorSchema = z.object({
  name: z.string(),
  total_value: z.object({ value: num }).optional(),
  values: z.array(z.object({ value: num })).optional(),
});

const midiaSchema = z.object({
  id: z.string(),
  media_type: z.string().default(""),
  media_product_type: z.string().default(""),
  timestamp: z.string(),
  permalink: z.string().default(""),
  caption: z.string().default(""),
  like_count: num,
  comments_count: num,
  insights: z.object({ data: z.array(valorSchema) }).optional(),
});

const demografiaSchema = z.object({
  data: z.array(
    z.object({
      total_value: z.object({
        breakdowns: z
          .array(
            z.object({
              results: z
                .array(
                  z.object({
                    dimension_values: z.array(z.string()),
                    value: num,
                  }),
                )
                .default([]),
            }),
          )
          .default([]),
      }),
    }),
  ),
});

/** Métricas diárias do Instagram (metric_type=total_value). */
export interface InstagramMetricasDia {
  reach: number;
  views: number;
  accounts_engaged: number;
  total_interactions: number;
  profile_links_taps: number;
}
const METRICAS_DIA: (keyof InstagramMetricasDia)[] = [
  "reach",
  "views",
  "accounts_engaged",
  "total_interactions",
  "profile_links_taps",
];

/** "Rio de Janeiro (state)" → "Rio de Janeiro". */
const semEstado = (s: string) => s.replace(/\s*\(state\)/g, "");

/** 00h do dia em Brasília (UTC−3), em segundos: o since/until do Instagram. */
const inicioDoDia = (dia: string) =>
  Math.floor(Date.parse(`${dia}T03:00:00Z`) / 1000);

const valorDe = (v: z.infer<typeof valorSchema>) =>
  v.total_value?.value ?? v.values?.[0]?.value ?? 0;

export function createMetaClient(config: MetaConfig) {
  const { sistema } = config;
  const ler = (
    caminho: string,
    query: Record<string, string | number | undefined>,
  ) =>
    requestJson(sistema, `${API_URL}/${caminho}`, {
      headers: { Authorization: `Bearer ${config.token}` },
      query,
      retries: 1,
      fetch: config.fetch,
    });

  /** Todas as páginas, pelo cursor after. `parar` encerra antes do fim. */
  async function todas<T extends z.ZodType>(
    caminho: string,
    query: Record<string, string | number | undefined>,
    item: T,
    parar: (lote: z.infer<T>[]) => boolean = () => false,
  ): Promise<z.infer<T>[]> {
    const out: z.infer<T>[] = [];
    let after: string | undefined;
    for (;;) {
      const r = parseWith(
        sistema,
        paginado(item),
        await ler(caminho, { ...query, after }),
      );
      out.push(...r.data);
      after = r.paging?.cursors?.after;
      if (!r.paging?.next || !after || parar(r.data)) return out;
    }
  }

  const periodo = (de: string, ate: string) =>
    JSON.stringify({ since: de, until: ate });

  return {
    async contaDeAnuncios(adAccountId: string) {
      const r = await ler(`act_${adAccountId}`, {
        fields: "name,account_status,currency",
      });
      return parseWith(sistema, contaSchema, r);
    },
    async pagina(pageId: string) {
      return parseWith(
        sistema,
        paginaSchema,
        await ler(pageId, { fields: "name,followers_count" }),
      );
    },
    async instagram(instagramId: string) {
      return parseWith(
        sistema,
        instagramSchema,
        await ler(instagramId, {
          fields: "username,followers_count,media_count",
        }),
      );
    },

    /** Métricas por campanha e dia (level=campaign, time_increment=1). */
    async insights(
      adAccountId: string,
      de: string,
      ate: string,
    ): Promise<MetaInsight[]> {
      return todas(
        `act_${adAccountId}/insights`,
        {
          level: "campaign",
          time_increment: 1,
          time_range: periodo(de, ate),
          fields:
            "campaign_id,spend,impressions,reach,frequency,clicks,inline_link_clicks,ctr,cpc,cpm,actions,cost_per_action_type",
          limit: POR_PAGINA,
        },
        insightSchema,
      );
    },

    /** Investimento por campanha e dia, quebrado por plataforma ou estado. */
    async quebras(
      adAccountId: string,
      de: string,
      ate: string,
      por: "publisher_platform" | "region",
    ): Promise<MetaQuebra[]> {
      const linhas = await todas(
        `act_${adAccountId}/insights`,
        {
          level: "campaign",
          time_increment: 1,
          time_range: periodo(de, ate),
          breakdowns: por,
          fields: "campaign_id,spend,impressions,inline_link_clicks",
          limit: POR_PAGINA,
        },
        quebraSchema,
      );
      return linhas.map((l) => ({
        ...l,
        ...(l.region !== undefined ? { region: semEstado(l.region) } : {}),
      }));
    },

    /** Campanhas pelo id, com conjuntos e anúncios (só os nomes). */
    async campanhas(
      adAccountId: string,
      ids: string[],
    ): Promise<MetaCampanha[]> {
      const out: MetaCampanha[] = [];
      for (let i = 0; i < ids.length; i += 50) {
        const lote = await todas(
          `act_${adAccountId}/campaigns`,
          {
            fields:
              "id,name,objective,effective_status,adsets.limit(50){name,ads.limit(50){name}}",
            filtering: JSON.stringify([
              { field: "id", operator: "IN", value: ids.slice(i, i + 50) },
            ]),
            limit: 50,
          },
          campanhaSchema,
        );
        for (const c of lote)
          out.push({
            campaign_id: c.id,
            campaign_name: c.name,
            objective: c.objective,
            effective_status: c.effective_status,
            conjuntos: (c.adsets?.data ?? []).map((a) => ({
              adset_name: a.name,
              anuncios: (a.ads?.data ?? []).map((x) => ({ ad_name: x.name })),
            })),
          });
      }
      return out;
    },

    /** Alcance, visualizações e interações do Instagram num dia (Brasília). */
    async instagramDia(
      instagramId: string,
      dia: string,
    ): Promise<InstagramMetricasDia> {
      const r = parseWith(
        sistema,
        z.object({ data: z.array(valorSchema) }),
        await ler(`${instagramId}/insights`, {
          metric: METRICAS_DIA.join(","),
          period: "day",
          metric_type: "total_value",
          since: inicioDoDia(dia),
          until: inicioDoDia(dia) + 86_400,
        }),
      );
      const por = new Map(r.data.map((v) => [v.name, valorDe(v)]));
      return Object.fromEntries(
        METRICAS_DIA.map((m) => [m, por.get(m) ?? 0]),
      ) as unknown as InstagramMetricasDia;
    },

    /** Posts publicados a partir de `desde` (aaaa-mm-dd), com as métricas. */
    async instagramPosts(
      instagramId: string,
      desde: string,
    ): Promise<InstagramPost[]> {
      const antes = (m: { timestamp: string }) =>
        m.timestamp.slice(0, 10) < desde;
      const midias = await todas(
        `${instagramId}/media`,
        {
          fields:
            "id,media_type,media_product_type,timestamp,permalink,caption,like_count,comments_count,insights.metric(reach,saved,shares,views)",
          limit: 50,
        },
        midiaSchema,
        (lote) => lote.some(antes),
      );
      return midias
        .filter((m) => !antes(m))
        .map((m) => {
          const ins = new Map(
            (m.insights?.data ?? []).map((v) => [v.name, valorDe(v)]),
          );
          return {
            id: m.id,
            media_type: m.media_type,
            media_product_type: m.media_product_type,
            timestamp: m.timestamp,
            permalink: m.permalink,
            caption: m.caption,
            like_count: m.like_count,
            comments_count: m.comments_count,
            saved: ins.get("saved") ?? 0,
            shares: ins.get("shares") ?? 0,
            reach: ins.get("reach") ?? 0,
            views: ins.get("views") ?? 0,
          };
        });
    },

    /** Seguidores por cidade e por faixa de idade (follower_demographics). */
    async instagramDemografia(
      instagramId: string,
    ): Promise<InstagramDemografia[]> {
      const out: InstagramDemografia[] = [];
      for (const breakdown of ["city", "age"] as const) {
        const r = parseWith(
          sistema,
          demografiaSchema,
          await ler(`${instagramId}/insights`, {
            metric: "follower_demographics",
            period: "lifetime",
            metric_type: "total_value",
            breakdown,
          }),
        );
        for (const d of r.data)
          for (const b of d.total_value.breakdowns)
            for (const x of b.results)
              out.push({
                breakdown,
                dimension_value: semEstado(x.dimension_values[0] ?? ""),
                value: x.value,
              });
      }
      return out;
    },
  };
}
