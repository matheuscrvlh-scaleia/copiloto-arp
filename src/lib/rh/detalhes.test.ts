import { describe, expect, it } from "vitest";
import type { ColaboradorQuadro, LinhaPonto } from "./calculos";
import {
  movimentoEntre,
  tabelaDeHorasPerdidas,
  tabelaDeSaidas,
  tabelaDoBanco,
  tabelaDoPonto,
  tabelaDoQuadro,
} from "./detalhes";

// Pessoas fictícias.
const ponto = (
  id: string,
  faltas: number,
  atrasos: number,
  saldo: number,
): LinhaPonto => ({
  colaborador_id: id,
  nome: `Pessoa ${id}`,
  matricula: null,
  departamento_id: "d1",
  departamento: "Administração",
  previstas_min: 6000,
  faltas_min: faltas,
  atrasos_min: atrasos,
  faltas_dias: faltas / 480,
  abonos_min: {},
  banco_saldo_min: saldo,
  banco_creditos_min: Math.max(saldo, 0),
  banco_debitos_min: Math.min(saldo, 0),
});

const pessoa = (
  id: string,
  admissao: string | null,
  desligamento: string | null = null,
  tipo: ColaboradorQuadro["tipo_turnover"] = null,
  motivo: string | null = null,
): ColaboradorQuadro => ({
  id,
  nome: `Pessoa ${id}`,
  matricula: Number(id),
  departamento_id: "d1",
  departamento: "Administração",
  admissao,
  desligamento,
  tipo_turnover: tipo,
  motivo_desligamento: motivo,
});

describe("tabelas do modal de detalhe", () => {
  it("ponto: do maior absenteísmo para o menor, com valor cru para ordenar", () => {
    const t = tabelaDoPonto([ponto("1", 0, 30, 0), ponto("2", 480, 0, 0)]);
    expect(t.linhas.map((l) => l.chave)).toEqual(["2", "1"]);
    expect(t.linhas[0]?.celulas.slice(2, 5)).toEqual(["8h00", "0h00", "8,0%"]);
    expect(t.linhas[0]?.ordem?.[2]).toBe(480);
  });

  it("banco: de quem mais deve para quem mais tem crédito", () => {
    const t = tabelaDoBanco([ponto("1", 0, 0, 90), ponto("2", 0, 0, -120)]);
    expect(t.linhas.map((l) => l.celulas[4])).toEqual(["-2h00", "+1h30"]);
    expect(t.colunas).toHaveLength(5);
  });

  it("banco em R$: coluna no fim só quando vem o valor de cada pessoa", () => {
    const t = tabelaDoBanco(
      [ponto("1", 0, 0, 90), ponto("2", 0, 0, -120)],
      undefined,
      new Map([["1", 22.5]]),
    );
    expect(t.colunas.at(-1)?.titulo).toBe("Saldo em R$");
    expect(t.linhas.map((l) => l.celulas.at(-1))).toEqual(["—", "R$ 22,50"]);
  });

  it("horas perdidas: só quem tem, e dias de falta só nas faltas", () => {
    const linhas = [ponto("1", 0, 30, 0), ponto("2", 960, 0, 0)];
    const faltas = tabelaDeHorasPerdidas(linhas, "faltas");
    const atrasos = tabelaDeHorasPerdidas(linhas, "atrasos");
    expect(faltas.linhas.map((l) => l.chave)).toEqual(["2"]);
    expect(faltas.colunas.map((c) => c.titulo)).toContain("Dias de falta");
    expect(atrasos.linhas.map((l) => l.chave)).toEqual(["1"]);
    expect(atrasos.colunas.map((c) => c.titulo)).not.toContain("Dias de falta");
  });

  it("quadro: tempo de casa até a data pedida", () => {
    const t = tabelaDoQuadro([pessoa("7", "2024-10-19")], "2026-10-19");
    expect(t.linhas[0]?.celulas).toEqual([
      "Pessoa 7",
      "7",
      "Administração",
      "—",
      "19/10/2024",
      "2 anos",
    ]);
  });

  it("saídas: motivo e tipo com os nomes do Copiloto", () => {
    const t = tabelaDeSaidas([
      pessoa("1", "2020-01-01", "2026-09-10", "voluntario", "pedido_demissao"),
      pessoa("2", "2020-01-01", "2026-09-12"),
    ]);
    expect(t.linhas.map((l) => l.celulas.slice(3))).toEqual([
      ["Pedido de demissão", "Voluntário (iniciativa do empregado)"],
      ["—", "Sem classificação"],
    ]);
  });

  it("movimento: quem entrou e quem saiu no intervalo", () => {
    const m = movimentoEntre(
      [
        pessoa("1", "2026-09-05"),
        pessoa("2", "2020-01-01", "2026-09-30"),
        pessoa("3", "2026-10-01"),
      ],
      "2026-09-01",
      "2026-09-30",
    );
    expect(m.admitidos.map((c) => c.id)).toEqual(["1"]);
    expect(m.desligados.map((c) => c.id)).toEqual(["2"]);
  });
});
