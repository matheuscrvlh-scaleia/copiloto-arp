import { describe, expect, it } from "vitest";
import {
  areaPorExtenso,
  dataPorExtenso,
  diasPorExtenso,
  mesesPorExtenso,
  metrosPorExtenso,
  numeroPorExtenso,
  quantidadePorExtenso,
  reaisPorExtenso,
  valorPorExtenso,
} from "./extenso";

describe("por extenso", () => {
  it("teste 8 do spec: aluguel 2.400,00 e área 30,50 m²", () => {
    expect(valorPorExtenso(2400)).toBe(
      "2.400,00 (dois mil e quatrocentos reais)",
    );
    expect(areaPorExtenso(30.5)).toBe(
      "30,50 m² (trinta metros e cinquenta centímetros quadrados)",
    );
  });

  it("valores do teste 8 (caução, distrato, evento)", () => {
    expect(reaisPorExtenso(6000)).toBe("seis mil reais");
    expect(reaisPorExtenso(5164.03)).toBe(
      "cinco mil cento e sessenta e quatro reais e três centavos",
    );
    expect(reaisPorExtenso(4015)).toBe("quatro mil e quinze reais");
    expect(reaisPorExtenso(2810.5)).toBe(
      "dois mil oitocentos e dez reais e cinquenta centavos",
    );
    expect(reaisPorExtenso(5621)).toBe(
      "cinco mil seiscentos e vinte e um reais",
    );
  });

  it("números", () => {
    expect(numeroPorExtenso(0)).toBe("zero");
    expect(numeroPorExtenso(100)).toBe("cem");
    expect(numeroPorExtenso(101)).toBe("cento e um");
    expect(numeroPorExtenso(1000)).toBe("mil");
    expect(numeroPorExtenso(1001)).toBe("mil e um");
    expect(numeroPorExtenso(1100)).toBe("mil e cem");
    expect(numeroPorExtenso(2450)).toBe("dois mil quatrocentos e cinquenta");
    expect(numeroPorExtenso(1_200_000)).toBe("um milhão e duzentos mil");
    expect(numeroPorExtenso(2_000_015)).toBe("dois milhões e quinze");
    expect(numeroPorExtenso(1_234_567)).toBe(
      "um milhão duzentos e trinta e quatro mil quinhentos e sessenta e sete",
    );
    expect(numeroPorExtenso(222, true)).toBe("duzentas e vinte e duas");
    expect(numeroPorExtenso(2001, true)).toBe("duas mil e uma");
    expect(() => numeroPorExtenso(1.5)).toThrow();
  });

  it("reais e centavos no singular, milhão redondo com 'de'", () => {
    expect(reaisPorExtenso(1)).toBe("um real");
    expect(reaisPorExtenso(0.01)).toBe("um centavo");
    expect(reaisPorExtenso(0.5)).toBe("cinquenta centavos");
    expect(reaisPorExtenso(0)).toBe("zero reais");
    expect(reaisPorExtenso(1_000_000)).toBe("um milhão de reais");
    expect(reaisPorExtenso(1_011_105.65)).toBe(
      "um milhão onze mil cento e cinco reais e sessenta e cinco centavos",
    );
  });

  it("áreas", () => {
    expect(metrosPorExtenso(30)).toBe("trinta metros quadrados");
    expect(metrosPorExtenso(1)).toBe("um metro quadrado");
    expect(metrosPorExtenso(0.5)).toBe("cinquenta centímetros quadrados");
    expect(metrosPorExtenso(730)).toBe("setecentos e trinta metros quadrados");
    expect(areaPorExtenso(41316.81)).toBe(
      "41.316,81 m² (quarenta e um mil trezentos e dezesseis metros e oitenta e um centímetros quadrados)",
    );
  });

  it("prazos e datas", () => {
    expect(mesesPorExtenso(36)).toBe("36 (trinta e seis) meses");
    expect(mesesPorExtenso(1)).toBe("1 (um) mês");
    expect(diasPorExtenso(30, true)).toBe("30 (trinta) dias úteis");
    expect(diasPorExtenso(1)).toBe("1 (um) dia");
    expect(quantidadePorExtenso(2, "parcela", "parcelas", true)).toBe(
      "2 (duas) parcelas",
    );
    expect(dataPorExtenso("2026-11-04")).toBe("4 de novembro de 2026");
    expect(dataPorExtenso("2026-03-01")).toBe("1º de março de 2026");
  });
});
