// Correções de segurança do Comercial (20261104160000_comercial_seguranca):
// token da ficha e valores do contrato fora da API, ficha pelo link numa
// transação, reserva da prévia de importação, "gerado" só depois de pronto,
// ficha do contrato recebida e remover exemplos sem perder dado real.
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

const PERMISSOES = {
  link: ["comercial.formulario.link"],
  contratos: ["comercial.contratos.editar"],
  gerar: ["comercial.contratos.editar", "comercial.contratos.gerar"],
  valores: ["comercial.contratos.ver", "comercial.valores.ver"],
  importar: ["comercial.censo.importar"],
  parametros: ["comercial.parametros.editar"],
} as const;

type Quem = keyof typeof PERMISSOES;
const U = Object.fromEntries(
  Object.keys(PERMISSOES).map((nome, i) => [
    nome,
    `00000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`,
  ]),
) as Record<Quem, string>;

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

async function como<T>(quem: Quem, fn: () => Promise<T>): Promise<T> {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub', '${U[quem]}', false);`,
  );
  try {
    return await fn();
  } finally {
    await db.exec(
      "reset role; select set_config('request.jwt.claim.sub', '', false);",
    );
  }
}

async function comoServidor<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec("set role service_role;");
  try {
    return await fn();
  } finally {
    await db.exec("reset role;");
  }
}

async function novaFicha(extra = ""): Promise<{ id: string; token: string }> {
  const { rows } = await db.query<{ id: string; token: string }>(
    `insert into comercial.fichas (nome, expira_em${extra ? `, ${extra.split("=")[0]}` : ""})
     values ('Interessado', now() + interval '30 days'${extra ? `, ${extra.split("=")[1]}` : ""})
     returning id, token`,
  );
  return rows[0] as { id: string; token: string };
}

const gravar = (token: string, enviar: boolean, nome = "FULANO") =>
  comoServidor(() =>
    valor<string>(
      `select comercial.gravar_ficha_pelo_link('${token}', 'pf', null, '${nome}',
         '12345678909', '{"nome": "${nome}"}', null, ${enviar})`,
    ),
  );

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_MINIMO);
  for (const f of readdirSync(MIGRATIONS).sort())
    if (f.endsWith(".sql"))
      await db.exec(readFileSync(join(MIGRATIONS, f), "utf8"));
  for (const [nome, id] of Object.entries(U)) {
    await db.query("insert into auth.users (id, email) values ($1, $2)", [
      id,
      `${nome}@arp.test`,
    ]);
    for (const p of PERMISSOES[nome as Quem])
      await db.query(
        "insert into core.usuario_permissoes (usuario_id, permissao) values ($1, $2)",
        [id, p],
      );
  }
}, 120_000);

describe("token da ficha", () => {
  it("a sessão lê a lista de fichas, mas nunca o token", async () => {
    for (const quem of ["contratos", "link"] as const) {
      expect(
        await como(quem, () =>
          valor<number>(
            "select count(*)::int from comercial.fichas where exemplo",
          ),
        ),
      ).toBeGreaterThan(0);
      expect(
        await como(quem, () => erro("select token from comercial.fichas")),
      ).toMatch(/permission denied/);
      expect(
        await como(quem, () => erro("select * from comercial.fichas")),
      ).toMatch(/permission denied/);
    }
    expect(
      await comoServidor(() =>
        valor<number>(
          "select count(token)::int from comercial.fichas where exemplo",
        ),
      ),
    ).toBeGreaterThan(0);
  });

  it("quem gera o link cria a ficha com o token feito no servidor", async () => {
    const token = "a".repeat(64);
    const id = await como("link", () =>
      valor<string>(
        `insert into comercial.fichas (token, nome, gerada_por)
         values ('${token}', 'Novo', '${U.link}') returning id`,
      ),
    );
    expect(
      await valor<string>(
        `select token from comercial.fichas where id = '${id}'`,
      ),
    ).toBe(token);
  });
});

