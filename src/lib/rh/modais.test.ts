import { describe, expect, it } from "vitest";
import type { ColaboradorQuadro, LinhaPonto } from "./calculos";
import type { CustoIndividual, TotaisCusto } from "./custo";
import {
  origemDoAbsenteismo,
  origemDoBanco,
  origemDoComponente,
  origemDoCustoSobreReceita,
  origemDoQuadro,
} from "./modais";

const colab = (c: Partial<ColaboradorQuadro>): ColaboradorQuadro => ({
  id: c.nome ?? "x",
  nome: "X",
  matricula: 1,
  departamento_id: "adm",
  departamento: "Administração",
  admissao: "2025-01-10",
  desligamento: null,
  tipo_turnover: null,
  ...c,
});

const ponto = (p: Partial<LinhaPonto>): LinhaPonto => ({
  colaborador_id: p.nome ?? "x",
  nome: "X",
  matricula: 1,
  departamento_id: "adm",
  departamento: "Administração",
  previstas_min: 10_000,
  faltas_min: 0,
  atrasos_min: 0,
  faltas_dias: 0,
  abonos_min: {},
  banco_saldo_min: 0,
  banco_creditos_min: 0,
  banco_debitos_min: 0,
  ...p,
});

const nomesNas = (d: { tabelas: { linhas: { celulas: string[] }[] }[] }) =>
  d.tabelas.flatMap((t) => t.linhas.map((l) => l.celulas[0]));

describe("modal do quadro", () => {
  const todos = [
    colab({ nome: "Ana" }),
    colab({ nome: "Bia", admissao: "2026-10-05" }),
    colab({
      nome: "Caio",
      desligamento: "2026-10-12",
      tipo_turnover: "voluntario",
    }),
  ];

  it("diz de onde vem e põe a lista do foco primeiro", () => {
    const d = origemDoQuadro(todos, "2026-10-01", "2026-10-19", {
      foco: "admissoes",
      pessoas: true,
    });
    expect(d.fontes?.[0]?.valor).toMatch(/Copiloto RH/);
    expect(d.tabelas[0]?.titulo).toBe("Admitidos em 01/10/2026 a 19/10/2026");
    expect(d.tabelas[0]?.linhas.map((l) => l.celulas[0])).toEqual(["Bia"]);
    expect(d.resumo).toContainEqual({ rotulo: "Ativos no fim", valor: "2" });
  });

  it("sem permissão de ver pessoas, só somas por setor", () => {
    const d = origemDoQuadro(todos, "2026-10-01", "2026-10-19", {
      pessoas: false,
    });
    expect(nomesNas(d)).not.toContain("Ana");
    expect(d.tabelas[0]?.linhas[0]?.celulas).toEqual(["Administração", "2"]);
  });

  it("turnover: números do Copiloto no resumo; sem eles, diz por quê", () => {
    const numeros = {
      de: "2026-10-01",
      ate: "2026-10-19",
      taxas: [
        { tipo: "geral" as const, rotulo: "Turnover Geral", valor: 50 },
        {
          tipo: "voluntario" as const,
          rotulo: "Turnover Voluntário",
          valor: 50,
        },
        {
          tipo: "involuntario" as const,
          rotulo: "Turnover Involuntário",
          valor: 0,
        },
      ],
      turnover: 50,
      inicio: 2,
      fim: 2,
      admissoes: 1,
      desligamentos: 1,
      desligamentosPorTipo: { voluntario: 1, involuntario: 0, acordo: 0 },
    };
    const d = origemDoQuadro(todos, "2026-10-01", "2026-10-19", {
      foco: "turnover",
      pessoas: true,
      numeros,
    });
    expect(d.fontes?.find((f) => f.rotulo === "Regra")?.valor).toMatch(
      /Calculado pelo Copiloto RH/,
    );
    expect(d.resumo?.map((r) => [r.rotulo, r.valor])).toEqual([
      ["Ativos no fim", "2"],
      ["Admissões", "1"],
      ["Desligamentos", "1"],
      ["Turnover Geral", "50,0%"],
      ["Turnover Voluntário", "50,0%"],
      ["Turnover Involuntário", "0,0%"],
    ]);

    const fora = origemDoQuadro(todos, "2026-10-01", "2026-10-19", {
      foco: "turnover",
      pessoas: true,
      semTurnover: "Copiloto RH indisponível",
    });
    // Sem o Copiloto não há taxa calculada aqui: só o aviso.
    expect(fora.resumo).toContainEqual({ rotulo: "Turnover", valor: "—" });
    expect(fora.fontes).toContainEqual({
      rotulo: "Turnover",
      valor: "Copiloto RH indisponível",
    });
  });
});

