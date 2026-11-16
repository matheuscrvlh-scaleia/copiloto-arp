import { randomUUID } from "node:crypto";
import type { CopilotoRhClient } from "@/connectors/copiloto-rh/client";
import { banco } from "@/infra/banco";
import {
  recalcularEmAberto,
  tentarRecalcular,
} from "@/modules/rh/custo.service";
import {
  type LinhaCopiloto,
  planejarCopiloto,
  planejarDependentes,
} from "./copiloto-rh.regras";
import * as repo from "./copiloto-rh.repository";
import { copilotoRh as criarClienteCopiloto } from "./credenciais.service";
import { emLotes, executar, guardarBrutos } from "./execucao.service";

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
 * que é dele em rh.colaboradores (regras em copiloto-rh.regras.ts). Depois,
 * os dependentes: a lista inteira, tirando quem sumiu de lá.
 */
export async function sincronizarCopiloto() {
  const api = await criarClienteCopiloto();

  return executar(SISTEMA, "rh", async (runId) => {
    const copiloto = await api.colaboradores();
    const existentes = await banco.comoServico(repo.colaboradores);

    const { linhas, valoresPj, novos, avisos } = planejarCopiloto(
      copiloto,
      existentes,
      randomUUID,
    );
    for (const lote of emLotes(linhas, 500))
      await banco.comoServico((tx) => repo.gravarColaboradores(tx, lote));

    // Valor do PJ: troca tudo (quem deixou de ser PJ ou ficou sem Salário sai).
    const comValor = new Set(valoresPj.map((v) => v.colaborador_id));
    const atuais = await banco.comoServico(repo.colaboradoresComValorPj);
    const sair = atuais.filter((id) => !comValor.has(id));
    for (const lote of emLotes(sair, 200))
      await banco.comoServico((tx) => repo.removerValoresPj(tx, lote));
    for (const lote of emLotes(valoresPj, 500))
      await banco.comoServico((tx) =>
        repo.gravarValoresPj(
          tx,
          lote.map((v) => ({ ...v, sync_run_id: runId })),
        ),
      );

    // O bruto guarda o que o conector validou, menos o salário: o do PJ já
    // está em rh.valores_pj e o dos outros não é usado.
    await guardarBrutos(
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
      dependentes = await gravarDependentes(api, linhas, avisos, (itens) =>
        guardarBrutos(SISTEMA, "dependentes", runId, itens),
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
    await tentarRecalcular(() => recalcularEmAberto());
    return {
      ...resultado,
      registros: linhas.length,
      cursor: { executado_em: new Date().toISOString(), ...resultado },
    };
  });
}

async function gravarDependentes(
  api: CopilotoRhClient,
  colaboradores: Pick<LinhaCopiloto, "id" | "copiloto_id" | "matricula">[],
  avisos: string[],
  guardar: (itens: { chave: string; payload: unknown }[]) => Promise<void>,
): Promise<number> {
  const copiloto = await api.dependentes();
  const plano = planejarDependentes(copiloto, colaboradores);
  avisos.push(...plano.avisos);
  for (const lote of emLotes(plano.linhas, 500))
    await banco.comoServico((tx) => repo.gravarDependentes(tx, lote));

  const atuais = await banco.comoServico(repo.dependentes);
  const manter = new Set(plano.linhas.map((l) => l.copiloto_id));
  const sairam = atuais.filter((id) => !manter.has(id));
  for (const lote of emLotes(sairam, 200))
    await banco.comoServico((tx) => repo.removerDependentes(tx, lote));

  await guardar(copiloto.map((d) => ({ chave: d.id, payload: d })));
  return plano.linhas.length;
}
