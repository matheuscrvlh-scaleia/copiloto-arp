import { sql } from "kysely";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exigir } from "@/contexto";
import { ErroDeConflito, ErroDeNegocio, ErroDePermissao } from "@/erros";
import { descreverComBanco, TESTE } from "@/testes/apoio";
import { banco, type Tx } from ".";
import { erroDoBanco } from "./erros";

function erroPg(code: string, mensagem: string): pg.DatabaseError {
  const e = new pg.DatabaseError(mensagem, mensagem.length, "error");
  e.code = code;
  return e;
}

describe("erroDoBanco", () => {
  it("traduz os códigos de negócio com as mensagens de sempre", () => {
    expect(erroDoBanco(erroPg("23505", "duplicate key"))).toMatchObject({
      codigo: "conflito",
      message: "Já existe outro registro com esse valor.",
    });
    expect(erroDoBanco(erroPg("23514", "check"))).toBeInstanceOf(ErroDeNegocio);
    expect(erroDoBanco(erroPg("42501", "denied"))).toBeInstanceOf(
      ErroDePermissao,
    );
    // Regra do banco (raise exception): a mensagem já vem em português.
    expect(
      erroDoBanco(erroPg("P0001", "precisa haver um administrador")),
    ).toMatchObject({
      codigo: "regra",
      message: "Precisa haver um administrador.",
    });
    expect(erroDoBanco(erroPg("22023", "valor inválido"))).toBeInstanceOf(
      ErroDeNegocio,
    );
  });

  it("deixa passar o que não é de negócio", () => {
    expect(erroDoBanco(erroPg("42P01", "relation does not exist"))).toBeNull();
    expect(erroDoBanco(new Error("outro"))).toBeNull();
  });
});

const quemSou = async (tx: Tx) => {
  const r = await sql<{
    papel: string;
    uid: string | null;
    claims: string | null;
  }>`select current_user::text as papel, auth.uid()::text as uid,
       current_setting('request.jwt.claims', true) as claims`.execute(tx);
  const linha = r.rows[0];
  if (!linha) throw new Error("sem linha");
  return linha;
};

descreverComBanco("escopos do banco", () => {
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
    expect(admin).not.toBe("");
    expect(semAcesso).not.toBe("");
  });

  afterAll(() => banco.encerrar());

  it("fora de um escopo, arp_api não lê nada", async () => {
    const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await c.connect();
    try {
      for (const tabela of ["core.usuarios", "os.chamados", "auth.users"])
        await expect(
          c.query(`select 1 from ${tabela} limit 1`),
        ).rejects.toThrow(/permission denied/);
    } finally {
      await c.end();
    }
  });

  it("cada escopo assume o seu papel e informa o usuário", async () => {
    expect(await banco.comoUsuario(admin, quemSou)).toMatchObject({
      papel: "authenticated",
      uid: admin,
    });
    expect(await banco.comoServico(quemSou)).toMatchObject({
      papel: "service_role",
      uid: null,
    });
    expect(await banco.comoAnonimo(quemSou)).toMatchObject({
      papel: "anon",
      uid: null,
    });
  });

  it("o papel não vaza: nem depois do escopo, nem depois de um erro", async () => {
    await banco.comoServico(quemSou);
    await expect(
      banco.comoUsuario(admin, async () => {
        throw new Error("falhou no meio");
      }),
    ).rejects.toThrow("falhou no meio");
    // A conexão volta ao pool como arp_api, sem papel e sem usuário: a
    // trava usa a conexão crua, fora de qualquer escopo.
    let dentro = false;
    await banco.comTrava("teste:vazamento", async () => {
      dentro = true;
    });
    expect(dentro).toBe(true);
    expect(await banco.comoAnonimo(quemSou)).toMatchObject({
      papel: "anon",
      uid: null,
    });
  });

  it("escopos simultâneos não se misturam", async () => {
    const vistos = await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        i % 3 === 0
          ? banco.comoUsuario(admin, quemSou)
          : i % 3 === 1
            ? banco.comoUsuario(semAcesso, quemSou)
            : banco.comoServico(quemSou),
      ),
    );
    vistos.forEach((v, i) => {
      expect(v.uid).toBe(i % 3 === 0 ? admin : i % 3 === 1 ? semAcesso : null);
      expect(v.papel).toBe(i % 3 === 2 ? "service_role" : "authenticated");
    });
  });

  it("o escopo é uma transação: erro desfaz o que foi gravado", async () => {
    const marca = `teste de transação ${Date.now()}`;
    await expect(
      banco.comoServico(async (tx) => {
        await tx
          .insertInto("core.logs")
          .values({ modulo: "acesso", evento: "login", descricao: marca })
          .execute();
        throw new Error("desfaz");
      }),
    ).rejects.toThrow("desfaz");
    const achados = await banco.comoServico((tx) =>
      tx
        .selectFrom("core.logs")
        .select("id")
        .where("descricao", "=", marca)
        .execute(),
    );
    expect(achados).toEqual([]);
  });

  it("erro de negócio do banco sai traduzido do escopo", async () => {
    await expect(
      banco.comoServico((tx) =>
        tx
          .insertInto("core.logs")
          .values({ modulo: "nao-existe", evento: "login", descricao: "x" })
          .execute(),
      ),
    ).rejects.toMatchObject({ message: "Valor fora do permitido." });
    await expect(
      banco.comoUsuario(semAcesso, (tx) =>
        tx
          .insertInto("core.logs")
          .values({ modulo: "acesso", evento: "login", descricao: "x" })
          .execute(),
      ),
    ).rejects.toBeInstanceOf(ErroDePermissao);
    expect(new ErroDeConflito("x").statusCode).toBe(409);
  });

  it("exigir confere a permissão no banco", async () => {
    const ctx = (id: string) => ({
      ip: "203.0.113.1",
      agente: null,
      requisicaoId: "teste",
      usuario: { id, nome: "", email: "" },
      permissoes: new Set<never>(),
      senhaProvisoria: false,
      sessao: {
        id: "",
        inicio: new Date(),
        ultimoUso: new Date(),
        acessoExpiraEm: new Date(),
      },
    });
    await expect(exigir(ctx(admin), "admin.usuarios")).resolves.toBeUndefined();
    await expect(
      exigir(ctx(semAcesso), "admin.usuarios"),
    ).rejects.toBeInstanceOf(ErroDePermissao);
  });

  it("os valores chegam como o PostgREST entregava", async () => {
    const r = await banco.comoServico((tx) =>
      sql<Record<string, unknown>>`
        select date '2026-11-16' as dia,
               timestamptz '2026-11-16 12:00:00-03' as instante,
               1.5::numeric as valor,
               9007199254740991::bigint as grande,
               array[date '2026-01-02', null] as dias,
               array[1.25::numeric] as valores
      `.execute(tx),
    );
    expect(r.rows[0]).toEqual({
      dia: "2026-11-16",
      instante: "2026-11-16T15:00:00.000Z",
      valor: 1.5,
      grande: 9007199254740991,
      dias: ["2026-01-02", null],
      valores: [1.25],
    });
  });
});
