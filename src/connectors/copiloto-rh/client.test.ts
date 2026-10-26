import { describe, expect, it } from "vitest";
import { ConnectorError } from "../http";
import { createCopilotoRhClient } from "./client";

// Formato dos exemplos da documentação da API (dados fictícios).
const COLABORADOR = {
  id: "3f6c1e2a-8b7d-4c5e-9f10-2a3b4c5d6e7f",
  code: "00123",
  full_name: "Maria Exemplo",
  email: "maria@empresa.test",
  status: "active",
  employment_type: "full_time",
  contract_type: "clt",
  hire_date: "2024-03-01",
  termination_date: null,
  termination_reason: null,
  department: { id: "d1", name: "Financeiro" },
  position: { id: "p1", title: "Analista", level: "Pleno" },
  unit: { id: "u1", name: "Matriz" },
  work_unit: null,
  direct_manager_id: "m1",
  responsible_manager_id: null,
  created_at: "2026-10-20T13:45:00.000Z",
  updated_at: "2026-10-20T13:45:00.000Z",
  personal: {
    cpf: "000.000.000-00",
    birth_date: "1990-05-12",
    mobile_phone: "(00) 00000-0000",
    address: { city: "Cidade" },
  },
  compensation: { base_salary: 2000, weekly_hours: 44 },
};

interface Chamada {
  url: string;
  metodo: string;
  auth: string | null;
  corpo?: unknown;
}

