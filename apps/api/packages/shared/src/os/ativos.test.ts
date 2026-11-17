import { describe, expect, it } from "vitest";
import {
  checklistDaOS,
  custoPorMes,
  descreverFrequencia,
  descreverLocal,
  escreverChecklist,
  faltasNoCadastro,
  idadeEmAnos,
  lerChecklist,
  mesDe,
  ordenarPorPeso,
  pesoDaManutencao,
  preventivaAtrasada,
  preventivasAGerar,
  proximaDataDoPlano,
  situacaoDaGarantia,
  situacaoDoPlano,
  tempoMedioDeReparoMin,
  umAnoAntes,
} from "./ativos";

const dias = (n: number) => ({ frequencia_dias: n, frequencia_meses: null });
const meses = (n: number) => ({ frequencia_dias: null, frequencia_meses: n });

describe("plano preventivo", () => {
  it("avança por dias ou por meses", () => {
    expect(proximaDataDoPlano(dias(30), "2026-10-23")).toBe("2026-11-22");
    expect(proximaDataDoPlano(meses(1), "2026-10-23")).toBe("2026-11-23");
    expect(proximaDataDoPlano(meses(6), "2026-10-23")).toBe("2027-04-23");
    // 31 em mês curto vira o último dia.
    expect(proximaDataDoPlano(meses(1), "2027-01-31")).toBe("2027-02-28");
  });

  it("descreve a frequência", () => {
    expect(descreverFrequencia(dias(1))).toBe("Todo dia");
    expect(descreverFrequencia(dias(30))).toBe("A cada 30 dias");
    expect(descreverFrequencia(meses(1))).toBe("Todo mês");
    expect(descreverFrequencia(meses(3))).toBe("A cada 3 meses");
  });

  const plano = (proxima: string, antecedencia: number | null = null) => ({
    ...dias(30),
    proxima_data: proxima,
    antecedencia_dias: antecedencia,
  });

  it("gera N dias antes da data (padrão ou do plano)", () => {
    expect(preventivasAGerar(plano("2026-10-30"), 7, "2026-10-23")).toEqual({
      datas: ["2026-10-30"],
      proxima: "2026-11-29",
    });
    expect(
      preventivasAGerar(plano("2026-10-31"), 7, "2026-10-23").datas,
    ).toEqual([]);
    expect(
      preventivasAGerar(plano("2026-10-31", 10), 7, "2026-10-23").datas,
    ).toEqual(["2026-10-31"]);
  });

  it("atraso antigo vira uma OS só, a mais recente", () => {
    const r = preventivasAGerar(plano("2026-01-10"), 7, "2026-10-23");
    expect(r.datas).toEqual(["2026-10-07"]);
    expect(r.proxima).toBe("2026-11-06");
  });

  it("antecedência maior que a frequência gera mais de uma, com limite", () => {
    const p = {
      ...dias(5),
      proxima_data: "2026-10-24",
      antecedencia_dias: 12,
    };
    expect(preventivasAGerar(p, 7, "2026-10-23").datas).toEqual([
      "2026-10-24",
      "2026-10-29",
      "2026-11-03",
    ]);
    expect(preventivasAGerar(p, 7, "2026-10-23", 2).datas).toHaveLength(2);
  });

  it("situação do plano", () => {
    const p = { ...plano("2026-11-20"), ativo: true };
    expect(situacaoDoPlano(p, 7, "2026-10-23")).toBe("agendado");
    expect(situacaoDoPlano(p, 7, "2026-11-15")).toBe("a_gerar");
    expect(situacaoDoPlano(p, 7, "2026-11-21")).toBe("atrasado");
    expect(situacaoDoPlano({ ...p, ativo: false }, 7, "2026-11-21")).toBe(
      "pausado",
    );
  });

  it("checklist: texto com * vira obrigatório e volta", () => {
    const itens = lerChecklist("Limpar filtro\n* Medir corrente\n\n  ");
    expect(itens).toEqual([
      { texto: "Limpar filtro", obrigatorio: false },
      { texto: "Medir corrente", obrigatorio: true },
    ]);
    expect(escreverChecklist(itens)).toBe("Limpar filtro\n*Medir corrente");
    expect(checklistDaOS([...itens, { texto: " " }, 3])).toEqual([
      { texto: "Limpar filtro", obrigatorio: false, feito: false },
      { texto: "Medir corrente", obrigatorio: true, feito: false },
    ]);
    expect(checklistDaOS(null)).toEqual([]);
  });
});

