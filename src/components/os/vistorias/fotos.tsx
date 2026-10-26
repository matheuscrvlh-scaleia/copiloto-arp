"use client";

import { Camera, ImagePlus, Loader, Trash2, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";
import { ModalConfirmacao } from "@/components/modal-confirmacao";
import { tamanhoReduzido } from "@/lib/os/vistoria-regras";
import { enviarFoto, removerFoto } from "@/server/os/acoes/vistorias";
import type { Foto } from "./tipos";

// Fotos do ambiente: tiradas direto do telefone (ou da galeria), várias por
// vez, reduzidas no navegador antes de subir — o lado maior fica com uns
// 1600 px em JPEG, que pesa pouco e lê bem no laudo.

const LADO_MAIOR = 1600;
const QUALIDADE = 0.8;

async function decodificar(
  arquivo: File,
): Promise<ImageBitmap | HTMLImageElement> {
  try {
    // "from-image": respeita a orientação da câmera (foto em pé fica em pé).
    return await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(arquivo);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/** Foto reduzida em JPEG; null se o navegador não conseguir abrir o arquivo. */
export async function reduzirFoto(arquivo: File): Promise<File | null> {
  let imagem: ImageBitmap | HTMLImageElement;
  try {
    imagem = await decodificar(arquivo);
  } catch {
    return null;
  }
  const original = {
    largura: "naturalWidth" in imagem ? imagem.naturalWidth : imagem.width,
    altura: "naturalHeight" in imagem ? imagem.naturalHeight : imagem.height,
  };
  const { largura, altura } = tamanhoReduzido(original, LADO_MAIOR);
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(imagem, 0, 0, largura, altura);
  if ("close" in imagem) imagem.close();
  const blob = await new Promise<Blob | null>((ok) =>
    canvas.toBlob(ok, "image/jpeg", QUALIDADE),
  );
  if (!blob) return null;
  const nome = `${arquivo.name.replace(/\.[^.]+$/, "") || "foto"}.jpg`;
  return new File([blob], nome, { type: "image/jpeg" });
}

export function FotosDoAmbiente({
  vistoriaId,
  ambienteId,
  titulo,
  fotos,
  aoMudar,
}: {
  vistoriaId: string;
  ambienteId: string;
  titulo: string;
  fotos: Foto[];
  aoMudar: (fotos: Foto[]) => void;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [remover, setRemover] = useState<Foto | null>(null);
  const [removendo, setRemovendo] = useState(false);
  // As fotos chegam uma a uma; a lista atual fica aqui para não perder nenhuma.
  const atuais = useRef(fotos);
  atuais.current = fotos;

  async function enviar(lista: FileList | null) {
    const arquivos = [...(lista ?? [])];
    if (!arquivos.length) return;
    setErro(null);
    let falhas = 0;
    for (const [i, arquivo] of arquivos.entries()) {
      setProgresso(`Enviando ${i + 1} de ${arquivos.length}…`);
      const reduzida = await reduzirFoto(arquivo);
      if (!reduzida) {
        falhas += 1;
        continue;
      }
      const form = new FormData();
      form.set("vistoria_id", vistoriaId);
      form.set("ambiente_id", ambienteId);
      form.set("arquivo", reduzida);
      const r = await enviarFoto(form);
      if (r.foto) {
        atuais.current = [...atuais.current, r.foto];
        aoMudar(atuais.current);
      } else falhas += 1;
    }
    setProgresso(null);
    if (falhas)
      setErro(
        falhas === 1
          ? "Uma foto não subiu. Tente de novo."
          : `${falhas} fotos não subiram. Tente de novo.`,
      );
    if (camera.current) camera.current.value = "";
    if (galeria.current) galeria.current.value = "";
  }

  async function confirmarRemocao() {
    if (!remover) return;
    setRemovendo(true);
    const r = await removerFoto({ id: remover.id });
    setRemovendo(false);
    if (r.erro) {
      setErro(r.erro);
    } else {
      aoMudar(atuais.current.filter((f) => f.id !== remover.id));
    }
    setRemover(null);
  }

  const botao =
    "inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 disabled:cursor-wait disabled:opacity-60 sm:flex-none";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={botao}
          disabled={!!progresso}
          onClick={() => camera.current?.click()}
        >
          <Camera className="size-5" aria-hidden />
          Tirar foto
        </button>
        <button
          type="button"
          className={botao}
          disabled={!!progresso}
          onClick={() => galeria.current?.click()}
        >
          <ImagePlus className="size-5" aria-hidden />
          Da galeria
        </button>
        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-label={`Tirar foto de ${titulo}`}
          onChange={(e) => enviar(e.target.files)}
        />
        <input
          ref={galeria}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-label={`Escolher fotos de ${titulo}`}
          onChange={(e) => enviar(e.target.files)}
        />
        {progresso && (
          <output className="inline-flex items-center gap-2 text-sm text-neutral-600">
            <Loader
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden
            />
            {progresso}
          </output>
        )}
      </div>
      {erro && (
        <p
          role="alert"
          className="flex items-center gap-2 text-xs text-red-700"
        >
          <TriangleAlert className="size-3.5" aria-hidden />
          {erro}
        </p>
      )}

      {fotos.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {fotos.map((f, i) => (
            <li key={f.id} className="group relative">
              {f.url ? (
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener"
                  className="block overflow-hidden rounded-xl bg-neutral-100"
                >
                  {/* biome-ignore lint/performance/noImgElement: endereço assinado do bucket, temporário */}
                  <img
                    src={f.url}
                    alt={`Foto ${i + 1} de ${titulo}`}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                </a>
              ) : (
                <span className="grid aspect-square place-items-center rounded-xl bg-neutral-100 text-xs text-neutral-500">
                  Foto indisponível
                </span>
              )}
              <button
                type="button"
                onClick={() => setRemover(f)}
                className="absolute top-1 right-1 grid size-8 place-items-center rounded-full bg-black/55 text-[#fff] transition hover:bg-red-600"
                aria-label={`Remover a foto ${i + 1} de ${titulo}`}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-neutral-500">Nenhuma foto neste ambiente.</p>
      )}
      <p className="text-xs text-neutral-500">
        As fotos são reduzidas para não pesar, mantendo boa leitura no laudo.
      </p>

      <ModalConfirmacao
        aberto={!!remover}
        pergunta="Remover esta foto? Ela sai do ambiente e do laudo."
        rotulo="Remover"
        rotuloEnviando="Removendo…"
        perigo
        enviando={removendo}
        aoConfirmar={confirmarRemocao}
        aoFechar={() => setRemover(null)}
      />
    </div>
  );
}
