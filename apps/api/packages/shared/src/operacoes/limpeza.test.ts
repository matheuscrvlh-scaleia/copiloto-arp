import { describe, expect, it } from "vitest";
import {
  BLOCO_04,
  blocosDoMes,
  calcularRateio,
  centavos,
  type EntradaRateio,
  lerMes,
  maiorResto,
  mesAnterior,
  mesSeguinte,
  prazoDoEnvio,
  regraBl04Do,
  situacaoDoEnvio,
  somarComposicao,
  valorDoExtra,
  valoresPorLocal,
} from "./limpeza";

// Setembro de 2026, com os insumos da spec (4.8): é o teste de aceite do
// rateio, centavo a centavo.
const BLOCOS = ["01", "02", "04", "05", "09", "10", "11"];

const extra = (
  descricao: string,
  quantidade: number | null,
  valorUnitario: number | null,
  valor: number,
) => ({ descricao, quantidade, valorUnitario, valor });

const SETEMBRO_2026: EntradaRateio = {
  valorBase: 3532394,
  composicao: "38.509,83 − 8.072,68 + 1.736,79 + 630,00 + 2.520,00",
  funcBase: 9,
  funcAreaComum: 5,
  funcRateados: 4,
  extras: [
    extra("Insalubridade espaço pet", null, null, 27868),
    extra("Limpeza banheiros (por auxiliar/mês)", 4, 389700, 1558800),
    extra("Vigia extra fins de semana", 8, 31500, 252000),
    extra("Insalubridade limpeza de banheiro", null, null, 249799),
    extra("Limpeza extra banheiros domingos e feriados", 5, 31500, 157500),
  ],
  blocos: BLOCOS,
  minutos: [
    { bloco: "01", limpeza: 131, manutencao: 73 },
    { bloco: "02", limpeza: 67, manutencao: 74 },
    { bloco: "04", limpeza: 229, manutencao: 150 },
    { bloco: "05", limpeza: 295, manutencao: 226 },
    { bloco: "09", limpeza: 152, manutencao: 114 },
    { bloco: "10", limpeza: 178, manutencao: 115 },
    { bloco: "11", limpeza: 167, manutencao: 148 },
  ],
  contrato: [
    {
      descricao: "Vigia com 13 agentes e viatura",
      valor: 5193771,
      entraConferencia: false,
    },
    {
      descricao: "Limpeza com 13 auxiliares",
      valor: 5368861,
      entraConferencia: true,
    },
    {
      descricao: "Limpeza administrativa com 1 auxiliar",
      valor: 356945,
      entraConferencia: false,
    },
    {
      descricao: "Vigilância patrimonial com 2 vigilantes",
      valor: 1397998,
      entraConferencia: false,
    },
    {
      descricao: "2 vigias extras de fim de semana (315,00 × 8)",
      valor: 252000,
      entraConferencia: true,
    },
    {
      descricao: "1 limpeza de banheiro em domingos e feriados (315,00 × 5)",
      valor: 157500,
      entraConferencia: true,
    },
  ],
  regraBl04: "separado",
};

