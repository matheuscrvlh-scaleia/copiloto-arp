import { describe, expect, it } from "vitest";
import type { Colaborador } from "@/connectors/copiloto-rh/schemas";
import {
  type Existente,
  matriculaDoCopiloto,
  planejarCopiloto,
  tipoContratoDoCopiloto,
} from "./copiloto-rh-regras";

const copiloto = (c: Partial<Colaborador> & { id: string }): Colaborador => ({
  full_name: " Pessoa Exemplo ",
  status: "active",
  contract_type: "clt",
  hire_date: "2024-03-01",
  personal: { birth_date: "1990-01-02" },
  updated_at: "2026-10-20T00:00:00Z",
  ...c,
});

const existente = (e: Partial<Existente> & { id: string }): Existente => ({
  matricula: null,
  copiloto_id: null,
  tipo_contrato: null,
  ...e,
});

let n = 0;
const novoId = () => `novo-${++n}`;

describe("regras do copiloto rh", () => {
  it("matrícula só se for número; zeros à esquerda não importam", () => {
    expect(matriculaDoCopiloto("00123")).toBe(123);
    expect(matriculaDoCopiloto("A12")).toBeNull();
    expect(matriculaDoCopiloto(null)).toBeNull();
  });

  it("tipo de contrato pelos valores do Copiloto", () => {
    expect(tipoContratoDoCopiloto("clt")).toBe("clt");
    expect(tipoContratoDoCopiloto("socio")).toBe("pro_labore");
    expect(tipoContratoDoCopiloto("aprendiz")).toBe("aprendiz");
    expect(tipoContratoDoCopiloto("internship")).toBe("estagiario");
    expect(tipoContratoDoCopiloto("temporary")).toBeNull();
  });

  it("o Copiloto manda em nome, nascimento, contrato, admissão e desligamento", () => {
    const r = planejarCopiloto(
      [
        copiloto({
          id: "c1",
          code: "007",
          status: "terminated",
          termination_date: "2026-09-30",
          termination_reason: "pedido_demissao",
          termination_decision: "pediu_pra_sair",
        }),
      ],
      [existente({ id: "a", matricula: 7, tipo_contrato: "aprendiz" })],
      novoId,
    );
    expect(r.linhas).toEqual([
      {
        id: "a",
        copiloto_id: "c1",
        matricula: 7,
        nome: "Pessoa Exemplo",
        nascimento: "1990-01-02",
        admissao: "2024-03-01",
        desligamento: "2026-09-30",
        tipo_contrato: "clt",
        situacao_copiloto: "terminated",
        motivo_desligamento_copiloto: "pedido_demissao",
        decisao_desligamento_copiloto: "pediu_pra_sair",
      },
    ]);
    expect(r.novos).toBe(0);
    expect(r.avisos).toEqual([]);
  });

  it("já ligado: casa pelo id do Copiloto mesmo com matrícula diferente", () => {
    const r = planejarCopiloto(
      [copiloto({ id: "c1", code: "8" })],
      [existente({ id: "a", matricula: 99, copiloto_id: "c1" })],
      novoId,
    );
    expect(r.linhas[0]).toMatchObject({ id: "a", matricula: 99 });
  });

  it("sem par: cria, com a matrícula do Copiloto se estiver livre", () => {
    const r = planejarCopiloto(
      [
        copiloto({
          id: "c1",
          contract_type: "pj",
          compensation: { base_salary: 7000 },
        }),
        copiloto({ id: "c2", code: "5" }),
      ],
      [existente({ id: "a", matricula: 7 })],
      novoId,
    );
    expect(r.novos).toBe(2);
    expect(
      r.linhas.map((l) => [
        l.id.startsWith("novo-"),
        l.matricula,
        l.tipo_contrato,
      ]),
    ).toEqual([
      [true, null, "pj"],
      [true, 5, "clt"],
    ]);
    expect(r.avisos).toEqual([
      "2 colaborador(es) do Copiloto criado(s) no Centralizador (sem par pela matrícula)",
    ]);
  });

  it("salário só do PJ; no protótipo, R$ 2.000,00; sem Salário, avisa", () => {
    const pessoas = [
      copiloto({ id: "c1", code: "1", compensation: { base_salary: 3000 } }),
      copiloto({
        id: "c2",
        code: "2",
        contract_type: "pj",
        compensation: { base_salary: 7000 },
      }),
      copiloto({ id: "c3", code: "3", contract_type: "pj" }),
    ];
    const existentes = [
      existente({ id: "a", matricula: 1 }),
      existente({ id: "b", matricula: 2 }),
      existente({ id: "c", matricula: 3 }),
    ];
    const real = planejarCopiloto(pessoas, existentes, novoId, false);
    expect(real.valoresPj).toEqual([{ colaborador_id: "b", valor: 7000 }]);
    expect(real.avisos).toEqual([
      "matrícula 3: PJ sem Salário no Copiloto (custo como valor não informado)",
    ]);
    expect(planejarCopiloto(pessoas, existentes, novoId).valoresPj).toEqual([
      { colaborador_id: "b", valor: 2000 },
    ]);
  });

  it("matrícula já ligada a outra pessoa do Copiloto: cria sem matrícula", () => {
    const r = planejarCopiloto(
      [copiloto({ id: "c2", code: "7" })],
      [existente({ id: "a", matricula: 7, copiloto_id: "c1" })],
      novoId,
    );
    expect(r.linhas[0]).toMatchObject({ matricula: null, copiloto_id: "c2" });
    expect(r.avisos[0]).toMatch(/matrícula 7: já usada/);
  });

  it("dois do Copiloto com a mesma matrícula: só o primeiro liga", () => {
    const r = planejarCopiloto(
      [copiloto({ id: "c1", code: "7" }), copiloto({ id: "c2", code: "07" })],
      [existente({ id: "a", matricula: 7 })],
      novoId,
    );
    expect(r.linhas.map((l) => l.copiloto_id)).toEqual(["c1", "c2"]);
    expect(r.linhas[1]?.matricula).toBeNull();
  });

  it("avisa o que falta, sem nome nem data no texto", () => {
    const r = planejarCopiloto(
      [
        copiloto({
          id: "c1",
          code: "7",
          contract_type: "temporary",
          personal: null,
          hire_date: "2025-01-10",
          termination_date: "2024-12-01",
        }),
      ],
      [existente({ id: "a", matricula: 7, tipo_contrato: "clt" })],
      novoId,
    );
    expect(r.linhas[0]).toMatchObject({
      tipo_contrato: "clt",
      nascimento: null,
      desligamento: null,
    });
    expect(r.avisos).toEqual([
      'matrícula 7: tipo de contrato "temporary" do Copiloto sem equivalente; ficou o anterior',
      "matrícula 7: sem data de nascimento no Copiloto",
      "matrícula 7: desligamento antes da admissão no Copiloto; desligamento ignorado",
    ]);
    expect(r.avisos.join()).not.toMatch(/Pessoa|2025|2024/);
  });
});
