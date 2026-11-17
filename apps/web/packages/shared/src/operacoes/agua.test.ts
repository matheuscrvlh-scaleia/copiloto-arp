import { describe, expect, it } from "vitest";
import {
  blocoDe,
  blocoDoNome,
  type Celula,
  campoDoTitulo,
  conciliar,
  dataBr,
  formatarM3,
  formatarVisor,
  lerNomeDaFoto,
  lerPlanilhaAgua,
  lerTextoPdf,
  ligarFotos,
  numeroBr,
  referenciaDe,
  rotuloMes,
  tipoDe,
} from "./agua";

const CABECALHO: Celula[] = [
  "Bloco",
  "Sala / unidade",
  "Cliente",
  "Nº do hidrômetro",
  "Data leitura anterior",
  "Leitura anterior",
  "Data leitura atual",
  "Leitura atual",
  "Dias",
  "Consumo medido (m³)",
  "Volume faturado (m³)",
  "Valor faturado (R$)",
  "Tipo de faturamento",
];

const LINHA = (
  sala: string,
  cliente: string,
  hidro: string,
  ant: Celula,
  atual: Celula,
  consumo: Celula,
  volume: Celula,
  valor: Celula,
  tipo: Celula,
): Celula[] => [
  "05",
  sala,
  cliente,
  hidro,
  "24/08/2026",
  ant,
  "23/09/2026",
  atual,
  "",
  consumo,
  volume,
  valor,
  tipo,
];

function planilha(extra: Celula[][] = [], total?: Celula[]): Celula[][] {
  return [
    ["Espaço ARP - Faturamento Individualizado"],
    ["Referência:", "SET/26"],
    CABECALHO,
    LINHA(
      "101",
      "Café Serra",
      "A18L500618",
      "1.632,060",
      "1.642,060",
      "10,000",
      "10,00",
      "203,28",
      "MÍNIMO",
    ),
    LINHA(
      "107 e 108",
      "Ateliê Lume",
      "A24AK0070837",
      520.5,
      560.5,
      40,
      40,
      1624.4,
      "FATURADO",
    ),
    CABECALHO,
    LINHA(
      "112A",
      "ESTOQUE ARP",
      "D21L002616",
      "88,000",
      "88,000",
      "0,000",
      "0,00",
      "0,00",
      "0",
    ),
    [
      "SUBTOTAL",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "50,000",
      "50,00",
      "1.827,68",
      "",
    ],
    ...extra,
    total ?? [
      "TOTAL",
      "",
      "",
      3,
      "",
      "",
      "",
      "",
      "",
      "50,000",
      "50,00",
      "1.827,68",
      "",
    ],
  ];
}

const OPCOES = { modelo: {}, tolerancia: 0.01 };
const NOME =
  "Espaço ARP - Bloco 05 - Faturamento - Individualizado - SET-2026.xlsx";

function lerOk(linhas: Celula[][], opcoes = OPCOES, nome = NOME) {
  const r = lerPlanilhaAgua(nome, [{ nome: "Plan1", linhas }], opcoes);
  if (!("ok" in r)) throw new Error(JSON.stringify(r));
  return r.ok;
}

