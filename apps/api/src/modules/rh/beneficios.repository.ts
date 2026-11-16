import { sql } from "kysely";
import { jsonArrayFrom } from "kysely/helpers/postgres";
import type { Tx } from "@/infra/banco";

// Benefícios, vínculos por funcionário e tabelas do plano (beneficios.ts,
// dependentes.ts e acoes/cadastros.ts do antigo). Com a sessão: o RLS
// decide (rh.beneficios); a folha individual só pela service role, depois
// de conferir a permissão.

/** Todos os vínculos pela pessoa, inclusive os encerrados. */
export function vinculos(tx: Tx) {
  return tx
    .selectFrom("rh.colaborador_beneficios as v")
    .leftJoin("rh.colaboradores as c", "c.id", "v.colaborador_id")
    .select([
      "v.id",
      "v.beneficio_id",
      "v.colaborador_id",
      "v.desde",
      "v.ate",
      "v.valor_manual",
      "c.nome",
      "c.matricula",
      "c.nascimento",
    ])
    .orderBy("v.desde", "desc")
    .orderBy("v.id")
    .execute();
}

/** Benefícios dados a todo um tipo de contrato. */
export function contratos(tx: Tx) {
  return tx
    .selectFrom("rh.beneficio_contratos")
    .select(["id", "beneficio_id", "tipo_contrato", "desde", "ate"])
    .orderBy("desde", "desc")
    .orderBy("id")
    .execute();
}

/** Quem pode receber benefício: cadastro ainda sem desligamento. */
export function colaboradoresAtivos(tx: Tx) {
  return tx
    .selectFrom("rh.colaboradores")
    .select([
      "id",
      "nome",
      "matricula",
      "tipo_contrato",
      "admissao",
      "departamento_id",
    ])
    .where("desligamento", "is", null)
    .orderBy("nome")
    .orderBy("id")
    .execute();
}

/** Tabelas do plano (faixas e quantas regras de coparticipação), da mais nova. */
export function tabelasDoPlano(tx: Tx) {
  return tx
    .selectFrom("rh.plano_tabelas as t")
    .leftJoin("rh.beneficios as b", "b.id", "t.beneficio_id")
    .select((eb) => [
      "t.id",
      "t.beneficio_id",
      "b.nome as beneficio",
      "t.vigente_desde",
      "t.reajuste_pct",
      jsonArrayFrom(
        eb
          .selectFrom("rh.plano_faixas_etarias as f")
          .select(["f.idade_min", "f.idade_max", "f.mensalidade"])
          .whereRef("f.tabela_id", "=", "t.id")
          .orderBy("f.idade_min"),
      ).as("faixas"),
      eb
        .selectFrom("rh.plano_coparticipacao as p")
        .select((e) => e.fn.countAll<number>().as("n"))
        .whereRef("p.tabela_id", "=", "t.id")
        .as("regras"),
    ])
    .orderBy("t.vigente_desde", "desc")
    .orderBy("t.id")
    .execute();
}

export function valoresMensais(tx: Tx) {
  return tx
    .selectFrom("rh.beneficio_valores_mensais")
    .select(["beneficio_id", "colaborador_id", "competencia", "valor"])
    .orderBy("id")
    .execute();
}

export function totaisMensais(tx: Tx) {
  return tx
    .selectFrom("rh.beneficio_totais_mensais")
    .select(["beneficio_id", "competencia", "valor"])
    .orderBy("id")
    .execute();
}

/** Dependentes vindos do Copiloto RH, com o titular. */
export function dependentes(tx: Tx) {
  return tx
    .selectFrom("rh.dependentes as d")
    .leftJoin("rh.colaboradores as c", "c.id", "d.colaborador_id")
    .select([
      "d.colaborador_id",
      "d.nome",
      "d.nascimento",
      "d.parentesco",
      "d.tem_plano",
      "d.tem_odonto",
      "c.nome as titular",
      "c.tipo_contrato",
    ])
    .orderBy("d.nome")
    .execute();
}

// ---------------------------------------------------------------------------
// Gravações
// ---------------------------------------------------------------------------

