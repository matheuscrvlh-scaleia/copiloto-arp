import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { criarApp } from "@/app";
import { banco } from "@/infra/banco";
import { descreverComBanco, Navegador, TESTE } from "@/testes/apoio";
import { esquecerLeituras, memoria } from "./memoria";

// Marketing (parte A) na homologação: quem não usa o módulo recebe 403; o
// administrador lê os cadastros e as fontes. Nenhuma ferramenta externa é
// chamada: os conectores e o fetch respondem com falha, e a tela recebe a
// fonte vazia com o aviso, como quando a ferramenta não responde.

const { bloqueado } = vi.hoisted(() => ({
  bloqueado: () =>
    new Proxy(
      {},
      {
        get: () => () =>
          Promise.reject(new Error("chamada externa bloqueada no teste")),
      },
    ),
}));

vi.mock("@/connectors/marketing/meta", async (original) => ({
  ...(await original<typeof import("@/connectors/marketing/meta")>()),
  createMetaClient: bloqueado,
}));
vi.mock("@/connectors/marketing/google", async (original) => ({
  ...(await original<typeof import("@/connectors/marketing/google")>()),
  createGoogleClient: bloqueado,
}));
vi.mock("@/connectors/marketing/asana", async (original) => ({
  ...(await original<typeof import("@/connectors/marketing/asana")>()),
  createAsanaClient: bloqueado,
}));
vi.mock("@/connectors/marketing/site", async (original) => ({
  ...(await original<typeof import("@/connectors/marketing/site")>()),
  createSiteClient: bloqueado,
}));

const MKT = "/api/v1/marketing";

const LEITURAS = [
  "/parametros",
  "/locatarios",
  "/landing-pages",
  "/regras-alerta",
  "/temas-e-codigos",
  "/metas",
  "/referencias",
  "/benchmark",
  "/publico",
  "/eventos/agenda",
  "/historico",
  "/fontes/anuncios",
  "/fontes/rd",
  "/fontes/rd-anuncios",
  "/fontes/site",
  "/fontes/redes",
  "/fontes/asana",
  "/fontes/reputacao",
];

describe("memória das leituras ao vivo", () => {
  it("guarda pelo tempo dado, divide a leitura em curso e esquece pela tag", async () => {
    const lembrar = memoria<number>("asana");
    let leituras = 0;
    const ler = async () => ({ valor: ++leituras, validade: 60_000 });
    const [a, b] = await Promise.all([lembrar("k", ler), lembrar("k", ler)]);
    expect([a, b, leituras]).toEqual([1, 1, 1]);
    expect(await lembrar("k", ler)).toBe(1);
    esquecerLeituras("meta");
    expect(await lembrar("k", ler)).toBe(1);
    esquecerLeituras("asana");
    expect(await lembrar("k", ler)).toBe(2);
  });

  it("falha não fica guardada", async () => {
    const lembrar = memoria<number>("google");
    await expect(
      lembrar("k", () => Promise.reject(new Error("fora"))),
    ).rejects.toThrow("fora");
    expect(await lembrar("k", async () => ({ valor: 7, validade: 1 }))).toBe(7);
  });
});

descreverComBanco("marketing (/api/v1/marketing)", () => {
  let app: FastifyInstance;
  let admin: Navegador;
  let semAcesso: Navegador;

  beforeAll(async () => {
    vi.stubGlobal("fetch", () =>
      Promise.reject(new Error("chamada externa bloqueada no teste")),
    );
    app = await criarApp();
    admin = new Navegador(app);
    semAcesso = new Navegador(app);
    for (const [n, email] of [
      [admin, TESTE.email],
      [semAcesso, TESTE.emailSemAcesso],
    ] as const) {
      const r = await n.pedir("POST", "/api/v1/auth/entrar", {
        email,
        senha: TESTE.senha,
      });
      expect(r.statusCode).toBe(200);
    }
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await app.close();
    await banco.encerrar();
  });

  it("sem acesso ao módulo: 403 em toda leitura", async () => {
    for (const caminho of LEITURAS) {
      const r = await semAcesso.pedir("GET", `${MKT}${caminho}`);
      expect(r.statusCode, caminho).toBe(403);
    }
  });

  it("o administrador lê todos os cadastros e as fontes", async () => {
    for (const caminho of LEITURAS) {
      const r = await admin.pedir("GET", `${MKT}${caminho}`);
      expect(r.statusCode, caminho).toBe(200);
    }
  }, 120_000);

  it("cadastros: a linha única dos parâmetros e as metas só de marketing.*", async () => {
    const p = (await admin.pedir("GET", `${MKT}/parametros`)).json();
    expect(p.parametros.id).toBe(true);
    expect(Array.isArray(p.parametros.quadros_ocultos)).toBe(true);
    const m = (await admin.pedir("GET", `${MKT}/metas`)).json();
    for (const meta of m.metas)
      expect(meta.indicador.startsWith("marketing.")).toBe(true);
  });

  it("ferramenta que não responde: fonte real vazia, com aviso; sem exemplo", async () => {
    const a = (await admin.pedir("GET", `${MKT}/fontes/anuncios`)).json();
    expect(a.metaReal).toBe(false);
    expect(typeof a.avisoMeta).toBe("string");
    expect(a.googleReal).toBe(false);
    expect(a.meta.insights).toEqual([]);
    // TikTok não está ligado: vazio, sem dado de exemplo.
    expect(a.tiktok.campanhas).toEqual([]);
    expect(a.campanhas).toEqual([]);

    const s = (await admin.pedir("GET", `${MKT}/fontes/site`)).json();
    expect(s.siteReal).toBe(false);
    expect(s.ga4).toEqual([]);

    const asana = (await admin.pedir("GET", `${MKT}/fontes/asana`)).json();
    expect(asana.tarefas).toEqual([]);
    expect(typeof asana.aviso).toBe("string");
  });

  it("reputação e redes não ligadas vêm vazias; histórico respeita o limite", async () => {
    const r = (await admin.pedir("GET", `${MKT}/fontes/reputacao`)).json();
    expect(r).toEqual({ locais: [], avaliacoes: [], temas: [] });
    const redes = (await admin.pedir("GET", `${MKT}/fontes/redes`)).json();
    expect(redes.youtube.dias).toEqual([]);
    expect(redes.tiktok.videos).toEqual([]);
    const h = (await admin.pedir("GET", `${MKT}/historico?limite=3`)).json();
    expect(h.alteracoes.length).toBeLessThanOrEqual(3);
  });
});
