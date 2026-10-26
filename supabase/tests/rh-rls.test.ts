// RLS do schema rh e do bucket importacoes reescrito para desempenho
// (20261026170000_rh_desempenho_rls): mesma visibilidade e mesma gravação de
// antes. Dois bancos com os mesmos dados: "antes" com as migrations até a
// anterior a esta, "depois" com todas. Cada perfil lê, altera, apaga e inclui
// em cada tabela nos dois, e o resultado tem que ser o mesmo.
//
// As regras do rh não dependem da linha (só da permissão), então a contagem
// de linhas de cada tabela com dados já diz quais linhas a pessoa alcança; no
// storage, que depende da pasta, compara os nomes dos arquivos.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import {
  type DiaDoPonto,
  type DiasSomados,
  linhaDosDias,
  somarDias,
} from "@/lib/rh/ponto-periodo";

const MIGRATIONS = join(import.meta.dirname, "..", "migrations");
const ESTA = "20261026170000";

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

const TODAS_DO_RH = [
  "rh.painel",
  "rh.custo_pessoal",
  "rh.custo_pessoal.individual",
  "rh.quadro",
  "rh.jornada",
  "rh.funcionarios",
  "rh.endomarketing",
  "rh.folha",
  "rh.beneficios",
  "rh.parametros",
];

// p: permissões individuais; cargo: permissões pelo cargo de acesso.
interface Perfil {
  p: string[];
  cargo?: { ativo: boolean; p: string[] };
  inativo?: boolean;
}

const PERFIS = {
  semNada: { p: [] },
  semModulo: { p: ["os.acessar", "admin.usuarios"] },
  painel: { p: ["rh.painel"] },
  custo: { p: ["rh.custo_pessoal"] },
  individual: { p: ["rh.custo_pessoal.individual"] },
  quadro: { p: ["rh.quadro"] },
  jornada: { p: ["rh.jornada"] },
  funcionarios: { p: ["rh.funcionarios"] },
  endomarketing: { p: ["rh.endomarketing"] },
  folha: { p: ["rh.folha"] },
  beneficios: { p: ["rh.beneficios"] },
  parametros: { p: ["rh.parametros"] },
  folhaEIndividual: { p: ["rh.folha", "rh.custo_pessoal.individual"] },
  tudo: { p: TODAS_DO_RH },
  inativo: { p: TODAS_DO_RH, inativo: true },
  cargoInativo: {
    p: [],
    cargo: { ativo: false, p: ["rh.folha", "rh.parametros", "rh.beneficios"] },
  },
  cargoAtivo: {
    p: ["rh.painel"],
    cargo: { ativo: true, p: ["rh.folha", "rh.beneficios"] },
  },
} satisfies Record<string, Perfil>;
type NomePerfil = keyof typeof PERFIS;
const NOMES = Object.keys(PERFIS) as NomePerfil[];

const U = Object.fromEntries(
  NOMES.map((nome, i) => [
    nome,
    `00000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`,
  ]),
) as Record<NomePerfil, string>;

const DEP = "10000000-0000-0000-0000-000000000001";
const DEP2 = "10000000-0000-0000-0000-000000000002";
const CARGO = "20000000-0000-0000-0000-000000000001";
const MOTIVO = "21000000-0000-0000-0000-000000000001";
const C = {
  ana: "30000000-0000-0000-0000-000000000001",
  bia: "30000000-0000-0000-0000-000000000002",
  caio: "30000000-0000-0000-0000-000000000003",
  socioCadastro: "30000000-0000-0000-0000-000000000004",
  socioFolha: "30000000-0000-0000-0000-000000000005",
  socioRubrica: "30000000-0000-0000-0000-000000000006",
  foraDoPonto: "30000000-0000-0000-0000-000000000007",
};
const FOLHA = "40000000-0000-0000-0000-000000000001";
const FOLHA2 = "40000000-0000-0000-0000-000000000002";
const BENEFICIO = "70000000-0000-0000-0000-000000000001";
const PLANO = "70000000-0000-0000-0000-000000000002";
const TABELA = "71000000-0000-0000-0000-000000000001";

