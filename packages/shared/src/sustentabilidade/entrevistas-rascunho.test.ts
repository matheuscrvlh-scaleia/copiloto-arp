import { describe, expect, it } from "vitest";
import {
  confirmarEnvio,
  escolherRascunho,
  estadoDoEnvio,
  lerRascunhoLocal,
  precisaEnviar,
  type RascunhoLocal,
  responder,
} from "./entrevistas-rascunho";

const base: RascunhoLocal = {
  chave: "k1",
  contratoId: "c1",
  versao: 2,
  respostas: {},
  secao: 0,
  alteradoEm: 1000,
  enviadoAte: null,
};

describe("rascunho no aparelho", () => {
  it("cada resposta marca pendente até o servidor confirmar", () => {
    const r1 = responder(base, "q7", "q7_pouco", 2000);
    expect(r1.respostas).toEqual({ q7: "q7_pouco" });
    expect(precisaEnviar(r1)).toBe(true);
    const r2 = confirmarEnvio(r1, r1.alteradoEm);
    expect(precisaEnviar(r2)).toBe(false);
  });

  it("resposta dada durante o envio continua pendente", () => {
    const r1 = responder(base, "q7", "q7_pouco", 2000);
    const r2 = responder(r1, "q8", 3, 2500);
    expect(precisaEnviar(confirmarEnvio(r2, r1.alteradoEm))).toBe(true);
  });

  it("o carimbo anda mesmo com o relógio voltando", () => {
    const r = responder(base, "q7", "q7_pouco", 10);
    expect(r.alteradoEm).toBe(1001);
  });

  it("apagar a resposta tira a chave", () => {
    const r = responder(responder(base, "q8", 3, 2000), "q8", undefined, 3000);
    expect(r.respostas).toEqual({});
  });

  it("reenviar a mesma versão não muda nada (idempotente)", () => {
    const r = confirmarEnvio(responder(base, "q8", 3, 2000), 2000);
    expect(confirmarEnvio(r, 2000)).toEqual(r);
    // Confirmação atrasada de uma versão antiga não volta o carimbo.
    expect(confirmarEnvio(r, 1500).enviadoAte).toBe(2000);
  });
});

describe("qual rascunho continuar", () => {
  const servidor = {
    chave: "k1",
    contratoId: "c1",
    versao: 2,
    respostas: { q7: "q7_muito" },
    alteradoEm: 5000,
  };

  it("mesma chave: o do aparelho", () => {
    expect(escolherRascunho(base, servidor)).toBe(base);
  });

  it("chave diferente: o mais recente", () => {
    const outro = { ...base, chave: "k2" };
    expect(escolherRascunho(outro, servidor)?.chave).toBe("k1");
    expect(
      escolherRascunho({ ...outro, alteradoEm: 9000 }, servidor)?.chave,
    ).toBe("k2");
  });

  it("só no servidor: começa dele, já enviado", () => {
    const r = escolherRascunho(null, servidor);
    expect(r?.enviadoAte).toBe(5000);
    expect(r && precisaEnviar(r)).toBe(false);
  });

  it("guardado inválido ou de outro contrato é ignorado", () => {
    expect(lerRascunhoLocal("{", "c1")).toBeNull();
    expect(lerRascunhoLocal(JSON.stringify(base), "c2")).toBeNull();
    expect(lerRascunhoLocal(JSON.stringify(base), "c1")).toEqual(base);
  });
});

describe("indicador", () => {
  it("Salvo, no aparelho, enviando", () => {
    const e = (x: Partial<Parameters<typeof estadoDoEnvio>[0]>) =>
      estadoDoEnvio({
        pendente: true,
        online: true,
        enviando: false,
        falhou: false,
        ...x,
      });
    expect(e({ pendente: false })).toBe("salvo");
    expect(e({ online: false })).toBe("aparelho");
    expect(e({ enviando: true })).toBe("enviando");
    expect(e({ falhou: true })).toBe("erro");
  });
});
