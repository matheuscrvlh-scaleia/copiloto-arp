import { describe, expect, it } from "vitest";
import { questionarioV2 } from "../questionario-inicial";
import {
  definicaoSchema,
  NAO_SE_APLICA,
  type Pergunta,
  type Respostas,
  validarRespostas,
} from "./tipos";
import {
  perguntasVisiveis,
  perguntaVisivel,
  progresso,
  respostasVisiveis,
  secoesComPerguntas,
} from "./visibilidade";

// Regras "mostrar só se" do questionário e validação das respostas.

const def = questionarioV2();
const numeros = (ps: Pergunta[]) => ps.map((p) => p.numero);
const achar = (d: typeof def, id: string) =>
  d.secoes.flatMap((s) => s.perguntas).find((p) => p.id === id) as Pergunta;

const NAO_SEPARA_NENHUM: Respostas = {
  q18b: "q18b_nao",
  q23: ["q23_nenhum"],
};

describe("regras do questionário", () => {
  it('"não separa" + "nenhum especial": só A, B, C, D, E e E1', () => {
    const secoes = secoesComPerguntas(def, NAO_SEPARA_NENHUM);
    expect(secoes.map((s) => s.secao.id)).toEqual(["A", "B", "C", "D", "E"]);
    const e = secoes.find((s) => s.secao.id === "E");
    expect(numeros(e?.perguntas ?? [])).toEqual([
      "18",
      "18b",
      "19",
      "20",
      "21",
      "22",
      "23",
    ]);
    const visiveis = numeros(perguntasVisiveis(def, NAO_SEPARA_NENHUM));
    for (const n of ["24", "25", "25b", "26", "28", "31", "32", "46", "17"])
      expect(visiveis).not.toContain(n);
  });

  it("separa + RSS e óleo: E2 e só os blocos marcados em F", () => {
    const r: Respostas = {
      q18b: "q18b_sim",
      q23: ["q23_rss", "q23_oleo"],
      q16: "q16_sim",
    };
    const v = numeros(perguntasVisiveis(def, r));
    expect(v).toEqual(expect.arrayContaining(["17", "24", "25", "25b", "31"]));
    expect(v).not.toContain("19");
    const f = secoesComPerguntas(def, r).find((s) => s.secao.id === "F");
    expect(numeros(f?.perguntas ?? [])).toEqual([
      "32",
      "33",
      "34",
      "43",
      "44",
      "45",
    ]);
  });

  it("sem resposta na 18b nem E1 nem E2; 17 só com 16 = sim", () => {
    const v = numeros(perguntasVisiveis(def, {}));
    expect(v).not.toContain("19");
    expect(v).not.toContain("24");
    expect(perguntaVisivel(achar(def, "q17"), { q16: "q16_nao" }, def)).toBe(
      false,
    );
    expect(perguntaVisivel(achar(def, "q17"), { q16: "q16_sim" }, def)).toBe(
      true,
    );
    expect(
      perguntaVisivel(achar(def, "q17"), { q16: NAO_SE_APLICA }, def),
    ).toBe(false);
  });

  it("em cadeia: se a pergunta de que depende some, esta some também", () => {
    const d = questionarioV2();
    achar(d, "q23").mostrar_se = { pergunta_id: "q18b", valor: "q18b_sim" };
    const r = { q18b: "q18b_nao", q23: ["q23_rss"] };
    expect(perguntaVisivel(achar(d, "q23"), r, d)).toBe(false);
    expect(perguntaVisivel(achar(d, "q32"), r, d)).toBe(false);
    expect(
      perguntaVisivel(achar(d, "q32"), { ...r, q18b: "q18b_sim" }, d),
    ).toBe(true);
  });

  it("inativa, seção inativa, regra quebrada ou circular escondem", () => {
    const d = questionarioV2();
    achar(d, "q14").ativa = false;
    const c = d.secoes.find((s) => s.id === "B");
    if (c) c.ativa = false;
    achar(d, "q15").mostrar_se = { pergunta_id: "q99", valor: "x" };
    achar(d, "q12").mostrar_se = { pergunta_id: "q13", valor: "q13_sim" };
    achar(d, "q13").mostrar_se = { pergunta_id: "q12", valor: "q12_sim" };
    const r = { q12: "q12_sim", q13: "q13_sim" };
    for (const id of ["q14", "q6", "q15", "q12", "q13"])
      expect(perguntaVisivel(achar(d, id), r, d)).toBe(false);
  });

  it("sim ou não serve de condição", () => {
    const d = questionarioV2();
    achar(d, "q11").mostrar_se = { pergunta_id: "q10", valor: "sim" };
    expect(
      perguntaVisivel(achar(d, "q11"), { q10: { r: "sim", d: 2 } }, d),
    ).toBe(true);
    expect(perguntaVisivel(achar(d, "q11"), { q10: { r: "nao" } }, d)).toBe(
      false,
    );
  });
});

