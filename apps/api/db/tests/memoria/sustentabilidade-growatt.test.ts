// Energia solar pelo inversor (0004_growatt): quem configura a integração da
// Growatt, quem lê a geração diária e quem vê o histórico das execuções.
import { beforeAll, describe, expect, it } from "vitest";
import { abrirBanco, type BancoDeTeste } from "../apoio";

const U = {
  sustentabilidade: "00000000-0000-0000-0000-0000000000f1",
  marketing: "00000000-0000-0000-0000-0000000000f2",
  solar: "00000000-0000-0000-0000-0000000000f3",
  fora: "00000000-0000-0000-0000-0000000000f4",
};

const PERMISSOES: Record<keyof typeof U, string[]> = {
  sustentabilidade: ["sustentabilidade.parametros"],
  marketing: ["marketing.parametros"],
  solar: ["operacoes.solar.ver"],
  fora: ["sustentabilidade.painel"],
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
  // Uma execução de cada módulo e dois dias lidos (preparo, sem RLS).
  const run = await valor<string>(
    `insert into integracao.sync_runs (sistema, recurso, status, finalizado_em)
     values ('sus_growatt', 'geracao_diaria', 'sucesso', now()) returning id`,
  );
  await db.query(
    `insert into integracao.sync_runs (sistema, recurso, status, finalizado_em)
     values ('mkt_meta', 'instagram', 'sucesso', now()), ('secullum', 'ponto', 'sucesso', now())`,
  );
  await db.query(
    `insert into operacoes.solar_inversor_dias (usina_id, dia, energia_kwh, sync_run_id)
     values (42, '2026-11-01', 314.6, $1), (42, '2026-11-02', 286.9, $1)`,
    [run],
  );
}, 180_000);

describe("integração da Growatt", () => {
  it("configura quem tem sustentabilidade.parametros; o Marketing não", async () => {
    const pode = (u: string, s: string) =>
      como(u, () => valor<boolean>("select core.pode_integracao($1)", [s]));
    expect(await pode(U.sustentabilidade, "sus_growatt")).toBe(true);
    expect(await pode(U.sustentabilidade, "mkt_meta")).toBe(false);
    expect(await pode(U.sustentabilidade, "secullum")).toBe(false);
    expect(await pode(U.marketing, "sus_growatt")).toBe(false);
    expect(await pode(U.marketing, "mkt_meta")).toBe(true);
  });

  it("salvar: aceita o sistema novo e confere a permissão no banco", async () => {
    const salvar = `select core.salvar_integracao('sus_growatt',
      '{"base_url": "https://openapi.growatt.test", "usina_id": 42}', 'cifrado', true)`;
    expect(await falha(U.fora, salvar)).toMatch(/sem permissão/);
    expect(await falha(U.sustentabilidade, salvar)).toBeNull();
    expect(
      await valor<number>(
        "select count(*)::int from integracao.credenciais where sistema = 'sus_growatt'",
      ),
    ).toBe(1);
  });

  it("histórico: cada um vê as execuções das integrações que configura", async () => {
    const sistemas = (u: string) =>
      como(u, () =>
        valor<string | null>(
          "select string_agg(sistema, ',' order by sistema) from core.historico_integracoes(50)",
        ),
      );
    expect(await sistemas(U.sustentabilidade)).toBe("sus_growatt");
    expect(await sistemas(U.marketing)).toBe("mkt_meta");
    expect(await sistemas(U.fora)).toBeNull();
  });
});

describe("operacoes.solar_inversor_dias", () => {
  const contar = (u: string) =>
    como(u, () =>
      valor<number>("select count(*)::int from operacoes.solar_inversor_dias"),
    );

  it("lê quem vê a Energia solar; o resto não", async () => {
    expect(await contar(U.solar)).toBe(2);
    expect(await contar(U.sustentabilidade)).toBe(0);
    expect(await contar(U.fora)).toBe(0);
  });

  it("só a sincronização grava", async () => {
    expect(
      await falha(
        U.solar,
        "insert into operacoes.solar_inversor_dias (usina_id, dia, energia_kwh) values (42, '2026-11-03', 1)",
      ),
    ).toMatch(/permission denied|permissão/i);
  });

  it("energia negativa é recusada", async () => {
    await expect(
      db.query(
        "insert into operacoes.solar_inversor_dias (usina_id, dia, energia_kwh) values (42, '2026-11-04', -1)",
      ),
    ).rejects.toThrow(/check/);
  });
});
