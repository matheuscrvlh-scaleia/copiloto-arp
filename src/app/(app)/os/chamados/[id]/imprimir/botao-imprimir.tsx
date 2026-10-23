"use client";

import { Printer } from "lucide-react";

/** Abre a janela de impressão do navegador (lá também sai o PDF). */
export function BotaoImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-neutral-900 px-5 text-sm font-medium text-white transition hover:bg-neutral-800"
    >
      <Printer className="size-4" aria-hidden />
      Imprimir ou salvar PDF
    </button>
  );
}
