import "server-only";
import { createHash } from "node:crypto";
import type { AdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

/** Execução "rodando" há mais tempo que isso é considerada interrompida. */
const TIMEOUT_MS = 30 * 60_000;

export class SyncEmAndamento extends Error {
  constructor(sistema: string, recurso: string) {
    super(`já existe uma sincronização de ${sistema}/${recurso} rodando`);
    this.name = "SyncEmAndamento";
  }
}

export interface ResultadoExecucao {
  registros: number;
  /** Salvo em integracao.cursores só se a execução terminar com sucesso. */
  cursor?: Json;
}

/**
 * Registra a execução em integracao.sync_runs, impede duas ao mesmo tempo
 * (índice único) e só avança o cursor em caso de sucesso.
 */
export async function executar<T extends ResultadoExecucao>(
  admin: AdminClient,
  sistema: string,
  recurso: string,
  tarefa: (runId: string) => Promise<T>,
): Promise<T & { runId: string }> {
  const integracao = admin.schema("integracao");
  const agora = () => new Date().toISOString();

  await integracao
    .from("sync_runs")
    .update({
      status: "erro",
      finalizado_em: agora(),
      erro: "interrompida (timeout)",
    })
    .eq("sistema", sistema)
    .eq("recurso", recurso)
    .eq("status", "rodando")
    .lt("iniciado_em", new Date(Date.now() - TIMEOUT_MS).toISOString());

  const anterior = await integracao
    .from("cursores")
    .select("cursor")
    .eq("sistema", sistema)
    .eq("recurso", recurso)
    .maybeSingle();
  if (anterior.error) throw anterior.error;

  const inicio = await integracao
    .from("sync_runs")
    .insert({ sistema, recurso, cursor_antes: anterior.data?.cursor ?? null })
    .select("id")
    .single();
  if (inicio.error) {
    if (inicio.error.code === "23505")
      throw new SyncEmAndamento(sistema, recurso);
    throw inicio.error;
  }
  const runId = inicio.data.id;

  try {
    const resultado = await tarefa(runId);
    const fim = await integracao
      .from("sync_runs")
      .update({
        status: "sucesso",
        finalizado_em: agora(),
        registros: resultado.registros,
        cursor_depois: resultado.cursor ?? null,
      })
      .eq("id", runId);
    if (fim.error) throw fim.error;
    if (resultado.cursor !== undefined) {
      const cursor = await integracao.from("cursores").upsert({
        sistema,
        recurso,
        cursor: resultado.cursor,
        atualizado_em: agora(),
      });
      if (cursor.error) throw cursor.error;
    }
    return { ...resultado, runId };
  } catch (erro) {
    await integracao
      .from("sync_runs")
      .update({
        status: "erro",
        finalizado_em: agora(),
        erro: (erro instanceof Error ? erro.message : String(erro)).slice(
          0,
          2000,
        ),
      })
      .eq("id", runId);
    throw erro;
  }
}

/** Guarda o payload validado em integracao.registros_brutos. */
export async function guardarBrutos(
  admin: AdminClient,
  sistema: string,
  recurso: string,
  runId: string,
  itens: { chave: string; payload: unknown }[],
) {
  const linhas = itens.map(({ chave, payload }) => ({
    sistema,
    recurso,
    chave_externa: chave,
    payload: payload as Json,
    hash: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
    sync_run_id: runId,
    recebido_em: new Date().toISOString(),
  }));
  for (const lote of emLotes(linhas, 500)) {
    const { error } = await admin
      .schema("integracao")
      .from("registros_brutos")
      .upsert(lote, { onConflict: "sistema,recurso,chave_externa" });
    if (error) throw error;
  }
}

export function emLotes<T>(itens: T[], tamanho: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    lotes.push(itens.slice(i, i + tamanho));
  }
  return lotes;
}

/** Roda `tarefa` em todos os itens, no máximo `limite` ao mesmo tempo. */
export async function emParalelo<T, R>(
  itens: T[],
  limite: number,
  tarefa: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const resultados: PromiseSettledResult<R>[] = new Array(itens.length);
  let proximo = 0;
  async function trabalhador() {
    while (proximo < itens.length) {
      const i = proximo++;
      try {
        resultados[i] = {
          status: "fulfilled",
          value: await tarefa(itens[i] as T),
        };
      } catch (reason) {
        resultados[i] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limite, itens.length) }, trabalhador),
  );
  return resultados;
}
