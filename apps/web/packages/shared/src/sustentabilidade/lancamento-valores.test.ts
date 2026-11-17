import { describe, expect, it } from "vitest";
import {
  type DefinicaoFormulario,
  type Pergunta,
  validarRespostas,
} from "./formulario/tipos";
import { nomeCadastrado, nomesParecidos } from "./lancamento-cadastro";
import {
  camposReais,
  dataDoLancamento,
  definicaoSemReais,
  ERRO_DATA,
  juntarReais,
  preencherCustosPorPessoa,
  prepararLancamento,
  resumoDoLancamento,
  separarReais,
  temCampoDeData,
  textoDoValor,
} from "./lancamento-valores";

const p = (
  id: string,
  tipo: Pergunta["tipo"],
  extra: Partial<Pergunta> = {},
): Pergunta => ({
  id,
  numero: "",
  texto: id,
  ajuda: "",
  tipo,
  obrigatoria: false,
  opcoes: [],
  unidades: [],
  mostrar_se: null,
  fonte_indicador: false,
  ativa: true,
  travada: false,
  auto: null,
  ...extra,
});

// Formulário do tour guiado (spec 4.8), como nos dados de exemplo.
const TOUR: DefinicaoFormulario = {
  secoes: [
    {
      id: "s1",
      nome: "Lançamento",
      ativa: true,
      perguntas: [
        p("data", "data", { obrigatoria: true, texto: "Data" }),
        p("grupo", "texto", { obrigatoria: true, texto: "Grupo" }),
        p("participantes", "numero", {
          obrigatoria: true,
          texto: "Participantes",
        }),
        p("receita_arp", "reais", { obrigatoria: true }),
        p("custo_album", "reais"),
        p("custo_copo", "reais"),
      ],
    },
  ],
};

describe("campos em reais à parte (lancamento_valores)", () => {
  const respostas = {
    data: "2026-10-20",
    grupo: "Escola",
    participantes: 25,
    receita_arp: 250,
    custo_album: 62,
    custo_copo: "73,00",
  };

  it("separa ao gravar: reais só em números, fora de lancamentos.valores", () => {
    const { valores, reais } = separarReais(TOUR, respostas);
    expect(valores).toEqual({
      data: "2026-10-20",
      grupo: "Escola",
      participantes: 25,
    });
    expect(reais).toEqual({
      receita_arp: 250,
      custo_album: 62,
      custo_copo: 73,
    });
    expect(camposReais(TOUR)).toEqual(
      new Set(["receita_arp", "custo_album", "custo_copo"]),
    );
  });

  it("junta ao ler; sem permissão (null) ficam só os comuns", () => {
    const { valores, reais } = separarReais(TOUR, respostas);
    expect(juntarReais(valores, reais)).toEqual({
      ...respostas,
      custo_copo: 73,
    });
    expect(juntarReais(valores, null)).toEqual(valores);
  });

  it("sem 'Ver valores' os campos em reais saem e não são cobrados", () => {
    const sem = definicaoSemReais(TOUR);
    const r = { data: "2026-10-20", grupo: "Escola", participantes: 25 };
    expect(validarRespostas(TOUR, r)).toHaveProperty("receita_arp");
    expect(validarRespostas(sem, r)).toEqual({});
  });
});

describe("tour: custos por pessoa dos Parâmetros", () => {
  const regra = {
    pessoas: "participantes",
    custos: { custo_album: 2.48, custo_copo: 2.92 },
  };

  it("pré-preenche pelo número de participantes", () => {
    expect(
      preencherCustosPorPessoa(TOUR, { participantes: 25 }, regra),
    ).toEqual({ participantes: 25, custo_album: 62, custo_copo: 73 });
  });

  it("o que a pessoa digitou fica (copo de parte do grupo)", () => {
    expect(
      preencherCustosPorPessoa(
        TOUR,
        { participantes: 25, custo_copo: 29.2 },
        regra,
      ),
    ).toEqual({ participantes: 25, custo_album: 62, custo_copo: 29.2 });
  });

  it("sem participantes ou sem os campos, nada muda", () => {
    expect(preencherCustosPorPessoa(TOUR, {}, regra)).toEqual({});
    const semCampos: DefinicaoFormulario = {
      secoes: [
        {
          id: "s",
          nome: "",
          ativa: true,
          perguntas: [p("participantes", "numero")],
        },
      ],
    };
    expect(
      preencherCustosPorPessoa(semCampos, { participantes: 3 }, regra),
    ).toEqual({ participantes: 3 });
  });
});

