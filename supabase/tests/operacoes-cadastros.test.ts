// Cadastros de Operações (20261111170000_operacoes_cadastros): o hidrômetro
// com cadastro próprio, a carga inicial a partir das leituras, quem vê e quem
// edita, e a auditoria do hidrômetro e da sala.
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
  importa: "00000000-0000-0000-0000-0000000000b1",
  vinculo: "00000000-0000-0000-0000-0000000000b2",
  ve: "00000000-0000-0000-0000-0000000000b3",
  energia: "00000000-0000-0000-0000-0000000000b4",
};

const PERMISSOES: Record<keyof typeof U, string[]> = {
  importa: ["operacoes.agua.importar"],
  vinculo: ["operacoes.agua.vinculo", "operacoes.agua.ver"],
  ve: ["operacoes.agua.ver"],
  energia: ["operacoes.energia.ver", "operacoes.energia.editar"],
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

describe("cadastro de hidrômetros", () => {
  it("a carga inicial cadastra cada hidrômetro das leituras que valem, uma vez", async () => {
    const leituras = await valor<number>(
      "select count(distinct hidrometro)::int from operacoes.agua_leituras where vigente",
    );
    const cadastrados = await valor<number>(
      "select count(*)::int from operacoes.hidrometros",
    );
    expect(cadastrados).toBe(leituras);
    expect(
      await valor<number>(
        `select count(*)::int from operacoes.hidrometros h
         where not exists (select 1 from operacoes.agua_leituras l
           where l.vigente and l.hidrometro = h.numero and l.bloco = h.bloco)`,
      ),
    ).toBe(0);
  });

  it("quem só vê a água lê a lista, mas não cadastra", async () => {
    await como(U.ve, async () => {
      expect(
        await valor<number>("select count(*)::int from operacoes.hidrometros"),
      ).toBeGreaterThanOrEqual(0);
      expect(
        await erro(
          "insert into operacoes.hidrometros (numero, bloco) values ('ZZ-VE', '05')",
        ),
      ).toMatch(/row-level security/);
    });
    await como(U.energia, async () => {
      expect(
        await valor<number>("select count(*)::int from operacoes.hidrometros"),
      ).toBe(0);
    });
  });

  it("quem importa cadastra, edita, liga à sala e exclui; tudo vai para a auditoria", async () => {
    const sala = await como(U.energia, () =>
      valor<string>(
        `insert into operacoes.salas (codigo, bloco, sala) values ('BL07-990', '07', '990') returning id`,
      ),
    );
    const id = await como(U.importa, async () => {
      const h = await valor<string>(
        `insert into operacoes.hidrometros (numero, bloco, sala, descricao)
         values ('ZZ-001', '07', '990', 'Loja teste') returning id`,
      );
      await db.query(
        `update operacoes.hidrometros set sala_id = $1, ativo = false where id = $2`,
        [sala, h],
      );
      return h;
    });
    expect(
      await valor<string>(
        `select sala_id::text from operacoes.hidrometros where id = '${id}'`,
      ),
    ).toBe(sala);
    expect(
      await valor<number>(
        `select count(*)::int from core.auditoria
         where tabela = 'operacoes.hidrometros' and registro_id = '${id}'`,
      ),
    ).toBe(2);
    // Excluir a sala da energia solta o hidrômetro, sem apagá-lo.
    await como(U.energia, () =>
      db.query(`delete from operacoes.salas where id = '${sala}'`),
    );
    expect(
      await valor<string | null>(
        `select sala_id from operacoes.hidrometros where id = '${id}'`,
      ),
    ).toBeNull();
    expect(
      await valor<number>(
        `select count(*)::int from core.auditoria
         where tabela = 'operacoes.salas' and registro_id = '${sala}'`,
      ),
    ).toBe(2);
    await como(U.vinculo, () =>
      db.query(`delete from operacoes.hidrometros where id = '${id}'`),
    );
    expect(
      await valor<number>(
        `select count(*)::int from operacoes.hidrometros where id = '${id}'`,
      ),
    ).toBe(0);
  });

  it("o número é único e o exemplo não se grava pela sessão", async () => {
    await como(U.importa, async () => {
      await db.query(
        "insert into operacoes.hidrometros (numero, bloco) values ('ZZ-002', '05')",
      );
      expect(
        await erro(
          "insert into operacoes.hidrometros (numero, bloco) values ('ZZ-002', '06')",
        ),
      ).toMatch(/duplicate key|unique/);
      expect(
        await erro(
          "update operacoes.hidrometros set exemplo = true where numero = 'ZZ-002'",
        ),
      ).toMatch(/permission denied/);
      expect(
        await erro(
          "insert into operacoes.hidrometros (numero, bloco) values ('ZZ-003', '5')",
        ),
      ).toMatch(/check constraint/);
    });
  });
});
