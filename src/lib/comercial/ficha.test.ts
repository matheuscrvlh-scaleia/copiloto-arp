import { describe, expect, it } from "vitest";
import { digitosCnpj, digitosCpf } from "@/lib/documentos";
import {
  avisosDoEnvio,
  blocosDaFicha,
  dadosDaFichaParaContrato,
  destinoDoSalto,
  documentosFaltando,
  type EstadoCivil,
  esquemaDoEnvio,
  LUC_NAO_SEI,
  lerRespostas,
  limparPorTipo,
  nomeDaFicha,
  perguntasDaFicha,
  problemasDoEnvio,
  type RespostasEntrada,
  respostasSchema,
  respostasVazias,
} from "./ficha";

const HOJE = "2026-11-04";
const cpf = (base: string) => base + digitosCpf(base);
const CNPJ = `112223330001${digitosCnpj("112223330001")}`;

const endereco = {
  cep: "28610-000",
  logradouro: "rua monsenhor miranda",
  numero: "120",
  bairro: "centro",
  cidade: "nova friburgo",
  uf: "RJ" as const,
};

const pessoa = (
  nome: string,
  base: string,
  estado_civil: EstadoCivil = "Solteiro(a)",
) => ({
  nome,
  cpf: cpf(base),
  doc_tipo: "RG" as const,
  doc_numero: "12.345.678-9",
  orgao: "detran",
  orgao_uf: "RJ" as const,
  expedicao: "2015-03-10",
  nascimento: "1985-07-21",
  estado_civil,
  endereco,
  telefone: "(22) 99999-1111",
  email: "pessoa@exemplo.test",
});

const conjuge = {
  nome: "marina souza lima",
  cpf: cpf("987654321"),
  doc_tipo: "CNH" as const,
  doc_numero: "0123456789",
  orgao: "detran",
  orgao_uf: "RJ" as const,
  expedicao: "2016-01-02",
  nascimento: "1987-02-03",
  profissao: "professora",
  telefone: "22988887777",
  email: "marina@exemplo.test",
};

const renda = {
  profissao: "comerciante",
  empresa: "loja exemplo",
  endereco,
  telefone: "2225258300",
  renda: 8500,
};

function pf(extra: Partial<RespostasEntrada> = {}): RespostasEntrada {
  return {
    email: "Pessoa@Exemplo.test ",
    aceite: true,
    luc: "11_131",
    tipo: "pf",
    pessoas: [pessoa("joão da silva", "123456789")],
    renda,
    assinatura: "JOAO DA SILVA",
    ...extra,
  };
}

function pj(estadoCivil: EstadoCivil = "Casado(a)"): RespostasEntrada {
  return {
    email: "contato@empresa.test",
    aceite: true,
    luc: LUC_NAO_SEI,
    tipo: "pj",
    empresa: {
      cnpj: CNPJ,
      razao_social: "ateliê alecrim ltda",
      natureza: "LTDA (com sócios)",
      ie_isento: true,
      im: "12345",
      cnae: "4789-0/99",
      ramo: "presentes",
      endereco,
    },
    pessoas: [
      {
        ...pessoa("larissa nogueira pacheco", "111444777", estadoCivil),
        conjuge: estadoCivil === "Casado(a)" ? conjuge : {},
      },
    ],
    renda,
    assinatura: "Larissa Nogueira Pacheco",
  };
}

const ler = (r: RespostasEntrada) => respostasSchema.parse(r);

describe("respostas", () => {
  it("põe em caixa alta, menos o e-mail, e guarda só dígitos", () => {
    const r = ler(pf());
    expect(r.email).toBe("pessoa@exemplo.test");
    expect(r.pessoas[0]?.nome).toBe("JOÃO DA SILVA");
    expect(r.pessoas[0]?.endereco.cep).toBe("28610000");
    expect(r.pessoas[0]?.telefone).toBe("22999991111");
    expect(r.pessoas[0]?.nacionalidade).toBe("BRASILEIRA");
  });

  it("rascunho em branco é válido e começa com o LUC do link", () => {
    const r = respostasVazias("11_131", "pj");
    expect(r.luc).toBe("11_131");
    expect(r.tipo).toBe("pj");
    expect(r.pessoas).toHaveLength(1);
    expect(lerRespostas(null).tipo).toBe("");
    expect(lerRespostas({ tipo: "xx" }).tipo).toBe("");
  });

  it("data inválida vira vazia", () => {
    const r = ler(
      pf({
        pessoas: [{ ...pessoa("a b", "123456789"), nascimento: "2026-02-30" }],
      }),
    );
    expect(r.pessoas[0]?.nascimento).toBe("");
  });
});

