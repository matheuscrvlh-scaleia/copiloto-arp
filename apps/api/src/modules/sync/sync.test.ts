import { sql } from "kysely";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { Contexto } from "@/contexto";
import { ErroDeNegocio, ErroDePermissao } from "@/erros";
import { banco } from "@/infra/banco";
import { descreverComBanco, TESTE } from "@/testes/apoio";
import { executar, lerCursor, SyncEmAndamento } from "./execucao.service";
import { sincronizarAgora } from "./sync.service";

// Registro das execuções (integracao.sync_runs e cursores) com um sistema de
// mentira, e a permissão do "Sincronizar agora". Nenhum sistema externo é
// chamado: os casos que chegariam a sincronizar de verdade ficam de fora.

const SISTEMA = "teste_porte_sync";
const RECURSO = "itens";

const contexto = (id: string): Contexto => ({
  ip: "203.0.113.1",
  agente: null,
  requisicaoId: "teste",
  usuario: { id, nome: "", email: "" },
  permissoes: new Set(),
  senhaProvisoria: false,
  sessao: {
    id: "",
    inicio: new Date(),
    ultimoUso: new Date(),
    acessoExpiraEm: new Date(),
  },
});

async function limpar() {
  await banco.comoServico(async (tx) => {
    await tx
      .deleteFrom("integracao.sync_runs")
      .where("sistema", "=", SISTEMA)
      .execute();
    await tx
      .deleteFrom("integracao.cursores")
      .where("sistema", "=", SISTEMA)
      .execute();
  });
}

const execucoes = () =>
  banco.comoServico((tx) =>
    tx
      .selectFrom("integracao.sync_runs")
      .select(["status", "registros", "erro", "cursor_depois"])
      .where("sistema", "=", SISTEMA)
      .orderBy("iniciado_em")
      .execute(),
  );

descreverComBanco("sync: execuções e Sincronizar agora", () => {
  let admin: Contexto;
  let semAcesso: Contexto;

  beforeAll(async () => {
    await limpar();
    const usuarios = await banco.comoServico((tx) =>
      tx
        .selectFrom("core.usuarios")
        .select(["id", "email"])
        .where(sql`lower(email)`, "in", [
          TESTE.email.toLowerCase(),
          TESTE.emailSemAcesso.toLowerCase(),
        ])
        .execute(),
    );
    const idDe = (email: string) => {
      const u = usuarios.find(
        (x) => x.email.toLowerCase() === email.toLowerCase(),
      );
      if (!u) throw new Error("usuário de teste não encontrado");
      return u.id;
    };
    admin = contexto(idDe(TESTE.email));
    semAcesso = contexto(idDe(TESTE.emailSemAcesso));
  });
  afterAll(async () => {
    await limpar();
    await banco.encerrar();
  });

  it("sucesso: registra a execução e avança o cursor", async () => {
    const r = await executar(SISTEMA, RECURSO, async () => ({
      registros: 3,
      cursor: { ate: "2026-11-15" },
    }));
    expect(r.runId).toBeTruthy();
    expect(await lerCursor(SISTEMA, RECURSO)).toEqual({ ate: "2026-11-15" });
    expect(await execucoes()).toMatchObject([
      { status: "sucesso", registros: 3, cursor_depois: { ate: "2026-11-15" } },
    ]);
  });

  it("falha: registra o erro e o cursor fica onde estava", async () => {
    await expect(
      executar(SISTEMA, RECURSO, async () => {
        throw new Error("a API caiu");
      }),
    ).rejects.toThrow("a API caiu");
    expect(await lerCursor(SISTEMA, RECURSO)).toEqual({ ate: "2026-11-15" });
    expect((await execucoes()).at(-1)).toMatchObject({
      status: "erro",
      erro: "a API caiu",
    });
  });

  it("uma de cada vez: a segunda recebe SyncEmAndamento", async () => {
    let soltar = () => {};
    const primeira = executar(SISTEMA, RECURSO, async () => {
      await new Promise<void>((r) => {
        soltar = r;
      });
      return { registros: 0 };
    });
    // Espera a primeira abrir o registro "rodando".
    for (let i = 0; i < 50; i++) {
      if ((await execucoes()).some((e) => e.status === "rodando")) break;
      await new Promise((r) => setTimeout(r, 20));
    }
    await expect(
      executar(SISTEMA, RECURSO, async () => ({ registros: 0 })),
    ).rejects.toBeInstanceOf(SyncEmAndamento);
    soltar();
    await primeira;
  });

  it("Sincronizar agora: sem a permissão recebe 403", async () => {
    await expect(sincronizarAgora(semAcesso, "secullum")).rejects.toThrow(
      ErroDePermissao,
    );
    await expect(sincronizarAgora(semAcesso, "mkt_meta")).rejects.toThrow(
      "Você não tem permissão para configurar integrações.",
    );
  });

  it("Sincronizar agora: integração desconhecida ou sem sincronização", async () => {
    await expect(sincronizarAgora(admin, "nao_existe")).rejects.toThrow(
      new ErroDeNegocio("Integração desconhecida."),
    );
    await expect(sincronizarAgora(admin, "cameras")).rejects.toThrow(
      "A sincronização desta integração ainda não existe.",
    );
  });
});
