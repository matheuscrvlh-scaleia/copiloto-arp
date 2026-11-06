// Módulo Calendário (20261106170000_calendario): permissões, tipos
// configuráveis, visibilidade (todos, restrito por setor/cargo/pessoa,
// privado), edição só do que é seu ou com editar_todos, e a conclusão.
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

const U = {
  gestor: "00000000-0000-0000-0000-0000000000c1",
  ana: "00000000-0000-0000-0000-0000000000c2",
  bia: "00000000-0000-0000-0000-0000000000c3",
  caio: "00000000-0000-0000-0000-0000000000c4",
  vetudo: "00000000-0000-0000-0000-0000000000c5",
  fora: "00000000-0000-0000-0000-0000000000c6",
};

const PERMISSOES: Record<keyof typeof U, string[]> = {
  gestor: [
    "calendario.ver",
    "calendario.criar",
    "calendario.editar_todos",
    "calendario.configurar",
  ],
  ana: ["calendario.ver", "calendario.criar"],
  bia: ["calendario.ver", "calendario.criar"],
  caio: ["calendario.ver"],
  vetudo: ["calendario.ver", "calendario.ver_todos"],
  fora: ["rh.painel"],
};

const SETOR = "00000000-0000-0000-0000-00000000ca01";
const CARGO = "00000000-0000-0000-0000-00000000cb01";

let db: PGlite;
let tipoEvento = "";
let tipoTarefa = "";

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

/** Títulos que a pessoa vê, em ordem. */
const vistos = (u: string) =>
  como(u, async () =>
    (
      await db.query<{ titulo: string }>(
        "select titulo from calendario.itens order by titulo",
      )
    ).rows.map((r) => r.titulo),
  );

/** Cria um item como `u` e devolve o id. */
async function criar(u: string, campos: string, valores: string) {
  return como(u, () =>
    valor<string>(
      `insert into calendario.itens (${campos}) values (${valores}) returning id`,
    ),
  );
}

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
  // Ana e Caio são do setor; Bia tem o cargo (sem permissões próprias).
  await db.query("insert into os.setores (id, nome) values ($1, 'Obras')", [
    SETOR,
  ]);
  await db.query(
    "insert into os.setor_membros (setor_id, usuario_id) values ($1, $2), ($1, $3)",
    [SETOR, U.ana, U.caio],
  );
  await db.query("insert into core.cargos (id, nome) values ($1, 'Teste')", [
    CARGO,
  ]);
  await db.query("update core.usuarios set cargo_id = $1 where id = $2", [
    CARGO,
    U.bia,
  ]);
  tipoEvento = await valor(
    "select id from calendario.tipos where nome = 'Evento'",
  );
  tipoTarefa = await valor(
    "select id from calendario.tipos where nome = 'Tarefa'",
  );
}, 180_000);

describe("ponto de partida", () => {
  it("cadastra as 5 permissões; Administrador tem todas e os outros cargos veem e criam", async () => {
    expect(
      await valor<number>(
        "select count(*)::int from core.permissoes where codigo like 'calendario.%'",
      ),
    ).toBe(5);
    expect(
      await valor<number>(
        `select count(*)::int from core.cargo_permissoes cp
         join core.cargos c on c.id = cp.cargo_id
         where c.nome = 'Administrador' and cp.permissao like 'calendario.%'`,
      ),
    ).toBe(5);
    expect(
      await valor<number>(
        `select count(*)::int from core.cargos c
         where c.nome <> 'Administrador' and c.id <> '${CARGO}'
           and not exists (select 1 from core.cargo_permissoes cp
             where cp.cargo_id = c.id and cp.permissao = 'calendario.ver')`,
      ),
    ).toBe(0);
  });

  it("começa com os tipos Evento, Reunião, Tarefa, Obra e Feriado e folga", async () => {
    const { rows } = await db.query<{ nome: string }>(
      "select nome from calendario.tipos order by ordem",
    );
    expect(rows.map((r) => r.nome)).toEqual([
      "Evento",
      "Reunião",
      "Tarefa",
      "Obra",
      "Feriado e folga",
    ]);
  });
});

