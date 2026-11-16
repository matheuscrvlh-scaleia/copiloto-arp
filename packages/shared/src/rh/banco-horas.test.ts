import { describe, expect, it } from "vitest";
import {
  acaoSugerida,
  diferencaDoFechamento,
  podeFecharCiclo,
  realizadoNaFolha,
  saldosNoFim,
  valorCalculado,
} from "./banco-horas";

describe("fechamento do ciclo do banco de horas", () => {
  it("fecha só a partir da data de fim", () => {
    expect(podeFecharCiclo("2026-12-22", "2026-12-23")).toBe(false);
    expect(podeFecharCiclo("2026-12-23", "2026-12-23")).toBe(true);
    expect(podeFecharCiclo("2027-01-05", "2026-12-23")).toBe(true);
  });

  it("saldo final = BSaldo do último dia do ponto dentro do ciclo", () => {
    const s = saldosNoFim(
      [
        { colaborador_id: "a", data: "2026-12-20", banco_saldo_min: 100 },
        { colaborador_id: "a", data: "2026-12-23", banco_saldo_min: 130 },
        { colaborador_id: "a", data: "2026-12-24", banco_saldo_min: 0 },
        { colaborador_id: "b", data: "2026-12-10", banco_saldo_min: -45 },
      ],
      "2026-06-24",
      "2026-12-23",
    );
    expect(s).toEqual(
      new Map([
        ["a", 130],
        ["b", -45],
      ]),
    );
  });

  it("valor: positivo × salário/hora × (1 + adicional); negativo pela hora simples", () => {
    // 10h × R$ 20 × 1,8 = R$ 360; -2h × R$ 15 = -R$ 30.
    expect(valorCalculado(600, 20, 80)).toBe(360);
    expect(valorCalculado(-120, 15, 80)).toBe(-30);
    expect(valorCalculado(600, null, 80)).toBeNull();
  });

  it("ação sugerida pelo sinal do saldo", () => {
    expect(acaoSugerida(10)).toBe("pago");
    expect(acaoSugerida(-10)).toBe("descontado");
    expect(acaoSugerida(0)).toBeNull();
  });

  it("realizado na folha: rubrica 408 e grupo banco de horas, desconto subtrai", () => {
    const r = realizadoNaFolha([
      {
        colaborador_id: "a",
        codigo: 408,
        grupo: "hora_extra",
        natureza: "provento",
        valor: 350,
      },
      {
        colaborador_id: "a",
        codigo: 8781,
        grupo: "salario",
        natureza: "provento",
        valor: 3000,
      },
      {
        colaborador_id: "b",
        codigo: 469,
        grupo: "banco_horas",
        natureza: "desconto",
        valor: 28.5,
      },
    ]);
    expect(r).toEqual(
      new Map([
        ["a", 350],
        ["b", -28.5],
      ]),
    );
  });

  it("diferença = realizado − calculado", () => {
    expect(diferencaDoFechamento(360, 350)).toBe(-10);
    expect(diferencaDoFechamento(null, 350)).toBeNull();
  });
});
