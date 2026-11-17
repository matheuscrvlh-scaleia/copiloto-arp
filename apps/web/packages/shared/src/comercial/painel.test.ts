import { describe, expect, it } from "vitest";
import type { EnetContaReceber, EnetContrato, EnetLuc } from "./fontes";
import {
  acumular,
  atingido,
  atingiuMeta,
  aumentoDeReceita,
  type CarenciaContrato,
  carenciaDoContrato,
  churn,
  type EntradaPainel,
  faturamentoEmCarencia,
  type LinhaPainel,
  metaValida,
  montarPainel,
  mudancasDeMetas,
  valorPorM2,
} from "./painel";

// Conjunto pequeno que reproduz o teste 8 do spec ("Painel igual à
// planilha", ano 2025): leads jan = 31; aumento de receita jan = 9.912,38
// (11.781,00 menos 1.868,62); churn jan = 0,18%; ocupação jan = 98,8%;
// faturamento acumulado jan a nov = 9.897.916,49.

const HOJE = "2026-11-04";

const contrato = (c: Partial<EnetContrato>): EnetContrato => ({
  codigo: "c",
  luc: "01_101",
  cliente: "cli-1",
  locatario: "Locatário",
  data_inicio: "2024-01-01",
  data_termino: null,
  prazo: "Indeterminado",
  valor_aluguel: 1000,
  indice: "IGPM",
  mes_reajuste: 1,
  data_rescisao: null,
  ...c,
});

const conta = (
  competencia: string,
  valor: number,
  tipo = "Loja Comercial",
): EnetContaReceber => ({
  competencia,
  luc: "01_101",
  tipo_luc: tipo,
  cliente: "cli-1",
  valor_faturado: valor,
});

const luc = (
  numero: string,
  abl: number,
  tipo = "Loja Comercial",
): EnetLuc => ({
  numero,
  data_inicio: "2020-01-01",
  tipo_loja: tipo,
  abl,
  area_util: abl,
  status: "Locado",
  local: "Bloco 01",
  piso: "Térreo",
  rua: "Rua 1911",
  situacao: "",
});

// Faturamento: jan 1.038.122,22 (churn 1.868,62 ÷ 1.038.122,22 = 0,18%);
// fev a nov somam o resto de 9.897.916,49; dez fora do acumulado do teste.
const contas: EnetContaReceber[] = [
  conta("2025-01-01", 1_000_000),
  conta("2025-01-01", 20_000, "Área Publicitária"),
  conta("2025-01-01", 18_122.22, "Eventos"),
  ...["02", "03", "04", "05", "06", "07", "08", "09", "10"].map((m) =>
    conta(`2025-${m}-01`, 885_979.42),
  ),
  conta("2025-11-01", 885_979.49),
  conta("2025-12-01", 900_000),
];

const entrada: EntradaPainel = {
  ano: 2025,
  hoje: HOJE,
  contas,
  contratos: [
    contrato({
      codigo: "novo",
      cliente: "cli-2",
      data_inicio: "2025-01-15",
      valor_aluguel: 11_781,
    }),
    contrato({
      codigo: "saiu",
      cliente: "cli-3",
      luc: "01_102",
      data_inicio: "2024-03-01",
      data_rescisao: "2025-01-20",
      valor_aluguel: 1_868.62,
    }),
  ],
  lucs: [
    luc("01_101", 600),
    luc("01_102", 400),
    luc("AP_01", 0, "Área Publicitária"),
  ],
  tiposOcupacao: new Set(["Loja Comercial"]),
  tiposMidia: new Set(["Área Publicitária"]),
  tiposEventos: new Set(["Eventos"]),
  leads: [
    ...Array.from(
      { length: 31 },
      (_, i) => `2025-01-${String((i % 28) + 1).padStart(2, "0")}`,
    ),
    "2025-02-03",
    "2024-12-31",
  ],
  fotos: [
    {
      mes: "2025-01-01",
      abl_total: 41_316.81,
      abl_locada: 40_821.01,
      clientes_ativos: 268,
    },
  ],
  carencias: [],
  exemplo: false,
  metas: [
    { indicador: "comercial.leads", vigente_desde: "2025-01-01", meta: 30 },
    {
      indicador: "comercial.contratos_rescindidos",
      vigente_desde: "2025-01-01",
      meta: 1_000,
    },
    { indicador: "comercial.churn", vigente_desde: "2025-01-01", meta: 0.5 },
    {
      indicador: "comercial.faturamento",
      vigente_desde: "2025-01-01",
      meta: 1_011_105.65,
    },
    {
      indicador: "comercial.faturamento",
      vigente_desde: "2025-02-01",
      meta: 1_000_000,
    },
  ],
};

