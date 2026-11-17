// Fundação do banco próprio (0000_fundacao, 0003_sessoes e o papel da API):
// o `arp_api` sozinho não lê nada, as credenciais e as sessões só a service
// role alcança, o visitante (anon) não lê nem grava tabela nenhuma e toda
// tabela tem RLS ligado.
import { beforeAll, describe, expect, it } from "vitest";
import { abrirBanco, type BancoDeTeste } from "../apoio";

const USUARIO = "00000000-0000-0000-0000-00000000f001";

let db: BancoDeTeste;
/** Tabelas e views de todos os schemas do sistema (fora os do Postgres). */
let relacoes: string[] = [];

async function erro(sql: string): Promise<string | null> {
  try {
    await db.query(sql);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

beforeAll(async () => {
  db = await abrirBanco();
  await db.criarUsuario(USUARIO, "fundacao@arp.test", ["admin.usuarios"]);
  await db.query(
    "insert into auth.sessoes (usuario_id, token_hash, expira_em) values ($1, 'x', now() + interval '1 hour')",
    [USUARIO],
  );
  const { rows } = await db.query<{ t: string }>(
    `select format('%I.%I', n.nspname, c.relname) as t
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind in ('r', 'p', 'v', 'm')
        and n.nspname not like 'pg\\_%' and n.nspname <> 'information_schema'
      order by 1`,
  );
  relacoes = rows.map((r) => r.t);
}, 120_000);

describe("papéis", () => {
  it("o catálogo tem as tabelas do sistema (o teste não roda no vazio)", () => {
    expect(relacoes.length).toBeGreaterThan(200);
    expect(relacoes).toContain("auth.users");
    expect(relacoes).toContain("core.usuarios");
  });

  it("arp_api é LOGIN NOINHERIT e membro dos três papéis", async () => {
    const { rows } = await db.query<{
      rolcanlogin: boolean;
      rolinherit: boolean;
      rolbypassrls: boolean;
      membro_de: string[];
    }>(
      `select r.rolcanlogin, r.rolinherit, r.rolbypassrls,
              array(select g.rolname::text from pg_auth_members m
                    join pg_roles g on g.oid = m.roleid
                    where m.member = r.oid order by 1) as membro_de
         from pg_roles r where r.rolname = 'arp_api'`,
    );
    expect(rows).toEqual([
      {
        rolcanlogin: true,
        rolinherit: false,
        rolbypassrls: false,
        membro_de: ["anon", "authenticated", "service_role"],
      },
    ]);
  });

  it("arp_api sem `set role` não lê nenhuma tabela", async () => {
    const leu: string[] = [];
    await db.exec("set role arp_api");
    try {
      for (const t of relacoes)
        if ((await erro(`select 1 from ${t} limit 1`)) === null) leu.push(t);
    } finally {
      await db.exec("reset role");
    }
    expect(leu).toEqual([]);
  });
});

describe("auth.users e auth.sessoes: só a service role", () => {
  const comandos = (t: string) => [
    `select 1 from ${t}`,
    `insert into ${t} (id) values (gen_random_uuid())`,
    `update ${t} set id = id`,
    `delete from ${t}`,
  ];

  it.each([
    "auth.users",
    "auth.sessoes",
  ])("%s: authenticated e anon sem grant nenhum", async (t) => {
    for (const sql of comandos(t)) {
      expect(await db.comoUsuario(USUARIO, () => erro(sql)), sql).toMatch(
        /permission denied/,
      );
      expect(await db.comoAnonimo(() => erro(sql)), sql).toMatch(
        /permission denied/,
      );
    }
  });

  it("a service role lê as duas", async () => {
    const n = (t: string) =>
      db.comoServico(async () => {
        const { rows } = await db.query<{ n: number }>(
          `select count(*)::int as n from ${t}`,
        );
        return rows[0]?.n;
      });
    expect(await n("auth.users")).toBe(1);
    expect(await n("auth.sessoes")).toBe(1);
  });
});

describe("visitante (anon)", () => {
  // Os links públicos (formulário, ficha do Comercial, censo, terceirizado,
  // parceiro do Sustentabilidade) não passam pelo anon: a API confere o
  // token e grava como service role. Por isso não há exceção aqui.
  it("não tem grant em tabela nenhuma", async () => {
    const { rows } = await db.query<{ t: string }>(
      `select format('%I.%I', n.nspname, c.relname) as t
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where c.relkind in ('r', 'p', 'v', 'm')
          and n.nspname not like 'pg\\_%' and n.nspname <> 'information_schema'
          and has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
        order by 1`,
    );
    expect(rows.map((r) => r.t)).toEqual([]);
  });

  it("não lê nenhuma tabela, com ou sem dados", async () => {
    const leu: string[] = [];
    for (const t of relacoes)
      if (
        (await db.comoAnonimo(() => erro(`select 1 from ${t} limit 1`))) ===
        null
      )
        leu.push(t);
    expect(leu).toEqual([]);
  });

  it("só alcança os schemas da fundação (sem tabela aberta)", async () => {
    const { rows } = await db.query<{ s: string }>(
      `select nspname as s from pg_namespace
        where nspname not like 'pg\\_%' and nspname <> 'information_schema'
          and has_schema_privilege('anon', oid, 'USAGE')
        order by 1`,
    );
    expect(rows.map((r) => r.s)).toEqual(["auth", "extensions", "public"]);
  });
});

describe("RLS", () => {
  it("toda tabela dos schemas do sistema tem RLS ligado", async () => {
    const { rows } = await db.query<{ t: string }>(
      `select format('%I.%I', n.nspname, c.relname) as t
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where c.relkind in ('r', 'p')
          and n.nspname not like 'pg\\_%' and n.nspname <> 'information_schema'
          and not c.relrowsecurity
        order by 1`,
    );
    expect(rows.map((r) => r.t)).toEqual([]);
  });

  it("nenhuma política vale para anon ou public", async () => {
    const { rows } = await db.query<{ p: string }>(
      `select schemaname || '.' || tablename || ': ' || policyname as p
         from pg_policies
        where roles && array['anon', 'public']::name[]
        order by 1`,
    );
    expect(rows.map((r) => r.p)).toEqual([]);
  });
});
