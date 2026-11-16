"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";

// Janela do editor (<dialog>: Esc fecha, foco preso, fundo inerte), no
// visual das outras janelas do sistema (ver calendario/dialogo.tsx), com
// largura por uso: confirmação, painel da pergunta, versões, pré-visualização.

const LARGURA = {
  estreita: "w-[min(30rem,calc(100vw-1.5rem))]",
  media: "w-[min(44rem,calc(100vw-1.5rem))]",
  larga: "w-[min(64rem,calc(100vw-1.5rem))]",
} as const;

export function Janela({
  aberto,
  aoFechar,
  titulo,
  subtitulo,
  children,
  rodape,
  largura = "media",
  guia,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  children: React.ReactNode;
  rodape?: React.ReactNode;
  largura?: keyof typeof LARGURA;
  /** data-guia do painel. */
  guia?: string;
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
      className={`modal-detalhe m-auto max-h-[min(92dvh,60rem)] overflow-hidden rounded-[2rem] border-0 bg-transparent p-0 text-neutral-900 backdrop:bg-black/45 backdrop:backdrop-blur-md ${LARGURA[largura]}`}
    >
      {aberto && (
        <div
          data-guia={guia}
          className="painel-modal relative flex max-h-[min(92dvh,60rem)] flex-col overflow-hidden rounded-[2rem]"
        >
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
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-3 text-sm">
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

export const BOTAO = {
  primario:
    "inline-flex items-center justify-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50",
  secundario:
    "inline-flex items-center justify-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-50",
  perigo:
    "inline-flex items-center justify-center gap-1.5 rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:border-red-400 disabled:cursor-not-allowed disabled:opacity-50",
  pequeno:
    "inline-flex items-center justify-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-800 transition hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-40",
  pequenoPerigo:
    "inline-flex items-center justify-center gap-1 rounded-full border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 transition hover:border-red-400 disabled:cursor-not-allowed disabled:opacity-40",
  icone:
    "grid size-7 place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-900/5 hover:text-neutral-900 disabled:pointer-events-none disabled:opacity-30",
} as const;

/** Aviso dentro das janelas e do editor. */
export function Aviso({
  tom = "info",
  children,
}: {
  tom?: "info" | "alerta" | "erro";
  children: React.ReactNode;
}) {
  const cor = {
    info: "bg-neutral-900/[0.04] text-neutral-700",
    alerta: "bg-amber-400/15 text-amber-900",
    erro: "bg-red-500/10 text-red-800",
  }[tom];
  return (
    <div className={`rounded-2xl px-4 py-3 text-sm ${cor}`}>{children}</div>
  );
}
