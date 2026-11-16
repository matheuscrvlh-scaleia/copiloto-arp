import { sql } from "kysely";
import { jsonArrayFrom } from "kysely/helpers/postgres";
import type { Tx } from "@/infra/banco";

// Consultas do cálculo do custo de uma competência (custo.ts do antigo).
// Rodam na service role (o cálculo vale para todos, sem RLS): quem chama
// confere a permissão antes. Sem o corte de mil linhas do PostgREST.

export function folhaDaCompetencia(tx: Tx, competencia: string) {
  return tx
    .selectFrom("rh.folhas")
    .select(["id", "status"])
    .where("competencia", "=", competencia)
    .executeTakeFirst();
}

export function gruposDasRubricas(tx: Tx) {
  return tx
    .selectFrom("rh.rubricas")
    .select(["codigo", "grupo"])
    .orderBy("codigo")
    .execute();
}

export function pessoasDaFolha(tx: Tx, folhaId: string) {
  return tx
    .selectFrom("rh.folha_colaboradores")
    .select([
      "colaborador_id",
      "tipo_contrato",
      "departamento_id",
      "cargo_id",
      "horas_mes_min",
      "salario",
      "valor_fgts",
      "situacao",
    ])
    .where("folha_id", "=", folhaId)
    .orderBy("colaborador_id")
    .execute();
}

export function rubricasDaFolha(tx: Tx, folhaId: string) {
  return tx
    .selectFrom("rh.folha_rubricas as f")
    .leftJoin("rh.rubricas as r", "r.codigo", "f.rubrica_codigo")
    .select([
      "f.colaborador_id",
      "f.rubrica_codigo",
      "f.natureza",
      "f.valor",
      "r.descricao",
    ])
    .where("f.folha_id", "=", folhaId)
    .orderBy("f.id")
    .execute();
}

export function cadastro(tx: Tx) {
  return tx
    .selectFrom("rh.colaboradores")
    .select([
      "id",
      "tipo_contrato",
      "departamento_id",
      "cargo_id",
      "admissao",
      "desligamento",
      "nascimento",
    ])
    .orderBy("id")
    .execute();
}

/**
 * Sócios (a regra de rh.socios(), que a service role não roda por não ter
 * usuário): contrato de pró-labore no Copiloto ou em alguma folha, ou
 * rubrica de pró-labore em alguma folha.
 */
export async function socios(tx: Tx): Promise<Set<string>> {
  const r = await sql<{ id: string }>`
    select id from rh.colaboradores where tipo_contrato = 'pro_labore'
    union
    select colaborador_id from rh.folha_colaboradores where tipo_contrato = 'pro_labore'
    union
    select fr.colaborador_id
    from rh.folha_rubricas fr
    join rh.rubricas r on r.codigo = fr.rubrica_codigo
    where r.grupo = 'pro_labore'
  `.execute(tx);
  return new Set(r.rows.map((l) => l.id));
}

export function encargos(tx: Tx) {
  return tx
    .selectFrom("rh.encargos_por_contrato")
    .select([
      "tipo_contrato",
      "vigente_desde",
      "inss_patronal_pct",
      "terceiros_pct",
      "fgts_pct",
      "aplica_rat",
      "provisiona_13",
      "provisiona_ferias",
      "provisiona_recesso",
      "multa_rescisoria_pct",
    ])
    .execute();
}

export function empresa(tx: Tx) {
  return tx
    .selectFrom("rh.parametros_empresa")
    .select(["vigente_desde", "rat_pct", "fap"])
    .execute();
}

export function jornadas(tx: Tx) {
  return tx
    .selectFrom("rh.jornadas")
    .select([
      "departamento_id",
      "cargo_id",
      "colaborador_id",
      "horas_mes_min",
      "vigente_desde",
    ])
    .orderBy("id")
    .execute();
}

const COLUNAS_DO_BENEFICIO = [
  "b.id",
  "b.nome",
  "b.tipo",
  "b.valor_padrao",
  "b.valor_por_mes",
  "b.rubricas_desconto",
  "b.rubricas_desconto_dependente",
  "b.dependente_regra",
  "b.dependente_valor",
  "b.ativo",
  "b.forma_calculo",
] as const;

