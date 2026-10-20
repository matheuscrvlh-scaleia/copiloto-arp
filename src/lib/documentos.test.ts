import { describe, expect, it } from "vitest";
import { cnpjValido, formatarCep, formatarCnpj } from "./documentos";

// CNPJs fictícios, montados só para conferir o cálculo.
describe("documentos da empresa", () => {
  it("aceita CNPJ com dígitos certos, com ou sem máscara", () => {
    expect(cnpjValido("11222333000181")).toBe(true);
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
  });

  it("recusa dígito errado, tamanho errado e repetidos", () => {
    expect(cnpjValido("11222333000182")).toBe(false);
    expect(cnpjValido("1122233300018")).toBe(false);
    expect(cnpjValido("00000000000000")).toBe(false);
  });

  it("formata CNPJ e CEP", () => {
    expect(formatarCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatarCep("28610000")).toBe("28610-000");
    expect(formatarCnpj(null)).toBe("");
  });
});
