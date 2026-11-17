// Inteligência artificial (0005_claude): a credencial da Claude é aceita no
// banco e só quem tem admin.integracoes a configura.
import { beforeAll, describe, expect, it } from "vitest";
import { abrirBanco, type BancoDeTeste } from "../apoio";

const U = {
  admin: "00000000-0000-0000-0000-0000000000c1",
  sustentabilidade: "00000000-0000-0000-0000-0000000000c2",
};

const PERMISSOES: Record<keyof typeof U, string[]> = {
  admin: ["admin.integracoes"],
  sustentabilidade: ["sustentabilidade.parametros"],
};

let db: BancoDeTeste;

async function valor<T = unknown>(
  sql: string,
  params: unknown[] = [],
): Promise<T> {
  const { rows } = await db.query<Record<string, T>>(sql, params);
  return Object.values(rows[0] ?? {})[0] as T;
}

async function falha(usuario: string, sql: string): Promise<string | null> {
  try {
    await db.comoUsuario(usuario, () => db.query(sql));
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

beforeAll(async () => {
  db = await abrirBanco();
  for (const [nome, id] of Object.entries(U)) {
    await db.query(
      "insert into auth.users (id, email, encrypted_password) values ($1, $2, '')",
      [id, `${nome}@arp.test`],
    );
    for (const p of PERMISSOES[nome as keyof typeof U])
      await db.query(
        "insert into core.usuario_permissoes (usuario_id, permissao) values ($1, $2)",
        [id, p],
      );
  }
}, 180_000);

describe("integração da Claude", () => {
  it("salvar: aceita o sistema novo só para admin.integracoes", async () => {
    const salvar = `select core.salvar_integracao('claude',
      '{"modelo": "claude-opus-5-5"}', 'cifrado', true)`;
    expect(await falha(U.sustentabilidade, salvar)).toMatch(/sem permissão/);
    expect(await falha(U.admin, salvar)).toBeNull();
    expect(
      await valor<number>(
        "select count(*)::int from integracao.credenciais where sistema = 'claude'",
      ),
    ).toBe(1);
  });
});
