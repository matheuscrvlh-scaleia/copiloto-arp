import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it } from "vitest";
import {
  abasDoExcel,
  diferencasComPlanilha,
  type LeituraHistorico,
  lerHistoricoDoRateio,
  mesDaAba,
  paraPrevia,
  previaSchema,
  resumoDaLeitura,
  valorDaCelula,
} from "./limpeza-planilha";

// Planilha sintética no layout real da "RATEIO BS E MANUTENÇÃO" (spec 4.8):
// células fixas, valores gravados como fórmula com o resultado calculado
// (como o Excel salva), extras em texto livre em A13:B40. Sem a planilha
// real no repositório (tem dados do cliente), o arquivo é gerado aqui.

const BLOCOS = ["01", "02", "04", "05", "09", "10", "11"];
const ROTULOS = ["BL1", "BL2", "BL4", "BL5", "BL09", "BL10", "BL11"];

interface Aba {
  nome: string;
  apontamento: string;
  base: number;
  funcBase: number;
  funcAc: number;
  funcRat: number;
  /** Soma dos extras que entram na área comum. */
  extras: number;
  /** [limpeza, manutenção] por bloco; null = vazio. */
  minutos: ([number, number] | null)[];
  bl04NaAreaComum: boolean;
  pares: [string, number][];
}

const SETEMBRO_MIN: [number, number][] = [
  [131, 73],
  [67, 74],
  [229, 150],
  [295, 226],
  [152, 114],
  [178, 115],
  [167, 148],
];

/** Monta a aba como o Excel calcularia (ponto flutuante, sem arredondar). */
function escreverAba(livro: ExcelJS.Workbook, a: Aba) {
  const ws = livro.addWorksheet(a.nome);
  const vf = a.base / a.funcBase;
  ws.getCell("E2").value = a.apontamento;
  ws.getCell("E3").value = a.funcBase;
  ws.getCell("F3").value = { formula: "G3/E3", result: vf };
  ws.getCell("G3").value = a.base;
  const totalMin = a.minutos.reduce((s, m) => s + (m ? m[0] + m[1] : 0), 0);
  const blocos = a.minutos.map((m) =>
    m && totalMin > 0 ? ((m[0] + m[1]) / totalMin) * a.funcRat * vf : null,
  );
  const ac = a.funcAc * vf + a.extras;
  const bl04 = blocos[2] ?? 0;
  ws.getCell("E4").value = a.bl04NaAreaComum
    ? "ÁREA COMUM + BL04"
    : "ÁREA COMUM";
  ws.getCell("F4").value = {
    formula: "F3*5+SOMA(B13:B40)",
    result: a.bl04NaAreaComum ? ac + bl04 : ac,
  };
  ROTULOS.forEach((r, i) => {
    const l = 5 + i;
    const m = a.minutos[i];
    ws.getCell(`E${l}`).value = r;
    ws.getCell(`F${l}`).value =
      totalMin > 0
        ? { formula: `K${l}*F3*4`, result: blocos[i] as number }
        : { formula: `K${l}*F3*4`, result: { error: "#DIV/0!" } };
    ws.getCell(`H${l}`).value = m ? m[0] : null;
    ws.getCell(`I${l}`).value = m ? m[1] : null;
  });
  const somaBlocos = blocos.reduce<number>((s, v) => s + (v ?? 0), 0);
  ws.getCell("F12").value =
    totalMin > 0
      ? {
          formula: "SOMA(F4:F11)",
          result: a.bl04NaAreaComum
            ? ac + bl04 + somaBlocos - bl04
            : ac + somaBlocos,
        }
      : { formula: "SOMA(F4:F11)", result: { error: "#DIV/0!" } };
  a.pares.forEach(([d, v], i) => {
    ws.getCell(`A${13 + i}`).value = d;
    ws.getCell(`B${13 + i}`).value = v;
  });
}

