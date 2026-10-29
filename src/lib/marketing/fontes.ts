// Registros de cada ferramenta com os nomes de campo das APIs oficiais (spec
// do Marketing, seção 4.1). O mockup monta dados de exemplo nestes formatos;
// na fase real (V3) cada conector valida a resposta com Zod e devolve estes
// mesmos tipos. Só o que está aqui pode aparecer em tela.
//
// Datas: "aaaa-mm-dd" (dia do relatório) ou ISO com fuso (instantes).
// Valores: número (as APIs mandam texto em alguns casos; o conector converte).

// ---------------------------------------------------------------------------
// Meta Ads (Facebook e Instagram): campanha, conjunto, anúncio e métricas
// diárias. Insights com level=campaign e time_increment=1.
// ---------------------------------------------------------------------------

export interface MetaCampanha {
  campaign_id: string;
  campaign_name: string;
  /** OUTCOME_LEADS, OUTCOME_TRAFFIC, OUTCOME_AWARENESS, OUTCOME_ENGAGEMENT… */
  objective: string;
  /** ACTIVE, PAUSED… */
  effective_status: string;
  conjuntos: { adset_name: string; anuncios: { ad_name: string }[] }[];
}

export interface MetaAcao {
  /** lead, onsite_conversion.messaging_conversation_started_7d, landing_page_view */
  action_type: string;
  value: number;
}

export interface MetaInsight {
  campaign_id: string;
  date_start: string;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  clicks: number;
  inline_link_clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  actions: MetaAcao[];
  cost_per_action_type: MetaAcao[];
}

/** Insight com breakdowns=publisher_platform ou breakdowns=region. */
export interface MetaQuebra {
  campaign_id: string;
  date_start: string;
  /** facebook, instagram (quando a quebra é por plataforma). */
  publisher_platform?: string;
  /** Estado, ex.: "Rio de Janeiro" (quando a quebra é por região). */
  region?: string;
  spend: number;
  impressions: number;
  inline_link_clicks: number;
}

// ---------------------------------------------------------------------------
// Google Ads (inclui YouTube): GAQL, uma linha por campanha e dia.
// ---------------------------------------------------------------------------

export interface GoogleLinha {
  campaign: {
    id: string;
    name: string;
    /** SEARCH, PERFORMANCE_MAX, VIDEO, DISPLAY */
    advertising_channel_type: string;
    /** ENABLED, PAUSED */
    status: string;
  };
  segments: { date: string };
  metrics: {
    cost_micros: number;
    impressions: number;
    clicks: number;
    ctr: number;
    average_cpc: number;
    conversions: number;
    cost_per_conversion: number;
    /** Visualizações de vídeo (campanhas de vídeo). */
    video_views: number;
  };
}

export interface GoogleTermo {
  campaign_id: string;
  segments: { date: string };
  search_term_view: { search_term: string };
  metrics: { impressions: number; clicks: number; cost_micros: number };
}

// ---------------------------------------------------------------------------
// TikTok Ads: relatório integrado por campanha e dia.
// ---------------------------------------------------------------------------

export interface TikTokCampanha {
  campaign_id: string;
  campaign_name: string;
  /** LEAD_GENERATION, TRAFFIC, REACH, VIDEO_VIEWS */
  objective_type: string;
}

export interface TikTokLinha {
  campaign_id: string;
  stat_time_day: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversion: number;
  cost_per_conversion: number;
  video_play_actions: number;
  video_views_p100: number;
}

// ---------------------------------------------------------------------------
// Google Analytics 4 (Data API runReport) e Search Console.
// ---------------------------------------------------------------------------

export interface Ga4Linha {
  date: string;
  /** Organic Search, Paid Social, Direct, Organic Social, Referral, Paid Search… */
  sessionDefaultChannelGroup: string;
  sessionSourceMedium: string;
  sessionCampaignName: string;
  /** mobile, desktop, tablet */
  deviceCategory: string;
  sessions: number;
  totalUsers: number;
  newUsers: number;
  engagedSessions: number;
  engagementRate: number;
  /** Segundos. */
  averageSessionDuration: number;
  screenPageViews: number;
  keyEvents: number;
}

