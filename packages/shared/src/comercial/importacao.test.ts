import { describe, expect, it } from "vitest";
import {
  type ContextoFeedbacks,
  chaveDoFeedback,
  dataDaCelula,
  lerFeedbacks,
} from "./feedbacks-importacao";
import {
  aplicarEscolhas,
  conferirCabecalho,
  contarPrevia,
  escolhasDoForm,
  gruposDeDuplicadas,
  indicesDasColunas,
  type LinhaDaPrevia,
} from "./importacao";

describe("conferirCabecalho", () => {
  const esperado = ["Carimbo de data/hora", "Empresa", "Bloco"];
  it("confere ignorando acento, caixa, espaço e colunas vazias no fim", () => {
    expect(
      conferirCabecalho("Respostas", esperado, [
        "carimbo de data/hora ",
        "EMPRESA",
        "Bloco:",
        "",
        null,
      ]),
    ).toBeNull();
  });
  it("coluna a menos bloqueia e diz qual falta", () => {
    expect(
      conferirCabecalho("Respostas", esperado, [
        "Carimbo de data/hora",
        "Empresa",
      ]),
    ).toMatchObject({ faltam: ["Bloco"], sobram: [], foraDeOrdem: false });
  });
  it("coluna renomeada aparece como falta e como sobra", () => {
    expect(
      conferirCabecalho("Respostas", esperado, [
        "Carimbo de data/hora",
        "Razão social",
        "Bloco",
      ]),
    ).toMatchObject({ faltam: ["Empresa"], sobram: ["Razão social"] });
  });
  it("com ordem: mesmas colunas fora da ordem bloqueiam", () => {
    const r = conferirCabecalho(
      "Forms",
      esperado,
      ["Empresa", "Carimbo de data/hora", "Bloco"],
      { emOrdem: true },
    );
    expect(r?.foraDeOrdem).toBe(true);
    expect(
      conferirCabecalho("Forms", esperado, [...esperado, "Extra"], {
        sobrasPermitidas: true,
      }),
    ).toBeNull();
  });
  it("índices das colunas pelo nome", () => {
    expect(
      indicesDasColunas({ empresa: "Empresa", bloco: "Bloco", x: "Nada" }, [
        "Data",
        "empresa",
        "BLOCO",
      ]),
    ).toEqual({ empresa: 1, bloco: 2, x: -1 });
  });
});

describe("escolhas de duplicadas", () => {
  const itens: LinhaDaPrevia[] = [
    {
      linha: 2,
      valores: ["A"],
      duplicada: true,
      entra: false,
      avisos: ["repetida"],
      grupo: "Empresa A",
    },
    { linha: 3, valores: ["B"], duplicada: false, entra: true, avisos: [] },
    {
      linha: 4,
      valores: ["A"],
      duplicada: true,
      entra: true,
      avisos: ["repetida"],
      grupo: "Empresa A",
    },
  ];
  it("conta e agrupa", () => {
    expect(contarPrevia(itens)).toEqual({
      linhas: 3,
      duplicadas: 2,
      comAviso: 2,
      entram: 2,
    });
    expect(
      gruposDeDuplicadas(itens).map((g) => g.linhas.map((l) => l.linha)),
    ).toEqual([[2, 4]]);
  });
  it("a pessoa troca qual linha conta; escolha inválida é ignorada", () => {
    const form = new FormData();
    form.set("escolha.Empresa A", "2");
    form.set("escolha.Outra", "3");
    form.set("importacao_id", "x");
    const escolhas = escolhasDoForm(form);
    expect([...escolhas]).toEqual([
      ["Empresa A", 2],
      ["Outra", 3],
    ]);
    const r = aplicarEscolhas(itens, escolhas);
    expect(r.map((i) => i.entra)).toEqual([true, true, false]);
    expect(aplicarEscolhas(itens, new Map([["Empresa A", 3]]))).toEqual(itens);
  });
});

