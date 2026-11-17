import { describe, expect, it } from "vitest";
import {
  type ConfigControle,
  type ContratoControle,
  cartoesDoControle,
  type EntrevistaResumo,
  entradasESaidas,
  exportarControle,
  filtrarControle,
  filtrarPorCartao,
  type LinhaControle,
  linhasDoControle,
  opcoesDoControle,
  type PeriodoUltima,
  serieMensal,
  setorDeMenorValidade,
  setoresDoTexto,
} from "./entrevistas-controle";

const P = {
  mesesPrimeira: 6,
  validadePadraoMeses: 24,
  validadePorSetor: { Saúde: 24, Gastronômico: 2, Academia: 3 },
  avisoDias: 30,
};
const CFG: ConfigControle = {
  hoje: "2026-11-09",
  parametros: P,
  tiposLojaDispensados: ["Área Publicitária"],
  dataInauguracao: "ativacao",
};

function contrato(
  id: string,
  extra: Partial<ContratoControle> = {},
): ContratoControle {
  return {
    id,
    loja_id: null,
    contrato: `C-${id}`,
    cliente_nome: `Loja ${id}`,
    cliente_doc: "12345678000190",
    lucs: [`11_${id}`],
    bloco: "Bloco 1",
    tipo_loja: "Loja",
    ramo: "Varejo",
    ativacao: "2026-03-01",
    inicio: "2026-02-01",
    rescisao: null,
    situacao: "vigente",
    ativacao_corrigida: null,
    validade_meses_especifica: null,
    dispensada_motivo: null,
    dispensada_em: null,
    chamado_id: null,
    exemplo: false,
    ...extra,
  };
}

function entrevista(
  contratoId: string,
  data: string,
  setor: string | null = "Saúde",
): EntrevistaResumo {
  return {
    id: `${contratoId}-${data}`,
    contrato_id: contratoId,
    data,
    tipo: "primeira",
    setor,
    entrevistador_id: "u1",
    valida_ate: null,
    tem_pdf: true,
    origem: "sistema",
    formulario_versao: 1,
    exemplo: false,
  };
}

function linhas(
  contratos: ContratoControle[],
  entrevistas: EntrevistaResumo[] = [],
): LinhaControle[] {
  return linhasDoControle({
    contratos,
    entrevistas,
    chamados: new Map([
      [
        "ch1",
        {
          id: "ch1",
          numero: "#12",
          status: "aberto",
          situacao: "Aberto",
          responsavel: "Ana",
          href: "/os/chamados/ch1",
        },
      ],
    ]),
    nomes: new Map([["u1", "Bia"]]),
    config: CFG,
  });
}

const SEM_FILTRO = {
  situacao: "",
  bloco: "",
  tipoLoja: "",
  setor: "",
  ultima: "" as PeriodoUltima,
  busca: "",
};

describe("setor de várias opções", () => {
  it("separa o texto gravado", () => {
    expect(setoresDoTexto("Saúde; Gastronômico")).toEqual([
      "Saúde",
      "Gastronômico",
    ]);
    expect(setoresDoTexto(null)).toEqual([]);
  });

  it("usa o de menor validade", () => {
    expect(setorDeMenorValidade("Saúde; Gastronômico; Academia", P)).toBe(
      "Gastronômico",
    );
    expect(setorDeMenorValidade("Industrial/Confecção", P)).toBe(
      "Industrial/Confecção",
    );
    expect(setorDeMenorValidade("", P)).toBeNull();
  });
});

describe("linhas do controle", () => {
  it("contrato ativado em 01/03/2026 sem entrevista: Pendente com prevista 01/09/2026 (spec 8)", () => {
    const [l] = linhas([contrato("1")]);
    expect(l?.situacao).toBe("pendente");
    expect(l?.dataPrevista).toBe("2026-09-01");
    expect(l?.naLista).toBe(true);
  });

  it("uma linha por contrato, com todas as LUCs", () => {
    const ls = linhas([
      contrato("1", { lucs: ["11_129", "11_130", "11_202"] }),
    ]);
    expect(ls).toHaveLength(1);
    expect(exportarControle(ls)[0]?.[0]).toBe("11_129, 11_130, 11_202");
  });

  it("validade pela menor entre os setores marcados", () => {
    const [l] = linhas(
      [contrato("1")],
      [entrevista("1", "2026-10-01", "Saúde; Gastronômico")],
    );
    expect(l?.validaAte).toBe("2026-12-01");
    expect(l?.situacao).toBe("a_vencer");
    expect(l?.setor).toBe("Saúde; Gastronômico");
    expect(l?.entrevistador).toBe("Bia");
  });

  it("ativação corrigida vale no lugar da do ENET", () => {
    const [l] = linhas([contrato("1", { ativacao_corrigida: "2026-08-01" })]);
    expect(l?.dataPrevista).toBe("2027-02-01");
    expect(l?.situacao).toBe("aguardando");
    expect(l?.ativacaoCorrigida).toBe(true);
  });

  it("parâmetro de inauguração = início do contrato", () => {
    const [l] = linhasDoControle({
      contratos: [contrato("1")],
      entrevistas: [],
      chamados: new Map(),
      nomes: new Map(),
      config: { ...CFG, dataInauguracao: "inicio" },
    });
    expect(l?.dataPrevista).toBe("2026-08-01");
  });

  it("rescindido e tipo dispensado saem da lista, com o motivo", () => {
    const ls = linhas([
      contrato("1", { rescisao: "2026-11-01" }),
      contrato("2", { tipo_loja: "Area publicitaria" }),
      contrato("3", { rescisao: "2027-01-01" }),
    ]);
    expect(ls.map((l) => l.naLista)).toEqual([false, false, true]);
    expect(ls[0]?.fora).toBe("Rescindido em 01/11/2026");
    expect(ls[1]?.fora).toContain("dispensado");
  });

  it("chamado do contrato com número, situação e responsável", () => {
    const [l] = linhas([contrato("1", { chamado_id: "ch1" })]);
    expect(l?.chamado?.numero).toBe("#12");
    expect(exportarControle([l as LinhaControle])[0]?.[13]).toBe(
      "#12 · Aberto · Ana",
    );
  });
});

