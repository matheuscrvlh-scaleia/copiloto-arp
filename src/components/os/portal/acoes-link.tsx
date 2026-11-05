"use client";

import { Check, Copy, ExternalLink, Link2, MessageCircle } from "lucide-react";
import { useState } from "react";
import { FormAcao } from "@/components/form-acao";
import { encerrarAcesso } from "@/server/os/acoes/portal";

// O portal tem um link só: copiar, enviar a cada loja pelo WhatsApp (com
// a mensagem pronta) e encerrar o acesso de quem está dentro.

// Mesmo tamanho dos botões do FormAcao (px-4 py-2 text-sm), lado a lado.
const BOTAO =
  "inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400";

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
          confirmar={`Encerrar o acesso de ${loja} ao portal? Quem estiver dentro sai na hora e precisa entrar de novo com o CPF ou CNPJ.`}
        >
          <input type="hidden" name="loja" value={lojaId} />
        </FormAcao>
      )}
    </div>
  );
}

// O link do portal no topo da tela, ao lado das abas: endereço à vista,
// copiar com um clique e abrir para conferir.
export function LinkDoPortal({ url }: { url: string }) {
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
    <div className="vidro flex w-full min-w-0 items-center gap-3 rounded-full p-1 sm:w-auto">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-green-600 text-white">
        <Link2 className="size-4" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="text-[11px] text-neutral-500">
          Link do portal das lojas
        </span>
        <span className="truncate text-sm font-medium text-neutral-900 select-all">
          {url.replace(/^https?:\/\//, "")}
        </span>
      </span>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        title="Abrir o portal"
        aria-label="Abrir o portal"
        className="grid size-9 shrink-0 place-items-center rounded-full text-neutral-600 transition hover:bg-white/70 hover:text-neutral-900"
      >
        <ExternalLink className="size-4" aria-hidden />
      </a>
      <button
        type="button"
        onClick={copiar}
        className="inline-flex shrink-0 items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-700"
      >
        {copiado ? (
          <Check className="size-4 text-green-400" aria-hidden />
        ) : (
          <Copy className="size-4" aria-hidden />
        )}
        <span aria-live="polite">{copiado ? "Copiado" : "Copiar link"}</span>
      </button>
    </div>
  );
}
