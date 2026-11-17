import { describe, expect, it } from "vitest";
import {
  limparTelefone,
  linkWhatsApp,
  MENSAGENS_PADRAO,
  mascaraTelefone,
  preencher,
} from "./whatsapp";

describe("máscara do telefone", () => {
  it("formata enquanto digita, com 55 quando falta o DDI", () => {
    expect(mascaraTelefone("")).toBe("");
    expect(mascaraTelefone("2")).toBe("+55 (2");
    expect(mascaraTelefone("+55 (22")).toBe("+55 (22");
    expect(mascaraTelefone("+55 (22) 9")).toBe("+55 (22) 9");
    expect(mascaraTelefone("+55 (22) 25221")).toBe("+55 (22) 2522-1");
    expect(mascaraTelefone("+55 (22) 2522-12345")).toBe("+55 (22) 25221-2345");
    expect(mascaraTelefone("22998765432")).toBe("+55 (22) 99876-5432");
    expect(mascaraTelefone("+5522998765432999")).toBe("+55 (22) 99876-5432");
    expect(mascaraTelefone("+55 (22) ")).toBe("+55 (22");
    expect(limparTelefone(mascaraTelefone("22998765432"))).toBe(
      "5522998765432",
    );
  });
});

describe("telefone", () => {
  it("regras do sistema atual", () => {
    expect(limparTelefone("(22) 99876-5432")).toBe("5522998765432");
    expect(limparTelefone("22 2522-1234")).toBe("552225221234");
    expect(limparTelefone("022998765432")).toBe("5522998765432");
    expect(limparTelefone("+55 22 99876-5432")).toBe("5522998765432");
    expect(limparTelefone("99876")).toBeNull();
    expect(limparTelefone("")).toBeNull();
  });

  it("link do wa.me", () => {
    expect(linkWhatsApp("(22) 99876-5432", "Olá, tudo bem?")).toBe(
      "https://wa.me/5522998765432?text=Ol%C3%A1%2C%20tudo%20bem%3F",
    );
    expect(linkWhatsApp(null, "Oi")).toBe("https://wa.me/?text=Oi");
    expect(linkWhatsApp("123", "Oi")).toBe("https://wa.me/?text=Oi");
  });
});

describe("modelos", () => {
  it("chave sem valor some", () => {
    expect(preencher("Olá, {{nome}}{{ sobrenome }}!", { nome: "Ana" })).toBe(
      "Olá, Ana!",
    );
  });

  it("O.S. no formato do sistema atual, com Nº, local e link", () => {
    const texto = preencher(MENSAGENS_PADRAO.os, {
      numero: 1234,
      tipo: "ELÉTRICA",
      status: "Em Andamento",
      data: "21/10/2026",
      local: "Bloco B - Loja 131",
      descricao: "Tomada sem energia no caixa da loja 131.",
      link: "https://exemplo/os/1234",
    });
    expect(texto).toBe(
      [
        "*ORDEM DE SERVIÇO*",
        "*Nº:* 1234",
        "*Tipo:* ELÉTRICA",
        "*Status:* Em Andamento",
        "*Data:* 21/10/2026",
        "*Local:* Bloco B - Loja 131",
        "*Descrição:*",
        "Tomada sem energia no caixa da loja 131.",
        "",
        "*Fotos e detalhes:* https://exemplo/os/1234",
      ].join("\n"),
    );
  });

  it("nenhum modelo padrão sobra com {{", () => {
    for (const modelo of Object.values(MENSAGENS_PADRAO))
      expect(preencher(modelo, {})).not.toContain("{{");
  });
});
