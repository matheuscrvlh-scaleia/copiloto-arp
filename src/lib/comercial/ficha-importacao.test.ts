import { describe, expect, it } from "vitest";
import { digitosCnpj, digitosCpf } from "@/lib/documentos";
import {
  type Celula,
  COLUNAS_FORMS,
  conferirCabecalho,
  lerCarimbo,
  lerData,
  lerFichasDoForms,
} from "./ficha-importacao";

const CPF = `123456789${digitosCpf("123456789")}`;
const CPF2 = `987654321${digitosCpf("987654321")}`;
const CNPJ = `112223330001${digitosCnpj("112223330001")}`;

// Cabeçalho parecido com o do Forms (texto das perguntas).
const CABECALHO = [
  "Carimbo de data/hora",
  "Endereço de e-mail",
  "Em razão das regras estabelecidas pela LGPD (Lei 13.709)...",
  "Imóvel pretendido (bloco e nº da unidade)",
  "Que tipo de formulário você seguirá?",
  "Razão Social",
  "CNPJ",
  "Natureza Jurídica",
  "Inscrição Estadual",
  "Inscrição Municipal",
  "CNAE principal (nº)",
  "Ramo de atuação",
  "Endereço completo (com CEP)",
  "Capital social atual",
  "Última alteração social",
  "Nome completo",
  "CPF",
  "Documento de identificação (RG, CNH, certidão etc.)",
  "Órgão expedidor (nome e UF)",
  "Data de expedição",
  "Data de nascimento",
  "Nacionalidade",
  "Estado civil",
  "Endereço completo (com CEP)",
  "Telefone (com DDD)",
  "Telefone secundário",
  "E-mail",
  "Nome completo do cônjuge",
  "CPF do cônjuge",
  "Documento de identificação",
  "Data de expedição",
  "Órgão expedidor",
  "Data de nascimento",
  "Nacionalidade",
  "Profissão / ocupação",
  "Telefone",
  "Telefone secundário",
  "E-mail",
  "Profissão",
  "Empresa",
  "Endereço completo da empresa (com CEP)",
  "Telefone",
  "E-mail",
  "Renda mensal",
  "Referência pessoal (nome e telefone)",
  "Outras rendas e origem",
  "Patrimônio",
  "Paga aluguel? Se sim, dê uma referência, com contato",
  "Ao preencher seu nome completo abaixo... Nome completo",
];

function linha(
  valores: Record<number, Celula>,
  carimbo: Celula = "05/10/2026 14:32:10",
) {
  const l: Celula[] = Array(49).fill("");
  l[0] = carimbo;
  l[2] = "Sim, aceito";
  for (const [k, v] of Object.entries(valores)) l[Number(k)] = v;
  return l;
}

const pf = linha({
  1: "maria@exemplo.test",
  3: "11_131",
  4: "Locatário Pessoa Física",
  15: "Maria Souza",
  16: CPF,
  17: "RG 12.345.678-9",
  18: "DETRAN/RJ",
  19: "10/03/2015",
  20: "21/07/1985",
  21: "Brasileira",
  22: "Casada",
  23: "Rua das Flores, 10, Centro, Nova Friburgo RJ 28610-000",
  24: "(22) 99999-1111",
  26: "maria@exemplo.test",
  27: "José Souza",
  28: CPF2,
  29: "CNH 0123",
  30: "02/01/2016",
  31: "DETRAN RJ",
  32: "03/02/1987",
  34: "Professor",
  35: "22988887777",
  37: "jose@exemplo.test",
  39: "Loja X",
  43: "R$ 5.000,00",
  44: "Ana - (22) 98888-7777",
  46: "Veículos, Moto",
  47: "Sim, Imobiliária Y (22) 2525-0000",
  48: "Maria Souza",
});

const pj = linha({
  1: "contato@empresa.test",
  4: "Locatário Pessoa Jurídica",
  5: "Empresa Teste Ltda",
  6: CNPJ,
  7: "LTDA (com sócios)",
  8: "isento",
  9: "N/H",
  14: "7 de janeiro de 2019",
  15: "Carlos Lima",
  16: CPF,
  22: "Solteiro",
});

