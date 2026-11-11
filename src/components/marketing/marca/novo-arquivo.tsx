"use client";

import { FileArchive, Plus, Upload, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { classeCampo } from "@/components/estilos";
import { notificar } from "@/components/notificacoes";
import {
  ehImagem,
  formatarTamanho,
  tipoDoArquivo,
} from "@/lib/marketing/marca";
import { novoArquivo } from "@/server/marketing/acoes/marca";
import { ACEITA, enviarArquivo, erroDoArquivo } from "./subir-arquivo";

// Último cartão da aba Arquivos: cadastra um arquivo de marca novo, com
// título, descrição e o arquivo (com prévia antes de enviar). Cria o grupo
// e envia pelo mesmo caminho do "Subir nova versão".

function Previa({ arquivo }: { arquivo: File }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(arquivo);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [arquivo]);
  const mime = tipoDoArquivo(arquivo.name);
  if (!url) return null;
  if (mime?.startsWith("image/"))
    return (
      // biome-ignore lint/performance/noImgElement: prévia local (blob), sem otimização
      <img
        src={url}
        alt={`Prévia de ${arquivo.name}`}
        className="h-48 w-full rounded-xl object-contain"
      />
    );
  if (mime === "application/pdf")
    return (
      <object
        data={url}
        type="application/pdf"
        aria-label={`Prévia de ${arquivo.name}`}
        className="h-64 w-full rounded-xl"
      />
    );
  return (
    <span className="flex h-24 flex-col items-center justify-center gap-1 text-neutral-500">
      <FileArchive className="size-8" aria-hidden />
      <span className="text-xs">ZIP: sem prévia</span>
    </span>
  );
}

/** Aba Imagens de referência: só imagem, e "para que serve" é obrigatório. */
const IMAGENS = ".png,.jpg,.jpeg,.svg";

export function NovoArquivo({ referencia = false }: { referencia?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const id = useId();

  const fechar = () => {
    setAberto(false);
    setTitulo("");
    setDescricao("");
    setArquivo(null);
  };
  const escolher = (a: File | undefined) => {
    if (!a) return;
    const erro = erroDoArquivo(a);
    if (erro) return notificar("erro", erro);
    if (referencia && !ehImagem(a.name))
      return notificar("erro", "Imagem de referência: envie PNG, JPG ou SVG.");
    setArquivo(a);
    // Sem título ainda: sugere o nome do arquivo, sem a extensão.
    if (!titulo.trim()) setTitulo(a.name.replace(/\.[^.]+$/, ""));
  };

  async function salvar() {
    if (!arquivo || !titulo.trim()) return;
    if (referencia && !descricao.trim()) return;
    setEnviando(true);
    const r = await novoArquivo({ titulo, descricao, referencia });
    if (!r.ok) notificar("erro", r.erro);
    else {
      // Se o envio falhar, o cartão novo fica como "Aguardando envio".
      await enviarArquivo(r.grupo, arquivo);
      fechar();
    }
    setEnviando(false);
  }

  if (!aberto)
    return (
      <li>
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="flex h-full min-h-40 w-full flex-col items-center justify-center gap-2 rounded-[1.75rem] border-2 border-dashed border-neutral-300 p-5 text-sm font-medium text-neutral-600 transition hover:border-neutral-500 hover:text-neutral-900"
        >
          <span className="grid size-10 place-items-center rounded-full bg-neutral-900/[0.05]">
            <Plus className="size-5" aria-hidden />
          </span>
          {referencia ? "Adicionar imagem de referência" : "Adicionar arquivo"}
        </button>
      </li>
    );

  return (
    <li className="vidro rounded-[1.75rem] p-5 md:p-6">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void salvar();
        }}
      >
        <h2 className="font-semibold tracking-tight">
          {referencia ? "Nova imagem de referência" : "Novo arquivo"}
        </h2>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Título</span>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={120}
            required
            placeholder={
              referencia
                ? "Ex.: Foto de evento no padrão da marca"
                : "Ex.: Manual de fotografia"
            }
            // biome-ignore lint/a11y/noAutofocus: abriu por clique em "Adicionar arquivo"
            autoFocus
            className={classeCampo}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">
            {referencia ? "Para que serve" : "Descrição"}
          </span>
          <textarea
            required={referencia}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder="Para que serve e quando usar"
            className={`${classeCampo} font-[inherit] leading-relaxed`}
          />
        </label>

        <input
          id={id}
          type="file"
          accept={referencia ? IMAGENS : ACEITA}
          className="sr-only"
          onChange={(e) => {
            escolher(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <label
          htmlFor={id}
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastando(false);
            escolher(e.dataTransfer.files[0]);
          }}
          className={`flex cursor-pointer flex-col gap-2 rounded-2xl border-2 border-dashed p-3 transition ${arrastando ? "border-marca bg-marca/10" : "border-neutral-300 hover:border-neutral-500"}`}
        >
          {arquivo ? (
            <>
              <Previa arquivo={arquivo} />
              <span className="flex items-center justify-between gap-2 text-xs text-neutral-600">
                <span className="min-w-0 truncate">
                  {arquivo.name} · {formatarTamanho(arquivo.size)}
                </span>
                <span className="shrink-0 font-medium underline-offset-4 hover:underline">
                  Trocar
                </span>
              </span>
            </>
          ) : (
            <span className="flex h-28 flex-col items-center justify-center gap-1 text-sm text-neutral-600">
              <Upload className="size-5" aria-hidden />
              Escolha ou arraste o arquivo
              <span className="text-xs text-neutral-500">
                {referencia
                  ? "PNG, JPG ou SVG, até 25 MB"
                  : "PDF, PNG, JPG, SVG ou ZIP, até 25 MB"}
              </span>
            </span>
          )}
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={
              enviando ||
              !arquivo ||
              !titulo.trim() ||
              (referencia && !descricao.trim())
            }
            className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enviando ? "Enviando…" : "Adicionar"}
          </button>
          <button
            type="button"
            onClick={fechar}
            disabled={enviando}
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 disabled:opacity-60"
          >
            <X className="size-3.5" aria-hidden />
            Cancelar
          </button>
        </div>
      </form>
    </li>
  );
}
