import { describe, expect, it } from "vitest";
import {
  avisosDaCaixa,
  type CaixaBase,
  type ContratoEnet,
  caixaNoFiltro,
  contar,
  contratoDaSala,
  entrarNaGrade,
  lerLuc,
  mesmoLocatario,
  montarPainel,
  normalizarBloco,
  opcoesDeDisjuntor,
  padronizarMedidor,
  pctOcupado,
  proximaPosicao,
  separarDisjuntor,
  statusDaCarga,
  textoDoDisjuntor,
  unidadesDoTexto,
  validarDisjuntor,
} from "./energia";

const DISJUNTORES = [
  "40A Monofásico",
  "40A Bifásico",
  "40A Trifásico",
  "50A Trifásico",
  "70A Trifásico",
];
const LIGACOES = ["Monofásica", "Bifásica", "Trifásica"];
const SITUACOES = [
  "Medidor ativo",
  "Chicote de espera",
  "Cabos de espera",
  "Tampa cega",
  "Outro",
];

function caixa(c: Partial<CaixaBase> = {}): CaixaBase {
  return {
    id: c.numero ?? "1",
    numero: "1824",
    numero_antigo: null,
    lado: "esquerdo",
    coluna: 1,
    linha: 1,
    status: "ocupado",
    sala: "Sala 101",
    ocupante: "Café Serra",
    locatario_novo: false,
    com_termo: true,
    ...c,
  };
}

describe("regras da carga do catálogo", () => {
  it("status do arquivo → status da caixa", () => {
    expect(statusDaCarga("ocupado")).toBe("ocupado");
    expect(statusDaCarga("OCUPADO COM MEDIDOR")).toBe("ocupado");
    expect(statusDaCarga("livre")).toBe("livre");
    expect(statusDaCarga("VAZIO (EM ESPERA / GIZ)")).toBe("livre");
    expect(statusDaCarga("reserva")).toBe("reservado");
    expect(statusDaCarga("demolido")).toBeNull();
  });

  it("disjuntor em texto livre → amperes e ligação", () => {
    expect(separarDisjuntor("40A Monofásico")).toEqual({
      amperes: 40,
      ligacao: "Monofásica",
    });
    expect(separarDisjuntor("Disj. 3x40A Trifásico")).toEqual({
      amperes: 40,
      ligacao: "Trifásica",
    });
    expect(separarDisjuntor("3x50A")).toEqual({
      amperes: 50,
      ligacao: "Trifásica",
    });
    expect(separarDisjuntor("40A em espera")).toEqual({
      amperes: 40,
      ligacao: null,
    });
    expect(separarDisjuntor("sem disjuntor")).toEqual({
      amperes: null,
      ligacao: null,
    });
    expect(textoDoDisjuntor(50, "Trifásica")).toBe("50A Trifásico");
    expect(textoDoDisjuntor(null, null)).toBe("");
  });

  it("medidor em texto livre → situação da lista; o resto vira Outro", () => {
    expect(padronizarMedidor("Vazio (Chicote de Espera)", SITUACOES)).toBe(
      "Chicote de espera",
    );
    expect(padronizarMedidor("Cabos de espera", SITUACOES)).toBe(
      "Cabos de espera",
    );
    expect(padronizarMedidor("Medidor Digital Ativo", SITUACOES)).toBe(
      "Medidor ativo",
    );
    expect(padronizarMedidor("Ativo Display Digital", SITUACOES)).toBe(
      "Medidor ativo",
    );
    expect(padronizarMedidor("Tampa Cega", SITUACOES)).toBe("Tampa cega");
    expect(padronizarMedidor("Aguardando Energisa", SITUACOES)).toBe("Outro");
    expect(padronizarMedidor("", SITUACOES)).toBeNull();
    expect(padronizarMedidor("Tampa cega", ["Medidor ativo"])).toBeNull();
  });
});

