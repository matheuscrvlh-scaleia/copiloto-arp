import { describe, expect, it } from "vitest";
import {
  ATRACOES_2026,
  abaAtracoes2025,
  abaAtracoes2026,
  abaEcocopos,
  abaProdutores25,
  abaProdutores26,
  planilha,
} from "./__fixtures__/planilhas";
import { lerAtracoes } from "./atracoes";
import { lerEcocopos } from "./ecocopos";
import { lerProdutores } from "./produtores";

// O arquivo do Mercado Local tem todas as abas; cada leitor pega as suas.
const mercadoLocal = () =>
  planilha([
    abaAtracoes2025(),
    abaAtracoes2026(),
    abaProdutores25(),
    abaProdutores26(),
    abaEcocopos(),
  ]);

describe("lerAtracoes", () => {
  it("conta por mês e confere com o total escrito em cada bloco", async () => {
    const r = await lerAtracoes(await mercadoLocal());
    const meses2026 = r.resumo.por_mes.filter((m) =>
      m.competencia.startsWith("2026"),
    );
    expect(meses2026.map((m) => [m.lidas, m.escritas])).toEqual(
      ATRACOES_2026.map(([, l, e]) => [l, e]),
    );
    expect(meses2026.reduce((s, m) => s + (m.escritas ?? 0), 0)).toBe(289);

    // mai (56 × 57) e ago (26 × 27): aviso com os dois números e decisão.
    const avisos = r.avisos
      .filter((a) => a.nivel === "aviso")
      .map((a) => a.mensagem);
    expect(avisos).toEqual([
      "Maio 2026: 56 lidas × 57 escritas no total do bloco.",
      "Agosto 2026: 26 lidas × 27 escritas no total do bloco.",
    ]);
    expect(
      r.decisoes.map(
        (d) => d.tipo === "confirmar_motivo" && [d.lido, d.escrito],
      ),
    ).toEqual([
      [56, 57],
      [26, 27],
    ]);
  });

  it("monta a data com o dia e o mês do bloco; total não entra", async () => {
    const r = await lerAtracoes(await mercadoLocal());
    expect(r.resumo.linhas).toBe(45 + 287);
    // 2025: blocos sem ano no título usam o ano da aba; total do ano confere.
    expect(r.resumo.por_aba).toContainEqual({
      aba: "Atração 2025",
      lidas: 45,
      escritas: 45,
    });
    const jan = r.linhas.filter((l) => l.data?.startsWith("2026-01"));
    expect(jan).toHaveLength(12);
    expect(jan[0]).toMatchObject({
      data: "2026-01-01",
      tipo: "Oficina",
      horario: "10:00",
      horas_experiencia: 2,
    });
    // Linha sem dia herda o da linha de cima.
    expect(jan[4]?.data).toBe("2026-01-04");
    expect(r.resumo.periodo).toEqual({ de: "2025-11-01", ate: "2026-09-28" });
    expect(r.linhas.some((l) => /ativa/.test(JSON.stringify(l.extras)))).toBe(
      false,
    );
  });
});

describe("lerProdutores", () => {
  it("uma participação por produtor e data; únicos sem acento/caixa", async () => {
    const r = await lerProdutores(await mercadoLocal());
    const jan = r.resumo.por_mes.find((m) => m.competencia === "2026-01");
    expect(jan).toEqual({
      competencia: "2026-01",
      feiras: 4,
      participacoes: 7,
      produtores_unicos: 4,
    });
    // Desenho B (dez/2025): rótulos na coluna A, feiras nas colunas.
    expect(r.resumo.por_mes.find((m) => m.competencia === "2025-12")).toEqual({
      competencia: "2025-12",
      feiras: 2,
      participacoes: 4,
      produtores_unicos: 3,
    });
    expect(r.resumo.feiras).toBe(8);
    expect(r.resumo.participacoes).toBe(r.linhas.length);
  });

  it("qtda diferente da lista → aviso com os dois números", async () => {
    const r = await lerProdutores(await mercadoLocal());
    expect(
      r.avisos.filter((a) => a.nivel === "aviso").map((a) => a.mensagem),
    ).toEqual(["Feira de 2026-01-18: qtda 3 × 2 produtores na lista."]);
  });

  it("nomes parecidos viram decisão de unificar, sem juntar sozinho", async () => {
    const r = await lerProdutores(await mercadoLocal());
    expect(r.decisoes).toHaveLength(1);
    const d = r.decisoes[0];
    expect(d?.tipo).toBe("unificar_nomes");
    if (d?.tipo !== "unificar_nomes") return;
    expect(d.nomes).toEqual([
      { nome: "Quitutes da Dona Zuza", ocorrencias: 4 },
      { nome: "Quitutess da Dona Zuza", ocorrencias: 1 },
    ]);
    expect(d.sugerido).toBe("Quitutes da Dona Zuza");
    // Os dois continuam separados na leitura.
    expect(
      new Set(r.linhas.map((l) => l.produtor)).has("Quitutess da Dona Zuza"),
    ).toBe(true);
  });
});

describe("lerEcocopos", () => {
  it("um lançamento por linha, valor em texto pt-BR, total fora", async () => {
    const r = await lerEcocopos(await mercadoLocal());
    expect(
      r.linhas.map((l) => [l.data, l.tipo, l.quantidade, l.valor]),
    ).toEqual([
      ["2025-01-10", "Ecocopo fictício", 10, 4.25],
      ["2025-01-24", "Ecocopo fictício", 4, 4.25],
      ["2025-02-07", "Caneca inventada", 3, 1234.56],
      ["2025-02-15", "Ecocopo fictício", null, 4.25],
    ]);
    expect(r.avisos.map((a) => a.mensagem)).toEqual([
      '"dois" não é número (quantidade).',
    ]);
    expect(r.resumo.por_mes).toEqual([
      { competencia: "2025-01", lancamentos: 2, quantidade: 14, valor: 8.5 },
      { competencia: "2025-02", lancamentos: 2, quantidade: 3, valor: 1238.81 },
    ]);
  });

  it("arquivo sem a aba avisa com erro", async () => {
    const r = await lerEcocopos(await planilha([abaAtracoes2025()]));
    expect(r.linhas).toEqual([]);
    expect(r.avisos[0]?.nivel).toBe("erro");
  });
});
