import { describe, expect, it } from "vitest";
import {
  type ConfigEntrevista,
  type ContratoDoCliente,
  entrevistaPorCliente,
  entrevistasDosContratos,
  piorEntrevista,
  ultimasPorContrato,
} from "./clube-entrevista";

const CFG: ConfigEntrevista = {
  hoje: "2026-11-16",
  parametros: {
    mesesPrimeira: 6,
    validadePadraoMeses: 24,
    validadePorSetor: { Gastronômico: 2 },
    avisoDias: 30,
  },
  tiposLojaDispensados: ["Área Publicitária"],
  dataInauguracao: "ativacao",
};

const contrato = (
  id: string,
  o: Partial<ContratoDoCliente> = {},
): ContratoDoCliente => ({
  id,
  contrato: id,
  clienteDoc: "12345678000190",
  lucs: ["11_1"],
  bloco: "11",
  tipoLoja: "Loja",
  situacao: "vigente",
  rescisao: null,
  ativacao: "2026-01-01",
  inicio: "2025-12-01",
  ativacaoCorrigida: null,
  validadeMesesEspecifica: null,
  dispensada: false,
  ...o,
});

describe("entrevistasDosContratos", () => {
  it("usa a situação de 4.4: ativado em 01/01/2026 sem entrevista, hoje 16/11 → pendente", () => {
    const [r] = entrevistasDosContratos([contrato("c1")], [], CFG);
    expect(r).toMatchObject({
      situacao: "pendente",
      dataPrevista: "2026-07-01",
      foraDaLista: false,
    });
  });

  it("a ativação corrigida e a data de inauguração dos Parâmetros valem", () => {
    const corr = contrato("c1", { ativacaoCorrigida: "2026-10-01" });
    expect(entrevistasDosContratos([corr], [], CFG)[0]?.situacao).toBe(
      "aguardando",
    );
    const inicio = { ...CFG, dataInauguracao: "inicio" as const };
    expect(
      entrevistasDosContratos([contrato("c1")], [], inicio)[0]?.dataPrevista,
    ).toBe("2026-06-01");
  });

  it("entrevista salva põe a validade; a mais recente de cada contrato vale", () => {
    const e = [
      { contratoId: "c1", data: "2024-01-10", setor: null },
      { contratoId: "c1", data: "2026-10-20", setor: null },
    ];
    expect(ultimasPorContrato(e).get("c1")?.data).toBe("2026-10-20");
    const [r] = entrevistasDosContratos([contrato("c1")], e, CFG);
    expect(r).toMatchObject({
      situacao: "em_dia",
      validaAte: "2028-10-20",
      ultimaData: "2026-10-20",
    });
  });

  it("tipo de loja dispensado e contrato encerrado ficam fora da lista", () => {
    const itens = entrevistasDosContratos(
      [
        contrato("pub", { tipoLoja: "Área Publicitária" }),
        contrato("enc", { situacao: "encerrado" }),
        contrato("ok"),
      ],
      [],
      CFG,
    );
    expect(itens.map((i) => i.foraDaLista)).toEqual([true, true, false]);
  });
});

describe("piorEntrevista", () => {
  it("a pior situação entre os contratos da lista", () => {
    expect(
      piorEntrevista([
        { situacao: "em_dia", foraDaLista: false },
        { situacao: "vencida", foraDaLista: false },
        { situacao: "pendente", foraDaLista: false },
      ]),
    ).toBe("vencida");
    expect(
      piorEntrevista([
        { situacao: "em_dia", foraDaLista: false },
        { situacao: "a_vencer", foraDaLista: false },
      ]),
    ).toBe("a_vencer");
  });

  it("contrato fora da lista não conta; sem nenhum, null", () => {
    expect(
      piorEntrevista([{ situacao: "vencida", foraDaLista: true }]),
    ).toBeNull();
    expect(piorEntrevista([])).toBeNull();
  });
});

describe("entrevistaPorCliente", () => {
  it("agrupa pelo documento e ignora contrato encerrado ou rescindido", () => {
    const m = entrevistaPorCliente(
      [
        contrato("a1"),
        contrato("a2", { rescisao: "2026-06-01" }),
        contrato("b1", {
          clienteDoc: "99999999000199",
          ativacao: "2026-10-01",
        }),
        contrato("c1", { clienteDoc: "11111111000191", situacao: "encerrado" }),
        contrato("sem", { clienteDoc: null }),
      ],
      [],
      CFG,
    );
    expect(m.get("12345678000190")).toBe("pendente");
    expect(m.get("99999999000199")).toBe("aguardando");
    expect(m.has("11111111000191")).toBe(false);
    expect(m.size).toBe(2);
  });
});
