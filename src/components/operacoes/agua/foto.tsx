"use client";

import { ImageOff } from "lucide-react";
import { useState } from "react";
import { Dialogo } from "@/components/calendario/dialogo";

// Foto do visor: a miniatura abre a foto grande numa janela (Esc fecha), com
// a referência, a leitura e o consumo embaixo. Nos dados de exemplo, o
// "visor" vem desenhado pelo servidor (não há foto de verdade).

export interface FotoDoVisorProps {
  /** Link assinado da foto; null quando a leitura não tem foto. */
  link: string | null;
  /** Visor desenhado (dados de exemplo), no lugar da foto. */
  desenho?: React.ReactNode;
  titulo: string;
  legenda: string;
  /** Classe da miniatura (tamanho). */
  className?: string;
}

export function FotoDoVisor({
  link,
  desenho,
  titulo,
  legenda,
  className = "h-10 w-16",
}: FotoDoVisorProps) {
  const [aberta, setAberta] = useState(false);
  if (!link && !desenho)
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-amber-800">
        <ImageOff className="size-3.5" aria-hidden />
        Sem foto
      </span>
    );
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setAberta(true);
        }}
        aria-label={`Ampliar a foto: ${titulo}`}
        className={`block shrink-0 overflow-hidden rounded-lg bg-neutral-100 outline-none ring-neutral-900/30 transition hover:opacity-90 focus-visible:ring-2 ${className}`}
      >
        {link ? (
          // biome-ignore lint/performance/noImgElement: link assinado do disco, sem otimização de imagem
          <img
            src={link}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
          />
        ) : (
          desenho
        )}
      </button>
      <Dialogo
        aberto={aberta}
        aoFechar={() => setAberta(false)}
        titulo={titulo}
        subtitulo="Foto do visor"
      >
        <figure className="flex flex-col gap-3 pb-3">
          {link ? (
            // biome-ignore lint/performance/noImgElement: link assinado do disco, sem otimização de imagem
            <img
              src={link}
              alt={`Visor: ${legenda}`}
              className="max-h-[65dvh] w-full rounded-2xl object-contain"
            />
          ) : (
            <div className="w-full">{desenho}</div>
          )}
          <figcaption className="text-sm text-neutral-600">
            {legenda}
          </figcaption>
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-neutral-600 underline-offset-4 hover:underline"
            >
              Abrir a foto em outra aba ↗
            </a>
          )}
        </figure>
      </Dialogo>
    </>
  );
}
