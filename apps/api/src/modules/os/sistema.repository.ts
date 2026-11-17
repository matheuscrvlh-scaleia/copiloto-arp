import type { Selectable } from "kysely";
import type { Tx } from "@/infra/banco";
import type { OsChamados, OsStatusChamado } from "@/infra/banco/tipos";

// Consultas dos chamados criados por outros módulos (origem 'modulo'). Só
// os.chamados (não OS); a `tx` é do escopo `comoServico` de quem chama.

const COLUNAS = [
  "id",
  "tipo",
  "numero",
  "titulo",
  "status",
  "prazo",
  "setor_id",
  "responsavel_id",
  "aberto_por",
  "pessoal",
  "precisa_confirmacao",
  "origem_modulo",
  "origem_ref",
] as const;

export type ChamadoDaOrigem = Pick<
  Selectable<OsChamados>,
  (typeof COLUNAS)[number]
>;

export function abertoDaOrigem(
  tx: Tx,
  modulo: string,
  ref: string,
  status: readonly OsStatusChamado[],
): Promise<ChamadoDaOrigem | undefined> {
  return tx
    .selectFrom("os.chamados")
    .select(COLUNAS)
    .where("origem_modulo", "=", modulo)
    .where("origem_ref", "=", ref)
    .where("status", "in", status)
    .orderBy("criado_em")
    .limit(1)
    .executeTakeFirst();
}

export function porId(
  tx: Tx,
  id: string,
): Promise<ChamadoDaOrigem | undefined> {
  return tx
    .selectFrom("os.chamados")
    .select(COLUNAS)
    .where("id", "=", id)
    .executeTakeFirst();
}

/** Só grava se o status ainda é o lido. Devolve se mudou alguma linha. */
export async function mudarSeAinda(
  tx: Tx,
  id: string,
  statusLido: OsStatusChamado,
  patch: {
    status: OsStatusChamado;
    solucao?: string | null;
    concluido_por?: string | null;
    motivo_cancelamento?: string;
  },
): Promise<boolean> {
  const r = await tx
    .updateTable("os.chamados")
    .set(patch)
    .where("id", "=", id)
    .where("status", "=", statusLido)
    .executeTakeFirst();
  return r.numUpdatedRows > 0n;
}
