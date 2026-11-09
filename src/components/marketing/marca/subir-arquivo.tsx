"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { notificar } from "@/components/notificacoes";
import { enviarParaLink } from "@/lib/enviar-arquivo";
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
// direto para o armazenamento privado, por um link de envio assinado que o
// servidor só gera para quem tem marketing.marca.editar; depois o servidor
// confere o arquivo e registra a versão (a anterior fica no histórico).

export const ACEITA = Object.keys(TIPOS_ARQUIVO)
  .map((e) => `.${e}`)
  .join(",");

/** Erro do arquivo antes de enviar (tipo ou tamanho), ou null. */
export function erroDoArquivo(arquivo: File): string | null {
  if (!tipoDoArquivo(arquivo.name)) return "Envie PDF, PNG, JPG, SVG ou ZIP.";
  if (arquivo.size > ARQUIVO_MAX_BYTES) return "Arquivo maior que 25 MB.";
  return null;
}

/** Envia o arquivo para o grupo e avisa o resultado. Devolve se deu certo. */
export async function enviarArquivo(
  grupo: string,
  arquivo: File,
): Promise<boolean> {
  const erro = erroDoArquivo(arquivo);
  if (erro) {
    notificar("erro", erro);
    return false;
  }
  try {
    const preparo = await prepararEnvio({
      grupo,
      nome: arquivo.name,
      tamanho: arquivo.size,
    });
    if (!preparo.ok) {
      notificar("erro", preparo.erro);
      return false;
    }
    if (!(await enviarParaLink(preparo.url, arquivo))) {
      notificar("erro", "O envio não terminou. Tente de novo.");
      return false;
    }
    const r = await registrarArquivo({
      grupo,
      path: preparo.path,
      nome: arquivo.name,
    });
    if (r.erro) notificar("erro", r.erro);
    else if (r.ok) notificar("ok", r.ok);
    return !r.erro;
  } catch {
    notificar(
      "erro",
      "O envio não terminou. Confira a conexão e tente de novo.",
    );
    return false;
  }
}

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
    setEnviando(true);
    await enviarArquivo(grupo, arquivo);
    setEnviando(false);
    if (entrada.current) entrada.current.value = "";
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
