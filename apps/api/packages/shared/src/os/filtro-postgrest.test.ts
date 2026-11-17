import { describe, expect, it } from "vitest";
import {
  buscaNoOr,
  limitesDoMes,
  listaNoOr,
  termoDeBusca,
  totalForaDoIntervalo,
} from "./filtro-postgrest";

describe("busca no PostgREST", () => {
  it("tira a sintaxe do .or() e os curingas do texto", () => {
    expect(termoDeBusca("  bomba, (casa)  de máquinas* ")).toBe(
      "bomba casa de máquinas",
    );
    expect(termoDeBusca(String.raw`a:b"c%d\e`)).toBe("a b c d e");
    expect(termoDeBusca(" ,() ")).toBeNull();
    expect(termoDeBusca(null)).toBeNull();
    expect(termoDeBusca("x".repeat(200))?.length).toBe(80);
  });

  it("procura nas colunas e no número exato", () => {
    expect(buscaNoOr("bomba", ["titulo", "descricao"], "numero")).toBe(
      "titulo.ilike.*bomba*,descricao.ilike.*bomba*",
    );
    expect(buscaNoOr("#123", ["titulo"], "numero")).toBe(
      "titulo.ilike.*#123*,numero.eq.123",
    );
    expect(buscaNoOr("42", ["titulo"])).toBe("titulo.ilike.*42*");
    expect(buscaNoOr("  ", ["titulo"])).toBeNull();
  });

  it("lista de ids só com valores simples", () => {
    expect(listaNoOr("loja_id", ["a-1", "b,c", "d"])).toBe(
      "loja_id.in.(a-1,d)",
    );
    expect(listaNoOr("loja_id", [])).toBeNull();
  });

  it("limites do mês em Brasília", () => {
    expect(limitesDoMes("2026-12-15")).toEqual({
      de: "2026-12-01T00:00:00-03:00",
      ate: "2027-01-01T00:00:00-03:00",
    });
    expect(limitesDoMes("2026-03-31").ate).toBe("2026-04-01T00:00:00-03:00");
  });
});

describe("página além do fim", () => {
  it("lê o total do erro 416", () => {
    expect(
      totalForaDoIntervalo({
        code: "PGRST103",
        details:
          "An offset of 3000 was requested, but there are only 120 rows.",
      }),
    ).toBe(120);
    expect(totalForaDoIntervalo({ code: "PGRST103", details: null })).toBe(0);
    expect(totalForaDoIntervalo({ code: "42501", details: "x" })).toBeNull();
  });
});
