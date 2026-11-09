// Água (20261109160100_operacoes_agua e 20261109160150_operacoes_agua_exemplo):
// os parâmetros da variação, os meses de exemplo, a reimportação de um mês
// com os blocos mantidos (como a prévia da tela grava), a conferência do
// arquivo repetido pelo sha256 e a correção de vínculo do hidrômetro.
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
  ve: "00000000-0000-0000-0000-0000000000a2",
  vinculo: "00000000-0000-0000-0000-0000000000a3",
  parametros: "00000000-0000-0000-0000-0000000000a4",
};

const PERMISSOES: Record<keyof typeof U, string[]> = {
  importa: [
    "operacoes.agua.ver",
    "operacoes.agua.valores",
    "operacoes.agua.importar",
  ],
  ve: ["operacoes.agua.ver"],
  vinculo: ["operacoes.agua.ver", "operacoes.agua.vinculo"],
  parametros: ["operacoes.agua.ver", "operacoes.parametros"],
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

describe("parâmetros da variação", () => {
  it("têm os padrões e só operacoes.parametros muda", async () => {
    expect(
      await como(U.ve, () =>
        valor<string>(
          "select concat_ws('|', agua_variacao_pct, agua_variacao_meses, agua_variacao_min_m3) from operacoes.parametros",
        ),
      ),
    ).toBe("50.00|3|5.00");
    await como(U.importa, () =>
      db.query("update operacoes.parametros set agua_variacao_pct = 80"),
    );
    expect(
      await valor<string>(
        "select agua_variacao_pct::text from operacoes.parametros",
      ),
    ).toBe("50.00");
    await como(U.parametros, () =>
      db.query("update operacoes.parametros set agua_variacao_meses = 6"),
    );
    expect(
      await valor<number>(
        "select agua_variacao_meses from operacoes.parametros",
      ),
    ).toBe(6);
    expect(
      await como(U.parametros, () =>
        erro("update operacoes.parametros set agua_variacao_meses = 0"),
      ),
    ).toMatch(/check/);
    await db.query("update operacoes.parametros set agua_variacao_meses = 3");
  });
});

describe("dados de exemplo", () => {
  it("três meses confirmados, com as leituras vigentes", async () => {
    const { rows } = await como(U.ve, () =>
      db.query<{ referencia: string; n: number }>(
        `select referencia::text, count(*)::int as n from operacoes.agua_leituras
         where vigente and exemplo group by referencia order by referencia`,
      ),
    );
    expect(rows).toEqual([
      { referencia: "2026-06-01", n: 30 },
      { referencia: "2026-07-01", n: 30 },
      { referencia: "2026-08-01", n: 29 },
    ]);
    expect(
      await valor<number>(
        "select count(*)::int from operacoes.importacoes where tipo = 'agua' and exemplo and status = 'confirmada'",
      ),
    ).toBe(3);
  });

  it("têm os casos de alerta de agosto", async () => {
    const linha = (h: string) =>
      db.query<{
        leitura_anterior: string;
        leitura_atual: string;
        consumo: string;
        foto: string | null;
      }>(
        `select leitura_anterior::text, leitura_atual::text, consumo::text, foto
         from operacoes.agua_leituras where hidrometro = '${h}' and referencia = '2026-08-01'`,
      );
    expect((await linha("EXA000004")).rows[0]?.consumo).toBe("42.400");
    expect((await linha("EXA000013")).rows[0]).toMatchObject({
      leitura_anterior: "9998.500",
      leitura_atual: "3.200",
    });
    expect((await linha("EXA000016")).rows[0]?.leitura_atual).toBe("0.000");
    expect((await linha("EXA000005")).rows[0]?.foto).toBeNull();
    expect((await linha("EXA000022")).rows).toHaveLength(0);
  });

  it("soma das linhas igual ao valor guardado da conferência", async () => {
    expect(
      await valor<boolean>(
        `select bool_and(v.valor_lido = s.total) from operacoes.importacao_valores v
         join (
           select l.importacao_id, sum(a.valor) as total from operacoes.agua_leituras l
           join operacoes.agua_valores a on a.leitura_id = l.id group by l.importacao_id
         ) s on s.importacao_id = v.importacao_id`,
      ),
    ).toBe(true);
  });

  it("sem operacoes.agua.valores, os reais ficam escondidos", async () => {
    expect(
      await como(U.ve, () =>
        valor<number>("select count(*)::int from operacoes.agua_valores"),
      ),
    ).toBe(0);
    expect(
      await como(U.importa, () =>
        valor<number>("select count(*)::int from operacoes.agua_valores"),
      ),
    ).toBe(89);
  });
});

describe("reimportar um bloco do mês", () => {
  let nova = "";

  it("a prévia leva as linhas novas e copia os outros blocos", async () => {
    nova = await como(U.importa, async () => {
      const id = await valor<string>(
        `insert into operacoes.importacoes (tipo, referencia, bate, criado_por, arquivos)
         values ('agua', '2026-08-01', true, '${U.importa}',
           '[{"nome": "Bloco 05.xlsx", "sha256": "abc123"}]') returning id`,
      );
      // Bloco 05 novo (uma leitura) e os demais copiados da versão confirmada.
      await db.query(
        `insert into operacoes.agua_leituras
           (importacao_id, referencia, bloco, sala, hidrometro, consumo, volume_faturado, tipo)
         values ('${id}', '2026-08-01', '05', '101', 'NOVO0001', 3, 10, 'MINIMO')`,
      );
      await db.query(
        `insert into operacoes.agua_leituras
           (importacao_id, referencia, bloco, sala, cliente, hidrometro, consumo, volume_faturado, tipo, foto)
         select '${id}', referencia, bloco, sala, cliente, hidrometro, consumo, volume_faturado, tipo, foto
         from operacoes.agua_leituras
         where vigente and referencia = '2026-08-01' and bloco <> '05'`,
      );
      return id;
    });
    expect(
      await como(U.ve, () =>
        valor<number>(
          `select count(*)::int from operacoes.agua_leituras where importacao_id = '${nova}'`,
        ),
      ),
    ).toBe(0);
  });

  it("confirmar substitui o mês; o anterior fica guardado e volta no desfazer", async () => {
    await como(U.importa, () =>
      db.query(`select operacoes.confirmar_importacao('${nova}')`),
    );
    const vigentes = () =>
      como(U.ve, () =>
        valor<string>(
          `select concat_ws('|', count(*), count(*) filter (where bloco = '05'))
           from operacoes.agua_leituras where vigente and referencia = '2026-08-01'`,
        ),
      );
    expect(await vigentes()).toBe("25|1");
    expect(
      await valor<string>(
        "select status from operacoes.importacoes where tipo = 'agua' and exemplo and referencia = '2026-08-01'",
      ),
    ).toBe("substituida");
    await como(U.importa, () =>
      db.query(`select operacoes.desfazer_importacao('${nova}')`),
    );
    expect(await vigentes()).toBe("29|5");
  });

  it("acha o arquivo já importado pelo sha256 (jsonb @>)", async () => {
    const r = await como(U.importa, () =>
      valor<number>(
        `select count(*)::int from operacoes.importacoes
         where tipo = 'agua' and arquivos @> '[{"sha256": "abc123"}]'`,
      ),
    );
    expect(r).toBe(1);
  });
});

describe("vínculo do hidrômetro", () => {
  it("só quem tem operacoes.agua.vinculo corrige, com motivo", async () => {
    const inserir = (u: string, motivo = "trocado de sala na reforma") =>
      como(u, () =>
        erro(
          `insert into operacoes.agua_vinculos (hidrometro, desde, bloco, sala, motivo, criado_por)
           values ('EXA000001', '2026-08-01', '01', '102', '${motivo}', '${u}')`,
        ),
      );
    expect(await inserir(U.ve)).toMatch(/row-level security/);
    expect(await inserir(U.vinculo, "x")).toMatch(/check/);
    expect(await inserir(U.vinculo)).toBeNull();
    expect(await inserir(U.vinculo)).toMatch(/unique|duplicate/);
    expect(
      await como(U.ve, () =>
        valor<number>("select count(*)::int from operacoes.agua_vinculos"),
      ),
    ).toBe(1);
  });
});

describe("remover os exemplos", () => {
  it("apaga as importações e as leituras de exemplo", async () => {
    await como(U.parametros, () =>
      db.query("select operacoes.remover_exemplos()"),
    );
    expect(
      await valor<number>(
        "select count(*)::int from operacoes.agua_leituras where exemplo",
      ),
    ).toBe(0);
    expect(
      await valor<number>(
        "select count(*)::int from operacoes.importacoes where tipo = 'agua' and exemplo",
      ),
    ).toBe(0);
  });
});
