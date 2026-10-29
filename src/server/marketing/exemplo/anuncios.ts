import type {
  GoogleLinha,
  GoogleTermo,
  MetaCampanha,
  MetaInsight,
  MetaQuebra,
  TikTokCampanha,
  TikTokLinha,
} from "@/lib/marketing/fontes";
import { diaDaSemana, somarDias } from "@/lib/marketing/periodo";
import { arred, sorteio } from "./sorteio";

// Anúncios de exemplo: 12 campanhas (6 Meta, 4 Google com 1 de YouTube, 2
// TikTok), dia a dia nas últimas 18 semanas. Cada campanha tem o custo por
// lead "real" dela, que define quantos leads chegam no RD (rd.ts usa a mesma
// conta). Casos do spec (etapa 1): uma campanha com gasto e sem lead (a de
// alcance dos 108 anos) e uma pausada que ainda gastou no começo da janela.

export const JANELA_DIAS = 126;

export type Plataforma = "meta" | "google" | "tiktok";

export interface CampanhaExemplo {
  id: string;
  plataforma: Plataforma;
  nome: string;
  /** objective (Meta), advertising_channel_type (Google), objective_type (TikTok). */
  tipo: string;
  /** effective_status / campaign.status; TikTok não entra nos campos usados. */
  situacao: string | null;
  /** Gasto médio por dia, em reais. */
  verba: number;
  /** Custo por lead que a campanha "entrega" (null: não gera lead). */
  cpl: number | null;
  /** Conversões da plataforma ÷ leads do RD (a plataforma conta do jeito dela). */
  inflacao: number;
  /** Landing pages para onde a campanha manda, com peso. */
  destinos: (readonly [string, number])[];
  /** Pausada a partir deste dia (sem gasto depois). */
  pausadaEm?: number;
}

const CAMPANHAS: CampanhaExemplo[] = [
  {
    id: "120210001",
    plataforma: "meta",
    nome: "Locação | Lojas disponíveis | Leads",
    tipo: "OUTCOME_LEADS",
    situacao: "ACTIVE",
    verba: 38,
    cpl: 38,
    inflacao: 1.45,
    destinos: [["lp-lojas-disponiveis", 1]],
  },
  {
    id: "120210002",
    plataforma: "meta",
    nome: "Eventos | Casamentos e festas | Leads",
    tipo: "OUTCOME_LEADS",
    situacao: "ACTIVE",
    verba: 48,
    cpl: 29,
    inflacao: 1.35,
    destinos: [["lp-casamentos-e-festas", 1]],
  },
  {
    id: "120210003",
    plataforma: "meta",
    nome: "Eventos | Corporativo | Conversas",
    tipo: "OUTCOME_ENGAGEMENT",
    situacao: "ACTIVE",
    verba: 28,
    cpl: 52,
    inflacao: 2.1,
    destinos: [["lp-eventos-corporativos", 1]],
  },
  {
    id: "120210004",
    plataforma: "meta",
    nome: "Coworking | Salas | Tráfego",
    tipo: "OUTCOME_TRAFFIC",
    situacao: "ACTIVE",
    verba: 18,
    cpl: 64,
    inflacao: 0.6,
    destinos: [["lp-espacos-coworking", 1]],
  },
  {
    id: "120210005",
    plataforma: "meta",
    nome: "Marca | 108 anos | Alcance",
    tipo: "OUTCOME_AWARENESS",
    situacao: "ACTIVE",
    verba: 22,
    cpl: null,
    inflacao: 0,
    destinos: [],
  },
  {
    id: "120210006",
    plataforma: "meta",
    nome: "Agenda | Fim de semana | Tráfego",
    tipo: "OUTCOME_TRAFFIC",
    situacao: "PAUSED",
    verba: 16,
    cpl: 70,
    inflacao: 0.8,
    destinos: [["lp-newsletter-agenda", 1]],
    pausadaEm: 60,
  },
  {
    id: "2104401",
    plataforma: "google",
    nome: "Pesquisa | Aluguel de loja Nova Friburgo",
    tipo: "SEARCH",
    situacao: "ENABLED",
    verba: 34,
    cpl: 44,
    inflacao: 1.2,
    destinos: [
      ["lp-lojas-disponiveis", 4],
      ["lp-espacos-coworking", 1],
    ],
  },
  {
    id: "2104402",
    plataforma: "google",
    nome: "Pesquisa | Espaço para eventos",
    tipo: "SEARCH",
    situacao: "ENABLED",
    verba: 44,
    cpl: 36,
    inflacao: 1.25,
    destinos: [
      ["lp-casamentos-e-festas", 3],
      ["lp-eventos-corporativos", 2],
    ],
  },
  {
    id: "2104403",
    plataforma: "google",
    nome: "PMax | Espaço ARP",
    tipo: "PERFORMANCE_MAX",
    situacao: "ENABLED",
    verba: 30,
    cpl: 48,
    inflacao: 1.7,
    destinos: [
      ["lp-casamentos-e-festas", 2],
      ["lp-lojas-disponiveis", 2],
      ["lp-newsletter-agenda", 1],
    ],
  },
  {
    id: "2104404",
    plataforma: "google",
    nome: "YouTube | Institucional 108 anos",
    tipo: "VIDEO",
    situacao: "ENABLED",
    verba: 16,
    cpl: 160,
    inflacao: 1.1,
    destinos: [["lp-newsletter-agenda", 1]],
  },
  {
    id: "1789001",
    plataforma: "tiktok",
    nome: "TikTok | Agenda cultural",
    tipo: "TRAFFIC",
    situacao: null,
    verba: 14,
    cpl: 75,
    inflacao: 0.9,
    destinos: [
      ["lp-newsletter-agenda", 2],
      ["lp-feira-de-natal", 1],
    ],
  },
  {
    id: "1789002",
    plataforma: "tiktok",
    nome: "TikTok | Festas e eventos | Leads",
    tipo: "LEAD_GENERATION",
    situacao: null,
    verba: 20,
    cpl: 33,
    inflacao: 1.5,
    destinos: [["lp-casamentos-e-festas", 1]],
  },
];