const DADOS = `
  insert into rh.departamentos (id, nome, codigo_folha) values
    ('${DEP}', 'Operações', 91), ('${DEP2}', 'Comercial', 92);
  insert into rh.cargos (id, nome, codigo_folha) values ('${CARGO}', 'Analista', 901);
  insert into rh.motivos_desligamento (id, descricao) values ('${MOTIVO}', 'Pedido de demissão');
  insert into rh.colaboradores
    (id, copiloto_id, matricula, nome, nascimento, admissao, desligamento,
     motivo_desligamento_id, tipo_contrato, departamento_id, cargo_id, fora_do_ponto)
  values
    ('${C.ana}', gen_random_uuid(), 1, 'Ana', '1990-01-01', '2020-01-01', null, null, 'clt', '${DEP}', '${CARGO}', false),
    ('${C.bia}', gen_random_uuid(), 2, 'Bia', '1985-05-05', '2021-03-01', '2026-09-30', '${MOTIVO}', 'clt', '${DEP2}', null, false),
    ('${C.caio}', gen_random_uuid(), 3, 'Caio', null, '2026-01-01', null, null, 'pj', null, null, false),
    ('${C.socioCadastro}', gen_random_uuid(), 4, 'Sócio do cadastro', null, '2010-01-01', null, null, 'pro_labore', '${DEP}', null, false),
    ('${C.socioFolha}', gen_random_uuid(), 5, 'Sócio da folha', null, '2010-01-01', null, null, 'clt', '${DEP}', null, false),
    ('${C.socioRubrica}', gen_random_uuid(), 6, 'Sócio da rubrica', null, '2010-01-01', null, null, 'clt', '${DEP}', null, false),
    ('${C.foraDoPonto}', gen_random_uuid(), 7, 'Fora do ponto', null, '2022-01-01', null, null, 'clt', '${DEP}', null, true);
  insert into rh.dependentes (colaborador_id, nome, nascimento, tem_plano)
    values ('${C.ana}', 'Filho da Ana', '2015-01-01', true);
  insert into rh.parametros_empresa (vigente_desde, rat_pct, fap, banco_horas_inicio, banco_horas_fim)
    values ('2026-01-01', 1, 1.5, '2026-01-01', '2026-06-30');
  insert into rh.encargos_por_contrato
    (tipo_contrato, vigente_desde, inss_patronal_pct, terceiros_pct, fgts_pct,
     aplica_rat, provisiona_13, provisiona_ferias, multa_rescisoria_pct)
    values ('clt', '2026-09-01', 20, 5.8, 8, true, true, true, 40);
  insert into rh.jornadas (departamento_id, horas_mes_min, vigente_desde) values ('${DEP}', 13200, '2026-01-01');
  insert into rh.jornadas (colaborador_id, horas_mes_min, vigente_desde) values ('${C.ana}', 10800, '2026-01-01');
  insert into rh.rubricas (codigo, descricao, grupo) values
    (9001, 'Salário teste', 'salario'), (9002, 'Pró-labore teste', 'pro_labore');
  insert into rh.beneficios (id, nome, tipo, valor_padrao) values ('${BENEFICIO}', 'VR', 'alimentacao', 500);
  insert into rh.beneficios (id, nome, tipo) values ('${PLANO}', 'Plano', 'plano_saude');
  insert into rh.colaborador_beneficios (colaborador_id, beneficio_id, desde)
    values ('${C.ana}', '${BENEFICIO}', '2026-01-01');
  insert into rh.beneficio_contratos (beneficio_id, tipo_contrato, desde)
    values ('${BENEFICIO}', 'estagiario', '2026-01-01');
  insert into rh.plano_tabelas (id, beneficio_id, vigente_desde) values ('${TABELA}', '${PLANO}', '2026-01-01');
  insert into rh.plano_faixas_etarias (tabela_id, idade_min, idade_max, mensalidade)
    values ('${TABELA}', 0, 18, 100), ('${TABELA}', 19, null, 300);
  insert into rh.plano_coparticipacao (tabela_id, meses_min, colaborador_pct) values ('${TABELA}', 0, 20);
  insert into rh.folhas (id, competencia) values ('${FOLHA}', '2026-09-01'), ('${FOLHA2}', '2026-08-01');
  insert into rh.folha_colaboradores (folha_id, colaborador_id, situacao, tipo_contrato, departamento_id, cargo_id, salario)
  values
    ('${FOLHA}', '${C.ana}', 'trabalhando', 'clt', '${DEP}', '${CARGO}', 2000),
    ('${FOLHA}', '${C.bia}', 'trabalhando', 'clt', '${DEP2}', null, 2000),
    ('${FOLHA}', '${C.socioRubrica}', 'trabalhando', 'clt', '${DEP}', null, 2000),
    ('${FOLHA2}', '${C.socioFolha}', 'trabalhando', 'pro_labore', '${DEP}', null, 2000);
  insert into rh.folha_rubricas (folha_id, colaborador_id, rubrica_codigo, natureza, valor) values
    ('${FOLHA}', '${C.ana}', 9001, 'provento', 2000),
    ('${FOLHA}', '${C.bia}', 9001, 'provento', 2000),
    ('${FOLHA}', '${C.socioRubrica}', 9002, 'provento', 2000);
  insert into rh.custos_colaborador
    (competencia, colaborador_id, departamento_id, cargo_id, tipo_contrato,
     remuneracao, encargos, custo_total, memoria)
    values ('2026-09-01', '${C.ana}', '${DEP}', '${CARGO}', 'clt', 2000, 700, 2700, '{"linhas": [], "pendencias": []}');
  insert into rh.valores_pj (colaborador_id, valor) values ('${C.caio}', 2000);
  insert into rh.notas_pj (competencia, colaborador_id, numero_documento, valor)
    values ('2026-09-01', '${C.caio}', 'NF-1', 2000);
  insert into rh.dados_financeiros_mensais (competencia, faturamento_bruto) values ('2026-09-01', 100000);
  insert into rh.orcamento_endomarketing (ano, valor) values (2026, 5000);
  insert into rh.afastamentos (colaborador_id, inicio, fim, motivo) values ('${C.ana}', '2026-10-01', '2026-10-05', 'Atestado');
  insert into rh.ponto_mensal (competencia, colaborador_id, departamento_id, previstas_min, faltas_min)
    values ('2026-09-01', '${C.ana}', '${DEP}', 10000, 60), ('2026-09-01', '${C.bia}', '${DEP2}', 10000, 0);
  insert into rh.ponto_diario
    (colaborador_id, data, competencia, batidas, ocorrencia, previstas_min, faltas_min,
     atrasos_min, abonos_min, extras_min, noturnas_min, banco_saldo_min,
     banco_creditos_min, banco_debitos_min)
  values
    ('${C.ana}', '2026-10-01', '2026-10-01', '[]', null, 480, 0, 10, '{"Abono2": 30}', '{"Ex80%": 20, "ExNot": 5}', 5, 100, 20, 0),
    ('${C.ana}', '2026-10-02', '2026-10-01', '[]', ' falta ', 480, 480, 0, '{}', '{}', 0, 90, 0, 10),
    ('${C.ana}', '2026-10-05', '2026-10-01', '[]', null, 480, 0, 0, '{"Abono2": 15, "Abono10": 60}', '{"Ex100%": 30, "Ex80%": 10, "Extras": 40, "A": 1}', 0, 120, 30, 0),
    ('${C.bia}', '2026-10-03', '2026-10-01', '[]', 'FOLGA', 0, 0, 0, '{}', '{"ExInt": 15}', 0, -30, 0, 30),
    ('${C.bia}', '2026-10-04', '2026-10-01', '[]', 'FALTA', 480, 480, 0, '{"Abono3": 480}', '{}', 0, -60, 0, 30),
    ('${C.foraDoPonto}', '2026-10-01', '2026-10-01', '[]', 'FALTA', 480, 480, 0, '{}', '{}', 0, 0, 0, 0),
    ('${C.ana}', '2026-11-02', '2026-11-01', '[]', null, 480, 0, 0, '{}', '{}', 0, 120, 0, 0);
  insert into storage.objects (bucket_id, name) values
    ('importacoes', 'folha/a/extrato.pdf'),
    ('importacoes', 'plano_saude/b/tabela.xlsx'),
    ('importacoes', 'outra/c/x.pdf'),
    ('os', 'folha/d/foto.jpg');
`;

