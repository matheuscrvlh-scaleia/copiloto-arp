import { describe, expect, it } from "vitest";
import {
  custoPorLead,
  type FontesAnuncios,
  linhasDeCampanha,
  somar,
} from "./anuncios";
import type { RdConversao } from "./fontes";

// Plano de testes do spec (seção 8): custo por lead pelos leads do RD, as
// conversões da plataforma só na coluna delas e lead sem campanha fora das
// campanhas.

const P = { de: "2026-10-19", ate: "2026-10-25" };

function conversao(campanha: string, n: number): RdConversao {
  return {
    event_uuid: `e${campanha}${n}`,
    contact_uuid: `c${n}`,
    conversion_identifier: "lp-lojas-disponiveis",
    created_at: "2026-10-20T10:00:00-03:00",
    traffic_source: "facebook",
    traffic_medium: "paid_social",
    traffic_campaign: campanha,
  };
}

const fontes: FontesAnuncios = {
  meta: {
    campanhas: [
      {
        campaign_id: "1",
        campaign_name: "Locação | Lojas",
        objective: "OUTCOME_LEADS",
        effective_status: "ACTIVE",
        conjuntos: [],
      },
    ],
    insights: [
      {
        campaign_id: "1",
        date_start: "2026-10-20",
        spend: 1500,
        impressions: 100_000,
        reach: 60_000,
        frequency: 1.6,
        clicks: 2000,
        inline_link_clicks: 1500,
        ctr: 2,
        cpc: 0.75,
        cpm: 15,
        actions: [{ action_type: "lead", value: 42 }],
        cost_per_action_type: [],
      },
    ],
    quebras: [],
  },
  google: {
    linhas: [
      {
        campaign: {
          id: "9",
          name: "Pesquisa | Eventos",
          advertising_channel_type: "SEARCH",
          status: "ENABLED",
        },
        segments: { date: "2026-10-21" },
        metrics: {
          cost_micros: 300_000_000,
          impressions: 4000,
          clicks: 200,
          ctr: 0.05,
          average_cpc: 1_500_000,
          conversions: 7,
          cost_per_conversion: 0,
          video_views: 0,
        },
      },
    ],
    termos: [],
  },
  tiktok: { campanhas: [], linhas: [] },
};

const conversoes = [
  ...Array.from({ length: 30 }, (_, n) => conversao("Locação | Lojas", n)),
  conversao("", 99),
  conversao("Campanha que não existe", 98),
];

describe("custo por lead", () => {
  it("investimento de 1.500,00 e 30 leads no RD dá 50,00; as 42 conversões ficam na coluna da plataforma", () => {
    const { linhas } = linhasDeCampanha(fontes, conversoes, P);
    const meta = linhas.find((l) => l.id === "1");
    expect(meta?.custoPorLead).toBe(50);
    expect(meta?.leadsRd).toBe(30);
    expect(meta?.conversoesPlataforma).toBe(42);
  });

  it("lead sem campanha identificada não entra em campanha nenhuma", () => {
    const r = linhasDeCampanha(fontes, conversoes, P);
    expect(r.semCampanha).toBe(2);
    expect(r.leadsTotal).toBe(32);
    expect(somar(r.linhas).leadsRd).toBe(30);
  });

  it("sem lead não há custo por lead; Google sem alcance (vazio, não zero)", () => {
    const google = linhasDeCampanha(fontes, conversoes, P).linhas.find(
      (l) => l.id === "9",
    );
    expect(google?.custoPorLead).toBeNull();
    expect(google?.alcance).toBeNull();
    expect(google?.investimento).toBe(300);
    expect(custoPorLead(100, 0)).toBeNull();
  });

  it("ordena pelo maior investimento e nunca soma conversões com leads", () => {
    const r = linhasDeCampanha(fontes, conversoes, P);
    expect(r.linhas.map((l) => l.id)).toEqual(["1", "9"]);
    const t = somar(r.linhas);
    expect(t.conversoesPlataforma).toBe(49);
    expect(t.leadsRd).toBe(30);
    expect(t.custoPorLead).toBe(60);
  });
});
