import type {
  GoogleLinha,
  GoogleTermo,
  MetaCampanha,
  MetaInsight,
  MetaQuebra,
  RdConversao,
  TikTokCampanha,
  TikTokLinha,
} from "./fontes";
import { dentro, type PeriodoMkt } from "./periodo";

// Performance de anúncios (spec 4.5): uma linha por campanha das três
// plataformas, com o custo por lead sempre pelos leads que chegaram no RD
// Station. "Conversões da plataforma" e "Leads no RD" ficam separados e nunca
// se somam. Lead sem campanha identificada não entra em campanha nenhuma.

export type Plataforma = "meta" | "google" | "tiktok";

export const PLATAFORMAS: Record<
  Plataforma,
  { rotulo: string; cor: 1 | 2 | 3; ferramenta: string }
> = {
  meta: { rotulo: "Meta", cor: 1, ferramenta: "Meta Ads" },
  google: { rotulo: "Google", cor: 2, ferramenta: "Google Ads" },
  tiktok: { rotulo: "TikTok", cor: 3, ferramenta: "TikTok Ads" },
};

const TIPOS: Record<string, string> = {
  OUTCOME_LEADS: "Leads",
  OUTCOME_TRAFFIC: "Tráfego",
  OUTCOME_AWARENESS: "Reconhecimento",
  OUTCOME_ENGAGEMENT: "Engajamento",
  SEARCH: "Pesquisa",
  PERFORMANCE_MAX: "Performance Max",
  VIDEO: "YouTube (vídeo)",
  DISPLAY: "Display",
  LEAD_GENERATION: "Geração de leads",
  TRAFFIC: "Tráfego",
  REACH: "Alcance",
  VIDEO_VIEWS: "Visualizações",
};
export const rotuloTipo = (t: string) => TIPOS[t] ?? t;

const SITUACOES: Record<string, string> = {
  ACTIVE: "Ativa",
  ENABLED: "Ativa",
  PAUSED: "Pausada",
  CAMPAIGN_PAUSED: "Pausada",
  ARCHIVED: "Arquivada",
  REMOVED: "Removida",
};
export const rotuloSituacao = (s: string | null) =>
  s ? (SITUACOES[s] ?? s) : null;

/** Subtipo do Google na coluna Plataforma (Pesquisa, Performance Max…). */
const GOOGLE_SUB: Record<string, string> = {
  SEARCH: "Pesquisa",
  PERFORMANCE_MAX: "Performance Max",
  VIDEO: "YouTube",
  DISPLAY: "Display",
};

export interface CampanhaLinha {
  id: string;
  plataforma: Plataforma;
  /** "Meta (Facebook/Instagram)", "Google Pesquisa", "TikTok". */
  rotuloPlataforma: string;
  nome: string;
  /** Código da plataforma (objective, advertising_channel_type, objective_type). */
  tipo: string;
  /** Código (effective_status / campaign.status); TikTok: null (não está nos campos usados). */
  situacao: string | null;
  investimento: number;
  impressoes: number;
  /** Google não entrega alcance por campanha: null. */
  alcance: number | null;
  cliques: number;
  ctr: number | null;
  cpc: number | null;
  conversoesPlataforma: number;
  leadsRd: number;
  /** Investimento ÷ leads do RD; null sem lead. */
  custoPorLead: number | null;
  /** Google (YouTube) e TikTok; Meta em branco. */
  visualizacoes: number | null;
  /** Meta: impressões ÷ alcance (cansaço do criativo). */
  frequencia: number | null;
}

/** Investimento ÷ leads do RD. Sem lead, não há custo por lead. */
export function custoPorLead(
  investimento: number,
  leadsRd: number,
): number | null {
  return leadsRd > 0 ? investimento / leadsRd : null;
}

export interface FontesAnuncios {
  meta: {
    campanhas: MetaCampanha[];
    insights: MetaInsight[];
    quebras: MetaQuebra[];
  };
  google: { linhas: GoogleLinha[]; termos: GoogleTermo[] };
  tiktok: { campanhas: TikTokCampanha[]; linhas: TikTokLinha[] };
}

