import { describe, expect, it } from "vitest";
import {
  conteudoDosItens,
  conteudoDoTexto,
  diferenca,
  lerConteudo,
  linhasDoConteudo,
  mesmoConteudo,
  normalizarHex,
  paraJson,
  resumoMarca,
  textoDoConteudo,
} from "./marca";

describe("conteúdo dos blocos da marca", () => {
  it("lista: uma linha por item, explicação depois do travessão", () => {
    const r = conteudoDoTexto(
      "lista",
      "Humorada — Leve, sem piada pronta.\n\n  Confiante  \nPositiva - Olha o lado bom",
    );
    expect(r).toEqual({
      ok: true,
      conteudo: {
        tipo: "lista",
        itens: [
          { titulo: "Humorada", texto: "Leve, sem piada pronta." },
          { titulo: "Confiante" },
          { titulo: "Positiva", texto: "Olha o lado bom" },
        ],
      },
    });
  });

  it("lista vai e volta pelo texto do formulário sem mudar", () => {
    const c = lerConteudo("lista", {
      itens: [
        { titulo: "Empoderador", texto: "" },
        { titulo: "Mago", texto: "a — b" },
      ],
    });
    const volta = conteudoDoTexto("lista", textoDoConteudo(c));
    expect(volta.ok && mesmoConteudo(volta.conteudo, c)).toBe(true);
    // Explicação vazia não vai para o banco.
    expect(paraJson(c)).toEqual({
      itens: [{ titulo: "Empoderador" }, { titulo: "Mago", texto: "a — b" }],
    });
  });

  it("cores: valida e normaliza o HEX", () => {
    expect(normalizarHex("58c069")).toBe("#58C069");
    expect(normalizarHex("#abc")).toBe("#AABBCC");
    expect(normalizarHex("#12345G")).toBeNull();
    const r = conteudoDoTexto(
      "cores",
      "Verde Arp — #58c069 — Fundos e destaques",
    );
    expect(r).toEqual({
      ok: true,
      conteudo: {
        tipo: "cores",
        itens: [
          { nome: "Verde Arp", hex: "#58C069", uso: "Fundos e destaques" },
        ],
      },
    });
    const erro = conteudoDoTexto("cores", "Verde — #58C069\nPreto — preto");
    expect(erro.ok).toBe(false);
    expect(!erro.ok && erro.erro).toMatch(/^Linha 2/);
  });

  it("jsonb inválido vira vazio, sem quebrar a tela", () => {
    expect(lerConteudo("lista", { texto: "x" })).toEqual({
      tipo: "lista",
      itens: [],
    });
    expect(lerConteudo("texto", null)).toEqual({ tipo: "texto", texto: "" });
  });
});

describe("histórico: antes × depois", () => {
  it("mostra o que saiu e o que entrou, mantendo o resto", () => {
    const antes = linhasDoConteudo(
      lerConteudo("lista", {
        itens: [{ titulo: "Confiante" }, { titulo: "Humorada", texto: "" }],
      }),
    );
    const depois = linhasDoConteudo(
      lerConteudo("lista", {
        itens: [
          { titulo: "Confiante" },
          { titulo: "Humorada", texto: "Leve, sem piada pronta." },
        ],
      }),
    );
    expect(diferenca(antes, depois)).toEqual([
      { tipo: "igual", texto: "Confiante" },
      { tipo: "removido", texto: "Humorada" },
      { tipo: "incluido", texto: "Humorada — Leve, sem piada pronta." },
    ]);
    expect(diferenca([], ["a"])).toEqual([{ tipo: "incluido", texto: "a" }]);
  });
});

describe("resumo para o Painel", () => {
  it("conta os blocos vazios e os itens sem explicação", () => {
    const r = resumoMarca([
      {
        titulo: "Propósito",
        conteudo: lerConteudo("texto", { texto: "Conectar" }),
      },
      { titulo: "Valores", conteudo: lerConteudo("lista", { itens: [] }) },
      {
        titulo: "Tons",
        conteudo: lerConteudo("lista", {
          itens: [
            { titulo: "Humorada", texto: "" },
            { titulo: "Positiva", texto: "x" },
          ],
        }),
      },
    ]);
    expect(r).toEqual({
      blocos: 3,
      preenchidos: 2,
      vazios: ["Valores"],
      itensSemExplicacao: 1,
    });
  });
});

describe("arquivos de marca", () => {
  it("aceita só PDF, PNG, JPG, SVG e ZIP e limpa o nome", async () => {
    const { tipoDoArquivo, nomeSeguro, formatarTamanho } = await import(
      "./marca"
    );
    expect(tipoDoArquivo("Guia Rápido.PDF")).toBe("application/pdf");
    expect(tipoDoArquivo("logo.svg")).toBe("image/svg+xml");
    expect(tipoDoArquivo("planilha.xlsx")).toBeNull();
    expect(nomeSeguro("Rebranding Espaço Arp – Doc Final.pdf")).toBe(
      "rebranding-espaco-arp-doc-final.pdf",
    );
    expect(formatarTamanho(2.5 * 1024 * 1024)).toBe("2,5 MB");
  });
});

describe("itens repetidos", () => {
  it("não aceita o mesmo item duas vezes (o revisor contaria em dobro)", () => {
    const r = conteudoDoTexto("lista", "Shopping\nshopping");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erro).toMatch(/^Linha 2/);
    // Lista colada com marcador: o marcador sai.
    expect(conteudoDoTexto("lista", "- Shopping\n• Tem de tudo")).toEqual({
      ok: true,
      conteudo: {
        tipo: "lista",
        itens: [{ titulo: "Shopping" }, { titulo: "Tem de tudo" }],
      },
    });
  });
});

describe("lista editada item a item", () => {
  it("guarda nome e significado sem depender do travessão", () => {
    const json = JSON.stringify([
      { titulo: " Vivemos a rua ", texto: "Somos da rua — e ela é nossa." },
      { titulo: "", texto: "" },
      { titulo: "Herdamos coragem", texto: "" },
    ]);
    expect(conteudoDosItens(json)).toEqual({
      ok: true,
      conteudo: {
        tipo: "lista",
        itens: [
          { titulo: "Vivemos a rua", texto: "Somos da rua — e ela é nossa." },
          { titulo: "Herdamos coragem" },
        ],
      },
    });
  });

  it("aponta o item sem nome e o repetido", () => {
    const semNome = conteudoDosItens(
      JSON.stringify([{ titulo: "A" }, { titulo: "", texto: "só texto" }]),
    );
    expect(!semNome.ok && semNome.erro).toMatch(/^Item 2: falta o nome/);
    const repetido = conteudoDosItens(
      JSON.stringify([{ titulo: "Tom" }, { titulo: "tom" }]),
    );
    expect(!repetido.ok && repetido.erro).toMatch(/^Item 2/);
    expect(conteudoDosItens("{").ok).toBe(false);
  });
});
