import { describe, expect, it } from "vitest";
import {
  absenteismo,
  ativosEm,
  type ColaboradorQuadro,
  EXTRAS_SEM_DIVISAO,
  extrasDe,
  formatarTempoDeCasa,
  type LinhaPonto,
  mesesDeCasa,
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

  it("tempo de casa", () => {
    expect(mesesDeCasa("2024-04-20", "2026-10-19")).toBe(29);
    expect(mesesDeCasa("2024-04-19", "2026-10-19")).toBe(30);
    expect(formatarTempoDeCasa(29)).toBe("2a 5m");
    expect(formatarTempoDeCasa(5)).toBe("5 meses");
    expect(formatarTempoDeCasa(24)).toBe("2 anos");
  });
});

describe("horas extras do ponto", () => {
  it("horário com percentuais: soma os percentuais; ExNot é parte, ExInt à parte", () => {
    const e = extrasDe({
      extras_min: { "Ex80%": 120, "Ex100%": 30, ExNot: 60, ExInt: 15 },
    });
    expect(e).toEqual({
      total: 150,
      porTipo: { "Ex80%": 120, "Ex100%": 30 },
      noturnas: 60,
      intervalo: 15,
    });
  });

  it("horário sem divisão: usa a coluna Extras, sem contar ExNot de novo", () => {
    const e = extrasDe({ extras_min: { Extras: 135, ExNot: 135, ExInt: 0 } });
    expect(e.total).toBe(135);
    expect(e.porTipo).toEqual({ [EXTRAS_SEM_DIVISAO]: 135 });
  });

  it("sem colunas de extra, zero", () => {
    expect(extrasDe({}).total).toBe(0);
  });
});
