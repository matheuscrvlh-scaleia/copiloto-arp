import { describe, expect, it } from "vitest";
import type { PeriodoApurado } from "./painel-apuracao";
import {
  colunasDosConsolidados,
  type EntradaDoPainel,
  equivalenciasDoVolume,
  linhasDeConsolidados,
  montarCartoes,
  montarComparacao,
  montarGraficos,
  montarPainel,
  separarReais,
  textoDaVariacao,
  totaisDoAno,
  valorComUnidade,
  volumeDesdeOInicio,
} from "./painel-montagem";

const mensal = (porMes: (number | null)[], total?: number | null) => ({
  total:
    total !== undefined
      ? total
      : porMes.some((v) => v !== null)
        ? porMes.reduce<number>((t, v) => t + (v ?? 0), 0)
        : null,
  porMes,
});

function periodo(
  ano: number,
  base: Partial<PeriodoApurado> = {},
): PeriodoApurado {
  return {
    ano,
    ateMes: 3,
    volume: mensal([100, 200, 300]),
    pessoas: mensal([10, 20, 30]),
    oficinas: mensal([1, null, 2]),
    produtores: { participacoes: 40, unicos: 12 },
    energia: mensal([8000, 8500, 9000]),
    co2: null,
    rcc: {
      a: mensal([24, null, 16]),
      b: mensal([8, null, 8]),
      total: mensal([32, null, 24]),
      pctReciclado: (40 / 56) * 100,
      economia: 1500,
    },
    ...base,
  };
}

function entrada(p: Partial<EntradaDoPainel> = {}): EntradaDoPainel {
  return {
    filtros: { ano: 2026, ateMes: 3, comparar: false },
    atual: periodo(2026),
    anterior: periodo(2025, { volume: mensal([50, 100, 150]) }),
    desdeOInicio: { valor: 41_250 + 600, marcoAteAno: 2025 },
    agua: { m3: 1000, anterior: 950, incompleta: false },
    clube: {
      ativos: 27,
      locatarios: 27,
      clientes: 178,
      participacao: (27 / 178) * 100,
    },
    entrevistas: {
      emDia: 150,
      precisam: 160,
      pct: 93.75,
      pendentes: 6,
      vencidas: 4,
    },
    ocupacao: { preto: 78, azul: null, rondas: 4 },
    limiteOcupacao: 90,
    metas: {},
    comValores: true,
    equivalencias: [],
    ...p,
  };
}

const porChave = (e: EntradaDoPainel) =>
  Object.fromEntries(montarCartoes(e).map((c) => [c.chave, c]));

