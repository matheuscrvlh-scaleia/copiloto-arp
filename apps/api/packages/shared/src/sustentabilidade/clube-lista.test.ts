import { describe, expect, it } from "vitest";
import {
  agruparLinhas,
  anosDoClube,
  ativosPorAno,
  dataDeReferencia,
  type ExtrasDoAno,
  filtrarPorCartao,
  filtrarPorSituacao,
  type LinhaClube,
  linhasDoClube,
  mesesCobertos,
  type ParticipanteBase,
  passaNosFiltros,
  resumoDosCartoes,
  situacaoNaData,
  totaisDoClube,
} from "./clube-lista";

const HOJE = "2026-11-16";

const termo = (assinadoEm: string, validoAte: string) => ({
  ano: Number(assinadoEm.slice(0, 4)),
  assinadoEm,
  validoAte,
});

const base = (
  o: Partial<ParticipanteBase> & { id: string },
): ParticipanteBase => ({
  nome: `Participante ${o.id}`,
  doc: "12345678000190",
  locatario: true,
  lucs: ["11_101"],
  blocos: ["11"],
  formas: ["Pagante"],
  termos: [termo("2026-03-10", "2027-03-10")],
  saiuEm: null,
  interesse: false,
  ...o,
});

function linhas(
  participantes: ParticipanteBase[],
  o: {
    comValores?: boolean;
    extras?: Record<string, ExtrasDoAno>;
    ano?: number;
  } = {},
) {
  return linhasDoClube({
    participantes,
    ano: o.ano ?? 2026,
    hoje: HOJE,
    avisoDias: 30,
    extras: new Map(Object.entries(o.extras ?? {})),
    entrevistas: new Map(),
    comValores: o.comValores ?? true,
  });
}

describe("situacaoNaData (4.5)", () => {
  const p = (t: [string, string][], extra = {}) => ({
    termos: t.map(([a, v]) => termo(a, v)),
    saiuEm: null,
    interesse: false,
    ...extra,
  });

  it("termo válido por mais de 30 dias é Ativo", () => {
    expect(situacaoNaData(p([["2026-03-10", "2027-03-10"]]), HOJE, 30)).toEqual(
      {
        situacao: "ativo",
        validoAte: "2027-03-10",
      },
    );
  });

  it("faltando 30 dias ou menos é Termo a vencer; no último dia ainda vale", () => {
    expect(
      situacaoNaData(p([["2025-12-16", "2026-12-16"]]), HOJE, 30).situacao,
    ).toBe("a_vencer");
    expect(
      situacaoNaData(p([["2025-11-16", "2026-11-16"]]), HOJE, 30).situacao,
    ).toBe("a_vencer");
    expect(
      situacaoNaData(p([["2025-11-15", "2026-11-15"]]), HOJE, 30).situacao,
    ).toBe("vencido");
  });

  it("vale o termo mais longo; o renovado antes do fim mantém ativo", () => {
    const r = situacaoNaData(
      p([
        ["2025-11-20", "2026-11-20"],
        ["2026-11-10", "2027-11-10"],
      ]),
      HOJE,
      30,
    );
    expect(r).toEqual({ situacao: "ativo", validoAte: "2027-11-10" });
  });

  it("Saiu vence tudo, mas só depois da data de saída", () => {
    const saiu = p([["2026-03-10", "2027-03-10"]], { saiuEm: "2026-06-01" });
    expect(situacaoNaData(saiu, HOJE, 30).situacao).toBe("saiu");
    expect(situacaoNaData(saiu, "2026-05-31", 30).situacao).toBe("ativo");
  });

  it("sem termo: Interessado se veio da entrevista, senão Termo vencido", () => {
    expect(situacaoNaData(p([], { interesse: true }), HOJE, 30)).toEqual({
      situacao: "interessado",
      validoAte: null,
    });
    expect(situacaoNaData(p([]), HOJE, 30).situacao).toBe("vencido");
  });

  it("termo ainda não assinado na data de referência não conta", () => {
    expect(
      situacaoNaData(p([["2026-03-10", "2027-03-10"]]), "2025-12-31", 30)
        .situacao,
    ).toBe("vencido");
  });
});

