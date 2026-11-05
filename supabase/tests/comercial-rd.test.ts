// Oportunidades do RD Station CRM (20261105120000_comercial_rd_oportunidades):
// só a service role grava; a sessão do Funil, do Painel e dos parâmetros lê
// sem os contatos; quem não usa nenhuma dessas telas não lê nada.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const MIGRATIONS = join(import.meta.dirname, "..", "migrations");

const SUPABASE_MINIMO = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema storage to authenticated;
  grant select, insert on storage.objects to authenticated;
`;

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

let db: PGlite;

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
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub', '${U[quem]}', false);`,
  );
  try {
    return await fn();
  } finally {
    await db.exec(
      "reset role; select set_config('request.jwt.claim.sub', '', false);",
    );
  }
}

async function comoServidor<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec("set role service_role;");
  try {
    return await fn();
  } finally {
    await db.exec("reset role;");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_MINIMO);
  for (const f of readdirSync(MIGRATIONS).sort())
    if (f.endsWith(".sql"))
      await db.exec(readFileSync(join(MIGRATIONS, f), "utf8"));
  for (const [nome, id] of Object.entries(U)) {
    await db.query("insert into auth.users (id, email) values ($1, $2)", [
      id,
      `${nome}@arp.test`,
    ]);
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