describe("cartões do painel", () => {
  it("mostra os 12 indicadores, com valor e unidade", () => {
    const c = montarCartoes(entrada());
    expect(c).toHaveLength(12);
    const m = Object.fromEntries(c.map((x) => [x.chave, x]));
    expect(m.volume_reciclado?.valor).toBe("600 kg");
    expect(m.energia_gerada?.valor).toBe("25.500 kWh");
    expect(m.rcc_total?.valor).toBe("56,00 t");
    expect(m.rcc_total?.detalhe).toBe("71,4% reciclado (classe A)");
    expect(m.participantes_clube?.valor).toBe("27");
    expect(m.participantes_clube?.detalhe).toBe(
      "27 locatários de 178 clientes com contrato (15,2%)",
    );
    expect(m.cobertura_entrevistas?.valor).toBe("93,8%");
    expect(m.cobertura_entrevistas?.detalhe).toContain("150 em dia de 160");
    expect(m.ocupacao_coletores?.valor).toBe("78% / sem dado");
  });

  it("volume: desde o início com o marco", () => {
    const m = porChave(entrada());
    expect(m.volume_reciclado?.detalhe).toBe(
      "Desde o início: 41.850 kg (marco até dez/2025 + sistema)",
    );
    const sem = porChave(
      entrada({ desdeOInicio: { valor: null, marcoAteAno: null } }),
    );
    expect(sem.volume_reciclado?.detalhe).toBe("Desde o início: sem dado");
  });

  it("fonte sem dado vira 'sem dado em mm/aaaa', nunca zero", () => {
    const e = entrada({
      atual: periodo(2026, {
        energia: mensal([null, null, null]),
        volume: mensal([null, null, null]),
      }),
      agua: { m3: null, anterior: null, incompleta: false },
      clube: null,
      entrevistas: {
        emDia: 0,
        precisam: 0,
        pct: null,
        pendentes: 0,
        vencidas: 0,
      },
      ocupacao: { preto: null, azul: null, rondas: 0 },
    });
    const m = porChave(e);
    for (const chave of [
      "energia_gerada",
      "co2_evitado",
      "volume_reciclado",
      "consumo_agua",
      "participantes_clube",
      "cobertura_entrevistas",
      "ocupacao_coletores",
    ] as const) {
      expect(m[chave]?.valor).toBe("sem dado em 03/2026");
      expect(m[chave]?.semDado).toBe(true);
    }
  });

  it("CO₂ sem dado explica que Operações ainda não informa", () => {
    const m = porChave(entrada());
    expect(m.co2_evitado?.valor).toBe("sem dado em 03/2026");
    expect(m.co2_evitado?.detalhe).toBe(
      "Operações ainda não informa o CO₂ evitado",
    );
    const com = porChave(entrada({ atual: periodo(2026, { co2: 1.234 }) }));
    expect(com.co2_evitado?.valor).toBe("1,23 t");
  });

  it("produtores: participações e únicos em dois números", () => {
    const m = porChave(entrada());
    expect(m.produtores_participacoes?.valor).toBe("40 participações");
    expect(m.produtores_participacoes?.detalhe).toContain(
      "12 produtores únicos",
    );
    expect(m.produtores_participacoes?.titulo).toBe("Produtores locais");
  });

  it("água: variação sobre o mesmo mês do ano anterior (sempre) e aviso de mês incompleto", () => {
    const m = porChave(
      entrada({ agua: { m3: 1100, anterior: 1000, incompleta: true } }),
    );
    expect(m.consumo_agua?.titulo).toBe("Consumo de água – mar/2026");
    expect(m.consumo_agua?.valor).toBe("1.100 m³");
    expect(m.consumo_agua?.variacao?.texto).toBe("+10,0% sobre 03/2025");
    // mais água que antes é ruim
    expect(m.consumo_agua?.variacao?.sentido).toBe("ruim");
    expect(m.consumo_agua?.aviso).toContain("incompleto");
  });

  it("variação do ano só aparece com 'comparar'", () => {
    expect(porChave(entrada()).volume_reciclado?.variacao).toBeUndefined();
    const m = porChave(
      entrada({ filtros: { ano: 2026, ateMes: 3, comparar: true } }),
    );
    expect(m.volume_reciclado?.variacao).toEqual({
      texto: "+100,0% sobre o mesmo período de 2025",
      sentido: "bom",
    });
  });

  it("valor economizado só aparece com a permissão de valores", () => {
    const com = montarCartoes(entrada({ comValores: true }));
    expect(com.some((c) => c.chave === "rcc_economia")).toBe(true);
    expect(com.find((c) => c.chave === "rcc_economia")?.valor).toBe(
      "R$ 1.500,00",
    );
    const sem = montarPainel(entrada({ comValores: false }));
    expect(sem.cartoes.some((c) => c.chave === "rcc_economia")).toBe(false);
    expect(
      sem.comparacao.some((l) => l.indicador.includes("economizado")),
    ).toBe(false);
    expect(JSON.stringify(sem)).not.toContain("1.500,00");
  });

  it("meta: no acumulado mostra quanto foi atingido; na foto, o semáforo", () => {
    const m = porChave(
      entrada({
        metas: {
          volume_reciclado: {
            meta: 1200,
            limiteAtencao: null,
            direcao: "maior_melhor",
          },
          cobertura_entrevistas: {
            meta: 100,
            limiteAtencao: 90,
            direcao: "maior_melhor",
          },
        },
      }),
    );
    expect(m.volume_reciclado?.meta).toBe("Meta 2026: 1.200 kg (50% atingido)");
    expect(m.volume_reciclado?.status).toBeUndefined();
    expect(m.cobertura_entrevistas?.meta).toBe("Meta: 100,0%");
    expect(m.cobertura_entrevistas?.status).toBe("atencao");
    expect(m.energia_gerada?.meta).toBeUndefined();
  });

  it("ocupação: o limite vem dos Parâmetros, acima dele fica fora", () => {
    const m = porChave(
      entrada({
        ocupacao: { preto: 95, azul: 40, rondas: 3 },
        limiteOcupacao: 90,
      }),
    );
    expect(m.ocupacao_coletores?.meta).toBe("Limite de alerta: 90%");
    expect(m.ocupacao_coletores?.status).toBe("fora");
  });

  it("cada cartão abre a tela de origem já filtrada", () => {
    const m = porChave(entrada());
    expect(m.volume_reciclado?.href).toContain("/sustentabilidade/programas?");
    expect(m.volume_reciclado?.href).toContain("de=2026-01-01&ate=2026-03-31");
    expect(m.volume_reciclado?.href).toContain("grupo=Volume%20reciclado");
    expect(m.consumo_agua?.href).toBe("/operacoes/agua?mes=2026-03");
    expect(m.energia_gerada?.href).toBe("/operacoes/energia/solar?mes=2026-03");
    expect(m.rcc_total?.href).toContain("/sustentabilidade/rcc?");
  });
});

