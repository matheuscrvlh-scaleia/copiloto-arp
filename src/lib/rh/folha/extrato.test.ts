import { describe, expect, it } from "vitest";
import { coerente, conferir } from "./conferencia";
import { ErroExtrato, type ItemTexto, lerExtrato, numeroBr } from "./extrato";
import { aplicarSalarioFicticio, SALARIO_FICTICIO } from "./ficticio";

// Folha sintética com as mesmas posições do Extrato Mensal real (07/2026).
// Pessoas e valores inventados.

const t = (
  str: string,
  x: number,
  y: number,
  w = str.length * 4,
): ItemTexto => ({ str, x, y, w });
/** Número alinhado à direita terminando em `direita`. */
const n = (str: string, direita: number, y: number): ItemTexto => {
  const w = str.length * 4;
  return { str, x: direita - w, y, w };
};

function cabecalho(pagina: string): ItemTexto[] {
  return [
    t("Empresa:", 0, 833),
    t("25 - ARP EMPREENDIMENTOS IMOBILIARIOS LTDA", 103, 833),
    t("Página:", 472, 833),
    t(pagina, 536, 833),
    t("CNPJ:", 0, 822),
    t("00.000.000/0001-00", 103, 822),
    t("Cálculo:", 0, 810),
    t("Folha Mensal", 103, 810),
    t("Competência:", 0, 798),
    t("07/2026", 103, 798),
    t("EXTRATO MENSAL", 240, 763),
  ];
}

const ana: ItemTexto[] = [
  t("Empr.:", 0, 741),
  t("7 ANA TESTE", 57, 741),
  t("Situação:", 202, 741),
  t("Trabalhando", 232, 741),
  t("CPF:", 343, 741),
  t("000.000.000-00", 359, 741),
  t("Adm:", 454, 741),
  t("01/02/2020", 516, 741),
  t("Vínculo:", 0, 731),
  t("Celetista", 63, 731),
  t("CC:", 219, 731),
  t("1", 232, 731),
  t("Depto:", 336, 731),
  t("2", 359, 731),
  t("Horas Mês:", 437, 731),
  n("220,00", 551, 731),
  t("Cargo:", 0, 721),
  t("10 ANALISTA", 46, 721),
  t("C.B.O:", 210, 721),
  t("252405", 232, 721),
  t("Filial: 1", 342, 721),
  t("Salário:", 448, 721),
  n("3.000,00", 550, 721),
  // linha 1: salário (P) | INSS (D)
  t("8781 DIAS NORMAIS", 18, 700),
  n("30,00", 202, 700),
  n("3.000,00", 262, 700),
  t("P", 264, 700),
  t("998", 294, 700),
  t("INSS", 316, 700),
  n("9,00", 483, 700),
  n("270,00 D", 541, 700),
  // linha 2: hora extra (P, referência em horas) | plano de saúde (D, sem referência)
  t("250 REFLEXO EXTRAS DSR", 22, 690),
  n("10:30", 202, 690),
  n("100,00", 262, 690),
  t("P", 264, 690),
  t("307", 294, 690),
  t("PLANO DE SAÚDE", 316, 690),
  n("157,64 D", 541, 690),
  // linha 3: só coluna direita, desconto percentual
  t("334", 294, 680),
  t("VALE TRANSPORTE - 1%", 316, 680),
  n("1,00", 483, 680),
  n("30,00 D", 541, 680),
  // rodapé
  t("Informativa:", 236, 630),
  t("Informativa Dedutora:", 344, 630),
  t("ND:", -1, 629),
  t("0", 23, 629),
  t("Proventos:", 34, 629),
  n("3.100,00", 124, 629),
  t("Descontos:", 144, 629),
  n("457,64", 230, 629),
  t("0", 443, 629),
  t("Líquido:", 469, 629),
  n("2.642,36", 550, 629),
  t("NF:", 0, 619),
  t("0", 23, 619),
  t("Base INSS:", 33, 619),
  n("3.100,00", 123, 619),
  t("Base FGTS:", 238, 619),
  n("3.100,00", 326, 619),
  t("Valor FGTS:", 344, 619),
  n("248,00", 446, 619),
];

