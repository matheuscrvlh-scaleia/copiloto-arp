import { describe, expect, it } from "vitest";
import type { EnetContrato } from "./fontes";
import {
  aluguelReajustado,
  contarFaixas,
  diasParaVencer,
  faixaDoContrato,
  linhasDeVencimento,
  noPeriodo,
  proximoReajuste,
  reajusteProximo,
  rotulosDasFaixas,
} from "./vencimentos";

const HOJE = "2026-11-04";
const F = { faixa1: 30, faixa2: 90 };

const ct = (o: Partial<EnetContrato> = {}): EnetContrato => ({
  codigo: "CT1",
  luc: "01_101",
  cliente: "C1",
  locatario: "Loja",
  data_inicio: "2023-12-15",
  data_termino: "2026-12-14",
  prazo: "Determinado",
  valor_aluguel: 2000,
  indice: "IGPM",
  mes_reajuste: 12,
  data_rescisao: null,
  ...o,
});

describe("faixas de vencimento", () => {
  it("dias para vencer: término menos hoje (negativo = vencido)", () => {
    expect(diasParaVencer("2026-11-10", HOJE)).toBe(6);
    expect(diasParaVencer("2026-11-01", HOJE)).toBe(-3);
    expect(diasParaVencer(null, HOJE)).toBeNull();
  });

  it("cada contrato na faixa dos parâmetros", () => {
    const f = (t: string | null, p: EnetContrato["prazo"] = "Determinado") =>
      faixaDoContrato({ data_termino: t, prazo: p }, HOJE, F);
    expect(f("2026-11-03")).toBe("vencido");
    expect(f("2026-11-04")).toBe("faixa1");
    expect(f("2026-12-04")).toBe("faixa1");
    expect(f("2026-12-05")).toBe("faixa2");
    expect(f("2027-02-02")).toBe("faixa2");
    expect(f("2027-02-03")).toBe("depois");
    expect(f(null, "Indeterminado")).toBe("indeterminado");
    expect(
      faixaDoContrato(
        { data_termino: "2026-12-05", prazo: "Determinado" },
        HOJE,
        { faixa1: 60, faixa2: 120 },
      ),
    ).toBe("faixa1");
  });

  it("rótulos com os dias", () => {
    const r = rotulosDasFaixas(F);
    expect(r.faixa1).toBe("Vencem em até 30 dias");
    expect(r.faixa2).toBe("Vencem de 31 a 90 dias");
  });

  it("período de término: vencidos e indeterminados sempre entram", () => {
    expect(
      noPeriodo({ data_termino: "2027-11-04", prazo: "Determinado" }, HOJE, ""),
    ).toBe(true);
    expect(
      noPeriodo({ data_termino: "2027-11-05", prazo: "Determinado" }, HOJE, ""),
    ).toBe(false);
    expect(
      noPeriodo(
        { data_termino: "2027-11-05", prazo: "Determinado" },
        HOJE,
        "todos",
      ),
    ).toBe(true);
    expect(
      noPeriodo(
        { data_termino: "2026-01-01", prazo: "Determinado" },
        HOJE,
        "3m",
      ),
    ).toBe(true);
    expect(
      noPeriodo({ data_termino: null, prazo: "Indeterminado" }, HOJE, "6m"),
    ).toBe(true);
  });
});

describe("reajuste previsto", () => {
  it("próximo reajuste: dia do início no mês de reajuste", () => {
    expect(
      proximoReajuste({ data_inicio: "2023-12-15", mes_reajuste: 12 }, HOJE),
    ).toBe("2026-12-15");
    expect(
      proximoReajuste({ data_inicio: "2023-03-31", mes_reajuste: 2 }, HOJE),
    ).toBe("2027-02-28");
    expect(
      proximoReajuste({ data_inicio: "2020-11-04", mes_reajuste: 11 }, HOJE),
    ).toBe("2026-11-04");
    expect(
      proximoReajuste({ data_inicio: "2020-11-03", mes_reajuste: 11 }, HOJE),
    ).toBe("2027-11-03");
  });

  it("só nos próximos N dias", () => {
    expect(
      reajusteProximo(
        { data_inicio: "2023-12-15", mes_reajuste: 12 },
        HOJE,
        60,
      ),
    ).toBe(true);
    expect(
      reajusteProximo({ data_inicio: "2023-01-05", mes_reajuste: 1 }, HOJE, 60),
    ).toBe(false);
  });

  it("índice negativo não reajusta", () => {
    expect(aluguelReajustado(2000, 4.12)).toBe(2082.4);
    expect(aluguelReajustado(2000, -1.5)).toBe(2000);
  });

  it("linhas: só contratos ativos; previsto com o índice do contrato; sem valores, sem aluguel", () => {
    const lucs = new Map([["01_101", { local: "Bloco 01", abl: 40 }]]);
    const base = {
      lucs,
      hoje: HOJE,
      faixas: F,
      diasReajuste: 60,
      acumulados: { IGPM: 4.12, IPCA: null },
    };
    const contratos = [
      ct(),
      ct({ codigo: "CT2", indice: "IPCA" }),
      ct({ codigo: "CT3", data_rescisao: "2026-10-01" }),
    ];
    const ls = linhasDeVencimento({ ...base, contratos, comValores: true });
    expect(ls.map((l) => l.contrato)).toEqual(["CT1", "CT2"]);
    expect(ls[0]).toMatchObject({
      bloco: "Bloco 01",
      dias: 40,
      faixa: "faixa2",
      previsto: { acumulado: 4.12, aluguel: 2082.4 },
    });
    expect(ls[1]?.previsto).toBeNull();
    const sem = linhasDeVencimento({ ...base, contratos, comValores: false });
    expect(sem[0]?.aluguel).toBeNull();
    expect(sem[0]?.previsto).toEqual({ acumulado: 4.12, aluguel: null });
    expect(contarFaixas(ls).faixa2).toBe(2);
  });
});
