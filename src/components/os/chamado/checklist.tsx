"use client";

import { Check } from "lucide-react";
import { useActionState, useOptimistic, useTransition } from "react";
import { formatarDataHora } from "@/lib/formato";
import type { ItemChecklist } from "@/lib/os/chamado";
import { marcarChecklist } from "@/server/os/acoes/chamados";

// Checklist do chamado: tocar no item marca (com quem e quando). Item
// obrigatório pendente impede concluir. Marca na hora e confirma no
// servidor; se falhar, volta e mostra o erro.

export function Checklist({
  id,
  itens,
  nomes,
  editavel,
}: {
  id: string;
  itens: ItemChecklist[];
  nomes: Record<string, string>;
  editavel: boolean;
}) {
  const [estado, executar] = useActionState(marcarChecklist, {});
  const [, iniciar] = useTransition();
  const [otimista, marcar] = useOptimistic(
    itens,
    (atual, { indice, feito }: { indice: number; feito: boolean }) =>
      atual.map((i, k) => (k === indice ? { ...i, feito } : i)),
  );
  const feitos = otimista.filter((i) => i.feito).length;

  function alternar(indice: number, feito: boolean) {
    const form = new FormData();
    form.set("id", id);
    form.set("indice", String(indice));
    form.set("feito", feito ? "1" : "0");
    iniciar(() => {
      marcar({ indice, feito });
      executar(form);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div
          role="progressbar"
          aria-label="Checklist"
          aria-valuemin={0}
          aria-valuemax={otimista.length}
          aria-valuenow={feitos}
          className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-900/[0.07]"
        >
          <div
            className="h-full rounded-full bg-marca transition-[width]"
            style={{
              width: `${(feitos / Math.max(1, otimista.length)) * 100}%`,
            }}
          />
        </div>
        <span className="text-xs font-medium tabular-nums text-neutral-600">
          {feitos} de {otimista.length}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {otimista.map((item, k) => (
          <li key={`${k}-${item.texto}`}>
            <button
              type="button"
              disabled={!editavel}
              aria-pressed={item.feito}
              onClick={() => alternar(k, !item.feito)}
              className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-neutral-900/[0.06] bg-white/60 px-3 py-2 text-left transition enabled:hover:border-neutral-900/20 disabled:cursor-default"
            >
              <span
                aria-hidden
                className={`grid size-6 shrink-0 place-items-center rounded-lg border-2 transition ${item.feito ? "border-marca bg-marca text-[#fff]" : "border-neutral-300"}`}
              >
                {item.feito && <Check className="size-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm ${item.feito ? "text-neutral-500 line-through" : "text-neutral-900"}`}
                >
                  {item.texto}
                  {item.obrigatorio && !item.feito && (
                    <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 no-underline">
                      Obrigatório
                    </span>
                  )}
                </span>
                {item.feito && item.por && item.em && (
                  <span className="block text-xs text-neutral-500">
                    {nomes[item.por] ?? "Alguém"} · {formatarDataHora(item.em)}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {estado.erro && (
        <p role="alert" className="text-sm text-red-700">
          {estado.erro}
        </p>
      )}
    </div>
  );
}