describe("números, datas e textos no formato brasileiro", () => {
  it("lê números com milhar e vírgula, reais e números do Excel", () => {
    expect(numeroBr("1.632,060")).toBe(1632.06);
    expect(numeroBr("102,943")).toBe(102.943);
    expect(numeroBr("R$ 8.126,13")).toBe(8126.13);
    expect(numeroBr("1.632")).toBe(1632);
    expect(numeroBr("10.5")).toBe(10.5);
    expect(numeroBr("(1,50)")).toBe(-1.5);
    expect(numeroBr(203.28)).toBe(203.28);
    expect(numeroBr("")).toBeNull();
    expect(numeroBr("-")).toBeNull();
    expect(numeroBr("abc")).toBeNaN();
  });

  it("lê datas dd/mm/aaaa, do Excel e o número de série", () => {
    expect(dataBr("24/08/2026")).toBe("2026-08-24");
    expect(dataBr("24/08/26")).toBe("2026-08-24");
    expect(dataBr(new Date(Date.UTC(2026, 7, 24)))).toBe("2026-08-24");
    const serie = (Date.UTC(2026, 7, 24) - Date.UTC(1899, 11, 30)) / 86_400_000;
    expect(dataBr(serie)).toBe("2026-08-24");
    expect(dataBr("31/02/2026")).toBe("invalida");
    expect(dataBr("")).toBeNull();
  });

  it("acha o mês de referência e o bloco no texto e no nome do arquivo", () => {
    expect(referenciaDe("SET/26")).toBe("2026-09-01");
    expect(referenciaDe("set-2026")).toBe("2026-09-01");
    expect(referenciaDe("09/2026")).toBe("2026-09-01");
    expect(referenciaDe(NOME)).toBe("2026-09-01");
    expect(referenciaDe("sem mês")).toBeNull();
    expect(rotuloMes("2026-09-01")).toBe("SET/26");
    expect(blocoDe("Bloco 05")).toBe("05");
    expect(blocoDe("14 - Cervejaria Pontal")).toBe("14");
    expect(blocoDe(5)).toBe("05");
    expect(blocoDoNome(NOME)).toBe("05");
  });

  it("reconhece os tipos de faturamento como vêm no arquivo", () => {
    expect(tipoDe("MÍNIMO")).toBe("MINIMO");
    expect(tipoDe("0")).toBe("ZERO");
    expect(tipoDe(0)).toBe("ZERO");
    expect(tipoDe("Refaturado")).toBe("REFATURADO");
    expect(tipoDe("FATURADO")).toBe("FATURADO");
    expect(tipoDe("")).toBeNull();
    expect(tipoDe("talvez")).toBe("invalido");
  });

  it("reconhece os campos pelo título, sem confundir data com leitura", () => {
    expect(campoDoTitulo("Data da leitura anterior")).toBe("data_anterior");
    expect(campoDoTitulo("Leitura anterior (m³)")).toBe("leitura_anterior");
    expect(campoDoTitulo("Volume faturado")).toBe("volume_faturado");
    expect(campoDoTitulo("Consumo medido")).toBe("consumo");
    expect(campoDoTitulo("Valor (R$)")).toBe("valor");
    expect(campoDoTitulo("Nº medidor")).toBe("hidrometro");
    expect(campoDoTitulo("Observação")).toBeNull();
  });

  it("formata volumes com duas casas e a leitura como visor", () => {
    expect(formatarM3(102.943)).toBe("102,94 m³");
    expect(formatarVisor(1632.06)).toBe("1632,06");
  });
});

