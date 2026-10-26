// RLS dos chamados reescrito para desempenho (20261026150000_desempenho_rls):
// mesma visibilidade e mesma edição de antes. As funções antigas
// (os.ve_chamado, os.edita_chamado, os.pode_ver_chamado,
// os.pode_editar_chamado, os.envolvido) continuam no banco e servem de
// oráculo: rodadas como dono da tabela (sem RLS), com o usuário na sessão,
// dizem o que a regra antiga liberava.
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

const SETORES = {
  S: "Operações",
  M: "Marketing",
  C: "Comercial",
  G: "Gestão",
} as const;
type Setor = keyof typeof SETORES;

// p: permissões individuais; cargo: permissões pelo cargo de acesso;
// s: setores de que é membro.
interface Perfil {
  p: string[];
  s: Setor[];
  cargo?: { ativo: boolean; p: string[] };
  inativo?: boolean;
}

const PESSOAS = {
  abriu: { p: ["os.acessar"], s: [] },
  responsavel: { p: ["os.acessar"], s: [] },
  todos: { p: ["os.acessar", "os.todos_setores"], s: [] },
  painelGeral: { p: ["os.painel_geral"], s: [] },
  excluir: { p: ["os.acessar", "os.painel_geral", "os.excluir"], s: [] },
  membro: { p: ["os.acessar"], s: ["S"] },
  meuSetor: { p: ["os.acessar", "os.meu_setor"], s: ["S"] },
  painelSetor: { p: ["os.painel_setor"], s: ["S"] },
  gestor: { p: ["os.acessar", "os.gerenciar_setor"], s: ["S"] },
  gestorTodos: {
    p: ["os.acessar", "os.gerenciar_setor", "os.todos_setores"],
    s: [],
  },
  destPessoa: { p: ["os.acessar"], s: [] },
  destSetor: { p: ["os.acessar"], s: ["C"] },
  destResp: { p: ["os.acessar"], s: [] },
  participante: { p: ["os.acessar"], s: [] },
  inativo: { p: ["os.acessar", "os.todos_setores"], s: ["S"], inativo: true },
  cargoInativo: {
    p: [],
    s: ["S"],
    cargo: { ativo: false, p: ["os.acessar", "os.todos_setores"] },
  },
  cargoAtivo: {
    p: [],
    s: ["S"],
    cargo: { ativo: true, p: ["os.acessar", "os.meu_setor"] },
  },
  semModulo: { p: ["rh.painel"], s: ["S"] },
  financeiro: {
    p: ["os.acessar", "os.todos_setores", "os.custos", "os.excluir"],
    s: [],
  },
  terceirizados: { p: ["os.terceirizados"], s: [] },
} satisfies Record<string, Perfil>;
type Pessoa = keyof typeof PESSOAS;

const U = Object.fromEntries(
  Object.keys(PESSOAS).map((nome, i) => [
    nome,
    `00000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`,
  ]),
) as Record<Pessoa, string>;

const SETOR = {} as Record<Setor, string>;
// Título -> id.
const K: Record<string, string> = {};

let db: PGlite;

async function valor<T = unknown>(sql: string): Promise<T> {
  const { rows } = await db.query<Record<string, T>>(sql);
  return Object.values(rows[0] ?? {})[0] as T;
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

// Dono das tabelas (sem RLS) com o usuário na sessão: o que as funções
// antigas respondem para ele.
async function oraculo<T>(usuario: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(
    `select set_config('request.jwt.claim.sub', '${usuario}', false);`,
  );
  try {
    return await fn();
  } finally {
    await db.exec("select set_config('request.jwt.claim.sub', '', false);");
  }
}

// Roda e desfaz (nada fica gravado).
async function desfazendo<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec("begin");
  try {
    return await fn();
  } finally {
    await db.exec("rollback");
  }
}

// Ids de chamado -> títulos, em ordem.
const nomes = (ids: string[]) => {
  const porId = Object.fromEntries(Object.entries(K).map(([t, id]) => [id, t]));
  return [...new Set(ids.map((id) => porId[id] ?? id))].sort();
};

