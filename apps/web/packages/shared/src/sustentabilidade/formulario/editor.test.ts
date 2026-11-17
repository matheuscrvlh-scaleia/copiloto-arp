import { describe, expect, it } from "vitest";
import { questionarioV1, questionarioV2 } from "../questionario-inicial";
import {
  adicionarOpcao,
  type ContextoEditor,
  conferirAntesDePublicar,
  consequenciasDeInativar,
  criarPergunta,
  criarSecao,
  diferencas,
  duplicarPergunta,
  editarOpcao,
  editarPergunta,
  excluirOpcao,
  excluirPergunta,
  excluirSecao,
  type Falha,
  inativarOpcao,
  inativarPergunta,
  inativarSecao,
  moverOpcao,
  moverPergunta,
  moverSecao,
  type Resultado,
  reativarOpcao,
  reativarPergunta,
  reativarSecao,
  renomearSecao,
  restaurarVersao,
  type Sucesso,
  todasAsPerguntas,
  type Uso,
} from "./editor";
import type { DefinicaoFormulario, Pergunta } from "./tipos";

// Editor 4.13 sobre o questionário real (versão 2), com o uso do mockup:
// perguntas do Forms com 23 respostas, as condicionais com 11, 25b sem uso.

const USO: Uso = {
  perguntas: { q16: 23, q7: 23, q12: 23, q3: 23, q18b: 23, q19: 11 },
  opcoes: { q7_muito: 1, q7_mediano: 6, q7_pouco: 8, q7_nenhum: 5 },
};

function contexto(
  extra: Partial<ContextoEditor> = {},
  uso: Uso = USO,
): ContextoEditor {
  let n = 0;
  return {
    uso,
    indicadoresPorCampo: {},
    novoId: () => `novo${++n}`,
    ...extra,
  };
}

function sucesso(r: Resultado): Sucesso {
  if ("erro" in r) throw new Error(`Esperava sucesso: ${r.erro}`);
  return r;
}

function falhou(r: Resultado): Falha {
  if (!("erro" in r)) throw new Error("Esperava erro");
  return r;
}

const pergunta = (def: DefinicaoFormulario, id: string) =>
  todasAsPerguntas(def).find((p) => p.id === id) as Pergunta;
const secaoDe = (def: DefinicaoFormulario, id: string) =>
  def.secoes.find((s) => s.perguntas.some((p) => p.id === id))?.id;
const numeros = (def: DefinicaoFormulario, secao: string) =>
  def.secoes.find((s) => s.id === secao)?.perguntas.map((p) => p.numero);

describe("excluir pergunta", () => {
  it("16 com 23 respostas: não exclui, explica e oferece inativar", () => {
    const r = falhou(excluirPergunta(questionarioV2(), "q16", contexto()));
    expect(r.erro).toContain("23 respostas");
    expect(r.erro).toContain("só pode ser inativada");
    expect(r.podeInativar).toBe(true);
  });

  it("25b sem uso: exclui e registra a alteração", () => {
    const def = questionarioV2();
    const r = sucesso(excluirPergunta(def, "q25b", contexto()));
    expect(pergunta(r.definicao, "q25b")).toBeUndefined();
    expect(r.alteracao.descricao).toBe(
      "Pergunta 25b excluída (Quantidade diária de resíduo não reciclável)",
    );
    expect(r.alteracao.antes).toMatchObject({ id: "q25b" });
    expect(r.alteracao.depois).toBeNull();
    expect(pergunta(def, "q25b")).toBeDefined(); // não muda a entrada
  });

  it("fonte de indicador (questionário ou programa) só inativa", () => {
    const semUso = contexto({}, { perguntas: {}, opcoes: {} });
    expect(
      falhou(excluirPergunta(questionarioV2(), "q28", semUso)).erro,
    ).toContain("fonte de indicador");
    const programa = contexto(
      { indicadoresPorCampo: { q27: ["Frequência média"] } },
      { perguntas: {}, opcoes: {} },
    );
    const r = falhou(excluirPergunta(questionarioV2(), "q27", programa));
    expect(r.erro).toContain("Frequência média");
    expect(r.podeInativar).toBe(true);
  });

  it("com pergunta dependendo dela: explica quais", () => {
    const semUso = contexto({}, { perguntas: {}, opcoes: {} });
    const def = sucesso(
      editarPergunta(
        questionarioV2(),
        "q16",
        { fonte_indicador: false },
        semUso,
      ),
    ).definicao;
    const r = falhou(excluirPergunta(def, "q16", semUso));
    expect(r.erro).toContain("17 dependem dela");
    expect(r.podeInativar).toBe(true);
  });

  it("programa fala em lançamentos", () => {
    const r = falhou(
      excluirPergunta(questionarioV2(), "q16", contexto({ programa: true })),
    );
    expect(r.erro).toContain("23 lançamentos");
  });
});

