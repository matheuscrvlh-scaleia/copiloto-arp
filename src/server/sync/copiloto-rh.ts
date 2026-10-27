import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { copilotoRh as criarClienteCopiloto } from "../integracoes";
import { recalcularEmAberto, tentarRecalcular } from "../rh/custo";
import { lerTudo } from "../supabase-paginas";
import { planejarCopiloto, planejarDependentes } from "./copiloto-rh-regras";
import { emLotes, executar, guardarBrutos } from "./execucao";

const SISTEMA = "copiloto_rh";

export interface ResultadoCopiloto {
  colaboradores: number;
  novos: number;
  ativos: number;
  desligados: number;
  /** Null: a leitura dos dependentes falhou (o motivo vai nos avisos). */
  dependentes: number | null;
  avisos: string[];
}

/**
 * Traz do Copiloto RH todos os colaboradores (todas as situações) e grava o
 * que é dele em rh.colaboradores (regras em copiloto-rh-regras.ts). Depois,
 * os dependentes: a lista inteira, tirando quem sumiu de lá.
 */
export async function sincronizarCopiloto() {
  const admin = createAdminClient();
  const api = await criarClienteCopiloto();
  const rh = admin.schema("rh");

  return executar(admin, SISTEMA, "rh", async (runId) => {
    const copiloto = await api.colaboradores();
    // Todos os colaboradores (ativos e desligados): de mil em mil.
    const existentes = await lerTudo(() =>
      rh
        .from("colaboradores")
        .select("id, matricula, copiloto_id, tipo_contrato")
        .order("id"),
    );

    const { linhas, valoresPj, novos, avisos } = planejarCopiloto(
      copiloto,
      existentes,
      randomUUID,
    );
    for (const lote of emLotes(linhas, 500)) {
      const { error } = await rh
        .from("colaboradores")
        .upsert(lote, { onConflict: "id" });
      if (error) throw error;
    }

    // Valor do PJ: troca tudo (quem deixou de ser PJ ou ficou sem Salário sai).
    // Os que saem vão pelo id, em lotes: um "not in" com todos os PJs na URL
    // cresce com o quadro.
    const comValor = new Set(valoresPj.map((v) => v.colaborador_id));
    const atuais = await lerTudo(() =>
      rh.from("valores_pj").select("colaborador_id").order("colaborador_id"),
    );
    const sair = atuais
      .map((v) => v.colaborador_id)
      .filter((id) => !comValor.has(id));
    for (const lote of emLotes(sair, 200)) {
      const { error } = await rh
        .from("valores_pj")
        .delete()
        .in("colaborador_id", lote);
      if (error) throw error;
    }
    for (const lote of emLotes(valoresPj, 500)) {
      const { error } = await rh.from("valores_pj").upsert(
        lote.map((v) => ({ ...v, sync_run_id: runId })),
        { onConflict: "colaborador_id" },
      );
      if (error) throw error;
    }

    // O bruto guarda o que o conector validou, menos o salário: o do PJ já
    // está em rh.valores_pj e o dos outros não é usado.
    await guardarBrutos(
      admin,
      SISTEMA,
      "colaboradores",
      runId,
      copiloto.map(({ compensation: _, ...c }) => ({
        chave: c.id,
        payload: c,
      })),
    );

    // Falha nos dependentes não derruba as pessoas nem apaga o que já veio.
    let dependentes: number | null = null;
    try {
      dependentes = await gravarDependentes(
        admin,
        api,
        linhas,
        avisos,
        (itens) => guardarBrutos(admin, SISTEMA, "dependentes", runId, itens),
      );
    } catch (erro) {
      avisos.push(
        `Dependentes não sincronizados: ${erro instanceof Error ? erro.message : String(erro)}`,
      );
    }

    const resultado: ResultadoCopiloto = {
      colaboradores: copiloto.length,
      novos,
      ativos: copiloto.filter((c) => c.status === "active").length,
      desligados: copiloto.filter((c) => c.status === "terminated").length,
      dependentes,
      avisos,
    };
    // Contrato e valor do PJ mudam o custo das folhas em aberto.
    await tentarRecalcular(recalcularEmAberto);
    return {
      ...resultado,
      registros: linhas.length,
      cursor: { executado_em: new Date().toISOString(), ...resultado },
    };
  });
}

async function gravarDependentes(
  admin: ReturnType<typeof createAdminClient>,
  api: Awaited<ReturnType<typeof criarClienteCopiloto>>,
  colaboradores: Parameters<typeof planejarDependentes>[1],
  avisos: string[],
  guardar: (itens: { chave: string; payload: unknown }[]) => Promise<void>,
): Promise<number> {
  const rh = admin.schema("rh");
  const copiloto = await api.dependentes();
  const plano = planejarDependentes(copiloto, colaboradores);
  avisos.push(...plano.avisos);
  for (const lote of emLotes(plano.linhas, 500)) {
    const { error } = await rh
      .from("dependentes")
      .upsert(lote, { onConflict: "copiloto_id" });
    if (error) throw error;
  }

  const atuais = await lerTudo(() =>
    rh.from("dependentes").select("copiloto_id").order("copiloto_id"),
  );
  const manter = new Set(plano.linhas.map((l) => l.copiloto_id));
  const sairam = atuais
    .map((d) => d.copiloto_id)
    .filter((id) => !manter.has(id));
  for (const lote of emLotes(sairam, 200)) {
    const { error } = await rh
      .from("dependentes")
      .delete()
      .in("copiloto_id", lote);
    if (error) throw error;
  }

  await guardar(copiloto.map((d) => ({ chave: d.id, payload: d })));
  return plano.linhas.length;
}