describe("valores do contrato", () => {
  it("nem quem vê valores lê aluguel, dados ou o conteúdo das versões pela API", async () => {
    for (const quem of ["contratos", "valores"] as const) {
      for (const sql of [
        "select aluguel from comercial.contratos",
        "select dados from comercial.contratos",
        "select dados -> 'condicoes' from comercial.contratos",
        "select * from comercial.contratos",
        "select conteudo from comercial.contrato_versoes",
      ])
        expect(await como(quem, () => erro(sql))).toMatch(/permission denied/);
      expect(
        await como(quem, () =>
          valor<number>(
            "select count(*)::int from comercial.contratos where exemplo and status = 'gerado'",
          ),
        ),
      ).toBe(5);
      expect(
        await como(quem, () =>
          valor<number>(
            "select count(versao)::int from comercial.contrato_versoes",
          ),
        ),
      ).toBeGreaterThan(0);
    }
  });

  it("quem edita ainda grava aluguel e dados", async () => {
    const id = await como("contratos", () =>
      valor<string>(
        `insert into comercial.contratos (tipo, aluguel, dados)
         values ('contrato', 1500, '{"condicoes": {"aluguel": 1500}}') returning id`,
      ),
    );
    await como("contratos", () =>
      db.query(
        `update comercial.contratos set aluguel = 1600 where id = '${id}' and status = 'rascunho'`,
      ),
    );
    expect(
      await valor<string>(
        `select aluguel::text from comercial.contratos where id = '${id}'`,
      ),
    ).toBe("1600.00");
  });
});

describe("ficha pelo link (comercial.gravar_ficha_pelo_link)", () => {
  it("salva o rascunho e envia na mesma transação; depois de enviada não grava mais", async () => {
    const f = await novaFicha();
    expect(await gravar(f.token, false, "RASCUNHO")).toBe("ok");
    expect(
      await valor<string>(
        `select situacao || ':' || (iniciada_em is not null) || ':' || (consentimento_em is not null)
         from comercial.fichas where id = '${f.id}'`,
      ),
    ).toBe("em_preenchimento:true:true");
    expect(await gravar(f.token, true, "ENVIADA")).toBe("ok");
    // A outra aba salva depois: nada muda.
    expect(await gravar(f.token, false, "OUTRA ABA")).toBe("enviada");
    expect(
      await valor<string>(
        `select f.situacao || ':' || f.nome || ':' || (d.respostas ->> 'nome')
         from comercial.fichas f join comercial.ficha_dados d on d.ficha_id = f.id
         where f.id = '${f.id}'`,
      ),
    ).toBe("recebida:ENVIADA:ENVIADA");
  });

  it("link vencido, cancelado ou inexistente não grava", async () => {
    const vencida = await novaFicha();
    await db.query(
      `update comercial.fichas set expira_em = now() - interval '1 day' where id = '${vencida.id}'`,
    );
    expect(await gravar(vencida.token, false)).toBe("expirada");
    const cancelada = await novaFicha("cancelada_em=now()");
    expect(await gravar(cancelada.token, false)).toBe("cancelada");
    expect(await gravar("b".repeat(64), false)).toBe("inexistente");
    expect(
      await valor<number>(
        `select count(*)::int from comercial.ficha_dados
         where ficha_id in ('${vencida.id}', '${cancelada.id}')`,
      ),
    ).toBe(0);
  });

  it("só o servidor chama", async () => {
    const f = await novaFicha();
    expect(
      await como("link", () =>
        erro(
          `select comercial.gravar_ficha_pelo_link('${f.token}', 'pf', null, 'X', null, '{}', null, true)`,
        ),
      ),
    ).toMatch(/permission denied/);
  });
});

