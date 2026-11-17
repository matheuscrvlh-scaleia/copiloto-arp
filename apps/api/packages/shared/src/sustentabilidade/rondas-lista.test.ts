import { describe, expect, it } from "vitest";
import {
  filtrarLinhas,
  type ItemLido,
  linhasDasRondas,
  mediaGeralPorCor,
  mediaPorLocalECor,
  type RondaLida,
  resumoDaUltimaRonda,
  rondasDoLocal,
  rondasDoMes,
  semanasDoGrafico,
} from "./rondas-lista";

const item = (
  id: string,
  local: string,
  cor: "preto" | "azul",
  conteineres: number,
  ocupacaoPct: number,
): ItemLido => ({
  id,
  coletorId: local,
  local,
  cor,
  conteineres,
  ocupacaoPct,
  observacao: null,
  foto: null,
});
const ronda = (
  id: string,
  dataHora: string,
  itens: ItemLido[],
  lancadoPor = "Ana",
): RondaLida => ({ id, dataHora, itens, lancadoPor, exemplo: false });

// Quinta 05/11 e terça 17/11 (as horas são de Brasília, UTC−3).
const R1 = ronda("r1", "2026-11-05T12:00:00Z", [
  item("i1", "PEV Caçula", "preto", 4, 100),
  item("i2", "PEV Caçula", "azul", 2, 30),
  item("i3", "Bloco 3", "preto", 1, 50),
]);
const R2 = ronda("r2", "2026-11-17T12:30:00Z", [
  item("i4", "PEV Caçula", "preto", 4, 90),
  item("i5", "Bloco 3", "preto", 1, 10),
  item("i6", "PEV Pontal", "azul", 1, 60),
]);
const RONDAS = [R1, R2];

describe("linhasDasRondas e filtrarLinhas", () => {
  const linhas = linhasDasRondas(RONDAS, 90);
  const periodo = { de: "2026-11-01", ate: "2026-11-30" };
  const filtro = (f: Partial<Parameters<typeof filtrarLinhas>[1]> = {}) =>
    filtrarLinhas(linhas, { ...periodo, local: "", cor: "", cartao: "", ...f });

  it("uma linha por coletor visitado, da ronda mais recente para a mais antiga", () => {
    expect(linhas).toHaveLength(6);
    expect(linhas[0]?.rondaId).toBe("r2");
    expect(linhas.at(-1)?.rondaId).toBe("r1");
  });

  it("marca como cheio a ocupação no limite ou acima", () => {
    expect(
      linhas
        .filter((l) => l.cheio)
        .map((l) => l.chave)
        .sort(),
    ).toEqual(["i1", "i4"]);
  });

  it("filtra por período (dia de Brasília), local, cor e cartão", () => {
    expect(filtro()).toHaveLength(6);
    expect(filtro({ de: "2026-11-10" })).toHaveLength(3);
    expect(filtro({ local: "Bloco 3" })).toHaveLength(2);
    expect(filtro({ cor: "azul" })).toHaveLength(2);
    expect(filtro({ cartao: "cheios" })).toHaveLength(2);
    expect(filtro({ cartao: "preto", local: "PEV Caçula" })).toHaveLength(2);
  });

  it("a ronda das 22h do dia 30 é do dia 30, não de dezembro", () => {
    const tarde = linhasDasRondas(
      [ronda("r3", "2026-12-01T01:00:00Z", [item("i7", "A", "preto", 1, 10)])],
      90,
    );
    expect(
      filtrarLinhas(tarde, {
        de: "2026-11-30",
        ate: "2026-11-30",
        local: "",
        cor: "",
        cartao: "",
      }),
    ).toHaveLength(1);
  });
});

describe("cartões", () => {
  it("última ronda: média ponderada por cor sem os não visitados e cheios", () => {
    expect(resumoDaUltimaRonda(RONDAS, "2026-11-30", 90)).toEqual({
      ultima: "2026-11-17",
      // (4×90 + 1×10) ÷ 5 = 74
      pretos: 74,
      azuis: 60,
      cheios: 1,
    });
  });

  it("vale a última ronda até o dia pedido; sem ronda, sem dado (não zero)", () => {
    expect(resumoDaUltimaRonda(RONDAS, "2026-11-10", 90).ultima).toBe(
      "2026-11-05",
    );
    expect(resumoDaUltimaRonda(RONDAS, "2026-10-31", 90)).toEqual({
      ultima: null,
      pretos: null,
      azuis: null,
      cheios: 0,
    });
  });

  it("filtro de local deixa só os itens do local e some com a ronda que não passou", () => {
    const so = rondasDoLocal(RONDAS, "PEV Pontal");
    expect(so).toHaveLength(1);
    expect(so[0]?.itens).toHaveLength(1);
    expect(rondasDoLocal(RONDAS, "")).toHaveLength(2);
  });

  it("rondas no mês", () => {
    expect(rondasDoMes(RONDAS, "2026-11-30")).toBe(2);
    expect(rondasDoMes(RONDAS, "2026-10-31")).toBe(0);
  });
});

describe("mediaPorLocalECor", () => {
  const linhas = linhasDasRondas(RONDAS, 90);

  it("média ponderada pelos contêineres de cada local e cor", () => {
    const m = mediaPorLocalECor(linhas);
    const cacula = m.find((x) => x.local === "PEV Caçula" && x.cor === "preto");
    // (4×100 + 4×90) ÷ 8 = 95
    expect(cacula).toMatchObject({
      rondas: 2,
      conteineres: 8,
      ocupacaoMedia: 95,
      maxima: 100,
    });
    expect(m).toHaveLength(4);
  });

  it("média geral por cor", () => {
    // pretos: (400 + 50 + 360 + 10) ÷ 10 = 82
    expect(mediaGeralPorCor(linhas, "preto")).toBe(82);
  });
});

describe("semanasDoGrafico", () => {
  it("12 semanas até a semana de hoje, sem ronda = sem dado", () => {
    const s = semanasDoGrafico(RONDAS, "2026-11-17");
    expect(s).toHaveLength(12);
    expect(s.at(-1)?.semana).toBe("2026-11-16");
    expect(s.at(-1)?.preto).toBe(74);
    expect(s.at(-2)?.preto).toBeNull();
    expect(s.at(-2)?.azul).toBeNull();
  });
});
