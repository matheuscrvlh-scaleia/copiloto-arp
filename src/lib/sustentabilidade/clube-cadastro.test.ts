import { describe, expect, it } from "vitest";
import {
  acaoDoClube,
  competenciaDoMes,
  contribuicaoDoClube,
  lerReais,
  novoParticipante,
  saidaDoClube,
  termoDoClube,
} from "./clube-cadastro";
import {
  documentoComTipo,
  listaEmTexto,
  textoDoTermoClube,
} from "./clube-termo";

const ID = "b0000000-0000-4000-8000-000000000001";

describe("novoParticipante", () => {
  const manual = {
    origem: "manual",
    cliente_doc: "",
    nome: "Associação Raízes",
    documento: "11.222.333/0001-81",
    formas: ["Pagante", "Pagante"],
    email: "",
    telefone: "(22) 99999-0000",
    contato: "",
  };

  it("cadastro manual: nome, CNPJ validado, formas sem repetir e contato opcional", () => {
    const r = novoParticipante.safeParse(manual);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.doc).toBe("11222333000181");
      expect(r.data.formas).toEqual(["Pagante"]);
      expect(r.data.email).toBeNull();
      expect(r.data.telefone).toBe("(22) 99999-0000");
    }
  });

  it("CPF ou CNPJ com dígito errado é recusado", () => {
    const r = novoParticipante.safeParse({
      ...manual,
      documento: "11.222.333/0001-80",
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toMatch(/CPF ou CNPJ inválido/);
  });

  it("cadastro manual exige o nome", () => {
    expect(novoParticipante.safeParse({ ...manual, nome: " " }).success).toBe(
      false,
    );
  });

  it("cliente da lista de contratos: vale o documento do contrato (11 ou 14 dígitos)", () => {
    const base = { ...manual, origem: "cliente", nome: "", documento: "" };
    expect(
      novoParticipante.safeParse({ ...base, cliente_doc: "11222333000181" })
        .success,
    ).toBe(true);
    expect(
      novoParticipante.safeParse({ ...base, cliente_doc: "123" }).success,
    ).toBe(false);
    expect(
      novoParticipante.safeParse({ ...base, cliente_doc: "" }).success,
    ).toBe(false);
  });
});

describe("lerReais", () => {
  it("1.234,56, zero e vírgula; vazio e negativo recusam", () => {
    expect(lerReais("1.234,56")).toEqual({ ok: true, valor: 1234.56 });
    expect(lerReais("0")).toEqual({ ok: true, valor: 0 });
    expect(lerReais("R$ 50,5")).toEqual({ ok: true, valor: 50.5 });
    expect(lerReais("").ok).toBe(false);
    expect(lerReais("-1").ok).toBe(false);
    expect(lerReais("abc").ok).toBe(false);
  });
});

describe("formulários do detalhe", () => {
  it("termo: ano e data obrigatórios", () => {
    expect(
      termoDoClube.safeParse({
        participante_id: ID,
        ano: "2026",
        assinado_em: "2026-03-10",
      }).success,
    ).toBe(true);
    expect(
      termoDoClube.safeParse({
        participante_id: ID,
        ano: "",
        assinado_em: "2026-03-10",
      }).success,
    ).toBe(false);
    expect(
      termoDoClube.safeParse({
        participante_id: ID,
        ano: "2026",
        assinado_em: "10/03/2026",
      }).success,
    ).toBe(false);
  });

  it("contribuição: competência é aaaa-mm e vira dia 1", () => {
    const ok = contribuicaoDoClube.safeParse({
      participante_id: ID,
      data: "2026-11-10",
      forma: "PIX",
      competencia: "2026-11",
      valor: "0",
      observacao: "",
    });
    expect(ok.success).toBe(true);
    expect(competenciaDoMes("2026-11")).toBe("2026-11-01");
    expect(
      contribuicaoDoClube.safeParse({
        participante_id: ID,
        data: "2026-11-10",
        forma: "PIX",
        competencia: "2026-13",
        valor: "1",
        observacao: "",
      }).success,
    ).toBe(false);
  });

  it("ação e saída pedem tipo e motivo", () => {
    expect(
      acaoDoClube.safeParse({
        participante_id: ID,
        data: "2026-11-10",
        tipo: "",
        observacao: "",
      }).success,
    ).toBe(false);
    expect(
      saidaDoClube.safeParse({
        participante_id: ID,
        saiu_em: "2026-11-10",
        motivo: "",
      }).success,
    ).toBe(false);
    expect(
      saidaDoClube.safeParse({
        participante_id: ID,
        saiu_em: "2026-11-10",
        motivo: "Encerrou a loja",
      }).success,
    ).toBe(true);
  });
});

describe("texto do termo", () => {
  const d = {
    assinadoEm: "2026-03-10",
    validoAte: "2027-03-10",
    ano: 2026,
    validadeMeses: 12,
    participante: { nome: "Café da Serra Ltda", doc: "12345678000190" },
    formas: ["Pagante", "Contribui com resíduos"],
    arp: {
      razaoSocial: "ARP EMPREENDIMENTOS LTDA",
      cnpj: "33.111.139/0001-61",
      cidade: "Nova Friburgo",
    },
  };

  it("leva as partes, o ano, as formas e a validade", () => {
    const t = textoDoTermoClube(d);
    expect(t.data).toBe("Nova Friburgo, 10 de março de 2026.");
    expect(t.titulo).toBe("TERMO DE ADESÃO AO CLUBE SUSTENTARP");
    expect(t.paragrafos[0]).toContain("CAFÉ DA SERRA LTDA");
    expect(t.paragrafos[0]).toContain("CNPJ 12.345.678/0001-90");
    expect(t.paragrafos[0]).toContain("no ano de 2026");
    expect(t.paragrafos[0]).toContain("Pagante e Contribui com resíduos");
    expect(t.paragrafos[2]).toContain("12 meses, até 10 de março de 2027");
    expect(t.assinaturas.map((a) => a.nome)).toEqual([
      "ARP EMPREENDIMENTOS LTDA",
      "CAFÉ DA SERRA LTDA",
    ]);
  });

  it("sem forma o texto não cita forma; validade de 1 mês no singular", () => {
    const t = textoDoTermoClube({ ...d, formas: [], validadeMeses: 1 });
    expect(t.paragrafos[0]).not.toContain("formas de participação");
    expect(t.paragrafos[2]).toContain("1 mês,");
  });

  it("listaEmTexto e documentoComTipo", () => {
    expect(listaEmTexto(["a"])).toBe("a");
    expect(listaEmTexto(["a", "b", "c"])).toBe("a, b e c");
    expect(documentoComTipo("12345678909")).toBe("CPF 123.456.789-09");
  });
});

describe("assinante do termo", () => {
  it("a linha do participante diz quem assinou", () => {
    const t = textoDoTermoClube({
      assinadoEm: "2026-03-10",
      validoAte: "2027-03-10",
      ano: 2026,
      validadeMeses: 12,
      participante: { nome: "Café da Serra Ltda", doc: "12345678000190" },
      formas: [],
      assinante: { nome: "Maria Souza", documento: "12345678909" },
      arp: {
        razaoSocial: "ARP LTDA",
        cnpj: "33.111.139/0001-61",
        cidade: "Nova Friburgo",
      },
    });
    expect(t.assinaturas[1]?.documento).toBe(
      "CNPJ 12.345.678/0001-90 · assinado por Maria Souza (CPF 123.456.789-09)",
    );
  });
});
