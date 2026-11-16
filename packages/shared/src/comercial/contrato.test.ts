import { describe, expect, it } from "vitest";
import {
  areaDosLucs,
  blocosDoModelo,
  colunasDoContrato,
  dadosIniciais,
  esquemaContrato,
  fiadoresNaQuantidade,
  fisicaDaVistoria,
  imovelDosLucs,
  lerDados,
  lerDistrato,
  manterValores,
  mimeDoAnexo,
  naturezaDoCnpj,
  nomeDoArquivo,
  type ParametrosContrato,
  pavimentoDoContrato,
  semValores,
  terminoDoPrazo,
  totalPendencias,
  trocarGarantia,
  unidadesDosLucs,
  valorCaucao,
} from "./contrato";
import { areaPorExtenso, reaisPorExtenso } from "./extenso";

const PARAMETROS: ParametrosContrato = {
  empreendimento_nome: "ARP",
  endereco_cep: "28613-001",
  endereco_logradouro: "Av. Conselheiro Julius Arp",
  endereco_numero: "80",
  endereco_complemento: null,
  endereco_bairro: "Centro",
  endereco_cidade: "Nova Friburgo",
  endereco_uf: "RJ",
  indice_padrao: "IGPM",
  dia_vencimento_padrao: 10,
  caucao_alugueis: 3,
  caucao_prazo_dias: 5,
  capitalizacao_prazo_dias: 7,
  nc004_versao: "JUL/26",
  obras_tapume_dias: 7,
  obras_retirada_dias: 60,
  obras_projetos_dias: 60,
  multa_alugueis: 3,
  vaga_promocional_padrao: 1,
  consumo_agua_padrao: true,
  entrega_tipo_imovel: "Loja",
  entrega_padrao: "Shell / infraestrutura básica",
  entrega_prazo_implantacao_dias: 60,
};

describe("dados do contrato", () => {
  it("rascunho vazio tem todos os blocos com os padrões", () => {
    const d = lerDados({});
    expect(d.imovel.lucs).toEqual([]);
    expect(d.condicoes.tipo_prazo).toBe("meses");
    expect(d.partes.pf.endereco.cep).toBe("");
    expect(d.garantia.tipo).toBe("");
    expect(d.entrega.fisica.paredes).toBe("");
  });

  it("os padrões vêm dos parâmetros", () => {
    const d = dadosIniciais(PARAMETROS);
    expect(d.imovel.empreendimento).toBe("ARP");
    expect(d.imovel.endereco).toEqual({
      cep: "28613001",
      logradouro: "AV. CONSELHEIRO JULIUS ARP",
      numero: "80",
      complemento: "",
      bairro: "CENTRO",
      cidade: "NOVA FRIBURGO",
      uf: "RJ",
    });
    expect(d.condicoes.dia_vencimento).toBe(10);
    expect(d.garantia.caucao.quantidade).toBe(3);
    expect(d.entrega.nc004).toBe("JUL/26");
    expect(d.entrega.prazos).toEqual({ tapume: 7, retirada: 60, projetos: 60 });
    expect(
      dadosIniciais({ ...PARAMETROS, caucao_alugueis: 2 }).garantia.caucao
        .quantidade,
    ).toBe(2);
  });

  it("texto vai em caixa alta, menos e-mail; CPF e CEP ficam só com dígitos", () => {
    const d = esquemaContrato.parse({
      partes: {
        pf: {
          nome: "joão da silva",
          email: " Joao@Exemplo.com ",
          cpf: "529.982.247-25",
          endereco: { cep: "28613-001", logradouro: "rua são joão" },
        },
      },
    });
    expect(d.partes.pf.nome).toBe("JOÃO DA SILVA");
    expect(d.partes.pf.email).toBe("Joao@Exemplo.com");
    expect(d.partes.pf.cpf).toBe("52998224725");
    expect(d.partes.pf.endereco.cep).toBe("28613001");
    expect(d.partes.pf.endereco.logradouro).toBe("RUA SÃO JOÃO");
  });

  it("dado fora do formato não passa", () => {
    expect(
      esquemaContrato.safeParse({ condicoes: { aluguel: -1 } }).success,
    ).toBe(false);
    expect(
      esquemaContrato.safeParse({ condicoes: { data_inicio: "31/12/2026" } })
        .success,
    ).toBe(false);
    expect(
      esquemaContrato.safeParse({ garantia: { tipo: "aval" } }).success,
    ).toBe(false);
  });
});