describe("saltos (tabela de 4.12)", () => {
  it("4: PJ vai para 5 (CNPJ antes); PF e fiador vão para 15", () => {
    expect(destinoDoSalto(4, ler(pj()))).toBe(5);
    expect(destinoDoSalto(4, ler(pf()))).toBe(15);
    expect(destinoDoSalto(4, ler(pf({ tipo: "fiador" })))).toBe(15);
    expect(destinoDoSalto(4, respostasVazias())).toBeNull();
  });

  it("casado e união estável vão para o cônjuge (27); os outros para 38", () => {
    expect(destinoDoSalto(26, ler(pj("Casado(a)")))).toBe(27);
    expect(destinoDoSalto(26, ler(pj("Em união estável / convivente")))).toBe(
      27,
    );
    for (const e of ["Solteiro(a)", "Divorciado(a)", "Viúvo(a)"] as const)
      expect(destinoDoSalto(26, ler(pj(e)))).toBe(38);
  });

  it("PF solteiro pula a empresa e o cônjuge; PJ casado responde tudo", () => {
    const de = (a: number, b: number) =>
      Array.from({ length: b - a + 1 }, (_, i) => a + i);
    expect(perguntasDaFicha(ler(pf()))).toEqual([
      1,
      2,
      3,
      4,
      ...de(15, 26),
      ...de(38, 48),
    ]);
    expect(perguntasDaFicha(ler(pj()))).toEqual([
      1,
      2,
      3,
      4,
      6,
      5,
      ...de(7, 14),
      ...de(15, 26),
      ...de(27, 37),
      ...de(38, 48),
    ]);
    expect(perguntasDaFicha(respostasVazias())).toEqual([1, 2, 3, 4]);
  });
});

describe("envio", () => {
  it("PF completo passa", () => {
    expect(problemasDoEnvio(ler(pf()), HOJE)).toEqual([]);
    expect(esquemaDoEnvio(HOJE).safeParse(pf()).success).toBe(true);
  });

  it("sem aceite da LGPD não segue", () => {
    const p = problemasDoEnvio(ler(pf({ aceite: false })), HOJE);
    expect(p.map((x) => x.pergunta)).toEqual([2]);
    const z = esquemaDoEnvio(HOJE).safeParse(pf({ aceite: false }));
    expect(z.success).toBe(false);
    expect(z.error?.issues[0]?.path).toEqual(["aceite"]);
  });

  it("PJ com sócio casado pede o cônjuge", () => {
    const sem = pj();
    const s = sem.pessoas?.[0];
    if (s) s.conjuge = {};
    const p = problemasDoEnvio(ler(sem), HOJE);
    expect(p.length).toBeGreaterThan(0);
    expect(p.every((x) => x.pergunta >= 27 && x.pergunta <= 37)).toBe(true);
    expect(p.map((x) => x.campo)).toContain("pessoas.0.conjuge.cpf");
    expect(p.map((x) => x.campo)).not.toContain("pessoas.0.conjuge.telefone2");
    expect(problemasDoEnvio(ler(pj()), HOJE)).toEqual([]);
  });

  it("PJ pede os dados da empresa, com o CNPJ conferido pelos dígitos", () => {
    const r = ler(pj("Solteiro(a)"));
    r.empresa.cnpj = "11222333000100";
    r.empresa.ie_isento = false;
    const p = problemasDoEnvio(r, HOJE);
    expect(p.map((x) => x.campo)).toEqual(["empresa.cnpj", "empresa.ie"]);
  });

  it("confere CPF pelos dígitos e não aceita o mesmo CPF duas vezes", () => {
    const r = ler(pj());
    const s = r.pessoas[0];
    if (!s) throw new Error();
    s.cpf = "12345678900";
    s.conjuge.cpf = r.pessoas[0]?.cpf ?? "";
    const campos = problemasDoEnvio(r, HOJE).map((x) => x.campo);
    expect(campos).toContain("pessoas.0.cpf");
    expect(campos).toContain("pessoas.0.conjuge.cpf");
  });

  it("aluguel com Sim pede a referência; patrimônio Outro pede qual", () => {
    const r = ler(
      pf({
        renda: { ...renda, paga_aluguel: true, patrimonio: ["Outro"] },
      }),
    );
    expect(problemasDoEnvio(r, HOJE).map((x) => x.pergunta)).toEqual([
      46, 47, 47,
    ]);
  });

  it("nome do envio diferente da 15 só avisa", () => {
    const r = ler(pf({ assinatura: "JOAO SILVA" }));
    expect(problemasDoEnvio(r, HOJE)).toEqual([]);
    expect(avisosDoEnvio(r)[0]).toMatch(/diferente do nome da pergunta 15/);
    expect(avisosDoEnvio(ler(pf({ assinatura: "João  da Silva" })))).toEqual(
      [],
    );
  });

  it("documentos obrigatórios que faltam", () => {
    const exigidos = [
      { documento: "Identidade e CPF", obrigatorio: true },
      { documento: "Comprovante de residência", obrigatorio: true },
      { documento: "Extrato", obrigatorio: false },
    ];
    expect(documentosFaltando(exigidos, ["identidade e cpf"])).toEqual([
      "Comprovante de residência",
    ]);
  });

  it("limpa o que não vale para o tipo", () => {
    const r = ler(pj());
    const l = limparPorTipo({ ...r, tipo: "pf" });
    expect(l.empresa.cnpj).toBe("");
    const solteiro = ler(pj("Solteiro(a)"));
    const s = solteiro.pessoas[0];
    if (s) s.conjuge.nome = "SOBRA";
    expect(limparPorTipo(solteiro).pessoas[0]?.conjuge.nome).toBe("");
    expect(nomeDaFicha(r)).toBe("ATELIÊ ALECRIM LTDA");
  });
});

