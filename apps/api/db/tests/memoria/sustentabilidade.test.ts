// Módulo Sustentabilidade (20261116130000_sustentabilidade): permissões, RLS
// de cada tabela, valores e contatos escondidos sem a permissão, link do
// parceiro, versões imutáveis, publicação do formulário, importação
// (confirmar e desfazer), permissão por programa e dados de exemplo.

import {
  definicaoSchema,
  respostaSchema,
  type TipoPergunta,
} from "@arp/shared/sustentabilidade/formulario/tipos";
import {
  questionarioV1,
  questionarioV2,
} from "@arp/shared/sustentabilidade/questionario-inicial";
import { beforeAll, describe, expect, it } from "vitest";
import { abrirBanco, type BancoDeTeste } from "../apoio";

const P = {
  sustentarp: "a0000000-0000-4000-8000-000000000001",
  mercado: "a0000000-0000-4000-8000-000000000002",
  turismo: "a0000000-0000-4000-8000-000000000003",
};
const F = {
  questionario: "a0000000-0000-4000-8000-0000000000f0",
  coleta: "a0000000-0000-4000-8000-0000000000f1",
  atracoes: "a0000000-0000-4000-8000-0000000000f2",
  produtores: "a0000000-0000-4000-8000-0000000000f3",
  tour: "a0000000-0000-4000-8000-0000000000f6",
};

const u = (n: number) =>
  `00000000-0000-0000-0000-0000000005${String(n).padStart(2, "0")}`;
const U = {
  ver: u(1),
  aplica: u(2),
  respostas: u(3),
  corrige: u(4),
  questionario: u(5),
  questionarioExcluir: u(6),
  clubeVer: u(7),
  clube: u(8),
  clubeTudo: u(9),
  ronda: u(10),
  rcc: u(11),
  rccValores: u(12),
  gestora: u(13),
  gestoraTudo: u(14),
  painel: u(15),
  painelValores: u(16),
  importa: u(17),
  parametros: u(18),
  parametrosValores: u(19),
  lanca: u(20),
  exporta: u(21),
  fora: u(22),
  // Sem ele, a guarda "pelo menos um administrador" barra apagar permissão.
  admin: u(23),
};
type Usuario = keyof typeof U;

const s = (...p: string[]) => p.map((x) => `sustentabilidade.${x}`);
const PERMISSOES: Record<Usuario, string[]> = {
  ver: s("entrevistas.ver"),
  aplica: s("entrevistas.aplicar"),
  respostas: s("entrevistas.respostas"),
  corrige: s("entrevistas.dispensar"),
  questionario: s("entrevistas.questionario"),
  questionarioExcluir: s("entrevistas.questionario", "formularios.excluir"),
  clubeVer: s("clube.ver"),
  clube: s("clube.ver", "clube.editar"),
  clubeTudo: s("clube.ver", "clube.editar", "valores", "contato"),
  ronda: s("ronda"),
  rcc: s("rcc"),
  rccValores: s("rcc", "valores"),
  gestora: s("programas.gerenciar"),
  gestoraTudo: s(
    "programas.gerenciar",
    "valores",
    "contato",
    "formularios.excluir",
  ),
  painel: s("painel"),
  painelValores: s("painel", "valores"),
  importa: s("importar"),
  parametros: s("parametros"),
  parametrosValores: s("parametros", "valores"),
  // "Programa – lançar" só do Mercado Local (permissão criada pelo gatilho).
  lanca: s(`programa.${P.mercado}`),
  exporta: s("exportar"),
  fora: ["rh.painel"],
  admin: ["admin.usuarios"],
};
const TODOS = Object.keys(U) as Usuario[];
const DO_MODULO = TODOS.filter((n) => n !== "fora" && n !== "admin");

/** Quem lê cada tabela (os outros leem zero linhas). */
const LEITURA: Record<string, Usuario[]> = {
  parametros: DO_MODULO,
  parametros_valores: [
    "clubeTudo",
    "rccValores",
    "gestoraTudo",
    "painelValores",
    "parametrosValores",
  ],
  setor_validades: DO_MODULO,
  importacoes: ["importa"],
  contratos: [
    "ver",
    "aplica",
    "respostas",
    "corrige",
    "clubeVer",
    "clube",
    "clubeTudo",
    "painel",
    "painelValores",
    "importa",
  ],
  programas: ["gestora", "gestoraTudo", "painel", "painelValores", "lanca"],
  programa_contatos: ["gestoraTudo"],
  formularios: DO_MODULO,
  formulario_versoes: DO_MODULO,
  formulario_alteracoes: [
    "questionario",
    "questionarioExcluir",
    "gestora",
    "gestoraTudo",
  ],
  entrevistas: ["respostas", "corrige"],
  entrevista_transferencias: ["ver", "respostas", "corrige"],
  participantes: ["clubeVer", "clube", "clubeTudo", "painel", "painelValores"],
  participante_contatos: ["clubeTudo"],
  participante_valores: ["clubeTudo", "painelValores"],
  termos: ["clubeVer", "clube", "clubeTudo", "painel", "painelValores"],
  contribuicoes: ["clubeVer", "clube", "clubeTudo"],
  contribuicao_valores: ["clubeTudo", "painelValores"],
  acoes: ["clubeVer", "clube", "clubeTudo"],
  coletores: DO_MODULO,
  rondas: ["ronda", "painel", "painelValores"],
  ronda_itens: ["ronda", "painel", "painelValores"],
  rcc_fatores: [
    "rcc",
    "rccValores",
    "painel",
    "painelValores",
    "parametros",
    "parametrosValores",
  ],
  rcc_precos: ["rccValores", "painelValores", "parametrosValores"],
  co2_fatores: ["painel", "painelValores", "parametros", "parametrosValores"],
  rcc_notas: ["rcc", "rccValores", "painel", "painelValores"],
  rcc_nota_valores: ["rccValores", "painelValores"],
  programa_indicadores: [
    "gestora",
    "gestoraTudo",
    "painel",
    "painelValores",
    "lanca",
  ],
  programa_links: ["gestora", "gestoraTudo"],
  lancamentos: ["gestora", "gestoraTudo", "painel", "painelValores", "lanca"],
  lancamento_valores: ["gestoraTudo", "painelValores"],
  cadastros_lista: [
    "gestora",
    "gestoraTudo",
    "painel",
    "painelValores",
    "importa",
    "lanca",
  ],
  marcos: ["painel", "painelValores", "parametros", "parametrosValores"],
  equivalencias: ["painel", "painelValores", "parametros", "parametrosValores"],
  consolidados: ["painel", "painelValores", "parametros", "parametrosValores"],
  consolidado_valores: ["painelValores", "parametrosValores"],
};

let db: BancoDeTeste;

async function valor<T = unknown>(sql: string, p: unknown[] = []): Promise<T> {
  const { rows } = await db.query<Record<string, T>>(sql, p);
  return Object.values(rows[0] ?? {})[0] as T;
}

const conta = (tabela: string, onde = "true") =>
  valor<number>(
    `select count(*)::int from sustentabilidade.${tabela} where ${onde}`,
  );

