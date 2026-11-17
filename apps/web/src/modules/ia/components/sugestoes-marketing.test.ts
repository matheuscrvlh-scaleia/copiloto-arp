import { describe, expect, it } from "vitest";
import { ehTelaDeMarketing } from "./sugestoes-marketing";

describe("sugestões de marketing", () => {
  it("só nas telas do Marketing", () => {
    expect(ehTelaDeMarketing("/marketing")).toBe(true);
    expect(ehTelaDeMarketing("/marketing/marca")).toBe(true);
    expect(ehTelaDeMarketing("/marketingx")).toBe(false);
    expect(ehTelaDeMarketing("/rh/marketing")).toBe(false);
  });
});