describe("planilha do parceiro", () => {
  it("lê as linhas, ignora cabeçalho repetido e subtotal e acha o resumo", () => {
    const a = lerOk(planilha());
    expect(a.referencia).toBe("2026-09-01");
    expect(a.blocos).toEqual(["05"]);
    expect(a.linhas).toHaveLength(3);
    const [primeira, segunda, terceira] = a.linhas;
    expect(primeira).toMatchObject({
      bloco: "05",
      sala: "101",
      hidrometro: "A18L500618",
      leituraAnterior: 1632.06,
      leituraAtual: 1642.06,
      dataAnterior: "2026-08-24",
      dataAtual: "2026-09-23",
      dias: 30,
      consumo: 10,
      valorCentavos: 20328,
      tipo: "MINIMO",
    });
    expect(segunda?.sala).toBe("107 e 108");
    expect(terceira?.tipo).toBe("ZERO");
    expect(a.ignoradas.map((i) => i.motivo)).toEqual([
      "cabeçalho repetido",
      "subtotal",
    ]);
    expect(a.resumo).toEqual({
      hidrometros: 3,
      faturados: null,
      consumo: 50_000,
      volume: 50_000,
      valor: 182_768,
    });
    expect(conciliar(a, 0.01).bate).toBe(true);
  });

  it("não bate quando faltam linhas ou a soma difere do resumo", () => {
    const total: Celula[] = [
      "TOTAL",
      "",
      "",
      4,
      "",
      "",
      "",
      "",
      "",
      "50,000",
      "50,00",
      "1.900,00",
      "",
    ];
    const c = conciliar(lerOk(planilha([], total)), 0.01);
    expect(c.bate).toBe(false);
    expect(c.diferencas).toEqual([
      "faltam 1 linha(s): 3 lidas, 4 no resumo",
      "valor: a soma das linhas é diferente do resumo",
    ]);
  });

  it("aceita diferença dentro da tolerância e lê o resumo em pares rótulo/valor", () => {
    const linhas = planilha(
      [
        ["Quantidade de hidrômetros", 3],
        ["Valor total", "1.827,69"],
      ],
      ["TOTAL", "", "", "", "", "", "", "", "", "50,000", "50,00", "", ""],
    );
    const a = lerOk(linhas);
    expect(a.resumo?.hidrometros).toBe(3);
    expect(a.resumo?.valor).toBe(182_769);
    expect(conciliar(a, 0.01).bate).toBe(true);
    expect(conciliar(a, 0).bate).toBe(false);
  });

  it("sem resumo no arquivo, a conferência não bate", () => {
    const linhas = planilha().slice(0, -1);
    const c = conciliar(lerOk(linhas), 0.01);
    expect(c.bate).toBe(false);
    expect(c.diferencas[0]).toMatch(/não tem resumo/);
  });

  it("avisa quando o consumo é diferente de leitura atual − anterior", () => {
    const linhas = planilha();
    linhas[3] = LINHA(
      "101",
      "Café Serra",
      "A18L500618",
      100,
      110,
      12,
      12,
      240,
      "FATURADO",
    );
    const a = lerOk(linhas);
    expect(a.avisos).toHaveLength(1);
    expect(a.avisos[0]?.mensagem).toMatch(/consumo 12,00 m³ diferente/);
  });

  it("lista a linha com campo ilegível e o hidrômetro repetido na mesma sala", () => {
    const a = lerOk(
      planilha([
        LINHA("120", "X", "B11L000001", "abc", 10, 10, 10, 1, "FATURADO"),
        LINHA("101", "Café Serra", "A18L500618", 1, 2, 1, 1, 1, "FATURADO"),
      ]),
    );
    expect(a.ignoradas.map((i) => i.motivo)).toEqual([
      "cabeçalho repetido",
      "subtotal",
      'leitura anterior (m³) ilegível ("abc")',
      "repete o hidrômetro A18L500618 da linha 4 (mesma sala)",
    ]);
  });

  it("sem coluna de bloco, usa o bloco do nome do arquivo", () => {
    const sem = planilha().map((l) => l.slice(1));
    const a = lerOk(sem);
    expect(a.blocos).toEqual(["05"]);
  });

  it("sem as colunas obrigatórias, pede o mapeamento", () => {
    const r = lerPlanilhaAgua(
      NOME,
      [
        {
          nome: "Plan1",
          linhas: [
            [
              "Sala",
              "Cliente",
              "Código",
              "Leitura anterior",
              "Leitura atual",
              "Consumo",
              "Volume faturado",
              "Valor",
              "Tipo",
            ],
            ["101", "Café", "A1", 1, 2, 1, 1, 10, "FATURADO"],
          ],
        },
      ],
      OPCOES,
    );
    expect(r).toMatchObject({ colunas: { faltam: ["hidrometro"] } });
  });

  it("o modelo salvo (título ou letra) vale antes dos sinônimos", () => {
    const linhas: Celula[][] = [
      [
        "Sala",
        "Cliente",
        "Código",
        "Leitura anterior",
        "Leitura atual",
        "Consumo",
        "Volume faturado",
        "Valor",
        "Tipo",
      ],
      ["101", "Café", "A1B", 1, 2, 1, 1, 10, "FATURADO"],
      ["Total", "", 1, "", "", 1, 1, 10, ""],
    ];
    for (const modelo of [{ hidrometro: "Código" }, { hidrometro: "C" }]) {
      const a = lerOk(linhas, { modelo, tolerancia: 0.01 });
      expect(a.linhas[0]?.hidrometro).toBe("A1B");
      expect(conciliar(a, 0.01).bate).toBe(true);
    }
  });

  it("recusa planilha sem a tabela de leituras", () => {
    expect(
      lerPlanilhaAgua(NOME, [{ nome: "Capa", linhas: [["Olá"]] }], OPCOES),
    ).toMatchObject({ erro: expect.stringMatching(/Não achei a tabela/) });
  });
});