/** Conversões do Meta: ações do tipo lead + conversas iniciadas. */
function conversoesMeta(i: MetaInsight): number {
  return i.actions
    .filter(
      (a) =>
        a.action_type === "lead" ||
        a.action_type === "onsite_conversion.messaging_conversation_started_7d",
    )
    .reduce((t, a) => t + a.value, 0);
}

type Periodo = Pick<PeriodoMkt, "de" | "ate">;

/**
 * Leads do RD no período por campanha (traffic_campaign = nome da campanha).
 * `interesse` limita às landing pages daquele interesse. As conversões que
 * não casam com nenhuma campanha voltam em `semCampanha`.
 */
export function leadsPorCampanha(
  conversoes: RdConversao[],
  nomes: Set<string>,
  periodo: Periodo,
  aceita: (c: RdConversao) => boolean = () => true,
): { porNome: Map<string, number>; semCampanha: number; total: number } {
  const porNome = new Map<string, number>();
  let semCampanha = 0;
  let total = 0;
  for (const c of conversoes) {
    if (!dentro(c.created_at, periodo) || !aceita(c)) continue;
    total++;
    if (c.traffic_campaign && nomes.has(c.traffic_campaign))
      porNome.set(
        c.traffic_campaign,
        (porNome.get(c.traffic_campaign) ?? 0) + 1,
      );
    else semCampanha++;
  }
  return { porNome, semCampanha, total };
}

/** Uma linha por campanha das três plataformas, no período. */
export function linhasDeCampanha(
  f: FontesAnuncios,
  conversoes: RdConversao[],
  periodo: Periodo,
  aceitaLead?: (c: RdConversao) => boolean,
): { linhas: CampanhaLinha[]; semCampanha: number; leadsTotal: number } {
  const linhas = new Map<string, CampanhaLinha>();
  const nova = (
    id: string,
    plataforma: Plataforma,
    rotuloPlataforma: string,
    nome: string,
    tipo: string,
    situacao: string | null,
  ): CampanhaLinha => ({
    id,
    plataforma,
    rotuloPlataforma,
    nome,
    tipo,
    situacao,
    investimento: 0,
    impressoes: 0,
    alcance: plataforma === "google" ? null : 0,
    cliques: 0,
    ctr: null,
    cpc: null,
    conversoesPlataforma: 0,
    leadsRd: 0,
    custoPorLead: null,
    visualizacoes: plataforma === "meta" ? null : 0,
    frequencia: null,
  });

  const metaPorId = new Map(f.meta.campanhas.map((c) => [c.campaign_id, c]));
  for (const i of f.meta.insights) {
    if (!dentro(i.date_start, periodo)) continue;
    const c = metaPorId.get(i.campaign_id);
    if (!c) continue;
    const l =
      linhas.get(i.campaign_id) ??
      nova(
        i.campaign_id,
        "meta",
        "Meta (Facebook/Instagram)",
        c.campaign_name,
        c.objective,
        c.effective_status,
      );
    l.investimento += i.spend;
    l.impressoes += i.impressions;
    // Alcance não se soma de um dia para o outro (a mesma pessoa conta de
    // novo): a soma diária é o teto; a API com o período inteiro dá o exato.
    l.alcance = (l.alcance ?? 0) + i.reach;
    l.cliques += i.inline_link_clicks;
    l.conversoesPlataforma += conversoesMeta(i);
    linhas.set(i.campaign_id, l);
  }
  for (const g of f.google.linhas) {
    if (!dentro(g.segments.date, periodo)) continue;
    const c = g.campaign;
    const l =
      linhas.get(c.id) ??
      nova(
        c.id,
        "google",
        `Google ${GOOGLE_SUB[c.advertising_channel_type] ?? c.advertising_channel_type}`,
        c.name,
        c.advertising_channel_type,
        c.status,
      );
    l.investimento += g.metrics.cost_micros / 1_000_000;
    l.impressoes += g.metrics.impressions;
    l.cliques += g.metrics.clicks;
    l.conversoesPlataforma += g.metrics.conversions;
    l.visualizacoes = (l.visualizacoes ?? 0) + g.metrics.video_views;
    linhas.set(c.id, l);
  }
  const ttPorId = new Map(f.tiktok.campanhas.map((c) => [c.campaign_id, c]));
  for (const t of f.tiktok.linhas) {
    if (!dentro(t.stat_time_day, periodo)) continue;
    const c = ttPorId.get(t.campaign_id);
    if (!c) continue;
    const l =
      linhas.get(t.campaign_id) ??
      nova(
        t.campaign_id,
        "tiktok",
        "TikTok",
        c.campaign_name,
        c.objective_type,
        null,
      );
    l.investimento += t.spend;
    l.impressoes += t.impressions;
    l.alcance = (l.alcance ?? 0) + t.reach;
    l.cliques += t.clicks;
    l.conversoesPlataforma += t.conversion;
    l.visualizacoes = (l.visualizacoes ?? 0) + t.video_play_actions;
    linhas.set(t.campaign_id, l);
  }

  const todas = [...linhas.values()];
  const leads = leadsPorCampanha(
    conversoes,
    new Set(todas.map((l) => l.nome)),
    periodo,
    aceitaLead,
  );
  for (const l of todas) {
    l.leadsRd = leads.porNome.get(l.nome) ?? 0;
    l.custoPorLead = custoPorLead(l.investimento, l.leadsRd);
    l.ctr = l.impressoes > 0 ? (l.cliques / l.impressoes) * 100 : null;
    l.cpc = l.cliques > 0 ? l.investimento / l.cliques : null;
    if (l.plataforma === "meta" && l.alcance)
      l.frequencia = l.impressoes / l.alcance;
    if (l.plataforma === "google" && l.tipo !== "VIDEO") l.visualizacoes = null;
  }
  todas.sort((a, b) => b.investimento - a.investimento);
  return {
    linhas: todas,
    semCampanha: leads.semCampanha,
    leadsTotal: leads.total,
  };
}

