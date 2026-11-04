import { describe, expect, it } from "vitest";
import type { FontesEnet } from "./fontes";
import {
  dentroDoPeriodo,
  faixaDeTamanho,
  faixasDeTamanho,
  resumoPorBairro,
  valorM2DoPainel,
} from "./pesquisa";

const im = (
  bairro: string,
  area_m2: number,
  aluguel: number,
  condominio: number | null = null,
  iptu: number | null = null,
) => ({ bairro, area_m2, aluguel, condominio, iptu });

describe("resumo por bairro", () => {
  it("quantidade e médias; valor por m² médio é a média de cada imóvel", () => {
    const [centro, olaria] = resumoPorBairro([
      im("Centro", 50, 3000, 500, 100),
      im("Centro", 100, 4000, null, 200),
      im("Olaria", 40, 1200, 0, 0),
      im("Centro", 25, 2000, 300, null),
    ]);
    expect(centro).toMatchObject({ bairro: "Centro", quantidade: 3 });
    expect(centro?.areaMedia).toBeCloseTo(58.333, 3);
    expect(centro?.aluguelMedio).toBe(3000);
    // Em branco fica fora da média do condomínio e do IPTU.
    expect(centro?.condominioMedio).toBe(400);
    expect(centro?.iptuMedio).toBe(150);
    // (60 + 40 + 80) / 3
    expect(centro?.valorM2Medio).toBe(60);
    // (3600 + 4200 + 2300) / 3
    expect(centro?.custoTotalMedio).toBeCloseTo(3366.667, 3);
    // (72 + 42 + 92) / 3
    expect(centro?.custoM2Medio).toBeCloseTo(68.667, 3);
    expect(olaria).toMatchObject({
      quantidade: 1,
      valorM2Medio: 30,
      condominioMedio: 0,
      custoTotalMedio: 1200,
    });
  });

  it("vazio não tem linha", () => {
    expect(resumoPorBairro([])).toEqual([]);
  });
});

describe("faixa de tamanho", () => {
  const limites = [30, 50, 80, 100];
  it("até é inclusive; acima do último vira 'Acima de'", () => {
    expect(faixaDeTamanho(30, limites)).toBe("Até 30 m²");
    expect(faixaDeTamanho(30.5, limites)).toBe("Até 50 m²");
    expect(faixaDeTamanho(100, limites)).toBe("Até 100 m²");
    expect(faixaDeTamanho(101, limites)).toBe("Acima de 100 m²");
    expect(faixasDeTamanho(limites)).toEqual([
      "Até 30 m²",
      "Até 50 m²",
      "Até 80 m²",
      "Até 100 m²",
      "Acima de 100 m²",
    ]);
  });
});

describe("período", () => {
  it("todos, ano ou últimos 12 meses", () => {
    expect(dentroDoPeriodo("2023-08-10", "", "2026-11-04")).toBe(true);
    expect(dentroDoPeriodo("2023-08-10", "2023", "2026-11-04")).toBe(true);
    expect(dentroDoPeriodo("2024-01-10", "2023", "2026-11-04")).toBe(false);
    expect(dentroDoPeriodo("2025-11-05", "12m", "2026-11-04")).toBe(true);
    expect(dentroDoPeriodo("2025-11-04", "12m", "2026-11-04")).toBe(false);
  });
});

describe("valor por m² da ARP (Painel)", () => {
  it("faturamento do último mês fechado ÷ ABL dos LUCs com contrato no fim do mês (tipos que contam)", () => {
    const contrato = (
      luc: string,
      inicio: string,
      rescisao: string | null,
    ) => ({
      codigo: luc,
      luc,
      cliente: "c",
      locatario: "L",
      data_inicio: inicio,
      data_termino: null,
      prazo: "Indeterminado" as const,
      valor_aluguel: 0,
      indice: "IGPM" as const,
      mes_reajuste: 1,
      data_rescisao: rescisao,
    });
    const luc = (numero: string, abl: number) => ({
      numero,
      abl,
      data_inicio: "2010-01-01",
      tipo_loja: "Loja Comercial",
      area_util: abl,
      status: "Locado" as const,
      local: "Bloco 01",
      piso: "",
      rua: "",
      situacao: "",
    });
    const enet: Pick<FontesEnet, "lucs" | "contratos" | "contasReceber"> = {
      lucs: [luc("01_1", 100), luc("01_2", 50), luc("01_3", 30)],
      contratos: [
        contrato("01_1", "2020-01-01", null),
        // Rescindido no meio de outubro: não está locado no fim do mês.
        contrato("01_2", "2020-01-01", "2026-10-15"),
        // Começa em novembro: ainda não conta.
        contrato("01_3", "2026-11-01", null),
      ],
      contasReceber: [
        {
          competencia: "2026-10-01",
          luc: "01_1",
          tipo_luc: "",
          cliente: "c",
          valor_faturado: 2800,
        },
        {
          competencia: "2026-10-01",
          luc: "01_2",
          tipo_luc: "",
          cliente: "c",
          valor_faturado: 700,
        },
        {
          competencia: "2026-11-01",
          luc: "01_1",
          tipo_luc: "",
          cliente: "c",
          valor_faturado: 9999,
        },
      ],
    };
    expect(
      valorM2DoPainel(enet, new Set(["Loja Comercial"]), "2026-11-04"),
    ).toEqual({
      mes: "2026-10-01",
      faturamento: 3500,
      ablLocada: 100,
      valor: 35,
    });
  });
});
