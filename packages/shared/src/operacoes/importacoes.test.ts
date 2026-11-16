import { describe, expect, it } from "vitest";
import {
  contarAvisos,
  lerArquivos,
  lerAvisos,
  lerFiltroImportacoes,
  linhasDoResumo,
  podeDesfazer,
  rotuloDaChave,
  textoDaReferencia,
  tiposQuePode,
} from "./importacoes";

describe("tipos e permissões", () => {
  it("mesma regra de operacoes.pode_importar", () => {
    const tem = new Set([
      "operacoes.energia.contas",
      "operacoes.limpeza.fechar",
    ]);
    expect(tiposQuePode((p) => tem.has(p))).toEqual(["energisa", "limpeza"]);
    expect(tiposQuePode(() => false)).toEqual([]);
  });

  it("só prévia e confirmada voltam atrás", () => {
    expect(podeDesfazer("previa")).toBe(true);
    expect(podeDesfazer("confirmada")).toBe(true);
    expect(podeDesfazer("substituida")).toBe(false);
    expect(podeDesfazer("desfeita")).toBe(false);
  });

  it("referência mensal vira mês; a do orçamento fica como está", () => {
    expect(textoDaReferencia("2026-09-01")).toBe("set/2026");
    expect(textoDaReferencia("Edifício garagem R01")).toBe(
      "Edifício garagem R01",
    );
  });
});

describe("filtros", () => {
  it("valor inválido vira sem filtro; datas trocadas se acertam", () => {
    expect(
      lerFiltroImportacoes({
        log_tipo: "agua",
        status: "qualquer",
        de: "2026-10-31",
        ate: "2026-10-01",
        pagina: "0",
      }),
    ).toEqual({
      tipo: "agua",
      status: null,
      de: "2026-10-01",
      ate: "2026-10-31",
      pagina: 1,
    });
    expect(lerFiltroImportacoes({ log_tipo: ["energisa", "agua"] }).tipo).toBe(
      "energisa",
    );
  });
});

describe("jsonb das áreas", () => {
  it("lê só os arquivos e avisos no formato combinado", () => {
    expect(
      lerArquivos([
        { nome: "a.xlsx", caminho: "agua/x/a.xlsx", bytes: 10 },
        { caminho: "sem-nome" },
        "lixo",
      ]),
    ).toEqual([{ nome: "a.xlsx", caminho: "agua/x/a.xlsx", bytes: 10 }]);
    const avisos = lerAvisos([
      { nivel: "erro", bloco: "05", mensagem: "Faltam 2 linhas" },
      { nivel: "estranho", mensagem: "vira aviso" },
      { nivel: "info" },
    ]);
    expect(avisos).toHaveLength(2);
    expect(contarAvisos(avisos)).toEqual({ erro: 1, aviso: 1, info: 0 });
    expect(lerAvisos(null)).toEqual([]);
  });

  it("resumo em linhas, com um nível aninhado", () => {
    expect(
      linhasDoResumo({
        linhasLidas: 215,
        referencia: "2026-09-01",
        arquivo: { faturados: 238, consumo: 4312.91 },
        blocos: ["01", "05"],
        bate: false,
      }),
    ).toEqual([
      { rotulo: "Linhas lidas", valor: "215" },
      { rotulo: "Referencia", valor: "set/2026" },
      { rotulo: "Arquivo · Faturados", valor: "238" },
      { rotulo: "Arquivo · Consumo", valor: "4.312,91" },
      { rotulo: "Blocos", valor: "01, 05" },
      { rotulo: "Bate", valor: "não" },
    ]);
    expect(linhasDoResumo([1, 2])).toEqual([]);
    expect(rotuloDaChave("valor_lido")).toBe("Valor lido");
  });
});
