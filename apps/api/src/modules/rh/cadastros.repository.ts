import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Gravações de Configurações › Cadastros e › Parâmetros, com a sessão: o RLS
// confere rh.parametros e cada alteração cai em core.auditoria.

export function salvarDepartamento(
  tx: Tx,
  id: string,
  d: { nome: string; codigo_folha: number | null },
) {
  return tx
    .updateTable("rh.departamentos")
    .set(d)
    .where("id", "=", id)
    .execute();
}

/** Troca o grupo; devolve quantas rubricas mudaram (0: não achou). */
export async function trocarGrupo(
  tx: Tx,
  codigo: number,
  grupo: string,
  usuarioId: string,
): Promise<number> {
  const r = await tx
    .updateTable("rh.rubricas")
    .set({
      grupo: sql`${grupo}::rh.grupo_rubrica`,
      classificada_por: usuarioId,
      classificada_em: sql`now()`,
    })
    .where("codigo", "=", codigo)
    .executeTakeFirst();
  return Number(r.numUpdatedRows);
}

export function salvarFinanceiro(
  tx: Tx,
  f: {
    competencia: string;
    faturamento_bruto: number | null;
    custo_despesa_total: number | null;
    custos_operacionais_sem_pessoal: number | null;
    lucro: number | null;
  },
) {
  return tx
    .insertInto("rh.dados_financeiros_mensais")
    .values({ ...f, origem: "manual" })
    .onConflict((oc) =>
      oc.column("competencia").doUpdateSet({
        faturamento_bruto: f.faturamento_bruto,
        custo_despesa_total: f.custo_despesa_total,
        custos_operacionais_sem_pessoal: f.custos_operacionais_sem_pessoal,
        lucro: f.lucro,
        origem: "manual",
      }),
    )
    .execute();
}

// ---------------------------------------------------------------------------
// Parâmetros
// ---------------------------------------------------------------------------

interface Alvo {
  departamento_id: string | null;
  cargo_id: string | null;
  colaborador_id: string | null;
}

/** A jornada do alvo a partir do mês (a chave tem NULLS NOT DISTINCT). */
export function salvarJornada(
  tx: Tx,
  alvo: Alvo,
  horasMesMin: number,
  vigenteDesde: string,
) {
  return tx
    .insertInto("rh.jornadas")
    .values({
      ...alvo,
      horas_mes_min: horasMesMin,
      vigente_desde: vigenteDesde,
    })
    .onConflict((oc) =>
      oc
        .columns([
          "departamento_id",
          "cargo_id",
          "colaborador_id",
          "vigente_desde",
        ])
        .doUpdateSet({ horas_mes_min: horasMesMin }),
    )
    .execute();
}

/** Tira a jornada de um nível (todas as vigências). */
export function removerJornada(tx: Tx, alvo: Alvo) {
  let q = tx.deleteFrom("rh.jornadas");
  q = alvo.departamento_id
    ? q.where("departamento_id", "=", alvo.departamento_id)
    : q.where("departamento_id", "is", null);
  q = alvo.cargo_id
    ? q.where("cargo_id", "=", alvo.cargo_id)
    : q.where("cargo_id", "is", null);
  q = alvo.colaborador_id
    ? q.where("colaborador_id", "=", alvo.colaborador_id)
    : q.where("colaborador_id", "is", null);
  return q.execute();
}

export function salvarMeta(
  tx: Tx,
  m: {
    indicador: string;
    direcao: "maior_melhor" | "menor_melhor";
    meta: number;
    limite_atencao: number | null;
    vigente_desde: string;
  },
) {
  return tx
    .insertInto("core.metas")
    .values(m)
    .onConflict((oc) =>
      oc.columns(["indicador", "vigente_desde"]).doUpdateSet({
        direcao: m.direcao,
        meta: m.meta,
        limite_atencao: m.limite_atencao,
      }),
    )
    .execute();
}

export function salvarEmpresa(
  tx: Tx,
  e: {
    vigente_desde: string;
    regime_tributario: string | null;
    rat_pct: number;
    fap: number;
    banco_horas_inicio: string;
    banco_horas_fim: string;
    banco_horas_adicional_pct: number;
  },
) {
  const { vigente_desde: _, ...valores } = e;
  return tx
    .insertInto("rh.parametros_empresa")
    .values(e)
    .onConflict((oc) => oc.column("vigente_desde").doUpdateSet(valores))
    .execute();
}

export function salvarEncargos(
  tx: Tx,
  e: {
    tipo_contrato: "clt" | "aprendiz" | "estagiario" | "pj";
    vigente_desde: string;
    inss_patronal_pct: number;
    terceiros_pct: number;
    fgts_pct: number;
    multa_rescisoria_pct: number;
    aplica_rat: boolean;
    provisiona_13: boolean;
    provisiona_ferias: boolean;
    provisiona_recesso: boolean;
  },
) {
  const { tipo_contrato: _t, vigente_desde: _v, ...valores } = e;
  return tx
    .insertInto("rh.encargos_por_contrato")
    .values(e)
    .onConflict((oc) =>
      oc.columns(["tipo_contrato", "vigente_desde"]).doUpdateSet(valores),
    )
    .execute();
}
