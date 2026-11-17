import { describe, expect, it } from "vitest";
import {
  aplicarOperacao,
  errosParaPublicar,
  explicarErroDoBanco,
  indicadoresPorCampoDe,
  linhaDeUsoSchema,
  operacaoSchema,
  tiposDoFormulario,
  tiradosDaPublicada,
  usoDoBanco,
} from "./editor-operacoes";
import type { ContextoEditor } from "./formulario/editor";
import type { DefinicaoFormulario } from "./formulario/tipos";
import { questionarioV2 } from "./questionario-inicial";

function contexto(extra: Partial<ContextoEditor> = {}): ContextoEditor {
  let n = 0;
  return {
    uso: { perguntas: {}, opcoes: {} },
    indicadoresPorCampo: {},
    novoId: () => `novo${++n}`,
    ...extra,
  };
}

const programa = (): DefinicaoFormulario => ({
  secoes: [
    {
      id: "s1",
      nome: "Campos",
      ativa: true,
      perguntas: [
        {
          id: "peso",
          numero: "1",
          texto: "Peso",
          ajuda: "",
          tipo: "numero_unidade",
          obrigatoria: true,
          opcoes: [],
          unidades: ["kg"],
          mostrar_se: null,
          fonte_indicador: false,
          ativa: true,
          travada: false,
          auto: null,
        },
        {
          id: "material",
          numero: "2",
          texto: "Material",
          ajuda: "",
          tipo: "uma",
          obrigatoria: false,
          opcoes: [
            { id: "material_1", texto: "Recicláveis", ativa: true },
            { id: "material_2", texto: "Eletrônicos", ativa: true },
          ],
          unidades: [],
          mostrar_se: null,
          fonte_indicador: false,
          ativa: true,
          travada: false,
          auto: null,
        },
      ],
    },
  ],
});

describe("uso vindo de uso_do_formulario", () => {
  it("separa pergunta (opção null) de opção e converte o bigint", () => {
    const linhas = [
      { pergunta_id: "q7", opcao_id: null, usos: "23" },
      { pergunta_id: "q7", opcao_id: "q7_pouco", usos: 8 },
      { pergunta_id: "q25b", opcao_id: null, usos: 0 },
    ].map((l) => linhaDeUsoSchema.parse(l));
    expect(usoDoBanco(linhas)).toEqual({
      perguntas: { q7: 23 },
      opcoes: { q7_pouco: 8 },
    });
  });
});

describe("indicadores por campo", () => {
  const linhas = [
    { nome: "Volume reciclado", campo_id: "peso", filtro: null, ativo: true },
    {
      nome: "Oficinas",
      campo_id: null,
      filtro: { campo_id: "oficina", valor: "sim" },
      ativo: true,
    },
    { nome: "Antigo", campo_id: "peso", filtro: null, ativo: false },
  ];

  it("conta fonte e filtro; o inativo entra marcado", () => {
    expect(indicadoresPorCampoDe(linhas)).toEqual({
      peso: ["Volume reciclado", "Antigo (inativo)"],
      oficina: ["Oficinas"],
    });
  });

  it("só ativos para a conferência antes de publicar", () => {
    expect(indicadoresPorCampoDe(linhas, true)).toEqual({
      peso: ["Volume reciclado"],
      oficina: ["Oficinas"],
    });
  });
});

describe("operações", () => {
  it("Zod aceita a operação da tela e recusa a desconhecida", () => {
    expect(
      operacaoSchema.safeParse({
        op: "mover_pergunta",
        pergunta_id: "q7",
        direcao: "subir",
      }).success,
    ).toBe(true);
    expect(operacaoSchema.safeParse({ op: "apagar_tudo" }).success).toBe(false);
  });

  it("despacha para a regra pura", () => {
    const r = aplicarOperacao(
      questionarioV2(),
      { op: "excluir_pergunta", pergunta_id: "q16" },
      contexto({ uso: { perguntas: { q16: 23 }, opcoes: {} } }),
    );
    expect("erro" in r && r.podeInativar).toBe(true);
  });

  it("tipo fora do formulário não entra", () => {
    const r = aplicarOperacao(
      programa(),
      {
        op: "criar_pergunta",
        secao_id: "s1",
        dados: { numero: "3", texto: "Nível", tipo: "grade" },
      },
      contexto(),
      tiposDoFormulario("programa"),
    );
    expect(r).toEqual({ erro: expect.stringContaining("tipo de resposta") });
  });

  it("questionário não oferece lista de cadastro nem reais; programa sim", () => {
    expect(tiposDoFormulario("questionario")).not.toContain("lista_cadastro");
    expect(tiposDoFormulario("questionario")).not.toContain("reais");
    expect(tiposDoFormulario("programa")).toContain("lista_cadastro");
    expect(tiposDoFormulario("programa")).not.toContain("auto");
  });
});

describe("permissão de excluir", () => {
  it("lista o que sai da versão publicada", () => {
    const publicada = programa();
    const r = aplicarOperacao(
      publicada,
      { op: "excluir_opcao", pergunta_id: "material", opcao_id: "material_2" },
      contexto(),
    );
    // Com 2 opções ativas não deixa tirar; adiciona uma antes.
    expect("erro" in r).toBe(true);
    const com3 = aplicarOperacao(
      publicada,
      { op: "adicionar_opcao", pergunta_id: "material", texto: "Outros" },
      contexto(),
    );
    if ("erro" in com3) throw new Error(com3.erro);
    const sem = aplicarOperacao(
      com3.definicao,
      { op: "excluir_opcao", pergunta_id: "material", opcao_id: "material_2" },
      contexto(),
    );
    if ("erro" in sem) throw new Error(sem.erro);
    expect(tiradosDaPublicada(publicada, sem.definicao)).toEqual([
      "material_2",
    ]);
    // A opção nova (não publicada) sai sem pedir permissão.
    expect(tiradosDaPublicada(publicada, com3.definicao)).toEqual([]);
  });
});

describe("antes de publicar", () => {
  it("formulário sem nada ativo não publica", () => {
    expect(
      errosParaPublicar(
        { secoes: [{ id: "s", nome: "Campos", ativa: true, perguntas: [] }] },
        {},
        "programa",
      ),
    ).toEqual(["O formulário não tem nenhum campo ativo."]);
  });

  it("indicador ativo em campo inativo bloqueia", () => {
    const def = programa();
    const peso = def.secoes[0]?.perguntas[0];
    if (peso) peso.ativa = false;
    expect(
      errosParaPublicar(def, { peso: ["Volume reciclado"] }, "programa"),
    ).toEqual([
      'Indicador "Volume reciclado" ficará sem dado novo (campo 1 inativo). Ajuste ou inative o indicador.',
    ]);
  });
});

describe("mensagem do banco", () => {
  it("troca ids por número e texto da opção", () => {
    expect(
      explicarErroDoBanco(
        "já tem respostas ou lançamentos e só pode ser inativado: material, material (opção material_1)",
        [programa()],
      ),
    ).toBe(
      'Já tem respostas ou lançamentos e só pode ser inativado: nº 2; opção 2 "Recicláveis".',
    );
  });

  it("sem lista, só põe maiúscula e ponto", () => {
    expect(explicarErroDoBanco("informe o resumo da versão", [])).toBe(
      "Informe o resumo da versão.",
    );
  });
});
