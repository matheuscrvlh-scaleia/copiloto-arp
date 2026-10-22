import { describe, expect, it } from "vitest";
import {
  diferencas,
  lerFiltrosHistorico,
  rotuloDaAcao,
  tabelasQueCasam,
  urlDaPagina,
} from "./historico";

describe("filtros do histórico na URL", () => {
  it("lê os filtros válidos", () => {
    expect(
      lerFiltrosHistorico({
        q: "  encargos ",
        modulo: "rh",
        tipo: "alteracao",
        quem: "3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b",
        de: "2026-10-01",
        ate: "2026-10-22",
        pagina: "3",
      }),
    ).toEqual({
      busca: "encargos",
      modulo: "rh",
      tipo: "alteracao",
      usuario: "3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b",
      de: "2026-10-01",
      ate: "2026-10-22",
      pagina: 3,
    });
  });

  it("valor inválido vira sem filtro; datas trocadas são desviradas", () => {
    expect(
      lerFiltrosHistorico({
        modulo: "outro",
        tipo: ["evento", "x"],
        quem: "nao-e-uuid",
        de: "2026-10-22",
        ate: "2026-10-01",
        pagina: "-1",
      }),
    ).toEqual({
      busca: "",
      modulo: null,
      tipo: "evento",
      usuario: null,
      de: "2026-10-01",
      ate: "2026-10-22",
      pagina: 1,
    });
    expect(lerFiltrosHistorico({ de: "2026-02-31" }).de).toBeNull();
  });

  it("monta o link de outra página com os mesmos filtros", () => {
    const f = lerFiltrosHistorico({ q: "folha", modulo: "rh", pagina: "2" });
    expect(urlDaPagina(f, 3)).toBe("?q=folha&modulo=rh&pagina=3");
    expect(urlDaPagina(f, 1)).toBe("?q=folha&modulo=rh");
  });
});

describe("nomes na tela", () => {
  it("acha a tabela pelo nome amigável, sem acento", () => {
    expect(tabelasQueCasam("beneficio")).toEqual([
      "rh.beneficios",
      "rh.colaborador_beneficios",
    ]);
    expect(tabelasQueCasam("  ")).toEqual([]);
  });

  it("dá nome à ação de cada tipo", () => {
    expect(rotuloDaAcao({ tipo: "alteracao", acao: "update" })).toBe("Alterou");
    expect(rotuloDaAcao({ tipo: "sincronizacao", acao: "erro" })).toBe(
      "Falhou",
    );
    expect(rotuloDaAcao({ tipo: "evento", acao: "login_falhou" })).toBe(
      "Errou o login",
    );
    expect(rotuloDaAcao({ tipo: "evento", acao: "novo_evento" })).toBe(
      "novo_evento",
    );
  });
});

describe("o que mudou", () => {
  it("na alteração, só os campos diferentes (sem as datas automáticas)", () => {
    expect(
      diferencas(
        { nome: "A", ativo: true, rat_pct: 1, atualizado_em: "x" },
        { nome: "A", ativo: false, rat_pct: 2, atualizado_em: "y" },
      ),
    ).toEqual([
      { campo: "ativo", antes: "sim", depois: "não" },
      { campo: "rat_pct", antes: "1", depois: "2" },
    ]);
  });

  it("ao criar, os campos preenchidos; ao remover, os que havia", () => {
    expect(diferencas(null, { nome: "A", descricao: null })).toEqual([
      { campo: "nome", antes: null, depois: "A" },
    ]);
    expect(diferencas({ faixas: [1, 2] }, null)).toEqual([
      { campo: "faixas", antes: "[1,2]", depois: null },
    ]);
  });
});
