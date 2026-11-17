import type { Tx } from "@/infra/banco";
import type { Alvo } from "./alvo";

// Consultas das rotinas do módulo (service role): aceite automático e avisos
// de prazo, lembretes recorrentes, modelos de entrada e saída e cobrança do
// terceirizado. Chamados e OS ficam cada um na sua tabela, com as mesmas
// colunas. `recorte` (só nos testes) limita a rotina a ids conhecidos: a
// rotina de verdade roda sem ele, sobre tudo.

export type Tabela = "os.chamados" | "os.ordens";
export type Recorte = readonly string[] | undefined;

export const tabelaDo = (a: Pick<Alvo, "tipo">): Tabela =>
  a.tipo === "os" ? "os.ordens" : "os.chamados";

const LOTE = 1000;

// ---------------------------------------------------------------------------
// Aceite automático, avisos de prazo e confirmação parada
// ---------------------------------------------------------------------------

/** Concluídos (para o aceite automático), os mais antigos primeiro. */
export function concluidos(tx: Tx, tabela: Tabela, recorte: Recorte) {
  let q = tx
    .selectFrom(tabela)
    .select([
      "id",
      "tipo",
      "numero",
      "titulo",
      "concluido_em",
      "responsavel_id",
    ])
    .where("status", "=", "concluido")
    .where("concluido_em", "is not", null);
  if (recorte) q = q.where("id", "in", [...recorte]);
  return q.orderBy("concluido_em").limit(LOTE).execute();
}

/** Fecha só se ainda está Concluído (pode ter mudado entre a leitura e agora). */
export async function fecharAutomatico(
  tx: Tx,
  tabela: Tabela,
  id: string,
): Promise<boolean> {
  const r = await tx
    .updateTable(tabela)
    .set({ status: "fechado", fechado_automatico: true })
    .where("id", "=", id)
    .where("status", "=", "concluido")
    .executeTakeFirst();
  return r.numUpdatedRows > 0n;
}

/** Abertos ou em andamento com o prazo entre `desde` e `ate`. */
export function comPrazoPerto(
  tx: Tx,
  tabela: Tabela,
  desde: string,
  ate: string,
  recorte: Recorte,
) {
  let q = tx
    .selectFrom(tabela)
    .select([
      "id",
      "tipo",
      "numero",
      "titulo",
      "status",
      "prazo",
      "responsavel_id",
      "setor_id",
    ])
    .where("status", "in", ["aberto", "em_andamento"])
    .where("prazo", ">=", desde)
    .where("prazo", "<=", ate);
  if (recorte) q = q.where("id", "in", [...recorte]);
  return q.limit(LOTE).execute();
}

/** Destinos de Aviso com prazo próprio vencido, com o dono (chamado ou OS). */
export async function destinosVencidos(
  tx: Tx,
  tabela: Tabela,
  desde: string,
  agora: string,
  recorte: Recorte,
) {
  const coluna = tabela === "os.ordens" ? "ordem_id" : "chamado_id";
  const destinos = await tx
    .selectFrom("os.destinatarios")
    .select([
      "id",
      "chamado_id",
      "ordem_id",
      "setor_id",
      "usuario_id",
      "responsavel_id",
      "titulo",
      "prazo",
      "status",
    ])
    .where("status", "<>", "concluido")
    .where("prazo", ">=", desde)
    .where("prazo", "<=", agora)
    .where(coluna, "in", (eb) => {
      let donos = eb
        .selectFrom(tabela)
        .select("id")
        .where("status", "in", ["aberto", "em_andamento", "aguardando"]);
      if (recorte) donos = donos.where("id", "in", [...recorte]);
      return donos;
    })
    .limit(LOTE)
    .execute();
  const ids = [...new Set(destinos.flatMap((d) => d[coluna] ?? []))];
  const donos = ids.length
    ? await tx
        .selectFrom(tabela)
        .select(["id", "tipo", "numero", "titulo"])
        .where("id", "in", ids)
        .execute()
    : [];
  const porId = new Map(donos.map((c) => [c.id, c]));
  return destinos.flatMap((d) => {
    const dono = porId.get(d[coluna] ?? "");
    return dono ? [{ ...d, dono }] : [];
  });
}

/** Concluídos esperando a confirmação de quem pediu. */
export function esperandoConfirmacao(tx: Tx, tabela: Tabela, recorte: Recorte) {
  let q = tx
    .selectFrom(tabela)
    .select(["id", "tipo", "numero", "titulo", "concluido_em", "aberto_por"])
    .where("status", "=", "concluido")
    .where("aberto_por", "is not", null)
    .where("concluido_em", "is not", null);
  if (recorte) q = q.where("id", "in", [...recorte]);
  return q.limit(LOTE).execute();
}

// ---------------------------------------------------------------------------
// Lembretes recorrentes
// ---------------------------------------------------------------------------

