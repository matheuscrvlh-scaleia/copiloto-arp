import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { lerEnv } from "./env";

const chave = (bytes = 32) => randomBytes(bytes).toString("base64");

const valida = () => ({
  SITE_URL: "https://arp.example.com/",
  DATABASE_URL: "postgres://arp_api:senha@db:5432/arp",
  JWT_CHAVE: chave(48),
  INTEGRACOES_CHAVE: chave(),
  ARQUIVOS_CHAVE: chave(),
});

describe("lerEnv", () => {
  it("aceita o mínimo e preenche os padrões", () => {
    const env = lerEnv(valida());
    expect(env).toMatchObject({
      NODE_ENV: "development",
      PORT: 3000,
      SITE_URL: "https://arp.example.com",
      AGENDADOR: true,
      COOKIES_SEGUROS: true,
      ARQUIVOS_DIR: "./dados/arquivos",
    });
    expect(env.PROXIES_CONFIAVEIS).toContain("172.16.0.0/12");
  });

  it("site em http (desenvolvimento): cookies sem Secure", () => {
    const env = lerEnv({ ...valida(), SITE_URL: "http://localhost:5173" });
    expect(env.COOKIES_SEGUROS).toBe(false);
  });

  it("AGENDADOR=0 desliga as rotinas", () => {
    expect(lerEnv({ ...valida(), AGENDADOR: "0" }).AGENDADOR).toBe(false);
  });

  it("diz qual variável falta ou está errada, sem mostrar o valor", () => {
    const curta = chave(16);
    let mensagem = "";
    try {
      lerEnv({ ...valida(), JWT_CHAVE: curta, DATABASE_URL: undefined });
    } catch (e) {
      mensagem = e instanceof Error ? e.message : "";
    }
    expect(mensagem).toContain("JWT_CHAVE");
    expect(mensagem).toContain("DATABASE_URL");
    expect(mensagem).not.toContain(curta);
  });

  it("chaves do cofre e dos arquivos precisam de exatamente 32 bytes", () => {
    expect(() => lerEnv({ ...valida(), INTEGRACOES_CHAVE: chave(31) })).toThrow(
      /INTEGRACOES_CHAVE/,
    );
    expect(() => lerEnv({ ...valida(), ARQUIVOS_CHAVE: "curta" })).toThrow(
      /ARQUIVOS_CHAVE/,
    );
  });

  it("em produção exige https e a pasta dos arquivos", () => {
    const producao = { ...valida(), NODE_ENV: "production" };
    expect(() => lerEnv(producao)).toThrow(/ARQUIVOS_DIR/);
    expect(() =>
      lerEnv({
        ...producao,
        ARQUIVOS_DIR: "/dados/arquivos",
        SITE_URL: "http://arp.example.com",
      }),
    ).toThrow(/SITE_URL: em produção precisa ser https/);
    expect(
      lerEnv({ ...producao, ARQUIVOS_DIR: "/dados/arquivos" }).NODE_ENV,
    ).toBe("production");
  });
});
