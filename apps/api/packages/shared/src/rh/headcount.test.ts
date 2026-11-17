import { describe, expect, it } from "vitest";
import type { ColaboradorQuadro } from "./calculos";
import {
  agrupar,
  emTitulo,
  maioresEOutros,
  ROTULO_CONTRATO,
  SEM_INFORMACAO,
} from "./headcount";

// Pessoas fictícias.
const pessoa = (
  id: string,
  cargo: string | null,
  tipo_contrato: string | null = "clt",
): ColaboradorQuadro => ({
  id,
  nome: `Pessoa ${id}`,
  matricula: null,
  departamento_id: "d1",
  departamento: "Administração",
  admissao: "2024-01-01",
  desligamento: null,
  tipo_turnover: null,
  cargo,
  tipo_contrato,
});

describe("headcount", () => {
  it("cargo em título, com conectores e algarismos romanos", () => {
    expect(emTitulo("AUXILIAR DE SERVIÇOS GERAIS II")).toBe(
      "Auxiliar de Serviços Gerais II",
    );
  });

  it("junta grafias com e sem acento e fica com a acentuada", () => {
    const g = agrupar(
      [
        pessoa("1", "AUXILIAR DE SERVICOS GERAIS"),
        pessoa("2", "AUXILIAR DE SERVIÇOS GERAIS"),
        pessoa("3", "ANALISTA"),
        pessoa("4", null),
      ],
      (c) => c.cargo,
    );
    expect(g.map((x) => [x.rotulo, x.pessoas.length])).toEqual([
      ["Auxiliar de Serviços Gerais", 2],
      ["Analista", 1],
      [SEM_INFORMACAO, 1],
    ]);
  });

  it("contrato com rótulo próprio", () => {
    const g = agrupar(
      [pessoa("1", null, "pro_labore"), pessoa("2", null, "clt")],
      (c) => c.tipo_contrato,
      (v) => ROTULO_CONTRATO[v] ?? v,
    );
    expect(g.map((x) => x.rotulo).sort()).toEqual(["CLT", "Pró-labore"]);
  });

  it("os maiores e o resto em Outros, sem perder ninguém", () => {
    const g = agrupar(
      ["A", "A", "A", "B", "B", "C", "D", "E"].map((c, i) =>
        pessoa(String(i), c),
      ),
      (c) => c.cargo,
    );
    const r = maioresEOutros(g, 2, "cargos");
    expect(r.map((x) => [x.rotulo, x.pessoas.length])).toEqual([
      ["A", 3],
      ["B", 2],
      ["Outros (3 cargos)", 3],
    ]);
    // Um só grupo sobrando não vira "Outros".
    expect(maioresEOutros(g, 4, "cargos")).toHaveLength(5);
  });
});
