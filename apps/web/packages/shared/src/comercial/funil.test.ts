import { describe, expect, it } from "vitest";
import type { FontesRd, RdOportunidade } from "./fontes";
import {
  contarFunil,
  contarPor,
  doEstado,
  type FiltroFunil,
  filtrarFunil,
  mesesDoPeriodo,
  montarOportunidades,
  type OportunidadeFunil,
  porMesEEstado,
  quadroMensal,
} from "./funil";

// Conjunto pequeno que reproduz o teste 8 do spec ("Funil igual à
// planilha", base até 02/10/2026, Ano 2026): 335 oportunidades, 311
// perdidas, 2 vendidas, 22 em andamento, recorrentes 2.400,00 e pontuais
// 3.100,00, por mês 43, 42, 35, 37, 41, 33, 34, 32, 35, 3; Tráfego Direto
// 125, Social 82, Orgânico 73, Desconhecido 51; Sala comercial 143; "Sem
// disponibilidade no momento" 245.

const HOJE = "2026-10-02";
const POR_MES = [43, 42, 35, 37, 41, 33, 34, 32, 35, 3];
const FONTES: [string, number][] = [
  ["Tráfego Direto", 125],
  ["Social | Link da Bio do RD Station", 82],
  ["Busca Orgânica | Google", 73],
  ["Desconhecido", 51],
  ["Busca Paga | Google", 4],
];
const DE_PARA = new Map([
  ["Tráfego Direto", "Tráfego Direto"],
  ["Social | Link da Bio do RD Station", "Social"],
  ["Busca Orgânica | Google", "Orgânico"],
  ["Desconhecido", "Desconhecido"],
]);

const ref = (name: string) => ({ _id: name, name });
const repetir = <T>(lista: [T, number][]) =>
  lista.flatMap(([v, n]) => Array<T>(n).fill(v));

function oportunidade(
  i: number,
  o: Partial<RdOportunidade> & { mes: number; ano?: number },
): RdOportunidade {
  const mm = String(o.mes).padStart(2, "0");
  return {
    _id: `op-${i}`,
    name: `Oportunidade ${i}`,
    organization: null,
    rating: 3,
    deal_pipeline: ref("Comercial - Espaço Arp"),
    deal_stage: ref("Novo Cliente"),
    win: false,
    deal_lost_reason: null,
    deal_lost_note: null,
    amount_unique: 0,
    amount_montly: 0,
    hold: false,
    created_at: `${o.ano ?? 2026}-${mm}-01T15:00:00.000Z`,
    first_activity_at: null,
    last_activity_at: null,
    next_task: null,
    prediction_date: null,
    closed_at: null,
    deal_source: ref("Tráfego Direto"),
    campaign: ref("Interesses em Locação"),
    user: ref("Rafael"),
    deal_custom_fields: [],
    contacts: [
      {
        name: `Contato ${i}`,
        title: "Sócio",
        emails: [{ email: `c${i}@exemplo.com.br` }],
        phones: [{ phone: "(22) 90000-0000" }],
      },
    ],
    ...o,
  };
}

function base2026(): RdOportunidade[] {
  const meses = POR_MES.flatMap((n, m) => Array<number>(n).fill(m + 1));
  const fontes = repetir(FONTES);
  const perfis = repetir([
    ["Sala comercial", 143],
    ["Loja", 100],
    ["Galpão", 92],
  ]);
  const motivos = repetir([
    ["Sem disponibilidade no momento", 245],
    ["Demora no follow", 66],
  ]);
  return meses.map((mes, i) => {
    const vendida = i < 2;
    const andamento = i >= 2 && i < 24;
    return oportunidade(i, {
      mes,
      win: vendida ? true : andamento ? null : false,
      deal_lost_reason:
        vendida || andamento ? null : ref(motivos[i - 24] as string),
      amount_montly: i === 0 ? 2400 : andamento ? 999 : 0,
      amount_unique: i === 1 ? 3100 : 0,
      deal_source: ref(fontes[i] as string),
      deal_custom_fields: [
        {
          custom_field: {
            _id: "p",
            label: "Qual o perfil do imóvel que procura?",
          },
          value: perfis[i] as string,
        },
      ],
    });
  });
}

const RD: FontesRd = {
  oportunidades: [
    ...base2026(),
    // Fora do filtro: outro ano e outro funil.
    oportunidade(900, { mes: 12, ano: 2025 }),
    oportunidade(901, { mes: 3, deal_pipeline: ref("Eventos - Espaço Arp") }),
  ],
  conversoes: [],
  landingPages: [],
};

const FILTRO: Omit<FiltroFunil, "estado"> = {
  ano: 2026,
  mes: null,
  funil: "Comercial - Espaço Arp",
  campanha: null,
  fonteAjustada: null,
  responsavel: null,
  landingPage: null,
};

const tudo = { contato: true, valores: true };

