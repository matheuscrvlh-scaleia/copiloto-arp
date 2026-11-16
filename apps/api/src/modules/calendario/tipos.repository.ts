import type { EntradaTipo } from "@arp/shared/calendario/contratos";
import type { Tx } from "@/infra/banco";

// Tipos de item do calendário (calendario.tipos). Só consultas: quem chama
// decide o escopo (o RLS libera ler a quem vê ou configura, e gravar a quem
// configura).

const COLUNAS = [
  "id",
  "nome",
  "descricao",
  "cor",
  "icone",
  "usa_horario",
  "usa_periodo",
  "usa_local",
  "usa_responsavel",
  "usa_conclusao",
  "usa_recorrencia",
  "visibilidade_padrao",
  "ordem",
  "ativo",
] as const;

export function tipos(tx: Tx) {
  return tx
    .selectFrom("calendario.tipos")
    .select(COLUNAS)
    .orderBy("ordem")
    .orderBy("nome")
    .execute();
}

export function tipo(tx: Tx, id: string) {
  return tx
    .selectFrom("calendario.tipos")
    .select(COLUNAS)
    .where("id", "=", id)
    .executeTakeFirst();
}

/** Ids gravados (vazio: o RLS não deixou). */
export function criar(tx: Tx, linha: EntradaTipo) {
  return tx
    .insertInto("calendario.tipos")
    .values(linha)
    .returning("id")
    .execute();
}

export function atualizar(tx: Tx, id: string, linha: EntradaTipo) {
  return tx
    .updateTable("calendario.tipos")
    .set(linha)
    .where("id", "=", id)
    .returning("id")
    .execute();
}

export function excluir(tx: Tx, id: string) {
  return tx
    .deleteFrom("calendario.tipos")
    .where("id", "=", id)
    .returning("id")
    .execute();
}