describe("blocos e contrato", () => {
  it("blocos na ordem das perguntas, com cônjuge quando casado", () => {
    const b = blocosDaFicha(ler(pj()));
    expect(b.map((x) => x.titulo)).toEqual([
      "Formulário",
      "Pessoa jurídica",
      "Sócio administrador",
      "Cônjuge ou convivente",
      "Dados profissionais e renda",
      "Envio",
    ]);
    expect(b[1]?.itens[0]?.valor).toMatch(/^11\.222\.333\/0001-/);
  });

  it("PF: dados, cônjuge e as conferências necessárias", () => {
    const r = pf({
      email: "outro@exemplo.test",
      pessoas: [
        {
          ...pessoa("joão da silva", "123456789", "Casado(a)"),
          telefone2: "2225251234",
          conjuge,
        },
      ],
    });
    const c = dadosDaFichaParaContrato({
      id: "f1",
      tipo: "pf",
      origem: "sistema",
      respostas: ler(r),
    });
    expect(c.tipoParte).toBe("pf");
    expect(c.papel).toBe("locatario");
    expect(c.luc).toBe("11_131");
    expect(c.pessoaFisica?.nome).toBe("JOÃO DA SILVA");
    expect(c.pessoaFisica?.profissao).toBe("COMERCIANTE");
    expect(c.conjuge?.nome).toBe("MARINA SOUZA LIMA");
    expect(c.renda.rendaMensal).toBe(8500);
    expect(c.conferencias.join(" ")).toMatch(/dois telefones/);
    expect(c.conferencias.join(" ")).toMatch(/dois e-mails/);
  });

  it("PJ: empresa, representantes e LUC 'Ainda não sei'", () => {
    const c = dadosDaFichaParaContrato({
      id: "f2",
      tipo: "pj",
      origem: "google_forms",
      respostas: ler(pj()),
    });
    expect(c.tipoParte).toBe("pj");
    expect(c.luc).toBeNull();
    expect(c.pessoaJuridica?.inscricaoEstadual).toBe("ISENTO");
    expect(c.representantes).toHaveLength(1);
    expect(c.representantes[0]?.conjuge?.cpf).toHaveLength(11);
    expect(c.destinacao.atividades).toBe("PRESENTES");
    expect(c.conferencias.join(" ")).toMatch(/Google Forms/);
  });
});

describe("consulta do CNPJ", () => {
  it("natureza e CNAE da Receita viram as opções da ficha", async () => {
    const { naturezaDaReceita, cnaeDaReceita } = await import("./ficha");
    expect(naturezaDaReceita("Sociedade Empresária Limitada", 2)).toBe(
      "LTDA (com sócios)",
    );
    expect(naturezaDaReceita("Sociedade Empresária Limitada", 1)).toBe(
      "LTDA (unipessoal)",
    );
    expect(naturezaDaReceita("Sociedade Anônima Fechada", 3)).toBe("S.A.");
    expect(naturezaDaReceita("Associação Privada", 3)).toBe("");
    expect(cnaeDaReceita("4781400 - Comércio varejista de artigos")).toEqual({
      cnae: "4781-4/00",
      ramo: "Comércio varejista de artigos",
    });
  });
});
