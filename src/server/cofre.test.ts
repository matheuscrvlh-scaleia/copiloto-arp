import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { cifrar, cofreConfigurado, decifrar } = await import("./cofre");

describe("cofre", () => {
  beforeEach(() => {
    vi.stubEnv("INTEGRACOES_CHAVE", randomBytes(32).toString("base64"));
  });

  it("cifra e decifra; o texto aberto não aparece", () => {
    const c = cifrar("senha-secreta", "secullum");
    expect(c).toMatch(/^v1\./);
    expect(c).not.toContain("senha-secreta");
    expect(decifrar(c, "secullum")).toBe("senha-secreta");
  });

  it("cada cifragem sai diferente (IV aleatório)", () => {
    expect(cifrar("x", "wps")).not.toBe(cifrar("x", "wps"));
  });

  it("não abre com outro contexto nem adulterado", () => {
    const c = cifrar("token", "wps");
    expect(() => decifrar(c, "secullum")).toThrow();
    const partes = c.split(".");
    partes[3] = Buffer.from("outro").toString("base64url");
    expect(() => decifrar(partes.join("."), "wps")).toThrow();
  });

  it("não abre com outra chave", () => {
    const c = cifrar("token", "wps");
    vi.stubEnv("INTEGRACOES_CHAVE", randomBytes(32).toString("base64"));
    expect(() => decifrar(c, "wps")).toThrow();
  });

  it("sem chave ou com chave curta, avisa", () => {
    vi.stubEnv("INTEGRACOES_CHAVE", "");
    expect(cofreConfigurado()).toBe(false);
    expect(() => cifrar("x", "wps")).toThrow(/INTEGRACOES_CHAVE/);
    vi.stubEnv("INTEGRACOES_CHAVE", randomBytes(16).toString("base64"));
    expect(() => cifrar("x", "wps")).toThrow(/32 bytes/);
  });
});
