import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Consultas do Diário de Obra (cópia da API do aplicativo) usadas pelo
// Painel. Com a sessão (RLS: operacoes.obras.diario). A parte B (telas do
// Diário) completa este arquivo.

/** Todas as obras do aplicativo (poucas: lidas inteiras). */
export function obras(tx: Tx) {
  return tx
    .selectFrom("operacoes.diario_obras")
    .select([
      "id",
      "nome",
      "status_id",
      "grupo",
      "responsavel",
      "data_inicio",
      "data_fim",
      "prazo_contratual",
      "prazo_decorrido",
      "prazo_a_vencer",
      "realizado",
      "tarefas",
      "dados",
      "exemplo",
    ])
    .orderBy("nome")
    .orderBy("id")
    .execute();
}
export type LinhaDaObra = Awaited<ReturnType<typeof obras>>[number];

/** Datas e status de todos os relatórios. */
export function datasDosRelatorios(tx: Tx) {
  return tx
    .selectFrom("operacoes.diario_relatorios")
    .select(["id", "obra_id", "numero", "data", "data_fim", "status_id"])
    .orderBy("data")
    .orderBy("id")
    .execute();
}

/** Quando a sincronização gravou a obra mais recente. */
export async function ultimaAtualizacao(tx: Tx): Promise<string | null> {
  const r = await tx
    .selectFrom("operacoes.diario_obras")
    .select("atualizado_em")
    .orderBy("atualizado_em", "desc")
    .limit(1)
    .executeTakeFirst();
  return r?.atualizado_em ?? null;
}

// ---------------------------------------------------------------------------
// Telas do Diário (parte B): a obra com o cronograma, os relatórios e o
// estado da consulta (integracao.*, só service role: quem chama confere).
// ---------------------------------------------------------------------------

export function obra(tx: Tx, id: string) {
  return tx
    .selectFrom("operacoes.diario_obras")
    .select([
      "id",
      "nome",
      "status_id",
      "grupo",
      "responsavel",
      "data_inicio",
      "data_fim",
      "prazo_contratual",
      "prazo_decorrido",
      "prazo_a_vencer",
      "realizado",
      "tarefas",
      "dados",
      "exemplo",
      "lista_de_tarefas",
    ])
    .where("id", "=", id)
    .executeTakeFirst();
}

function relatoriosBase(tx: Tx) {
  return tx
    .selectFrom("operacoes.diario_relatorios as r")
    .leftJoin("operacoes.diario_obras as o", "o.id", "r.obra_id")
    .select([
      "r.id",
      "r.obra_id",
      "r.numero",
      "r.data",
      "r.data_fim",
      "r.status_id",
      "r.modelo",
      "r.modelo_id",
      "r.autor",
      "r.autor_cargo",
      "r.autor_id",
      "r.app",
      "r.criado_no_app",
      "r.resumo",
      "r.exemplo",
      "o.nome as obra",
    ]);
}
export type LinhaDoRelatorio = Awaited<
  ReturnType<ReturnType<typeof relatoriosBase>["execute"]>
>[number];

export function relatoriosDoPeriodo(
  tx: Tx,
  f: {
    de: string;
    ate: string;
    obra?: string;
    status?: number[];
    modelo?: string;
    autor?: string;
  },
) {
  let q = relatoriosBase(tx)
    .where("r.data", ">=", f.de)
    .where("r.data", "<=", f.ate);
  if (f.obra) q = q.where("r.obra_id", "=", f.obra);
  if (f.status?.length) q = q.where("r.status_id", "in", f.status);
  if (f.modelo) q = q.where("r.modelo_id", "=", f.modelo);
  if (f.autor) q = q.where("r.autor_id", "=", f.autor);
  return q
    .orderBy("r.data", "desc")
    .orderBy("r.numero", "desc")
    .orderBy("r.id")
    .execute();
}

export function relatorio(tx: Tx, id: string) {
  return relatoriosBase(tx)
    .select(["r.dados", "r.detalhado_em"])
    .where("r.id", "=", id)
    .executeTakeFirst();
}

/** Modelos e autores que aparecem nos relatórios guardados. */
export function modelosEAutores(tx: Tx) {
  return tx
    .selectFrom("operacoes.diario_relatorios")
    .select(["id", "modelo", "modelo_id", "autor", "autor_id"])
    .orderBy("id")
    .execute();
}

const PARTES = {
  ocorrencias: "ocorrencias",
  equipamentos: "equipamentos",
  material: "controleDeMaterial",
  galeria: "galeriaDeFotos",
  videos: "videos",
  anexos: "anexos",
  atividades: "atividades",
} as const;
export type Parte = keyof typeof PARTES;

/** Pedaços do JSON dos relatórios detalhados da obra (só os pedidos). */
export function partes(
  tx: Tx,
  obraId: string,
  pedidas: Parte[],
  periodo?: { de: string; ate: string },
) {
  let q = tx
    .selectFrom("operacoes.diario_relatorios")
    .select((eb) => [
      "id",
      "numero",
      "data",
      ...pedidas.map((p) =>
        sql<unknown>`${eb.ref("dados")} -> ${PARTES[p]}`.as(p),
      ),
    ])
    .where("obra_id", "=", obraId)
    .where("detalhado_em", "is not", null);
  if (periodo)
    q = q.where("data", ">=", periodo.de).where("data", "<=", periodo.ate);
  return q.orderBy("data").orderBy("numero").orderBy("id").execute();
}

// --- Estado da consulta (service role) --------------------------------------

export function credencial(tx: Tx, sistema: string) {
  return tx
    .selectFrom("integracao.credenciais")
    .select("ativa")
    .where("sistema", "=", sistema)
    .executeTakeFirst();
}

export function execucoes(tx: Tx, sistema: string, recurso: string, n: number) {
  return tx
    .selectFrom("integracao.sync_runs")
    .select([
      "id",
      "status",
      "iniciado_em",
      "finalizado_em",
      "erro",
      "cursor_depois",
    ])
    .where("sistema", "=", sistema)
    .where("recurso", "=", recurso)
    .orderBy("iniciado_em", "desc")
    .limit(n)
    .execute();
}

export async function temExemplo(tx: Tx): Promise<boolean> {
  return !!(await tx
    .selectFrom("operacoes.diario_obras")
    .select("id")
    .where("exemplo", "=", true)
    .limit(1)
    .executeTakeFirst());
}

export async function empresa(tx: Tx): Promise<unknown> {
  const r = await tx
    .selectFrom("operacoes.diario_cadastros")
    .select("empresa")
    .where("id", "=", true)
    .executeTakeFirst();
  return r?.empresa ?? null;
}

/** A consulta morreu no meio: fica como erro, para liberar a trava. */
export function marcarInterrompida(tx: Tx, id: string) {
  return tx
    .updateTable("integracao.sync_runs")
    .set({
      status: "erro",
      finalizado_em: new Date().toISOString(),
      erro: "interrompida (timeout)",
    })
    .where("id", "=", id)
    .where("status", "=", "rodando")
    .execute();
}
