import { tokenValido } from "@arp/shared/sustentabilidade/programas-link";
import { describe, expect, it } from "vitest";
import { confereToken, hashDoToken, novoToken } from "./parceiro-token";

// Veio de packages/shared (programas-regras.test.ts), junto com as funções.

describe("token do link do parceiro", () => {
  it("hash sha256 em hexa (o banco guarda só ele)", () => {
    expect(hashDoToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    const t = novoToken();
    expect(tokenValido(t)).toBe(true);
    expect(hashDoToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(confereToken(t, hashDoToken(t))).toBe(true);
    expect(confereToken(t, hashDoToken(novoToken()))).toBe(false);
  });

  it("formato inválido nem chega ao banco", () => {
    expect(confereToken("abc", hashDoToken("abc"))).toBe(false);
  });
});
