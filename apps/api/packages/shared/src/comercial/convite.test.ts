import { describe, expect, it } from "vitest";
import { mensagemDoConvite } from "./convite";

describe("mensagem do convite", () => {
  it("troca {formulario} pelo nome e põe o link embaixo", () => {
    expect(
      mensagemDoConvite(
        "Olá, responda o *{formulario}* abaixo.",
        "CENSO 2027",
        "https://x/censo/abc",
      ),
    ).toBe("Olá, responda o *CENSO 2027* abaixo.\n\nhttps://x/censo/abc");
  });

  it("sem texto, só o link", () => {
    expect(mensagemDoConvite("  ", "Censo", "https://x")).toBe("https://x");
  });
});
