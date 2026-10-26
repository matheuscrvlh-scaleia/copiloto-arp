"use client";

import { Check, Copy, Loader, MessageCircle, Send } from "lucide-react";
import { useState } from "react";
import { prepararEnvio } from "@/server/os/acoes/vistorias";

// Envio do laudo ao locatário: gera o PDF, guarda na vistoria (e no portal
// da loja) e abre o WhatsApp com a mensagem pronta e o link do PDF.

export function EnviarLaudo({ vistoriaId }: { vistoriaId: string }) {
  const [estado, setEstado] = useState<
    | { fase: "parado" }
    | { fase: "gerando" }
    | { fase: "pronto"; link: string; whatsapp: string }
    | { fase: "erro"; erro: string }
  >({ fase: "parado" });
  const [copiado, setCopiado] = useState(false);

  async function preparar() {
    setEstado({ fase: "gerando" });
    const r = await prepararEnvio({ vistoriaId });
    setEstado(
      r.link && r.whatsapp
        ? { fase: "pronto", link: r.link, whatsapp: r.whatsapp }
        : { fase: "erro", erro: r.erro ?? "Não foi possível gerar o laudo." },
    );
  }

  async function copiar(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  }

  const secundario =
    "inline-flex min-h-10 items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 disabled:cursor-wait disabled:opacity-60";

  if (estado.fase === "pronto")
    return (
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={estado.whatsapp}
          target="_blank"
          rel="noopener"
          className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#1a8f4c] px-4 text-sm font-medium text-[#fff] transition hover:brightness-110"
        >
          <MessageCircle className="size-4" aria-hidden />
          Abrir no WhatsApp
        </a>
        <button
          type="button"
          onClick={() => copiar(estado.link)}
          className={secundario}
        >
          {copiado ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          {copiado ? "Link copiado" : "Copiar link do PDF"}
        </button>
      </div>
    );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={preparar}
        disabled={estado.fase === "gerando"}
        className={secundario}
      >
        {estado.fase === "gerando" ? (
          <Loader
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden
          />
        ) : (
          <Send className="size-4" aria-hidden />
        )}
        {estado.fase === "gerando" ? "Gerando o laudo…" : "Enviar ao locatário"}
      </button>
      {estado.fase === "erro" && (
        <span role="alert" className="text-xs text-red-700">
          {estado.erro}
        </span>
      )}
    </div>
  );
}
