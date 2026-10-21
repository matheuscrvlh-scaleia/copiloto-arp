import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { copilotoRh as criarClienteCopiloto } from "../integracoes";
import { planejarCopiloto } from "./copiloto-rh-regras";
import { emLotes, executar, guardarBrutos } from "./execucao";

const SISTEMA = "copiloto_rh";

export interface ResultadoCopiloto {
  colaboradores: number;
  novos: number;
  ativos: number;
  desligados: number;
  avisos: string[];
}

/**
 * Traz do Copiloto RH todos os colaboradores (todas as situações) e grava o
 * que é dele em rh.colaboradores (regras em copiloto-rh-regras.ts).
 */
export async function sincronizarCopiloto() {
  const admin = createAdminClient();
  const api = await criarClienteCopiloto();
  const rh = admin.schema("rh");

  return executar(admin, SISTEMA, "rh", async (runId) => {
    const copiloto = await api.colaboradores();
    const existentes = await rh
      .from("colaboradores")
      .select("id, matricula, copiloto_id, tipo_contrato");
    if (existentes.error) throw existentes.error;

    const { linhas, novos, avisos } = planejarCopiloto(
      copiloto,
      existentes.data,
      randomUUID,
    );
    for (const lote of emLotes(linhas, 500)) {
      const { error } = await rh
        .from("colaboradores")
        .upsert(lote, { onConflict: "id" });
      if (error) throw error;
    }

    await guardarBrutos(
      admin,
      SISTEMA,
      "colaboradores",
      runId,
      copiloto.map((c) => ({ chave: c.id, payload: c })),
    );

    const resultado: ResultadoCopiloto = {
      colaboradores: copiloto.length,
      novos,
      ativos: copiloto.filter((c) => c.status === "active").length,
      desligados: copiloto.filter((c) => c.status === "terminated").length,
      avisos,
    };
    return {
      ...resultado,
      registros: linhas.length,
      cursor: { executado_em: new Date().toISOString(), ...resultado },
    };
  });
}
