import { describe, expect, it } from "vitest";
import type { LinhaPonto } from "./calculos";
import {
  avisoDoPonto,
  type DiaDoPonto,
  juntarPonto,
  planejarPonto,
  somarDias,
} from "./ponto-periodo";

const dia = (data: string, p: Partial<DiaDoPonto> = {}): DiaDoPonto => ({
  colaborador_id: "a",
  nome: "Ana",
  matricula: 1,
  departamento_id: "d1",
  departamento: "Adm",
  data,
  previstas_min: 480,
  faltas_min: 0,
  atrasos_min: 0,
  abonos_min: {},
  extras_min: {},
  noturnas_min: 0,
  banco_saldo_min: 0,
  banco_creditos_min: 0,
  banco_debitos_min: 0,
  ...p,
});

const linha = (p: Partial<LinhaPonto> = {}): LinhaPonto => ({
  colaborador_id: "a",
  nome: "Ana",
  matricula: 1,
  departamento_id: "d1",
  departamento: "Adm",
  previstas_min: 0,
  faltas_min: 0,
  atrasos_min: 0,
  faltas_dias: 0,
  abonos_min: {},
  banco_saldo_min: 0,
  banco_creditos_min: 0,
  banco_debitos_min: 0,
  ...p,
});

describe("ponto de um período", () => {
  it("mês inteiro pelo total; pedaço de mês pelos dias; nada depois de ontem", () => {
    expect(
      planejarPonto({ de: "2026-08-15", ate: "2026-10-21" }, "2026-10-20"),
    ).toEqual({
      efetivo: { de: "2026-08-15", ate: "2026-10-20" },
      meses: ["2026-09-01", "2026-10-01"], // outubro: total até ontem
      trechos: [
        { competencia: "2026-08-01", de: "2026-08-15", ate: "2026-08-31" },
      ],
    });
    expect(
      planejarPonto({ de: "2026-10-13", ate: "2026-10-19" }, "2026-10-20"),
    ).toMatchObject({
      meses: [],
      trechos: [{ de: "2026-10-13", ate: "2026-10-19" }],
    });
    // Hoje: nenhum dia fechado ainda.
    expect(
      planejarPonto({ de: "2026-10-21", ate: "2026-10-21" }, "2026-10-20"),
    ).toEqual({ efetivo: null, meses: [], trechos: [] });
  });

  it("soma os dias; saldo do banco é o do último dia", () => {
    const [l] = somarDias([
      dia("2026-10-14", {
        ocorrencia: "FALTA",
        faltas_min: 480,
        banco_saldo_min: 100,
        banco_creditos_min: 30,
        abonos_min: { Abono2: 60 },
      }),
      dia("2026-10-13", {
        faltas_min: 120, // só uma parte: não conta como dia de falta
        atrasos_min: 15,
        banco_saldo_min: 70,
        banco_creditos_min: 20,
        abonos_min: { Abono2: 30 },
      }),
    ]);
    expect(l).toMatchObject({
      previstas_min: 960,
      faltas_min: 600,
      atrasos_min: 15,
      faltas_dias: 1,
      banco_saldo_min: 100,
      banco_creditos_min: 50,
      abonos_min: { Abono2: 90 },
    });
  });

  it("junta meses e trechos em ordem", () => {
    const [l] = juntarPonto([
      [linha({ faltas_min: 60, banco_saldo_min: 10, departamento: "Velho" })],
      [linha({ faltas_min: 30, banco_saldo_min: -5, departamento: "Novo" })],
    ]);
    expect(l).toMatchObject({
      faltas_min: 90,
      banco_saldo_min: -5,
      departamento: "Novo",
    });
  });

  it("avisa sem inventar zero", () => {
    expect(
      avisoDoPonto({ linhas: [], efetivo: null, semDias: [] }).semDado,
    ).toMatch(/amanhã/);
    const semDias = {
      linhas: [],
      efetivo: { de: "2026-09-10", ate: "2026-09-20" },
      semDias: [
        { competencia: "2026-09-01", de: "2026-09-10", ate: "2026-09-20" },
      ],
    };
    expect(avisoDoPonto(semDias).semDado).toMatch(/meses inteiros/);
    const parcial = { ...semDias, linhas: [linha()] };
    expect(avisoDoPonto(parcial)).toEqual({
      semDado: null,
      parcial: "Fora do total: 10/09/2026 a 20/09/2026 (sem o ponto dia a dia)",
    });
  });
});