describe("inativar pergunta", () => {
  it("18b: lista 19 a 31, inativa junto e avisa o indicador", () => {
    const def = questionarioV2();
    const ctx = contexto();
    const previa = consequenciasDeInativar(def, "q18b", {});
    const esperados = [
      "19",
      "20",
      "21",
      "22",
      "24",
      "25",
      "25b",
      "26",
      "27",
      "28",
      "29",
      "30",
      "31",
    ];
    expect(previa.dependentes.map((p) => p.numero)).toEqual(esperados);
    expect(previa.indicadores).toContain(
      "Gráficos das respostas e painel (pergunta 18b)",
    );

    const r = sucesso(inativarPergunta(def, "q18b", ctx));
    for (const n of ["18b", ...esperados])
      expect(pergunta(r.definicao, `q${n}`).ativa).toBe(false);
    expect(pergunta(r.definicao, "q23").ativa).toBe(true);
    expect(r.alteracao.descricao).toBe(
      `Pergunta 18b inativada (e dependentes ${esperados.join(", ")})`,
    );
    expect(r.avisos[0]).toContain("deixam de receber dado novo");
    expect(r.avisos[0]).toContain("pergunta 18b");
    expect(r.avisos[1]).toContain(esperados.join(", "));
  });

  it("dependente em cadeia também vai junto", () => {
    const ctx = contexto();
    // 33 passa a depender da 32 (que depende da 23)
    let def = questionarioV2();
    def = sucesso(
      editarPergunta(
        def,
        "q32",
        { tipo: "sim_nao" },
        contexto({}, { perguntas: {}, opcoes: {} }),
      ),
    ).definicao;
    def = sucesso(
      editarPergunta(
        def,
        "q33",
        { mostrar_se: { pergunta_id: "q32", valor: "sim" } },
        ctx,
      ),
    ).definicao;
    const deps = consequenciasDeInativar(def, "q23", {}).dependentes.map(
      (p) => p.numero,
    );
    expect(deps).toContain("33");
    const r = sucesso(inativarPergunta(def, "q23", ctx));
    expect(pergunta(r.definicao, "q33").ativa).toBe(false);
  });

  it("reativar volta; já inativa ou já ativa dá erro", () => {
    const ctx = contexto();
    const def = sucesso(
      inativarPergunta(questionarioV2(), "q14", ctx),
    ).definicao;
    expect(falhou(inativarPergunta(def, "q14", ctx)).erro).toContain(
      "já está inativa",
    );
    const r = sucesso(reativarPergunta(def, "q14", ctx));
    expect(pergunta(r.definicao, "q14").ativa).toBe(true);
    expect(r.avisos).toEqual([]);
    expect(falhou(reativarPergunta(r.definicao, "q14", ctx)).erro).toContain(
      "já está ativa",
    );
  });
});

