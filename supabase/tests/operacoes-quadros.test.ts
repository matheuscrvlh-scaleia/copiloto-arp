// Quadros de medidores e termo de energia (20261109160200_operacoes_quadros
// e o exemplo 20261109160250): contagem do catálogo (8 quadros, 315 caixas,
// 169/143/3), resumo por quadro com o RLS de quem lê, contratos do ENET só
// para quem vê os quadros, versão do termo que zera "locatário novo",
// caixa liberada indo para o histórico e a remoção dos exemplos.
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
  editor: "00000000-0000-0000-0000-0000000000e1",
  termo: "00000000-0000-0000-0000-0000000000e2",
  ver: "00000000-0000-0000-0000-0000000000e3",
  fora: "00000000-0000-0000-0000-0000000000e4",
  parametros: "00000000-0000-0000-0000-0000000000e5",
};

const PERMISSOES: Record<keyof typeof U, string[]> = {
  editor: [
    "operacoes.energia.ver",
    "operacoes.energia.editar",
    "operacoes.energia.historico",
  ],
  termo: ["operacoes.energia.ver", "operacoes.energia.termo"],
  ver: ["operacoes.energia.ver"],
  fora: ["rh.painel"],
  parametros: ["operacoes.parametros"],
};

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

/** Chamada de registrar_termo com o essencial preenchido. */
const termo = (caixa: string, versao: number, pasta = caixa) =>
  `select operacoes.registrar_termo('${caixa}', ${versao}, 'Loja Teste', '00.000.000/0001-00',
     'pessoa jurídica, locatária', 'Bloco 12', '1º pavimento (térreo)', 'Sala 104', 'PE 1',
     40, 'Monofásica', '16', '14-250-1', null, '2026-11-09',
     'energia/termos/${pasta}/v${versao}.pdf', 'energia/termos/${pasta}/v${versao}.docx')`;

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
}, 180_000);

describe("exemplo: quadros do catálogo", () => {
  it("8 quadros e 315 caixas: 169 ocupadas, 143 livres, 3 reservadas", async () => {
    const { rows } = await db.query<{ status: string; n: number }>(
      `select c.status, count(*)::int as n from operacoes.caixas c
       join operacoes.quadros q on q.id = c.quadro_id where q.exemplo
       group by c.status order by c.status`,
    );
    expect(
      await valor<number>(
        "select count(*)::int from operacoes.quadros where exemplo",
      ),
    ).toBe(8);
    expect(Object.fromEntries(rows.map((r) => [r.status, r.n]))).toEqual({
      livre: 143,
      ocupado: 169,
      reservado: 3,
    });
  });

  it("caixas e ocupadas por bloco iguais à tabela de 4.5", async () => {
    const { rows } = await db.query<{ bloco: string; t: number; o: number }>(
      `select q.bloco, count(*)::int as t,
         (count(*) filter (where c.status = 'ocupado'))::int as o
       from operacoes.caixas c join operacoes.quadros q on q.id = c.quadro_id
       where q.exemplo group by q.bloco order by q.bloco`,
    );
    expect(rows.map((r) => [r.bloco, r.t, r.o])).toEqual([
      ["01", 63, 37],
      ["02", 27, 8],
      ["04", 48, 26],
      ["05", 48, 17],
      ["09", 45, 13],
      ["10", 24, 23],
      ["11", 36, 34],
      ["12", 24, 11],
    ]);
  });

  it("posições sem sobreposição, uma troca pendente e salas sem caixa", async () => {
    expect(
      await valor<number>(
        `select count(*)::int from (
           select quadro_id, lado, coluna, linha from operacoes.caixas
           group by 1, 2, 3, 4 having count(*) > 1) d`,
      ),
    ).toBe(0);
    expect(
      await valor<string>(
        "select ocupante from operacoes.caixas where locatario_novo",
      ),
    ).toBe("Ateliê Serrano");
    expect(
      await valor<number>(
        `select count(*)::int from operacoes.salas s where s.exemplo
         and not exists (select 1 from operacoes.caixas c where c.sala_id = s.id)`,
      ),
    ).toBe(7);
    expect(
      await valor<number>(
        "select count(*)::int from operacoes.caixa_ocupantes",
      ),
    ).toBeGreaterThan(10);
  });
});

describe("resumo por quadro", () => {
  it("segue o RLS de quem lê e conta o locatário novo como sem termo", async () => {
    const b12 = await como(U.ver, () =>
      db.query<{
        caixas: number;
        ocupadas: number;
        sem_termo: number;
        locatarios_novos: number;
      }>(
        `select r.* from jsonb_to_recordset(operacoes.resumo_quadros()) as r(
           quadro_id uuid, caixas int, ocupadas int, sem_termo int, locatarios_novos int)
         join operacoes.quadros q on q.id = r.quadro_id where q.codigo = 'b12'`,
      ),
    );
    expect(b12.rows[0]).toMatchObject({
      caixas: 24,
      ocupadas: 11,
      locatarios_novos: 1,
    });
    expect(b12.rows[0]?.sem_termo).toBeGreaterThanOrEqual(1);
    expect(
      await como(U.fora, () =>
        valor<number>("select jsonb_array_length(operacoes.resumo_quadros())"),
      ),
    ).toBe(0);
  });
});

