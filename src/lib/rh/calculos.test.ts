import { describe, expect, it } from "vitest";
import {
  absenteismo,
  ativosEm,
  type ColaboradorQuadro,
  formatarTempoDeCasa,
  type LinhaPonto,
  mesesDeCasa,
  movimentoDoMes,
  porSetor,
  somarPonto,
} from "./calculos";

const ponto = (p: Partial<LinhaPonto>): LinhaPonto => ({
  colaborador_id: "x",
  nome: "X",
  matricula: 1,
  departamento_id: "adm",
  departamento: "Administração",
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

describe("jornada", () => {
  it("absenteísmo = (faltas + atrasos) ÷ previstas, sem abono", () => {
    expect(
      absenteismo({ previstas_min: 10_000, faltas_min: 480, atrasos_min: 20 }),
    ).toBe(5);
    expect(
      absenteismo({ previstas_min: 0, faltas_min: 0, atrasos_min: 0 }),
    ).toBeNull();
  });

  it("soma separa banco positivo (passivo) e negativo", () => {
    const t = somarPonto([
      ponto({
        previstas_min: 10_000,
        faltas_min: 500,
        abonos_min: { Abono2: 60, Abono3: 30 },
        banco_saldo_min: 120,
      }),
      ponto({ previstas_min: 10_000, atrasos_min: 500, banco_saldo_min: -300 }),
    ]);
    expect(t.absenteismo).toBe(5);
    expect(t.abonos_min).toBe(90);
    expect(t.banco_saldo_min).toBe(-180);
    expect(t.banco_positivo_min).toBe(120);
    expect(t.banco_negativo_min).toBe(-300);
  });

  it("agrupa por setor e ordena pelo maior absenteísmo", () => {
    const setores = porSetor([
      ponto({ departamento_id: "adm", previstas_min: 1000, faltas_min: 10 }),
      ponto({
        departamento_id: "est",
        departamento: "Estacionamento",
        previstas_min: 1000,
        faltas_min: 100,
      }),
      ponto({ departamento_id: "adm", previstas_min: 1000, faltas_min: 30 }),
    ]);
    expect(
      setores.map((s) => [s.departamento, s.colaboradores, s.absenteismo]),
    ).toEqual([
      ["Estacionamento", 1, 10],
      ["Administração", 2, 2],
    ]);
  });
});

const pessoa = (p: Partial<ColaboradorQuadro>): ColaboradorQuadro => ({
  id: "x",
  nome: "X",
  matricula: null,
  departamento_id: null,
  departamento: "",
  admissao: "2020-01-01",
  desligamento: null,
  tipo_turnover: null,
  ...p,
});

describe("quadro e turnover", () => {
  it("ativo no dia: admitido até ele e não desligado até ele", () => {
    const cs = [
      pessoa({ admissao: "2026-09-15" }),
      pessoa({ admissao: "2026-01-01", desligamento: "2026-09-10" }),
      pessoa({ admissao: null }),
    ];
    expect(ativosEm(cs, "2026-09-10").length).toBe(0);
    expect(ativosEm(cs, "2026-09-09").length).toBe(1);
    expect(ativosEm(cs, "2026-09-30").length).toBe(1);
  });

  it("movimento do mês e turnover; efetivação não conta como saída", () => {
    const cs = [
      ...Array.from({ length: 10 }, () => pessoa({})),
      pessoa({ admissao: "2026-09-05" }),
      pessoa({ admissao: "2026-09-12" }),
      pessoa({ desligamento: "2026-09-20", tipo_turnover: "voluntario" }),
      pessoa({ desligamento: "2026-09-25", tipo_turnover: "efetivacao" }),
    ];
    const m = movimentoDoMes(cs, "2026-09-01");
    expect(m).toMatchObject({
      inicio: 12,
      fim: 12,
      admissoes: 2,
      desligamentos: 1,
      efetivacoes: 1,
      desligamentosPorTipo: { voluntario: 1, efetivacao: 1 },
    });
    // ((2 + 1) ÷ 2) ÷ 12 × 100
    expect(m.turnover).toBeCloseTo(12.5);
  });

  it("tempo de casa", () => {
    expect(mesesDeCasa("2024-04-20", "2026-10-19")).toBe(29);
    expect(mesesDeCasa("2024-04-19", "2026-10-19")).toBe(30);
    expect(formatarTempoDeCasa(29)).toBe("2a 5m");
    expect(formatarTempoDeCasa(5)).toBe("5 meses");
    expect(formatarTempoDeCasa(24)).toBe("2 anos");
  });
});