describe("rateio de setembro de 2026 (aceite, igual à planilha)", () => {
  const r = calcularRateio(SETEMBRO_2026);

  it("valor por funcionário, extras, área comum e rateado", () => {
    expect(r.valorPorFuncionario).toBe(392488);
    expect(r.extras).toBe(2245967);
    expect(r.areaComum).toBe(4208408);
    expect(r.areaComumExibida).toBe(4208408);
    expect(r.rateado).toBe(1569953);
  });

  it("cada bloco ao centavo, na ordem dos parâmetros", () => {
    expect(r.blocos.map((b) => [b.bloco, b.minutos, b.valor])).toEqual([
      ["01", 204, 151142],
      ["02", 141, 104466],
      ["04", 379, 280799],
      ["05", 521, 386005],
      ["09", 266, 197078],
      ["10", 293, 217082],
      ["11", 315, 233381],
    ]);
    expect(r.minutosTotal).toBe(2119);
    expect(r.blocos.map((b) => (b.participacao ?? 0).toFixed(4))).toEqual([
      "0.0963",
      "0.0665",
      "0.1789",
      "0.2459",
      "0.1255",
      "0.1383",
      "0.1487",
    ]);
  });

  it("total 57.783,61, soma das partes igual ao total e conferência verde", () => {
    expect(r.total).toBe(5778361);
    expect(r.somaBlocos).toBe(1569953);
    expect((r.areaComum ?? 0) + (r.somaBlocos ?? 0)).toBe(r.total);
    expect(r.conferencia).toMatchObject({
      situacao: "bate",
      contrato: 5778361,
      diferenca: 0,
    });
    expect(r.completo).toBe(true);
    expect(r.pendencias).toEqual([]);
  });

  it("composição do valor base confere", () => {
    expect(r.composicao).toEqual({ valor: 3532394, confere: true });
  });

  it("maior resto: os 4 centavos vão aos blocos 02, 10, 09 e 04", () => {
    expect(r.ajustes.map((a) => a.chave)).toEqual(["02", "10", "09", "04"]);
  });

  it("memória de cálculo com cada passo e a fórmula", () => {
    const m = Object.fromEntries(r.memoria.map((p) => [p.chave, p]));
    expect(m.valor_funcionario?.formula).toBe(
      "valor base ÷ funcionários da base = 35.323,94 ÷ 9",
    );
    expect(m.valor_funcionario?.valor).toBe("3.924,88");
    expect(m.valor_funcionario?.nota).toContain("3.924,882222");
    expect(m.area_comum?.formula).toBe(
      "funcionários da área comum × valor por funcionário + extras = 5 × 3.924,88 + 22.459,67",
    );
    expect(m.area_comum?.valor).toBe("42.084,08");
    expect(m["bloco:01"]?.formula).toBe(
      "participação × valor rateado = (131 + 73) ÷ 2.119 × 15.699,53 = 9,63% × 15.699,53",
    );
    expect(m["bloco:02"]?.nota).toContain("maior resto");
    expect(m.total?.valor).toBe("57.783,61");
    expect(m.conferencia?.valor).toBe("Bate com o total");
    expect(r.memoria.map((p) => p.chave)).toEqual([
      "valor_base",
      "valor_funcionario",
      "extras",
      "area_comum",
      "rateado",
      "minutos",
      ...BLOCOS.map((b) => `bloco:${b}`),
      "total",
      "conferencia",
    ]);
  });

  it("valores por local para comparar com a planilha", () => {
    expect(valoresPorLocal(r, "separado")).toEqual({
      area_comum: 4208408,
      "01": 151142,
      "02": 104466,
      "04": 280799,
      "05": 386005,
      "09": 197078,
      "10": 217082,
      "11": 233381,
      total: 5778361,
    });
  });
});

describe("regra do Bloco 04", () => {
  it("até nov/2025 dentro da área comum; desde dez/2025 separado", () => {
    expect(regraBl04Do("2025-11-01")).toBe("area_comum");
    expect(regraBl04Do("2025-12-01")).toBe("separado");
    expect(regraBl04Do("2021-07-01")).toBe("area_comum");
  });

  it("regra antiga: área comum mostra o Bloco 04 somado e o total não muda", () => {
    const nova = calcularRateio(SETEMBRO_2026);
    const antiga = calcularRateio({
      ...SETEMBRO_2026,
      regraBl04: "area_comum",
    });
    const bl04 = antiga.blocos.find((b) => b.bloco === BLOCO_04)?.valor ?? 0;
    expect(bl04).toBe(280799);
    expect(antiga.areaComum).toBe(4208408);
    expect(antiga.areaComumExibida).toBe(4208408 + 280799);
    expect(antiga.total).toBe(nova.total);
    const v = valoresPorLocal(antiga, "area_comum");
    // A planilha antiga: total = área comum (com BL04) + blocos sem o BL04.
    const semBl04 = BLOCOS.filter((b) => b !== BLOCO_04).reduce(
      (s, b) => s + (v[b] ?? 0),
      0,
    );
    expect((v.area_comum ?? 0) + semBl04).toBe(antiga.total);
    expect(
      antiga.memoria.find((p) => p.chave === "area_comum")?.nota,
    ).toContain("com o Bloco 04");
  });
});

