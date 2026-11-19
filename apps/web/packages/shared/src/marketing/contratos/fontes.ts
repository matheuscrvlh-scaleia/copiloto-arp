import { z } from "zod";
import type {
  AsanaProjeto,
  AsanaTarefa,
  BuscaLinha,
  FacebookDia,
  Ga4Linha,
  GoogleAvaliacao,
  GoogleLinha,
  GoogleLocal,
  GoogleTermo,
  InstagramDemografia,
  InstagramDia,
  InstagramPost,
  MetaCampanha,
  MetaInsight,
  MetaQuebra,
  RdContato,
  RdConversao,
  RdLandingPageDia,
  TemaDaAvaliacao,
  TikTokCampanha,
  TikTokContaDia,
  TikTokLinha,
  TikTokVideo,
  YoutubeCanal,
  YoutubeDia,
  YoutubeVideo,
} from "../fontes";

// Contrato das fontes do Marketing (dados das ferramentas, nos campos das
// APIs de marketing/fontes.ts). As telas fazem as contas com as regras de
// @arp/shared/marketing/*. Todas exigem acesso ao módulo (alguma permissão
// marketing.*).
//
//   GET /api/v1/marketing/fontes/anuncios     → DadosAnuncios
//   GET /api/v1/marketing/fontes/rd           → DadosRd
//   GET /api/v1/marketing/fontes/rd-anuncios  → DadosRd (leads do custo por lead)
//   GET /api/v1/marketing/fontes/site         → DadosSite
//   GET /api/v1/marketing/fontes/redes        → DadosRedes
//   GET /api/v1/marketing/fontes/asana        → DadosAsana
//   GET /api/v1/marketing/fontes/reputacao    → DadosReputacao

// ---------------------------------------------------------------------------
// Anúncios
// ---------------------------------------------------------------------------

const metaAcao = z.object({ action_type: z.string(), value: z.number() });

export const metaCampanha: z.ZodType<MetaCampanha> = z.object({
  campaign_id: z.string(),
  campaign_name: z.string(),
  objective: z.string(),
  effective_status: z.string(),
  conjuntos: z.array(
    z.object({
      adset_name: z.string(),
      anuncios: z.array(z.object({ ad_name: z.string() })),
    }),
  ),
});

export const metaInsight: z.ZodType<MetaInsight> = z.object({
  campaign_id: z.string(),
  date_start: z.string(),
  spend: z.number(),
  impressions: z.number(),
  reach: z.number(),
  frequency: z.number(),
  clicks: z.number(),
  inline_link_clicks: z.number(),
  ctr: z.number(),
  cpc: z.number(),
  cpm: z.number(),
  actions: z.array(metaAcao),
  cost_per_action_type: z.array(metaAcao),
});

export const metaQuebra: z.ZodType<MetaQuebra> = z.object({
  campaign_id: z.string(),
  date_start: z.string(),
  publisher_platform: z.string().optional(),
  region: z.string().optional(),
  spend: z.number(),
  impressions: z.number(),
  inline_link_clicks: z.number(),
});

export const googleLinha: z.ZodType<GoogleLinha> = z.object({
  campaign: z.object({
    id: z.string(),
    name: z.string(),
    advertising_channel_type: z.string(),
    status: z.string(),
  }),
  segments: z.object({ date: z.string() }),
  metrics: z.object({
    cost_micros: z.number(),
    impressions: z.number(),
    clicks: z.number(),
    ctr: z.number(),
    average_cpc: z.number(),
    conversions: z.number(),
    cost_per_conversion: z.number(),
    video_views: z.number(),
  }),
});

export const googleTermo: z.ZodType<GoogleTermo> = z.object({
  campaign_id: z.string(),
  segments: z.object({ date: z.string() }),
  search_term_view: z.object({ search_term: z.string() }),
  metrics: z.object({
    impressions: z.number(),
    clicks: z.number(),
    cost_micros: z.number(),
  }),
});

export const tiktokCampanha: z.ZodType<TikTokCampanha> = z.object({
  campaign_id: z.string(),
  campaign_name: z.string(),
  objective_type: z.string(),
});

export const tiktokLinha: z.ZodType<TikTokLinha> = z.object({
  campaign_id: z.string(),
  stat_time_day: z.string(),
  spend: z.number(),
  impressions: z.number(),
  reach: z.number(),
  clicks: z.number(),
  ctr: z.number(),
  cpc: z.number(),
  cpm: z.number(),
  conversion: z.number(),
  cost_per_conversion: z.number(),
  video_play_actions: z.number(),
  video_views_p100: z.number(),
});

export const plataforma = z.enum(["meta", "google", "tiktok"]);

/** Uma campanha de qualquer plataforma (detalhe da campanha). */
export const campanhaRef = z.object({
  id: z.string(),
  plataforma,
  nome: z.string(),
  /** objective, advertising_channel_type ou objective_type. */
  tipo: z.string(),
  situacao: z.string().nullable(),
});
export type CampanhaRef = z.infer<typeof campanhaRef>;

