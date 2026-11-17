import { describe, expect, it } from "vitest";
import {
  cobertura,
  contratoEntraNaLista,
  type EntradaSituacao,
  lucsDoTexto,
  type ParametrosEntrevista,
  participacao,
  proximaDataDaEntrevista,
  situacaoDaEntrevista,
  situacaoDoTermo,
  termoValido,
  tipoDaEntrevista,
  validadeDoTermo,
} from "./situacao";

// Padrões sugeridos no spec (4.4 e 4.11); no sistema vêm dos Parâmetros.
const PARAMETROS_PADRAO: ParametrosEntrevista = {
  mesesPrimeira: 6,
  validadePadraoMeses: 24,
  validadePorSetor: { Gastronômico: 2, Saúde: 3 },
  avisoDias: 30,
};

const base = (o: Partial<EntradaSituacao>): EntradaSituacao => ({
  hoje: "2026-11-09",
  ativacao: "2026-03-01",
  dispensada: false,
  ultimaEntrevista: null,
  validadeEspecificaMeses: null,
  parametros: PARAMETROS_PADRAO,
  ...o,
});

describe("situacaoDaEntrevista (spec 8)", () => {
  it("ativado em 01/03/2026 sem entrevista, hoje 09/11/2026 → pendente, prevista 01/09/2026", () => {
    expect(situacaoDaEntrevista(base({}))).toEqual({
      situacao: "pendente",
      dataPrevista: "2026-09-01",
      validaAte: null,
    });
  });

  it("aguardando antes da prevista; no dia exato da prevista já é pendente", () => {
    expect(situacaoDaEntrevista(base({ hoje: "2026-08-31" })).situacao).toBe(
      "aguardando",
    );
    expect(situacaoDaEntrevista(base({ hoje: "2026-09-01" })).situacao).toBe(
      "pendente",
    );
  });

  it("ao salvar a entrevista vira em dia, com validade pelo prazo do setor", () => {
    const r = situacaoDaEntrevista(
      base({ ultimaEntrevista: { data: "2026-11-09", setor: "Saúde" } }),
    );
    expect(r).toEqual({
      situacao: "em_dia",
      dataPrevista: "2027-02-09",
      validaAte: "2027-02-09",
    });
  });

  // Validade em 25/11 e em 01/11: entrevistas sem setor (padrão de 24 meses).
  it("validade 25/11/2026 → a vencer; 01/11/2026 → vencida", () => {
    const vale = (data: string) =>
      situacaoDaEntrevista(base({ ultimaEntrevista: { data, setor: null } }));
    expect(vale("2024-11-25")).toMatchObject({
      situacao: "a_vencer",
      validaAte: "2026-11-25",
    });
    expect(vale("2024-11-01")).toMatchObject({
      situacao: "vencida",
      validaAte: "2026-11-01",
    });
  });

  it("limites: último dia da validade ainda a vencer; dia seguinte vencida", () => {
    const u = { data: "2024-11-09", setor: null };
    expect(
      situacaoDaEntrevista(base({ ultimaEntrevista: u, hoje: "2026-11-09" }))
        .situacao,
    ).toBe("a_vencer");
    expect(
      situacaoDaEntrevista(base({ ultimaEntrevista: u, hoje: "2026-11-10" }))
        .situacao,
    ).toBe("vencida");
  });

  it("limite do aviso: faltando 30 dias a vencer; 31 em dia", () => {
    const u = { data: "2024-12-09", setor: null }; // vale até 2026-12-09
    expect(
      situacaoDaEntrevista(base({ ultimaEntrevista: u, hoje: "2026-11-09" }))
        .situacao,
    ).toBe("a_vencer");
    expect(
      situacaoDaEntrevista(base({ ultimaEntrevista: u, hoje: "2026-11-08" }))
        .situacao,
    ).toBe("em_dia");
  });

  it("dispensada vence tudo e não tem data prevista", () => {
    expect(
      situacaoDaEntrevista(
        base({
          dispensada: true,
          ultimaEntrevista: { data: "2020-01-01", setor: null },
        }),
      ),
    ).toEqual({
      situacao: "dispensada",
      dataPrevista: null,
      validaAte: "2022-01-01",
    });
  });

  it("ativação corrigida à mão muda a prevista", () => {
    expect(
      situacaoDaEntrevista(base({ ativacao: "2026-06-15" })),
    ).toMatchObject({ situacao: "aguardando", dataPrevista: "2026-12-15" });
  });

  it("sem ativação e sem entrevista: pendente sem data", () => {
    expect(situacaoDaEntrevista(base({ ativacao: null }))).toEqual({
      situacao: "pendente",
      dataPrevista: null,
      validaAte: null,
    });
  });
});

