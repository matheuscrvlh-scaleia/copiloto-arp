import { termoDeBusca } from "@arp/shared/os/filtro-postgrest";
import {
  type CriterioVistoria,
  ehUuid,
  type FiltroVistorias,
} from "@arp/shared/os/vistorias-lista";
import {
  type Expression,
  type ExpressionBuilder,
  type Insertable,
  type Selectable,
  type SqlBool,
  sql,
  type Updateable,
} from "kysely";
import type { Tx } from "@/infra/banco";
import type { DB, OsVistoriaAmbientes, OsVistorias } from "@/infra/banco/tipos";

// Consultas das vistorias de locação (4.10). Só SQL: quem abre o escopo é o
// service (as telas leem e gravam pela sessão, com o RLS de os.vistorias;
// o modelo de entrada/saída e o link do locatário, pela service role).

export type Vistoria = Selectable<OsVistorias>;
export type Ambiente = Selectable<OsVistoriaAmbientes>;

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------

type EbVistorias = ExpressionBuilder<DB, "os.vistorias">;

const COLUNAS_LISTA = [
  "id",
  "codigo",
  "tipo",
  "status",
  "rascunho",
  "data",
  "hora",
  "vistoriador_id",
  "vistoriador_nome",
  "loja_id",
  "locatario",
  "bloco",
  "unidade",
  "assinatura_locador_path",
  "assinatura_locatario_path",
  "legado_id",
  "criado_em",
  "atualizado_em",
] as const;

/** Os `.or()` do PostgREST que os cartões usam, em SQL. */
const OU: Record<string, (eb: EbVistorias) => Expression<SqlBool>> = {
  "assinatura_locador_path.is.null,assinatura_locatario_path.is.null": (eb) =>
    eb.or([
      eb("assinatura_locador_path", "is", null),
      eb("assinatura_locatario_path", "is", null),
    ]),
  "legado_id.not.is.null,and(assinatura_locador_path.not.is.null,assinatura_locatario_path.not.is.null)":
    (eb) =>
      eb.or([
        eb("legado_id", "is not", null),
        eb.and([
          eb("assinatura_locador_path", "is not", null),
          eb("assinatura_locatario_path", "is not", null),
        ]),
      ]),
};

function filtroDasVistorias(
  f: FiltroVistorias | null,
  c: CriterioVistoria | null,
) {
  return (eb: EbVistorias): Expression<SqlBool> => {
    const e: Expression<SqlBool>[] = [];
    if (f) {
      if (f.tipo) e.push(eb(sql<string>`tipo::text`, "=", f.tipo));
      if (f.status) e.push(eb(sql<string>`status::text`, "=", f.status));
      if (f.vistoriador)
        e.push(
          ehUuid(f.vistoriador)
            ? eb("vistoriador_id", "=", f.vistoriador)
            : eb.and([
                eb("vistoriador_id", "is", null),
                eb("vistoriador_nome", "=", f.vistoriador),
              ]),
        );
      if (f.bloco === "sem")
        e.push(eb.or([eb("bloco", "is", null), eb("bloco", "=", "")]));
      else if (f.bloco) e.push(eb("bloco", "=", f.bloco));
      if (f.de) e.push(eb("data", ">=", f.de));
      if (f.ate) e.push(eb("data", "<=", f.ate));
      const termo = termoDeBusca(f.q);
      if (termo) {
        const como = `%${termo}%`;
        e.push(
          eb.or([
            eb("codigo", "ilike", como),
            eb("locatario", "ilike", como),
            eb("bloco", "ilike", como),
            eb("unidade", "ilike", como),
          ]),
        );
      }
    }
    if (c) {
      if (c.status) e.push(eb(sql<string>`status::text`, "=", c.status));
      if (c.semStatus)
        e.push(eb(sql<string>`status::text`, "not in", c.semStatus));
      if (c.legadoNulo) e.push(eb("legado_id", "is", null));
      if (c.ou) {
        const ou = OU[c.ou];
        if (!ou) throw new Error(`Filtro de cartão desconhecido: ${c.ou}`);
        e.push(ou(eb));
      }
      if (c.dataEntre)
        e.push(
          eb.and([
            eb("data", ">=", c.dataEntre.de),
            eb("data", "<", c.dataEntre.ate),
          ]),
        );
      // "Com OS gerada": alguma OS (que a pessoa vê) saiu desta vistoria.
      if (c.comOS)
        e.push(
          eb.exists(
            eb
              .selectFrom("os.ordens as o")
              .select("o.id")
              .whereRef("o.vistoria_id", "=", "os.vistorias.id"),
          ),
        );
    }
    return eb.and(e);
  };
}

