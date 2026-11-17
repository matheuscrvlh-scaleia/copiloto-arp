import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarApp } from "@/app";
import {
  acharFonte,
  detalheDaFonte,
  type Fonte,
  montarCatalogo,
  textoDoCatalogo,
} from "./catalogo";
import { compactar, executarFerramenta } from "./ferramentas";

// O catálogo da IA sai das rotas registradas de verdade: este teste monta o
// app inteiro (sem banco) e confere o que entra, o que fica de fora e como a
// IA acha a fonte de um caminho concreto.

let app: FastifyInstance;
let fontes: Fonte[];

beforeAll(async () => {
  app = await criarApp();
  fontes = montarCatalogo(app.rotas);
});
afterAll(async () => {
  await app.close();
});

describe("catálogo de fontes", () => {
  it("enxerga as leituras de todos os módulos", () => {
    const modulos = new Set(fontes.map((f) => f.modulo));
    for (const m of [
      "rh",
      "financeiro",
      "os",
      "marketing",
      "comercial",
      "operacoes",
      "sustentabilidade",
      "calendario",
    ])
      expect(modulos).toContain(m);
    expect(fontes.length).toBeGreaterThan(80);
  });

  it("leva a permissão da rota e os campos da resposta", () => {
    const painel = fontes.find((f) => f.caminho === "/sustentabilidade/painel");
    expect(painel?.permissao).toBe("sustentabilidade.painel");
    expect(painel?.campos.length).toBeGreaterThan(0);
  });

  it("deixa de fora acesso, arquivos, a própria IA, rotas públicas e downloads", () => {
    const caminhos = fontes.map((f) => f.caminho);
    expect(caminhos.some((c) => c.startsWith("/auth"))).toBe(false);
    expect(caminhos.some((c) => c.startsWith("/arquivos"))).toBe(false);
    expect(caminhos.some((c) => c.startsWith("/ia"))).toBe(false);
    const publicas = app.rotas
      .filter((r) => r.acesso === "publico")
      .map((r) => r.url.replace("/api/v1", ""));
    expect(caminhos.filter((c) => publicas.includes(c))).toEqual([]);
    // Rota GET sem schema de resposta (PDF, planilha) não é fonte.
    const semResposta = app.rotas
      .filter((r) => r.metodo === "GET" && r.schemas.resposta === undefined)
      .map((r) => r.url.replace("/api/v1", ""));
    expect(caminhos.filter((c) => semResposta.includes(c))).toEqual([]);
  });

  it("acha a fonte de um caminho com parâmetro, preferindo o mais específico", () => {
    const comParametro = fontes.find((f) => f.params.length > 0);
    expect(comParametro).toBeDefined();
    if (!comParametro) return;
    const concreto = comParametro.caminho.replace(/:[^/]+/g, "abc123");
    expect(acharFonte(fontes, concreto)?.caminho).toBe(comParametro.caminho);
    expect(acharFonte(fontes, "/nao/existe")).toBeNull();
  });

  it("o texto do catálogo cabe nas instruções (e lista as permissões)", () => {
    const texto = textoDoCatalogo(fontes);
    expect(texto).toContain("/sustentabilidade/painel");
    expect(texto).toContain("# O que cada permissão libera");
    // ≈ 4 caracteres por token: bem abaixo de 40 mil tokens.
    expect(texto.length).toBeLessThan(160_000);
  });

  it("o detalhe mostra parâmetros e o esboço da resposta", () => {
    const f = fontes.find((x) => x.consulta.length > 0);
    expect(f).toBeDefined();
    if (!f) return;
    const d = detalheDaFonte(f);
    expect(d).toContain("Parâmetros de consulta");
    expect(d).toContain("Resposta:");
  });
});

describe("ferramentas", () => {
  const ctx = {
    ip: "127.0.0.1",
    agente: null,
    requisicaoId: "t",
    usuario: {
      id: "00000000-0000-0000-0000-000000000001",
      nome: "T",
      email: "t@t",
    },
    permissoes: new Set<never>(),
    senhaProvisoria: false,
    sessao: {
      id: "00000000-0000-0000-0000-000000000002",
      inicio: new Date(),
      ultimoUso: new Date(),
      acessoExpiraEm: new Date(),
    },
  };

  it("recusa caminho fora do catálogo ou com truque", async () => {
    for (const caminho of [
      "/auth/eu",
      "/ia/config",
      "/../auth/eu",
      "/rh/painel?x=1",
      "//rh",
      "rh/painel",
    ]) {
      const r = await executarFerramenta(ctx, fontes, "consultar", { caminho });
      expect(r.erro, caminho).toBe(true);
    }
  });

  it("não lê fonte cuja permissão a pessoa não tem (e diz qual)", async () => {
    const r = await executarFerramenta(ctx, fontes, "consultar", {
      caminho: "/sustentabilidade/painel",
    });
    expect(r.erro).toBe(true);
    expect(r.conteudo).toContain("sustentabilidade.painel");
    expect(r.fonte).toEqual({
      caminho: "/sustentabilidade/painel",
      modulo: "sustentabilidade",
      ok: false,
    });
  });

  it("entrada malformada e ferramenta desconhecida viram erro, não exceção", async () => {
    expect(
      (await executarFerramenta(ctx, fontes, "consultar", { x: 1 })).erro,
    ).toBe(true);
    expect((await executarFerramenta(ctx, fontes, "apagar", {})).erro).toBe(
      true,
    );
  });

  it("detalha fontes do catálogo", async () => {
    const r = await executarFerramenta(ctx, fontes, "detalhar_fontes", {
      caminhos: ["/sustentabilidade/painel", "/nada"],
    });
    expect(r.erro).toBe(false);
    expect(r.conteudo).toContain("# /sustentabilidade/painel");
    expect(r.conteudo).toContain("Não é uma fonte do catálogo.");
  });
});

describe("compactar", () => {
  it("corta listas longas e diz o total", () => {
    const dados = { itens: Array.from({ length: 1000 }, (_, i) => ({ i })) };
    const texto = compactar(dados, 2000);
    expect(texto.length).toBeLessThanOrEqual(2000 + 80);
    expect(texto).toContain("de 1000 itens");
  });

  it("dado pequeno passa inteiro", () => {
    expect(compactar({ a: [1, 2, 3] })).toBe('{"a":[1,2,3]}');
  });
});
