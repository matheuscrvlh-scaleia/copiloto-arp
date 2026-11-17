import { describe, expect, it } from "vitest";
import {
  abaGestao,
  abaQuiosqueJul26,
  abaQuiosqueNov25,
  abaTour,
  abaTourCervejeiro,
  planilha,
} from "./__fixtures__/planilhas";
import { TIPOS_DE_IMPORTACAO } from "./index";
import {
  dataNoMesDaAba,
  lerQuiosque,
  mesDaAbaQuiosque,
  PUBLICOS_PADRAO,
  padronizarPublico,
} from "./quiosque";
import { lerGestao, lerTour } from "./tour";

// "Tour Guiado ARP": abas do quiosque, dos tours e o resumo Gestão juntas.
const tourGuiado = () =>
  planilha([
    abaTour(),
    abaTourCervejeiro(),
    abaGestao(),
    abaQuiosqueNov25(),
    abaQuiosqueJul26(),
  ]);

describe("quiosque: regras", () => {
  it("mês e ano pelo nome da aba", () => {
    expect(mesDaAbaQuiosque("Quiosque_Nov25")).toEqual({ mes: 11, ano: 2025 });
    expect(mesDaAbaQuiosque("Quiosque_Set26")).toEqual({ mes: 9, ano: 2026 });
    expect(mesDaAbaQuiosque("Quiosque")).toBeNull();
  });

  it("inverte dia e mês quando batem com a aba; senão marca para conferir", () => {
    const nov = { mes: 11, ano: 2025 };
    expect(dataNoMesDaAba("05/11/2025", nov)).toEqual({
      data: "2025-11-05",
      invertida: false,
      conferir: false,
    });
    expect(dataNoMesDaAba("11/05/2025", nov)).toEqual({
      data: "2025-11-05",
      invertida: true,
      conferir: false,
    });
    expect(dataNoMesDaAba("13/12/2025", nov)).toEqual({
      data: "2025-12-13",
      invertida: false,
      conferir: true,
    });
    expect(dataNoMesDaAba("05/11/2024", nov).conferir).toBe(true);
    expect(dataNoMesDaAba(null, nov)).toEqual({
      data: null,
      invertida: false,
      conferir: true,
    });
  });

  it("padroniza o público", () => {
    const p = (t: string) => padronizarPublico(t, PUBLICOS_PADRAO).valor;
    expect(p("Friiburguense")).toBe("Friburguense");
    expect(p("Entregador")).toBe("Entrega");
    expect(p("turistas")).toBe("Turista");
    expect(p("")).toBe("Não informado");
    expect(padronizarPublico("Astronauta", PUBLICOS_PADRAO)).toEqual({
      valor: "Astronauta",
      naLista: false,
    });
  });
});

describe("lerQuiosque", () => {
  it("uma pergunta por linha; vazias e só '.' não entram; resumo por mês", async () => {
    const r = await lerQuiosque(await tourGuiado());
    expect(r.resumo.por_mes).toEqual([
      {
        competencia: "2025-11",
        aba: "Quiosque_Nov25",
        perguntas: 6,
        invertidas: 1,
        conferir: 1,
        colunas: ["data", "horario", "pergunta", "publico", "cidade"],
      },
      {
        competencia: "2026-07",
        aba: "Quiosque_Jul26",
        perguntas: 3,
        invertidas: 1,
        conferir: 0,
        colunas: [
          "data",
          "horario",
          "pergunta",
          "publico",
          "cidade",
          "pessoas",
          "dificuldade",
        ],
      },
    ]);
    expect(r.resumo.linhas).toBe(9);
    expect(r.resumo.publico).toEqual({
      Turista: 3,
      Friburguense: 2,
      Entrega: 1,
      Trabalhador: 1,
      "Não informado": 1,
      Astronauta: 1,
    });
  });

  it("datas trocadas corrigidas, colunas novas a partir de jul/2026", async () => {
    const r = await lerQuiosque(await tourGuiado());
    const nov = r.linhas.filter((l) => l.aba === "Quiosque_Nov25");
    expect(nov[1]).toMatchObject({
      data: "2025-11-05",
      invertida: true,
      publico: "Friburguense",
      publico_original: "Friiburguense",
    });
    expect(nov[2]).toMatchObject({
      data: "2025-12-13",
      conferir: true,
      publico: "Entrega",
    });
    expect(nov.every((l) => l.pessoas === null && l.dificuldade === null)).toBe(
      true,
    );
    const jul = r.linhas.filter((l) => l.aba === "Quiosque_Jul26");
    expect(jul.map((l) => [l.data, l.pessoas, l.dificuldade])).toEqual([
      ["2026-07-02", 3, "Nenhuma"],
      ["2026-07-02", 2, "Alguma"],
      ["2026-07-09", null, null],
    ]);
    expect(jul[0]?.horario).toBe("14:00");
    const msgs = r.avisos.map((a) => a.mensagem);
    expect(msgs).toContain(
      "1 data(s) com dia e mês trocados corrigidas para o mês da aba (linhas 3).",
    );
    expect(msgs).toContain(
      'Data "13/12/2025" fora do mês da aba e sem inversão possível: conferir.',
    );
    expect(msgs).toContain(
      'Público "Friiburguense" padronizado como Friburguense (1).',
    );
    expect(msgs).toContain(
      'Público "Astronauta" fora da lista do formulário (1): entra como escrito.',
    );
  });
});

