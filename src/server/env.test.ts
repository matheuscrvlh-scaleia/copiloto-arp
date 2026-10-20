import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("env", () => {
  it("variável vazia conta como não configurada", async () => {
    const { semVazios } = await import("./env");
    expect(semVazios({ A: "1", B: "", C: "  ", D: undefined })).toEqual({
      A: "1",
    });
  });

  it("integração vazia não impede as outras", async () => {
    vi.stubEnv("SECULLUM_USUARIO", "u");
    vi.stubEnv("SECULLUM_SENHA", "s");
    vi.stubEnv("SECULLUM_BANCO_ID", "1");
    vi.stubEnv("WPS_BASE_URL", "");
    vi.stubEnv("WPS_ESTACIONAMENTO_ID", "");
    vi.resetModules();
    const { required } = await import("./env");
    expect(
      required("Secullum", [
        "SECULLUM_USUARIO",
        "SECULLUM_SENHA",
        "SECULLUM_BANCO_ID",
      ]),
    ).toEqual({
      SECULLUM_USUARIO: "u",
      SECULLUM_SENHA: "s",
      SECULLUM_BANCO_ID: "1",
    });
    expect(() => required("WPS", ["WPS_BASE_URL"])).toThrow(
      /WPS não configurado/,
    );
    vi.unstubAllEnvs();
  });
});
