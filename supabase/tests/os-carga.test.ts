// Carga por pessoa do Meu setor contada no banco (os.carga_do_setor,
// 20261026190000_os_carga_setor). Oráculo: a regra de antes, congelada
// aqui. O servidor lia o responsável e o prazo dos chamados em aberto com
// os filtros da barra (pela sessão, RLS) e contava em JavaScript
// (cargaDosAbertos). Cada cenário roda as duas com a mesma pessoa logada e
// compara a carga que a tela mostra.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { type Carga, cargaDasContagens, ordenarCarga } from "@/lib/os/lista";

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

const SETORES = { S: "Operações", M: "Marketing" } as const;
type Setor = keyof typeof SETORES;

interface Perfil {
  p: string[];
  s: Setor[];
  inativo?: boolean;
}

const PESSOAS = {
  // Gerencia o setor S: vê o setor inteiro.
  gestor: { p: ["os.acessar", "os.meu_setor", "os.gerenciar_setor"], s: ["S"] },
  // Meu setor: vê o setor inteiro.
  meuSetor: { p: ["os.acessar", "os.meu_setor"], s: ["S"] },
  // Só membro: a fila do setor e o que é dele.
  ana: { p: ["os.acessar"], s: ["S"] },
  bia: { p: ["os.acessar"], s: ["S"] },
  // Responsável por chamados de S sem ser do setor.
  caio: { p: ["os.acessar"], s: ["M"] },
  // Todos os setores, sem ser de nenhum.
  todos: { p: ["os.acessar", "os.meu_setor", "os.todos_setores"], s: [] },
  semModulo: { p: ["rh.painel"], s: ["S"] },
  inativo: { p: ["os.acessar", "os.todos_setores"], s: ["S"], inativo: true },
} satisfies Record<string, Perfil>;
type Pessoa = keyof typeof PESSOAS;

const U = Object.fromEntries(
  Object.keys(PESSOAS).map((nome, i) => [
    nome,
    `00000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`,
  ]),
) as Record<Pessoa, string>;

const SETOR = {} as Record<Setor, string>;
const CATEGORIA: { a?: string; b?: string } = {};

/** O "agora" dos cenários (e um antes e um depois dele). */
const AGORA = "2026-10-26T15:00:00.000Z";

let db: PGlite;

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

