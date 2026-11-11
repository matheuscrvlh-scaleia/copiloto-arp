"use client";

import { X } from "lucide-react";
import { useRef } from "react";
import { createPortal } from "react-dom";
import { classeCampo } from "@/components/estilos";
import { useCamadaModal } from "@/components/os/chamado/janela";

// Painel que abre do lado direito com um formulário (corrigir leitura,
// cadastrar hidrômetro ou sala). Fecha com Esc, no X ou clicando no fundo.

export function Painel({
  titulo,
  aoFechar,
  children,
}: {
  titulo: string;
  aoFechar: () => void;
  children: React.ReactNode;
}) {
  const painel = useRef<HTMLDivElement>(null);
  useCamadaModal(painel, aoFechar);
  return createPortal(
    // biome-ignore lint/a11y/noStaticElementInteractions: clicar no fundo fecha; o teclado fecha com Esc
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/30 backdrop-blur-[2px] transition-opacity duration-300 starting:opacity-0 motion-reduce:transition-none"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
    >
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        className="painel-modal flex h-full w-full flex-col outline-none transition-transform duration-300 ease-out starting:translate-x-full motion-reduce:transition-none sm:w-[min(40rem,calc(100vw-3rem))] sm:rounded-l-[2rem]"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-900/[0.06] px-4 py-3 sm:px-6">
          <h2 className="text-base font-semibold">{titulo}</h2>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="grid size-10 place-items-center rounded-full hover:bg-neutral-900/[0.06]"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function CampoTexto({
  rotulo,
  nome,
  valor,
  tipo = "text",
  numerico,
  obrigatorio,
}: {
  rotulo: string;
  nome: string;
  valor: string;
  tipo?: "text" | "date";
  numerico?: boolean;
  obrigatorio?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700">
      <span>
        {rotulo}
        {obrigatorio && <span className="text-red-700"> *</span>}
      </span>
      <input
        name={nome}
        type={tipo}
        defaultValue={valor}
        required={obrigatorio}
        inputMode={numerico ? "decimal" : undefined}
        autoComplete="off"
        className={classeCampo}
      />
    </label>
  );
}