function api(rotas: Record<string, (u: URL) => Response>, chamadas: Chamada[]) {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    const u = new URL(String(url));
    chamadas.push({
      url: String(url),
      metodo: init?.method ?? "GET",
      auth: new Headers(init?.headers).get("authorization"),
      corpo: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const rota = rotas[u.pathname];
    return rota ? rota(u) : new Response("{}", { status: 404 });
  }) as typeof fetch;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const token = () =>
  json({ access_token: "crh_at_1", token_type: "Bearer", expires_in: 3600 });

const config = {
  baseUrl: "https://copiloto.test/public-api/",
  usuario: "crh_id",
  senha: "crh_sk_x",
};

describe("copiloto rh", () => {
  it("faz login uma vez e reaproveita o token", async () => {
    const chamadas: Chamada[] = [];
    const client = createCopilotoRhClient({
      ...config,
      fetch: api(
        {
          "/public-api/v1/auth/token": token,
          "/public-api/v1/me": () =>
            json({
              organization: { id: "o1", name: "Empresa" },
              client: { client_id: "crh_id", name: "Centralizador" },
              scopes: ["employees:read"],
              expires_at: "2026-10-20T14:45:00.000Z",
            }),
        },
        chamadas,
      ),
    });
    await client.me();
    const me = await client.me();
    expect(me).toEqual({
      organization: { id: "o1", name: "Empresa" },
      scopes: ["employees:read"],
    });
    expect(chamadas.map((c) => [c.metodo, new URL(c.url).pathname])).toEqual([
      ["POST", "/public-api/v1/auth/token"],
      ["GET", "/public-api/v1/me"],
      ["GET", "/public-api/v1/me"],
    ]);
    expect(chamadas[0]?.corpo).toEqual({
      client_id: "crh_id",
      client_secret: "crh_sk_x",
    });
    expect(chamadas[1]?.auth).toBe("Bearer crh_at_1");
  });

  it("aceita a URL já terminada em /v1", async () => {
    const chamadas: Chamada[] = [];
    const client = createCopilotoRhClient({
      ...config,
      baseUrl: "https://copiloto.test/public-api/v1",
      fetch: api(
        {
          "/public-api/v1/auth/token": token,
          "/public-api/v1/me": () =>
            json({ organization: { id: "o1", name: "E" }, scopes: [] }),
        },
        chamadas,
      ),
    });
    await client.me();
    expect(chamadas[1]?.url).toBe("https://copiloto.test/public-api/v1/me");
  });

  it("percorre as páginas e guarda só os campos usados", async () => {
    const chamadas: Chamada[] = [];
    const client = createCopilotoRhClient({
      ...config,
      fetch: api(
        {
          "/public-api/v1/auth/token": token,
          "/public-api/v1/employees": (u) => {
            const page = Number(u.searchParams.get("page"));
            return json({
              data: [{ ...COLABORADOR, id: `c${page}` }],
              pagination: {
                page,
                per_page: 100,
                total: 2,
                has_more: page < 2,
              },
            });
          },
        },
        chamadas,
      ),
    });
    const lista = await client.colaboradores({
      status: ["active", "on_leave"],
      alteradosDesde: new Date("2026-10-01T00:00:00Z"),
    });
    expect(lista.map((c) => c.id)).toEqual(["c1", "c2"]);
    const q = new URL(chamadas[1]?.url ?? "").searchParams;
    expect(q.get("status")).toBe("active,on_leave");
    expect(q.get("updated_since")).toBe("2026-10-01T00:00:00.000Z");
    expect(q.get("per_page")).toBe("100");

    const c = lista[0];
    expect(c?.personal).toEqual({ birth_date: "1990-05-12" });
    // Do salário só o valor (vale para o PJ; a regra do sync descarta o resto).
    expect(c?.compensation).toEqual({ base_salary: 2000 });
    expect(c).not.toHaveProperty("email");
    expect(JSON.stringify(lista)).not.toContain("000.000.000-00");
  });

  it("token expirado antes da hora: renova uma vez", async () => {
    let tokens = 0;
    let chamadasMe = 0;
    const client = createCopilotoRhClient({
      ...config,
      fetch: api(
        {
          "/public-api/v1/auth/token": () => {
            tokens++;
            return token();
          },
          "/public-api/v1/me": () =>
            ++chamadasMe === 1
              ? json({ error: { code: "invalid_token" } }, 401)
              : json({ organization: { id: "o1", name: "E" }, scopes: [] }),
        },
        [],
      ),
    });
    await client.me();
    expect(tokens).toBe(2);
  });

  it("turnover: manda período e departamento e valida a resposta", async () => {
    const chamadas: Chamada[] = [];
    const contagens = {
      terminations: 1,
      voluntary: 1,
      involuntary: 0,
      agreement: 0,
      hires: 2,
      headcount_start: 30,
      headcount_end: 31,
    };
    const client = createCopilotoRhClient({
      ...config,
      fetch: api(
        {
          "/public-api/v1/auth/token": token,
          "/public-api/v1/turnover": () =>
            json({
              period: { from: "2026-10-01", to: "2026-10-21" },
              filters: { unit_id: null, department_id: "d1" },
              agreement_counts_as: "voluntary",
              rates: {
                general: 3.33,
                voluntary: 3.33,
                involuntary: 0,
                agreement: null,
              },
              counts: contagens,
              monthly: [],
              by_department: [
                { department: null, active: 1, terminations: 0, rate: 0 },
              ],
            }),
        },
        chamadas,
      ),
    });
    const t = await client.turnover({
      de: "2026-10-01",
      ate: "2026-10-21",
      departamentoId: "d1",
    });
    expect(t.rates.general).toBe(3.33);
    const q = new URL(chamadas[1]?.url ?? "").searchParams;
    expect([q.get("from"), q.get("to"), q.get("department_id")]).toEqual([
      "2026-10-01",
      "2026-10-21",
      "d1",
    ]);
  });

  it("credencial errada vira erro do conector, sem repetir o login", async () => {
    const chamadas: Chamada[] = [];
    const client = createCopilotoRhClient({
      ...config,
      fetch: api(
        {
          "/public-api/v1/auth/token": () =>
            json(
              { error: { code: "invalid_client", message: "credencial" } },
              401,
            ),
        },
        chamadas,
      ),
    });
    const erro = await client.me().catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ConnectorError);
    expect((erro as ConnectorError).status).toBe(401);
    expect(chamadas).toHaveLength(1);
  });
});
