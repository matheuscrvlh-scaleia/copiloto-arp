"use server";

import { refresh } from "next/cache";
import type { EstadoAcao } from "@/components/form-acao";
import { formatarMes } from "@/lib/formato";
import { podeAgora, usuarioAtual } from "@/server/auth";
import { registrarDepois } from "@/server/logs";
import { recalcularEmAberto } from "@/server/rh/custo";

/**
 * Recalcula o custo de todas as folhas em aberto (as fechadas ficam). O
 * cálculo usa a service role: a permissão é conferida agora no banco. O
 * registro no histórico sai depois da resposta.
 */
export async function recalcularCustos(
  _: EstadoAcao,
  _form: FormData,
): Promise<EstadoAcao> {
  const [folha, parametros] = await Promise.all([
    podeAgora("rh.folha"),
    podeAgora("rh.parametros"),
  ]);
  if (!folha && !parametros) {
    return { erro: "Você não tem permissão para recalcular o custo." };
  }
  try {
    const [feitos, usuario] = await Promise.all([
      recalcularEmAberto(),
      usuarioAtual(),
    ]);
    registrarDepois({
      modulo: "rh",
      evento: "custo_recalculado",
      descricao: feitos.length
        ? `Recalculou o custo de ${feitos.map((f) => formatarMes(f.competencia)).join(", ")}`
        : "Pediu o recálculo do custo (nenhuma folha em aberto)",
      usuarioId: usuario.id,
      detalhes: { competencias: feitos.map((f) => f.competencia) },
    });
    refresh();
    if (!feitos.length) return { ok: "Nenhuma folha em aberto para calcular." };
    return {
      ok: `Recalculado: ${feitos
        .map(
          (f) =>
            `${formatarMes(f.competencia)} (${f.pessoas} pessoas${f.comPendencia ? `, ${f.comPendencia} com pendência` : ""})`,
        )
        .join(", ")}.`,
    };
  } catch (e) {
    console.error("recálculo do custo", e);
    return { erro: "Não foi possível recalcular. Tente de novo." };
  }
}
