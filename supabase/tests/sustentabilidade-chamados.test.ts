// Categorias dos chamados do Módulo Sustentabilidade
// (20261116140000_sustentabilidade_chamados): criadas sem confirmação do
// solicitante, a "Entrevista de cliente" renomeada para "Entrevista de
// resíduos" (sem duplicar) e o recolhimento de coletor em Operações.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { CATEGORIAS_DO_MODULO } from "@/lib/sustentabilidade/entrevistas-chamados";

const MIGRATIONS = join(import.meta.dirname, "..", "migrations");
const MIGRATION = "20261116140000_sustentabilidade_chamados.sql";

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

let db: PGlite;

interface Linha {
  setor: string;
  nome: string;
  tipo_padrao: string;
  precisa_confirmacao: boolean;
  prazo_valor: number | null;
}

async function categorias(): Promise<Linha[]> {
  const { rows } = await db.query<Linha>(`
    select s.nome as setor, c.nome, c.tipo_padrao::text, c.precisa_confirmacao, c.prazo_valor
    from os.categorias c join os.setores s on s.id = c.setor_id
    where c.pai_id is null and s.nome in ('Sustentabilidade', 'Operações')
    order by s.nome, c.nome`);
  return rows;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_MINIMO);
  for (const f of readdirSync(MIGRATIONS).sort())
    if (f.endsWith(".sql"))
      await db.exec(readFileSync(join(MIGRATIONS, f), "utf8"));
}, 120_000);

describe("categorias do Sustentabilidade", () => {
  it("cria as do módulo sem confirmação do solicitante, como tarefa", async () => {
    const todas = await categorias();
    for (const c of CATEGORIAS_DO_MODULO) {
      const achadas = todas.filter((l) => l.nome === c.nome);
      expect(achadas, c.nome).toHaveLength(1);
      const [l] = achadas as [Linha];
      expect(l.setor).toBe(c.setor);
      expect(l.precisa_confirmacao).toBe(false);
      expect(l.tipo_padrao).toBe("tarefa");
    }
  });

  it("renomeia a Entrevista de cliente em vez de duplicar", async () => {
    const nomes = (await categorias())
      .filter((l) => l.setor === "Sustentabilidade")
      .map((l) => l.nome);
    expect(nomes).not.toContain("Entrevista de cliente");
    expect(nomes.filter((n) => n === "Entrevista de resíduos")).toHaveLength(1);
  });

  it("recolhimento de coletor em Operações, com prazo de 1 dia útil", async () => {
    const r = (await categorias()).find(
      (l) => l.nome === "Recolhimento de coletor",
    );
    expect(r?.setor).toBe("Operações");
    expect(r?.prazo_valor).toBe(1);
  });

  it("rodar de novo não cria nada a mais", async () => {
    const antes = (await categorias()).length;
    await db.exec(readFileSync(join(MIGRATIONS, MIGRATION), "utf8"));
    expect((await categorias()).length).toBe(antes);
  });

  it("não mexe nas categorias de Operações que já existiam", async () => {
    const eletrica = (await categorias()).find((l) => l.nome === "Elétrica");
    expect(eletrica?.tipo_padrao).toBe("os");
  });
});
