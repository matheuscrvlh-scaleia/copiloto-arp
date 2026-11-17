import { parametrosDosFiltros } from "@arp/shared/contratos/casca";
import { describe, expect, it } from "vitest";

// Toda tela que lembra filtros diz o próprio nome (`useFiltros...("nome")`
// para ler, `tela="nome"` na barra para gravar), e a API só aceita o que o
// contrato aceita. Nome fora do padrão dá 400 e os filtros não ficam.

const fontes = import.meta.glob<string>("../**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
});

const NOMES = [
  // (modulo, tela) no hook comum; (tela, ...) nos de cada módulo.
  /\buseFiltrosLembrados\(\s*"[a-z]+",\s*"([^"]+)"/g,
  /\buseFiltros(?:Com|Mkt|Op|Su)\(\s*"([^"]+)"/g,
  /\btela="([^"]+)"/g,
];

describe("filtros lembrados: nomes das telas", () => {
  const usados = new Map<string, string>();
  for (const [arquivo, texto] of Object.entries(fontes)) {
    if (arquivo.includes(".test.")) continue;
    for (const padrao of NOMES)
      for (const [, nome] of texto.matchAll(padrao))
        if (nome) usados.set(nome, arquivo);
  }

  it("acha as telas (o teste não está olhando para o vazio)", () => {
    expect(usados.size).toBeGreaterThan(25);
    expect(usados.has("entrevistas-respostas")).toBe(true);
    expect(usados.has("entrevistas-movimentos")).toBe(true);
    expect(usados.has("agua_extrato")).toBe(true);
  });

  it("todo nome passa no contrato da API", () => {
    const recusados = [...usados].filter(
      ([tela]) => !parametrosDosFiltros.shape.tela.safeParse(tela).success,
    );
    expect(recusados).toEqual([]);
  });
});
