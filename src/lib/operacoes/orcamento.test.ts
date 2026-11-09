import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  type Aba,
  lerOrcamento,
  mesDaCelula,
  mesesNoTexto,
  type OrcamentoLido,
  obraDoTitulo,
  revisaoNoTexto,
} from "./orcamento";
import { abasDoXlsx } from "./orcamento-planilha";

// Planilha sintética no formato descrito na spec 4.9 (nomes e valores
// fictícios): título, revisão e data no topo, coluna "Real. até 06/26",
// meses como data do Excel e um "02/12/2026" escrito entre dez/26 e fev/27,
// linha de subtotal, total escrito com 3 centavos de diferença e uma linha
// sem rótulo depois do total.

const utc = (a: number, m: number) => new Date(Date.UTC(a, m - 1, 1));

async function planilhaModelo(): Promise<Uint8Array> {
  const livro = new ExcelJS.Workbook();
  const ws = livro.addWorksheet("Prev Orçamentária");
  ws.getCell("A1").value =
    "Estimativa de custo e desembolso para execução do edifício modelo – Condomínio Exemplo";
  ws.getCell("A2").value = "Revisão R00 de 14/07/2026";
  ws.getCell("A3").value = "Previsto de jul/2026 a dez/2026";
  const cab: ExcelJS.CellValue[] = [
    "Etapa",
    "Real. até 06/26",
    utc(2026, 7),
    utc(2026, 8),
    utc(2026, 9),
    utc(2026, 10),
    utc(2026, 11),
    utc(2026, 12),
    "02/12/2026",
    utc(2027, 2),
    "mar/27",
    "Total",
  ];
  ws.getRow(4).values = cab;
  ws.getRow(5).values = [
    "Térreo",
    100000,
    50000,
    25000.1,
    25000.1,
    null,
    null,
    null,
    null,
    null,
    null,
    200000.2,
  ];
  ws.getRow(6).values = ["Pavimento 1", 80000, ...Array(9).fill(null), 80000];
  ws.getRow(7).values = [
    "Pavimento 2",
    null,
    null,
    null,
    null,
    10000.33,
    10000.33,
    "10.000,33",
    null,
    null,
    null,
    30000.99,
  ];
  ws.getRow(8).values = [
    "Pavimento 3",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    5000,
    5000,
    null,
    10000,
  ];
  ws.getRow(9).values = [
    "Casa de máquinas",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    "contratação extra após projeto",
    null,
  ];
  ws.getRow(10).values = [
    "Subtotal",
    ...Array(10).fill(null),
    { formula: "SUM(L5:L9)", result: 320001.19 },
  ];
  ws.getRow(11).values = [
    "TOTAL",
    ...Array(10).fill(null),
    { formula: "L10-0.03", result: 320001.16 },
  ];
  ws.getRow(13).values = [null, 300000, 20001.16];
  return new Uint8Array(await livro.xlsx.writeBuffer());
}

async function lerModelo(
  meses?: Record<string, string>,
  arquivo = "orcamento.xlsx",
) {
  const r = lerOrcamento(await abasDoXlsx(await planilhaModelo()), {
    arquivo,
    meses,
  });
  if ("erro" in r) throw new Error(r.erro);
  return r.ok;
}

const etapa = (o: OrcamentoLido, nome: string) => {
  const e = o.etapas.find((x) => x.nome === nome);
  if (!e) throw new Error(`etapa ${nome}`);
  return e;
};
const avisoCom = (o: OrcamentoLido, trecho: string) =>
  o.avisos.find((a) => a.mensagem.includes(trecho));

