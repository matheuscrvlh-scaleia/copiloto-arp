import { describe, expect, it } from "vitest";
import type { FontesEnet } from "@/lib/comercial/fontes";
import {
  acompanhamentoPorBloco,
  blocoDoLocal,
  convitesDosLocatarios,
  empresasComSugestao,
  filtrarRespostas,
  indicadoresCenso,
  lerReais,
  linhasDosTemas,
  mediana,
  periodoDosContatos,
  porGrupo,
  type RespostaIndicador,
  type SugestaoFeedback,
  semNomeDaEmpresa,
  situacaoDoLink,
  ticketAjustado,
  VAZIO,
  validarQuestionario,
} from "./censo";

const EXP = [
  "Manter meu espaço",
  "Ampliar espaço",
  "Empreender com um novo negócio/projeto",
  "Reduzir meu espaço",
];

const r = (p: Partial<RespostaIndicador>): RespostaIndicador => ({
  bloco: "11",
  segmento: "Serviços",
  colaboradores: null,
  visitantes_dia: null,
  ticket_ajustado: null,
  conversoes_dia: null,
  expectativas: [],
  ...p,
});

describe("ticket ajustado", () => {
  it("mensalidade de 199,00 em 22 dias vira 9,05", () => {
    const t = ticketAjustado(199, true, 22) as number;
    expect(t.toFixed(2)).toBe("9.05");
  });
  it("sem mensalidade é o próprio ticket; sem ticket, nada", () => {
    expect(ticketAjustado(80, false, null)).toBe(80);
    expect(ticketAjustado(80, true, null)).toBe(80);
    expect(ticketAjustado(null, true, 22)).toBeNull();
  });
});

describe("indicadores da rodada", () => {
  const respostas = [
    r({
      colaboradores: 2,
      visitantes_dia: 10,
      ticket_ajustado: 50,
      conversoes_dia: 4,
      expectativas: [EXP[0] as string],
    }),
    r({
      colaboradores: 4,
      visitantes_dia: 0,
      ticket_ajustado: 100,
      conversoes_dia: 1,
      expectativas: [EXP[0] as string, EXP[2] as string],
    }),
    r({
      colaboradores: 30,
      visitantes_dia: 40,
      ticket_ajustado: 9.05,
      conversoes_dia: null,
      segmento: "Comércio",
      expectativas: [EXP[1] as string],
    }),
    // "-" no número: ficou nulo e sai daquele indicador.
    r({
      colaboradores: null,
      visitantes_dia: null,
      ticket_ajustado: null,
      conversoes_dia: 5,
      bloco: null,
      expectativas: [EXP[0] as string],
    }),
  ];
  const i = indicadoresCenso(respostas, EXP);

  it("conta empresas, soma colaboradores e visitantes", () => {
    expect(i.empresas).toBe(4);
    expect(i.colaboradores).toBe(36);
    expect(i.mediaColaboradores).toBe(12);
    expect(i.medianaColaboradores).toBe(4);
    expect(i.visitantes).toBe(50);
    expect(i.pessoas).toBe(86);
  });
  it("atendimento ao público só entre as respostas válidas", () => {
    expect(i.visitantesValidos).toBe(3);
    expect(i.pctAtendimento).toBeCloseTo((2 / 3) * 100, 6);
  });
  it("ticket ponderado pelas conversões, só com ticket e conversões", () => {
    expect(i.movimentacao).toBe(300);
    expect(i.conversoes).toBe(5);
    expect(i.ticketMedio).toBe(60);
  });
  it("expectativas sobre o total de empresas (a soma passa de 100%)", () => {
    expect(i.expectativas.map((e) => e.pct)).toEqual([75, 25, 25, 0]);
    expect(i.expectativas.reduce((s, e) => s + e.pct, 0)).toBeGreaterThan(100);
  });
  it("rodada vazia não divide por zero", () => {
    const v = indicadoresCenso([], EXP);
    expect(v.mediaColaboradores).toBeNull();
    expect(v.pctAtendimento).toBeNull();
    expect(v.ticketMedio).toBeNull();
  });
  it("mediana com quantidade par", () => {
    expect(mediana([1, 2, 3, 10])).toBe(2.5);
    expect(mediana([])).toBeNull();
  });
  it("quadros por bloco e segmento, com (vazio)", () => {
    const seg = porGrupo(respostas, "segmento");
    expect(seg[0]).toMatchObject({
      grupo: "Comércio",
      visitantes: 40,
      empresas: 1,
    });
    expect(seg[1]).toMatchObject({
      grupo: "Serviços",
      empresas: 3,
      movimentacao: 300,
    });
    expect(porGrupo(respostas, "bloco").map((g) => g.grupo)).toEqual([
      "11",
      VAZIO,
    ]);
    expect(filtrarRespostas(respostas, { bloco: VAZIO })).toHaveLength(1);
    expect(
      filtrarRespostas(respostas, { segmento: "Comércio", bloco: "11" }),
    ).toHaveLength(1);
  });
});