describe("criar, editar e duplicar", () => {
  const ctx = contexto();

  it("uma opção com 1 opção não salva; com 2 salva e fica 'nova'", () => {
    const pub = questionarioV2();
    const dados = {
      numero: "15b",
      texto: "Conhece a coleta de óleo?",
      tipo: "uma" as const,
      opcoes: [{ texto: "Sim" }],
    };
    expect(falhou(criarPergunta(pub, "C", dados, ctx)).erro).toContain(
      "pelo menos 2 opções",
    );
    const r = sucesso(
      criarPergunta(
        pub,
        "C",
        {
          ...dados,
          opcoes: [{ texto: "Sim" }, { texto: "Não" }, { texto: " " }],
        },
        ctx,
      ),
    );
    const nova = r.definicao.secoes[2]?.perguntas.at(-1) as Pergunta;
    expect(nova.numero).toBe("15b");
    expect(nova.opcoes.map((o) => o.texto)).toEqual(["Sim", "Não"]);
    expect(nova.ativa).toBe(true);
    expect(nova.travada).toBe(false);
    expect(r.alteracao.descricao).toBe(
      "Pergunta 15b criada na seção SustentArp",
    );
    expect(diferencas(pub, r.definicao)).toEqual({ [nova.id]: "nova" });
  });

  it("número repetido, texto vazio, tipo automático e unidade faltando", () => {
    const def = questionarioV2();
    const base = { numero: "50", texto: "Pergunta", tipo: "texto" as const };
    expect(
      falhou(criarPergunta(def, "C", { ...base, numero: "7" }, ctx)).erro,
    ).toBe("Já existe uma pergunta com o nº 7.");
    expect(
      falhou(criarPergunta(def, "C", { ...base, texto: " " }, ctx)).erro,
    ).toBe("Escreva a pergunta.");
    expect(
      falhou(criarPergunta(def, "C", { ...base, tipo: "auto" }, ctx)).erro,
    ).toContain("Automático");
    expect(
      falhou(criarPergunta(def, "C", { ...base, tipo: "numero_unidade" }, ctx))
        .erro,
    ).toContain("unidade");
    expect(falhou(criarPergunta(def, "X", base, ctx)).erro).toBe(
      "Seção não encontrada.",
    );
  });

  it("regra 'mostrar só se' precisa de pergunta de opções ativa e valor válido", () => {
    const def = questionarioV2();
    const base = { numero: "50", texto: "Pergunta", tipo: "texto" as const };
    const com = (pergunta_id: string, valor: string) =>
      criarPergunta(
        def,
        "D",
        { ...base, mostrar_se: { pergunta_id, valor } },
        ctx,
      );
    expect(falhou(com("q14", "x")).erro).toContain("não serve de condição");
    expect(falhou(com("q16", "q16_talvez")).erro).toContain(
      "não existe ou está inativa",
    );
    expect(falhou(com("q99", "x")).erro).toContain("não existe");
    expect(sucesso(com("q16", "q16_nao")).definicao).toBeDefined();
    expect(sucesso(com("q10", "sim")).definicao).toBeDefined();
  });

  it("regra circular é recusada", () => {
    // 16 -> 18b não é circular; 18b -> 22 é (22 depende da 18b)
    sucesso(
      editarPergunta(
        questionarioV2(),
        "q16",
        { mostrar_se: { pergunta_id: "q18b", valor: "q18b_sim" } },
        ctx,
      ),
    );
    const c = falhou(
      editarPergunta(
        questionarioV2(),
        "q18b",
        { mostrar_se: { pergunta_id: "q22", valor: "q22_ruas" } },
        ctx,
      ),
    );
    expect(c.erro).toContain("circular");
  });

  it("editar o texto da 7: fica 'editada'; o tipo fica bloqueado (tem respostas)", () => {
    const pub = questionarioV2();
    const r = sucesso(
      editarPergunta(
        pub,
        "q7",
        { texto: "Grau de conhecimento sobre resíduos" },
        ctx,
      ),
    );
    expect(r.alteracao.descricao).toBe("Pergunta 7 editada: texto");
    expect(r.alteracao.antes).toMatchObject({
      texto: "Grau de conhecimento sobre gestão de resíduos",
    });
    expect(r.alteracao.depois).toMatchObject({
      texto: "Grau de conhecimento sobre resíduos",
    });
    expect(diferencas(pub, r.definicao)).toEqual({ q7: "editada" });
    const t = falhou(
      editarPergunta(r.definicao, "q7", { tipo: "varias" }, ctx),
    );
    expect(t.erro).toContain("23 respostas");
    expect(t.erro).toContain("inative esta pergunta e crie outra");
    expect(t.podeInativar).toBe(true);
  });

  it("tipo muda sem respostas; não muda se outras dependem dela", () => {
    const semUso = contexto({}, { perguntas: {}, opcoes: {} });
    const r = sucesso(
      editarPergunta(questionarioV2(), "q14", { tipo: "texto" }, semUso),
    );
    expect(pergunta(r.definicao, "q14").tipo).toBe("texto");
    expect(
      falhou(editarPergunta(questionarioV2(), "q16", { tipo: "texto" }, semUso))
        .erro,
    ).toContain("dependem dela");
  });

  it("nada mudou", () => {
    expect(
      falhou(
        editarPergunta(
          questionarioV2(),
          "q7",
          { texto: "Grau de conhecimento sobre gestão de resíduos" },
          ctx,
        ),
      ).erro,
    ).toBe("Nada mudou.");
  });

  it("trocar a seção no painel leva a pergunta para o fim da outra seção", () => {
    const r = sucesso(
      editarPergunta(questionarioV2(), "q14", { secao_id: "D" }, ctx),
    );
    expect(numeros(r.definicao, "D")).toEqual(["16", "17", "14"]);
    expect(r.alteracao.descricao).toBe("Pergunta 14 editada: seção (PGRS)");
  });

  it("opção usada não sai pela lista do painel", () => {
    const def = questionarioV2();
    const semMediano = pergunta(def, "q7").opcoes.filter(
      (o) => o.id !== "q7_mediano",
    );
    expect(
      falhou(editarPergunta(def, "q7", { opcoes: semMediano }, ctx)).erro,
    ).toContain("Só pode ser inativada");
    const comNova = [...pergunta(def, "q7").opcoes, { texto: "Não sabe" }];
    const r = sucesso(editarPergunta(def, "q7", { opcoes: comNova }, ctx));
    expect(pergunta(r.definicao, "q7").opcoes.at(-1)).toEqual({
      id: expect.stringMatching(/^novo/),
      texto: "Não sabe",
      ativa: true,
    });
  });

  it("duplicar a 12: cópia logo abaixo, sem respostas nem indicador", () => {
    const def = questionarioV2();
    const r = sucesso(duplicarPergunta(def, "q12", ctx));
    const c = r.definicao.secoes.find((s) => s.id === "C")?.perguntas;
    expect(c?.map((p) => p.numero)).toEqual(["12", "12-c", "13", "14", "15"]);
    const copia = c?.[1] as Pergunta;
    expect(copia.texto).toBe("Você conhece o SustentArp? (cópia)");
    expect(copia.fonte_indicador).toBe(false);
    expect(copia.id).not.toBe("q12");
    expect(USO.perguntas[copia.id]).toBeUndefined();
    expect(copia.opcoes.map((o) => o.texto)).toEqual(["Sim", "Pouco", "Não"]);
    expect(copia.opcoes.every((o) => !o.id.startsWith("q12_"))).toBe(true);
    expect(r.alteracao.descricao).toBe("Pergunta 12 duplicada (cópia 12-c)");
    const outra = sucesso(duplicarPergunta(r.definicao, "q12", contexto()));
    expect(numeros(outra.definicao, "C")?.[1]).toBe("12-c2");
  });
});