describe("funil igual à planilha (teste 8)", () => {
  const ops = filtrarFunil(
    montarOportunidades(RD, DE_PARA, HOJE, tudo),
    FILTRO,
  );
  const c = contarFunil(ops);

  it("cartões: criadas, perdidas, vendidas e em andamento com %", () => {
    expect(c.criadas).toBe(335);
    expect(c.perdidas).toBe(311);
    expect(c.vendidas).toBe(2);
    expect(c.andamento).toBe(22);
    expect(c.perdidasPct?.toFixed(2)).toBe("92.84");
    expect(c.conversao?.toFixed(2)).toBe("0.60");
  });

  it("vendas recorrentes e pontuais só das vendidas", () => {
    expect(c.recorrentes).toBe(2400);
    expect(c.pontuais).toBe(3100);
  });

  it("oportunidades por mês, pela data de criação", () => {
    const meses = mesesDoPeriodo(2026, null, HOJE);
    expect(meses).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const q = quadroMensal(ops, (o) => o.fonteAjustada, meses);
    expect(q.total.porMes).toEqual(POR_MES);
    expect(q.total.total).toBe(335);
    expect(q.total.media).toBeCloseTo(33.5, 5);
    const e = porMesEEstado(ops, meses);
    expect(
      meses.map(
        (_, i) =>
          (e.Vendida[i] ?? 0) +
          (e.Perdida[i] ?? 0) +
          (e["Em andamento"][i] ?? 0),
      ),
    ).toEqual(POR_MES);
  });

  it("quadros: fonte ajustada pelo de-para, perfil e motivo de perda", () => {
    const q = quadroMensal(
      ops,
      (o) => o.fonteAjustada,
      mesesDoPeriodo(2026, null, HOJE),
    );
    const direto = q.linhas.find((l) => l.rotulo === "Tráfego Direto");
    expect(direto?.total).toBe(125);
    expect(direto?.pct?.toFixed(2)).toBe("37.31");
    expect(q.linhas.map((l) => [l.rotulo, l.total])).toEqual([
      ["Tráfego Direto", 125],
      ["Social", 82],
      ["Orgânico", 73],
      ["Desconhecido", 51],
      // Sem de-para: fica com o nome do RD.
      ["Busca Paga | Google", 4],
    ]);
    const sala = contarPor(ops, (o) => o.perfil)[0];
    expect(sala).toMatchObject({ rotulo: "Sala comercial", quantidade: 143 });
    expect(sala?.pct?.toFixed(2)).toBe("42.69");
    const motivos = contarPor(doEstado(ops, "Perdida"), (o) => o.motivoPerda);
    expect(motivos[0]).toMatchObject({
      rotulo: "Sem disponibilidade no momento",
      quantidade: 245,
    });
  });

  it("filtro de mês e estado", () => {
    const set = filtrarFunil(ops, { ...FILTRO, mes: 9 });
    expect(set).toHaveLength(35);
    expect(mesesDoPeriodo(2026, 9, HOJE)).toEqual([9]);
    expect(doEstado(ops, "Em andamento")).toHaveLength(22);
    expect(
      filtrarFunil(ops, { ...FILTRO, fonteAjustada: "Social" }),
    ).toHaveLength(82);
  });
});

describe("linha da oportunidade", () => {
  const rd: FontesRd = {
    oportunidades: [
      oportunidade(1, {
        mes: 9,
        // 23h de 30/09 em Brasília é 01/10 em UTC.
        created_at: "2026-10-01T02:00:00.000Z",
        last_activity_at: "2026-09-25T14:00:00.000Z",
      }),
      oportunidade(2, { mes: 9 }),
    ],
    conversoes: [
      {
        event_uuid: "a",
        email: "C1@exemplo.com.br",
        conversion_identifier: "lp-antiga",
        created_at: "2026-08-01T10:00:00.000Z",
      },
      {
        event_uuid: "b",
        email: "c1@exemplo.com.br",
        conversion_identifier: "lp-alugue",
        created_at: "2026-09-30T20:00:00.000Z",
      },
      {
        event_uuid: "c",
        email: "c1@exemplo.com.br",
        conversion_identifier: "lp-depois",
        created_at: "2026-10-01T12:00:00.000Z",
      },
      {
        event_uuid: "d",
        email: "c2@exemplo.com.br",
        conversion_identifier: "lp-depois",
        created_at: "2026-09-20T12:00:00.000Z",
      },
    ],
    landingPages: [],
  };

  it("data de criação em Brasília, dias sem interação e landing page de origem", () => {
    const [a, b] = montarOportunidades(rd, DE_PARA, HOJE, tudo);
    expect(a?.criacao).toBe("2026-09-30");
    expect(a?.diasSemInteracao).toBe(7);
    expect(a?.landingPage).toBe("lp-alugue");
    // Sem interação: vazio, a tela mostra "Sem interação".
    expect(b?.diasSemInteracao).toBeNull();
    // Só conversão depois da criação: fica com ela.
    expect(b?.landingPage).toBe("lp-depois");
  });

  it("sem a permissão, contato e valores nem entram na linha", () => {
    const [a] = montarOportunidades(rd, DE_PARA, HOJE, {
      contato: false,
      valores: false,
    });
    expect(a?.contatos).toBeNull();
    expect(a?.valorUnico).toBeNull();
    expect(a?.valorRecorrente).toBeNull();
    expect(JSON.stringify(a)).not.toContain("c1@exemplo.com.br");
    expect(contarFunil([a as OportunidadeFunil]).recorrentes).toBeNull();
    const [comTudo] = montarOportunidades(rd, DE_PARA, HOJE, tudo);
    expect(comTudo?.contatos?.[0]).toEqual({
      nome: "Contato 1",
      cargo: "Sócio",
      email: "c1@exemplo.com.br",
      telefone: "(22) 90000-0000",
    });
  });

  it("ano que não chegou não tem meses; ano passado tem os 12", () => {
    expect(mesesDoPeriodo(2027, null, HOJE)).toEqual([]);
    expect(mesesDoPeriodo(2025, null, HOJE)).toHaveLength(12);
  });
});
