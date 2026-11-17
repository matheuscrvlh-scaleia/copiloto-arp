import { describe, expect, it } from "vitest";
import { formatarNumeroChamado, rotuloOS } from "./numeros";

describe("números", () => {
  it("chamado", () => {
    expect(formatarNumeroChamado(1234)).toBe("#1234");
  });

  it("título da O.S.", () => {
    expect(rotuloOS("os", "interna", 1234)).toBe("ORDEM DE SERVIÇO Nº 1234");
    expect(rotuloOS("os", null, 7)).toBe("ORDEM DE SERVIÇO Nº 7");
    expect(rotuloOS("os", "terceirizada", 1234)).toBe(
      "O.S. TERCEIRIZADO Nº 1234",
    );
    expect(rotuloOS("tarefa", null, 12)).toBe("TAREFA Nº 12");
  });
});
