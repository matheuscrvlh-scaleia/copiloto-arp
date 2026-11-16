import { createHash } from "node:crypto";
import { ErroDeConflito } from "@/erros";
import { banco } from "@/infra/banco";
import type { JsonValue } from "@/infra/banco/tipos";
import * as repo from "./execucao.repository";

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
  cursor?: JsonValue;
}

/**
 * Registra a execução em integracao.sync_runs, impede duas ao mesmo tempo
 * (índice único) e só avança o cursor em caso de sucesso. Cada gravação é
 * um escopo próprio: a tarefa chama os sistemas externos fora deles.
 */
export async function executar<T extends ResultadoExecucao>(
  sistema: string,
  recurso: string,
  tarefa: (runId: string) => Promise<T>,
): Promise<T & { runId: string }> {
  let runId: string;
  try {
    runId = await banco.comoServico(async (tx) => {
      await repo.marcarInterrompidas(
        tx,
        sistema,
        recurso,
        new Date(Date.now() - TIMEOUT_MS).toISOString(),
      );
      const anterior = await repo.cursor(tx, sistema, recurso);
      return repo.iniciar(tx, sistema, recurso, anterior ?? null);
    });
  } catch (erro) {
    if (erro instanceof ErroDeConflito)
      throw new SyncEmAndamento(sistema, recurso);
    throw erro;
  }

  try {
    const resultado = await tarefa(runId);
    await banco.comoServico(async (tx) => {
      await repo.concluir(
        tx,
        runId,
        resultado.registros,
        resultado.cursor ?? null,
      );
      if (resultado.cursor !== undefined)
        await repo.gravarCursor(tx, sistema, recurso, resultado.cursor);
    });
    return { ...resultado, runId };
  } catch (erro) {
    await banco.comoServico((tx) =>
      repo.falhar(tx, runId, mensagemDoErro(erro).slice(0, 2000)),
    );
    throw erro;
  }
}

function mensagemDoErro(erro: unknown): string {
  if (erro instanceof Error) return erro.message;
  if (typeof erro === "object" && erro && "message" in erro)
    return String(erro.message);
  return String(erro);
}

/** Guarda o payload validado em integracao.registros_brutos. */
export async function guardarBrutos(
  sistema: string,
  recurso: string,
  runId: string,
  itens: { chave: string; payload: unknown }[],
): Promise<void> {
  const recebidoEm = new Date().toISOString();
  const linhas = itens.map(({ chave, payload }) => {
    const json = JSON.stringify(payload);
    return {
      sistema,
      recurso,
      chave_externa: chave,
      payload: json,
      hash: createHash("sha256").update(json).digest("hex"),
      sync_run_id: runId,
      recebido_em: recebidoEm,
    };
  });
  for (const lote of emLotes(linhas, 500))
    await banco.comoServico((tx) => repo.gravarBrutos(tx, lote));
}

/** O cursor guardado (integracao.cursores), ou undefined. */
export function lerCursor(
  sistema: string,
  recurso: string,
): Promise<JsonValue | undefined> {
  return banco.comoServico((tx) => repo.cursor(tx, sistema, recurso));
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
      const item = itens[i];
      if (item === undefined) continue;
      try {
        resultados[i] = { status: "fulfilled", value: await tarefa(item) };
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
