import { describe, expect, it } from "vitest";
import {
  andamentoDosAvisos,
  type CustoDoPainel,
  type DestinoDoPainel,
  minutosPorChamado,
  minutosPorTecnico,
  normalizar,
  notasDosFornecedores,
  ocupacaoDaAgenda,
  type SessaoDoPainel,
  slugDoSetor,
  somarCustos,
} from "./indicadores-setor";

const brt = (s: string) => new Date(`${s}-03:00`);
const iso = (s: string) => brt(s).toISOString();

function sessao(p: Partial<SessaoDoPainel>): SessaoDoPainel {
  return {
    chamado_id: "os1",
    data: "2026-10-20",
    inicio: "08:00",
    fim: "12:00",
    almoco_inicio: null,
    almoco_fim: null,
    tecnicos: ["ana"],
    ...p,
  };
}

describe("nomes", () => {
  it("acha setor e categoria sem acento e gera o endereço", () => {
    expect(normalizar(" Operações ")).toBe("operacoes");
    expect(slugDoSetor("Gestão & Projetos")).toBe("gestao-projetos");
  });
});

describe("minutos por técnico", () => {
  const tecnicos = [
    { id: "ana", nome: "Ana", desligado_em: null },
    { id: "beto", nome: "Beto", desligado_em: "2026-10-15" },
  ];

  it("soma por técnico, minuto-homem e respeita o desligamento", () => {
    const r = minutosPorTecnico(
      [
        sessao({ tecnicos: ["ana", "beto"], data: "2026-10-10" }),
        sessao({
          chamado_id: "os2",
          tecnicos: ["ana", "beto"],
          data: "2026-10-16",
          fim: "14:00",
          almoco_inicio: "12:00",
          almoco_fim: "13:00",
        }),
        sessao({ data: "2026-09-30" }),
      ],
      tecnicos,
      "2026-10-01",
      "2026-10-31",
    );
    expect(r.porTecnico.map((t) => [t.tecnico.id, t.minutos])).toEqual([
      ["ana", 540],
      ["beto", 240],
    ]);
    expect(r.porTecnico[0]?.chamados).toEqual(["os1", "os2"]);
    expect(r.minutos).toBe(540);
    expect(r.minutoHomem).toBe(780);
  });

  it("minutos de cada OS", () => {
    const m = minutosPorChamado([
      sessao({}),
      sessao({ inicio: "13:00", fim: "14:30" }),
      sessao({ chamado_id: "os2" }),
    ]);
    expect(m.get("os1")).toBe(330);
    expect(m.get("os2")).toBe(240);
  });
});

describe("custos", () => {
  it("soma e separa as OS incompletas e sem cálculo", () => {
    const custos = new Map<string, CustoDoPainel>([
      [
        "a",
        {
          chamado_id: "a",
          custo_mao_obra: 100.1,
          custo_materiais: 50.2,
          valor_terceirizado: null,
          custo_total: 150.3,
          valor_rateio: 150.3,
          completo: true,
        },
      ],
      [
        "b",
        {
          chamado_id: "b",
          custo_mao_obra: 0,
          custo_materiais: 0,
          valor_terceirizado: 300,
          custo_total: 300,
          valor_rateio: 0,
          completo: false,
        },
      ],
    ]);
    const s = somarCustos(["a", "b", "c"], custos);
    expect(s.total).toBe(450.3);
    expect(s.maoDeObra).toBe(100.1);
    expect(s.terceiros).toBe(300);
    expect(s.rateio).toBe(150.3);
    expect(s.incompletas).toEqual(["b"]);
    expect(s.semCalculo).toEqual(["c"]);
  });
});

