import { describe, expect, it } from "vitest";
import { createRdCrmClient } from "@/connectors/rd-crm";
import { funilPorEtapa, oportunidadeDoCrm } from "./rd-crm";

// Respostas no formato da documentação da API v1 do RD Station CRM
// (nomes fictícios).
const FUNIS = [
  {
    id: "f1",
    name: "Comercial - Espaço Arp",
    deal_stages: [
      { _id: "e1", name: "Sem contato" },
      { _id: "e2", name: "Proposta" },
    ],
  },
];
const DEAL = {
  _id: "d1",
  name: "Loja 120 m²",
  rating: 3,
  amount_unique: "0",
  amount_montly: 4500.5,
  hold: null,
  win: null,
  created_at: "2026-10-01T13:00:00.000-03:00",
  prediction_date: "2026-12-01T00:00:00.000-03:00",
  deal_stage: { _id: "e2", name: "Proposta" },
  user: { _id: "u1", name: "Fulana" },
  organization: { _id: "o1", name: "Empresa Teste" },
  deal_custom_fields: [
    { custom_field: { _id: "c1", label: "Segmento" }, value: ["Moda"] },
    { custom_field: null, value: "x" },
  ],
  contacts: [{ name: "Beltrano", emails: [{ email: "b@teste.com" }] }],
};

function fetchFalso(respostas: Record<string, unknown>) {
  const pedidos: URL[] = [];
  const f: typeof fetch = async (u) => {
    const url = new URL(String(u));
    pedidos.push(url);
    const corpo = respostas[url.pathname];
    return new Response(JSON.stringify(corpo), {
      status: corpo === undefined ? 404 : 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  return { f, pedidos };
}

describe("RD Station CRM", () => {
  it("lê todas as páginas, com o token na query", async () => {
    let n = 0;
    const pedidos: URL[] = [];
    const f: typeof fetch = async (u) => {
      const url = new URL(String(u));
      pedidos.push(url);
      n++;
      const deals = n === 1 ? Array(200).fill(DEAL) : [DEAL];
      return Response.json({ total: 201, has_more: n === 1, deals });
    };
    const api = createRdCrmClient({ token: "tk", fetch: f });
    expect(await api.oportunidades()).toHaveLength(201);
    expect(pedidos.map((p) => p.searchParams.get("page"))).toEqual(["1", "2"]);
    expect(pedidos[0]?.searchParams.get("token")).toBe("tk");
  });

  it("converte para o formato das telas, com o funil pela etapa", async () => {
    const { f } = fetchFalso({
      "/api/v1/deal_pipelines": FUNIS,
      "/api/v1/deals": { total: 1, has_more: false, deals: [DEAL] },
    });
    const api = createRdCrmClient({ token: "tk", fetch: f });
    const mapa = funilPorEtapa(await api.funis());
    const [crm] = await api.oportunidades();
    const o = oportunidadeDoCrm(crm as never, mapa);
    expect(o.deal_pipeline).toEqual({
      _id: "f1",
      name: "Comercial - Espaço Arp",
    });
    expect(o.amount_unique).toBe(0);
    expect(o.amount_montly).toBe(4500.5);
    expect(o.hold).toBe(false);
    expect(o.win).toBeNull();
    expect(o.prediction_date).toBe("2026-12-01");
    expect(o.deal_custom_fields).toEqual([
      { custom_field: { _id: "c1", label: "Segmento" }, value: "Moda" },
    ]);
    expect(o.contacts[0]).toEqual({
      name: "Beltrano",
      title: null,
      emails: [{ email: "b@teste.com" }],
      phones: [],
    });
  });
});
