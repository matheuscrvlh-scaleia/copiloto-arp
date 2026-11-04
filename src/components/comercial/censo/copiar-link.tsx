"use client";

import { Copy, MessageCircle } from "lucide-react";
import { notificar } from "@/components/notificacoes";
import { marcarConviteEnviado } from "@/server/comercial/acoes/censo";

// Link único da empresa na rodada, para mandar pelo WhatsApp: copiar ou
// abrir o WhatsApp com o link já escrito. Marca o convite como enviado.

const BOTAO =
  "inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-800 transition hover:border-neutral-400";

export function CopiarLink({
  convite,
  token,
  rodada,
}: {
  convite: string;
  token: string;
  rodada: string;
}) {
  const link = () => `${window.location.origin}/censo/${token}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link());
      notificar("ok", "Link copiado. Cole na conversa do WhatsApp da empresa.");
      void marcarConviteEnviado(convite);
    } catch {
      notificar("erro", `Não consegui copiar. O link é ${link()}`);
    }
  }

  function whatsapp() {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${rodada}: ${link()}`)}`,
      "_blank",
      "noopener,noreferrer",
    );
    void marcarConviteEnviado(convite);
  }

  return (
    <span className="inline-flex flex-wrap gap-1.5">
      <button type="button" onClick={copiar} className={BOTAO}>
        <Copy className="size-3.5" aria-hidden />
        Copiar link
      </button>
      <button type="button" onClick={whatsapp} className={BOTAO}>
        <MessageCircle className="size-3.5" aria-hidden />
        WhatsApp
      </button>
    </span>
  );
}
