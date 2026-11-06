"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";

// Janela do calendário (<dialog>: Esc fecha, foco preso, fundo inerte), no
// mesmo visual das outras janelas do sistema. Aberta por quem a usa.

export function Dialogo({
  aberto,
  aoFechar,
  titulo,
  subtitulo,
  children,
  rodape,
  cor,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  children: React.ReactNode;
  rodape?: React.ReactNode;
  /** Faixa colorida no topo (cor do tipo). */
  cor?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) {
      d.showModal();
      document.documentElement.style.overflow = "hidden";
    } else if (!aberto && d.open) d.close();
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      onCancel={(e) => {
        e.preventDefault();
        aoFechar();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
      onKeyDown={() => undefined}
      className="modal-detalhe m-auto max-h-[min(92dvh,56rem)] w-[min(38rem,calc(100vw-1.5rem))] overflow-hidden rounded-[2rem] border-0 bg-transparent p-0 text-neutral-900 backdrop:bg-black/45 backdrop:backdrop-blur-md"
    >
      {aberto && (
        <div className="painel-modal relative flex max-h-[min(92dvh,56rem)] flex-col overflow-hidden rounded-[2rem]">
          {cor && (
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-1.5"
              style={{ backgroundColor: cor }}
            />
          )}
          <header className="relative shrink-0 px-6 pt-6 pr-16 pb-3">
            {subtitulo && (
              <div className="mb-1 text-xs font-medium text-neutral-500">
                {subtitulo}
              </div>
            )}
            <h2
              id={idTitulo}
              className="text-xl font-semibold tracking-tight text-balance"
            >
              {titulo}
            </h2>
            <button
              type="button"
              onClick={aoFechar}
              aria-label="Fechar"
              className="absolute top-5 right-5 grid size-10 place-items-center rounded-full bg-neutral-900 text-white transition hover:scale-105"
            >
              <X className="size-4" aria-hidden />
            </button>
          </header>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-3">
            {children}
          </div>
          {rodape && (
            <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-neutral-900/[0.06] px-6 py-4">
              {rodape}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}
