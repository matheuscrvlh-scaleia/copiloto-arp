// Censo de exemplo (20261104130000_comercial_exemplo_censo): as duas rodadas,
// a distribuição parecida com a planilha de 2026, os temas já agrupados, os
// convites da rodada aberta e as regras do banco que o questionário usa
// (uma resposta por empresa, nada depois de encerrar).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { indicadoresCenso, porGrupo } from "../../src/lib/comercial/censo";

const MIGRATIONS = join(import.meta.dirname, "..", "migrations");
const ESTA = "20261104130000_comercial_exemplo_censo.sql";

const SUPABASE_MINIMO = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema storage to authenticated;
  grant select, insert on storage.objects to authenticated;
`;

const PARAMETROS = "00000000-0000-0000-0000-000000000001";
const ANA = "00000000-0000-0000-0000-000000000002";

let db: PGlite;

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

const rodada = (nome: string) =>
  `(select id from comercial.censo_rodadas where nome = '${nome}')`;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_MINIMO);
  // Só até esta migration: as dos outros exemplos não mudam o que se confere aqui.
  for (const f of readdirSync(MIGRATIONS).sort()) {
    if (f.endsWith(".sql") && f <= ESTA)
      await db.exec(readFileSync(join(MIGRATIONS, f), "utf8"));
  }
  for (const [id, email, permissao] of [
    [PARAMETROS, "parametros@arp.test", "comercial.parametros.editar"],
    [ANA, "ana@arp.test", "comercial.censo.ver"],
  ] as const) {
    await db.query("insert into auth.users (id, email) values ($1, $2)", [
      id,
      email,
    ]);
    await db.query(
      "insert into core.usuario_permissoes (usuario_id, permissao) values ($1, $2)",
      [id, permissao],
    );
  }
}, 120_000);

describe("rodada Censo 2026 (fechada, como a planilha)", () => {
  it("178 respostas, sem repetidas, todas de exemplo", async () => {
    expect(
      await valor(
        `select situacao from comercial.censo_rodadas where nome = 'Censo 2026'`,
      ),
    ).toBe("encerrada");
    expect(
      await valor(
        `select count(*)::int from comercial.censo_respostas where rodada_id = ${rodada("Censo 2026")} and considerada and exemplo`,
      ),
    ).toBe(178);
    expect(
      await valor(
        `select count(distinct lower(empresa_nome))::int from comercial.censo_respostas where rodada_id = ${rodada("Censo 2026")}`,
      ),
    ).toBe(178);
  });

  it("segmentos e blocos na distribuição da planilha", async () => {
    const { rows } = await db.query<{ segmento: string; n: number }>(
      `select segmento, count(*)::int as n from comercial.censo_respostas
       where rodada_id = ${rodada("Censo 2026")} group by 1 order by 2 desc, 1`,
    );
    expect(rows.map((r) => [r.segmento, r.n])).toEqual([
      ["Serviços", 53],
      ["Clínicas e Médicos", 42],
      ["Comércio", 33],
      ["Alimentação", 25],
      ["Academias e Condicionamento", 11],
      ["Educação", 6],
      ["Veterinária", 6],
      ["Entretenimento", 2],
    ]);
    expect(
      await valor(
        `select count(*)::int from comercial.censo_respostas where rodada_id = ${rodada("Censo 2026")} and bloco = '5'`,
      ),
    ).toBe(30);
  });

  it("indicadores com a ordem de grandeza da planilha (98,84% com atendimento)", async () => {
    const { rows } = await db.query<{
      bloco: string | null;
      segmento: string | null;
      colaboradores: number | null;
      visitantes_dia: number | null;
      ticket_ajustado: string | null;
      conversoes_dia: number | null;
      expectativas: string[];
    }>(
      `select bloco, segmento, colaboradores, visitantes_dia, ticket_ajustado, conversoes_dia, expectativas
       from comercial.censo_respostas where rodada_id = ${rodada("Censo 2026")} and considerada`,
    );
    const respostas = rows.map((r) => ({
      ...r,
      ticket_ajustado:
        r.ticket_ajustado === null ? null : Number(r.ticket_ajustado),
    }));
    const i = indicadoresCenso(respostas, [
      "Manter meu espaço",
      "Ampliar espaço",
      "Empreender com um novo negócio/projeto",
      "Reduzir meu espaço",
    ]);
    expect(i.empresas).toBe(178);
    expect(i.pctAtendimento?.toFixed(2)).toBe("98.84");
    expect(i.medianaColaboradores).toBeGreaterThanOrEqual(3);
    expect(i.medianaColaboradores).toBeLessThanOrEqual(5);
    expect(i.mediaColaboradores).toBeGreaterThan(6);
    expect(i.mediaColaboradores).toBeLessThan(14);
    expect(i.visitantes).toBeGreaterThan(5000);
    expect(i.visitantes).toBeLessThan(11000);
    expect(i.ticketMedio).toBeGreaterThan(60);
    expect(i.ticketMedio).toBeLessThan(250);
    expect(i.movimentacao).toBeGreaterThan(300_000);
    expect(i.movimentacao).toBeLessThan(1_200_000);
    expect(i.expectativas.at(-1)?.empresas).toBe(2);
    expect(i.expectativas.reduce((s, e) => s + e.pct, 0)).toBeGreaterThan(100);
    expect(porGrupo(respostas, "segmento")).toHaveLength(8);
  });

  it("mensalidade grava o ticket ajustado (ticket ÷ dias)", async () => {
    expect(
      await valor(
        `select count(*)::int from comercial.censo_respostas
         where mensalidade and abs(ticket_ajustado - round(ticket / dias_uso, 4)) > 0.0001`,
      ),
    ).toBe(0);
    expect(
      await valor(
        `select count(*)::int from comercial.censo_respostas where mensalidade
         and rodada_id = ${rodada("Censo 2026")}`,
      ),
    ).toBeGreaterThan(5);
  });

  it("toda sugestão de 2026 já está num dos 8 temas de exemplo", async () => {
    expect(
      await valor(
        "select count(*)::int from comercial.censo_temas where exemplo",
      ),
    ).toBe(8);
    const semTema = await valor<number>(
      `select count(*)::int from comercial.censo_respostas r
       where r.rodada_id = ${rodada("Censo 2026")} and r.sugestao is not null
         and not exists (select 1 from comercial.censo_sugestao_temas s where s.resposta_id = r.id)`,
    );
    expect(semTema).toBe(0);
    const comSugestao = await valor<number>(
      `select count(*)::int from comercial.censo_respostas
       where rodada_id = ${rodada("Censo 2026")} and sugestao is not null`,
    );
    expect(comSugestao).toBeGreaterThan(80);
    expect(comSugestao).toBeLessThan(140);
    expect(
      await valor(
        "select count(distinct tema_id)::int from comercial.censo_sugestao_temas",
      ),
    ).toBe(8);
  });
});

describe("rodada Censo 2027 (aberta, com convites)", () => {
  it("um convite por locatário ativo, com token, e 41 respostas", async () => {
    expect(
      await valor(
        `select situacao from comercial.censo_rodadas where nome = 'Censo 2027'`,
      ),
    ).toBe("aberta");
    expect(
      await valor(
        `select count(*)::int from comercial.censo_convites where rodada_id = ${rodada("Censo 2027")} and length(token) >= 32`,
      ),
    ).toBe(212);
    expect(
      await valor(
        `select count(*)::int from comercial.censo_respostas where rodada_id = ${rodada("Censo 2027")} and convite_id is not null`,
      ),
    ).toBe(41);
    expect(
      await valor(
        `select count(*)::int from comercial.censo_respostas where rodada_id = ${rodada("Censo 2027")} and origem = 'presencial'`,
      ),
    ).toBeGreaterThan(0);
    // Quem respondeu recebeu o link; respostas no bloco da lista.
    expect(
      await valor(
        `select count(*)::int from comercial.censo_respostas r join comercial.censo_convites c on c.id = r.convite_id
         where c.enviado_em is null`,
      ),
    ).toBe(0);
    expect(
      await valor(
        `select count(*)::int from comercial.censo_respostas r
         where not exists (select 1 from comercial.listas l where l.lista = 'censo_bloco' and l.valor = r.bloco)`,
      ),
    ).toBe(0);
  });

  it("a mesma empresa não responde duas vezes; depois de encerrar, nada entra", async () => {
    const convite = await valor<string>(
      `select c.id from comercial.censo_convites c
       where c.rodada_id = ${rodada("Censo 2027")}
         and not exists (select 1 from comercial.censo_respostas r where r.convite_id = c.id)
       order by c.empresa_nome limit 1`,
    );
    const inserir = `insert into comercial.censo_respostas (rodada_id, convite_id, locatario_enet_id, empresa_nome, colaboradores, origem)
      select rodada_id, id, locatario_enet_id, empresa_nome, 3, 'link' from comercial.censo_convites where id = '${convite}'`;
    expect(await erro(inserir)).toBeNull();
    expect(await erro(inserir)).toMatch(/duplicate|unique/i);

    await db.query(
      `update comercial.censo_rodadas set situacao = 'encerrada' where nome = 'Censo 2027'`,
    );
    expect(
      await erro(
        `update comercial.censo_respostas set colaboradores = 4 where convite_id = '${convite}'`,
      ),
    ).toMatch(/encerrada/);
    await db.query(
      `update comercial.censo_rodadas set situacao = 'aberta' where nome = 'Censo 2027'`,
    );
  });

  it("quem só vê o Censo lê respostas e temas, mas não os convites (tokens)", async () => {
    await db.exec(
      `set role authenticated; select set_config('request.jwt.claim.sub', '${ANA}', false);`,
    );
    try {
      expect(
        await valor("select count(*)::int from comercial.censo_respostas"),
      ).toBeGreaterThan(200);
      expect(
        await valor("select count(*)::int from comercial.censo_temas"),
      ).toBe(8);
      expect(
        await valor("select count(*)::int from comercial.censo_convites"),
      ).toBe(0);
    } finally {
      await db.exec(
        "reset role; select set_config('request.jwt.claim.sub', '', false);",
      );
    }
  });
});

describe("remover dados de exemplo", () => {
  it("apaga as rodadas, os convites, as respostas e os temas", async () => {
    await db.exec(
      `set role authenticated; select set_config('request.jwt.claim.sub', '${PARAMETROS}', false);`,
    );
    try {
      await db.query("select comercial.remover_exemplos()");
    } finally {
      await db.exec(
        "reset role; select set_config('request.jwt.claim.sub', '', false);",
      );
    }
    for (const t of [
      "censo_rodadas",
      "censo_convites",
      "censo_temas",
      "censo_sugestao_temas",
    ])
      expect(
        await valor(`select count(*)::int from comercial.${t} where exemplo`),
      ).toBe(0);
    // A resposta de teste (sem exemplo) saiu junto com a rodada de exemplo.
    expect(
      await valor("select count(*)::int from comercial.censo_respostas"),
    ).toBe(0);
  });
});