async function idsDe(sql: string, coluna = "id"): Promise<string[]> {
  const { rows } = await db.query<Record<string, string>>(sql);
  return rows.map((r) => r[coluna] as string);
}

const vistos = (u: Pessoa) =>
  como(U[u], async () => nomes(await idsDe("select id from os.chamados")));

async function inserir(
  tabela: string,
  campos: Record<string, string | number | boolean | null>,
): Promise<string> {
  const colunas = Object.keys(campos);
  const { rows } = await db.query<{ id: string }>(
    `insert into ${tabela} (${colunas.join(", ")})
     values (${colunas.map((_, i) => `$${i + 1}`).join(", ")}) returning *`,
    Object.values(campos),
  );
  return rows[0]?.id ?? "";
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_MINIMO);
  for (const f of readdirSync(MIGRATIONS).sort()) {
    if (f.endsWith(".sql"))
      await db.exec(readFileSync(join(MIGRATIONS, f), "utf8"));
  }

  for (const [chave, nome] of Object.entries(SETORES)) {
    SETOR[chave as Setor] = await valor<string>(
      `select id from os.setores where nome = '${nome}'`,
    );
  }
  for (const [nome, perfil] of Object.entries(PESSOAS) as [Pessoa, Perfil][]) {
    const id = U[nome];
    await db.query("insert into auth.users (id, email) values ($1, $2)", [
      id,
      `${nome}@arp.test`,
    ]);
    for (const p of perfil.p) {
      await db.query(
        "insert into core.usuario_permissoes (usuario_id, permissao) values ($1, $2)",
        [id, p],
      );
    }
    if (perfil.cargo) {
      const cargo = await inserir("core.cargos", {
        nome: `Cargo ${nome}`,
        ativo: perfil.cargo.ativo,
      });
      for (const p of perfil.cargo.p) {
        await db.query(
          "insert into core.cargo_permissoes (cargo_id, permissao) values ($1, $2)",
          [cargo, p],
        );
      }
      await db.query("update core.usuarios set cargo_id = $1 where id = $2", [
        cargo,
        id,
      ]);
    }
    for (const s of perfil.s) {
      await db.query(
        "insert into os.setor_membros (setor_id, usuario_id) values ($1, $2)",
        [SETOR[s], id],
      );
    }
    if (perfil.inativo)
      await db.query("update core.usuarios set ativo = false where id = $1", [
        id,
      ]);
  }

  const chamado = (
    titulo: string,
    setor: Setor,
    campos: Record<string, string | null> = {},
  ) =>
    inserir("os.chamados", {
      tipo: "solicitacao",
      titulo,
      setor_id: SETOR[setor],
      aberto_por: null,
      responsavel_id: U.responsavel,
      ...campos,
    }).then((id) => {
      K[titulo] = id;
      return id;
    });

  await chamado("K01 fila", "S", {
    aberto_por: U.abriu,
    responsavel_id: null,
  });
  await chamado("K02 atribuído", "S");
  await chamado("K03 fila do marketing", "M", { responsavel_id: null });
  const k4 = await chamado("K04 destino pessoa", "M");
  await inserir("os.destinatarios", {
    chamado_id: k4,
    usuario_id: U.destPessoa,
  });
  const k5 = await chamado("K05 destino setor", "G");
  await inserir("os.destinatarios", { chamado_id: k5, setor_id: SETOR.C });
  const k6 = await chamado("K06 destino com responsável", "G");
  await inserir("os.destinatarios", {
    chamado_id: k6,
    setor_id: SETOR.G,
    responsavel_id: U.destResp,
  });
  const k7 = await chamado("K07 participante", "G");
  await inserir("os.participantes", {
    chamado_id: k7,
    usuario_id: U.participante,
    motivo: "mencionado",
  });
  await chamado("K08 aberto por quem perdeu o módulo", "G", {
    aberto_por: U.semModulo,
  });
  const k9 = await chamado("K09 na lixeira", "S");
  await db.query("update os.chamados set lixeira_em = now() where id = $1", [
    k9,
  ]);
  await chamado("K10 fila da gestão", "G", { responsavel_id: null });

  // Filhas em todos os chamados.
  const empresa = await inserir("os.empresas", { nome: "Terceirizada" });
  const profissional = await inserir("os.profissionais", {
    empresa_id: empresa,
    nome: "Profissional",
  });
  const tecnico = await inserir("os.tecnicos", { nome: "Técnico" });
  for (const [i, id] of Object.values(K).entries()) {
    await inserir("os.eventos", { chamado_id: id, tipo: "comentario" });
    await inserir("os.anexos", {
      chamado_id: id,
      nome: "foto.jpg",
      path: `chamados/${id}/foto.jpg`,
    });
    await inserir("os.materiais", {
      chamado_id: id,
      descricao: "Material",
      quantidade: 1,
    });
    const sessao = await inserir("os.sessoes", {
      chamado_id: id,
      data: "2026-10-26",
      inicio: "08:00",
    });
    await inserir("os.sessao_tecnicos", {
      sessao_id: sessao,
      tecnico_id: tecnico,
    });
    await inserir("os.os_custos", { chamado_id: id });
    await inserir("os.chamado_profissionais", {
      chamado_id: id,
      profissional_id: profissional,
    });
    await inserir("os.terceirizado_links", {
      chamado_id: id,
      token: `token-${String(i).padStart(4, "0")}-${"x".repeat(32)}`,
    });
  }
}, 60_000);

