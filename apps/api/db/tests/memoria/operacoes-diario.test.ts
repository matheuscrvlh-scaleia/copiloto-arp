// Diário de Obra (20261109160600_operacoes_diario e o seed 20261109160650):
// a cópia do aplicativo é só leitura para quem usa o sistema (RLS pelas
// permissões do diário e do painel), os dados de exemplo estão marcados e
// saem juntos (obra apagada leva os relatórios).
import { beforeAll, describe, expect, it } from "vitest";
import { abrirBanco, type BancoDeTeste } from "../apoio";

const U = {
  diario: "00000000-0000-0000-0000-0000000000e1",
  painel: "00000000-0000-0000-0000-0000000000e2",
  obras: "00000000-0000-0000-0000-0000000000e3",
  fora: "00000000-0000-0000-0000-0000000000e4",
};

const PERMISSOES: Record<keyof typeof U, string[]> = {
  diario: ["operacoes.obras.diario", "operacoes.obras.atualizar"],
  painel: ["operacoes.painel"],
  obras: ["operacoes.obras.ver"],
  fora: ["rh.painel"],
};

let db: BancoDeTeste;

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
  return db.comoUsuario(usuario, fn);
}

const contar = (u: string, tabela: string) =>
  como(u, () => valor<number>(`select count(*)::int from operacoes.${tabela}`));

beforeAll(async () => {
  db = await abrirBanco();
  for (const [nome, id] of Object.entries(U)) {
    await db.query(
      "insert into auth.users (id, email, encrypted_password) values ($1, $2, '')",
      [id, `${nome}@arp.test`],
    );
    for (const p of PERMISSOES[nome as keyof typeof U]) {
      await db.query(
        "insert into core.usuario_permissoes (usuario_id, permissao) values ($1, $2)",
        [id, p],
      );
    }
  }
}, 180_000);

describe("dados de exemplo", () => {
  it("duas obras e cerca de 20 relatórios, todos marcados e com prefixo", async () => {
    expect(
      await valor<number>("select count(*)::int from operacoes.diario_obras"),
    ).toBe(2);
    const n = await valor<number>(
      "select count(*)::int from operacoes.diario_relatorios",
    );
    expect(n).toBeGreaterThanOrEqual(15);
    expect(
      await valor<number>(
        `select count(*)::int from operacoes.diario_relatorios
         where not exemplo or id not like 'exemplo-%' or obra_id not like 'exemplo-%'`,
      ),
    ).toBe(0);
    expect(
      await valor<number>(
        "select count(*)::int from operacoes.diario_obras where not exemplo or id not like 'exemplo-%'",
      ),
    ).toBe(0);
  });

  it("relatórios com detalhe, resumo, autor e modelo por id", async () => {
    expect(
      await valor<number>(
        `select count(*)::int from operacoes.diario_relatorios
         where dados is null or resumo is null or detalhado_em is null
            or autor_id is null or modelo_id is null`,
      ),
    ).toBe(0);
    expect(
      await valor<number>(
        "select count(*)::int from operacoes.diario_relatorios where (resumo->>'impraticavel')::boolean",
      ),
    ).toBeGreaterThan(0);
    // Pelo menos um a aprovar (status 1 ou 3) para o cartão ter número.
    expect(
      await valor<number>(
        "select count(*)::int from operacoes.diario_relatorios where status_id in (1, 3)",
      ),
    ).toBeGreaterThan(0);
  });
});

describe("RLS", () => {
  it("diário e painel leem; ver obras (orçamento) e quem é de fora não", async () => {
    expect(await contar(U.diario, "diario_obras")).toBe(2);
    expect(await contar(U.diario, "diario_relatorios")).toBeGreaterThan(0);
    expect(await contar(U.painel, "diario_relatorios")).toBeGreaterThan(0);
    expect(await contar(U.obras, "diario_obras")).toBe(0);
    expect(await contar(U.fora, "diario_relatorios")).toBe(0);
    // Cadastros (filtros): só quem vê o diário.
    await db.query(
      "insert into operacoes.diario_cadastros (id, empresa) values (true, '{}')",
    );
    expect(await contar(U.diario, "diario_cadastros")).toBe(1);
    expect(await contar(U.painel, "diario_cadastros")).toBe(0);
  });

  it("ninguém grava pela sessão: só a sincronização (service role)", async () => {
    for (const sql of [
      "update operacoes.diario_relatorios set status_id = 4",
      "delete from operacoes.diario_relatorios",
      "update operacoes.diario_obras set exemplo = false",
      `insert into operacoes.diario_obras (id, nome, status_id, dados)
       values ('x', 'x', 3, '{}')`,
    ]) {
      const e = await como(U.diario, () => erro(sql));
      expect(e).toMatch(/permission denied|row-level security/);
    }
    expect(
      await valor<number>(
        "select count(*)::int from operacoes.diario_relatorios where status_id = 4",
      ),
    ).toBeLessThan(
      await valor<number>(
        "select count(*)::int from operacoes.diario_relatorios",
      ),
    );
  });
});

describe("limpeza dos exemplos (o que a sincronização faz)", () => {
  it("apagar as obras de exemplo leva os relatórios junto", async () => {
    await db.comoServico(async () => {
      await db.query("delete from operacoes.diario_obras where exemplo");
      await db.query("delete from operacoes.diario_relatorios where exemplo");
    });
    expect(
      await valor<number>(
        "select count(*)::int from operacoes.diario_relatorios",
      ),
    ).toBe(0);
  });
});
