// Contas da Energisa e Energia solar (20261109160300_operacoes_contas e o
// exemplo 20261109160350): fatura da prévia não vale até confirmar
// (vigente por gatilho), quem vê o quê, gravação da fatura com os itens numa
// transação, duplicados recusados e os dados de exemplo coerentes.
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
  contas: "00000000-0000-0000-0000-0000000000e1",
  outro: "00000000-0000-0000-0000-0000000000e2",
  solar: "00000000-0000-0000-0000-0000000000e3",
  parametros: "00000000-0000-0000-0000-0000000000e4",
  fora: "00000000-0000-0000-0000-0000000000e5",
};

const PERMISSOES: Record<keyof typeof U, string[]> = {
  contas: ["operacoes.energia.contas"],
  outro: ["operacoes.energia.contas"],
  solar: ["operacoes.solar.ver"],
  parametros: ["operacoes.parametros"],
  fora: ["operacoes.energia.ver"],
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

const MATRICULA = "0001234567";

/** Prévia de fatura da Energisa (só a importação) criada por `quem`. */
async function previa(quem: string, referencia = "2026-09-01") {
  return como(quem, () =>
    valor<string>(
      `insert into operacoes.importacoes (tipo, referencia, bate, criado_por)
       values ('energisa', '${referencia}', true, '${quem}') returning id`,
    ),
  );
}

const fatura = (referencia: string) => `{
  "matricula": "${MATRICULA}", "referencia": "${referencia}", "consumo_kwh": 880,
  "valor_consumo": 1172.55, "compensado_kwh": 780, "valor_compensado": 887.82,
  "total": 332.80, "saldo_kwh": 1621, "expirar_kwh": 0
}`;
const ITENS = `[
  {"ordem": 1, "descricao": "Consumo em kWh", "tipo": "consumo", "quantidade": 880, "valor": 1172.55, "unidade": "KWH", "preco_unitario": 1.332443},
  {"ordem": 2, "descricao": "Energia Atv Injetada GDI oUC 9/2026 mPT", "tipo": "injetada", "origem": "oUC", "mes_geracao": "2026-09-01", "quantidade": -707, "valor": -804.73},
  {"ordem": 3, "descricao": "Energia Atv Injetada GDI mUC 6/2024 mPT", "tipo": "injetada", "origem": "mUC", "mes_geracao": "2024-06-01", "quantidade": -73, "valor": -83.09},
  {"ordem": 4, "descricao": "Adic. B. Amarela", "tipo": "bandeira", "valor": 2.74},
  {"ordem": 5, "descricao": "CONTRIBUIÇÃO ILUM PUBLICA", "tipo": "iluminacao", "valor": 45.33}
]`;

const gravar = (imp: string, sha: string, referencia = "2026-09-01") =>
  `select operacoes.gravar_fatura_energisa('${imp}', 'energisa/x/f.pdf', '${sha}',
     '${fatura(referencia)}'::jsonb, '${ITENS}'::jsonb)`;

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

describe("dados de exemplo", () => {
  it("3 unidades fictícias, uma geradora, e 12 meses de faturas vigentes", async () => {
    expect(
      await valor<string>(
        "select string_agg(papel, ',' order by matricula) from operacoes.energia_unidades where exemplo",
      ),
    ).toBe("consome,consome,gera");
    expect(
      await valor<number>(
        "select count(*)::int from operacoes.energia_faturas where exemplo and vigente",
      ),
    ).toBe(36);
    expect(
      await valor<number>(
        "select count(distinct referencia)::int from operacoes.energia_faturas where exemplo",
      ),
    ).toBe(12);
  });

  it("em toda fatura os itens somam o total e os créditos batem com o compensado", async () => {
    expect(
      await valor<number>(
        `select count(*)::int from operacoes.energia_faturas f
         where f.exemplo and (
           f.total <> (select sum(valor) from operacoes.energia_fatura_itens i where i.fatura_id = f.id)
           or f.compensado_kwh <> coalesce((select -sum(quantidade) from operacoes.energia_fatura_itens i
                                            where i.fatura_id = f.id and i.tipo = 'injetada'), 0)
           or f.valor_compensado <> coalesce((select -sum(valor) from operacoes.energia_fatura_itens i
                                              where i.fatura_id = f.id and i.tipo = 'injetada'), 0)
           or f.iluminacao_publica <> (select sum(valor) from operacoes.energia_fatura_itens i
                                       where i.fatura_id = f.id and i.tipo = 'iluminacao'))`,
      ),
    ).toBe(0);
  });

  it("só a geradora tem energia injetada medida; todo crédito tem origem e mês", async () => {
    expect(
      await valor<string>(
        `select string_agg(distinct u.papel, ',') from operacoes.energia_faturas f
         join operacoes.energia_unidades u using (matricula)
         where f.exemplo and f.injetada_kwh > 0`,
      ),
    ).toBe("gera");
    expect(
      await valor<number>(
        `select count(*)::int from operacoes.energia_fatura_itens
         where tipo = 'injetada' and (origem is null or mes_geracao is null)`,
      ),
    ).toBe(0);
  });

  it("um crédito a expirar no último mês (para o alerta da tela solar)", async () => {
    expect(
      await valor<number>(
        "select sum(expirar_kwh)::int from operacoes.energia_faturas where referencia = '2026-10-01'",
      ),
    ).toBeGreaterThan(0);
  });
});

describe("quem vê o quê", () => {
  it("contas e solar veem faturas e itens; o histórico de importações, só contas", async () => {
    for (const u of [U.contas, U.solar]) {
      expect(
        await como(u, () =>
          valor<number>("select count(*)::int from operacoes.energia_faturas"),
        ),
      ).toBe(36);
      expect(
        await como(u, () =>
          valor<number>(
            "select count(*)::int from operacoes.energia_fatura_itens",
          ),
        ),
      ).toBeGreaterThan(36 * 3);
    }
    expect(
      await como(U.solar, () =>
        valor<number>(
          "select count(*)::int from operacoes.importacoes where tipo = 'energisa'",
        ),
      ),
    ).toBe(0);
  });

  it("sem contas nem solar não vê nada", async () => {
    expect(
      await como(U.fora, () =>
        valor<number>(
          "select ((select count(*) from operacoes.energia_faturas) + (select count(*) from operacoes.energia_unidades))::int",
        ),
      ),
    ).toBe(0);
  });

  it("solar só consulta: não cadastra unidade nem cria prévia", async () => {
    expect(
      await como(U.solar, () =>
        erro(
          `insert into operacoes.energia_unidades (matricula, papel) values ('${MATRICULA}', 'gera')`,
        ),
      ),
    ).toMatch(/row-level security/);
    expect(
      await como(U.solar, () =>
        erro(
          `insert into operacoes.importacoes (tipo, referencia, criado_por) values ('energisa', '2026-09-01', '${U.solar}')`,
        ),
      ),
    ).toMatch(/row-level security/);
  });
});

describe("prévia → confirmada → desfeita", () => {
  let imp: string;
  let id: string;

  it("cadastra a unidade nova na prévia e grava fatura e itens juntos, fora das telas", async () => {
    imp = await previa(U.contas);
    await como(U.contas, () =>
      db.query(
        `insert into operacoes.energia_unidades (matricula, apelido, papel) values ('${MATRICULA}', 'Sala nova', 'consome')`,
      ),
    );
    id = await como(U.contas, () => valor<string>(gravar(imp, "sha-1")));
    expect(
      await valor<string>(
        `select vigente::text || ' ' || importado_por || ' ' || (select count(*) from operacoes.energia_fatura_itens where fatura_id = '${id}')
         from operacoes.energia_faturas where id = '${id}'`,
      ),
    ).toBe(`false ${U.contas} 5`);
    expect(
      await valor<string>(
        `select string_agg(coalesce(origem, '-') || ' ' || coalesce(mes_geracao::text, '-'), ',' order by ordem)
         from operacoes.energia_fatura_itens where fatura_id = '${id}'`,
      ),
    ).toBe("- -,oUC 2026-09-01,mUC 2024-06-01,- -,- -");
  });

  it("outra pessoa não grava na prévia de quem importou", async () => {
    expect(
      await como(U.outro, () => erro(gravar(imp, "sha-2", "2026-08-01"))),
    ).toMatch(/row-level security/);
  });

  it("fatura sem itens é recusada (nada fica gravado)", async () => {
    const antes = await valor<number>(
      "select count(*)::int from operacoes.energia_faturas",
    );
    expect(
      await como(U.contas, () =>
        erro(
          `select operacoes.gravar_fatura_energisa('${imp}', null, 'sha-3', '${fatura("2026-07-01")}'::jsonb, '[]'::jsonb)`,
        ),
      ),
    ).toMatch(/precisa ter itens/);
    expect(
      await valor<number>(
        "select count(*)::int from operacoes.energia_faturas",
      ),
    ).toBe(antes);
  });

  it("o mesmo arquivo (sha256) e o mesmo mês da unidade são recusados", async () => {
    const outra = await previa(U.contas, "2026-08-01");
    expect(
      await como(U.contas, () => erro(gravar(outra, "sha-1", "2026-08-01"))),
    ).toMatch(/duplicate key|unique/);
    expect(
      await como(U.contas, () => erro(gravar(outra, "sha-9", "2026-09-01"))),
    ).toMatch(/duplicate key|unique/);
    await como(U.contas, () =>
      db.query(`select operacoes.desfazer_importacao('${outra}')`),
    );
  });

  it("confirmar liga a fatura (quem só vê a solar passa a contar com ela); desfazer apaga", async () => {
    await como(U.contas, () =>
      db.query(`select operacoes.confirmar_importacao('${imp}')`),
    );
    expect(
      await como(U.solar, () =>
        valor<boolean>(
          `select vigente from operacoes.energia_faturas where id = '${id}'`,
        ),
      ),
    ).toBe(true);
    expect(
      await como(U.contas, () =>
        valor<number>(`select operacoes.desfazer_importacao('${imp}')`),
      ),
    ).toBe(1);
    expect(
      await valor<number>(
        `select count(*)::int from operacoes.energia_faturas where id = '${id}'`,
      ),
    ).toBe(0);
  });

  it("a prévia entra como não vigente mesmo que o cliente diga o contrário", async () => {
    const outra = await previa(U.contas, "2026-06-01");
    const f = await como(U.contas, () =>
      valor<string>(
        `insert into operacoes.energia_faturas (importacao_id, matricula, referencia, total, vigente, importado_por)
         values ('${outra}', '${MATRICULA}', '2026-06-01', 10, true, '${U.contas}') returning id`,
      ),
    );
    expect(
      await valor<boolean>(
        `select vigente from operacoes.energia_faturas where id = '${f}'`,
      ),
    ).toBe(false);
    await como(U.contas, () =>
      db.query(`select operacoes.desfazer_importacao('${outra}')`),
    );
  });

  it("descartar a prévia apaga a fatura e marca a importação como cancelada", async () => {
    const outra = await previa(U.contas, "2026-05-01");
    await como(U.contas, () => db.query(gravar(outra, "sha-5", "2026-05-01")));
    await como(U.contas, () =>
      db.query(`select operacoes.desfazer_importacao('${outra}')`),
    );
    expect(
      await valor<string>(
        `select status || ' ' || (select count(*) from operacoes.energia_faturas where importacao_id = '${outra}')
         from operacoes.importacoes where id = '${outra}'`,
      ),
    ).toBe("cancelada 0");
  });
});

describe("remover os exemplos", () => {
  it("operacoes.remover_exemplos() tira as faturas e as unidades de exemplo", async () => {
    await como(U.parametros, () =>
      db.query("select operacoes.remover_exemplos()"),
    );
    expect(
      await valor<number>(
        "select ((select count(*) from operacoes.energia_faturas where exemplo) + (select count(*) from operacoes.energia_unidades where exemplo))::int",
      ),
    ).toBe(0);
    // A unidade real (cadastrada na prévia) fica.
    expect(
      await valor<number>(
        `select count(*)::int from operacoes.energia_unidades where matricula = '${MATRICULA}'`,
      ),
    ).toBe(1);
  });
});
