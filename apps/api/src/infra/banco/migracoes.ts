import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

// Executor de migrations. Roda como comando à parte (src/migrar.ts), com a
// conexão de administrador; nunca dentro do processo que serve HTTP.
//
// - Arquivos `NNNN_nome.sql` em ordem; o que já rodou fica em
//   `infra.migracoes` com o checksum. Arquivo aplicado que mudou é erro:
//   migration aplicada não se edita, cria-se outra.
// - Cada arquivo roda numa conexão e numa transação próprias: ou entra
//   inteiro (com o registro), ou nada; e os `SET` do arquivo (o dump zera o
//   search_path) morrem com a conexão.

/** Último número das migrations que o banco clonado da produção já traz. */
const ULTIMA_DA_BASE = 2;

const NOME = /^(\d{4})_[a-z0-9_]+\.sql$/;
const TRAVA = "select pg_advisory_lock(hashtext('infra.migracoes'))";

export interface Migration {
  nome: string;
  numero: number;
  sql: string;
  checksum: string;
}

type Log = (mensagem: string) => void;

/** O fim de linha não entra no checksum (o git pode trocar LF por CRLF). */
export function checksumDe(sql: string): string {
  return createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex");
}

export async function lerMigrations(pasta: string): Promise<Migration[]> {
  const nomes = (await fs.readdir(pasta)).filter((n) => n.endsWith(".sql"));
  const lidas = await Promise.all(
    nomes.sort().map(async (nome) => {
      const m = NOME.exec(nome);
      if (!m) throw new Error(`Nome de migration inválido: ${nome}`);
      const sql = await fs.readFile(path.join(pasta, nome), "utf8");
      return { nome, numero: Number(m[1]), sql, checksum: checksumDe(sql) };
    }),
  );
  const repetida = lidas.find((m, i) => lidas[i - 1]?.numero === m.numero);
  if (repetida) throw new Error(`Número repetido: ${repetida.nome}`);
  return lidas;
}

async function comConexao<T>(
  url: string,
  fn: (c: pg.Client) => Promise<T>,
): Promise<T> {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

async function aplicadas(c: pg.Client): Promise<Map<string, string>> {
  await c.query(`
    create schema if not exists infra;
    create table if not exists infra.migracoes (
      nome text primary key,
      checksum text not null,
      aplicada_em timestamptz not null default now(),
      -- false: marcada como aplicada sem rodar (banco clonado)
      executada boolean not null default true
    );
  `);
  const r = await c.query<{ nome: string; checksum: string }>(
    "select nome, checksum from infra.migracoes",
  );
  return new Map(r.rows.map((l) => [l.nome, l.checksum]));
}

const registrar =
  "insert into infra.migracoes (nome, checksum, executada) values ($1, $2, $3)";

/**
 * Aplica o que falta, em ordem. Devolve os nomes aplicados. Com
 * `marcarBase`, as migrations da base (até ULTIMA_DA_BASE) que ainda não
 * estão registradas são só marcadas como aplicadas, sem rodar: é o caso do
 * banco clonado da produção, que já tem o schema.
 */
export async function migrar(opcoes: {
  url: string;
  pasta: string;
  marcarBase?: boolean;
  log?: Log;
}): Promise<string[]> {
  const log = opcoes.log ?? (() => {});
  const migrations = await lerMigrations(opcoes.pasta);
  // A trava é de sessão: esta conexão fica aberta até o fim, e um segundo
  // executor espera aqui em vez de rodar junto.
  return comConexao(opcoes.url, async (controle) => {
    await controle.query(TRAVA);
    const feitas = await aplicadas(controle);
    const novas: string[] = [];
    for (const m of migrations) {
      const checksum = feitas.get(m.nome);
      if (checksum !== undefined) {
        if (checksum !== m.checksum)
          throw new Error(
            `A migration ${m.nome} mudou depois de aplicada. Desfaça a edição e crie uma nova migration.`,
          );
        continue;
      }
      if (opcoes.marcarBase && m.numero <= ULTIMA_DA_BASE) {
        await controle.query(registrar, [m.nome, m.checksum, false]);
        log(`marcada (sem rodar): ${m.nome}`);
        continue;
      }
      await comConexao(opcoes.url, async (c) => {
        await c.query("begin");
        try {
          await c.query(m.sql);
          await c.query(registrar, [m.nome, m.checksum, true]);
          await c.query("commit");
        } catch (e) {
          await c.query("rollback").catch(() => {});
          throw new Error(`Falha na migration ${m.nome}`, { cause: e });
        }
      });
      log(`aplicada: ${m.nome}`);
      novas.push(m.nome);
    }
    return novas;
  });
}

/**
 * Garante o papel com que a API conecta (o usuário de `urlDaApi`): LOGIN
 * NOINHERIT, membro de anon, authenticated e service_role. Sozinho não lê
 * nada; só assume um desses papéis dentro de um escopo de `infra/banco`.
 * Roda depois das migrations (os três papéis nascem na 0000). A senha só é
 * definida na criação: papel que já existe não é alterado.
 */
export async function garantirPapelDaApi(
  urlAdmin: string,
  urlDaApi: string,
  log: Log = () => {},
): Promise<void> {
  const api = new URL(urlDaApi);
  const papel = decodeURIComponent(api.username);
  const senha = decodeURIComponent(api.password);
  if (!papel || !senha)
    throw new Error("DATABASE_URL precisa trazer o usuário e a senha da API");
  await comConexao(urlAdmin, async (c) => {
    const existe = await c.query("select 1 from pg_roles where rolname = $1", [
      papel,
    ]);
    if (!existe.rowCount) {
      // CREATE ROLE não aceita parâmetro: o próprio banco monta o comando
      // com o nome e a senha escapados (format %I e %L).
      const r = await c.query<{ comando: string }>(
        "select format('create role %I login noinherit password %L', $1::text, $2::text) as comando",
        [papel, senha],
      );
      const comando = r.rows[0]?.comando;
      if (!comando) throw new Error("Não foi possível criar o papel da API");
      await c.query(comando);
      log(`papel criado: ${papel}`);
    }
    const r = await c.query<{ comando: string }>(
      "select format('grant anon, authenticated, service_role to %I', $1::text) as comando",
      [papel],
    );
    const comando = r.rows[0]?.comando;
    if (comando) await c.query(comando);
  });
}
