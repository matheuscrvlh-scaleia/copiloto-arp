import { describe, expect, it } from "vitest";
import { conferirAntesDePublicar, todasAsPerguntas } from "./formulario/editor";
import { definicaoSchema } from "./formulario/tipos";
import {
  QUESTIONARIO_V2_EXTRA,
  questionarioV1,
  questionarioV2,
} from "./questionario-inicial";

describe("questionário inicial (Forms Questionário RSU)", () => {
  const v1 = questionarioV1();
  const v2 = questionarioV2();
  const ps = todasAsPerguntas(v2);

  it("v1: 46 perguntas numeradas + 18b; v2 acrescenta a 25b", () => {
    const n1 = todasAsPerguntas(v1).map((p) => p.numero);
    expect(n1).toHaveLength(47);
    for (let i = 1; i <= 46; i++) expect(n1).toContain(String(i));
    expect(n1).toContain("18b");
    expect(n1).not.toContain("25b");
    expect(ps.map((p) => p.numero)).toHaveLength(48);
    expect(QUESTIONARIO_V2_EXTRA).toEqual(["q25b"]);
    expect(ps.every((p) => p.id === `q${p.numero}`)).toBe(true);
  });

  it("seções A–F, válidas e publicáveis", () => {
    expect(v2.secoes.map((s) => `${s.id} ${s.nome}`)).toEqual([
      "A Identificação",
      "B Entrevistado e estabelecimento",
      "C SustentArp",
      "D PGRS",
      "E Resíduos",
      "F Resíduos especiais",
    ]);
    expect(definicaoSchema.safeParse(v1).success).toBe(true);
    expect(definicaoSchema.safeParse(v2).success).toBe(true);
    expect(conferirAntesDePublicar(v1, {})).toEqual([]);
    expect(conferirAntesDePublicar(v2, {})).toEqual([]);
  });

  it("1, 2, 4 e 5 automáticos e travados; fontes de indicador", () => {
    const travadas = ps.filter((p) => p.travada);
    expect(travadas.map((p) => `${p.numero}:${p.auto}`)).toEqual([
      "1:empresa",
      "2:luc",
      "4:situacao",
      "5:data",
    ]);
    expect(travadas.every((p) => p.tipo === "auto")).toBe(true);
    expect(
      ps
        .filter((p) => p.fonte_indicador)
        .map((p) => p.numero)
        .sort(),
    ).toEqual([
      "12",
      "13",
      "16",
      "18b",
      "20",
      "22",
      "23",
      "26",
      "28",
      "3",
      "7",
    ]);
    expect(ps.filter((p) => p.obrigatoria).map((p) => p.numero)).toEqual([
      "6",
      "7",
      "16",
      "18b",
    ]);
  });

  it("regras: 17←16, E1←18b não, E2←18b sim, F←23", () => {
    const regra = (n: string) => {
      const r = ps.find((p) => p.numero === n)?.mostrar_se;
      return r ? `${r.pergunta_id}=${r.valor}` : null;
    };
    expect(regra("17")).toBe("q16=q16_sim");
    for (const n of ["19", "20", "21", "22"])
      expect(regra(n)).toBe("q18b=q18b_nao");
    for (const n of ["24", "25", "25b", "26", "27", "28", "29", "30", "31"])
      expect(regra(n)).toBe("q18b=q18b_sim");
    for (const n of ["32", "33", "34"]) expect(regra(n)).toBe("q23=q23_rss");
    for (const n of ["35", "36", "37", "38"])
      expect(regra(n)).toBe("q23=q23_ri");
    for (const n of ["39", "40", "41", "42"])
      expect(regra(n)).toBe("q23=q23_rcc");
    for (const n of ["43", "44", "45"]) expect(regra(n)).toBe("q23=q23_oleo");
    expect(regra("46")).toBe("q23=q23_caixa_gordura");
    expect(regra("23")).toBeNull();
  });

  it("opções com ids estáveis e textos do Forms", () => {
    const p3 = ps.find((p) => p.id === "q3");
    expect(p3?.opcoes.map((o) => o.id)).toContain("q3_saude");
    expect(p3?.opcoes).toHaveLength(7);
    expect(ps.find((p) => p.id === "q22")?.opcoes).toHaveLength(8);
    expect(ps.find((p) => p.id === "q28")?.opcoes).toHaveLength(16);
    expect(ps.find((p) => p.id === "q20")?.opcoes.map((o) => o.texto)).toEqual([
      "Orgânico (restos de comida)",
      "Plástico",
      "Papel/papelão",
      "Vidro",
      "Metal",
      "Não reciclado (lixo de banheiro)",
    ]);
    for (const p of ps)
      for (const o of p.opcoes) expect(o.id.startsWith(`${p.id}_`)).toBe(true);
    const unidades = ps.find((p) => p.id === "q19")?.unidades;
    expect(unidades).toContain("saco de 100 L");
    expect(ps.find((p) => p.id === "q46")?.ajuda).toContain("caixa de gordura");
  });

  it("cada chamada devolve objetos novos", () => {
    const a = questionarioV2();
    const p = todasAsPerguntas(a).find((x) => x.id === "q19");
    if (p?.mostrar_se) p.mostrar_se.valor = "mexido";
    const b = questionarioV2();
    expect(
      todasAsPerguntas(b).find((x) => x.id === "q20")?.mostrar_se?.valor,
    ).toBe("q18b_nao");
    expect(
      todasAsPerguntas(b).find((x) => x.id === "q19")?.mostrar_se?.valor,
    ).toBe("q18b_nao");
  });
});