describe("data do fato e textos", () => {
  const def: DefinicaoFormulario = {
    secoes: [
      {
        id: "s",
        nome: "",
        ativa: true,
        perguntas: [
          p("velha", "data", { ativa: false }),
          p("data", "data", { texto: "Data" }),
          p("tipo", "uma", {
            texto: "Tipo",
            opcoes: [
              { id: "tipo_1", texto: "Feira", ativa: true },
              { id: "tipo_4", texto: "Oficina", ativa: true },
            ],
          }),
          p("peso", "numero_unidade", { texto: "Peso" }),
          p("oficina", "sim_nao", { texto: "Oficina?" }),
        ],
      },
    ],
  };

  it("data do lançamento = primeiro campo de data ativo", () => {
    expect(
      dataDoLancamento(def, { velha: "2020-01-01", data: "2026-11-03" }),
    ).toBe("2026-11-03");
    expect(dataDoLancamento(def, {})).toBeNull();
    expect(temCampoDeData(def)).toBe(true);
  });

  it("texto das respostas e resumo da lista", () => {
    const [, , tipo, peso, oficina] = def.secoes[0]?.perguntas ?? [];
    expect(textoDoValor(tipo as Pergunta, "tipo_4")).toBe("Oficina");
    expect(textoDoValor(peso as Pergunta, { n: 120.5, u: "kg" })).toBe(
      "120,50 kg",
    );
    expect(textoDoValor(oficina as Pergunta, { r: "sim" })).toBe("Sim");
    expect(textoDoValor(oficina as Pergunta, undefined)).toBe("—");
    expect(
      resumoDoLancamento(def, {
        data: "2026-11-03",
        tipo: "tipo_1",
        peso: { n: 3, u: "kg" },
      }),
    ).toBe("Tipo: Feira · Peso: 3 kg");
  });
});

describe("lista de cadastro: nomes parecidos antes de criar", () => {
  const lista = ["Sítio da Serra", "Mel da Serra", "Queijaria do Vale"];

  it("nome igual sem acento/caixa já existe", () => {
    expect(nomeCadastrado("sitio da serra ", lista)).toBe("Sítio da Serra");
    expect(nomesParecidos("SITIO DA SERRA", lista)).toEqual([]);
  });

  it("sugere os parecidos", () => {
    expect(nomesParecidos("Sitio da Sera", lista)[0]).toBe("Sítio da Serra");
    expect(nomesParecidos("Queijaria", lista)).toEqual(["Queijaria do Vale"]);
    expect(nomesParecidos("Pães do Morro", lista)).toEqual([]);
  });
});

describe("preparar o lançamento para gravar", () => {
  const custos = {
    pessoas: "participantes",
    custos: { custo_album: 2.48, custo_copo: 2.92 },
  };
  const base = { data: "2026-10-20", grupo: "Escola", participantes: 25 };

  it("com valores: cobra a receita, separa reais e pré-preenche custos", () => {
    expect(
      prepararLancamento({
        definicao: TOUR,
        respostas: base,
        comValores: true,
      }),
    ).toEqual({ erros: { receita_arp: expect.any(String) } });
    expect(
      prepararLancamento({
        definicao: TOUR,
        respostas: { ...base, receita_arp: 250, custo_copo: 10 },
        comValores: true,
        custos,
      }),
    ).toEqual({
      data: "2026-10-20",
      valores: base,
      reais: { receita_arp: 250, custo_album: 62, custo_copo: 10 },
    });
  });

  it("sem valores: ignora o que veio em reais, mas grava os custos padrão", () => {
    expect(
      prepararLancamento({
        definicao: TOUR,
        respostas: { ...base, receita_arp: 999 },
        comValores: false,
        custos,
      }),
    ).toEqual({
      data: "2026-10-20",
      valores: base,
      reais: { custo_album: 62, custo_copo: 73 },
    });
  });

  it("data: do campo de data ou pedida à parte", () => {
    const semData: DefinicaoFormulario = {
      secoes: [
        { id: "s", nome: "", ativa: true, perguntas: [p("q", "texto")] },
      ],
    };
    expect(
      prepararLancamento({
        definicao: semData,
        respostas: { q: "x" },
        comValores: true,
      }),
    ).toEqual({ erros: { [ERRO_DATA]: expect.any(String) } });
    expect(
      prepararLancamento({
        definicao: semData,
        respostas: { q: "x" },
        comValores: true,
        data: "2026-11-03",
      }),
    ).toEqual({ data: "2026-11-03", valores: { q: "x" }, reais: {} });
  });
});
