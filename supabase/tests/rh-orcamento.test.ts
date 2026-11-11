// Planejamento orçamentário do RH (20261111190000_rh_planejamento_orcamentario):
// quem vê e quem lança, o orçamento que só o ERP grava, a categoria
// desativada e o ano finalizado, que fica só leitura.
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
  lanca: "00000000-0000-0000-0000-0000000000c1",
  ve: "00000000-0000-0000-0000-0000000000c2",
  outroRh: "00000000-0000-0000-0000-0000000000c3",
  gestora: "00000000-0000-0000-0000-0000000000c4",
};

const PERMISSOES: Record<keyof typeof U, string[]> = {
  lanca: ["rh.orcamento.lancar"],
  ve: ["rh.orcamento"],
  outroRh: ["rh.painel", "rh.custo_pessoal"],
  gestora: ["rh.parametros"],
};

let db: PGlite;
let eventos: string;

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

const gasto = (data: string, valor: number, extra = "") =>
  `insert into rh.gastos (data, valor, categoria_id, descricao, finalidade${extra ? ", observacao" : ""})
   values ('${data}', ${valor}, '${eventos}', 'Bolo', 'Aniversariantes'${extra ? `, '${extra}'` : ""})`;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_MINIMO);
  const arquivos = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of arquivos) {
    // A Gestora (rh.parametros) existe antes da migration: ela ganha as
    // permissões novas na própria migration.
    if (f.startsWith("20261111190000")) {
      await db.query("insert into auth.users (id, email) values ($1, $2)", [
        U.gestora,
        "gestora@arp.test",
      ]);
      await db.query(
        "insert into core.usuario_permissoes (usuario_id, permissao) values ($1, 'rh.parametros')",
        [U.gestora],
      );
    }
    await db.exec(readFileSync(join(MIGRATIONS, f), "utf8"));
  }
  for (const [nome, id] of Object.entries(U)) {
    if (nome === "gestora") continue;
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
  eventos = await valor<string>(
    "select id from rh.categorias_gasto where nome = 'Eventos'",
  );
}, 180_000);

