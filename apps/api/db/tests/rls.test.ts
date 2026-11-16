import { sql } from "kysely";
import { afterAll, beforeAll, expect, it } from "vitest";
import { ErroDePermissao } from "@/erros";
import { banco, type Tx } from "@/infra/banco";
import { descreverComBanco, TESTE } from "@/testes/apoio";

// Testes do RLS: o que cada papel enxerga, direto no banco. Cada módulo
// acrescenta aqui (ou num arquivo ao lado, db/tests/<modulo>.test.ts) os
// casos das suas tabelas: quem tem a permissão lê, quem não tem não lê.

const contar = (tabela: "os.chamados" | "auth.sessoes") => async (tx: Tx) => {
  const r = await tx
    .selectFrom(tabela)
    .select((eb) => eb.fn.countAll<number>().as("n"))
    .executeTakeFirstOrThrow();
  return r.n;
};

descreverComBanco("RLS", () => {
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

  it("os.chamados: sem permissão não lê nada; o administrador lê", async () => {
    expect(await banco.comoUsuario(semAcesso, contar("os.chamados"))).toBe(0);
    expect(
      await banco.comoUsuario(admin, contar("os.chamados")),
    ).toBeGreaterThan(0);
  });

  it("os.chamados: visitante (anon) nem chega na tabela", async () => {
    await expect(
      banco.comoAnonimo(contar("os.chamados")),
    ).rejects.toBeInstanceOf(ErroDePermissao);
  });

  it("auth.sessoes e auth.users: só a service role", async () => {
    expect(
      await banco.comoServico(contar("auth.sessoes")),
    ).toBeGreaterThanOrEqual(0);
    for (const escopo of [
      (fn: (tx: Tx) => Promise<unknown>) => banco.comoUsuario(admin, fn),
      (fn: (tx: Tx) => Promise<unknown>) => banco.comoAnonimo(fn),
    ]) {
      await expect(escopo(contar("auth.sessoes"))).rejects.toBeInstanceOf(
        ErroDePermissao,
      );
      await expect(
        escopo((tx) =>
          tx.selectFrom("auth.users").select("id").limit(1).execute(),
        ),
      ).rejects.toBeInstanceOf(ErroDePermissao);
    }
  });

  it("core.pode responde por quem está no escopo", async () => {
    const pode = (id: string) =>
      banco.comoUsuario(id, async (tx) => {
        const r = await sql<{ ok: boolean }>`
          select core.pode('admin.usuarios') as ok
        `.execute(tx);
        return r.rows[0]?.ok;
      });
    expect(await pode(admin)).toBe(true);
    expect(await pode(semAcesso)).toBe(false);
  });
});