describe("confirmação de importação", () => {
  it("a prévia é reservada uma vez só; o desfazer limpa a reservada", async () => {
    const id = await como("importar", () =>
      valor<string>(
        `insert into comercial.importacoes (tipo, arquivo_nome, arquivo_sha256, enviado_por)
         values ('censo', 'censo.xlsx', 'abc', '${U.importar}') returning id`,
      ),
    );
    const reservar = () =>
      como("importar", () =>
        db.query(
          `update comercial.importacoes set status = 'confirmando'
           where id = '${id}' and status = 'previa' returning id`,
        ),
      ).then((r) => r.rows.length);
    expect(await reservar()).toBe(1);
    expect(await reservar()).toBe(0);
    await como("importar", () =>
      db.query(`select comercial.desfazer_importacao('${id}')`),
    );
    expect(
      await valor<string>(
        `select status from comercial.importacoes where id = '${id}'`,
      ),
    ).toBe("desfeita");
  });
});

describe("contrato: gerado e ficha", () => {
  let ficha = "";
  beforeAll(async () => {
    ficha = (await novaFicha()).id;
  });

  it("gerado só a partir de pronto", async () => {
    expect(
      await como("gerar", () =>
        erro(
          "insert into comercial.contratos (tipo, status) values ('contrato', 'gerado')",
        ),
      ),
    ).toBeTruthy();
    const id = await como("gerar", () =>
      valor<string>(
        "insert into comercial.contratos (tipo) values ('contrato') returning id",
      ),
    );
    const gerar = () =>
      como("gerar", () =>
        erro(
          `update comercial.contratos set status = 'gerado' where id = '${id}'`,
        ),
      );
    expect(await gerar()).toMatch(/pronto/);
    await como("gerar", () =>
      db.query(
        `update comercial.contratos set status = 'pronto' where id = '${id}'`,
      ),
    );
    expect(await gerar()).toBeNull();
    expect(
      await valor<string>(
        `select status from comercial.contratos where id = '${id}'`,
      ),
    ).toBe("gerado");
  });

  it("a ficha do contrato tem que estar recebida", async () => {
    const inserir = (f: string) =>
      como("contratos", () =>
        erro(
          `insert into comercial.contratos (tipo, ficha_id) values ('contrato', '${f}')`,
        ),
      );
    expect(await inserir(ficha)).toMatch(/ficha/);
    expect(await inserir("00000000-0000-0000-0000-00000000ffff")).toMatch(
      /ficha/,
    );
    await db.query(
      `update comercial.fichas set situacao = 'recebida', consentimento_em = now(),
         recebida_em = now() where id = '${ficha}'`,
    );
    expect(await inserir(ficha)).toBeNull();
    expect(
      await valor<string>(
        `select situacao from comercial.fichas where id = '${ficha}'`,
      ),
    ).toBe("usada");
  });
});

describe("remover dados de exemplo", () => {
  it("mantém o tema com sugestão real e apaga as fotos de ocupação de exemplo", async () => {
    const tema = await valor<string>(
      "select id from comercial.censo_temas where exemplo order by nome limit 1",
    );
    const contato = await valor<string>(
      `insert into comercial.contatos (locatario_nome, tipo, canal, descricao)
       values ('Loja real', 'Sugestão', 'WhatsApp', 'Mais bancos') returning id`,
    );
    await db.query(
      `insert into comercial.censo_sugestao_temas (tema_id, contato_id) values ('${tema}', '${contato}')`,
    );
    await db.query(`
      insert into comercial.ocupacao_fotos (mes, lucs, lucs_locados, abl_total, abl_locada, exemplo)
        values ('2020-01-01', 10, 5, 100, 50, true), ('2020-02-01', 10, 6, 100, 60, false);
    `);
    const r = await como("parametros", () =>
      valor<Record<string, number>>("select comercial.remover_exemplos()"),
    );
    expect(r.ocupacao_fotos).toBe(1);
    expect(
      await valor<string>(
        `select exemplo::text from comercial.censo_temas where id = '${tema}'`,
      ),
    ).toBe("false");
    expect(
      await valor<number>(
        `select count(*)::int from comercial.censo_sugestao_temas where contato_id = '${contato}'`,
      ),
    ).toBe(1);
    expect(
      await valor<number>(
        "select count(*)::int from comercial.censo_temas where exemplo",
      ),
    ).toBe(0);
    expect(
      await valor<number>("select count(*)::int from comercial.ocupacao_fotos"),
    ).toBe(1);
  });
});
