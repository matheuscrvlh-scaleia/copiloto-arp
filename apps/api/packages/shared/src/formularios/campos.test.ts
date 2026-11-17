import { describe, expect, it } from "vitest";
import {
  type Campo,
  camposSchema,
  novoCampo,
  problemasDosCampos,
  resumir,
  textoDaResposta,
  titulosDasPerguntas,
  validarRespostas,
} from "./campos";
import {
  configuracoesSchema,
  deBrasilia,
  motivoFechado,
  paraBrasiliaLocal,
  problemaParaPublicar,
  situacaoEfetiva,
} from "./formulario";

const campo = (tipo: Campo["tipo"], extra: Partial<Campo> = {}): Campo => ({
  ...novoCampo(tipo),
  titulo: `Pergunta ${tipo}`,
  ...extra,
});

describe("perguntas do editor", () => {
  it("pergunta nova já vem válida e com id curto", () => {
    const c = novoCampo("unica");
    expect(c.id).toMatch(/^[a-z0-9]{8}$/);
    expect(c.opcoes).toEqual(["Opção 1", "Opção 2"]);
    expect(camposSchema.safeParse([c]).success).toBe(true);
  });

  it("aponta título vazio, opção vazia ou repetida e escala invertida", () => {
    const problemas = problemasDosCampos([
      campo("texto", { titulo: " " }),
      campo("unica", { opcoes: ["A", "a"] }),
      campo("lista", { opcoes: [""] }),
      campo("escala", { escalaMin: 1, escalaMax: 1 as never }),
      campo("secao", { titulo: "" }),
    ]);
    expect(problemas).toEqual([
      "Pergunta 1: escreva a pergunta.",
      "Pergunta 2: há opção repetida.",
      "Pergunta 3: inclua ao menos uma opção.",
      "Pergunta 3: há opção em branco.",
      "Pergunta 4: o fim da escala precisa ser maior que o início.",
      "Pergunta 5: dê um título à seção.",
    ]);
  });

  it("id repetido não passa", () => {
    const a = campo("texto");
    expect(problemasDosCampos([a, { ...a }])).toContain(
      "Pergunta 2: identificador repetido.",
    );
  });

  it("só publica com ao menos uma pergunta que recebe resposta", () => {
    expect(problemaParaPublicar([campo("secao")])).toMatch(/ao menos uma/);
    expect(problemaParaPublicar([campo("secao"), campo("texto")])).toBeNull();
  });
});

describe("respostas de quem preenche", () => {
  const campos = [
    campo("secao"),
    campo("texto", { id: "nome0001", obrigatorio: true }),
    campo("email", { id: "email001" }),
    campo("telefone", { id: "tel00001" }),
    campo("numero", { id: "num00001" }),
    campo("data", { id: "data0001" }),
    campo("documento", { id: "doc00001" }),
    campo("unica", { id: "unica001", opcoes: ["Loja", "Quiosque"] }),
    campo("multipla", { id: "mult0001", opcoes: ["A", "B", "C"] }),
    campo("escala", { id: "nota0001", escalaMin: 0, escalaMax: 10 }),
    campo("sim_nao", { id: "sim00001" }),
  ];

  it("normaliza cada tipo e ignora chave que não é pergunta", () => {
    const r = validarRespostas(campos, {
      nome0001: "  Ana  ",
      email001: "Ana@Exemplo.com",
      tel00001: "(22) 99999-1234",
      num00001: "1.234,5",
      data0001: "2026-11-06",
      doc00001: "529.982.247-25",
      unica001: "Loja",
      mult0001: ["C", "A", "A"],
      nota0001: "9",
      sim00001: "nao",
      invasor: "x",
    });
    expect(r.erros).toEqual({});
    expect(r.respostas).toEqual({
      nome0001: "Ana",
      email001: "ana@exemplo.com",
      tel00001: "22999991234",
      num00001: 1234.5,
      data0001: "2026-11-06",
      doc00001: "52998224725",
      unica001: "Loja",
      mult0001: ["A", "C"],
      nota0001: 9,
      sim00001: false,
    });
  });

  it("obrigatória vazia, formato errado e opção que não existe dão erro", () => {
    const r = validarRespostas(campos, {
      nome0001: "   ",
      email001: "ana@",
      tel00001: "1234",
      num00001: "abc",
      data0001: "2026-13-40",
      doc00001: "111.111.111-11",
      unica001: "Sala",
      mult0001: ["D"],
      nota0001: 11,
      sim00001: "talvez",
    });
    expect(Object.keys(r.erros).sort()).toEqual(
      [
        "nome0001",
        "email001",
        "tel00001",
        "num00001",
        "data0001",
        "doc00001",
        "unica001",
        "mult0001",
        "nota0001",
        "sim00001",
      ].sort(),
    );
    expect(r.erros.nome0001).toBe("Resposta obrigatória.");
    expect(r.respostas).toEqual({});
  });

  it("texto longo demais é recusado", () => {
    const r = validarRespostas([campo("texto", { id: "curto001" })], {
      curto001: "x".repeat(501),
    });
    expect(r.erros.curto001).toMatch(/500/);
  });

  it("guarda o título de cada pergunta respondível", () => {
    expect(titulosDasPerguntas(campos.slice(0, 2))).toEqual({
      nome0001: "Pergunta texto",
    });
  });
});