describe("regras", () => {
  it("caução: aluguel 2.000,00 × 3 = 6.000,00; com 2, 4.000,00", () => {
    expect(valorCaucao(2000, 3)).toBe(6000);
    expect(valorCaucao(2000, 2)).toBe(4000);
    expect(valorCaucao(null, 3)).toBeNull();
    expect(valorCaucao(1333.33, 3)).toBe(3999.99);
  });

  it("dois LUCs vizinhos somam a área e saem como 'Lojas 129 e 130'", () => {
    expect(areaDosLucs([{ abl: 50.01 }, { abl: 33.11 }])).toBe(83.12);
    expect(unidadesDosLucs(["11_129", "11_130"])).toBe("LOJAS 129 E 130");
    expect(unidadesDosLucs(["11_131"])).toBe("131");
  });

  it("LUC escolhido (ou vindo da Ocupação) preenche bloco, pavimento, unidade e área", () => {
    const doEnet = new Map([
      [
        "11_131",
        {
          numero: "11_131",
          local: "Bloco 11",
          piso: "Piso 1",
          tipo: "Loja",
          abl: 42.5,
        },
      ],
    ]);
    const i = imovelDosLucs(
      dadosIniciais(PARAMETROS).imovel,
      ["11_131"],
      doEnet,
    );
    expect(i).toMatchObject({
      lucs: ["11_131"],
      bloco: "BLOCO 11",
      pavimento: "1º PAVIMENTO (TÉRREO)",
      unidade: "131",
      area: 42.5,
      area_enet: 42.5,
    });
  });

  it("valor e área por extenso", () => {
    expect(reaisPorExtenso(2400)).toBe("dois mil e quatrocentos reais");
    expect(areaPorExtenso(30.5)).toBe(
      "30,50 m² (trinta metros e cinquenta centímetros quadrados)",
    );
  });

  it("pavimento sai como no contrato", () => {
    expect(pavimentoDoContrato("Piso 1")).toBe("1º PAVIMENTO (TÉRREO)");
    expect(pavimentoDoContrato("Piso 2")).toBe("2º PAVIMENTO");
    expect(pavimentoDoContrato("Térreo")).toBe("TÉRREO");
  });

  it("término calculado na data fixa (meses e temporário em dias)", () => {
    const c = lerDados({}).condicoes;
    expect(terminoDoPrazo(c)).toBeNull();
    expect(
      terminoDoPrazo({
        ...c,
        inicio: "data_fixa",
        data_inicio: "2026-11-01",
        prazo: 24,
      }),
    ).toBe("2028-10-31");
    expect(
      terminoDoPrazo({
        ...c,
        inicio: "data_fixa",
        tipo_prazo: "dias",
        data_inicio: "2026-11-01",
        prazo: 40,
      }),
    ).toBe("2026-12-10");
  });

  it("trocar de garantia limpa só o bloco da anterior", () => {
    const d = dadosIniciais(PARAMETROS);
    d.garantia.tipo = "seguro_fianca";
    d.garantia.seguro_fianca.apolice = "123";
    d.garantia.caucao.aluguel_base = 2000;
    const g = trocarGarantia(d.garantia, "caucao", PARAMETROS);
    expect(g.tipo).toBe("caucao");
    expect(g.seguro_fianca.apolice).toBe("");
    expect(g.caucao.aluguel_base).toBe(2000);
    const f = trocarGarantia(g, "fiador", PARAMETROS);
    expect(f.caucao.aluguel_base).toBeNull();
    expect(f.fiador.fiadores).toHaveLength(1);
    expect(fiadoresNaQuantidade(f.fiador.fiadores, 3)).toHaveLength(3);
  });

  it("colunas da lista saem dos dados", () => {
    const d = dadosIniciais(PARAMETROS);
    d.imovel.lucs = ["11_132", "11_133"];
    d.imovel.area = 83.12;
    d.partes.tipo = "pj";
    d.partes.pj.razao_social = "ATELIÊ ALECRIM LTDA";
    d.garantia.tipo = "caucao";
    d.condicoes.aluguel = 2400;
    expect(colunasDoContrato(d, "11")).toMatchObject({
      lucs: ["11_132", "11_133"],
      bloco: "11",
      area_m2: 83.12,
      locatario_nome: "ATELIÊ ALECRIM LTDA",
      parte_tipo: "pj",
      garantia: "caucao",
      aluguel: 2400,
      inicio: null,
    });
  });

  it("sem a permissão de valores, o servidor tira os valores e mantém os do banco ao gravar", () => {
    const d = dadosIniciais(PARAMETROS);
    d.condicoes.aluguel = 2400;
    d.condicoes.carencias_descontos = [
      {
        tipo: "desconto_fixo",
        inicio: "2026-11-01",
        fim: "2026-12-31",
        valor: 400,
      },
    ];
    d.garantia.caucao.aluguel_base = 2400;
    const sem = semValores(d);
    expect(sem.condicoes.aluguel).toBeNull();
    expect(sem.condicoes.carencias_descontos[0]?.valor).toBeNull();
    expect(sem.condicoes.carencias_descontos[0]?.inicio).toBe("2026-11-01");
    expect(sem.garantia.caucao.aluguel_base).toBeNull();
    expect(d.condicoes.aluguel).toBe(2400);
    sem.condicoes.prazo = 36;
    const gravado = manterValores(sem, d);
    expect(gravado.condicoes.aluguel).toBe(2400);
    expect(gravado.condicoes.carencias_descontos[0]?.valor).toBe(400);
    expect(gravado.condicoes.prazo).toBe(36);
  });

  it("puxar da vistoria: um item por linha, no item certo", () => {
    const f = fisicaDaVistoria([
      {
        titulo: "Paredes",
        descricao: "drywall sem pintura",
        resposta: "respondido",
      },
      { titulo: "Teto", descricao: "laje aparente", resposta: "respondido" },
      {
        titulo: "Infraestrutura elétrica",
        descricao: "cabo de 10 mm",
        resposta: "respondido",
      },
      {
        titulo: "Tipo de ligação",
        descricao: "monofásico 220V",
        resposta: "respondido",
      },
      {
        titulo: "Ventilação, Janelas, Climatização",
        descricao: "2 janelas",
        resposta: "respondido",
      },
      { titulo: "Banheiro", descricao: null, resposta: "nao_se_aplica" },
      {
        titulo: "Vitrine",
        descricao: "vidro temperado",
        resposta: "respondido",
      },
    ]);
    expect(f.paredes).toBe("DRYWALL SEM PINTURA");
    expect(f.eletrica).toBe("CABO DE 10 MM\nMONOFÁSICO 220V");
    expect(f.ar).toBe("2 JANELAS");
    expect(f.banheiro).toBeUndefined();
    expect(f.observacoes).toBe("VITRINE: VIDRO TEMPERADO");
  });

  it("modelo: cada escolha troca o bloco certo", () => {
    const d = dadosIniciais(PARAMETROS);
    d.partes.tipo = "pj";
    d.garantia.tipo = "seguro_fianca";
    d.condicoes.carencias_descontos = [
      {
        tipo: "carencia",
        inicio: "2026-11-01",
        fim: "2026-11-30",
        valor: null,
      },
    ];
    const b = blocosDoModelo(d);
    expect(b.find((x) => x.bloco === "Partes")?.modelo).toBe(
      "EX 2, EX 4, EX 5, EX 6",
    );
    expect(b.find((x) => x.bloco === "Garantia")?.modelo).toBe("EX 3");
    expect(b.find((x) => x.bloco === "Carência")?.modelo).toBe("EX 5");
    expect(b.find((x) => x.bloco === "Prazo")?.modelo).toBe("EX 1, EX 2");
  });

  it("anexo: só os tipos aceitos e nome seguro no bucket", () => {
    expect(mimeDoAnexo("Apólice.PDF")).toBe("application/pdf");
    expect(mimeDoAnexo("x.exe")).toBeNull();
    expect(nomeDoArquivo("Apólice nº 12 (final).pdf")).toBe(
      "apolice-n-12-final-.pdf",
    );
  });
});

