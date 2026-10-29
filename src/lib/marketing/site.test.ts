import { describe, expect, it } from "vitest";
import type { RdContato, RdConversao, RdLandingPageDia } from "./fontes";
import {
  buscasDoPeriodo,
  canalDoLead,
  colunasLeads,
  contarLeads,
  type InteresseDe,
  leadsDoPeriodo,
  linhasDeLandingPage,
  linhasExportarLeads,
  resumoSite,
} from "./site";

// Plano de testes do spec (seção 8) para Site e leads: leads únicos, o
// interesse pelo cadastro da landing page, LP sem cadastro como "Sem tipo"
// e o Excel sem dado pessoal para quem não tem a permissão.

const P = { de: "2026-10-19", ate: "2026-10-25" };

const CADASTRO: Record<string, "evento" | "locacao" | "outro"> = {
  "lp-casamentos": "evento",
  "lp-lojas": "locacao",
};
const interesseDe: InteresseDe = (id) => CADASTRO[id] ?? "sem_tipo";

function contato(uuid: string, nome: string): RdContato {
  return {
    uuid,
    name: nome,
    email: `${uuid}@exemplo.com.br`,
    mobile_phone: "+55 22 99999-0000",
    city: "Nova Friburgo",
    state: "RJ",
    tags: [],
    created_at: "2026-10-01T10:00:00-03:00",
    lifecycle_stage: "Lead",
  };
}

function conversao(
  id: string,
  contatoId: string,
  lp: string,
  dia = "2026-10-20",
): RdConversao {
  return {
    event_uuid: id,
    contact_uuid: contatoId,
    conversion_identifier: lp,
    created_at: `${dia}T10:00:00-03:00`,
    traffic_source: "google",
    traffic_medium: "organic",
    traffic_campaign: "",
  };
}

function lpDia(
  id: string,
  nome: string,
  visitas = 10,
  conv = 1,
): RdLandingPageDia {
  return {
    conversion_identifier: id,
    nome,
    date: "2026-10-20",
    visits_count: visitas,
    conversion_count: conv,
  };
}

const rd = {
  contatos: [contato("c1", "Ana Lima"), contato("c2", "Bruno Costa")],
  conversoes: [
    conversao("e1", "c1", "lp-casamentos"),
    conversao("e2", "c1", "lp-lojas", "2026-10-22"),
    conversao("e3", "c2", "lp-feira"),
  ],
  landingPages: [
    lpDia("lp-casamentos", "Casamentos"),
    lpDia("lp-lojas", "Lojas"),
    lpDia("lp-feira", "Feira de Natal"),
  ],
};

describe("Site e leads", () => {
  it("leads únicos: mesmo contato em 2 landing pages → 2 linhas, cartão conta 1", () => {
    const so = { ...rd, conversoes: rd.conversoes.slice(0, 2) };
    const leads = leadsDoPeriodo(so, P, interesseDe, false);
    expect(leads).toHaveLength(2);
    expect(contarLeads(leads).unicos).toBe(1);
    // A mais recente primeiro.
    expect(leads[0]?.evento).toBe("e2");
  });

  it("interesse do lead: LP cadastrada como Locação → cartão Leads de Locação", () => {
    const c = contarLeads(leadsDoPeriodo(rd, P, interesseDe, false));
    expect(c.locacao).toBe(1);
    expect(c.evento).toBe(1);
    expect(c.unicos).toBe(2);
  });

  it("landing page sem tipo: LP nova sem cadastro → Sem tipo", () => {
    const lps = linhasDeLandingPage(rd.landingPages, P, interesseDe);
    expect(lps.find((l) => l.id === "lp-feira")?.interesse).toBe("sem_tipo");
    const leads = leadsDoPeriodo(rd, P, interesseDe, false);
    expect(leads.find((l) => l.evento === "e3")?.interesse).toBe("sem_tipo");
    const r = resumoSite({ ga4: [] }, rd, P, interesseDe);
    expect(r.landingPagesSemTipo).toEqual([
      { id: "lp-feira", nome: "Feira de Natal" },
    ]);
  });

  it("dados do lead: sem a permissão, o Excel sai sem nome, e-mail e telefone", () => {
    const leads = leadsDoPeriodo(rd, P, interesseDe, false);
    for (const l of leads) {
      expect(l).not.toHaveProperty("nome");
      expect(l).not.toHaveProperty("email");
      expect(l).not.toHaveProperty("telefone");
    }
    const titulos = colunasLeads(false).map((c) => c.titulo);
    expect(titulos).not.toContain("Nome");
    expect(titulos).not.toContain("E-mail");
    expect(titulos).not.toContain("Telefone");
    const texto = JSON.stringify(linhasExportarLeads(leads, false));
    for (const c of rd.contatos) {
      expect(texto).not.toContain(c.name);
      expect(texto).not.toContain(c.email);
      expect(texto).not.toContain(c.mobile_phone);
    }
    expect(texto).toContain("Lead nº");
  });

  it("com a permissão, nome, e-mail e telefone vão para o Excel", () => {
    const leads = leadsDoPeriodo(rd, P, interesseDe, true);
    const texto = JSON.stringify(linhasExportarLeads(leads, true));
    expect(texto).toContain("Ana Lima");
    expect(colunasLeads(true)).toHaveLength(colunasLeads(false).length + 2);
  });

  it("canal do lead pelas regras do GA4", () => {
    expect(canalDoLead("google", "organic")).toBe("Organic Search");
    expect(canalDoLead("(direct)", "(none)")).toBe("Direct");
    expect(canalDoLead("instagram", "social")).toBe("Organic Social");
    expect(canalDoLead("facebook", "paid_social")).toBe("Paid Social");
    expect(canalDoLead("google", "cpc")).toBe("Paid Search");
    expect(canalDoLead("rd_email", "email")).toBe("Email");
  });

  it("buscas: oportunidade = posição 4–10, muita impressão e CTR baixo", () => {
    const b = (
      query: string,
      clicks: number,
      impressions: number,
      position: number,
    ) => ({
      date: "2026-10-20",
      query,
      page: "/",
      clicks,
      impressions,
      ctr: clicks / impressions,
      position,
    });
    const top = buscasDoPeriodo(
      [
        b("marca", 50, 100, 1.2),
        b("o que fazer", 3, 400, 7.5),
        b("nicho", 2, 20, 6),
      ],
      P,
    );
    expect(top.map((t) => t.termo)).toEqual(["marca", "o que fazer", "nicho"]);
    expect(top.find((t) => t.termo === "o que fazer")?.oportunidade).toBe(true);
    expect(top.find((t) => t.termo === "marca")?.oportunidade).toBe(false);
    expect(top.find((t) => t.termo === "nicho")?.oportunidade).toBe(false);
  });
});