describe("mês incompleto", () => {
  it("sem minutos: área comum calculada, blocos e total sem valor", () => {
    const r = calcularRateio({
      ...SETEMBRO_2026,
      minutos: BLOCOS.map((bloco) => ({ bloco, limpeza: 0, manutencao: 0 })),
    });
    expect(r.completo).toBe(false);
    expect(r.pendencias).toEqual(["Lance os minutos dos blocos."]);
    expect(r.areaComum).toBe(4208408);
    expect(r.total).toBeNull();
    expect(
      r.blocos.every((b) => b.valor === null && b.participacao === null),
    ).toBe(true);
    expect(r.conferencia.situacao).toBe("nao_bate");
    expect(r.conferencia.diferenca).toBeNull();
  });

  it("sem valor base nem funcionários: só os extras", () => {
    const r = calcularRateio({
      ...SETEMBRO_2026,
      valorBase: null,
      funcBase: null,
    });
    expect(r.completo).toBe(false);
    expect(r.pendencias).toHaveLength(2);
    expect(r.valorPorFuncionario).toBeNull();
    expect(r.extras).toBe(2245967);
    expect(r.total).toBeNull();
  });

  it("funcionários da área comum + rateados acima da base", () => {
    const r = calcularRateio({ ...SETEMBRO_2026, funcAreaComum: 6 });
    expect(r.completo).toBe(false);
    expect(r.pendencias[0]).toContain("passam dos funcionários da base");
    expect(r.total).toBeNull();
  });

  it("bloco sem minutos lançados entra com zero", () => {
    const r = calcularRateio({
      ...SETEMBRO_2026,
      minutos: SETEMBRO_2026.minutos.filter((m) => m.bloco !== "11"),
    });
    expect(r.blocos.at(-1)).toMatchObject({
      bloco: "11",
      minutos: 0,
      valor: 0,
    });
    expect((r.areaComum ?? 0) + (r.somaBlocos ?? 0)).toBe(r.total);
    expect(r.total).toBe(5778361);
  });
});

describe("extras", () => {
  it("quantidade × valor por dia, ao centavo", () => {
    expect(valorDoExtra(8, 31500, 0)).toBe(252000);
    expect(valorDoExtra(4, 389700, 0)).toBe(1558800);
    expect(valorDoExtra(1.5, 33333, 0)).toBe(50000); // 49.999,5 → 50.000
    expect(valorDoExtra(null, null, 27868)).toBe(27868);
  });

  it("extra a mais muda só a área comum e o total", () => {
    const base = calcularRateio(SETEMBRO_2026);
    const r = calcularRateio({
      ...SETEMBRO_2026,
      extras: [
        ...SETEMBRO_2026.extras,
        extra("Vigia extra do caixa do estacionamento", null, null, 358900),
      ],
    });
    expect(r.extras).toBe(2245967 + 358900);
    expect(r.areaComum).toBe(4208408 + 358900);
    expect(r.blocos.map((b) => b.valor)).toEqual(
      base.blocos.map((b) => b.valor),
    );
    expect(r.total).toBe(5778361 + 358900);
    expect(r.conferencia).toMatchObject({
      situacao: "nao_bate",
      diferenca: 358900,
    });
  });

  it("sem itens do contrato marcados, não há conferência", () => {
    const r = calcularRateio({
      ...SETEMBRO_2026,
      contrato: SETEMBRO_2026.contrato.map((c) => ({
        ...c,
        entraConferencia: false,
      })),
    });
    expect(r.conferencia.situacao).toBe("sem_contrato");
  });
});

describe("arredondamento pelo maior resto", () => {
  it("fecha no alvo e desempata pela ordem da lista", () => {
    // 3 partes iguais de 1/3 de 100 centavos: 34 + 33 + 33.
    const { partes, ganharam } = maiorResto([100n, 100n, 100n], 3n, 100n);
    expect(partes).toEqual([34n, 33n, 33n]);
    expect(ganharam).toEqual([0]);
  });

  it("valores negativos usam o piso", () => {
    const { partes } = maiorResto([-5n, 11n], 2n, 3n);
    expect(partes.reduce((s, p) => s + p, 0n)).toBe(3n);
  });

  it("a soma das partes fecha no total em qualquer combinação de minutos", () => {
    for (let k = 1; k <= 200; k++) {
      const minutos = BLOCOS.map((bloco, i) => ({
        bloco,
        limpeza: (k * 37 + i * 101) % 400,
        manutencao: (k * 13 + i * 7) % 250,
      }));
      const r = calcularRateio({
        ...SETEMBRO_2026,
        valorBase: 3000000 + k * 977,
        minutos,
      });
      expect((r.areaComum ?? 0) + (r.somaBlocos ?? 0)).toBe(r.total);
    }
  });
});

