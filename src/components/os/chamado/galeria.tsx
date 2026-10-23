"use client";

import { ChevronLeft, ChevronRight, Download, FileText, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useCamadaModal } from "./janela";

// Fotos e arquivos do chamado: miniaturas que abrem grandes ao tocar (setas
// e teclado passam para a próxima); arquivo que não é foto abre em outra
// aba. Os endereços são temporários (assinados pelo servidor).

export interface ArquivoDaGaleria {
  id: string;
  nome: string;
  url: string | null;
  foto: boolean;
  legenda?: string;
}

export function Galeria({
  arquivos,
  tamanho = "md",
}: {
  arquivos: ArquivoDaGaleria[];
  tamanho?: "sm" | "md";
}) {
  const fotos = arquivos.filter((a) => a.foto && a.url);
  const outros = arquivos.filter((a) => !a.foto || !a.url);
  const [aberta, setAberta] = useState<number | null>(null);
  const lado = tamanho === "sm" ? "size-16" : "size-20 sm:size-24";

  return (
    <div className="flex flex-col gap-2">
      {fotos.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {fotos.map((f, i) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => setAberta(i)}
                aria-label={`Ver foto ${f.nome}`}
                className={`${lado} block overflow-hidden rounded-2xl ring-1 ring-neutral-900/10 transition hover:ring-2 hover:ring-marca focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca`}
              >
                {/* biome-ignore lint/performance/noImgElement: endereço assinado e temporário do bucket */}
                <img
                  src={f.url ?? undefined}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
      {outros.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {outros.map((a) => (
            <li key={a.id}>
              <a
                href={a.url ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!a.url}
                className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-full border border-neutral-200 bg-white py-1.5 pr-4 pl-2 text-sm transition hover:border-neutral-400"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-neutral-900/[0.05] text-neutral-600">
                  <FileText className="size-3.5" aria-hidden />
                </span>
                <span className="truncate">{a.nome}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {aberta !== null && (
        <Visor
          fotos={fotos}
          inicial={aberta}
          aoFechar={() => setAberta(null)}
        />
      )}
    </div>
  );
}

function Visor({
  fotos,
  inicial,
  aoFechar,
}: {
  fotos: ArquivoDaGaleria[];
  inicial: number;
  aoFechar: () => void;
}) {
  const [i, setI] = useState(inicial);
  const painel = useRef<HTMLDivElement>(null);
  useCamadaModal(painel, aoFechar);
  const foto = fotos[i];
  const total = fotos.length;

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setI((x) => (x + 1) % total);
      if (e.key === "ArrowLeft") setI((x) => (x - 1 + total) % total);
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [total]);

  if (!foto) return null;
  const botao =
    "grid size-11 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25";

  return createPortal(
    <div
      ref={painel}
      role="dialog"
      aria-modal="true"
      aria-label={`Foto ${i + 1} de ${total}`}
      tabIndex={-1}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
      className="fixed inset-0 z-[70] flex flex-col bg-black/90 outline-none"
    >
      <div className="flex items-center gap-2 p-3 text-white">
        <span className="min-w-0 flex-1 truncate text-sm">
          {foto.nome}
          {foto.legenda && (
            <span className="text-white/60"> · {foto.legenda}</span>
          )}
        </span>
        <span className="text-xs text-white/60 tabular-nums">
          {i + 1} / {total}
        </span>
        <a
          href={foto.url ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Abrir o original"
          className={botao}
        >
          <Download className="size-4" aria-hidden />
        </a>
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar"
          className={botao}
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: clicar no fundo fecha; o teclado fecha com Esc */}
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center p-3"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) aoFechar();
        }}
      >
        {/* biome-ignore lint/performance/noImgElement: endereço assinado e temporário do bucket */}
        <img
          src={foto.url ?? undefined}
          alt={foto.nome}
          className="max-h-full max-w-full rounded-xl object-contain"
        />
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => setI((i - 1 + total) % total)}
              aria-label="Foto anterior"
              className={`${botao} absolute top-1/2 left-3 -translate-y-1/2`}
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setI((i + 1) % total)}
              aria-label="Próxima foto"
              className={`${botao} absolute top-1/2 right-3 -translate-y-1/2`}
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