const TODOS = [
  "K01 fila",
  "K02 atribuído",
  "K03 fila do marketing",
  "K04 destino pessoa",
  "K05 destino setor",
  "K06 destino com responsável",
  "K07 participante",
  "K08 aberto por quem perdeu o módulo",
  "K09 na lixeira",
  "K10 fila da gestão",
];
const DO_SETOR_S = ["K01 fila", "K02 atribuído", "K09 na lixeira"];
const DO_RESPONSAVEL = TODOS.filter(
  (t) =>
    !["K01 fila", "K03 fila do marketing", "K10 fila da gestão"].includes(t),
);

describe("quem vê o chamado (casos da regra)", () => {
  const casos: [Pessoa, string, string[]][] = [
    ["abriu", "quem abriu", ["K01 fila"]],
    ["responsavel", "o responsável", DO_RESPONSAVEL],
    ["todos", "os.todos_setores", TODOS],
    ["painelGeral", "os.painel_geral", TODOS],
    ["membro", "membro do setor: só a fila (sem responsável)", ["K01 fila"]],
    ["meuSetor", "os.meu_setor: o setor inteiro", DO_SETOR_S],
    ["painelSetor", "os.painel_setor: o setor inteiro", DO_SETOR_S],
    ["gestor", "quem gerencia o setor: o setor inteiro", DO_SETOR_S],
    ["gestorTodos", "gerencia com os.todos_setores", TODOS],
    ["destPessoa", "destinatário (pessoa)", ["K04 destino pessoa"]],
    ["destSetor", "destinatário (setor)", ["K05 destino setor"]],
    ["destResp", "responsável pelo destino", ["K06 destino com responsável"]],
    ["participante", "participante (citado)", ["K07 participante"]],
    ["inativo", "usuário inativo: nada", []],
    ["cargoInativo", "permissão só por cargo inativo: nada", []],
    ["cargoAtivo", "permissão pelo cargo ativo", DO_SETOR_S],
    ["semModulo", "sem permissão do módulo: nada, nem o que abriu", []],
  ];
  it.each(casos)("%s (%s)", async (u, _, esperado) => {
    expect(await vistos(u)).toEqual(esperado);
  });
});

