"use client";

import { Check, Copy, MessageCircle } from "lucide-react";
import { useState } from "react";
import { FormAcao } from "@/components/form-acao";
import { encerrarAcesso } from "@/server/os/acoes/portal";

// O portal tem um link só: copiar, enviar a cada loja pelo WhatsApp (com
// a mensagem pronta) e encerrar o acesso de quem está dentro.

// Mesmo tamanho dos botões do FormAcao (px-4 py-2 text-sm), lado a lado.
const BOTAO =
  "inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400";
const PILULA =
  "inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 transition hover:border-neutral-400";

export function AcoesDaLoja({
  lojaId,
  loja,
  whatsapp,
  temTelefone,
  dentro,
}: {
  lojaId: string;
  loja: string;
  whatsapp: string;
  temTelefone: boolean;
  dentro: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={whatsapp}
        target="_blank"
        rel="noreferrer"
        className={BOTAO}
        title={
          temTelefone
            ? "Abre o WhatsApp com a mensagem pronta"
            : "A loja não tem telefone: o WhatsApp pede para escolher o contato"
        }
      >
        <MessageCircle className="size-4" aria-hidden />
        Enviar pelo WhatsApp
      </a>
      {dentro && (
        <FormAcao
          acao={encerrarAcesso}
          variante="perigo"
          rotulo="Encerrar acesso"
          rotuloEnviando="Encerrando…"
          confirmar={`Encerrar o acesso de ${loja} ao portal? Quem estiver dentro sai na hora e precisa entrar de novo com o CNPJ.`}
        >
          <input type="hidden" name="loja" value={lojaId} />
        </FormAcao>
      )}
    </div>
  );
}

export function CopiarLink({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt("Copie o link do portal:", url);
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