describe("dataDeReferencia", () => {
  it("hoje no ano corrente, 31/12 nos anos passados", () => {
    expect(dataDeReferencia(2026, HOJE)).toBe(HOJE);
    expect(dataDeReferencia(2025, HOJE)).toBe("2025-12-31");
  });
});

describe("mesesCobertos e combinado no ano (valor combinado × meses)", () => {
  it("termo de 10/03/2026 a 10/03/2027 cobre março a dezembro: 10 meses", () => {
    expect(mesesCobertos(2026, [termo("2026-03-10", "2027-03-10")], null)).toBe(
      10,
    );
  });

  it("dois termos seguidos cobrem o ano inteiro; sair em junho corta o resto", () => {
    const dois = [
      termo("2025-02-01", "2026-02-01"),
      termo("2026-01-20", "2027-01-20"),
    ];
    expect(mesesCobertos(2026, dois, null)).toBe(12);
    expect(mesesCobertos(2026, dois, "2026-06-15")).toBe(6);
  });

  it("sem termo no ano, zero", () => {
    expect(mesesCobertos(2024, [termo("2026-03-10", "2027-03-10")], null)).toBe(
      0,
    );
  });

  it("combinado = valor por mês × meses; sem valor combinado fica vazio", () => {
    const l = linhas(
      [base({ id: "a" }), base({ id: "b", doc: "11111111000191" })],
      {
        extras: {
          a: { contribuido: 0, contribuicoes: 0, acoes: 0, combinadoMes: 50 },
        },
      },
    );
    expect(l.find((x) => x.id === "a")?.combinado).toBe(500);
    expect(l.find((x) => x.id === "b")?.combinado).toBeNull();
  });
});

describe("linhasDoClube", () => {
  it("uma linha por participante, em ordem de nome, com as colunas de 4.5", () => {
    const [b, a] = linhas(
      [
        base({ id: "2", nome: "Zé Lanches", lucs: ["11_5", "11_6"] }),
        base({ id: "1", nome: "Ateliê Serrano", locatario: false, lucs: [] }),
      ],
      {
        extras: {
          "1": {
            contribuido: 120.5,
            contribuicoes: 2,
            acoes: 3,
            combinadoMes: null,
          },
        },
      },
    ) as [LinhaClube, LinhaClube];
    expect(b.nome).toBe("Ateliê Serrano");
    expect(b).toMatchObject({
      locatario: false,
      lucs: [],
      termoAssinadoEm: "2026-03-10",
      validoAte: "2027-03-10",
      contribuido: 120.5,
      contribuicoes: 2,
      acoes: 3,
      situacao: "ativo",
      docFormatado: "12.345.678/0001-90",
    });
    expect(a.lucs).toEqual(["11_5", "11_6"]);
  });

  it("sem Ver valores, contribuído e combinado são null (não zero), mesmo com dado", () => {
    const [l] = linhas([base({ id: "1" })], {
      comValores: false,
      extras: {
        "1": { contribuido: 999, contribuicoes: 4, acoes: 1, combinadoMes: 50 },
      },
    }) as [LinhaClube];
    expect(l.contribuido).toBeNull();
    expect(l.combinado).toBeNull();
    expect(l.contribuicoes).toBe(4);
  });

  it("ano passado: termo do ano, situação no fim do ano e contagens do ano", () => {
    const p = base({
      id: "1",
      termos: [
        termo("2025-02-01", "2026-02-01"),
        termo("2026-01-20", "2027-01-20"),
      ],
    });
    const [em2025] = linhas([p], { ano: 2025 }) as [LinhaClube];
    expect(em2025.termoAssinadoEm).toBe("2025-02-01");
    expect(em2025.validoAte).toBe("2026-02-01");
    expect(em2025.situacao).toBe("ativo");
    const [em2024] = linhas([p], { ano: 2024 }) as [LinhaClube];
    expect(em2024.termoAssinadoEm).toBeNull();
    expect(em2024.situacao).toBe("vencido");
  });
});

