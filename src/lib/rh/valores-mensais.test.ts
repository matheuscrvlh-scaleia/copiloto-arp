import { describe, expect, it } from "vitest";
import { valorLancadoNoMes } from "./custo";
import { ErroPlanilha } from "./plano";
import {
  casarPorNome,
  chaveDoNome,
  lerValoresDaPlanilha,
} from "./valores-mensais";

// Nomes e CPFs inventados.
const LANCADOS = [
  { competencia: "2026-03-01", valor: 350 },
  { competencia: "2026-05-01", valor: 420 },
];

describe("valor do mês lançado", () => {
  it("usa o valor lançado na competência", () => {
    expect(valorLancadoNoMes(LANCADOS, "2026-03-01")).toEqual({
      valor: 350,
      de: "2026-03-01",
    });
  });

  it("sem lançamento no mês, repete o último anterior e avisa", () => {
    expect(valorLancadoNoMes(LANCADOS, "2026-04-01")).toEqual({
      valor: 350,
      de: "2026-03-01",
      aviso: "Valor de mar/2026 repetido – sem lançamento em abr/2026",
    });
    expect(valorLancadoNoMes(LANCADOS, "2026-08-01").valor).toBe(420);
  });

  it("lançamento posterior não muda os meses anteriores", () => {
    const depois = [...LANCADOS, { competencia: "2026-04-01", valor: 999 }];
    expect(valorLancadoNoMes(depois, "2026-03-01").valor).toBe(350);
    expect(valorLancadoNoMes(depois, "2026-04-01").valor).toBe(999);
  });

  it("sem nenhum lançamento até o mês, fica pendente", () => {
    expect(valorLancadoNoMes(LANCADOS, "2026-02-01")).toEqual({
      valor: null,
      pendencia: "sem valor lançado até fev/2026",
    });
  });
});

describe("planilha de valores do mês", () => {
  it("acha o cabeçalho e lê nome e valor; o CPF é descartado", () => {
    const r = lerValoresDaPlanilha([
      ["Valores de VR"],
      ["CPF", "Nome", "Valor (R$)"],
      ["000.000.000-00", "Ana Teste", 350.5],
      ["111.111.111-11", "Bruno Exemplo", "R$ 1.200,00"],
      [null, null, null],
      ["222.222.222-22", "Carla Modelo", "abc"],
    ]);
    expect(r.linhas).toEqual([
      { linha: 3, nome: "Ana Teste", valor: 350.5 },
      { linha: 4, nome: "Bruno Exemplo", valor: 1200 },
    ]);
    expect(JSON.stringify(r.linhas)).not.toContain("000.000");
    expect(r.avisos).toEqual([
      "Linha 6 (Carla Modelo): valor inválido; ficou de fora.",
    ]);
  });

  it("sem as colunas nome e valor, recusa", () => {
    expect(() => lerValoresDaPlanilha([["CPF", "Quantia"]])).toThrow(
      ErroPlanilha,
    );
  });

  it("liga pelo nome sem acento nem maiúsculas; avisa o que não liga", () => {
    const pessoas = [
      { colaborador_id: "a", nome: "Ana Téste" },
      { colaborador_id: "b", nome: "Bruno Exemplo" },
      { colaborador_id: "c1", nome: "Davi Igual" },
      { colaborador_id: "c2", nome: "Davi Igual" },
    ];
    const r = casarPorNome(
      [
        { linha: 2, nome: "ANA  TESTE", valor: 10 },
        { linha: 3, nome: "Bruno Exemplo", valor: 20 },
        { linha: 4, nome: "bruno exemplo", valor: 30 },
        { linha: 5, nome: "Davi Igual", valor: 40 },
        { linha: 6, nome: "Fora da Lista", valor: 50 },
      ],
      pessoas,
    );
    expect([...r.valores]).toEqual([
      ["a", 10],
      ["b", 30],
    ]);
    expect(r.naoEncontrados).toEqual(["Fora da Lista"]);
    expect(r.avisos).toHaveLength(2);
    expect(chaveDoNome(" José  da Silva ")).toBe("jose da silva");
  });
});
