// Módulo Chamados e OS: aplica as migrations num Postgres em memória (PGlite)
// com o mínimo do Supabase e testa estrutura, ciclo do chamado e RLS.
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
  operacoes: "Operações",
  comercial: "Comercial",
  marketing: "Marketing",
  estacionamento: "Estacionamento",
} as const;
type Setor = keyof typeof SETORES;

// Quem usa o módulo nos testes: permissões individuais e setores.
const PESSOAS = {
  solicitante: { p: ["os.acessar"], s: ["comercial"] },
  tecnico: { p: ["os.acessar"], s: ["operacoes"] },
  colega: { p: ["os.acessar"], s: ["operacoes"] },
  supervisor: { p: ["os.acessar", "os.meu_setor"], s: ["operacoes"] },
  gestor: {
    p: ["os.acessar", "os.meu_setor", "os.gerenciar_setor"],
    s: ["operacoes"],
  },
  diretor: { p: ["os.acessar", "os.todos_setores"], s: [] },
  citado: { p: ["os.acessar"], s: [] },
  marketing: { p: ["os.acessar"], s: ["marketing"] },
  estranho: { p: ["rh.painel"], s: [] },
  inativo: { p: ["os.acessar"], s: ["operacoes"] },
  financeiro: { p: ["os.acessar", "os.todos_setores", "os.custos"], s: [] },
  agenda: { p: ["os.acessar", "os.portal_agenda"], s: [] },
  portal: { p: ["os.acessar", "os.portal"], s: [] },
  ativos: { p: ["os.ativos"], s: [] },
  ativosGerenciar: { p: ["os.ativos_gerenciar"], s: [] },
  vistoriador: { p: ["os.vistorias"], s: [] },
  auditor: { p: ["os.historico"], s: [] },
  parametros: { p: ["os.acessar", "os.parametros"], s: [] },
  porCargo: { p: [], s: [] },
  // Gerencia o setor sem os.meu_setor: vê o setor mesmo assim.
  gerente: { p: ["os.acessar", "os.gerenciar_setor"], s: ["operacoes"] },
} satisfies Record<string, { p: string[]; s: Setor[] }>;
type Pessoa = keyof typeof PESSOAS;

const U = Object.fromEntries(
  Object.keys(PESSOAS).map((nome, i) => [
    nome,
    `00000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`,
  ]),
) as Record<Pessoa, string>;

const SETOR = {} as Record<Setor, string>;

let db: PGlite;

