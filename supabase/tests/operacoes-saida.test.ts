// Saída do ativo (20261109160700_operacoes_saida): listas nos parâmetros do
// Chamados, sobra sem cadastro numa transação só, planos que param, ativo
// que não volta a uso sem desfazer a saída e não recebe chamado nem OS, e
// os feriados liberados para quem usa Operações (prazo do rateio no Painel).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const MIGRATIONS = join(import.meta.dirname, "..", "migrations");

const SUPABASE_MINIMO = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated') $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant execute on function auth.role() to anon, authenticated, service_role;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema storage to authenticated;
  grant select, insert on storage.objects to authenticated;
`;

const U = {
  saida: "00000000-0000-0000-0000-0000000000e1",
  gerente: "00000000-0000-0000-0000-0000000000e2",
  operacoes: "00000000-0000-0000-0000-0000000000e3",
  fora: "00000000-0000-0000-0000-0000000000e4",
};

const PERMISSOES: Record<keyof typeof U, string[]> = {
  saida: ["os.ativos", "os.ativos_saida"],
  gerente: ["os.ativos", "os.ativos_gerenciar"],
  operacoes: ["operacoes.painel"],
  fora: ["rh.painel"],
};

let db: PGlite;
let setor: string;

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
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub', '${usuario}', false);`,
  );
  try {
    return await fn();
  } finally {
    await db.exec(
      "reset role; select set_config('request.jwt.claim.sub', '', false);",
    );
  }
}

const novoAtivo = (nome: string) =>
  valor<string>(`insert into os.ativos (nome) values ('${nome}') returning id`);

/** Saída simples (descarte), como quem tem os.ativos_saida. */
const registrarSaida = (ativo: string, tipo = "Descarte") =>
  como(U.saida, () =>
    valor<string>(
      `select os.registrar_saida_ativo('${ativo}', '${tipo}', '2026-11-05', null, null, null,
         null, null, null, null, null, false, null, null)`,
    ),
  );

const sobra = (nome: string, extra = "") =>
  `select * from os.registrar_saida_sobra('${nome}', null, '05', 'Canteiro', 'Venda',
     '2026-11-07', '40 telhas', 120, 'PIX', 'Fulano de Tal', 'Comprador Fictício', null,
     null, 'Sobra da obra', false, null, null${extra})`;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_MINIMO);
  for (const f of readdirSync(MIGRATIONS).sort()) {
    if (f.endsWith(".sql"))
      await db.exec(readFileSync(join(MIGRATIONS, f), "utf8"));
  }
  for (const [nome, id] of Object.entries(U)) {
    await db.query("insert into auth.users (id, email) values ($1, $2)", [
      id,
      `${nome}@arp.test`,
    ]);
    for (const p of PERMISSOES[nome as keyof typeof U]) {
      await db.query(
        "insert into core.usuario_permissoes (usuario_id, permissao) values ($1, $2)",
        [id, p],
      );
    }
  }
  setor = await valor<string>(
    "insert into os.setores (nome) values ('Manutenção (teste)') returning id",
  );
}, 180_000);

describe("parâmetros do Chamados", () => {
  it("tipos de saída e formas de recebimento vêm com a lista da spec", async () => {
    expect(
      await valor<string[]>("select ativos_saida_tipos from os.parametros"),
    ).toEqual(["Venda", "Doação", "Descarte", "Devolução", "Outro"]);
    expect(
      await valor<string[]>("select ativos_saida_formas from os.parametros"),
    ).toEqual(["Dinheiro", "PIX", "Outro"]);
  });

  it("lista vazia não é aceita", async () => {
    expect(
      await erro("update os.parametros set ativos_saida_tipos = '{}'"),
    ).toMatch(/check/);
  });
});