export async function contarVistorias(
  tx: Tx,
  f: FiltroVistorias | null,
  c: CriterioVistoria | null,
): Promise<number> {
  const r = await tx
    .selectFrom("os.vistorias")
    .select((eb) => eb.fn.countAll<number>().as("total"))
    .where(filtroDasVistorias(f, c))
    .executeTakeFirstOrThrow();
  return Number(r.total);
}

/** As vistorias do filtro, a mais recente primeiro (um trecho ou todas). */
export function vistoriasDoFiltro(
  tx: Tx,
  f: FiltroVistorias,
  c: CriterioVistoria | null,
  trecho?: { limite: number; pular: number },
) {
  let q = tx
    .selectFrom("os.vistorias")
    .select(COLUNAS_LISTA)
    .where(filtroDasVistorias(f, c))
    .orderBy("data", "desc")
    .orderBy("codigo", "desc")
    .orderBy("id");
  if (trecho) q = q.limit(trecho.limite).offset(trecho.pular);
  return q.execute();
}

/** Quantas OS cada vistoria gerou (só as dos ids). */
export async function ordensDasVistorias(
  tx: Tx,
  ids: string[],
): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const linhas = await tx
    .selectFrom("os.ordens")
    .select((eb) => ["vistoria_id", eb.fn.countAll<number>().as("total")])
    .where("vistoria_id", "in", ids)
    .groupBy("vistoria_id")
    .execute();
  return new Map(
    linhas.flatMap((l) =>
      l.vistoria_id ? [[l.vistoria_id, Number(l.total)]] : [],
    ),
  );
}

/** Opções dos filtros de vistoriador e bloco (três colunas de todas). */
export function colunasDosFiltros(tx: Tx) {
  return tx
    .selectFrom("os.vistorias")
    .select(["vistoriador_id", "vistoriador_nome", "bloco"])
    .orderBy("id")
    .execute();
}

// ---------------------------------------------------------------------------
// Detalhe
// ---------------------------------------------------------------------------

export function vistoria(tx: Tx, id: string): Promise<Vistoria | undefined> {
  return tx
    .selectFrom("os.vistorias")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
}

export function ambientesDaVistoria(tx: Tx, vistoriaId: string) {
  return tx
    .selectFrom("os.vistoria_ambientes")
    .selectAll()
    .where("vistoria_id", "=", vistoriaId)
    .orderBy("ordem")
    .orderBy("criado_em")
    .execute();
}

export function ambientesPorId(tx: Tx, ids: string[]): Promise<Ambiente[]> {
  if (!ids.length) return Promise.resolve([]);
  return tx
    .selectFrom("os.vistoria_ambientes")
    .selectAll()
    .where("id", "in", ids)
    .execute();
}

export function ambiente(tx: Tx, id: string): Promise<Ambiente | undefined> {
  return tx
    .selectFrom("os.vistoria_ambientes")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
}

const COLUNAS_LIGADOS = [
  "id",
  "numero",
  "tipo",
  "titulo",
  "status",
  "ambiente_id",
  "criado_em",
] as const;

/** O chamado que pediu a vistoria e as OS dos ambientes, na ordem. */
export async function ligadosAVistoria(tx: Tx, vistoriaId: string) {
  const chamados = await tx
    .selectFrom("os.chamados")
    .select(COLUNAS_LIGADOS)
    .where("vistoria_id", "=", vistoriaId)
    .orderBy("criado_em")
    .execute();
  const ordens = await tx
    .selectFrom("os.ordens")
    .select(COLUNAS_LIGADOS)
    .where("vistoria_id", "=", vistoriaId)
    .orderBy("criado_em")
    .execute();
  return [...chamados, ...ordens].sort((a, b) =>
    a.criado_em.localeCompare(b.criado_em),
  );
}