export const dadosAnuncios = z.object({
  meta: z.object({
    campanhas: z.array(metaCampanha),
    insights: z.array(metaInsight),
    quebras: z.array(metaQuebra),
  }),
  google: z.object({
    linhas: z.array(googleLinha),
    termos: z.array(googleTermo),
  }),
  tiktok: z.object({
    campanhas: z.array(tiktokCampanha),
    linhas: z.array(tiktokLinha),
  }),
  /** As campanhas das três plataformas (detalhe da campanha). */
  campanhas: z.array(campanhaRef),
  /** A Meta foi lida da API (senão, Meta fica vazia e avisoMeta diz por quê). */
  metaReal: z.boolean(),
  avisoMeta: z.string().optional(),
  /** O Google Ads foi lido da API (senão, fica vazio e avisoGoogle diz por quê). */
  googleReal: z.boolean(),
  avisoGoogle: z.string().optional(),
});
export type DadosAnuncios = z.infer<typeof dadosAnuncios>;

// ---------------------------------------------------------------------------
// RD Station
// ---------------------------------------------------------------------------

export const rdContato: z.ZodType<RdContato> = z.object({
  uuid: z.string(),
  name: z.string(),
  email: z.string(),
  mobile_phone: z.string(),
  city: z.string(),
  state: z.string(),
  tags: z.array(z.string()),
  created_at: z.string(),
  lifecycle_stage: z.string(),
});

export const rdConversao: z.ZodType<RdConversao> = z.object({
  event_uuid: z.string(),
  contact_uuid: z.string(),
  conversion_identifier: z.string(),
  created_at: z.string(),
  traffic_source: z.string(),
  traffic_medium: z.string(),
  traffic_campaign: z.string(),
});

export const rdLandingPageDia: z.ZodType<RdLandingPageDia> = z.object({
  conversion_identifier: z.string(),
  nome: z.string(),
  date: z.string(),
  visits_count: z.number(),
  conversion_count: z.number(),
});

export const dadosRd = z.object({
  /** Só nos dados reais: quando a última sincronização terminou. */
  lidoEm: z.string().optional(),
  contatos: z.array(rdContato),
  conversoes: z.array(rdConversao),
  landingPages: z.array(rdLandingPageDia),
});
export type DadosRd = z.infer<typeof dadosRd>;

// ---------------------------------------------------------------------------
// Site (GA4 e Search Console)
// ---------------------------------------------------------------------------

export const ga4Linha: z.ZodType<Ga4Linha> = z.object({
  date: z.string(),
  sessionDefaultChannelGroup: z.string(),
  sessionSourceMedium: z.string(),
  sessionCampaignName: z.string(),
  deviceCategory: z.string(),
  sessions: z.number(),
  totalUsers: z.number(),
  newUsers: z.number(),
  engagedSessions: z.number(),
  engagementRate: z.number(),
  averageSessionDuration: z.number(),
  screenPageViews: z.number(),
  keyEvents: z.number(),
});

export const buscaLinha: z.ZodType<BuscaLinha> = z.object({
  date: z.string(),
  query: z.string(),
  page: z.string(),
  clicks: z.number(),
  impressions: z.number(),
  ctr: z.number(),
  position: z.number(),
});

export const dadosSite = z.object({
  ga4: z.array(ga4Linha),
  buscas: z.array(buscaLinha),
  /** Por que as buscas não vieram (Search Console sem propriedade ou sem acesso). */
  avisoBuscas: z.string().optional(),
  /** O GA4 foi lido da API (senão, fica vazio e avisoSite diz por quê). */
  siteReal: z.boolean(),
  avisoSite: z.string().optional(),
});
export type DadosSite = z.infer<typeof dadosSite>;

// ---------------------------------------------------------------------------
// Redes
// ---------------------------------------------------------------------------

export const instagramDia: z.ZodType<InstagramDia> = z.object({
  date: z.string(),
  followers_count: z.number().nullable(),
  reach: z.number().nullable(),
  views: z.number().nullable(),
  accounts_engaged: z.number().nullable(),
  total_interactions: z.number().nullable(),
  profile_links_taps: z.number().nullable(),
});

export const instagramPost: z.ZodType<InstagramPost> = z.object({
  id: z.string(),
  media_type: z.string(),
  media_product_type: z.string(),
  timestamp: z.string(),
  permalink: z.string(),
  caption: z.string(),
  like_count: z.number(),
  comments_count: z.number(),
  saved: z.number(),
  shares: z.number(),
  reach: z.number(),
  views: z.number(),
});

export const instagramDemografia: z.ZodType<InstagramDemografia> = z.object({
  breakdown: z.enum(["city", "age", "gender"]),
  dimension_value: z.string(),
  value: z.number(),
});

