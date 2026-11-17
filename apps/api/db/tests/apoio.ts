import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { PGlite, type Results } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";

// Banco descartável para os testes de RLS (db/tests/memoria): um Postgres em
// memória (PGlite) com as migrations de db/migrations aplicadas em ordem,
// mais os dados de referência que as migrations antigas (do Supabase)
// gravavam. Nada aqui fala com a homologação.
//
// - Extensões: pgcrypto e uuid-ossp vêm de @electric-sql/pglite/contrib e
//   são carregadas na criação; a 0000 as cria no schema `extensions`.
// - O PGlite aceita a 0001_base.sql (dump da produção) sem contorno: os
//   `SET` do começo e o `set_config('search_path', '', false)` valem para a
//   sessão inteira, então o apoio dá `reset all` depois de cada arquivo (a
//   produção roda cada migration numa conexão própria; ver migracoes.ts).
// - O dump da produção é só schema. O catálogo de permissões, os cargos
//   padrão, as listas, os parâmetros e os dados de exemplo que os cenários
//   usam estão em dados-de-referencia.json.gz: o conteúdo das tabelas depois
//   de rodar as 101 migrations antigas (supabase/migrations do repositório
//   anterior), tirados core.auditoria e storage.buckets. São dados fictícios
//   que já estavam nas migrations; as datas relativas ("últimos 90 dias")
//   ficaram congeladas em 16/11/2026. A carga roda com
//   session_replication_role = replica (sem gatilhos nem FK, como um
//   restore) e só nas colunas que existem nas duas versões.
// - Montar tudo leva alguns segundos; o resultado vai para um arquivo em
//   os.tmpdir() (chave: conteúdo das migrations, dos dados e deste arquivo)
//   e os outros arquivos de teste partem dele. Cada arquivo de teste ganha
//   uma instância própria; os casos de um arquivo dividem o mesmo banco
//   (como nos testes antigos, um caso pode depender do anterior).
// - Papéis: os três da 0000 e o `arp_api` (LOGIN NOINHERIT, membro dos
//   três), como `garantirPapelDaApi` faz na produção.

const MIGRATIONS = join(import.meta.dirname, "..", "migrations");
const DADOS = join(import.meta.dirname, "dados-de-referencia.json.gz");
const EXTENSOES = { pgcrypto, uuid_ossp };

/** Dia em que dados-de-referencia.json.gz foi gerado (datas relativas congeladas). */
export const DATA_DOS_DADOS = "2026-11-16";

type Papel = "authenticated" | "service_role" | "anon";

const CONTROLE = /^\s*(savepoint|release|rollback|begin|commit)\b/i;

/**
 * O banco de um arquivo de teste. Fora de um escopo, `query` e `exec` rodam
 * como o superusuário do PGlite (ignora o RLS: é a preparação do cenário).
 * Dentro de `comoUsuario`/`comoServico`/`comoAnonimo`, rodam no papel do
 * escopo, como `infra/banco` faz na produção: uma transação com
 * `set_config('role', ..., true)` e `request.jwt.claims`.
 */
export class BancoDeTeste {
  #dentro = false;
  #fila: Promise<unknown> = Promise.resolve();
  #n = 0;

  constructor(readonly pg: PGlite) {}

  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<Results<T>> {
    return this.#rodar(() => this.pg.query<T>(sql, params), sql);
  }

  exec(sql: string): Promise<Results[]> {
    return this.#rodar(() => this.pg.exec(sql), sql);
  }

  /** Em nome do usuário: papel `authenticated`, o RLS vale. */
  comoUsuario<T>(usuarioId: string, fn: () => Promise<T>): Promise<T> {
    return this.#escopo(
      "authenticated",
      { sub: usuarioId, role: "authenticated" },
      fn,
    );
  }

  /** Papel `service_role`: ignora o RLS (rotinas, link público). */
  comoServico<T>(fn: () => Promise<T>): Promise<T> {
    return this.#escopo("service_role", { role: "service_role" }, fn);
  }

  /** Papel `anon`: visitante. */
  comoAnonimo<T>(fn: () => Promise<T>): Promise<T> {
    return this.#escopo("anon", { role: "anon" }, fn);
  }

  /** auth.users (o gatilho cria core.usuarios) e as permissões diretas. */
  async criarUsuario(
    id: string,
    email: string,
    permissoes: readonly string[] = [],
  ): Promise<void> {
    await this.query(
      "insert into auth.users (id, email, encrypted_password) values ($1, $2, '')",
      [id, email],
    );
    for (const p of permissoes)
      await this.query(
        "insert into core.usuario_permissoes (usuario_id, permissao) values ($1, $2)",
        [id, p],
      );
  }

  async #escopo<T>(
    papel: Papel,
    claims: Record<string, string>,
    fn: () => Promise<T>,
  ): Promise<T> {
    if (this.#dentro) throw new Error("Escopo dentro de escopo.");
    // O caso já abriu uma transação (para desfazer tudo no fim): o escopo
    // vira um savepoint dela e, ao sair, devolve o papel e as claims de
    // antes; o begin/commit do escopo encerraria a transação do caso.
    const aninhado = this.pg.isInTransaction();
    let antes: { papel: string; claims: string } | undefined;
    if (aninhado) {
      const { rows } = await this.pg.query<{ papel: string; claims: string }>(
        "select current_setting('role') as papel, coalesce(current_setting('request.jwt.claims', true), '') as claims",
      );
      antes = rows[0];
      await this.pg.exec("savepoint escopo");
    } else await this.pg.exec("begin");
    await this.pg.query(
      "select set_config('role', $1, true), set_config('request.jwt.claims', $2, true)",
      [papel, JSON.stringify(claims)],
    );
    this.#dentro = true;
    let r: T;
    try {
      r = await fn();
      await this.#fila;
    } catch (e) {
      await this.#fila;
      this.#dentro = false;
      // Desfazer o savepoint também devolve o papel e as claims de antes.
      await this.pg.exec(
        aninhado
          ? "rollback to savepoint escopo; release savepoint escopo"
          : "rollback",
      );
      throw e;
    }
    this.#dentro = false;
    if (antes) {
      await this.pg.exec("release savepoint escopo");
      await this.pg.query(
        "select set_config('role', $1, true), set_config('request.jwt.claims', $2, true)",
        [antes.papel, antes.claims],
      );
    }
    // Commit que falha (restrição adiada) já desfaz a transação.
    else await this.pg.exec("commit");
    return r;
  }

  // Dentro de um escopo, cada comando roda num savepoint: o erro esperado
  // (RLS recusou) desfaz só aquele comando, e o resto do caso continua na
  // mesma transação, com o mesmo papel. A fila mantém os savepoints em ordem
  // mesmo com consultas em paralelo.
  // Comandos de transação do próprio caso (savepoint, rollback to...) passam
  // direto: embrulhados, o release do savepoint do apoio os desfaria.
  #rodar<R>(fn: () => Promise<R>, sql: string): Promise<R> {
    if (!this.#dentro || CONTROLE.test(sql)) return fn();
    const vez = this.#fila.then(async () => {
      const sp = `teste_${++this.#n}`;
      await this.pg.exec(`savepoint ${sp}`);
      try {
        const r = await fn();
        await this.pg.exec(`release savepoint ${sp}`);
        return r;
      } catch (e) {
        await this.pg.exec(
          `rollback to savepoint ${sp}; release savepoint ${sp}`,
        );
        throw e;
      }
    });
    this.#fila = vez.catch(() => {});
    return vez;
  }
}

