import { describe, expect, it } from "vitest";
import {
  descreverIntervalo,
  intervalo,
  paginaDaUrl,
  paginasVisiveis,
  totalDePaginas,
} from "./paginacao";

describe("paginação", () => {
  it("lê a página da URL", () => {
    expect(paginaDaUrl("3")).toBe(3);
    expect(paginaDaUrl(["2", "5"])).toBe(2);
    expect(paginaDaUrl(undefined)).toBe(1);
    expect(paginaDaUrl("0")).toBe(1);
    expect(paginaDaUrl("-2")).toBe(1);
    expect(paginaDaUrl("1.5")).toBe(1);
    expect(paginaDaUrl("abc")).toBe(1);
  });

  it("calcula o intervalo do PostgREST", () => {
    expect(intervalo(1, 30)).toEqual({ de: 0, ate: 29 });
    expect(intervalo(3, 30)).toEqual({ de: 60, ate: 89 });
  });

  it("conta as páginas (pelo menos uma)", () => {
    expect(totalDePaginas(0, 30)).toBe(1);
    expect(totalDePaginas(30, 30)).toBe(1);
    expect(totalDePaginas(31, 30)).toBe(2);
  });

  it("mostra a primeira, a última e as vizinhas", () => {
    expect(paginasVisiveis(1, 1)).toEqual([1]);
    expect(paginasVisiveis(5, 20)).toEqual([1, null, 4, 5, 6, null, 20]);
    expect(paginasVisiveis(1, 5)).toEqual([1, 2, null, 5]);
    expect(paginasVisiveis(3, 4)).toEqual([1, 2, 3, 4]);
  });

  it("descreve o intervalo", () => {
    expect(descreverIntervalo(2, 412, 30)).toBe("31–60 de 412");
    expect(descreverIntervalo(14, 412, 30)).toBe("391–412 de 412");
    expect(descreverIntervalo(1, 0, 30)).toBe("0 de 0");
  });
});