describe("lerFeedbacks", () => {
  const ctx: ContextoFeedbacks = {
    tiposFeedback: ["Feedback positivo", "Reclamação", "Sugestão"],
    canais: ["Presencial", "WhatsApp"],
    existentes: new Set(),
  };
  const aba = (linhas: (string | number | Date | null)[][]) => [
    { nome: "Base de Dados", linhas: [] },
    { nome: "Feedbacks", linhas },
  ];

  it("lê a aba, normaliza a data e aplica tipo e canal padrão com aviso", () => {
    const r = lerFeedbacks(
      aba([
        ["Feedbacks 2021-2022"],
        ["Data", "Cliente", "LUC", "Tipo", "Feedback", "Obs. interna"],
        [
          new Date(Date.UTC(2021, 4, 3)),
          "Loja Exemplo",
          "03_105",
          "reclamação",
          "Pediu mais sinalização",
          "x",
        ],
        ["15/02/2022", "Café Fictício", "", "", "Elogiou a limpeza", ""],
        [null, null, null, null, null, null],
      ]),
      ctx,
    );
    expect("ok" in r).toBe(true);
    if (!("ok" in r)) return;
    const [a, b] = r.ok.linhas;
    expect(a).toMatchObject({
      linha: 3,
      entra: true,
      duplicada: false,
      dados: {
        data: "2021-05-03",
        locatario_nome: "Loja Exemplo",
        luc: "03_105",
        tipo: "Reclamação",
        canal: "Presencial",
      },
    });
    expect(a?.avisos).toEqual(["Sem canal: entra como “Presencial”"]);
    expect(b?.dados).toMatchObject({
      data: "2022-02-15",
      tipo: "Feedback positivo",
      luc: null,
    });
    expect(b?.avisos).toHaveLength(2);
    expect(r.ok.linhas).toHaveLength(2);
    expect(r.ok.avisos[0]?.mensagem).toContain("Obs. interna");
  });

  it("coluna a menos bloqueia mostrando o que falta", () => {
    const r = lerFeedbacks(
      aba([
        ["Data", "Cliente"],
        ["01/01/2022", "X"],
      ]),
      ctx,
    );
    expect(r).toMatchObject({
      cabecalho: {
        aba: "Feedbacks",
        faltam: ["Feedback"],
        recebido: ["Data", "Cliente"],
      },
    });
  });

  it("repetido no arquivo ou já registrado fica fora como duplicada", () => {
    const existente = chaveDoFeedback({
      data: "2022-01-01",
      locatario_nome: "loja um",
      descricao: "Texto A",
    });
    const r = lerFeedbacks(
      aba([
        ["Data", "Locatário", "Feedback"],
        ["01/01/2022", "Loja Um", "Texto A"],
        ["02/01/2022", "Loja Dois", "Texto B"],
        ["02/01/2022", "Loja Dois", "Texto B"],
        ["31/02/2022", "Loja Três", "Texto C"],
      ]),
      { ...ctx, existentes: new Set([existente]) },
    );
    if (!("ok" in r)) throw new Error("devia ler");
    expect(r.ok.linhas.map((l) => [l.entra, l.duplicada])).toEqual([
      [false, true],
      [true, false],
      [false, true],
      [false, false],
    ]);
    expect(r.ok.linhas[3]?.avisos[0]).toContain("Data inválida");
  });

  it("sem aba Feedbacks em planilha de várias abas dá erro", () => {
    expect(
      lerFeedbacks(
        [
          { nome: "A", linhas: [] },
          { nome: "B", linhas: [] },
        ],
        ctx,
      ),
    ).toMatchObject({ erro: expect.stringContaining("Feedbacks") });
  });

  it("datas", () => {
    expect(dataDaCelula(44562)).toBe("2022-01-01");
    expect(dataDaCelula("2022-03-04")).toBe("2022-03-04");
    expect(dataDaCelula("5/3/22")).toBe("2022-03-05");
    expect(dataDaCelula("cerca de março")).toBeNull();
  });
});