describe("lerTour", () => {
  it("um tour por linha nas duas abas; total fora; resultado calculado sem a coluna", async () => {
    const r = await lerTour(await tourGuiado());
    expect(r.resumo.abas).toEqual(["Tour Guiado", "Tour Cervejeiro"]);
    expect(r.resumo.linhas).toBe(5);
    expect(r.linhas.map((l) => l.tipo)).toEqual([
      "mensal",
      "escolar",
      "mensal",
      "mensal",
      "cervejeiro",
    ]);
    const cerv = r.linhas[4];
    expect(cerv).toMatchObject({
      receita_arp: 300,
      custo_parceiro: 250.5,
      outros_custos: 10,
      resultado: 39.5,
      resultado_calculado: true,
    });
    expect(r.linhas[0]?.custo_album).toBeCloseTo(74.4);
  });

  it("ano calculado diferente da data: avisa e usa a data", async () => {
    const r = await lerTour(await tourGuiado());
    expect(r.linhas[3]?.data).toBe("2025-06-21");
    expect(r.avisos).toContainEqual({
      nivel: "aviso",
      aba: "Tour Guiado",
      linha: 6,
      mensagem:
        "Ano 2024 na planilha, mas a data é 21/06/2025: usado o ano da data.",
    });
  });

  it("confere participantes e resultado por ano com o resumo Gestão", async () => {
    const r = await lerTour(await tourGuiado());
    expect(r.resumo.por_ano).toEqual([
      {
        ano: 2023,
        tours: 2,
        participantes: 70,
        resultado: -300.5,
        gestao_participantes: 70,
        gestao_resultado: -300.5,
      },
      {
        ano: 2024,
        tours: 1,
        participantes: 25,
        resultado: -150.25,
        gestao_participantes: 27,
        gestao_resultado: -150.25,
      },
      {
        ano: 2025,
        tours: 2,
        participantes: 32,
        resultado: -40.5,
        gestao_participantes: 32,
        gestao_resultado: -40.5,
      },
    ]);
    const diferencas = r.avisos
      .filter((a) => a.aba === "Gestão")
      .map((a) => a.mensagem);
    expect(diferencas).toEqual([
      "2024: 25 participantes lidos × 27 no resumo (diferença -2).",
    ]);
  });

  it("Gestão com os anos nas colunas", () => {
    const g = lerGestao({
      nome: "Gestão",
      linhas: [
        [null, 2023, 2024],
        ["Participantes", 583, 393],
        ["Resultado", "-5.954,72", -3032.2],
      ],
    });
    expect(Object.fromEntries(g.porAno)).toEqual({
      2023: { participantes: 583, resultado: -5954.72 },
      2024: { participantes: 393, resultado: -3032.2 },
    });
  });
});

describe("TIPOS_DE_IMPORTACAO", () => {
  it("os seis tipos com rótulo e leitor", async () => {
    expect(Object.keys(TIPOS_DE_IMPORTACAO)).toEqual([
      "entrevistas",
      "atracoes",
      "produtores",
      "ecocopos",
      "quiosque",
      "tour",
    ]);
    const r = await TIPOS_DE_IMPORTACAO.tour.ler(await tourGuiado());
    expect(r.resumo.linhas).toBe(5);
  });
});