describe("ENET: contratos vigentes", () => {
  it("só quem vê os quadros ou emite o termo lê; só vigentes com locatário", async () => {
    await db.exec(`
      insert into os.lojas (luc, nome, locatario, cnpj, bloco, situacao, inicio) values
        ('12_104', 'Sala 104', 'Ateliê Serrano', '00.000.901/0001-00', '12', 'vigente', '2026-11-03'),
        ('12_105', 'Sala 105', 'Antiga', null, '12', 'encerrado', '2020-01-01'),
        ('12_106', 'Sala 106', null, null, '12', 'vigente', null);
    `);
    const lidas = await como(U.termo, () =>
      db.query<{ luc: string; documento: string }>(
        "select e->>'luc' as luc, e->>'documento' as documento from jsonb_array_elements(operacoes.enet_contratos()) e",
      ),
    );
    expect(lidas.rows).toEqual([
      { luc: "12_104", documento: "00.000.901/0001-00" },
    ]);
    expect(
      await como(U.fora, () =>
        valor<number>("select jsonb_array_length(operacoes.enet_contratos())"),
      ),
    ).toBe(0);
  });
});

describe("termo de autorização", () => {
  let caixa = "";

  beforeAll(async () => {
    caixa = await valor<string>(
      "select id from operacoes.caixas where locatario_novo",
    );
  });

  it("quem só vê não emite; arquivo fora da pasta da caixa é recusado", async () => {
    expect(await como(U.ver, () => erro(termo(caixa, 1)))).toMatch(
      /sem permissão/,
    );
    expect(
      await como(U.termo, () => erro(termo(caixa, 1, "outra-pasta"))),
    ).toMatch(/fora da pasta/);
  });

  it("grava a versão 1, zera o locatário novo e recusa versão repetida", async () => {
    expect(await como(U.termo, () => erro(termo(caixa, 1)))).toBeNull();
    expect(
      await valor<boolean>(
        `select locatario_novo from operacoes.caixas where id = '${caixa}'`,
      ),
    ).toBe(false);
    expect(await como(U.termo, () => erro(termo(caixa, 1)))).toMatch(
      /acabou de ser emitido/,
    );
    expect(await como(U.termo, () => erro(termo(caixa, 2)))).toBeNull();
    expect(
      await como(U.ver, () =>
        valor<number>(
          `select max(versao) from operacoes.termos where caixa_id = '${caixa}'`,
        ),
      ),
    ).toBe(2);
    expect(
      await como(U.ver, () =>
        valor<number>(`select operacoes.proxima_versao_termo('${caixa}')`),
      ),
    ).toBe(3);
  });

  it("termo não se altera nem se apaga pela sessão", async () => {
    expect(
      await como(U.termo, () =>
        erro(
          `update operacoes.termos set locatario = 'X' where caixa_id = '${caixa}'`,
        ),
      ),
    ).toMatch(/permission denied/);
  });
});

describe("caixa: termo da carga e liberar", () => {
  let caixa = "";

  beforeAll(async () => {
    caixa = await valor<string>(
      `select c.id from operacoes.caixas c join operacoes.quadros q on q.id = c.quadro_id
       where q.codigo = 'b10' and c.status = 'ocupado' and c.termo_externo
       order by c.numero limit 1`,
    );
  });

  it("quem edita marca o termo da carga; quem só vê não", async () => {
    expect(
      await como(U.ver, () =>
        valor<number>(
          `with u as (update operacoes.caixas set termo_externo = false
             where id = '${caixa}' returning 1) select count(*)::int from u`,
        ),
      ),
    ).toBe(0);
    expect(
      await como(U.editor, () =>
        erro(
          `update operacoes.caixas set termo_externo = true where id = '${caixa}'`,
        ),
      ),
    ).toBeNull();
  });

  it("trocar o locatário tira o termo da carga", async () => {
    await como(U.editor, () =>
      db.query(
        `select operacoes.trocar_locatario('${caixa}', 'Loja Nova Teste', null, '2026-11-01', null, 'enet')`,
      ),
    );
    expect(
      await valor<boolean>(
        `select termo_externo from operacoes.caixas where id = '${caixa}'`,
      ),
    ).toBe(false);
  });

  it("liberar manda o ocupante para o histórico e deixa a caixa livre", async () => {
    expect(
      await como(U.termo, () =>
        erro(`select operacoes.liberar_caixa('${caixa}', '2026-11-05')`),
      ),
    ).toMatch(/sem permissão/);
    await como(U.editor, () =>
      db.query(`select operacoes.liberar_caixa('${caixa}', '2026-11-05')`),
    );
    const { rows } = await db.query<{
      status: string;
      ocupante: string | null;
      locatario_novo: boolean;
    }>(
      `select status, ocupante, locatario_novo from operacoes.caixas where id = '${caixa}'`,
    );
    expect(rows[0]).toEqual({
      status: "livre",
      ocupante: null,
      locatario_novo: false,
    });
    expect(
      await como(U.editor, () =>
        valor<string>(
          `select saida::text from operacoes.caixa_ocupantes
           where caixa_id = '${caixa}' and nome = 'Loja Nova Teste'`,
        ),
      ),
    ).toBe("2026-11-05");
    expect(
      await como(U.editor, () =>
        erro(`select operacoes.liberar_caixa('${caixa}', '2026-11-05')`),
      ),
    ).toMatch(/não tem ocupante/);
  });
});

describe("remover exemplos", () => {
  it("apaga quadros, caixas, histórico e salas de exemplo", async () => {
    await como(U.parametros, () =>
      db.query("select operacoes.remover_exemplos()"),
    );
    expect(
      await valor<number>(
        `select (select count(*) from operacoes.quadros)
              + (select count(*) from operacoes.caixas)
              + (select count(*) from operacoes.caixa_ocupantes)
              + (select count(*) from operacoes.salas where exemplo)`,
      ),
    ).toBe(0);
  });
});
