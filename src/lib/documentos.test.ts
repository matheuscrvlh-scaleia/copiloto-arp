import { describe, expect, it } from "vitest";
import {
  cnpjValido,
  cpfValido,
  digitosCnpj,
  digitosCpf,
  formatarCep,
  formatarCnpj,
  formatarCpf,
  formatarDocumento,
} from "./documentos";

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

  it("aceita CPF com dígitos certos, com ou sem máscara", () => {
    expect(cpfValido("52998224725")).toBe(true);
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("12345678909")).toBe(true);
  });

  it("recusa CPF com dígito errado, tamanho errado e repetidos", () => {
    expect(cpfValido("52998224724")).toBe(false);
    expect(cpfValido("5299822472")).toBe(false);
    expect(cpfValido("11111111111")).toBe(false);
  });

  it("calcula os dígitos verificadores", () => {
    expect(digitosCpf("529982247")).toBe("25");
    expect(digitosCnpj("112223330001")).toBe("81");
  });

  it("formata CPF e escolhe a máscara pelo tamanho", () => {
    expect(formatarCpf("52998224725")).toBe("529.982.247-25");
    expect(formatarDocumento("52998224725")).toBe("529.982.247-25");
    expect(formatarDocumento("11222333000181")).toBe("11.222.333/0001-81");
  });
});
