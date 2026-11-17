import { describe, expect, it } from "vitest";
import {
  afetadosPeloBloqueio,
  horariosLivres,
  type RegrasAgenda,
} from "./agenda";

const regras: RegrasAgenda = {
  hora_inicio: "08:00",
  hora_fim: "12:00",
  duracao_min: 60,
  limite_por_dia: 3,
  dias_semana: [1, 2, 3, 4, 5],
};

const h = (s: string) => new Date(`${s}:00-03:00`);
const inicios = (xs: { inicio: Date }[]) => xs.map((x) => x.inicio.getTime());

// 2026-10-26 é segunda.
const base = {
  regras,
  data: "2026-10-26",
  ocupados: [],
  bloqueios: [],
  agora: h("2026-10-23T10:00"),
};

describe("horários livres", () => {
  it("divide o expediente pela duração", () => {
    expect(inicios(horariosLivres(base))).toEqual(
      ["08:00", "09:00", "10:00", "11:00"].map((x) =>
        h(`2026-10-26T${x}`).getTime(),
      ),
    );
  });

  it("dia que não atende: vazio", () => {
    expect(horariosLivres({ ...base, data: "2026-10-25" })).toEqual([]);
  });

  it("tira ocupado, bloqueado e o que já passou", () => {
    const livres = horariosLivres({
      ...base,
      agora: h("2026-10-26T08:30"),
      ocupados: [{ inicio: h("2026-10-26T09:00"), fim: h("2026-10-26T10:00") }],
      bloqueios: [
        { inicio: h("2026-10-26T11:30"), fim: h("2026-10-26T15:00") },
      ],
    });
    expect(inicios(livres)).toEqual([h("2026-10-26T10:00").getTime()]);
  });

  it("dia que já bateu o limite: vazio", () => {
    const ocupados = ["08:00", "09:00", "10:00"].map((x) => ({
      inicio: h(`2026-10-26T${x}`),
      fim: h(`2026-10-26T${x.replace(":00", ":59")}`),
    }));
    expect(horariosLivres({ ...base, ocupados })).toEqual([]);
    expect(
      horariosLivres({
        ...base,
        ocupados,
        regras: { ...regras, limite_por_dia: null },
      }).length,
    ).toBe(1);
  });
});

describe("bloqueio", () => {
  it("pega os agendamentos que cruzam o bloqueio", () => {
    const ags = [
      { id: "a", inicio: h("2026-10-26T08:00"), fim: h("2026-10-26T09:00") },
      { id: "b", inicio: h("2026-10-26T09:00"), fim: h("2026-10-26T10:00") },
      { id: "c", inicio: h("2026-10-26T10:00"), fim: h("2026-10-26T11:00") },
    ];
    const afetados = afetadosPeloBloqueio(ags, {
      inicio: h("2026-10-26T09:30"),
      fim: h("2026-10-26T12:00"),
    });
    expect(afetados.map((a) => a.id)).toEqual(["b", "c"]);
  });
});
