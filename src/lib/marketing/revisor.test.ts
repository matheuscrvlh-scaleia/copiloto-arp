import { describe, expect, it } from "vitest";
import { normalizar, revisar } from "./revisor";

// Listas iguais às do seed (rebranding 2025 e guia rápido).
const LISTAS = {
  proibidas: [
    "Super Espaço",
    "Melhor da Cidade",
    "Tem de tudo",
    "Repleto de atividades",
    "Shopping",
  ],
  proprietarias: ["Energia", "1911", "Lugar de ser", "Rua do Relógio"],
};

const marcados = (texto: string) =>
  revisar(texto, LISTAS)
    .trechos.filter((t) => t.tipo !== "normal")
    .map((t) => [t.tipo, t.texto]);

describe("revisor de texto da marca", () => {
  it("teste do spec: marca Super Espaço e Tem de tudo e sugere as proprietárias", () => {
    const r = revisar("O Super Espaço tem de tudo", LISTAS);
    expect(r.totalProibidas).toBe(2);
    expect(r.proibidas.map((p) => p.termo)).toEqual([
      "Super Espaço",
      "Tem de tudo",
    ]);
    expect(marcados("O Super Espaço tem de tudo")).toEqual([
      ["proibida", "Super Espaço"],
      ["proibida", "tem de tudo"],
    ]);
    expect(r.sugestoes).toEqual(LISTAS.proprietarias);
  });

  it("os trechos remontam o texto original sem perder nada", () => {
    const texto = "Ação!  SUPER   espaço,\nmelhor da cidade… e Energia.";
    const r = revisar(texto, LISTAS);
    expect(r.trechos.map((t) => t.texto).join("")).toBe(texto);
  });

  it("ignora maiúscula e acento, nos dois sentidos", () => {
    expect(marcados("super espaco")).toEqual([["proibida", "super espaco"]]);
    expect(marcados("na RUA DO RELOGIO")).toEqual([
      ["propria", "RUA DO RELOGIO"],
    ]);
    expect(normalizar("Relógio É")).toBe("relogio e");
  });

  it("só casa palavra inteira", () => {
    expect(marcados("Shoppings e shoppingcenter")).toEqual([]);
    expect(marcados("o shopping.")).toEqual([["proibida", "shopping"]]);
    expect(marcados("19110 e 1911")).toEqual([["propria", "1911"]]);
  });

  it("conta repetições e separa as proprietárias usadas das sugeridas", () => {
    const r = revisar("Shopping, shopping e muita energia em 1911", LISTAS);
    expect(r.proibidas).toEqual([{ termo: "Shopping", vezes: 2 }]);
    expect(r.totalProibidas).toBe(2);
    expect(r.proprietariasUsadas.map((p) => p.termo)).toEqual([
      "Energia",
      "1911",
    ]);
    expect(r.sugestoes).toEqual(["Lugar de ser", "Rua do Relógio"]);
  });

  it("proibida vence proprietária no mesmo trecho e a expressão longa vence a curta", () => {
    const r = revisar("Super Espaço", {
      proibidas: ["Super Espaço"],
      proprietarias: ["Espaço", "Super Espaço"],
    });
    expect(r.trechos).toEqual([
      { tipo: "proibida", texto: "Super Espaço", termo: "Super Espaço" },
    ]);
    const longa = revisar("Lugar de ser feliz", {
      proibidas: [],
      proprietarias: ["Lugar", "Lugar de ser"],
    });
    expect(longa.trechos[0]).toEqual({
      tipo: "propria",
      texto: "Lugar de ser",
      termo: "Lugar de ser",
    });
  });

  it("lista vazia ou texto vazio não quebra", () => {
    expect(revisar("", LISTAS).trechos).toEqual([]);
    expect(
      revisar("qualquer coisa", { proibidas: [" ", ""], proprietarias: [] })
        .totalProibidas,
    ).toBe(0);
  });
});
