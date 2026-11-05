// OS independentes (20261029120000_os_ordens_independentes): aplica as
// migrations até a anterior, grava OS do jeito antigo (os.chamados com
// tipo 'os' e filhas por chamado_id) e confere a mudança para os.ordens.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const MIGRATIONS = join(import.meta.dirname, "..", "migrations");
const SEPARACAO = "20261029120000_os_ordens_independentes.sql";

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

const id = { ticket: "", ordem: "", numero: 0 };

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_MINIMO);
  const arquivos = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const antes = arquivos.filter((f) => f < SEPARACAO);
  for (const f of antes)
    await db.exec(readFileSync(join(MIGRATIONS, f), "utf8"));

  // Do jeito antigo: o chamado, a OS gerada dele e as filhas da OS.
  const setor = await valor<string>("select id from os.setores limit 1");
  id.ticket = await valor<string>(
    `insert into os.chamados (tipo, titulo, setor_id)
     values ('solicitacao', 'Lâmpada queimada', '${setor}') returning id`,
  );
  const { rows } = await db.query<{ id: string; numero: number }>(
    `insert into os.chamados (tipo, titulo, setor_id, convertido_de_id, execucao, local)
     values ('os', 'Trocar lâmpada', '${setor}', '${id.ticket}', 'terceirizada', 'Doca 2')
     returning id, numero`,
  );
  id.ordem = rows[0]?.id as string;
  id.numero = Number(rows[0]?.numero);
  const os = id.ordem;
  await db.exec(`
    insert into os.destinatarios (chamado_id, setor_id) values ('${os}', '${setor}');
    insert into os.eventos (chamado_id, tipo) values ('${os}', 'comentario');
    insert into os.anexos (chamado_id, nome, path) values ('${os}', 'a.jpg', 'chamados/${os}/a.jpg');
    insert into os.materiais (chamado_id, descricao, quantidade) values ('${os}', 'Lâmpada', 1);
    insert into os.sessoes (chamado_id, data, inicio) values ('${os}', '2026-10-28', '08:00');
    insert into os.os_custos (chamado_id, custo_total) values ('${os}', 42);
    insert into os.eventos (chamado_id, tipo) values ('${id.ticket}', 'comentario');
  `);

  for (const f of arquivos.filter((f) => f >= SEPARACAO))
    await db.exec(readFileSync(join(MIGRATIONS, f), "utf8"));
}, 120_000);

describe("OS sai de os.chamados para os.ordens", () => {
  it("mesmo id e número, campos da execução e o chamado de origem ligado", async () => {
    const { rows } = await db.query(
      `select numero::int, tipo::text, execucao::text, local, vinculado_a_id
       from os.ordens where id = '${id.ordem}'`,
    );
    expect(rows).toEqual([
      {
        numero: id.numero,
        tipo: "os",
        execucao: "terceirizada",
        local: "Doca 2",
        vinculado_a_id: id.ticket,
      },
    ]);
    expect(
      await valor(`select count(*)::int from os.chamados where tipo = 'os'`),
    ).toBe(0);
    expect(
      await valor(
        `select count(*)::int from os.chamados where id = '${id.ticket}'`,
      ),
    ).toBe(1);
  });

  it("as filhas passam para a OS", async () => {
    for (const t of ["destinatarios", "eventos", "anexos"])
      expect(
        await valor(
          `select count(*)::int from os.${t}
           where ordem_id = '${id.ordem}' and chamado_id is null`,
        ),
        t,
      ).toBe(1);
    for (const t of ["materiais", "sessoes", "os_custos"])
      expect(
        await valor(
          `select count(*)::int from os.${t} where ordem_id = '${id.ordem}'`,
        ),
        t,
      ).toBe(1);
    expect(
      await valor(
        `select count(*)::int from os.eventos where chamado_id = '${id.ticket}'`,
      ),
    ).toBe(1);
  });

  it("a numeração da OS continua de onde parou", async () => {
    const setor = await valor<string>("select id from os.setores limit 1");
    expect(
      await valor<number>(
        `insert into os.ordens (titulo, setor_id) values ('Nova', '${setor}') returning numero::int`,
      ),
    ).toBeGreaterThan(id.numero);
  });

  it("chamado não vira OS, OS não vira chamado; filha tem um dono só", async () => {
    const setor = await valor<string>("select id from os.setores limit 1");
    expect(
      await erro(
        `insert into os.chamados (tipo, titulo, setor_id) values ('os', 'x', '${setor}')`,
      ),
    ).toMatch(/chamados_sem_os/);
    expect(
      await erro(
        `insert into os.ordens (tipo, titulo, setor_id) values ('solicitacao', 'x', '${setor}')`,
      ),
    ).toMatch(/check constraint/);
    expect(
      await erro(
        `insert into os.eventos (chamado_id, ordem_id, tipo)
         values ('${id.ticket}', '${id.ordem}', 'comentario')`,
      ),
    ).toMatch(/check constraint/);
  });

  it("apagar o chamado ligado só desfaz o vínculo", async () => {
    await db.exec("begin");
    try {
      await db.query(
        `delete from os.eventos where chamado_id = '${id.ticket}'`,
      );
      await db.query(`delete from os.chamados where id = '${id.ticket}'`);
      expect(
        await valor(
          `select vinculado_a_id from os.ordens where id = '${id.ordem}'`,
        ),
      ).toBeNull();
    } finally {
      await db.exec("rollback");
    }
  });

  it("outros custos: lista vazia por padrão, só aceita lista", async () => {
    expect(
      await valor(
        `select outros_custos::text from os.os_custos where ordem_id = '${id.ordem}'`,
      ),
    ).toBe("[]");
    expect(
      await erro(
        `update os.os_custos set outros_custos = '{"valor": 1}' where ordem_id = '${id.ordem}'`,
      ),
    ).toMatch(/check constraint/);
  });
});
