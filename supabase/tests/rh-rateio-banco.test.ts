// Benefício rateado (20261112150000_rh_beneficio_rateado) e fechamento do
// ciclo do banco de horas (20261112150100_rh_banco_horas_ciclos): regras do
// cadastro, quem vê e quem mexe, o ciclo finalizado só leitura e o próximo
// ciclo aberto nos Parâmetros.
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
  gestora: "00000000-0000-0000-0000-0000000000d1",
  custo: "00000000-0000-0000-0000-0000000000d2",
  beneficios: "00000000-0000-0000-0000-0000000000d3",
  painel: "00000000-0000-0000-0000-0000000000d4",
};

const PERMISSOES: Record<keyof typeof U, string[]> = {
  gestora: ["rh.parametros", "rh.custo_pessoal", "rh.custo_pessoal.individual"],
  custo: ["rh.custo_pessoal"],
  beneficios: ["rh.beneficios"],
  painel: ["rh.painel"],
};

const DEP = "10000000-0000-0000-0000-0000000000d1";
const ANA = "20000000-0000-0000-0000-0000000000d1";
const BIA = "20000000-0000-0000-0000-0000000000d2";

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
  for (const f of readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort())
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
  await db.exec(`
    insert into rh.departamentos (id, nome, codigo_folha) values ('${DEP}', 'Manutenção', 91);
    insert into rh.colaboradores
      (id, copiloto_id, matricula, nome, admissao, tipo_contrato, departamento_id, fora_do_ponto)
    values
      ('${ANA}', gen_random_uuid(), 1, 'Ana', '2020-01-01', 'clt', '${DEP}', false),
      ('${BIA}', gen_random_uuid(), 2, 'Bia', '2021-01-01', 'clt', '${DEP}', false);
    insert into rh.parametros_empresa
      (vigente_desde, rat_pct, fap, banco_horas_inicio, banco_horas_fim, banco_horas_adicional_pct)
    values ('2026-06-01', 3, 0.5, '2025-12-24', '2026-06-23', 80);
  `);
}, 180_000);

describe("benefício rateado", () => {
  const novo = (campos: string, valores: string) =>
    `insert into rh.beneficios (nome, tipo, ${campos}) values ('Massoterapia', 'outro', ${valores})`;

  it("por funcionário continua o padrão, sem divisão", async () => {
    expect(
      await valor<string>(
        `${novo("valor_padrao", "50")} returning forma_calculo`,
      ),
    ).toBe("por_funcionario");
    expect(
      await erro(novo("valor_padrao, dividir_entre", "50, 'ativos'")),
    ).toMatch(/beneficio_rateio/);
  });

  it("rateado pede quem entra na divisão e, no departamento, qual", async () => {
    expect(
      await erro(novo("valor_padrao, forma_calculo", "1200, 'rateado'")),
    ).toMatch(/beneficio_rateio/);
    expect(
      await erro(
        novo(
          "valor_padrao, forma_calculo, dividir_entre",
          "1200, 'rateado', 'departamento'",
        ),
      ),
    ).toMatch(/beneficio_rateio/);
    expect(
      await erro(
        novo(
          "valor_padrao, forma_calculo, dividir_entre, dividir_departamento_id",
          `1200, 'rateado', 'ativos', '${DEP}'`,
        ),
      ),
    ).toMatch(/beneficio_rateio/);
    expect(
      await erro(
        novo(
          "valor_padrao, forma_calculo, dividir_entre, dividir_departamento_id",
          `1200, 'rateado', 'departamento', '${DEP}'`,
        ),
      ),
    ).toBeNull();
  });

  it("rateado precisa do valor total ou do valor lançado por mês", async () => {
    expect(
      await erro(novo("forma_calculo, dividir_entre", "'rateado', 'ativos'")),
    ).toMatch(/beneficio_rateado_com_valor/);
    expect(
      await erro(
        novo(
          "forma_calculo, dividir_entre, valor_por_mes",
          "'rateado', 'ativos_nao_afastados', true",
        ),
      ),
    ).toBeNull();
  });

  it("total do mês: lança quem cadastra benefícios; vê quem é do RH", async () => {
    const id = await valor<string>(
      "select id from rh.beneficios where valor_por_mes and forma_calculo = 'rateado'",
    );
    const lancar = `insert into rh.beneficio_totais_mensais (beneficio_id, competencia, valor) values ('${id}', '2026-07-01', 1200)`;
    expect(await como(U.painel, () => erro(lancar))).toMatch(
      /row-level security/,
    );
    expect(await como(U.beneficios, () => erro(lancar))).toBeNull();
    expect(
      await como(U.painel, () =>
        valor<number>("select count(*)::int from rh.beneficio_totais_mensais"),
      ),
    ).toBe(1);
    expect(
      await como(U.beneficios, () =>
        erro(
          `insert into rh.beneficio_totais_mensais (beneficio_id, competencia, valor) values ('${id}', '2026-07-01', 900)`,
        ),
      ),
    ).toMatch(/unique|duplicate/);
  });
});

