import { describe, expect, it } from "vitest";
import { status } from "@/lib/indicadores";
import {
  agrupar,
  atrasadoEm,
  backlog,
  baldeDe,
  baldesDoPeriodo,
  concluidosNa,
  confirmacaoParada,
  diasDoPeriodo,
  emAbertoEm,
  idadeEmDias,
  janelaDoPeriodo,
  type LinhaMeta,
  matrizEntreSetores,
  metaPara,
  momentoDoPainel,
  naJanela,
  ORIGEM_PORTAL,
  primeiraResposta,
  resolucao,
  SEM_SETOR,
  separarNoPrazo,
  setorDeOrigem,
} from "./indicadores";
import type { Origem, StatusChamado } from "./rotulos";

// 2026-10-23 é sexta.
const brt = (s: string) => new Date(`${s}-03:00`);
const iso = (s: string) => brt(s).toISOString();
const AGORA = brt("2026-10-23T12:00");

function ch(p: Partial<Chamado> & { id: string }): Chamado {
  return {
    status: "aberto",
    origem: "sistema",
    setor_id: "op",
    categoria_id: null,
    aberto_por: null,
    prazo: null,
    criado_em: iso("2026-10-01T09:00"),
    concluido_em: null,
    fechado_em: null,
    cancelado_em: null,
    primeira_resposta_em: null,
    aguardando_min: 0,
    aguardando_desde: null,
    ...p,
  };
}

interface Chamado {
  id: string;
  status: StatusChamado;
  origem: Origem;
  setor_id: string;
  categoria_id: string | null;
  aberto_por: string | null;
  prazo: string | null;
  criado_em: string;
  concluido_em: string | null;
  fechado_em: string | null;
  cancelado_em: string | null;
  primeira_resposta_em: string | null;
  aguardando_min: number;
  aguardando_desde: string | null;
}

describe("janela do período", () => {
  it("vai do início do primeiro dia ao fim do último, em Brasília", () => {
    const j = janelaDoPeriodo("2026-10-01", "2026-10-23");
    expect(naJanela(iso("2026-10-01T00:00"), j)).toBe(true);
    expect(naJanela(iso("2026-10-23T23:59"), j)).toBe(true);
    expect(naJanela(iso("2026-10-24T00:00"), j)).toBe(false);
    expect(naJanela(iso("2026-09-30T23:59"), j)).toBe(false);
    expect(naJanela(null, j)).toBe(false);
  });

  it("olha até agora, ou até o fim do período que já passou", () => {
    const hoje = janelaDoPeriodo("2026-10-01", "2026-10-23");
    expect(momentoDoPainel(hoje, AGORA)).toBe(AGORA);
    const passado = janelaDoPeriodo("2026-09-01", "2026-09-30");
    expect(momentoDoPainel(passado, AGORA)).toEqual(brt("2026-10-01T00:00"));
  });
});