describe("mover pergunta", () => {
  const ctx = contexto();

  it("sobe e desce dentro da seção", () => {
    const r = sucesso(moverPergunta(questionarioV2(), "q9", "subir", ctx));
    expect(numeros(r.definicao, "B")).toEqual(["6", "7", "9", "8", "10", "11"]);
    expect(r.alteracao.descricao).toBe("Pergunta 9 mudou de posição");
  });

  it("no limite passa para a seção vizinha", () => {
    const sobe = sucesso(moverPergunta(questionarioV2(), "q6", "subir", ctx));
    expect(numeros(sobe.definicao, "A")?.at(-1)).toBe("6");
    expect(sobe.alteracao.descricao).toBe(
      "Pergunta 6 movida para a seção Identificação",
    );
    const desce = sucesso(
      moverPergunta(questionarioV2(), "q15", "descer", ctx),
    );
    expect(numeros(desce.definicao, "D")?.[0]).toBe("15");
    expect(
      falhou(moverPergunta(questionarioV2(), "q46", "descer", ctx)).erro,
    ).toBe("Já está no limite do formulário.");
  });

  it("não entra em seção inativa", () => {
    const def = sucesso(inativarSecao(questionarioV2(), "C", ctx)).definicao;
    expect(falhou(moverPergunta(def, "q11", "descer", ctx)).erro).toContain(
      "inativa",
    );
  });
});

