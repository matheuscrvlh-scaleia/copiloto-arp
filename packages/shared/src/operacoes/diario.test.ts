import { describe, expect, it } from "vitest";
import relatorioDaApi from "@/connectors/diario-de-obras/__fixtures__/relatorio.json";
import { relatorioSchema } from "@/connectors/diario-de-obras/schemas";
import {
  aAprovar,
  alertasDoPainel,
  cartoesDoPainel,
  diaImpraticavel,
  diasCobertos,
  diasSemRelatorio,
  duracao,
  efetivo,
  equipamentosTotais,
  historicoDaTarefa,
  homemHora,
  lerResumo,
  linhasDoPainel,
  type ObraDoDiario,
  ocorrenciasPorTipo,
  periodoDaBusca,
  prazoConsumido,
  prazoVencido,
  producao,
  resumoDoRelatorio,
  STATUS_OBRA,
  statusDe,
} from "./diario";

const relatorio = relatorioSchema.parse(relatorioDaApi);
const SEG_A_SAB = [1, 2, 3, 4, 5, 6];

function obra(o: Partial<ObraDoDiario> = {}): ObraDoDiario {
  return {
    id: "o1",
    nome: "Obra A",
    statusId: 3,
    grupo: null,
    responsavel: null,
    dataInicio: "2026-11-02",
    dataFim: "2027-01-31",
    prazo: { contratual: 100, decorrido: 40, aVencer: 60 },
    realizado: 25,
    tarefas: null,
    ficha: null,
    ...o,
  };
}

describe("status pelo id", () => {
  it("texto e tom; id desconhecido não quebra", () => {
    expect(statusDe(STATUS_OBRA, 2)).toEqual({
      rotulo: "Paralisada",
      tom: "alerta",
    });
    expect(statusDe(STATUS_OBRA, 9).rotulo).toBe("Status 9");
    expect(statusDe(STATUS_OBRA, null).rotulo).toBe("—");
  });

  it("a aprovar: 1 e 3", () => {
    expect([1, 3, 4].map(aAprovar)).toEqual([true, true, false]);
  });
});

describe("prazo e avanço", () => {
  it("prazo consumido = decorrido ÷ contratual", () => {
    expect(
      prazoConsumido({ contratual: 200, decorrido: 50, aVencer: 150 }),
    ).toBe(25);
    expect(
      prazoConsumido({ contratual: null, decorrido: 5, aVencer: null }),
    ).toBeNull();
    expect(
      prazoConsumido({ contratual: 0, decorrido: 5, aVencer: 0 }),
    ).toBeNull();
  });

  it("vencido: não concluída e a vencer = 0 ou fim antes de hoje", () => {
    const hoje = "2026-11-09";
    expect(
      prazoVencido({ statusId: 3, aVencer: 0, dataFim: "2027-01-01" }, hoje),
    ).toBe(true);
    expect(
      prazoVencido({ statusId: 3, aVencer: null, dataFim: "2026-11-08" }, hoje),
    ).toBe(true);
    expect(
      prazoVencido({ statusId: 3, aVencer: 5, dataFim: "2026-11-09" }, hoje),
    ).toBe(false);
    expect(
      prazoVencido({ statusId: 4, aVencer: 0, dataFim: "2020-01-01" }, hoje),
    ).toBe(false);
  });
});

describe("dias sem relatório", () => {
  it("só dias que contam, do início até ontem, sem o dia de hoje", () => {
    // 02/11/2026 é segunda; hoje 09/11 (segunda). Domingo 08/11 não conta.
    const cobertos = diasCobertos([
      { data: "2026-11-02", dataFim: null },
      { data: "2026-11-03", dataFim: "2026-11-04" },
      { data: "2026-11-06", dataFim: null },
    ]);
    expect(diasSemRelatorio(obra(), cobertos, SEG_A_SAB, "2026-11-09")).toEqual(
      ["2026-11-07", "2026-11-05"],
    );
  });

  it("só obra em andamento e com data de início", () => {
    const vazio = new Set<string>();
    expect(
      diasSemRelatorio(obra({ statusId: 2 }), vazio, SEG_A_SAB, "2026-11-09"),
    ).toEqual([]);
    expect(
      diasSemRelatorio(
        obra({ dataInicio: null }),
        vazio,
        SEG_A_SAB,
        "2026-11-09",
      ),
    ).toEqual([]);
  });
});

