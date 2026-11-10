import type { TikTokCampanha, TikTokLinha } from "@/lib/marketing/fontes";
import { diaDaSemana, somarDias } from "@/lib/marketing/periodo";
import { arred, sorteio } from "@/lib/sorteio";

// Anúncios de exemplo do TikTok (Meta e Google são reais: server/marketing/
// meta.ts e google.ts): 2 campanhas, dia a dia nas últimas 18 semanas. Cada
// campanha tem o custo por lead "real" dela, que define quantos leads chegam
// no RD de exemplo (rd.ts usa a mesma conta). Sai daqui quando o TikTok for
// ligado.

export const JANELA_DIAS = 126;

export type Plataforma = "tiktok";

export interface CampanhaExemplo {
  id: string;
  plataforma: Plataforma;
  nome: string;
  /** objective_type. */
  tipo: string;
  /** O TikTok não entra nos campos usados. */
  situacao: string | null;
  /** Gasto médio por dia, em reais. */
  verba: number;
  /** Custo por lead que a campanha "entrega" (null: não gera lead). */
  cpl: number | null;
  /** Conversões da plataforma ÷ leads do RD (a plataforma conta do jeito dela). */
  inflacao: number;
  /** Landing pages para onde a campanha manda, com peso. */
  destinos: (readonly [string, number])[];
}

const CAMPANHAS: CampanhaExemplo[] = [
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

export interface DadosAnuncios {
  campanhas: CampanhaExemplo[];
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
    tiktok: { campanhas: [], linhas: [] },
    leadsNoRd: new Map(),
  };

  for (const c of CAMPANHAS) {
    const leads = new Map<string, number>();
    out.leadsNoRd.set(c.id, leads);
    out.tiktok.campanhas.push({
      campaign_id: c.id,
      campaign_name: c.nome,
      objective_type: c.tipo,
    });

    for (const data of dias) {
      const s = sorteio(`anuncio:${c.id}:${data}`);
      const spend = arred(s.perto(c.verba * fatorDoDia(data), 0.28));
      const cpm = s.perto(9, 0.25);
      const impressions = Math.round((spend / cpm) * 1000);
      const clicks = Math.max(1, Math.round(impressions * s.perto(0.014, 0.3)));
      const rd = c.cpl === null ? 0 : s.contagem(spend / c.cpl);
      if (rd > 0) leads.set(data, rd);
      const conversoes =
        c.cpl === null
          ? 0
          : Math.round(rd * c.inflacao + (s.chance(0.3) ? 1 : 0));

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
  }
  return out;
}