describe("filtros", () => {
  const f = (o: Partial<Parameters<typeof passaNosFiltros>[1]> = {}) => ({
    forma: "",
    locatario: "" as const,
    bloco: "",
    busca: "",
    ...o,
  });
  const p = base({
    id: "1",
    nome: "Café da Serra",
    blocos: ["11", "12"],
    formas: ["Pagante", "Certificado (selo)"],
  });

  it("forma, locatário e bloco", () => {
    expect(passaNosFiltros(p, f({ forma: "Certificado (selo)" }))).toBe(true);
    expect(passaNosFiltros(p, f({ forma: "Engajado em ações" }))).toBe(false);
    expect(passaNosFiltros(p, f({ locatario: "nao" }))).toBe(false);
    expect(passaNosFiltros(p, f({ locatario: "sim" }))).toBe(true);
    expect(passaNosFiltros(p, f({ bloco: "12" }))).toBe(true);
    expect(passaNosFiltros(p, f({ bloco: "13" }))).toBe(false);
  });

  it("busca por nome (sem acento) ou por CNPJ com ou sem pontuação", () => {
    expect(passaNosFiltros(p, f({ busca: "cafe" }))).toBe(true);
    expect(passaNosFiltros(p, f({ busca: "12.345.678/0001" }))).toBe(true);
    expect(passaNosFiltros(p, f({ busca: "12345678000190" }))).toBe(true);
    expect(passaNosFiltros(p, f({ busca: "99" }))).toBe(false);
    expect(passaNosFiltros(p, f({ busca: "outro nome" }))).toBe(false);
  });

  it("situação: ativos (padrão) inclui a vencer; todas não filtra", () => {
    const l = linhas([
      base({ id: "1" }),
      base({ id: "2", termos: [termo("2025-12-01", "2026-12-01")] }),
      base({ id: "3", termos: [termo("2025-01-01", "2026-01-01")] }),
      base({ id: "4", saiuEm: "2026-05-05" }),
      base({ id: "5", termos: [], interesse: true }),
    ]);
    const ids = (s: Parameters<typeof filtrarPorSituacao>[1]) =>
      filtrarPorSituacao(l, s).map((x) => x.id);
    expect(ids("ativos")).toEqual(["1", "2"]);
    expect(ids("todas")).toHaveLength(5);
    expect(ids("vencido")).toEqual(["3"]);
    expect(ids("saiu")).toEqual(["4"]);
    expect(ids("interessado")).toEqual(["5"]);
    expect(ids("a_vencer")).toEqual(["2"]);
  });
});

describe("cartões (spec 8: 27 ativos locatários e 178 clientes → 27 e 15,2%)", () => {
  const docPj = (n: number) => String(10_000_000_000_000 + n);
  const ativos = Array.from({ length: 27 }, (_, i) =>
    base({ id: `l${i}`, doc: docPj(i) }),
  );
  const todos = [
    ...ativos,
    // Não locatário ativo, locatário vencido e PF: não entram na participação.
    base({ id: "n1", doc: docPj(100), locatario: false }),
    base({
      id: "v1",
      doc: docPj(101),
      termos: [termo("2025-01-01", "2026-01-01")],
    }),
    base({ id: "pf", doc: "12345678909" }),
    base({
      id: "av",
      doc: docPj(102),
      termos: [termo("2025-12-10", "2026-12-10")],
    }),
  ];
  const l = linhas(todos, {
    extras: {
      l0: { contribuido: 100, contribuicoes: 1, acoes: 0, combinadoMes: null },
      l1: { contribuido: 0, contribuicoes: 1, acoes: 0, combinadoMes: null },
    },
  });

  it("participação = ativos locatários PJ ÷ clientes PJ com contrato", () => {
    const r = resumoDosCartoes(l, 178, true);
    // 27 + o "a vencer" (termo válido) = 28 ativos locatários.
    expect(r.ativosLocatarios).toBe(28);
    expect(r.ativos).toBe(30);
    expect(r.aVencer).toBe(1);
    expect(r.contribuiram).toBe(2);
    expect(r.contribuido).toBe(100);
    expect(r.participacao).toBeCloseTo((28 / 178) * 100, 5);
    const so27 = resumoDosCartoes(
      l.filter((x) => x.id !== "av"),
      178,
      true,
    );
    expect(so27.ativosLocatarios).toBe(27);
    expect(so27.participacao?.toFixed(1)).toBe("15.2");
  });

  it("sem Ver valores o cartão Contribuído é null (não aparece)", () => {
    const sem = linhas(todos, { comValores: false });
    expect(resumoDosCartoes(sem, 178, false).contribuido).toBeNull();
  });

  it("clicar no cartão filtra as mesmas linhas que ele conta", () => {
    expect(filtrarPorCartao(l, "participacao")).toHaveLength(28);
    expect(filtrarPorCartao(l, "a_vencer").map((x) => x.id)).toEqual(["av"]);
    expect(filtrarPorCartao(l, "contribuiram")).toHaveLength(2);
  });

  it("sem cliente com contrato a participação é null", () => {
    expect(resumoDosCartoes(l, 0, true).participacao).toBeNull();
  });
});

