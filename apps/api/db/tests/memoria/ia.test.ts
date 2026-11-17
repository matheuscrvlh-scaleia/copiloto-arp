// IA ARP (0009_ia): quem configura, quem conversa e quem vê o uso.
// - conversas e perguntas: só o dono (nem o gestor lê o conteúdo);
// - uso: o dono vê o seu, o gestor vê tudo, ninguém grava pela sessão;
// - configuração e limites: lê quem usa ou gerencia, muda só quem gerencia.
import { beforeAll, describe, expect, it } from "vitest";
import { abrirBanco, type BancoDeTeste } from "../apoio";

const U = {
  gestor: "00000000-0000-0000-0000-0000000000a1",
  ana: "00000000-0000-0000-0000-0000000000a2",
  bia: "00000000-0000-0000-0000-0000000000a3",
  fora: "00000000-0000-0000-0000-0000000000a4",
};

const PERMISSOES: Record<keyof typeof U, string[]> = {
  gestor: ["ia.gerenciar", "ia.usar"],
  ana: ["ia.usar"],
  bia: ["ia.usar"],
  fora: [],
};

let db: BancoDeTeste;

async function valor<T = unknown>(
  sql: string,
  params: unknown[] = [],
): Promise<T> {
  const { rows } = await db.query<Record<string, T>>(sql, params);
  return Object.values(rows[0] ?? {})[0] as T;
}

async function como<T = unknown>(usuario: string, sql: string): Promise<T> {
  return db.comoUsuario(usuario, async () => {
    const { rows } = await db.query<Record<string, T>>(sql);
    return Object.values(rows[0] ?? {})[0] as T;
  });
}

