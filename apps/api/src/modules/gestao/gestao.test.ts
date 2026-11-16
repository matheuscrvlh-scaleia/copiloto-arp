import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { criarApp } from "@/app";
import { banco } from "@/infra/banco";
import { eventosPendentes } from "@/infra/eventos";
import { descreverComBanco, Navegador, TESTE } from "@/testes/apoio";

// O turnover vem do Copiloto RH (sistema externo): nos testes, fora do ar.
const turnoverDoPeriodo = vi.hoisted(() =>
  vi.fn(async () => ({ ok: false, motivo: "Copiloto RH fora do teste." })),
);
vi.mock("@/modules/rh/turnover", () => ({
  buscaDeTurnover: () => turnoverDoPeriodo,
}));

// O banco de homologação fica atrás de um túnel: cada pedido demora.
vi.setConfig({ testTimeout: 120_000 });

const GESTAO = "/api/v1/gestao";

descreverComBanco("gestão (/api/v1/gestao)", () => {
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
    await eventosPendentes();
    await app.close();
    await banco.encerrar();
  });

  it("quem não tem nada do RH não recebe número algum", async () => {
    const r = await semAcesso.pedir("GET", `${GESTAO}/painel`);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ pessoas: null });
    expect(turnoverDoPeriodo).not.toHaveBeenCalled();
  });

  it("as listas do mês pedem rh.quadro (403)", async () => {
    const r = await semAcesso.pedir(
      "GET",
      `${GESTAO}/meses/2026-10-01/tabelas`,
    );
    expect(r.statusCode).toBe(403);
    expect(r.json().erro.mensagem).toBe("Você não tem acesso ao quadro.");
  });

  it("painel do período: números, gráficos de 12 meses e detalhes", async () => {
    const r = await admin.pedir("GET", `${GESTAO}/painel?mes=2026-10`);
    expect(r.statusCode).toBe(200);
    const p = r.json().pessoas;
    expect(p.mes).toBe("2026-10-01");
    expect(p.ate).toBe("2026-10-31");
    expect(p.rotulo).toBe("out/2026");
    expect(p.ativos).toBeGreaterThan(0);
    expect(p.evolucao).toHaveLength(12);
    expect(p.fluxo).toHaveLength(12);
    expect(p.evolucao.at(-1)).toMatchObject({
      chave: "2026-10-01",
      destaque: true,
    });
    expect(p.tempoDeCasa).toHaveLength(5);
    // Sem o Copiloto, o turnover fica sem número e diz por quê.
    expect(p.turnover).toBeNull();
    expect(p.status.turnover).toBeNull();
    expect(p.turnoverMotivo).toBe("Copiloto RH fora do teste.");
    // O administrador vê as listas: 12 meses (sem tabelas, vêm ao abrir).
    expect(Object.keys(p.detalhes.meses)).toHaveLength(12);
    expect(p.detalhes.meses["2026-10-01"].tabelas).toEqual([]);
    expect(Object.keys(p.detalhes.horas)).toEqual(["faltas", "atrasos"]);
    expect(Object.keys(p.detalhes.setores).sort()).toEqual(
      p.setores.map((s: { chave: string }) => s.chave).sort(),
    );
    expect(turnoverDoPeriodo).toHaveBeenCalledTimes(2);
  });

  it("listas do mês: admitidos, desligados e ativos", async () => {
    const r = await admin.pedir("GET", `${GESTAO}/meses/2026-10-01/tabelas`);
    expect(r.statusCode).toBe(200);
    expect(r.json().tabelas.map((t: { titulo: string }) => t.titulo)).toEqual([
      "Admitidos no mês",
      "Desligados no mês",
      "Ativos no fim do mês",
    ]);
    const invalido = await admin.pedir(
      "GET",
      `${GESTAO}/meses/2026-10/tabelas`,
    );
    expect(invalido.statusCode).toBe(400);
  });
});
