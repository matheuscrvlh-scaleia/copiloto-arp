import { describe, expect, it } from "vitest";
import {
  blocoNoTermo,
  type DadosDoTermo,
  dataPorExtenso,
  documentoNoTexto,
  faltaNoTermo,
  nomeDoArquivoDoTermo,
  qualificacaoPadrao,
  salaNoTermo,
  textoDoTermo,
  tipoDoDocumento,
} from "./termo";

const ARP = {
  razaoSocial: "ARP EMPREENDIMENTOS IMOBILIÁRIOS LTDA",
  cnpj: "33.111.139/0001-61",
  endereco: "Av. Conselheiro Julius Arp, nº 80, Centro, Nova Friburgo/RJ",
  cidade: "Nova Friburgo",
};

// Locatário fictício numa caixa do Bloco 12 (teste de aceite da seção 8).
const DADOS: DadosDoTermo = {
  dataEmissao: "2026-10-08",
  locatario: "Ateliê Serrano",
  documento: "00.000.901/0001-00",
  qualificacao: "pessoa jurídica, locatária",
  bloco: "Bloco 12",
  pavimento: "1º pavimento (térreo)",
  sala: "Sala 104",
  projeto: "PE 00615 00 649",
  amperes: 40,
  ligacao: "Monofásica",
  armario: "16",
  rota: "14-250-1980",
  observacaoTecnica: "",
};

describe("texto do termo", () => {
  it("é o modelo de 4.6 palavra por palavra, só com os campos trocados", () => {
    const t = textoDoTermo(DADOS, ARP);
    expect(t.data).toBe("Nova Friburgo, 08 de outubro de 2026.");
    expect(t.titulo).toBe("TERMO DE AUTORIZAÇÃO");
    expect(t.paragrafos).toEqual([
      "Pelo presente Termo, ARP EMPREENDIMENTOS IMOBILIÁRIOS LTDA, pessoa jurídica de direito privado, inscrita no CNPJ/MF sob o nº 33.111.139/0001-61, situada na Av. Conselheiro Julius Arp, nº 80, Centro, Nova Friburgo/RJ, neste ato representada na forma do seu contrato social, vem conceder AUTORIZAÇÃO a ATELIÊ SERRANO, inscrito(a) no CNPJ 00.000.901/0001-00, a fim de que este(a) requeira junto à Concessionária Energisa a instalação e ligação do medidor de energia no Bloco 12, 1º pavimento (térreo), parte, Sala 104, locado pela mesma, situado no endereço acima mencionado.",
      "OBS – Projeto PE 00615 00 649 – disjuntor de 40 amperes, Ligação Monofásica, ARMÁRIO 16, ROTA 14-250-1980.",
    ]);
    expect(t.assinaturas).toEqual([
      {
        nome: "ARP EMPREENDIMENTOS IMOBILIÁRIOS LTDA",
        documento: "33.111.139/0001-61",
      },
      { nome: "ATELIÊ SERRANO", documento: "00.000.901/0001-00" },
    ]);
  });

  it("dados da ARP vêm dos parâmetros; observação técnica só quando preenchida", () => {
    const t = textoDoTermo(
      { ...DADOS, observacaoTecnica: "  Cabo 10 mm², tensão 127/220 V.  " },
      { ...ARP, razaoSocial: "OUTRA RAZÃO", cidade: "Lumiar" },
    );
    expect(t.data.startsWith("Lumiar, ")).toBe(true);
    expect(t.paragrafos[0]).toContain("Termo, OUTRA RAZÃO, pessoa");
    expect(t.paragrafos[2]).toBe("Cabo 10 mm², tensão 127/220 V.");
    expect(t.assinaturas[0]?.nome).toBe("OUTRA RAZÃO");
  });

  it("nada do histórico de ocupantes: só os campos recebidos", () => {
    const texto = JSON.stringify(textoDoTermo(DADOS, ARP));
    expect(texto).not.toMatch(/Doce Trama|anterior|histórico/i);
  });

  it("aponta o que falta", () => {
    expect(faltaNoTermo(DADOS)).toEqual([]);
    expect(
      faltaNoTermo({ ...DADOS, documento: " ", amperes: null, rota: "" }),
    ).toEqual(["CPF ou CNPJ", "Disjuntor (amperes)", "Rota"]);
  });
});

describe("campos", () => {
  it("data por extenso com dia de dois dígitos", () => {
    expect(dataPorExtenso("2026-03-01")).toBe("01 de março de 2026");
    expect(() => dataPorExtenso("2026-13-01")).toThrow();
    expect(() => dataPorExtenso("08/10/2026")).toThrow();
  });

  it("documento: tipo pelos dígitos e qualificação padrão", () => {
    const p = {
      termo_qualificacao_cpf: "pessoa física, locatária",
      termo_qualificacao_cnpj: "pessoa jurídica, locatária",
    };
    expect(tipoDoDocumento("000.000.123-00")).toBe("CPF");
    expect(tipoDoDocumento("00.000.123/0001-00")).toBe("CNPJ");
    expect(tipoDoDocumento("123")).toBeNull();
    expect(qualificacaoPadrao("000.000.123-00", p)).toBe(
      "pessoa física, locatária",
    );
    expect(qualificacaoPadrao("00000123000100", p)).toBe(
      "pessoa jurídica, locatária",
    );
    expect(qualificacaoPadrao("", p)).toBe("");
    expect(documentoNoTexto("000.000.123-00")).toBe("CPF 000.000.123-00");
    expect(documentoNoTexto("CPF 000.000.123-00")).toBe("CPF 000.000.123-00");
    expect(documentoNoTexto("RG 12")).toBe("RG 12");
  });

  it("bloco e sala como no termo", () => {
    expect(blocoNoTermo("4")).toBe("Bloco 04");
    expect(blocoNoTermo("Bloco 12")).toBe("Bloco 12");
    expect(salaNoTermo("104")).toBe("Sala 104");
    expect(salaNoTermo("Loja 3")).toBe("Loja 3");
  });
});

describe("nome do arquivo", () => {
  const MODELO =
    "TERMO DE AUTORIZACAO DE ENERGIA - BL[bloco] - [sala] - [LOCATARIO]";

  it("segue o modelo dos parâmetros, sem acento", () => {
    expect(
      nomeDoArquivoDoTermo(MODELO, {
        bloco: "Bloco 12",
        sala: "Sala 104",
        locatario: "Ateliê Serrano",
      }),
    ).toBe("TERMO DE AUTORIZACAO DE ENERGIA - BL12 - 104 - ATELIE SERRANO");
  });

  it("aceita [LOCATÁRIO] e tira o que o Windows não aceita", () => {
    expect(
      nomeDoArquivoDoTermo("[LOCATÁRIO] bl[BLOCO]-[sala]", {
        bloco: "4",
        sala: "101/102",
        locatario: 'Loja "A": Ótica?',
      }),
    ).toBe("LOJA A OTICA bl04-101 102");
  });
});
