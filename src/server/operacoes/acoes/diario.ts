"use server";

import { after } from "next/server";
import type { EstadoAcao } from "@/components/form-acao";
import { createAdminClient } from "@/lib/supabase/admin";
import { podeAgora } from "@/server/auth";
import { diarioDeObras } from "@/server/integracoes";
import { logOperacoes } from "@/server/operacoes/historico";
import {
  RECURSO_DIARIO,
  SISTEMA_DIARIO,
  sincronizarDiario,
} from "@/server/sync/diario-de-obras";
import { pedidoManual } from "@/server/sync/diario-de-obras-regras";
import { SyncEmAndamento } from "@/server/sync/execucao";

/**
 * "Atualizar agora": consulta o aplicativo Diário de Obra depois de
 * responder (pode levar minutos). Uma consulta por vez (trava da
 * sync_runs) e um intervalo mínimo desde a última, para não gastar a cota
 * de 150 consultas por minuto da empresa.
 */
export async function atualizarDiarioAgora(
  _: EstadoAcao,
  _form: FormData,
): Promise<EstadoAcao> {
  if (!(await podeAgora("operacoes.obras.atualizar")))
    return { erro: "Sem permissão para atualizar o Diário de Obra." };
  try {
    await diarioDeObras();
  } catch (erro) {
    return {
      erro:
        erro instanceof Error
          ? `${erro.message}.`
          : "Configure o Diário de Obra em Administração › Integrações.",
    };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("integracao")
    .from("sync_runs")
    .select("id, status, iniciado_em, finalizado_em")
    .eq("sistema", SISTEMA_DIARIO)
    .eq("recurso", RECURSO_DIARIO)
    .order("iniciado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error)
    return { erro: "Não deu para ler a última consulta. Tente de novo." };
  const pedido = pedidoManual(data, new Date());
  if (!pedido.pode)
    return {
      erro:
        pedido.motivo === "andamento"
          ? "Já há uma consulta em andamento. Aguarde terminar."
          : `A última consulta terminou há pouco. Tente de novo em ${pedido.faltaMin} min.`,
    };
  if (pedido.interrompida && data) {
    // A consulta morreu no meio: fica registrada como erro (como executar()
    // faz) para liberar a trava da sync_runs. Só a que ainda está "rodando".
    const { error: erroMarca } = await admin
      .schema("integracao")
      .from("sync_runs")
      .update({
        status: "erro",
        finalizado_em: new Date().toISOString(),
        erro: "interrompida (timeout)",
      })
      .eq("id", data.id)
      .eq("status", "rodando");
    if (erroMarca)
      return {
        erro: "Não deu para liberar a consulta anterior. Tente de novo.",
      };
  }

  await logOperacoes(
    "operacoes_diario_atualizado",
    "Pediu a atualização do Diário de Obra",
    { sistema: SISTEMA_DIARIO },
  );
  after(async () => {
    try {
      await sincronizarDiario();
    } catch (erro) {
      // Outra consulta começou ao mesmo tempo: a trava segurou, nada a fazer.
      if (erro instanceof SyncEmAndamento) return;
      // O erro fica registrado em integracao.sync_runs (aviso no topo das telas).
      console.error("sync diário de obra (manual)", erro);
    }
  });
  return {
    ok: "Consulta ao Diário de Obra iniciada. Leva alguns minutos; recarregue a tela para ver os dados novos.",
  };
}
