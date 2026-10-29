"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** Amostra grande de uma cor da marca, com HEX e RGB para copiar. */
export function AmostraCor({
  nome,
  hex,
  rgb,
  uso,
  textoEscuro,
}: {
  nome: string;
  hex: string;
  rgb: string;
  uso?: string;
  textoEscuro: boolean;
}) {
  const [copiado, setCopiado] = useState<string | null>(null);
  const copiar = async (valor: string) => {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(valor);
      setTimeout(() => setCopiado(null), 1500);
    } catch {
      // Navegador sem permissão de área de transferência: o código está à vista.
    }
  };
  return (
    <figure className="overflow-hidden rounded-3xl border border-neutral-900/10 bg-white/70">
      <div
        className={`flex h-32 items-end p-4 ${textoEscuro ? "text-neutral-900" : "text-white"}`}
        style={{ backgroundColor: hex }}
      >
        <span className="text-lg font-semibold tracking-tight">{nome}</span>
      </div>
      <figcaption className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap gap-1.5">
          {[
            { rotulo: "HEX", valor: hex },
            { rotulo: "RGB", valor: rgb },
          ].map((c) => (
            <button
              key={c.rotulo}
              type="button"
              onClick={() => copiar(c.valor)}
              title={`Copiar ${c.rotulo}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1 font-mono text-xs text-neutral-800 transition hover:border-neutral-400"
            >
              <span className="font-sans text-[10px] font-semibold text-neutral-400">
                {c.rotulo}
              </span>
              {c.valor}
              {copiado === c.valor ? (
                <Check className="size-3 text-green-700" aria-label="Copiado" />
              ) : (
                <Copy className="size-3 text-neutral-400" aria-hidden />
              )}
            </button>
          ))}
        </div>
        {uso && <p className="text-xs text-neutral-600">{uso}</p>}
      </figcaption>
    </figure>
  );
}
