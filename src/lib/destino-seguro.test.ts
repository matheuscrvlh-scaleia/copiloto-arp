import { describe, expect, it } from "vitest";
import { destinoSeguro } from "./destino-seguro";

describe("destinoSeguro", () => {
  it.each([
    ["/rh/jornada?mes=2026-09", "/rh/jornada?mes=2026-09"],
    ["/", "/"],
    ["//evil.com", "/"],
    ["/\\evil.com", "/"],
    ["https://evil.com", "/"],
    ["rh", "/"],
    ["", "/"],
    [null, "/"],
  ])("%s → %s", (entrada, esperado) => {
    expect(destinoSeguro(entrada)).toBe(esperado);
  });
});

describe("destinoSeguro com padrão", () => {
  it("sem destino (ou só '/') vai para a tela inicial", () => {
    expect(destinoSeguro("", "/gestao")).toBe("/gestao");
    expect(destinoSeguro("/", "/gestao")).toBe("/gestao");
    expect(destinoSeguro("//evil.com", "/gestao")).toBe("/gestao");
    expect(destinoSeguro("/rh/jornada", "/gestao")).toBe("/rh/jornada");
  });
});
