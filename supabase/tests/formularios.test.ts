// Formulários (20261106120000): quem vê, quem edita, o envio pelo link (só
// a service role, com a situação, a data e o limite conferidos no banco) e
// o contador de respostas, que não conta como edição.
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

const U = {
  ve: "00000000-0000-0000-0000-0000000000f1",
  edita: "00000000-0000-0000-0000-0000000000f2",
  nada: "00000000-0000-0000-0000-0000000000f3",
} as const;
const PERMISSOES: Record<keyof typeof U, string[]> = {
  ve: ["formularios.ver"],
  edita: ["formularios.editar"],
  nada: ["rh.painel"],
};

let db: PGlite;

async function como<T>(
  quem: keyof typeof U | "servico",
  fn: () => Promise<T>,
): Promise<T> {
  await db.exec(
    quem === "servico"
      ? "set role service_role;"
      : `set role authenticated; select set_config('request.jwt.claim.sub', '${U[quem]}', false);`,
  );
  try {
    return await fn();
  } finally {
    await db.exec(
      "reset role; select set_config('request.jwt.claim.sub', '', false);",
    );
  }
}

async function erro(
  sql: string,
  params: unknown[] = [],
): Promise<string | null> {
  try {
    await db.query(sql, params);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

const CAMPOS = JSON.stringify([
  { id: "nome0001", tipo: "texto", titulo: "Nome", obrigatorio: true },
]);

async function novo(extra = ""): Promise<{ id: string; token: string }> {
  const r = await db.query<{ id: string; token: string }>(
    `insert into formularios.formularios (titulo, campos, criado_por${extra ? ", situacao, limite_respostas" : ""})
     values ('Pesquisa', $1, $2${extra ? `, ${extra}` : ""}) returning id, token`,
    [CAMPOS, U.edita],
  );
  const linha = r.rows[0];
  if (!linha) throw new Error("sem formulário");
  return linha;
}

async function responder(token: string): Promise<string | null> {
  return como("servico", () =>
    erro("select formularios.responder($1, $2, $3)", [
      token,
      '{"nome0001":"Ana"}',
      '{"nome0001":"Nome"}',
    ]),
  );
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
    for (const p of PERMISSOES[nome as keyof typeof U])
      await db.query(
        "insert into core.usuario_permissoes (usuario_id, permissao) values ($1, $2)",
        [id, p],
      );
  }
}, 180_000);

describe("acesso aos formulários", () => {
  it("quem edita cria, altera e exclui; quem só vê, só lê", async () => {
    const criado = await como("edita", () =>
      db.query<{ id: string }>(
        "insert into formularios.formularios (titulo) values ('Inscrição') returning id",
      ),
    );
    const id = criado.rows[0]?.id;
    expect(id).toBeTruthy();

    const visto = await como("ve", () =>
      db.query("select id from formularios.formularios where id = $1", [id]),
    );
    expect(visto.rows).toHaveLength(1);
    expect(
      await como("ve", () =>
        erro("insert into formularios.formularios (titulo) values ('x')"),
      ),
    ).toMatch(/row-level security/);
    const mudou = await como("ve", () =>
      db.query(
        "update formularios.formularios set titulo = 'x' where id = $1 returning id",
        [id],
      ),
    );
    expect(mudou.rows).toHaveLength(0);

    const nada = await como("nada", () =>
      db.query("select id from formularios.formularios"),
    );
    expect(nada.rows).toHaveLength(0);

    const apagou = await como("edita", () =>
      db.query(
        "delete from formularios.formularios where id = $1 returning id",
        [id],
      ),
    );
    expect(apagou.rows).toHaveLength(1);
  });

  it("ninguém cria formulário em nome de outra pessoa", async () => {
    expect(
      await como("edita", () =>
        erro(
          "insert into formularios.formularios (titulo, criado_por) values ('x', $1)",
          [U.ve],
        ),
      ),
    ).toMatch(/row-level security/);
  });

  it("com login não se grava resposta nem se chama o envio do link", async () => {
    const f = await novo("'publicado', null");
    expect(
      await como("edita", () =>
        erro(
          "insert into formularios.respostas (formulario_id, respostas) values ($1, '{}')",
          [f.id],
        ),
      ),
    ).toMatch(/permission denied/);
    expect(
      await como("edita", () =>
        erro("select formularios.responder($1, '{}', '{}')", [f.token]),
      ),
    ).toMatch(/permission denied/);
  });
});

