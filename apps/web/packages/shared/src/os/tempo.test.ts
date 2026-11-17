import { describe, expect, it } from "vitest";
import {
  deBrasilia,
  diaDaSemana,
  diasEntre,
  hojeEmBrasilia,
  horaDosMinutos,
  instante,
  minutosDoDia,
  paraBrasilia,
  somarDias,
  ultimoDiaDoMes,
} from "./tempo";

describe("horário de Brasília", () => {
  it("UTC−3 fixo, independente do fuso do servidor", () => {
    expect(paraBrasilia(new Date("2026-10-21T11:05:00Z"))).toEqual({
      data: "2026-10-21",
      hora: "08:05",
    });
    expect(deBrasilia("2026-10-21", "08:05").toISOString()).toBe(
      "2026-10-21T11:05:00.000Z",
    );
  });

  it("às 22h em Brasília o UTC já virou o dia, mas hoje ainda é hoje", () => {
    const agora = new Date("2026-10-22T01:30:00Z");
    expect(hojeEmBrasilia(agora)).toBe("2026-10-21");
  });

  it("contas com datas", () => {
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(somarDias("2026-03-01", -1)).toBe("2026-02-28");
    expect(diaDaSemana("2026-10-25")).toBe(0);
    expect(diasEntre("2026-10-01", "2026-10-31")).toBe(30);
    expect(ultimoDiaDoMes(2028, 2)).toBe(29);
    expect(minutosDoDia("08:30")).toBe(510);
    expect(horaDosMinutos(1500)).toBe("01:00");
  });

  it("data sozinha é o início do dia em Brasília", () => {
    expect(instante("2026-10-21").toISOString()).toBe(
      "2026-10-21T03:00:00.000Z",
    );
    expect(instante("2026-10-21T10:00:00+00:00").toISOString()).toBe(
      "2026-10-21T10:00:00.000Z",
    );
  });
});
