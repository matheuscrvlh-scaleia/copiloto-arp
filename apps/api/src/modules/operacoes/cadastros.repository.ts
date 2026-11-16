import type { Insertable } from "kysely";
import type { Tx } from "@/infra/banco";
import type { OperacoesHidrometros, OperacoesSalas } from "@/infra/banco/tipos";

// Gravações dos cadastros de Operações (hidrômetros e salas da energia).
// Com a sessão: o RLS confere de novo e o gatilho audita.

type Hidrometro = Omit<Insertable<OperacoesHidrometros>, "id">;
type Sala = Omit<Insertable<OperacoesSalas>, "id">;

export async function idDaSala(tx: Tx, codigo: string) {
  const s = await tx
    .selectFrom("operacoes.salas")
    .select("id")
    .where("codigo", "=", codigo)
    .executeTakeFirst();
  return s?.id ?? null;
}

export function inserirHidrometro(tx: Tx, h: Hidrometro) {
  return tx
    .insertInto("operacoes.hidrometros")
    .values(h)
    .returning("id")
    .execute();
}

export function alterarHidrometro(tx: Tx, id: string, h: Hidrometro) {
  return tx
    .updateTable("operacoes.hidrometros")
    .set(h)
    .where("id", "=", id)
    .returning("id")
    .execute();
}

export function excluirHidrometro(tx: Tx, id: string) {
  return tx
    .deleteFrom("operacoes.hidrometros")
    .where("id", "=", id)
    .returning("numero")
    .execute();
}

export function inserirSala(tx: Tx, s: Sala) {
  return tx.insertInto("operacoes.salas").values(s).returning("id").execute();
}

export function alterarSala(tx: Tx, id: string, s: Sala) {
  return tx
    .updateTable("operacoes.salas")
    .set(s)
    .where("id", "=", id)
    .returning("id")
    .execute();
}

export function excluirSala(tx: Tx, id: string) {
  return tx
    .deleteFrom("operacoes.salas")
    .where("id", "=", id)
    .returning("codigo")
    .execute();
}