describe("texto e resumo das respostas", () => {
  it("escreve cada tipo como na tela", () => {
    expect(textoDaResposta("sim_nao", true)).toBe("Sim");
    expect(textoDaResposta("multipla", ["A", "C"])).toBe("A; C");
    expect(textoDaResposta("data", "2026-11-06")).toBe("06/11/2026");
    expect(textoDaResposta("documento", "52998224725")).toBe("529.982.247-25");
    expect(textoDaResposta("telefone", "22999991234")).toBe("(22) 99999-1234");
    expect(textoDaResposta("numero", 1234.5)).toBe("1.234,50");
    expect(textoDaResposta("escala", 9)).toBe("9");
    expect(textoDaResposta(null, undefined)).toBe("");
  });

  it("conta opções, faz a média da nota e lista os textos recentes", () => {
    const multipla = campo("multipla", { opcoes: ["A", "B"] });
    expect(resumir(multipla, [["A"], ["A", "B"], undefined])).toEqual({
      tipo: "contagem",
      respondidas: 2,
      itens: [
        { rotulo: "A", n: 2 },
        { rotulo: "B", n: 1 },
      ],
    });
    const nota = resumir(
      campo("escala", { escalaMin: 1, escalaMax: 3 }),
      [3, 2, 3],
    );
    expect(nota).toMatchObject({ tipo: "nota", respondidas: 3 });
    if (nota.tipo === "nota") {
      expect(nota.media).toBeCloseTo(8 / 3);
      expect(nota.itens.map((i) => i.n)).toEqual([0, 1, 2]);
    }
    expect(resumir(campo("numero"), [10, 2, 6])).toEqual({
      tipo: "numero",
      respondidas: 3,
      media: 6,
      min: 2,
      max: 10,
    });
    const texto = resumir(campo("texto"), ["a", "", "b", "c", "d", "e", "f"]);
    expect(texto).toEqual({
      tipo: "texto",
      respondidas: 6,
      recentes: ["a", "b", "c", "d", "e"],
    });
  });
});

describe("link e configurações", () => {
  const base = {
    situacao: "publicado" as const,
    encerra_em: null,
    limite_respostas: null,
    total_respostas: 0,
  };
  const agora = new Date("2026-11-06T15:00:00Z");

  it("publicado vira encerrado pela data ou pelo limite", () => {
    expect(situacaoEfetiva(base, agora)).toBe("publicado");
    expect(
      situacaoEfetiva({ ...base, encerra_em: "2026-11-06T14:59:00Z" }, agora),
    ).toBe("encerrado");
    expect(
      situacaoEfetiva(
        { ...base, limite_respostas: 3, total_respostas: 3 },
        agora,
      ),
    ).toBe("encerrado");
    expect(motivoFechado(null, agora)).toBe("inexistente");
    expect(motivoFechado({ ...base, situacao: "rascunho" }, agora)).toBe(
      "rascunho",
    );
    expect(motivoFechado(base, agora)).toBeNull();
  });

  it("data de encerramento vai e volta pelo horário de Brasília", () => {
    expect(deBrasilia("2026-11-30T18:00")).toBe("2026-11-30T21:00:00.000Z");
    expect(paraBrasiliaLocal("2026-11-30T21:00:00.000Z")).toBe(
      "2026-11-30T18:00",
    );
    expect(deBrasilia("")).toBeNull();
  });

  it("limite vazio é sem limite; zero não vale", () => {
    const ok = configuracoesSchema.parse({
      mensagem_final: " Obrigado! ",
      encerra_em: "",
      limite_respostas: "",
    });
    expect(ok).toEqual({
      mensagem_final: "Obrigado!",
      encerra_em: "",
      limite_respostas: null,
    });
    expect(
      configuracoesSchema.safeParse({
        mensagem_final: "",
        encerra_em: "",
        limite_respostas: "0",
      }).success,
    ).toBe(false);
  });
});
