import { sql } from "kysely";
import pg from "pg";
import type { Tx } from "@/infra/banco";
import { erroDoBanco } from "@/infra/banco/erros";

// No sistema anterior cada gravação era um pedido solto: um passo opcional
// (destinos extras, horário da agenda, seguir o chamado) podia falhar sem
// desfazer o resto. Aqui o escopo é uma transação, e um erro do banco a
// derruba inteira. `tentar` isola o passo num savepoint: se falhar, só ele é
// desfeito e a transação segue.

export type Tentativa<T> =
  | { ok: true; valor: T }
  | {
      ok: false;
      erro: unknown;
      /** Código do Postgres (P0001, 42501, 23505…), quando o erro é dele. */
      codigo: string | null;
      /** Texto para a pessoa (as mesmas mensagens do escopo do banco). */
      mensagem: string;
    };

export async function tentar<T>(
  tx: Tx,
  fn: () => Promise<T>,
): Promise<Tentativa<T>> {
  await sql`savepoint tentativa`.execute(tx);
  try {
    const valor = await fn();
    await sql`release savepoint tentativa`.execute(tx);
    return { ok: true, valor };
  } catch (erro) {
    await sql`rollback to savepoint tentativa`.execute(tx);
    return {
      ok: false,
      erro,
      codigo: erro instanceof pg.DatabaseError ? (erro.code ?? null) : null,
      mensagem:
        erroDoBanco(erro)?.message ?? "Não foi possível salvar. Tente de novo.",
    };
  }
}
