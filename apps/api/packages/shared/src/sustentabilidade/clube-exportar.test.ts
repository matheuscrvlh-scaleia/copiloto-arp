import { describe, expect, it } from "vitest";
import {
  celulasDaLinha,
  colunasDasContribuicoes,
  colunasDoClube,
  linhasDasContribuicoes,
  linhasParaExportar,
} from "./clube-exportar";
import {
  agruparLinhas,
  type LinhaClube,
  linhasDoClube,
  type ParticipanteBase,
} from "./clube-lista";

const termo = { ano: 2026, assinadoEm: "2026-03-10", validoAte: "2027-03-10" };
const p = (
  id: string,
  o: Partial<ParticipanteBase> = {},
): ParticipanteBase => ({
  id,
  nome: `Cliente ${id}`,
  doc: "12345678000190",
  locatario: true,
  lucs: ["11_101"],
  blocos: ["11"],
  formas: ["Pagante"],
  termos: [termo],
  saiuEm: null,
  interesse: false,
  ...o,
});

function lista(
  comValores: boolean,
  ps = [p("a"), p("b", { formas: ["Pagante", "Engajado"] })],
) {
  return linhasDoClube({
    participantes: ps,
    ano: 2026,
    hoje: "2026-11-16",
    avisoDias: 30,
    extras: new Map([
      ["a", { contribuido: 100, contribuicoes: 2, acoes: 1, combinadoMes: 50 }],
      [
        "b",
        { contribuido: 40.5, contribuicoes: 1, acoes: 2, combinadoMes: null },
      ],
    ]),
    entrevistas: new Map([["12345678000190", "em_dia" as const]]),
    comValores,
  });
}

describe("colunas do Clube", () => {
  it("com Ver valores: as 12 colunas de 4.5", () => {
    expect(colunasDoClube(true).map((c) => c.titulo)).toEqual([
      "Participante",
      "CPF ou CNPJ",
      "Locatário",
      "LUCs",
      "Formas de participação",
      "Termo do ano assinado em",
      "Válido até",
      "Contribuído no ano",
      "Combinado no ano",
      "Ações no ano",
      "Entrevista",
      "Situação",
    ]);
  });

  it("sem Ver valores: as colunas de reais nem existem", () => {
    const t = colunasDoClube(false).map((c) => c.titulo);
    expect(t).toHaveLength(10);
    expect(t).not.toContain("Contribuído no ano");
    expect(t).not.toContain("Combinado no ano");
    expect(colunasDasContribuicoes(false).map((c) => c.titulo)).not.toContain(
      "Valor",
    );
    expect(colunasDasContribuicoes(true).map((c) => c.titulo)).toContain(
      "Valor",
    );
  });

  it("toda linha tem uma célula por coluna, com e sem valores", () => {
    for (const com of [true, false]) {
      const [l] = lista(com) as [LinhaClube];
      expect(celulasDaLinha(l, com)).toHaveLength(colunasDoClube(com).length);
    }
  });
});

describe("exportação (Excel e PDF iguais à tela)", () => {
  it("linha escrita como na tela e total no rodapé", () => {
    const linhas = linhasParaExportar(agruparLinhas(lista(true), "", []), true);
    expect(linhas[0]).toEqual([
      "Cliente a",
      "12.345.678/0001-90",
      "Sim",
      "11_101",
      "Pagante",
      "10/03/2026",
      "10/03/2027",
      100,
      500,
      1,
      "Em dia",
      "Ativo",
    ]);
    expect(linhas.at(-1)).toEqual([
      "Total",
      "2 participantes",
      "",
      "",
      "",
      "",
      "",
      140.5,
      500,
      3,
      "",
      "",
    ]);
  });

  it("sem Ver valores nenhuma célula tem valor em reais, nem o total", () => {
    const linhas = linhasParaExportar(
      agruparLinhas(lista(false), "", []),
      false,
    );
    expect(linhas.every((l) => l.length === colunasDoClube(false).length)).toBe(
      true,
    );
    const texto = JSON.stringify(linhas);
    expect(texto).not.toContain("100");
    expect(texto).not.toContain("40.5");
    expect(texto).not.toContain("500");
    expect(linhas.at(-1)?.slice(0, 2)).toEqual(["Total", "2 participantes"]);
  });

  it("mesmo com a linha trazendo valor, sem permissão ele não sai", () => {
    const [l] = lista(true) as [LinhaClube];
    expect(celulasDaLinha(l, false)).not.toContain(100);
    expect(celulasDaLinha(l, false)).not.toContain(500);
  });

  it("agrupado: título, linhas, subtotal de cada grupo e total sem repetir quem está em dois", () => {
    const g = agruparLinhas(lista(true), "forma", ["Pagante", "Engajado"]);
    const linhas = linhasParaExportar(g, true);
    expect(linhas.map((l) => l[0])).toEqual([
      "Pagante",
      "Cliente a",
      "Cliente b",
      "Subtotal Pagante",
      "Engajado",
      "Cliente b",
      "Subtotal Engajado",
      "Total",
    ]);
    expect(linhas.at(-1)?.[1]).toBe("2 participantes");
    expect(linhas.at(-1)?.[7]).toBe(140.5);
    expect(linhas[3]?.[1]).toBe("2 participantes");
    expect(linhas[6]?.[1]).toBe("1 participante");
  });
});

describe("Contribuições do Clube", () => {
  const rows = [
    {
      participante: "Café da Serra",
      doc: "12345678000190",
      data: "2026-10-10",
      forma: "PIX",
      competencia: "2026-10-01",
      valor: 150,
      observacao: null,
    },
    {
      participante: "Café da Serra",
      doc: "12345678000190",
      data: "2026-10-18",
      forma: "Material",
      competencia: "2026-10-01",
      valor: 0,
      observacao: "Doação",
    },
  ];
  const fmt = (d: string) => d;

  it("linhas com total; valor zero conta como zero", () => {
    const l = linhasDasContribuicoes(rows, fmt, true);
    expect(l[0]).toEqual([
      "Café da Serra",
      "12345678000190",
      "10/10/2026",
      "PIX",
      "10/2026",
      150,
      "",
    ]);
    expect(l.at(-1)).toEqual(["Total", "2 contribuições", "", "", "", 150, ""]);
  });

  it("sem Ver valores não tem coluna nem total de reais", () => {
    const sem = rows.map((r) => ({ ...r, valor: null }));
    const l = linhasDasContribuicoes(sem, fmt, false);
    expect(
      l.every((x) => x.length === colunasDasContribuicoes(false).length),
    ).toBe(true);
    expect(JSON.stringify(l)).not.toContain("150");
  });
});