export interface CamposDoBeneficio {
  nome: string;
  tipo:
    | "plano_saude"
    | "odonto"
    | "alimentacao"
    | "transporte"
    | "seguro"
    | "outro";
  valor_padrao: number | null;
  valor_por_mes: boolean;
  rubricas_desconto: number[];
  rubricas_desconto_dependente: number[];
  dependente_regra: "nao_paga" | "percentual" | "valor_fixo";
  dependente_valor: number | null;
  ativo: boolean;
  forma_calculo: "por_funcionario" | "rateado";
  dividir_entre: string | null;
  dividir_departamento_id: string | null;
}

export function atualizarBeneficio(tx: Tx, id: string, b: CamposDoBeneficio) {
  return tx.updateTable("rh.beneficios").set(b).where("id", "=", id).execute();
}

export function criarBeneficio(tx: Tx, b: CamposDoBeneficio) {
  return tx
    .insertInto("rh.beneficios")
    .values(b)
    .returning("id")
    .executeTakeFirstOrThrow();
}

export function beneficio(tx: Tx, id: string) {
  return tx
    .selectFrom("rh.beneficios")
    .select([
      "id",
      "nome",
      "tipo",
      "valor_por_mes",
      "forma_calculo",
      "rubricas_desconto",
    ])
    .where("id", "=", id)
    .executeTakeFirst();
}

/** Vínculo em aberto da pessoa no benefício (sem data de fim). */
export async function temVinculoAberto(
  tx: Tx,
  beneficioId: string,
  colaboradorId: string,
): Promise<boolean> {
  const l = await tx
    .selectFrom("rh.colaborador_beneficios")
    .select("id")
    .where("beneficio_id", "=", beneficioId)
    .where("colaborador_id", "=", colaboradorId)
    .where("ate", "is", null)
    .executeTakeFirst();
  return !!l;
}

export async function temContratoAberto(
  tx: Tx,
  beneficioId: string,
  tipo: "clt" | "aprendiz" | "estagiario" | "pj",
): Promise<boolean> {
  const l = await tx
    .selectFrom("rh.beneficio_contratos")
    .select("id")
    .where("beneficio_id", "=", beneficioId)
    .where("tipo_contrato", "=", tipo)
    .where("ate", "is", null)
    .executeTakeFirst();
  return !!l;
}

export function vincular(
  tx: Tx,
  linhas: {
    beneficio_id: string;
    colaborador_id: string;
    desde: string;
    valor_manual?: number | null;
  }[],
) {
  if (!linhas.length) return Promise.resolve([]);
  return tx.insertInto("rh.colaborador_beneficios").values(linhas).execute();
}

export function vincularContrato(
  tx: Tx,
  v: {
    beneficio_id: string;
    tipo_contrato: "clt" | "aprendiz" | "estagiario" | "pj";
    desde: string;
  },
) {
  return tx.insertInto("rh.beneficio_contratos").values(v).execute();
}

export function removerContrato(tx: Tx, id: string) {
  return tx.deleteFrom("rh.beneficio_contratos").where("id", "=", id).execute();
}

export function removerVinculo(tx: Tx, id: string) {
  return tx
    .deleteFrom("rh.colaborador_beneficios")
    .where("id", "=", id)
    .execute();
}

export function salvarValorManual(tx: Tx, id: string, valor: number | null) {
  return tx
    .updateTable("rh.colaborador_beneficios")
    .set({ valor_manual: valor })
    .where("id", "=", id)
    .execute();
}

/** Quem já recebe o benefício (vínculo em aberto). */
export async function quemJaRecebe(
  tx: Tx,
  beneficioId: string,
): Promise<string[]> {
  const ls = await tx
    .selectFrom("rh.colaborador_beneficios")
    .select("colaborador_id")
    .where("beneficio_id", "=", beneficioId)
    .where("ate", "is", null)
    .orderBy("id")
    .execute();
  return ls.map((l) => l.colaborador_id);
}