describe("opções", () => {
  const ctx = contexto();

  it("opção usada da 7: excluir não deixa, oferece inativar; inativar pode", () => {
    const def = questionarioV2();
    const r = falhou(excluirOpcao(def, "q7", "q7_mediano", ctx));
    expect(r.erro).toContain("já foi usada em 6 respostas");
    expect(r.erro).toContain("respostas antigas mantêm o texto original");
    expect(r.podeInativar).toBe(true);
    const i = sucesso(inativarOpcao(def, "q7", "q7_mediano", ctx));
    expect(pergunta(i.definicao, "q7").opcoes[1]).toMatchObject({
      id: "q7_mediano",
      ativa: false,
    });
    expect(i.alteracao.descricao).toBe(
      'Opção "8 a 6 - conhecimento mediano" da pergunta 7 inativada',
    );
    const v = sucesso(reativarOpcao(i.definicao, "q7", "q7_mediano", ctx));
    expect(pergunta(v.definicao, "q7").opcoes[1]?.ativa).toBe(true);
  });

  it("adicionar, editar, mover e excluir opção sem uso", () => {
    let def = questionarioV2();
    const a = sucesso(adicionarOpcao(def, "q12", "Já ouviu falar", ctx));
    def = a.definicao;
    const id = pergunta(def, "q12").opcoes.at(-1)?.id as string;
    expect(a.alteracao.descricao).toBe(
      'Opção "Já ouviu falar" adicionada na pergunta 12',
    );
    expect(falhou(adicionarOpcao(def, "q12", "sim", ctx)).erro).toContain(
      "já tem a opção",
    );
    def = sucesso(editarOpcao(def, "q12", id, "Ouviu falar", ctx)).definicao;
    def = sucesso(moverOpcao(def, "q12", id, "subir", ctx)).definicao;
    expect(pergunta(def, "q12").opcoes.map((o) => o.texto)).toEqual([
      "Sim",
      "Pouco",
      "Ouviu falar",
      "Não",
    ]);
    const e = sucesso(excluirOpcao(def, "q12", id, ctx));
    expect(pergunta(e.definicao, "q12").opcoes).toHaveLength(3);
    expect(falhou(moverOpcao(def, "q12", "q12_sim", "subir", ctx)).erro).toBe(
      "Já está no limite.",
    );
  });

  it("não fica com menos de 2 opções ativas nem tira opção de uma regra", () => {
    const def = questionarioV2();
    expect(
      falhou(inativarOpcao(def, "q39", "q39_eventual", ctx)).erro,
    ).toContain("pelo menos 2 opções ativas");
    expect(falhou(inativarOpcao(def, "q16", "q16_sim", ctx)).erro).toContain(
      "17 só aparecem com esta opção",
    );
    expect(
      falhou(
        excluirOpcao(
          def,
          "q23",
          "q23_rss",
          contexto({}, { perguntas: {}, opcoes: {} }),
        ),
      ).erro,
    ).toContain("32, 33, 34");
  });

  it("pergunta sem opções ou travada", () => {
    expect(
      falhou(adicionarOpcao(questionarioV2(), "q14", "x", ctx)).erro,
    ).toContain("não tem opções");
    expect(
      falhou(adicionarOpcao(questionarioV2(), "q1", "x", ctx)).erro,
    ).toContain("só o texto de ajuda");
  });
});

