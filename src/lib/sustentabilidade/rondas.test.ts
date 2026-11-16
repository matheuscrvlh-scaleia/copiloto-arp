import { describe, expect, it } from "vitest";
import {
  coletoresCheios,
  type ItemRonda,
  inicioDaSemana,
  ocupacaoMedia,
  rondasNoMes,
  serieSemanal,
  ultimaRonda,
} from "./rondas";

const item = (
  coletorId: string,
  cor: ItemRonda["cor"],
  conteineres: number,
  ocupacaoPct: number,
): ItemRonda => ({ coletorId, cor, conteineres, ocupacaoPct });

describe("ocupacaoMedia", () => {
  it("ponderada pelos contêineres, por cor", () => {
    const itens = [
      item("caçula-p", "preto", 4, 100),
      item("pontal-p", "preto", 1, 50),
      item("caçula-a", "azul", 2, 30),
    ];
    expect(ocupacaoMedia(itens, "preto")).toBe(90);
    expect(ocupacaoMedia(itens, "azul")).toBe(30);
  });

  it("não visitado (sem item) não vira zero; contêiner 0 não pesa", () => {
    const visitados = [item("a", "preto", 2, 80)];
    expect(ocupacaoMedia(visitados, "preto")).toBe(80);
    expect(
      ocupacaoMedia([...visitados, item("b", "preto", 0, 0)], "preto"),
    ).toBe(80);
    expect(ocupacaoMedia(visitados, "azul")).toBeNull();
  });
});

describe("coletoresCheios", () => {
  it("no limite ou acima", () => {
    const itens = [
      item("a", "preto", 1, 100),
      item("b", "azul", 1, 90),
      item("c", "azul", 1, 80),
    ];
    expect(coletoresCheios(itens, 90).map((i) => i.coletorId)).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("rondas no mês e última ronda", () => {
  const rondas = [
    { dataHora: "2026-11-03T13:00:00+00:00", itens: [] },
    // 22h30 de 30/11 em Brasília: ainda é novembro.
    { dataHora: "2026-12-01T01:30:00+00:00", itens: [] },
    { dataHora: "2026-12-01T12:00:00+00:00", itens: [] },
    { dataHora: "2026-10-27", itens: [] },
  ];

  it("conta pelo dia em Brasília", () => {
    expect(rondasNoMes(rondas, "2026-11-01")).toBe(2);
    expect(rondasNoMes(rondas, "2026-12")).toBe(1);
    expect(rondasNoMes(rondas, "2026-10-01")).toBe(1);
  });

  it("a mais recente", () => {
    expect(ultimaRonda(rondas)?.dataHora).toBe("2026-12-01T12:00:00+00:00");
    expect(ultimaRonda([])).toBeNull();
  });
});

describe("serieSemanal", () => {
  it("segunda-feira como início da semana", () => {
    expect(inicioDaSemana("2026-11-16")).toBe("2026-11-16"); // segunda
    expect(inicioDaSemana("2026-11-22")).toBe("2026-11-16"); // domingo
    expect(inicioDaSemana("2026-11-15")).toBe("2026-11-09");
  });

  it("junta as rondas da semana e deixa a semana sem ronda em branco", () => {
    const serie = serieSemanal(
      [
        { dataHora: "2026-11-10", itens: [item("a", "preto", 1, 100)] },
        { dataHora: "2026-11-13", itens: [item("a", "preto", 3, 60)] },
        { dataHora: "2026-11-17", itens: [item("b", "azul", 2, 40)] },
      ],
      "2026-11-18",
      3,
    );
    expect(serie).toEqual([
      { semana: "2026-11-02", preto: null, azul: null },
      { semana: "2026-11-09", preto: 70, azul: null },
      { semana: "2026-11-16", preto: null, azul: 40 },
    ]);
  });
});