const setembro: Aba = {
  nome: "BS 25.09.26",
  apontamento: "BLACK STAR COM APONTAMENTO 09.2026",
  base: 35323.94,
  funcBase: 9,
  funcAc: 5,
  funcRat: 4,
  extras: 22459.67,
  minutos: SETEMBRO_MIN,
  bl04NaAreaComum: false,
  pares: [
    ["Insalub. Espaço Pet", 278.68],
    ["Limpeza banheiros", 3897],
    ["quantidade", 4],
    ["Vigia diária", 315],
    ["dias cobrados", 8],
    ["Insalub. limpeza banheiro", 2497.99],
    ["Limp. extra banheiros dom/feriados", 315],
    ["dias", 5],
    ["Vigia extra caixa do estacionamento", 3589],
  ],
};

// Novembro/2025: regra antiga, total da spec (51.190,62).
const novembro: Aba = {
  nome: "BS 20.11.25",
  apontamento: "BLACK STAR COM APONTAMENTO 11.2025",
  base: 35323.94,
  funcBase: 9,
  funcAc: 5,
  funcRat: 4,
  extras: 15866.68,
  minutos: SETEMBRO_MIN,
  bl04NaAreaComum: true,
  pares: [
    ["Insalub. Espaço Pet", 278.68],
    ["Limpeza 3.897,00 x 4", 15588],
    ["Total extras", 15866.68],
  ],
};

const junho: Aba = {
  nome: "BS 25.06.26 ",
  apontamento: "BLACK STAR COM APONTAMENTO 06.2026",
  base: 35323.94,
  funcBase: 9,
  funcAc: 5,
  funcRat: 4,
  extras: 15866.68,
  minutos: BLOCOS.map(() => null),
  bl04NaAreaComum: false,
  pares: [
    ["Insalub. Espaço Pet", 278.68],
    ["Limpeza", 15588],
  ],
};

let leitura: LeituraHistorico;

beforeAll(async () => {
  const livro = new ExcelJS.Workbook();
  livro.addWorksheet("BS Principal").getCell("E3").value = 7;
  escreverAba(livro, novembro);
  // Dezembro em duas abas: vale a revisada.
  escreverAba(livro, {
    ...setembro,
    nome: "BS 20.12.25",
    base: 30000,
    pares: [["Insalub. Espaço Pet", 278.68]],
    extras: 278.68,
  });
  escreverAba(livro, {
    ...setembro,
    nome: "BS 20.12.25 REV",
    pares: setembro.pares.slice(0, 8),
  });
  escreverAba(livro, junho);
  escreverAba(livro, setembro);
  livro.addWorksheet("BS Evolutivo");
  livro.addWorksheet("Programação BS");
  const bytes = new Uint8Array(await livro.xlsx.writeBuffer());
  leitura = lerHistoricoDoRateio(await abasDoExcel(bytes), {
    blocos: BLOCOS,
    funcAreaComum: 5,
    funcRateados: 4,
  });
});

const mes = (ref: string) => {
  const m = leitura.meses.find((x) => x.referencia === ref);
  if (!m) throw new Error(`sem ${ref}`);
  return m;
};

describe("nome da aba", () => {
  it("mês e ano do nome, com ano de 2 ou 4 dígitos, espaço e REV", () => {
    expect(mesDaAba("BS 25.09.26")).toEqual({
      referencia: "2026-09-01",
      dia: 25,
      revisada: false,
    });
    expect(mesDaAba("BS 17.01.2022")?.referencia).toBe("2022-01-01");
    expect(mesDaAba("BS 20.12.25 REV")).toEqual({
      referencia: "2025-12-01",
      dia: 20,
      revisada: true,
    });
    expect(mesDaAba("BS 25.06.26 ")?.referencia).toBe("2026-06-01");
    expect(mesDaAba("BS Principal")).toBeNull();
    expect(mesDaAba("BS 20.13.25")).toBeNull();
  });
});