const linhas = montarPainel(entrada);
const de = (i: LinhaPainel["indicador"]) =>
  linhas.find((l) => l.indicador === i) as LinhaPainel;

describe("painel igual à planilha (teste 8)", () => {
  it("leads jan = 31, pela data de criação", () => {
    expect(de("leads").real[0]).toBe(31);
    expect(de("leads").real[1]).toBe(1);
  });

  it("aumento de receita jan = 9.912,38 (11.781,00 − 1.868,62)", () => {
    expect(de("contratos_fechados").real[0]).toBe(11_781);
    expect(de("contratos_rescindidos").real[0]).toBe(1_868.62);
    expect(de("aumento_receita").real[0]).toBeCloseTo(9_912.38, 2);
  });

  it("churn jan = 0,18% e ocupação jan = 98,8% pela foto", () => {
    expect(de("churn").real[0]?.toFixed(2)).toBe("0.18");
    expect(de("ocupacao").real[0]?.toFixed(1)).toBe("98.8");
    expect(de("ocupacao").marcas[0]).toBe("foto");
    expect(de("clientes").real[0]).toBe(268);
  });

  it("faturamento acumulado jan a nov = 9.897.916,49", () => {
    const real = de("faturamento").real;
    expect(acumular(real.slice(0, 11), "soma")).toBeCloseTo(9_897_916.49, 2);
    expect(de("faturamento").acumulado.real).toBeCloseTo(10_797_916.49, 2);
  });

  it("mídia e eventos pelo tipo do LUC; valor por m² sobre a ABL locada", () => {
    expect(de("receita_midia").real[0]).toBe(20_000);
    expect(de("receita_eventos").real[0]).toBe(18_122.22);
    expect(de("valor_m2").real[0]).toBeCloseTo(1_038_122.22 / 40_821.01, 6);
  });

  it("% atingido e a cor invertida em rescindidos e churn", () => {
    expect(de("leads").atingido[0]?.toFixed(2)).toBe("103.33");
    expect(atingiuMeta(de("leads").atingido[0] as number, "maior_melhor")).toBe(
      true,
    );
    const resc = de("contratos_rescindidos").atingido[0] as number;
    expect(resc.toFixed(2)).toBe("186.86");
    expect(atingiuMeta(resc, "menor_melhor")).toBe(false);
    expect(atingiuMeta(de("churn").atingido[0] as number, "menor_melhor")).toBe(
      true,
    );
    expect(atingiuMeta(99.9, "maior_melhor")).toBe(false);
  });

  it("plan acumulado só nos meses com Real; sem Plan, % vazio", () => {
    const f = de("faturamento").acumulado;
    expect(f.plan).toBeCloseTo(2_011_105.65, 2);
    expect(de("receita_midia").atingido[0]).toBeNull();
    expect(de("carencia").plan.every((p) => p === null)).toBe(true);
  });

  it("dado real sem foto: sem histórico; carência vazia sem contratos", () => {
    expect(de("ocupacao").real[1]).toBeNull();
    expect(de("ocupacao").marcas[1]).toBe("sem_historico");
    expect(de("valor_m2").real[1]).toBeNull();
    expect(de("carencia").real.every((v) => v === null)).toBe(true);
  });

  it("dado de exemplo sem foto: calcula pelos contratos ativos no fim do mês", () => {
    const p = montarPainel({ ...entrada, exemplo: true, fotos: [] });
    const ocup = p.find((l) => l.indicador === "ocupacao") as LinhaPainel;
    // jan: só 01_101 (600 de 1.000 m²); 01_102 rescindiu em 20/01.
    expect(ocup.real[0]).toBe(60);
    expect(ocup.marcas[0]).toBe("calculado");
    // 2027 ainda não tem Real.
    const futuro = montarPainel({ ...entrada, ano: 2027 });
    expect(futuro.every((l) => l.real.every((v) => v === null))).toBe(true);
  });

  it("mês corrente usa o status de hoje dos LUCs e não passa de hoje", () => {
    const p = montarPainel({ ...entrada, ano: 2026 });
    const ocup = p.find((l) => l.indicador === "ocupacao") as LinhaPainel;
    expect(ocup.marcas[10]).toBe("hoje");
    expect(ocup.real[10]).toBe(100);
    expect(ocup.real[11]).toBeNull();
  });
});