// Tabela -> o que uma alteração de cada linha muda (nada, de fato) e uma
// linha nova válida.
const TABELAS: Record<string, { set: string; nova: string }> = {
  "rh.departamentos": {
    set: "nome = nome",
    nova: "(nome) values ('Novo')",
  },
  "rh.cargos": { set: "nome = nome", nova: "(nome) values ('Novo cargo')" },
  "rh.motivos_desligamento": {
    set: "descricao = descricao",
    nova: "(descricao) values ('Novo motivo')",
  },
  "rh.colaboradores": {
    set: "nome = nome",
    nova: "(copiloto_id, nome) values (gen_random_uuid(), 'Nova pessoa')",
  },
  "rh.parametros_empresa": {
    set: "fap = fap",
    nova: "(vigente_desde, rat_pct, fap, banco_horas_inicio, banco_horas_fim) values ('2030-01-01', 1, 1, '2030-01-01', '2030-06-30')",
  },
  "rh.encargos_por_contrato": {
    set: "fgts_pct = fgts_pct",
    nova: "(tipo_contrato, vigente_desde, inss_patronal_pct, terceiros_pct, fgts_pct, aplica_rat, provisiona_13, provisiona_ferias, multa_rescisoria_pct) values ('clt', '2030-01-01', 20, 5.8, 8, true, true, true, 40)",
  },
  "rh.jornadas": {
    set: "horas_mes_min = horas_mes_min",
    nova: "(horas_mes_min, vigente_desde) values (13200, '2030-01-01')",
  },
  "rh.parametros_turnover": {
    set: "formula_geral = formula_geral",
    nova: "default values",
  },
  "rh.dados_financeiros_mensais": {
    set: "lucro = lucro",
    nova: "(competencia) values ('2030-01-01')",
  },
  "rh.orcamento_endomarketing": {
    set: "valor = valor",
    nova: "(ano, valor) values (2030, 1)",
  },
  "rh.rubricas": {
    set: "descricao = descricao",
    nova: "(codigo, descricao) values (99999, 'Nova')",
  },
  "rh.afastamentos": {
    set: "motivo = motivo",
    nova: `(colaborador_id, inicio, fim) values ('${C.bia}', '2030-01-01', '2030-01-02')`,
  },
  "rh.beneficios": {
    set: "nome = nome",
    nova: "(nome, tipo, valor_padrao) values ('Novo', 'outro', 10)",
  },
  "rh.colaborador_beneficios": {
    set: "valor_manual = valor_manual",
    nova: `(colaborador_id, beneficio_id, desde) values ('${C.bia}', '${BENEFICIO}', '2030-01-01')`,
  },
  "rh.beneficio_contratos": {
    set: "desde = desde",
    nova: `(beneficio_id, tipo_contrato, desde) values ('${BENEFICIO}', 'aprendiz', '2030-01-01')`,
  },
  "rh.dependentes": {
    set: "nome = nome",
    nova: `(colaborador_id, nome) values ('${C.bia}', 'Outro dependente')`,
  },
  "rh.plano_tabelas": {
    set: "reajuste_pct = reajuste_pct",
    nova: `(beneficio_id, vigente_desde) values ('${PLANO}', '2030-01-01')`,
  },
  "rh.plano_faixas_etarias": {
    set: "mensalidade = mensalidade",
    nova: `(tabela_id, idade_min, mensalidade) values ('${TABELA}', 70, 500)`,
  },
  "rh.plano_coparticipacao": {
    set: "meses_max = meses_max",
    nova: `(tabela_id, meses_min, colaborador_pct) values ('${TABELA}', 99, 10)`,
  },
  "rh.folhas": {
    set: "ficticia = ficticia",
    nova: "(competencia) values ('2030-01-01')",
  },
  "rh.folha_colaboradores": {
    set: "liquido = liquido",
    nova: `(folha_id, colaborador_id, situacao, tipo_contrato) values ('${FOLHA}', '${C.caio}', 'trabalhando', 'clt')`,
  },
  "rh.folha_rubricas": {
    set: "valor = valor",
    nova: `(folha_id, colaborador_id, rubrica_codigo, natureza, valor) values ('${FOLHA}', '${C.ana}', 9002, 'desconto', 1)`,
  },
  "rh.custos_colaborador": {
    set: "calculado_em = calculado_em",
    nova: `(competencia, colaborador_id, tipo_contrato, custo_total, memoria) values ('2030-01-01', '${C.ana}', 'clt', 0, '{}')`,
  },
  "rh.valores_pj": {
    set: "valor = valor",
    nova: `(colaborador_id, valor) values ('${C.bia}', 1)`,
  },
  "rh.notas_pj": {
    set: "valor = valor",
    nova: `(competencia, colaborador_id, numero_documento, valor) values ('2030-01-01', '${C.caio}', 'NF-9', 1)`,
  },
  "rh.ponto_mensal": {
    set: "faltas_min = faltas_min",
    nova: `(competencia, colaborador_id) values ('2030-01-01', '${C.ana}')`,
  },
  "rh.ponto_diario": {
    set: "faltas_min = faltas_min",
    nova: `(colaborador_id, data, competencia) values ('${C.ana}', '2030-01-01', '2030-01-01')`,
  },
};