describe("filtros e cartões", () => {
  const ls = linhas(
    [
      contrato("1"),
      contrato("2", { bloco: "Bloco 2" }),
      contrato("3", { dispensada_motivo: "Contrato temporário" }),
      contrato("4", { cliente_nome: "Padaria Pão Quente" }),
      contrato("5"),
      contrato("6"),
    ],
    [
      entrevista("4", "2025-01-10", "Saúde"),
      entrevista("5", "2024-12-01", "Saúde"),
      entrevista("6", "2026-10-20", "Academia"),
    ],
  );

  it("padrão: todas menos as dispensadas", () => {
    expect(filtrarControle(ls, SEM_FILTRO, CFG.hoje).map((l) => l.id)).toEqual([
      "1",
      "2",
      "4",
      "5",
      "6",
    ]);
    expect(
      filtrarControle(ls, { ...SEM_FILTRO, situacao: "todas" }, CFG.hoje),
    ).toHaveLength(6);
  });

  it("bloco, setor, período da última e busca", () => {
    const f = (x: Partial<typeof SEM_FILTRO>) =>
      filtrarControle(ls, { ...SEM_FILTRO, ...x }, CFG.hoje).map((l) => l.id);
    expect(f({ bloco: "Bloco 2" })).toEqual(["2"]);
    expect(f({ setor: "Academia" })).toEqual(["6"]);
    expect(f({ ultima: "nunca" })).toEqual(["1", "2"]);
    expect(f({ ultima: "12m" })).toEqual(["6"]);
    expect(f({ ultima: "24m" })).toEqual(["4", "5", "6"]);
    expect(f({ busca: "pao quente" })).toEqual(["4"]);
    expect(f({ busca: "11_5" })).toEqual(["5"]);
    expect(f({ busca: "12.345.678/0001-90" })).toHaveLength(5);
  });

  it("cartões: pendentes, a vencer, vencidas e cobertura", () => {
    const base = filtrarControle(ls, SEM_FILTRO, CFG.hoje);
    const n = cartoesDoControle(base);
    // 4: validade 10/01/2027 (a vencer? não: faltam 62 dias) → em dia;
    // 5: 01/12/2026 → a vencer; 6: academia 3 meses → 20/01/2027 em dia.
    expect(n.pendente).toBe(2);
    expect(n.a_vencer).toBe(1);
    expect(n.vencida).toBe(0);
    expect(n.cobertura).toEqual({ emDia: 3, precisam: 5, pct: 60 });
    expect(filtrarPorCartao(base, "cobertura").map((l) => l.id)).toEqual([
      "4",
      "5",
      "6",
    ]);
    expect(filtrarPorCartao(base, "a_vencer").map((l) => l.id)).toEqual(["5"]);
  });

  it("opções dos filtros vêm da lista", () => {
    const o = opcoesDoControle(ls);
    expect(o.blocos).toEqual(["Bloco 1", "Bloco 2"]);
    expect(o.setores).toEqual(["Academia", "Saúde"]);
  });
});

describe("gráfico de 12 meses", () => {
  it("entrevistas no mês e cobertura no último dia", () => {
    const contratos = [
      contrato("1", { ativacao: "2025-01-01" }),
      contrato("2", { ativacao: "2025-01-01" }),
      contrato("3", { ativacao: "2025-01-01", rescisao: "2026-10-15" }),
    ];
    const entrevistas = [
      entrevista("1", "2026-09-10"),
      entrevista("2", "2026-10-05"),
    ];
    const s = serieMensal({
      meses: ["2026-09-01", "2026-10-01", "2026-11-01"],
      contratos,
      entrevistas,
      config: CFG,
    });
    expect(s.map((p) => p.entrevistas)).toEqual([1, 1, 0]);
    // set: 1 de 3 (o 3 ainda estava); out: 2 de 2 (o 3 saiu); nov: 2 de 2.
    expect(s[0]?.cobertura).toBeCloseTo(33.33, 1);
    expect(s[1]?.cobertura).toBe(100);
    expect(s[2]?.cobertura).toBe(100);
  });
});

describe("entradas e saídas", () => {
  it("contratos que entraram ou saíram no período, em ordem de data", () => {
    const ls = linhas([
      contrato("1", { ativacao: "2026-10-05" }),
      contrato("2", { ativacao: "2025-01-01", rescisao: "2026-10-02" }),
      contrato("3", { ativacao: "2026-09-30" }),
    ]);
    const m = entradasESaidas(ls, "2026-10-01", "2026-10-31");
    expect(m.map((x) => [x.movimento, x.linha.id])).toEqual([
      ["Saída", "2"],
      ["Entrada", "1"],
    ]);
  });
});
