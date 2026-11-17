import { describe, expect, it } from "vitest";
import {
  aceiteVenceu,
  avisoDoPrazo,
  chaveDoAviso,
  confirmacaoParada,
  dataDaOcorrencia,
  datasACriar,
  destinoVenceu,
  lerRecorrencia,
  prazoDaOcorrencia,
  proximaDaSerie,
} from "./automacao";
import type { Calendario } from "./prazo";

const cal: Calendario = {
  feriados: new Set(["2026-11-02"]),
  diasUteis: [1, 2, 3, 4, 5],
  expedienteFim: "18:00",
};

// 2026-10-23 é sexta; 12:00 em Brasília.
const agora = new Date("2026-10-23T15:00:00Z");

describe("avisos de prazo", () => {
  it("vence em até N horas e venceu depois do prazo", () => {
    expect(
      avisoDoPrazo(
        { status: "aberto", prazo: "2026-10-24T10:00:00Z" },
        agora,
        24,
      ),
    ).toBe("vence");
    expect(
      avisoDoPrazo(
        { status: "em_andamento", prazo: "2026-10-23T14:59:00Z" },
        agora,
        24,
      ),
    ).toBe("venceu");
    expect(
      avisoDoPrazo(
        { status: "aberto", prazo: "2026-10-26T15:00:00Z" },
        agora,
        24,
      ),
    ).toBeNull();
  });

  it("parado, encerrado ou sem prazo não avisa", () => {
    const vencido = "2026-10-20T10:00:00Z";
    expect(
      avisoDoPrazo({ status: "aguardando", prazo: vencido }, agora, 24),
    ).toBeNull();
    expect(
      avisoDoPrazo({ status: "concluido", prazo: vencido }, agora, 24),
    ).toBeNull();
    expect(avisoDoPrazo({ status: "aberto", prazo: null }, agora, 24)).toBe(
      null,
    );
  });

  it("a chave muda quando o prazo muda", () => {
    const a = chaveDoAviso("vence", "x", "2026-10-24T10:00:00+00:00");
    expect(a).toBe("vence:x:2026-10-24T10:00:00.000Z");
    expect(chaveDoAviso("vence", "x", "2026-10-24T10:00:00.000Z")).toBe(a);
    expect(chaveDoAviso("vence", "x", "2026-10-25T10:00:00Z")).not.toBe(a);
  });

  it("destino com prazo próprio vencido e não concluído", () => {
    expect(
      destinoVenceu({ status: "aberto", prazo: "2026-10-22T21:00:00Z" }, agora),
    ).toBe(true);
    expect(
      destinoVenceu(
        { status: "concluido", prazo: "2026-10-22T21:00:00Z" },
        agora,
      ),
    ).toBe(false);
    expect(destinoVenceu({ status: "aberto", prazo: null }, agora)).toBe(false);
  });
});

describe("aceite e confirmação", () => {
  it("fecha depois de N dias úteis, no fim do expediente", () => {
    // Concluído na segunda 19/10: 3 dias úteis → quinta 22/10 18h.
    const concluido = "2026-10-19T13:00:00Z";
    expect(
      aceiteVenceu(concluido, 3, cal, new Date("2026-10-22T20:59:00Z")),
    ).toBe(false);
    expect(
      aceiteVenceu(concluido, 3, cal, new Date("2026-10-22T21:00:00Z")),
    ).toBe(true);
  });

  it("feriado não conta como dia útil", () => {
    // Sexta 30/10 + 1 dia útil pula o fim de semana e o feriado de 02/11.
    const concluido = "2026-10-30T13:00:00Z";
    expect(
      aceiteVenceu(concluido, 1, cal, new Date("2026-11-02T22:00:00Z")),
    ).toBe(false);
    expect(
      aceiteVenceu(concluido, 1, cal, new Date("2026-11-03T21:00:00Z")),
    ).toBe(true);
  });

  it("lembrete de confirmação vem antes do fechamento", () => {
    const concluido = "2026-10-20T13:00:00Z";
    expect(confirmacaoParada(concluido, 2, cal, agora)).toBe(true);
    expect(aceiteVenceu(concluido, 3, cal, agora)).toBe(false);
  });
});

describe("lembretes recorrentes", () => {
  it("lê o Repetir gravado e recusa o que não serve", () => {
    expect(
      lerRecorrencia({ frequencia: "semanal", dias_semana: [1, 3] }),
    ).toEqual({ frequencia: "semanal", dias_semana: [1, 3] });
    expect(lerRecorrencia({ frequencia: "anual" })).toBeNull();
    expect(lerRecorrencia(null)).toBeNull();
    expect(lerRecorrencia({ frequencia: "mensal", dia_mes: 40 })).toBeNull();
  });

  it("data da ocorrência: a da série, a do prazo ou a da abertura", () => {
    expect(
      dataDaOcorrencia({
        serie_data: "2026-10-05",
        prazo: null,
        criado_em: "2026-10-01T12:00:00Z",
      }),
    ).toBe("2026-10-05");
    // 01:00 UTC do dia 10 ainda é dia 09 em Brasília.
    expect(
      dataDaOcorrencia({
        serie_data: null,
        prazo: "2026-10-10T01:00:00Z",
        criado_em: "2026-10-01T12:00:00Z",
      }),
    ).toBe("2026-10-09");
    expect(
      dataDaOcorrencia({
        serie_data: null,
        prazo: null,
        criado_em: "2026-10-01T12:00:00Z",
      }),
    ).toBe("2026-10-01");
  });

  it("prazo da ocorrência é o fim do expediente", () => {
    expect(prazoDaOcorrencia("2026-10-26", cal).toISOString()).toBe(
      "2026-10-26T21:00:00.000Z",
    );
  });

  it("cria só o que cai dentro da antecedência", () => {
    const r = { frequencia: "semanal" as const, dias_semana: [1] };
    // Última segunda 19/10; hoje sexta 23/10; 3 dias à frente → 26/10.
    expect(datasACriar(r, "2026-10-19", "2026-10-23", 3)).toEqual([
      "2026-10-26",
    ]);
    expect(datasACriar(r, "2026-10-19", "2026-10-23", 2)).toEqual([]);
  });

  it("diária com antecedência cria os próximos dias de uma vez", () => {
    expect(
      datasACriar({ frequencia: "diaria" }, "2026-10-23", "2026-10-23", 3),
    ).toEqual(["2026-10-24", "2026-10-25", "2026-10-26"]);
  });

  it("depois de parada, não cria lembrete atrasado", () => {
    expect(
      datasACriar({ frequencia: "diaria" }, "2026-01-01", "2026-10-23", 1),
    ).toEqual(["2026-10-23", "2026-10-24"]);
  });

  it("respeita o fim da série", () => {
    expect(
      datasACriar(
        { frequencia: "diaria", fim: "2026-10-24" },
        "2026-10-23",
        "2026-10-23",
        5,
      ),
    ).toEqual(["2026-10-24"]);
  });

  it("próxima data para a tela", () => {
    const r = { frequencia: "mensal" as const, dia_mes: 5 };
    expect(proximaDaSerie(r, "2026-11-05", "2026-10-23")).toBe("2026-11-05");
    expect(proximaDaSerie(r, "2026-08-05", "2026-10-23")).toBe("2026-11-05");
    expect(
      proximaDaSerie(
        { frequencia: "diaria", fim: "2026-10-01" },
        "2026-10-01",
        "2026-10-23",
      ),
    ).toBeNull();
  });
});