describe("seções", () => {
  const ctx = contexto();

  it("criar, renomear, mover e excluir vazia", () => {
    let def = questionarioV2();
    const c = sucesso(criarSecao(def, "Assinaturas", ctx));
    def = c.definicao;
    expect(c.alteracao.descricao).toBe('Seção "Assinaturas" criada');
    const id = def.secoes.at(-1)?.id as string;
    expect(falhou(criarSecao(def, "  ", ctx)).erro).toBe(
      "Informe o nome da seção.",
    );
    def = sucesso(renomearSecao(def, id, "Fim", ctx)).definicao;
    def = sucesso(moverSecao(def, id, "subir", ctx)).definicao;
    expect(def.secoes.map((s) => s.id)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      id,
      "F",
    ]);
    expect(falhou(moverSecao(def, "A", "subir", ctx)).erro).toBe(
      "Já está no limite.",
    );
    const e = sucesso(excluirSecao(def, id, ctx));
    expect(e.definicao.secoes).toHaveLength(6);
    expect(e.alteracao.descricao).toBe("Seção Fim excluída");
  });

  it("excluir seção com perguntas: só inativar", () => {
    const r = falhou(excluirSecao(questionarioV2(), "C", ctx));
    expect(r.erro).toContain("tem 4 perguntas");
    expect(r.erro).toContain("Inativar seção");
    expect(r.podeInativar).toBe(true);
  });

  it("inativar seção inativa todas as perguntas (e quem depende delas)", () => {
    const r = sucesso(inativarSecao(questionarioV2(), "E", ctx));
    const e = r.definicao.secoes.find((s) => s.id === "E");
    expect(e?.ativa).toBe(false);
    expect(e?.perguntas.every((p) => !p.ativa)).toBe(true);
    // F depende da 23 (seção E): vai junto, com aviso
    expect(pergunta(r.definicao, "q32").ativa).toBe(false);
    expect(r.avisos.join(" ")).toContain("32");
    expect(conferirAntesDePublicar(r.definicao, {})).toEqual([]);
  });

  it("reativar seção: perguntas continuam inativas, com aviso", () => {
    const def = sucesso(inativarSecao(questionarioV2(), "C", ctx)).definicao;
    expect(falhou(reativarPergunta(def, "q14", ctx)).erro).toContain(
      "Reative a seção antes",
    );
    const r = sucesso(reativarSecao(def, "C", ctx));
    expect(r.avisos[0]).toContain("4 perguntas");
    expect(
      sucesso(reativarPergunta(r.definicao, "q14", ctx)).definicao,
    ).toBeDefined();
  });
});

describe("campos travados (ENET)", () => {
  const ctx = contexto();
  const def = questionarioV2();

  it("não exclui, não inativa, não duplica", () => {
    const e = falhou(excluirPergunta(def, "q1", ctx));
    expect(e.erro).toContain("não pode ser excluído nem inativado");
    expect(e.podeInativar).toBe(false);
    expect(falhou(inativarPergunta(def, "q1", ctx)).erro).toContain(
      "Campo automático",
    );
    expect(falhou(duplicarPergunta(def, "q2", ctx)).erro).toContain(
      "Campo automático",
    );
  });

  it("não muda de seção (seta nem painel), mas muda de posição na seção", () => {
    expect(falhou(moverPergunta(def, "q5", "descer", ctx)).erro).toBe(
      "Campo automático do ENET: não muda de seção.",
    );
    expect(
      falhou(editarPergunta(def, "q5", { secao_id: "B" }, ctx)).erro,
    ).toContain("só o texto de ajuda");
    const r = sucesso(moverPergunta(def, "q2", "subir", ctx));
    expect(numeros(r.definicao, "A")?.slice(0, 2)).toEqual(["2", "1"]);
  });

  it("não troca tipo nem texto; só a ajuda", () => {
    expect(falhou(editarPergunta(def, "q1", { tipo: "texto" }, ctx)).erro).toBe(
      "Campo automático do ENET: só o texto de ajuda pode ser editado.",
    );
    expect(
      falhou(editarPergunta(def, "q1", { texto: "Empresa" }, ctx)).erro,
    ).toContain("só o texto de ajuda");
    const r = sucesso(
      editarPergunta(def, "q1", { ajuda: "Vem do ENET." }, ctx),
    );
    expect(pergunta(r.definicao, "q1").ajuda).toBe("Vem do ENET.");
  });

  it("a seção de identificação não inativa", () => {
    expect(falhou(inativarSecao(def, "A", ctx)).erro).toContain(
      "não pode ser inativada",
    );
  });
});

