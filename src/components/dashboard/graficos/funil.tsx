"use client";

import { useMontado } from "./base";
import { formatar, type Unidade } from "./series";

// Funil: etapas em barras deitadas que afinam, com a passagem de uma etapa
// para a seguinte escrita entre elas (onde está o gargalo).

export function Funil({
  etapas,
  unidade = "numero",
  descricao,
}: {
  etapas: { chave: string; rotulo: string; valor: number; detalhe?: string }[];
  unidade?: Unidade;
  descricao: string;
}) {
  const montado = useMontado();
  const max = Math.max(...etapas.map((e) => e.valor), 1);
  return (
    <ol className="flex flex-col gap-1" aria-label={descricao}>
      {etapas.map((e, k) => {
        const anterior = etapas[k - 1];
        const passagem =
          anterior && anterior.valor > 0
            ? (e.valor / anterior.valor) * 100
            : null;
        return (
          <li key={e.chave} className="flex flex-col gap-1">
            {passagem !== null && (
              <span className="pl-1 text-[11px] text-neutral-500">
                ↓ {formatar(passagem, "pct")} passam para a etapa seguinte
              </span>
            )}
            <div className="flex items-center gap-3">
              <div className="relative h-9 flex-1 overflow-hidden rounded-full bg-neutral-900/[0.05]">
                <span
                  className="absolute inset-y-0 left-0 rounded-full motion-reduce:transition-none"
                  style={{
                    width: montado
                      ? `${Math.max((e.valor / max) * 100, 1.5)}%`
                      : "0%",
                    backgroundColor: `color-mix(in oklab, var(--serie-1) ${100 - k * 14}%, transparent)`,
                    transition: `width 700ms cubic-bezier(.2,.8,.2,1) ${k * 80}ms`,
                  }}
                />
                <span className="absolute inset-y-0 left-3 flex items-center text-sm font-medium text-neutral-900 mix-blend-normal">
                  <span className="rounded-full bg-white/80 px-2 py-0.5 backdrop-blur">
                    {e.rotulo}
                  </span>
                </span>
              </div>
              <span className="w-24 text-right text-sm font-semibold tabular-nums">
                {formatar(e.valor, unidade)}
                {e.detalhe && (
                  <span className="block text-[11px] font-normal text-neutral-500">
                    {e.detalhe}
                  </span>
                )}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