export const facebookDia: z.ZodType<FacebookDia> = z.object({
  date: z.string(),
  followers_count: z.number(),
});

export const youtubeCanal: z.ZodType<YoutubeCanal> = z.object({
  subscriberCount: z.number(),
  viewCount: z.number(),
  videoCount: z.number(),
});

export const youtubeDia: z.ZodType<YoutubeDia> = z.object({
  day: z.string(),
  views: z.number(),
  estimatedMinutesWatched: z.number(),
  averageViewDuration: z.number(),
  subscribersGained: z.number(),
  subscribersLost: z.number(),
});

export const youtubeVideo: z.ZodType<YoutubeVideo> = z.object({
  id: z.string(),
  title: z.string(),
  publishedAt: z.string(),
  viewCount: z.number(),
  likeCount: z.number(),
  commentCount: z.number(),
});

export const tiktokContaDia: z.ZodType<TikTokContaDia> = z.object({
  date: z.string(),
  followers_count: z.number(),
  profile_views: z.number(),
  video_views: z.number(),
  likes: z.number(),
  comments: z.number(),
  shares: z.number(),
});

export const tiktokVideo: z.ZodType<TikTokVideo> = z.object({
  id: z.string(),
  create_time: z.string(),
  title: z.string(),
  share_url: z.string(),
  view_count: z.number(),
  like_count: z.number(),
});

export const dadosRedes = z.object({
  instagram: z.object({
    dias: z.array(instagramDia),
    posts: z.array(instagramPost),
    demografia: z.array(instagramDemografia),
  }),
  facebook: z.object({ dias: z.array(facebookDia) }),
  youtube: z.object({
    canal: youtubeCanal,
    dias: z.array(youtubeDia),
    videos: z.array(youtubeVideo),
  }),
  tiktok: z.object({
    dias: z.array(tiktokContaDia),
    videos: z.array(tiktokVideo),
  }),
  /** Instagram e Facebook lidos da Meta (senão, vazios e avisoMeta diz por quê). */
  metaReal: z.boolean(),
  avisoMeta: z.string().optional(),
});
export type DadosRedes = z.infer<typeof dadosRedes>;

// ---------------------------------------------------------------------------
// Asana
// ---------------------------------------------------------------------------

export const asanaProjeto: z.ZodType<AsanaProjeto> = z.object({
  gid: z.string(),
  name: z.string(),
  archived: z.boolean(),
});

export const asanaTarefa: z.ZodType<AsanaTarefa> = z.object({
  gid: z.string(),
  name: z.string(),
  projects: z.array(z.object({ gid: z.string(), name: z.string() })),
  memberships: z.array(z.object({ section: z.object({ name: z.string() }) })),
  assignee: z.object({ name: z.string() }).nullable(),
  created_at: z.string(),
  due_on: z.string().nullable(),
  start_on: z.string().nullable(),
  completed: z.boolean(),
  completed_at: z.string().nullable(),
  tags: z.array(z.object({ name: z.string() })),
  custom_fields: z.array(
    z.object({ name: z.string(), display_value: z.string().nullable() }),
  ),
  permalink_url: z.string(),
  notes: z.string().optional(),
});

export const dadosAsana = z.object({
  projetos: z.array(asanaProjeto),
  tarefas: z.array(asanaTarefa),
  /** Quando o Asana foi lido (ISO); null se não foi. */
  lidoEm: z.string().nullable(),
  /** Por que não há dados (sem acesso, desativada, erro); null se leu. */
  aviso: z.string().nullable(),
});
export type DadosAsana = z.infer<typeof dadosAsana>;

// ---------------------------------------------------------------------------
// Reputação (Google Perfil da Empresa; ainda não ligado, vem vazio)
// ---------------------------------------------------------------------------

export const googleLocal: z.ZodType<GoogleLocal> = z.object({
  id: z.string(),
  title: z.string(),
  averageRating: z.number(),
  totalReviewCount: z.number(),
  mapsUri: z.string(),
});

export const googleAvaliacao: z.ZodType<GoogleAvaliacao> = z.object({
  reviewId: z.string(),
  localId: z.string(),
  reviewer: z.object({ displayName: z.string() }),
  starRating: z.enum(["ONE", "TWO", "THREE", "FOUR", "FIVE"]),
  comment: z.string(),
  createTime: z.string(),
  updateTime: z.string(),
  reviewReply: z
    .object({ comment: z.string(), updateTime: z.string() })
    .nullable(),
});

export const temaDaAvaliacao: z.ZodType<TemaDaAvaliacao> = z.object({
  reviewId: z.string(),
  tema: z.string(),
});

export const dadosReputacao = z.object({
  locais: z.array(googleLocal),
  avaliacoes: z.array(googleAvaliacao),
  temas: z.array(temaDaAvaliacao),
});
export type DadosReputacao = z.infer<typeof dadosReputacao>;