describe("convites a partir do ENET", () => {
  const enet = {
    lucs: [
      { numero: "11_105", local: "Bloco 11", tipo_loja: "Loja Comercial" },
      { numero: "03_101", local: "Bloco 03", tipo_loja: "Sala Comercial" },
      { numero: "11_101", local: "Bloco 11", tipo_loja: "Loja Comercial" },
      { numero: "OOH_01", local: "ARP", tipo_loja: "Área Publicitária" },
    ],
    contratos: [
      {
        luc: "11_105",
        cliente: "CL1",
        data_inicio: "2020-01-01",
        data_rescisao: null,
      },
      {
        luc: "11_101",
        cliente: "CL1",
        data_inicio: "2021-01-01",
        data_rescisao: null,
      },
      {
        luc: "03_101",
        cliente: "CL2",
        data_inicio: "2020-01-01",
        data_rescisao: "2026-01-01",
      },
      {
        luc: "OOH_01",
        cliente: "CL3",
        data_inicio: "2020-01-01",
        data_rescisao: null,
      },
    ],
    clientes: [
      { codigo: "CL1", nome: "Ateliê Alecrim" },
      { codigo: "CL2", nome: "Saiu" },
      { codigo: "CL3", nome: "Só mídia" },
    ],
  } as unknown as FontesEnet;

  it("uma empresa por locatário ativo, sem mídia, com o menor LUC", () => {
    const c = convitesDosLocatarios(
      enet,
      "2026-11-04",
      new Set(["Área Publicitária"]),
      ["11"],
    );
    expect(c).toEqual([
      {
        locatario_enet_id: "CL1",
        empresa_nome: "Ateliê Alecrim",
        luc: "11_101",
        bloco: "11",
      },
    ]);
  });
  it("bloco do local do ENET", () => {
    expect(blocoDoLocal("Bloco 03", ["1", "2"])).toBe("3");
    expect(blocoDoLocal("Bloco 11", ["11"])).toBe("11");
    expect(blocoDoLocal("ARP", ["11"])).toBeNull();
  });
  it("acompanhamento por bloco: respondeu e falta", () => {
    const q = acompanhamentoPorBloco(
      [
        { bloco: "2", respondeu: true },
        { bloco: "2", respondeu: false },
        { bloco: "1", respondeu: false },
        { bloco: null, respondeu: true },
      ],
      ["1", "2"],
    );
    expect(q.map((l) => [l.bloco, l.responderam, l.faltam])).toEqual([
      ["1", 0, 1],
      ["2", 1, 1],
      [VAZIO, 1, 0],
    ]);
    expect(q[1]?.pct).toBe(50);
  });
});

describe("questionário", () => {
  const opcoes = {
    blocos: ["11", "QQ"],
    segmentos: ["Serviços"],
    expectativas: EXP,
  };
  const base = {
    email: "contato@exemplo.com",
    bloco: "11",
    segmento: "Serviços",
    empresa_nome: "Ateliê",
    colaboradores: "3",
    visitantes_dia: "0",
    expectativas: [EXP[0] as string],
  };

  it("aceita o mínimo obrigatório", () => {
    const v = validarQuestionario(base, opcoes);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.dados.ticket).toBeNull();
      expect(v.dados.mensalidade).toBeNull();
    }
  });
  it('recusa texto em número (o "-" de 2026)', () => {
    const v = validarQuestionario(
      { ...base, colaboradores: "-", visitantes_dia: "cerca de 20" },
      opcoes,
    );
    expect(v.ok).toBe(false);
    if (!v.ok)
      expect(Object.keys(v.erros).sort()).toEqual([
        "colaboradores",
        "visitantes_dia",
      ]);
  });
  it("7a só vale com a 7 respondida; mensalidade calcula o ticket ajustado", () => {
    const sem = validarQuestionario(
      { ...base, mensalidade: "sim", dias_uso: "22" },
      opcoes,
    );
    expect(sem.ok && sem.dados.mensalidade).toBeNull();
    const com = validarQuestionario(
      { ...base, ticket: "199,00", mensalidade: "sim", dias_uso: "22" },
      opcoes,
    );
    expect(com.ok).toBe(true);
    if (com.ok) {
      expect(com.dados.dias_uso).toBe(22);
      expect(com.dados.ticket_ajustado?.toFixed(2)).toBe("9.05");
    }
    const semDias = validarQuestionario(
      { ...base, ticket: "199", mensalidade: "sim" },
      opcoes,
    );
    expect(semDias.ok).toBe(false);
  });
  it("obrigatórias e opções das listas", () => {
    const v = validarQuestionario(
      { ...base, bloco: "99", segmento: "", expectativas: [], email: "x" },
      opcoes,
    );
    expect(v.ok).toBe(false);
    if (!v.ok)
      expect(Object.keys(v.erros).sort()).toEqual([
        "bloco",
        "email",
        "expectativas",
        "segmento",
      ]);
  });
  it("valor em reais", () => {
    expect(lerReais("1.234,56")).toBe(1234.56);
    expect(lerReais("R$ 45,9")).toBe(45.9);
    expect(lerReais("45.90")).toBe(45.9);
    expect(lerReais("")).toBeNull();
    expect(lerReais("uns 50")).toBe("invalido");
  });
  it("link fecha com a rodada encerrada ou depois do fim", () => {
    const rodada = {
      situacao: "aberta",
      inicio: "2026-10-01",
      fim: "2026-11-30",
    };
    expect(situacaoDoLink(rodada, "2026-11-04")).toBe("aberta");
    expect(situacaoDoLink(rodada, "2026-12-01")).toBe("encerrada");
    expect(situacaoDoLink(rodada, "2026-09-30")).toBe("antes");
    expect(
      situacaoDoLink({ ...rodada, situacao: "encerrada" }, "2026-11-04"),
    ).toBe("encerrada");
  });
});

