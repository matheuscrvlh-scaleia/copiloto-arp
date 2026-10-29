// Módulo Marketing (20261029200000_marketing): permissões, RLS da marca e
// dos parâmetros, versões da marca com "voltar", conferências do cadastro e
// histórico em core.auditoria.
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
  editor: "00000000-0000-0000-0000-0000000000a1",
  leitor: "00000000-0000-0000-0000-0000000000a2",
  parametros: "00000000-0000-0000-0000-0000000000a3",
  painel: "00000000-0000-0000-0000-0000000000a4",
  fora: "00000000-0000-0000-0000-0000000000a5",
};

const PERMISSOES: Record<keyof typeof U, string[]> = {
  editor: ["marketing.marca", "marketing.marca.editar"],
  leitor: ["marketing.marca"],
  parametros: ["marketing.parametros"],
  painel: ["marketing.painel"],
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
}, 60_000);

describe("permissões e ponto de partida", () => {
  it("cadastra as 12 permissões (sem Público e visitação, com Eventos do site) e dá todas ao Administrador", async () => {
    expect(
      await valor<number>(
        "select count(*)::int from core.permissoes where codigo like 'marketing.%'",
      ),
    ).toBe(12);
    expect(
      await valor<number>(
        `select count(*)::int from core.cargo_permissoes cp
         join core.cargos c on c.id = cp.cargo_id
         where c.nome = 'Administrador' and cp.permissao like 'marketing.%'`,
      ),
    ).toBe(12);
  });

  it("deixa os parâmetros preenchidos com os valores iniciais da 4.12", async () => {
    const p = (
      await db.query<{
        estrelas_reclamacao: number[];
        reclamacoes_alerta: number;
      }>(
        "select estrelas_reclamacao, reclamacoes_alerta from marketing.parametros",
      )
    ).rows[0];
    expect(p).toEqual({
      estrelas_reclamacao: [1, 2],
      reclamacoes_alerta: 3,
    });
    expect(
      await valor<number>("select count(*)::int from marketing.regras_alerta"),
    ).toBe(8);
    expect(
      await valor<string>(
        "select area from marketing.ronda_codigos where codigo = 'S'",
      ),
    ).toBe("marketing");
    expect(
      await valor<number>("select count(*)::int from marketing.locatarios"),
    ).toBe(20);
  });
});

describe("marca", () => {
  it("só quem tem a permissão lê a base", async () => {
    expect(
      await como(U.leitor, () =>
        valor<number>("select count(*)::int from marketing.marca_blocos"),
      ),
    ).toBeGreaterThan(10);
    expect(
      await como(U.fora, () =>
        valor<number>("select count(*)::int from marketing.marca_blocos"),
      ),
    ).toBe(0);
  });

  it("sem Marca › Editar, a alteração não pega", async () => {
    const n = await como(U.leitor, async () => {
      const r = await db.query(
        `update marketing.marca_blocos set conteudo = '{"texto": "x"}' where chave = 'tagline'`,
      );
      return r.affectedRows;
    });
    expect(n).toBe(0);
  });

  it("cada alteração vira versão, com quem, antes e depois; voltar restaura o original", async () => {
    const original = await valor<{ itens: { titulo: string }[] }>(
      "select conteudo from marketing.marca_blocos where chave = 'tons'",
    );
    const novo = JSON.stringify({
      itens: [
        ...original.itens.slice(0, 4),
        { titulo: "Humorada", texto: "Leve, sem piada pronta." },
      ],
    });
    await como(U.editor, () =>
      db.query(
        `update marketing.marca_blocos set conteudo = '${novo}' where chave = 'tons'`,
      ),
    );
    const versao = (
      await db.query<{ id: number; versao: number; por: string }>(
        "select id, versao, por from marketing.marca_versoes where bloco = 'tons' order by versao desc limit 1",
      )
    ).rows[0];
    expect(versao?.versao).toBe(2);
    expect(versao?.por).toBe(U.editor);

    // Sem permissão de editar, voltar não passa.
    expect(
      await como(U.leitor, () =>
        erro(`select marketing.desfazer_versao(${versao?.id})`),
      ),
    ).toMatch(/sem permissão/);

    await como(U.editor, () =>
      db.query(`select marketing.desfazer_versao(${versao?.id})`),
    );
    expect(
      await valor(
        "select conteudo from marketing.marca_blocos where chave = 'tons'",
      ),
    ).toEqual(original);
    const desfeita = (
      await db.query<{ versao: number; desfaz: number }>(
        "select versao, desfaz from marketing.marca_versoes where bloco = 'tons' order by versao desc limit 1",
      )
    ).rows[0];
    expect(desfeita).toEqual({ versao: 3, desfaz: versao?.id });
  });

  it("gravar o mesmo conteúdo não cria versão", async () => {
    const antes = await valor<number>(
      "select count(*)::int from marketing.marca_versoes where bloco = 'tagline'",
    );
    await como(U.editor, () =>
      db.query(
        "update marketing.marca_blocos set conteudo = conteudo where chave = 'tagline'",
      ),
    );
    expect(
      await valor<number>(
        "select count(*)::int from marketing.marca_versoes where bloco = 'tagline'",
      ),
    ).toBe(antes);
  });

  it("não aceita lista sem itens nem texto sem texto", async () => {
    expect(
      await erro(
        `update marketing.marca_blocos set conteudo = '{"texto": 1}' where chave = 'tagline'`,
      ),
    ).toMatch(/check/);
  });
});

