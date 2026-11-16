import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import { afterAll, beforeAll, expect, it } from "vitest";
import { ErroDePermissao } from "@/erros";
import { banco, type Tx } from "@/infra/banco";
import { descreverComBanco, TESTE } from "@/testes/apoio";

// RLS do Calendário e de Relatórios (schema formularios): quem não tem a
// permissão não lê nem grava; o administrador lê; o visitante (anon) nem
// chega nas tabelas; o envio pelo link (formularios.responder) só pela
// service role. Os testes que gravam desfazem tudo (a transação é
// abortada no fim).

type Tabela =
  | "calendario.itens"
  | "calendario.tipos"
  | "formularios.formularios"
  | "formularios.respostas";

const contar = (tabela: Tabela) => async (tx: Tx) => {
  const r = await tx
    .selectFrom(tabela)
    .select((eb) => eb.fn.countAll<number>().as("n"))
    .executeTakeFirstOrThrow();
  return r.n;
};

/** Roda e desfaz: a transação do escopo termina com erro de propósito. */
class Desfazer extends Error {}
async function eDesfazer<T>(
  escopo: (fn: (tx: Tx) => Promise<never>) => Promise<unknown>,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  let resultado: T | undefined;
  await escopo(async (tx) => {
    resultado = await fn(tx);
    throw new Desfazer();
  }).catch((e) => {
    if (!(e instanceof Desfazer)) throw e;
  });
  if (resultado === undefined) throw new Error("sem resultado");
  return resultado;
}

descreverComBanco("RLS do Calendário e de Relatórios", () => {
  let admin = "";
  let semAcesso = "";

  beforeAll(async () => {
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
    const idDe = (email: string) =>
      usuarios.find((u) => u.email.toLowerCase() === email.toLowerCase())?.id ??
      "";
    admin = idDe(TESTE.email);
    semAcesso = idDe(TESTE.emailSemAcesso);
  });

  afterAll(() => banco.encerrar());

  it("sem permissão não lê nada; o administrador lê os tipos", async () => {
    for (const t of [
      "calendario.itens",
      "calendario.tipos",
      "formularios.formularios",
      "formularios.respostas",
    ] as const)
      expect(await banco.comoUsuario(semAcesso, contar(t))).toBe(0);
    expect(
      await banco.comoUsuario(admin, contar("calendario.tipos")),
    ).toBeGreaterThan(0);
  });

  it("visitante (anon) nem chega nas tabelas", async () => {
    for (const t of ["calendario.itens", "formularios.formularios"] as const)
      await expect(banco.comoAnonimo(contar(t))).rejects.toBeInstanceOf(
        ErroDePermissao,
      );
  });

  it("sem permissão não cria tipo, item nem relatório", async () => {
    const tipo = await banco.comoServico(async (tx) =>
      tx
        .selectFrom("calendario.tipos")
        .select("id")
        .limit(1)
        .executeTakeFirstOrThrow(),
    );
    await expect(
      banco.comoUsuario(semAcesso, (tx) =>
        tx
          .insertInto("calendario.tipos")
          .values({ nome: `Teste ${randomUUID()}`, cor: "#2a78d6" })
          .execute(),
      ),
    ).rejects.toBeInstanceOf(ErroDePermissao);
    await expect(
      banco.comoUsuario(semAcesso, (tx) =>
        tx
          .insertInto("calendario.itens")
          .values({
            tipo_id: tipo.id,
            titulo: "Teste",
            inicio: "2026-11-16",
            fim: "2026-11-16",
          })
          .execute(),
      ),
    ).rejects.toBeInstanceOf(ErroDePermissao);
    await expect(
      banco.comoUsuario(semAcesso, (tx) =>
        tx
          .insertInto("formularios.formularios")
          .values({ titulo: "Teste" })
          .execute(),
      ),
    ).rejects.toBeInstanceOf(ErroDePermissao);
  });

  it("o item privado do administrador: ele vê; ninguém cria em nome de outro", async () => {
    const tipo = await banco.comoServico((tx) =>
      tx
        .selectFrom("calendario.tipos")
        .select("id")
        .where("ativo", "=", true)
        .limit(1)
        .executeTakeFirstOrThrow(),
    );
    const visto = await eDesfazer(
      (fn) => banco.comoUsuario(admin, fn),
      async (tx) => {
        const { id } = await tx
          .insertInto("calendario.itens")
          .values({
            tipo_id: tipo.id,
            titulo: "Teste RLS",
            inicio: "2026-11-16",
            fim: "2026-11-16",
            visibilidade: "privado",
          })
          .returning("id")
          .executeTakeFirstOrThrow();
        const lido = await tx
          .selectFrom("calendario.itens")
          .select("id")
          .where("id", "=", id)
          .execute();
        return lido.length;
      },
    );
    expect(visto).toBe(1);
    await expect(
      banco.comoUsuario(admin, (tx) =>
        tx
          .insertInto("calendario.itens")
          .values({
            tipo_id: tipo.id,
            titulo: "Teste RLS",
            inicio: "2026-11-16",
            fim: "2026-11-16",
            criado_por: semAcesso,
          })
          .execute(),
      ),
    ).rejects.toBeInstanceOf(ErroDePermissao);
  });

  it("com login não se chama o envio do link (só a service role)", async () => {
    await expect(
      banco.comoUsuario(admin, (tx) =>
        sql`select formularios.responder(p_token => 'x', p_respostas => '{}'::jsonb, p_perguntas => '{}'::jsonb)`.execute(
          tx,
        ),
      ),
    ).rejects.toBeInstanceOf(ErroDePermissao);
  });
});
