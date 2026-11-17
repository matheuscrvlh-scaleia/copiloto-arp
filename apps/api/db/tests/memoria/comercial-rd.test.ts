// Oportunidades do RD Station CRM (20261105120000_comercial_rd_oportunidades):
// só a service role grava; a sessão do Funil, do Painel e dos parâmetros lê
// sem os contatos; quem não usa nenhuma dessas telas não lê nada.
import { beforeAll, describe, expect, it } from "vitest";
import { abrirBanco, type BancoDeTeste } from "../apoio";

const PERMISSOES = {
  funil: ["comercial.funil.ver"],
  painel: ["comercial.painel.ver"],
  fora: ["comercial.kit.ver"],
} as const;

type Quem = keyof typeof PERMISSOES;
const U = Object.fromEntries(
  Object.keys(PERMISSOES).map((nome, i) => [
    nome,
    `00000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`,
  ]),
) as Record<Quem, string>;

let db: BancoDeTeste;

async function valor<T = unknown>(sql: string): Promise<T> {
  const { rows } = await db.query<Record<string, T>>(sql);
  return Object.values(rows[0] ?? {})[0] as T;
}

async function erro(sql: string): Promise<string | null> {
  try {
    await db.query(sql);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

async function como<T>(quem: Quem, fn: () => Promise<T>): Promise<T> {
  return db.comoUsuario(U[quem], fn);
}

async function comoServidor<T>(fn: () => Promise<T>): Promise<T> {
  return db.comoServico(fn);
}

beforeAll(async () => {
  db = await abrirBanco();
  for (const [nome, id] of Object.entries(U)) {
    await db.query(
      "insert into auth.users (id, email, encrypted_password) values ($1, $2, '')",
      [id, `${nome}@arp.test`],
    );
    for (const p of PERMISSOES[nome as Quem])
      await db.query(
        "insert into core.usuario_permissoes (usuario_id, permissao) values ($1, $2)",
        [id, p],
      );
  }
}, 120_000);

describe("oportunidades do RD Station CRM", () => {
  it("só a service role grava; contatos fora da sessão", async () => {
    expect(
      await comoServidor(() =>
        erro(
          `insert into comercial.rd_oportunidades (id, dados, contatos)
           values ('d1', '{"name": "Loja"}', '[{"name": "Fulano"}]')`,
        ),
      ),
    ).toBeNull();
    expect(
      await como("funil", () =>
        erro(
          "insert into comercial.rd_oportunidades (id, dados) values ('d2', '{}')",
        ),
      ),
    ).toMatch(/permission denied/);
    for (const quem of ["funil", "painel"] as const) {
      expect(
        await como(quem, () =>
          valor<string>(
            "select dados->>'name' from comercial.rd_oportunidades",
          ),
        ),
      ).toBe("Loja");
      expect(
        await como(quem, () =>
          erro("select contatos from comercial.rd_oportunidades"),
        ),
      ).toMatch(/permission denied/);
    }
    expect(
      await como("fora", () =>
        valor<number>("select count(*)::int from comercial.rd_oportunidades"),
      ),
    ).toBe(0);
  });
});