async function subir(ate?: string): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_MINIMO);
  for (const f of readdirSync(MIGRATIONS).sort()) {
    if (!f.endsWith(".sql") || (ate && f >= ate)) continue;
    await db.exec(readFileSync(join(MIGRATIONS, f), "utf8"));
  }
  for (const [nome, perfil] of Object.entries(PERFIS) as [
    NomePerfil,
    Perfil,
  ][]) {
    const id = U[nome];
    await db.query("insert into auth.users (id, email) values ($1, $2)", [
      id,
      `${nome}@arp.test`,
    ]);
    for (const p of perfil.p)
      await db.query(
        "insert into core.usuario_permissoes (usuario_id, permissao) values ($1, $2)",
        [id, p],
      );
    if (perfil.cargo) {
      const { rows } = await db.query<{ id: string }>(
        "insert into core.cargos (nome, ativo) values ($1, $2) returning id",
        [`Cargo ${nome}`, perfil.cargo.ativo],
      );
      const cargo = rows[0]?.id;
      for (const p of perfil.cargo.p)
        await db.query(
          "insert into core.cargo_permissoes (cargo_id, permissao) values ($1, $2)",
          [cargo, p],
        );
      await db.query("update core.usuarios set cargo_id = $1 where id = $2", [
        cargo,
        id,
      ]);
    }
    if (perfil.inativo)
      await db.query("update core.usuarios set ativo = false where id = $1", [
        id,
      ]);
  }
  await db.exec(DADOS);
  return db;
}

