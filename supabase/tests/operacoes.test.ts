// Módulo Operações (20261109160000_operacoes): permissões, RLS por área,
// valores da água escondidos sem a permissão, importação em prévia →
// confirmada → desfeita (o mês anterior volta), rateio fechado não muda,
// histórico de ocupantes sigiloso e a saída do ativo nos Chamados.
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
  agua: "00000000-0000-0000-0000-0000000000d1",
  aguaSemValor: "00000000-0000-0000-0000-0000000000d2",
  energia: "00000000-0000-0000-0000-0000000000d3",
  energiaVer: "00000000-0000-0000-0000-0000000000d4",
  limpeza: "00000000-0000-0000-0000-0000000000d5",
  ativos: "00000000-0000-0000-0000-0000000000d6",
  fora: "00000000-0000-0000-0000-0000000000d7",
};

const PERMISSOES: Record<keyof typeof U, string[]> = {
  agua: [
    "operacoes.agua.ver",
    "operacoes.agua.valores",
    "operacoes.agua.importar",
  ],
  aguaSemValor: ["operacoes.agua.ver"],
  energia: [
    "operacoes.energia.ver",
    "operacoes.energia.editar",
    "operacoes.energia.historico",
  ],
  energiaVer: ["operacoes.energia.ver"],
  limpeza: ["operacoes.limpeza.ver", "operacoes.limpeza.fechar"],
  ativos: ["os.ativos", "os.ativos_saida"],
  fora: ["rh.painel"],
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

/** Cria uma prévia de água com uma leitura e o valor, como `agua`. */
async function previaAgua(mes: string, consumo: number, bate = true) {
  return como(U.agua, async () => {
    const id = await valor<string>(
      `insert into operacoes.importacoes (tipo, referencia, bate, criado_por)
       values ('agua', '${mes}', ${bate}, '${U.agua}') returning id`,
    );
    const leitura = await valor<string>(
      `insert into operacoes.agua_leituras
         (importacao_id, referencia, bloco, sala, hidrometro, consumo, volume_faturado, tipo)
       values ('${id}', '${mes}', '05', '101', 'H-1', ${consumo}, ${consumo}, 'FATURADO')
       returning id`,
    );
    await db.query(
      `insert into operacoes.agua_valores (leitura_id, valor) values ('${leitura}', ${consumo * 10})`,
    );
    return id;
  });
}

const consumoVigente = (u: string) =>
  como(u, () =>
    valor<string | null>(
      "select max(consumo)::text from operacoes.agua_leituras where vigente and referencia = '2026-09-01'",
    ),
  );

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

describe("ponto de partida", () => {
  it("cadastra as 19 permissões de Operações e a de saída do ativo; Administrador tem todas", async () => {
    expect(
      await valor<number>(
        "select count(*)::int from core.permissoes where codigo like 'operacoes.%'",
      ),
    ).toBe(19);
    expect(
      await valor<number>(
        `select count(*)::int from core.cargo_permissoes cp
         join core.cargos c on c.id = cp.cargo_id
         where c.nome = 'Administrador'
           and (cp.permissao like 'operacoes.%' or cp.permissao = 'os.ativos_saida')`,
      ),
    ).toBe(20);
  });

  it("toda tabela de operacoes tem RLS", async () => {
    expect(
      await valor<number>(
        `select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'operacoes' and c.relkind = 'r' and not c.relrowsecurity`,
      ),
    ).toBe(0);
  });

  it("parâmetros: quem usa o módulo lê, quem não usa não vê; só operacoes.parametros edita", async () => {
    expect(
      await como(U.aguaSemValor, () =>
        valor<string>("select agua_limite_m3::text from operacoes.parametros"),
      ),
    ).toBe("30.00");
    expect(
      await como(U.fora, () =>
        valor<number>("select count(*)::int from operacoes.parametros"),
      ),
    ).toBe(0);
    await como(U.agua, () =>
      db.query("update operacoes.parametros set agua_limite_m3 = 99"),
    );
    expect(
      await valor<string>("select agua_limite_m3::text from operacoes.parametros"),
    ).toBe("30.00");
  });
});

describe("água: importação, confirmação e desfazer", () => {
  it("prévia não aparece para quem só vê; confirmada aparece", async () => {
    const id = await previaAgua("2026-09-01", 12);
    expect(await consumoVigente(U.aguaSemValor)).toBeNull();
    await como(U.agua, () =>
      db.query(`select operacoes.confirmar_importacao('${id}')`),
    );
    expect(await consumoVigente(U.aguaSemValor)).toBe("12.000");
  });

  it("sem operacoes.agua.valores a pessoa vê m³, mas não os reais", async () => {
    const reais = (u: string) =>
      como(u, () =>
        valor<number>("select count(*)::int from operacoes.agua_valores"),
      );
    expect(await reais(U.aguaSemValor)).toBe(0);
    expect(await reais(U.agua)).toBeGreaterThan(0);
  });

  it("reimportar o mês substitui; desfazer volta ao anterior", async () => {
    const nova = await previaAgua("2026-09-01", 20);
    await como(U.agua, () =>
      db.query(`select operacoes.confirmar_importacao('${nova}')`),
    );
    expect(await consumoVigente(U.agua)).toBe("20.000");
    await como(U.agua, () =>
      db.query(`select operacoes.desfazer_importacao('${nova}')`),
    );
    expect(await consumoVigente(U.agua)).toBe("12.000");
    expect(
      await valor<string>(
        `select status from operacoes.importacoes where id = '${nova}'`,
      ),
    ).toBe("desfeita");
  });

  it("mês que não bate só entra com motivo, e fica marcado incompleto", async () => {
    const id = await previaAgua("2026-10-01", 5, false);
    expect(
      await como(U.agua, () =>
        erro(`select operacoes.confirmar_importacao('${id}')`),
      ),
    ).toMatch(/motivo/);
    await como(U.agua, () =>
      db.query(
        `select operacoes.confirmar_importacao('${id}', 'Bloco 05 veio pela metade')`,
      ),
    );
    expect(
      await valor<boolean>(
        `select incompleta from operacoes.importacoes where id = '${id}'`,
      ),
    ).toBe(true);
  });

  it("quem só vê não importa nem confirma", async () => {
    expect(
      await como(U.aguaSemValor, () =>
        erro(
          `insert into operacoes.importacoes (tipo, referencia, criado_por)
           values ('agua', '2026-11-01', '${U.aguaSemValor}')`,
        ),
      ),
    ).toMatch(/row-level security/);
  });
});

describe("energia: caixas e histórico sigiloso", () => {
  let caixa = "";

  it("quem edita cria quadro e caixa; quem só vê não muda", async () => {
    caixa = await como(U.energia, async () => {
      const q = await valor<string>(
        "insert into operacoes.quadros (codigo, nome, bloco) values ('t1', 'Teste', '04') returning id",
      );
      return valor<string>(
        `insert into operacoes.caixas (quadro_id, numero, ocupante, status)
         values ('${q}', '1', 'Loja Antiga', 'ocupado') returning id`,
      );
    });
    await como(U.energiaVer, () =>
      db.query(`update operacoes.caixas set status = 'livre' where id = '${caixa}'`),
    );
    expect(
      await valor<string>(`select status from operacoes.caixas where id = '${caixa}'`),
    ).toBe("ocupado");
  });

  it("o ocupante não muda direto, só pela troca de locatário", async () => {
    expect(
      await como(U.energia, () =>
        erro(`update operacoes.caixas set ocupante = 'X' where id = '${caixa}'`),
      ),
    ).toMatch(/permission denied/);
  });

  it("trocar o locatário manda o anterior para o histórico, sem repetir nome", async () => {
    await como(U.energia, async () => {
      await db.query(
        `select operacoes.trocar_locatario('${caixa}', 'Loja Nova', '123', '2026-09-01')`,
      );
      await db.query(
        `select operacoes.trocar_locatario('${caixa}', 'Loja Antiga', null, '2026-10-01')`,
      );
      await db.query(
        `select operacoes.trocar_locatario('${caixa}', 'Loja Nova', '123', '2026-11-01')`,
      );
    });
    const historico = (u: string) =>
      como(u, async () =>
        (
          await db.query<{ nome: string }>(
            `select nome from operacoes.caixa_ocupantes where caixa_id = '${caixa}' order by nome`,
          )
        ).rows.map((r) => r.nome),
      );
    expect(await historico(U.energia)).toEqual(["Loja Antiga", "Loja Nova"]);
    expect(await historico(U.energiaVer)).toEqual([]);
    expect(
      await valor<boolean>(
        `select locatario_novo from operacoes.caixas where id = '${caixa}'`,
      ),
    ).toBe(true);
  });
});

describe("rateio da limpeza", () => {
  it("fecha só completo; fechado não muda; reabre com motivo", async () => {
    await como(U.limpeza, async () => {
      await db.query(
        `insert into operacoes.limpeza_meses (referencia, valor_base, func_base, func_area_comum, func_rateados, criado_por)
         values ('2026-09-01', 75657.43, 9, 5, 4, '${U.limpeza}')`,
      );
      expect(
        await erro("select operacoes.limpeza_fechar('2026-09-01')"),
      ).toMatch(/minutos/);
      await db.query(
        "insert into operacoes.limpeza_minutos (referencia, bloco, limpeza, manutencao) values ('2026-09-01', '01', 180, 0)",
      );
      await db.query("select operacoes.limpeza_fechar('2026-09-01')");
      await db.query(
        "update operacoes.limpeza_minutos set limpeza = 999 where referencia = '2026-09-01'",
      );
      expect(
        await erro(
          "insert into operacoes.limpeza_minutos (referencia, bloco, limpeza) values ('2026-09-01', '02', 10)",
        ),
      ).toMatch(/row-level security/);
      expect(
        await erro("select operacoes.limpeza_reabrir('2026-09-01', '')"),
      ).toMatch(/motivo/);
      await db.query("select operacoes.limpeza_enviar('2026-09-01')");
      await db.query(
        "select operacoes.limpeza_reabrir('2026-09-01', 'Minutos do bloco 02 errados')",
      );
    });
    expect(
      await valor<string>(
        "select limpeza::text from operacoes.limpeza_minutos where referencia = '2026-09-01' and bloco = '01'",
      ),
    ).toBe("180");
    expect(
      await valor<string>(
        "select status || coalesce(enviado_em::text, '-') from operacoes.limpeza_meses where referencia = '2026-09-01'",
      ),
    ).toBe("aberto-");
  });

  it("quem não tem a permissão não vê o rateio", async () => {
    expect(
      await como(U.fora, () =>
        valor<number>("select count(*)::int from operacoes.limpeza_meses"),
      ),
    ).toBe(0);
  });
});

describe("chamados: saída do ativo", () => {
  it("registra a saída, baixa o ativo e desfaz com motivo", async () => {
    const ativo = await valor<string>(
      "insert into os.ativos (nome) values ('Bomba antiga') returning id",
    );
    const saida = await como(U.ativos, () =>
      valor<string>(
        `select os.registrar_saida_ativo('${ativo}', 'Venda', '2026-11-05', '1', 350, 'Pix',
           'Fulano', 'Comprador', '000', null, null, false, null, null)`,
      ),
    );
    expect(
      await valor<string>(
        `select situacao || ' – ' || baixa_motivo from os.ativos where id = '${ativo}'`,
      ),
    ).toBe("baixado – Vendido");
    expect(
      await como(U.ativos, () =>
        erro(
          `select os.registrar_saida_ativo('${ativo}', 'Doação', '2026-11-06', null, null, null,
             null, null, null, null, null, false, null, null)`,
        ),
      ),
    ).toMatch(/já está baixado/);
    await como(U.ativos, () =>
      db.query(
        `select os.desfazer_saida_ativo('${saida}', 'Venda cancelada pelo comprador')`,
      ),
    );
    expect(
      await valor<string>(`select situacao from os.ativos where id = '${ativo}'`),
    ).toBe("em_uso");
  });

  it("venda exige valor; sem a permissão não registra", async () => {
    const ativo = await valor<string>(
      "insert into os.ativos (nome) values ('Mesa') returning id",
    );
    expect(
      await como(U.ativos, () =>
        erro(
          `select os.registrar_saida_ativo('${ativo}', 'Venda', '2026-11-05', null, null, null,
             null, null, null, null, null, false, null, null)`,
        ),
      ),
    ).toMatch(/check/);
    expect(
      await como(U.fora, () =>
        erro(
          `select os.registrar_saida_ativo('${ativo}', 'Descarte', '2026-11-05', null, null, null,
             null, null, null, null, null, false, null, null)`,
        ),
      ),
    ).toMatch(/permission denied|sem permissão/);
  });
});
