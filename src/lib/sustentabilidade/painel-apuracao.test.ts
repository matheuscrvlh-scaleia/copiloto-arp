import { describe, expect, it } from "vitest";
import {
  apurarClube,
  apurarEnergia,
  apurarEntrevistas,
  apurarGrupos,
  apurarOcupacao,
  apurarPeriodo,
  apurarRcc,
  type ContratoDoPainel,
  competenciasDoAno,
  grupoPorNome,
  type IndicadorDePrograma,
  mensalDoGrupo,
  produtoresDoGrupo,
  somaOuNull,
} from "./painel-apuracao";

const F1 = "f1";
const F3 = "f3";

const indicadores: IndicadorDePrograma[] = [
  {
    nome: "Volume reciclado",
    grupo: "Volume reciclado",
    calculo: "soma",
    formularioId: F1,
    campoId: "peso",
    filtro: null,
    percentualValor: null,
  },
  {
    nome: "Participações de produtores",
    grupo: "Produtores locais",
    calculo: "contagem",
    formularioId: F3,
    campoId: null,
    filtro: null,
    percentualValor: null,
  },
  {
    nome: "Produtores únicos",
    grupo: "Produtores locais",
    calculo: "contagem_distintos",
    formularioId: F3,
    campoId: "produtor",
    filtro: null,
    percentualValor: null,
  },
  {
    nome: "Oficinas",
    grupo: "Oficinas",
    calculo: "contagem",
    formularioId: F1,
    campoId: null,
    filtro: { campo_id: "oficina", valor: "sim" },
    percentualValor: null,
  },
  {
    nome: "Sem grupo",
    grupo: null,
    calculo: "soma",
    formularioId: F1,
    campoId: "peso",
    filtro: null,
    percentualValor: null,
  },
];

const lancamentos = [
  {
    formularioId: F1,
    data: "2026-01-10",
    valores: { peso: 100, oficina: "sim" },
  },
  {
    formularioId: F1,
    data: "2026-01-20",
    valores: { peso: 50, oficina: "nao" },
  },
  {
    formularioId: F1,
    data: "2026-03-05",
    valores: { peso: 200, oficina: "sim" },
  },
  // fora do período (mês depois do "até")
  {
    formularioId: F1,
    data: "2026-06-05",
    valores: { peso: 999, oficina: "sim" },
  },
  // a mesma produtora em 3 feiras de janeiro e uma de março
  { formularioId: F3, data: "2026-01-04", valores: { produtor: "Ana" } },
  { formularioId: F3, data: "2026-01-11", valores: { produtor: "ana" } },
  { formularioId: F3, data: "2026-01-18", valores: { produtor: "Bia" } },
  { formularioId: F3, data: "2026-03-08", valores: { produtor: "Ana" } },
];

describe("competenciasDoAno", () => {
  it("de janeiro até o mês", () => {
    expect(competenciasDoAno(2026, 3)).toEqual([
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
    ]);
  });
});

describe("grupos de impacto", () => {
  const competencias = competenciasDoAno(2026, 3);
  const grupos = apurarGrupos(indicadores, lancamentos, competencias);

  it("soma o volume do grupo no ano e mês a mês, com sem dado onde não há lançamento", () => {
    const g = grupoPorNome(grupos, "volume RECICLADO");
    const m = mensalDoGrupo(g, 3);
    expect(m.total).toBe(350);
    expect(m.porMes).toEqual([150, null, 200]);
  });

  it("indicador sem grupo não entra", () => {
    expect([...grupos.keys()].sort()).toEqual([
      "Oficinas",
      "Produtores locais",
      "Volume reciclado",
    ]);
  });

  it("produtores: participações e únicos em dois números, nunca somados", () => {
    const p = produtoresDoGrupo(grupoPorNome(grupos, "Produtores locais"));
    expect(p.participacoes).toBe(4);
    expect(p.unicos).toBe(2);
  });

  it("grupo inexistente: tudo sem dado", () => {
    const m = mensalDoGrupo(grupoPorNome(grupos, "Inexistente"), 2);
    expect(m).toEqual({ total: null, porMes: [null, null] });
    expect(produtoresDoGrupo(null)).toEqual({
      participacoes: null,
      unicos: null,
    });
  });

  it("oficinas contam só os lançamentos que passam no filtro", () => {
    const m = mensalDoGrupo(grupoPorNome(grupos, "Oficinas"), 3);
    expect(m.total).toBe(2);
    expect(m.porMes).toEqual([1, null, 1]);
  });
});

