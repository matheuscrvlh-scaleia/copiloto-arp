import { sql } from "kysely";
import type { Tx } from "@/infra/banco";
import type {
  linhaDaLista,
  linhaDaObra,
  linhaDoDetalhe,
} from "./diario-de-obras.regras";

// Gravações da sincronização do Diário de Obra (operacoes.diario_*).

/** Tira os dados de exemplo; devolve quantas obras de exemplo havia. */
export async function removerExemplos(tx: Tx): Promise<number> {
  const r = await tx
    .deleteFrom("operacoes.diario_obras")
    .where("exemplo", "=", true)
    .executeTakeFirst();
  await tx
    .deleteFrom("operacoes.diario_relatorios")
    .where("exemplo", "=", true)
    .execute();
  return Number(r.numDeletedRows);
}

export function gravarCadastros(
  tx: Tx,
  empresa: unknown,
  cadastros: unknown,
  agora: string,
) {
  return tx
    .insertInto("operacoes.diario_cadastros")
    .values({
      id: true,
      empresa: JSON.stringify(empresa),
      cadastros: JSON.stringify(cadastros),
      atualizado_em: agora,
    })
    .onConflict((oc) =>
      oc.column("id").doUpdateSet((eb) => ({
        empresa: eb.ref("excluded.empresa"),
        cadastros: eb.ref("excluded.cadastros"),
        atualizado_em: eb.ref("excluded.atualizado_em"),
      })),
    )
    .execute();
}

export async function obras(tx: Tx): Promise<string[]> {
  const r = await tx
    .selectFrom("operacoes.diario_obras")
    .select("id")
    .execute();
  return r.map((o) => o.id);
}

export function removerObras(tx: Tx, ids: string[]) {
  return tx
    .deleteFrom("operacoes.diario_obras")
    .where("id", "in", ids)
    .execute();
}

/** Relatórios guardados da obra (todos, ou só os da janela). */
export function relatoriosDaObra(
  tx: Tx,
  obraId: string,
  janela: { desde: string; ate: string } | null,
) {
  let q = tx
    .selectFrom("operacoes.diario_relatorios")
    .select(["id", "status_id", "detalhado_em"])
    .where("obra_id", "=", obraId);
  if (janela)
    q = q.where("data", ">=", janela.desde).where("data", "<=", janela.ate);
  return q.orderBy("id").execute();
}

export function gravarObra(tx: Tx, linha: ReturnType<typeof linhaDaObra>) {
  const { dados, tarefas, lista_de_tarefas, ...colunas } = linha;
  const comCronograma = tarefas !== undefined;
  return tx
    .insertInto("operacoes.diario_obras")
    .values({
      ...colunas,
      dados: JSON.stringify(dados),
      ...(comCronograma && {
        tarefas: JSON.stringify(tarefas),
        lista_de_tarefas: JSON.stringify(lista_de_tarefas),
      }),
    })
    .onConflict((oc) =>
      oc.column("id").doUpdateSet((eb) => ({
        nome: eb.ref("excluded.nome"),
        status_id: eb.ref("excluded.status_id"),
        grupo: eb.ref("excluded.grupo"),
        responsavel: eb.ref("excluded.responsavel"),
        data_inicio: eb.ref("excluded.data_inicio"),
        data_fim: eb.ref("excluded.data_fim"),
        prazo_contratual: eb.ref("excluded.prazo_contratual"),
        prazo_decorrido: eb.ref("excluded.prazo_decorrido"),
        prazo_a_vencer: eb.ref("excluded.prazo_a_vencer"),
        dados: eb.ref("excluded.dados"),
        modificado_no_app: eb.ref("excluded.modificado_no_app"),
        atualizado_em: eb.ref("excluded.atualizado_em"),
        exemplo: eb.ref("excluded.exemplo"),
        // Sem cronograma (falhou ou a obra não tem): fica o anterior.
        ...(comCronograma && {
          realizado: eb.ref("excluded.realizado"),
          tarefas: eb.ref("excluded.tarefas"),
          lista_de_tarefas: eb.ref("excluded.lista_de_tarefas"),
        }),
      })),
    )
    .execute();
}

export function gravarRelatorios(
  tx: Tx,
  linhas: ReturnType<typeof linhaDaLista>[],
) {
  return tx
    .insertInto("operacoes.diario_relatorios")
    .values(linhas)
    .onConflict((oc) =>
      oc.column("id").doUpdateSet((eb) => ({
        obra_id: eb.ref("excluded.obra_id"),
        numero: eb.ref("excluded.numero"),
        data: eb.ref("excluded.data"),
        data_fim: eb.ref("excluded.data_fim"),
        status_id: eb.ref("excluded.status_id"),
        modelo: eb.ref("excluded.modelo"),
        modelo_id: eb.ref("excluded.modelo_id"),
        autor: eb.ref("excluded.autor"),
        autor_cargo: eb.ref("excluded.autor_cargo"),
        autor_id: eb.ref("excluded.autor_id"),
        app: eb.ref("excluded.app"),
        criado_no_app: eb.ref("excluded.criado_no_app"),
        atualizado_em: eb.ref("excluded.atualizado_em"),
        exemplo: eb.ref("excluded.exemplo"),
      })),
    )
    .execute();
}

export function removerRelatorios(tx: Tx, ids: string[]) {
  return tx
    .deleteFrom("operacoes.diario_relatorios")
    .where("id", "in", ids)
    .execute();
}

/** Relatórios ainda sem detalhe, os mais recentes primeiro. */
export function semDetalhe(tx: Tx, limite: number) {
  return tx
    .selectFrom("operacoes.diario_relatorios")
    .select(["id", "obra_id", "data"])
    .where("detalhado_em", "is", null)
    .orderBy("data", "desc")
    .limit(limite)
    .execute();
}

export function gravarDetalhe(
  tx: Tx,
  id: string,
  linha: ReturnType<typeof linhaDoDetalhe>,
) {
  return tx
    .updateTable("operacoes.diario_relatorios")
    .set({
      ...linha,
      dados: JSON.stringify(linha.dados),
      resumo: JSON.stringify(linha.resumo),
    })
    .where("id", "=", id)
    .execute();
}

export async function contarSemDetalhe(tx: Tx): Promise<number> {
  const r = await tx
    .selectFrom("operacoes.diario_relatorios")
    .select(sql<number>`count(*)::int`.as("total"))
    .where("detalhado_em", "is", null)
    .executeTakeFirstOrThrow();
  return r.total;
}

/** Intervalo da rotina nos Parâmetros de Operações (minutos). */
export async function intervaloDaRotina(tx: Tx): Promise<number> {
  const r = await tx
    .selectFrom("operacoes.parametros")
    .select("obras_intervalo_min")
    .where("id", "=", true)
    .executeTakeFirstOrThrow();
  return r.obras_intervalo_min;
}