async function erro(sql: string): Promise<string | null> {
  try {
    await db.query(sql);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

async function linhas(sql: string): Promise<number> {
  return (await db.query(sql)).rows.length;
}

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

async function comoServidor<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec("set role service_role");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

type Valor = string | number | boolean | null;

async function inserir(
  tabela: string,
  campos: Record<string, Valor>,
): Promise<string> {
  const colunas = Object.keys(campos);
  const { rows } = await db.query<{ id: string }>(
    `insert into ${tabela} (${colunas.join(", ")})
     values (${colunas.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
    Object.values(campos),
  );
  return rows[0]?.id ?? "";
}

const chamado = (titulo: string, campos: Record<string, Valor> = {}) =>
  inserir("os.chamados", {
    tipo: "solicitacao",
    titulo,
    setor_id: SETOR.operacoes,
    aberto_por: U.solicitante,
    ...campos,
  });

async function campo<T = unknown>(id: string, coluna: string): Promise<T> {
  const { rows } = await db.query<{ v: T }>(
    `select ${coluna} as v from os.chamados where id = $1`,
    [id],
  );
  return rows[0]?.v as T;
}

const mudar = (id: string, set: string) =>
  erro(`update os.chamados set ${set} where id = '${id}'`);

async function titulos(usuario: string, prefixo: string): Promise<string[]> {
  const { rows } = await como(usuario, () =>
    db.query<{ titulo: string }>(
      `select titulo from os.chamados where titulo like '${prefixo}%' order by titulo`,
    ),
  );
  return rows.map((r) => r.titulo);
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
  for (const [nome, perfil] of Object.entries(PESSOAS) as [
    Pessoa,
    { p: string[]; s: Setor[] },
  ][]) {
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
    for (const s of perfil.s) {
      await db.query(
        "insert into os.setor_membros (setor_id, usuario_id) values ($1, $2)",
        [SETOR[s], id],
      );
    }
  }
}, 60_000);

describe("estrutura e dados iniciais", () => {
  it("liga o RLS em todas as tabelas de os", async () => {
    const { rows } = await db.query(
      "select tablename from pg_tables where schemaname = 'os' and not rowsecurity",
    );
    expect(rows).toEqual([]);
  });

  it("18 permissões os.*, todas no Administrador; a Diretoria acompanha", async () => {
    expect(
      await linhas("select 1 from core.permissoes where codigo like 'os.%'"),
    ).toBe(18);
    const permissoesDe = async (cargo: string) =>
      (
        await db.query<{ p: string }>(
          `select cp.permissao as p from core.cargo_permissoes cp
           join core.cargos c on c.id = cp.cargo_id
           where c.nome = '${cargo}' and cp.permissao like 'os.%' order by 1`,
        )
      ).rows.map((r) => r.p);
    expect(await permissoesDe("Administrador")).toHaveLength(18);
    expect(await permissoesDe("Diretoria")).toEqual([
      "os.acessar",
      "os.ativos",
      "os.custos",
      "os.exportar",
      "os.painel_geral",
      "os.todos_setores",
    ]);
  });

  it("setores, categorias e subcategorias de Estrutura", async () => {
    const { rows } = await db.query<{ nome: string }>(
      "select nome from os.setores order by ordem",
    );
    expect(rows.map((r) => r.nome)).toEqual([
      "Operações",
      "Comercial",
      "Marketing",
      "Sustentabilidade",
      "Estacionamento",
      "Financeiro",
      "Gestão",
    ]);
    expect(
      await linhas("select 1 from os.categorias where pai_id is null"),
    ).toBe(20);
    expect(
      (
        await db.query<{ nome: string }>(
          "select nome from os.categorias where no_portal order by ordem",
        )
      ).rows.map((r) => r.nome),
    ).toEqual([
      "Manutenção",
      "Acesso ao telhado",
      "Enviar projeto",
      "Reunião",
      "Envio de documentos",
    ]);
    const { rows: subs } = await db.query<{ nome: string; mesmo: boolean }>(
      `select c.nome, c.setor_id = p.setor_id as mesmo from os.categorias c
       join os.categorias p on p.id = c.pai_id
       where p.nome = 'Estrutura' order by c.ordem`,
    );
    expect(subs).toEqual([
      { nome: "Calha", mesmo: true },
      { nome: "Infiltração", mesmo: true },
    ]);
  });

  it("subcategoria tem um nível só e fica no setor do pai", async () => {
    const calha = await valor<string>(
      "select id from os.categorias where nome = 'Calha'",
    );
    const estrutura = await valor<string>(
      "select id from os.categorias where nome = 'Estrutura'",
    );
    expect(
      await erro(
        `insert into os.categorias (setor_id, pai_id, nome) values ('${SETOR.operacoes}', '${calha}', 'Neta')`,
      ),
    ).toMatch(/um nível/);
    expect(
      await erro(
        `insert into os.categorias (setor_id, pai_id, nome) values ('${SETOR.marketing}', '${estrutura}', 'Outro setor')`,
      ),
    ).toMatch(/mesmo setor/);
  });

  it("agenda do Telhado ligada ao Acesso ao telhado, com 2 por dia", async () => {
    const { rows } = await db.query<{ limite_por_dia: number; nome: string }>(
      `select a.nome, a.limite_por_dia from os.categorias c
       join os.agendas a on a.id = c.agenda_id where c.nome = 'Acesso ao telhado'`,
    );
    expect(rows).toEqual([{ nome: "Telhado", limite_por_dia: 2 }]);
  });

  it("modelos de entrada e saída com itens; feriados; textos do laudo", async () => {
    const { rows } = await db.query<{ nome: string; itens: number }>(
      `select m.nome, count(i.id)::int as itens from os.modelos m
       join os.modelo_itens i on i.modelo_id = m.id group by m.nome order by m.nome`,
    );
    expect(rows).toEqual([
      { nome: "Entrada de cliente", itens: 6 },
      { nome: "Saída de cliente", itens: 3 },
    ]);
    expect(
      await linhas("select 1 from os.feriados where data = '2026-11-20'"),
    ).toBe(1);
    const { rows: p } = await db.query<{
      tipos: string[];
      ambientes: number;
      causas: number;
    }>(
      `select array(select jsonb_object_keys(vistoria_textos) order by 1) as tipos,
         cardinality(vistoria_ambientes) as ambientes, cardinality(causas_falha) as causas
       from os.parametros`,
    );
    expect(p[0]).toEqual({
      tipos: ["entrada", "extraordinaria", "preventiva", "saida"],
      ambientes: 12,
      causas: 8,
    });
  });

  it("entra no histórico do sistema: auditoria e eventos no módulo os", async () => {
    expect(
      await valor("select core.modulo_da_auditoria('os.chamados', '{}')"),
    ).toBe("os");
    expect(
      await valor("select core.modulo_da_auditoria('rh.cargos', '{}')"),
    ).toBe("rh");
    expect(
      await erro(
        "insert into core.logs (modulo, evento, descricao) values ('os', 'teste', 'Teste')",
      ),
    ).toBeNull();
    expect(
      await erro(
        "insert into core.logs (modulo, evento, descricao) values ('outro', 'teste', 'Teste')",
      ),
    ).toMatch(/logs_modulo_check/);
  });
});

describe("quem vê o chamado (os.ve_chamado)", () => {
  beforeAll(async () => {
    await chamado("V1 fila");
    await chamado("V2 atribuído", { responsavel_id: U.tecnico });
    const doMarketing = {
      setor_id: SETOR.marketing,
      aberto_por: U.marketing,
      responsavel_id: U.marketing,
    };
    await chamado("V3 outro setor", { ...doMarketing, responsavel_id: null });
    const v4 = await chamado("V4 destino pessoa", doMarketing);
    await inserir("os.destinatarios", { chamado_id: v4, usuario_id: U.colega });
    const v5 = await chamado("V5 destino setor", doMarketing);
    await inserir("os.destinatarios", {
      chamado_id: v5,
      setor_id: SETOR.operacoes,
    });
    const v6 = await chamado("V6 citado", doMarketing);
    await db.query(
      "insert into os.participantes (chamado_id, usuario_id, motivo) values ($1, $2, 'mencionado')",
      [v6, U.citado],
    );
  });

  it("quem abriu vê os seus", async () => {
    expect(await titulos(U.solicitante, "V")).toEqual([
      "V1 fila",
      "V2 atribuído",
    ]);
  });

  it("o responsável vê o dele; o setor vê a fila e o que foi mandado ao setor", async () => {
    expect(await titulos(U.tecnico, "V")).toEqual([
      "V1 fila",
      "V2 atribuído",
      "V5 destino setor",
    ]);
  });

  it("colega do setor vê a fila, mas não o chamado atribuído a outro", async () => {
    expect(await titulos(U.colega, "V")).toEqual([
      "V1 fila",
      "V4 destino pessoa",
      "V5 destino setor",
    ]);
  });

  it("com os.meu_setor (ou gerenciando o setor) vê todos do setor", async () => {
    for (const u of [U.supervisor, U.gestor, U.gerente]) {
      expect(await titulos(u, "V")).toEqual([
        "V1 fila",
        "V2 atribuído",
        "V5 destino setor",
      ]);
    }
  });

  it("com os.todos_setores vê tudo", async () => {
    expect(await titulos(U.diretor, "V")).toHaveLength(6);
  });

  it("citado vê o chamado em que foi citado", async () => {
    expect(await titulos(U.citado, "V")).toEqual(["V6 citado"]);
  });

  it("quem abriu e o setor de origem continuam vendo os do Marketing", async () => {
    expect(await titulos(U.marketing, "V")).toEqual([
      "V3 outro setor",
      "V4 destino pessoa",
      "V5 destino setor",
      "V6 citado",
    ]);
  });

  it("sem nenhuma permissão os.* não vê nada", async () => {
    expect(await titulos(U.estranho, "V")).toEqual([]);
    await como(U.estranho, async () => {
      expect(await linhas("select * from os.setores")).toBe(0);
      expect(await linhas("select * from os.destinatarios")).toBe(0);
    });
  });

  it("usuário inativo perde o acesso", async () => {
    expect(await titulos(U.inativo, "V")).toEqual([
      "V1 fila",
      "V5 destino setor",
    ]);
    await db.exec(
      `update core.usuarios set ativo = false where id = '${U.inativo}'`,
    );
    expect(await titulos(U.inativo, "V")).toEqual([]);
  });
});

describe("abrir chamado", () => {
  const abrir = (abertoPor: string) =>
    `insert into os.chamados (tipo, titulo, setor_id, aberto_por)
     values ('solicitacao', 'A aberto', '${SETOR.operacoes}', '${abertoPor}')`;

  it("exige os.acessar", async () => {
    for (const u of [U.vistoriador, U.estranho]) {
      await como(u, async () => {
        expect(await erro(abrir(u))).toMatch(/row-level security/);
      });
    }
  });

  it("só em nome de si mesmo", async () => {
    await como(U.solicitante, async () => {
      expect(await erro(abrir(U.tecnico))).toMatch(/row-level security/);
      expect(await erro(abrir(U.solicitante))).toBeNull();
    });
    expect(await titulos(U.solicitante, "A")).toEqual(["A aberto"]);
  });
});

describe("ciclo do chamado (os.ciclo_do_chamado)", () => {
  it("anda pelo ciclo e preenche as datas", async () => {
    const id = await chamado("C ciclo", { prazo: "2026-12-01 18:00-03" });
    expect(await mudar(id, "status = 'aguardando'")).toMatch(
      /não é possível passar de aberto para aguardando/,
    );

    expect(await mudar(id, "status = 'em_andamento'")).toBeNull();
    expect(await campo(id, "primeira_resposta_em")).not.toBeNull();
    expect(await campo(id, "iniciado_em")).not.toBeNull();

    // Aguardando exige o motivo.
    expect(await mudar(id, "status = 'aguardando'")).toMatch(
      /check constraint/,
    );
    expect(
      await mudar(
        id,
        "status = 'aguardando', aguardando_tipo = 'material', aguardando_motivo = 'Peça encomendada'",
      ),
    ).toBeNull();
    expect(await campo(id, "aguardando_desde")).not.toBeNull();

    // Parado há 2 horas: ao retomar, o tempo vai para aguardando_min e o
    // prazo anda o mesmo tanto.
    await mudar(id, "aguardando_desde = now() - interval '2 hours'");
    const prazoAntes = await campo<Date>(id, "prazo");
    expect(await mudar(id, "status = 'em_andamento'")).toBeNull();
    expect(await campo(id, "aguardando_min")).toBe(120);
    expect(await campo(id, "aguardando_desde")).toBeNull();
    const empurrado =
      (new Date(await campo<Date>(id, "prazo")).getTime() -
        new Date(prazoAntes).getTime()) /
      1000;
    expect(empurrado).toBeGreaterThanOrEqual(7200);
    expect(empurrado).toBeLessThan(7260);

    expect(await mudar(id, "status = 'concluido'")).toBeNull();
    expect(await campo(id, "concluido_em")).not.toBeNull();
    expect(await mudar(id, "status = 'aguardando'")).toMatch(
      /não é possível passar de concluido para aguardando/,
    );

    // Reabrir.
    expect(await mudar(id, "status = 'em_andamento'")).toBeNull();
    expect(await campo(id, "reaberto_vezes")).toBe(1);
    expect(await campo(id, "concluido_em")).toBeNull();

    expect(await mudar(id, "status = 'concluido'")).toBeNull();
    expect(await mudar(id, "status = 'fechado'")).toBeNull();
    expect(await campo(id, "fechado_em")).not.toBeNull();
    expect(await campo(id, "concluido_em")).not.toBeNull();

    for (const s of ["em_andamento", "aberto", "cancelado", "concluido"]) {
      expect(await mudar(id, `status = '${s}'`)).toMatch(
        /não é possível passar de fechado/,
      );
    }
  });

  it("fechar direto do aberto também marca concluído", async () => {
    const id = await chamado("C fechar direto");
    expect(await mudar(id, "status = 'fechado'")).toBeNull();
    expect(await campo(id, "concluido_em")).not.toBeNull();
    expect(await campo(id, "primeira_resposta_em")).not.toBeNull();
  });

  it("cancelar exige motivo e não tem volta", async () => {
    const id = await chamado("C cancelar");
    expect(await mudar(id, "status = 'cancelado'")).toMatch(/check constraint/);
    expect(
      await mudar(
        id,
        "status = 'cancelado', motivo_cancelamento = 'Aberto em duplicidade'",
      ),
    ).toBeNull();
    expect(await campo(id, "cancelado_em")).not.toBeNull();
    expect(await mudar(id, "status = 'aberto'")).toMatch(
      /não é possível passar de cancelado/,
    );
  });
});

describe("quem pode mudar o quê (os.validar_chamado)", () => {
  const PRAZO = "2026-12-01 18:00-03";

  it("colega do setor não muda prazo nem prioridade", async () => {
    const id = await chamado("Q fila", { prazo: PRAZO });
    await como(U.colega, async () => {
      expect(await mudar(id, "prioridade = 'urgente'")).toMatch(
        /muda prazo e prioridade/,
      );
      expect(await mudar(id, "prazo = prazo + interval '1 day'")).toMatch(
        /muda prazo e prioridade/,
      );
      // Nem de carona numa troca de status.
      expect(
        await mudar(
          id,
          "status = 'em_andamento', prazo = prazo + interval '1 day'",
        ),
      ).toMatch(/muda prazo e prioridade/);
    });
    await como(U.solicitante, async () => {
      expect(await mudar(id, "prioridade = 'alta'")).toBeNull();
    });
  });

  it("ao retomar de Aguardando, o prazo empurrado pelo banco passa", async () => {
    const id = await chamado("Q aguardando", { prazo: PRAZO });
    await mudar(id, "status = 'em_andamento'");
    await mudar(id, "status = 'aguardando', aguardando_tipo = 'lojista'");
    await mudar(id, "aguardando_desde = now() - interval '1 hour'");
    await como(U.colega, async () => {
      expect(await mudar(id, "status = 'em_andamento'")).toBeNull();
    });
    expect(await campo(id, "aguardando_min")).toBe(60);
  });

  it("colega assume a fila e devolve o que é dele, mas não atribui a outro", async () => {
    const id = await chamado("Q assumir");
    await como(U.colega, async () => {
      expect(await mudar(id, `responsavel_id = '${U.tecnico}'`)).toMatch(
        /troca o responsável/,
      );
      expect(await mudar(id, `responsavel_id = '${U.colega}'`)).toBeNull();
    });
    expect(await campo(id, "responsavel_id")).toBe(U.colega);
    await como(U.colega, async () => {
      expect(await mudar(id, "responsavel_id = null")).toBeNull();
    });
    expect(await campo(id, "responsavel_id")).toBeNull();
  });

  it("não troca o responsável de outro (nem vendo o setor inteiro)", async () => {
    const id = await chamado("Q de outro", { responsavel_id: U.tecnico });
    await como(U.supervisor, async () => {
      expect(await mudar(id, `responsavel_id = '${U.supervisor}'`)).toMatch(
        /troca o responsável/,
      );
    });
    // Sem os.meu_setor, o colega nem enxerga a linha.
    await como(U.colega, () => mudar(id, `responsavel_id = '${U.colega}'`));
    expect(await campo(id, "responsavel_id")).toBe(U.tecnico);
  });

  it("quem gerencia o setor troca responsável, prazo e prioridade", async () => {
    const id = await chamado("Q gestor", {
      responsavel_id: U.tecnico,
      prazo: PRAZO,
    });
    await como(U.gestor, async () => {
      expect(
        await mudar(
          id,
          `responsavel_id = '${U.colega}', prazo = prazo + interval '2 days', prioridade = 'alta'`,
        ),
      ).toBeNull();
    });
    expect(await campo(id, "responsavel_id")).toBe(U.colega);
    expect(await campo(id, "prioridade")).toBe("alta");
    await como(U.gerente, async () => {
      expect(await mudar(id, `responsavel_id = '${U.tecnico}'`)).toBeNull();
    });
    expect(await campo(id, "responsavel_id")).toBe(U.tecnico);
  });

  it("encerrado não muda responsável, prazo, prioridade nem setor", async () => {
    const id = await chamado("Q encerrado", {
      responsavel_id: U.tecnico,
      prazo: PRAZO,
    });
    await mudar(id, "status = 'fechado'");
    await como(U.gestor, async () => {
      for (const s of [
        "prioridade = 'urgente'",
        "responsavel_id = null",
        "prazo = prazo + interval '1 day'",
      ])
        expect(await mudar(id, s)).toMatch(/chamado encerrado não muda/);
    });
    expect(await campo(id, "responsavel_id")).toBe(U.tecnico);
  });

  it("só quem pediu (ou gerencia) confirma ou reabre um Concluído", async () => {
    const confirmar = await chamado("Q confirmar", {
      responsavel_id: U.tecnico,
    });
    const reabrir = await chamado("Q reabrir", { responsavel_id: U.tecnico });
    await como(U.tecnico, async () => {
      for (const id of [confirmar, reabrir]) {
        expect(await mudar(id, "status = 'em_andamento'")).toBeNull();
        expect(await mudar(id, "status = 'concluido'")).toBeNull();
      }
      expect(await mudar(confirmar, "status = 'fechado'")).toMatch(
        /só quem pediu confirma/,
      );
      expect(await mudar(reabrir, "status = 'em_andamento'")).toMatch(
        /só quem pediu confirma/,
      );
    });
    expect(await campo(confirmar, "concluido_por")).toBe(U.tecnico);
    await como(U.solicitante, async () => {
      expect(await mudar(confirmar, "status = 'fechado'")).toBeNull();
    });
    expect(await campo(confirmar, "fechado_por")).toBe(U.solicitante);
    await como(U.gestor, async () => {
      expect(await mudar(reabrir, "status = 'em_andamento'")).toBeNull();
    });
    expect(await campo(reabrir, "reaberto_vezes")).toBe(1);
  });

  it("só quem pediu ou gerencia cancela", async () => {
    const id = await chamado("Q cancelar");
    const cancelar =
      "status = 'cancelado', motivo_cancelamento = 'Não precisa mais'";
    await como(U.colega, async () => {
      expect(await mudar(id, cancelar)).toMatch(/cancela/);
    });
    await como(U.solicitante, async () => {
      expect(await mudar(id, cancelar)).toBeNull();
    });
    expect(await campo(id, "cancelado_por")).toBe(U.solicitante);
  });
});

describe("vários destinatários (os.sincronizar_destinos)", () => {
  async function comDestinos(titulo: string, tipo: string, setores: Setor[]) {
    const id = await chamado(titulo, { tipo, setor_id: SETOR.comercial });
    for (const s of setores) {
      await inserir("os.destinatarios", { chamado_id: id, setor_id: SETOR[s] });
    }
    return id;
  }
  const destino = (id: string, s: Setor, status: string) =>
    `update os.destinatarios set status = '${status}'
     where chamado_id = '${id}' and setor_id = '${SETOR[s]}'`;

  it("Aviso para 3 setores: anda com o primeiro e fecha com o último", async () => {
    const id = await comDestinos("D aviso", "aviso", [
      "operacoes",
      "marketing",
      "estacionamento",
    ]);
    await como(U.tecnico, async () => {
      expect(await erro(destino(id, "operacoes", "em_andamento"))).toBeNull();
    });
    expect(await campo(id, "status")).toBe("em_andamento");

    await como(U.tecnico, () =>
      db.query(destino(id, "operacoes", "concluido")),
    );
    await como(U.marketing, () =>
      db.query(destino(id, "marketing", "concluido")),
    );
    expect(await campo(id, "status")).toBe("em_andamento");
    expect(
      await valor(
        `select concluido_por from os.destinatarios where chamado_id = '${id}' and setor_id = '${SETOR.marketing}'`,
      ),
    ).toBe(U.marketing);

    await db.query(destino(id, "estacionamento", "concluido"));
    expect(await campo(id, "status")).toBe("fechado");
    expect(await campo(id, "fechado_em")).not.toBeNull();
  });

  it("Solicitação para 2 setores conclui (espera a confirmação) e volta se um destino reabre", async () => {
    const id = await comDestinos("D solicitação", "solicitacao", [
      "operacoes",
      "marketing",
    ]);
    await db.query(destino(id, "operacoes", "concluido"));
    expect(await campo(id, "status")).toBe("em_andamento");
    await db.query(destino(id, "marketing", "concluido"));
    expect(await campo(id, "status")).toBe("concluido");

    await como(U.marketing, () =>
      db.query(destino(id, "marketing", "em_andamento")),
    );
    expect(await campo(id, "status")).toBe("em_andamento");
    expect(await campo(id, "concluido_em")).toBeNull();
  });

  it("quem não é destinatário não mexe no destino", async () => {
    const id = await comDestinos("D alheio", "solicitacao", ["marketing"]);
    await como(U.tecnico, () =>
      db.query(destino(id, "marketing", "concluido")),
    );
    expect(
      await valor(
        `select status from os.destinatarios where chamado_id = '${id}'`,
      ),
    ).toBe("aberto");
  });

  it("em ordem: cada destino só anda depois que o anterior concluir", async () => {
    const id = await chamado("D em ordem", {
      setor_id: SETOR.comercial,
      destinos_em_ordem: true,
    });
    const ordem: Setor[] = ["comercial", "operacoes", "marketing"];
    for (const [i, s] of ordem.entries())
      await inserir("os.destinatarios", {
        chamado_id: id,
        setor_id: SETOR[s],
        ordem: i,
      });

    expect(await erro(destino(id, "operacoes", "em_andamento"))).toMatch(
      /espera a anterior/,
    );
    expect(await erro(destino(id, "marketing", "concluido"))).toMatch(
      /espera a anterior/,
    );
    // Confirmar a leitura não depende da vez.
    expect(
      await erro(
        `update os.destinatarios set lido_em = now() where chamado_id = '${id}' and setor_id = '${SETOR.marketing}'`,
      ),
    ).toBeNull();

    await db.query(destino(id, "comercial", "concluido"));
    expect(await erro(destino(id, "operacoes", "concluido"))).toBeNull();
    expect(await erro(destino(id, "marketing", "concluido"))).toBeNull();
    expect(await campo(id, "status")).toBe("concluido");
  });
});

describe("dinheiro só com os.custos", () => {
  let id = "";
  const MATERIAIS = "select * from os.materiais where chamado_id = ";

  beforeAll(async () => {
    id = await chamado("$ OS com custo", {
      tipo: "os",
      responsavel_id: U.tecnico,
    });
    const material = await inserir("os.materiais", {
      chamado_id: id,
      descricao: "Disjuntor 20A",
      quantidade: 2,
    });
    await db.query(
      "insert into os.material_valores (material_id, valor_unitario) values ($1, 35.9)",
      [material],
    );
    const tecnico = await inserir("os.tecnicos", { nome: "Técnico Exemplo" });
    await db.query(
      "insert into os.tecnico_valores (tecnico_id, vigente_desde, valor_minuto) values ($1, '2026-01-01', 0.5)",
      [tecnico],
    );
    await db.query(
      "insert into os.os_custos (chamado_id, valor_terceirizado) values ($1, 100)",
      [id],
    );
  });

  it("quem vê a OS vê os materiais, mas nenhum valor", () =>
    como(U.tecnico, async () => {
      expect(await linhas(`${MATERIAIS}'${id}'`)).toBe(1);
      expect(await linhas("select * from os.material_valores")).toBe(0);
      expect(await linhas("select * from os.os_custos")).toBe(0);
      expect(await linhas("select * from os.tecnico_valores")).toBe(0);
      expect(
        await erro(
          `insert into os.material_valores (material_id, valor_unitario)
           select id, 1 from os.materiais where chamado_id = '${id}'
           on conflict (material_id) do nothing`,
        ),
      ).toMatch(/row-level security/);
    }));

  it("quem não vê a OS não vê os materiais", () =>
    como(U.solicitante, async () => {
      // O solicitante abriu: vê. O citado, não.
      expect(await linhas(`${MATERIAIS}'${id}'`)).toBe(1);
    }).then(() =>
      como(U.citado, async () => {
        expect(await linhas(`${MATERIAIS}'${id}'`)).toBe(0);
      }),
    ));

  it("com os.custos vê custo, valores dos materiais e valor por minuto", () =>
    como(U.financeiro, async () => {
      expect(await linhas("select * from os.os_custos")).toBe(1);
      expect(await linhas("select * from os.material_valores")).toBe(1);
      expect(await linhas("select * from os.tecnico_valores")).toBe(1);
    }));

  it("o resultado do cálculo só o servidor grava", async () => {
    const gravar = `select os.gravar_calculo_os('${id}', '{"minutos": 90, "minuto_homem": 180, "custo_mao_obra": 90, "custo_materiais": 71.8, "custo_total": 261.8, "completo": true}')`;
    for (const u of [U.tecnico, U.financeiro]) {
      await como(u, async () => {
        expect(await erro(gravar)).toMatch(/permission denied/);
      });
    }
    await comoServidor(async () => {
      expect(await erro(gravar)).toBeNull();
    });
    const { rows } = await db.query<{
      custo_total: string;
      valor_terceirizado: string;
    }>(
      `select custo_total, valor_terceirizado from os.os_custos where chamado_id = '${id}'`,
    );
    expect(rows).toEqual([
      { custo_total: "261.80", valor_terceirizado: "100.00" },
    ]);
  });
});

describe("agenda (os.reservar_horario)", () => {
  let telhado = "";
  const reservar = (inicio: string, fim: string) =>
    `select os.reservar_horario('${telhado}', '${inicio}-03', '${fim}-03', null, null)`;

  beforeAll(async () => {
    telhado = await valor<string>(
      "select id from os.agendas where nome = 'Telhado'",
    );
  });

  it("respeita o limite do dia (Telhado: 2)", () =>
    como(U.solicitante, async () => {
      expect(
        await erro(reservar("2026-11-03 07:00", "2026-11-03 08:00")),
      ).toBeNull();
      expect(
        await erro(reservar("2026-11-03 08:00", "2026-11-03 09:00")),
      ).toBeNull();
      expect(
        await erro(reservar("2026-11-03 09:00", "2026-11-03 10:00")),
      ).toMatch(/limite de horários/);
    }));

  it("não marca horário que se choca com outro", () =>
    como(U.solicitante, async () => {
      expect(
        await erro(reservar("2026-11-04 07:00", "2026-11-04 08:00")),
      ).toBeNull();
      expect(
        await erro(reservar("2026-11-04 07:30", "2026-11-04 08:30")),
      ).toMatch(/acabou de ser ocupado/);
    }));

  it("marcar só pela função, e com permissão do módulo", async () => {
    await como(U.solicitante, async () => {
      expect(
        await erro(
          `insert into os.agendamentos (agenda_id, inicio, fim) values ('${telhado}', '2026-11-05 07:00-03', '2026-11-05 08:00-03')`,
        ),
      ).toMatch(/row-level security/);
    });
    await como(U.estranho, async () => {
      expect(
        await erro(reservar("2026-11-05 07:00", "2026-11-05 08:00")),
      ).toMatch(/sem permissão/);
    });
  });

  it("bloqueio manda os marcados para remarcar e fecha o período", async () => {
    const bloquear = `insert into os.agenda_bloqueios (agenda_id, inicio, fim, motivo)
      values ('${telhado}', '2026-11-04 06:00-03', '2026-11-04 12:00-03', 'Chuva')`;
    await como(U.solicitante, async () => {
      expect(await erro(bloquear)).toMatch(/row-level security/);
    });
    await como(U.agenda, async () => {
      expect(await erro(bloquear)).toBeNull();
    });
    const { rows } = await db.query<{ status: string }>(
      `select status from os.agendamentos
       where inicio::date = '2026-11-04' or inicio::date = '2026-11-03' order by inicio`,
    );
    expect(rows.map((r) => r.status)).toEqual([
      "marcado",
      "marcado",
      "remarcar",
    ]);
    await como(U.solicitante, async () => {
      expect(
        await erro(reservar("2026-11-04 09:00", "2026-11-04 10:00")),
      ).toMatch(/bloqueado/);
    });
  });
});

describe("vistorias", () => {
  const nova = (codigo?: string) =>
    inserir("os.vistorias", {
      ...(codigo ? { codigo } : {}),
      tipo: "entrada",
      data: "2026-10-23",
      vistoriador_nome: "Vistoriador Exemplo",
      locador: "ARP",
      locatario: "Loja Exemplo",
      bloco: "A",
      unidade: "101",
    });
  const proximo = () => valor<string>("select os.proximo_codigo_vistoria()");

  it("código ARP01, ARP02… ARP10… ARP100", () =>
    como(U.vistoriador, async () => {
      expect(await proximo()).toBe("ARP01");
      const id = await nova();
      expect(
        await valor(`select codigo from os.vistorias where id = '${id}'`),
      ).toBe("ARP01");
      expect(await proximo()).toBe("ARP02");
      await nova("ARP09");
      await nova("Laudo antigo 7");
      expect(await proximo()).toBe("ARP10");
      await nova();
      expect(await proximo()).toBe("ARP11");
      await nova("ARP99");
      expect(await proximo()).toBe("ARP100");
      await nova();
      expect(await proximo()).toBe("ARP101");
    }));

  it("só com os.vistorias", () =>
    como(U.colega, async () => {
      expect(await linhas("select * from os.vistorias")).toBe(0);
      expect(await erro("select os.proximo_codigo_vistoria()")).toBeNull();
      expect(
        await erro(
          "insert into os.vistorias (codigo, tipo, data, vistoriador_nome, locador, locatario, bloco, unidade) values ('X1', 'saida', '2026-10-23', 'X', 'ARP', 'L', 'A', '1')",
        ),
      ).toMatch(/row-level security/);
    }));
});

describe("ativos", () => {
  let ativo = "";

  it("só os.ativos_gerenciar cadastra; a situação guarda os períodos", async () => {
    await como(U.ativos, async () => {
      expect(
        await erro("insert into os.ativos (nome) values ('Sem permissão')"),
      ).toMatch(/row-level security/);
    });
    ativo = await como(U.ativosGerenciar, () =>
      inserir("os.ativos", { nome: "Bomba de recalque" }),
    );
    expect(
      await valor(`select codigo from os.ativos where id = '${ativo}'`),
    ).toMatch(/^AT-\d{4}$/);

    await como(U.ativosGerenciar, async () => {
      await db.query(
        `update os.ativos set situacao = 'em_manutencao' where id = '${ativo}'`,
      );
      // Regravar a mesma situação não abre período novo.
      await db.query(
        `update os.ativos set situacao = 'em_manutencao' where id = '${ativo}'`,
      );
    });
    const { rows } = await db.query<{
      situacao: string;
      fechado: boolean;
      usuario_id: string;
    }>(
      `select situacao, ate is not null as fechado, usuario_id from os.ativo_situacoes
       where ativo_id = '${ativo}' order by desde, ate nulls last`,
    );
    expect(rows).toEqual([
      { situacao: "em_uso", fechado: true, usuario_id: U.ativosGerenciar },
      {
        situacao: "em_manutencao",
        fechado: false,
        usuario_id: U.ativosGerenciar,
      },
    ]);
  });

  it("vê com os.ativos; sem ela, só a lista para vincular (com os.acessar)", async () => {
    await como(U.ativos, async () => {
      expect(await linhas("select * from os.ativos")).toBeGreaterThan(0);
      expect(await linhas("select * from os.ativo_situacoes")).toBe(2);
      expect(
        await erro(
          `update os.ativo_situacoes set ate = now() where ativo_id = '${ativo}'`,
        ),
      ).toMatch(/permission denied/);
      expect(await linhas("select * from os.ativos_para_vincular()")).toBe(0);
    });
    await como(U.colega, async () => {
      expect(await linhas("select * from os.ativos")).toBe(0);
      expect(await linhas("select * from os.ativo_situacoes")).toBe(0);
      expect(await linhas("select * from os.ativos_para_vincular()")).toBe(1);
    });
  });

  it("plano preventivo e série não criam duas vezes na mesma data", async () => {
    const plano = await inserir("os.planos_preventivos", {
      ativo_id: ativo,
      titulo: "Revisão trimestral",
      frequencia_meses: 3,
      proxima_data: "2026-12-01",
      setor_id: SETOR.operacoes,
    });
    const doPlano = { tipo: "os", plano_id: plano, plano_data: "2026-12-01" };
    await chamado("P preventiva", doPlano);
    await expect(chamado("P preventiva de novo", doPlano)).rejects.toThrow(
      /chamados_plano_id_plano_data_key/,
    );

    const serie = {
      serie_id: "70000000-0000-0000-0000-000000000001",
      serie_data: "2026-11-10",
    };
    await chamado("P lembrete", serie);
    await expect(chamado("P lembrete de novo", serie)).rejects.toThrow(
      /chamados_serie_id_serie_data_key/,
    );
  });

  it("resumo de manutenção: custo sem canceladas, corretivas sem preventivas", async () => {
    const outro = await inserir("os.ativos", { nome: "Portão da doca" });
    const categoria = async (nome: string) =>
      valor<string>(`select id from os.categorias where nome = '${nome}'`);
    const eletrica = await categoria("Elétrica");
    const preventiva = await categoria("Preventiva");
    const plano = await inserir("os.planos_preventivos", {
      ativo_id: outro,
      titulo: "Lubrificar",
      frequencia_dias: 30,
      proxima_data: "2026-11-01",
      setor_id: SETOR.operacoes,
    });
    const os = (titulo: string, extra: Record<string, Valor>, custo: number) =>
      chamado(titulo, { tipo: "os", ativo_id: outro, ...extra }).then((id) =>
        db.query(
          "insert into os.os_custos (chamado_id, custo_total) values ($1, $2)",
          [id, custo],
        ),
      );
    await os("R corretiva", { categoria_id: eletrica }, 100);
    await os("R preventiva", { categoria_id: preventiva }, 50);
    await os("R do plano", { plano_id: plano, plano_data: "2026-11-01" }, 0);
    await os(
      "R cancelada",
      {
        categoria_id: eletrica,
        status: "cancelado",
        motivo_cancelamento: "Duplicada",
      },
      999,
    );
    await os("R não é OS", { tipo: "solicitacao" }, 77);

    const resumo = `select custo_periodo::float, custo_total::float, corretivas_periodo::int,
        preventivas_periodo::int, os_abertas::int
      from os.resumo_ativos('2000-01-01') where ativo_id = '${outro}'`;
    const { rows } = await como(U.ativos, () => db.query(resumo));
    expect(rows).toEqual([
      {
        custo_periodo: 150,
        custo_total: 150,
        corretivas_periodo: 1,
        preventivas_periodo: 2,
        os_abertas: 3,
      },
    ]);
    expect(await como(U.colega, () => linhas(resumo))).toBe(0);
  });
});

describe("modelos, notificações, linha do tempo e anexos", () => {
  it("um disparo por modelo e loja; só o servidor grava", async () => {
    const loja = await inserir("os.lojas", {
      luc: "A-101",
      nome: "Loja Exemplo",
    });
    const modelo = await valor<string>(
      "select id from os.modelos where nome = 'Entrada de cliente'",
    );
    const disparar = `insert into os.disparos (modelo_id, loja_id) values ('${modelo}', '${loja}')`;
    await como(U.gestor, async () => {
      expect(await erro(disparar)).toMatch(/permission denied/);
    });
    expect(await erro(disparar)).toBeNull();
    expect(await erro(disparar)).toMatch(/disparos_modelo_id_loja_id_key/);
  });

  it("notificações: cada um vê e marca as suas; ninguém cria pela aplicação", async () => {
    for (const u of [U.tecnico, U.colega]) {
      await db.query(
        "insert into os.notificacoes (usuario_id, tipo, titulo, href) values ($1, 'atribuido', 'Novo chamado', '/os')",
        [u],
      );
    }
    await como(U.tecnico, async () => {
      expect(await linhas("select * from os.notificacoes")).toBe(1);
      await db.query("update os.notificacoes set lida_em = now()");
      expect(
        await erro(
          `insert into os.notificacoes (usuario_id, tipo, titulo, href) values ('${U.tecnico}', 'x', 'Falsa', '/os')`,
        ),
      ).toMatch(/permission denied/);
      expect(await erro("delete from os.notificacoes")).toMatch(
        /permission denied/,
      );
    });
    const { rows } = await db.query<{ usuario_id: string; lida: boolean }>(
      "select usuario_id, lida_em is not null as lida from os.notificacoes order by usuario_id",
    );
    expect(rows).toEqual([
      { usuario_id: U.tecnico, lida: true },
      { usuario_id: U.colega, lida: false },
    ]);
  });

  it("linha do tempo: quem vê registra em nome próprio; ninguém edita nem apaga", async () => {
    const id = await chamado("E linha do tempo", {
      responsavel_id: U.tecnico,
    });
    const registrar = (autor: string) =>
      `insert into os.eventos (chamado_id, tipo, texto, autor_id) values ('${id}', 'comentario', 'Ok', '${autor}')`;
    await como(U.tecnico, async () => {
      expect(await erro(registrar(U.tecnico))).toBeNull();
      expect(await erro(registrar(U.colega))).toMatch(/row-level security/);
      expect(await erro("update os.eventos set texto = 'Editado'")).toMatch(
        /permission denied/,
      );
      expect(await erro("delete from os.eventos")).toMatch(/permission denied/);
    });
    await como(U.colega, async () => {
      expect(await erro(registrar(U.colega))).toMatch(/row-level security/);
      expect(
        await linhas(`select * from os.eventos where chamado_id = '${id}'`),
      ).toBe(0);
    });
  });

  it("anexos seguem o chamado (e o ativo, a permissão de ativos)", async () => {
    const id = await chamado("E anexos", { responsavel_id: U.tecnico });
    await db.query(
      "insert into os.anexos (chamado_id, nome, path) values ($1, 'foto.jpg', $2)",
      [id, `chamados/${id}/foto.jpg`],
    );
    const ativo = await inserir("os.ativos", { nome: "Gerador" });
    await db.query(
      "insert into os.anexos (ativo_id, nome, path, categoria) values ($1, 'manual.pdf', $2, 'manual')",
      [ativo, `ativos/${ativo}/manual.pdf`],
    );
    const anexos = "select nome from os.anexos order by nome";
    const nomes = async (u: string) =>
      (await como(u, () => db.query<{ nome: string }>(anexos))).rows.map(
        (r) => r.nome,
      );
    expect(await nomes(U.tecnico)).toEqual(["foto.jpg"]);
    expect(await nomes(U.diretor)).toEqual(["foto.jpg"]);
    expect(await nomes(U.colega)).toEqual([]);
    expect(await nomes(U.ativos)).toEqual(["manual.pdf"]);
    await como(U.colega, async () => {
      expect(
        await erro(
          `insert into os.anexos (chamado_id, nome, path) values ('${id}', 'x.jpg', 'chamados/${id}/x.jpg')`,
        ),
      ).toMatch(/row-level security/);
    });
  });
});

describe("pessoas do módulo (os.pessoas)", () => {
  const CARGO = "80000000-0000-0000-0000-000000000001";
  const pessoas = async () =>
    (
      await como(U.tecnico, () =>
        db.query<{ id: string }>("select id from os.pessoas()"),
      )
    ).rows.map((r) => r.id);

  it("só quem tem permissão os.* (individual ou pelo cargo ativo) e está ativo", async () => {
    await db.exec(`
      insert into core.cargos (id, nome) values ('${CARGO}', 'Técnico de campo');
      insert into core.cargo_permissoes (cargo_id, permissao) values ('${CARGO}', 'os.acessar');
      update core.usuarios set cargo_id = '${CARGO}' where id = '${U.porCargo}';
    `);
    const ids = await pessoas();
    expect(ids).toContain(U.tecnico);
    expect(ids).toContain(U.vistoriador);
    expect(ids).toContain(U.porCargo);
    expect(ids).not.toContain(U.estranho);
    expect(ids).not.toContain(U.inativo);

    await db.exec(`update core.cargos set ativo = false where id = '${CARGO}'`);
    expect(await pessoas()).not.toContain(U.porCargo);

    const setores = await como(U.tecnico, () =>
      valor<string[]>(
        `select setores from os.pessoas() where id = '${U.gestor}'`,
      ),
    );
    expect(setores).toEqual([SETOR.operacoes]);
    expect(
      await como(U.estranho, () => linhas("select * from os.pessoas()")),
    ).toBe(0);
  });
});

describe("auditoria", () => {
  it("parâmetros: só os.parametros edita, e a alteração fica registrada", async () => {
    const mudar = "update os.parametros set aviso_vencimento_horas = 48";
    await como(U.colega, () => db.query(mudar));
    expect(
      await valor("select aviso_vencimento_horas from os.parametros"),
    ).toBe(24);
    await como(U.parametros, () => db.query(mudar));
    expect(
      await valor("select aviso_vencimento_horas from os.parametros"),
    ).toBe(48);
    const { rows } = await db.query<{ usuario_id: string }>(
      // A linha sem usuário é a dos textos padrão, gravados pela migration.
      "select usuario_id from core.auditoria where tabela = 'os.parametros' and acao = 'update' and usuario_id is not null",
    );
    expect(rows).toEqual([{ usuario_id: U.parametros }]);
  });

  it("mudanças no chamado vão para a auditoria", async () => {
    expect(
      await linhas(
        `select 1 from core.auditoria where tabela = 'os.chamados' and acao = 'update' and usuario_id = '${U.gestor}'`,
      ),
    ).toBeGreaterThan(0);
  });

  it("com os.historico vê a auditoria do módulo (e só ela)", async () => {
    const DO_MODULO = "select 1 from core.auditoria where tabela like 'os.%'";
    const total = await linhas(DO_MODULO);
    expect(total).toBeGreaterThan(0);
    await como(U.auditor, async () => {
      expect(await linhas(DO_MODULO)).toBe(total);
      expect(
        await linhas(
          "select 1 from core.auditoria where tabela not like 'os.%'",
        ),
      ).toBe(0);
    });
    expect(
      await como(U.colega, () => linhas("select 1 from core.auditoria")),
    ).toBe(0);
  });
});

describe("portal do lojista: link único e sessão pelo CNPJ", () => {
  let sessao = "";
  beforeAll(async () => {
    const loja = await inserir("os.lojas", {
      luc: "P-01",
      nome: "Loja do portal",
      cnpj: "12345678000195",
    });
    sessao = await comoServidor(() =>
      inserir("os.portal_sessoes", {
        loja_id: loja,
        token: "s".repeat(40),
        expira_em: "2099-01-01",
      }),
    );
  });

  it("sessões: só quem gerencia o portal vê e encerra", async () => {
    expect(
      await como(U.solicitante, () =>
        linhas("select 1 from os.portal_sessoes"),
      ),
    ).toBe(0);
    expect(
      await como(U.portal, () => linhas("select 1 from os.portal_sessoes")),
    ).toBe(1);
    await como(U.portal, () =>
      db.query(
        `update os.portal_sessoes set encerrado_em = now() where id = '${sessao}'`,
      ),
    );
    expect(
      await valor(
        `select encerrado_em is not null from os.portal_sessoes where id = '${sessao}'`,
      ),
    ).toBe(true);
  });

  it("ninguém logado cria sessão nem lê as tentativas", async () => {
    await como(U.portal, async () => {
      expect(
        await erro(
          `insert into os.portal_sessoes (loja_id, token, expira_em) select loja_id, '${"t".repeat(40)}', '2099-01-01' from os.portal_sessoes limit 1`,
        ),
      ).toMatch(/permission denied|row-level security/);
      expect(await erro("select 1 from os.portal_tentativas")).toMatch(
        /permission denied/,
      );
    });
  });
});
