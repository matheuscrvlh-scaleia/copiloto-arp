import type { Selectable } from "kysely";
import type { Tx } from "@/infra/banco";
import type { OsModeloItens, OsModelos } from "@/infra/banco/tipos";

// Modelos de entrada e saída de cliente, disparos e lembretes recorrentes
// (os.modelos, os.modelo_itens, os.disparos e os chamados com Repetir).

export type Modelo = Selectable<OsModelos>;
export type ItemModelo = Selectable<OsModeloItens>;
export interface ModeloComItens extends Modelo {
  itens: ItemModelo[];
}

const COLUNAS_LOJA = [
  "id",
  "nome",
  "luc",
  "situacao",
  "inicio",
  "fim",
  "tem_vaga",
  "atualizado_em",
] as const;

/** Modelos com os itens na ordem (um só, com `id`). */
export async function modelos(tx: Tx, id?: string): Promise<ModeloComItens[]> {
  let q = tx
    .selectFrom("os.modelos")
    .selectAll()
    .orderBy("gatilho")
    .orderBy("nome");
  if (id) q = q.where("id", "=", id);
  const lista = await q.execute();
  if (!lista.length) return [];
  const itens = await tx
    .selectFrom("os.modelo_itens")
    .selectAll()
    .where(
      "modelo_id",
      "in",
      lista.map((m) => m.id),
    )
    .orderBy("ordem")
    .execute();
  return lista.map((m) => ({
    ...m,
    itens: itens.filter((i) => i.modelo_id === m.id),
  }));
}

/** Lojas para o botão "Disparar modelo" (vigentes primeiro). */
export function lojasParaDisparo(tx: Tx) {
  return tx
    .selectFrom("os.lojas")
    .select(COLUNAS_LOJA)
    .orderBy("situacao", "desc")
    .orderBy("nome")
    .execute();
}

export function lojaDoModelo(tx: Tx, id: string) {
  return tx
    .selectFrom("os.lojas")
    .select(COLUNAS_LOJA)
    .where("id", "=", id)
    .executeTakeFirst();
}
export type LojaDoModelo = NonNullable<
  Awaited<ReturnType<typeof lojaDoModelo>>
>;

/** Disparos mais recentes, com o nome do modelo e a loja. */
export function disparosFeitos(tx: Tx, limite: number) {
  return tx
    .selectFrom("os.disparos as d")
    .leftJoin("os.modelos as m", "m.id", "d.modelo_id")
    .innerJoin("os.lojas as l", "l.id", "d.loja_id")
    .select([
      "d.id",
      "d.em",
      "d.automatico",
      "d.chamado_id",
      "m.nome as modelo",
      "l.id as loja_id",
      "l.nome as loja_nome",
      "l.luc as loja_luc",
      "l.situacao as loja_situacao",
    ])
    .orderBy("d.em", "desc")
    .limit(limite)
    .execute();
}

/** Os Avisos dos disparos que a pessoa vê (o RLS tira os demais). */
export function avisosDosDisparos(tx: Tx, ids: string[]) {
  return tx
    .selectFrom("os.chamados")
    .select(["id", "numero", "status"])
    .where("id", "in", ids)
    .execute();
}

/** Chamados com Repetir (os mais novos primeiro), em páginas de 1000. */
export function comRecorrencia(tx: Tx, de: number) {
  return tx
    .selectFrom("os.chamados")
    .select([
      "id",
      "numero",
      "titulo",
      "tipo",
      "setor_id",
      "responsavel_id",
      "recorrencia",
      "serie_id",
      "serie_data",
      "prazo",
      "criado_em",
    ])
    .where("recorrencia", "is not", null)
    .orderBy("criado_em", "desc")
    .orderBy("id")
    .offset(de)
    .limit(1000)
    .execute();
}

/** Tira o Repetir de toda a série; devolve quantos chamados mudaram. */
export async function pararSerie(tx: Tx, serieId: string): Promise<number> {
  const linhas = await tx
    .updateTable("os.chamados")
    .set({ recorrencia: null })
    .where((eb) =>
      eb.or([eb("serie_id", "=", serieId), eb("id", "=", serieId)]),
    )
    .where("recorrencia", "is not", null)
    .returning("id")
    .execute();
  return linhas.length;
}

/** Reserva o disparo (um por modelo e loja: a repetição dá 23505). */
export async function reservarDisparo(
  tx: Tx,
  d: {
    modelo_id: string;
    loja_id: string;
    automatico: boolean;
    disparado_por: string | null;
  },
): Promise<string> {
  const linha = await tx
    .insertInto("os.disparos")
    .values(d)
    .returning("id")
    .executeTakeFirstOrThrow();
  return linha.id;
}

export async function ligarDisparo(
  tx: Tx,
  id: string,
  chamadoId: string,
): Promise<void> {
  await tx
    .updateTable("os.disparos")
    .set({ chamado_id: chamadoId })
    .where("id", "=", id)
    .execute();
}

/** Categorias e setores para achar o setor do Aviso do modelo. */
export async function catalogoDoAviso(tx: Tx) {
  const categorias = await tx
    .selectFrom("os.categorias")
    .select(["id", "nome", "setor_id", "ativo"])
    .execute();
  const setores = await tx
    .selectFrom("os.setores")
    .select(["id", "nome"])
    .execute();
  return { categorias, setores };
}
