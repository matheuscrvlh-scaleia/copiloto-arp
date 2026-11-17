import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarApp } from "@/app";
import { acharFonte, type Fonte, montarCatalogo } from "./catalogo";
import { montarInstrucoes } from "./instrucoes";
import { INSTRUCOES_DE_MARKETING } from "./marketing";

// As instruções de marketing mandam a IA ler fontes pelo caminho: se uma
// rota mudar de nome, a IA passaria a pedir um caminho que não existe.

let app: FastifyInstance;
let fontes: Fonte[];

beforeAll(async () => {
  app = await criarApp();
  fontes = montarCatalogo(app.rotas);
});
afterAll(async () => {
  await app.close();
});

describe("IA ARP: marketing", () => {
  it("todo caminho citado nas instruções é uma fonte do catálogo", () => {
    const caminhos = [...INSTRUCOES_DE_MARKETING.matchAll(/`(\/[^`]+)`/g)].map(
      (m) => m[1] ?? "",
    );
    expect(caminhos.length).toBeGreaterThan(3);
    expect(caminhos.filter((c) => !acharFonte(fontes, c))).toEqual([]);
  });

  it("entra nas instruções antes das orientações da empresa", () => {
    const texto = montarInstrucoes("(catálogo)", "Fale de você.");
    const marketing = texto.indexOf("# Marketing:");
    expect(marketing).toBeGreaterThan(0);
    expect(marketing).toBeLessThan(texto.indexOf("# Orientações da empresa"));
  });
});
