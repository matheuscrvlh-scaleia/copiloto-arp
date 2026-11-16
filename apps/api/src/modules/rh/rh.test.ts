import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { criarApp } from "@/app";
import { banco } from "@/infra/banco";
import { descreverComBanco, Navegador, TESTE } from "@/testes/apoio";

// RH parte A de ponta a ponta na homologação: quem não tem acesso recebe 403
// em toda leitura e gravação; o administrador lê todas as telas. O Copiloto
// RH (turnover) nunca é chamado de verdade: o cliente falha como "não
// configurado" e as telas mostram o motivo.

vi.mock("@/modules/sync/credenciais.service", async (original) => {
  const m =
    await original<typeof import("@/modules/sync/credenciais.service")>();
  return {
    ...m,
    copilotoRh: () =>
      Promise.reject(
        new m.IntegracaoNaoConfigurada("copiloto_rh", "desligado nos testes"),
      ),
  };
});

// Só os módulos que o teste usa: um módulo de outro pedaço ainda incompleto
// não derruba este arquivo.
vi.mock("@/modules", async () => {
  const { auth } = await import("@/modules/auth");
  const { rh } = await import("@/modules/rh");
  return {
    MODULOS: [
      { prefixo: "/auth", plugin: auth },
      { prefixo: "/rh", plugin: rh },
    ],
    EXTERNOS: [],
    ROTINAS: [],
  };
});

const RH = "/api/v1/rh";
const PERIODO = "de=2026-10-01&ate=2026-10-31";