describe("abertos, atrasados e fechados", () => {
  it("agora vale o status; concluído aguardando confirmação não está em aberto", () => {
    expect(emAbertoEm(ch({ id: "a" }), AGORA, AGORA)).toBe(true);
    expect(
      emAbertoEm(ch({ id: "b", status: "aguardando" }), AGORA, AGORA),
    ).toBe(true);
    expect(emAbertoEm(ch({ id: "c", status: "concluido" }), AGORA, AGORA)).toBe(
      false,
    );
  });

  it("num momento passado reconstrói pelas datas do ciclo", () => {
    const fim = brt("2026-10-10T00:00");
    const fechadoDepois = ch({
      id: "a",
      status: "fechado",
      concluido_em: iso("2026-10-15T10:00"),
      fechado_em: iso("2026-10-16T10:00"),
    });
    expect(emAbertoEm(fechadoDepois, fim, AGORA)).toBe(true);
    const criadoDepois = ch({ id: "b", criado_em: iso("2026-10-12T10:00") });
    expect(emAbertoEm(criadoDepois, fim, AGORA)).toBe(false);
    const canceladoAntes = ch({
      id: "c",
      status: "cancelado",
      cancelado_em: iso("2026-10-05T10:00"),
    });
    expect(emAbertoEm(canceladoAntes, fim, AGORA)).toBe(false);
  });

  it("atrasado é o aberto com prazo vencido no momento", () => {
    const vencido = ch({ id: "a", prazo: iso("2026-10-20T18:00") });
    const futuro = ch({ id: "b", prazo: iso("2026-10-30T18:00") });
    const semPrazo = ch({ id: "c" });
    const concluido = ch({
      id: "d",
      status: "concluido",
      prazo: iso("2026-10-20T18:00"),
      concluido_em: iso("2026-10-21T18:00"),
    });
    expect(
      [vencido, futuro, semPrazo, concluido].filter((c) =>
        atrasadoEm(c, AGORA, AGORA),
      ),
    ).toEqual([vencido]);
  });

  it("fechados no período: concluído ou fechado com a conclusão dentro dele", () => {
    const j = janelaDoPeriodo("2026-10-01", "2026-10-23");
    const lista = [
      ch({ id: "a", status: "fechado", concluido_em: iso("2026-10-05T10:00") }),
      ch({
        id: "b",
        status: "concluido",
        concluido_em: iso("2026-10-22T10:00"),
      }),
      ch({
        id: "c",
        status: "fechado",
        concluido_em: iso("2026-09-29T10:00"),
      }),
      ch({
        id: "d",
        status: "cancelado",
        cancelado_em: iso("2026-10-05T10:00"),
      }),
    ];
    expect(concluidosNa(lista, j).map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("% no prazo só entre os que tinham prazo", () => {
    const r = separarNoPrazo([
      ch({
        id: "a",
        prazo: iso("2026-10-10T18:00"),
        concluido_em: iso("2026-10-10T17:00"),
      }),
      ch({
        id: "b",
        prazo: iso("2026-10-10T18:00"),
        concluido_em: iso("2026-10-11T09:00"),
      }),
      ch({
        id: "c",
        prazo: iso("2026-10-10T18:00"),
        concluido_em: iso("2026-10-10T18:00"),
      }),
      ch({ id: "d", concluido_em: iso("2026-10-10T18:00") }),
    ]);
    expect(r.noPrazo.map((c) => c.id)).toEqual(["a", "c"]);
    expect(r.fora.map((c) => c.id)).toEqual(["b"]);
    expect(r.semPrazo.map((c) => c.id)).toEqual(["d"]);
    expect(r.pct).toBeCloseTo(66.67, 1);
    expect(separarNoPrazo([ch({ id: "x" })]).pct).toBeNull();
  });
});

describe("metas", () => {
  const metas: LinhaMeta[] = [
    {
      setor_id: null,
      categoria_id: null,
      indicador: "pct_no_prazo",
      meta: 80,
      limite_atencao: 70,
    },
    {
      setor_id: "op",
      categoria_id: null,
      indicador: "pct_no_prazo",
      meta: 90,
      limite_atencao: null,
    },
    {
      setor_id: null,
      categoria_id: "eletrica",
      indicador: "tempo_medio_horas",
      meta: 24,
      limite_atencao: 36,
    },
  ];

  it("usa a mais específica: categoria, setor, geral", () => {
    expect(metaPara(metas, "pct_no_prazo", "op")?.meta).toBe(90);
    expect(metaPara(metas, "pct_no_prazo", "mkt")?.meta).toBe(80);
    expect(metaPara(metas, "pct_no_prazo", null)?.meta).toBe(80);
    expect(
      metaPara(metas, "tempo_medio_horas", "op", "eletrica")?.limiteAtencao,
    ).toBe(36);
    expect(metaPara(metas, "tempo_medio_horas", "op", "hidraulica")).toBeNull();
  });

  it("% no prazo: maior é melhor; tempo médio: menor é melhor", () => {
    const pct = metaPara(metas, "pct_no_prazo", null);
    expect(status(85, pct)).toBe("ok");
    expect(status(75, pct)).toBe("atencao");
    expect(status(60, pct)).toBe("fora");
    const tempo = metaPara(metas, "tempo_medio_horas", "op", "eletrica");
    expect(status(20, tempo)).toBe("ok");
    expect(status(30, tempo)).toBe("atencao");
    expect(status(40, tempo)).toBe("fora");
    expect(status(40, null)).toBe("sem_meta");
  });
});

describe("semanas do período", () => {
  it("segunda a domingo, cortadas nas pontas", () => {
    const b = baldesDoPeriodo("2026-10-01", "2026-10-23");
    expect(b.map((x) => [x.de, x.ate])).toEqual([
      ["2026-10-01", "2026-10-04"],
      ["2026-10-05", "2026-10-11"],
      ["2026-10-12", "2026-10-18"],
      ["2026-10-19", "2026-10-23"],
    ]);
    expect(b[1]?.titulo).toBe("05/10 a 11/10/2026");
    expect(baldeDe(iso("2026-10-11T23:00"), b)).toBe("2026-10-05");
    expect(baldeDe(iso("2026-10-24T10:00"), b)).toBeNull();
  });

  it("um dia só vira um balde", () => {
    expect(baldesDoPeriodo("2026-10-23", "2026-10-23")).toHaveLength(1);
  });

  it("período longo vira meses", () => {
    const b = baldesDoPeriodo("2026-01-01", "2026-10-23");
    expect(b).toHaveLength(10);
    expect(b[0]).toMatchObject({ rotulo: "jan", titulo: "jan/2026" });
    expect(b.at(-1)).toMatchObject({ de: "2026-10-01", ate: "2026-10-23" });
  });

  it("dias do período", () => {
    expect(diasDoPeriodo("2026-10-30", "2026-11-02")).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });
});

describe("agrupar", () => {
  it("do maior grupo para o menor", () => {
    const g = agrupar(["b", "a", "b", "c", "a", "b"], (x) => x);
    expect(g.map((x) => [x.chave, x.itens.length])).toEqual([
      ["b", 3],
      ["a", 2],
      ["c", 1],
    ]);
  });
});

describe("tempo de resolução", () => {
  it("desconta o Aguardando e avisa quantos vieram do histórico", () => {
    const r = resolucao([
      ch({
        id: "a",
        criado_em: iso("2026-10-20T08:00"),
        concluido_em: iso("2026-10-20T12:00"),
        aguardando_min: 60,
      }),
      ch({
        id: "b",
        origem: "importacao",
        criado_em: iso("2026-10-20T08:00"),
        concluido_em: iso("2026-10-20T09:00"),
      }),
    ]);
    expect(r.porChamado.get("a")).toBe(180);
    expect(r.mediaMin).toBe(120);
    expect(r.n).toBe(2);
    expect(r.importados).toBe(1);
  });
});

describe("aguardando confirmação", () => {
  it("só os concluídos há mais dos dias do parâmetro", () => {
    const lista = [
      ch({
        id: "a",
        status: "concluido",
        concluido_em: iso("2026-10-20T10:00"),
      }),
      ch({
        id: "b",
        status: "concluido",
        concluido_em: iso("2026-10-22T10:00"),
      }),
      ch({ id: "c", status: "fechado", concluido_em: iso("2026-10-01T10:00") }),
    ];
    expect(confirmacaoParada(lista, AGORA, 2).map((c) => c.id)).toEqual(["a"]);
  });
});

describe("primeira resposta", () => {
  const horas = new Map<string, number | null>([
    ["eletrica", 4],
    ["sem", null],
  ]);

  it("separa cumpridos, estourados, pendentes, sem meta e sem dado", () => {
    const r = primeiraResposta(
      [
        ch({
          id: "ok",
          categoria_id: "eletrica",
          criado_em: iso("2026-10-22T08:00"),
          primeira_resposta_em: iso("2026-10-22T11:00"),
        }),
        ch({
          id: "tarde",
          categoria_id: "eletrica",
          criado_em: iso("2026-10-22T08:00"),
          primeira_resposta_em: iso("2026-10-22T13:00"),
        }),
        ch({
          id: "esperando",
          categoria_id: "eletrica",
          criado_em: iso("2026-10-22T08:00"),
        }),
        ch({
          id: "recente",
          categoria_id: "eletrica",
          criado_em: iso("2026-10-23T10:00"),
        }),
        ch({
          id: "semMeta",
          categoria_id: "sem",
          criado_em: iso("2026-10-22T08:00"),
          primeira_resposta_em: iso("2026-10-22T09:00"),
        }),
        ch({
          id: "velho",
          origem: "importacao",
          categoria_id: "eletrica",
          criado_em: iso("2026-10-22T08:00"),
          primeira_resposta_em: iso("2026-10-22T08:30"),
        }),
      ],
      horas,
      AGORA,
    );
    const ids = (xs: { id: string }[]) => xs.map((x) => x.id);
    expect(ids(r.cumpridos)).toEqual(["ok"]);
    expect(ids(r.estourados)).toEqual(["tarde", "esperando"]);
    expect(ids(r.pendentes)).toEqual(["recente"]);
    expect(ids(r.semMeta)).toEqual(["semMeta"]);
    expect(ids(r.semDado)).toEqual(["velho"]);
    expect(r.pct).toBe((1 / 3) * 100);
    // Média: 180, 300 e 60 minutos (o importado não entra).
    expect(r.mediaMin).toBe(180);
  });
});

describe("backlog", () => {
  it("idade sem o tempo em Aguardando, por faixa", () => {
    const parado = ch({
      id: "p",
      criado_em: iso("2026-10-13T12:00"),
      aguardando_min: 1440 * 2,
      aguardando_desde: iso("2026-10-22T12:00"),
    });
    // 10 dias corridos − 2 já parados − 1 parado agora = 7.
    expect(idadeEmDias(parado, AGORA)).toBe(7);
    const b = backlog(
      [
        parado,
        ch({ id: "novo", criado_em: iso("2026-10-23T08:00") }),
        ch({ id: "velho", criado_em: iso("2026-08-01T08:00") }),
      ],
      AGORA,
    );
    expect(b.faixas.map((f) => f.itens.map((c) => c.id))).toEqual([
      ["novo"],
      [],
      ["p"],
      ["velho"],
    ]);
    expect(b.maisAntigo?.id).toBe("velho");
    expect(b.mediaDias).not.toBeNull();
  });
});

describe("chamados entre setores", () => {
  const setores = new Map([
    ["ana", ["mkt"]],
    ["bia", ["op", "mkt"]],
    ["caio", []],
  ]);

  it("origem: portal, setor de quem abriu ou sem setor; interno não conta", () => {
    expect(
      setorDeOrigem({ origem: "portal", aberto_por: null }, "op", setores),
    ).toBe(ORIGEM_PORTAL);
    expect(
      setorDeOrigem({ origem: "sistema", aberto_por: "ana" }, "op", setores),
    ).toBe("mkt");
    expect(
      setorDeOrigem({ origem: "sistema", aberto_por: "bia" }, "mkt", setores),
    ).toBeNull();
    expect(
      setorDeOrigem({ origem: "sistema", aberto_por: "caio" }, "op", setores),
    ).toBe(SEM_SETOR);
  });

  it("um aviso para vários setores conta em cada destino", () => {
    const m = matrizEntreSetores(
      [
        ch({ id: "1", setor_id: "op", aberto_por: "ana" }),
        ch({ id: "2", setor_id: "op", aberto_por: "ana" }),
        ch({ id: "3", setor_id: "mkt", aberto_por: "ana" }),
        ch({ id: "4", setor_id: "com", aberto_por: "ana" }),
      ],
      setores,
      new Map([["4", ["op", "est"]]]),
    );
    expect(m.map((c) => [c.origem, c.destino, c.itens.length])).toEqual([
      ["mkt", "op", 3],
      ["mkt", "com", 1],
      ["mkt", "est", 1],
    ]);
  });
});
