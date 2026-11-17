import { describe, expect, it } from "vitest";
import { separarPergunta } from "./confirmacao";

describe("separarPergunta", () => {
  it("pergunta vira título e o resto, explicação", () => {
    expect(
      separarPergunta(
        "Remover a jornada de Administração? Quem ela cobre passa a seguir o nível de cima.",
      ),
    ).toEqual({
      titulo: "Remover a jornada de Administração?",
      texto: "Quem ela cobre passa a seguir o nível de cima.",
    });
  });

  it("só a pergunta", () => {
    expect(separarPergunta("Remover VR de Fulano?")).toEqual({
      titulo: "Remover VR de Fulano?",
      texto: undefined,
    });
  });

  it("sem pergunta, tudo é título", () => {
    expect(separarPergunta("Isso apaga o lote.")).toEqual({
      titulo: "Isso apaga o lote.",
    });
  });
});