describe("disjuntor × ligação", () => {
  const opcoes = opcoesDeDisjuntor(DISJUNTORES, LIGACOES);

  it("opções vêm da lista dos parâmetros, só ligações aceitas", () => {
    expect(opcoes.map((o) => o.valor)).toEqual([
      "40|Monofásica",
      "40|Bifásica",
      "40|Trifásica",
      "50|Trifásica",
      "70|Trifásica",
    ]);
    expect(
      opcoesDeDisjuntor(DISJUNTORES, ["Monofásica"]).map((o) => o.rotulo),
    ).toEqual(["40A Monofásico"]);
  });

  it("o valor atual fora da lista continua como opção", () => {
    const comAtual = opcoesDeDisjuntor(DISJUNTORES, LIGACOES, {
      amperes: 63,
      ligacao: "Trifásica",
    });
    expect(comAtual.at(-1)).toMatchObject({
      valor: "63|Trifásica",
      rotulo: "63A Trifásico",
    });
  });

  it("recusa combinação que não está na lista; vazio vale", () => {
    expect(validarDisjuntor("50|Trifásica", opcoes)).toEqual({
      amperes: 50,
      ligacao: "Trifásica",
    });
    expect(validarDisjuntor("70|Monofásica", opcoes).erro).toMatch(/lista/);
    expect(validarDisjuntor("", opcoes)).toEqual({
      amperes: null,
      ligacao: null,
    });
  });
});

describe("ENET", () => {
  const contratos: ContratoEnet[] = [
    {
      bloco: "12",
      luc: "12_104",
      nome: "Sala 104",
      locatario: "Ateliê Serrano",
      documento: "00.000.901/0001-00",
      contrato: "CONTR-9001",
      inicio: "2026-11-03",
      fim: null,
    },
    {
      bloco: null,
      luc: "12_104",
      nome: "Sala 104",
      locatario: "Doce Trama",
      documento: null,
      contrato: null,
      inicio: "2023-02-01",
      fim: null,
    },
    {
      bloco: "Bloco 4",
      luc: "311",
      nome: "Sala 311",
      locatario: "Pet Amigo",
      documento: null,
      contrato: null,
      inicio: null,
      fim: null,
    },
  ];

  it("lê bloco e unidades de textos variados", () => {
    expect(normalizarBloco("Bloco 4")).toBe("04");
    expect(normalizarBloco("BL12")).toBe("12");
    expect(normalizarBloco("04 & 03")).toBe("04");
    expect(normalizarBloco("")).toBeNull();
    expect(unidadesDoTexto("101-102")).toEqual(["101", "102"]);
    expect(unidadesDoTexto("Sala 0228")).toEqual(["228"]);
    expect(lerLuc("11_131", null)).toEqual({ bloco: "11", unidades: ["131"] });
  });

  it("contrato da sala: mesmo bloco e unidade, o mais recente", () => {
    expect(
      contratoDaSala(contratos, { bloco: "12", sala: "104" })?.locatario,
    ).toBe("Ateliê Serrano");
    expect(
      contratoDaSala(contratos, { bloco: "04", sala: "310-311" })?.locatario,
    ).toBe("Pet Amigo");
    expect(contratoDaSala(contratos, { bloco: "05", sala: "104" })).toBeNull();
    expect(contratoDaSala(contratos, { bloco: "12", sala: null })).toBeNull();
  });

  it("mesmo locatário sem olhar acento e caixa", () => {
    expect(mesmoLocatario("ATELIE  serrano", "Ateliê Serrano")).toBe(true);
    expect(mesmoLocatario("", "")).toBe(false);
    expect(mesmoLocatario("Doce Trama", "Ateliê Serrano")).toBe(false);
  });
});