describe("totais do rodapé", () => {
  it("participantes, contribuído, combinado e ações; null sem valores", () => {
    const ps = [base({ id: "a" }), base({ id: "b" })];
    const extras = {
      a: { contribuido: 100.25, contribuicoes: 2, acoes: 1, combinadoMes: 10 },
      b: { contribuido: 50, contribuicoes: 1, acoes: 4, combinadoMes: null },
    };
    expect(totaisDoClube(linhas(ps, { extras }), true)).toEqual({
      participantes: 2,
      contribuido: 150.25,
      combinado: 100,
      acoes: 5,
    });
    expect(
      totaisDoClube(linhas(ps, { extras, comValores: false }), false),
    ).toEqual({
      participantes: 2,
      contribuido: null,
      combinado: null,
      acoes: 5,
    });
  });
});

describe("agruparLinhas", () => {
  const l = linhas([
    base({ id: "1", formas: ["Pagante", "Contribui com resíduos"] }),
    base({ id: "2", formas: ["Pagante"], locatario: false }),
    base({ id: "3", formas: [] }),
  ]);

  it("sem agrupar: um grupo só, sem rótulo", () => {
    expect(agruparLinhas(l, "", ["Pagante"])).toEqual([
      { chave: "", rotulo: "", linhas: l },
    ]);
  });

  it("por forma: na ordem dos Parâmetros, quem tem duas formas aparece nas duas", () => {
    const g = agruparLinhas(l, "forma", [
      "Pagante",
      "Engajado",
      "Contribui com resíduos",
    ]);
    expect(g.map((x) => [x.rotulo, x.linhas.map((y) => y.id)])).toEqual([
      ["Pagante", ["1", "2"]],
      ["Contribui com resíduos", ["1"]],
      ["Sem forma definida", ["3"]],
    ]);
  });

  it("por locatário", () => {
    const g = agruparLinhas(l, "locatario", []);
    expect(g.map((x) => [x.rotulo, x.linhas.length])).toEqual([
      ["Locatários", 2],
      ["Não locatários", 1],
    ]);
  });
});

describe("gráfico: participantes ativos por ano e forma", () => {
  const ps = [
    base({
      id: "1",
      formas: ["Pagante", "Certificado (selo)"],
      termos: [
        termo("2024-05-01", "2025-05-01"),
        termo("2025-05-01", "2026-05-01"),
        termo("2026-05-01", "2027-05-01"),
      ],
    }),
    base({
      id: "2",
      formas: ["Pagante"],
      termos: [termo("2025-08-01", "2026-08-01")],
    }),
    base({ id: "3", formas: [], termos: [termo("2026-02-01", "2027-02-01")] }),
  ];

  it("anos do primeiro termo até o atual", () => {
    expect(anosDoClube([{ ano: 2024 }, { ano: 2026 }], 2026)).toEqual([
      2024, 2025, 2026,
    ]);
    expect(anosDoClube([], 2026)).toEqual([2026]);
  });

  it("conta quem tinha termo válido no fim de cada ano (hoje no ano corrente)", () => {
    const r = ativosPorAno(ps, [2024, 2025, 2026], HOJE, 30, [
      "Pagante",
      "Certificado (selo)",
    ]);
    expect(r[0]).toMatchObject({ ano: 2024, total: 1 });
    expect(r[0]?.porForma).toEqual({ Pagante: 1, "Certificado (selo)": 1 });
    expect(r[1]).toMatchObject({ ano: 2025, total: 2 });
    expect(r[1]?.porForma.Pagante).toBe(2);
    // Em 2026: o 1 (renovado), o 2 (termo até 01/08/2026) já venceu, o 3 sem forma.
    expect(r[2]).toMatchObject({ ano: 2026, total: 2 });
    expect(r[2]?.porForma).toEqual({
      Pagante: 1,
      "Certificado (selo)": 1,
      "Sem forma definida": 1,
    });
  });
});