describe("relatório", () => {
  it("efetivo pela opção selecionada", () => {
    // Personalizada: conta quem tem presença.
    expect(efetivo(relatorio.maoDeObra)).toBe(1);
    expect(
      efetivo({
        opcaoSelecionada: "padrao",
        padrao: [
          { _id: "a", descricao: "Pedreiro", quantidade: 3 },
          { _id: "b", descricao: "Servente", quantidade: 2 },
        ],
        personalizada: [],
      }),
    ).toBe(5);
    expect(efetivo(null)).toBeNull();
    expect(
      efetivo({ opcaoSelecionada: null, padrao: [], personalizada: [] }),
    ).toBeNull();
  });

  it("homem-hora só da personalizada com presença", () => {
    expect(homemHora(relatorio.maoDeObra)).toBe(480);
    expect(
      homemHora({ opcaoSelecionada: "padrao", padrao: [], personalizada: [] }),
    ).toBeNull();
  });

  it("dia impraticável: manhã ou tarde ativas", () => {
    expect(diaImpraticavel(relatorio.clima)).toBe(true);
    expect(
      diaImpraticavel({
        manha: { clima: "Chuvoso", condicao: "Impraticável", ativo: false },
        tarde: { clima: "Claro", condicao: "Praticável", ativo: true },
        noite: { clima: "Chuvoso", condicao: "IMPRATICAVEL", ativo: true },
      }),
    ).toBe(false);
  });

  it("resumo gravado na sincronização e lido de volta", () => {
    const r = resumoDoRelatorio(relatorio);
    expect(r).toEqual({
      efetivo: 1,
      homemHora: 480,
      manha: { clima: "Nublado", condicao: "Impraticável" },
      tarde: { clima: "Claro", condicao: "Praticável" },
      impraticavel: true,
      ocorrencias: 1,
      tipos: ["Chuva", "Dia parado"],
      fotos: 2,
      videos: 1,
      anexos: 1,
      comentarios: 1,
    });
    expect(lerResumo(JSON.parse(JSON.stringify(r)))).toEqual(r);
    expect(lerResumo({ efetivo: "x" })).toBeNull();
  });

  it("ocorrências por tipo e equipamentos somados", () => {
    expect(
      ocorrenciasPorTipo([
        ...relatorio.ocorrencias,
        {
          _id: "x",
          descricao: "Chuva de novo",
          tags: [
            { _id: "1", descricao: "Chuva", checked: true },
            { _id: "2", descricao: "Acidente", checked: false },
          ],
          fotos: [],
          videos: [],
        },
      ]),
    ).toEqual([
      { chave: "Chuva", n: 2 },
      { chave: "Dia parado", n: 1 },
    ]);
    expect(
      equipamentosTotais([
        { _id: "1", descricao: "Betoneira", quantidade: 1 },
        { _id: "2", descricao: "Andaime", quantidade: 6 },
        { _id: "3", descricao: "Betoneira ", quantidade: 2 },
      ]),
    ).toEqual([
      { descricao: "Andaime", quantidade: 6 },
      { descricao: "Betoneira", quantidade: 3 },
    ]);
  });

  it("produção: acumulado ÷ quantidade, só ativa", () => {
    expect(
      producao({ ativo: true, unidade: "m", quantidade: 100, acumulado: 10 }),
    ).toEqual({ acumulado: 10, quantidade: 100, unidade: "m", pct: 10 });
    expect(producao({ ativo: false, quantidade: 100 })).toBeNull();
    expect(producao({ ativo: true, quantidade: 0, acumulado: 3 })?.pct).toBe(
      null,
    );
  });
});

