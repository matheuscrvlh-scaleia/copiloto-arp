import { describe, expect, it } from "vitest";
import type { DefinicaoFormulario, Pergunta } from "../formulario/tipos";
import {
  CONTRATOS_FICTICIOS,
  cabecalhoForms,
  ITENS_GRADE,
  linhasForms,
  planilha,
} from "./__fixtures__/planilhas";
import {
  colunasDoForms,
  lerEntrevistas,
  mapearParaDefinicao,
} from "./entrevistas-forms";

const arquivo = (linhas = linhasForms(), cab = cabecalhoForms()) =>
  planilha([{ nome: "Respostas ao formulário 1", linhas: [cab, ...linhas] }]);

describe("colunas do Forms", () => {
  it("46 perguntas; a grade ocupa 3 colunas e é uma pergunta", () => {
    const { carimbo, perguntas } = colunasDoForms(cabecalhoForms());
    expect(carimbo).toBe(0);
    expect(new Set(perguntas.map((p) => p.id)).size).toBe(46);
    expect(perguntas.filter((p) => p.id === "q20").map((p) => p.item)).toEqual(
      ITENS_GRADE,
    );
    expect(
      perguntas.find((p) => p.titulo.endsWith("Pergunta fictícia 21"))?.id,
    ).toBe("q21");
  });

  it("sem número no título, numera pela ordem", () => {
    const { perguntas } = colunasDoForms(cabecalhoForms(false));
    expect(new Set(perguntas.map((p) => p.id)).size).toBe(46);
    expect(perguntas.find((p) => p.titulo === "Possui PGRS?")?.id).toBe("q16");
  });
});

describe("lerEntrevistas", () => {
  it("20 entrevistas: 16 de 1ª vez, 4 de atualização, 4 pedem vínculo", async () => {
    const r = await lerEntrevistas(await arquivo(), {
      contratos: CONTRATOS_FICTICIOS,
    });
    expect(r.resumo).toMatchObject({
      linhas: 20,
      primeira: 16,
      atualizacao: 4,
      sem_luc: 4,
      a_vincular: 4,
      duplicadas: 0,
      perguntas: 46,
    });
    expect(r.resumo.periodo).toEqual({ de: "2026-04-25", ate: "2026-08-12" });
    expect(r.decisoes).toHaveLength(4);
    expect(r.decisoes.every((d) => d.tipo === "vincular_contrato")).toBe(true);
    // LUCs fora do padrão casam com o contrato.
    expect(r.linhas.slice(0, 4).map((l) => l.contrato_id)).toEqual([
      "c-01",
      "c-02",
      "c-03",
      "c-04",
    ]);
    expect(r.linhas[3]?.lucs).toEqual(["11_129", "11_130", "11_202"]);
    expect(r.avisos.filter((a) => a.nivel !== "info")).toEqual([]);
  });

  it("respostas por id q<n>, com a grade como objeto", async () => {
    const r = await lerEntrevistas(await arquivo());
    const conta = (q: string) =>
      r.linhas.reduce<Record<string, number>>((acc, l) => {
        const v = String(l.respostas[q] ?? "em branco");
        acc[v] = (acc[v] ?? 0) + 1;
        return acc;
      }, {});
    expect(conta("q7")).toEqual({ Pouco: 8, Mediano: 6, Nenhum: 5, Muito: 1 });
    expect(conta("q16")).toEqual({ Sim: 2, Não: 17, "em branco": 1 });
    expect(r.linhas[0]?.respostas.q20).toEqual({
      Orgânico: "Pouco",
      Plástico: "Muito",
      Papel: "Não gera",
    });
    expect(r.linhas[0]?.respostas.q5).toBe("2026-04-28");
    // Sem lista de contratos: sem decisões, com aviso.
    expect(r.decisoes).toEqual([]);
    expect(r.avisos.some((a) => /lista de contratos/.test(a.mensagem))).toBe(
      true,
    );
  });

  it("sugere o contrato pelo nome quando não há LUC", async () => {
    const linhas = linhasForms();
    const l = linhas[19];
    if (l) l[1] = "Sem Entrevista Ltda Ficticia";
    const r = await lerEntrevistas(await arquivo(linhas), {
      contratos: CONTRATOS_FICTICIOS,
    });
    const d = r.decisoes.find(
      (x) => x.tipo === "vincular_contrato" && x.linha === 21,
    );
    expect(d?.tipo === "vincular_contrato" && d.sugestoes[0]?.contrato_id).toBe(
      "c-90",
    );
  });

  it("bloqueia a mesma entrevista duas vezes (contrato e data)", async () => {
    const linhas = linhasForms();
    linhas.push([...(linhas[2] ?? [])]);
    const r = await lerEntrevistas(await arquivo(linhas), {
      contratos: CONTRATOS_FICTICIOS,
      existentes: [{ contrato_id: "c-05", data: "2026-05-24" }],
    });
    expect(r.resumo.duplicadas).toBe(2);
    expect(r.resumo.linhas).toBe(19);
    const erros = r.avisos.filter((a) => a.nivel === "erro");
    expect(erros.map((a) => a.linha)).toEqual([6, 22]);
    expect(erros[0]?.mensagem).toMatch(/já importada/);
    expect(erros[1]?.mensagem).toMatch(/repete a linha 4/);
  });

  it("avisa quando o arquivo não tem as 46 perguntas", async () => {
    const cab = cabecalhoForms().slice(0, 40);
    const r = await lerEntrevistas(
      await arquivo(
        linhasForms().map((l) => l.slice(0, 40)),
        cab,
      ),
    );
    expect(r.avisos.some((a) => /tem 37 perguntas/.test(a.mensagem))).toBe(
      true,
    );
  });
});

