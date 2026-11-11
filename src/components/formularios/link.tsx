"use client";

import { Check, Copy, MessageCircle } from "lucide-react";
import { useId, useState } from "react";
import { classeCampo } from "@/components/estilos";

// Link público do formulário, para copiar ou mandar pelo WhatsApp.

const BOTAO =
  "inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800";
const BOTAO_SECUNDARIO =
  "inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400";

export function LinkDoFormulario({
  link,
  titulo,
}: {
  link: string;
  titulo: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const id = useId();
  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt("Copie o link:", link);
    }
  }
  const mensagem = `Olá! Responda "${titulo}" por este link: ${link}`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-xs font-medium text-neutral-600">
        Link público (sem login)
      </label>
      <input
        id={id}
        readOnly
        value={link}
        onFocus={(e) => e.target.select()}
        className={`${classeCampo} font-mono text-xs`}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copiar} className={BOTAO}>
          {copiado ? (
            <Check className="size-4 text-green-400" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          <span aria-live="polite">{copiado ? "Copiado" : "Copiar link"}</span>
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`}
          target="_blank"
          rel="noreferrer"
          className={BOTAO_SECUNDARIO}
        >
          <MessageCircle className="size-4" aria-hidden />
          Enviar pelo WhatsApp
        </a>
      </div>
    </div>
  );
}