describe("PDF do parceiro", () => {
  it("PDF só com imagem pede a planilha", () => {
    expect(lerTextoPdf(NOME, ["", "  "], { tolerancia: 0.01 })).toEqual({
      imagem: true,
    });
  });

  it("lê a camada de texto e marca as linhas para conferir", () => {
    const r = lerTextoPdf(
      "Espaço ARP - Bloco 05 - Faturamento - Individualizado - SET-2026.pdf",
      [
        [
          "ESPAÇO ARP - BLOCO 05 - SET/26",
          "101 CAFÉ SERRA A18L500618 24/08/2026 1.632,060 23/09/2026 1.642,060 30 10,000 10,00 203,28 MÍNIMO",
          "112A ESTOQUE ARP D21L002616 24/08/2026 88,000 23/09/2026 88,000 30 0,000 0,00 0,00 0",
          "TOTAL 2 10,000 10,00 203,28",
        ].join("\n"),
      ],
      { tolerancia: 0.01 },
    );
    if (!("ok" in r)) throw new Error(JSON.stringify(r));
    expect(r.ok.referencia).toBe("2026-09-01");
    expect(r.ok.linhas).toHaveLength(2);
    expect(r.ok.linhas[0]).toMatchObject({
      sala: "101",
      cliente: "CAFÉ SERRA",
      leituraAnterior: 1632.06,
      leituraAtual: 1642.06,
      dias: 30,
      consumo: 10,
      volumeFaturado: 10,
      valorCentavos: 20328,
      tipo: "MINIMO",
      conferir: true,
    });
    expect(r.ok.linhas[1]?.tipo).toBe("ZERO");
    expect(conciliar(r.ok, 0.01).bate).toBe(true);
  });
});

describe("fotos dos visores", () => {
  it("lê o nome MES_AA_NÚMERO e só o número", () => {
    expect(lerNomeDaFoto("SET_26_A19L036553.jpg")).toEqual({
      referencia: "2026-09-01",
      hidrometro: "A19L036553",
    });
    expect(lerNomeDaFoto("fotos/set-2026-a19l036553.JPEG")).toEqual({
      referencia: "2026-09-01",
      hidrometro: "A19L036553",
    });
    expect(lerNomeDaFoto("A19L036553.png")).toEqual({
      referencia: null,
      hidrometro: "A19L036553",
    });
    expect(lerNomeDaFoto("foto.jpg")).toBeNull();
    expect(lerNomeDaFoto("SET_26_A19L036553.pdf")).toBeNull();
  });

  it("liga ao hidrômetro e lista outro mês, sem leitura e repetida", () => {
    const r = ligarFotos(
      [
        "SET_26_A19L036553.jpg",
        "AGO_26_A19L036553.jpg",
        "SET_26_Z99Z999999.jpg",
        "A19L036553.png",
        "IMG_0001.jpg",
      ],
      "2026-09-01",
      new Set(["A19L036553"]),
    );
    expect([...r.ligadas]).toEqual([["A19L036553", "SET_26_A19L036553.jpg"]]);
    expect(r.semLeitura).toEqual(["SET_26_Z99Z999999.jpg"]);
    expect(r.recusadas.map((x) => x.nome)).toEqual([
      "AGO_26_A19L036553.jpg",
      "A19L036553.png",
      "IMG_0001.jpg",
    ]);
  });
});