describe("lerOrcamento: planilha no formato da spec", () => {
  it("lê título, obra, revisão, data, etapas e totais em centavos", async () => {
    const o = await lerModelo({ I: "2027-01-01" });
    expect(o.titulo).toContain("edifício modelo");
    expect(o.obra).toBe("Edifício modelo");
    expect(o.revisao).toBe("R00");
    expect(o.data).toBe("2026-07-14");
    expect(o.etapas.map((e) => e.nome)).toEqual([
      "Térreo",
      "Pavimento 1",
      "Pavimento 2",
      "Pavimento 3",
      "Casa de máquinas",
    ]);
    expect(o.totalEtapas).toBe(32_000_119);
    expect(o.totalArquivo).toBe(32_000_116);
    expect(o.diferenca).toBe(-3);
    expect(avisoCom(o, "difere do total da planilha")?.mensagem).toContain(
      "R$ -0,03",
    );
    expect(o.periodo).toEqual({ de: "2026-06-01", ate: "2027-02-01" });
  });

  it("o realizado da planilha entra no previsto (orçamento total) e à parte como realizado", async () => {
    const o = await lerModelo({ I: "2027-01-01" });
    const terreo = etapa(o, "Térreo");
    expect(terreo.realizado).toEqual([
      { mes: "2026-06-01", centavos: 10_000_000 },
    ]);
    expect(terreo.previsto).toEqual([
      { mes: "2026-06-01", centavos: 10_000_000 },
      { mes: "2026-07-01", centavos: 5_000_000 },
      { mes: "2026-08-01", centavos: 2_500_010 },
      { mes: "2026-09-01", centavos: 2_500_010 },
    ]);
    expect(o.totalRealizado).toBe(18_000_000);
    expect(o.realizadoAte).toBe("2026-06-01");
  });

  it("valor escrito como texto (10.000,33) vale como número", async () => {
    const o = await lerModelo({ I: "2027-01-01" });
    expect(etapa(o, "Pavimento 2").previsto.at(-1)).toEqual({
      mes: "2026-12-01",
      centavos: 1_000_033,
    });
  });

  it("“02/12/2026” entre dez/26 e fev/27 fica pendente, com jan/27 sugerido", async () => {
    const o = await lerModelo();
    expect(o.pendentes).toHaveLength(1);
    const col = o.pendentes[0];
    expect(col).toMatchObject({
      coluna: "I",
      texto: "02/12/2026",
      lido: "2026-12-01",
      problema: "repetido",
      sugestao: "2027-01-01",
      antes: "2026-12-01",
      depois: "2027-02-01",
      escolhido: false,
    });
    expect(avisoCom(o, "Escolha o mês certo")?.nivel).toBe("aviso");
  });

  it("com o mês escolhido na prévia, não há pendência e o aviso vira registro", async () => {
    const o = await lerModelo({ I: "2027-01-01" });
    expect(o.pendentes).toEqual([]);
    expect(etapa(o, "Pavimento 3").previsto).toEqual([
      { mes: "2027-01-01", centavos: 500_000 },
      { mes: "2027-02-01", centavos: 500_000 },
    ]);
    const a = avisoCom(o, "escolhido na prévia");
    expect(a?.nivel).toBe("info");
    expect(a?.mensagem).toContain("jan/2027");
  });

  it("escolher um mês que já tem coluna é recusado", async () => {
    const r = lerOrcamento(await abasDoXlsx(await planilhaModelo()), {
      meses: { I: "2026-12-01" },
    });
    expect(r).toEqual({
      erro: expect.stringContaining("dez/2026 ficou em duas colunas"),
    });
  });

  it("etapa sem valor, texto em mês, mês fora do intervalo e linha sem rótulo viram avisos", async () => {
    const o = await lerModelo({ I: "2027-01-01" });
    expect(etapa(o, "Casa de máquinas")).toMatchObject({
      observacao: "contratação extra após projeto",
      previsto: [],
    });
    expect(avisoCom(o, "Casa de máquinas: etapa sem valor")?.nivel).toBe(
      "aviso",
    );
    expect(
      avisoCom(o, "“contratação extra após projeto” em mar/2027"),
    ).toBeTruthy();
    expect(
      avisoCom(o, "Pavimento 3: previsto fora do intervalo")?.mensagem,
    ).toContain("jan/2027, fev/2027");
    expect(avisoCom(o, "A linha 13 tem valores sem nome")?.nivel).toBe("info");
    // O subtotal escrito bate com as etapas de cima: sem aviso.
    expect(avisoCom(o, "Subtotal")).toBeUndefined();
  });

  it("revisão do nome do arquivo quando a planilha não diz; conflito avisa", async () => {
    const abas = await abasDoXlsx(await planilhaModelo());
    const semRev: Aba[] = abas.map((a) => ({
      ...a,
      linhas: a.linhas.map((l, i) => (i === 1 ? l.map(() => null) : l)),
    }));
    const r = lerOrcamento(semRev, {
      arquivo: "Prev_Orçamentária-ARP-R01.xlsx",
      meses: { I: "2027-01-01" },
    });
    expect("ok" in r && r.ok.revisao).toBe("R01");
    const o = await lerModelo({ I: "2027-01-01" }, "orcamento-R02.xlsx");
    expect(o.revisao).toBe("R00");
    expect(avisoCom(o, "vale o que está na planilha")).toBeTruthy();
  });

  it("sem linha de meses: erro claro", () => {
    expect(
      lerOrcamento([
        {
          nome: "x",
          linhas: [
            ["Etapa", "Valor"],
            ["A", 1],
          ],
        },
      ]),
    ).toEqual({ erro: expect.stringContaining("linha dos meses") });
  });
});

