import { describe, expect, it } from "vitest";
import { type DesafioDaSemana, ordenarDesafios, semanaDe } from "./semana";

describe("minha semana", () => {
  it("vai de segunda a domingo", () => {
    // 17/11/2026 é terça.
    expect(semanaDe("2026-11-17")).toEqual({
      de: "2026-11-16",
      ate: "2026-11-22",
    });
    // Domingo fica na semana que começou na segunda anterior.
    expect(semanaDe("2026-11-22")).toEqual({
      de: "2026-11-16",
      ate: "2026-11-22",
    });
    expect(semanaDe("2026-11-16").de).toBe("2026-11-16");
  });

  it("atrasados primeiro, depois por data; sem data no fim", () => {
    const d = (titulo: string, data: string | null, atrasado = false) =>
      ({
        grupo: "agenda",
        titulo,
        detalhe: "",
        data,
        atrasado,
        href: "/",
      }) satisfies DesafioDaSemana;
    expect(
      ordenarDesafios([
        d("c", null),
        d("b", "2026-11-20"),
        d("a", "2026-11-10", true),
        d("d", "2026-11-18"),
      ]).map((x) => x.titulo),
    ).toEqual(["a", "d", "b", "c"]);
  });
});
