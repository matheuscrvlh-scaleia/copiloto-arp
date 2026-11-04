"use client";

import { Download, Paperclip, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { notificar } from "@/components/notificacoes";
import {
  ACEITA_ANEXO,
  ANEXO_MAX_BYTES,
  mimeDoAnexo,
  TIPOS_ANEXO,
  type TipoAnexo,
} from "@/lib/comercial/contrato";
import { formatarDataHora } from "@/lib/formato";
import {
  linkDoAnexo,
  prepararAnexo,
  registrarAnexo,
  removerAnexo,
} from "@/server/comercial/acoes/contratos";
import type { AnexoDoContrato } from "@/server/comercial/contratos";
import { BOTAO_SEC, Remover } from "./campos";

// Anexos do contrato (bucket privado "comercial"): o arquivo vai do
// navegador direto para o bucket por um link assinado que o servidor só
// gera para quem edita contratos; depois o servidor confere e registra.

async function enviar(
  contratoId: string,
  tipo: TipoAnexo,
  arquivo: File,
): Promise<void> {
  if (!mimeDoAnexo(arquivo.name)) {
    notificar("erro", "Envie PDF, PNG, JPG ou Word (DOC, DOCX).");
    return;
  }
  if (arquivo.size > ANEXO_MAX_BYTES) {
    notificar("erro", "Arquivo maior que 25 MB.");
    return;
  }
  try {
    const p = await prepararAnexo({
      contratoId,
      tipo,
      nome: arquivo.name,
      tamanho: arquivo.size,
    });
    if (!p.ok) {
      notificar("erro", p.erro);
      return;
    }
    const corpo = new FormData();
    corpo.append("cacheControl", "3600");
    corpo.append("", arquivo);
    const r = await fetch(p.url, {
      method: "PUT",
      body: corpo,
      headers: { "x-upsert": "false" },
    });
    if (!r.ok) {
      notificar("erro", "O envio não terminou. Tente de novo.");
      return;
    }
    const reg = await registrarAnexo({
      contratoId,
      tipo,
      path: p.path,
      nome: arquivo.name,
    });
    if (reg.erro) notificar("erro", reg.erro);
    else if (reg.ok) notificar("ok", reg.ok);
  } catch {
    notificar(
      "erro",
      "O envio não terminou. Confira a conexão e tente de novo.",
    );
  }
}

export async function abrirAnexo(id: string) {
  const r = await linkDoAnexo(id);
  if ("erro" in r) notificar("erro", r.erro);
  else window.open(r.url, "_blank", "noopener");
}

/** Os anexos de um tipo, com "Anexar" e remover. */
export function Anexos({
  id,
  contratoId,
  tipo,
  anexos,
  editar,
  rotulo,
}: {
  /** id do botão (a Revisão leva até ele). */
  id?: string;
  contratoId: string | null;
  tipo: TipoAnexo;
  anexos: AnexoDoContrato[];
  editar: boolean;
  rotulo?: string;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [, iniciar] = useTransition();
  const deste = anexos.filter((a) => a.tipo === tipo);

  return (
    <div className="flex flex-col gap-2">
      {deste.map((a) => (
        <div
          key={a.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-200 bg-white/70 px-3 py-2 text-sm"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Paperclip
              className="size-4 shrink-0 text-neutral-400"
              aria-hidden
            />
            <span className="truncate font-medium">{a.nome}</span>
            <span className="text-xs text-neutral-500">
              {formatarDataHora(a.enviadoEm)}
              {a.enviadoPor ? ` · ${a.enviadoPor}` : ""}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void abrirAnexo(a.id)}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
            >
              <Download className="size-3.5" aria-hidden />
              Baixar
            </button>
            {editar && (
              <Remover
                rotulo="Remover"
                onClick={() =>
                  iniciar(async () => {
                    const r = await removerAnexo(a.id);
                    if (r.erro) notificar("erro", r.erro);
                    else if (r.ok) notificar("ok", r.ok);
                  })
                }
              />
            )}
          </span>
        </div>
      ))}
      {editar && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={entrada}
            type="file"
            accept={ACEITA_ANEXO}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f || !contratoId) return;
              setEnviando(true);
              await enviar(contratoId, tipo, f);
              setEnviando(false);
              if (entrada.current) entrada.current.value = "";
            }}
          />
          <button
            id={id}
            type="button"
            disabled={enviando || !contratoId}
            onClick={() => entrada.current?.click()}
            title="PDF, PNG, JPG ou Word, até 25 MB"
            className={BOTAO_SEC}
          >
            <Upload className="size-4" aria-hidden />
            {enviando
              ? "Enviando…"
              : (rotulo ?? `Anexar: ${TIPOS_ANEXO[tipo]}`)}
          </button>
          {!contratoId && (
            <span className="text-xs text-neutral-500">
              Salve o rascunho para anexar arquivos.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
