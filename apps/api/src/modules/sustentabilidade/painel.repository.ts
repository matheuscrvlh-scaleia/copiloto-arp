import { sql } from "kysely";
import { jsonArrayFrom } from "kysely/helpers/postgres";
import type { Tx } from "@/infra/banco";

// Consultas do Painel de Sustentabilidade (spec 4.9). Tudo com a sessão: o
// RLS de "painel" lê programas, RCC, clube, rondas, contratos, marcos e
// consolidados; as tabelas com reais pedem "Ver valores".

export function indicadoresDoPainel(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.programa_indicadores")
    .select([
      "nome",
      "grupo",
      "calculo",
      "formulario_id",
      "campo_id",
      "filtro",
      "percentual_valor",
    ])
    .where("ativo", "=", true)
    .where("mostrar_painel", "=", true)
    .where("em_reais", "=", false)
    .where("grupo", "is not", null)
    .execute();
}

export function lancamentos(tx: Tx, formularios: string[], ate: string) {
  if (!formularios.length) return Promise.resolve([]);
  return tx
    .selectFrom("sustentabilidade.lancamentos")
    .select(["formulario_id", "data", "valores", "exemplo"])
    .where("formulario_id", "in", formularios)
    .where("data", "<=", ate)
    .orderBy("data")
    .orderBy("id")
    .execute();
}

export function notasDoRcc(tx: Tx, ate: string) {
  return tx
    .selectFrom("sustentabilidade.rcc_notas")
    .select(["competencia", "cacambas_a", "cacambas_b", "exemplo"])
    .where("competencia", "<=", ate)
    .orderBy("competencia")
    .orderBy("id")
    .execute();
}

export function fatoresDoRcc(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.rcc_fatores")
    .select(["vigente_desde", "toneladas_por_cacamba"])
    .execute();
}

export function fatoresDeCo2(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.co2_fatores")
    .select(["vigente_desde", "kg_por_kwh"])
    .execute();
}

export function precosDoRcc(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.rcc_precos")
    .select(["vigente_desde", "preco_a", "preco_b"])
    .execute();
}

export function participantes(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.participantes")
    .select(["id", "cliente_doc", "locatario_manual", "saiu_em", "exemplo"])
    .orderBy("id")
    .execute();
}

export function termos(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.termos")
    .select(["participante_id", "assinado_em", "valido_ate"])
    .orderBy("id")
    .execute();
}

export function contratos(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.contratos")
    .select([
      "id",
      "situacao",
      "rescisao",
      "tipo_loja",
      "cliente_doc",
      "ativacao",
      "ativacao_corrigida",
      "inicio",
      "dispensada_motivo",
      "validade_meses_especifica",
      "exemplo",
    ])
    .orderBy("id")
    .execute();
}

/** Dados de controle das entrevistas salvas, sem respostas. */
export async function entrevistasResumo(tx: Tx) {
  const r = await sql<{
    contrato_id: string | null;
    data: string;
    setor: string | null;
  }>`select contrato_id, data, setor from sustentabilidade.entrevistas_resumo() order by id`.execute(
    tx,
  );
  return r.rows;
}

export function rondasDoMes(tx: Tx, inicio: string, fim: string) {
  return tx
    .selectFrom("sustentabilidade.rondas as r")
    .select((eb) => [
      "r.exemplo",
      jsonArrayFrom(
        eb
          .selectFrom("sustentabilidade.ronda_itens as i")
          .select(["i.coletor_id", "i.conteineres", "i.ocupacao_pct"])
          .whereRef("i.ronda_id", "=", "r.id"),
      ).as("ronda_itens"),
    ])
    .where("r.data_hora", ">=", inicio)
    .where("r.data_hora", "<", fim)
    .execute();
}

export function marcosAte(tx: Tx, ano: number) {
  return tx
    .selectFrom("sustentabilidade.marcos")
    .select(["indicador", "ano", "valor", "exemplo"])
    .where("ano", "<=", ano)
    .execute();
}

export function consolidados(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.consolidados")
    .select(["ano", "situacao", "totais", "fechado_em", "reaberto_motivo"])
    .execute();
}

export function consolidadoValores(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.consolidado_valores")
    .select(["ano", "totais"])
    .execute();
}

export function equivalenciasConfirmadas(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.equivalencias")
    .select(["nome", "fator", "unidade", "confirmado"])
    .where("confirmado", "=", true)
    .orderBy("nome")
    .execute();
}

export function metas(tx: Tx) {
  return tx
    .selectFrom("core.metas")
    .select(["indicador", "direcao", "meta", "limite_atencao", "vigente_desde"])
    .where("indicador", "like", "sustentabilidade.%")
    .execute();
}

// ---------------------------------------------------------- fechar e reabrir

export async function situacaoDoAno(
  tx: Tx,
  ano: number,
): Promise<string | null> {
  const r = await tx
    .selectFrom("sustentabilidade.consolidados")
    .select("situacao")
    .where("ano", "=", ano)
    .executeTakeFirst();
  return r?.situacao ?? null;
}

export async function fecharDeNovo(
  tx: Tx,
  ano: number,
  totais: unknown,
  usuarioId: string,
): Promise<boolean> {
  const r = await tx
    .updateTable("sustentabilidade.consolidados")
    .set({
      totais: JSON.stringify(totais),
      situacao: "fechado",
      fechado_por: usuarioId,
      fechado_em: sql`now()`,
      reaberto_por: null,
      reaberto_em: null,
      reaberto_motivo: null,
    })
    .where("ano", "=", ano)
    .executeTakeFirst();
  return r.numUpdatedRows > 0n;
}

export async function fechar(
  tx: Tx,
  ano: number,
  totais: unknown,
  usuarioId: string,
): Promise<boolean> {
  const r = await tx
    .insertInto("sustentabilidade.consolidados")
    .values({ ano, totais: JSON.stringify(totais), fechado_por: usuarioId })
    .returning("ano")
    .executeTakeFirst();
  return Boolean(r);
}

export async function gravarTotaisEmReais(
  tx: Tx,
  ano: number,
  totais: unknown,
) {
  await tx
    .insertInto("sustentabilidade.consolidado_valores")
    .values({ ano, totais: JSON.stringify(totais) })
    .onConflict((oc) =>
      oc.column("ano").doUpdateSet({ totais: JSON.stringify(totais) }),
    )
    .execute();
}

export async function reabrir(
  tx: Tx,
  ano: number,
  motivo: string,
  usuarioId: string,
): Promise<boolean> {
  const r = await tx
    .updateTable("sustentabilidade.consolidados")
    .set({
      situacao: "reaberto",
      reaberto_por: usuarioId,
      reaberto_em: sql`now()`,
      reaberto_motivo: motivo,
    })
    .where("ano", "=", ano)
    .where("situacao", "=", "fechado")
    .executeTakeFirst();
  return r.numUpdatedRows > 0n;
}