export interface Totais {
  investimento: number;
  impressoes: number;
  cliques: number;
  conversoesPlataforma: number;
  leadsRd: number;
  custoPorLead: number | null;
  ctr: number | null;
  cpc: number | null;
}

export function somar(linhas: CampanhaLinha[]): Totais {
  const t = linhas.reduce(
    (a, l) => ({
      investimento: a.investimento + l.investimento,
      impressoes: a.impressoes + l.impressoes,
      cliques: a.cliques + l.cliques,
      conversoesPlataforma: a.conversoesPlataforma + l.conversoesPlataforma,
      leadsRd: a.leadsRd + l.leadsRd,
    }),
    {
      investimento: 0,
      impressoes: 0,
      cliques: 0,
      conversoesPlataforma: 0,
      leadsRd: 0,
    },
  );
  return {
    ...t,
    custoPorLead: custoPorLead(t.investimento, t.leadsRd),
    ctr: t.impressoes ? (t.cliques / t.impressoes) * 100 : null,
    cpc: t.cliques ? t.investimento / t.cliques : null,
  };
}

/** Investimento por dia de uma campanha (detalhe). */
export function diaADia(
  f: FontesAnuncios,
  conversoes: RdConversao[],
  campanha: Pick<CampanhaLinha, "id" | "nome" | "plataforma">,
  periodo: Periodo,
): {
  data: string;
  investimento: number;
  impressoes: number;
  cliques: number;
  conversoesPlataforma: number;
  leadsRd: number;
}[] {
  const dias = new Map<
    string,
    {
      data: string;
      investimento: number;
      impressoes: number;
      cliques: number;
      conversoesPlataforma: number;
      leadsRd: number;
    }
  >();
  const dia = (d: string) => {
    const atual = dias.get(d) ?? {
      data: d,
      investimento: 0,
      impressoes: 0,
      cliques: 0,
      conversoesPlataforma: 0,
      leadsRd: 0,
    };
    dias.set(d, atual);
    return atual;
  };
  if (campanha.plataforma === "meta")
    for (const i of f.meta.insights)
      if (i.campaign_id === campanha.id && dentro(i.date_start, periodo)) {
        const d = dia(i.date_start);
        d.investimento += i.spend;
        d.impressoes += i.impressions;
        d.cliques += i.inline_link_clicks;
        d.conversoesPlataforma += conversoesMeta(i);
      }
  if (campanha.plataforma === "google")
    for (const g of f.google.linhas)
      if (g.campaign.id === campanha.id && dentro(g.segments.date, periodo)) {
        const d = dia(g.segments.date);
        d.investimento += g.metrics.cost_micros / 1_000_000;
        d.impressoes += g.metrics.impressions;
        d.cliques += g.metrics.clicks;
        d.conversoesPlataforma += g.metrics.conversions;
      }
  if (campanha.plataforma === "tiktok")
    for (const t of f.tiktok.linhas)
      if (t.campaign_id === campanha.id && dentro(t.stat_time_day, periodo)) {
        const d = dia(t.stat_time_day);
        d.investimento += t.spend;
        d.impressoes += t.impressions;
        d.cliques += t.clicks;
        d.conversoesPlataforma += t.conversion;
      }
  for (const c of conversoes)
    if (c.traffic_campaign === campanha.nome && dentro(c.created_at, periodo))
      dia(c.created_at.slice(0, 10)).leadsRd++;
  return [...dias.values()].sort((a, b) => a.data.localeCompare(b.data));
}