/** A última folha importada (service role: a folha individual tem RLS). */
export function ultimaFolha(tx: Tx) {
  return tx
    .selectFrom("rh.folhas")
    .select(["id", "competencia"])
    .orderBy("competencia", "desc")
    .limit(1)
    .executeTakeFirst();
}

/** Quem tem alguma das rubricas na folha (só a pessoa, nunca o valor). */
export async function comRubricas(
  tx: Tx,
  folhaId: string,
  codigos: number[],
): Promise<string[]> {
  if (!codigos.length) return [];
  const ls = await tx
    .selectFrom("rh.folha_rubricas")
    .select("colaborador_id")
    .where("folha_id", "=", folhaId)
    .where("rubrica_codigo", "in", codigos)
    .orderBy("id")
    .execute();
  return ls.map((l) => l.colaborador_id);
}

/** Vínculos pela pessoa que valem em algum dia da competência. */
export function pessoaisNoMes(
  tx: Tx,
  beneficioId: string,
  competencia: string,
  fim: string,
) {
  return tx
    .selectFrom("rh.colaborador_beneficios as v")
    .leftJoin("rh.colaboradores as c", "c.id", "v.colaborador_id")
    .select(["v.colaborador_id", "c.nome"])
    .where("v.beneficio_id", "=", beneficioId)
    .where("v.desde", "<=", fim)
    .where((eb) =>
      eb.or([eb("v.ate", "is", null), eb("v.ate", ">=", competencia)]),
    )
    .orderBy("v.id")
    .execute();
}

export async function contratosNoMes(
  tx: Tx,
  beneficioId: string,
  competencia: string,
  fim: string,
) {
  const ls = await tx
    .selectFrom("rh.beneficio_contratos")
    .select("tipo_contrato")
    .where("beneficio_id", "=", beneficioId)
    .where("desde", "<=", fim)
    .where((eb) => eb.or([eb("ate", "is", null), eb("ate", ">=", competencia)]))
    .execute();
  return [...new Set(ls.map((l) => l.tipo_contrato))];
}

export function colaboradoresDosContratos(
  tx: Tx,
  tipos: ("clt" | "aprendiz" | "estagiario" | "pj" | "pro_labore")[],
) {
  if (!tipos.length) return Promise.resolve([]);
  return tx
    .selectFrom("rh.colaboradores")
    .select(["id", "nome", "admissao", "desligamento"])
    .where("tipo_contrato", "in", tipos)
    .orderBy("id")
    .execute();
}

export async function gravarValores(
  tx: Tx,
  linhas: {
    beneficio_id: string;
    colaborador_id: string;
    competencia: string;
    valor: number;
  }[],
): Promise<void> {
  if (!linhas.length) return;
  await tx
    .insertInto("rh.beneficio_valores_mensais")
    .values(linhas)
    .onConflict((oc) =>
      oc
        .columns(["beneficio_id", "colaborador_id", "competencia"])
        .doUpdateSet({ valor: sql`excluded.valor` }),
    )
    .execute();
}

export async function apagarValores(
  tx: Tx,
  beneficioId: string,
  competencia: string,
  colaboradores: string[],
): Promise<void> {
  if (!colaboradores.length) return;
  await tx
    .deleteFrom("rh.beneficio_valores_mensais")
    .where("beneficio_id", "=", beneficioId)
    .where("competencia", "=", competencia)
    .where("colaborador_id", "in", colaboradores)
    .execute();
}

export async function gravarTotal(
  tx: Tx,
  beneficioId: string,
  competencia: string,
  valor: number | null,
): Promise<void> {
  if (valor === null) {
    await tx
      .deleteFrom("rh.beneficio_totais_mensais")
      .where("beneficio_id", "=", beneficioId)
      .where("competencia", "=", competencia)
      .execute();
    return;
  }
  await tx
    .insertInto("rh.beneficio_totais_mensais")
    .values({ beneficio_id: beneficioId, competencia, valor })
    .onConflict((oc) =>
      oc.columns(["beneficio_id", "competencia"]).doUpdateSet({ valor }),
    )
    .execute();
}
