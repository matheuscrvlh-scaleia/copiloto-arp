import { sql, type Updateable } from "kysely";
import type { Tx } from "@/infra/banco";
import type {
  OperacoesEnergiaUnidades,
  OperacoesParametros,
} from "@/infra/banco/tipos";

// Gravações de Parâmetros de Operações: a linha única (com a sessão; o RLS
// decide), os dados de exemplo e as unidades consumidoras da Energisa.

export type Parametros = Updateable<OperacoesParametros>;
type Unidade = Omit<Updateable<OperacoesEnergiaUnidades>, "matricula">;

/** Linhas alteradas (0 quando o RLS não deixou). */
export async function salvar(tx: Tx, linha: Parametros): Promise<number> {
  const r = await tx
    .updateTable("operacoes.parametros")
    .set(linha)
    .where("id", "=", true)
    .executeTakeFirst();
  return Number(r.numUpdatedRows);
}

export async function removerExemplos(tx: Tx): Promise<void> {
  await sql`select operacoes.remover_exemplos()`.execute(tx);
}

export function inserirUnidade(tx: Tx, u: Unidade & { matricula: string }) {
  return tx
    .insertInto("operacoes.energia_unidades")
    .values(u)
    .returning("matricula")
    .execute();
}

export function alterarUnidade(tx: Tx, matricula: string, u: Unidade) {
  return tx
    .updateTable("operacoes.energia_unidades")
    .set(u)
    .where("matricula", "=", matricula)
    .returning("matricula")
    .execute();
}