describe("planejamento orçamentário do RH", () => {
  it("rh.endomarketing virou rh.orcamento; a Gestora ganha ver e lançar", async () => {
    expect(
      await valor<number>(
        "select count(*)::int from core.permissoes where codigo = 'rh.endomarketing'",
      ),
    ).toBe(0);
    expect(
      await valor<string>(
        `select string_agg(permissao, ',' order by permissao) from core.usuario_permissoes
         where usuario_id = '${U.gestora}'`,
      ),
    ).toBe("rh.orcamento,rh.orcamento.lancar,rh.parametros");
    expect(
      await valor<number>(
        "select count(*)::int from information_schema.tables where table_schema = 'rh' and table_name = 'orcamento_endomarketing'",
      ),
    ).toBe(0);
  });

  it("Endomarketing é uma das categorias iniciais", async () => {
    expect(
      await valor<string>(
        "select string_agg(nome, ',' order by nome) from rh.categorias_gasto",
      ),
    ).toBe(
      "Alimentação,Ações de saúde,Brindes,Capacitação,Datas comemorativas,Endomarketing,Eventos",
    );
  });

  it("vê quem tem rh.orcamento; lança só quem tem rh.orcamento.lancar", async () => {
    await como(U.lanca, () => db.query(gasto("2026-10-15", 300)));
    expect(
      await como(U.ve, () =>
        valor<number>("select count(*)::int from rh.gastos"),
      ),
    ).toBe(1);
    expect(await como(U.ve, () => erro(gasto("2026-10-16", 10)))).toMatch(
      /row-level security/,
    );
    expect(
      await como(U.outroRh, () =>
        valor<number>("select count(*)::int from rh.gastos"),
      ),
    ).toBe(0);
    expect(
      await como(U.outroRh, () =>
        valor<number>("select count(*)::int from rh.categorias_gasto"),
      ),
    ).toBe(0);
    expect(
      await valor<string>(
        "select criado_por::text from rh.gastos where data = '2026-10-15'",
      ),
    ).toBe(U.lanca);
  });

  it("gasto sem finalidade, sem categoria ou sem valor não entra", async () => {
    await como(U.lanca, async () => {
      expect(
        await erro(
          `insert into rh.gastos (data, valor, categoria_id, descricao, finalidade)
           values ('2026-10-01', 10, '${eventos}', 'x', '  ')`,
        ),
      ).toMatch(/check/);
      expect(
        await erro(
          "insert into rh.gastos (data, valor, descricao, finalidade) values ('2026-10-01', 10, 'x', 'y')",
        ),
      ).toMatch(/null/);
      expect(
        await erro(
          `insert into rh.gastos (valor, categoria_id, descricao, finalidade)
           values (10, '${eventos}', 'x', 'y')`,
        ),
      ).toMatch(/null/);
      expect(await erro(gasto("2026-10-01", 0))).toMatch(/check/);
    });
  });

  it("categoria: desativar tira da lista de lançamento, mas o gasto antigo fica; excluir não há", async () => {
    await como(U.lanca, async () => {
      await db.query(
        `update rh.categorias_gasto set ativa = false where id = '${eventos}'`,
      );
      expect(await erro(gasto("2026-10-20", 50))).toMatch(
        /categoria desativada/,
      );
      // O gasto que já a tem continua editável (sem trocar a categoria).
      await db.query(
        "update rh.gastos set valor = 320 where data = '2026-10-15'",
      );
      expect(
        await erro(`delete from rh.categorias_gasto where id = '${eventos}'`),
      ).toMatch(/permission denied/);
      await db.query(
        `update rh.categorias_gasto set ativa = true where id = '${eventos}'`,
      );
    });
    expect(
      await como(U.ve, () => erro("update rh.categorias_gasto set nome = 'X'")),
    ).toBeNull(); // sem a política de editar: não alcança nenhuma linha
    expect(
      await valor<number>(
        "select count(*)::int from rh.categorias_gasto where nome = 'X'",
      ),
    ).toBe(0);
  });

  it("o orçamento só chega pelo ERP: a tela não grava", async () => {
    expect(
      await como(U.lanca, () =>
        erro(
          "insert into rh.orcamentos_anuais (ano, valor) values (2026, 50000)",
        ),
      ),
    ).toMatch(/permission denied/);
    // Sincronização (service role).
    await db.query(
      "insert into rh.orcamentos_anuais (ano, valor) values (2026, 50000)",
    );
    expect(
      await como(U.lanca, () =>
        erro("update rh.orcamentos_anuais set valor = 1 where ano = 2026"),
      ),
    ).toMatch(/permission denied/);
  });

  it("finalizar: só quem lança; guarda o total gasto e quem fechou", async () => {
    expect(
      await como(U.ve, () => erro("select rh.finalizar_orcamento(2026)")),
    ).toMatch(/sem permissão/);
    expect(
      await como(U.lanca, () => erro("select rh.finalizar_orcamento(2030)")),
    ).toMatch(/ainda não chegou do ERP/);
    await como(U.lanca, () => db.query(gasto("2026-11-02", 180, "nota 12")));
    await como(U.lanca, () => db.query(gasto("2027-01-05", 999)));
    await como(U.lanca, () => db.query("select rh.finalizar_orcamento(2026)"));
    const { rows } = await db.query<{
      total_gasto: string;
      finalizado_por: string;
      fechado: boolean;
    }>(
      "select total_gasto, finalizado_por, finalizado_em is not null fechado from rh.orcamentos_anuais where ano = 2026",
    );
    expect(rows[0]).toEqual({
      total_gasto: "500.00",
      finalizado_por: U.lanca,
      fechado: true,
    });
    expect(
      await como(U.lanca, () => erro("select rh.finalizar_orcamento(2026)")),
    ).toMatch(/já foi finalizado/);
  });

  it("ano finalizado é só leitura: gasto não entra, não muda e não sai; o orçamento também não", async () => {
    await como(U.lanca, async () => {
      expect(await erro(gasto("2026-12-01", 10))).toMatch(/já foi finalizado/);
      expect(
        await erro("update rh.gastos set valor = 1 where data = '2026-10-15'"),
      ).toMatch(/já foi finalizado/);
      expect(
        await erro("delete from rh.gastos where data = '2026-10-15'"),
      ).toMatch(/já foi finalizado/);
      // Nem levar um gasto de 2027 para 2026.
      expect(
        await erro(
          "update rh.gastos set data = '2026-12-31' where data = '2027-01-05'",
        ),
      ).toMatch(/já foi finalizado/);
      // O ano seguinte segue aberto.
      expect(
        await erro(
          "update rh.gastos set valor = 900 where data = '2027-01-05'",
        ),
      ).toBeNull();
    });
    // Nem a sincronização muda o orçamento fechado.
    expect(
      await erro("update rh.orcamentos_anuais set valor = 1 where ano = 2026"),
    ).toMatch(/já foi finalizado/);
    expect(
      await erro("delete from rh.orcamentos_anuais where ano = 2026"),
    ).toMatch(/já foi finalizado/);
  });

  it("gasto, categoria e orçamento caem no histórico", async () => {
    expect(
      await valor<string>(
        `select string_agg(distinct tabela, ',' order by tabela) from core.auditoria
         where tabela in ('rh.gastos', 'rh.categorias_gasto', 'rh.orcamentos_anuais')`,
      ),
    ).toBe("rh.categorias_gasto,rh.gastos,rh.orcamentos_anuais");
  });
});
