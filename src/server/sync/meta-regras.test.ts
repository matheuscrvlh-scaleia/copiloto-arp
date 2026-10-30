import { describe, expect, it } from "vitest";
import { diasDoInstagram, JANELA_META_DIAS, RELER_DIAS } from "./meta-regras";

describe("diasDoInstagram", () => {
  it("na primeira vez lê a janela inteira até ontem", () => {
    const dias = diasDoInstagram("2026-10-30", new Set());
    expect(dias).toHaveLength(JANELA_META_DIAS);
    expect(dias[0]).toBe("2026-10-29");
    expect(dias.at(-1)).toBe("2026-06-26");
  });

  it("depois, só os que faltam e os últimos dias de novo", () => {
    const lidos = new Set(diasDoInstagram("2026-10-29", new Set()));
    expect(diasDoInstagram("2026-10-30", lidos)).toEqual([
      "2026-10-29",
      "2026-10-28",
      "2026-10-27",
    ]);
    expect(RELER_DIAS).toBe(3);
  });
});