describe("progresso e respostas guardadas", () => {
  it("conta só as visíveis, sem os automáticos; não se aplica conta", () => {
    const r: Respostas = {
      ...NAO_SEPARA_NENHUM,
      q6: "Ana, gerente",
      q7: NAO_SE_APLICA,
      q8: 0,
      q14: "  ",
    };
    // visíveis não automáticas: 3, 6–11, 12–15, 16, 18, 18b, 19–22, 23 = 19;
    // escondidas: 17, E2 (9) e F (15) = 25
    expect(progresso(def, r)).toEqual({
      respondidas: 5,
      total: 19,
      escondidas: 25,
    });
  });

  it("tira as respostas de perguntas que sumiram", () => {
    const r = { ...NAO_SEPARA_NENHUM, q24: "por cor", q19: { n: 2, u: "kg" } };
    expect(respostasVisiveis(def, r)).toEqual({
      ...NAO_SEPARA_NENHUM,
      q19: { n: 2, u: "kg" },
    });
  });
});

describe("validar respostas", () => {
  const completas: Respostas = {
    ...NAO_SEPARA_NENHUM,
    q1: "Loja X",
    q6: "Ana, gerente",
    q7: "q7_mediano",
    q16: "q16_nao",
  };

  it("obrigatória visível vazia pede resposta ou Não se aplica", () => {
    expect(validarRespostas(def, {})).toEqual({
      q6: "Responda ou marque “Não se aplica”.",
      q7: "Responda ou marque “Não se aplica”.",
      q16: "Responda ou marque “Não se aplica”.",
      q18b: "Responda ou marque “Não se aplica”.",
    });
    expect(validarRespostas(def, completas)).toEqual({});
    expect(validarRespostas(def, { ...completas, q7: NAO_SE_APLICA })).toEqual(
      {},
    );
    expect(validarRespostas(def, { ...completas, q1: NAO_SE_APLICA })).toEqual({
      q1: "Campo automático não aceita “Não se aplica”.",
    });
  });

  it("obrigatória escondida não é cobrada; resposta de escondida é ignorada", () => {
    const d = questionarioV2();
    achar(d, "q17").obrigatoria = true;
    expect(validarRespostas(d, completas)).toEqual({});
    expect(
      validarRespostas(d, { ...completas, q16: "q16_sim" }),
    ).toHaveProperty("q17");
    expect(validarRespostas(d, { ...completas, q24: 123 })).toEqual({});
  });

  it("valor de cada tipo", () => {
    const erros = validarRespostas(def, {
      ...completas,
      q3: ["q3_saude", "q3_xxx"],
      q8: "dez",
      q10: { r: "talvez" },
      q11: { r: "sim", d: "copa pequena" },
      q19: { n: 3, u: "caminhão" },
      q20: { q20_organico: "pouco", q20_vidro: "bastante" },
      q22: "q22_ruas",
    });
    expect(erros).toEqual({
      q3: "Opção inexistente ou inativa.",
      q8: "Informe um número.",
      q10: "Responda sim ou não e a quantidade (número).",
      q19: "Unidade não aceita nesta pergunta.",
      q20: "Marque Pouco, Médio, Muito ou Não gera.",
    });
  });

  it("data, opção inativa e grade obrigatória", () => {
    const d = questionarioV2();
    const p7 = achar(d, "q7");
    for (const o of p7.opcoes) if (o.id === "q7_pouco") o.ativa = false;
    achar(d, "q20").obrigatoria = true;
    expect(
      validarRespostas(d, {
        ...completas,
        q16: "q16_sim",
        q17: "2026-02-30",
        q7: "q7_pouco",
        q20: { q20_organico: "pouco" },
      }),
    ).toEqual({
      q7: "Opção inexistente ou inativa.",
      q17: "Data inválida.",
      q20: "Marque um nível em cada linha.",
    });
    expect(
      validarRespostas(d, {
        ...completas,
        q16: "q16_sim",
        q17: "2024-02-29",
        q20: NAO_SE_APLICA,
      }),
    ).toEqual({});
  });
});

describe("definicaoSchema", () => {
  it("aceita o questionário e recusa ids repetidos", () => {
    expect(definicaoSchema.safeParse(def).success).toBe(true);
    const d = questionarioV2();
    achar(d, "q8").id = "q9";
    const r = definicaoSchema.safeParse(d);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("Id de pergunta repetido: q9");
  });
});
