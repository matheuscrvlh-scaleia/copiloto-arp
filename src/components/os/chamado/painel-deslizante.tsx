"use client";

import { Maximize2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useCamadaModal } from "./janela";

// Janela lateral do chamado: desliza da direita sobre a lista (larga no
// computador, tela cheia no celular). Fechar volta para a lista sem o ?c=
// na URL, sem perder a rolagem.

export function PainelDeslizante({
  fecharHref,
  paginaHref,
  children,
}: {
  fecharHref: string;
  paginaHref: string;
  children: React.ReactNode;
}) {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  if (!montado) return null;
  return createPortal(
    <Camada fecharHref={fecharHref} paginaHref={paginaHref}>
      {children}
    </Camada>,
    document.body,
  );
}

function Camada({
  fecharHref,
  paginaHref,
  children,
}: {
  fecharHref: string;
  paginaHref: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const painel = useRef<HTMLDivElement>(null);
  const fechar = () => router.push(fecharHref, { scroll: false });
  useCamadaModal(painel, fechar);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: clicar no fundo fecha; o teclado fecha com Esc
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/30 backdrop-blur-[2px] transition-opacity duration-300 starting:opacity-0 motion-reduce:transition-none print:hidden"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) fechar();
      }}
    >
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-label="Chamado"
        tabIndex={-1}
        className="painel-modal flex h-full w-full flex-col outline-none transition-transform duration-300 ease-out starting:translate-x-full motion-reduce:transition-none sm:w-[min(52rem,calc(100vw-3rem))] sm:rounded-l-[2rem]"
      >
        <div className="flex shrink-0 items-center justify-end gap-2 border-b border-neutral-900/[0.06] px-4 py-3 sm:px-6">
          <Link
            href={paginaHref}
            className="inline-flex min-h-10 items-center gap-2 rounded-full px-3.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-900/[0.06]"
          >
            <Maximize2 className="size-4" aria-hidden />
            Abrir página inteira
          </Link>
          <Link
            href={fecharHref}
            scroll={false}
            aria-label="Fechar"
            className="grid size-10 place-items-center rounded-full bg-neutral-900 text-white transition hover:scale-105"
          >
            <X className="size-4" aria-hidden />
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          {children}
        </div>
      </div>
    </div>
  );
}