describe("envio pelo link", () => {
  it("rascunho não recebe; publicado recebe e conta", async () => {
    const rascunho = await novo();
    expect(await responder(rascunho.token)).toMatch(/encerrado/);
    expect(await responder("x".repeat(40))).toMatch(/não encontrado/);

    const f = await novo("'publicado', null");
    const antes = await db.query<{ atualizado_em: string }>(
      "select atualizado_em::text from formularios.formularios where id = $1",
      [f.id],
    );
    const auditoriaAntes = await db.query<{ n: number }>(
      "select count(*)::int as n from core.auditoria where tabela = 'formularios.formularios'",
    );
    expect(await responder(f.token)).toBeNull();
    expect(await responder(f.token)).toBeNull();
    const depois = await db.query<{
      total_respostas: number;
      atualizado_em: string;
      ultima: boolean;
    }>(
      `select total_respostas, atualizado_em::text, ultima_resposta_em is not null as ultima
       from formularios.formularios where id = $1`,
      [f.id],
    );
    expect(depois.rows[0]?.total_respostas).toBe(2);
    expect(depois.rows[0]?.ultima).toBe(true);
    // Resposta não é edição: nem "atualizado em" nem histórico mudam.
    expect(depois.rows[0]?.atualizado_em).toBe(antes.rows[0]?.atualizado_em);
    const auditoriaDepois = await db.query<{ n: number }>(
      "select count(*)::int as n from core.auditoria where tabela = 'formularios.formularios'",
    );
    expect(auditoriaDepois.rows[0]?.n).toBe(auditoriaAntes.rows[0]?.n);

    const vistas = await como("ve", () =>
      db.query<{ respostas: unknown; perguntas: unknown }>(
        "select respostas, perguntas from formularios.respostas where formulario_id = $1",
        [f.id],
      ),
    );
    expect(vistas.rows).toHaveLength(2);
    expect(vistas.rows[0]?.respostas).toEqual({ nome0001: "Ana" });
    expect(vistas.rows[0]?.perguntas).toEqual({ nome0001: "Nome" });

    // Quem edita apaga uma resposta (spam) e o total acompanha.
    const apagada = await como("edita", () =>
      db.query(
        `delete from formularios.respostas where id = (
           select id from formularios.respostas where formulario_id = $1 limit 1
         ) returning id`,
        [f.id],
      ),
    );
    expect(apagada.rows).toHaveLength(1);
    const total = await db.query<{ total_respostas: number }>(
      "select total_respostas from formularios.formularios where id = $1",
      [f.id],
    );
    expect(total.rows[0]?.total_respostas).toBe(1);

    // Quem só vê não apaga.
    const naoApagou = await como("ve", () =>
      db.query(
        "delete from formularios.respostas where formulario_id = $1 returning id",
        [f.id],
      ),
    );
    expect(naoApagou.rows).toHaveLength(0);
  });

  it("encerra sozinho ao bater o limite", async () => {
    const f = await novo("'publicado', 2");
    expect(await responder(f.token)).toBeNull();
    expect(await responder(f.token)).toBeNull();
    expect(await responder(f.token)).toMatch(/encerrado/);
    const r = await db.query<{ situacao: string; total_respostas: number }>(
      "select situacao, total_respostas from formularios.formularios where id = $1",
      [f.id],
    );
    expect(r.rows[0]).toEqual({ situacao: "encerrado", total_respostas: 2 });
  });

  it("não recebe depois da data de encerramento", async () => {
    const f = await novo("'publicado', null");
    await db.query(
      "update formularios.formularios set encerra_em = now() - interval '1 minute' where id = $1",
      [f.id],
    );
    expect(await responder(f.token)).toMatch(/encerrado/);
  });

  it("o administrador recebe as permissões do módulo", async () => {
    const r = await db.query<{ permissao: string }>(
      `select cp.permissao from core.cargo_permissoes cp
       join core.cargos c on c.id = cp.cargo_id
       where c.nome = 'Administrador' and cp.permissao like 'formularios.%'
       order by 1`,
    );
    expect(r.rows.map((x) => x.permissao)).toEqual([
      "formularios.editar",
      "formularios.exportar",
      "formularios.ver",
    ]);
  });
});