/** Todas as ocorrências que ainda repetem. */
export function ocorrenciasComRepetir(
  tx: Tx,
  tabela: Tabela,
  recorte: Recorte,
) {
  let q = tx
    .selectFrom(tabela)
    .select([
      "id",
      "numero",
      "tipo",
      "titulo",
      "descricao",
      "setor_id",
      "categoria_id",
      "prioridade",
      "responsavel_id",
      "aberto_por",
      "pessoal",
      "precisa_confirmacao",
      "destinos_em_ordem",
      "loja_id",
      "ativo_id",
      "checklist",
      "etiquetas",
      "campos",
      "recorrencia",
      "serie_id",
      "serie_data",
      "prazo",
      "criado_em",
      "acao_url",
      "acao_rotulo",
      "conclusao_externa",
      "origem_modulo",
      "origem_ref",
    ])
    .where("recorrencia", "is not", null);
  if (recorte)
    q = q.where((eb) =>
      eb.or([eb("id", "in", [...recorte]), eb("serie_id", "in", [...recorte])]),
    );
  return q.orderBy("id").execute();
}

/** Destinos das ocorrências (a próxima repete os da última), na ordem. */
export function destinosDas(tx: Tx, tabela: Tabela, ids: string[]) {
  if (!ids.length) return Promise.resolve([]);
  const coluna = tabela === "os.ordens" ? "ordem_id" : "chamado_id";
  return tx
    .selectFrom("os.destinatarios")
    .select([
      "chamado_id",
      "ordem_id",
      "setor_id",
      "usuario_id",
      "titulo",
      "responsavel_id",
      "ordem",
    ])
    .where(coluna, "in", ids)
    .orderBy("ordem")
    .execute();
}

/** A data mais nova de cada série, contando as ocorrências sem Repetir. */
export function datasDasSeries(tx: Tx, tabela: Tabela, ids: string[]) {
  if (!ids.length) return Promise.resolve([]);
  return tx
    .selectFrom(tabela)
    .select(["serie_id", "serie_data", "recorrencia"])
    .where("serie_id", "in", ids)
    .where("serie_data", "is not", null)
    .execute();
}

/** O primeiro chamado da série passa a ter a série gravada nele também. */
export async function marcarPrimeira(
  tx: Tx,
  tabela: Tabela,
  id: string,
  data: string,
): Promise<void> {
  await tx
    .updateTable(tabela)
    .set({ serie_id: id, serie_data: data })
    .where("id", "=", id)
    .where("serie_id", "is", null)
    .execute();
}

export async function manterTipoDeTarefa(
  tx: Tx,
  tabela: Tabela,
  id: string,
  t: {
    pessoal: boolean;
    precisa_confirmacao: boolean;
    destinos_em_ordem: boolean;
  },
): Promise<void> {
  await tx.updateTable(tabela).set(t).where("id", "=", id).execute();
}

// ---------------------------------------------------------------------------
// Modelos de entrada e saída
// ---------------------------------------------------------------------------

/**
 * Lojas candidatas: começaram há pouco, saíram há pouco ou mudaram há pouco
 * (a regra fina é de @arp/shared/os/modelos).
 */
export function lojasCandidatas(
  tx: Tx,
  hoje: string,
  desde: string,
  recorte: Recorte,
) {
  let q = tx
    .selectFrom("os.lojas")
    .select([
      "id",
      "nome",
      "luc",
      "situacao",
      "inicio",
      "fim",
      "tem_vaga",
      "atualizado_em",
    ])
    .where((eb) =>
      eb.or([
        eb("inicio", ">=", desde),
        eb.and([eb("fim", ">=", desde), eb("fim", "<=", hoje)]),
        eb.and([
          eb("situacao", "=", "encerrado"),
          eb("atualizado_em", ">=", desde),
        ]),
      ]),
    );
  if (recorte) q = q.where("id", "in", [...recorte]);
  return q.limit(2000).execute();
}

export function disparosDosModelos(tx: Tx, modeloIds: string[]) {
  if (!modeloIds.length) return Promise.resolve([]);
  return tx
    .selectFrom("os.disparos")
    .select(["modelo_id", "loja_id"])
    .where("modelo_id", "in", modeloIds)
    .execute();
}

// ---------------------------------------------------------------------------
// Cobrança do terceirizado
// ---------------------------------------------------------------------------

/** OS terceirizadas em aberto com o prazo do terceirizado até `ate`. */
export function ordensParaCobrar(tx: Tx, ate: string, recorte: Recorte) {
  let q = tx
    .selectFrom("os.ordens")
    .select([
      "id",
      "numero",
      "titulo",
      "responsavel_id",
      "aberto_por",
      "prazo_terceirizado",
    ])
    .where("tipo", "=", "os")
    .where("execucao", "=", "terceirizada")
    .where("status", "in", ["aberto", "em_andamento", "aguardando"])
    .where("cobranca_avisada_em", "is", null)
    .where("prazo_terceirizado", "is not", null)
    .where("prazo_terceirizado", "<=", ate);
  if (recorte) q = q.where("id", "in", [...recorte]);
  return q.execute();
}

export function linksDasOrdens(tx: Tx, ids: string[]) {
  if (!ids.length) return Promise.resolve([]);
  return tx
    .selectFrom("os.terceirizado_links")
    .select(["ordem_id", "criado_por", "terminado_em"])
    .where("ordem_id", "in", ids)
    .where("cancelado_em", "is", null)
    .execute();
}

export async function marcarCobranca(
  tx: Tx,
  id: string,
  em: string,
): Promise<void> {
  await tx
    .updateTable("os.ordens")
    .set({ cobranca_avisada_em: em })
    .where("id", "=", id)
    .execute();
}