descreverComBanco("rh parte A (/api/v1/rh)", () => {
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
      const r = await n.pedir("POST", "/api/v1/auth/entrar", {
        email,
        senha: TESTE.senha,
      });
      expect(r.statusCode).toBe(200);
    }
  });

  afterAll(async () => {
    await app.close();
    await banco.encerrar();
  });

  it("sem acesso ao RH: 403 em toda leitura e gravação", async () => {
    const id = randomUUID();
    const pedidos = [
      ["GET", `${RH}/painel?${PERIODO}`],
      ["GET", `${RH}/quadro?${PERIODO}`],
      ["GET", `${RH}/jornada?${PERIODO}`],
      ["GET", `${RH}/funcionarios`],
      ["GET", `${RH}/funcionarios/${id}`],
      ["GET", `${RH}/banco-de-horas`],
      ["GET", `${RH}/parametros`],
      ["GET", `${RH}/detalhes/quadro?de=2026-10-01&fim=2026-10-31&foco=ativos`],
      [
        "GET",
        `${RH}/detalhes/memoria-do-custo?competencia=2026-10-01&colaborador=${id}`,
      ],
      ["POST", `${RH}/funcionarios/${id}/fora-do-ponto`, { fora: "sim" }],
      ["POST", `${RH}/banco-de-horas/fechar`, {}],
      ["PATCH", `${RH}/banco-de-horas/ciclos/${id}`, {}],
      ["POST", `${RH}/banco-de-horas/ciclos/${id}/finalizar`, {}],
    ] as const;
    for (const [metodo, url, corpo] of pedidos) {
      const r = await semAcesso.pedir(metodo, url, corpo);
      expect(r.statusCode, `${metodo} ${url}`).toBe(403);
    }
  });

  describe("administrador", () => {
    it("painel: indicadores e detalhes prontos; turnover com o motivo", async () => {
      const r = await admin.pedir("GET", `${RH}/painel?${PERIODO}`);
      expect(r.statusCode).toBe(200);
      const p = r.json();
      expect(p.filtros.periodo).toMatchObject({
        de: "2026-10-01",
        ate: "2026-10-31",
      });
      expect(p.quadro.evolucao).toHaveLength(12);
      expect(p.quadro.turnover).toBeNull();
      expect(p.quadro.semTurnover).toBe(
        "Cadastre o Copiloto RH em Administração › Integrações.",
      );
      // Com rh.quadro, a lista de pessoas vem ao abrir o modal.
      expect(p.quadro.origemAtivos.tabelas).toEqual([]);
      expect(p.quadro.origemAtivos.carga).toMatchObject({ foco: "ativos" });
    });

    it("quadro, jornada, parâmetros e fechamento respondem", async () => {
      for (const url of [
        `${RH}/quadro?${PERIODO}`,
        `${RH}/jornada?${PERIODO}`,
        `${RH}/parametros`,
        `${RH}/banco-de-horas`,
        `${RH}/banco-de-horas?aba=anteriores`,
      ]) {
        const r = await admin.pedir("GET", url);
        expect(r.statusCode, url).toBe(200);
      }
      const q = (await admin.pedir("GET", `${RH}/quadro?${PERIODO}`)).json();
      expect(q.colaboradores.length).toBeGreaterThan(0);
      expect(q.turnover).toMatchObject({ ok: false });
    });

    it("detalhes do quadro: a lista de pessoas do período", async () => {
      const r = await admin.pedir(
        "GET",
        `${RH}/detalhes/quadro?de=2026-10-01&fim=2026-10-31&foco=ativos&rotulo=out%2F2026`,
      );
      expect(r.statusCode).toBe(200);
      expect(r.json().tabelas.length).toBeGreaterThan(0);
    });

    it("funcionários: lista, perfil, id inexistente e id inválido", async () => {
      const lista = await admin.pedir("GET", `${RH}/funcionarios`);
      expect(lista.statusCode).toBe(200);
      const [primeiro] = lista.json().funcionarios;
      expect(primeiro).toBeDefined();
      const perfil = await admin.pedir(
        "GET",
        `${RH}/funcionarios/${primeiro.id}?${PERIODO}`,
      );
      expect(perfil.statusCode).toBe(200);
      expect(perfil.json().funcionario.id).toBe(primeiro.id);
      expect(
        (await admin.pedir("GET", `${RH}/funcionarios/${randomUUID()}`))
          .statusCode,
      ).toBe(404);
      expect(
        (await admin.pedir("GET", `${RH}/funcionarios/nao-e-uuid`)).statusCode,
      ).toBe(404);

      const memoria = await admin.pedir(
        "GET",
        `${RH}/detalhes/memoria-do-custo?competencia=2026-10-01&colaborador=${primeiro.id}`,
      );
      expect(memoria.statusCode).toBe(200);
    });

    it("fora do ponto: grava pelo RLS (id que não existe: nada muda)", async () => {
      const r = await admin.pedir(
        "POST",
        `${RH}/funcionarios/${randomUUID()}/fora-do-ponto`,
        { fora: "sim" },
      );
      expect(r.statusCode).toBe(200);
      expect(r.json()).toEqual({ mensagem: "Fora do ponto." });
    });

    it("fechamento: salvar sem linhas e finalizar ciclo inexistente", async () => {
      const id = randomUUID();
      const salvo = await admin.pedir(
        "PATCH",
        `${RH}/banco-de-horas/ciclos/${id}`,
        {},
      );
      expect(salvo.statusCode).toBe(200);
      expect(salvo.json()).toEqual({ mensagem: "Fechamento salvo." });
      const valor = await admin.pedir(
        "PATCH",
        `${RH}/banco-de-horas/ciclos/${id}`,
        { [`realizado_${randomUUID()}`]: "abc" },
      );
      expect(valor.statusCode).toBe(400);
      expect(valor.json().erro.mensagem).toBe(
        "Valor realizado: valor realizado inválido",
      );
      const fim = await admin.pedir(
        "POST",
        `${RH}/banco-de-horas/ciclos/${id}/finalizar`,
        {},
      );
      expect(fim.statusCode).toBe(404);
      expect(fim.json().erro.mensagem).toBe("Ciclo não encontrado.");
    });
  });
});