describe("tipos", () => {
  it("só calendario.configurar cria e altera; quem vê o calendário lê", async () => {
    expect(
      await como(U.ana, () =>
        erro(
          "insert into calendario.tipos (nome, cor) values ('Treino', '#123456')",
        ),
      ),
    ).toMatch(/row-level security/);
    const id = await como(U.gestor, () =>
      valor<string>(
        "insert into calendario.tipos (nome, cor, icone) values ('Treinamento', '#123456', 'treinamento') returning id",
      ),
    );
    expect(
      await como(U.caio, () =>
        valor<number>(
          `select count(*)::int from calendario.tipos where id = '${id}'`,
        ),
      ),
    ).toBe(1);
    expect(
      await como(U.fora, () =>
        valor<number>("select count(*)::int from calendario.tipos"),
      ),
    ).toBe(0);
  });

  it("recusa cor fora do padrão e nome repetido", async () => {
    expect(
      await como(U.gestor, () =>
        erro("insert into calendario.tipos (nome, cor) values ('X', 'azul')"),
      ),
    ).toMatch(/check/);
    expect(
      await como(U.gestor, () =>
        erro(
          "insert into calendario.tipos (nome, cor) values (' evento ', '#000000')",
        ),
      ),
    ).toMatch(/duplicate|unique/);
  });

  it("tipo em uso não se exclui (inativa-se)", async () => {
    await criar(
      U.ana,
      "tipo_id, titulo, inicio, fim",
      `'${tipoEvento}', 'Uso do tipo', '2026-11-10', '2026-11-10'`,
    );
    expect(
      await como(U.gestor, () =>
        erro(`delete from calendario.tipos where id = '${tipoEvento}'`),
      ),
    ).toMatch(/foreign key/);
  });
});

describe("quem vê", () => {
  beforeAll(async () => {
    const base = "tipo_id, titulo, inicio, fim, visibilidade";
    await criar(
      U.ana,
      base,
      `'${tipoEvento}', 'A todos', '2026-11-10', '2026-11-10', 'todos'`,
    );
    await criar(
      U.ana,
      `${base}, setores`,
      `'${tipoEvento}', 'B setor', '2026-11-11', '2026-11-11', 'restrito', array['${SETOR}']::uuid[]`,
    );
    await criar(
      U.ana,
      `${base}, cargos`,
      `'${tipoEvento}', 'C cargo', '2026-11-12', '2026-11-12', 'restrito', array['${CARGO}']::uuid[]`,
    );
    await criar(
      U.ana,
      `${base}, usuarios`,
      `'${tipoEvento}', 'D pessoa', '2026-11-13', '2026-11-13', 'restrito', array['${U.vetudo}']::uuid[]`,
    );
    await criar(
      U.ana,
      base,
      `'${tipoEvento}', 'E privado', '2026-11-14', '2026-11-14', 'privado'`,
    );
    await criar(
      U.ana,
      `${base}, responsavel_id`,
      `'${tipoTarefa}', 'F privado com responsável', '2026-11-14', '2026-11-14', 'privado', '${U.bia}'`,
    );
  });

  it("quem criou vê tudo o que é seu", async () => {
    expect(await vistos(U.ana)).toEqual([
      "A todos",
      "B setor",
      "C cargo",
      "D pessoa",
      "E privado",
      "F privado com responsável",
      "Uso do tipo",
    ]);
  });

  it("o setor vê o restrito ao setor; o cargo, o do cargo; a pessoa, o dela", async () => {
    expect(await vistos(U.caio)).toEqual(["A todos", "B setor", "Uso do tipo"]);
    expect(await vistos(U.bia)).toEqual([
      "A todos",
      "C cargo",
      "F privado com responsável",
      "Uso do tipo",
    ]);
  });

  it("ver_todos vê os restritos, mas nunca o privado de outra pessoa", async () => {
    expect(await vistos(U.vetudo)).toEqual([
      "A todos",
      "B setor",
      "C cargo",
      "D pessoa",
      "Uso do tipo",
    ]);
  });

  it("sem calendario.ver não vê nada", async () => {
    expect(await vistos(U.fora)).toEqual([]);
  });

  it("restrito precisa de ao menos um setor, cargo ou pessoa", async () => {
    expect(
      await como(U.ana, () =>
        erro(
          `insert into calendario.itens (tipo_id, titulo, inicio, fim, visibilidade)
           values ('${tipoEvento}', 'Vazio', '2026-11-10', '2026-11-10', 'restrito')`,
        ),
      ),
    ).toMatch(/check/);
  });
});