describe("mapearParaDefinicao", () => {
  const p = (
    x: Partial<Pergunta> & Pick<Pergunta, "id" | "numero" | "tipo">,
  ): Pergunta => ({
    texto: "",
    ajuda: "",
    obrigatoria: false,
    opcoes: [],
    unidades: [],
    mostrar_se: null,
    fonte_indicador: false,
    ativa: true,
    travada: false,
    auto: null,
    ...x,
  });
  const op = (id: string, texto: string) => ({ id, texto, ativa: true });
  const def: DefinicaoFormulario = {
    secoes: [
      {
        id: "s",
        nome: "S",
        ativa: true,
        perguntas: [
          p({
            id: "grau",
            numero: "7",
            tipo: "uma",
            opcoes: [
              op("nenhum", "Nenhum"),
              op("pouco", "Pouco"),
              op("mediano", "Mediano"),
              op("muito", "Muito"),
            ],
          }),
          p({ id: "q16", numero: "16", tipo: "sim_nao" }),
          p({ id: "q10", numero: "10", tipo: "sim_nao_quantidade" }),
          p({
            id: "q19",
            numero: "19",
            tipo: "numero_unidade",
            unidades: ["saco de 100 L", "kg"],
          }),
          p({
            id: "q20",
            numero: "20",
            tipo: "grade",
            opcoes: [op("org", "Orgânico"), op("pla", "Plástico")],
          }),
          p({
            id: "q22",
            numero: "22",
            tipo: "varias",
            opcoes: [
              op("a", "Coletor fictício A"),
              op("b", "Coletor fictício B, azul"),
            ],
          }),
          p({ id: "q8", numero: "8", tipo: "numero" }),
        ],
      },
    ],
  };

  it("converte textos do Forms em ids e deixa o resto pendente", () => {
    const r = mapearParaDefinicao(
      {
        q7: "pouco",
        q16: "Não",
        q10: "Sim, 2",
        q19: "+ - 4 sacos de 100 L",
        q20: { Orgânico: "Mediano", Plástico: "Não gera" },
        q22: "Coletor fictício B, azul, Coletor fictício A",
        q8: "uns dez",
        q99: "x",
      },
      def,
    );
    expect(r.respostas).toEqual({
      grau: "pouco",
      q16: { r: "nao" },
      q10: { r: "sim", d: 2 },
      q19: { n: 4, u: "saco de 100 L" },
      q20: { org: "medio", pla: "nao_gera" },
      q22: ["b", "a"],
    });
    expect(r.pendentes.map((x) => x.pergunta_id)).toEqual(["q8", "q99"]);
  });
});
