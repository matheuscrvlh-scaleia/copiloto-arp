import { describe, expect, it } from "vitest";
import {
  comparativoAnual,
  diasComEvento,
  entradasPorDia,
  incrementoEmEventos,
  mediaPorDiaDaSemana,
  mediaPorHora,
  resumoFluxo,
} from "./publico";

// 2026-11-09 é segunda; 2026-11-14 é sábado.
const c = (inicio: string, entradas: number, deviceid = "ARP-ENTRADA") => ({
  deviceid,
  inicio,
  entradas,
});

const CONTAGENS = [
  // 23h de domingo em Brasília é 02h de segunda em UTC: conta no domingo.
  c("2026-11-09T02:00:00Z", 5),
  c("2026-11-09T13:00:00Z", 100),
  c("2026-11-09T13:00:00Z", 50, "ARP-C-2"),
  c("2026-11-10T14:00:00Z", 200),
  c("2026-11-14T15:00:00Z", 400),
];

describe("entradas por dia", () => {
  it("soma as câmeras no dia de Brasília", () => {
    const d = entradasPorDia(CONTAGENS);
    expect(d.get("2026-11-08")).toBe(5);
    expect(d.get("2026-11-09")).toBe(150);
    expect(d.get("2026-11-10")).toBe(200);
  });
});

describe("resumo do período", () => {
  const p = { de: "2026-11-09", ate: "2026-11-15" };
  const r = resumoFluxo(entradasPorDia(CONTAGENS), p);

  it("média só dos dias com dado; dia sem contagem não é zero", () => {
    expect(r.total).toBe(750);
    expect(r.diasComDado).toBe(3);
    expect(r.diasNoPeriodo).toBe(7);
    expect(r.mediaPorDia).toBe(250);
  });

  it("separa dia útil e fim de semana e acha o pico", () => {
    expect(r.mediaDiaUtil).toBe(175);
    expect(r.mediaFimDeSemana).toBe(400);
    expect(r.pico).toEqual({ dia: "2026-11-14", entradas: 400 });
  });

  it("período sem dado fica sem média", () => {
    const vazio = resumoFluxo(new Map(), p);
    expect(vazio.mediaPorDia).toBeNull();
    expect(vazio.pico).toBeNull();
  });
});

describe("por hora e por dia da semana", () => {
  const p = { de: "2026-11-09", ate: "2026-11-15" };
  it("média por hora de Brasília sobre os dias com dado", () => {
    const h = mediaPorHora(CONTAGENS, p);
    expect(h[10]).toBe(50); // 150 às 10h ÷ 3 dias
    expect(h[3]).toBeNull();
  });
  it("média por dia da semana", () => {
    const s = mediaPorDiaDaSemana(entradasPorDia(CONTAGENS), p);
    expect(s[1]).toBe(150);
    expect(s[6]).toBe(400);
    expect(s[0]).toBeNull();
  });
});

describe("comparativo anual e eventos", () => {
  const porDia = new Map([
    ["2025-11-01", 300], // sábado
    ["2026-11-07", 500], // sábado
    ["2026-11-14", 700], // sábado
    ["2026-11-10", 100], // terça
  ]);
  it("média do dia da semana em cada mês, no ano e no anterior", () => {
    const nov = comparativoAnual(porDia, 2026, 6)[10];
    expect(nov).toEqual({ mes: "Novembro", atual: 600, anterior: 300 });
  });
  it("incremento: dias com evento contra dias sem", () => {
    const dias = diasComEvento([{ inicio: "2026-11-14", fim: "2026-11-14" }]);
    const r = incrementoEmEventos(
      porDia,
      { de: "2026-11-01", ate: "2026-11-30" },
      dias,
    );
    expect(r.comEvento).toBe(700);
    expect(r.semEvento).toBe(300);
    expect(r.variacao).toBeCloseTo(133.33, 1);
  });
});