function arquivosDasMigrations(): { nome: string; sql: string }[] {
  return readdirSync(MIGRATIONS)
    .filter((n) => n.endsWith(".sql"))
    .sort()
    .map((nome) => ({
      nome,
      sql: readFileSync(join(MIGRATIONS, nome), "utf8"),
    }));
}

async function carregarDados(pg: PGlite): Promise<void> {
  const dados = JSON.parse(
    gunzipSync(readFileSync(DADOS)).toString("utf8"),
  ) as Record<string, unknown[]>;
  await pg.exec("set session_replication_role = replica");
  for (const [tabela, linhas] of Object.entries(dados)) {
    const [schema, nome] = tabela.split(".");
    const colunas = new Set(
      Object.keys((linhas[0] ?? {}) as Record<string, unknown>),
    );
    // Só as colunas que existem nas duas versões e não são geradas.
    const { rows } = await pg.query<{
      coluna: string;
      sequencia: string | null;
    }>(
      `select a.attname as coluna,
              pg_get_serial_sequence(format('%I.%I', $1::text, $2::text), a.attname) as sequencia
         from pg_attribute a
         join pg_class c on c.oid = a.attrelid
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = $1 and c.relname = $2 and a.attnum > 0
          and not a.attisdropped and a.attgenerated = ''
        order by a.attnum`,
      [schema, nome],
    );
    if (!rows.length)
      throw new Error(`Tabela ${tabela} não existe no banco novo.`);
    const comuns = rows.filter((r) => colunas.has(r.coluna));
    const lista = comuns.map((r) => `"${r.coluna}"`).join(", ");
    await pg.query(
      `insert into ${tabela} (${lista}) overriding system value
         select ${lista} from json_populate_recordset(null::${tabela}, $1::json)`,
      [JSON.stringify(linhas)],
    );
    for (const r of comuns)
      if (r.sequencia)
        await pg.query(
          `select setval($1, greatest((select max("${r.coluna}") from ${tabela}), 1))`,
          [r.sequencia],
        );
  }
  await pg.exec("reset session_replication_role");
}

async function montar(): Promise<PGlite> {
  const pg = await PGlite.create({ extensions: EXTENSOES });
  for (const m of arquivosDasMigrations()) {
    try {
      await pg.exec(m.sql);
    } catch (e) {
      throw new Error(`Falha na migration ${m.nome}: ${(e as Error).message}`);
    }
    await pg.exec("reset all");
  }
  await carregarDados(pg);
  await pg.exec(`
    create role arp_api login noinherit;
    grant anon, authenticated, service_role to arp_api;
  `);
  return pg;
}

function chave(): string {
  const h = createHash("sha256");
  for (const m of arquivosDasMigrations()) h.update(m.nome).update(m.sql);
  h.update(readFileSync(DADOS));
  h.update(readFileSync(new URL(import.meta.url)));
  return h.digest("hex").slice(0, 16);
}

/**
 * Um banco novo para o arquivo de teste. A primeira chamada (por versão das
 * migrations) monta e guarda a pasta de dados; as outras partem dela.
 */
export async function abrirBanco(): Promise<BancoDeTeste> {
  const pasta = join(os.tmpdir(), "arp-db-tests");
  const arquivo = join(pasta, `${chave()}.tar.gz`);
  if (existsSync(arquivo)) {
    const pg = await PGlite.create({
      loadDataDir: new Blob([readFileSync(arquivo)]),
      extensions: EXTENSOES,
    });
    return new BancoDeTeste(pg);
  }
  const pg = await montar();
  const dump = await pg.dumpDataDir("gzip");
  mkdirSync(pasta, { recursive: true });
  // Dois arquivos de teste montando juntos: cada um grava o seu e renomeia.
  const temp = `${arquivo}.${process.pid}.${Date.now()}`;
  writeFileSync(temp, Buffer.from(await dump.arrayBuffer()));
  renameSync(temp, arquivo);
  return new BancoDeTeste(pg);
}