describe("composição do valor base", () => {
  it("soma a conta escrita com sinais de menos tipográficos", () => {
    expect(
      somarComposicao("38.509,83 − 8.072,68 + 1.736,79 + 630,00 + 2.520,00"),
    ).toBe(3532394);
    expect(somarComposicao("1000 - 0,5")).toBe(99950);
  });

  it("texto que não é só uma conta não é somado", () => {
    expect(somarComposicao("contrato de setembro")).toBeNull();
    expect(somarComposicao("38.509,83 menos desconto")).toBeNull();
    expect(somarComposicao("")).toBeNull();
  });

  it("composição que não bate aparece na memória", () => {
    const r = calcularRateio({ ...SETEMBRO_2026, composicao: "35.000,00" });
    expect(r.composicao).toEqual({ valor: 3500000, confere: false });
    expect(r.memoria[0]?.nota).toContain("35.000,00");
  });
});

describe("prazo e situação do envio ao Financeiro", () => {
  const cal = {
    diasUteis: [1, 2, 3, 4, 5],
    feriados: new Set(["2026-10-12", "2026-11-02"]),
  };

  it("n-ésimo dia útil do mês seguinte, sem fim de semana e feriado", () => {
    // Outubro/2026: 1 (qui), 2 (sex), 5, 6, 7 → 5º dia útil = 07/10.
    expect(prazoDoEnvio("2026-09-01", 5, cal)).toBe("2026-10-07");
    // Novembro/2026: 2 é feriado → 3, 4, 5, 6, 9.
    expect(prazoDoEnvio("2026-10-01", 5, cal)).toBe("2026-11-09");
    expect(prazoDoEnvio("2026-12-01", 1, cal)).toBe("2027-01-01");
  });

  it("situação: no prazo, atrasado, enviado e histórico importado", () => {
    const tela = { origem: "tela", enviadoEm: null };
    expect(situacaoDoEnvio(tela, "2026-11-09", "2026-11-09")).toBe("no_prazo");
    expect(situacaoDoEnvio(tela, "2026-11-09", "2026-11-10")).toBe("atrasado");
    expect(
      situacaoDoEnvio(
        { origem: "tela", enviadoEm: "2026-11-09T23:30:00-03:00" },
        "2026-11-09",
        "2026-11-20",
      ),
    ).toBe("enviado");
    expect(
      situacaoDoEnvio(
        { origem: "tela", enviadoEm: "2026-11-10T02:30:00Z" },
        "2026-11-09",
        "2026-11-20",
      ),
    ).toBe("enviado");
    expect(
      situacaoDoEnvio(
        { origem: "tela", enviadoEm: "2026-11-10T12:00:00Z" },
        "2026-11-09",
        "2026-11-20",
      ),
    ).toBe("enviado_atrasado");
    expect(
      situacaoDoEnvio(
        { origem: "importacao", enviadoEm: null },
        "2021-08-06",
        "2026-11-20",
      ),
    ).toBe("historico");
  });
});

describe("meses e blocos", () => {
  it("mês seguinte, anterior e leitura da URL", () => {
    expect(mesSeguinte("2026-12-01")).toBe("2027-01-01");
    expect(mesAnterior("2026-01-01")).toBe("2025-12-01");
    expect(lerMes("2026-09")).toBe("2026-09-01");
    expect(lerMes("2026-09-01")).toBe("2026-09-01");
    expect(lerMes("2026-13")).toBeNull();
    expect(lerMes(undefined)).toBeNull();
  });

  it("blocos: os dos parâmetros e depois os que só o mês tem", () => {
    expect(blocosDoMes(["01", "05", "02"], ["12", "02", "03"])).toEqual([
      "01",
      "05",
      "02",
      "03",
      "12",
    ]);
  });

  it("centavos a partir do número do banco", () => {
    expect(centavos(35323.94)).toBe(3532394);
    expect(centavos("2497.99")).toBe(249799);
    expect(centavos(null)).toBe(0);
  });
});