async function erro(sql: string, p: unknown[] = []): Promise<string | null> {
  try {
    await db.query(sql, p);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

/** Linhas afetadas (0 quando o RLS esconde a linha). */
async function afetadas(sql: string, p: unknown[] = []): Promise<number> {
  return (await db.query(sql, p)).affectedRows ?? 0;
}

async function como<T>(usuario: string, fn: () => Promise<T>): Promise<T> {
  return db.comoUsuario(usuario, fn);
}

type Pergunta = {
  id: string;
  ativa: boolean;
  opcoes: { id: string; texto: string; ativa: boolean }[];
  [k: string]: unknown;
};
type Definicao = {
  secoes: { id: string; nome: string; ativa: boolean; perguntas: Pergunta[] }[];
};

const rascunho = (id: string) =>
  valor<Definicao>(
    "select rascunho from sustentabilidade.formularios where id = $1",
    [id],
  );

/** Grava o rascunho como a pessoa e tenta publicar. Devolve o erro ou null. */
async function publicar(
  quem: string,
  id: string,
  muda: (d: Definicao) => void,
  resumo = "Ajuste",
) {
  const antes = await rascunho(id);
  const d = structuredClone(antes);
  muda(d);
  const falha = await como(quem, async () => {
    await db.query(
      "update sustentabilidade.formularios set rascunho = $1, rascunho_alterado = true where id = $2",
      [JSON.stringify(d), id],
    );
    return erro("select sustentabilidade.publicar_formulario($1, $2)", [
      id,
      resumo,
    ]);
  });
  // O rascunho recusado continua gravado; o teste volta ao anterior.
  if (falha)
    await db.query(
      "update sustentabilidade.formularios set rascunho = $1 where id = $2",
      [JSON.stringify(antes), id],
    );
  return falha;
}

const semPergunta = (id: string) => (d: Definicao) => {
  for (const sec of d.secoes)
    sec.perguntas = sec.perguntas.filter((p) => p.id !== id);
};
const pergunta = (d: Definicao, id: string) => {
  const p = d.secoes.flatMap((x) => x.perguntas).find((x) => x.id === id);
  if (!p) throw new Error(`sem a pergunta ${id}`);
  return p;
};

beforeAll(async () => {
  db = await abrirBanco();
  for (const [nome, id] of Object.entries(U)) {
    await db.query(
      "insert into auth.users (id, email, encrypted_password) values ($1, $2, '')",
      [id, `${nome}@arp.test`],
    );
    for (const p of PERMISSOES[nome as Usuario]) {
      await db.query(
        "insert into core.usuario_permissoes (usuario_id, permissao) values ($1, $2)",
        [id, p],
      );
    }
  }
  // Tabelas que o exemplo deixa vazias ganham uma linha para o teste de leitura.
  await db.exec(`
    insert into sustentabilidade.importacoes (id, tipo, status)
      values ('10000000-0000-4000-8000-000000000001', 'tour', 'desfeita');
    insert into sustentabilidade.formulario_alteracoes (formulario_id, descricao)
      values ('${F.questionario}', 'Editou o texto da pergunta 7');
    insert into sustentabilidade.entrevista_transferencias (entrevista_id, de_contrato_id, para_contrato_id, motivo)
      select e.id, e.contrato_id, 'c0000000-0000-4000-8000-000000000001', 'Mudou de loja'
      from sustentabilidade.entrevistas e
      where e.contrato_id <> 'c0000000-0000-4000-8000-000000000001' limit 1;
    insert into sustentabilidade.programa_links (programa_id, token_hash)
      values ('${P.mercado}', repeat('ab', 32));
    insert into sustentabilidade.equivalencias (nome, fator, unidade) values ('Árvores', 0.017, 'árvores');
    insert into sustentabilidade.consolidados (ano, totais) values (2025, '{"volume_reciclado": 22750}');
    insert into sustentabilidade.consolidado_valores (ano, totais) values (2025, '{"rcc_economia": 12000}');
  `);
}, 240_000);

describe("ponto de partida", () => {
  it("cadastra as 17 permissões fixas e uma por programa; Administrador tem todas", async () => {
    expect(
      await valor<number>(
        "select count(*)::int from core.permissoes where codigo like 'sustentabilidade.%' and codigo not like 'sustentabilidade.programa.%'",
      ),
    ).toBe(17);
    expect(
      await valor<number>(
        "select count(*)::int from core.permissoes where codigo like 'sustentabilidade.programa.%'",
      ),
    ).toBe(3);
    expect(
      await valor<number>(
        `select count(*)::int from core.permissoes p
         where p.codigo like 'sustentabilidade.%' and not exists (
           select 1 from core.cargo_permissoes cp join core.cargos c on c.id = cp.cargo_id
           where c.nome = 'Administrador' and cp.permissao = p.codigo)`,
      ),
    ).toBe(0);
  });

  it("toda tabela tem RLS e está na matriz de leitura deste teste", async () => {
    const { rows } = await db.query<{ t: string; rls: boolean }>(
      `select c.relname as t, c.relrowsecurity as rls from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'sustentabilidade' and c.relkind = 'r' order by 1`,
    );
    expect(rows.filter((r) => !r.rls)).toEqual([]);
    expect(rows.map((r) => r.t)).toEqual(Object.keys(LEITURA).sort());
  });

  it("toda chave estrangeira tem índice", async () => {
    const { rows } = await db.query<{ fk: string }>(
      `select c.conrelid::regclass || ' ' || c.conname as fk
       from pg_constraint c
       where c.contype = 'f' and c.connamespace = 'sustentabilidade'::regnamespace
         and not exists (
           select 1 from pg_index i
           where i.indrelid = c.conrelid
             and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] @> c.conkey)`,
    );
    expect(rows).toEqual([]);
  });

  it("dados de exemplo no volume da seção 6", async () => {
    expect(await conta("contratos")).toBe(272);
    expect(await conta("contratos", "tipo_loja = 'Área Publicitária'")).toBe(
      30,
    );
    expect(await conta("contratos", "rescisao is not null")).toBe(8);
    expect(
      await valor<number>(
        "select count(distinct cliente_doc)::int from sustentabilidade.contratos where situacao = 'vigente'",
      ),
    ).toBe(178);
    expect(await conta("contratos", "cliente_doc !~ '^99\\d{6}000100$'")).toBe(
      0,
    );
    expect(await conta("contratos", "cardinality(lucs) = 3")).toBeGreaterThan(
      0,
    );
    expect(await conta("entrevistas", "data >= '2026-01-01'")).toBe(20);
    expect(await conta("entrevistas", "tipo = 'atualizacao'")).toBe(4);
    // As 3 antigas: duas a vencer nos próximos 30 dias e uma vencida.
    expect(
      await valor<string[]>(
        "select array_agg(valida_ate::text order by valida_ate) from sustentabilidade.entrevistas where data < '2026-01-01'",
      ),
    ).toEqual(["2026-09-15", "2026-11-20", "2026-12-02"]);
    expect(await conta("participantes", "not locatario_manual")).toBe(27);
    expect(await conta("participantes", "locatario_manual")).toBe(3);
    // Todo participante locatário tem contrato vigente (27 de 178 = 15,2%).
    expect(
      await conta(
        "participantes p",
        "not locatario_manual and exists (select 1 from sustentabilidade.contratos c where c.cliente_doc = p.cliente_doc and c.situacao = 'vigente')",
      ),
    ).toBe(27);
    expect(await conta("termos")).toBe(30);
    expect(await conta("coletores")).toBe(12);
    expect(await conta("rondas")).toBe(12);
    expect(await conta("ronda_itens", "ocupacao_pct = 100")).toBeGreaterThan(0);
    expect(
      await conta(
        "rcc_notas",
        "competencia between '2026-01-01' and '2026-10-01'",
      ),
    ).toBe(10);
    expect(
      await valor<string[]>(
        "select array_agg(nome order by nome) from sustentabilidade.programas",
      ),
    ).toEqual(["Mercado Local", "SustentArp", "Turismo"]);
    expect(
      await conta("formularios", "tipo = 'programa' and versao_publicada = 1"),
    ).toBe(6);
    expect(await conta("programa_indicadores")).toBe(16);
    expect(
      await valor<number>(
        "select count(distinct date_trunc('month', data))::int from sustentabilidade.lancamentos",
      ),
    ).toBe(10);
    expect(await conta("lancamentos", `formulario_id = '${F.atracoes}'`)).toBe(
      320,
    );
    expect(await conta("lancamentos", `formulario_id = '${F.tour}'`)).toBe(7);
    expect(
      await valor<number[]>(
        "select array_agg(distinct ano order by ano) from sustentabilidade.marcos",
      ),
    ).toEqual([2024, 2025]);
    for (const t of [
      "contratos",
      "entrevistas",
      "participantes",
      "coletores",
      "rondas",
      "rcc_notas",
      "rcc_precos",
      "programas",
      "formularios",
      "lancamentos",
      "marcos",
    ])
      expect([t, await conta(t, "not exemplo")]).toEqual([t, 0]);
  });

  it("questionário de exemplo: igual ao do código (v1 = Forms + 18b; v2 = v1 + 25b), no formato do editor", async () => {
    const versao = (n: number) =>
      valor<Definicao>(
        `select definicao from sustentabilidade.formulario_versoes where formulario_id = '${F.questionario}' and versao = ${n}`,
      );
    const [v1, v2] = [await versao(1), await versao(2)];
    // O texto da migration é o de src/lib/sustentabilidade/questionario-inicial.ts.
    expect(v1).toEqual(questionarioV1());
    expect(v2).toEqual(questionarioV2());
    expect(await rascunho(F.questionario)).toEqual(v2);
    expect(v2.secoes.map((x) => x.id)).toEqual(["A", "B", "C", "D", "E", "F"]);
    const ids = (d: Definicao) =>
      d.secoes.flatMap((x) => x.perguntas.map((p) => p.id)).sort();
    const forms = [
      ...Array.from({ length: 46 }, (_, i) => `q${i + 1}`),
      "q18b",
    ];
    expect(ids(v1)).toEqual([...forms].sort());
    expect(ids(v2)).toEqual([...forms, "q25b"].sort());
    expect(pergunta(v2, "q7").opcoes[0]).toEqual({
      id: "q7_muito",
      texto: "10 a 9 - muito conhecimento",
      ativa: true,
    });
    expect(pergunta(v2, "q1")).toMatchObject({
      tipo: "auto",
      auto: "empresa",
      travada: true,
    });
    expect(pergunta(v2, "q19").mostrar_se).toEqual({
      pergunta_id: "q18b",
      valor: "q18b_nao",
    });
  });

  it("todo formulário de exemplo passa no esquema do editor; as respostas de exemplo, no da versão delas", async () => {
    const { rows } = await db.query<{ nome: string; definicao: unknown }>(
      `select f.nome || ' v' || v.versao as nome, v.definicao
       from sustentabilidade.formulario_versoes v
       join sustentabilidade.formularios f on f.id = v.formulario_id order by 1`,
    );
    expect(rows).toHaveLength(8);
    for (const r of rows) {
      const lido = definicaoSchema.safeParse(r.definicao);
      expect([r.nome, lido.success ? null : lido.error.issues]).toEqual([
        r.nome,
        null,
      ]);
      // O banco guarda exatamente o que o esquema devolve (nada a mais).
      expect(lido.data).toEqual(r.definicao);
    }
    const v1 = questionarioV1();
    const entrevistas = await db.query<{ respostas: Record<string, unknown> }>(
      "select respostas from sustentabilidade.entrevistas",
    );
    expect(entrevistas.rows).toHaveLength(23);
    const tipos = new Map(
      v1.secoes.flatMap((x) => x.perguntas).map((q) => [q.id, q.tipo] as const),
    );
    for (const { respostas } of entrevistas.rows) {
      for (const [id, v] of Object.entries(respostas)) {
        const tipo = tipos.get(id);
        if (!tipo)
          throw new Error(`resposta de pergunta que não existe: ${id}`);
        const lido = respostaSchema(tipo).safeParse(v);
        expect([id, v, lido.success]).toEqual([id, v, true]);
      }
    }
    // Idem os lançamentos, na definição do formulário deles.
    const lanc = await db.query<{
      definicao: Definicao;
      valores: Record<string, unknown>;
    }>(
      `select v.definicao, l.valores || coalesce(lv.valores, '{}') as valores
       from (select distinct on (formulario_id, valores -> 'tipo') * from sustentabilidade.lancamentos) l
       join sustentabilidade.formulario_versoes v on v.formulario_id = l.formulario_id and v.versao = l.formulario_versao
       left join sustentabilidade.lancamento_valores lv on lv.lancamento_id = l.id`,
    );
    expect(lanc.rows.length).toBeGreaterThan(10);
    for (const { definicao, valores } of lanc.rows) {
      const campos = new Map(
        definicao.secoes
          .flatMap((x) => x.perguntas)
          .map((q) => [q.id, q.tipo] as const),
      );
      for (const [id, v] of Object.entries(valores)) {
        const tipo = campos.get(id) as TipoPergunta | undefined;
        if (!tipo) throw new Error(`valor de campo que não existe: ${id}`);
        expect([id, v, respostaSchema(tipo).safeParse(v).success]).toEqual([
          id,
          v,
          true,
        ]);
      }
    }
  });
});

describe("RLS de leitura, tabela por tabela", () => {
  for (const [tabela, quem] of Object.entries(LEITURA)) {
    it(`${tabela}: lê ${quem.length === DO_MODULO.length ? "quem usa o módulo" : quem.join(", ")}`, async () => {
      expect(await conta(tabela)).toBeGreaterThan(0);
      const leram: Usuario[] = [];
      for (const n of TODOS) {
        if ((await como(U[n], () => conta(tabela))) > 0) leram.push(n);
      }
      expect(leram).toEqual(TODOS.filter((n) => quem.includes(n)));
    });
  }

  it("sem 'Ver valores' ninguém lê tabela de valores; sem 'Ver contato', nenhuma de contatos", async () => {
    const { rows } = await db.query<{ t: string }>(
      `select tablename as t from pg_tables where schemaname = 'sustentabilidade'
       and (tablename like '%valores' or tablename = 'rcc_precos' or tablename like '%contatos')`,
    );
    expect(rows).toHaveLength(9);
    for (const { t } of rows) {
      const exige = t.endsWith("contatos") ? "contato" : "valores";
      for (const n of TODOS) {
        if (PERMISSOES[n].includes(`sustentabilidade.${exige}`)) continue;
        expect([t, n, await como(U[n], () => conta(t))]).toEqual([t, n, 0]);
      }
    }
  });

  it("'Programa – lançar' vê só o seu programa, os indicadores e os lançamentos dele", async () => {
    await como(U.lanca, async () => {
      expect(
        await valor<string[]>(
          "select array_agg(nome) from sustentabilidade.programas",
        ),
      ).toEqual(["Mercado Local"]);
      expect(await conta("lancamentos", `programa_id <> '${P.mercado}'`)).toBe(
        0,
      );
      expect(
        await conta("programa_indicadores", `programa_id <> '${P.mercado}'`),
      ).toBe(0);
      expect(await conta("lancamentos")).toBeGreaterThan(300);
    });
  });

  it("entrevistas_resumo() dá a lista de controle sem as respostas a quem só tem 'ver'", async () => {
    expect(
      await como(U.ver, () =>
        valor<number>(
          "select count(*)::int from sustentabilidade.entrevistas_resumo()",
        ),
      ),
    ).toBe(23);
    expect(
      await como(U.ronda, () =>
        valor<number>(
          "select count(*)::int from sustentabilidade.entrevistas_resumo()",
        ),
      ),
    ).toBe(0);
    const { fields } = await db.query(
      "select * from sustentabilidade.entrevistas_resumo() limit 0",
    );
    expect(fields.map((f) => f.name)).not.toContain("respostas");
  });
});

describe("RLS de gravação", () => {
  it("parâmetros: só 'Parâmetros' edita; valores do tour exigem também 'Ver valores'", async () => {
    const muda = "update sustentabilidade.parametros set aviso_dias = 45";
    expect(await como(U.ver, () => afetadas(muda))).toBe(0);
    expect(await como(U.parametros, () => afetadas(muda))).toBe(1);
    const custo =
      "update sustentabilidade.parametros_valores set tour_custo_album = 3";
    expect(await como(U.parametros, () => afetadas(custo))).toBe(0);
    expect(await como(U.parametrosValores, () => afetadas(custo))).toBe(1);
    expect(
      await como(U.parametros, () =>
        erro("update sustentabilidade.parametros set id = true"),
      ),
    ).toMatch(/permission denied/);
    for (const [t, sql] of [
      [
        "setor_validades",
        "insert into sustentabilidade.setor_validades (setor, meses) values ('Veterinária', 3)",
      ],
      [
        "coletores",
        "insert into sustentabilidade.coletores (local, cor) values ('PEV Novo', 'azul')",
      ],
      [
        "rcc_fatores",
        "insert into sustentabilidade.rcc_fatores (vigente_desde, toneladas_por_cacamba, volume_m3) values ('2026-12-01', 7, 5)",
      ],
      [
        "co2_fatores",
        "insert into sustentabilidade.co2_fatores (vigente_desde, kg_por_kwh) values ('2026-12-01', 0.04)",
      ],
      [
        "marcos",
        "insert into sustentabilidade.marcos (indicador, ano, valor) values ('volume_reciclado', 2023, 100)",
      ],
      [
        "equivalencias",
        "insert into sustentabilidade.equivalencias (nome, fator) values ('Água', 2)",
      ],
      [
        "consolidados",
        "insert into sustentabilidade.consolidados (ano, totais) values (2024, '{}')",
      ],
    ] as const) {
      expect([t, await como(U.painel, () => erro(sql))]).toEqual([
        t,
        expect.stringMatching(/row-level security/),
      ]);
      expect([t, await como(U.parametros, () => erro(sql))]).toEqual([t, null]);
    }
    // Preço da caçamba e reais do consolidado: Parâmetros + Ver valores.
    const preco =
      "insert into sustentabilidade.rcc_precos (vigente_desde, preco_a, preco_b) values ('2026-12-01', 550, 990)";
    expect(await como(U.parametros, () => erro(preco))).toMatch(
      /row-level security/,
    );
    expect(await como(U.parametrosValores, () => erro(preco))).toBeNull();
  });

  it("contratos: 'dispensar ou corrigir' muda só o que é do módulo; quem e quando vêm do banco", async () => {
    const id = "c0000000-0000-4000-8000-000000000002";
    const dispensa = `update sustentabilidade.contratos set dispensada_motivo = 'Contrato temporário' where id = '${id}'`;
    expect(await como(U.ver, () => afetadas(dispensa))).toBe(0);
    expect(await como(U.corrige, () => afetadas(dispensa))).toBe(1);
    expect(
      await valor<string>(
        `select dispensada_por::text from sustentabilidade.contratos where id = '${id}' and dispensada_em is not null`,
      ),
    ).toBe(U.corrige);
    expect(
      await como(U.corrige, () =>
        erro(
          `update sustentabilidade.contratos set cliente_nome = 'Outro' where id = '${id}'`,
        ),
      ),
    ).toMatch(/permission denied/);
    expect(
      await como(U.corrige, () =>
        erro(
          `insert into sustentabilidade.contratos (cliente_nome) values ('Novo')`,
        ),
      ),
    ).toMatch(/permission denied/);
    // Correção da ativação exige motivo.
    expect(
      await como(U.corrige, () =>
        erro(
          `update sustentabilidade.contratos set ativacao_corrigida = '2026-03-01' where id = '${id}'`,
        ),
      ),
    ).toMatch(/check constraint/);
    await como(U.corrige, () =>
      db.query(
        `update sustentabilidade.contratos set ativacao_corrigida = '2026-03-01', ativacao_corrigida_motivo = 'Data errada no ENET', dispensada_motivo = null where id = '${id}'`,
      ),
    );
    expect(
      await valor<number>(
        `select count(*)::int from core.auditoria where tabela = 'sustentabilidade.contratos' and registro_id = '${id}'`,
      ),
    ).toBe(2);
  });

  it("entrevistas: quem aplica cria e salva a sua; salva só muda por 'corrigir', com antes e depois", async () => {
    const contrato = "c0000000-0000-4000-8000-000000000004";
    const cria = (quem: string) =>
      como(quem, () =>
        erro(
          `insert into sustentabilidade.entrevistas (id, contrato_id, data, formulario_versao, respostas, rascunho_chave, entrevistador_id)
           values ('20000000-0000-4000-8000-000000000001', '${contrato}', '2026-11-16', 1, '{"q6": "Maria – gerente"}',
             '20000000-0000-4000-8000-0000000000aa', '${quem}')`,
        ),
      );
    expect(await cria(U.ver)).toMatch(/row-level security/);
    expect(await cria(U.respostas)).toMatch(/row-level security/);
    expect(await cria(U.aplica)).toBeNull();
    // O mesmo rascunho enviado de novo (offline) não entra duas vezes.
    expect(
      await como(U.aplica, () =>
        erro(
          `insert into sustentabilidade.entrevistas (contrato_id, data, formulario_versao, rascunho_chave, entrevistador_id)
           values ('${contrato}', '2026-11-16', 1, '20000000-0000-4000-8000-0000000000aa', '${U.aplica}')`,
        ),
      ),
    ).toMatch(/duplicate key/);
    // Quem aplica vê só as que aplicou.
    expect(await como(U.aplica, () => conta("entrevistas"))).toBe(1);
    const salva =
      "update sustentabilidade.entrevistas set situacao = 'salva', valida_ate = '2028-11-16' where id = '20000000-0000-4000-8000-000000000001'";
    expect(await como(U.aplica, () => afetadas(salva))).toBe(1);
    const corrige = `update sustentabilidade.entrevistas set respostas = respostas || '{"q8": 5}' where id = '20000000-0000-4000-8000-000000000001'`;
    expect(await como(U.aplica, () => afetadas(corrige))).toBe(0);
    expect(await como(U.respostas, () => afetadas(corrige))).toBe(0);
    expect(await como(U.corrige, () => afetadas(corrige))).toBe(1);
    const { rows } = await db.query<{ antes: unknown; depois: unknown }>(
      `select antes -> 'respostas' -> 'q8' as antes, depois -> 'respostas' -> 'q8' as depois
       from core.auditoria where tabela = 'sustentabilidade.entrevistas'
         and registro_id = '20000000-0000-4000-8000-000000000001' order by em desc, id desc limit 1`,
    );
    expect(rows[0]).toEqual({ antes: null, depois: 5 });
    // Salva não é apagada por ninguém do módulo.
    const apaga =
      "delete from sustentabilidade.entrevistas where id = '20000000-0000-4000-8000-000000000001'";
    expect(await como(U.aplica, () => afetadas(apaga))).toBe(0);
    expect(await como(U.corrige, () => afetadas(apaga))).toBe(0);
    // Mesma entrevista (contrato e data) duas vezes: bloqueia.
    expect(
      await erro(
        `insert into sustentabilidade.entrevistas (contrato_id, data, formulario_versao, situacao) values ('${contrato}', '2026-11-16', 1, 'salva')`,
      ),
    ).toMatch(/duplicate key/);
    // Transferir é de quem corrige.
    const transfere = (quem: string) =>
      como(quem, () =>
        erro(
          `insert into sustentabilidade.entrevista_transferencias (entrevista_id, de_contrato_id, para_contrato_id, motivo, quem)
           values ('20000000-0000-4000-8000-000000000001', '${contrato}', 'c0000000-0000-4000-8000-000000000005', 'Mudou de LUC', '${quem}')`,
        ),
      );
    expect(await transfere(U.ver)).toMatch(/row-level security/);
    expect(await transfere(U.corrige)).toBeNull();
  });

  it("clube: só 'editar' grava; valor e contato exigem as permissões próprias", async () => {
    const novo = (quem: string) =>
      como(quem, () =>
        erro(
          `insert into sustentabilidade.participantes (id, cliente_doc, nome, formas)
           values ('30000000-0000-4000-8000-000000000001', '99555555000100', 'Padaria Nova', '{Pagante}')`,
        ),
      );
    expect(await novo(U.clubeVer)).toMatch(/row-level security/);
    expect(await novo(U.clube)).toBeNull();
    const pid = "30000000-0000-4000-8000-000000000001";
    for (const sql of [
      `insert into sustentabilidade.termos (participante_id, ano, assinado_em, valido_ate) values ('${pid}', 2026, '2026-11-01', '2027-11-01')`,
      `insert into sustentabilidade.contribuicoes (id, participante_id, data, forma, competencia) values ('30000000-0000-4000-8000-0000000000c1', '${pid}', '2026-11-05', 'PIX', '2026-11-01')`,
      `insert into sustentabilidade.acoes (participante_id, data, tipo) values ('${pid}', '2026-11-06', 'Oficina')`,
    ]) {
      expect(await como(U.clubeVer, () => erro(sql))).toMatch(
        /row-level security/,
      );
      expect(await como(U.clube, () => erro(sql))).toBeNull();
    }
    // Quem lança a contribuição grava o valor, mas não o lê depois.
    const valorSql =
      "insert into sustentabilidade.contribuicao_valores (contribuicao_id, valor) values ('30000000-0000-4000-8000-0000000000c1', 80)";
    expect(await como(U.clubeVer, () => erro(valorSql))).toMatch(
      /row-level security/,
    );
    expect(await como(U.clube, () => erro(valorSql))).toBeNull();
    expect(
      await como(U.clube, () =>
        conta(
          "contribuicao_valores",
          "contribuicao_id = '30000000-0000-4000-8000-0000000000c1'",
        ),
      ),
    ).toBe(0);
    const combinado = `insert into sustentabilidade.participante_valores (participante_id, valor_combinado_mes) values ('${pid}', 80)`;
    const contato = `insert into sustentabilidade.participante_contatos (participante_id, email) values ('${pid}', 'padaria@exemplo.invalid')`;
    expect(await como(U.clube, () => erro(combinado))).toMatch(
      /row-level security/,
    );
    expect(await como(U.clube, () => erro(contato))).toMatch(
      /row-level security/,
    );
    expect(await como(U.clubeTudo, () => erro(combinado))).toBeNull();
    expect(await como(U.clubeTudo, () => erro(contato))).toBeNull();
    // Interesse registrado pela entrevista: quem aplica cria só o interesse.
    expect(
      await como(U.aplica, () =>
        erro(
          "insert into sustentabilidade.participantes (cliente_doc, nome, interesse) values ('99555556000100', 'Loja Interessada', true)",
        ),
      ),
    ).toBeNull();
    expect(
      await como(U.aplica, () =>
        erro(
          "insert into sustentabilidade.participantes (cliente_doc, nome, formas) values ('99555557000100', 'Loja Pagante', '{Pagante}')",
        ),
      ),
    ).toMatch(/row-level security/);
  });

  it("rondas: só 'lançar ronda' grava; ocupação de 10 em 10; coletor não visitado fica sem linha", async () => {
    const ronda = (quem: string) =>
      como(quem, () =>
        erro(
          `insert into sustentabilidade.rondas (id, lancado_por) values ('40000000-0000-4000-8000-000000000001', '${quem}')`,
        ),
      );
    expect(await ronda(U.painel)).toMatch(/row-level security/);
    expect(await ronda(U.ronda)).toBeNull();
    const item = (pct: number, coletor: number) =>
      `insert into sustentabilidade.ronda_itens (ronda_id, coletor_id, conteineres, ocupacao_pct)
       values ('40000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000${coletor}', 2, ${pct})`;
    expect(await como(U.painel, () => erro(item(50, 1)))).toMatch(
      /row-level security/,
    );
    expect(await como(U.ronda, () => erro(item(55, 1)))).toMatch(
      /check constraint/,
    );
    expect(await como(U.ronda, () => erro(item(100, 1)))).toBeNull();
    expect(await como(U.ronda, () => erro(item(0, 2)))).toBeNull();
    expect(
      await conta(
        "ronda_itens",
        "ronda_id = '40000000-0000-4000-8000-000000000001'",
      ),
    ).toBe(2);
  });

  it("RCC: só 'RCC' lança; A + B > 0; PDF obrigatório; valor da nota escondido sem 'Ver valores'", async () => {
    const nota = (a: number, b: number, pdf = "'rcc/nota.pdf'") =>
      `insert into sustentabilidade.rcc_notas (id, competencia, empresa, numero, pdf, cacambas_a, cacambas_b)
       values ('50000000-0000-4000-8000-000000000001', '2026-11-01', 'Coletora (fictícia)', 'NF 1', ${pdf}, ${a}, ${b})`;
    expect(await como(U.painel, () => erro(nota(3, 1)))).toMatch(
      /row-level security/,
    );
    expect(await como(U.rcc, () => erro(nota(0, 0)))).toMatch(
      /check constraint/,
    );
    expect(await como(U.rcc, () => erro(nota(3, 1, "null")))).toMatch(
      /not-null|null value/,
    );
    expect(await como(U.rcc, () => erro(nota(3, 1)))).toBeNull();
    expect(
      await como(U.rcc, () =>
        erro(
          "insert into sustentabilidade.rcc_nota_valores (nota_id, valor_total) values ('50000000-0000-4000-8000-000000000001', 2540)",
        ),
      ),
    ).toBeNull();
    const le = "nota_id = '50000000-0000-4000-8000-000000000001'";
    expect(await como(U.rcc, () => conta("rcc_nota_valores", le))).toBe(0);
    expect(await como(U.rccValores, () => conta("rcc_nota_valores", le))).toBe(
      1,
    );
  });

  it("programas, indicadores e formulários de programa: só 'Programas – gerenciar'", async () => {
    const programa =
      "insert into sustentabilidade.programas (id, nome, area) values ('60000000-0000-4000-8000-000000000001', 'Horta Comunitária', 'Social')";
    expect(await como(U.painel, () => erro(programa))).toMatch(
      /row-level security/,
    );
    expect(await como(U.lanca, () => erro(programa))).toMatch(
      /row-level security/,
    );
    expect(await como(U.gestora, () => erro(programa))).toBeNull();
    const form = `insert into sustentabilidade.formularios (id, tipo, programa_id, nome)
      values ('60000000-0000-4000-8000-0000000000f1', 'programa', '60000000-0000-4000-8000-000000000001', 'Colheitas')`;
    expect(await como(U.questionario, () => erro(form))).toMatch(
      /row-level security/,
    );
    expect(await como(U.gestora, () => erro(form))).toBeNull();
    // Um questionário só, e ele não é de quem gerencia programas.
    expect(
      await como(U.gestora, () =>
        erro(
          "insert into sustentabilidade.formularios (tipo, nome) values ('questionario', 'Outro')",
        ),
      ),
    ).toMatch(/row-level security/);
    expect(
      await como(U.questionario, () =>
        erro(
          "insert into sustentabilidade.formularios (tipo, nome) values ('questionario', 'Outro')",
        ),
      ),
    ).toMatch(/duplicate key/);
    expect(
      await como(U.gestora, () =>
        afetadas(
          `update sustentabilidade.formularios set nome = 'x' where id = '${F.questionario}'`,
        ),
      ),
    ).toBe(0);
    // versao_publicada só muda pela função.
    expect(
      await como(U.gestora, () =>
        erro(
          "update sustentabilidade.formularios set versao_publicada = 5 where id = '60000000-0000-4000-8000-0000000000f1'",
        ),
      ),
    ).toMatch(/permission denied/);
    // Contato do parceiro exige "Ver contato".
    const contato =
      "insert into sustentabilidade.programa_contatos (programa_id, email) values ('60000000-0000-4000-8000-000000000001', 'horta@exemplo.invalid')";
    expect(await como(U.gestora, () => erro(contato))).toMatch(
      /row-level security/,
    );
    expect(await como(U.gestoraTudo, () => erro(contato))).toBeNull();
    // Excluir formulário: precisa de "excluir"; com lançamentos, nem assim.
    const apaga = (id: string) =>
      `delete from sustentabilidade.formularios where id = '${id}'`;
    expect(
      await como(U.gestora, () =>
        afetadas(apaga("60000000-0000-4000-8000-0000000000f1")),
      ),
    ).toBe(0);
    expect(await como(U.gestoraTudo, () => erro(apaga(F.atracoes)))).toMatch(
      /foreign key/,
    );
    expect(
      await como(U.gestoraTudo, () => erro(apaga(F.questionario))),
    ).toBeNull();
    expect(await conta("formularios", "tipo = 'questionario'")).toBe(1);
  });

  it("link do parceiro: só 'Programas – gerenciar' lê, cria e desliga; um ativo por programa; o token não é lido", async () => {
    const hash = "cd".repeat(32);
    const cria = (quem: string, programa: string) =>
      como(quem, () =>
        erro(
          `insert into sustentabilidade.programa_links (programa_id, token_hash, criado_por) values ('${programa}', '${hash}', '${quem}')`,
        ),
      );
    expect(await cria(U.lanca, P.turismo)).toMatch(/row-level security/);
    expect(await cria(U.painel, P.turismo)).toMatch(/row-level security/);
    expect(await cria(U.gestora, P.mercado)).toMatch(/duplicate key/);
    expect(await cria(U.gestora, P.turismo)).toBeNull();
    expect(
      await erro(
        `insert into sustentabilidade.programa_links (programa_id, token_hash) values ('${P.sustentarp}', 'token-em-claro')`,
      ),
    ).toMatch(/check constraint/);
    const desliga = `update sustentabilidade.programa_links set desligado_em = now() where programa_id = '${P.turismo}'`;
    expect(await como(U.lanca, () => afetadas(desliga))).toBe(0);
    expect(await como(U.gestora, () => afetadas(desliga))).toBe(1);
    expect(
      await como(U.gestora, () =>
        erro(
          `update sustentabilidade.programa_links set desligado_em = null where programa_id = '${P.turismo}'`,
        ),
      ),
    ).toMatch(/não pode ser religado/);
    expect(
      await como(U.gestora, () =>
        erro(
          `update sustentabilidade.programa_links set ultimo_acesso_em = now() where programa_id = '${P.turismo}'`,
        ),
      ),
    ).toMatch(/permission denied/);
    // anon (o parceiro, sem usuário) não alcança nada do schema.
    await db.comoAnonimo(async () => {
      expect(
        await erro("select 1 from sustentabilidade.programa_links"),
      ).toMatch(/permission denied/);
      expect(await erro("select 1 from sustentabilidade.lancamentos")).toMatch(
        /permission denied/,
      );
    });
  });
});

describe("caminhos de arquivo presos à própria linha", () => {
  it("entrevista, termo, ronda e RCC recusam caminho de arquivo alheio", async () => {
    const id = "d0000000-0000-4000-8000-0000000000aa";
    const ins = (pdf: string, anexos = "[]") =>
      erro(
        `insert into sustentabilidade.entrevistas (id, contrato_id, data, formulario_versao, pdf, anexos)
         values ('${id}', 'c0000000-0000-4000-8000-000000000006', '2026-01-02', 1, '${pdf}', '${anexos}')`,
      );
    expect(await ins("entrevistas/outra-entrevista/entrevista.pdf")).toMatch(
      /check constraint/,
    );
    expect(await ins("importacoes/x/planilha.xlsx")).toMatch(
      /check constraint/,
    );
    expect(
      await ins(
        `entrevistas/${id}/a.pdf`,
        '[{"nome":"x","caminho":"clube/termos/y/z.pdf"}]',
      ),
    ).toMatch(/check constraint/);
    expect(
      await ins(
        `entrevistas/${id}/a.pdf`,
        `[{"nome":"x","caminho":"entrevistas/${id}/anexos/1-x.pdf"}]`,
      ),
    ).toBeNull();
    const pid = await valor<string>(
      "select id from sustentabilidade.participantes limit 1",
    );
    expect(
      await erro(
        `insert into sustentabilidade.termos (participante_id, ano, assinado_em, valido_ate, arquivo)
         values ('${pid}', 2031, '2031-01-01', '2032-01-01', 'clube/termos/outro/t.pdf')`,
      ),
    ).toMatch(/check constraint/);
    expect(
      await erro(
        "insert into sustentabilidade.rondas (foto) values ('entrevistas/x/a.pdf')",
      ),
    ).toMatch(/check constraint/);
    expect(
      await erro(
        "insert into sustentabilidade.rcc_notas (competencia, empresa, numero, pdf, cacambas_a) values ('2026-01-01', 'E', '1', 'clube/termos/x.pdf', 1)",
      ),
    ).toMatch(/check constraint/);
    await db.query(
      `delete from sustentabilidade.entrevistas where id = '${id}'`,
    );
  });
});

describe("permissão por programa (Programa – lançar)", () => {
  const NOVO = "60000000-0000-4000-8000-000000000002";
  const codigo = `sustentabilidade.programa.${NOVO}`;

  it("criar o programa cria a permissão (com o nome) e dá ao Administrador; renomear muda a descrição", async () => {
    await como(U.gestora, () =>
      db.query(
        `insert into sustentabilidade.programas (id, nome) values ('${NOVO}', 'Feira de Trocas')`,
      ),
    );
    expect(
      await valor<string>(
        `select descricao from core.permissoes where codigo = '${codigo}'`,
      ),
    ).toBe("Programa – lançar: Feira de Trocas");
    expect(
      await valor<number>(
        `select count(*)::int from core.cargo_permissoes cp join core.cargos c on c.id = cp.cargo_id
         where c.nome = 'Administrador' and cp.permissao = '${codigo}'`,
      ),
    ).toBe(1);
    await como(U.gestora, () =>
      db.query(
        `update sustentabilidade.programas set nome = 'Feira de Trocas e Reparos' where id = '${NOVO}'`,
      ),
    );
    expect(
      await valor<string>(
        `select descricao from core.permissoes where codigo = '${codigo}'`,
      ),
    ).toBe("Programa – lançar: Feira de Trocas e Reparos");
    // Quem só lança entra no módulo por essa permissão.
    expect(
      await como(U.lanca, () =>
        valor<boolean>("select sustentabilidade.acessa()"),
      ),
    ).toBe(true);
    expect(
      await como(U.lanca, () =>
        valor<string[]>(
          "select array_agg(p::text) from sustentabilidade.meus_programas() p",
        ),
      ),
    ).toEqual([P.mercado]);
  });

  it("quem tem a permissão lança só naquele programa", async () => {
    const lanca = (quem: string, programa: string, formulario: string) =>
      como(quem, () =>
        erro(
          `insert into sustentabilidade.lancamentos (programa_id, formulario_id, formulario_versao, data, valores, lancado_por)
           values ('${programa}', '${formulario}', 1, '2026-11-14', '{"data": "2026-11-14", "produtor": "Sítio da Serra"}', '${quem}')`,
        ),
      );
    expect(await lanca(U.lanca, P.mercado, F.produtores)).toBeNull();
    expect(await lanca(U.lanca, P.sustentarp, F.coleta)).toMatch(
      /row-level security/,
    );
    expect(await lanca(U.painel, P.mercado, F.produtores)).toMatch(
      /row-level security/,
    );
    expect(await lanca(U.exporta, P.mercado, F.produtores)).toMatch(
      /row-level security/,
    );
    expect(await lanca(U.gestora, P.sustentarp, F.coleta)).toBeNull();
    // Formulário de outro programa e versão que não existe: recusados.
    expect(await lanca(U.gestora, P.mercado, F.coleta)).toMatch(
      /não é deste programa/,
    );
    expect(
      await como(U.gestora, () =>
        erro(
          `insert into sustentabilidade.lancamentos (programa_id, formulario_id, formulario_versao, data, lancado_por)
           values ('${P.mercado}', '${F.produtores}', 9, '2026-11-14', '${U.gestora}')`,
        ),
      ),
    ).toMatch(/foreign key/);
    // Não se passa por lançamento do link nem por outra pessoa.
    expect(
      await como(U.lanca, () =>
        erro(
          `insert into sustentabilidade.lancamentos (programa_id, formulario_id, formulario_versao, data, origem, lancado_por)
           values ('${P.mercado}', '${F.produtores}', 1, '2026-11-14', 'link', '${U.lanca}')`,
        ),
      ),
    ).toMatch(/row-level security/);
    // Corrige e apaga só no seu programa.
    const corrige = (programa: string) =>
      `update sustentabilidade.lancamentos set data = '2026-11-15' where programa_id = '${programa}' and data = '2026-11-14'`;
    expect(await como(U.lanca, () => afetadas(corrige(P.sustentarp)))).toBe(0);
    expect(await como(U.lanca, () => afetadas(corrige(P.mercado)))).toBe(1);
  });

  it("reais do lançamento: quem lança grava, só 'Ver valores' lê", async () => {
    const id = await como(U.lanca, () =>
      valor<string>(
        `insert into sustentabilidade.lancamentos (programa_id, formulario_id, formulario_versao, data, valores, lancado_por)
         values ('${P.mercado}', '${F.atracoes}', 1, '2026-11-10', '{"tipo": "tipo_4", "tema": "Oficina de pães"}', '${U.lanca}') returning id`,
      ),
    );
    const grava = `insert into sustentabilidade.lancamento_valores (lancamento_id, valores) values ('${id}', '{"valor": 35}')`;
    expect(await como(U.painel, () => erro(grava))).toMatch(
      /row-level security/,
    );
    expect(await como(U.lanca, () => erro(grava))).toBeNull();
    const le = `lancamento_id = '${id}'`;
    expect(await como(U.lanca, () => conta("lancamento_valores", le))).toBe(0);
    expect(await como(U.gestora, () => conta("lancamento_valores", le))).toBe(
      0,
    );
    expect(
      await como(U.gestoraTudo, () => conta("lancamento_valores", le)),
    ).toBe(1);
  });

  it("apagar o programa apaga a permissão; com lançamentos, o programa não sai", async () => {
    await db.query(
      "insert into core.usuario_permissoes (usuario_id, permissao) values ($1, $2)",
      [U.exporta, codigo],
    );
    expect(
      await como(U.gestora, () =>
        erro(
          `delete from sustentabilidade.programas where id = '${P.mercado}'`,
        ),
      ),
    ).toMatch(/foreign key/);
    expect(
      await como(U.gestora, () =>
        afetadas(`delete from sustentabilidade.programas where id = '${NOVO}'`),
      ),
    ).toBe(1);
    expect(
      await valor<number>(
        `select (select count(*) from core.permissoes where codigo = '${codigo}')::int
              + (select count(*) from core.usuario_permissoes where permissao = '${codigo}')::int
              + (select count(*) from core.cargo_permissoes where permissao = '${codigo}')::int`,
      ),
    ).toBe(0);
  });
});

describe("formulários: versões e publicação", () => {
  it("versão publicada é imutável, até para a service role", async () => {
    const muda = `update sustentabilidade.formulario_versoes set resumo = 'x' where formulario_id = '${F.questionario}'`;
    const apaga = `delete from sustentabilidade.formulario_versoes where formulario_id = '${F.questionario}'`;
    for (const quem of [U.questionarioExcluir, U.gestoraTudo]) {
      expect(await como(quem, () => erro(muda))).toMatch(/permission denied/);
      expect(await como(quem, () => erro(apaga))).toMatch(/permission denied/);
      expect(
        await como(quem, () =>
          erro(
            `insert into sustentabilidade.formulario_versoes (formulario_id, versao, definicao, resumo) values ('${F.questionario}', 2, '{"secoes": []}', 'x')`,
          ),
        ),
      ).toMatch(/permission denied/);
    }
    expect(await erro(muda)).toMatch(/não pode ser alterada/);
    expect(await erro(apaga)).toMatch(/não pode ser apagada/);
    await db.comoServico(async () => {
      expect(await erro(muda)).toMatch(/não pode ser alterada/);
    });
  });

  it("uso_do_formulario conta respostas por pergunta e por opção, em todas as versões", async () => {
    const uso = async (id: string, p: string, o: string | null) =>
      como(U.questionario, () =>
        valor<number>(
          `select usos::int from sustentabilidade.uso_do_formulario('${id}')
           where pergunta_id = $1 and opcao_id is not distinct from $2`,
          [p, o],
        ),
      );
    // 23 de exemplo (uma sem resposta na 16) + a aplicada no teste (só q6 e q8).
    expect(await uso(F.questionario, "q6", null)).toBe(24);
    expect(await uso(F.questionario, "q16", null)).toBe(22);
    expect(await uso(F.questionario, "q16", "q16_sim")).toBe(2);
    expect(await uso(F.questionario, "q16", "q16_nao")).toBe(20);
    expect(await uso(F.questionario, "q25b", null)).toBe(0);
    expect(await uso(F.questionario, "q3", "q3_industrial")).toBe(0);
    // Várias opções (lista) e grade (objeto por linha).
    expect(await uso(F.questionario, "q23", "q23_rss")).toBe(4);
    expect(await uso(F.questionario, "q20", "q20_organico")).toBeGreaterThan(0);
    // Formulário de programa: lançamentos, inclusive os campos em reais.
    expect(await uso(F.tour, "participantes", null)).toBe(7);
    expect(await uso(F.tour, "receita_arp", null)).toBe(7);
    expect(await uso(F.atracoes, "tipo", "tipo_4")).toBe(
      await conta(
        "lancamentos",
        `formulario_id = '${F.atracoes}' and valores ->> 'tipo' = 'tipo_4'`,
      ),
    );
    // Quem não usa o módulo não recebe nada.
    expect(
      await como(U.fora, () =>
        valor<number>(
          `select count(*)::int from sustentabilidade.uso_do_formulario('${F.questionario}')`,
        ),
      ),
    ).toBe(0);
  });

  it("publicar recusa tirar pergunta ou opção com respostas e aceita inativar", async () => {
    expect(
      await publicar(U.questionario, F.questionario, semPergunta("q16")),
    ).toMatch(/só pode ser inativado: q16/);
    expect(
      await publicar(U.questionario, F.questionario, (d) => {
        const q3 = pergunta(d, "q3");
        q3.opcoes = q3.opcoes.filter((o) => o.id !== "q3_lojas");
      }),
    ).toMatch(/só pode ser inativado: q3 \(opção q3_lojas\)/);
    // A recusa não publica nada: continua na versão 2.
    expect(
      await valor<number>(
        `select versao_publicada from sustentabilidade.formularios where id = '${F.questionario}'`,
      ),
    ).toBe(2);
    // Inativar a pergunta e a opção: publica a versão 3.
    expect(
      await publicar(
        U.questionario,
        F.questionario,
        (d) => {
          pergunta(d, "q16").ativa = false;
          const lojas = pergunta(d, "q3").opcoes.find(
            (o) => o.id === "q3_lojas",
          );
          if (lojas) lojas.ativa = false;
        },
        "Inativa a pergunta do PGRS",
      ),
    ).toBeNull();
    const { rows } = await db.query(
      `select f.versao_publicada, f.rascunho_alterado, v.resumo, v.publicado_por::text,
              v.definicao = f.rascunho as igual
       from sustentabilidade.formularios f
       join sustentabilidade.formulario_versoes v on v.formulario_id = f.id and v.versao = 3
       where f.id = '${F.questionario}'`,
    );
    expect(rows[0]).toEqual({
      versao_publicada: 3,
      rascunho_alterado: false,
      resumo: "Inativa a pergunta do PGRS",
      publicado_por: U.questionario,
      igual: true,
    });
    // As versões 1 e 2 continuam lá, iguais; as entrevistas ficam na versão delas.
    expect(
      await conta("formulario_versoes", `formulario_id = '${F.questionario}'`),
    ).toBe(3);
    expect(
      await valor<Definicao>(
        `select definicao from sustentabilidade.formulario_versoes where formulario_id = '${F.questionario}' and versao = 1`,
      ),
    ).toEqual(questionarioV1());
    expect(await conta("entrevistas", "formulario_versao <> 1")).toBe(0);
  });

  it("publicar: tirar pergunta ou opção sem uso exige 'Formulários específicos – excluir'", async () => {
    expect(
      await publicar(U.questionario, F.questionario, semPergunta("q25b")),
    ).toMatch(/exige a permissão de excluir.*q25b/);
    expect(
      await publicar(U.questionarioExcluir, F.questionario, (d) => {
        semPergunta("q25b")(d);
        const q3 = pergunta(d, "q3");
        q3.opcoes = q3.opcoes.filter((o) => o.id !== "q3_industrial");
      }),
    ).toBeNull();
    expect(
      await valor<number>(
        `select versao_publicada from sustentabilidade.formularios where id = '${F.questionario}'`,
      ),
    ).toBe(4);
    // Com a permissão de excluir, o que tem respostas continua protegido.
    expect(
      await publicar(U.questionarioExcluir, F.questionario, semPergunta("q7")),
    ).toMatch(/só pode ser inativado: q7/);
  });

  it("publicar: permissão por tipo de formulário, resumo obrigatório e formulário novo ganha a versão 1", async () => {
    const nada = () => {};
    expect(await publicar(U.questionario, F.questionario, nada, " ")).toMatch(
      /informe o resumo/,
    );
    expect(
      await como(U.gestora, () =>
        erro(
          `select sustentabilidade.publicar_formulario('${F.questionario}', 'x')`,
        ),
      ),
    ).toMatch(/sem permissão/);
    expect(
      await como(U.questionario, () =>
        erro(`select sustentabilidade.publicar_formulario('${F.tour}', 'x')`),
      ),
    ).toMatch(/sem permissão/);
    expect(
      await como(U.fora, () =>
        erro(
          `select sustentabilidade.publicar_formulario('${F.questionario}', 'x')`,
        ),
      ),
    ).toMatch(/sem permissão/);
    // Campo com lançamentos (inclusive em reais) não sai do formulário do programa.
    expect(
      await publicar(U.gestoraTudo, F.tour, semPergunta("receita_arp")),
    ).toMatch(/só pode ser inativado: receita_arp/);
    // Formulário novo: nasce sem versão e ganha a 1 ao publicar.
    const novo = "60000000-0000-4000-8000-0000000000f1";
    const campo = (id: string) => ({
      id,
      numero: id,
      texto: id,
      ajuda: "",
      tipo: "numero",
      obrigatoria: false,
      opcoes: [],
      unidades: [],
      mostrar_se: null,
      fonte_indicador: false,
      ativa: true,
      travada: false,
      auto: null,
    });
    expect(
      await valor<number>(
        `select versao_publicada from sustentabilidade.formularios where id = '${novo}'`,
      ),
    ).toBe(0);
    expect(
      await publicar(
        U.gestora,
        novo,
        (d) => {
          d.secoes = [
            {
              id: "s1",
              nome: "Lançamento",
              ativa: true,
              perguntas: [campo("quilos"), campo("pessoas")],
            },
          ];
        },
        "Primeira versão",
      ),
    ).toBeNull();
    expect(
      await valor<number>(
        `select versao_publicada from sustentabilidade.formularios where id = '${novo}'`,
      ),
    ).toBe(1);
    // Campo usado por indicador não sai, nem sem lançamentos e com "excluir".
    await como(U.gestora, () =>
      db.query(
        `insert into sustentabilidade.programa_indicadores (programa_id, formulario_id, nome, campo_id, calculo)
         values ('60000000-0000-4000-8000-000000000001', '${novo}', 'Quilos colhidos', 'quilos', 'soma')`,
      ),
    );
    expect(await publicar(U.gestoraTudo, novo, semPergunta("quilos"))).toMatch(
      /usado por indicador.*quilos/,
    );
    expect(
      await publicar(U.gestoraTudo, novo, semPergunta("pessoas")),
    ).toBeNull();
  });
});

describe("importações", () => {
  const previa = (quem: string, substitui: string | null = null) =>
    como(quem, () =>
      valor<string>(
        `insert into sustentabilidade.importacoes (tipo, arquivo, sha256, criado_por, substitui)
         values ('produtores', '{"nome": "feira.xlsx"}', 'abc', '${quem}', ${substitui ? `'${substitui}'` : "null"}) returning id`,
      ),
    );
  const linhas = (id: string, n: number) =>
    como(U.importa, async () => {
      await db.query(
        `insert into sustentabilidade.cadastros_lista (programa_id, campo_id, valor, normalizado, importacao_id, criado_por)
         values ('${P.mercado}', 'produtor', 'Doçuras da Tia ${id.slice(0, 4)}', 'docuras da tia ${id.slice(0, 4)}', '${id}', '${U.importa}')`,
      );
      await db.query(
        `insert into sustentabilidade.lancamentos (programa_id, formulario_id, formulario_versao, data, valores, origem, importacao_id, lancado_por)
         select '${P.mercado}', '${F.produtores}', 1, date '2025-03-01' + g,
           jsonb_build_object('produtor', 'Doçuras da Tia ${id.slice(0, 4)}'), 'importacao', '${id}', '${U.importa}'
         from generate_series(1, ${n}) g`,
      );
    });
  const status = (id: string) =>
    valor<string>(
      `select status from sustentabilidade.importacoes where id = '${id}'`,
    );
  const daImportacao = (id: string) =>
    conta("lancamentos", `importacao_id = '${id}'`);

  it("só 'Importar histórico' cria a prévia e grava as linhas dela", async () => {
    expect(
      await como(U.gestora, () =>
        erro(
          `insert into sustentabilidade.importacoes (tipo, criado_por) values ('tour', '${U.gestora}')`,
        ),
      ),
    ).toMatch(/row-level security/);
    const id = await previa(U.importa);
    // Quem gerencia não grava linha "de importação"; quem importa não lança como equipe.
    expect(
      await como(U.gestora, () =>
        erro(
          `insert into sustentabilidade.lancamentos (programa_id, formulario_id, formulario_versao, data, origem, importacao_id, lancado_por)
           values ('${P.mercado}', '${F.produtores}', 1, '2025-03-01', 'importacao', '${id}', '${U.gestora}')`,
        ),
      ),
    ).toMatch(/row-level security/);
    expect(
      await como(U.importa, () =>
        erro(
          `insert into sustentabilidade.lancamentos (programa_id, formulario_id, formulario_versao, data, lancado_por)
           values ('${P.mercado}', '${F.produtores}', 1, '2025-03-01', '${U.importa}')`,
        ),
      ),
    ).toMatch(/row-level security/);
    // O status não muda à mão.
    expect(
      await como(U.importa, () =>
        erro(
          `update sustentabilidade.importacoes set status = 'confirmada' where id = '${id}'`,
        ),
      ),
    ).toMatch(/permission denied/);
    await como(U.importa, () =>
      db.query(`select sustentabilidade.desfazer_importacao('${id}')`),
    );
  });

  it("confirmar e desfazer: as linhas da importação saem e o registro fica", async () => {
    const id = await previa(U.importa);
    await linhas(id, 4);
    expect(
      await como(U.gestora, () =>
        erro(`select sustentabilidade.confirmar_importacao('${id}')`),
      ),
    ).toMatch(/sem permissão/);
    await como(U.importa, () =>
      db.query(`select sustentabilidade.confirmar_importacao('${id}')`),
    );
    expect(await status(id)).toBe("confirmada");
    expect(
      await valor<string>(
        `select confirmado_por::text from sustentabilidade.importacoes where id = '${id}'`,
      ),
    ).toBe(U.importa);
    // Depois de confirmada, não entra mais linha nela.
    expect(
      await como(U.importa, () =>
        erro(
          `insert into sustentabilidade.lancamentos (programa_id, formulario_id, formulario_versao, data, origem, importacao_id, lancado_por)
           values ('${P.mercado}', '${F.produtores}', 1, '2025-03-01', 'importacao', '${id}', '${U.importa}')`,
        ),
      ),
    ).toMatch(/row-level security/);
    expect(
      await como(U.gestora, () =>
        erro(`select sustentabilidade.desfazer_importacao('${id}')`),
      ),
    ).toMatch(/sem permissão/);
    const antes = await conta("lancamentos");
    expect(
      await como(U.importa, () =>
        valor<number>(`select sustentabilidade.desfazer_importacao('${id}')`),
      ),
    ).toBe(4);
    expect(await conta("lancamentos")).toBe(antes - 4);
    expect(await daImportacao(id)).toBe(0);
    expect(await conta("cadastros_lista", `importacao_id = '${id}'`)).toBe(0);
    expect(await status(id)).toBe("desfeita");
    expect(
      await valor<string>(
        `select desfeito_por::text from sustentabilidade.importacoes where id = '${id}'`,
      ),
    ).toBe(U.importa);
    expect(
      await como(U.importa, () =>
        erro(`select sustentabilidade.desfazer_importacao('${id}')`),
      ),
    ).toMatch(/já foi desfeita/);
  });

  it("substituir: a anterior fica 'substituida' sem as linhas; entrevistas importadas também saem ao desfazer", async () => {
    const a = await previa(U.importa);
    await linhas(a, 3);
    await como(U.importa, () =>
      db.query(`select sustentabilidade.confirmar_importacao('${a}')`),
    );
    const b = await previa(U.importa, a);
    await linhas(b, 5);
    await como(U.importa, () =>
      db.query(`select sustentabilidade.confirmar_importacao('${b}')`),
    );
    expect(await status(a)).toBe("substituida");
    expect(await daImportacao(a)).toBe(0);
    expect(await daImportacao(b)).toBe(5);

    // liberar_substituida (antes de gravar as linhas): a anterior sai já e
    // fica "substituida"; a prévia segue prévia até confirmar.
    const c = await previa(U.importa, b);
    await como(U.importa, () =>
      db.query(`select sustentabilidade.liberar_substituida('${c}')`),
    );
    expect(await status(b)).toBe("substituida");
    expect(await status(c)).toBe("previa");
    expect(await daImportacao(b)).toBe(0);
    await linhas(c, 2);
    await como(U.importa, () =>
      db.query(`select sustentabilidade.confirmar_importacao('${c}')`),
    );
    expect(await daImportacao(c)).toBe(2);

    await como(U.importa, () =>
      db.query(`select sustentabilidade.desfazer_importacao('${c}')`),
    );
    expect(await daImportacao(c)).toBe(0);
    expect(await status(a)).toBe("substituida");

    const e = await como(U.importa, () =>
      valor<string>(
        `insert into sustentabilidade.importacoes (tipo, criado_por) values ('entrevistas', '${U.importa}') returning id`,
      ),
    );
    await como(U.importa, () =>
      db.query(
        `insert into sustentabilidade.entrevistas (contrato_id, data, formulario_versao, respostas, situacao, origem, importacao_id, entrevistador_id)
         values ('c0000000-0000-4000-8000-000000000006', '2026-05-05', 1, '{"q6": "Fulana"}', 'salva', 'forms', '${e}', null)`,
      ),
    );
    expect(
      await como(U.importa, () =>
        valor<number>(`select sustentabilidade.desfazer_importacao('${e}')`),
      ),
    ).toBe(1);
    expect(await conta("entrevistas", `importacao_id = '${e}'`)).toBe(0);
  });
});

describe("histórico e metas", () => {
  it("alterações do módulo e metas sustentabilidade.* aparecem no módulo 'sustentabilidade'", async () => {
    expect(
      await valor<string>(
        "select core.modulo_da_auditoria('sustentabilidade.parametros', '{}')",
      ),
    ).toBe("sustentabilidade");
    expect(
      await valor<string>(
        `select core.modulo_da_auditoria('core.metas', '{"indicador": "sustentabilidade.volume_reciclado"}')`,
      ),
    ).toBe("sustentabilidade");
    expect(
      await valor<string>(
        `select core.modulo_da_auditoria('core.metas', '{"indicador": "rh.turnover"}')`,
      ),
    ).toBe("rh");
    expect(
      await valor<boolean>(
        `select pg_get_constraintdef(oid) like '%''sustentabilidade''%' from pg_constraint where conname = 'logs_modulo_check'`,
      ),
    ).toBe(true);
    // A mudança dos parâmetros feita acima ficou com antes e depois.
    const { rows } = await db.query(
      `select antes ->> 'aviso_dias' as antes, depois ->> 'aviso_dias' as depois, usuario_id::text as quem
       from core.auditoria where tabela = 'sustentabilidade.parametros' and acao = 'update'`,
    );
    expect(rows).toEqual([{ antes: "30", depois: "45", quem: U.parametros }]);
  });

  it("metas do painel: quem usa o módulo lê; só 'Parâmetros' grava", async () => {
    const meta =
      "insert into core.metas (indicador, direcao, meta, vigente_desde) values ('sustentabilidade.volume_reciclado', 'maior_melhor', 25000, '2026-01-01')";
    expect(await como(U.painel, () => erro(meta))).toMatch(
      /row-level security/,
    );
    expect(await como(U.parametros, () => erro(meta))).toBeNull();
    const le =
      "select count(*)::int from core.metas where indicador like 'sustentabilidade.%'";
    expect(await como(U.painel, () => valor<number>(le))).toBe(1);
    expect(await como(U.fora, () => valor<number>(le))).toBe(0);
  });
});

describe("dados de exemplo", () => {
  it("remover_exemplos: só 'Parâmetros'; zera os exemplos e poupa o que recebeu dado real", async () => {
    expect(
      await como(U.gestoraTudo, () =>
        erro("select sustentabilidade.remover_exemplos()"),
      ),
    ).toMatch(/sem permissão/);
    await como(U.parametros, () =>
      db.query("select sustentabilidade.remover_exemplos()"),
    );
    for (const t of [
      "entrevistas",
      "participantes",
      "rondas",
      "rcc_notas",
      "rcc_precos",
      "lancamentos",
      "marcos",
    ])
      expect([t, await conta(t, "exemplo")]).toEqual([t, 0]);
    // Filhas dos exemplos saem junto.
    expect(await conta("termos")).toBe(1);
    expect(await conta("contribuicoes")).toBe(1);
    expect(await conta("ronda_itens")).toBe(2);
    expect(await conta("rcc_nota_valores")).toBe(1);
    // O que foi lançado nos testes continua.
    expect(await conta("lancamentos")).toBe(3);
    expect(await conta("entrevistas")).toBe(1);
    // Turismo saiu inteiro (com a permissão dele); SustentArp e Mercado
    // Local ficaram porque receberam lançamento real.
    expect(
      await valor<string[]>(
        "select array_agg(nome order by nome) from sustentabilidade.programas where exemplo",
      ),
    ).toEqual(["Mercado Local", "SustentArp"]);
    expect(
      await valor<number>(
        `select count(*)::int from core.permissoes where codigo = 'sustentabilidade.programa.${P.turismo}'`,
      ),
    ).toBe(0);
    expect(
      await valor<number>(
        `select count(*)::int from core.permissoes where codigo = 'sustentabilidade.programa.${P.mercado}'`,
      ),
    ).toBe(1);
    // Contratos e coletores de exemplo que sobraram são os que têm dado real.
    expect(await conta("contratos", "exemplo")).toBe(
      await valor<number>(
        `select count(distinct c)::int from (
           select contrato_id as c from sustentabilidade.entrevistas
           union select de_contrato_id from sustentabilidade.entrevista_transferencias
           union select para_contrato_id from sustentabilidade.entrevista_transferencias) x`,
      ),
    );
    expect(await conta("coletores", "exemplo")).toBe(2);
    // O questionário fica enquanto houver entrevista.
    expect(await conta("formularios", "tipo = 'questionario'")).toBe(1);
    // Parâmetros e cadastros de base não são exemplo.
    expect(await conta("parametros")).toBe(1);
    expect(await conta("rcc_fatores", "vigente_desde = '2000-01-01'")).toBe(1);
  });
});
