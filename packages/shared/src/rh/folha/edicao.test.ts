import { describe, expect, it } from "vitest";
import { minutosDasHoras, rubricasDoFormulario } from "./edicao";

const linha = (codigo: string, valor: string, natureza = "provento") => ({
  codigo,
  natureza,
  referencia: "",
  valor,
});

describe("pessoa da folha editada na tela", () => {
  it("lê valores em pt-BR; linha nova em branco e valor apagado saem", () => {
    expect(
      rubricasDoFormulario([
        { ...linha("8781", "2.000,00"), referencia: "30" },
        linha("307", "", "desconto"),
        linha("", ""),
        linha("490", "57,5", "desconto"),
      ]),
    ).toEqual([
      { codigo: 8781, natureza: "provento", referencia: 30, valor: 2000 },
      { codigo: 490, natureza: "desconto", referencia: null, valor: 57.5 },
    ]);
  });

  it("recusa valor, natureza ou referência inválidos", () => {
    expect(() => rubricasDoFormulario([linha("8781", "abc")])).toThrow(
      /Rubrica 8781: valor inválido/,
    );
    expect(() => rubricasDoFormulario([linha("8781", "-1")])).toThrow(
      /valor inválido/,
    );
    expect(() => rubricasDoFormulario([linha("8781", "1", "")])).toThrow(
      /provento, desconto/,
    );
    expect(() =>
      rubricasDoFormulario([{ ...linha("8781", "1"), referencia: "x" }]),
    ).toThrow(/referência/);
  });

  it("horas do mês viram minutos", () => {
    expect(minutosDasHoras("220")).toBe(13200);
    expect(minutosDasHoras("220,5")).toBe(13230);
    expect(minutosDasHoras("")).toBeNull();
    expect(() => minutosDasHoras("mil")).toThrow(/Horas\/mês/);
  });
});