describe("tarefa", () => {
  it("histórico pelas atividades do cronograma, do mais antigo ao mais novo", () => {
    const tarefa = "5cc21c9c33e38246132b9a44";
    const outro = { ...relatorio, id: "r0", numero: 34, data: "2022-12-30" };
    const h = historicoDaTarefa(tarefa, [
      { ...relatorio, id: "r1" },
      {
        ...outro,
        atividades: outro.atividades.map((a) =>
          a.tarefaId === tarefa ? { ...a, porcentagem: 5 } : a,
        ),
        ocorrencias: [
          {
            _id: "o",
            descricao: "Faltou cimento",
            tags: [{ _id: "t", descricao: "Falta de material", checked: true }],
            tarefa: { _id: tarefa },
            fotos: [],
            videos: [],
          },
        ],
      },
    ]);
    expect(h.map((p) => [p.relatorioId, p.atual, p.segundos])).toEqual([
      ["r0", 5, 21600],
      ["r1", 10, 21600],
    ]);
    expect(h[0]?.ocorrencias).toEqual([
      { descricao: "Faltou cimento", tipos: ["Falta de material"] },
    ]);
    expect(h[1]?.horario).toBe("10:00–16:00");
    expect(h[1]?.producao?.pct).toBe(10);
    expect(duracao(43200)).toBe("12h00");
  });
});

describe("painel", () => {
  const hoje = "2026-11-09";
  const obras = [
    obra(),
    obra({
      id: "o2",
      nome: "Obra B",
      prazo: { contratual: 100, decorrido: 100, aVencer: 0 },
      realizado: 70,
    }),
    obra({ id: "o3", nome: "Obra C", statusId: 2, realizado: null }),
  ];
  const relatorios = [
    { id: "r1", obraId: "o1", numero: 1, data: "2026-11-02", statusId: 4 },
    { id: "r2", obraId: "o1", numero: 2, data: "2026-11-03", statusId: 3 },
    { id: "r3", obraId: "o2", numero: 9, data: "2026-11-06", statusId: 1 },
  ].map((r) => ({ ...r, dataFim: null }));

  it("linhas, cartões e alertas", () => {
    const linhas = linhasDoPainel(obras, relatorios, SEG_A_SAB, hoje);
    const [a, b, c] = linhas;
    expect(a?.consumido).toBe(40);
    expect(a?.desvio).toBe(-15);
    expect(a?.ultimo?.id).toBe("r2");
    expect(a?.aAprovar).toBe(1);
    expect(a?.semRelatorio).toEqual([
      "2026-11-07",
      "2026-11-06",
      "2026-11-05",
      "2026-11-04",
    ]);
    expect(b?.vencido).toBe(true);
    expect(c?.semRelatorio).toEqual([]);
    expect(cartoesDoPainel(linhas)).toEqual({
      emAndamento: 2,
      vencidas: 1,
      avancoMedio: 47.5,
      aAprovar: 2,
    });
    const alertas = alertasDoPainel(linhas, -10, {
      pct: (v) => `${v}%`,
      pontos: (v) => `${v} p.p.`,
      data: (d) => d,
    });
    expect(alertas.map((x) => [x.obraId, x.tipo])).toEqual([
      ["o2", "vencido"],
      ["o1", "desvio"],
      ["o1", "sem_relatorio"],
      ["o2", "desvio"],
      ["o2", "sem_relatorio"],
      ["o3", "paralisada"],
    ]);
    expect(alertas[2]?.texto).toBe(
      "Obra A: 4 dias sem relatório (2026-11-07, 2026-11-06, 2026-11-05 e mais 1).",
    );
  });
});

describe("filtros", () => {
  it("período da URL ou os últimos 30 dias", () => {
    expect(periodoDaBusca(undefined, undefined, "2026-11-09")).toEqual({
      de: "2026-10-11",
      ate: "2026-11-09",
      padrao: true,
    });
    expect(periodoDaBusca("2026-11-05", "2026-11-01", "2026-11-09")).toEqual({
      de: "2026-11-01",
      ate: "2026-11-05",
      padrao: false,
    });
    expect(periodoDaBusca("x", "2026-11-01", "2026-11-09").padrao).toBe(true);
  });
});
