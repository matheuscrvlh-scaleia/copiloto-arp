"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { notificar } from "@/components/notificacoes";
import {
  ARQUIVO_MAX_BYTES,
  TIPOS_ARQUIVO,
  tipoDoArquivo,
} from "@/lib/marketing/marca";
import {
  prepararEnvio,
  registrarArquivo,
} from "@/server/marketing/acoes/marca";

// "Subir nova versão" de um arquivo de marca. O arquivo vai do navegador
// direto para o bucket privado, por um link de envio assinado que o
// servidor só gera para quem tem marketing.marca.editar; depois o servidor
// confere o arquivo e registra a versão (a anterior fica no histórico).

const ACEITA = Object.keys(TIPOS_ARQUIVO)
  .map((e) => `.${e}`)
  .join(",");

export function SubirArquivo({
  grupo,
  primeiro,
}: {
  grupo: string;
  /** Ainda não há arquivo: "Enviar arquivo" em vez de "nova versão". */
  primeiro: boolean;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(arquivo: File) {
    if (!tipoDoArquivo(arquivo.name))
      return notificar("erro", "Envie PDF, PNG, JPG, SVG ou ZIP.");
    if (arquivo.size > ARQUIVO_MAX_BYTES)
      return notificar("erro", "Arquivo maior que 25 MB.");
    setEnviando(true);
    try {
      const preparo = await prepararEnvio({
        grupo,
        nome: arquivo.name,
        tamanho: arquivo.size,
      });
      if (!preparo.ok) return notificar("erro", preparo.erro);
      // Mesmo formato do uploadToSignedUrl do supabase-js.
      const corpo = new FormData();
      corpo.append("cacheControl", "3600");
      corpo.append("", arquivo);
      const envio = await fetch(preparo.url, {
        method: "PUT",
        body: corpo,
        headers: { "x-upsert": "false" },
      });
      if (!envio.ok)
        return notificar("erro", "O envio não terminou. Tente de novo.");
      const r = await registrarArquivo({
        grupo,
        path: preparo.path,
        nome: arquivo.name,
      });
      if (r.erro) notificar("erro", r.erro);
      else if (r.ok) notificar("ok", r.ok);
    } catch {
      notificar(
        "erro",
        "O envio não terminou. Confira a conexão e tente de novo.",
      );
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={entrada}
        type="file"
        accept={ACEITA}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          if (arquivo) void enviar(arquivo);
        }}
      />
      <button
        type="button"
        disabled={enviando}
        onClick={() => entrada.current?.click()}
        title="PDF, PNG, JPG, SVG ou ZIP, até 25 MB"
        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 disabled:cursor-wait disabled:opacity-60"
      >
        <Upload className="size-4" aria-hidden />
        {enviando
          ? "Enviando…"
          : primeiro
            ? "Enviar arquivo"
            : "Subir nova versão"}
      </button>
    </>
  );
}