async function falha(usuario: string, sql: string): Promise<string | null> {
  try {
    await db.comoUsuario(usuario, () => db.query(sql));
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

let conversaDaAna = "";
let perguntaDaAna = "";

beforeAll(async () => {
  db = await abrirBanco();
  for (const [nome, id] of Object.entries(U)) {
    await db.query(
      "insert into auth.users (id, email, encrypted_password) values ($1, $2, '')",
      [id, `${nome}@arp.test`],
    );
    for (const p of PERMISSOES[nome as keyof typeof U])
      await db.query(
        "insert into core.usuario_permissoes (usuario_id, permissao) values ($1, $2)",
        [id, p],
      );
  }
}, 180_000);

describe("permissões novas", () => {
  it("estão no catálogo do banco", async () => {
    expect(
      await valor<number>(
        "select count(*)::int from core.permissoes where codigo in ('ia.usar', 'ia.gerenciar')",
      ),
    ).toBe(2);
  });
});

describe("configuração", () => {
  it("nasce com uma linha e preços", async () => {
    expect(await valor<number>("select count(*)::int from ia.config")).toBe(1);
    expect(
      await valor<number>(
        "select (precos -> 'claude-opus-5-5' ->> 'saida')::int from ia.config",
      ),
    ).toBe(20);
  });

  it("quem usa lê; quem não tem a IA não vê", async () => {
    expect(
      await como<number>(U.ana, "select count(*)::int from ia.config"),
    ).toBe(1);
    expect(
      await como<number>(U.fora, "select count(*)::int from ia.config"),
    ).toBe(0);
  });

  it("só o gestor muda", async () => {
    await db.comoUsuario(U.ana, () =>
      db.query("update ia.config set ativa = false"),
    );
    expect(await valor<boolean>("select ativa from ia.config")).toBe(true);
    await db.comoUsuario(U.gestor, () =>
      db.query("update ia.config set max_consultas = 8"),
    );
    expect(await valor<number>("select max_consultas from ia.config")).toBe(8);
  });

  it("recusa valor fora da faixa", async () => {
    expect(
      await falha(U.gestor, "update ia.config set max_consultas = 0"),
    ).toMatch(/check/);
  });
});

describe("limites", () => {
  it("só o gestor cria e vê", async () => {
    expect(
      await falha(
        U.ana,
        `insert into ia.limites (usuario_id, tokens_mes) values ('${U.ana}', 999999999)`,
      ),
    ).toMatch(/row-level security|permission denied/);
    expect(
      await falha(
        U.gestor,
        `insert into ia.limites (usuario_id, tokens_mes) values ('${U.bia}', 1000)`,
      ),
    ).toBeNull();
    expect(
      await como<number>(U.bia, "select count(*)::int from ia.limites"),
    ).toBe(0);
    expect(
      await como<number>(U.gestor, "select count(*)::int from ia.limites"),
    ).toBe(1);
  });

  it("é de um cargo ou de uma pessoa, nunca dos dois", async () => {
    const cargo = await valor<string>("select id from core.cargos limit 1");
    expect(
      await falha(
        U.gestor,
        `insert into ia.limites (cargo_id, usuario_id, tokens_mes) values ('${cargo}', '${U.ana}', 1)`,
      ),
    ).toMatch(/check/);
  });
});

describe("conversas", () => {
  it("quem tem ia.usar abre conversa e pergunta", async () => {
    conversaDaAna = await como<string>(
      U.ana,
      "insert into ia.conversas (titulo) values ('Leads do mês') returning id",
    );
    perguntaDaAna = await como<string>(
      U.ana,
      `insert into ia.perguntas (conversa_id, pergunta) values ('${conversaDaAna}', 'Quantos leads?') returning id`,
    );
    expect(perguntaDaAna).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("sem ia.usar não abre", async () => {
    expect(
      await falha(U.fora, "insert into ia.conversas (titulo) values ('x')"),
    ).toMatch(/row-level security/);
  });

  it("ninguém além do dono lê, nem o gestor", async () => {
    for (const u of [U.bia, U.gestor]) {
      expect(
        await como<number>(u, "select count(*)::int from ia.conversas"),
      ).toBe(0);
      expect(
        await como<number>(u, "select count(*)::int from ia.perguntas"),
      ).toBe(0);
    }
    expect(
      await como<number>(U.ana, "select count(*)::int from ia.perguntas"),
    ).toBe(1);
  });

  it("não dá para perguntar na conversa de outra pessoa", async () => {
    expect(
      await falha(
        U.bia,
        `insert into ia.perguntas (conversa_id, pergunta) values ('${conversaDaAna}', 'oi')`,
      ),
    ).toMatch(/row-level security/);
  });
});

describe("uso", () => {
  it("só a API grava (service role)", async () => {
    expect(
      await falha(
        U.ana,
        `insert into ia.uso (usuario_id, modelo, status) values ('${U.ana}', 'x', 'ok')`,
      ),
    ).toMatch(/permission denied/);
    await db.comoServico(() =>
      db.query(
        `insert into ia.uso (pergunta_id, conversa_id, usuario_id, modelo, status, tokens_contados)
         values ($1, $2, $3, 'claude-opus-5-5', 'ok', 1500)`,
        [perguntaDaAna, conversaDaAna, U.ana],
      ),
    );
  });

  it("o dono vê o seu, o gestor vê tudo, os outros nada", async () => {
    expect(await como<number>(U.ana, "select count(*)::int from ia.uso")).toBe(
      1,
    );
    expect(
      await como<number>(U.gestor, "select count(*)::int from ia.uso"),
    ).toBe(1);
    expect(await como<number>(U.bia, "select count(*)::int from ia.uso")).toBe(
      0,
    );
  });

  it("o dono avalia a resposta, mas não muda os números", async () => {
    expect(await falha(U.ana, "update ia.uso set avaliacao = 1")).toBeNull();
    expect(await falha(U.ana, "update ia.uso set custo_usd = 0")).toMatch(
      /permission denied/,
    );
  });

  it("apagar a conversa mantém o uso", async () => {
    await db.comoUsuario(U.ana, () =>
      db.query("delete from ia.conversas where id = $1", [conversaDaAna]),
    );
    expect(
      await valor<number>(
        "select count(*)::int from ia.uso where conversa_id is null and pergunta_id is null",
      ),
    ).toBe(1);
  });
});
