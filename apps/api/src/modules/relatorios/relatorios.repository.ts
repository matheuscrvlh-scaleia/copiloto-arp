import type { Tx } from "@/infra/banco";
import type { Json } from "@/infra/banco/tipos";

// Relatórios (formularios.formularios). Só consultas; com a sessão o RLS
// libera ler a quem tem formularios.ver ou formularios.editar e gravar a
// quem tem formularios.editar.

export function lista(tx: Tx) {
  return tx
    .selectFrom("formularios.formularios")
    .select([
      "id",
      "titulo",
      "situacao",
      "campos",
      "encerra_em",
      "limite_respostas",
      "total_respostas",
      "ultima_resposta_em",
      "atualizado_em",
      "criado_em",
    ])
    .orderBy("atualizado_em", "desc")
    .orderBy("id")
    .execute();
}

export function porId(tx: Tx, id: string) {
  return tx
    .selectFrom("formularios.formularios")
    .select([
      "id",
      "titulo",
      "descricao",
      "campos",
      "mensagem_final",
      "situacao",
      "token",
      "encerra_em",
      "limite_respostas",
      "total_respostas",
      "ultima_resposta_em",
      "criado_em",
      "publicado_em",
      "atualizado_em",
      "cor",
      "paginas",
      "redirecionar_para",
    ])
    .where("id", "=", id)
    .executeTakeFirst();
}

export interface Novo {
  titulo: string;
  descricao: string;
  campos: unknown;
  mensagem_final: string;
  criado_por: string;
  cor?: string;
  paginas?: boolean;
  redirecionar_para?: string | null;
}

export async function criar(tx: Tx, novo: Novo): Promise<string> {
  const r = await tx
    .insertInto("formularios.formularios")
    .values({ ...novo, campos: JSON.stringify(novo.campos) })
    .returning("id")
    .executeTakeFirstOrThrow();
  return r.id;
}

/** O que se altera de um relatório (`campos` é gravado como JSON). */
export interface Mudanca {
  titulo?: string;
  descricao?: string;
  campos?: unknown;
  mensagem_final?: string;
  encerra_em?: string | null;
  limite_respostas?: number | null;
  cor?: string;
  paginas?: boolean;
  redirecionar_para?: string | null;
  situacao?: string;
  publicado_em?: string | null;
  token?: string;
}

/** true se alterou (false: não existe ou o RLS não deixou). */
export async function alterar(
  tx: Tx,
  id: string,
  mudanca: Mudanca,
): Promise<boolean> {
  const { campos, ...resto } = mudanca;
  const valores: Omit<Mudanca, "campos"> & { campos?: Json } = resto;
  if (campos !== undefined) valores.campos = JSON.stringify(campos);
  const r = await tx
    .updateTable("formularios.formularios")
    .set(valores)
    .where("id", "=", id)
    .returning("id")
    .execute();
  return r.length > 0;
}

/** true se excluiu. Respostas saem junto (cascata no banco). */
export async function excluir(tx: Tx, id: string): Promise<boolean> {
  const r = await tx
    .deleteFrom("formularios.formularios")
    .where("id", "=", id)
    .returning("id")
    .execute();
  return r.length > 0;
}
