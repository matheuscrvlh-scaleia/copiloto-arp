"use client";

import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { reabrirAno } from "@/server/sustentabilidade/acoes/painel";

/** "Reabrir" um ano fechado, com o motivo (fica no histórico). */
export function ReabrirAno({ ano }: { ano: number }) {
  return (
    <details className="group w-fit text-sm">
      <summary className="cursor-pointer list-none rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 transition hover:border-neutral-400 group-open:hidden">
        Reabrir
      </summary>
      <FormAcao
        acao={reabrirAno}
        rotulo={`Reabrir ${ano}`}
        rotuloEnviando="Reabrindo…"
        variante="secundario"
        className="flex min-w-64 flex-col gap-2"
      >
        <input type="hidden" name="ano" value={ano} />
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
          Motivo da reabertura
          <textarea
            name="motivo"
            required
            minLength={5}
            maxLength={500}
            rows={2}
            placeholder="Ex.: faltava lançar uma coleta de dezembro"
            className={classeCampo}
          />
        </label>
      </FormAcao>
    </details>
  );
}
