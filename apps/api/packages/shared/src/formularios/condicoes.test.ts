import { describe, expect, it } from "vitest";
import {
  type ArquivoEnviado,
  type Campo,
  camposSchema,
  novoCampo,
  problemasDosCampos,
  textoDaResposta,
  validarRespostas,
  valoresQueDecidem,
  visiveis,
} from "./campos";

// Perguntas condicionais e envio de arquivo.

const campo = (
  id: string,
  tipo: Campo["tipo"],
  extra: Partial<Campo> = {},
): Campo => ({ ...novoCampo(tipo), id, titulo: `Pergunta ${id}`, ...extra });

const tipoLoja = campo("tipo0001", "unica", {
  opcoes: ["Loja", "Quiosque", "Evento"],
  obrigatorio: true,
});
const area = campo("area0001", "numero", {
  obrigatorio: true,
  condicao: { campo: "tipo0001", valores: ["Loja", "Quiosque"] },
});
const secaoEvento = campo("secev001", "secao", {
  condicao: { campo: "tipo0001", valores: ["Evento"] },
});
const publico = campo("publ0001", "numero", { obrigatorio: true });
const secaoFim = campo("secfim01", "secao");
const nota = campo("nota0001", "escala", { escalaMin: 0, escalaMax: 10 });
const porque = campo("porq0001", "paragrafo", {
  obrigatorio: true,
  condicao: { campo: "nota0001", valores: ["0", "1", "2", "3", "4", "5", "6"] },
});
const FORM = [tipoLoja, area, secaoEvento, publico, secaoFim, nota, porque];

describe("perguntas condicionais", () => {
  it("mostra a pergunta e a seção conforme a resposta anterior", () => {
    expect([...visiveis(FORM, {})]).toEqual([
      "tipo0001",
      "secfim01",
      "nota0001",
    ]);
    expect([...visiveis(FORM, { tipo0001: "Loja" })]).toContain("area0001");
    const evento = visiveis(FORM, { tipo0001: "Evento", nota0001: 3 });
    expect(evento.has("area0001")).toBe(false);
    // A seção do evento abre e leva junto a pergunta dela.
    expect(evento.has("secev001")).toBe(true);
    expect(evento.has("publ0001")).toBe(true);
    // Detrator explica o porquê; nota alta não vê a pergunta.
    expect(evento.has("porq0001")).toBe(true);
    expect(visiveis(FORM, { nota0001: 9 }).has("porq0001")).toBe(false);
  });

  it("escondida não é exigida e o que veio nela é descartado", () => {
    const r = validarRespostas(FORM, {
      tipo0001: "Loja",
      area0001: "35",
      publ0001: "200",
      nota0001: 10,
      porq0001: "não devia ir",
    });
    expect(r.erros).toEqual({});
    expect(r.respostas).toEqual({
      tipo0001: "Loja",
      area0001: 35,
      nota0001: 10,
    });

    const faltando = validarRespostas(FORM, {
      tipo0001: "Evento",
      nota0001: 2,
    });
    expect(Object.keys(faltando.erros).sort()).toEqual([
      "porq0001",
      "publ0001",
    ]);
  });

  it("sim ou não e caixas de seleção também decidem", () => {
    const tem = campo("tem00001", "sim_nao");
    const qual = campo("qual0001", "texto", {
      condicao: { campo: "tem00001", valores: ["sim"] },
    });
    expect(visiveis([tem, qual], { tem00001: true }).has("qual0001")).toBe(
      true,
    );
    expect(visiveis([tem, qual], { tem00001: false }).has("qual0001")).toBe(
      false,
    );
    const canais = campo("can00001", "multipla", { opcoes: ["Site", "Outro"] });
    const outro = campo("out00001", "texto", {
      condicao: { campo: "can00001", valores: ["Outro"] },
    });
    expect(
      visiveis([canais, outro], { can00001: ["Site", "Outro"] }).has(
        "out00001",
      ),
    ).toBe(true);
  });

  it("o editor aponta condição quebrada", () => {
    expect(
      problemasDosCampos([
        { ...area, condicao: { campo: "tipo0001", valores: ["Loja"] } },
        tipoLoja,
      ]),
    ).toContain(
      "Pergunta 1: a condição precisa apontar para uma pergunta anterior.",
    );
    expect(
      problemasDosCampos([
        campo("txt00001", "texto"),
        campo("x0000001", "texto", {
          condicao: { campo: "txt00001", valores: ["a"] },
        }),
      ]),
    ).toEqual([
      "Pergunta 2: a condição só pode usar pergunta de escolha, sim ou não ou escala.",
    ]);
    expect(
      problemasDosCampos([
        tipoLoja,
        { ...area, condicao: { campo: "tipo0001", valores: ["Sala"] } },
      ]),
    ).toEqual([
      "Pergunta 2: a condição usa uma resposta que não existe mais na pergunta 1.",
    ]);
    expect(
      problemasDosCampos([
        tipoLoja,
        { ...area, condicao: { campo: "tipo0001", valores: [] } },
      ]),
    ).toEqual(["Pergunta 2: marque ao menos uma resposta na condição."]);
    expect(problemasDosCampos(FORM)).toEqual([]);
    expect(camposSchema.safeParse(FORM).success).toBe(true);
  });

  it("lista os valores que cada tipo oferece para a condição", () => {
    expect(
      valoresQueDecidem(campo("s0000001", "sim_nao")).map((v) => v.valor),
    ).toEqual(["sim", "nao"]);
    expect(valoresQueDecidem(nota)).toHaveLength(11);
    expect(valoresQueDecidem(campo("t0000001", "texto"))).toEqual([]);
  });

  it("formulário gravado antes das condições continua válido", () => {
    const antigo = [{ id: "nome0001", tipo: "texto", titulo: "Nome" }];
    const lido = camposSchema.parse(antigo);
    expect(lido[0]?.condicao).toBeNull();
    expect(lido[0]?.maxArquivos).toBe(1);
  });
});

describe("envio de arquivo", () => {
  const FORM_ID = "11111111-1111-4111-8111-111111111111";
  const doc: ArquivoEnviado = {
    caminho: `${FORM_ID}/22222222-2222-4222-8222-222222222222.pdf`,
    nome: "contrato.pdf",
    tamanho: 1024,
    tipo: "application/pdf",
    assinatura: "boa",
  };
  const anexo = campo("anex0001", "arquivo", {
    obrigatorio: true,
    maxArquivos: 2,
  });
  const conferir = (a: ArquivoEnviado) => a.assinatura === "boa";

  it("grava o arquivo sem a assinatura", () => {
    const r = validarRespostas([anexo], { anex0001: [doc] }, conferir);
    expect(r.erros).toEqual({});
    const { assinatura: _, ...semAssinatura } = doc;
    expect(r.respostas.anex0001).toEqual([semAssinatura]);
    expect(textoDaResposta("arquivo", r.respostas.anex0001)).toBe(
      "contrato.pdf",
    );
  });

  it("recusa assinatura errada, arquivo a mais, caminho estranho e falta", () => {
    const erro = (v: unknown) =>
      validarRespostas([anexo], { anex0001: v }, conferir).erros.anex0001;
    expect(erro([{ ...doc, assinatura: "falsa" }])).toBe(
      "Envie o arquivo de novo.",
    );
    expect(erro([doc, doc, doc])).toBe("Envie no máximo 2 arquivos.");
    expect(erro([{ ...doc, caminho: "../../segredo.pdf" }])).toBe(
      "Envie o arquivo de novo.",
    );
    expect(erro([])).toBe("Resposta obrigatória.");
  });
});
