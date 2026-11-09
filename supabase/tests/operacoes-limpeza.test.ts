// Rateio da limpeza (20261109160400_operacoes_limpeza e o exemplo
// 20261109160450): limpeza_salvar grava o mês e os filhos de uma vez, com o
// RLS de quem chama (mês fechado não muda); limpeza_gravar_previa grava os
// meses da planilha numa prévia de importação (fechados, ou abertos e
// "incompletos"), que confirmar/desfazer do contrato fecham; e os meses de
// exemplo dão a conta da spec.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { calcularRateio, centavos } from "@/lib/operacoes/limpeza";

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
  limpeza: "00000000-0000-0000-0000-0000000000e1",
  outro: "00000000-0000-0000-0000-0000000000e2",
  ver: "00000000-0000-0000-0000-0000000000e3",
  fora: "00000000-0000-0000-0000-0000000000e4",
  parametros: "00000000-0000-0000-0000-0000000000e5",
};

const PERMISSOES: Record<keyof typeof U, string[]> = {
  limpeza: ["operacoes.limpeza.ver", "operacoes.limpeza.fechar"],
  outro: ["operacoes.limpeza.fechar"],
  ver: ["operacoes.limpeza.ver"],
  fora: ["operacoes.agua.ver"],
  parametros: ["operacoes.parametros"],
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

const json = (v: unknown) =>
  `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;

const MES = {
  valor_base: 35323.94,
  base_composicao: "38.509,83 − 8.072,68 + 1.736,79 + 630,00 + 2.520,00",
  func_base: 9,
  func_area_comum: 5,
  func_rateados: 4,
  regra_bl04: "separado",
  extras: [
    { descricao: "Insalubridade espaço pet", valor: 278.68 },
    {
      descricao: "Vigia extra fins de semana",
      quantidade: 8,
      valor_unitario: 315,
      valor: 2520,
    },
  ],
  minutos: [
    { bloco: "01", limpeza: 131, manutencao: 73 },
    { bloco: "02", limpeza: 67, manutencao: 74 },
  ],
  contrato: [
    {
      descricao: "Limpeza com 13 auxiliares",
      valor: 53688.61,
      entra_conferencia: true,
    },
  ],
  equipe: [
    {
      nome: "Colaborador A",
      funcao: "Auxiliar",
      grupo: "blocos",
      blocos: ["01", "02"],
      turno: "Segunda a sexta",
      minutos_dia: 345,
    },
  ],
};

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

describe("meses de exemplo", () => {
  it("julho e agosto fechados e enviados; outubro aberto", async () => {
    const { rows } = await db.query<{ ref: string; s: string }>(
      `select to_char(referencia, 'YYYY-MM') as ref,
              status || '/' || (enviado_em is not null) || '/' || exemplo as s
       from operacoes.limpeza_meses order by referencia`,
    );
    expect(rows).toEqual([
      { ref: "2026-07", s: "fechado/true/true" },
      { ref: "2026-08", s: "fechado/true/true" },
      { ref: "2026-10", s: "aberto/false/true" },
    ]);
  });

  it("outubro dá a conta de setembro da spec e bate com o contrato", async () => {
    const ref = "2026-10-01";
    const mes = (
      await db.query<{
        valor_base: string;
        func_base: number;
        func_area_comum: number;
        func_rateados: number;
      }>(`select * from operacoes.limpeza_meses where referencia = '${ref}'`)
    ).rows[0];
    const extras = (
      await db.query<{
        descricao: string;
        quantidade: string | null;
        valor_unitario: string | null;
        valor: string;
      }>(
        `select * from operacoes.limpeza_extras where referencia = '${ref}' order by ordem`,
      )
    ).rows;
    const minutos = (
      await db.query<{ bloco: string; limpeza: number; manutencao: number }>(
        `select * from operacoes.limpeza_minutos where referencia = '${ref}' order by bloco`,
      )
    ).rows;
    const contrato = (
      await db.query<{
        descricao: string;
        valor: string;
        entra_conferencia: boolean;
      }>(
        `select * from operacoes.limpeza_contrato where referencia = '${ref}' order by ordem`,
      )
    ).rows;
    const r = calcularRateio({
      valorBase: centavos(mes?.valor_base),
      funcBase: mes?.func_base ?? null,
      funcAreaComum: mes?.func_area_comum ?? null,
      funcRateados: mes?.func_rateados ?? null,
      extras: extras.map((x) => ({
        descricao: x.descricao,
        quantidade: x.quantidade === null ? null : Number(x.quantidade),
        valorUnitario:
          x.valor_unitario === null ? null : centavos(x.valor_unitario),
        valor: centavos(x.valor),
      })),
      blocos: minutos.map((m) => m.bloco),
      minutos,
      contrato: contrato.map((c) => ({
        descricao: c.descricao,
        valor: centavos(c.valor),
        entraConferencia: c.entra_conferencia,
      })),
      regraBl04: "separado",
    });
    expect(r.areaComum).toBe(4208408);
    expect(r.blocos.map((b) => b.valor)).toEqual([
      151142, 104466, 280799, 386005, 197078, 217082, 233381,
    ]);
    expect(r.total).toBe(5778361);
    expect(r.conferencia.situacao).toBe("bate");
    expect(
      await valor<number>(
        `select sum(minutos_dia)::int from operacoes.limpeza_equipe where referencia = '${ref}' and grupo = 'blocos'`,
      ),
    ).toBe(2119);
  });
});

describe("limpeza_salvar", () => {
  it("cria o mês e troca os filhos de uma vez", async () => {
    await como(U.limpeza, () =>
      db.query(`select operacoes.limpeza_salvar('2026-11-01', ${json(MES)})`),
    );
    expect(
      await valor<string>(
        "select valor_base::text || '/' || criado_por from operacoes.limpeza_meses where referencia = '2026-11-01'",
      ),
    ).toBe(`35323.94/${U.limpeza}`);
    expect(
      await valor<string>(
        "select string_agg(descricao || ':' || coalesce(quantidade::text, '-') || ':' || valor, '|' order by ordem) from operacoes.limpeza_extras where referencia = '2026-11-01'",
      ),
    ).toBe(
      "Insalubridade espaço pet:-:278.68|Vigia extra fins de semana:8.00:2520.00",
    );
    expect(
      await valor<string>(
        "select blocos::text || minutos_dia from operacoes.limpeza_equipe where referencia = '2026-11-01'",
      ),
    ).toBe("{01,02}345");

    // Salvar de novo substitui (nada fica duplicado).
    await como(U.limpeza, () =>
      db.query(
        `select operacoes.limpeza_salvar('2026-11-01', ${json({ ...MES, extras: [], valor_base: 30000 })})`,
      ),
    );
    expect(
      await valor<number>(
        "select count(*)::int from operacoes.limpeza_extras where referencia = '2026-11-01'",
      ),
    ).toBe(0);
    expect(
      await valor<number>(
        "select count(*)::int from operacoes.limpeza_minutos where referencia = '2026-11-01'",
      ),
    ).toBe(2);
  });

  it("dado inválido desfaz tudo (transação)", async () => {
    const e = await como(U.limpeza, () =>
      erro(
        `select operacoes.limpeza_salvar('2026-11-01', ${json({
          ...MES,
          valor_base: 1,
          minutos: [{ bloco: "1", limpeza: 1, manutencao: 0 }],
        })})`,
      ),
    );
    expect(e).toMatch(/check/);
    expect(
      await valor<string>(
        "select valor_base::text from operacoes.limpeza_meses where referencia = '2026-11-01'",
      ),
    ).toBe("30000.00");
  });

  it("mês fechado não muda; sem a permissão, nada", async () => {
    await como(U.limpeza, () =>
      db.query("select operacoes.limpeza_fechar('2026-11-01')"),
    );
    expect(
      await como(U.limpeza, () =>
        erro(`select operacoes.limpeza_salvar('2026-11-01', ${json(MES)})`),
      ),
    ).toMatch(/fechado/);
    expect(
      await como(U.ver, () =>
        erro(`select operacoes.limpeza_salvar('2026-12-01', ${json(MES)})`),
      ),
    ).toMatch(/sem permissão/);
    expect(
      await como(U.fora, () =>
        erro(`select operacoes.limpeza_salvar('2026-12-01', ${json(MES)})`),
      ),
    ).toMatch(/sem permissão/);
    expect(
      await como(U.limpeza, () =>
        erro(`select operacoes.limpeza_salvar('2026-12-15', ${json(MES)})`),
      ),
    ).toMatch(/inválido|check/);
  });

  it("quem só vê lê o mês, os extras e os minutos", async () => {
    expect(
      await como(U.ver, () =>
        valor<number>(
          "select count(*)::int from operacoes.limpeza_minutos where referencia = '2026-11-01'",
        ),
      ),
    ).toBe(2);
    expect(
      await como(U.fora, () =>
        valor<number>("select count(*)::int from operacoes.limpeza_extras"),
      ),
    ).toBe(0);
  });
});

describe("importação do histórico", () => {
  const previa = (usuario: string) =>
    como(usuario, () =>
      valor<string>(
        `insert into operacoes.importacoes (tipo, referencia, resumo, bate, criado_por)
         values ('limpeza', 'Histórico do rateio', '{}', true, '${usuario}') returning id`,
      ),
    );

  const meses = [
    {
      referencia: "2025-11-01",
      apontamento: "APONTAMENTO 11.2025",
      valor_base: 35323.94,
      func_base: 9,
      func_area_comum: 5,
      func_rateados: 4,
      regra_bl04: "area_comum",
      incompleto: false,
      valores_planilha: { area_comum: 44892.07, total: 51190.62 },
      extras: [{ descricao: "Insalub. Espaço Pet", valor: 278.68 }],
      minutos: [{ bloco: "01", limpeza: 131, manutencao: 73 }],
    },
    {
      referencia: "2026-06-01",
      apontamento: null,
      valor_base: 35323.94,
      func_base: 9,
      func_area_comum: 5,
      func_rateados: 4,
      regra_bl04: "separado",
      incompleto: true,
      valores_planilha: { total: null, erros: ["F12: #DIV/0!"] },
      extras: [],
      minutos: [{ bloco: "01", limpeza: 0, manutencao: 0 }],
    },
  ];

  it("grava a prévia: mês completo fechado, incompleto aberto; confirma e desfaz", async () => {
    const id = await previa(U.limpeza);
    expect(
      await como(U.limpeza, () =>
        valor<number>(
          `select operacoes.limpeza_gravar_previa('${id}', ${json(meses)})`,
        ),
      ),
    ).toBe(2);
    const { rows } = await db.query<{ s: string }>(
      `select to_char(referencia, 'YYYY-MM') || ' ' || status || ' ' || incompleto || ' ' || origem
         || ' ' || regra_bl04 || ' ' || (fechado_por is not null) as s
       from operacoes.limpeza_meses where importacao_id = '${id}' order by referencia`,
    );
    expect(rows.map((r) => r.s)).toEqual([
      "2025-11 fechado false importacao area_comum true",
      "2026-06 aberto true importacao separado false",
    ]);
    expect(
      await valor<string>(
        "select valores_planilha ->> 'total' from operacoes.limpeza_meses where referencia = '2025-11-01'",
      ),
    ).toBe("51190.62");

    // O mês incompleto recebe os minutos pela tela e fecha.
    await como(U.limpeza, async () => {
      await db.query(
        "update operacoes.limpeza_minutos set limpeza = 100 where referencia = '2026-06-01'",
      );
      await db.query(`select operacoes.confirmar_importacao('${id}')`);
      await db.query("select operacoes.limpeza_fechar('2026-06-01')");
    });
    expect(
      await valor<string>(
        "select status || ' ' || incompleto from operacoes.limpeza_meses where referencia = '2026-06-01'",
      ),
    ).toBe("fechado false");
    // Mês importado não sai pela tela, só desfazendo a importação.
    await como(U.limpeza, async () => {
      await db.query(
        "select operacoes.limpeza_reabrir('2026-06-01', 'Conferir os minutos')",
      );
      await db.query(
        "delete from operacoes.limpeza_meses where referencia = '2026-06-01'",
      );
    });
    expect(
      await valor<number>(
        "select count(*)::int from operacoes.limpeza_meses where referencia = '2026-06-01'",
      ),
    ).toBe(1);
    await como(U.limpeza, () =>
      db.query(`select operacoes.desfazer_importacao('${id}')`),
    );
    expect(
      await valor<number>(
        `select count(*)::int from operacoes.limpeza_meses where importacao_id = '${id}'`,
      ),
    ).toBe(0);
    expect(
      await valor<number>(
        "select count(*)::int from operacoes.limpeza_extras where referencia = '2025-11-01'",
      ),
    ).toBe(0);
  });

  it("recusa mês que já existe, prévia de outra pessoa e quem não pode importar", async () => {
    const id = await previa(U.limpeza);
    expect(
      await como(U.limpeza, () =>
        erro(
          `select operacoes.limpeza_gravar_previa('${id}', ${json([{ ...meses[0], referencia: "2026-07-01" }])})`,
        ),
      ),
    ).toMatch(/já existe/);
    expect(
      await como(U.outro, () =>
        erro(`select operacoes.limpeza_gravar_previa('${id}', ${json(meses)})`),
      ),
    ).toMatch(/não encontrada/);
    expect(
      await como(U.ver, () =>
        erro(`select operacoes.limpeza_gravar_previa('${id}', ${json(meses)})`),
      ),
    ).toMatch(/sem permissão/);
    expect(
      await como(U.fora, () =>
        erro(`select operacoes.limpeza_gravar_previa('${id}', ${json(meses)})`),
      ),
    ).toMatch(/sem permissão|permission denied/);
    expect(
      await valor<number>(
        `select count(*)::int from operacoes.limpeza_meses where importacao_id = '${id}'`,
      ),
    ).toBe(0);
  });
});

describe("remover exemplos", () => {
  it("apaga os meses de exemplo e o que é deles", async () => {
    await como(U.parametros, () =>
      db.query("select operacoes.remover_exemplos()"),
    );
    expect(
      await valor<number>(
        "select count(*)::int from operacoes.limpeza_meses where exemplo",
      ),
    ).toBe(0);
    expect(
      await valor<number>(
        "select count(*)::int from operacoes.limpeza_equipe where referencia in ('2026-07-01', '2026-08-01', '2026-10-01')",
      ),
    ).toBe(0);
    expect(
      await valor<number>(
        "select count(*)::int from operacoes.limpeza_meses where referencia = '2026-11-01'",
      ),
    ).toBe(1);
  });
});
