// Operações no histórico do sistema (20261109160800_operacoes_historico):
// core.logs aceita o módulo "operacoes", a auditoria das tabelas
// operacoes.* cai nesse módulo e o filtro do histórico (core.historico)
// acha os eventos por ele.
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
  create function auth.role() returns text language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated') $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant execute on function auth.role() to anon, authenticated, service_role;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema storage to authenticated;
  grant select, insert on storage.objects to authenticated;
`;

const U = {
  admin: "00000000-0000-0000-0000-0000000000f1",
  operacoes: "00000000-0000-0000-0000-0000000000f2",
};

const PERMISSOES: Record<keyof typeof U, string[]> = {
  admin: ["admin.historico"],
  operacoes: ["operacoes.parametros"],
};

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

async function como<T>(usuario: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub', '${usuario}', false);`,
  );
  try {
    return await fn();
  } finally {
    await db.exec(
      "reset role; select set_config('request.jwt.claim.sub', '', false);",
    );
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_MINIMO);
  for (const f of readdirSync(MIGRATIONS).sort()) {
    if (f.endsWith(".sql"))
      await db.exec(readFileSync(join(MIGRATIONS, f), "utf8"));
  }
  for (const [nome, id] of Object.entries(U)) {
    await db.query("insert into auth.users (id, email) values ($1, $2)", [
      id,
      `${nome}@arp.test`,
    ]);
    for (const p of PERMISSOES[nome as keyof typeof U]) {
      await db.query(
        "insert into core.usuario_permissoes (usuario_id, permissao) values ($1, $2)",
        [id, p],
      );
    }
  }
}, 180_000);

describe("histórico do sistema com Operações", () => {
  it("core.logs aceita o módulo operacoes (e segue recusando módulo desconhecido)", async () => {
    expect(
      await erro(
        `insert into core.logs (modulo, evento, descricao, usuario_id, detalhes)
         values ('operacoes', 'operacoes_rateio_fechado',
                 'Fechou o rateio da limpeza de setembro de 2026',
                 '${U.operacoes}', '{"referencia": "2026-09-01"}')`,
      ),
    ).toBeNull();
    expect(
      await erro(
        "insert into core.logs (modulo, evento, descricao) values ('inventado', 'x', 'y')",
      ),
    ).toMatch(/logs_modulo_check/);
  });

  it("a auditoria das tabelas operacoes.* cai no módulo operacoes", async () => {
    expect(
      await valor<string>(
        "select core.modulo_da_auditoria('operacoes.caixas', '{}')",
      ),
    ).toBe("operacoes");
    // As outras regras continuam.
    expect(
      await valor<string>("select core.modulo_da_auditoria('os.ativos', '{}')"),
    ).toBe("os");
    expect(
      await valor<string>(
        "select core.modulo_da_auditoria('core.usuarios', '{}')",
      ),
    ).toBe("admin");
  });

  it("o filtro por módulo do histórico acha o evento de Operações", async () => {
    const linhas = await como(U.admin, async () => {
      const { rows } = await db.query<{ acao: string; descricao: string }>(
        "select acao, descricao from core.historico(p_modulo => 'operacoes', p_tipo => 'evento')",
      );
      return rows;
    });
    expect(linhas).toEqual([
      {
        acao: "operacoes_rateio_fechado",
        descricao: "Fechou o rateio da limpeza de setembro de 2026",
      },
    ]);
  });
});
