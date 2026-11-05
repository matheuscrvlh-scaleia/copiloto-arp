import { describe, expect, it } from "vitest";
import {
  createRdCrmClient,
  renovarRdCrm,
  trocarCodigoRdCrm,
} from "@/connectors/rd-crm";
import { oportunidadesDoCrm } from "./rd-crm";

// Respostas no formato da documentação da API v2 do RD Station CRM
// (nomes fictícios).
const NEGOCIACAO = {
  id: "d1",
  name: "Loja 120 m²",
  rating: 3,
  status: "lost",
  one_time_price: "0",
  recurrence_price: 4500.5,
  expected_close_date: "2026-12-01",
  created_at: "2026-10-01T13:00:00.000-03:00",
  pipeline_id: "f1",
  stage_id: "e2",
  owner_id: "u1",
  lost_reason_id: "m1",
  source_id: null,
  contact_ids: ["c1", "c9"],
  custom_fields: { segmento: ["Moda"], tamanho: null },
};

describe("RD Station CRM (API v2)", () => {
  it("troca o code e renova o par de tokens por formulário", async () => {
    const corpos: string[] = [];
    const f: typeof fetch = async (_, init) => {
      corpos.push(String(init?.body));
      return Response.json({ access_token: "a", refresh_token: "r2" });
    };
    const app = { clientId: "id", clientSecret: "s", fetch: f };
    expect(
      await trocarCodigoRdCrm({ ...app, code: "c", redirectUri: "https://x/" }),
    ).toEqual({ access_token: "a", refresh_token: "r2" });
    await renovarRdCrm({ ...app, refreshToken: "r1" });
    expect(corpos[0]).toContain("grant_type=authorization_code");
    expect(corpos[1]).toContain("grant_type=refresh_token");
    expect(corpos[1]).toContain("refresh_token=r1");
  });

  it("lê todas as páginas com o token no cabeçalho", async () => {
    const pedidos: { url: URL; auth: string | null }[] = [];
    const f: typeof fetch = async (u, init) => {
      const url = new URL(String(u));
      pedidos.push({
        url,
        auth: new Headers(init?.headers).get("authorization"),
      });
      const n = Number(url.searchParams.get("page[number]"));
      return Response.json({
        data: n === 1 ? Array(100).fill(NEGOCIACAO) : [NEGOCIACAO],
        links: { next: n === 1 ? "https://api.rd.services/x?page=2" : null },
      });
    };
    const api = createRdCrmClient({ accessToken: "tk", fetch: f });
    expect(await api.negociacoes()).toHaveLength(101);
    expect(pedidos.map((p) => p.url.searchParams.get("page[number]"))).toEqual([
      "1",
      "2",
    ]);
    expect(pedidos[0]?.auth).toBe("Bearer tk");
    expect(pedidos[0]?.url.pathname).toBe("/crm/v2/deals");
  });

  it("põe os nomes dos cadastros e separa os contatos", async () => {
    const api = createRdCrmClient({
      accessToken: "tk",
      fetch: async () => Response.json({ data: [NEGOCIACAO], links: {} }),
    });
    const [o] = oportunidadesDoCrm(await api.negociacoes(), {
      funis: [{ id: "f1", name: "Comercial - Espaço Arp" }],
      etapas: [{ id: "e2", name: "Proposta" }],
      usuarios: [{ id: "u1", name: "Fulana" }],
      fontes: [],
      campanhas: [],
      motivos: [{ id: "m1", name: "Preço" }],
      empresas: [],
      campos: [{ id: "cf1", slug: "segmento", label: "Segmento" }],
      contatos: [
        {
          id: "c1",
          name: "Beltrano",
          job_title: null,
          emails: [{ email: "b@teste.com" }],
          phones: [],
        },
      ],
    });
    expect(o?.dados.deal_pipeline.name).toBe("Comercial - Espaço Arp");
    expect(o?.dados.deal_stage.name).toBe("Proposta");
    expect(o?.dados.win).toBe(false);
    expect(o?.dados.deal_lost_reason?.name).toBe("Preço");
    expect(o?.dados.amount_unique).toBe(0);
    expect(o?.dados.amount_montly).toBe(4500.5);
    expect(o?.dados.deal_source).toBeNull();
    expect(o?.dados.deal_custom_fields).toEqual([
      { custom_field: { _id: "cf1", label: "Segmento" }, value: "Moda" },
      { custom_field: { _id: "tamanho", label: "tamanho" }, value: null },
    ]);
    expect(o?.contatos).toEqual([
      {
        name: "Beltrano",
        title: null,
        emails: [{ email: "b@teste.com" }],
        phones: [],
      },
    ]);
  });
});
