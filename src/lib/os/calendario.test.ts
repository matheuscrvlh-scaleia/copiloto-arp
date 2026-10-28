import { describe, expect, it } from "vitest";
import {
  datasDoPlano,
  diasEntre,
  gradeDoMes,
  gradeDoPeriodo,
  type ItemCalendario,
  inicioDaSemana,
  intervaloDaVisao,
  itensPorDia,
  MAX_DIAS_PERIODO,
  navegar,
  periodoEscolhido,
  prazoNoDia,
  rotuloDoDia,
  tituloDoIntervalo,
  tituloDoPeriodo,
} from "./calendario";

describe("calendário", () => {
  it("a semana começa na segunda", () => {
    expect(inicioDaSemana("2026-10-23")).toBe("2026-10-19");
    expect(inicioDaSemana("2026-10-25")).toBe("2026-10-19");
    expect(inicioDaSemana("2026-10-19")).toBe("2026-10-19");
  });

  it("período personalizado: padrão, invertido e cortado no máximo", () => {
    expect(periodoEscolhido(undefined, undefined, "2026-10-28")).toEqual({
      de: "2026-10-28",
      ate: "2026-11-03",
    });
    expect(periodoEscolhido("2026-11-10", "2026-11-01", "x")).toEqual({
      de: "2026-11-01",
      ate: "2026-11-10",
    });
    const longo = periodoEscolhido("2026-01-01", "2026-12-31", "x");
    expect(diasEntre(longo.de, longo.ate)).toBe(MAX_DIAS_PERIODO);
    const grade = gradeDoPeriodo("2026-10-28", "2026-11-03");
    expect(grade.map((s) => s[0])).toEqual(["2026-10-26", "2026-11-02"]);
    expect(tituloDoIntervalo("2026-10-28", "2026-11-03")).toBe(
      "28 de outubro a 3 de novembro de 2026",
    );
  });

  it("a grade do mês cobre semanas inteiras", () => {
    const grade = gradeDoMes("2026-10-23");
    expect(grade[0]?.[0]).toBe("2026-09-28");
    expect(grade.at(-1)?.[6]).toBe("2026-11-01");
    expect(grade.every((s) => s.length === 7)).toBe(true);
    expect(intervaloDaVisao("mes", "2026-10-05")).toEqual({
      de: "2026-09-28",
      ate: "2026-11-01",
    });
  });

  it("intervalo da semana e do dia", () => {
    expect(intervaloDaVisao("semana", "2026-10-23")).toEqual({
      de: "2026-10-19",
      ate: "2026-10-25",
    });
    expect(intervaloDaVisao("dia", "2026-10-23")).toEqual({
      de: "2026-10-23",
      ate: "2026-10-23",
    });
  });

  it("navega por mês, semana e dia", () => {
    expect(navegar("mes", "2026-12-15", 1)).toBe("2027-01-01");
    expect(navegar("mes", "2026-01-31", -1)).toBe("2025-12-01");
    expect(navegar("semana", "2026-10-23", -1)).toBe("2026-10-16");
    expect(navegar("dia", "2026-10-31", 1)).toBe("2026-11-01");
  });

  it("títulos do período", () => {
    expect(tituloDoPeriodo("mes", "2026-10-23")).toBe("outubro de 2026");
    expect(tituloDoPeriodo("semana", "2026-10-23")).toBe(
      "19 a 25 de outubro de 2026",
    );
    expect(tituloDoPeriodo("semana", "2026-10-29")).toBe(
      "26 de outubro a 1 de novembro de 2026",
    );
    expect(tituloDoPeriodo("dia", "2026-10-23")).toBe(
      "sexta, 23 de outubro de 2026",
    );
    expect(rotuloDoDia("2026-10-23")).toBe("sex, 23/10");
  });

  it("arrastar para outro dia mantém a hora de Brasília", () => {
    // 18h em Brasília = 21h UTC.
    expect(prazoNoDia("2026-10-23T21:00:00Z", "2026-10-27")).toBe(
      "2026-10-27T18:00",
    );
  });

  it("datas previstas do plano preventivo no intervalo", () => {
    expect(
      datasDoPlano(
        {
          proxima_data: "2026-10-10",
          frequencia_dias: null,
          frequencia_meses: 1,
        },
        "2026-10-15",
        "2027-01-15",
      ),
    ).toEqual(["2026-11-10", "2026-12-10", "2027-01-10"]);
    expect(
      datasDoPlano(
        {
          proxima_data: "2026-10-20",
          frequencia_dias: 7,
          frequencia_meses: null,
        },
        "2026-10-19",
        "2026-11-01",
      ),
    ).toEqual(["2026-10-20", "2026-10-27"]);
  });

  it("itens de cada dia: dia inteiro primeiro, depois pela hora", () => {
    const item = (p: Partial<ItemCalendario>): ItemCalendario => ({
      chave: p.titulo ?? "x",
      tipo: "prazo",
      dia: "2026-10-23",
      hora: null,
      quando: null,
      titulo: "x",
      detalhe: null,
      chamadoId: null,
      href: null,
      status: null,
      prazo: null,
      arrastavel: false,
      ...p,
    });
    const dias = itensPorDia([
      item({ titulo: "B", hora: "14:00" }),
      item({ titulo: "A", hora: "09:00" }),
      item({ titulo: "Plano" }),
      item({ titulo: "Outro dia", dia: "2026-10-24" }),
    ]);
    expect(dias.get("2026-10-23")?.map((i) => i.titulo)).toEqual([
      "Plano",
      "A",
      "B",
    ]);
    expect(dias.get("2026-10-24")).toHaveLength(1);
  });
});
