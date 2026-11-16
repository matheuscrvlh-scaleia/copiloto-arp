import { describe, expect, it } from "vitest";
import type { Turnover } from "@/connectors/copiloto-rh/schemas";
import { tipoDoDesligamento, turnoverDaApi } from "./turnover";

const contagens = (
  p: Partial<Turnover["counts"]> = {},
): Turnover["counts"] => ({
  terminations: 0,
  voluntary: 0,
  involuntary: 0,
  agreement: 0,
  hires: 0,
  headcount_start: 0,
  headcount_end: 0,
  ...p,
});

// Formato da resposta de GET /v1/turnover (exemplo da documentação).
const resposta = (
  agreement_counts_as: Turnover["agreement_counts_as"],
): Turnover => ({
  period: { from: "2026-01-01", to: "2026-10-31" },
  agreement_counts_as,
  rates: { general: 2.86, voluntary: 1.43, involuntary: 1.43, agreement: null },
  counts: contagens({
    terminations: 4,
    voluntary: 2,
    involuntary: 2,
    hires: 6,
    headcount_start: 140,
    headcount_end: 142,
  }),
  monthly: [
    {
      month: "2026-01",
      from: "2026-01-01",
      to: "2026-01-31",
      rates: {
        general: 0.71,
        voluntary: 0.71,
        involuntary: 0,
        agreement: null,
      },
      counts: contagens({ terminations: 1, voluntary: 1, hires: 1 }),
    },
  ],
  by_department: [
    {
      department: { id: "d", name: "Financeiro" },
      active: 12,
      terminations: 2,
      rate: 14.29,
    },
    { department: null, active: 1, terminations: 0, rate: 0 },
  ],
});

describe("turnover do Copiloto", () => {
  it("tipo de cada desligamento: decisão antes do motivo, acordo primeiro", () => {
    expect(tipoDoDesligamento("pediu_pra_sair", "sem_justa_causa")).toBe(
      "voluntario",
    );
    expect(tipoDoDesligamento("foi_demitido", "pedido_demissao")).toBe(
      "involuntario",
    );
    expect(tipoDoDesligamento(null, "acordo_mutuo")).toBe("acordo");
    expect(tipoDoDesligamento("acordo_mutuo", null)).toBe("acordo");
    expect(tipoDoDesligamento(null, "aposentadoria_idade")).toBe("voluntario");
    expect(tipoDoDesligamento(null, "falecimento")).toBe("involuntario");
    expect(tipoDoDesligamento(null, null)).toBe("involuntario");
  });

  it("converte a resposta da API sem recalcular nada", () => {
    const t = turnoverDaApi(resposta("voluntary"));
    expect(t).toMatchObject({
      de: "2026-01-01",
      ate: "2026-10-31",
      acordoContaComo: "voluntario",
      turnover: 2.86,
      inicio: 140,
      fim: 142,
      admissoes: 6,
      desligamentos: 4,
      desligamentosPorTipo: { voluntario: 2, involuntario: 2, acordo: 0 },
    });
    expect(t.taxas.map((x) => [x.rotulo, x.valor])).toEqual([
      ["Turnover Geral", 2.86],
      ["Turnover Voluntário", 1.43],
      ["Turnover Involuntário", 1.43],
    ]);
    expect(t.mensal[0]).toMatchObject({
      competencia: "2026-01-01",
      turnover: 0.71,
      desligamentos: 1,
    });
    expect(t.porDepartamento.map((d) => d.nome)).toEqual([
      "Financeiro",
      "Sem departamento",
    ]);
  });

  it("acordo à parte vira o quarto tipo", () => {
    const r = resposta("separate");
    r.rates.agreement = 0.5;
    const t = turnoverDaApi(r);
    expect(t.acordoContaComo).toBe("separado");
    expect(t.taxas.at(-1)).toEqual({
      tipo: "acordo",
      rotulo: "Turnover por Acordo",
      valor: 0.5,
    });
  });
});