export function campanhasDeExemplo(): CampanhaExemplo[] {
  return CAMPANHAS;
}

const TERMOS = {
  "2104401": [
    "aluguel de loja nova friburgo",
    "loja para alugar centro nova friburgo",
    "ponto comercial nova friburgo",
    "sala comercial nova friburgo",
    "aluguel loja shopping friburgo",
    "espaço arp lojas",
    "quiosque para alugar nova friburgo",
    "loja rua do relógio",
    "aluguel de sala para consultório friburgo",
    "imóvel comercial região serrana",
    "galpão para alugar nova friburgo",
    "coworking nova friburgo",
  ],
  "2104402": [
    "espaço para eventos nova friburgo",
    "salão de festas nova friburgo",
    "local para casamento região serrana",
    "espaço para casamento nova friburgo",
    "espaço para festa de 15 anos friburgo",
    "local para evento corporativo serra rj",
    "espaço arp eventos",
    "aluguel de espaço para aniversário",
    "casamento ao ar livre nova friburgo",
    "espaço para formatura nova friburgo",
    "buffet e espaço de festas friburgo",
    "local para palestra nova friburgo",
    "espaço para feira nova friburgo",
  ],
} as const;

const ESTADOS = [
  ["Rio de Janeiro", 82],
  ["Minas Gerais", 9],
  ["São Paulo", 5],
  ["Espírito Santo", 4],
] as const;

export interface DadosAnuncios {
  campanhas: CampanhaExemplo[];
  meta: {
    campanhas: MetaCampanha[];
    insights: MetaInsight[];
    quebras: MetaQuebra[];
  };
  google: { linhas: GoogleLinha[]; termos: GoogleTermo[] };
  tiktok: { campanhas: TikTokCampanha[]; linhas: TikTokLinha[] };
  /** Leads que cada campanha mandou ao RD por dia: id → data → quantidade. */
  leadsNoRd: Map<string, Map<string, number>>;
}

