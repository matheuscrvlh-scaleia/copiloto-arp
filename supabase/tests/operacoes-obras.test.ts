// Obras — previsto e realizado (20261109160000_operacoes + 20261109160500_operacoes_obras
// + 20261109160550_operacoes_obras_exemplo): exemplos carregados, RLS de quem
// vê e de quem importa, prévia → confirmada (revisão vigente) → nova revisão
// → desfazer (a anterior volta), realizado da planilha travado e o da tela
// editável, vínculo único com o Diário de Obra e a remoção dos exemplos.
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
  importa: "00000000-0000-0000-0000-0000000000e1",
  ve: "00000000-0000-0000-0000-0000000000e2",
  diario: "00000000-0000-0000-0000-0000000000e3",
  admin: "00000000-0000-0000-0000-0000000000e4",
  fora: "00000000-0000-0000-0000-0000000000e5",
};

const PERMISSOES: Record<keyof typeof U, string[]> = {
  importa: ["operacoes.obras.ver", "operacoes.obras.importar"],
  ve: ["operacoes.obras.ver"],
  diario: ["operacoes.obras.diario"],
  admin: ["operacoes.parametros"],
  fora: ["rh.painel"],
};

const ANEXO = "0b7a0000-0000-4000-8000-000000000001";
const PRACA = "0b7a0000-0000-4000-8000-000000000002";

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

const vigente = (obra: string) =>
  como(U.ve, () =>
    valor<string | null>(
      `select codigo from operacoes.orcamento_revisoes where obra_id = '${obra}' and vigente`,
    ),
  );

const novaImportacao = () =>
  valor<string>(
    `insert into operacoes.importacoes (tipo, referencia, criado_por)
     values ('orcamento', 'Obra teste', '${U.importa}') returning id`,
  );

