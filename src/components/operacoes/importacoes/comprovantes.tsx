import {
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  ImageIcon,
} from "lucide-react";
import { formatarNumero } from "@/lib/formato";
import type { ArquivoComLink } from "@/server/operacoes/importacoes";

// Os arquivos da importação como foram recebidos (o comprovante): fotos em
// miniatura (abrem inteiras), PDF para ver em outra aba e planilhas para
// baixar. Os links valem 10 minutos (recarregar a tela gera outros).

const MAX_FOTOS = 24;

const ICONE = {
  pdf: FileText,
  planilha: FileSpreadsheet,
  foto: ImageIcon,
  outro: FileText,
} as const;

const tamanho = (b?: number) =>
  b === undefined
    ? null
    : b >= 1024 * 1024
      ? `${formatarNumero(b / 1024 / 1024, 1)} MB`
      : `${formatarNumero(Math.max(1, b / 1024), 0)} KB`;

export function Comprovantes({ arquivos }: { arquivos: ArquivoComLink[] }) {
  if (!arquivos.length)
    return (
      <p className="text-sm text-neutral-500">
        Nenhum arquivo registrado nesta importação.
      </p>
    );
  const fotos = arquivos.filter((a) => a.tipo === "foto");
  const documentos = arquivos.filter((a) => a.tipo !== "foto");
  const mostradas = fotos.slice(0, MAX_FOTOS);
  const [unica] = fotos;
  if (unica && fotos.length === 1 && !documentos.length && unica.urlVer)
    return (
      <a
        href={unica.urlVer}
        target="_blank"
        rel="noreferrer"
        title="Abrir a foto inteira"
      >
        {/* biome-ignore lint/performance/noImgElement: arquivo privado com link temporário */}
        <img
          src={unica.urlVer}
          alt={`Comprovante: ${unica.nome}`}
          className="max-h-[28rem] w-full rounded-2xl border border-neutral-900/[0.06] bg-white object-contain"
        />
      </a>
    );

  return (
    <div className="flex flex-col gap-4">
      {documentos.length > 0 && (
        <ul className="flex flex-col gap-2">
          {documentos.map((a) => {
            const Icone = ICONE[a.tipo];
            return (
              <li
                key={`${a.nome}-${a.caminho ?? ""}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-900/[0.06] bg-white/70 px-4 py-3"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Icone
                    className="size-5 shrink-0 text-neutral-500"
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block break-all text-sm font-medium">
                      {a.nome}
                    </span>
                    {tamanho(a.bytes) && (
                      <span className="text-xs text-neutral-500">
                        {tamanho(a.bytes)}
                      </span>
                    )}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  {a.urlVer && (
                    <a
                      href={a.urlVer}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-900/[0.06]"
                    >
                      <ExternalLink className="size-3.5" aria-hidden />
                      Ver
                    </a>
                  )}
                  {a.url ? (
                    <a
                      href={a.url}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-900/[0.06]"
                    >
                      <Download className="size-3.5" aria-hidden />
                      Baixar
                    </a>
                  ) : (
                    <span className="text-xs text-neutral-500">
                      arquivo não guardado
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {fotos.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-neutral-500">
            {fotos.length === 1
              ? "1 foto"
              : `${formatarNumero(fotos.length)} fotos`}
            {fotos.length > MAX_FOTOS &&
              ` (as primeiras ${MAX_FOTOS}; cada uma aparece também na leitura do hidrômetro)`}
          </p>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {mostradas.map((a) => (
              <li key={`${a.nome}-${a.caminho ?? ""}`}>
                {a.urlVer ? (
                  <a
                    href={a.urlVer}
                    target="_blank"
                    rel="noreferrer"
                    title={a.nome}
                    className="block"
                  >
                    {/* biome-ignore lint/performance/noImgElement: arquivo privado com link temporário */}
                    <img
                      src={a.urlVer}
                      alt={a.nome}
                      loading="lazy"
                      className="aspect-square w-full rounded-xl border border-neutral-900/[0.06] object-cover"
                    />
                  </a>
                ) : (
                  <span className="grid aspect-square place-items-center rounded-xl bg-neutral-900/[0.04] p-2 text-center text-[0.65rem] text-neutral-500">
                    {a.nome}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