const diretor: ItemTexto[] = [
  t("Contr:", 0, 590),
  t("51 BETO DIRETOR", 54, 590),
  t("Situação:", 202, 590),
  t("Trabalhando", 232, 590),
  t("Adm:", 454, 590),
  t("01/07/1998", 516, 590),
  t("Vínculo:", 0, 580),
  t("Diretor", 63, 580),
  t("Depto:", 336, 580),
  t("5", 359, 580),
  t("Horas Mês:", 437, 580),
  t("Cargo:", 0, 570),
  t("1358 DIRETOR GERAL", 46, 570),
  t("Salário:", 448, 570),
  n("10.000,00", 550, 570),
  t("100 PRO-LABORE", 22, 550),
  n("220:00", 202, 550),
  n("10.000,00", 262, 550),
  t("P", 264, 550),
  t("843", 294, 550),
  t("INSS EMPREGADOR", 316, 550),
  n("11,00", 483, 550),
  n("1.100,00 D", 541, 550),
  t("ND:", -1, 530),
  t("Proventos:", 34, 530),
  n("10.000,00", 124, 530),
  t("Descontos:", 144, 530),
  n("1.100,00", 230, 530),
  t("Líquido:", 469, 530),
  n("8.900,00", 550, 530),
  t("NF:", 0, 520),
  t("Base INSS:", 33, 520),
  n("10.000,00", 123, 520),
];

const demitido: ItemTexto[] = [
  t("Empr.:", 0, 741),
  t("9 CARLOS SAIU", 57, 741),
  t("Situação:", 202, 741),
  t("Demitido", 232, 741),
  t("Adm:", 454, 741),
  t("10/10/2024", 516, 741),
  t("Vínculo:", 0, 731),
  t("Aprendiz", 63, 731),
  t("Depto:", 336, 731),
  t("3", 359, 731),
  t("Horas Mês:", 437, 731),
  n("150,00", 551, 731),
  t("Cargo:", 0, 721),
  t("20 APRENDIZ", 46, 721),
  t("Salário:", 448, 721),
  n("1.000,00", 550, 721),
  t("9180 SALDO DE SALARIO", 18, 700),
  n("10,00", 202, 700),
  n("333,33", 262, 700),
  t("P", 264, 700),
  t("23", 298, 700),
  t("FGTS DE RESCISAO", 316, 700),
  n("26,67", 483, 700),
  t("*", 543, 700),
  t("ND:", -1, 629),
  t("Proventos:", 34, 629),
  n("333,33", 124, 629),
  t("Descontos:", 144, 629),
  n("0,00", 230, 629),
  t("Líquido:", 469, 629),
  n("333,33", 550, 629),
];

const resumo: ItemTexto[] = [
  t("Resumo por Rubrica", 0, 741),
  t("8781 DIAS NORMAIS", 18, 700),
  n("3.000,00", 262, 700),
  t("P", 264, 700),
  t("Líquido Geral:", 448, 139),
  n("11.875,69", 550, 139),
];

const ultima: ItemTexto[] = [
  t("INSS", 0, 731),
  t("FGTS, PIS e ISS", 278, 731),
  t("Salário contribuição empregados:", 1, 721),
  n("3.100,00", 254, 721),
  t("Base do FGTS:", 278, 721),
  n("3.100,00", 546, 721),
  t("Salário contribuição contribuintes:", 1, 711),
  n("10.000,00", 254, 711),
  t("Valor do FGTS:", 278, 711),
  n("248,00", 546, 711),
  t("Empresa:", 1, 670),
  n("620,00", 254, 670),
  t("RAT:", 1, 660),
  n("46,50", 254, 660),
];

const paginas = [
  [...cabecalho("1/3"), ...ana, ...diretor],
  [...cabecalho("2/3"), ...demitido],
  [...cabecalho("3/3"), ...resumo, ...ultima],
];

describe("numeroBr", () => {
  it("lê milhar, decimal e horas", () => {
    expect(numeroBr("1.234,56")).toBe(1234.56);
    expect(numeroBr("30,00")).toBe(30);
    expect(numeroBr("10:30")).toBe(10.5);
    expect(numeroBr("ANA")).toBeNull();
  });
});

