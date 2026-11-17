import { describe, expect, it } from "vitest";
import { parametrosDosFiltros } from "./casca";

const aceita = (tela: string) =>
  parametrosDosFiltros.safeParse({ modulo: "sustentabilidade", tela }).success;

describe("filtros lembrados: nome da tela", () => {
  it("aceita os nomes das telas, com _ ou - entre as palavras", () => {
    for (const tela of [
      "painel",
      "agua_extrato",
      "reputacao_benchmark",
      "entrevistas-respostas",
      "entrevistas-movimentos",
    ])
      expect(aceita(tela), tela).toBe(true);
  });

  it("recusa o que poderia montar outra chave em core.preferencias", () => {
    for (const tela of [
      "",
      "Tela",
      "tela1",
      "a.b",
      "a/b",
      "a b",
      "-a",
      "a-",
      "_a",
      "a__b",
      "a".repeat(61),
    ])
      expect(aceita(tela), tela).toBe(false);
  });

  it("recusa módulo sem filtros lembrados", () => {
    expect(
      parametrosDosFiltros.safeParse({ modulo: "financeiro", tela: "painel" })
        .success,
    ).toBe(false);
  });
});