describe("nota dos fornecedores", () => {
  it("aceite, retorno no prazo e retrabalho viram nota de 0 a 10", () => {
    const os = new Map([
      [
        "1",
        {
          id: "1",
          prazo_terceirizado: iso("2026-10-10T18:00"),
          reaberto_vezes: 0,
        },
      ],
      [
        "2",
        {
          id: "2",
          prazo_terceirizado: iso("2026-10-10T18:00"),
          reaberto_vezes: 1,
        },
      ],
      ["3", { id: "3", prazo_terceirizado: null, reaberto_vezes: 0 }],
    ]);
    const [n] = notasDosFornecedores(
      [
        {
          chamado_id: "1",
          empresa_id: "e",
          aceito_em: iso("2026-10-05T10:00"),
          recusado_em: null,
          terminado_em: iso("2026-10-09T10:00"),
        },
        {
          chamado_id: "2",
          empresa_id: "e",
          aceito_em: iso("2026-10-05T10:00"),
          recusado_em: null,
          terminado_em: iso("2026-10-12T10:00"),
        },
        {
          chamado_id: "3",
          empresa_id: "e",
          aceito_em: null,
          recusado_em: iso("2026-10-05T10:00"),
          terminado_em: null,
        },
        {
          chamado_id: "4",
          empresa_id: null,
          aceito_em: null,
          recusado_em: null,
          terminado_em: null,
        },
      ],
      os,
    );
    expect(n?.enviadas).toEqual(["1", "2", "3"]);
    expect(n?.pctAceite).toBeCloseTo(66.67, 1);
    expect(n?.pctNoPrazo).toBe(50);
    expect(n?.pctRetrabalho).toBe(50);
    // (66,7 + 50 + 50) ÷ 3 = 55,6 → 5,6.
    expect(n?.nota).toBe(5.6);
  });
});

describe("avisos com vários setores", () => {
  const d = (p: Partial<DestinoDoPainel>): DestinoDoPainel => ({
    chamado_id: "a1",
    setor_id: "op",
    status: "concluido",
    prazo: null,
    concluido_em: iso("2026-10-05T10:00"),
    criado_em: iso("2026-10-01T10:00"),
    ...p,
  });

  it("completos, tempo até o último setor e quem atrasou", () => {
    const r = andamentoDosAvisos(
      [
        { id: "a1", criado_em: iso("2026-10-01T10:00") },
        { id: "a2", criado_em: iso("2026-10-02T10:00") },
        { id: "a3", criado_em: iso("2026-10-02T10:00") },
      ],
      [
        d({}),
        d({
          setor_id: "est",
          concluido_em: iso("2026-10-03T10:00"),
          prazo: iso("2026-10-02T18:00"),
        }),
        d({
          chamado_id: "a2",
          status: "aberto",
          concluido_em: null,
          prazo: iso("2026-10-10T18:00"),
          setor_id: "est",
        }),
      ],
      brt("2026-10-23T12:00"),
    );
    expect(r.completos).toEqual(["a1"]);
    expect(r.pendentes).toEqual(["a2"]);
    expect(r.pct).toBe(50);
    expect(r.tempoAteUltimoMin).toBe(4 * 1440);
    expect(r.atrasosPorSetor.get("est")).toEqual(["a1", "a2"]);
    expect(r.atrasosPorSetor.has("op")).toBe(false);
  });
});

describe("ocupação da agenda", () => {
  it("vagas dos dias abertos sem os bloqueados, e os ocupados", () => {
    // 19 a 25/10/2026: segunda a domingo; agenda de segunda a sábado.
    const r = ocupacaoDaAgenda(
      { dias_semana: [1, 2, 3, 4, 5, 6], limite_por_dia: 2 },
      [
        { inicio: iso("2026-10-19T07:00"), status: "marcado" },
        { inicio: iso("2026-10-20T08:00"), status: "realizado" },
        { inicio: iso("2026-10-21T08:00"), status: "cancelado" },
        { inicio: iso("2026-10-27T08:00"), status: "marcado" },
      ],
      [{ inicio: iso("2026-10-22T00:00"), fim: iso("2026-10-23T00:00") }],
      "2026-10-19",
      "2026-10-25",
    );
    expect(r.diasBloqueados).toEqual(["2026-10-22"]);
    expect(r.vagas).toBe(10);
    expect(r.ocupados).toBe(2);
    expect(r.pct).toBe(20);
  });
});
