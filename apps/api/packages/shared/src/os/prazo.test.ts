import { describe, expect, it } from "vitest";
import {
  type Calendario,
  calcularPrazo,
  diasEmAberto,
  ehDiaUtil,
  grupoDaCaixa,
  minutosEmAguardando,
  noPrazo,
  prazoDoAceite,
  situacaoDoPrazo,
  somarDiasUteis,
  tempoDeResolucaoMin,
} from "./prazo";

const cal: Calendario = {
  feriados: new Set(["2026-11-02", "2026-11-20"]),
  diasUteis: [1, 2, 3, 4, 5],
  expedienteFim: "18:00",
};

// 2026-10-23 é sexta.
const brt = (s: string) => new Date(`${s}-03:00`);

describe("dias úteis", () => {
  it("pula fim de semana e feriado", () => {
    expect(ehDiaUtil("2026-10-24", cal)).toBe(false);
    expect(ehDiaUtil("2026-11-02", cal)).toBe(false);
    expect(somarDiasUteis("2026-10-23", 1, cal)).toBe("2026-10-26");
    // Sexta 30/10 + 2: segunda 02/11 é feriado → terça e quarta.
    expect(somarDiasUteis("2026-10-30", 2, cal)).toBe("2026-11-04");
    expect(somarDiasUteis("2026-10-23", 0, cal)).toBe("2026-10-23");
  });
});

describe("cálculo do prazo", () => {
  it("horas são corridas", () => {
    const p = calcularPrazo(
      { abertura: brt("2026-10-23T17:00"), valor: 24, unidade: "horas" },
      cal,
    );
    expect(p.toISOString()).toBe(brt("2026-10-24T17:00").toISOString());
  });

  it("dias úteis vencem no fim do expediente", () => {
    const p = calcularPrazo(
      { abertura: brt("2026-10-23T17:00"), valor: 1, unidade: "dias_uteis" },
      cal,
    );
    expect(p.toISOString()).toBe(brt("2026-10-26T18:00").toISOString());
  });

  it("abertura às 23h em Brasília conta pelo dia de Brasília", () => {
    // 23h de quinta em Brasília já é sexta em UTC.
    const p = calcularPrazo(
      { abertura: brt("2026-10-22T23:00"), valor: 1, unidade: "dias_uteis" },
      cal,
    );
    expect(p.toISOString()).toBe(brt("2026-10-23T18:00").toISOString());
  });

  it("aceite fecha sozinho depois de N dias úteis", () => {
    const p = prazoDoAceite(brt("2026-10-30T10:00"), 3, cal);
    expect(p.toISOString()).toBe(brt("2026-11-05T18:00").toISOString());
  });
});

describe("situação do prazo", () => {
  const agora = brt("2026-10-23T10:00");
  const sit = (prazo: string | null, status = "aberto" as const) =>
    situacaoDoPrazo({ prazo, status }, agora, 48);

  it("etiquetas", () => {
    expect(sit(brt("2026-10-23T09:00").toISOString())).toBe("atrasado");
    expect(sit(brt("2026-10-23T18:00").toISOString())).toBe("vence_hoje");
    expect(sit(brt("2026-10-24T09:00").toISOString())).toBe("vencendo");
    expect(sit(brt("2026-10-30T09:00").toISOString())).toBe("no_prazo");
    expect(sit(null)).toBe("sem_prazo");
  });

  it("encerrados não atrasam; aguardando conta normal", () => {
    const vencido = brt("2026-10-20T09:00").toISOString();
    for (const status of ["concluido", "fechado", "cancelado"] as const)
      expect(situacaoDoPrazo({ prazo: vencido, status }, agora, 48)).toBe(
        "encerrado",
      );
    expect(
      situacaoDoPrazo({ prazo: vencido, status: "aguardando" }, agora, 48),
    ).toBe("atrasado");
  });
});

describe("caixa de entrada", () => {
  const agora = brt("2026-10-23T10:00"); // sexta
  it("agrupa até o domingo desta semana", () => {
    expect(grupoDaCaixa(brt("2026-10-22T10:00").toISOString(), agora)).toBe(
      "atrasados",
    );
    expect(grupoDaCaixa(brt("2026-10-23T23:30").toISOString(), agora)).toBe(
      "hoje",
    );
    expect(grupoDaCaixa(brt("2026-10-25T20:00").toISOString(), agora)).toBe(
      "semana",
    );
    expect(grupoDaCaixa(brt("2026-10-26T08:00").toISOString(), agora)).toBe(
      "depois",
    );
    expect(grupoDaCaixa(null, agora)).toBe("sem_prazo");
  });

  it("no domingo a semana acaba hoje", () => {
    const domingo = brt("2026-10-25T10:00");
    expect(grupoDaCaixa(brt("2026-10-26T10:00").toISOString(), domingo)).toBe(
      "depois",
    );
  });
});

describe("tempos", () => {
  const agora = brt("2026-10-23T10:00");

  it("aguardando soma a pausa que está correndo", () => {
    expect(
      minutosEmAguardando(
        {
          aguardando_min: 30,
          aguardando_desde: brt("2026-10-23T09:00").toISOString(),
        },
        agora,
      ),
    ).toBe(90);
    expect(
      minutosEmAguardando(
        { aguardando_min: 30, aguardando_desde: null },
        agora,
      ),
    ).toBe(30);
  });

  it("dias em aberto descontam o aguardando", () => {
    expect(
      diasEmAberto(
        {
          criado_em: brt("2026-10-20T10:00").toISOString(),
          encerrado_em: null,
          aguardando_min: 1440,
          aguardando_desde: null,
        },
        agora,
      ),
    ).toBe(2);
    expect(
      diasEmAberto(
        {
          criado_em: brt("2026-10-20T10:00").toISOString(),
          encerrado_em: brt("2026-10-21T22:00").toISOString(),
          aguardando_min: 0,
          aguardando_desde: null,
        },
        agora,
      ),
    ).toBe(1.5);
  });

  it("tempo de resolução e no prazo", () => {
    const criado_em = brt("2026-10-20T10:00").toISOString();
    expect(
      tempoDeResolucaoMin({
        criado_em,
        concluido_em: brt("2026-10-20T14:00").toISOString(),
        aguardando_min: 60,
      }),
    ).toBe(180);
    expect(
      tempoDeResolucaoMin({ criado_em, concluido_em: null, aguardando_min: 0 }),
    ).toBeNull();
    const prazo = brt("2026-10-21T18:00").toISOString();
    expect(
      noPrazo({ prazo, concluido_em: brt("2026-10-21T17:00").toISOString() }),
    ).toBe(true);
    expect(
      noPrazo({ prazo, concluido_em: brt("2026-10-22T08:00").toISOString() }),
    ).toBe(false);
    expect(noPrazo({ prazo: null, concluido_em: prazo })).toBeNull();
  });
});