describe("importação do histórico (planilha sintética no layout real)", () => {
  it("uma aba por mês; ignora Principal, Evolutivo, Programação e a repetida", () => {
    expect(leitura.meses.map((m) => m.referencia)).toEqual([
      "2025-11-01",
      "2025-12-01",
      "2026-06-01",
      "2026-09-01",
    ]);
    expect(mes("2025-12-01").aba).toBe("BS 20.12.25 REV");
    expect(leitura.ignoradas.map((i) => i.aba).sort()).toEqual(
      ["BS 20.12.25", "BS Evolutivo", "BS Principal", "Programação BS"].sort(),
    );
  });

  it("set/26: 57.783,61, Bloco 04 separado, conta refeita igual à aba", () => {
    const m = mes("2026-09-01");
    expect(m.regraBl04).toBe("separado");
    expect(m.totalPlanilha).toBe(5778361);
    expect(m.totalConta).toBe(5778361);
    expect(m.diferencas).toEqual([]);
    expect(m.incompleto).toBe(false);
    expect([m.valorBase, m.funcBase, m.funcAreaComum, m.funcRateados]).toEqual([
      3532394, 9, 5, 4,
    ]);
    expect(m.apontamento).toBe("BLACK STAR COM APONTAMENTO 09.2026");
    expect(m.minutos.map((x) => x.bloco)).toEqual(BLOCOS);
    expect(m.planilha.blocos).toEqual({
      "01": 1511.42,
      "02": 1044.66,
      "04": 2807.99,
      "05": 3860.05,
      "09": 1970.78,
      "10": 2170.82,
      "11": 2333.81,
    });
    expect(m.planilha.area_comum).toBe(42084.08);
  });

  it("set/26: extras com quantidade × valor por dia e a anotação fora da soma", () => {
    const m = mes("2026-09-01");
    expect(
      m.extras.map((x) => [
        x.descricao,
        x.quantidade,
        x.valorUnitario,
        x.valor,
      ]),
    ).toEqual([
      ["Insalub. Espaço Pet", null, null, 27868],
      ["Limpeza banheiros", 4, 389700, 1558800],
      ["Vigia diária", 8, 31500, 252000],
      ["Insalub. limpeza banheiro", null, null, 249799],
      ["Limp. extra banheiros dom/feriados", 5, 31500, 157500],
    ]);
    expect(m.planilha.fora_da_soma).toEqual([
      { descricao: "Vigia extra caixa do estacionamento", valor: 3589 },
    ]);
    expect(m.planilha.extras_lidos).toHaveLength(9);
    expect(m.avisos.some((a) => a.mensagem.includes("fora da soma"))).toBe(
      true,
    );
  });

  it("nov/25: 51.190,62 com o Bloco 04 dentro da área comum", () => {
    const m = mes("2025-11-01");
    expect(m.regraBl04).toBe("area_comum");
    expect(m.totalPlanilha).toBe(5119062);
    expect(m.totalConta).toBe(5119062);
    expect(m.diferencas).toEqual([]);
    // A área comum da aba já tem o Bloco 04.
    expect(m.planilha.area_comum).toBeCloseTo(
      (35323.94 / 9) * 5 + 15866.68 + 2807.99,
      2,
    );
    expect(m.extras.map((x) => x.valor)).toEqual([27868, 1558800]);
    expect(m.planilha.fora_da_soma).toEqual([
      { descricao: "Total extras", valor: 15866.68 },
    ]);
  });

  it("jun/26: minutos vazios e #DIV/0! → incompleto, sem comparação", () => {
    const m = mes("2026-06-01");
    expect(m.incompleto).toBe(true);
    expect(m.motivoIncompleto).toContain("minutos vazios");
    expect(m.motivoIncompleto).toContain("#DIV/0!");
    expect(m.totalPlanilha).toBeNull();
    expect(m.totalConta).toBeNull();
    expect(m.planilha.erros).toContain("F12: #DIV/0!");
    expect(m.diferencas).toEqual([]);
  });

  it("resumo da prévia", () => {
    const r = resumoDaLeitura(leitura);
    expect(r).toMatchObject({
      abas: 8,
      meses: 4,
      incompletos: ["2026-06-01"],
      total_diferente: [],
      periodo: "nov/2025 a set/2026",
    });
  });

  it("prévia: mês que já existe fica de fora, com aviso; formato validado", () => {
    const entram = leitura.meses.filter((m) => m.referencia !== "2026-09-01");
    const p = paraPrevia(leitura, entram, ["2026-09-01"], "rateio.xlsx");
    expect(p.resumo.meses).toBe(3);
    expect(p.resumo.ja_existiam).toEqual(["2026-09-01"]);
    expect(p.resumo.lista.map((m) => m.referencia)).toEqual([
      "2025-11-01",
      "2025-12-01",
      "2026-06-01",
    ]);
    expect(p.bate).toBe(true);
    expect(p.avisos[0]?.mensagem).toContain("set/2026 já está no rateio");
    expect(p.avisos.some((a) => a.aba === "BS 25.09.26")).toBe(false);
    expect(previaSchema.safeParse({ ...p, id: "x" }).success).toBe(true);
  });

  it("aba só com o total: incompleta, sem comparar", () => {
    const aba = {
      nome: "BS 25.09.26",
      celula: (end: string) => {
        if (end === "F12") return 57790;
        return null;
      },
    };
    const l = lerHistoricoDoRateio([aba], {
      blocos: BLOCOS,
      funcAreaComum: 5,
      funcRateados: 4,
    });
    // Sem os outros dados a aba é incompleta: não compara.
    expect(l.meses[0]?.incompleto).toBe(true);
  });

  it("conta diferente da aba: aviso e diferença no total", async () => {
    const livro = new ExcelJS.Workbook();
    escreverAba(livro, setembro);
    const ws = livro.getWorksheet("BS 25.09.26");
    if (!ws) throw new Error("sem aba");
    ws.getCell("F12").value = { formula: "SOMA(F4:F11)", result: 57800 };
    const l = lerHistoricoDoRateio(
      await abasDoExcel(new Uint8Array(await livro.xlsx.writeBuffer())),
      { blocos: BLOCOS, funcAreaComum: 5, funcRateados: 4 },
    );
    const m = l.meses[0];
    expect(m?.diferencas).toEqual([
      { local: "total", planilha: 5780000, conta: 5778361 },
    ]);
    expect(
      m?.avisos.some(
        (a) => a.mensagem === "Total: aba 57.800,00, conta refeita 57.783,61.",
      ),
    ).toBe(true);
    expect(resumoDaLeitura(l).total_diferente).toEqual(["2026-09-01"]);
  });

  it("arquivo sem nenhuma aba de mês é erro", () => {
    const l = lerHistoricoDoRateio([{ nome: "Plan1", celula: () => null }], {
      blocos: BLOCOS,
      funcAreaComum: 5,
      funcRateados: 4,
    });
    expect(l.meses).toEqual([]);
    expect(l.avisos[0]?.nivel).toBe("erro");
  });
});