describe(
  "mesma regra de antes (oráculo: funções antigas)",
  { timeout: 60_000 },
  () => {
    const pessoas = Object.keys(PESSOAS) as Pessoa[];

    it("select em os.chamados = os.ve_chamado", async () => {
      for (const u of pessoas) {
        const agora = await vistos(u);
        const antes = await oraculo(U[u], async () =>
          nomes(
            await idsDe(
              "select id from os.chamados where os.ve_chamado(id, setor_id, aberto_por, responsavel_id)",
            ),
          ),
        );
        expect(agora, u).toEqual(antes);
      }
    });

    it("update em os.chamados = os.edita_chamado", async () => {
      for (const u of pessoas) {
        const antes = await oraculo(U[u], async () =>
          nomes(
            await idsDe(
              "select id from os.chamados where os.edita_chamado(id, setor_id, aberto_por, responsavel_id)",
            ),
          ),
        );
        // Com returning (passa também pelo `ver`).
        const comRetorno = await desfazendo(() =>
          como(U[u], async () =>
            nomes(
              await idsDe(
                "update os.chamados set descricao = 'editado' returning id",
              ),
            ),
          ),
        );
        expect(comRetorno, u).toEqual(antes);
        // Sem ler coluna nenhuma: só a política de update decide.
        const linhas = await desfazendo(() =>
          como(U[u], async () => {
            const r = await db.query(
              "update os.chamados set descricao = 'editado'",
            );
            return r.affectedRows ?? 0;
          }),
        );
        expect(linhas, u).toBe(antes.length);
      }
    });

    // Com o módulo: a função nova só responde a quem usa o módulo (a regra
    // de ver já exigia core.pode_modulo junto de os.envolvido).
    it("os.meus_chamados_envolvidos() = os.envolvido (com o módulo)", async () => {
      for (const u of pessoas) {
        const [antes, agora] = await oraculo(U[u], async () => [
          nomes(
            await idsDe(
              "select id from os.chamados where os.envolvido(id) and core.pode_modulo('os')",
            ),
          ),
          nomes(await idsDe("select id from os.meus_chamados_envolvidos() id")),
        ]);
        expect(agora, u).toEqual(antes);
      }
    });

    // Filha -> regra antiga, sobre o chamado_id da linha.
    const FILHAS: [string, string, string][] = [
      ["os.eventos", "chamado_id", "os.pode_ver_chamado(chamado_id)"],
      [
        "os.anexos",
        "chamado_id",
        "chamado_id is not null and os.pode_ver_chamado(chamado_id)",
      ],
      ["os.destinatarios", "chamado_id", "os.pode_ver_chamado(chamado_id)"],
      ["os.participantes", "chamado_id", "os.pode_ver_chamado(chamado_id)"],
      ["os.sessoes", "chamado_id", "os.pode_ver_chamado(chamado_id)"],
      ["os.materiais", "chamado_id", "os.pode_ver_chamado(chamado_id)"],
      [
        "os.os_custos",
        "chamado_id",
        "core.pode('os.custos') and os.pode_ver_chamado(chamado_id)",
      ],
      [
        "os.chamado_profissionais",
        "chamado_id",
        "os.pode_ver_chamado(chamado_id)",
      ],
      [
        "os.terceirizado_links",
        "chamado_id",
        "core.pode('os.terceirizados') or os.pode_editar_chamado(chamado_id)",
      ],
    ];

    it.each(
      FILHAS,
    )("select em %s = regra antiga", async (tabela, col, regra) => {
      for (const u of pessoas) {
        const agora = await como(U[u], async () =>
          nomes(await idsDe(`select ${col} from ${tabela}`, col)),
        );
        const antes = await oraculo(U[u], async () =>
          nomes(
            await idsDe(`select ${col} from ${tabela} where ${regra}`, col),
          ),
        );
        expect(agora, `${tabela} ${u}`).toEqual(antes);
      }
    });

    it("select em os.sessao_tecnicos = regra antiga", async () => {
      for (const u of pessoas) {
        const sql = (regra: string) =>
          `select s.chamado_id from os.sessao_tecnicos st
         join os.sessoes s on s.id = st.sessao_id ${regra}`;
        const agora = await como(U[u], async () =>
          nomes(
            await idsDe(
              "select (select chamado_id from os.sessoes s where s.id = st.sessao_id) as chamado_id from os.sessao_tecnicos st",
              "chamado_id",
            ),
          ),
        );
        const antes = await oraculo(U[u], async () =>
          nomes(
            await idsDe(
              sql("where os.pode_ver_chamado(s.chamado_id)"),
              "chamado_id",
            ),
          ),
        );
        expect(agora, u).toEqual(antes);
      }
    });

    // Tabela, set do update e se exige os.custos além da edição do chamado.
    const EDICOES: [string, string, boolean][] = [
      ["os.materiais", "descricao = 'outro'", false],
      ["os.sessoes", "observacao = 'outro'", false],
      ["os.chamado_profissionais", "profissional_id = profissional_id", false],
      ["os.destinatarios", "observacao = 'outro'", false],
      ["os.os_custos", "valor_terceirizado = 1", true],
    ];

    it.each(
      EDICOES,
    )("update e delete em %s = os.pode_editar_chamado", async (tabela, set, exigeCustos) => {
      for (const u of pessoas) {
        const esperado = await oraculo(U[u], async () =>
          nomes(
            await idsDe(
              `select distinct chamado_id from ${tabela}
               where os.pode_editar_chamado(chamado_id)
                 ${exigeCustos ? "and core.pode('os.custos')" : ""}`,
              "chamado_id",
            ),
          ),
        );
        const atualizados = await desfazendo(() =>
          como(U[u], async () =>
            nomes(
              await idsDe(
                `update ${tabela} set ${set} returning chamado_id`,
                "chamado_id",
              ),
            ),
          ),
        );
        expect(atualizados, `update ${tabela} ${u}`).toEqual(esperado);
        const apagados = await desfazendo(() =>
          como(U[u], async () =>
            nomes(
              await idsDe(
                `delete from ${tabela} returning chamado_id`,
                "chamado_id",
              ),
            ),
          ),
        );
        expect(apagados, `delete ${tabela} ${u}`).toEqual(esperado);
      }
    });

    it("delete em os.sessao_tecnicos = os.pode_editar_chamado da sessão", async () => {
      for (const u of pessoas) {
        const esperado = await oraculo(U[u], () =>
          valor<number>(
            `select count(*)::int from os.sessao_tecnicos st
           join os.sessoes s on s.id = st.sessao_id
           where os.pode_editar_chamado(s.chamado_id)`,
          ),
        );
        // Sem returning nem where: só a política de delete decide.
        const apagados = await desfazendo(() =>
          como(U[u], async () => {
            const r = await db.query("delete from os.sessao_tecnicos");
            return r.affectedRows ?? 0;
          }),
        );
        expect(apagados, u).toBe(esperado);
      }
    });

    // Tabela, insert de uma linha no chamado e a regra antiga que decidia.
    const INSERCOES: [
      string,
      (id: string, eu: string) => string,
      "ver" | "editar",
    ][] = [
      [
        "os.eventos",
        (id, eu) =>
          `insert into os.eventos (chamado_id, tipo, autor_id) values ('${id}', 'comentario', '${eu}')`,
        "ver",
      ],
      [
        "os.participantes",
        (id) =>
          `insert into os.participantes (chamado_id, usuario_id) values ('${id}', '${U.todos}')`,
        "ver",
      ],
      [
        "os.materiais",
        (id) =>
          `insert into os.materiais (chamado_id, descricao, quantidade) values ('${id}', 'Novo', 2)`,
        "editar",
      ],
      [
        "os.anexos",
        (id) =>
          `insert into os.anexos (chamado_id, nome, path) values ('${id}', 'b.jpg', 'chamados/${id}/b.jpg')`,
        "editar",
      ],
      [
        "os.destinatarios",
        (id) =>
          `insert into os.destinatarios (chamado_id, setor_id) values ('${id}', '${SETOR.M}')`,
        "editar",
      ],
    ];

    it.each(
      INSERCOES,
    )("insert em %s = regra antiga", async (tabela, sql, regra) => {
      for (const u of pessoas) {
        const esperado = await oraculo(U[u], async () =>
          nomes(
            await idsDe(
              `select id from os.chamados where os.pode_${regra}_chamado(id)`,
            ),
          ),
        );
        const ok: string[] = [];
        const erros: string[] = [];
        await desfazendo(() =>
          como(U[u], async () => {
            for (const id of Object.values(K)) {
              await db.exec("savepoint tentativa");
              try {
                await db.query(sql(id, U[u]));
                ok.push(id);
                await db.exec("release savepoint tentativa");
              } catch (e) {
                await db.exec("rollback to savepoint tentativa");
                erros.push((e as Error).message);
              }
            }
          }),
        );
        for (const e of erros) expect(e).toMatch(/row-level security/);
        expect(nomes(ok), `${tabela} ${u}`).toEqual(esperado);
      }
    });
  },
);