describe("energia", () => {
  const competencias = competenciasDoAno(2026, 3);
  it("mês sem leitura fica sem dado; total só dos que existem", () => {
    const { energia, co2 } = apurarEnergia(
      [
        { mes: "2026-01-01", kwh: 8000, co2_t: null },
        { mes: "2026-03-01", kwh: 9000.5, co2_t: null },
      ],
      competencias,
    );
    expect(energia.porMes).toEqual([8000, null, 9000.5]);
    expect(energia.total).toBe(17000.5);
    expect(co2).toBeNull();
  });
  it("nenhuma leitura: sem dado, nunca zero", () => {
    const { energia, co2 } = apurarEnergia([], competencias);
    expect(energia.total).toBeNull();
    expect(co2).toBeNull();
  });
  it("com CO₂ informado soma o do período", () => {
    const { co2 } = apurarEnergia(
      [
        { mes: "2026-01-01", kwh: 1, co2_t: 0.5 },
        { mes: "2026-02-01", kwh: 1, co2_t: 0.25 },
      ],
      competencias,
    );
    expect(co2).toBe(0.75);
  });
});

describe("RCC", () => {
  const competencias = competenciasDoAno(2026, 3);
  const fatores = [
    { vigenteDesde: "2000-01-01", toneladasPorCacamba: 8 },
    { vigenteDesde: "2026-03-01", toneladasPorCacamba: 7 },
  ];
  const precos = [{ vigenteDesde: "2000-01-01", precoA: 100, precoB: 400 }];
  const notas = [
    { competencia: "2026-01-01", cacambasA: 3, cacambasB: 1 },
    { competencia: "2026-03-01", cacambasA: 2, cacambasB: 0 },
    { competencia: "2026-08-01", cacambasA: 9, cacambasB: 9 },
  ];

  it("cada nota usa o fator vigente na competência dela (A 24 t, B 8 t em janeiro)", () => {
    const r = apurarRcc(notas, fatores, precos, competencias);
    expect(r.a.porMes).toEqual([24, null, 14]);
    expect(r.b.porMes).toEqual([8, null, 0]);
    expect(r.total.total).toBe(46);
    expect(r.pctReciclado).toBeCloseTo((38 / 46) * 100);
    expect(r.economia).toBe(3 * 300 + 2 * 300);
  });

  it("sem preços (sem permissão de valores) o valor é null, nunca zero", () => {
    const r = apurarRcc(notas, fatores, null, competencias);
    expect(r.economia).toBeNull();
    expect(r.total.total).toBe(46);
  });

  it("sem nota no período: tudo sem dado", () => {
    const r = apurarRcc([], fatores, precos, competencias);
    expect(r.total.total).toBeNull();
    expect(r.pctReciclado).toBeNull();
    expect(r.a.porMes).toEqual([null, null, null]);
  });
});

describe("apurarPeriodo", () => {
  it("junta programas, energia e RCC de um ano até um mês", () => {
    const p = apurarPeriodo({
      ano: 2026,
      ateMes: 3,
      indicadores,
      lancamentos,
      geracao: [{ mes: "2026-02-01", kwh: 100, co2_t: null }],
      notas: [{ competencia: "2026-01-01", cacambasA: 3, cacambasB: 1 }],
      fatores: [{ vigenteDesde: "2000-01-01", toneladasPorCacamba: 8 }],
      precos: null,
      grupos: {
        volume: "Volume reciclado",
        pessoas: "Pessoas impactadas",
        oficinas: "Oficinas",
        produtores: "Produtores locais",
      },
    });
    expect(p.volume.total).toBe(350);
    expect(p.pessoas.total).toBeNull();
    expect(p.energia.total).toBe(100);
    expect(p.rcc.total.total).toBe(32);
    expect(p.rcc.pctReciclado).toBe(75);
    expect(p.produtores).toEqual({ participacoes: 4, unicos: 2 });
  });
});

describe("somaOuNull", () => {
  it("zero de verdade aparece; só nulos dão null", () => {
    expect(somaOuNull([0, null])).toBe(0);
    expect(somaOuNull([null, undefined])).toBeNull();
  });
});

