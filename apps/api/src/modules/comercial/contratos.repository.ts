import { sql } from "kysely";
import type { Tx } from "@/infra/banco";
import type { Json } from "@/infra/banco/tipos";

// Consultas de Contratos e Distratos. Aluguel e `dados` (com os valores) o
// banco não deixa a sessão ler: vêm de `guardados`, pela service role, só
// para ids que a sessão acabou de ver.

export function lista(tx: Tx, desde: string | null) {
  let q = tx
    .selectFrom("comercial.contratos")
    .select([
      "id",
      "tipo",
      "status",
      "versao",
      "lucs",
      "bloco",
      "locatario_nome",
      "parte_tipo",
      "garantia",
      "atualizado_em",
      "atualizado_por",
      "gerado_em",
      "exemplo",
    ]);
  if (desde) q = q.where("atualizado_em", ">=", desde);
  return q.orderBy("atualizado_em", "desc").orderBy("id").execute();
}

export function guardados(tx: Tx, ids: string[]) {
  return tx
    .selectFrom("comercial.contratos")
    .select(["id", "aluguel", "dados"])
    .where("id", "in", ids)
    .execute();
}

export function contrato(tx: Tx, id: string) {
  return tx
    .selectFrom("comercial.contratos")
    .select([
      "id",
      "tipo",
      "status",
      "versao",
      "etapa_atual",
      "atualizado_em",
      "atualizado_por",
      "exemplo",
      "contrato_enet_id",
      "ficha_id",
      "lucs",
    ])
    .where("id", "=", id)
    .executeTakeFirst();
}

export function versoes(tx: Tx, id: string) {
  return tx
    .selectFrom("comercial.contrato_versoes")
    .select(["id", "versao", "status", "etapa_atual", "por", "em"])
    .where("contrato_id", "=", id)
    .orderBy("em", "desc")
    .orderBy("id", "desc")
    .limit(50)
    .execute();
}

export function anexos(tx: Tx, id: string) {
  return tx
    .selectFrom("comercial.contrato_anexos")
    .select([
      "id",
      "tipo",
      "arquivo_nome",
      "tamanho",
      "enviado_em",
      "enviado_por",
    ])
    .where("contrato_id", "=", id)
    .orderBy("enviado_em")
    .execute();
}

/** Fichas recebidas (e já usadas), para escolher na etapa Partes. */
export function fichasRecebidas(tx: Tx) {
  return tx
    .selectFrom("comercial.fichas")
    .select([
      "id",
      "tipo",
      "nome",
      "luc",
      "situacao",
      "recebida_em",
      "gerada_em",
    ])
    .where("situacao", "in", ["recebida", "usada"])
    .where("tipo", "is not", null)
    .orderBy(sql`recebida_em desc nulls last`)
    .limit(500)
    .execute();
}

/** Documentos do kit com a versão atual de cada um (RLS do kit). */
export function documentosDoKit(tx: Tx) {
  return tx
    .selectFrom("comercial.kit_documentos as d")
    .leftJoin("comercial.kit_versoes as v", (j) =>
      j.onRef("v.documento_id", "=", "d.id").on("v.atual", "=", true),
    )
    .select([
      "d.id",
      "d.nome",
      "d.categoria",
      "d.ordem",
      "d.blocos",
      "d.todo_contrato",
      "d.ativo",
      "v.id as versao_id",
      "v.versao",
      "v.validade",
      "v.arquivo_path",
    ])
    .orderBy("d.ordem")
    .orderBy("d.nome")
    .execute();
}

export function tiposDosAnexos(tx: Tx, contratoId: string) {
  return tx
    .selectFrom("comercial.contrato_anexos")
    .select("tipo")
    .where("contrato_id", "=", contratoId)
    .execute();
}

export async function guardarKit(
  tx: Tx,
  contratoId: string,
  versoes: string[],
) {
  await tx
    .deleteFrom("comercial.contrato_kit")
    .where("contrato_id", "=", contratoId)
    .execute();
  if (!versoes.length) return;
  await tx
    .insertInto("comercial.contrato_kit")
    .values(versoes.map((v) => ({ contrato_id: contratoId, versao_id: v })))
    .execute();
}

export function situacaoDaFicha(tx: Tx, id: string) {
  return tx
    .selectFrom("comercial.fichas")
    .select("situacao")
    .where("id", "=", id)
    .executeTakeFirst();
}

