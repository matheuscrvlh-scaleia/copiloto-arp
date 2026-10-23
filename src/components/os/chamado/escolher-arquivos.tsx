"use client";

import { Camera, FileText, Paperclip, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef } from "react";
import { formatarTamanho, reduzirFotos } from "./arquivos";

// Fotos e arquivos de um chamado: "Tirar foto" abre a câmera do celular
// (no computador, o seletor de imagens) e "Anexar" escolhe qualquer arquivo.
// As fotos já entram reduzidas; a lista mostra miniatura e deixa tirar.

const ACEITOS =
  "image/*,application/pdf,text/plain,text/csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx";

export function EscolherArquivos({
  arquivos,
  aoMudar,
  soFoto = false,
  rotulo,
  compacto = false,
}: {
  arquivos: File[];
  aoMudar: (arquivos: File[]) => void;
  /** Campo de foto da categoria: só câmera/imagem. */
  soFoto?: boolean;
  /** Nome acessível do grupo (ex.: "Foto do local"). */
  rotulo?: string;
  /** Só os botões redondos, sem a lista (barra do comentário). */
  compacto?: boolean;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const id = useId();

  async function adicionar(lista: FileList | null) {
    if (!lista?.length) return;
    const novos = await reduzirFotos([...lista]);
    aoMudar([...arquivos, ...novos]);
    if (camera.current) camera.current.value = "";
    if (arquivo.current) arquivo.current.value = "";
  }

  const botao = compacto
    ? "grid size-10 place-items-center rounded-full text-neutral-600 transition hover:bg-neutral-900/[0.06] hover:text-neutral-900"
    : "inline-flex min-h-11 items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400";

  return (
    <div className="flex flex-col gap-2">
      {/* biome-ignore lint/a11y/useSemanticElements: grupo de botões, não de campos */}
      <div role="group" aria-label={rotulo} className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => camera.current?.click()}
          className={botao}
          aria-label={compacto ? "Tirar foto" : undefined}
          title="Tirar foto"
        >
          <Camera className="size-4" aria-hidden />
          {!compacto && "Tirar foto"}
        </button>
        {!soFoto && (
          <button
            type="button"
            onClick={() => arquivo.current?.click()}
            className={botao}
            aria-label={compacto ? "Anexar arquivo" : undefined}
            title="Anexar arquivo"
          >
            <Paperclip className="size-4" aria-hidden />
            {!compacto && "Anexar"}
          </button>
        )}
        <input
          ref={camera}
          id={`${id}-camera`}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          hidden
          onChange={(e) => adicionar(e.currentTarget.files)}
        />
        <input
          ref={arquivo}
          id={`${id}-arquivo`}
          type="file"
          accept={soFoto ? "image/*" : ACEITOS}
          multiple
          hidden
          onChange={(e) => adicionar(e.currentTarget.files)}
        />
      </div>
      {!compacto && arquivos.length > 0 && (
        <ListaDeArquivos
          arquivos={arquivos}
          aoTirar={(i) => aoMudar(arquivos.filter((_, k) => k !== i))}
        />
      )}
    </div>
  );
}

export function ListaDeArquivos({
  arquivos,
  aoTirar,
}: {
  arquivos: File[];
  aoTirar: (indice: number) => void;
}) {
  // Miniaturas locais; liberadas quando a lista muda.
  const urls = useMemo(
    () =>
      arquivos.map((a) =>
        a.type.startsWith("image/") ? URL.createObjectURL(a) : null,
      ),
    [arquivos],
  );
  useEffect(
    () => () => {
      for (const u of urls) if (u) URL.revokeObjectURL(u);
    },
    [urls],
  );

  return (
    <ul className="flex flex-wrap gap-2">
      {arquivos.map((a, i) => (
        <li
          key={`${a.name}-${a.size}-${a.lastModified}`}
          className="relative flex max-w-full items-center gap-2 rounded-2xl border border-neutral-200 bg-white py-1.5 pr-9 pl-1.5 text-xs"
        >
          {urls[i] ? (
            // biome-ignore lint/performance/noImgElement: prévia local (blob:)
            <img
              src={urls[i] ?? undefined}
              alt=""
              className="size-10 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-neutral-900/[0.05] text-neutral-500">
              <FileText className="size-4" aria-hidden />
            </span>
          )}
          <span className="min-w-0">
            <span className="block max-w-[10rem] truncate font-medium">
              {a.name}
            </span>
            <span className="text-neutral-500">{formatarTamanho(a.size)}</span>
          </span>
          <button
            type="button"
            onClick={() => aoTirar(i)}
            aria-label={`Tirar ${a.name}`}
            className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-900/[0.07] hover:text-neutral-900"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