describe("distrato", () => {
  it("soma as pendências do modelo de 31/05/2026: 5.164,03", () => {
    const d = lerDistrato({
      pendencias: {
        aluguel: 3716.29,
        rateio_arp: 792.22,
        rateio_bloco: 106.11,
        rateio_agua: 203.28,
        rateio_foro: 54.68,
        rateio_iptu: 250.25,
        rateio_seguro: 41.2,
        outros: null,
      },
    });
    expect(totalPendencias(d.pendencias)).toBe(5164.03);
  });

  it("locatário em caixa alta e documento só com dígitos", () => {
    const d = lerDistrato({
      locatario: "café serra azul ltda",
      documento: "61.231.836/0001-91",
    });
    expect(d.locatario).toBe("CAFÉ SERRA AZUL LTDA");
    expect(d.documento).toBe("61231836000191");
  });
});

describe("consulta de CNPJ", () => {
  it("natureza da Receita vira a opção da lista", () => {
    expect(naturezaDoCnpj("206-2 - Sociedade Empresária Limitada", 2)).toBe(
      "LTDA (com sócios)",
    );
    expect(naturezaDoCnpj("206-2 - Sociedade Empresária Limitada", 1)).toBe(
      "LTDA (unipessoal)",
    );
    expect(naturezaDoCnpj("205-4 - Sociedade Anônima Fechada", 3)).toBe("S.A.");
    expect(naturezaDoCnpj("213-5 - Empresário (Individual)", 0)).toBe("MEI/ME");
    expect(naturezaDoCnpj("", 0)).toBe("");
  });
});
