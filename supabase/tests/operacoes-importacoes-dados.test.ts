// Importações de Operações: conta da concessionária de água (agua_conta) e
// edição do que foi importado (20261111150000_operacoes_importacoes_dados):
// prévia → confirmar → substituir → desfazer, quem vê e quem edita, e a
// auditoria só das correções feitas à mão.
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
  importa: "00000000-0000-0000-0000-0000000000a1",
  valores: "00000000-0000-0000-0000-0000000000a2",
  ve: "00000000-0000-0000-0000-0000000000a3",
  completo: "00000000-0000-0000-0000-0000000000a4",
};

const PERMISSOES: Record<keyof typeof U, string[]> = {
  importa: ["operacoes.agua.importar"],
  valores: ["operacoes.agua.valores", "operacoes.agua.ver"],
  ve: ["operacoes.agua.ver"],
  completo: ["operacoes.agua.importar", "operacoes.agua.valores"],
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

/** Prévia de conta (importação + linha) criada por `quem`; devolve o id da importação. */
async function previaConta(quem: string, total: number, matricula = "123456") {
  return como(quem, async () => {
    const imp = await valor<string>(
      `insert into operacoes.importacoes (tipo, referencia, bate, criado_por)
       values ('agua_conta', '2026-09-01', true, '${quem}') returning id`,
    );
    await db.query(
      `insert into operacoes.agua_contas (importacao_id, referencia, matricula, consumo_m3, total)
       values ($1, '2026-09-01', $2, 4312.9, $3)`,
      [imp, matricula, total],
    );
    return imp;
  });
}

const contaVigente = () =>
  valor<string>(
    "select total::text from operacoes.agua_contas where vigente and matricula = '123456'",
  );

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

describe("conta da concessionária (agua_conta)", () => {
  it("só quem importa a água cria a prévia", async () => {
    expect(
      await como(U.ve, () =>
        erro(
          `insert into operacoes.importacoes (tipo, referencia, criado_por)
           values ('agua_conta', '2026-09-01', '${U.ve}')`,
        ),
      ),
    ).toMatch(/row-level security/);
  });

  it("confirmar liga a conta; a segunda da mesma matrícula substitui e desfazer devolve a primeira", async () => {
    const a = await previaConta(U.importa, 100);
    expect(
      await valor<boolean>(
        `select vigente from operacoes.agua_contas where importacao_id = '${a}'`,
      ),
    ).toBe(false);
    await como(U.importa, () =>
      db.query(`select operacoes.confirmar_importacao('${a}')`),
    );
    expect(await contaVigente()).toBe("100.00");

    const b = await previaConta(U.importa, 120);
    await como(U.importa, () =>
      db.query(`select operacoes.confirmar_importacao('${b}')`),
    );
    expect(
      await valor<string>(
        `select string_agg(status || ':' || (substitui is not null)::text, ',' order by criado_em)
         from operacoes.importacoes where id in ('${a}', '${b}')`,
      ),
    ).toBe("substituida:false,confirmada:true");
    expect(await contaVigente()).toBe("120.00");

    const apagadas = await como(U.importa, () =>
      valor<number>(`select operacoes.desfazer_importacao('${b}')`),
    );
    expect(apagadas).toBe(1);
    expect(await contaVigente()).toBe("100.00");
    expect(
      await valor<string>(
        `select status from operacoes.importacoes where id = '${a}'`,
      ),
    ).toBe("confirmada");
  });

  it("outra matrícula no mesmo mês não substitui", async () => {
    const c = await previaConta(U.importa, 50, "999");
    await como(U.importa, () =>
      db.query(`select operacoes.confirmar_importacao('${c}')`),
    );
    expect(await contaVigente()).toBe("100.00");
    expect(
      await valor<number>(
        "select count(*)::int from operacoes.agua_contas where vigente and referencia = '2026-09-01'",
      ),
    ).toBe(2);
  });

  it("confirmar prévia sem a conta lida é recusado", async () => {
    const vazia = await como(U.importa, () =>
      valor<string>(
        `insert into operacoes.importacoes (tipo, referencia, bate, criado_por)
         values ('agua_conta', '2026-10-01', true, '${U.importa}') returning id`,
      ),
    );
    expect(
      await como(U.importa, () =>
        erro(`select operacoes.confirmar_importacao('${vazia}')`),
      ),
    ).toMatch(/não tem a conta/);
  });

  it("a conta aparece para quem vê reais; quem só vê a água vê a importação, não a conta", async () => {
    expect(
      await como(U.valores, () =>
        valor<number>(
          "select count(*)::int from operacoes.agua_contas where matricula = '123456'",
        ),
      ),
    ).toBe(1);
    expect(
      await como(U.ve, () =>
        valor<number>("select count(*)::int from operacoes.agua_contas"),
      ),
    ).toBe(0);
    expect(
      await como(U.ve, () =>
        valor<number>(
          "select count(*)::int from operacoes.importacoes where tipo = 'agua_conta'",
        ),
      ),
    ).toBeGreaterThan(0);
  });

  it("quem importa corrige a conta que vale, com auditoria; quem só vê não", async () => {
    await como(U.importa, () =>
      db.query(
        "update operacoes.agua_contas set total = 101.5, observacao = 'corrigido' where vigente and matricula = '123456'",
      ),
    );
    expect(await contaVigente()).toBe("101.50");
    expect(
      await valor<number>(
        "select count(*)::int from core.auditoria where tabela = 'operacoes.agua_contas' and acao = 'update'",
      ),
    ).toBeGreaterThan(0);
    await como(U.valores, () =>
      db.query(
        "update operacoes.agua_contas set total = 1 where matricula = '123456'",
      ),
    );
    expect(await contaVigente()).toBe("101.50");
    // vigente não se muda por fora das funções.
    expect(
      await como(U.importa, () =>
        erro("update operacoes.agua_contas set vigente = false"),
      ),
    ).toMatch(/permission denied/);
  });
});

describe("leituras da água importadas: corrigir e excluir", () => {
  let imp: string;
  let leitura: string;
  let outra: string;

  beforeAll(async () => {
    // Um mês de água confirmado com duas leituras (gravado como a tela faz).
    imp = await como(U.completo, async () => {
      const id = await valor<string>(
        `insert into operacoes.importacoes (tipo, referencia, bate, criado_por)
         values ('agua', '2031-01-01', true, '${U.completo}') returning id`,
      );
      for (const h of ["Z1", "Z2"]) {
        const l = await valor<string>(
          `insert into operacoes.agua_leituras (importacao_id, referencia, bloco, sala, hidrometro, consumo, volume_faturado, tipo)
           values ('${id}', '2031-01-01', '05', '101', '${h}', 12, 12, 'FATURADO') returning id`,
        );
        await db.query(
          "insert into operacoes.agua_valores (leitura_id, valor) values ($1, 250)",
          [l],
        );
      }
      await db.query(`select operacoes.confirmar_importacao('${id}')`);
      return id;
    });
    leitura = await valor<string>(
      `select id from operacoes.agua_leituras where importacao_id = '${imp}' and hidrometro = 'Z1'`,
    );
    outra = await valor<string>(
      `select id from operacoes.agua_leituras where importacao_id = '${imp}' and hidrometro = 'Z2'`,
    );
  });

  const auditadas = (acao: string, id: string) =>
    valor<number>(
      `select count(*)::int from core.auditoria
       where tabela in ('operacoes.agua_leituras', 'operacoes.agua_valores')
         and acao = '${acao}' and registro_id = '${id}'`,
    );

  it("confirmar o mês não enche a auditoria", async () => {
    expect(await auditadas("update", leitura)).toBe(0);
  });

  it("quem importa corrige a leitura; o valor só com reais", async () => {
    await como(U.importa, async () => {
      await db.query(
        `update operacoes.agua_leituras set consumo = 15, sala = '101A' where id = '${leitura}'`,
      );
      // Sem agua.valores o update não acha a linha.
      await db.query(
        `update operacoes.agua_valores set valor = 1 where leitura_id = '${leitura}'`,
      );
    });
    expect(
      await valor<string>(
        `select consumo::text || '|' || sala from operacoes.agua_leituras where id = '${leitura}'`,
      ),
    ).toBe("15.000|101A");
    expect(
      await valor<string>(
        `select valor::text from operacoes.agua_valores where leitura_id = '${leitura}'`,
      ),
    ).toBe("250.00");
    await como(U.completo, () =>
      db.query(
        `update operacoes.agua_valores set valor = 260.4 where leitura_id = '${leitura}'`,
      ),
    );
    expect(
      await valor<string>(
        `select valor::text from operacoes.agua_valores where leitura_id = '${leitura}'`,
      ),
    ).toBe("260.40");
    expect(await auditadas("update", leitura)).toBe(2);
  });

  it("quem só vê não corrige nem exclui; vigente não muda por fora", async () => {
    await como(U.valores, async () => {
      await db.query(
        `update operacoes.agua_leituras set consumo = 99 where id = '${outra}'`,
      );
      await db.query(
        `delete from operacoes.agua_leituras where id = '${outra}'`,
      );
    });
    expect(
      await valor<string>(
        `select consumo::text from operacoes.agua_leituras where id = '${outra}'`,
      ),
    ).toBe("12.000");
    expect(
      await como(U.importa, () =>
        erro(
          `update operacoes.agua_leituras set vigente = false where id = '${outra}'`,
        ),
      ),
    ).toMatch(/permission denied/);
  });

  it("excluir uma leitura que vale fica na auditoria; desfazer o mês apaga o resto sem auditar", async () => {
    await como(U.importa, () =>
      db.query(`delete from operacoes.agua_leituras where id = '${outra}'`),
    );
    expect(
      await valor<number>(
        `select count(*)::int from operacoes.agua_leituras where id = '${outra}'`,
      ),
    ).toBe(0);
    expect(await auditadas("delete", outra)).toBe(1);
    await como(U.importa, () =>
      db.query(`select operacoes.desfazer_importacao('${imp}')`),
    );
    expect(
      await valor<number>(
        `select count(*)::int from operacoes.agua_leituras where importacao_id = '${imp}'`,
      ),
    ).toBe(0);
    expect(await auditadas("delete", leitura)).toBe(0);
  });
});