describe("modais do ponto", () => {
  const linhas = [
    ponto({ nome: "Ana", faltas_min: 480, banco_saldo_min: 120 }),
    ponto({ nome: "Bia", atrasos_min: 30, banco_saldo_min: 600 }),
    ponto({ nome: "Caio", banco_saldo_min: -60 }),
  ];
  const o = { mes: "2026-10-01", ate: "2026-10-19", pessoas: true };

  it("absenteísmo: fórmula, setor e pessoas só com permissão", () => {
    const com = origemDoAbsenteismo(linhas, o);
    expect(com.fontes?.find((f) => f.rotulo === "Fórmula")?.valor).toMatch(
      /faltas \+ atrasos/,
    );
    expect(com.tabelas.map((t) => t.titulo)).toEqual([
      "Por setor",
      "Por pessoa",
    ]);
    const sem = origemDoAbsenteismo(linhas, { ...o, pessoas: false });
    expect(sem.tabelas.map((t) => t.titulo)).toEqual(["Por setor"]);
  });

  it("banco positivo: só quem tem crédito, do maior para o menor, com R$", () => {
    const d = origemDoBanco(linhas, {
      ...o,
      soPositivo: true,
      reais: {
        valor: 150,
        folha: "2026-07-01",
        adicional: 50,
        porDepartamento: new Map([["adm", 150]]),
      },
    });
    expect(d.tabelas[1]?.linhas.map((l) => l.celulas[0])).toEqual([
      "Bia",
      "Ana",
    ]);
    expect(d.resumo).toContainEqual({
      rotulo: "Positivo em R$",
      valor: "R$ 150",
    });
    expect(d.fontes?.find((f) => f.rotulo === "Valor em R$")?.valor).toMatch(
      /jul\/2026.*50%/,
    );
  });
});

describe("modais do custo", () => {
  const t: TotaisCusto = {
    colaboradores: 2,
    remuneracao: 4000,
    encargos: 1352,
    provisoes: 1200,
    beneficios: 0,
    rescisao: 0,
    reembolsos: 0,
    custo_total: 6552,
    sem_valor: 0,
  };
  const pessoa = (nome: string, encargos: number): CustoIndividual => ({
    colaborador_id: nome,
    nome,
    matricula: 1,
    departamento_id: "adm",
    departamento: "Administração",
    cargo: "Analista",
    tipo_contrato: "clt",
    valor_informado: true,
    remuneracao: 2000,
    encargos,
    provisoes: 600,
    beneficios: 0,
    rescisao: 0,
    custo_total: 2600 + encargos,
    custo_hora: null,
    salario_hora: null,
    jornada_min: null,
    memoria: { linhas: [], pendencias: [] },
  });
  const o = {
    competencia: "2026-07-01",
    ficticia: true,
    porSetor: [{ nome: "Administração", totais: t }],
  };

  it("componente: regra, % da remuneração e pessoas só com permissão", () => {
    const sem = origemDoComponente("encargos", t, o);
    expect(sem.resumo).toContainEqual({
      rotulo: "% da remuneração",
      valor: "33,8%",
    });
    expect(sem.fontes?.[0]?.valor).toMatch(/protótipo/);
    expect(sem.tabelas).toHaveLength(1);

    const com = origemDoComponente("encargos", t, {
      ...o,
      pessoas: [pessoa("Ana", 600), pessoa("Bia", 752)],
    });
    expect(com.tabelas[1]?.linhas.map((l) => l.celulas[0])).toEqual([
      "Bia",
      "Ana",
    ]);
  });

  it("% sobre a receita mostra que falta o faturamento", () => {
    const d = origemDoCustoSobreReceita(t, null, {
      competencia: "2026-07-01",
      ficticia: false,
    });
    expect(d.resumo).toContainEqual({
      rotulo: "Faturamento bruto",
      valor: "Pendente",
    });
    expect(d.fontes?.find((f) => f.rotulo === "Faturamento")?.valor).toMatch(
      /pendente/,
    );
  });
});
