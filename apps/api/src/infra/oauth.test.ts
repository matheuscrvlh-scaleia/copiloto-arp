import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { aleatorio, desafioPkce, mesmoState } from "./oauth";

describe("state da autorização", () => {
  it("só vale o mesmo texto, e vazio nunca vale", () => {
    const s = aleatorio();
    expect(mesmoState(s, s)).toBe(true);
    expect(mesmoState(s, aleatorio())).toBe(false);
    expect(mesmoState(s, s.slice(1))).toBe(false);
    expect(mesmoState("", "")).toBe(false);
  });

  it("é base64url, sem ponto (o cookie junta state e verificador com ponto)", () => {
    expect(aleatorio()).toMatch(/^[\w-]{43}$/);
  });
});

describe("PKCE", () => {
  it("desafio é o SHA-256 do verificador em base64url, sem padding", () => {
    const v = aleatorio();
    const d = desafioPkce(v);
    expect(d).toBe(createHash("sha256").update(v).digest("base64url"));
    expect(d).toMatch(/^[\w-]{43}$/);
    expect(d).not.toBe(v);
  });
});
