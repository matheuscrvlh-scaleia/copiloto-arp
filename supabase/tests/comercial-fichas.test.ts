// Fichas cadastrais: exemplos do mockup (20261104130200) e o cancelamento do
// link e a referência do RD (20261104140500). As respostas de exemplo
// passam pelo mesmo Zod da ficha (src/lib/comercial/ficha.ts).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import {
  dadosDaFichaParaContrato,
  lerRespostas,
  problemasDoEnvio,
  respostasSchema,
} from "../../src/lib/comercial/ficha";
import { cnpjValido, cpfValido } from "../../src/lib/documentos";

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
  link: "00000000-0000-0000-0000-0000000000a1",
  fichas: "00000000-0000-0000-0000-0000000000a2",
  parametros: "00000000-0000-0000-0000-0000000000a3",
} as const;
const PERMISSOES: Record<keyof typeof U, string[]> = {
  link: ["comercial.formulario.link"],
  fichas: ["comercial.formulario.ver"],
  parametros: ["comercial.parametros.editar"],
};

let db: PGlite;

interface Linha {
  id: string;
  tipo: string | null;
  situacao: string;
  origem: string;
  nome: string | null;
  documento: string | null;
  respostas: unknown;
  ficha_principal_id: string | null;
  docs: number;
}

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

async function erro(sql: string): Promise<string | null> {
  try {
    await db.query(sql);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

const HOJE = new Date().toISOString().slice(0, 10);
let fichas: Linha[] = [];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_MINIMO);
  // Até o módulo Comercial, mais só as migrations das fichas: os exemplos
  // das outras áreas têm os testes delas (comercial.test.ts roda tudo).
  for (const f of readdirSync(MIGRATIONS).sort())
    if (
      f.endsWith(".sql") &&
      (f <= "20261104120000_comercial.sql" || f.includes("fichas"))
    )
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
  fichas = (
    await db.query<Linha>(
      `select f.id, f.tipo, f.situacao, f.origem, f.nome, d.documento, d.respostas,
         f.ficha_principal_id,
         (select count(*)::int from comercial.ficha_documentos x where x.ficha_id = f.id) as docs
       from comercial.fichas f
       left join comercial.ficha_dados d on d.ficha_id = f.id
       where f.exemplo
       order by f.gerada_em`,
    )
  ).rows;
}, 120_000);

describe("fichas de exemplo", () => {
  it("são 24: PJ, PF e fiador; recebidas, em preenchimento e usadas; 8 do Google Forms", () => {
    expect(fichas).toHaveLength(24);
    const conta = (f: (l: Linha) => boolean) => fichas.filter(f).length;
    expect(conta((l) => l.origem === "google_forms")).toBe(8);
    expect(conta((l) => l.situacao === "recebida")).toBe(13);
    expect(conta((l) => l.situacao === "em_preenchimento")).toBe(6);
    expect(conta((l) => l.situacao === "usada")).toBe(5);
    for (const t of ["pj", "pf", "fiador"])
      expect(conta((l) => l.tipo === t)).toBeGreaterThan(3);
  });

  it("CPF e CNPJ com dígitos que conferem; um CPF repetido para o aviso", () => {
    const docs = fichas.map((l) => l.documento).filter((d): d is string => !!d);
    expect(docs.length).toBe(21);
    for (const d of docs)
      expect(d.length === 11 ? cpfValido(d) : cnpjValido(d)).toBe(true);
    for (const l of fichas) {
      const r = lerRespostas(l.respostas);
      for (const p of l.respostas ? r.pessoas : []) {
        if (p.cpf) expect(cpfValido(p.cpf)).toBe(true);
        if (p.conjuge.cpf) expect(cpfValido(p.conjuge.cpf)).toBe(true);
      }
    }
    expect(docs.length - new Set(docs).size).toBe(1);
  });

  it("as recebidas e usadas passam no envio do Zod; as incompletas não", () => {
    for (const l of fichas) {
      if (!l.respostas) continue;
      expect(respostasSchema.safeParse(l.respostas).success).toBe(true);
      const problemas = problemasDoEnvio(lerRespostas(l.respostas), HOJE);
      if (l.situacao === "em_preenchimento")
        expect(problemas.length).toBeGreaterThan(0);
      else expect(problemas).toEqual([]);
    }
  });

  it("documentos só nas do sistema; fiadores ligados à ficha do locatário", () => {
    for (const l of fichas)
      if (l.origem === "google_forms" || l.situacao === "em_preenchimento")
        expect(l.docs).toBe(0);
      else expect(l.docs).toBe(3);
    expect(fichas.filter((l) => l.ficha_principal_id).length).toBe(5);
  });

  it("alimentam a etapa Partes", () => {
    const casada = fichas.find(
      (l) => l.nome === "ATELIE ALECRIM PRESENTES LTDA",
    );
    const p = dadosDaFichaParaContrato({
      id: casada?.id ?? "",
      tipo: casada?.tipo ?? null,
      origem: "sistema",
      respostas: casada?.respostas,
    });
    expect(p.tipoParte).toBe("pj");
    expect(p.pessoaJuridica?.cnpj).toHaveLength(14);
    expect(p.representantes[0]?.conjuge?.nome).toBeTruthy();
  });

  it("quem gera link vê a lista mas não os dados; quem vê fichas vê tudo", async () => {
    const n = (sql: string) =>
      db.query<{ n: number }>(sql).then((r) => r.rows[0]?.n);
    expect(
      await como("link", () =>
        n("select count(*)::int as n from comercial.fichas where exemplo"),
      ),
    ).toBe(24);
    expect(
      await como("link", () =>
        n("select count(*)::int as n from comercial.ficha_dados"),
      ),
    ).toBe(0);
    expect(
      await como("fichas", () =>
        n("select count(*)::int as n from comercial.ficha_dados"),
      ),
    ).toBeGreaterThanOrEqual(21);
  });
});

describe("link da ficha", () => {
  it("cancela só link em preenchimento e guarda a oportunidade do RD", async () => {
    const id = await como("link", async () => {
      const { rows } = await db.query<{ id: string }>(
        `insert into comercial.fichas (luc, nome, expira_em, rd_oportunidade)
         values ('11_131', 'INTERESSADO TESTE', now() + interval '30 days', 'Oportunidade 123')
         returning id`,
      );
      return rows[0]?.id ?? "";
    });
    await como("link", () =>
      db.query(
        `update comercial.fichas set cancelada_em = now() where id = '${id}'`,
      ),
    );
    const recebida = fichas.find((l) => l.situacao === "recebida")?.id;
    expect(
      await erro(
        `update comercial.fichas set cancelada_em = now() where id = '${recebida}'`,
      ),
    ).toMatch(/fichas_cancelada_em_preenchimento/);
    expect(
      await erro(
        `update comercial.fichas set rd_oportunidade = repeat('x', 201) where id = '${id}'`,
      ),
    ).toMatch(/check/);
  });

  it("Remover dados de exemplo apaga as fichas, os dados e os documentos", async () => {
    await como("parametros", () =>
      db.query("select comercial.remover_exemplos()"),
    );
    const { rows } = await db.query<{ f: number; d: number; x: number }>(
      `select (select count(*)::int from comercial.fichas where exemplo) as f,
         (select count(*)::int from comercial.ficha_dados) as d,
         (select count(*)::int from comercial.ficha_documentos) as x`,
    );
    expect(rows[0]).toEqual({ f: 0, d: 0, x: 0 });
  });
});