describe("clube", () => {
  const contratos: ContratoDoPainel[] = ["1", "2", "3", "4"].map((d, i) => ({
    id: `c${i}`,
    situacao: i === 3 ? "encerrado" : "vigente",
    rescisao: null,
    tipoLoja: "Loja",
    clienteDoc: d.repeat(11),
    ativacao: "2025-01-01",
    ativacaoCorrigida: null,
    inicio: null,
    dispensada: false,
    validadeEspecificaMeses: null,
  }));
  const participantes = [
    {
      id: "p1",
      clienteDoc: "1".repeat(11),
      locatarioManual: false,
      saiuEm: null,
    },
    {
      id: "p2",
      clienteDoc: "2".repeat(11),
      locatarioManual: false,
      saiuEm: null,
    },
    {
      id: "p3",
      clienteDoc: "9".repeat(11),
      locatarioManual: true,
      saiuEm: null,
    },
    {
      id: "p4",
      clienteDoc: "3".repeat(11),
      locatarioManual: false,
      saiuEm: "2026-05-01",
    },
  ];
  const termos = [
    { participanteId: "p1", assinadoEm: "2026-01-10", validoAte: "2027-01-10" },
    // venceu antes de hoje
    { participanteId: "p2", assinadoEm: "2025-01-10", validoAte: "2026-01-10" },
    { participanteId: "p3", assinadoEm: "2026-02-01", validoAte: "2027-02-01" },
    { participanteId: "p4", assinadoEm: "2026-01-01", validoAte: "2027-01-01" },
  ];

  it("ativos = termo válido e sem saída; locatários sobre os clientes com contrato vigente", () => {
    const c = apurarClube({
      participantes,
      termos,
      contratos,
      data: "2026-11-16",
      avisoDias: 30,
    });
    expect(c.ativos).toBe(2); // p1 e p3
    expect(c.locatarios).toBe(1); // só p1 (p3 não é locatário)
    expect(c.clientes).toBe(3); // o contrato encerrado não conta
    expect(c.participacao).toBeCloseTo((1 / 3) * 100);
  });

  it("antes da saída o participante ainda era ativo (painel de um ano passado)", () => {
    const c = apurarClube({
      participantes,
      termos,
      contratos,
      data: "2026-03-01",
      avisoDias: 30,
    });
    expect(c.ativos).toBe(3); // p1, p3 (assinou em fev), p4 (ainda não saiu)
  });

  it("sem contrato vigente a participação fica sem dado", () => {
    const c = apurarClube({
      participantes,
      termos,
      contratos: [],
      data: "2026-11-16",
      avisoDias: 30,
    });
    expect(c.participacao).toBeNull();
  });
});

describe("entrevistas", () => {
  const parametros = {
    mesesPrimeira: 6,
    validadePadraoMeses: 24,
    validadePorSetor: {},
    avisoDias: 30,
  };
  const base: Omit<ContratoDoPainel, "id"> = {
    situacao: "vigente",
    rescisao: null,
    tipoLoja: "Loja",
    clienteDoc: "1".repeat(11),
    ativacao: "2026-03-01",
    ativacaoCorrigida: null,
    inicio: null,
    dispensada: false,
    validadeEspecificaMeses: null,
  };
  const contratos: ContratoDoPainel[] = [
    { ...base, id: "pendente" }, // ativado em 01/03, 6 meses: pendente desde 01/09
    { ...base, id: "emdia" },
    { ...base, id: "vencida" },
    { ...base, id: "aguardando", ativacao: "2026-10-01" },
    { ...base, id: "publicidade", tipoLoja: "Área Publicitária" },
    { ...base, id: "rescindido", rescisao: "2026-05-01" },
  ];
  const entrevistas = [
    { contratoId: "emdia", data: "2026-06-01", setor: null },
    { contratoId: "vencida", data: "2024-01-01", setor: null },
  ];

  it("em dia ÷ quem precisa; pendentes e vencidas à parte", () => {
    const r = apurarEntrevistas({
      contratos,
      entrevistas,
      parametros,
      tiposLojaDispensados: ["Área Publicitária"],
      dataInauguracao: "ativacao",
      data: "2026-11-09",
    });
    // lista: pendente, emdia, vencida, aguardando (3 precisam)
    expect(r.precisam).toBe(3);
    expect(r.emDia).toBe(1);
    expect(r.pendentes).toBe(1);
    expect(r.vencidas).toBe(1);
    expect(r.pct).toBeCloseTo((1 / 3) * 100);
  });

  it("sem contrato que precise: sem dado", () => {
    const r = apurarEntrevistas({
      contratos: [],
      entrevistas: [],
      parametros,
      tiposLojaDispensados: [],
      dataInauguracao: "ativacao",
      data: "2026-11-09",
    });
    expect(r.pct).toBeNull();
  });

  it("entrevista depois da data de referência não conta", () => {
    const r = apurarEntrevistas({
      contratos: [{ ...base, id: "emdia" }],
      entrevistas: [{ contratoId: "emdia", data: "2026-10-01", setor: null }],
      parametros,
      tiposLojaDispensados: [],
      dataInauguracao: "ativacao",
      data: "2026-09-15",
    });
    expect(r.emDia).toBe(0);
    expect(r.pendentes).toBe(1);
  });
});

describe("ocupação dos coletores", () => {
  it("média ponderada por cor; sem item, sem dado", () => {
    const o = apurarOcupacao([
      {
        itens: [
          { coletorId: "a", cor: "preto", conteineres: 2, ocupacaoPct: 50 },
          { coletorId: "b", cor: "preto", conteineres: 1, ocupacaoPct: 80 },
        ],
      },
      { itens: [] },
    ]);
    expect(o.preto).toBeCloseTo(60);
    expect(o.azul).toBeNull();
    expect(o.rondas).toBe(2);
  });
});
