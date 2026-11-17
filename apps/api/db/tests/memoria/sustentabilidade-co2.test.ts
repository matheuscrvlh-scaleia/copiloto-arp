// Fator de emissão do CO₂ evitado (0007_co2_fatores): quem lê, quem grava e
// a auditoria das mudanças.
import { beforeAll, describe, expect, it } from "vitest";
import { abrirBanco, type BancoDeTeste } from "../apoio";

const U = {
  parametros: "00000000-0000-0000-0000-0000000000e1",
  painel: "00000000-0000-0000-0000-0000000000e2",
  fora: "00000000-0000-0000-0000-0000000000e3",
};

const PERMISSOES: Record<keyof typeof U, string[]> = {
  parametros: ["sustentabilidade.parametros"],
  painel: ["sustentabilidade.painel"],
  fora: ["operacoes.solar.ver"],
};

let db: BancoDeTeste;

async function valor<T = unknown>(
  sql: string,
  params: unknown[] = [],
): Promise<T> {
  const { rows } = await db.query<Record<string, T>>(sql, params);
  return Object.values(rows[0] ?? {})[0] as T;
}

const como = <T>(usuario: string, fn: () => Promise<T>) =>
  db.comoUsuario(usuario, fn);

async function falha(usuario: string, sql: string): Promise<string | null> {
  try {
    await como(usuario, () => db.query(sql));
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

const contar = (u: string) =>
  como(u, () =>
    valor<number>("select count(*)::int from sustentabilidade.co2_fatores"),
  );

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

describe("sustentabilidade.co2_fatores", () => {
  it("a migration já traz o fator inicial (MCTI 2023)", async () => {
    expect(
      await valor<string>(
        "select kg_por_kwh::text from sustentabilidade.co2_fatores where vigente_desde = '2025-01-01'",
      ),
    ).toBe("0.03850");
  });

  const inserir = (data: string, fator: string) =>
    `insert into sustentabilidade.co2_fatores (vigente_desde, kg_por_kwh) values ('${data}', ${fator})`;

  it("grava só quem tem Parâmetros", async () => {
    expect(await falha(U.painel, inserir("2026-01-01", "0.0385"))).toMatch(
      /row-level security|permission denied/,
    );
    expect(await falha(U.fora, inserir("2026-01-01", "0.0385"))).toMatch(
      /row-level security|permission denied/,
    );
    expect(
      await falha(U.parametros, inserir("2026-01-01", "0.0385")),
    ).toBeNull();
  });

  it("uma vigência por data e fator positivo", async () => {
    expect(await falha(U.parametros, inserir("2026-01-01", "0.05"))).toMatch(
      /duplicate key|unique/,
    );
    expect(await falha(U.parametros, inserir("2027-01-01", "0"))).toMatch(
      /check constraint/,
    );
  });

  it("lê quem vê o painel ou os parâmetros; o resto não", async () => {
    expect(await contar(U.parametros)).toBe(2);
    expect(await contar(U.painel)).toBe(2);
    expect(await contar(U.fora)).toBe(0);
  });

  it("a gravação entra na auditoria com o autor", async () => {
    expect(
      await valor<string>(
        `select criado_por::text from sustentabilidade.co2_fatores where vigente_desde = '2026-01-01'`,
      ),
    ).toBe(U.parametros);
    expect(
      await valor<number>(
        "select count(*)::int from core.auditoria where tabela = 'sustentabilidade.co2_fatores' and usuario_id is not null",
      ),
    ).toBe(1);
  });
});