describe("filtro, contagem e avisos", () => {
  const lista = [
    caixa({ numero: "1824", ocupante: "Ótica Visão" }),
    caixa({ numero: "1825", status: "ocupado", locatario_novo: true }),
    caixa({ numero: "1826", status: "ocupado", com_termo: false }),
    caixa({ numero: "1827", status: "reservado", ocupante: null }),
    caixa({
      numero: "1828-ESP",
      numero_antigo: "cx 1670",
      status: "livre",
      sala: null,
      ocupante: null,
    }),
  ];

  it("status, sem termo e busca por número, numeração antiga, sala e ocupante", () => {
    const f = (
      status: Parameters<typeof caixaNoFiltro>[1]["status"],
      busca = "",
    ) =>
      lista
        .filter((c) => caixaNoFiltro(c, { status, busca }))
        .map((c) => c.numero);
    expect(f("ocupado")).toEqual(["1824", "1825", "1826"]);
    expect(f("semtermo")).toEqual(["1825", "1826"]);
    expect(f("", "otica")).toEqual(["1824"]);
    expect(f("", "1670")).toEqual(["1828-ESP"]);
    expect(f("livre", "sala 101")).toEqual([]);
    expect(f("")).toHaveLength(5);
  });

  it("conta por status e calcula o % ocupado", () => {
    const n = contar(lista);
    expect(n).toEqual({
      caixas: 5,
      ocupadas: 3,
      reservadas: 1,
      livres: 1,
      semTermo: 2,
    });
    expect(pctOcupado(n)).toBe(60);
    expect(pctOcupado({ caixas: 0, ocupadas: 0 })).toBe(0);
  });

  it("avisos: locatário novo, sem medidor, disjuntor incompleto, ENET diferente", () => {
    const avisos = avisosDaCaixa(
      {
        ...caixa({ locatario_novo: true }),
        medidor_situacao: "Cabos de espera",
        disjuntor_amperes: 40,
        ligacao: null,
      },
      {
        bloco: "01",
        luc: "01_101",
        nome: "Sala 101",
        locatario: "Outra Loja",
        documento: null,
        contrato: null,
        inicio: null,
        fim: null,
      },
    ).map((a) => a.texto);
    expect(avisos).toEqual([
      "Locatário novo sem termo de energia.",
      "Caixa ocupada sem medidor ativo: confira o medidor ou o status.",
      "Disjuntor incompleto: informe amperes e ligação.",
      "O ENET mostra outro locatário nesta sala: Outra Loja.",
    ]);
    expect(
      avisosDaCaixa(
        {
          ...caixa(),
          medidor_situacao: "Medidor ativo",
          disjuntor_amperes: 40,
          ligacao: "Monofásica",
        },
        null,
      ),
    ).toEqual([]);
  });
});

describe("desenho do painel e teclado", () => {
  const pos = (numero: string, lado: string, coluna: number, linha: number) =>
    caixa({ numero, lado, coluna, linha });

  it("põe cada caixa na posição; colisão vai para o próximo espaço livre", () => {
    const p = montarPainel([
      pos("A", "esquerdo", 1, 1),
      pos("B", "esquerdo", 2, 1),
      pos("C", "esquerdo", 2, 1),
      pos("D", "direito", 1, 2),
    ]);
    expect(p.esquerdo.colunas).toBe(2);
    expect(
      p.esquerdo.grade.map((l) => l.map((c) => c?.numero ?? null)),
    ).toEqual([
      ["A", "B"],
      ["C", null],
    ]);
    expect(p.direito.grade.map((l) => l.map((c) => c?.numero ?? null))).toEqual(
      [[null], ["D"]],
    );
  });

  it("setas pulam espaços vazios; Home e End vão às pontas da linha", () => {
    const g = [
      ["A", null, "C"],
      [null, "E", null],
      ["G", null, null],
    ];
    expect(proximaPosicao(g, { linha: 0, coluna: 0 }, "ArrowRight")).toEqual({
      linha: 0,
      coluna: 2,
    });
    expect(proximaPosicao(g, { linha: 0, coluna: 0 }, "ArrowDown")).toEqual({
      linha: 2,
      coluna: 0,
    });
    expect(proximaPosicao(g, { linha: 0, coluna: 2 }, "ArrowRight")).toBeNull();
    expect(proximaPosicao(g, { linha: 0, coluna: 2 }, "Home")).toEqual({
      linha: 0,
      coluna: 0,
    });
    expect(proximaPosicao(g, { linha: 1, coluna: 1 }, "End")).toEqual({
      linha: 1,
      coluna: 1,
    });
  });

  it("ao cruzar o barramento entra pela linha mais próxima", () => {
    const g = [
      ["A", "B"],
      [null, null],
      [null, "F"],
    ];
    expect(entrarNaGrade(g, 0, "esquerda")).toEqual({ linha: 0, coluna: 0 });
    expect(entrarNaGrade(g, 2, "direita")).toEqual({ linha: 2, coluna: 1 });
    expect(entrarNaGrade(g, 1, "direita")).toEqual({ linha: 0, coluna: 1 });
    expect(entrarNaGrade([], 0, "esquerda")).toBeNull();
  });
});
