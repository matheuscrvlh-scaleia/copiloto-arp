import "server-only";
import { mensagemSegura } from "@/connectors/http";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { wps as criarClienteWps } from "../integracoes";
import { emParalelo, executar, guardarBrutos } from "./execucao";
import {
  type DiaEstacionamento,
  dataLocal,
  diasParaSincronizar,
  linhasDoDia,
  pagamentosSemPlaca,
  semRepetirEntreDias,
} from "./wps-regras";

const SISTEMA = "wps";

export interface OpcoesWps {
  hoje?: Date;
  /** Força os dias ("aaaa-mm-dd"), ex.: reprocessar setembro. */
  dias?: string[];
}

export interface ResultadoWps {
  estacionamento: number;
  dias: number;
  pagamentos: number;
  entradas: number;
  saidas: number;
  avisos: string[];
}

/**
 * Traz da WPS, para cada dia, os pagamentos (sem repetição) e as entradas e
 * saídas por tipo de veículo, e troca esses dias no banco de uma vez. Dia
 * que falhar fica como estava e vira aviso.
 */
export async function sincronizarWps(opcoes: OpcoesWps = {}) {
  const admin = createAdminClient();
  const api = await criarClienteWps();
  const dias = opcoes.dias ?? diasParaSincronizar(opcoes.hoje ?? new Date());

  return executar(admin, SISTEMA, "estacionamento", async (runId) => {
    const avisos: string[] = [];

    const resultados = await emParalelo(dias, 3, async (dia) => {
      const data = dataLocal(dia);
      const [pagamentos, entradas, saidas] = await Promise.all([
        api.pagamentos(data),
        api.entradas(data),
        api.saidas(data),
      ]);
      return { dia, pagamentos, entradas, saidas };
    });

    const lidos: DiaEstacionamento[] = [];
    const brutos = [];
    for (const [i, r] of resultados.entries()) {
      if (r.status === "rejected") {
        avisos.push(
          `${dias[i]}: não lido (${mensagemSegura(r.reason).slice(0, 200)})`,
        );
        continue;
      }
      const { dia, pagamentos, entradas, saidas } = r.value;
      lidos.push(linhasDoDia(dia, pagamentos, entradas, saidas));
      brutos.push({
        chave: `${api.estacionamentoId}:${dia}`,
        payload: {
          pagamento: pagamentosSemPlaca(pagamentos),
          entrada: entradas,
          saida: saidas,
        },
      });
    }
    if (lidos.length === 0) {
      throw new Error(`nenhum dia lido da WPS (${avisos[0] ?? "sem dias"})`);
    }

    const { dias: gravar, repetidos } = semRepetirEntreDias(lidos);
    if (repetidos > 0) {
      avisos.push(
        `${repetidos} pagamentos listados em mais de um dia (ficaram no último)`,
      );
    }
    const { error } = await admin
      .schema("financeiro")
      .rpc("gravar_estacionamento", {
        p_estacionamento_id: api.estacionamentoId,
        p_dias: gravar as unknown as Json,
        p_sync_run_id: runId,
      });
    if (error) throw error;

    await guardarBrutos(admin, SISTEMA, "estacionamento_dia", runId, brutos);

    const soma = (f: (d: DiaEstacionamento) => number) =>
      gravar.reduce((s, d) => s + f(d), 0);
    const resultado: ResultadoWps = {
      estacionamento: api.estacionamentoId,
      dias: gravar.length,
      pagamentos: soma((d) => d.pagamentos.length),
      entradas: soma((d) => d.movimento.reduce((s, m) => s + m.entradas, 0)),
      saidas: soma((d) => d.movimento.reduce((s, m) => s + m.saidas, 0)),
      avisos,
    };
    return {
      ...resultado,
      registros: resultado.pagamentos,
      cursor: {
        executado_em: new Date().toISOString(),
        de: gravar[0]?.data ?? null,
        ate: gravar.at(-1)?.data ?? null,
        ...resultado,
      },
    };
  });
}