describe("lerExtrato", () => {
  const e = lerExtrato(paginas);

  it("lê cabeçalho, competência e todas as pessoas (Empr.: e Contr:)", () => {
    expect(e.competencia).toBe("2026-07-01");
    expect(e.empresa).toContain("ARP");
    expect(
      e.colaboradores.map((c) => [
        c.matricula,
        c.nome,
        c.tipo_contrato,
        c.situacao,
      ]),
    ).toEqual([
      [7, "ANA TESTE", "clt", "trabalhando"],
      [51, "BETO DIRETOR", "pro_labore", "trabalhando"],
      [9, "CARLOS SAIU", "aprendiz", "demitido"],
    ]);
  });

  it("lê os campos do cabeçalho de cada pessoa", () => {
    expect(e.colaboradores[0]).toMatchObject({
      admissao: "2020-02-01",
      departamento_codigo: 2,
      horas_mes: 220,
      cargo_codigo: 10,
      cargo_nome: "ANALISTA",
      cbo: "252405",
      salario: 3000,
      proventos: 3100,
      descontos: 457.64,
      liquido: 2642.36,
      base_inss: 3100,
      base_fgts: 3100,
      valor_fgts: 248,
    });
    expect(e.colaboradores[1]?.horas_mes).toBeNull();
  });

  it("lê as duas colunas de rubricas, separando referência de valor pela borda direita", () => {
    expect(e.colaboradores[0]?.rubricas).toEqual([
      {
        codigo: 8781,
        descricao: "DIAS NORMAIS",
        natureza: "provento",
        referencia: 30,
        valor: 3000,
      },
      {
        codigo: 998,
        descricao: "INSS",
        natureza: "desconto",
        referencia: 9,
        valor: 270,
      },
      {
        codigo: 250,
        descricao: "REFLEXO EXTRAS DSR",
        natureza: "provento",
        referencia: 10.5,
        valor: 100,
      },
      {
        codigo: 307,
        descricao: "PLANO DE SAÚDE",
        natureza: "desconto",
        referencia: null,
        valor: 157.64,
      },
      {
        codigo: 334,
        descricao: "VALE TRANSPORTE - 1%",
        natureza: "desconto",
        referencia: 1,
        valor: 30,
      },
    ]);
  });

  it("rubrica marcada com * e um número só vira informativa com valor", () => {
    expect(e.colaboradores[2]?.rubricas[1]).toEqual({
      codigo: 23,
      descricao: "FGTS DE RESCISAO",
      natureza: "informativa",
      referencia: null,
      valor: 26.67,
    });
  });

  it("não confunde o 'Empresa:' do resumo com o cabeçalho e lê o líquido geral", () => {
    expect(e.resumo).toMatchObject({
      base_inss_empregados: 3100,
      base_inss_contribuintes: 10000,
      base_fgts: 3100,
      valor_fgts: 248,
      inss_empresa: 620,
      rat: 46.5,
    });
    expect(e.liquido_geral).toBe(11875.69);
  });

  it("recusa arquivo que não é o extrato", () => {
    expect(() => lerExtrato([[t("Relatório qualquer", 0, 800)]])).toThrow(
      ErroExtrato,
    );
  });

  it("recusa situação desconhecida em vez de chutar", () => {
    const estranho = paginas.map((p) =>
      p.map((i) =>
        i.str === "Trabalhando" && i.y === 741 ? { ...i, str: "Licença X" } : i,
      ),
    );
    expect(() => lerExtrato(estranho)).toThrow(
      /Não reconheço o valor "Licença X" em Situação/,
    );
  });
});

describe("conferir", () => {
  it("confere pessoa a pessoa e os totais com o resumo", () => {
    const e = lerExtrato(paginas);
    const c = conferir(e);
    expect(c.coerentes).toBe(3);
    expect(c.incoerentes).toEqual([]);
    const ok = Object.fromEntries(c.itens.map((i) => [i.chave, i.ok]));
    expect(ok).toEqual({
      liquido: true,
      base_inss_empregados: true,
      base_inss_contribuintes: true,
      fgts: null,
    });
  });

  it("aponta a pessoa cujas rubricas não fecham", () => {
    const e = lerExtrato(paginas);
    const ana = e.colaboradores[0];
    if (!ana) throw new Error();
    expect(coerente({ ...ana, liquido: 1 })).toBe(false);
  });
});

describe("aplicarSalarioFicticio", () => {
  const e = lerExtrato(paginas);
  const grupos: Record<number, string> = {
    307: "beneficio_desconto",
    334: "beneficio_desconto",
    8781: "salario",
  };
  const f = aplicarSalarioFicticio(e, (codigo) => grupos[codigo]);
  const ana = f.colaboradores[0];

  it("troca o salário e reescala o que deriva dele", () => {
    expect(f.colaboradores.map((c) => c.salario)).toEqual([2000, 2000, 2000]);
    // fator 2000/3000
    expect(ana?.rubricas.find((r) => r.codigo === 8781)?.valor).toBe(2000);
    expect(ana?.rubricas.find((r) => r.codigo === 998)?.valor).toBe(180);
    expect(ana?.base_inss).toBe(2066.67);
  });

  it("mantém real só o desconto fixo de benefício (não o percentual)", () => {
    expect(ana?.rubricas.find((r) => r.codigo === 307)?.valor).toBe(157.64);
    expect(ana?.rubricas.find((r) => r.codigo === 334)?.valor).toBe(20);
  });

  it("a folha fictícia continua fechando e não guarda o resumo real", () => {
    expect(f.colaboradores.every(coerente)).toBe(true);
    expect(f.resumo).toEqual({});
    expect(f.liquido_geral).toBeNull();
    expect(JSON.stringify(f)).not.toContain("3000");
    expect(SALARIO_FICTICIO).toBe(2000);
  });
});
