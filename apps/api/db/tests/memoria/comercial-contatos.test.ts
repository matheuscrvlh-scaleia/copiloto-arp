// Exemplo do Relacionamento (20261104130400_comercial_exemplo_contatos): os
// contatos fictícios batem com o ENET de exemplo e com as listas, ficam nos
// últimos 90 dias, só o Relacionamento vê todos e "Remover dados de
// exemplo" apaga.

import { gerarEnet } from "@arp/shared/comercial/exemplo/enet";
import { beforeAll, describe, expect, it } from "vitest";
import { abrirBanco, type BancoDeTeste, DATA_DOS_DADOS } from "../apoio";

const U = {
  rel: "00000000-0000-0000-0000-0000000000b1",
  censo: "00000000-0000-0000-0000-0000000000b2",
  parametros: "00000000-0000-0000-0000-0000000000b3",
} as const;
const PERMISSOES: Record<keyof typeof U, string> = {
  rel: "comercial.relacionamento.ver",
  censo: "comercial.censo.ver",
  parametros: "comercial.parametros.editar",
};

let db: BancoDeTeste;

async function como<T>(quem: keyof typeof U, fn: () => Promise<T>): Promise<T> {
  return db.comoUsuario(U[quem], fn);
}

const contar = async (onde = "exemplo") =>
  (
    await db.query<{ n: number }>(
      `select count(*)::int n from comercial.contatos where ${onde}`,
    )
  ).rows[0]?.n;

beforeAll(async () => {
  db = await abrirBanco();
  for (const [nome, id] of Object.entries(U)) {
    await db.query(
      "insert into auth.users (id, email, encrypted_password) values ($1, $2, '')",
      [id, `${nome}@arp.test`],
    );
    await db.query(
      "insert into core.usuario_permissoes (usuario_id, permissao) values ($1, $2)",
      [id, PERMISSOES[nome as keyof typeof U]],
    );
  }
}, 120_000);

describe("contatos de exemplo", () => {
  it("26 registros de exemplo, sem quem registrou, quase todos nos últimos 90 dias", async () => {
    expect(await contar()).toBe(26);
    expect(await contar("exemplo and registrado_por is not null")).toBe(0);
    // Os dados vêm congelados do dia em que foram gerados (ver ../apoio.ts).
    expect(
      await contar(`exemplo and data >= date '${DATA_DOS_DADOS}' - 89`),
    ).toBe(25);
  });

  it("tipo e canal das listas dos parâmetros", async () => {
    expect(
      await contar(`exemplo and (
        tipo not in (select valor from comercial.listas where lista = 'tipo_contato')
        or canal not in (select valor from comercial.listas where lista = 'canal_contato'))`),
    ).toBe(0);
  });

  it("locatário, contrato, LUC e bloco existem no ENET de exemplo", async () => {
    const enet = gerarEnet("2026-11-04");
    const { rows } = await db.query<{
      locatario_enet_id: string;
      locatario_nome: string;
      contrato_enet_id: string;
      luc: string;
      bloco: string;
    }>(
      "select locatario_enet_id, locatario_nome, contrato_enet_id, luc, bloco from comercial.contatos where exemplo",
    );
    for (const r of rows) {
      const c = enet.contratos.find((x) => x.codigo === r.contrato_enet_id);
      expect(c, r.contrato_enet_id).toMatchObject({
        cliente: r.locatario_enet_id,
        locatario: r.locatario_nome,
        luc: r.luc,
      });
      expect(enet.lucs.find((l) => l.numero === r.luc)?.local).toBe(r.bloco);
    }
  });

  it("Relacionamento vê todos; Censo só os de feedback", async () => {
    expect(await como("rel", () => contar())).toBe(26);
    const feedback = await como("censo", () => contar());
    expect(feedback).toBe(
      await contar(`exemplo and tipo in (select valor from comercial.listas
        where lista = 'tipo_contato' and (extra ->> 'feedback')::boolean)`),
    );
    expect(feedback).toBeLessThan(26);
  });

  it("Remover dados de exemplo apaga", async () => {
    await como("parametros", () =>
      db.query("select comercial.remover_exemplos()"),
    );
    expect(await contar()).toBe(0);
  });
});