export interface LinhaGravada {
  lucs: string[];
  bloco: string | null;
  locatario_nome: string | null;
  parte_tipo: string | null;
  inicio: string | null;
  termino: string | null;
  contrato_enet_id?: string | null;
  garantia?: string | null;
  aluguel?: number | null;
  area_m2?: number | null;
  etapa_atual?: number;
  status: string;
  dados: string;
  ficha_id?: string | null;
}

const VOLTA = ["id", "atualizado_em", "status", "versao"] as const;

export function incluir(tx: Tx, linha: LinhaGravada & { tipo: string }) {
  return tx
    .insertInto("comercial.contratos")
    .values(linha)
    .returning(VOLTA)
    .executeTakeFirst();
}

/**
 * Só grava se ninguém mudou desde a leitura (`atualizado_em` igual). O
 * instante sai da API em milissegundos e o banco guarda microssegundos:
 * a comparação é no milissegundo.
 */
export function alterar(
  tx: Tx,
  id: string,
  lido: string,
  linha: Partial<LinhaGravada>,
) {
  return tx
    .updateTable("comercial.contratos")
    .set(linha)
    .where("id", "=", id)
    .where(
      sql<boolean>`abs(extract(epoch from (atualizado_em - ${lido}::timestamptz))) < 0.001`,
    )
    .returning(VOLTA)
    .executeTakeFirst();
}

export function ficha(tx: Tx, id: string) {
  return tx
    .selectFrom("comercial.fichas as f")
    .leftJoin("comercial.ficha_dados as d", "d.ficha_id", "f.id")
    .select([
      "f.id",
      "f.tipo",
      "f.origem",
      "f.nome",
      "f.situacao",
      "d.respostas",
    ])
    .where("f.id", "=", id)
    .executeTakeFirst();
}

export function registrarAcessoAFicha(tx: Tx, fichaId: string) {
  return tx
    .insertInto("comercial.ficha_acessos")
    .values({ ficha_id: fichaId, acao: "abriu" })
    .execute();
}

/** Última vistoria (entrada ou saída) dos LUCs no Tickets. */
export async function ultimaVistoria(
  tx: Tx,
  lucs: string[],
  tipo: "entrada" | "saida",
) {
  const lojas = await tx
    .selectFrom("os.lojas")
    .select("id")
    .where("luc", "in", lucs)
    .execute();
  const ids = lojas.map((l) => l.id);
  return tx
    .selectFrom("os.vistorias")
    .select(["id", "codigo", "data"])
    .where("tipo", "=", tipo)
    .where("status", "<>", "cancelado")
    .where((eb) =>
      eb.or([
        eb("unidade", "in", lucs),
        ...(ids.length ? [eb("loja_id", "in", ids)] : []),
      ]),
    )
    .orderBy("data", "desc")
    .orderBy("criado_em", "desc")
    .limit(1)
    .executeTakeFirst();
}

export function ambientesDaVistoria(tx: Tx, vistoriaId: string) {
  return tx
    .selectFrom("os.vistoria_ambientes")
    .select(["titulo", "descricao", "resposta"])
    .where("vistoria_id", "=", vistoriaId)
    .orderBy("ordem")
    .execute();
}

export function existe(tx: Tx, id: string) {
  return tx
    .selectFrom("comercial.contratos")
    .select("id")
    .where("id", "=", id)
    .executeTakeFirst();
}

export function incluirAnexo(
  tx: Tx,
  a: {
    contrato_id: string;
    tipo: string;
    arquivo_path: string;
    arquivo_nome: string;
    tamanho: number;
    tipo_mime: string | null;
    enviado_por: string;
  },
) {
  return tx.insertInto("comercial.contrato_anexos").values(a).execute();
}

export function removerAnexo(tx: Tx, id: string) {
  return tx
    .deleteFrom("comercial.contrato_anexos")
    .where("id", "=", id)
    .returning(["arquivo_path", "contrato_id"])
    .executeTakeFirst();
}

export function anexo(tx: Tx, id: string) {
  return tx
    .selectFrom("comercial.contrato_anexos")
    .select(["arquivo_path", "arquivo_nome"])
    .where("id", "=", id)
    .executeTakeFirst();
}

export type { Json };
