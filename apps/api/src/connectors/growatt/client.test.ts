import { describe, expect, it } from "vitest";
import { ConnectorError } from "../http";
import { createGrowattClient, janelas, somarDias } from "./client";

// Respostas no formato da OpenAPI v1 (valores fictícios).

const ok = (data: unknown) => ({ error_code: 0, error_msg: "", data });

function fakeFetch(respostas: unknown[], chamadas: string[] = []) {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    chamadas.push(String(url));
    expect(new Headers(init?.headers).get("token")).toBe("tk");
    const corpo =
      respostas[Math.min(chamadas.length - 1, respostas.length - 1)];
    return new Response(JSON.stringify(corpo), { status: 200 });
  }) as typeof fetch;
}

const config = { baseUrl: "https://growatt.test/", token: "tk", usinaId: 42 };

describe("growatt", () => {
  it("lê os números de agora, convertendo texto em número", async () => {
    const chamadas: string[] = [];
    const api = createGrowattClient({
      ...config,
      fetch: fakeFetch(
        [
          ok({
            current_power: 24.17,
            today_energy: "209.2",
            monthly_energy: "4882.8",
            yearly_energy: "94742.1",
            total_energy: "332519.19",
            carbon_offset: "1953.1",
            efficiency: "",
            last_update_time: "2026-11-17 11:44:23",
            timezone: "GMT-3",
          }),
        ],
        chamadas,
      ),
    });
    const r = await api.agora();
    expect(chamadas[0]).toBe("https://growatt.test/v1/plant/data?plant_id=42");
    expect(r.current_power).toBe(24.17);
    expect(r.today_energy).toBe(209.2);
    expect(r.total_energy).toBe(332519.19);
  });

  it("energia diária em janelas de 8 dias; dia sem valor fica de fora", async () => {
    const chamadas: string[] = [];
    const api = createGrowattClient({
      ...config,
      fetch: fakeFetch(
        [
          ok({
            time_unit: "day",
            count: 2,
            energys: [
              { date: "2026-11-01", energy: "314.6" },
              { date: "2026-11-02", energy: null },
            ],
          }),
          ok({ energys: [{ date: "2026-11-09", energy: "290" }] }),
        ],
        chamadas,
      ),
    });
    const dias = await api.energiaPorDia("2026-11-01", "2026-11-09");
    expect(chamadas).toHaveLength(2);
    expect(chamadas[0]).toContain("start_date=2026-11-01&end_date=2026-11-08");
    expect(chamadas[1]).toContain("start_date=2026-11-09&end_date=2026-11-09");
    expect(dias).toEqual([
      { dia: "2026-11-01", kwh: 314.6 },
      { dia: "2026-11-09", kwh: 290 },
    ]);
  });

  it("erro no corpo com HTTP 200 vira ConnectorError (token recusado = 401)", async () => {
    const api = createGrowattClient({
      ...config,
      fetch: fakeFetch([
        { error_code: 10011, error_msg: "error_permission_denied", data: "" },
      ]),
    });
    const erro = await api.agora().catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ConnectorError);
    expect(erro).toMatchObject({ status: 401 });
  });

  it("usina fora do token: 404 com a explicação", async () => {
    const api = createGrowattClient({
      ...config,
      fetch: fakeFetch([
        {
          error_code: 10002,
          error_msg: "error_Plant does not exist",
          data: "",
        },
      ]),
    });
    await expect(api.detalhes()).rejects.toMatchObject({
      status: 404,
      message: expect.stringMatching(/não é vista por este token/),
    });
  });

  it("da lista, só a contagem", async () => {
    const api = createGrowattClient({
      ...config,
      fetch: fakeFetch([ok({ count: 41, plants: [{ name: "Cliente" }] })]),
    });
    expect(await api.quantasUsinas()).toBe(41);
  });

  it("janelas e soma de dias atravessam o fim do mês e do ano", () => {
    expect(somarDias("2026-12-30", 3)).toBe("2027-01-02");
    expect(janelas("2026-11-25", "2026-12-10")).toEqual([
      ["2026-11-25", "2026-12-02"],
      ["2026-12-03", "2026-12-10"],
    ]);
    expect(janelas("2026-11-10", "2026-11-09")).toEqual([]);
  });
});
