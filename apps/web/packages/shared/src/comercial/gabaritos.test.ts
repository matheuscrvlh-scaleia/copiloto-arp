import { describe, expect, it } from "vitest";
import {
  gabaritoDeImportacao,
  gabaritoDeMetas,
  lerGabaritoDeMetas,
} from "./gabaritos";
import { TIPOS_ORDEM } from "./importacao";

describe("gabaritos de importação", () => {
  it("cada tipo tem o cabeçalho que o leitor procura", () => {
    for (const t of TIPOS_ORDEM) {
      const [cab] = gabaritoDeImportacao(t).linhas;
      expect(cab?.length).toBeGreaterThan(2);
      // O Forms repete perguntas (sócios); os outros não repetem coluna.
      if (t !== "fichas") expect(new Set(cab).size).toBe(cab?.length);
    }
    // As 49 colunas do Forms: data e hora e as perguntas 1 a 48.
    expect(gabaritoDeImportacao("fichas").linhas[0]).toHaveLength(49);
  });
});

describe("gabarito de metas", () => {
  const metas = [
    { indicador: "comercial.leads", vigente_desde: "2026-01-01", meta: 30 },
  ];

  it("traz as metas já cadastradas e o código na coluna A", () => {
    const g = gabaritoDeMetas(2026, metas);
    expect(g.linhas[0]?.slice(0, 3)).toEqual(["Código", "Indicador", "jan/26"]);
    const leads = g.linhas.find((l) => l[0] === "leads");
    expect(leads?.[2]).toBe(30);
    expect(leads?.[3]).toBeNull();
  });

  it("lê de volta pelo código, pelo nome e em texto brasileiro", () => {
    const g = gabaritoDeMetas(2026, metas);
    const linhas = g.linhas.map((l) => [...l]);
    const fat = linhas.find((l) => l[0] === "faturamento");
    if (fat) fat[3] = "1.234,50";
    linhas.push(["", "% Ocupação", 96]);
    const r = lerGabaritoDeMetas(linhas, 2026);
    expect(r.valores.get("leads.1")).toBe(30);
    expect(r.valores.get("faturamento.2")).toBe(1234.5);
    expect(r.valores.get("ocupacao.1")).toBe(96);
    expect(r.avisos).toEqual([]);
  });

  it("avisa indicador desconhecido e célula que não é número", () => {
    const r = lerGabaritoDeMetas(
      [
        ["Código", "Indicador", "jan/26"],
        ["xyz", "Outro", 1],
        ["leads", "", "muitos"],
      ],
      2026,
    );
    expect(r.valores.size).toBe(0);
    expect(r.avisos).toHaveLength(2);
  });

  it("sem colunas de mês, explica", () => {
    expect(lerGabaritoDeMetas([["a", "b"]], 2026).avisos[0]).toMatch(/meses/);
  });
});
