import type { BuscaLinha, Ga4Linha } from "@/lib/marketing/fontes";
import { diaDaSemana, somarDias } from "@/lib/marketing/periodo";
import { type DadosAnuncios, JANELA_DIAS } from "./anuncios";
import { arred, sorteio } from "./sorteio";

// Site de exemplo: GA4 por dia × canal × origem/mídia × campanha ×
// dispositivo, e Search Console por dia × busca. O tráfego pago acompanha os
// cliques dos anúncios do mesmo dia.

const ORGANICOS: {
  canal: string;
  origem: string;
  campanha: string;
  base: number;
  engajamento: number;
  duracao: number;
}[] = [
  {
    canal: "Organic Search",
    origem: "google / organic",
    campanha: "(organic)",
    base: 150,
    engajamento: 0.68,
    duracao: 128,
  },
  {
    canal: "Organic Search",
    origem: "bing / organic",
    campanha: "(organic)",
    base: 9,
    engajamento: 0.64,
    duracao: 110,
  },
  {
    canal: "Direct",
    origem: "(direct) / (none)",
    campanha: "(direct)",
    base: 92,
    engajamento: 0.58,
    duracao: 96,
  },
  {
    canal: "Organic Social",
    origem: "instagram / social",
    campanha: "(referral)",
    base: 46,
    engajamento: 0.49,
    duracao: 61,
  },
  {
    canal: "Organic Social",
    origem: "facebook / social",
    campanha: "(referral)",
    base: 14,
    engajamento: 0.44,
    duracao: 55,
  },
  {
    canal: "Referral",
    origem: "parceiro.exemplo / referral",
    campanha: "(referral)",
    base: 21,
    engajamento: 0.62,
    duracao: 104,
  },
  {
    canal: "Email",
    origem: "rd_email / email",
    campanha: "agenda-semanal",
    base: 12,
    engajamento: 0.71,
    duracao: 140,
  },
];

const DISPOSITIVOS = [
  ["mobile", 0.72],
  ["desktop", 0.25],
  ["tablet", 0.03],
] as const;

const BUSCAS: {
  query: string;
  page: string;
  impressoes: number;
  posicao: number;
  ctr: number;
}[] = [
  { query: "espaço arp", page: "/", impressoes: 160, posicao: 1.1, ctr: 0.46 },
  {
    query: "arp nova friburgo",
    page: "/",
    impressoes: 120,
    posicao: 1.3,
    ctr: 0.41,
  },
  {
    query: "fábrica de rendas arp",
    page: "/historia",
    impressoes: 38,
    posicao: 1.6,
    ctr: 0.33,
  },
  {
    query: "rua do relógio nova friburgo",
    page: "/",
    impressoes: 44,
    posicao: 2.4,
    ctr: 0.22,
  },
  {
    query: "espaço arp eventos",
    page: "/eventos",
    impressoes: 30,
    posicao: 1.4,
    ctr: 0.38,
  },
  {
    query: "eventos nova friburgo fim de semana",
    page: "/agenda",
    impressoes: 210,
    posicao: 5.8,
    ctr: 0.041,
  },
  {
    query: "o que fazer em nova friburgo",
    page: "/agenda",
    impressoes: 380,
    posicao: 8.7,
    ctr: 0.018,
  },
  {
    query: "salão de festas nova friburgo",
    page: "/eventos",
    impressoes: 95,
    posicao: 4.6,
    ctr: 0.052,
  },
  {
    query: "espaço para casamento nova friburgo",
    page: "/eventos",
    impressoes: 70,
    posicao: 6.2,
    ctr: 0.047,
  },
  {
    query: "local para evento corporativo serra rj",
    page: "/eventos",
    impressoes: 26,
    posicao: 9.4,
    ctr: 0.021,
  },
  {
    query: "aluguel de loja nova friburgo",
    page: "/lojas",
    impressoes: 64,
    posicao: 5.1,
    ctr: 0.058,
  },
  {
    query: "loja para alugar centro nova friburgo",
    page: "/lojas",
    impressoes: 41,
    posicao: 7.3,
    ctr: 0.032,
  },
  {
    query: "coworking nova friburgo",
    page: "/coworking",
    impressoes: 35,
    posicao: 3.9,
    ctr: 0.09,
  },
  {
    query: "estacionamento centro nova friburgo",
    page: "/como-chegar",
    impressoes: 88,
    posicao: 4.2,
    ctr: 0.064,
  },
  {
    query: "restaurantes nova friburgo",
    page: "/gastronomia",
    impressoes: 290,
    posicao: 11.6,
    ctr: 0.009,
  },
  {
    query: "cervejaria nova friburgo",
    page: "/gastronomia",
    impressoes: 110,
    posicao: 9.9,
    ctr: 0.015,
  },
  {
    query: "pilates nova friburgo",
    page: "/lojas",
    impressoes: 52,
    posicao: 14.2,
    ctr: 0.006,
  },
  {
    query: "feira de natal nova friburgo",
    page: "/agenda",
    impressoes: 75,
    posicao: 6.8,
    ctr: 0.036,
  },
  {
    query: "passeios em nova friburgo com crianças",
    page: "/agenda",
    impressoes: 140,
    posicao: 12.4,
    ctr: 0.007,
  },
  {
    query: "história de nova friburgo fábrica",
    page: "/historia",
    impressoes: 48,
    posicao: 7.9,
    ctr: 0.025,
  },
  {
    query: "espaço para festa infantil friburgo",
    page: "/eventos",
    impressoes: 56,
    posicao: 8.1,
    ctr: 0.022,
  },
  {
    query: "horário espaço arp",
    page: "/como-chegar",
    impressoes: 27,
    posicao: 1.2,
    ctr: 0.52,
  },
  {
    query: "brechó nova friburgo",
    page: "/lojas",
    impressoes: 40,
    posicao: 15.8,
    ctr: 0.004,
  },
  {
    query: "sala comercial nova friburgo",
    page: "/lojas",
    impressoes: 37,
    posicao: 10.3,
    ctr: 0.012,
  },
];

