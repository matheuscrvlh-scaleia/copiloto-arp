"use client";

import { FileCheck2, Paperclip } from "lucide-react";
import { useId, useState } from "react";
import { notificar } from "@/components/notificacoes";
import type { DocumentoExigido, TipoFicha } from "@/lib/comercial/ficha";
import {
  enviarDocumentoPeloLink,
  removerDocumentoPeloLink,
} from "@/server/comercial/acoes/ficha-publica";
import { Erro, Secao } from "./campos";
import { idDo, useFicha } from "./contexto";

// ---------------------------------------------------------------------------
// Documentos
// ---------------------------------------------------------------------------

export interface DocumentoEnviado {
  id: string;
  documento: string;
  arquivo_nome: string;
}

export function Documentos({
  token,
  tipo,
  aceite,
  exigidos,
  enviados,
  aoMudar,
}: {
  token: string | null;
  tipo: TipoFicha;
  aceite: boolean;
  exigidos: DocumentoExigido[];
  enviados: DocumentoEnviado[];
  aoMudar: (l: DocumentoEnviado[]) => void;
}) {
  const { erros } = useFicha();
  const [enviando, setEnviando] = useState<string | null>(null);
  const idBase = useId();
  async function enviar(documento: string, arquivo: File) {
    if (!token)
      return notificar("info", "Demonstração: nenhum arquivo é guardado.");
    const f = new FormData();
    f.set("token", token);
    f.set("tipo", tipo);
    f.set("documento", documento);
    f.set("aceite", aceite ? "1" : "");
    f.set("arquivo", arquivo);
    setEnviando(documento);
    try {
      const r = await enviarDocumentoPeloLink(f);
      if (r.erro) notificar("erro", r.erro);
      else if (r.documento) {
        aoMudar([
          ...enviados.filter((d) => d.documento !== documento),
          r.documento,
        ]);
        notificar("ok", `${documento}: arquivo enviado.`);
      }
    } catch {
      notificar(
        "erro",
        "O envio não chegou. Confira a internet e tente de novo.",
      );
    } finally {
      setEnviando(null);
    }
  }
  async function tirar(d: DocumentoEnviado) {
    if (!token) return;
    const f = new FormData();
    f.set("token", token);
    f.set("id", d.id);
    const r = await removerDocumentoPeloLink(f);
    if (r.erro) notificar("erro", r.erro);
    else aoMudar(enviados.filter((x) => x.id !== d.id));
  }
  return (
    <Secao
      titulo="Documentos comprobatórios"
      descricao="PDF ou foto (JPG, PNG, WEBP ou HEIC), até 8 MB cada. O arquivo sobe na hora; para trocar, envie outro."
    >
      {exigidos.length === 0 && (
        <p className="text-sm text-neutral-500">
          Nenhum documento pedido para este tipo de ficha.
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {exigidos.map((x, i) => {
          const enviado = enviados.find((d) => d.documento === x.documento);
          const id = `${idBase}-${i}`;
          return (
            <li
              key={x.documento}
              id={idDo(`documentos.${x.documento}`)}
              className={`flex flex-col gap-2 rounded-2xl border bg-white/70 p-4 ${erros[`documentos.${x.documento}`] ? "border-red-300" : "border-neutral-200"}`}
            >
              <p className="text-sm font-medium">
                {x.documento}
                {x.obrigatorio && <span className="text-red-600"> *</span>}
              </p>
              {enviado ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <FileCheck2 className="size-4 text-green-700" aria-hidden />
                  <span className="min-w-0 truncate text-neutral-700">
                    {enviado.arquivo_nome}
                  </span>
                  <button
                    type="button"
                    onClick={() => tirar(enviado)}
                    className="ml-auto text-xs font-medium text-red-700 hover:underline"
                  >
                    Tirar
                  </button>
                </div>
              ) : null}
              <label
                htmlFor={id}
                className="inline-flex cursor-pointer items-center gap-2 self-start rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
              >
                <Paperclip className="size-4" aria-hidden />
                {enviando === x.documento
                  ? "Enviando…"
                  : enviado
                    ? "Trocar arquivo"
                    : "Escolher arquivo"}
              </label>
              <input
                id={id}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,.heic,.heif"
                className="sr-only"
                disabled={enviando !== null}
                onChange={(e) => {
                  const a = e.target.files?.[0];
                  e.target.value = "";
                  if (a) enviar(x.documento, a);
                }}
              />
              <Erro caminho={`documentos.${x.documento}`} />
            </li>
          );
        })}
      </ul>
    </Secao>
  );
}
