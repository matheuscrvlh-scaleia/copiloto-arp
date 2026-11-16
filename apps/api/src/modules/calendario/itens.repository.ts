import type { LinhaDoItem } from "@arp/shared/calendario/item";
import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Itens do calendário (calendario.itens). Sempre com a sessão: o RLS decide
// quem vê cada item (todos, setores, cargos, pessoas ou só quem criou e o
// responsável) e quem altera.

/**
 * Itens que encostam em `de`..`ate` e as séries que começaram até `ate` e
 * ainda não acabaram (quem expande as ocorrências é a tela).
 */
export function itensEntre(tx: Tx, de: string, ate: string) {
  return tx
    .selectFrom("calendario.itens")
    .select([
      "id",
      "tipo_id",
      "titulo",
      "descricao",
      "local",
      "inicio",
      "fim",
      "hora_inicio",
      "hora_fim",
      "responsavel_id",
      "concluido_em",
      "recorrencia",
      "recorrencia_ate",
      "visibilidade",
      "setores",
      "cargos",
      "usuarios",
      "criado_por",
    ])
    .where("inicio", "<=", ate)
    .where((eb) =>
      eb.or([
        eb("fim", ">=", de),
        eb.and([
          eb("recorrencia", "is not", null),
          eb.or([
            eb("recorrencia_ate", "is", null),
            eb("recorrencia_ate", ">=", de),
          ]),
        ]),
      ]),
    )
    .orderBy("inicio")
    .orderBy("id")
    .execute();
}

/** Ids gravados (vazio: o RLS não deixou). */
export function criar(tx: Tx, linha: LinhaDoItem) {
  return tx
    .insertInto("calendario.itens")
    .values(linha)
    .returning("id")
    .execute();
}

export function atualizar(tx: Tx, id: string, linha: LinhaDoItem) {
  return tx
    .updateTable("calendario.itens")
    .set(linha)
    .where("id", "=", id)
    .returning("id")
    .execute();
}

export function excluir(tx: Tx, id: string) {
  return tx
    .deleteFrom("calendario.itens")
    .where("id", "=", id)
    .returning("id")
    .execute();
}

/** Marca como feito ou reabre: calendario.concluir() confere quem pode. */
export async function concluir(
  tx: Tx,
  id: string,
  feito: boolean,
): Promise<void> {
  await sql`select calendario.concluir(${id}::uuid, ${feito})`.execute(tx);
}
