import { describe, expect, it } from "vitest";
import {
  criterioDoCartaoVistoria,
  ehUuid,
  lerFiltroVistorias,
  vistoriadorDe,
} from "./vistorias-lista";

describe("filtros da lista de vistorias", () => {
  it("lê a URL e ignora o que não vale", () => {
    const f = lerFiltroVistorias({
      q: " loja 12 ",
      de: "2026-02-31",
      ate: "2026-10-01",
      cartao: "toString",
    });
    expect(f.q).toBe("loja 12");
    expect(f.de).toBe("");
    expect(f.ate).toBe("2026-10-01");
    expect(f.cartao).toBe("");
    expect(lerFiltroVistorias({ cartao: "com_os" }).cartao).toBe("com_os");
  });

  it("vistoriador pelo id ou, sem cadastro, pelo nome", () => {
    const id = "6f1c2a52-6a5b-4c1e-9d43-0b9b1f0a7c11";
    expect(vistoriadorDe({ vistoriador_id: id, vistoriador_nome: "Ana" })).toBe(
      id,
    );
    expect(
      vistoriadorDe({ vistoriador_id: null, vistoriador_nome: "Ana" }),
    ).toBe("Ana");
    expect(ehUuid(id)).toBe(true);
    expect(ehUuid("Ana")).toBe(false);
  });

  it("cada cartão vira um critério da consulta", () => {
    expect(criterioDoCartaoVistoria("andamento", "2026-10-23")).toEqual({
      status: "andamento",
    });
    expect(
      criterioDoCartaoVistoria("concluidas", "2026-12-05").dataEntre,
    ).toEqual({ de: "2026-12-01", ate: "2027-01-01" });
    const assinatura = criterioDoCartaoVistoria("assinatura", "2026-10-23");
    expect(assinatura.legadoNulo).toBe(true);
    expect(assinatura.semStatus).toEqual(["cancelado", "andamento"]);
    expect(criterioDoCartaoVistoria("com_os", "2026-10-23")).toEqual({
      comOS: true,
    });
  });
});
