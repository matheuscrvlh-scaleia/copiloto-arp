import { describe, expect, it } from "vitest";
import { buscaDeLojas, lerFiltroLojas, lerFiltroPortal } from "./portal-lista";

describe("filtros das lojas do portal", () => {
  it("lê a URL", () => {
    expect(lerFiltroPortal({ f: "sem_link", q: " 12 " })).toEqual({
      f: "sem_link",
      q: "12",
    });
    expect(lerFiltroPortal({ f: "constructor" }).f).toBeNull();
    expect(lerFiltroLojas({}).s).toBe("vigente");
    expect(lerFiltroLojas({ s: "todas" }).s).toBe("todas");
  });

  it("busca por LUC, nome e bloco (e locatário e CNPJ nos contratos)", () => {
    expect(buscaDeLojas("ana")).toBe(
      "luc.ilike.*ana*,nome.ilike.*ana*,bloco.ilike.*ana*",
    );
    expect(buscaDeLojas("ana", true)).toContain("locatario.ilike.*ana*");
    expect(buscaDeLojas("")).toBeNull();
  });
});
