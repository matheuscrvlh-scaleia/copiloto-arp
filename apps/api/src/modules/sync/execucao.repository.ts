import type { Tx } from "@/infra/banco";
import type { JsonValue } from "@/infra/banco/tipos";

// integracao.sync_runs, cursores e registros_brutos: o registro de cada
// execução das sincronizações.

export function marcarInterrompidas(
  tx: Tx,
  sistema: string,
  recurso: string,
  antesDe: string,
) {
  return tx
    .updateTable("integracao.sync_runs")
    .set({
      status: "erro",
      finalizado_em: new Date().toISOString(),
      erro: "interrompida (timeout)",
    })
    .where("sistema", "=", sistema)
    .where("recurso", "=", recurso)
    .where("status", "=", "rodando")
    .where("iniciado_em", "<", antesDe)
    .execute();
}

export async function cursor(
  tx: Tx,
  sistema: string,
  recurso: string,
): Promise<JsonValue | undefined> {
  const r = await tx
    .selectFrom("integracao.cursores")
    .select("cursor")
    .where("sistema", "=", sistema)
    .where("recurso", "=", recurso)
    .executeTakeFirst();
  return r?.cursor;
}

export async function iniciar(
  tx: Tx,
  sistema: string,
  recurso: string,
  cursorAntes: JsonValue | null,
): Promise<string> {
  const r = await tx
    .insertInto("integracao.sync_runs")
    .values({
      sistema,
      recurso,
      cursor_antes: cursorAntes === null ? null : JSON.stringify(cursorAntes),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return r.id;
}

export function concluir(
  tx: Tx,
  id: string,
  registros: number,
  cursorDepois: JsonValue | null,
) {
  return tx
    .updateTable("integracao.sync_runs")
    .set({
      status: "sucesso",
      finalizado_em: new Date().toISOString(),
      registros,
      cursor_depois:
        cursorDepois === null ? null : JSON.stringify(cursorDepois),
    })
    .where("id", "=", id)
    .execute();
}

export function gravarCursor(
  tx: Tx,
  sistema: string,
  recurso: string,
  valor: JsonValue,
) {
  return tx
    .insertInto("integracao.cursores")
    .values({
      sistema,
      recurso,
      cursor: JSON.stringify(valor),
      atualizado_em: new Date().toISOString(),
    })
    .onConflict((oc) =>
      oc.columns(["sistema", "recurso"]).doUpdateSet((eb) => ({
        cursor: eb.ref("excluded.cursor"),
        atualizado_em: eb.ref("excluded.atualizado_em"),
      })),
    )
    .execute();
}

export function falhar(tx: Tx, id: string, erro: string) {
  return tx
    .updateTable("integracao.sync_runs")
    .set({ status: "erro", finalizado_em: new Date().toISOString(), erro })
    .where("id", "=", id)
    .execute();
}

export interface LinhaBruta {
  sistema: string;
  recurso: string;
  chave_externa: string;
  payload: string;
  hash: string;
  sync_run_id: string;
  recebido_em: string;
}

export function gravarBrutos(tx: Tx, linhas: LinhaBruta[]) {
  return tx
    .insertInto("integracao.registros_brutos")
    .values(linhas)
    .onConflict((oc) =>
      oc.columns(["sistema", "recurso", "chave_externa"]).doUpdateSet((eb) => ({
        payload: eb.ref("excluded.payload"),
        hash: eb.ref("excluded.hash"),
        sync_run_id: eb.ref("excluded.sync_run_id"),
        recebido_em: eb.ref("excluded.recebido_em"),
      })),
    )
    .execute();
}

/** Execuções de um sistema desde `desde` (o cursor guarda o que gastaram). */
export async function cursoresDesde(
  tx: Tx,
  sistema: string,
  desde: string,
): Promise<(JsonValue | null)[]> {
  const r = await tx
    .selectFrom("integracao.sync_runs")
    .select("cursor_depois")
    .where("sistema", "=", sistema)
    .where("iniciado_em", ">=", desde)
    .execute();
  return r.map((l) => l.cursor_depois);
}

/** Última execução que terminou bem (Diário de Obra). */
export function ultimaComSucesso(tx: Tx, sistema: string, recurso: string) {
  return tx
    .selectFrom("integracao.sync_runs")
    .select(["finalizado_em", "cursor_depois"])
    .where("sistema", "=", sistema)
    .where("recurso", "=", recurso)
    .where("status", "=", "sucesso")
    .orderBy("iniciado_em", "desc")
    .limit(1)
    .executeTakeFirst();
}