let antes: PGlite;
let depois: PGlite;

async function como<T>(
  db: PGlite,
  usuario: string,
  fn: () => Promise<T>,
): Promise<T> {
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

/** Roda e desfaz: nada fica gravado. */
async function desfazendo<T>(db: PGlite, fn: () => Promise<T>): Promise<T> {
  await db.exec("begin");
  try {
    return await fn();
  } finally {
    await db.exec("rollback");
  }
}

/**
 * Resultado comparável: quantas linhas, ou o tipo do erro. Roda dentro de
 * desfazendo(): o erro volta ao savepoint e a transação segue.
 */
async function resultado(db: PGlite, sql: string): Promise<string> {
  await db.exec("savepoint tentativa");
  try {
    const r = await db.query(sql);
    await db.exec("release savepoint tentativa");
    return `ok:${r.rows.length || (r.affectedRows ?? 0)}`;
  } catch (e) {
    await db.exec("rollback to savepoint tentativa");
    const m = (e as Error).message;
    if (/row-level security/.test(m)) return "barrado pelo RLS";
    if (/permission denied/.test(m)) return "sem grant";
    return `erro: ${m}`;
  }
}

/** O que o perfil consegue em cada tabela, num dos bancos. */
async function alcance(db: PGlite, u: NomePerfil) {
  const saida: Record<string, string> = {};
  for (const [t, { set, nova }] of Object.entries(TABELAS)) {
    saida[`${t} select`] = await desfazendo(db, () =>
      como(db, U[u], () => resultado(db, `select 1 from ${t}`)),
    );
    saida[`${t} update`] = await desfazendo(db, () =>
      como(db, U[u], () => resultado(db, `update ${t} set ${set}`)),
    );
    saida[`${t} update returning`] = await desfazendo(db, () =>
      como(db, U[u], () => resultado(db, `update ${t} set ${set} returning 1`)),
    );
    saida[`${t} delete`] = await desfazendo(db, () =>
      como(db, U[u], () => resultado(db, `delete from ${t}`)),
    );
    saida[`${t} insert`] = await desfazendo(db, () =>
      como(db, U[u], () => resultado(db, `insert into ${t} ${nova}`)),
    );
  }
  saida["storage select"] = await como(db, U[u], async () =>
    (
      await db.query<{ n: string }>(
        "select bucket_id || ':' || name as n from storage.objects order by 1",
      )
    ).rows
      .map((r) => r.n)
      .join(", "),
  );
  for (const nome of [
    "folha/x/novo.pdf",
    "plano_saude/x/nova.xlsx",
    "outra/x/a.pdf",
  ]) {
    saida[`storage insert ${nome}`] = await desfazendo(db, () =>
      como(db, U[u], () =>
        resultado(
          db,
          `insert into storage.objects (bucket_id, name) values ('importacoes', '${nome}')`,
        ),
      ),
    );
  }
  return saida;
}

beforeAll(async () => {
  [antes, depois] = await Promise.all([subir(ESTA), subir()]);
}, 120_000);

describe("rh: o mesmo alcance de antes", { timeout: 120_000 }, () => {
  it.each(NOMES)("%s lê, altera, apaga e inclui o mesmo", async (u) => {
    const [a, d] = [await alcance(antes, u), await alcance(depois, u)];
    expect(d).toEqual(a);
  });

  it("os dados dos testes alcançam as regras (nem tudo barrado, nem tudo liberado)", async () => {
    const tudo = await alcance(depois, "tudo");
    const nada = await alcance(depois, "semNada");
    expect(tudo["rh.folha_rubricas select"]).toBe("ok:3");
    expect(tudo["rh.colaboradores update"]).toBe("ok:7");
    expect(nada["rh.colaboradores select"]).toBe("ok:0");
    expect(nada["rh.colaboradores insert"]).toBe("barrado pelo RLS");
    expect(tudo["storage select"]).toBe(
      "importacoes:folha/a/extrato.pdf, importacoes:plano_saude/b/tabela.xlsx",
    );
    // rh.folha lê a folha pela política de edição, sem o custo individual.
    const folha = await alcance(depois, "folha");
    expect(folha["rh.folha_colaboradores select"]).toBe("ok:4");
    expect(folha["rh.custos_colaborador select"]).toBe("ok:0");
  });
});

describe("rh.socios(): conjuntos no lugar das subconsultas por pessoa", () => {
  const socios = (db: PGlite, u: NomePerfil) =>
    como(db, U[u], async () =>
      (
        await db.query<{ id: string }>(
          "select id from rh.socios() id order by 1",
        )
      ).rows.map((r) => r.id),
    );

  it.each(NOMES)("%s recebe os mesmos ids", async (u) => {
    expect(await socios(depois, u)).toEqual(await socios(antes, u));
  });

  it("cadastro, folha e rubrica de pró-labore; sem módulo, nada", async () => {
    expect(await socios(depois, "painel")).toEqual(
      [C.socioCadastro, C.socioFolha, C.socioRubrica].sort(),
    );
    expect(await socios(depois, "semModulo")).toEqual([]);
    expect(await socios(depois, "inativo")).toEqual([]);
  });
});

describe("rh.ponto_dos_dias(): a soma de somarDias, feita no banco", () => {
  const somadoNoBanco = (u: NomePerfil, de: string, ate: string) =>
    como(
      depois,
      U[u],
      async () =>
        (
          await depois.query<DiasSomados>(
            `select colaborador_id, nome, matricula, departamento_id, departamento,
                  primeiro_dia::text as primeiro_dia, previstas_min, faltas_min,
                  atrasos_min, faltas_dias, abonos_min, extras_min, noturnas_min,
                  banco_saldo_min, banco_creditos_min, banco_debitos_min
           from rh.ponto_dos_dias($1, $2)`,
            [de, ate],
          )
        ).rows,
    );

  // Como o servidor fazia: os dias com nome e departamento, somados em JS.
  const somadoNoServidor = (u: NomePerfil, de: string, ate: string) =>
    como(depois, U[u], async () => {
      const { rows } = await depois.query<{
        colaborador_id: string;
        data: string;
        ocorrencia: string | null;
        nome: string;
        matricula: number | null;
        departamento_id: string | null;
        departamento: string | null;
        previstas_min: number;
        faltas_min: number;
        atrasos_min: number;
        abonos_min: Record<string, number>;
        extras_min: Record<string, number>;
        noturnas_min: number;
        banco_saldo_min: number;
        banco_creditos_min: number;
        banco_debitos_min: number;
      }>(
        `select d.colaborador_id, to_char(d.data, 'YYYY-MM-DD') as data, d.ocorrencia,
                c.nome, c.matricula, c.departamento_id, dep.nome as departamento,
                d.previstas_min, d.faltas_min, d.atrasos_min,
                d.abonos_min::text::json as abonos_min, d.extras_min::text::json as extras_min,
                d.noturnas_min, d.banco_saldo_min, d.banco_creditos_min, d.banco_debitos_min
         from rh.ponto_diario d
         join rh.colaboradores c on c.id = d.colaborador_id
         left join rh.departamentos dep on dep.id = c.departamento_id
         where d.data between $1 and $2 and not c.fora_do_ponto`,
        [de, ate],
      );
      const dias: DiaDoPonto[] = rows.map((d) => ({
        ...d,
        departamento: d.departamento ?? "Sem departamento",
      }));
      return {
        linhas: somarDias(dias),
        primeiro: dias.reduce<string | null>(
          (m, d) => (m === null || d.data < m ? d.data : m),
          null,
        ),
      };
    });

  const porPessoa = <T extends { colaborador_id: string }>(ls: T[]) =>
    [...ls].sort((a, b) => a.colaborador_id.localeCompare(b.colaborador_id));

  it.each([
    ["2026-10-01", "2026-10-31"],
    ["2026-10-02", "2026-10-04"],
    ["2026-10-05", "2026-11-30"],
    ["2027-01-01", "2027-01-31"],
  ])("de %s a %s: mesmos números, mesma ordem das colunas", async (de, ate) => {
    const banco = await somadoNoBanco("jornada", de, ate);
    const servidor = await somadoNoServidor("jornada", de, ate);
    const linhas = porPessoa(banco.map(linhaDosDias));
    const esperado = porPessoa(servidor.linhas);
    expect(linhas).toEqual(esperado);
    // A ordem das colunas de extras aparece nos textos da Jornada.
    expect(linhas.map((l) => Object.keys(l.extras_min ?? {}))).toEqual(
      esperado.map((l) => Object.keys(l.extras_min ?? {})),
    );
    expect(linhas.map((l) => Object.keys(l.abonos_min))).toEqual(
      esperado.map((l) => Object.keys(l.abonos_min)),
    );
    const primeiro = banco.reduce<string | null>((m, l) => {
      const d = l.primeiro_dia;
      return m === null || d < m ? d : m;
    }, null);
    expect(primeiro).toBe(servidor.primeiro);
  });

  it("dias de falta pela ocorrência; fora do ponto fica de fora; o RLS vale", async () => {
    const linhas = (
      await somadoNoBanco("jornada", "2026-10-01", "2026-10-31")
    ).map(linhaDosDias);
    const ana = linhas.find((l) => l.colaborador_id === C.ana);
    expect(ana?.faltas_dias).toBe(1);
    expect(ana?.banco_saldo_min).toBe(120);
    expect(ana?.extras_min).toEqual({
      "Ex80%": 30,
      ExNot: 5,
      A: 1,
      "Ex100%": 30,
      Extras: 40,
    });
    expect(linhas.some((l) => l.colaborador_id === C.foraDoPonto)).toBe(false);
    expect(
      await somadoNoBanco("parametros", "2026-10-01", "2026-10-31"),
    ).toEqual([]);
    expect(await somadoNoBanco("semNada", "2026-10-01", "2026-10-31")).toEqual(
      [],
    );
  });
});

describe("plano: regra calculada uma vez por consulta", () => {
  const plano = (sql: string) =>
    como(depois, U.tudo, async () =>
      (await depois.query<{ "QUERY PLAN": string }>(`explain ${sql}`)).rows
        .map((r) => r["QUERY PLAN"])
        .join("\n"),
    );

  it.each(
    Object.keys(TABELAS),
  )("%s: InitPlan, sem core.pode por linha", async (t) => {
    const p = await plano(`select * from ${t}`);
    expect(p).toMatch(/InitPlan/);
    expect(p).not.toMatch(/core\.pode/);
  });

  it("storage.objects: InitPlan, sem core.pode por linha", async () => {
    const p = await plano("select * from storage.objects");
    expect(p).toMatch(/InitPlan/);
    expect(p).not.toMatch(/core\.pode/);
  });

  it("nenhuma política do rh ou do storage chama core.pode por linha", async () => {
    const { rows } = await depois.query<{
      t: string;
      nome: string;
      expr: string;
    }>(
      `select schemaname || '.' || tablename as t, policyname as nome,
              coalesce(qual, '') || ' ' || coalesce(with_check, '') as expr
       from pg_policies where schemaname in ('rh', 'storage')`,
    );
    const porLinha = rows.flatMap(({ t, nome, expr }) => {
      const resto = expr.replace(
        /\( SELECT core\.pode(_modulo)?\('[^']*'::text\) AS pode(_modulo)?\)/g,
        "",
      );
      const achados = resto.match(/core\.pode(_modulo|_importar)?\(/g);
      return achados ? [`${t}.${nome}: ${achados.join(", ")}`] : [];
    });
    expect(porLinha).toEqual([]);
  });

  it("toda chave estrangeira do rh tem índice", async () => {
    const { rows } = await depois.query<{ fk: string }>(
      `select c.conrelid::regclass || '.' || c.conname as fk
       from pg_constraint c
       where c.contype = 'f' and c.connamespace = 'rh'::regnamespace
         and not exists (
           select 1 from pg_index i
           where i.indrelid = c.conrelid
             and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] @> c.conkey
             and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] <@ c.conkey
         )`,
    );
    expect(rows.map((r) => r.fk)).toEqual([]);
  });
});
