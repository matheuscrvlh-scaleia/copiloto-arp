import { describe, expect, it } from "vitest";
import {
  calcularOS,
  centavos,
  descreverPeriodos,
  type EntradaOS,
  formatarDuracao,
  minutoHomem,
  minutosDaOS,
  minutosDaSessao,
  type Sessao,
  type VigenciaValor,
  valorMinutoEm,
} from "./calculos";

const sessao = (s: Partial<Sessao>): Sessao => ({
  data: "2026-10-21",
  inicio: "08:00",
  fim: "12:00",
  almoco_inicio: null,
  almoco_fim: null,
  tecnicos: ["ana"],
  ...s,
});

describe("minutos da sessão", () => {
  it("sem almoço", () => {
    expect(minutosDaSessao(sessao({ inicio: "13:00", fim: "15:30" }))).toBe(
      150,
    );
  });

  it("desconta só a parte do almoço que cai dentro da sessão", () => {
    const parcial = sessao({ almoco_inicio: "11:30", almoco_fim: "13:00" });
    expect(minutosDaSessao(parcial)).toBe(210);
    const antes = sessao({
      inicio: "13:00",
      fim: "17:00",
      almoco_inicio: "12:30",
      almoco_fim: "13:30",
    });
    expect(minutosDaSessao(antes)).toBe(210);
    const fora = sessao({ almoco_inicio: "12:00", almoco_fim: "13:00" });
    expect(minutosDaSessao(fora)).toBe(240);
  });

  it("passa da meia-noite", () => {
    expect(minutosDaSessao(sessao({ inicio: "22:00", fim: "02:00" }))).toBe(
      240,
    );
    const noite = sessao({
      inicio: "22:00",
      fim: "06:00",
      almoco_inicio: "02:00",
      almoco_fim: "03:00",
    });
    expect(minutosDaSessao(noite)).toBe(420);
    const virando = sessao({
      inicio: "22:00",
      fim: "02:00",
      almoco_inicio: "23:30",
      almoco_fim: "00:30",
    });
    expect(minutosDaSessao(virando)).toBe(180);
  });

  it("cronômetro rodando: 0, ou o parcial se passar agora", () => {
    const rodando = sessao({ fim: null });
    expect(minutosDaSessao(rodando)).toBe(0);
    expect(
      minutosDaSessao(rodando, new Date("2026-10-21T09:30:00-03:00")),
    ).toBe(90);
  });

  it("minuto-homem multiplica pelos técnicos de cada sessão", () => {
    const ss = [
      sessao({
        tecnicos: ["ana", "bia"],
        almoco_inicio: "11:30",
        almoco_fim: "13:00",
      }),
      sessao({ data: "2026-10-22", inicio: "13:00", fim: "15:30" }),
    ];
    expect(minutosDaOS(ss)).toBe(360);
    expect(minutoHomem(ss)).toBe(210 * 2 + 150);
  });
});

const vigencias: VigenciaValor[] = [
  { tecnico_id: "ana", vigente_desde: "2026-01-01", valor_minuto: 0.4485 },
  { tecnico_id: "ana", vigente_desde: "2026-10-22", valor_minuto: 0.5 },
  { tecnico_id: "bia", vigente_desde: "2026-01-01", valor_minuto: 0.4 },
];

describe("valor por minuto", () => {
  it("vale a vigência mais recente até a data", () => {
    expect(valorMinutoEm(vigencias, "ana", "2026-10-21")).toBe(0.4485);
    expect(valorMinutoEm(vigencias, "ana", "2026-10-22")).toBe(0.5);
    expect(valorMinutoEm(vigencias, "ana", "2025-12-31")).toBeNull();
    expect(valorMinutoEm(vigencias, "carlos", "2026-10-21")).toBeNull();
  });
});

