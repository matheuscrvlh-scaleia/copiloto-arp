"use client";

import { Check, Copy, MessageCircle } from "lucide-react";
import { startTransition, useState } from "react";
import { FormAcao } from "@/components/form-acao";
import {
  cancelarLink,
  gerarLink,
  marcarLinkEnviado,
  trocarLink,
} from "@/server/os/acoes/portal";

// Ações do link de uma loja: gerar, copiar, enviar pelo WhatsApp (com a
// mensagem pronta), cancelar e gerar outro, cancelar.

const PILULA =
  "inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 transition hover:border-neutral-400";

export function AcoesDoLink({
  lojaId,
  loja,
  link,
}: {
  lojaId: string;
  loja: string;
  link: { url: string; whatsapp: string; temTelefone: boolean } | null;
}) {
  if (!link)
    return (
      <FormAcao acao={gerarLink} rotulo="Gerar link" rotuloEnviando="Gerando…">
        <input type="hidden" name="loja" value={lojaId} />
      </FormAcao>
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Copiar url={link.url} loja={loja} />
      <a
        href={link.whatsapp}
        target="_blank"
        rel="noreferrer"
        onClick={() => startTransition(() => marcarLinkEnviado(lojaId))}
        className={PILULA}
        title={
          link.temTelefone
            ? "Abre o WhatsApp com a mensagem pronta"
            : "A loja não tem telefone: o WhatsApp pede para escolher o contato"
        }
      >
        <MessageCircle className="size-3.5" aria-hidden />
        Enviar pelo WhatsApp
      </a>
      <FormAcao
        acao={trocarLink}
        variante="secundario"
        rotulo="Cancelar e gerar outro"
        rotuloEnviando="Gerando…"
        confirmar={`Cancelar o link de ${loja} e gerar outro? O link atual para de funcionar na hora; envie o novo à loja.`}
      >
        <input type="hidden" name="loja" value={lojaId} />
      </FormAcao>
      <FormAcao
        acao={cancelarLink}
        variante="perigo"
        rotulo="Cancelar link"
        rotuloEnviando="Cancelando…"
        confirmar={`Cancelar o link de ${loja}? Ele para de funcionar na hora e a loja fica sem portal até você gerar outro.`}
      >
        <input type="hidden" name="loja" value={lojaId} />
      </FormAcao>
    </div>
  );
}

function Copiar({ url, loja }: { url: string; loja: string }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt(`Copie o link de ${loja}:`, url);
    }
  }
  return (
    <button type="button" onClick={copiar} className={PILULA}>
      {copiado ? (
        <Check className="size-3.5 text-green-700" aria-hidden />
      ) : (
        <Copy className="size-3.5" aria-hidden />
      )}
      <span aria-live="polite">{copiado ? "Copiado" : "Copiar link"}</span>
    </button>
  );
}
