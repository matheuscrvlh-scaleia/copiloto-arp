import { describe, expect, it } from "vitest";
import type { EnetCliente, EnetContrato } from "./fontes";
import {
  aniversariosDoMes,
  aniversariosParaLembrar,
  chaveDoLembrete,
  inicioDoPeriodo,
  quandoEh,
  resumo,
  sociosSemNascimento,
  textoDoChamado,
} from "./relacionamento";

const HOJE = "2026-11-04";

const ct = (
  codigo: string,
  cliente: string,
  o: Partial<EnetContrato> = {},
): EnetContrato => ({
  codigo,
  luc: `01_${codigo}`,
  cliente,
  locatario: `Loja ${cliente}`,
  data_inicio: "2020-11-06",
  data_termino: null,
  prazo: "Indeterminado",
  valor_aluguel: 1000,
  indice: "IGPM",
  mes_reajuste: 11,
  data_rescisao: null,
  ...o,
});

const cl = (codigo: string, nascimentos: (string | null)[]): EnetCliente => ({
  codigo,
  nome: `Loja ${codigo}`,
  cpf_cnpj: codigo,
  tipo_pessoa: "PJ",
  socios: nascimentos.map((n, i) => ({
    nome: `Sócio ${i + 1}`,
    cpf: "1",
    data_nascimento: n,
  })),
  atividade: "Comércio",
});

const e = {
  hoje: HOJE,
  lucs: [
    { numero: "01_A", local: "Bloco 01" },
    { numero: "01_B", local: "Bloco 01" },
  ],
  contratos: [
    ct("A", "C1"),
    ct("B", "C2", { data_inicio: "2026-02-10" }),
    ct("C", "C3", { data_inicio: "2019-11-20", data_rescisao: "2026-05-01" }),
    ct("D", "C1", { data_inicio: "2016-02-29" }),
  ],
  clientes: [
    cl("C1", ["1980-11-05", null]),
    cl("C2", ["1990-12-01"]),
    cl("C3", ["1985-11-10"]),
  ],
};

describe("aniversários", () => {
  it("contrato com anos de ARP; sócio sem idade; só locatários ativos", () => {
    const nov = aniversariosDoMes(e, 2026, 11);
    expect(
      nov.map((a) => [a.tipo, a.data, a.anos, a.locatario, a.socio]),
    ).toEqual([
      ["socio", "2026-11-05", null, "Loja C1", "Sócio 1"],
      ["contrato", "2026-11-06", 6, "Loja C1", null],
    ]);
    // Sócio fica ligado ao primeiro contrato ativo do locatário.
    expect(nov[0]?.contrato).toBe("A");
  });

  it("contrato com menos de um ano não faz aniversário; 29/02 vira 28/02", () => {
    expect(aniversariosDoMes(e, 2026, 2).map((a) => [a.chave, a.data])).toEqual(
      [["D", "2026-02-28"]],
    );
  });

  it("conta os sócios sem data de nascimento", () => {
    expect(sociosSemNascimento(e)).toBe(1);
  });
});

describe("lembretes", () => {
  it("de hoje até X dias depois, com chave por ano (não repete)", () => {
    const l = aniversariosParaLembrar(e, 3);
    expect(l.map((a) => a.data)).toEqual(["2026-11-05", "2026-11-06"]);
    expect(chaveDoLembrete(l[1] as (typeof l)[number])).toBe(
      "comercial:aniversario:contrato:A:2026",
    );
    expect(aniversariosParaLembrar(e, 0)).toEqual([]);
  });

  it("vira o ano", () => {
    const l = aniversariosParaLembrar(
      { ...e, hoje: "2026-12-30", clientes: [cl("C1", ["1980-01-02"])] },
      5,
    );
    expect(l.map((a) => a.data)).toEqual(["2027-01-02"]);
  });

  it("quando é", () => {
    expect(quandoEh(HOJE, HOJE)).toBe("hoje");
    expect(quandoEh("2026-11-05", HOJE)).toBe("amanhã");
    expect(quandoEh("2026-11-07", HOJE)).toBe("em 3 dias");
  });
});

describe("registro de contatos", () => {
  it("período padrão: últimos 90 dias contando hoje", () => {
    expect(inicioDoPeriodo("", HOJE)).toBe("2026-08-07");
    expect(inicioDoPeriodo("todos", HOJE)).toBeNull();
  });

  it("resumo corta na palavra", () => {
    expect(resumo("curto")).toBe("curto");
    expect(resumo("uma frase bem comprida que passa do limite", 20)).toBe(
      "uma frase bem…",
    );
  });

  it("texto do chamado no Tickets", () => {
    expect(
      textoDoChamado({
        locatario: "Loja X",
        luc: "11_131",
        tipo: "Reclamação",
        canal: "WhatsApp",
        descricao: "Goteira",
      }),
    ).toEqual({
      titulo: "Reclamação: Loja X (11_131)",
      descricao: "Registro do Comercial (WhatsApp).\n\nGoteira",
    });
  });
});