describe("cálculo da O.S.", () => {
  it("200 min × 0,4485 = 89,70", () => {
    const r = calcularOS({
      sessoes: [sessao({ fim: "11:20" })],
      vigencias,
      rateio: null,
    });
    expect(r.minutos).toBe(200);
    expect(r.maoDeObra).toBe(89.7);
    expect(r.total).toBe(89.7);
    expect(r.completo).toBe(true);
  });

  it("vigência muda entre as sessões e vários técnicos", () => {
    const r = calcularOS({
      sessoes: [
        sessao({ data: "2026-10-22", inicio: "13:00", fim: "15:30" }),
        sessao({
          tecnicos: ["ana", "bia"],
          almoco_inicio: "11:30",
          almoco_fim: "13:00",
        }),
      ],
      vigencias,
      materiais: [
        { descricao: "Disjuntor", quantidade: 2, valor_unitario: 10.5 },
      ],
      rateio: { regra: "percentual", percentual: 30 },
      nomes: { ana: "Ana", bia: "Bia" },
    });
    // Ana: 210 × 0,4485 + 150 × 0,5 = 169,185; Bia: 210 × 0,40 = 84.
    expect(r.minutos).toBe(360);
    expect(r.minutoHomem).toBe(570);
    expect(r.porTecnico).toEqual([
      { tecnico_id: "ana", minutos: 360, valor_minuto: 0.5, custo: 169.19 },
      { tecnico_id: "bia", minutos: 210, valor_minuto: 0.4, custo: 84 },
    ]);
    expect(r.maoDeObra).toBe(253.19);
    expect(r.materiais).toBe(21);
    expect(r.total).toBe(274.19);
    // 274,185 × 30% = 82,2555: arredonda só o final.
    expect(r.valorRateio).toBe(82.26);
    expect(r.memoria).toContain("Ana: 210min × R$ 0,4485 = R$ 94,19");
    expect(r.memoria).toContain("Ana: 150min × R$ 0,5000 = R$ 75,00");
    expect(r.memoria[0]).toBe(
      "Principal (21/10/2026 08:00–12:00): 240min − 30min de almoço = 210min × 2 técnicos = 420 min-homem",
    );
  });

  it("técnico sem valor não vira zero nem valor chutado: fica pendente", () => {
    const r = calcularOS({
      sessoes: [sessao({ tecnicos: ["ana", "carlos"], fim: "11:20" })],
      vigencias,
      materiais: [{ descricao: "Cabo", quantidade: 1, valor_unitario: null }],
      rateio: null,
      nomes: { carlos: "Carlos" },
    });
    expect(r.completo).toBe(false);
    expect(r.maoDeObra).toBe(89.7);
    expect(r.porTecnico[1]).toEqual({
      tecnico_id: "carlos",
      minutos: 200,
      valor_minuto: null,
      custo: 0,
    });
    expect(r.pendencias).toEqual([
      "Sem valor por minuto para Carlos em 21/10/2026",
      "Material sem valor: Cabo",
    ]);
  });

  describe("rateio", () => {
    // 100 min × R$ 1,00 + terceirizado R$ 50 = R$ 150.
    const base: EntradaOS = {
      sessoes: [sessao({ fim: "09:40" })],
      vigencias: [
        { tecnico_id: "ana", vigente_desde: "2026-01-01", valor_minuto: 1 },
      ],
      terceirizado: 50,
      rateio: null,
    };
    const rateio = (r: Partial<EntradaOS>) => calcularOS({ ...base, ...r });

    it("outros custos entram no valor da O.S. e no rateio", () => {
      const r = rateio({
        outros: [{ descricao: "Frete", valor: 25.5 }],
        rateio: { regra: "percentual", percentual: 100 },
      });
      expect(r.outros).toBe(25.5);
      expect(r.total).toBe(175.5);
      expect(r.valorRateio).toBe(175.5);
      expect(r.memoria).toContain("Outros custos: R$ 25,50");
    });
    it("fora do rateio é zero", () => {
      expect(rateio({}).total).toBe(150);
      expect(rateio({}).valorRateio).toBe(0);
    });
    it("hora trabalhada = valor da O.S.", () => {
      expect(rateio({ rateio: { regra: "hora_trabalhada" } }).valorRateio).toBe(
        150,
      );
    });
    it("manual = valor digitado", () => {
      expect(
        rateio({ rateio: { regra: "manual", valor: 40 } }).valorRateio,
      ).toBe(40);
      const sem = rateio({ rateio: { regra: "manual", valor: null } });
      expect(sem.completo).toBe(false);
    });
    it("percentual = valor da O.S. × %", () => {
      expect(
        rateio({ rateio: { regra: "percentual", percentual: 10 } }).valorRateio,
      ).toBe(15);
    });
    it("terceirizado = valor cobrado; no legado, o valor da O.S.", () => {
      expect(rateio({ rateio: { regra: "terceirizado" } }).valorRateio).toBe(
        50,
      );
      expect(
        rateio({ rateio: { regra: "terceirizado" }, legado: true }).valorRateio,
      ).toBe(150);
    });
  });
});

describe("formatos", () => {
  it("centavos meio para cima sem lixo de ponto flutuante", () => {
    expect(centavos(200 * 0.4485)).toBe(89.7);
    expect(centavos(1.005)).toBe(1.01);
    expect(centavos(82.2555)).toBe(82.26);
  });

  it("duração", () => {
    expect(formatarDuracao(200)).toBe("3h 20min");
    expect(formatarDuracao(45)).toBe("45min");
    expect(formatarDuracao(120)).toBe("2h");
    expect(formatarDuracao(0)).toBe("0min");
  });

  it("períodos no formato do sistema atual", () => {
    expect(
      descreverPeriodos([
        sessao({ data: "2026-10-22", inicio: "13:00", fim: "15:30" }),
        sessao({ almoco_inicio: "12:00", almoco_fim: "13:00" }),
      ]),
    ).toBe(
      "Principal: 21/10/2026 08:00–12:00 | Continuação: 22/10/2026 13:00–15:30 | Almoço principal descontado: 12:00–13:00",
    );
    expect(
      descreverPeriodos([
        sessao({}),
        sessao({ data: "2026-10-22" }),
        sessao({
          data: "2026-10-23",
          fim: "17:00",
          almoco_inicio: "12:00",
          almoco_fim: "13:00",
        }),
      ]),
    ).toBe(
      "Principal: 21/10/2026 08:00–12:00 | Continuação 1: 22/10/2026 08:00–12:00 | Continuação 2: 23/10/2026 08:00–17:00 | Almoço continuação 2 descontado: 12:00–13:00",
    );
  });
});
