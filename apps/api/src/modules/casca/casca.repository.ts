import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Consultas da casca. Tudo roda em `banco.comoUsuario`: o RLS só mostra (e
// só deixa marcar) o que é da própria pessoa.

export async function rubricasNaoClassificadas(tx: Tx): Promise<number> {
  const r = await tx
    .selectFrom("rh.rubricas")
    .select((eb) => eb.fn.countAll<number>().as("total"))
    .where("grupo", "=", "nao_classificada")
    .executeTakeFirstOrThrow();
  return Number(r.total);
}

export async function folhaExiste(
  tx: Tx,
  competencia: string,
): Promise<boolean> {
  const r = await tx
    .selectFrom("rh.folhas")
    .select("competencia")
    .where("competencia", "=", competencia)
    .executeTakeFirst();
  return r !== undefined;
}

export async function temParametrosDaEmpresa(tx: Tx): Promise<boolean> {
  const r = await tx
    .selectFrom("rh.parametros_empresa")
    .select("vigente_desde")
    .limit(1)
    .executeTakeFirst();
  return r !== undefined;
}

export function metasDoRh(tx: Tx) {
  return tx
    .selectFrom("core.metas")
    .select(["indicador", "vigente_desde"])
    .where("indicador", "like", "rh.%")
    .execute();
}

/** Departamentos que a importação da folha criou como "Departamento N". */
export async function departamentosProvisorios(tx: Tx): Promise<number> {
  const r = await tx
    .selectFrom("rh.departamentos")
    .select((eb) => eb.fn.countAll<number>().as("total"))
    .where("nome", "like", "Departamento %")
    .executeTakeFirstOrThrow();
  return Number(r.total);
}

export function notificacoesNaoLidas(tx: Tx, usuarioId: string) {
  return tx
    .selectFrom("os.notificacoes")
    .select(["id", "tipo", "titulo", "texto", "href", "criado_em"])
    .where("usuario_id", "=", usuarioId)
    .where("lida_em", "is", null)
    .orderBy("criado_em", "desc")
    .limit(30)
    .execute();
}

/** Marca uma (pelo id) ou, sem id, todas as que ainda não foram lidas. */
export async function marcarLida(
  tx: Tx,
  usuarioId: string,
  id?: number,
): Promise<void> {
  const consulta = tx
    .updateTable("os.notificacoes")
    .set({ lida_em: sql`now()` })
    .where("usuario_id", "=", usuarioId);
  await (id === undefined
    ? consulta.where("lida_em", "is", null)
    : consulta.where("id", "=", id)
  ).execute();
}

export function preferencia(tx: Tx, chave: string) {
  return tx
    .selectFrom("core.preferencias")
    .select("valor")
    .where("chave", "=", chave)
    .executeTakeFirst();
}

export async function gravarPreferencia(
  tx: Tx,
  usuarioId: string,
  chave: string,
  valor: string,
): Promise<void> {
  const json = JSON.stringify(valor);
  await tx
    .insertInto("core.preferencias")
    .values({ usuario_id: usuarioId, chave, valor: json })
    .onConflict((oc) =>
      oc.columns(["usuario_id", "chave"]).doUpdateSet({ valor: json }),
    )
    .execute();
}

export async function apagarPreferencia(
  tx: Tx,
  usuarioId: string,
  chave: string,
): Promise<void> {
  await tx
    .deleteFrom("core.preferencias")
    .where("usuario_id", "=", usuarioId)
    .where("chave", "=", chave)
    .execute();
}
