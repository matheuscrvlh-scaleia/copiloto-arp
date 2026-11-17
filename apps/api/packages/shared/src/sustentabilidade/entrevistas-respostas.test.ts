import { describe, expect, it } from "vitest";
import {
  celulasDasRespostas,
  colunasDasRespostas,
  distribuicao,
  filtrarRespostas,
  opcoesDaPergunta,
  textoDaResposta,
  textoDoSetor,
  valoresAutomaticos,
} from "./entrevistas-respostas";
import type { Pergunta } from "./formulario/tipos";
import { NAO_SE_APLICA } from "./formulario/tipos";
import { questionarioV1, questionarioV2 } from "./questionario-inicial";

const V1 = questionarioV1();
const V2 = questionarioV2();
const p = (id: string) =>
  V2.secoes.flatMap((s) => s.perguntas).find((x) => x.id === id) as Pergunta;

describe("texto das respostas", () => {
  it("cada tipo vira o texto da tela e da planilha", () => {
    expect(textoDaResposta(p("q7"), "q7_pouco")).toBe(
      "5 a 3 - pouco conhecimento",
    );
    expect(textoDaResposta(p("q3"), ["q3_saude", "q3_academia"])).toBe(
      "Saúde; Academia",
    );
    expect(textoDaResposta(p("q19"), { n: 2, u: "saco de 100 L" })).toBe(
      "2 saco de 100 L",
    );
    expect(textoDaResposta(p("q10"), { r: "sim", d: 3 })).toBe("Sim: 3");
    expect(textoDaResposta(p("q11"), { r: "nao" })).toBe("Não");
    expect(textoDaResposta(p("q17"), "2025-03-10")).toBe("10/03/2025");
    expect(
      textoDaResposta(p("q20"), {
        q20_organico: "medio",
        q20_vidro: "nao_gera",
      }),
    ).toBe("Orgânico (restos de comida): Médio; Vidro: Não gera");
    expect(textoDaResposta(p("q14"), NAO_SE_APLICA)).toBe("Não se aplica");
    expect(textoDaResposta(p("q14"), "")).toBe("");
  });

  it("setor econômico como texto", () => {
    expect(textoDoSetor(V2, { q3: ["q3_saude", "q3_gastronomico"] })).toBe(
      "Saúde; Gastronômico",
    );
    expect(textoDoSetor(V2, {})).toBeNull();
  });

  it("campos automáticos", () => {
    const a = valoresAutomaticos(V2, {
      empresa: "Loja X",
      lucs: ["11_129", "11_130"],
      tipo: "atualizacao",
      data: "2026-11-16",
    });
    expect(a).toEqual({
      q1: "Loja X",
      q2: "11_129/11_130",
      q4: "Atualização",
      q5: "2026-11-16",
    });
  });
});

describe("planilha igual ao Forms", () => {
  it("uma coluna por pergunta de todas as versões, na ordem da mais nova", () => {
    const colunas = colunasDasRespostas([
      { versao: 1, definicao: V1 },
      { versao: 2, definicao: V2 },
    ]);
    const ids = colunas.map((c) => c.id);
    expect(ids).toHaveLength(48);
    expect(ids.indexOf("q25b")).toBe(ids.indexOf("q25") + 1);
    expect(colunas[0]?.titulo).toBe("1. Nome da empresa");
  });

  it("pergunta que só existe numa versão antiga entra ao lado da vizinha", () => {
    const antiga = structuredClone(V1);
    antiga.secoes[0]?.perguntas.splice(2, 0, {
      ...p("q8"),
      id: "q2x",
      numero: "2x",
      texto: "Pergunta antiga",
    });
    const ids = colunasDasRespostas([
      { versao: 2, definicao: V2 },
      { versao: 1, definicao: antiga },
    ]).map((c) => c.id);
    expect(ids.slice(0, 4)).toEqual(["q1", "q2", "q2x", "q3"]);
  });

  it("usa o texto da versão em que a entrevista foi respondida", () => {
    const colunas = colunasDasRespostas([
      { versao: 1, definicao: V1 },
      { versao: 2, definicao: V2 },
    ]);
    const celulas = celulasDasRespostas(
      V1,
      { q7: "q7_muito", q25b: { n: 1, u: "kg" } },
      colunas,
    );
    const i = (id: string) => colunas.findIndex((c) => c.id === id);
    expect(celulas[i("q7")]).toBe("10 a 9 - muito conhecimento");
    // A 25b não existia na versão 1: fica vazia.
    expect(celulas[i("q25b")]).toBe("");
  });
});

describe("filtros e gráficos da Tela 3", () => {
  const lista = [
    {
      data: "2026-05-10",
      tipo: "primeira",
      bloco: "Bloco 1",
      respostas: {
        q3: ["q3_saude"],
        q7: "q7_pouco",
        q16: "q16_nao",
        q23: ["q23_rss", "q23_oleo"],
      },
    },
    {
      data: "2026-06-10",
      tipo: "atualizacao",
      bloco: "Bloco 2",
      respostas: {
        q3: ["q3_lojas"],
        q7: "q7_muito",
        q16: "q16_sim",
        q23: ["q23_nenhum"],
      },
    },
    {
      data: "2025-01-10",
      tipo: "primeira",
      bloco: "Bloco 1",
      respostas: { q7: NAO_SE_APLICA },
    },
  ];
  const TUDO = {
    de: "2025-11-16",
    ate: "2026-11-16",
    tipo: "",
    setor: "",
    grau: "",
    pgrs: "",
    clube: "",
    especial: "",
    bloco: "",
  };

  it("período, tipo e opções marcadas", () => {
    expect(filtrarRespostas(lista, TUDO)).toHaveLength(2);
    expect(
      filtrarRespostas(lista, { ...TUDO, especial: "q23_oleo" }),
    ).toHaveLength(1);
    expect(
      filtrarRespostas(lista, { ...TUDO, tipo: "atualizacao" })[0]?.bloco,
    ).toBe("Bloco 2");
    expect(
      filtrarRespostas(lista, { ...TUDO, pgrs: "q16_sim", bloco: "Bloco 1" }),
    ).toHaveLength(0);
  });

  it("distribuição conta as respondidas, sem Não se aplica", () => {
    const d = distribuicao(
      p("q7"),
      lista.map((e) => e.respostas),
    );
    expect(d?.respondidas).toBe(2);
    expect(d?.fatias.find((f) => f.id === "q7_pouco")?.n).toBe(1);
    const e = distribuicao(
      p("q23"),
      lista.map((x) => x.respostas),
    );
    expect(e?.fatias.filter((f) => f.n > 0).map((f) => f.id)).toEqual([
      "q23_rss",
      "q23_oleo",
      "q23_nenhum",
    ]);
  });

  it("grade conta por linha e nível", () => {
    const d = distribuicao(p("q20"), [
      { q20: { q20_organico: "muito", q20_papel: "pouco" } },
      { q20: { q20_organico: "muito" } },
    ]);
    expect(d?.grade?.[0]).toEqual({
      linha: "Orgânico (restos de comida)",
      niveis: { pouco: 0, medio: 0, muito: 2, nao_gera: 0 },
    });
  });

  it("opções do filtro saem do questionário", () => {
    expect(opcoesDaPergunta(V2, "q16").map((o) => o.rotulo)).toEqual([
      "Sim",
      "Não",
    ]);
    expect(opcoesDaPergunta(null, "q16")).toEqual([]);
  });
});