/** Meta: Facebook × Instagram (publisher_platform) ou por estado (region). */
export function quebraMeta(
  quebras: MetaQuebra[],
  campanhaId: string,
  periodo: Periodo,
  por: "publisher_platform" | "region",
): {
  chave: string;
  investimento: number;
  impressoes: number;
  cliques: number;
}[] {
  const m = new Map<
    string,
    { chave: string; investimento: number; impressoes: number; cliques: number }
  >();
  for (const q of quebras) {
    const chave = q[por];
    if (
      q.campaign_id !== campanhaId ||
      !chave ||
      !dentro(q.date_start, periodo)
    )
      continue;
    const a = m.get(chave) ?? {
      chave,
      investimento: 0,
      impressoes: 0,
      cliques: 0,
    };
    a.investimento += q.spend;
    a.impressoes += q.impressions;
    a.cliques += q.inline_link_clicks;
    m.set(chave, a);
  }
  return [...m.values()].sort((a, b) => b.investimento - a.investimento);
}

/** Google Pesquisa: os `n` termos com mais cliques no período. */
export function termosDePesquisa(
  termos: GoogleTermo[],
  campanhaId: string,
  periodo: Periodo,
  n = 20,
): {
  termo: string;
  impressoes: number;
  cliques: number;
  investimento: number;
}[] {
  const m = new Map<
    string,
    { termo: string; impressoes: number; cliques: number; investimento: number }
  >();
  for (const t of termos) {
    if (t.campaign_id !== campanhaId || !dentro(t.segments.date, periodo))
      continue;
    const termo = t.search_term_view.search_term;
    const a = m.get(termo) ?? {
      termo,
      impressoes: 0,
      cliques: 0,
      investimento: 0,
    };
    a.impressoes += t.metrics.impressions;
    a.cliques += t.metrics.clicks;
    a.investimento += t.metrics.cost_micros / 1_000_000;
    m.set(termo, a);
  }
  return [...m.values()].sort((a, b) => b.cliques - a.cliques).slice(0, n);
}

/** Link "Abrir na plataforma" (só consulta: o ajuste é feito lá). */
export function linkNaPlataforma(
  l: Pick<CampanhaLinha, "id" | "plataforma">,
): string {
  switch (l.plataforma) {
    case "meta":
      return `https://adsmanager.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=${l.id}`;
    case "google":
      return `https://ads.google.com/aw/campaigns?campaignId=${l.id}`;
    case "tiktok":
      return `https://ads.tiktok.com/i18n/perf/campaign?keyword=${l.id}`;
  }
}