describe("parâmetros", () => {
  it("quem usa o módulo lê; só Parâmetros grava", async () => {
    expect(
      await como(U.painel, () =>
        valor<number>("select count(*)::int from marketing.locatarios"),
      ),
    ).toBe(20);
    expect(
      await como(U.fora, () =>
        valor<number>("select count(*)::int from marketing.locatarios"),
      ),
    ).toBe(0);
    expect(
      await como(U.painel, () =>
        erro(
          "insert into marketing.locatarios (nome, categoria) values ('Nova', 'Serviços')",
        ),
      ),
    ).toMatch(/row-level security/);
    const n = await como(U.painel, async () => {
      const r = await db.query(
        "update marketing.parametros set reclamacoes_alerta = 5",
      );
      return r.affectedRows;
    });
    expect(n).toBe(0);
  });

  it("locatário repetido não salva (sem diferença de maiúscula e espaço)", async () => {
    expect(
      await como(U.parametros, () =>
        erro(
          "insert into marketing.locatarios (nome, categoria) values (' bistrô tear ', 'Gastronomia')",
        ),
      ),
    ).toMatch(/duplicate key|unique/);
  });

  it("código da ronda repetido não salva", async () => {
    expect(
      await como(U.parametros, () =>
        erro(
          "insert into marketing.ronda_codigos (codigo, descricao, area) values ('S', 'Outra', 'operacoes')",
        ),
      ),
    ).toMatch(/duplicate key|unique/);
  });

  it("meta repetida para o mesmo indicador e mês não salva; outro módulo não edita", async () => {
    expect(
      await como(U.parametros, () =>
        erro(
          `insert into core.metas (indicador, direcao, meta, vigente_desde)
           values ('marketing.leads_mes', 'maior_melhor', 300, '2026-01-01')`,
        ),
      ),
    ).toMatch(/duplicate key|unique/);
    expect(
      await como(U.parametros, () =>
        erro(
          `insert into core.metas (indicador, direcao, meta, vigente_desde)
           values ('rh.turnover', 'menor_melhor', 3, '2026-11-01')`,
        ),
      ),
    ).toMatch(/row-level security/);
  });

  it("limite de Alerta precisa ficar acima do de Atenção", async () => {
    expect(
      await erro("update marketing.parametros set reclamacoes_alerta = 1"),
    ).toMatch(/check/);
  });

  it("cada alteração cai no histórico, que só Parâmetros vê", async () => {
    await como(U.parametros, () =>
      db.query("update marketing.parametros set reclamacoes_alerta = 5"),
    );
    const linha = await como(
      U.parametros,
      async () =>
        (
          await db.query<{
            antes: { reclamacoes_alerta: number };
            usuario_id: string;
          }>(
            `select antes, usuario_id from core.auditoria
           where tabela = 'marketing.parametros' and acao = 'update'
           order by em desc limit 1`,
          )
        ).rows[0],
    );
    expect(linha?.antes.reclamacoes_alerta).toBe(3);
    expect(linha?.usuario_id).toBe(U.parametros);
    expect(
      await como(U.painel, () =>
        valor<number>(
          "select count(*)::int from core.auditoria where tabela like 'marketing.%'",
        ),
      ),
    ).toBe(0);
  });
});

describe("acessos das ferramentas (20261029230000, 20261029235000 e 20261030120000)", () => {
  const salvar = (sistema: string) =>
    `select core.salvar_integracao('${sistema}', '{"ad_account_id": "1"}', 'v1.cifrado', true)`;

  it("Parâmetros configura só as do Marketing; outro módulo, nenhuma", async () => {
    await como(U.parametros, async () => {
      expect(await erro(salvar("mkt_meta"))).toBeNull();
      expect(
        await erro(
          "select core.registrar_teste_integracao('mkt_meta', true, 'ok')",
        ),
      ).toBeNull();
      expect(await erro(salvar("secullum"))).toMatch(/sem permissão/);
      expect(
        await valor<string>(
          "select string_agg(sistema, ',') from core.integracoes_configuradas()",
        ),
      ).toBe("mkt_meta");
    });
    await como(U.fora, async () => {
      expect(await erro(salvar("mkt_asana"))).toMatch(/sem permissão/);
      expect(
        await valor<number>(
          "select count(*)::int from core.integracoes_configuradas()",
        ),
      ).toBe(0);
      expect(await erro("select core.remover_integracao('mkt_meta')")).toMatch(
        /sem permissão/,
      );
    });
  });

  it("só aceita as ferramentas conhecidas e remove com auditoria", async () => {
    await como(U.parametros, async () => {
      expect(await erro(salvar("mkt_outra"))).toMatch(
        /credenciais_sistema_check/,
      );
      // Os 9 nomes antigos viraram 5 (20261029235000).
      expect(await erro(salvar("mkt_youtube"))).toMatch(
        /credenciais_sistema_check/,
      );
      // A agenda do site (20261030120000): só o endereço.
      expect(
        await erro(
          `select core.salvar_integracao('mkt_site', '{"endpoint": "https://x.com.br/wp-json/wp/v2/evento"}', 'v1.cifrado', true)`,
        ),
      ).toBeNull();
      await db.query("select core.remover_integracao('mkt_site')");
      await db.query(
        `select core.registrar_teste_integracao('mkt_meta', false, repeat('x', 3000))`,
      );
      expect(
        await valor<number>(
          "select length(teste_mensagem) from core.integracoes_configuradas()",
        ),
      ).toBe(2000);
      await db.query("select core.remover_integracao('mkt_meta')");
    });
    expect(
      await valor<number>("select count(*)::int from integracao.credenciais"),
    ).toBe(0);
    expect(
      await valor<number>(
        `select count(*)::int from core.auditoria
         where tabela = 'integracao.credenciais' and registro_id = 'mkt_meta'`,
      ),
    ).toBe(2);
  });
});
