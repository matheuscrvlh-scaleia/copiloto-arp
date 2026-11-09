"use server";

import { after } from "next/server";
import type { EstadoAcao } from "@/components/form-acao";
import { createAdminClient } from "@/lib/supabase/admin";
import { podeAgora, usuarioAtual } from "@/server/auth";
import { diarioDeObras } from "@/server/integracoes";
import { registrarDepois } from "@/server/logs";
import {
  RECURSO_DIARIO,
  SISTEMA_DIARIO,
  sincronizarDiario,
} from "@/server/sync/diario-de-obras";
import { INTERVALO_MANUAL_MIN } from "@/server/sync/diario-de-obras-regras";
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

  const { data, error } = await createAdminClient()
    .schema("integracao")
    .from("sync_runs")
    .select("status, iniciado_em, finalizado_em")
    .eq("sistema", SISTEMA_DIARIO)
    .eq("recurso", RECURSO_DIARIO)
    .order("iniciado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error)
    return { erro: "Não deu para ler a última consulta. Tente de novo." };
  if (data?.status === "rodando")
    return { erro: "Já há uma consulta em andamento. Aguarde terminar." };
  const ultima = data?.finalizado_em ? Date.parse(data.finalizado_em) : 0;
  const faltaMin = Math.ceil(
    INTERVALO_MANUAL_MIN - (Date.now() - ultima) / 60_000,
  );
  if (faltaMin > 0)
    return {
      erro: `A última consulta terminou há pouco. Tente de novo em ${faltaMin} min.`,
    };

  registrarDepois({
    modulo: "integracoes",
    evento: "sincronizacao_pedida",
    descricao: "Pediu a atualização do Diário de Obra",
    usuarioId: (await usuarioAtual()).id,
    detalhes: { sistema: SISTEMA_DIARIO },
  });
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
