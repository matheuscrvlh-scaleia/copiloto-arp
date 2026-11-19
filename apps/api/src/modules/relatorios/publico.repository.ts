import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Link público (/responder/<token>). Pela service role, só depois de o
// service conferir o formato do token: lê o formulário daquele token e
// grava a resposta por formularios.responder().

export function peloToken(tx: Tx, token: string) {
  return tx
    .selectFrom("formularios.formularios")
    .select([
      "id",
      "titulo",
      "descricao",
      "campos",
      "mensagem_final",
      "situacao",
      "encerra_em",
      "limite_respostas",
      "total_respostas",
      "cor",
      "paginas",
      "redirecionar_para",
    ])
    .where("token", "=", token)
    .executeTakeFirst();
}

/**
 * Grava a resposta. A função trava a linha e confere de novo situação, data
 * e limite: P0002 se o token não existe, P0001 se o link fechou.
 */
export async function responder(
  tx: Tx,
  token: string,
  respostas: unknown,
  perguntas: unknown,
): Promise<void> {
  await sql`select formularios.responder(p_token => ${token}, p_respostas => ${JSON.stringify(respostas)}::jsonb, p_perguntas => ${JSON.stringify(perguntas)}::jsonb)`.execute(
    tx,
  );
}