describe("gráficos do painel", () => {
  it("quatro gráficos, com o ano anterior só quando comparar", () => {
    const sem = montarGraficos(entrada());
    expect(sem.map((g) => g.chave)).toEqual([
      "volume",
      "energia",
      "rcc",
      "pessoas",
    ]);
    expect(sem[0]?.series).toHaveLength(1);
    expect(sem[0]?.meses).toEqual(["jan", "fev", "mar"]);
    expect(sem[2]?.empilhado).toBe(true);
    expect(sem[2]?.series.map((s) => s.chave)).toEqual(["a", "b"]);

    const com = montarGraficos(
      entrada({ filtros: { ano: 2026, ateMes: 3, comparar: true } }),
    );
    expect(com[0]?.series.map((s) => s.rotulo)).toEqual(["2026", "2025"]);
    expect(com[0]?.series[1]?.valores).toEqual([50, 100, 150]);
    expect(com[2]?.empilhado).toBe(false);
    expect(com[2]?.series).toHaveLength(4);
  });

  it("mês sem dado fica null na série (não vira zero)", () => {
    const g = montarGraficos(entrada());
    expect(g[2]?.series[0]?.valores).toEqual([24, null, 16]);
  });
});

describe("comparação com o ano anterior", () => {
  it("atual, anterior e variação; sem ponta, travessão", () => {
    const linhas = montarComparacao(
      entrada({
        anterior: periodo(2025, { co2: null, volume: mensal([50, 100, 150]) }),
      }),
    );
    const v = linhas.find((l) => l.indicador === "Volume reciclado no ano");
    expect(v).toEqual({
      indicador: "Volume reciclado no ano",
      atual: "600 kg",
      anterior: "300 kg",
      variacao: "+100,0%",
    });
    const co2 = linhas.find((l) => l.indicador.startsWith("CO₂"));
    expect(co2?.atual).toBe("sem dado");
    expect(co2?.variacao).toBe("—");
  });
});

describe("equivalências", () => {
  it("só as confirmadas com a área, sobre as toneladas", () => {
    const eq = equivalenciasDoVolume(2000, [
      { nome: "Árvores", fator: 17, unidade: "árvores", confirmado: true },
      { nome: "Água", fator: 3, unidade: "L", confirmado: false },
    ]);
    expect(eq).toEqual([{ nome: "Árvores", texto: "≈ 34 árvores" }]);
    expect(equivalenciasDoVolume(null, [])).toEqual([]);
  });
});

describe("desde o início", () => {
  it("marcos + anos no sistema; o ano fechado vale pelo consolidado", () => {
    const r = volumeDesdeOInicio({
      ano: 2027,
      marcos: [
        { ano: 2024, valor: 1000 },
        { ano: 2025, valor: 2000 },
      ],
      vivos: new Map<number, number | null>([
        [2026, 5000],
        [2027, 700],
      ]),
      fechados: new Map<number, number | null>([[2026, 4900]]),
    });
    // 2024 + 2025 (marcos) + 2026 fechado (4.900) + 2027 vivo
    expect(r).toEqual({ valor: 1000 + 2000 + 4900 + 700, marcoAteAno: 2025 });
  });

  it("ano do marco não soma o do sistema de novo; marco depois do ano do filtro fica de fora", () => {
    const r = volumeDesdeOInicio({
      ano: 2025,
      marcos: [
        { ano: 2025, valor: 2000 },
        { ano: 2026, valor: 9999 },
      ],
      vivos: new Map<number, number | null>([[2025, 300]]),
      fechados: new Map(),
    });
    expect(r.valor).toBe(2000);
    expect(r.marcoAteAno).toBe(2025);
  });

  it("sem marco nem dado: null", () => {
    expect(
      volumeDesdeOInicio({
        ano: 2026,
        marcos: [],
        vivos: new Map(),
        fechados: new Map(),
      }),
    ).toEqual({ valor: null, marcoAteAno: null });
  });
});

