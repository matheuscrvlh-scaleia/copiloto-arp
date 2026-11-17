// OS independentes (20261029120000_os_ordens_independentes). O teste antigo
// aplicava as migrations até a anterior, gravava OS do jeito antigo e
// conferia a cópia para os.ordens: era migração de dados, que o banco novo
// já traz feita (a 0001 tem o schema final). Ficam as regras do schema
// final: chamado não vira OS, filha com um dono só, vínculo desfeito ao
// apagar o chamado e outros custos só como lista.
import { beforeAll, describe, expect, it } from "vitest";
import { abrirBanco, type BancoDeTeste } from "../apoio";

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

const id = { ticket: "", ordem: "" };

beforeAll(async () => {
  db = await abrirBanco();
  const setor = await valor<string>("select id from os.setores limit 1");
  id.ticket = await valor<string>(
    `insert into os.chamados (tipo, titulo, setor_id)
     values ('solicitacao', 'Lâmpada queimada', '${setor}') returning id`,
  );
  id.ordem = await valor<string>(
    `insert into os.ordens (titulo, setor_id, vinculado_a_id, execucao, local)
     values ('Trocar lâmpada', '${setor}', '${id.ticket}', 'terceirizada', 'Doca 2')
     returning id`,
  );
  await db.query(
    `insert into os.os_custos (ordem_id, custo_total) values ('${id.ordem}', 42)`,
  );
}, 120_000);

describe("regras de os.ordens", () => {
  it("chamado não vira OS, OS não vira chamado; filha tem um dono só", async () => {
    const setor = await valor<string>("select id from os.setores limit 1");
    expect(
      await erro(
        `insert into os.chamados (tipo, titulo, setor_id) values ('os', 'x', '${setor}')`,
      ),
    ).toMatch(/chamados_sem_os/);
    expect(
      await erro(
        `insert into os.ordens (tipo, titulo, setor_id) values ('solicitacao', 'x', '${setor}')`,
      ),
    ).toMatch(/check constraint/);
    expect(
      await erro(
        `insert into os.eventos (chamado_id, ordem_id, tipo)
         values ('${id.ticket}', '${id.ordem}', 'comentario')`,
      ),
    ).toMatch(/check constraint/);
  });

  it("apagar o chamado ligado só desfaz o vínculo", async () => {
    await db.exec("begin");
    try {
      await db.query(
        `delete from os.eventos where chamado_id = '${id.ticket}'`,
      );
      await db.query(`delete from os.chamados where id = '${id.ticket}'`);
      expect(
        await valor(
          `select vinculado_a_id from os.ordens where id = '${id.ordem}'`,
        ),
      ).toBeNull();
    } finally {
      await db.exec("rollback");
    }
  });

  it("outros custos: lista vazia por padrão, só aceita lista", async () => {
    expect(
      await valor(
        `select outros_custos::text from os.os_custos where ordem_id = '${id.ordem}'`,
      ),
    ).toBe("[]");
    expect(
      await erro(
        `update os.os_custos set outros_custos = '{"valor": 1}' where ordem_id = '${id.ordem}'`,
      ),
    ).toMatch(/check constraint/);
  });
});
