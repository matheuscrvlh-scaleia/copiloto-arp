// RLS do schema rh (20261026170000_rh_desempenho_rls e as seguintes). O teste
// antigo subia dois bancos (antes e depois da migration) e conferia que cada
// perfil lia, alterava, apagava e incluía o mesmo nos dois. No banco novo não
// há "antes": o oráculo virou rh-rls-alcance.json, o alcance de cada perfil
// medido no banco antigo com as 101 migrations do Supabase (mesmo cenário,
// rh-rls-cenario.ts). Diferença aqui é o RLS do banco novo divergindo do
// sistema antigo.
//
// As regras do rh não dependem da linha (só da permissão), então a contagem
// de linhas de cada tabela com dados já diz quais linhas a pessoa alcança.

import {
  type DiaDoPonto,
  type DiasSomados,
  linhaDosDias,
  somarDias,
} from "@arp/shared/rh/ponto-periodo";
import { beforeAll, describe, expect, it } from "vitest";
import { abrirBanco, type BancoDeTeste } from "../apoio";
import ANTIGO from "./rh-rls-alcance.json";
import {
  alcance,
  C,
  comoResultado,
  NOMES,
  type NomePerfil,
  prepararCenario,
  SOCIOS,
  TABELAS,
  U,
} from "./rh-rls-cenario";

const ESPERADO = ANTIGO as Record<
  NomePerfil,
  { alcance: Record<string, string>; socios: string[] }
>;

let db: BancoDeTeste;

/** Sinal para desfazer o escopo levando o resultado. */
class Desfeito {
  constructor(readonly valor: string) {}
}

/** Roda como a pessoa e desfaz (o escopo inteiro volta). */
async function tentar(usuario: string, sql: string): Promise<string> {
  try {
    await db.comoUsuario(usuario, async () => {
      let r: string;
      try {
        r = comoResultado(await db.query(sql));
      } catch (e) {
        r = comoResultado(e as Error);
      }
      throw new Desfeito(r);
    });
  } catch (e) {
    if (e instanceof Desfeito) return e.valor;
    throw e;
  }
  throw new Error("inalcançável");
}

const socios = (u: NomePerfil) =>
  db.comoUsuario(U[u], async () =>
    (await db.query<{ id: string }>(SOCIOS)).rows.map((r) => r.id),
  );

beforeAll(async () => {
  db = await abrirBanco();
  await prepararCenario(db, (id, email) => db.criarUsuario(id, email));
}, 120_000);

describe("rh: o mesmo alcance do sistema antigo", { timeout: 120_000 }, () => {
  it.each(NOMES)("%s lê, altera, apaga e inclui o mesmo", async (u) => {
    expect(await alcance(tentar, u)).toEqual(ESPERADO[u].alcance);
  });

  it("os dados dos testes alcançam as regras (nem tudo barrado, nem tudo liberado)", async () => {
    const tudo = await alcance(tentar, "tudo");
    const nada = await alcance(tentar, "semNada");
    expect(tudo["rh.folha_rubricas select"]).toBe("ok:3");
    expect(tudo["rh.colaboradores update"]).toBe("ok:7");
    expect(nada["rh.colaboradores select"]).toBe("ok:0");
    expect(nada["rh.colaboradores insert"]).toBe("barrado pelo RLS");
    // rh.folha lê a folha pela política de edição, sem o custo individual.
    const folha = await alcance(tentar, "folha");
    expect(folha["rh.folha_colaboradores select"]).toBe("ok:4");
    expect(folha["rh.custos_colaborador select"]).toBe("ok:0");
  });
});

describe("rh.socios(): conjuntos no lugar das subconsultas por pessoa", () => {
  it.each(NOMES)("%s recebe os mesmos ids", async (u) => {
    expect(await socios(u)).toEqual(ESPERADO[u].socios);
  });

  it("cadastro, folha e rubrica de pró-labore; sem módulo, nada", async () => {
    expect(await socios("painel")).toEqual(
      [C.socioCadastro, C.socioFolha, C.socioRubrica].sort(),
    );
    expect(await socios("semModulo")).toEqual([]);
    expect(await socios("inativo")).toEqual([]);
  });
});

describe("rh.ponto_dos_dias(): a soma de somarDias, feita no banco", () => {
  const somadoNoBanco = (u: NomePerfil, de: string, ate: string) =>
    db.comoUsuario(
      U[u],
      async () =>
        (
          await db.query<DiasSomados>(
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
    db.comoUsuario(U[u], async () => {
      const { rows } = await db.query<{
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
    db.comoUsuario(U.tudo, async () =>
      (await db.query<{ "QUERY PLAN": string }>(`explain ${sql}`)).rows
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

  it("nenhuma política do rh chama core.pode por linha", async () => {
    const { rows } = await db.query<{
      t: string;
      nome: string;
      expr: string;
    }>(
      `select schemaname || '.' || tablename as t, policyname as nome,
              coalesce(qual, '') || ' ' || coalesce(with_check, '') as expr
       from pg_policies where schemaname = 'rh'`,
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
    const { rows } = await db.query<{ fk: string }>(
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
    // O teste antigo parava na 20261026170000. As FKs abaixo vieram depois
    // (banco de horas, benefício rateado, orçamento) e já estavam sem índice
    // no banco antigo com as 101 migrations: pendência de desempenho, não de
    // RLS. Nova FK sem índice no rh faz este teste falhar.
    expect(rows.map((r) => r.fk).sort()).toEqual([
      "rh.banco_horas_ciclos.banco_horas_ciclos_criado_por_fkey",
      "rh.banco_horas_ciclos.banco_horas_ciclos_finalizado_por_fkey",
      "rh.banco_horas_fechamentos.banco_horas_fechamentos_colaborador_id_fkey",
      "rh.beneficios.beneficios_dividir_departamento_id_fkey",
      "rh.gastos.gastos_criado_por_fkey",
      "rh.orcamentos_anuais.orcamentos_anuais_finalizado_por_fkey",
    ]);
  });
});
