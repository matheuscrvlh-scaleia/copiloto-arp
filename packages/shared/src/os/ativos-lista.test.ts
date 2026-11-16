import { describe, expect, it } from "vitest";
import {
  lerFiltroAtivos,
  OR_CADASTRO_INCOMPLETO,
  precisaDoSinal,
} from "./ativos-lista";

describe("filtros da lista de ativos", () => {
  it("lê a URL", () => {
    expect(
      lerFiltroAtivos({
        visao: "decisao",
        q: [" bomba ", "x"],
        incompleto: "1",
        preventiva: "atrasada",
      }),
    ).toEqual({
      visao: "decisao",
      q: "bomba",
      cat: "",
      local: "",
      situacao: "",
      sinal: "",
      incompleto: true,
      preventiva: true,
    });
    expect(lerFiltroAtivos({ visao: "outra" }).visao).toBe("lista");
  });

  it("só pede o sinal de todos na decisão ou no filtro por sinal", () => {
    expect(precisaDoSinal(lerFiltroAtivos({}))).toBe(false);
    expect(precisaDoSinal(lerFiltroAtivos({ sinal: "trocar" }))).toBe(true);
    expect(precisaDoSinal(lerFiltroAtivos({ visao: "decisao" }))).toBe(true);
  });

  it("cadastro incompleto cobre os cinco dados", () => {
    for (const c of [
      "categoria_id",
      "bloco",
      "loja_id",
      "area",
      "compra_data",
      "valor_reposicao",
      "vida_util_anos",
    ])
      expect(OR_CADASTRO_INCOMPLETO).toContain(c);
  });
});
