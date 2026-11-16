import { describe, expect, it } from "vitest";
import {
  diasDoCalculo,
  horasEmMinutos,
  numeroBr,
  totaisDoCalculo,
} from "./calculo";

describe("horasEmMinutos", () => {
  it.each([
    ["08:48", 528],
    ["176:00", 10560],
    ["-12:30", -750],
    ["", 0],
    [null, 0],
  ])("%s → %d", (entrada, esperado) => {
    expect(horasEmMinutos(entrada)).toBe(esperado);
  });

  it("recusa formato desconhecido em vez de virar zero", () => {
    expect(() => horasEmMinutos("8h")).toThrow();
  });
});

describe("numeroBr", () => {
  it("lê vírgula decimal", () => {
    expect(numeroBr("1,50")).toBe(1.5);
    expect(numeroBr("")).toBe(0);
  });
});

describe("totaisDoCalculo", () => {
  it("lê os totais pelo nome da coluna, na ordem que vier", () => {
    const t = totaisDoCalculo({
      Colunas: [
        "Data",
        "Faltas",
        "Carga",
        "Abono2",
        "BSaldo",
        "FaltasDias",
        "Atras.",
      ],
      Linhas: [],
      Totais: ["", "08:00", "176:00", "04:00", "-02:15", "1,00", "00:30"],
    });
    expect(t).toEqual({
      previstas_min: 10560,
      normais_min: 0,
      faltas_min: 480,
      atrasos_min: 30,
      faltas_dias: 1,
      abonos_min: { Abono2: 240 },
      extras_min: {},
      noturnas_min: 0,
      dsr_debito_min: 0,
      banco_saldo_min: -135,
      banco_creditos_min: 0,
      banco_debitos_min: 0,
    });
  });

  it("guarda as horas extras por coluna, o noturno e o DSR descontado", () => {
    const t = totaisDoCalculo({
      Colunas: ["Data", "Ex80%", "Ex100%", "ExNot", "Not.", "DSR.Deb"],
      Linhas: [],
      Totais: ["", "03:10", "", "00:45", "01:00", "07:20"],
    });
    expect(t.extras_min).toEqual({ "Ex80%": 190, "Ex100%": 0, ExNot: 45 });
    expect(t.noturnas_min).toBe(60);
    expect(t.dsr_debito_min).toBe(440);
  });
});

describe("diasDoCalculo", () => {
  const COLUNAS = [
    "Data",
    "Entrada 1",
    "Saída 1",
    "Entrada 2",
    "Saída 2",
    "Entrada 3",
    "Saída 3",
    "Normais",
    "Faltas",
    "Ex80%",
    "Abono2",
    "Atras.",
    "Carga",
    "BSaldo",
    "BCred.",
  ];
  const linha = (data: string, valores: (string | null)[]) => ({
    Key: `${data}T00:00:00`,
    Value: [`${data} - Ter`, ...valores],
  });

  it("lê batidas, horas e banco de cada dia pelo nome da coluna", () => {
    const [dia] = diasDoCalculo({
      Colunas: COLUNAS,
      Linhas: [
        linha("2026-09-01", [
          "08:02",
          "12:00",
          "13:01",
          "18:30",
          null,
          null,
          "08:00",
          null,
          "00:30",
          "",
          "00:02",
          "08:00",
          "-03:37",
          "00:28",
        ]),
      ],
      Totais: [],
    });
    expect(dia).toEqual({
      data: "2026-09-01",
      batidas: ["08:02", "12:00", "13:01", "18:30"],
      ocorrencia: null,
      previstas_min: 480,
      normais_min: 480,
      faltas_min: 0,
      atrasos_min: 2,
      abonos_min: { Abono2: 0 },
      extras_min: { "Ex80%": 30 },
      noturnas_min: 0,
      banco_saldo_min: -217,
      banco_creditos_min: 28,
      banco_debitos_min: 0,
    });
  });

  it("separa a justificativa das batidas e mantém a posição do par incompleto", () => {
    const [folga, impar] = diasDoCalculo({
      Colunas: COLUNAS,
      Linhas: [
        linha("2026-09-05", [...Array(6).fill("FOLGA"), ...Array(8).fill("")]),
        linha("2026-09-08", [
          "08:00",
          null,
          "13:00",
          "17:00",
          ...Array(10).fill(null),
        ]),
      ],
      Totais: [],
    });
    expect(folga?.batidas).toEqual([]);
    expect(folga?.ocorrencia).toBe("FOLGA");
    expect(impar?.batidas).toEqual(["08:00", null, "13:00", "17:00"]);
    expect(impar?.ocorrencia).toBeNull();
  });
});
