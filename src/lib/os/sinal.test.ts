import { describe, expect, it } from "vitest";
import {
  type DadosDoAtivo,
  diasParado,
  FAIXAS_SINAL_PADRAO,
  sinalDoAtivo,
  tempoMedioEntreFalhasDias,
} from "./sinal";

const ativo = (a: Partial<DadosDoAtivo>): DadosDoAtivo => ({
  custo12m: 1000,
  valorReposicao: 10_000,
  corretivas12m: 0,
  compraData: "2024-10-23",
  vidaUtilAnos: 10,
  ...a,
});

const hoje = "2026-10-23";
const sinal = (a: Partial<DadosDoAtivo>) =>
  sinalDoAtivo(ativo(a), FAIXAS_SINAL_PADRAO, hoje);

describe("sinal de troca", () => {
  it("tudo baixo: manter", () => {
    const r = sinal({});
    expect(r.sinal).toBe("manter");
    expect(r.pesoPct).toBe(10);
    expect(r.idadePct).toBeCloseTo(20, 0);
  });

  it("peso: 30 e 60 ainda são avaliar, acima de 60 troca", () => {
    expect(sinal({ custo12m: 2999 }).criterios.peso).toBe("manter");
    expect(sinal({ custo12m: 3000 }).criterios.peso).toBe("avaliar");
    expect(sinal({ custo12m: 6000 }).criterios.peso).toBe("avaliar");
    expect(sinal({ custo12m: 6001 }).sinal).toBe("trocar");
  });

  it("corretivas: 3 e 4 avaliar, 5 troca", () => {
    expect(sinal({ corretivas12m: 2 }).criterios.corretivas).toBe("manter");
    expect(sinal({ corretivas12m: 4 }).sinal).toBe("avaliar");
    expect(sinal({ corretivas12m: 5 }).sinal).toBe("trocar");
  });

  it("idade: 80% avalia, 100% ainda avalia, acima troca", () => {
    expect(sinal({ compraData: "2018-10-23" }).criterios.idade).toBe("avaliar");
    expect(sinal({ compraData: "2016-11-01" }).criterios.idade).toBe("avaliar");
    expect(sinal({ compraData: "2015-01-01" }).sinal).toBe("trocar");
  });

  it("vale o pior dos três", () => {
    expect(sinal({ custo12m: 3500, corretivas12m: 6 }).sinal).toBe("trocar");
  });

  it("sem reposição, vida útil ou compra: incompleto, com o que deu", () => {
    const r = sinal({ valorReposicao: null, corretivas12m: 6 });
    expect(r.sinal).toBe("incompleto");
    expect(r.criterios).toEqual({
      peso: "sem_dado",
      corretivas: "trocar",
      idade: "manter",
    });
    expect(sinal({ vidaUtilAnos: null }).sinal).toBe("incompleto");
    expect(sinal({ compraData: null }).idadePct).toBeNull();
  });
});

describe("histórico do ativo", () => {
  it("tempo médio entre falhas", () => {
    expect(
      tempoMedioEntreFalhasDias(["2026-03-01", "2026-01-01", "2026-02-01"]),
    ).toBe(29.5);
    expect(tempoMedioEntreFalhasDias(["2026-01-01"])).toBeNull();
  });

  it("dias parado dentro da janela", () => {
    const agora = new Date("2026-10-23T12:00:00-03:00");
    const periodos = [
      {
        situacao: "parado" as const,
        desde: "2026-09-28T00:00:00-03:00",
        ate: "2026-10-03T00:00:00-03:00",
      },
      {
        situacao: "em_uso" as const,
        desde: "2026-10-03T00:00:00-03:00",
        ate: "2026-10-20T00:00:00-03:00",
      },
      {
        situacao: "em_manutencao" as const,
        desde: "2026-10-20T00:00:00-03:00",
        ate: null,
      },
    ];
    // Outubro: 2 dias parado + 3,5 em manutenção (até agora).
    expect(diasParado(periodos, "2026-10-01", "2026-10-31", agora)).toBe(5.5);
  });
});