describe("fechamento do ciclo do banco de horas", () => {
  let ciclo: string;

  it("só abre a partir da data de fim e só com parâmetros + custo individual", async () => {
    expect(
      await como(U.gestora, () =>
        erro(
          "insert into rh.banco_horas_ciclos (inicio, fim) values (current_date - 10, current_date + 1)",
        ),
      ),
    ).toMatch(/só pode ser fechado a partir de/);
    expect(
      await como(U.custo, () =>
        erro(
          "insert into rh.banco_horas_ciclos (inicio, fim) values ('2025-12-24', '2026-06-23')",
        ),
      ),
    ).toMatch(/row-level security/);
    ciclo = await como(U.gestora, () =>
      valor<string>(
        "insert into rh.banco_horas_ciclos (inicio, fim) values ('2025-12-24', '2026-06-23') returning id",
      ),
    );
    await como(U.gestora, () =>
      db.query(`
        insert into rh.banco_horas_fechamentos
          (ciclo_id, colaborador_id, saldo_min, salario_hora, valor_calculado, acao, valor_realizado)
        values
          ('${ciclo}', '${ANA}', 600, 20, 360, 'pago', null),
          ('${ciclo}', '${BIA}', -120, 15, -30, null, null)`),
    );
  });

  it("a lista por pessoa só com o custo individual; os totais com o custo", async () => {
    expect(
      await como(U.custo, () =>
        valor<number>("select count(*)::int from rh.banco_horas_fechamentos"),
      ),
    ).toBe(0);
    expect(
      await como(U.custo, () =>
        valor<number>("select count(*)::int from rh.banco_horas_ciclos"),
      ),
    ).toBe(1);
    expect(
      await como(U.painel, () =>
        valor<number>("select count(*)::int from rh.banco_horas_ciclos"),
      ),
    ).toBe(0);
  });

  it("não finaliza com saldo sem ação; finaliza e guarda os totais", async () => {
    expect(
      await como(U.custo, () =>
        erro(`select rh.finalizar_ciclo_banco('${ciclo}')`),
      ),
    ).toMatch(/sem permissão/);
    expect(
      await como(U.gestora, () =>
        erro(`select rh.finalizar_ciclo_banco('${ciclo}')`),
      ),
    ).toMatch(/escolha a ação de 1 pessoa/);
    await como(U.gestora, async () => {
      await db.query(
        `update rh.banco_horas_fechamentos set acao = 'descontado', valor_realizado = -28.5 where colaborador_id = '${BIA}'`,
      );
      await db.query(
        `update rh.banco_horas_fechamentos set valor_realizado = 350 where colaborador_id = '${ANA}'`,
      );
      await db.query(`select rh.finalizar_ciclo_banco('${ciclo}')`);
    });
    const { rows } = await db.query<Record<string, unknown>>(
      `select total_saldo_min, total_calculado::text, total_realizado::text,
              finalizado_por::text, finalizado_em is not null as finalizado
       from rh.banco_horas_ciclos where id = '${ciclo}'`,
    );
    expect(rows[0]).toEqual({
      total_saldo_min: 480,
      total_calculado: "330.00",
      total_realizado: "321.50",
      finalizado_por: U.gestora,
      finalizado: true,
    });
  });

  it("finalizado fica só leitura", async () => {
    await como(U.gestora, async () => {
      expect(
        await erro(
          `update rh.banco_horas_fechamentos set valor_realizado = 1 where ciclo_id = '${ciclo}'`,
        ),
      ).toMatch(/só leitura/);
      expect(
        await erro(`delete from rh.banco_horas_ciclos where id = '${ciclo}'`),
      ).toMatch(/já foi finalizado/);
      expect(await erro(`select rh.finalizar_ciclo_banco('${ciclo}')`)).toMatch(
        /já foi finalizado/,
      );
    });
  });

  it("abre o próximo ciclo nos Parâmetros, com os mesmos meses", async () => {
    const { rows } = await db.query<Record<string, string>>(
      `select banco_horas_inicio::text as inicio, banco_horas_fim::text as fim,
              banco_horas_adicional_pct::text as adicional
       from rh.parametros_empresa order by vigente_desde desc limit 1`,
    );
    expect(rows[0]).toEqual({
      inicio: "2026-06-24",
      fim: "2026-12-23",
      adicional: "80.000",
    });
    const prox = async (i: string, f: string) =>
      (
        await db.query<{ inicio: string; fim: string }>(
          `select inicio::text, fim::text from rh.proximo_ciclo_banco('${i}', '${f}')`,
        )
      ).rows[0];
    expect(await prox("2026-06-24", "2026-12-23")).toEqual({
      inicio: "2026-12-24",
      fim: "2027-06-23",
    });
    expect(await prox("2026-01-01", "2026-12-31")).toEqual({
      inicio: "2027-01-01",
      fim: "2027-12-31",
    });
    expect(await prox("2026-11-01", "2026-11-15")).toEqual({
      inicio: "2026-11-16",
      fim: "2026-11-30",
    });
  });
});
