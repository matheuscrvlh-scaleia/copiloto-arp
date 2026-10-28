"use client";

import {
  Check,
  Copy,
  Loader,
  MessageCircle,
  PenLine,
  Send,
} from "lucide-react";
import { useState } from "react";
import { notificar } from "@/components/notificacoes";
import {
  enviarParaAssinatura,
  prepararEnvio,
} from "@/server/os/acoes/vistorias";

// Envio ao locatário pelo WhatsApp. "laudo": gera o PDF, guarda na vistoria
// (e no portal da loja) e manda o link do PDF. "assinatura": manda o link
// para ele conferir o laudo e assinar por último (depois da ARP).

const TEXTOS = {
  laudo: {
    acao: prepararEnvio,
    rotulo: "Enviar laudo (PDF)",
    gerando: "Gerando o laudo…",
    copiar: "Copiar link do PDF",
  },
  assinatura: {
    acao: enviarParaAssinatura,
    rotulo: "Enviar para o locatário assinar",
    gerando: "Preparando o link…",
    copiar: "Copiar link para assinar",
  },
} as const;

export function EnviarLaudo({
  vistoriaId,
  modo = "laudo",
}: {
  vistoriaId: string;
  modo?: keyof typeof TEXTOS;
}) {
  const t = TEXTOS[modo];
  const [estado, setEstado] = useState<
    | { fase: "parado" }
    | { fase: "gerando" }
    | { fase: "pronto"; link: string; whatsapp: string }
  >({ fase: "parado" });
  const [copiado, setCopiado] = useState(false);

  async function preparar() {
    setEstado({ fase: "gerando" });
    const r = await t.acao({ vistoriaId });
    if (r.link && r.whatsapp) {
      setEstado({ fase: "pronto", link: r.link, whatsapp: r.whatsapp });
      return;
    }
    setEstado({ fase: "parado" });
    notificar("erro", r.erro ?? "Não foi possível gerar o laudo.");
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
      <div className="contents">
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
          {copiado ? "Link copiado" : t.copiar}
        </button>
      </div>
    );

  return (
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
      ) : modo === "assinatura" ? (
        <PenLine className="size-4" aria-hidden />
      ) : (
        <Send className="size-4" aria-hidden />
      )}
      {estado.fase === "gerando" ? t.gerando : t.rotulo}
    </button>
  );
}
