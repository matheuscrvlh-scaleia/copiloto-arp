import { describe, expect, it } from "vitest";
import entrada from "@/connectors/wps/__fixtures__/entrada.json";
import pagamentoDetalhe from "@/connectors/wps/__fixtures__/pagamento-detalhe.json";
import {
  movimentoDoDiaSchema,
  pagamentosDoDiaSchema,
} from "@/connectors/wps/schemas";
import {
  type DiaEstacionamento,
  diasDoIntervalo,
  diasParaSincronizar,
  LIMITE_DIAS,
  linhasDoDia,
  pagamentosSemPlaca,
  semRepetirEntreDias,
} from "./wps-regras";

const pagamentos = pagamentosDoDiaSchema.parse(pagamentoDetalhe);
const entradas = movimentoDoDiaSchema.parse(entrada);
const saidas = movimentoDoDiaSchema.parse({
  quantidade: 9,
  subdetalhes: {
    carro: { quantidade: 8, descricao: "carro" },
    moto: { quantidade: 1, descricao: "moto" },
  },
});

describe("regras da sincronização da WPS", () => {
  it("relê a semana até ontem", () => {
    expect(diasParaSincronizar(new Date(2026, 9, 2))).toEqual([
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
    ]);
  });

  it("reprocesso: intervalo fechado, com data válida e limite de dias", () => {
    expect(diasDoIntervalo("2026-02-27", "2026-03-01")).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
    ]);
    expect(diasDoIntervalo("2026-09-10")).toEqual(["2026-09-10"]);
    expect(() => diasDoIntervalo("10/09/2026")).toThrow(/aaaa-mm-dd/);
    expect(() => diasDoIntervalo("2026-02-30")).toThrow(/inválida/);
    expect(() => diasDoIntervalo("2026-09-10", "2026-09-01")).toThrow(/antes/);
    expect(() => diasDoIntervalo("2026-01-01", "2026-12-31")).toThrow(
      new RegExp(String(LIMITE_DIAS)),
    );
  });

  it("um pagamento por código, com todos os grupos em que apareceu", () => {
    const dia = linhasDoDia("2026-01-15", pagamentos, entradas, saidas);
    // A API diz 7: 41338 está em cartao_credito e em desconto, e cada
    // registro de cartão aparece duas vezes (uma por RPS).
    expect(dia.pagamentos).toHaveLength(3);
    const p = dia.pagamentos.find((x) => x.wps_codigo === 41338);
    expect(p).toMatchObject({
      grupos: ["cartao_credito", "desconto"],
      valor_bruto: 194,
      valor_desconto: 106,
      valor_liquido: 88,
      forma_pagamento: "CRÉDITO MASTERCARD",
      terminal: "MOBILE",
    });
    expect(dia.pagamentos.find((x) => x.wps_codigo === 41339)).toMatchObject({
      grupos: ["cartao_credito"],
      valor_desconto: 0,
    });
    expect(dia.pagamentos.find((x) => x.wps_codigo === 41337)?.grupos).toEqual([
      "isento",
    ]);
  });

  it("não leva placa nem operador para o banco", () => {
    const dia = linhasDoDia("2026-01-15", pagamentos, entradas, saidas);
    expect(JSON.stringify(dia)).not.toMatch(/BBB-2333|APIKEY/);
    expect(JSON.stringify(pagamentosSemPlaca(pagamentos))).not.toMatch(
      /placa|operador|BBB-2333|APIKEY/,
    );
  });

  it("entradas e saídas por tipo de veículo, zero onde um lado não tem", () => {
    const dia = linhasDoDia("2026-01-15", pagamentos, entradas, saidas);
    expect(dia.movimento).toEqual([
      { tipo_veiculo: "carro", entradas: 11, saidas: 8 },
      { tipo_veiculo: "caminhao", entradas: 0, saidas: 0 },
      { tipo_veiculo: "moto", entradas: 0, saidas: 1 },
    ]);
  });

  it("pagamento listado em dois dias fica só no último", () => {
    const um = linhasDoDia("2026-01-15", pagamentos, entradas, saidas);
    const outro: DiaEstacionamento = {
      ...um,
      data: "2026-01-16",
      pagamentos: um.pagamentos.filter((p) => p.wps_codigo === 41339),
    };
    const { dias, repetidos } = semRepetirEntreDias([um, outro]);
    expect(repetidos).toBe(1);
    expect(dias[0]?.pagamentos.map((p) => p.wps_codigo).sort()).toEqual([
      41337, 41338,
    ]);
    expect(dias[1]?.pagamentos.map((p) => p.wps_codigo)).toEqual([41339]);
  });
});
