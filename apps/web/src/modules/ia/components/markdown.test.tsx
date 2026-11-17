import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { blocos, Markdown } from "./markdown";

describe("markdown da IA", () => {
  it("separa parágrafo, lista, tabela e código", () => {
    const b = blocos(
      [
        "**Resposta:** 12 leads.",
        "",
        "- um",
        "- dois",
        "",
        "| Mês | Leads |",
        "|---|---|",
        "| out | 12 |",
        "",
        "```grafico",
        '{"tipo":"colunas","titulo":"x","itens":[{"rotulo":"a","valor":1}]}',
        "```",
      ].join("\n"),
    );
    expect(b.map((x) => x.tipo)).toEqual(["p", "lista", "tabela", "codigo"]);
  });

  it("bloco de código ainda aberto (resposta chegando) fica marcado", () => {
    const [b] = blocos("```grafico\n{");
    expect(b).toMatchObject({ tipo: "codigo", aberto: true });
  });

  it("desenha link de tela, link externo e nunca HTML cru", () => {
    render(
      <MemoryRouter>
        <Markdown texto="Veja no [Painel](/sustentabilidade/painel), no [site](https://arp.com.br) e <script>alert(1)</script> [x](javascript:alert(1))" />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("link", { name: "Painel" }).getAttribute("href"),
    ).toBe("/sustentabilidade/painel");
    expect(screen.getByRole("link", { name: "site" }).getAttribute("rel")).toBe(
      "noreferrer noopener",
    );
    expect(screen.queryByRole("link", { name: "x" })).toBeNull();
    expect(document.querySelector("script")).toBeNull();
    expect(screen.getByText(/<script>/)).toBeTruthy();
  });

  it("tabela vira <table>", () => {
    render(
      <MemoryRouter>
        <Markdown texto={"| A | B |\n|---|---|\n| 1 | 2 |"} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByRole("cell", { name: "2" })).toBeTruthy();
  });
});