describe("totais do ano e consolidados", () => {
  const p = periodo(2026);
  const clube = { ativos: 27, locatarios: 27, clientes: 178, participacao: 15 };

  it("totais do ano com as mesmas chaves do marco", () => {
    const t = totaisDoAno(p, clube);
    expect(t.volume_reciclado).toBe(600);
    expect(t.rcc_total).toBe(56);
    expect(t.participantes_clube).toBe(27);
    expect(t.co2_evitado).toBeNull();
    expect(t.rcc_economia).toBe(1500);
  });

  it("separa os reais dos demais e descarta o que não tem dado", () => {
    const { semReais, reais } = separarReais(totaisDoAno(p, clube));
    expect(reais).toEqual({ rcc_economia: 1500 });
    expect(semReais.volume_reciclado).toBe(600);
    expect("co2_evitado" in semReais).toBe(false);
    expect("rcc_economia" in semReais).toBe(false);
  });

  const marcos = [
    { indicador: "volume_reciclado", ano: 2024, valor: 18_420 },
    { indicador: "volume_reciclado", ano: 2025, valor: 22_830 },
  ];

  it("tabela: marco inicial, fechado (consolidado) e ano aberto", () => {
    const linhas = linhasDeConsolidados({
      marcos,
      consolidados: [
        {
          ano: 2025,
          situacao: "fechado",
          totais: { volume_reciclado: 23_000 },
          totaisReais: null,
          fechadoEm: null,
          reabertoMotivo: null,
        },
      ],
      aoVivo: new Map([
        [2025, { volume_reciclado: 23_000 }],
        [2026, { volume_reciclado: 600 }],
      ]),
      comValores: true,
    });
    expect(linhas.map((l) => [l.ano, l.origem, l.situacao])).toEqual([
      [2024, "Marco inicial", "Fechado"],
      [2025, "Consolidado", "Fechado"],
      [2026, "Sistema", "Aberto"],
    ]);
    expect(linhas[0]?.valores.volume_reciclado).toBe(18_420);
    expect(linhas[1]?.aviso).toBeNull();
  });

  it("lançamento alterado depois de fechar: aviso, consolidado intacto", () => {
    const linhas = linhasDeConsolidados({
      marcos: [],
      consolidados: [
        {
          ano: 2026,
          situacao: "fechado",
          totais: { volume_reciclado: 600, oficinas: 3 },
          totaisReais: null,
          fechadoEm: null,
          reabertoMotivo: null,
        },
      ],
      aoVivo: new Map([[2026, { volume_reciclado: 650, oficinas: 3 }]]),
      comValores: true,
    });
    const l = linhas[0];
    expect(l?.valores.volume_reciclado).toBe(600);
    expect(l?.aviso).toEqual([
      { indicador: "volume_reciclado", consolidado: 600, atual: 650 },
    ]);
  });

  it("ano reaberto volta ao vivo, com o motivo", () => {
    const [l] = linhasDeConsolidados({
      marcos: [],
      consolidados: [
        {
          ano: 2026,
          situacao: "reaberto",
          totais: { volume_reciclado: 600 },
          totaisReais: null,
          fechadoEm: null,
          reabertoMotivo: "Faltava uma coleta",
        },
      ],
      aoVivo: new Map([[2026, { volume_reciclado: 650 }]]),
      comValores: true,
    });
    expect(l?.situacao).toBe("Reaberto");
    expect(l?.valores.volume_reciclado).toBe(650);
    expect(l?.aviso).toBeNull();
    expect(l?.motivoDaReabertura).toBe("Faltava uma coleta");
  });

  it("sem 'Ver valores' os reais não aparecem nem entram no aviso", () => {
    const [l] = linhasDeConsolidados({
      marcos: [],
      consolidados: [
        {
          ano: 2026,
          situacao: "fechado",
          totais: { volume_reciclado: 600 },
          totaisReais: { rcc_economia: 1000 },
          fechadoEm: null,
          reabertoMotivo: null,
        },
      ],
      aoVivo: new Map([[2026, { volume_reciclado: 600, rcc_economia: 2000 }]]),
      comValores: false,
    });
    expect("rcc_economia" in (l?.valores ?? {})).toBe(false);
    expect(l?.aviso).toBeNull();
    expect(colunasDosConsolidados(false)).not.toContain("rcc_economia");
    expect(colunasDosConsolidados(true)).toContain("rcc_economia");
  });
});

describe("formatos", () => {
  it("valor com unidade e variação", () => {
    expect(valorComUnidade(1234.5, "2026-03-01", 1, "t")).toBe("1.234,5 t");
    expect(valorComUnidade(12, "2026-03-01", 0, "%")).toBe("12%");
    expect(valorComUnidade(10, "2026-03-01", 2, "R$")).toBe("R$ 10,00");
    expect(valorComUnidade(null, "2026-03-01", 2, "t")).toBe(
      "sem dado em 03/2026",
    );
    expect(textoDaVariacao(110, 100)).toBe("+10,0%");
    expect(textoDaVariacao(90, 100)).toBe("-10,0%");
    expect(textoDaVariacao(null, 100)).toBe("—");
  });
});
