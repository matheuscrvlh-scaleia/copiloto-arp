import { describe, expect, it } from "vitest";
import {
  deveLancarNoMes,
  lerRefDaCobranca,
  mesACobrar,
  mesAnterior,
  type ProgramaParaCobrar,
  programasACobrar,
  refDaCobranca,
} from "./programas-cobranca";
import {
  calcularDoPrograma,
  competenciasDoAno,
  formatarValorDoIndicador,
  type IndicadorDoPrograma,
  indicadoresVisiveis,
  type LancamentoDoIndicador,
  painelDosProgramas,
  somaDoGrupoNoMes,
} from "./programas-indicadores";
import {
  confereToken,
  hashDoToken,
  inicioDoMesEmBrasilia,
  novoToken,
  podeCorrigirPeloLink,
  tokenValido,
} from "./programas-link";

const ML = "a0000000-0000-4000-8000-000000000002";
const TUR = "a0000000-0000-4000-8000-000000000003";
const F3 = "a0000000-0000-4000-8000-0000000000f3";
const F6 = "a0000000-0000-4000-8000-0000000000f6";

const ind = (o: Partial<IndicadorDoPrograma>): IndicadorDoPrograma => ({
  id: o.nome ?? "i",
  programa_id: ML,
  nome: "i",
  formulario_id: F3,
  campo_id: null,
  calculo: "contagem",
  filtro: null,
  percentual_valor: null,
  unidade: null,
  grupo: null,
  mostrar_painel: true,
  em_reais: false,
  ativo: true,
  ordem: 0,
  ...o,
});

const PARTICIPACOES = ind({
  nome: "Participações de produtores",
  grupo: "Produtores locais",
  unidade: "participações",
  ordem: 1,
});
const UNICOS = ind({
  nome: "Produtores únicos",
  campo_id: "produtor",
  calculo: "contagem_distintos",
  grupo: "Produtores locais",
  unidade: "produtores",
  ordem: 2,
});

// Seção 8: a mesma produtora em 4 feiras do mês e outras 3 em 1 feira cada.
const feira = (data: string, produtor: string): LancamentoDoIndicador => ({
  programa_id: ML,
  formulario_id: F3,
  data,
  valores: { data, produtor },
});
const FEIRAS = [
  feira("2026-11-01", "Maria Queijos"),
  feira("2026-11-08", "maria queijos"),
  feira("2026-11-15", "Maria Queijos"),
  feira("2026-11-22", "Maria Queijos"),
  feira("2026-11-01", "Sítio Boa Vista"),
  feira("2026-11-08", "Mel da Serra"),
  feira("2026-11-15", "Pães do Vale"),
];

describe("produtores únicos (seção 8)", () => {
  const comps = competenciasDoAno(2026, 11);

  it("participações 7, produtores únicos 4, separados no painel", () => {
    expect(calcularDoPrograma(PARTICIPACOES, FEIRAS, comps).periodo).toBe(7);
    expect(calcularDoPrograma(UNICOS, FEIRAS, comps).periodo).toBe(4);
    const painel = painelDosProgramas({
      programas: [{ id: ML, nome: "Mercado Local", area: null, ativo: true }],
      indicadores: [PARTICIPACOES, UNICOS],
      lancamentos: FEIRAS,
      competencias: comps,
      comValores: false,
    });
    const g = painel.grupos.find((x) => x.grupo === "Produtores locais");
    expect(g?.ano).toBe(7); // só as participações somam
    expect(g?.porMes[10]).toBe(7);
    expect(g?.aParte.map((a) => [a.nome, a.ano])).toEqual([
      ["Produtores únicos", 4],
    ]);
  });

  it("no ano é distinto do ano, não a soma dos meses", () => {
    const doisMeses = [
      ...FEIRAS,
      feira("2026-10-04", "Maria Queijos"),
      feira("2026-10-11", "Horta Nova"),
    ];
    const c = calcularDoPrograma(UNICOS, doisMeses, comps);
    expect(c.porMes[9]?.valor).toBe(2);
    expect(c.porMes[10]?.valor).toBe(4);
    expect(c.periodo).toBe(5);
    expect(c.porMes[0]?.valor).toBeNull(); // sem lançamento: sem dado
  });

  it("indicador conta só o seu formulário e o seu programa", () => {
    const outro: LancamentoDoIndicador = {
      programa_id: ML,
      formulario_id: "outro",
      data: "2026-11-02",
      valores: {},
    };
    expect(
      calcularDoPrograma(PARTICIPACOES, [...FEIRAS, outro], comps).periodo,
    ).toBe(7);
  });
});