/** Fator do dia: fim de semana e dezembro rendem mais. */
function fatorDoDia(data: string): number {
  const d = diaDaSemana(data);
  const fds = d === 0 || d === 6 ? 1.18 : d === 5 ? 1.08 : 1;
  return fds * (data.slice(5, 7) === "12" ? 1.15 : 1);
}

/** Anúncios e leads pagos das últimas JANELA_DIAS até ontem. */
export function gerarAnuncios(hoje: string): DadosAnuncios {
  const dias = Array.from({ length: JANELA_DIAS }, (_, i) =>
    somarDias(hoje, i - JANELA_DIAS),
  );
  const out: DadosAnuncios = {
    campanhas: CAMPANHAS,
    meta: { campanhas: [], insights: [], quebras: [] },
    google: { linhas: [], termos: [] },
    tiktok: { campanhas: [], linhas: [] },
    leadsNoRd: new Map(),
  };

  for (const c of CAMPANHAS) {
    const leads = new Map<string, number>();
    out.leadsNoRd.set(c.id, leads);
    if (c.plataforma === "meta")
      out.meta.campanhas.push({
        campaign_id: c.id,
        campaign_name: c.nome,
        objective: c.tipo,
        effective_status: c.situacao ?? "ACTIVE",
        conjuntos: [
          {
            adset_name: `${c.nome.split(" | ")[1]} | Público amplo RJ`,
            anuncios: [{ ad_name: "Vídeo 15s" }, { ad_name: "Carrossel" }],
          },
          {
            adset_name: `${c.nome.split(" | ")[1]} | Remarketing site`,
            anuncios: [{ ad_name: "Imagem única" }],
          },
        ],
      });
    if (c.plataforma === "tiktok")
      out.tiktok.campanhas.push({
        campaign_id: c.id,
        campaign_name: c.nome,
        objective_type: c.tipo,
      });

    dias.forEach((data, i) => {
      // Pausada: sem gasto a partir do dia da pausa (contado do fim).
      if (c.pausadaEm !== undefined && i >= JANELA_DIAS - c.pausadaEm) return;
      const s = sorteio(`anuncio:${c.id}:${data}`);
      const spend = arred(s.perto(c.verba * fatorDoDia(data), 0.28));
      const cpm =
        c.plataforma === "google"
          ? c.tipo === "SEARCH"
            ? s.perto(62, 0.2)
            : s.perto(14, 0.25)
          : c.plataforma === "tiktok"
            ? s.perto(9, 0.25)
            : s.perto(c.tipo === "OUTCOME_AWARENESS" ? 7 : 16, 0.2);
      const impressions = Math.round((spend / cpm) * 1000);
      const ctrBase =
        c.tipo === "SEARCH"
          ? 0.072
          : c.tipo === "OUTCOME_AWARENESS"
            ? 0.004
            : 0.014;
      const clicks = Math.max(
        1,
        Math.round(impressions * s.perto(ctrBase, 0.3)),
      );
      const rd = c.cpl === null ? 0 : s.contagem(spend / c.cpl);
      if (rd > 0) leads.set(data, rd);
      const conversoes =
        c.cpl === null
          ? 0
          : Math.round(rd * c.inflacao + (s.chance(0.3) ? 1 : 0));

      if (c.plataforma === "meta") {
        const frequency = arred(s.perto(1.25, 0.12));
        const reach = Math.round(impressions / frequency);
        const link = Math.round(clicks * s.perto(0.72, 0.1));
        const conversas = c.tipo === "OUTCOME_ENGAGEMENT" ? conversoes : 0;
        const leadsMeta = c.tipo === "OUTCOME_ENGAGEMENT" ? 0 : conversoes;
        const lpv = Math.round(link * s.perto(0.78, 0.1));
        const actions = [
          { action_type: "landing_page_view", value: lpv },
          ...(leadsMeta ? [{ action_type: "lead", value: leadsMeta }] : []),
          ...(conversas
            ? [
                {
                  action_type:
                    "onsite_conversion.messaging_conversation_started_7d",
                  value: conversas,
                },
              ]
            : []),
        ];
        out.meta.insights.push({
          campaign_id: c.id,
          date_start: data,
          spend,
          impressions,
          reach,
          frequency,
          clicks,
          inline_link_clicks: link,
          ctr: arred((clicks / impressions) * 100, 4),
          cpc: arred(spend / clicks, 4),
          cpm: arred((spend / impressions) * 1000, 4),
          actions,
          cost_per_action_type: actions
            .filter((a) => a.value > 0)
            .map((a) => ({
              action_type: a.action_type,
              value: arred(spend / a.value),
            })),
        });
        // Facebook × Instagram e estado.
        const ig = s.perto(c.tipo === "OUTCOME_AWARENESS" ? 0.55 : 0.68, 0.08);
        for (const [plat, parte] of [
          ["instagram", ig],
          ["facebook", 1 - ig],
        ] as const) {
          out.meta.quebras.push({
            campaign_id: c.id,
            date_start: data,
            publisher_platform: plat,
            spend: arred(spend * parte),
            impressions: Math.round(impressions * parte),
            inline_link_clicks: Math.round(link * parte),
          });
        }
        let resto = 1;
        ESTADOS.forEach(([estado, peso], k) => {
          const parte =
            k === ESTADOS.length - 1
              ? resto
              : Math.min(resto, s.perto(peso / 100, 0.2));
          resto -= parte;
          out.meta.quebras.push({
            campaign_id: c.id,
            date_start: data,
            region: estado,
            spend: arred(spend * parte),
            impressions: Math.round(impressions * parte),
            inline_link_clicks: Math.round(link * parte),
          });
        });
      } else if (c.plataforma === "google") {
        const video =
          c.tipo === "VIDEO"
            ? Math.round(impressions * s.perto(0.31, 0.15))
            : 0;
        out.google.linhas.push({
          campaign: {
            id: c.id,
            name: c.nome,
            advertising_channel_type: c.tipo,
            status: c.situacao ?? "ENABLED",
          },
          segments: { date: data },
          metrics: {
            cost_micros: Math.round(spend * 1_000_000),
            impressions,
            clicks,
            ctr: clicks / impressions,
            average_cpc: Math.round((spend / clicks) * 1_000_000),
            conversions: conversoes,
            cost_per_conversion: conversoes
              ? Math.round((spend / conversoes) * 1_000_000)
              : 0,
            video_views: video,
          },
        });
        const termos = TERMOS[c.id as keyof typeof TERMOS];
        if (termos) {
          // Os primeiros termos levam a maior parte (cauda longa).
          const pesos = termos.map((_, k) => 1 / (k + 1.4));
          const soma = pesos.reduce((a, b) => a + b, 0);
          termos.forEach((termo, k) => {
            const parte = ((pesos[k] as number) / soma) * s.perto(1, 0.35);
            const cl = Math.round(clicks * parte);
            if (cl === 0 && s.chance(0.6)) return;
            out.google.termos.push({
              campaign_id: c.id,
              segments: { date: data },
              search_term_view: { search_term: termo },
              metrics: {
                impressions: Math.round(impressions * parte * s.perto(1, 0.3)),
                clicks: cl,
                cost_micros: Math.round(spend * parte * 1_000_000),
              },
            });
          });
        }
      } else {
        const reach = Math.round(impressions / s.perto(1.18, 0.1));
        const plays = Math.round(impressions * s.perto(0.42, 0.15));
        out.tiktok.linhas.push({
          campaign_id: c.id,
          stat_time_day: data,
          spend,
          impressions,
          reach,
          clicks,
          ctr: arred((clicks / impressions) * 100, 4),
          cpc: arred(spend / clicks, 4),
          cpm: arred((spend / impressions) * 1000, 4),
          conversion: conversoes,
          cost_per_conversion: conversoes ? arred(spend / conversoes) : 0,
          video_play_actions: plays,
          video_views_p100: Math.round(plays * s.perto(0.12, 0.25)),
        });
      }
    });
  }
  return out;
}
