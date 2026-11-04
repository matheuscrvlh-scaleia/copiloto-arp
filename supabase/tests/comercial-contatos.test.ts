// Exemplo do Relacionamento (20261104130400_comercial_exemplo_contatos): os
// contatos fictícios batem com o ENET de exemplo e com as listas, ficam nos
// últimos 90 dias, só o Relacionamento vê todos e "Remover dados de
// exemplo" apaga.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { gerarEnet } from "../../src/server/comercial/exemplo/enet";

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

const U = {
  rel: "00000000-0000-0000-0000-0000000000b1",
  censo: "00000000-0000-0000-0000-0000000000b2",
  parametros: "00000000-0000-0000-0000-0000000000b3",
} as const;
const PERMISSOES: Record<keyof typeof U, string> = {
  rel: "comercial.relacionamento.ver",
  censo: "comercial.censo.ver",
  parametros: "comercial.parametros.editar",
};

let db: PGlite;

async function como<T>(quem: keyof typeof U, fn: () => Promise<T>): Promise<T> {
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

const contar = async (onde = "exemplo") =>
  (
    await db.query<{ n: number }>(
      `select count(*)::int n from comercial.contatos where ${onde}`,
    )
  ).rows[0]?.n;

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
    await db.query(
      "insert into core.usuario_permissoes (usuario_id, permissao) values ($1, $2)",
      [id, PERMISSOES[nome as keyof typeof U]],
    );
  }
}, 120_000);

describe("contatos de exemplo", () => {
  it("26 registros de exemplo, sem quem registrou, quase todos nos últimos 90 dias", async () => {
    expect(await contar()).toBe(26);
    expect(await contar("exemplo and registrado_por is not null")).toBe(0);
    expect(await contar("exemplo and data >= current_date - 89")).toBe(25);
  });

  it("tipo e canal das listas dos parâmetros", async () => {
    expect(
      await contar(`exemplo and (
        tipo not in (select valor from comercial.listas where lista = 'tipo_contato')
        or canal not in (select valor from comercial.listas where lista = 'canal_contato'))`),
    ).toBe(0);
  });

  it("locatário, contrato, LUC e bloco existem no ENET de exemplo", async () => {
    const enet = gerarEnet("2026-11-04");
    const { rows } = await db.query<{
      locatario_enet_id: string;
      locatario_nome: string;
      contrato_enet_id: string;
      luc: string;
      bloco: string;
    }>(
      "select locatario_enet_id, locatario_nome, contrato_enet_id, luc, bloco from comercial.contatos where exemplo",
    );
    for (const r of rows) {
      const c = enet.contratos.find((x) => x.codigo === r.contrato_enet_id);
      expect(c, r.contrato_enet_id).toMatchObject({
        cliente: r.locatario_enet_id,
        locatario: r.locatario_nome,
        luc: r.luc,
      });
      expect(enet.lucs.find((l) => l.numero === r.luc)?.local).toBe(r.bloco);
    }
  });

  it("Relacionamento vê todos; Censo só os de feedback", async () => {
    expect(await como("rel", () => contar())).toBe(26);
    const feedback = await como("censo", () => contar());
    expect(feedback).toBe(
      await contar(`exemplo and tipo in (select valor from comercial.listas
        where lista = 'tipo_contato' and (extra ->> 'feedback')::boolean)`),
    );
    expect(feedback).toBeLessThan(26);
  });

  it("Remover dados de exemplo apaga", async () => {
    await como("parametros", () =>
      db.query("select comercial.remover_exemplos()"),
    );
    expect(await contar()).toBe(0);
  });
});