describe("regras soltas", () => {
  it("aumento, churn, valor por m² e % atingido sem base", () => {
    expect(aumentoDeReceita(100, 150)).toBe(-50);
    expect(aumentoDeReceita(null, 10)).toBeNull();
    expect(churn(10, 0)).toBeNull();
    expect(valorPorM2(28_000, 1_000)).toBe(28);
    expect(valorPorM2(28_000, 0)).toBeNull();
    expect(atingido(50, 0)).toBeNull();
    expect(atingido(null, 10)).toBeNull();
  });

  it("acumulado por soma, média e último", () => {
    expect(acumular([1, null, 3], "soma")).toBe(4);
    expect(acumular([96, null, 98], "media")).toBe(97);
    expect(acumular([268, 270, null], "ultimo")).toBe(270);
    expect(acumular([null, null], "soma")).toBeNull();
  });

  it("carência proporcional aos dias, só as linhas do tipo carência", () => {
    const c = carenciaDoContrato(3_000, {
      carencias_descontos: [
        { tipo: "carencia", inicio: "2025-01-16", fim: "2025-02-14", valor: 0 },
        {
          tipo: "desconto_fixo",
          inicio: "2025-01-01",
          fim: "2025-12-31",
          valor: 200,
        },
      ],
    });
    expect(c?.periodos).toHaveLength(1);
    expect(faturamentoEmCarencia([c as CarenciaContrato], "2025-01-01")).toBe(
      1_548.39,
    );
    expect(faturamentoEmCarencia([c as CarenciaContrato], "2025-02-01")).toBe(
      1_500,
    );
    expect(faturamentoEmCarencia([c as CarenciaContrato], "2025-03-01")).toBe(
      0,
    );
    expect(carenciaDoContrato(3_000, { outra: 1 })).toBeNull();
    expect(carenciaDoContrato(null, { carencias_descontos: [] })).toBeNull();
    const p = montarPainel({ ...entrada, carencias: [c as CarenciaContrato] });
    expect(
      (p.find((l) => l.indicador === "carencia") as LinhaPainel).real[0],
    ).toBe(1_548.39);
  });

  it("metas: grava só o que mudou e apaga as esvaziadas", () => {
    const atuais = [
      {
        id: "1",
        indicador: "comercial.leads",
        vigente_desde: "2025-01-01",
        meta: 30,
      },
      {
        id: "2",
        indicador: "comercial.leads",
        vigente_desde: "2025-02-01",
        meta: 30,
      },
      {
        id: "3",
        indicador: "comercial.leads",
        vigente_desde: "2025-03-01",
        meta: 30,
      },
    ];
    const r = mudancasDeMetas(atuais, [
      { indicador: "comercial.leads", vigente_desde: "2025-01-01", meta: 30 },
      { indicador: "comercial.leads", vigente_desde: "2025-02-01", meta: 35 },
      { indicador: "comercial.leads", vigente_desde: "2025-03-01", meta: null },
      { indicador: "comercial.leads", vigente_desde: "2025-04-01", meta: 40 },
      { indicador: "comercial.leads", vigente_desde: "2025-05-01", meta: null },
    ]);
    expect(r.gravar).toEqual([
      { indicador: "comercial.leads", vigente_desde: "2025-02-01", meta: 35 },
      { indicador: "comercial.leads", vigente_desde: "2025-04-01", meta: 40 },
    ]);
    expect(r.apagar).toEqual(["3"]);
  });

  it("faixa aceita na meta", () => {
    expect(metaValida("ocupacao", 96)).toBeNull();
    expect(metaValida("ocupacao", 120)).not.toBeNull();
    expect(metaValida("aumento_receita", -500)).toBeNull();
    expect(metaValida("faturamento", -1)).not.toBeNull();
    expect(metaValida("leads", 30.5)).not.toBeNull();
    expect(metaValida("leads", Number.NaN)).not.toBeNull();
  });
});
