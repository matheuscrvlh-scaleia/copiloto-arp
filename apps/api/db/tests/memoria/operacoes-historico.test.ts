// Operações no histórico do sistema (20261109160800_operacoes_historico):
// core.logs aceita o módulo "operacoes", a auditoria das tabelas
// operacoes.* cai nesse módulo e o filtro do histórico (core.historico)
// acha os eventos por ele.
import { beforeAll, describe, expect, it } from "vitest";
import { abrirBanco, type BancoDeTeste } from "../apoio";

const U = {
  admin: "00000000-0000-0000-0000-0000000000f1",
  operacoes: "00000000-0000-0000-0000-0000000000f2",
};

const PERMISSOES: Record<keyof typeof U, string[]> = {
  admin: ["admin.historico"],
  operacoes: ["operacoes.parametros"],
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

describe("histórico do sistema com Operações", () => {
  it("core.logs aceita o módulo operacoes (e segue recusando módulo desconhecido)", async () => {
    expect(
      await erro(
        `insert into core.logs (modulo, evento, descricao, usuario_id, detalhes)
         values ('operacoes', 'operacoes_rateio_fechado',
                 'Fechou o rateio da limpeza de setembro de 2026',
                 '${U.operacoes}', '{"referencia": "2026-09-01"}')`,
      ),
    ).toBeNull();
    expect(
      await erro(
        "insert into core.logs (modulo, evento, descricao) values ('inventado', 'x', 'y')",
      ),
    ).toMatch(/logs_modulo_check/);
  });

  it("a auditoria das tabelas operacoes.* cai no módulo operacoes", async () => {
    expect(
      await valor<string>(
        "select core.modulo_da_auditoria('operacoes.caixas', '{}')",
      ),
    ).toBe("operacoes");
    // As outras regras continuam.
    expect(
      await valor<string>("select core.modulo_da_auditoria('os.ativos', '{}')"),
    ).toBe("os");
    expect(
      await valor<string>(
        "select core.modulo_da_auditoria('core.usuarios', '{}')",
      ),
    ).toBe("admin");
  });

  it("o filtro por módulo do histórico acha o evento de Operações", async () => {
    const linhas = await como(U.admin, async () => {
      const { rows } = await db.query<{ acao: string; descricao: string }>(
        "select acao, descricao from core.historico(p_modulo => 'operacoes', p_tipo => 'evento')",
      );
      return rows;
    });
    expect(linhas).toEqual([
      {
        acao: "operacoes_rateio_fechado",
        descricao: "Fechou o rateio da limpeza de setembro de 2026",
      },
    ]);
  });
});