/** Prévia como a ação grava: importação, revisão, etapa, previsto e realizado da planilha. */
async function previa(obra: string, codigo: string, valorMes: number) {
  return como(U.importa, async () => {
    const imp = await novaImportacao();
    const rev = await valor<string>(
      `insert into operacoes.orcamento_revisoes (obra_id, importacao_id, codigo, total)
       values ('${obra}', '${imp}', '${codigo}', ${valorMes * 2}) returning id`,
    );
    const etapa = await valor<string>(
      `insert into operacoes.orcamento_etapas (revisao_id, ordem, nome)
       values ('${rev}', 1, 'Térreo') returning id`,
    );
    await db.query(
      `insert into operacoes.orcamento_previsto (etapa_id, mes, valor) values
         ('${etapa}', '2026-07-01', ${valorMes}), ('${etapa}', '2026-08-01', ${valorMes})`,
    );
    await db.query(
      `insert into operacoes.obra_realizado (obra_id, etapa, mes, valor, origem, importacao_id, lancado_por)
       values ('${obra}', 'Térreo', '2026-06-01', 10, 'planilha', '${imp}', '${U.importa}')`,
    );
    return imp;
  });
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

describe("exemplos", () => {
  it("duas obras de exemplo; o Anexo Norte tem R00 e R01, com a R01 vigente", async () => {
    expect(
      await valor<number>(
        "select count(*)::int from operacoes.obras where exemplo",
      ),
    ).toBe(2);
    expect(await vigente(ANEXO)).toBe("R01");
    expect(await vigente(PRACA)).toBe("R00");
  });

  it("o total de cada revisão é a soma do previsto das etapas", async () => {
    const { rows } = await db.query<{ total: string; soma: string }>(
      `select r.total::text as total, sum(p.valor)::text as soma
       from operacoes.orcamento_revisoes r
       join operacoes.orcamento_etapas e on e.revisao_id = r.id
       join operacoes.orcamento_previsto p on p.etapa_id = e.id
       where r.exemplo
       group by r.id`,
    );
    expect(rows).toHaveLength(3);
    for (const r of rows) expect(r.soma).toBe(r.total);
  });
});

describe("quem vê", () => {
  const contar = (u: string, tabela: string) =>
    como(u, () =>
      valor<number>(`select count(*)::int from operacoes.${tabela}`),
    );

  it("obras.ver vê revisões, previsto e realizado; o Diário só vê as obras; fora não vê nada", async () => {
    expect(await contar(U.ve, "orcamento_previsto")).toBeGreaterThan(0);
    expect(await contar(U.ve, "obra_realizado")).toBeGreaterThan(0);
    expect(await contar(U.diario, "obras")).toBe(2);
    expect(await contar(U.diario, "orcamento_revisoes")).toBe(0);
    expect(await contar(U.diario, "obra_realizado")).toBe(0);
    expect(await contar(U.fora, "obras")).toBe(0);
  });

  it("só quem importa cria obra e lança realizado", async () => {
    expect(
      await como(U.ve, () =>
        erro(
          "insert into operacoes.obras (nome) values ('Obra sem permissão')",
        ),
      ),
    ).toMatch(/row-level security/);
    expect(
      await como(U.ve, () =>
        erro(
          `insert into operacoes.obra_realizado (obra_id, etapa, mes, valor, lancado_por)
           values ('${ANEXO}', 'Térreo', '2026-11-01', 1, '${U.ve}')`,
        ),
      ),
    ).toMatch(/row-level security/);
  });
});

describe("prévia, confirmação, nova revisão e desfazer", () => {
  let obra = "";

  it("a revisão nunca entra já vigente", async () => {
    obra = await como(U.importa, () =>
      valor<string>(
        "insert into operacoes.obras (nome) values ('Obra teste') returning id",
      ),
    );
    const imp = await como(U.importa, novaImportacao);
    expect(
      await como(U.importa, () =>
        erro(
          `insert into operacoes.orcamento_revisoes (obra_id, importacao_id, codigo, total, vigente)
           values ('${obra}', '${imp}', 'R00', 1, true)`,
        ),
      ),
    ).toMatch(/row-level security/);
    await como(U.importa, () =>
      db.query(`select operacoes.desfazer_importacao('${imp}')`),
    );
  });

  it("confirmar a R00 a torna vigente; a R01 confirmada assume e a R00 fica guardada", async () => {
    const r00 = await previa(obra, "R00", 100);
    expect(await vigente(obra)).toBeUndefined();
    await como(U.importa, () =>
      db.query(`select operacoes.confirmar_importacao('${r00}')`),
    );
    expect(await vigente(obra)).toBe("R00");

    const r01 = await previa(obra, "R01", 150);
    await como(U.importa, () =>
      db.query(`select operacoes.confirmar_importacao('${r01}')`),
    );
    expect(await vigente(obra)).toBe("R01");
    expect(
      await como(U.ve, () =>
        valor<number>(
          `select count(*)::int from operacoes.orcamento_revisoes where obra_id = '${obra}'`,
        ),
      ),
    ).toBe(2);

    // Desfazer a R01: ela e o realizado que trouxe saem; a R00 volta.
    await como(U.importa, () =>
      db.query(`select operacoes.desfazer_importacao('${r01}')`),
    );
    expect(await vigente(obra)).toBe("R00");
    expect(
      await como(U.ve, () =>
        valor<number>(
          `select count(*)::int from operacoes.obra_realizado where importacao_id = '${r01}'`,
        ),
      ),
    ).toBe(0);
  });

  it("revisão repetida na mesma obra é recusada pelo banco", async () => {
    const imp = await como(U.importa, novaImportacao);
    expect(
      await como(U.importa, () =>
        erro(
          `insert into operacoes.orcamento_revisoes (obra_id, importacao_id, codigo, total)
           values ('${obra}', '${imp}', 'R00', 1)`,
        ),
      ),
    ).toMatch(/duplicate key/);
  });
});

describe("realizado", () => {
  it("o da planilha não se edita pela tela; o da tela se edita e se exclui", async () => {
    const planilha = await como(U.importa, () =>
      valor<number>(
        `with x as (update operacoes.obra_realizado set valor = 1
           where obra_id = '${ANEXO}' and origem = 'planilha' returning 1)
         select count(*)::int from x`,
      ),
    );
    expect(planilha).toBe(0);
    const id = await como(U.importa, () =>
      valor<string>(
        `insert into operacoes.obra_realizado (obra_id, etapa, mes, valor, descricao, lancado_por)
         values ('${ANEXO}', 'Térreo', '2026-11-01', 1234.56, 'Medição teste', '${U.importa}')
         returning id`,
      ),
    );
    await como(U.importa, () =>
      db.query(
        `update operacoes.obra_realizado set valor = 2000 where id = '${id}'`,
      ),
    );
    expect(
      await valor<string>(
        `select valor::text from operacoes.obra_realizado where id = '${id}'`,
      ),
    ).toBe("2000.00");
    await como(U.importa, () =>
      db.query(`delete from operacoes.obra_realizado where id = '${id}'`),
    );
    expect(
      await valor<number>(
        `select count(*)::int from operacoes.obra_realizado where id = '${id}'`,
      ),
    ).toBe(0);
  });

  it("quem só vê não altera o realizado", async () => {
    const alterados = await como(U.ve, () =>
      valor<number>(
        `with x as (update operacoes.obra_realizado set valor = 1
           where obra_id = '${ANEXO}' returning 1)
         select count(*)::int from x`,
      ),
    );
    expect(alterados).toBe(0);
  });
});

describe("vínculo com o Diário de Obra", () => {
  it("uma obra do Diário liga-se a no máximo uma obra do orçamento", async () => {
    await como(U.importa, () =>
      db.query(
        `update operacoes.obras set diario_obra_id = 'abc123' where id = '${ANEXO}'`,
      ),
    );
    expect(
      await como(U.importa, () =>
        erro(
          `update operacoes.obras set diario_obra_id = 'abc123' where id = '${PRACA}'`,
        ),
      ),
    ).toMatch(/duplicate key/);
  });
});

describe("remover exemplos", () => {
  it("apaga obras, revisões, etapas, previsto e realizado de exemplo", async () => {
    await como(U.admin, () => db.query("select operacoes.remover_exemplos()"));
    expect(
      await valor<number>(
        `select ((select count(*) from operacoes.obras where exemplo)
              + (select count(*) from operacoes.orcamento_revisoes where exemplo)
              + (select count(*) from operacoes.obra_realizado where exemplo)
              + (select count(*) from operacoes.orcamento_etapas
                   where id::text like '0b7a0000-%'))::int`,
      ),
    ).toBe(0);
  });
});
