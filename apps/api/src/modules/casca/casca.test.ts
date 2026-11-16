import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { criarApp } from "@/app";
import { banco } from "@/infra/banco";
import { eventosPendentes } from "@/infra/eventos";
import { descreverComBanco, Navegador, TESTE } from "@/testes/apoio";

// O banco de homologação fica atrás de um túnel: cada pedido demora.
vi.setConfig({ testTimeout: 120_000 });

const V1 = "/api/v1";
const FILTROS = `${V1}/preferencias/filtros/marketing/teste_do_porte`;

descreverComBanco("casca (avisos, sino, filtros lembrados)", () => {
  let app: FastifyInstance;
  let admin: Navegador;
  let semAcesso: Navegador;

  beforeAll(async () => {
    app = await criarApp();
    admin = new Navegador(app);
    semAcesso = new Navegador(app);
    for (const [n, email] of [
      [admin, TESTE.email],
      [semAcesso, TESTE.emailSemAcesso],
    ] as const) {
      const r = await n.pedir("POST", `${V1}/auth/entrar`, {
        email,
        senha: TESTE.senha,
      });
      expect(r.statusCode).toBe(200);
    }
  });
  afterAll(async () => {
    await eventosPendentes();
    await app.close();
    await banco.encerrar();
  });

  it("sem sessão não responde", async () => {
    const n = new Navegador(app);
    for (const rota of ["avisos", "notificacoes"])
      expect((await n.pedir("GET", `${V1}/${rota}`)).statusCode).toBe(401);
  });

  it("avisos: lista para o administrador e vazio para quem não resolve nada", async () => {
    const r = await admin.pedir("GET", `${V1}/avisos`);
    expect(r.statusCode).toBe(200);
    for (const a of r.json().avisos)
      expect(Object.keys(a).sort()).toEqual([
        "descricao",
        "href",
        "id",
        "titulo",
      ]);
    const s = await semAcesso.pedir("GET", `${V1}/avisos`);
    expect(s.json()).toEqual({ avisos: [] });
  });

  it("notificações: as da pessoa; quem não tem Tickets nem Comercial recebe vazio", async () => {
    const r = await admin.pedir("GET", `${V1}/notificacoes`);
    expect(r.statusCode).toBe(200);
    expect(Array.isArray(r.json().notificacoes)).toBe(true);
    expect(r.json().notificacoes.length).toBeLessThanOrEqual(30);
    const s = await semAcesso.pedir("GET", `${V1}/notificacoes`);
    expect(s.json()).toEqual({ notificacoes: [] });
  });

  it("marcar como lida só alcança as da própria pessoa", async () => {
    // Quem não tem notificação alguma: nada muda, e a rota responde.
    const uma = await semAcesso.pedir("POST", `${V1}/notificacoes/1/lida`);
    expect(uma.statusCode).toBe(200);
    const todas = await semAcesso.pedir("POST", `${V1}/notificacoes/lidas`);
    expect(todas.statusCode).toBe(200);
    const invalida = await admin.pedir("POST", `${V1}/notificacoes/abc/lida`);
    expect(invalida.statusCode).toBe(400);
  });

  it("o sino não conta como uso da sessão", async () => {
    const antes = (await admin.pedir("GET", `${V1}/auth/eu`)).json().sessao;
    await admin.pedir("GET", `${V1}/notificacoes`);
    await admin.pedir("GET", `${V1}/avisos`);
    const depois = (await admin.pedir("GET", `${V1}/auth/eu`)).json().sessao;
    expect(depois.inatividade_em).toBe(antes.inatividade_em);
  });

  it("filtros lembrados: grava, lê e apaga; cada pessoa tem os seus", async () => {
    expect((await admin.pedir("GET", FILTROS)).json()).toEqual({ query: null });
    const gravou = await admin.pedir("PUT", FILTROS, {
      query: "periodo=mes&plataforma=meta",
    });
    expect(gravou.statusCode).toBe(200);
    expect((await admin.pedir("GET", FILTROS)).json()).toEqual({
      query: "periodo=mes&plataforma=meta",
    });
    expect((await semAcesso.pedir("GET", FILTROS)).json()).toEqual({
      query: null,
    });
    await admin.pedir("PUT", FILTROS, { query: "periodo=semana" });
    expect((await admin.pedir("GET", FILTROS)).json().query).toBe(
      "periodo=semana",
    );
    // Vazio apaga (botão Limpar).
    await admin.pedir("PUT", FILTROS, { query: "" });
    expect((await admin.pedir("GET", FILTROS)).json()).toEqual({ query: null });
  });

  it("filtros lembrados: módulo ou tela fora do padrão é recusado", async () => {
    const modulo = await admin.pedir(
      "GET",
      `${V1}/preferencias/filtros/financeiro/tela`,
    );
    expect(modulo.statusCode).toBe(400);
    const tela = await admin.pedir(
      "PUT",
      `${V1}/preferencias/filtros/marketing/Tela-1`,
      { query: "a=1" },
    );
    expect(tela.statusCode).toBe(400);
  });
});