describe("lerOrcamento: faixas REALIZADO e PREVISTO mescladas acima dos meses", () => {
  it("as colunas sob REALIZADO entram como realizado de cada mês", async () => {
    const livro = new ExcelJS.Workbook();
    const ws = livro.addWorksheet("Cronograma");
    ws.getCell("B1").value = "Obra: Guarita modelo";
    ws.getCell("C2").value = "REALIZADO";
    ws.mergeCells("C2:D2");
    ws.getCell("E2").value = "PREVISTO";
    ws.mergeCells("E2:F2");
    ws.getRow(3).values = [
      "Item",
      "Etapa",
      "mai/26",
      "jun/26",
      "jul/26",
      "ago/26",
    ];
    ws.getRow(4).values = [1, "Fundação", 1000, 2000, 3000, null];
    ws.getRow(5).values = [2, "Estrutura", null, null, 1500.5, 1500.5];
    const r = lerOrcamento(
      await abasDoXlsx(new Uint8Array(await livro.xlsx.writeBuffer())),
    );
    if ("erro" in r) throw new Error(r.erro);
    expect(r.ok.obra).toBe("Guarita modelo");
    expect(r.ok.etapas.map((e) => e.nome)).toEqual(["Fundação", "Estrutura"]);
    expect(r.ok.etapas[0]?.realizado).toEqual([
      { mes: "2026-05-01", centavos: 100_000 },
      { mes: "2026-06-01", centavos: 200_000 },
    ]);
    expect(r.ok.etapas[1]?.realizado).toEqual([]);
    expect(r.ok.totalEtapas).toBe(900_100);
    expect(r.ok.totalArquivo).toBeNull();
  });
});

describe("pedaços da leitura", () => {
  it("mês de uma célula de cabeçalho", () => {
    expect(mesDaCelula(new Date(Date.UTC(2026, 6, 1)))).toBe("2026-07-01");
    expect(mesDaCelula("jul/26")).toBe("2026-07-01");
    expect(mesDaCelula("JUL/2026")).toBe("2026-07-01");
    expect(mesDaCelula("julho de 2026")).toBe("2026-07-01");
    expect(mesDaCelula("Mar 27")).toBe("2027-03-01");
    expect(mesDaCelula("07/2026")).toBe("2026-07-01");
    expect(mesDaCelula("01/07/2026")).toBe("2026-07-01");
    expect(mesDaCelula("2026-07")).toBe("2026-07-01");
    expect(mesDaCelula("Total")).toBeNull();
    expect(mesDaCelula("marco zero 2026")).toBeNull();
    expect(mesDaCelula(46204)).toBeNull();
    expect(mesDaCelula("13/2026")).toBeNull();
  });

  it("meses dentro de um texto", () => {
    expect(mesesNoTexto("Real. até 06/26")).toEqual(["2026-06-01"]);
    expect(mesesNoTexto("Realizado de 06/2025 a 06/2026")).toEqual([
      "2025-06-01",
      "2026-06-01",
    ]);
    expect(mesesNoTexto("de jul/2026 a dez/2027")).toEqual([
      "2026-07-01",
      "2027-12-01",
    ]);
  });

  it("revisão e obra num texto", () => {
    expect(revisaoNoTexto("Revisão R00 de 14/07/2026")).toBe("R00");
    expect(revisaoNoTexto("Rev. 1")).toBe("R01");
    expect(revisaoNoTexto("Prev_Orçamentária-ARP-R01.xlsx")).toBe("R01");
    expect(revisaoNoTexto("Previsto de jul/2026")).toBeNull();
    expect(
      obraDoTitulo(
        "Estimativa de custo e desembolso para execução do edifício garagem – Espaço ARP",
      ),
    ).toBe("Edifício garagem");
    expect(obraDoTitulo("Planilha qualquer")).toBeNull();
  });
});
