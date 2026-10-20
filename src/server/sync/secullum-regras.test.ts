import { describe, expect, it } from "vitest";
import type { Funcionario } from "@/connectors/secullum/schemas";
import {
  competenciaDoMes,
  competenciasParaSincronizar,
  donosDaMatricula,
  esteveAtivoNoPeriodo,
  funcionarioSemDocumentos,
  matricula,
  tipoTurnoverSugerido,
} from "./secullum-regras";

const f = (p: Partial<Funcionario>): Funcionario => ({
  Id: 1,
  Nome: "X",
  ...p,
});

describe("regras da sincronização do Secullum", () => {
  it("matrícula só quando NumeroFolha é número", () => {
    expect(matricula("126")).toBe(126);
    expect(matricula(" 2 ")).toBe(2);
    expect(matricula("A12")).toBeNull();
    expect(matricula(null)).toBeNull();
  });

  it("matrícula repetida fica com o ativo, depois com o admitido por último", () => {
    const donos = donosDaMatricula([
      f({
        Id: 1,
        NumeroFolha: "7",
        Admissao: "2020-01-01",
        Demissao: "2022-01-01",
      }),
      f({ Id: 2, NumeroFolha: "7", Admissao: "2023-01-01" }),
      f({
        Id: 3,
        NumeroFolha: "8",
        Admissao: "2019-01-01",
        Demissao: "2020-01-01",
      }),
      f({
        Id: 4,
        NumeroFolha: "8",
        Admissao: "2021-01-01",
        Demissao: "2022-01-01",
      }),
    ]);
    expect(donos.get(7)).toBe(2);
    expect(donos.get(8)).toBe(4);
  });

  it("não guarda CPF nem PIS no bruto", () => {
    const limpo = funcionarioSemDocumentos(f({ Cpf: "1", NumeroPis: "2" }));
    expect(limpo).not.toHaveProperty("Cpf");
    expect(limpo).not.toHaveProperty("NumeroPis");
  });

  it("ativo no período considera admissão e demissão", () => {
    const set = { inicio: "2026-09-01", fim: "2026-09-30" };
    expect(esteveAtivoNoPeriodo({ Admissao: "2026-09-15T00:00:00" }, set)).toBe(
      true,
    );
    expect(esteveAtivoNoPeriodo({ Admissao: "2026-10-01T00:00:00" }, set)).toBe(
      false,
    );
    expect(
      esteveAtivoNoPeriodo(
        { Admissao: "2020-01-01", Demissao: "2026-09-01T00:00:00" },
        set,
      ),
    ).toBe(true);
    expect(
      esteveAtivoNoPeriodo(
        { Admissao: "2020-01-01", Demissao: "2026-08-31T00:00:00" },
        set,
      ),
    ).toBe(false);
  });

  it("sugere o tipo de turnover dos motivos conhecidos", () => {
    expect(tipoTurnoverSugerido("Pedido de demissão")).toBe("voluntario");
    expect(tipoTurnoverSugerido("Desligamento por parte da empresa")).toBe(
      "involuntario",
    );
    expect(tipoTurnoverSugerido("Motivo novo")).toBeNull();
  });

  it("sincroniza o mês corrente até ontem (hoje ainda está em andamento)", () => {
    expect(competenciasParaSincronizar(new Date(2026, 9, 19))).toEqual([
      {
        competencia: "2026-10-01",
        periodo: { inicio: "2026-10-01", fim: "2026-10-18" },
      },
    ]);
  });

  it("no começo do mês também refaz o mês anterior inteiro", () => {
    expect(competenciasParaSincronizar(new Date(2026, 2, 3))).toEqual([
      {
        competencia: "2026-02-01",
        periodo: { inicio: "2026-02-01", fim: "2026-02-28" },
      },
      {
        competencia: "2026-03-01",
        periodo: { inicio: "2026-03-01", fim: "2026-03-02" },
      },
    ]);
  });

  it("no dia 1, só o mês anterior (o corrente não tem dia completo)", () => {
    expect(competenciasParaSincronizar(new Date(2026, 0, 1))).toEqual([
      {
        competencia: "2025-12-01",
        periodo: { inicio: "2025-12-01", fim: "2025-12-31" },
      },
    ]);
  });

  it("competência manual vira o mês inteiro, sem passar de ontem", () => {
    const hoje = new Date(2026, 9, 19);
    expect(competenciaDoMes("2026-09", hoje)).toEqual({
      competencia: "2026-09-01",
      periodo: { inicio: "2026-09-01", fim: "2026-09-30" },
    });
    expect(competenciaDoMes("2026-10", hoje)).toEqual({
      competencia: "2026-10-01",
      periodo: { inicio: "2026-10-01", fim: "2026-10-18" },
    });
    expect(() => competenciaDoMes("2026-11", hoje)).toThrow(
      /não tem dia completo/,
    );
    expect(() => competenciaDoMes("09/2026", hoje)).toThrow();
  });
});