export interface BuscaLinha {
  date: string;
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

// ---------------------------------------------------------------------------
// RD Station Marketing: contato, conversão, funil e landing pages.
// ---------------------------------------------------------------------------

export interface RdContato {
  uuid: string;
  name: string;
  email: string;
  mobile_phone: string;
  city: string;
  state: string;
  tags: string[];
  created_at: string;
  /** Lead, Lead qualificado, Cliente */
  lifecycle_stage: string;
}

export interface RdConversao {
  /** Id do evento (cada conversão é uma linha). */
  event_uuid: string;
  contact_uuid: string;
  /** Landing page (identificador da conversão). */
  conversion_identifier: string;
  /** Data e hora da conversão. */
  created_at: string;
  traffic_source: string;
  traffic_medium: string;
  /** Nome da campanha (UTM). Vazio quando não veio campanha. */
  traffic_campaign: string;
}

/** Estatística diária da landing page (analytics de páginas do RD). */
export interface RdLandingPageDia {
  conversion_identifier: string;
  nome: string;
  date: string;
  visits_count: number;
  conversion_count: number;
}

// ---------------------------------------------------------------------------
// Redes: Instagram e Facebook (Graph API), YouTube (Data e Analytics),
// TikTok (conta Business). Seguidores: uma foto por dia.
// ---------------------------------------------------------------------------

export type Rede = "instagram" | "facebook" | "youtube" | "tiktok";

export interface InstagramDia {
  date: string;
  followers_count: number;
  media_count: number;
  reach: number;
  views: number;
  accounts_engaged: number;
  total_interactions: number;
  profile_links_taps: number;
}

export interface InstagramPost {
  id: string;
  /** IMAGE, VIDEO, CAROUSEL_ALBUM (REELS vem como VIDEO com media_product_type). */
  media_type: string;
  media_product_type: string;
  timestamp: string;
  permalink: string;
  caption: string;
  like_count: number;
  comments_count: number;
  saved: number;
  shares: number;
  reach: number;
  views: number;
}

export interface InstagramDemografia {
  /** follower_demographics com breakdown=city ou age. */
  breakdown: "city" | "age";
  dimension_value: string;
  value: number;
}

export interface FacebookDia {
  date: string;
  followers_count: number;
}

export interface YoutubeCanal {
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
}

export interface YoutubeDia {
  day: string;
  views: number;
  estimatedMinutesWatched: number;
  /** Segundos. */
  averageViewDuration: number;
  subscribersGained: number;
  subscribersLost: number;
}

export interface YoutubeVideo {
  id: string;
  title: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

export interface TikTokContaDia {
  date: string;
  followers_count: number;
  profile_views: number;
  video_views: number;
  likes: number;
  comments: number;
  shares: number;
}

export interface TikTokVideo {
  id: string;
  /** Data de publicação. */
  create_time: string;
  title: string;
  share_url: string;
  /** Visualizações. */
  view_count: number;
  /** Curtidas. */
  like_count: number;
}

// ---------------------------------------------------------------------------
// Google Perfil da Empresa: avaliações por local.
// ---------------------------------------------------------------------------

export type Estrelas = "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE";

export interface GoogleLocal {
  /** locations/…; "arp" para a própria ARP; senão o id do locatário. */
  id: string;
  title: string;
  averageRating: number;
  totalReviewCount: number;
  /** Link do perfil (Abrir no Google). */
  mapsUri: string;
}

export interface GoogleAvaliacao {
  reviewId: string;
  localId: string;
  reviewer: { displayName: string };
  starRating: Estrelas;
  comment: string;
  createTime: string;
  updateTime: string;
  reviewReply: { comment: string; updateTime: string } | null;
}

/**
 * Tema da avaliação: classificação automática numa lista fixa (Parâmetros).
 * Não vem do Google; fica guardada junto da avaliação.
 */
export interface TemaDaAvaliacao {
  reviewId: string;
  tema: string;
}

// ---------------------------------------------------------------------------
// Asana: projeto, seção, tarefa, tag e usuário.
// ---------------------------------------------------------------------------

export interface AsanaProjeto {
  gid: string;
  name: string;
  archived: boolean;
}

export interface AsanaTarefa {
  gid: string;
  name: string;
  projects: { gid: string; name: string }[];
  memberships: { section: { name: string } }[];
  assignee: { name: string } | null;
  created_at: string;
  due_on: string | null;
  start_on: string | null;
  completed: boolean;
  completed_at: string | null;
  tags: { name: string }[];
  custom_fields: { name: string; display_value: string | null }[];
  permalink_url: string;
}

// ---------------------------------------------------------------------------
// Estacionamento (WPS): passagens de veículos. Campos esperados, a confirmar
// com o WPS (sem documentação). A placa só serve para a recorrência e nunca
// sai do servidor.
// ---------------------------------------------------------------------------

export interface Passagem {
  placa: string;
  /** "aaaa-mm-ddTHH:MM" no horário do estacionamento. */
  entrada: string;
  saida: string | null;
  cancela: string;
}