export interface DadosSite {
  ga4: Ga4Linha[];
  buscas: BuscaLinha[];
}

export function gerarSite(hoje: string, anuncios: DadosAnuncios): DadosSite {
  const ga4: Ga4Linha[] = [];
  const buscas: BuscaLinha[] = [];

  // Cliques pagos por dia e campanha.
  const cliques = new Map<string, number>();
  for (const l of anuncios.meta.insights)
    cliques.set(`${l.date_start}|${l.campaign_id}`, l.inline_link_clicks);
  for (const l of anuncios.google.linhas)
    cliques.set(`${l.segments.date}|${l.campaign.id}`, l.metrics.clicks);
  for (const l of anuncios.tiktok.linhas)
    cliques.set(`${l.stat_time_day}|${l.campaign_id}`, l.clicks);

  for (let i = 0; i < JANELA_DIAS; i++) {
    const data = somarDias(hoje, i - JANELA_DIAS);
    const d = diaDaSemana(data);
    const fds = d === 0 || d === 6 ? 1.45 : d === 5 ? 1.15 : 1;
    const s = sorteio(`ga4:${data}`);
    const linhas: Omit<Ga4Linha, "deviceCategory">[] = [];
    for (const o of ORGANICOS) {
      const sessions = Math.round(s.perto(o.base * fds, 0.22));
      linhas.push(
        linha(
          data,
          o.canal,
          o.origem,
          o.campanha,
          sessions,
          o.engajamento,
          o.duracao,
          s,
        ),
      );
    }
    for (const c of anuncios.campanhas) {
      const cl = cliques.get(`${data}|${c.id}`);
      if (!cl) continue;
      const canal =
        c.plataforma === "google"
          ? c.tipo === "SEARCH"
            ? "Paid Search"
            : c.tipo === "VIDEO"
              ? "Paid Video"
              : "Cross-network"
          : "Paid Social";
      const origem =
        c.plataforma === "google"
          ? "google / cpc"
          : c.plataforma === "tiktok"
            ? "tiktok / paid_social"
            : s.chance(0.68)
              ? "instagram / paid_social"
              : "facebook / paid_social";
      const sessions = Math.round(cl * s.perto(0.82, 0.1));
      linhas.push(
        linha(
          data,
          canal,
          origem,
          c.nome,
          sessions,
          canal === "Paid Search" ? 0.63 : 0.41,
          canal === "Paid Search" ? 98 : 38,
          s,
        ),
      );
    }
    for (const l of linhas) {
      for (const [device, parte] of DISPOSITIVOS) {
        const f = (v: number) => Math.round(v * parte);
        ga4.push({
          ...l,
          deviceCategory: device,
          sessions: f(l.sessions),
          totalUsers: f(l.totalUsers),
          newUsers: f(l.newUsers),
          engagedSessions: f(l.engagedSessions),
          screenPageViews: f(l.screenPageViews),
          keyEvents: f(l.keyEvents),
        });
      }
    }

    const sb = sorteio(`gsc:${data}`);
    for (const b of BUSCAS) {
      const impressions = Math.round(
        sb.perto(b.impressoes * (fds > 1 ? 1.2 : 1), 0.3),
      );
      const clicks = Math.round(impressions * sb.perto(b.ctr, 0.25));
      if (impressions === 0) continue;
      buscas.push({
        date: data,
        query: b.query,
        page: b.page,
        clicks,
        impressions,
        ctr: clicks / impressions,
        position: arred(sb.perto(b.posicao, 0.12), 1),
      });
    }
  }
  return { ga4, buscas };
}

function linha(
  data: string,
  canal: string,
  origem: string,
  campanha: string,
  sessions: number,
  engajamento: number,
  duracao: number,
  s: ReturnType<typeof sorteio>,
): Omit<Ga4Linha, "deviceCategory"> {
  const totalUsers = Math.round(sessions * s.perto(0.86, 0.05));
  const engagedSessions = Math.round(sessions * s.perto(engajamento, 0.08));
  return {
    date: data,
    sessionDefaultChannelGroup: canal,
    sessionSourceMedium: origem,
    sessionCampaignName: campanha,
    sessions,
    totalUsers,
    newUsers: Math.round(totalUsers * s.perto(0.71, 0.08)),
    engagedSessions,
    engagementRate: sessions ? engagedSessions / sessions : 0,
    averageSessionDuration: Math.round(s.perto(duracao, 0.15)),
    screenPageViews: Math.round(sessions * s.perto(2.3, 0.15)),
    keyEvents: Math.round(sessions * s.perto(0.045, 0.3)),
  };
}
