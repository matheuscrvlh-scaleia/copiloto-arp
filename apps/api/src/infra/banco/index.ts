import { Kysely, PostgresDialect, sql, type Transaction } from "kysely";
import pg from "pg";
import { env } from "@/config/env";
import { erroDoBanco } from "./erros";
import type { DB } from "./tipos";

// Acesso ao banco. A API conecta como `arp_api`, que sozinho não lê nada
// (NOINHERIT): toda consulta roda dentro de um dos três escopos abaixo. Cada
// escopo é UMA transação que assume o papel e informa quem é o usuário só
// até o fim dela (`set local`): nada vaza para a próxima requisição que
// pegar a mesma conexão do pool.

/** A transação do escopo: é com ela que o repository consulta. */
export type Tx = Transaction<DB>;

type Papel = "authenticated" | "service_role" | "anon";

// Os valores saem do banco como o PostgREST entregava, para as regras de
// @arp/shared (que já recebiam assim) continuarem valendo:
//   date                  → "2026-11-16"
//   timestamp/timestamptz → ISO 8601 em UTC ("2026-11-16T12:00:00.000Z")
//   numeric e bigint      → number
const data = (v: string) => v;
const lerInstante = pg.types.getTypeParser(pg.types.builtins.TIMESTAMPTZ);
// "infinity" não é data: segue como texto.
function instante(v: string): string {
  const d: unknown = lerInstante(v);
  return d instanceof Date ? d.toISOString() : v;
}
const instanteSemFuso = (v: string) => instante(`${v}+00`);
// Listas: o driver separa os itens (como text[]) e cada um é convertido.
const TEXT_ARRAY: number = 1009;
const lerLista = pg.types.getTypeParser(TEXT_ARRAY);
const lista =
  <T>(item: (v: string) => T) =>
  (v: string): unknown => {
    const itens: unknown = lerLista(v);
    return Array.isArray(itens)
      ? itens.map((i: unknown) => (typeof i === "string" ? item(i) : i))
      : itens;
  };

const CONVERSORES = new Map<number, (v: string) => unknown>([
  [pg.types.builtins.DATE, data],
  [pg.types.builtins.TIMESTAMPTZ, instante],
  [pg.types.builtins.TIMESTAMP, instanteSemFuso],
  [pg.types.builtins.NUMERIC, Number],
  [pg.types.builtins.INT8, Number],
  [1182, lista(data)], // date[]
  [1185, lista(instante)], // timestamptz[]
  [1115, lista(instanteSemFuso)], // timestamp[]
  [1231, lista(Number)], // numeric[]
  [1016, lista(Number)], // bigint[]
]);

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: env.BANCO_CONEXOES,
  application_name: "arp-api",
  // Mesmo fuso do banco anterior: `current_date` e `now()::date` em UTC.
  options: "-c timezone=UTC",
  // Transação parada (ex.: esperando um sistema externo) é encerrada: nunca
  // chamar HTTP externo dentro de um escopo.
  idle_in_transaction_session_timeout: 60_000,
  types: {
    getTypeParser: (oid: number, formato?: "text" | "binary") =>
      (formato !== "binary" ? CONVERSORES.get(oid) : undefined) ??
      pg.types.getTypeParser(oid, formato),
  },
});
// Conexão ociosa que cai (banco reiniciou) não derruba o processo.
pool.on("error", () => {});

const db = new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });

async function escopo<T>(
  papel: Papel,
  claims: Record<string, string>,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  try {
    return await db.transaction().execute(async (tx) => {
      // set_config(..., true) é o `set local`: vale até o fim da transação.
      await sql`select set_config('role', ${papel}, true), set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`.execute(
        tx,
      );
      return fn(tx);
    });
  } catch (e) {
    throw erroDoBanco(e) ?? e;
  }
}

/**
 * Chave da trava: (1, hash do nome). `hashtext` devolve int4; o par de
 * inteiros não colide com travas de um argumento só (bigint).
 */
const travar = "select pg_try_advisory_lock(1, hashtext($1)) as ok";
const destravar = "select pg_advisory_unlock(1, hashtext($1))";

export const banco = {
  /** Em nome de quem está logado: papel `authenticated`, o RLS vale. */
  comoUsuario<T>(usuarioId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return escopo(
      "authenticated",
      { sub: usuarioId, role: "authenticated" },
      fn,
    );
  },

  /**
   * Papel `service_role`: IGNORA o RLS. Só para rotinas, login, link público
   * e gravações que o RLS não cobre, sempre depois de `exigir(ctx, ...)`.
   */
  comoServico<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return escopo("service_role", { role: "service_role" }, fn);
  },

  /** Papel `anon`: só o que o banco libera para visitante. */
  comoAnonimo<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return escopo("anon", { role: "anon" }, fn);
  },

  /**
   * Roda `fn` só se ninguém mais estiver rodando a mesma `chave` (trava de
   * sessão no Postgres, vale entre processos). false: já havia outra.
   */
  async comTrava(chave: string, fn: () => Promise<void>): Promise<boolean> {
    const conexao = await pool.connect();
    let quebrada = false;
    try {
      const r = await conexao.query<{ ok: boolean }>(travar, [chave]);
      if (r.rows[0]?.ok !== true) return false;
      try {
        await fn();
      } finally {
        // Se a conexão caiu, a trava já foi solta; descarta a conexão.
        await conexao.query(destravar, [chave]).catch(() => {
          quebrada = true;
        });
      }
      return true;
    } finally {
      conexao.release(quebrada);
    }
  },

  /** O banco responde? (saúde do contêiner) */
  async responde(): Promise<boolean> {
    try {
      await sql`select 1`.execute(db);
      return true;
    } catch {
      return false;
    }
  },

  encerrar(): Promise<void> {
    return db.destroy();
  },
};