/** Fotos dos ambientes, na ordem em que foram tiradas. */
export function fotosDosAmbientes(tx: Tx, ambientes: string[]) {
  if (!ambientes.length) return Promise.resolve([]);
  return tx
    .selectFrom("os.anexos")
    .select(["id", "nome", "path", "mime", "ambiente_id"])
    .where("ambiente_id", "in", ambientes)
    .where("categoria", "not in", ["laudo", "assinatura"])
    .orderBy("em")
    .orderBy("id")
    .execute();
}

export function resumoDaVistoria(tx: Tx, id: string) {
  return tx
    .selectFrom("os.vistorias")
    .select(["id", "codigo", "data"])
    .where("id", "=", id)
    .executeTakeFirst();
}

/** Lojas para escolher o contrato (vigentes primeiro). */
export function lojasParaVistoria(tx: Tx) {
  return tx
    .selectFrom("os.lojas")
    .select(["id", "nome", "luc", "bloco", "locatario", "situacao"])
    .orderBy("situacao", "desc")
    .orderBy("bloco")
    .orderBy("luc")
    .orderBy("id")
    .execute();
}

export function loja(tx: Tx, id: string) {
  return tx
    .selectFrom("os.lojas")
    .select(["id", "nome", "luc", "bloco", "locatario", "telefone"])
    .where("id", "=", id)
    .executeTakeFirst();
}

export async function nomeDoUsuario(
  tx: Tx,
  id: string,
): Promise<string | undefined> {
  const r = await tx
    .selectFrom("core.usuarios")
    .select("nome")
    .where("id", "=", id)
    .executeTakeFirst();
  return r?.nome;
}

// ---------------------------------------------------------------------------
// Gravações
// ---------------------------------------------------------------------------

export async function inserirVistoria(
  tx: Tx,
  v: Insertable<OsVistorias>,
): Promise<string> {
  const r = await tx
    .insertInto("os.vistorias")
    .values(v)
    .returning("id")
    .executeTakeFirstOrThrow();
  return r.id;
}

export async function inserirAmbientes(
  tx: Tx,
  linhas: Insertable<OsVistoriaAmbientes>[],
): Promise<void> {
  if (!linhas.length) return;
  await tx.insertInto("os.vistoria_ambientes").values(linhas).execute();
}

export async function inserirAmbiente(
  tx: Tx,
  a: { vistoria_id: string; titulo: string; ordem: number },
): Promise<string> {
  const r = await tx
    .insertInto("os.vistoria_ambientes")
    .values(a)
    .returning("id")
    .executeTakeFirstOrThrow();
  return r.id;
}

/** Devolve se a linha mudou (sem linha: não existe ou o RLS barrou). */
export async function atualizarVistoria(
  tx: Tx,
  id: string,
  v: Updateable<OsVistorias>,
): Promise<boolean> {
  const r = await tx
    .updateTable("os.vistorias")
    .set(v)
    .where("id", "=", id)
    .executeTakeFirst();
  return r.numUpdatedRows > 0n;
}

export async function atualizarAmbiente(
  tx: Tx,
  id: string,
  vistoriaId: string,
  a: Updateable<OsVistoriaAmbientes>,
): Promise<void> {
  await tx
    .updateTable("os.vistoria_ambientes")
    .set(a)
    .where("id", "=", id)
    .where("vistoria_id", "=", vistoriaId)
    .execute();
}

export async function ligarAmbienteAEntrada(
  tx: Tx,
  id: string,
  entradaAmbienteId: string,
): Promise<void> {
  await tx
    .updateTable("os.vistoria_ambientes")
    .set({ entrada_ambiente_id: entradaAmbienteId })
    .where("id", "=", id)
    .execute();
}

export function pathsDoAmbiente(tx: Tx, ambienteId: string) {
  return tx
    .selectFrom("os.anexos")
    .select("path")
    .where("ambiente_id", "=", ambienteId)
    .execute();
}

export async function removerAmbiente(tx: Tx, id: string): Promise<void> {
  await tx.deleteFrom("os.vistoria_ambientes").where("id", "=", id).execute();
}

/** A entrada mais recente da mesma loja, até a data da saída. */
export async function entradaMaisRecente(
  tx: Tx,
  v: { id: string; loja_id: string; data: string },
): Promise<string | undefined> {
  const r = await tx
    .selectFrom("os.vistorias")
    .select("id")
    .where("loja_id", "=", v.loja_id)
    .where("tipo", "=", "entrada")
    .where("status", "<>", "cancelado")
    .where("id", "<>", v.id)
    .where("data", "<=", v.data)
    .orderBy("data", "desc")
    .orderBy("criado_em", "desc")
    .limit(1)
    .executeTakeFirst();
  return r?.id;
}

