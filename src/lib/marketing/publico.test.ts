import { describe, expect, it } from "vitest";
import type { Passagem } from "./fontes";
import {
  fluxoPorDia,
  linhasDoPeriodo,
  linhasExportarFluxo,
  resumoPublico,
  totaisFluxo,
} from "./publico";

// Plano de testes do spec (4.10): ocupação máxima pelas vagas de Configurações,
// exportação sem placa e recorrência com a janela de Configurações.

const SEM_FILTRO = { diaSemana: null, soComEvento: false };

function passagem(placa: string, entrada: string, saida: string | null) {
  return { placa, entrada, saida, cancela: "Entrada" } satisfies Passagem;
}

describe("Ocupação máxima", () => {
  it("280 carros dentro às 20h com 350 vagas → 80,0%", () => {
    const ps = [
      // 280 entram entre 18h e 19h59 e saem depois das 21h.
      ...Array.from({ length: 280 }, (_, i) =>
        passagem(
          `AAA${i}`,
          `2026-10-24T${i % 2 ? "18" : "19"}:${String(i % 60).padStart(2, "0")}`,
          "2026-10-24T21:30",
        ),
      ),
      // 50 que já tinham saído antes das 18h.
      ...Array.from({ length: 50 }, (_, i) =>
        passagem(`BBB${i}`, "2026-10-24T10:00", "2026-10-24T12:00"),
      ),
    ];
    const fluxo = fluxoPorDia(ps, 30);
    const [l] = linhasDoPeriodo(
      fluxo,
      { de: "2026-10-24", ate: "2026-10-24" },
      350,
      new Map(),
      SEM_FILTRO,
    );
    expect(l?.dentroMax).toBe(280);
    expect(l?.ocupacaoPct?.toFixed(1)).toBe("80.0");
    expect(l?.entradas).toBe(330);
  });

  it("quem sai no mesmo minuto em que outro entra não conta duas vezes", () => {
    const fluxo = fluxoPorDia(
      [
        passagem("X1", "2026-10-24T10:00", "2026-10-24T11:00"),
        passagem("X2", "2026-10-24T11:00", "2026-10-24T12:00"),
      ],
      30,
    );
    expect(fluxo.get("2026-10-24")?.dentroMax).toBe(1);
  });
});

describe("Recorrência", () => {
  const ps = [
    passagem("ABC1D23", "2026-09-20T10:00", "2026-09-20T11:00"),
    passagem("ABC1D23", "2026-10-10T10:00", "2026-10-10T11:00"),
    passagem("XYZ9K87", "2026-09-01T10:00", "2026-09-01T11:00"),
    passagem("XYZ9K87", "2026-10-10T15:00", "2026-10-10T16:00"),
    passagem("NOV0A00", "2026-10-10T16:00", "2026-10-10T17:00"),
  ];

  it("conta a placa que entrou dentro da janela de Configurações", () => {
    // 30 dias: ABC (20 dias antes) volta; XYZ (39 dias antes) não.
    expect(fluxoPorDia(ps, 30).get("2026-10-10")?.voltaram).toBe(1);
    // 45 dias: as duas voltam.
    expect(fluxoPorDia(ps, 45).get("2026-10-10")?.voltaram).toBe(2);
    // 10 dias: nenhuma.
    expect(fluxoPorDia(ps, 10).get("2026-10-10")?.voltaram).toBe(0);
  });

  it("segunda entrada no mesmo dia não é volta", () => {
    const f = fluxoPorDia(
      [
        passagem("MES1M00", "2026-10-10T10:00", "2026-10-10T11:00"),
        passagem("MES1M00", "2026-10-10T15:00", "2026-10-10T16:00"),
      ],
      30,
    );
    expect(f.get("2026-10-10")?.voltaram).toBe(0);
  });

  it("Sem placas: exportar → nenhuma placa", () => {
    const fluxo = fluxoPorDia(ps, 30);
    const linhas = linhasDoPeriodo(
      fluxo,
      { de: "2026-09-01", ate: "2026-10-10" },
      350,
      new Map([["2026-10-10", ["Feira"]]]),
      SEM_FILTRO,
    );
    const texto = JSON.stringify([
      linhasExportarFluxo(linhas, totaisFluxo(linhas, 350)),
      linhas,
    ]);
    for (const p of ps) expect(texto).not.toContain(p.placa);
    expect(texto).toContain("Feira");
  });
});

describe("Resumo do Painel", () => {
  it("entradas e ocupação máxima do último fim de semana", () => {
    const r = resumoPublico(
      [
        passagem("A", "2026-10-24T10:00", "2026-10-24T12:00"),
        passagem("B", "2026-10-25T10:30", "2026-10-25T11:00"),
        passagem("C", "2026-10-25T10:40", "2026-10-25T11:30"),
        passagem("D", "2026-10-27T10:00", "2026-10-27T11:00"),
      ],
      { vagas: 4, janela_recorrencia_dias: 30 },
      "2026-10-29",
    );
    expect(r).toMatchObject({
      de: "2026-10-24",
      ate: "2026-10-25",
      entradas: 3,
      carrosDentroMax: 2,
      ocupacaoMaxima: 50,
    });
  });
});
