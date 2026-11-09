"use client";

import { Maximize2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useCamadaModal } from "@/components/os/chamado/janela";

// Ficha da caixa num painel que desliza da direita sobre o quadro (largo no
// computador, tela cheia no celular), como no mockup. Fechar volta ao
// quadro sem o ?caixa= e sem perder a rolagem; "Abrir página inteira" leva
// à ficha em /operacoes/energia/caixa/[id] (para mandar o link).

export function PainelDaCaixa({
  titulo,
  fecharHref,
  paginaHref,
  children,
}: {
  titulo: string;
  fecharHref: string;
  paginaHref: string;
  children: React.ReactNode;
}) {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  if (!montado) return null;
  return createPortal(
    <Camada titulo={titulo} fecharHref={fecharHref} paginaHref={paginaHref}>
      {children}
    </Camada>,
    document.body,
  );
}

function Camada({
  titulo,
  fecharHref,
  paginaHref,
  children,
}: {
  titulo: string;
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
        aria-label={titulo}
        tabIndex={-1}
        className="painel-modal flex h-full w-full flex-col outline-none transition-transform duration-300 ease-out starting:translate-x-full motion-reduce:transition-none sm:w-[min(48rem,calc(100vw-3rem))] sm:rounded-l-[2rem]"
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