/** Vínculos pela pessoa que valem em algum dia da competência. */
export function vinculos(tx: Tx, competencia: string, fim: string) {
  return tx
    .selectFrom("rh.colaborador_beneficios as v")
    .innerJoin("rh.beneficios as b", "b.id", "v.beneficio_id")
    .leftJoin("rh.colaboradores as c", "c.id", "v.colaborador_id")
    .select([
      "v.colaborador_id",
      "v.valor_manual",
      "c.nascimento",
      ...COLUNAS_DO_BENEFICIO,
    ])
    .where("v.desde", "<=", fim)
    .where((eb) =>
      eb.or([eb("v.ate", "is", null), eb("v.ate", ">=", competencia)]),
    )
    .orderBy("v.id")
    .execute();
}

/** Benefícios dados a todo um tipo de contrato, que valem na competência. */
export function porContrato(tx: Tx, competencia: string, fim: string) {
  return tx
    .selectFrom("rh.beneficio_contratos as v")
    .innerJoin("rh.beneficios as b", "b.id", "v.beneficio_id")
    .select(["v.tipo_contrato", ...COLUNAS_DO_BENEFICIO])
    .where("v.desde", "<=", fim)
    .where((eb) =>
      eb.or([eb("v.ate", "is", null), eb("v.ate", ">=", competencia)]),
    )
    .orderBy("v.id")
    .execute();
}

/** Tabelas do plano até a competência, com as faixas. */
export function tabelasDoPlano(tx: Tx, competencia: string) {
  return tx
    .selectFrom("rh.plano_tabelas as t")
    .select((eb) => [
      "t.beneficio_id",
      "t.vigente_desde",
      jsonArrayFrom(
        eb
          .selectFrom("rh.plano_faixas_etarias as f")
          .select(["f.idade_min", "f.idade_max", "f.mensalidade"])
          .whereRef("f.tabela_id", "=", "t.id"),
      ).as("faixas"),
    ])
    .where("t.vigente_desde", "<=", competencia)
    .orderBy("t.id")
    .execute();
}

export function dependentes(tx: Tx) {
  return tx
    .selectFrom("rh.dependentes")
    .select(["colaborador_id", "nascimento", "tem_plano", "tem_odonto"])
    .orderBy("id")
    .execute();
}

export function valoresPj(tx: Tx) {
  return tx
    .selectFrom("rh.valores_pj")
    .select(["colaborador_id", "valor"])
    .orderBy("colaborador_id")
    .execute();
}

/** Valores por mês até a competência (repete o último lançado). */
export function lancados(tx: Tx, competencia: string) {
  return tx
    .selectFrom("rh.beneficio_valores_mensais")
    .select(["beneficio_id", "colaborador_id", "competencia", "valor"])
    .where("competencia", "<=", competencia)
    .orderBy("id")
    .execute();
}

/** Rateados ativos: não têm vínculo; o total do mês é dividido no custo. */
export function rateados(tx: Tx) {
  return tx
    .selectFrom("rh.beneficios")
    .select([
      "id",
      "nome",
      "valor_padrao",
      "valor_por_mes",
      "rubricas_desconto",
      "rubricas_desconto_dependente",
      "dividir_entre",
      "dividir_departamento_id",
    ])
    .where("forma_calculo", "=", "rateado")
    .where("ativo", "=", true)
    .orderBy("id")
    .execute();
}

export function totais(tx: Tx, competencia: string) {
  return tx
    .selectFrom("rh.beneficio_totais_mensais")
    .select(["beneficio_id", "competencia", "valor"])
    .where("competencia", "<=", competencia)
    .orderBy("id")
    .execute();
}

/** Competências com folha que não está fechada (a partir de `desde`). */
export function competenciasEmAberto(tx: Tx, desde?: string) {
  let q = tx
    .selectFrom("rh.folhas")
    .select("competencia")
    .where("status", "<>", "fechada");
  if (desde) q = q.where("competencia", ">=", desde);
  return q.orderBy("competencia").execute();
}

/** rh.gravar_custos: troca o custo do mês (recusa folha fechada). */
export async function gravarCustos(
  tx: Tx,
  competencia: string,
  linhas: unknown[],
): Promise<void> {
  await sql`select rh.gravar_custos(${competencia}::date, ${JSON.stringify(linhas)}::jsonb)`.execute(
    tx,
  );
}