describe("sobra sem cadastro", () => {
  it("cria o ativo já baixado, com a saída, numa chamada só", async () => {
    const { rows } = await como(U.saida, () =>
      db.query<{ ativo_id: string; saida_id: string }>(
        sobra("Telhas de amianto"),
      ),
    );
    const ids = rows[0];
    expect(ids?.ativo_id).toBeTruthy();
    expect(
      await valor<string>(
        `select situacao || ' – ' || baixa_motivo || ' – ' || bloco from os.ativos where id = '${ids?.ativo_id}'`,
      ),
    ).toBe("baixado – Vendido – 05");
    expect(
      await valor<string>(
        `select tipo || ' ' || quantidade || ' ' || valor from os.ativo_saidas where id = '${ids?.saida_id}'`,
      ),
    ).toBe("Venda 40 telhas 120.00");
  });

  it("sem a permissão de saída não cria nada", async () => {
    const antes = await valor<number>("select count(*)::int from os.ativos");
    expect(await como(U.gerente, () => erro(sobra("Portas velhas")))).toMatch(
      /sem permissão/,
    );
    expect(await como(U.fora, () => erro(sobra("Portas velhas")))).toMatch(
      /sem permissão|permission denied/,
    );
    expect(await valor<number>("select count(*)::int from os.ativos")).toBe(
      antes,
    );
  });

  it("venda sem valor desfaz também o ativo criado", async () => {
    const antes = await valor<number>("select count(*)::int from os.ativos");
    expect(
      await como(U.saida, () =>
        erro(
          `select * from os.registrar_saida_sobra('Sucata', null, null, null, 'Venda',
             '2026-11-07', null, null, null, null, null, null, null, null, false, null, null)`,
        ),
      ),
    ).toMatch(/check/);
    expect(await valor<number>("select count(*)::int from os.ativos")).toBe(
      antes,
    );
  });
});

describe("ativo que saiu", () => {
  it("os planos preventivos param na saída", async () => {
    const ativo = await novoAtivo("Bomba de recalque 2");
    await db.query(
      `insert into os.planos_preventivos (ativo_id, titulo, frequencia_dias, proxima_data, setor_id)
       values ('${ativo}', 'Revisão', 30, '2026-12-01', '${setor}')`,
    );
    await registrarSaida(ativo);
    expect(
      await valor<boolean>(
        `select bool_or(ativo) from os.planos_preventivos where ativo_id = '${ativo}'`,
      ),
    ).toBe(false);
  });

  it("não volta a uso pelo Reativar; volta ao desfazer a saída", async () => {
    const ativo = await novoAtivo("Ar-condicionado sala 3");
    const saida = await registrarSaida(ativo, "Doação");
    expect(
      await como(U.gerente, () =>
        erro(
          `update os.ativos set situacao = 'em_uso', baixa_data = null, baixa_motivo = null
           where id = '${ativo}'`,
        ),
      ),
    ).toMatch(/desfaça a saída/);
    await como(U.saida, () =>
      db.query(
        `select os.desfazer_saida_ativo('${saida}', 'Doação cancelada pelo recebedor')`,
      ),
    );
    expect(
      await valor<string>(
        `select situacao from os.ativos where id = '${ativo}'`,
      ),
    ).toBe("em_uso");
  });

  it("a baixa comum (sem saída) continua podendo ser reativada", async () => {
    const ativo = await novoAtivo("Mesa de reunião");
    await db.query(
      `update os.ativos set situacao = 'baixado', baixa_data = '2026-11-01',
         baixa_motivo = 'Quebrada' where id = '${ativo}'`,
    );
    expect(
      await como(U.gerente, () =>
        erro(
          `update os.ativos set situacao = 'em_uso', baixa_data = null, baixa_motivo = null
           where id = '${ativo}'`,
        ),
      ),
    ).toBeNull();
  });

  it("ativo baixado não recebe chamado nem OS", async () => {
    const ativo = await novoAtivo("Portão antigo");
    await registrarSaida(ativo);
    expect(
      await erro(
        `insert into os.chamados (tipo, titulo, setor_id, ativo_id)
         values ('solicitacao', 'Consertar', '${setor}', '${ativo}')`,
      ),
    ).toMatch(/baixado/);
    expect(
      await erro(
        `insert into os.ordens (titulo, setor_id, ativo_id)
         values ('Consertar', '${setor}', '${ativo}')`,
      ),
    ).toMatch(/baixado/);
    const ordem = await valor<string>(
      `insert into os.ordens (titulo, setor_id) values ('Outra', '${setor}') returning id`,
    );
    expect(
      await erro(
        `update os.ordens set ativo_id = '${ativo}' where id = '${ordem}'`,
      ),
    ).toMatch(/baixado/);
    const emUso = await novoAtivo("Bomba nova");
    expect(
      await erro(
        `insert into os.ordens (titulo, setor_id, ativo_id)
         values ('Revisar', '${setor}', '${emUso}')`,
      ),
    ).toBeNull();
  });
});

describe("feriados", () => {
  it("quem usa Operações lê os feriados; quem não usa, não", async () => {
    await db.query(
      "insert into os.feriados (data, nome) values ('2026-11-20', 'Consciência Negra') on conflict do nothing",
    );
    expect(
      await como(U.operacoes, () =>
        valor<number>("select count(*)::int from os.feriados"),
      ),
    ).toBeGreaterThan(0);
    expect(
      await como(U.fora, () =>
        valor<number>("select count(*)::int from os.feriados"),
      ),
    ).toBe(0);
  });
});