describe("proximaDataDaEntrevista", () => {
  it("setor da tabela, padrão para setor sem prazo e para sem setor", () => {
    const p = PARAMETROS_PADRAO;
    expect(proximaDataDaEntrevista("2026-11-09", "Gastronômico", null, p)).toBe(
      "2027-01-09",
    );
    expect(proximaDataDaEntrevista("2026-11-09", "Academia", null, p)).toBe(
      "2028-11-09",
    );
    expect(proximaDataDaEntrevista("2026-11-09", null, null, p)).toBe(
      "2028-11-09",
    );
  });

  it("prazo específico do contrato vence o do setor", () => {
    expect(
      proximaDataDaEntrevista("2026-11-09", "Saúde", 12, PARAMETROS_PADRAO),
    ).toBe("2027-11-09");
  });

  it("fim de mês fica no último dia (31/08 + 6 = 28/02)", () => {
    expect(
      proximaDataDaEntrevista("2026-08-31", null, 6, PARAMETROS_PADRAO),
    ).toBe("2027-02-28");
  });
});

describe("tipoDaEntrevista", () => {
  it("primeira sem anterior, atualização com", () => {
    expect(tipoDaEntrevista(null)).toBe("primeira");
    expect(tipoDaEntrevista({ data: "2025-01-01" })).toBe("atualizacao");
  });
});

describe("contratoEntraNaLista", () => {
  const p = { hoje: "2026-11-09", tiposLojaDispensados: ["Área Publicitária"] };
  const c = {
    situacao: "vigente" as const,
    rescisao: null,
    tipoLoja: "Loja Comercial",
  };

  it("vigente, sem rescisão e tipo não dispensado entra", () => {
    expect(contratoEntraNaLista(c, p)).toBe(true);
  });

  it("rescindido sai (inclusive no dia); rescisão futura ainda entra", () => {
    expect(contratoEntraNaLista({ ...c, rescisao: "2026-11-01" }, p)).toBe(
      false,
    );
    expect(contratoEntraNaLista({ ...c, rescisao: "2026-11-09" }, p)).toBe(
      false,
    );
    expect(contratoEntraNaLista({ ...c, rescisao: "2026-12-01" }, p)).toBe(
      true,
    );
  });

  it("encerrado sai", () => {
    expect(contratoEntraNaLista({ ...c, situacao: "encerrado" }, p)).toBe(
      false,
    );
  });

  it("Área Publicitária sai, mesmo com acento ou caixa diferentes", () => {
    expect(
      contratoEntraNaLista({ ...c, tipoLoja: "Área Publicitária" }, p),
    ).toBe(false);
    expect(
      contratoEntraNaLista({ ...c, tipoLoja: "AREA PUBLICITARIA" }, p),
    ).toBe(false);
  });
});

describe("cobertura", () => {
  it("(em dia + a vencer) ÷ todos menos aguardando e dispensada", () => {
    const r = cobertura([
      "em_dia",
      "em_dia",
      "a_vencer",
      "vencida",
      "pendente",
      "aguardando",
      "dispensada",
    ]);
    expect(r.emDia).toBe(3);
    expect(r.precisam).toBe(5);
    expect(r.pct).toBe(60);
  });

  it("sem contrato que precise: null, não zero", () => {
    expect(cobertura(["aguardando", "dispensada"]).pct).toBeNull();
  });
});

describe("lucsDoTexto", () => {
  it("11_129/130/202 → três LUCs", () => {
    expect(lucsDoTexto("11_129/130/202")).toEqual([
      "11_129",
      "11_130",
      "11_202",
    ]);
  });

  it("códigos de estacionamento, mídia e completos", () => {
    expect(lucsDoTexto("ESTAC_01")).toEqual(["ESTAC_01"]);
    expect(lucsDoTexto("OOH01")).toEqual(["OOH01"]);
    expect(lucsDoTexto("OOH01/02")).toEqual(["OOH01", "OOH02"]);
    expect(lucsDoTexto("11_129 / 12_005")).toEqual(["11_129", "12_005"]);
    expect(lucsDoTexto("11_129/129")).toEqual(["11_129"]);
    expect(lucsDoTexto("")).toEqual([]);
    expect(lucsDoTexto(null)).toEqual([]);
  });
});

describe("Clube: termo e participação", () => {
  const t = (o: { validoAte?: string | null; saiuEm?: string | null }) =>
    situacaoDoTermo({
      hoje: "2026-11-09",
      validoAte: null,
      saiuEm: null,
      avisoDias: 30,
      ...o,
    });

  it("validade = assinatura + meses", () => {
    expect(validadeDoTermo("2025-11-20", 12)).toBe("2026-11-20");
  });

  it("ativo, a vencer, vencido e saiu", () => {
    expect(t({ validoAte: "2027-03-01" })).toBe("ativo");
    expect(t({ validoAte: "2026-12-09" })).toBe("a_vencer");
    expect(t({ validoAte: "2026-12-10" })).toBe("ativo");
    expect(t({ validoAte: "2026-11-09" })).toBe("a_vencer");
    expect(t({ validoAte: "2026-11-08" })).toBe("vencido");
    expect(t({ validoAte: null })).toBe("vencido");
    expect(t({ validoAte: "2027-03-01", saiuEm: "2026-10-01" })).toBe("saiu");
  });

  it("termo a vencer ainda conta como ativo", () => {
    expect(termoValido("a_vencer")).toBe(true);
    expect(termoValido("vencido")).toBe(false);
    expect(termoValido("saiu")).toBe(false);
  });

  it("participação 27 de 178 = 15,2%", () => {
    expect(participacao(27, 178)?.toFixed(1)).toBe("15.2");
    expect(participacao(0, 0)).toBeNull();
  });
});