describe("valores e grupos", () => {
  const RECEITA = ind({
    nome: "Receita da ARP no tour",
    programa_id: TUR,
    formulario_id: F6,
    campo_id: "receita_arp",
    calculo: "soma",
    em_reais: true,
  });
  const PARTICIPANTES = ind({
    nome: "Participantes do tour",
    programa_id: TUR,
    formulario_id: F6,
    campo_id: "participantes",
    calculo: "soma",
    grupo: "Pessoas impactadas",
  });
  const tour: LancamentoDoIndicador = {
    programa_id: TUR,
    formulario_id: F6,
    data: "2026-11-20",
    valores: { participantes: 25, receita_arp: 250 },
  };

  it("indicador em reais só com 'Ver valores'; inativo nunca", () => {
    const lista = [RECEITA, PARTICIPANTES, ind({ nome: "x", ativo: false })];
    expect(indicadoresVisiveis(lista, false).map((i) => i.nome)).toEqual([
      "Participantes do tour",
    ]);
    expect(indicadoresVisiveis(lista, true)).toHaveLength(2);
  });

  it("pessoas impactadas no mês soma o grupo", () => {
    expect(
      somaDoGrupoNoMes(
        "Pessoas impactadas",
        [PARTICIPANTES, RECEITA],
        [tour],
        "2026-11-01",
        true,
      ),
    ).toBe(25);
    expect(
      somaDoGrupoNoMes(
        "Pessoas impactadas",
        [PARTICIPANTES],
        [tour],
        "2026-10-01",
        true,
      ),
    ).toBeNull();
  });

  it("formatos: sem dado, reais, percentual e unidade", () => {
    expect(formatarValorDoIndicador(null, RECEITA)).toBe("sem dado");
    expect(formatarValorDoIndicador(1234.5, RECEITA)).toBe("1.234,50");
    expect(
      formatarValorDoIndicador(15.168, ind({ calculo: "percentual" })),
    ).toBe("15,2%");
    expect(formatarValorDoIndicador(7, PARTICIPACOES)).toBe("7 participações");
  });
});

describe("token do link do parceiro", () => {
  it("hash sha256 em hexa (o banco guarda só ele)", () => {
    expect(hashDoToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    const t = novoToken();
    expect(tokenValido(t)).toBe(true);
    expect(hashDoToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(confereToken(t, hashDoToken(t))).toBe(true);
    expect(confereToken(t, hashDoToken(novoToken()))).toBe(false);
  });

  it("formato inválido nem chega ao banco", () => {
    expect(tokenValido("abc")).toBe(false);
    expect(tokenValido(`${"a".repeat(42)}!`)).toBe(false);
    expect(confereToken("abc", hashDoToken("abc"))).toBe(false);
  });

  it("corrige até o fim do mês em que lançou (Brasília)", () => {
    const agora = new Date("2026-11-30T23:00:00-03:00");
    expect(podeCorrigirPeloLink("2026-11-02T10:00:00-03:00", agora)).toBe(true);
    expect(podeCorrigirPeloLink("2026-10-31T22:00:00-03:00", agora)).toBe(
      false,
    );
    // 01/12 às 01h de Brasília ainda é 30/11 em UTC−3? Não: já é dezembro.
    expect(
      podeCorrigirPeloLink(
        "2026-11-30T20:00:00-03:00",
        new Date("2026-12-01T01:00:00-03:00"),
      ),
    ).toBe(false);
    expect(inicioDoMesEmBrasilia(agora)).toBe("2026-11-01T03:00:00.000Z");
  });
});

describe("cobrança do lançamento do parceiro", () => {
  const prog = (o: Partial<ProgramaParaCobrar>): ProgramaParaCobrar => ({
    id: "p",
    ativo: true,
    frequencia: "mensal",
    inicio: "2024-01-01",
    fim: null,
    ...o,
  });

  it("no dia da cobrança (ou depois) cobra o mês anterior", () => {
    expect(mesAnterior("2026-01-05")).toBe("2025-12");
    expect(mesACobrar("2026-11-04", 5)).toBeNull();
    expect(mesACobrar("2026-11-05", 5)).toBe("2026-10");
    expect(mesACobrar("2026-11-20", 5)).toBe("2026-10");
  });

  it("só ativo, mensal e vigente no mês cobrado", () => {
    expect(deveLancarNoMes(prog({}), "2026-10")).toBe(true);
    expect(deveLancarNoMes(prog({ ativo: false }), "2026-10")).toBe(false);
    expect(deveLancarNoMes(prog({ frequencia: "evento" }), "2026-10")).toBe(
      false,
    );
    expect(deveLancarNoMes(prog({ inicio: "2026-11-01" }), "2026-10")).toBe(
      false,
    );
    expect(deveLancarNoMes(prog({ fim: "2026-09-30" }), "2026-10")).toBe(false);
  });

  it("sem lançamento no mês anterior gera; com lançamento, não", () => {
    const programas = [prog({ id: "a" }), prog({ id: "b" })];
    expect(
      programasACobrar(programas, new Set(["b"]), "2026-11-05", 5),
    ).toEqual({ mes: "2026-10", programas: ["a"] });
    expect(
      programasACobrar(programas, new Set(), "2026-11-04", 5).programas,
    ).toEqual([]);
  });

  it("referência do chamado", () => {
    const ref = refDaCobranca(ML, "2026-10");
    expect(ref).toBe(`cobranca:${ML}:2026-10`);
    expect(lerRefDaCobranca(ref)).toEqual({ programaId: ML, mes: "2026-10" });
    expect(lerRefDaCobranca("entrevista:x")).toBeNull();
  });
});