describe("cabeçalho", () => {
  it("são 49 colunas: data e hora e as perguntas 1 a 48", () => {
    expect(COLUNAS_FORMS).toHaveLength(49);
    expect(COLUNAS_FORMS.map((c) => c.pergunta).slice(1)).toEqual(
      Array.from({ length: 48 }, (_, i) => i + 1),
    );
    expect(conferirCabecalho(CABECALHO)).toEqual([]);
  });

  it("uma coluna a menos bloqueia e diz qual faltou", () => {
    const menos = CABECALHO.filter((_, i) => i !== 16);
    const r = lerFichasDoForms([menos, pf], new Map());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.cabecalho[0]).toMatchObject({ coluna: 17, esperado: "CPF" });
  });

  it("coluna a mais também bloqueia", () => {
    expect(conferirCabecalho([...CABECALHO, "Pontuação"])).toEqual([
      { coluna: 50, esperado: "(nenhuma)", veio: "Pontuação" },
    ]);
  });
});

describe("datas", () => {
  it("lê os formatos do Forms", () => {
    expect(lerData("07/01/2019")).toBe("2019-01-07");
    expect(lerData("7 de janeiro de 2019")).toBe("2019-01-07");
    expect(lerData("1º de março de 2020")).toBe("2020-03-01");
    expect(lerData(new Date("2020-05-06T00:00:00Z"))).toBe("2020-05-06");
    expect(lerData(45000)).toBe("2023-03-15");
    expect(lerData("sem data")).toBe("");
    expect(lerCarimbo("05/10/2026 14:32:10")).toBe("2026-10-05T17:32:10.000Z");
  });
});

describe("linhas", () => {
  it("PF casada: separa documento, órgão e referências; cônjuge entra", () => {
    const r = lerFichasDoForms([CABECALHO, pf, pj], new Map());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [a, b] = r.previa.fichas;
    expect(r.previa.linhas).toBe(2);
    expect(a?.tipo).toBe("pf");
    expect(a?.nome).toBe("MARIA SOUZA");
    expect(a?.documento).toBe(CPF);
    expect(a?.luc).toBe("11_131");
    expect(a?.enviadaEm).toBe("2026-10-05T17:32:10.000Z");
    const p = a?.respostas.pessoas[0];
    expect(p?.doc_tipo).toBe("RG");
    expect(p?.doc_numero).toBe("12.345.678-9");
    expect(p).toMatchObject({ orgao: "DETRAN", orgao_uf: "RJ" });
    expect(p?.estado_civil).toBe("Casado(a)");
    expect(p?.endereco.cep).toBe("28610000");
    expect(p?.conjuge.nome).toBe("JOSÉ SOUZA");
    expect(p?.conjuge.orgao_uf).toBe("RJ");
    const d = a?.respostas.renda;
    expect(d?.renda).toBe(5000);
    expect(d?.referencia_telefone).toBe("22988887777");
    expect(d?.patrimonio).toEqual(["Veículos", "Outro"]);
    expect(d?.patrimonio_outro).toBe("MOTO");
    expect(d?.paga_aluguel).toBe(true);
    expect(d?.aluguel_telefone).toBe("2225250000");

    expect(b?.tipo).toBe("pj");
    expect(b?.nome).toBe("EMPRESA TESTE LTDA");
    expect(b?.luc).toBeNull();
    expect(b?.respostas.empresa).toMatchObject({
      ie_isento: true,
      im_nao_tem: true,
      natureza: "LTDA (com sócios)",
      ultima_alteracao: "2019-01-07",
    });
  });

  it("CPF ou CNPJ que já tem ficha avisa e mostra a atual; repetido no arquivo também", () => {
    const existentes = new Map([
      [CNPJ, { id: "f-atual", nome: "EMPRESA TESTE LTDA" }],
    ]);
    const r = lerFichasDoForms([CABECALHO, pf, pj, pf], existentes);
    if (!r.ok) throw new Error();
    expect(r.previa.duplicadas).toBe(2);
    expect(r.previa.avisos.find((a) => a.fichaId)).toMatchObject({
      linha: 3,
      fichaId: "f-atual",
    });
    expect(r.previa.fichas[2]?.avisos).toContain(
      "Mesmo CPF ou CNPJ da linha 2.",
    );
    expect(r.previa.comAviso).toBe(2);
  });

  it("sem aceite da LGPD, sem data ou tipo fora da lista não entra", () => {
    const sem = linha({ 4: "Locatário Pessoa Física" });
    sem[2] = "";
    const r = lerFichasDoForms(
      [
        CABECALHO,
        sem,
        linha({ 4: "Outro" }),
        linha({ 4: "Fiador(a)" }, ""),
        Array(49).fill(""),
      ],
      new Map(),
    );
    if (!r.ok) throw new Error();
    expect(r.previa.linhas).toBe(3);
    expect(r.previa.fichas).toHaveLength(0);
    expect(r.previa.ignoradas.map((x) => x.linha)).toEqual([2, 3, 4]);
  });
});