describe("criar, editar e excluir", () => {
  it("sem calendario.criar não cria; ninguém cria em nome de outro", async () => {
    expect(
      await como(U.caio, () =>
        erro(
          `insert into calendario.itens (tipo_id, titulo, inicio, fim)
           values ('${tipoEvento}', 'X', '2026-11-10', '2026-11-10')`,
        ),
      ),
    ).toMatch(/row-level security/);
    expect(
      await como(U.ana, () =>
        erro(
          `insert into calendario.itens (tipo_id, titulo, inicio, fim, criado_por)
           values ('${tipoEvento}', 'X', '2026-11-10', '2026-11-10', '${U.bia}')`,
        ),
      ),
    ).toMatch(/permission denied/);
  });

  it("recusa fim antes do início e hora final antes da inicial", async () => {
    const tenta = (campos: string) =>
      como(U.ana, () =>
        erro(
          `insert into calendario.itens (tipo_id, titulo, inicio, fim, hora_inicio, hora_fim)
           values ('${tipoEvento}', 'X', ${campos})`,
        ),
      );
    expect(await tenta("'2026-11-10', '2026-11-09', null, null")).toMatch(
      /check/,
    );
    expect(await tenta("'2026-11-10', '2026-11-10', '10:00', '09:00'")).toMatch(
      /check/,
    );
    expect(
      await tenta("'2026-11-10', '2026-11-11', '10:00', '09:00'"),
    ).toBeNull();
  });

  it("cada um edita e exclui o seu; editar_todos mexe no dos outros, menos no privado", async () => {
    const id = await criar(
      U.ana,
      "tipo_id, titulo, inicio, fim",
      `'${tipoEvento}', 'Editável', '2026-11-20', '2026-11-20'`,
    );
    const privado = await criar(
      U.ana,
      "tipo_id, titulo, inicio, fim, visibilidade",
      `'${tipoEvento}', 'Só da Ana', '2026-11-20', '2026-11-20', 'privado'`,
    );
    const muda = (u: string, alvo: string) =>
      como(u, () =>
        valor<number>(
          `with m as (update calendario.itens set titulo = 'Mudou' where id = '${alvo}' returning 1)
           select count(*)::int from m`,
        ),
      );
    expect(await muda(U.bia, id)).toBe(0);
    expect(await muda(U.gestor, privado)).toBe(0);
    expect(await muda(U.gestor, id)).toBe(1);
    expect(await muda(U.ana, privado)).toBe(1);
    expect(
      await como(U.ana, () =>
        erro(
          `update calendario.itens set criado_por = '${U.bia}' where id = '${id}'`,
        ),
      ),
    ).toMatch(/permission denied/);
    await como(U.bia, () =>
      db.query(`delete from calendario.itens where id = '${id}'`),
    );
    expect(
      await valor<number>(
        `select count(*)::int from calendario.itens where id = '${id}'`,
      ),
    ).toBe(1);
    await como(U.gestor, () =>
      db.query(`delete from calendario.itens where id = '${id}'`),
    );
    expect(
      await valor<number>(
        `select count(*)::int from calendario.itens where id = '${id}'`,
      ),
    ).toBe(0);
  });

  it("não cria em tipo inativo", async () => {
    const tipo = await como(U.gestor, () =>
      valor<string>(
        "insert into calendario.tipos (nome, cor, ativo) values ('Antigo', '#111111', false) returning id",
      ),
    );
    expect(
      await como(U.ana, () =>
        erro(
          `insert into calendario.itens (tipo_id, titulo, inicio, fim)
           values ('${tipo}', 'X', '2026-11-10', '2026-11-10')`,
        ),
      ),
    ).toMatch(/row-level security/);
  });

  it("grava na auditoria", async () => {
    expect(
      await valor<number>(
        "select count(*)::int from core.auditoria where tabela = 'calendario.itens'",
      ),
    ).toBeGreaterThan(0);
  });
});

describe("concluir", () => {
  it("o responsável conclui mesmo sem calendario.criar; os outros, não", async () => {
    const id = await criar(
      U.ana,
      "tipo_id, titulo, inicio, fim, responsavel_id, visibilidade",
      `'${tipoTarefa}', 'Tarefa do Caio', '2026-11-21', '2026-11-21', '${U.caio}', 'todos'`,
    );
    expect(
      await como(U.bia, () =>
        erro(`select calendario.concluir('${id}', true)`),
      ),
    ).toMatch(/só quem criou/);
    await como(U.caio, () =>
      db.query(`select calendario.concluir('${id}', true)`),
    );
    expect(
      await valor<string>(
        `select concluido_por from calendario.itens where id = '${id}'`,
      ),
    ).toBe(U.caio);
    await como(U.gestor, () =>
      db.query(`select calendario.concluir('${id}', false)`),
    );
    expect(
      await valor<string | null>(
        `select concluido_em from calendario.itens where id = '${id}'`,
      ),
    ).toBeNull();
  });

  it("tipo sem conclusão e item que repete não se concluem", async () => {
    const evento = await criar(
      U.ana,
      "tipo_id, titulo, inicio, fim",
      `'${tipoEvento}', 'Evento qualquer', '2026-11-21', '2026-11-21'`,
    );
    expect(
      await como(U.ana, () =>
        erro(`select calendario.concluir('${evento}', true)`),
      ),
    ).toMatch(/não se conclui/);
    const serie = await criar(
      U.ana,
      "tipo_id, titulo, inicio, fim, recorrencia",
      `'${tipoTarefa}', 'Toda semana', '2026-11-21', '2026-11-21', 'semanal'`,
    );
    expect(
      await como(U.ana, () =>
        erro(`select calendario.concluir('${serie}', true)`),
      ),
    ).toMatch(/repete/);
  });
});
