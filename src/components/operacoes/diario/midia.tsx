import { ImageOff, Paperclip, PlayCircle } from "lucide-react";
import type { Anexo, Foto, Video } from "@/connectors/diario-de-obras/schemas";
import { formatarData, formatarNumero } from "@/lib/formato";

// Fotos, vídeos e anexos mostrados direto do aplicativo Diário de Obra: o
// módulo guarda só os endereços (http(s), conferidos na entrada) e abre o
// arquivo do aplicativo numa aba nova.

export interface FotoNaGaleria extends Foto {
  /** Data do relatório (aaaa-mm-dd), quando a galeria junta vários. */
  data?: string;
  numero?: number;
}

const tamanho = (bytes: number | null | undefined) => {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${formatarNumero(bytes / 1024)} KB`;
  return `${formatarNumero(bytes / (1024 * 1024), 1)} MB`;
};

function legenda(f: FotoNaGaleria): string {
  return [
    f.data ? formatarData(f.data) : null,
    f.numero ? `relatório ${f.numero}` : null,
    f.descricao,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function Galeria({
  fotos,
  vazio = "Nenhuma foto.",
  limite = 120,
}: {
  fotos: FotoNaGaleria[];
  vazio?: string;
  /** Teto de miniaturas na tela (o resto fica no aplicativo). */
  limite?: number;
}) {
  const visiveis = fotos.filter((f) => f.url || f.urlMiniatura);
  if (visiveis.length === 0)
    return <p className="py-4 text-sm text-neutral-500">{vazio}</p>;
  return (
    <div data-guia="op-diario-galeria">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {visiveis.slice(0, limite).map((f, i) => {
          const texto = legenda(f) || `Foto ${i + 1}`;
          const src = f.urlMiniatura ?? f.url;
          return (
            <li key={`${f.url ?? f.urlMiniatura}-${i}`} className="min-w-0">
              <a
                href={f.url ?? f.urlMiniatura ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
                className="group block overflow-hidden rounded-2xl bg-neutral-900/[0.06] ring-1 ring-neutral-900/10 transition hover:ring-2 hover:ring-marca focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca"
                title={texto}
              >
                {src ? (
                  // biome-ignore lint/performance/noImgElement: foto servida pelo aplicativo Diário de Obra (endereço externo)
                  <img
                    src={src}
                    alt={texto}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="aspect-[4/3] w-full object-cover"
                  />
                ) : (
                  <span className="grid aspect-[4/3] place-items-center text-neutral-400">
                    <ImageOff className="size-5" aria-hidden />
                  </span>
                )}
              </a>
              {(f.data || f.descricao) && (
                <p className="mt-1 truncate text-[11px] text-neutral-500">
                  {texto}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {visiveis.length > limite && (
        <p className="mt-3 text-xs text-neutral-500">
          Mostrando {formatarNumero(limite)} de{" "}
          {formatarNumero(visiveis.length)} fotos. Filtre o período para ver as
          outras.
        </p>
      )}
    </div>
  );
}

export function Videos({
  videos,
  vazio = "Nenhum vídeo.",
}: {
  videos: (Video & { data?: string })[];
  vazio?: string;
}) {
  const lista = videos.filter((v) => v.url);
  if (lista.length === 0)
    return <p className="py-4 text-sm text-neutral-500">{vazio}</p>;
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {lista.map((v, i) => {
        const texto =
          [v.data ? formatarData(v.data) : null, v.descricao, v.duracao]
            .filter(Boolean)
            .join(" · ") || `Vídeo ${i + 1}`;
        return (
          <li key={`${v.url}-${i}`}>
            <a
              href={v.url ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              className="relative block overflow-hidden rounded-2xl bg-neutral-900/[0.06] ring-1 ring-neutral-900/10 transition hover:ring-2 hover:ring-marca focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca"
            >
              {v.urlFoto ? (
                // biome-ignore lint/performance/noImgElement: capa servida pelo aplicativo Diário de Obra (endereço externo)
                <img
                  src={v.urlFoto}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="aspect-video w-full object-cover"
                />
              ) : (
                <span className="block aspect-video" />
              )}
              <span className="absolute inset-0 grid place-items-center bg-black/20 text-white">
                <PlayCircle className="size-9" aria-hidden />
              </span>
              <span className="sr-only">Abrir vídeo: {texto}</span>
            </a>
            <p className="mt-1 truncate text-[11px] text-neutral-500">
              {texto}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

export function Anexos({
  anexos,
  vazio = "Nenhum anexo.",
}: {
  anexos: (Anexo & { data?: string })[];
  vazio?: string;
}) {
  const lista = anexos.filter((a) => a.url);
  if (lista.length === 0)
    return <p className="py-4 text-sm text-neutral-500">{vazio}</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {lista.map((a, i) => (
        <li key={`${a.url}-${i}`}>
          <a
            href={a.url ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-neutral-800 underline-offset-4 hover:underline"
          >
            <Paperclip className="size-4 text-neutral-400" aria-hidden />
            {a.descricao ?? `Anexo ${i + 1}`}
            <span className="text-xs font-normal text-neutral-500">
              {[
                a.data ? formatarData(a.data) : null,
                a.extensao?.toUpperCase(),
                tamanho(a.tamanho),
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