describe("custo e reparo", () => {
  it("um ano antes", () => {
    expect(umAnoAntes("2026-10-23")).toBe("2025-10-23");
    expect(umAnoAntes("2028-02-29")).toBe("2027-02-28");
  });

  it("mês em Brasília", () => {
    // 01/11 às 01h UTC ainda é 31/10 em Brasília.
    expect(mesDe("2026-11-01T01:00:00Z")).toBe("2026-10");
    expect(mesDe("2026-11-01")).toBe("2026-11");
  });

  it("custo por mês com acumulado desde a compra", () => {
    const r = custoPorMes(
      [
        { em: "2026-08-10T12:00:00Z", valor: 100 },
        { em: "2026-08-20T12:00:00Z", valor: 50.5 },
        { em: "2026-10-01T12:00:00Z", valor: 200 },
      ],
      "2026-07-15",
      "2026-10-23",
    );
    expect(r).toEqual([
      { mes: "2026-07", valor: 0, acumulado: 0 },
      { mes: "2026-08", valor: 150.5, acumulado: 150.5 },
      { mes: "2026-09", valor: 0, acumulado: 150.5 },
      { mes: "2026-10", valor: 200, acumulado: 350.5 },
    ]);
  });

  it("custo antes da compra entra no começo da série", () => {
    const r = custoPorMes(
      [{ em: "2026-05-10T12:00:00Z", valor: 10 }],
      "2026-07-01",
      "2026-07-20",
    );
    expect(r[0]).toEqual({ mes: "2026-05", valor: 10, acumulado: 10 });
    expect(r.at(-1)?.acumulado).toBe(10);
  });

  it("MTTR sem o tempo em Aguardando", () => {
    expect(
      tempoMedioDeReparoMin([
        {
          criado_em: "2026-10-01T10:00:00Z",
          concluido_em: "2026-10-01T14:00:00Z",
          aguardando_min: 60,
        },
        {
          criado_em: "2026-10-02T10:00:00Z",
          concluido_em: "2026-10-02T11:00:00Z",
          aguardando_min: 0,
        },
        {
          criado_em: "2026-10-03T10:00:00Z",
          concluido_em: null,
          aguardando_min: 0,
        },
      ]),
    ).toBe(120);
    expect(tempoMedioDeReparoMin([])).toBeNull();
  });

  it("idade e peso", () => {
    expect(idadeEmAnos("2016-10-23", "2026-10-23")).toBe(10);
    expect(idadeEmAnos(null, "2026-10-23")).toBeNull();
    expect(pesoDaManutencao(3000, 10_000)).toBe(30);
    expect(pesoDaManutencao(3000, null)).toBeNull();
  });
});

describe("cadastro e decisão", () => {
  const completo = {
    categoria_id: "c",
    bloco: "B",
    loja_id: null,
    area: null,
    compra_data: "2020-01-01",
    valor_reposicao: 1000,
    vida_util_anos: 10,
  };

  it("lista o que falta no cadastro", () => {
    expect(faltasNoCadastro(completo)).toEqual([]);
    expect(
      faltasNoCadastro({
        ...completo,
        bloco: null,
        valor_reposicao: null,
        vida_util_anos: null,
      }),
    ).toEqual(["local", "valor de reposição", "vida útil"]);
  });

  it("descreve o local", () => {
    expect(
      descreverLocal({ bloco: "B", loja: null, area: " ", ponto: "Casa" }),
    ).toBe("B · Casa");
    expect(descreverLocal({})).toBe("Sem local");
  });

  it("garantia", () => {
    expect(situacaoDaGarantia(null, "2026-10-23", 60)).toBeNull();
    expect(situacaoDaGarantia("2026-10-22", "2026-10-23", 60)).toBe("vencida");
    expect(situacaoDaGarantia("2026-12-01", "2026-10-23", 60)).toBe("vencendo");
    expect(situacaoDaGarantia("2027-12-01", "2026-10-23", 60)).toBe("vigente");
  });

  it("ordena pelo peso, sem peso no fim", () => {
    const r = ordenarPorPeso([
      { id: "a", pesoPct: 10 },
      { id: "b", pesoPct: null },
      { id: "c", pesoPct: 70 },
    ]);
    expect(r.map((x) => x.id)).toEqual(["c", "a", "b"]);
  });

  it("preventiva atrasada", () => {
    const agora = new Date("2026-10-23T12:00:00Z");
    expect(
      preventivaAtrasada(
        { status: "aberto", prazo: "2026-10-22T21:00:00Z" },
        agora,
      ),
    ).toBe(true);
    expect(
      preventivaAtrasada(
        { status: "concluido", prazo: "2026-10-22T21:00:00Z" },
        agora,
      ),
    ).toBe(false);
    expect(preventivaAtrasada({ status: "aberto", prazo: null }, agora)).toBe(
      false,
    );
  });
});