export async function inserirFoto(
  tx: Tx,
  a: {
    vistoria_id: string;
    ambiente_id: string;
    nome: string;
    path: string;
    mime: string;
    tamanho: number;
    usuario: { id: string; nome: string };
  },
) {
  return tx
    .insertInto("os.anexos")
    .values({
      vistoria_id: a.vistoria_id,
      ambiente_id: a.ambiente_id,
      categoria: "foto",
      nome: a.nome,
      path: a.path,
      mime: a.mime,
      tamanho: a.tamanho,
      enviado_por: a.usuario.id,
      enviado_por_nome: a.usuario.nome,
    })
    .returning(["id", "nome", "path"])
    .executeTakeFirstOrThrow();
}

/** Remove a foto de um ambiente; devolve o caminho para apagar do disco. */
export function removerFoto(tx: Tx, id: string) {
  return tx
    .deleteFrom("os.anexos")
    .where("id", "=", id)
    .where("ambiente_id", "is not", null)
    .returning("path")
    .executeTakeFirst();
}

export async function inserirLaudo(
  tx: Tx,
  a: {
    vistoria_id: string;
    chamado_id: string | null;
    nome: string;
    path: string;
    tamanho: number;
    visivel_lojista: boolean;
    usuario: { id: string; nome: string };
  },
): Promise<string> {
  const r = await tx
    .insertInto("os.anexos")
    .values({
      vistoria_id: a.vistoria_id,
      chamado_id: a.chamado_id,
      categoria: "laudo",
      nome: a.nome,
      path: a.path,
      mime: "application/pdf",
      tamanho: a.tamanho,
      visivel_lojista: a.visivel_lojista,
      enviado_por: a.usuario.id,
      enviado_por_nome: a.usuario.nome,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return r.id;
}

export function laudosDaVistoria(tx: Tx, vistoriaId: string) {
  return tx
    .selectFrom("os.anexos")
    .select(["id", "path"])
    .where("vistoria_id", "=", vistoriaId)
    .where("categoria", "=", "laudo")
    .execute();
}

export async function removerAnexos(tx: Tx, ids: string[]): Promise<void> {
  if (!ids.length) return;
  await tx.deleteFrom("os.anexos").where("id", "in", ids).execute();
}

/** O chamado da loja que pediu a vistoria (o Aviso): sem ambiente. */
export function chamadoDaLoja(tx: Tx, vistoriaId: string) {
  return tx
    .selectFrom("os.chamados")
    .select(["id", "tipo"])
    .where("vistoria_id", "=", vistoriaId)
    .where("ambiente_id", "is", null)
    .orderBy("criado_em")
    .executeTakeFirst();
}

export async function ligarChamadoAVistoria(
  tx: Tx,
  chamadoId: string,
  vistoriaId: string,
): Promise<void> {
  await tx
    .updateTable("os.chamados")
    .set({ vistoria_id: vistoriaId })
    .where("id", "=", chamadoId)
    .execute();
}

export function vistoriaPeloToken(tx: Tx, token: string) {
  return tx
    .selectFrom("os.vistorias")
    .selectAll()
    .where("assinatura_token", "=", token)
    .executeTakeFirst();
}

/**
 * A assinatura do locatário pelo link: só grava se ninguém assinou no meio
 * do caminho (dois toques, ou a ARP colheu na tela). true: gravou.
 */
export async function gravarAssinaturaDoLink(
  tx: Tx,
  p: {
    id: string;
    token: string;
    path: string;
    nome: string;
    documento: string | null;
  },
): Promise<boolean> {
  const r = await tx
    .updateTable("os.vistorias")
    .set({
      assinatura_locatario_path: p.path,
      locatario_assinatura_nome: p.nome,
      locatario_assinatura_documento: p.documento,
      locatario_assinado_em: sql<string>`now()`,
      assinado_em: sql<string>`now()`,
    })
    .where("id", "=", p.id)
    .where("assinatura_token", "=", p.token)
    .where("assinatura_locatario_path", "is", null)
    .where("assinatura_locador_path", "is not", null)
    .executeTakeFirst();
  return r.numUpdatedRows > 0n;
}