describe("publicar", () => {
  const ctx = contexto();

  it("regra para pergunta inativa bloqueia; corrigida, publica", () => {
    let def = sucesso(inativarPergunta(questionarioV2(), "q16", ctx)).definicao;
    expect(pergunta(def, "q17").ativa).toBe(false);
    const re = sucesso(reativarPergunta(def, "q17", ctx));
    expect(re.avisos[0]).toContain("pergunta 16, que está inativa");
    def = re.definicao;
    expect(conferirAntesDePublicar(def, {})).toEqual([
      'Pergunta 17: a regra "mostrar só se" aponta para uma pergunta inativa ou inexistente (16).',
    ]);
    def = sucesso(
      editarPergunta(def, "q17", { mostrar_se: null }, ctx),
    ).definicao;
    expect(conferirAntesDePublicar(def, {})).toEqual([]);
  });

  it("sem texto, poucas opções, número repetido e regra para pergunta inexistente", () => {
    const def = questionarioV2();
    const p6 = pergunta(def, "q6");
    p6.texto = "";
    const p12 = pergunta(def, "q12");
    for (const o of p12.opcoes) o.ativa = o.id === "q12_sim";
    pergunta(def, "q8").numero = "9";
    pergunta(def, "q17").mostrar_se = { pergunta_id: "q99", valor: "x" };
    pergunta(def, "q19").mostrar_se = { pergunta_id: "q18b", valor: "q18b_x" };
    expect(conferirAntesDePublicar(def, {})).toEqual([
      "Pergunta 6 sem texto.",
      "Número 9 repetido.",
      "Pergunta 12 precisa de pelo menos 2 opções ativas.",
      'Pergunta 17: a regra "mostrar só se" aponta para uma pergunta inativa ou inexistente (q99).',
      "Pergunta 19: A resposta escolhida na regra não existe ou está inativa na pergunta 18b.",
    ]);
  });

  it("indicador que ficaria sem dado novo", () => {
    const ipc = { q27: ["Frequência de retirada"], q29: [] };
    const def = sucesso(
      inativarPergunta(questionarioV2(), "q27", ctx),
    ).definicao;
    expect(conferirAntesDePublicar(def, ipc)).toEqual([
      'Indicador "Frequência de retirada" ficará sem dado novo (campo 27 inativo). Ajuste ou inative o indicador.',
    ]);
    expect(conferirAntesDePublicar(questionarioV2(), ipc)).toEqual([]);
  });

  it("diferenças: nova e editada; ordem sozinha não marca", () => {
    const pub = questionarioV2();
    let def = sucesso(moverPergunta(pub, "q9", "subir", ctx)).definicao;
    expect(diferencas(pub, def)).toEqual({});
    def = sucesso(inativarPergunta(def, "q14", ctx)).definicao;
    def = sucesso(moverPergunta(def, "q15", "descer", ctx)).definicao;
    expect(diferencas(pub, def)).toEqual({ q14: "editada", q15: "editada" });
    // jsonb reordena as chaves: não conta como edição
    const reordenada = JSON.parse(
      JSON.stringify(pub, (_k, v) =>
        v && typeof v === "object" && !Array.isArray(v)
          ? Object.fromEntries(Object.entries(v).reverse())
          : v,
      ),
    );
    expect(diferencas(pub, reordenada)).toEqual({});
  });
});

describe("restaurar versão", () => {
  it("restaurar a v1 cria rascunho sem apagar nada", () => {
    const ctx = contexto();
    let atual = questionarioV2();
    atual = sucesso(
      criarPergunta(
        atual,
        "B",
        { numero: "11b", texto: "Tem horário de pico?", tipo: "texto" },
        ctx,
      ),
    ).definicao;
    atual = sucesso(adicionarOpcao(atual, "q12", "Ouviu falar", ctx)).definicao;
    const v1 = questionarioV1();
    const r = restaurarVersao(v1, atual);
    const ids = (d: DefinicaoFormulario) =>
      todasAsPerguntas(d).map((p) => p.id);
    for (const id of ids(atual)) expect(ids(r)).toContain(id);
    expect(pergunta(r, "q25b").ativa).toBe(false);
    expect(secaoDe(r, "q25b")).toBe("E");
    expect(pergunta(r, "novo1")).toMatchObject({ numero: "11b", ativa: false });
    expect(pergunta(r, "q12").opcoes.at(-1)).toMatchObject({
      texto: "Ouviu falar",
      ativa: false,
    });
    // o que existia na v1 volta como estava
    for (const p of todasAsPerguntas(v1))
      if (p.id !== "q12") expect(pergunta(r, p.id)).toEqual(p);
    expect(conferirAntesDePublicar(r, {})).toEqual([]);
    expect(diferencas(atual, r)).toMatchObject({ q25b: "editada" });
  });

  it("número que colide ganha sufixo", () => {
    const antiga = questionarioV1();
    const atual = questionarioV2();
    const p = pergunta(atual, "q25b");
    p.numero = "25";
    const r = restaurarVersao(antiga, atual);
    expect(pergunta(r, "q25b").numero).toBe("25-r");
  });
});