describe("edição (casos da regra)", () => {
  const editaveis = (u: Pessoa) =>
    desfazendo(() =>
      como(U[u], async () =>
        nomes(
          await idsDe("update os.chamados set descricao = 'x' returning id"),
        ),
      ),
    );

  it("só vê não basta: todos_setores e painéis sem vínculo não editam", async () => {
    expect(await editaveis("todos")).toEqual([]);
    expect(await editaveis("painelGeral")).toEqual([]);
    expect(await editaveis("painelSetor")).toEqual([]);
  });

  it("quem abriu, o setor, os destinos e citados editam o que veem", async () => {
    expect(await editaveis("abriu")).toEqual(["K01 fila"]);
    expect(await editaveis("membro")).toEqual(["K01 fila"]);
    expect(await editaveis("gestor")).toEqual(DO_SETOR_S);
    expect(await editaveis("destSetor")).toEqual(["K05 destino setor"]);
    expect(await editaveis("participante")).toEqual(["K07 participante"]);
  });

  it("os.excluir e gerenciar com todos_setores alcançam tudo que veem", async () => {
    expect(await editaveis("excluir")).toEqual(TODOS);
    expect(await editaveis("gestorTodos")).toEqual(TODOS);
  });
});

describe("plano: regra calculada uma vez por consulta", () => {
  const plano = async (u: Pessoa, sql: string) =>
    como(U[u], async () =>
      (await db.query<{ "QUERY PLAN": string }>(`explain ${sql}`)).rows
        .map((r) => r["QUERY PLAN"])
        .join("\n"),
    );

  it("os.chamados: InitPlan e hashed SubPlan, sem função por linha", async () => {
    const p = await plano("membro", "select id from os.chamados");
    expect(p).toMatch(/InitPlan/);
    expect(p).toMatch(/hashed SubPlan/);
    expect(p).not.toMatch(/ve_chamado|envolvido\(|gerencia\(|pode_ver_chamado/);
  });

  it("filhas: sem os.pode_ver_chamado por linha", async () => {
    for (const t of [
      "eventos",
      "anexos",
      "destinatarios",
      "sessoes",
      "materiais",
    ]) {
      const p = await plano("membro", `select * from os.${t}`);
      expect(p, t).not.toMatch(
        /pode_ver_chamado|pode_editar_chamado|ve_chamado/,
      );
      expect(p, t).toMatch(/InitPlan/);
    }
  });

  it("nenhuma política (fora rh) chama core.pode por linha", async () => {
    const { rows } = await db.query<{ t: string; nome: string; expr: string }>(
      `select schemaname || '.' || tablename as t, policyname as nome,
              coalesce(qual, '') || ' ' || coalesce(with_check, '') as expr
       from pg_policies where schemaname in ('core', 'os', 'financeiro', 'integracao')`,
    );
    const porLinha = rows.flatMap(({ t, nome, expr }) => {
      // Tira as chamadas embrulhadas em (select ...).
      const resto = expr.replace(
        /\( SELECT core\.pode(_modulo)?\('[^']*'::text\) AS pode(_modulo)?\)/g,
        "",
      );
      const achados = resto.match(
        /core\.pode(_modulo)?\(|os\.(ve_chamado|edita_chamado|pode_ver_chamado|envolvido|gerencia)\(/g,
      );
      return achados ? [`${t}.${nome}: ${achados.join(", ")}`] : [];
    });
    // Únicas por linha que sobram: o módulo de core.metas que não é rh,
    // financeiro nem os (nenhum hoje) e a conversão em OS (insert de uma linha).
    expect(porLinha).toEqual(["core.metas.ver: core.pode_modulo("]);
  });
});