describe("valor da célula do exceljs", () => {
  it("fórmula vira o resultado; erro, texto rico e vazio", () => {
    expect(valorDaCelula({ formula: "A1", result: 3 })).toBe(3);
    expect(
      valorDaCelula({ formula: "A1", result: { error: "#DIV/0!" } }),
    ).toEqual({ erro: "#DIV/0!" });
    expect(valorDaCelula({ richText: [{ text: "BL" }, { text: "09" }] })).toBe(
      "BL09",
    );
    expect(valorDaCelula(undefined)).toBeNull();
    expect(valorDaCelula({ formula: "A1" })).toBeNull();
  });
});

describe("comparar a conta com a aba guardada", () => {
  it("só o que passa da tolerância; formato inválido não compara", () => {
    expect(
      diferencasComPlanilha(
        {
          area_comum: 42084.08,
          total: 57783.62,
          blocos: { "01": 1511.43, "02": 1044.6 },
        },
        { area_comum: 4208408, total: 5778361, "01": 151142, "02": 104466 },
      ),
    ).toEqual([
      { local: "total", planilha: 5778362, conta: 5778361 },
      { local: "02", planilha: 104460, conta: 104466 },
    ]);
    expect(diferencasComPlanilha(null, { total: 1 })).toEqual([]);
    expect(diferencasComPlanilha("x", { total: 1 })).toEqual([]);
  });
});
