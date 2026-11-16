import { sql } from "kysely";
import { afterAll, beforeAll, expect, it } from "vitest";
import { banco, type Tx } from "@/infra/banco";
import { descreverComBanco, TESTE } from "@/testes/apoio";

// RLS das tabelas sensíveis do RH (salário, custo, ponto por pessoa): quem
// não tem permissão do RH não lê nada; o administrador lê.

type Tabela =
  | "rh.colaboradores"
  | "rh.ponto_mensal"
  | "rh.custos_colaborador"
  | "rh.folha_colaboradores"
  | "rh.folha_rubricas"
  | "rh.banco_horas_fechamentos";

const contar = (tabela: Tabela) => async (tx: Tx) => {
  const r = await tx
    .selectFrom(tabela)
    .select((eb) => eb.fn.countAll<number>().as("n"))
    .executeTakeFirstOrThrow();
  return r.n;
};

descreverComBanco("RLS do RH", () => {
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

  it("sem permissão do RH: nenhuma linha de pessoas, ponto, folha ou custo", async () => {
    for (const t of [
      "rh.colaboradores",
      "rh.ponto_mensal",
      "rh.custos_colaborador",
      "rh.folha_colaboradores",
      "rh.folha_rubricas",
      "rh.banco_horas_fechamentos",
    ] as const)
      expect(await banco.comoUsuario(semAcesso, contar(t)), t).toBe(0);
  });

  it("o administrador lê colaboradores, ponto e custo", async () => {
    for (const t of [
      "rh.colaboradores",
      "rh.ponto_mensal",
      "rh.custos_colaborador",
    ] as const)
      expect(await banco.comoUsuario(admin, contar(t)), t).toBeGreaterThan(0);
  });

  it("custo agregado e banco em R$: as funções do banco devolvem vazio sem permissão", async () => {
    const linhas = (id: string) =>
      banco.comoUsuario(id, async (tx) => {
        const r = await sql<{ n: number }>`
          select count(*)::int as n
          from rh.custo_agregado('2026-01-01'::date, '2026-12-01'::date)
        `.execute(tx);
        return r.rows[0]?.n ?? 0;
      });
    expect(await linhas(semAcesso)).toBe(0);
  });
});