async function inserir(
  tabela: string,
  campos: Record<string, string | number | boolean | string[] | null>,
): Promise<string> {
  const colunas = Object.keys(campos);
  const { rows } = await db.query<{ id: string }>(
    `insert into ${tabela} (${colunas.join(", ")})
     values (${colunas.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
    Object.values(campos),
  );
  return rows[0]?.id ?? "";
}

// ---------------------------------------------------------------------------
// A regra de antes (congelada): consulta com os filtros da barra e o cartão
// "Abertos" (o que responsaveisEPrazos pedia ao PostgREST) e a contagem em
// JavaScript (cargaDosAbertos).
// ---------------------------------------------------------------------------

const EM_ABERTO = ["aberto", "em_andamento", "aguardando"];

interface Barra {
  setor: string;
  /** Status da barra (statusDoFiltro): undefined é sem filtro. */
  status?: string[];
  tipos?: string[];
  categoria?: string;
  responsavel?: string;
  prioridade?: string;
  etiqueta?: string;
  de?: string;
  ate?: string;
}

/** statusComCartao(barra, cartão "Abertos"). */
const statusDaConsulta = (barra: string[] | undefined) =>
  barra?.length ? EM_ABERTO.filter((s) => barra.includes(s)) : EM_ABERTO;

async function linhasAntigas(
  b: Barra,
): Promise<{ responsavel_id: string | null; prazo: string | null }[]> {
  const status = statusDaConsulta(b.status);
  if (!status.length) return [];
  const onde = ["setor_id = $1", "status::text = any ($2)"];
  const valores: unknown[] = [b.setor, status];
  const mais = (sql: string, v: unknown) => {
    valores.push(v);
    onde.push(sql.replace("?", `$${valores.length}`));
  };
  if (b.tipos?.length) mais("tipo::text = any (?)", b.tipos);
  if (b.categoria) mais("categoria_id = ?", b.categoria);
  if (b.responsavel) mais("responsavel_id = ?", b.responsavel);
  if (b.prioridade) mais("prioridade::text = ?", b.prioridade);
  if (b.etiqueta) mais("etiquetas @> ?", [b.etiqueta]);
  if (b.de) mais("criado_em >= ?::timestamptz", `${b.de}T00:00:00-03:00`);
  if (b.ate) mais("criado_em <= ?::timestamptz", `${b.ate}T23:59:59-03:00`);
  const { rows } = await db.query<{
    responsavel_id: string | null;
    prazo: string | null;
  }>(
    `select responsavel_id, prazo::text as prazo from os.chamados
     where ${onde.join(" and ")} order by id`,
    valores,
  );
  return rows;
}

function cargaDosAbertos(
  abertos: { responsavel_id: string | null; prazo: string | null }[],
  membros: { id: string; nome: string }[],
  agora: Date,
): Carga[] {
  const limite = agora.getTime();
  const cargas = new Map<string | null, Carga>([
    ...membros.map((p): [string, Carga] => [
      p.id,
      { id: p.id, nome: p.nome, abertos: 0, atrasados: 0 },
    ]),
    [null, { id: null, nome: "Na fila", abertos: 0, atrasados: 0 }],
  ]);
  for (const c of abertos) {
    const alvo = cargas.get(c.responsavel_id);
    if (!alvo) continue;
    alvo.abertos++;
    if (c.prazo && new Date(c.prazo).getTime() < limite) alvo.atrasados++;
  }
  const fila = cargas.get(null) as Carga;
  cargas.delete(null);
  return ordenarCarga([...cargas.values()], fila);
}

// ---------------------------------------------------------------------------
// A função nova, chamada como o servidor chama (cargaPorResponsavel)
// ---------------------------------------------------------------------------

// Arrays de enum vão como literal ("{a,b}"): o PGlite não sabe serializar.
const literal = (xs: string[]) => `{${xs.join(",")}}`;

async function contagensNovas(b: Barra, agora: string) {
  const { rows } = await db.query<{
    responsavel_id: string | null;
    abertos: number;
    atrasados: number;
  }>(
    `select * from os.carga_do_setor(
       p_setor => $1, p_agora => $2, p_status => $3::os.status_chamado[],
       p_tipos => $4::os.tipo_chamado[], p_categoria => $5,
       p_responsavel => $6, p_prioridade => $7::os.prioridade,
       p_etiqueta => $8, p_criado_desde => $9, p_criado_ate => $10)`,
    [
      b.setor,
      agora,
      b.status?.length ? literal(b.status) : null,
      b.tipos?.length ? literal(b.tipos) : null,
      b.categoria ?? null,
      b.responsavel ?? null,
      b.prioridade ?? null,
      b.etiqueta ?? null,
      b.de ? `${b.de}T00:00:00-03:00` : null,
      b.ate ? `${b.ate}T23:59:59-03:00` : null,
    ],
  );
  return rows;
}

/** Pessoas do setor (lidas como dono das tabelas, fora da sessão). */
async function membrosDe(setor: Setor) {
  const { rows } = await db.query<{ id: string; nome: string }>(
    `select u.id, u.nome from os.setor_membros m
     join core.usuarios u on u.id = m.usuario_id
     where m.setor_id = $1 order by u.nome`,
    [SETOR[setor]],
  );
  return rows;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_MINIMO);
  for (const f of readdirSync(MIGRATIONS).sort()) {
    if (f.endsWith(".sql"))
      await db.exec(readFileSync(join(MIGRATIONS, f), "utf8"));
  }
  for (const [chave, nome] of Object.entries(SETORES)) {
    const { rows } = await db.query<{ id: string }>(
      "select id from os.setores where nome = $1",
      [nome],
    );
    SETOR[chave as Setor] = rows[0]?.id ?? "";
  }
  for (const [nome, perfil] of Object.entries(PESSOAS) as [Pessoa, Perfil][]) {
    const id = U[nome];
    await db.query(
      "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)",
      [id, `${nome}@arp.test`, JSON.stringify({ nome })],
    );
    for (const p of perfil.p)
      await db.query(
        "insert into core.usuario_permissoes (usuario_id, permissao) values ($1, $2)",
        [id, p],
      );
    for (const s of perfil.s)
      await db.query(
        "insert into os.setor_membros (setor_id, usuario_id) values ($1, $2)",
        [SETOR[s], id],
      );
    if (perfil.inativo)
      await db.query("update core.usuarios set ativo = false where id = $1", [
        id,
      ]);
  }
  CATEGORIA.a = await inserir("os.categorias", {
    setor_id: SETOR.S,
    nome: "Carga A",
  });
  CATEGORIA.b = await inserir("os.categorias", {
    setor_id: SETOR.S,
    nome: "Carga B",
  });

  // Chamados variados no setor S (e alguns em M, que não podem contar):
  // todos os status, responsáveis (do setor, de fora, a fila), prazos
  // (vencido, exatamente agora, no futuro, sem prazo), tipos, prioridades,
  // categorias, etiquetas, datas de abertura.
  const STATUS = [
    "aberto",
    "em_andamento",
    "aguardando",
    "concluido",
    "fechado",
    "cancelado",
  ];
  const RESPONSAVEIS = [U.ana, U.bia, U.caio, null, U.gestor, U.ana, null];
  const PRAZOS = [
    "2026-10-20T10:00:00Z",
    AGORA,
    "2026-10-26T14:59:59Z",
    "2026-10-27T09:00:00Z",
    null,
  ];
  // OS fica em os.ordens (fora das listas de chamados).
  const TIPOS = ["tarefa", "solicitacao", "aviso"];
  const PRIORIDADES = ["baixa", "media", "alta", "urgente"];
  const CATEGORIAS = [CATEGORIA.a, CATEGORIA.b, null];
  const ETIQUETAS = [[], ["eletrica"], ["eletrica", "urgente"], ["hidraulica"]];
  for (let i = 0; i < 168; i++) {
    const status = STATUS[i % STATUS.length] as string;
    const setor = i % 11 === 0 ? SETOR.M : SETOR.S;
    // Abertos de 1º a 23 de outubro (com a meia-noite e o fim do dia em
    // Brasília, nas bordas do período).
    const dia = String((i % 23) + 1).padStart(2, "0");
    const hora = ["03:00:00Z", "02:59:59Z", "15:00:00Z"][(i % 5) % 3];
    await inserir("os.chamados", {
      tipo: TIPOS[i % TIPOS.length] as string,
      titulo: `C${i}`,
      setor_id: setor,
      status,
      aguardando_tipo: status === "aguardando" ? "material" : null,
      motivo_cancelamento: status === "cancelado" ? "teste" : null,
      responsavel_id: RESPONSAVEIS[i % RESPONSAVEIS.length] ?? null,
      prazo: PRAZOS[i % PRAZOS.length] ?? null,
      prioridade: PRIORIDADES[(i >> 1) % PRIORIDADES.length] as string,
      categoria_id: setor === SETOR.S ? (CATEGORIAS[i % 3] ?? null) : null,
      etiquetas: ETIQUETAS[(i >> 2) % ETIQUETAS.length] as string[],
      aberto_por: i % 13 === 0 ? U.bia : null,
      criado_em: `2026-10-${dia}T${hora}`,
    });
  }
}, 60_000);

// statusDoFiltro(undefined): o que ainda está na fila de alguém.
const STATUS_ABERTOS = ["aberto", "em_andamento", "aguardando", "concluido"];

const BARRAS: [string, () => Barra][] = [
  ["padrão (em aberto)", () => ({ setor: SETOR.S, status: STATUS_ABERTOS })],
  ["status: todos", () => ({ setor: SETOR.S })],
  ["status: aguardando", () => ({ setor: SETOR.S, status: ["aguardando"] })],
  [
    "status: concluído (nada aberto)",
    () => ({ setor: SETOR.S, status: ["concluido"] }),
  ],
  [
    "responsável: Ana",
    () => ({ setor: SETOR.S, status: STATUS_ABERTOS, responsavel: U.ana }),
  ],
  [
    "categoria A",
    () => ({ setor: SETOR.S, status: STATUS_ABERTOS, categoria: CATEGORIA.a }),
  ],
  [
    "prioridade alta",
    () => ({ setor: SETOR.S, status: STATUS_ABERTOS, prioridade: "alta" }),
  ],
  [
    "etiqueta elétrica",
    () => ({ setor: SETOR.S, status: STATUS_ABERTOS, etiqueta: "eletrica" }),
  ],
  [
    "tipo tarefa",
    () => ({ setor: SETOR.S, status: STATUS_ABERTOS, tipos: ["tarefa"] }),
  ],
  [
    "aberto de 05/10 a 12/10",
    () => ({
      setor: SETOR.S,
      status: STATUS_ABERTOS,
      de: "2026-10-05",
      ate: "2026-10-12",
    }),
  ],
  ["aberto desde 20/10", () => ({ setor: SETOR.S, de: "2026-10-20" })],
  [
    "tudo junto",
    () => ({
      setor: SETOR.S,
      status: ["em_andamento", "aguardando"],
      categoria: CATEGORIA.b,
      etiqueta: "eletrica",
      ate: "2026-10-20",
    }),
  ],
  [
    "outro setor (Marketing)",
    () => ({ setor: SETOR.M, status: STATUS_ABERTOS }),
  ],
];

const PERFIS = Object.keys(PESSOAS) as Pessoa[];
const AGORAS = [AGORA, "2026-10-26T14:59:59.000Z", "2026-11-30T12:00:00.000Z"];

describe("os.carga_do_setor = carga de antes", { timeout: 60_000 }, () => {
  it.each(BARRAS)("%s, em todos os perfis e horários", async (_, barra) => {
    const b = barra();
    const membros = await membrosDe(b.setor === SETOR.M ? "M" : "S");
    for (const u of PERFIS)
      for (const agora of AGORAS) {
        const [antes, depois] = await como(U[u], async () => [
          cargaDosAbertos(await linhasAntigas(b), membros, new Date(agora)),
          cargaDasContagens(await contagensNovas(b, agora), membros),
        ]);
        expect(depois, `${u} às ${agora}`).toEqual(antes);
      }
  });

  it("os cenários contam alguma coisa (o teste não compara zeros)", async () => {
    const b: Barra = { setor: SETOR.S, status: STATUS_ABERTOS };
    const membros = await membrosDe("S");
    const carga = await como(U.gestor, async () =>
      cargaDasContagens(await contagensNovas(b, AGORA), membros),
    );
    const fila = carga.find((c) => c.id === null);
    const ana = carga.find((c) => c.id === U.ana);
    expect(fila?.abertos).toBeGreaterThan(0);
    expect(ana?.abertos).toBeGreaterThan(ana?.atrasados ?? 0);
    expect(ana?.atrasados).toBeGreaterThan(0);
  });

  it("vale o RLS de quem pede", async () => {
    const b: Barra = { setor: SETOR.S };
    // Uma de cada vez: a sessão (role e usuário) é do banco inteiro.
    const gestor = await como(U.gestor, () => contagensNovas(b, AGORA));
    const ana = await como(U.ana, () => contagensNovas(b, AGORA));
    const semModulo = await como(U.semModulo, () => contagensNovas(b, AGORA));
    const total = (r: { abertos: number }[]) =>
      r.reduce((n, c) => n + c.abertos, 0);
    expect(total(ana)).toBeLessThan(total(gestor));
    expect(semModulo).toEqual([]);
  });

  it("anônimo não executa", async () => {
    await db.exec("set role anon");
    try {
      await expect(contagensNovas({ setor: SETOR.S }, AGORA)).rejects.toThrow(
        /permission denied/,
      );
    } finally {
      await db.exec("reset role");
    }
  });
});
