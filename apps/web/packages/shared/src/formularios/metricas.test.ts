import { describe, expect, it } from "vitest";
import { type Campo, novoCampo } from "./campos";
import { haQuanto, metricasDasRespostas } from "./metricas";

// Métricas da tela de Respostas (ritmo, horários, completude).

const campo = (id: string, extra: Partial<Campo> = {}): Campo => ({
  ...novoCampo("texto"),
  id,
  ...extra,
});

// 17/11/2026 14:00 em Brasília (terça).
const agora = new Date("2026-11-17T17:00:00Z");

describe("metricasDasRespostas", () => {
  const campos = [
    campo("aaaaaa", { tipo: "sim_nao" }),
    campo("bbbbbb", {
      condicao: { campo: "aaaaaa", valores: ["sim"] },
    }),
  ];
  const registros = [
    // hoje 10h em Brasília: viu as duas, respondeu as duas
    {
      enviada_em: "2026-11-17T13:00:00Z",
      respostas: { aaaaaa: true, bbbbbb: "x" },
    },
    // 16/11 23h30 em Brasília (17/11 02:30 UTC): "Não" esconde a segunda
    { enviada_em: "2026-11-17T02:30:00Z", respostas: { aaaaaa: false } },
    // 08/11: viu as duas, respondeu uma
    { enviada_em: "2026-11-08T12:00:00Z", respostas: { aaaaaa: true } },
    // fora da janela de 30 dias
    {
      enviada_em: "2026-09-01T12:00:00Z",
      respostas: { aaaaaa: true, bbbbbb: "y" },
    },
  ];
  const m = metricasDasRespostas(campos, registros, agora);

  it("conta por dia no fuso de Brasília e acumula desde a primeira", () => {
    expect(m.total).toBe(4);
    expect(m.hoje).toBe(1);
    expect(m.porDia).toHaveLength(30);
    expect(m.porDia.at(-1)).toEqual({ dia: "2026-11-17", n: 1, acumulado: 4 });
    expect(m.porDia.at(-2)).toEqual({ dia: "2026-11-16", n: 1, acumulado: 3 });
    expect(m.porDia[0]?.acumulado).toBe(1);
    expect(m.diasComResposta).toBe(4);
    expect(m.primeira).toBe("2026-09-01T12:00:00.000Z");
    expect(m.ultima).toBe("2026-11-17T13:00:00.000Z");
  });

  it("separa esta semana da anterior e monta as semanas", () => {
    expect(m.semana).toBe(2);
    expect(m.semanaAnterior).toBe(1);
    expect(m.porSemana).toHaveLength(8);
    expect(m.porSemana.at(-1)).toEqual({
      de: "2026-11-11",
      ate: "2026-11-17",
      n: 2,
    });
  });

  it("põe cada resposta no dia da semana e na faixa de hora local", () => {
    expect(m.horarios[2]?.[3]).toBe(2); // ter, 09–12h (17/11 e 01/09)
    expect(m.horarios[1]?.[7]).toBe(1); // seg, 21–24h
  });

  it("mede a completude só nas perguntas que a pessoa viu", () => {
    expect(m.completas).toBe(3);
    expect(m.completude).toBeCloseTo((1 + 1 + 0.5 + 1) / 4);
    expect(m.porPergunta).toEqual([
      { id: "aaaaaa", viram: 4, responderam: 4 },
      { id: "bbbbbb", viram: 3, responderam: 2 },
    ]);
  });

  it("sem respostas, tudo zerado", () => {
    const v = metricasDasRespostas(campos, [], agora);
    expect(v.completude).toBe(0);
    expect(v.ultima).toBeNull();
    expect(v.porDia.every((d) => d.n === 0 && d.acumulado === 0)).toBe(true);
  });
});

describe("haQuanto", () => {
  it("fala o tempo em dias de Brasília", () => {
    expect(haQuanto("2026-11-17T16:30:00Z", agora)).toBe("agora há pouco");
    expect(haQuanto("2026-11-17T12:00:00Z", agora)).toBe("há 5 h");
    expect(haQuanto("2026-11-17T02:30:00Z", agora)).toBe("ontem");
    expect(haQuanto("2026-11-11T20:20:00Z", agora)).toBe("há 6 dias");
  });
});
