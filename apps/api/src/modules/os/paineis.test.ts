import { respostaPainel } from "@arp/shared/os/contratos/paineis";
import type { Permissao } from "@arp/shared/permissions";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarApp } from "@/app";
import type { Contexto } from "@/contexto";
import { ErroDePermissao, ErroDeValidacao } from "@/erros";
import { banco } from "@/infra/banco";
import { descreverComBanco, Navegador, TESTE } from "@/testes/apoio";
import { exportarPainel, lerPainel } from "./paineis.service";
import {
  lerPeriodo,
  planilhaDeRateio,
  planilhaDeTerceirizados,
} from "./relatorios.service";

// Painéis e relatórios de OS: quem não pode recebe 403; o administrador lê o
// painel geral, o de um setor, o PDF e as planilhas na homologação (só
// leitura: nada é gravado).

const OS = "/api/v1/os";
const NADA = "00000000-0000-4000-8000-000000000000";
/** A homologação fica atrás de um túnel: o painel faz dezenas de consultas. */
const LONGO = 240_000;

const contexto = (permissoes: Permissao[]): Contexto => ({
  ip: "198.18.0.1",
  agente: null,
  requisicaoId: "teste",
  usuario: { id: NADA, nome: "Teste", email: "teste@example.com" },
  permissoes: new Set(permissoes),
  senhaProvisoria: false,
  sessao: {
    id: NADA,
    inicio: new Date(),
    ultimoUso: new Date(),
    acessoExpiraEm: new Date(),
  },
});

describe("painéis: permissão conferida no service", () => {
  it("painel exige os.painel_geral ou os.painel_setor", async () => {
    await expect(lerPainel(contexto(["os.acessar"]), {})).rejects.toThrow(
      ErroDePermissao,
    );
  });

  it("PDF do painel e relatórios exigem os.exportar", async () => {
    const ctx = contexto(["os.painel_geral", "os.acessar"]);
    await expect(exportarPainel(ctx, {})).rejects.toThrow(
      "Você não tem permissão para exportar.",
    );
    await expect(
      planilhaDeRateio(ctx, { de: "2026-10-01", ate: "2026-10-31" }),
    ).rejects.toThrow("Você não tem permissão para exportar.");
    await expect(
      planilhaDeTerceirizados(ctx, { de: "2026-10-01", ate: "2026-10-31" }),
    ).rejects.toThrow(ErroDePermissao);
  });

  it("relatório exige período válido de até dois anos", () => {
    expect(() => lerPeriodo({ de: "2026-10-31", ate: "2026-10-01" })).toThrow(
      "Escolha um período válido (de / até).",
    );
    expect(() => lerPeriodo({ de: "x", ate: "2026-10-01" })).toThrow(
      ErroDeValidacao,
    );
    expect(() => lerPeriodo({ de: "2020-01-01", ate: "2026-10-01" })).toThrow(
      "Escolha um período de até dois anos.",
    );
    expect(lerPeriodo({ de: "2026-10-01", ate: "2026-10-31" })).toEqual({
      de: "2026-10-01",
      ate: "2026-10-31",
    });
  });
});

descreverComBanco("os: painéis e relatórios", () => {
  let app: FastifyInstance;
  let admin: Navegador;
  let semAcesso: Navegador;

  beforeAll(async () => {
    app = await criarApp();
    admin = new Navegador(app);
    semAcesso = new Navegador(app);
    await admin.pedir("POST", "/api/v1/auth/entrar", {
      email: TESTE.email,
      senha: TESTE.senha,
    });
    await semAcesso.pedir("POST", "/api/v1/auth/entrar", {
      email: TESTE.emailSemAcesso,
      senha: TESTE.senha,
    });
  }, LONGO);

  afterAll(async () => {
    await app.close();
    await banco.encerrar();
  });

  it("sem acesso recebe 403 no painel, no PDF e nos relatórios", async () => {
    for (const url of [
      `${OS}/paineis`,
      `${OS}/paineis/exportar`,
      `${OS}/ordens/relatorios/abertas`,
      `${OS}/ordens/relatorios/rateio?de=2026-10-01&ate=2026-10-31`,
      `${OS}/ordens/relatorios/terceirizados?de=2026-10-01&ate=2026-10-31`,
    ])
      expect((await semAcesso.pedir("GET", url)).statusCode, url).toBe(403);
  });

  it(
    "o administrador lê o painel geral e o de um setor, com os números coerentes",
    async () => {
      const r = await admin.pedir("GET", `${OS}/paineis?periodo=mes_passado`);
      expect(r.statusCode).toBe(200);
      const geral = respostaPainel.parse(r.json());
      if (geral.tipo !== "painel") throw new Error("esperava o painel");
      expect(geral.painel.cartoes).toHaveLength(4);
      // Todo id citado numa lista tem a linha dele.
      const linhas = new Set(geral.painel.linhas.map((l) => l.id));
      const emAberto = geral.painel.cartoes[0]?.origem;
      expect(emAberto && "partes" in emAberto).toBe(true);
      if (emAberto && "partes" in emAberto)
        for (const id of emAberto.partes.flatMap((p) => p.ids))
          expect(linhas.has(id)).toBe(true);

      // A soma dos setores ativos dá o geral (em aberto).
      let soma = 0;
      for (const s of geral.setores.slice(1)) {
        const d = await admin.pedir(
          "GET",
          `${OS}/paineis?periodo=mes_passado&setor=${s.rota.split("/").pop()}`,
        );
        expect(d.statusCode).toBe(200);
        const p = respostaPainel.parse(d.json());
        if (p.tipo === "painel")
          soma += Number(p.painel.cartoes[0]?.valor.replace(/\D/g, ""));
      }
      expect(soma).toBeLessThanOrEqual(
        Number(geral.painel.cartoes[0]?.valor.replace(/\D/g, "")),
      );

      expect(
        (await admin.pedir("GET", `${OS}/paineis?setor=nao-existe`)).statusCode,
      ).toBe(404);
    },
    LONGO,
  );

  it(
    "o administrador baixa o PDF do painel e os relatórios",
    async () => {
      const pdf = await admin.pedir("GET", `${OS}/paineis/exportar`);
      expect(pdf.statusCode).toBe(200);
      expect(pdf.headers["content-type"]).toBe("application/pdf");
      expect(pdf.rawPayload.subarray(0, 4).toString()).toBe("%PDF");

      for (const url of [
        `${OS}/ordens/relatorios/abertas`,
        `${OS}/ordens/relatorios/abertas?formato=xlsx`,
        `${OS}/ordens/relatorios/rateio?de=2026-10-01&ate=2026-10-31`,
        `${OS}/ordens/relatorios/terceirizados?de=2026-10-01&ate=2026-10-31`,
      ]) {
        const r = await admin.pedir("GET", url);
        expect(r.statusCode, url).toBe(200);
        expect(r.rawPayload.length, url).toBeGreaterThan(1000);
      }
      expect(
        (
          await admin.pedir(
            "GET",
            `${OS}/ordens/relatorios/rateio?de=2026-10-31&ate=2026-10-01`,
          )
        ).statusCode,
      ).toBe(400);
    },
    LONGO,
  );
});