describe("feedbacks por tema", () => {
  const s = (p: Partial<SugestaoFeedback>): SugestaoFeedback => ({
    chave: "r:1",
    origem: "censo",
    texto: "",
    empresa: "a",
    nomes: [],
    bloco: "11",
    segmento: "Serviços",
    temas: [],
    ...p,
  });
  const temas = [
    { id: "t1", nome: "Sinalização" },
    { id: "t2", nome: "Serviços no espaço" },
  ];
  const sugestoes = [
    s({
      chave: "r:1",
      empresa: "a",
      nomes: ["Café Aurora"],
      texto: "Clientes do Cafe aurora pedem placas",
      temas: [{ vinculo: "v1", tema: "t1", trecho: null }],
    }),
    s({
      chave: "r:2",
      empresa: "b",
      texto: "Melhor sinalização",
      temas: [{ vinculo: "v2", tema: "t1", trecho: null }],
    }),
    s({
      chave: "c:3",
      origem: "contato",
      empresa: "a",
      texto: "Placa na entrada",
      temas: [{ vinculo: "v3", tema: "t1", trecho: null }],
    }),
    s({
      chave: "r:4",
      empresa: "c",
      texto: "Caixa 24 horas",
      temas: [
        { vinculo: "v4", tema: "t2", trecho: "Caixa eletrônico 24 horas" },
      ],
    }),
    s({ chave: "r:5", empresa: "d", texto: "Sem tema ainda" }),
  ];

  it("conta empresas sem repetir e nunca mostra o nome da empresa", () => {
    const l = linhasDosTemas(sugestoes, temas);
    expect(l.map((x) => [x.nome, x.empresas, x.sugestoes])).toEqual([
      ["Sinalização", 2, 3],
      ["Serviços no espaço", 1, 1],
      ["Sem tema", 1, 1],
    ]);
    expect(l[0]?.exemplos).toHaveLength(3);
    expect(l[0]?.exemplos[0]).toBe("Clientes do [empresa] pedem placas");
    expect(l[1]?.exemplos).toEqual(["Caixa eletrônico 24 horas"]);
    expect(empresasComSugestao(sugestoes)).toBe(4);
  });
  it("tira o nome sem diferença de acento e maiúscula", () => {
    expect(
      semNomeDaEmpresa("Aqui na ATELIE ALECRIM tudo ótimo", ["Ateliê Alecrim"]),
    ).toBe("Aqui na [empresa] tudo ótimo");
  });
  it("período dos registros de contato da rodada", () => {
    const rodadas = [
      { id: "a", inicio: "2026-06-01", fim: "2026-07-15" },
      { id: "b", inicio: "2026-10-01", fim: "2026-11-30" },
    ];
    expect(periodoDosContatos(rodadas, "a", "2026-11-04")).toEqual({
      de: null,
      ate: "2026-07-15",
    });
    expect(periodoDosContatos(rodadas, "b", "2026-12-10")).toEqual({
      de: "2026-07-15",
      ate: "2026-12-10",
    });
  });
});
