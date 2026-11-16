import { describe, expect, it } from "vitest";
import { dia, planilha } from "./__fixtures__/planilhas";
import {
  abasDoArquivo,
  casarLuc,
  ehLinhaDeTotal,
  gruposParecidos,
  lerData,
  lerHora,
  lerNumero,
  lucsDoTexto,
  mesDoTitulo,
  normalizar,
  numeroDoTotal,
  partesDaData,
  similaridade,
} from "./comum";

describe("texto, números e datas pt-BR", () => {
  it("normaliza sem acento, caixa e pontuação nas pontas", () => {
    expect(normalizar("  Situação:  ")).toBe("situacao");
    expect(normalizar(".")).toBe("");
  });

  it("lê números em pt-BR", () => {
    expect(lerNumero("4,25")).toBe(4.25);
    expect(lerNumero("1.234,56")).toBe(1234.56);
    expect(lerNumero("R$ -5.954,72")).toBe(-5954.72);
    expect(lerNumero("1234.5")).toBe(1234.5);
    expect(lerNumero(" - ")).toBeNull();
    expect(lerNumero("dois")).toBeNaN();
  });

  it("lê datas: Date, série do Excel, dd/mm/aaaa, dd/mm/aa e sem ano", () => {
    expect(lerData(dia(2026, 3, 9))).toBe("2026-03-09");
    expect(lerData(46090)).toBe("2026-03-09");
    expect(lerData("09/03/2026")).toBe("2026-03-09");
    expect(lerData("9-3-26")).toBe("2026-03-09");
    expect(lerData("09/03", 2025)).toBe("2025-03-09");
    expect(lerData("31/02/2026")).toBeNull();
    expect(partesDaData("11/13/2025")).toEqual({ dia: 11, mes: 13, ano: 2025 });
  });

  it("lê horas", () => {
    expect(lerHora("14h")).toBe("14:00");
    expect(lerHora("9:05")).toBe("09:05");
    expect(lerHora(0.5)).toBe("12:00");
  });

  it("reconhece títulos de mês", () => {
    expect(mesDoTitulo("Janeiro 2026")).toEqual({ mes: 1, ano: 2026 });
    expect(mesDoTitulo("MARÇO/26")).toEqual({ mes: 3, ano: 2026 });
    expect(mesDoTitulo("Dezembro")).toEqual({ mes: 12, ano: null });
    expect(mesDoTitulo("Oficina de março")).toBeNull();
  });

  it("acha linha e número de total", () => {
    expect(ehLinhaDeTotal(["12 ativações"])).toBe(true);
    expect(ehLinhaDeTotal([12, "ativações"])).toBe(true);
    expect(ehLinhaDeTotal([5, "DJ"])).toBe(false);
    expect(numeroDoTotal(["57 ativações"])).toBe(57);
    expect(numeroDoTotal(["Total 2025", null, 45])).toBe(45);
    expect(numeroDoTotal(["Total 2025: 323"])).toBe(323);
  });
});

describe("nomes parecidos e LUC", () => {
  it("agrupa grafias parecidas e separa as diferentes", () => {
    expect(
      similaridade("Quitutes da Dona Zuza", "Quitutess da Dona Zuza"),
    ).toBeGreaterThan(0.9);
    const g = gruposParecidos([
      "Quitutes da Dona Zuza",
      "Quitutess da Dona Zuza",
      "Mel Inventado",
      "MEL INVENTADO",
    ]);
    expect(g).toEqual([["quitutes da dona zuza", "quitutess da dona zuza"]]);
  });

  it("separa LUCs de uma célula com o prefixo", () => {
    expect(lucsDoTexto("11_129/130/202")).toEqual([
      "11_129",
      "11_130",
      "11_202",
    ]);
    expect(lucsDoTexto("00H39, 00H_42")).toEqual(["00H39", "00H_42"]);
  });

  it("casa LUC fora do padrão com o contrato", () => {
    const contratos = [
      { id: "a", lucs: ["00H_39"], cliente_nome: "A" },
      { id: "b", lucs: ["11_129", "11_130"], cliente_nome: "B" },
      { id: "c", lucs: ["7_001"], cliente_nome: "C" },
      { id: "d", lucs: ["7_001"], cliente_nome: "D" },
    ];
    expect(casarLuc("00H39", contratos).contrato_id).toBe("a");
    expect(casarLuc("0H_39", contratos).contrato_id).toBe("a");
    expect(casarLuc("11_130", contratos).contrato_id).toBe("b");
    const amb = casarLuc("7_001", contratos);
    expect(amb.contrato_id).toBeNull();
    expect(amb.candidatos.map((c) => c.id)).toEqual(["c", "d"]);
    expect(casarLuc("99_999", contratos).contrato_id).toBeNull();
  });
});

describe("arquivo → abas", () => {
  it("lê xlsx (célula mesclada repete o valor) e CSV", async () => {
    const xlsx = await abasDoArquivo(
      await planilha([
        {
          nome: "A",
          linhas: [
            ["x", 1],
            [null, 2],
          ],
          mesclas: ["A1:A2"],
        },
      ]),
    );
    expect(xlsx[0]?.linhas).toEqual([
      ["x", 1],
      ["x", 2],
    ]);
    const csv = await abasDoArquivo(new TextEncoder().encode("a;b\n1;\n"));
    expect(csv[0]?.linhas).toEqual([
      ["a", "b"],
      ["1", null],
    ]);
  });
});
