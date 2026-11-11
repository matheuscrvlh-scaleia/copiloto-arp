import {
  Download,
  FileArchive,
  FileImage,
  FileText,
  Hourglass,
} from "lucide-react";
import { formatarDataHora } from "@/lib/formato";
import { formatarTamanho } from "@/lib/marketing/marca";
import type { ArquivoMarca } from "@/server/marketing/marca";
import { NovoArquivo } from "./novo-arquivo";
import { SubirArquivo } from "./subir-arquivo";

// Arquivos de marca para baixar: a versão atual de cada um e, recolhidas,
// as anteriores. Quem edita sobe uma versão nova (a anterior fica aqui) ou
// cadastra um arquivo novo no último cartão.

/** Ordem de leitura (o resto vem depois, por título). */
const ORDEM = ["rebranding", "guia_rapido", "ebook_108_anos", "logos"];

function Icone({ mime }: { mime: string | null }) {
  const classe = "size-6";
  if (mime?.startsWith("image/"))
    return <FileImage className={classe} aria-hidden />;
  if (mime === "application/zip")
    return <FileArchive className={classe} aria-hidden />;
  return <FileText className={classe} aria-hidden />;
}

function Baixar({ id, compacto = false }: { id: string; compacto?: boolean }) {
  return (
    <a
      href={`/marketing/marca/arquivo/${id}`}
      className={
        compacto
          ? "inline-flex items-center gap-1 text-xs font-medium text-neutral-700 underline-offset-4 hover:text-neutral-900 hover:underline"
          : "inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-800"
      }
    >
      <Download className={compacto ? "size-3" : "size-4"} aria-hidden />
      Baixar
    </a>
  );
}

function Dados({ a, nomes }: { a: ArquivoMarca; nomes: Map<string, string> }) {
  const quem = a.enviado_por ? nomes.get(a.enviado_por) : null;
  return (
    <>
      {[
        a.arquivo_nome,
        formatarTamanho(a.tamanho),
        `versão ${a.versao}`,
        `enviado em ${formatarDataHora(a.enviado_em).slice(0, 10)}${quem ? ` por ${quem}` : ""}`,
      ]
        .filter(Boolean)
        .join(" · ")}
    </>
  );
}

export function Arquivos({
  arquivos,
  nomes,
  podeEditar,
}: {
  arquivos: ArquivoMarca[];
  nomes: Map<string, string>;
  podeEditar: boolean;
}) {
  const grupos = [...new Set(arquivos.map((a) => a.grupo))].sort(
    (a, b) =>
      (ORDEM.indexOf(a) + 1 || 99) - (ORDEM.indexOf(b) + 1 || 99) ||
      a.localeCompare(b),
  );
  return (
    <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {grupos.map((g) => {
        const doGrupo = arquivos
          .filter((a) => a.grupo === g)
          .sort((a, b) => b.versao - a.versao);
        const atual = doGrupo.find((a) => a.atual) ?? doGrupo[0];
        if (!atual) return null;
        const anteriores = doGrupo.filter(
          (a) => a.id !== atual.id && a.arquivo_path,
        );
        const enviado = Boolean(atual.arquivo_path);
        return (
          <li
            key={g}
            className="vidro flex flex-col gap-4 rounded-[1.75rem] p-5 md:p-6"
          >
            {enviado && atual.tipo_mime?.startsWith("image/") && (
              // biome-ignore lint/performance/noImgElement: bucket privado, link assinado pela rota de download
              <img
                src={`/marketing/marca/arquivo/${atual.id}`}
                alt={`Prévia de ${atual.titulo}`}
                loading="lazy"
                className="h-40 w-full rounded-2xl bg-neutral-900/[0.04] object-contain p-2"
              />
            )}
            <div className="flex items-start gap-4">
              <span
                className={`grid size-12 shrink-0 place-items-center rounded-2xl ${enviado ? "bg-marca/20 text-marca-escuro" : "bg-neutral-900/[0.05] text-neutral-400"}`}
              >
                <Icone mime={atual.tipo_mime} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold tracking-tight">{atual.titulo}</h2>
                {atual.descricao && (
                  <p className="mt-0.5 text-sm text-neutral-600">
                    {atual.descricao}
                  </p>
                )}
                <p className="mt-1.5 break-words text-xs text-neutral-500">
                  {enviado ? (
                    <Dados a={atual} nomes={nomes} />
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 font-medium text-amber-800">
                      <Hourglass className="size-3" aria-hidden />
                      Aguardando envio
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {enviado && <Baixar id={atual.id} />}
              {podeEditar && <SubirArquivo grupo={g} primeiro={!enviado} />}
              {!enviado && !podeEditar && (
                <span className="text-xs text-neutral-500">
                  Quem edita a marca envia o arquivo por aqui.
                </span>
              )}
            </div>
            {anteriores.length > 0 && (
              <details className="group rounded-2xl border border-neutral-900/10 bg-white/50 px-4 py-2">
                <summary className="cursor-pointer text-xs font-medium text-neutral-600">
                  Versões anteriores ({anteriores.length})
                </summary>
                <ul className="mt-2 flex flex-col gap-2 pb-1">
                  {anteriores.map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600"
                    >
                      <span className="min-w-0 break-words">
                        <Dados a={a} nomes={nomes} />
                      </span>
                      <Baixar id={a.id} compacto />
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        );
      })}
      {podeEditar && <NovoArquivo />}
    </ul>
  );
}

/**
 * Imagens de referência: o padrão ideal da marca, em grade, com título e
 * para que serve. Guia o time e o Copiloto ao criar peças. Trocar a imagem
 * sobe uma versão nova (a anterior não se apaga).
 */
export function Referencias({
  arquivos,
  nomes,
  podeEditar,
}: {
  arquivos: ArquivoMarca[];
  nomes: Map<string, string>;
  podeEditar: boolean;
}) {
  const atuais = arquivos
    .filter((a) => a.atual)
    .sort((a, b) => b.enviado_em.localeCompare(a.enviado_em));
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {atuais.map((a) => {
        const enviado = Boolean(a.arquivo_path);
        return (
          <li
            key={a.grupo}
            className="vidro flex flex-col gap-3 overflow-hidden rounded-[1.75rem] p-3"
          >
            {enviado ? (
              <a
                href={`/marketing/marca/arquivo/${a.id}`}
                target="_blank"
                rel="noreferrer"
                title="Abrir a imagem em tamanho real"
              >
                {/* biome-ignore lint/performance/noImgElement: bucket privado, link assinado pela rota de download */}
                <img
                  src={`/marketing/marca/arquivo/${a.id}`}
                  alt={a.titulo}
                  loading="lazy"
                  className="aspect-[4/3] w-full rounded-2xl bg-neutral-900/[0.04] object-cover"
                />
              </a>
            ) : (
              <span className="grid aspect-[4/3] place-items-center rounded-2xl bg-neutral-900/[0.04] text-xs text-amber-800">
                Aguardando envio
              </span>
            )}
            <div className="flex flex-col gap-1 px-2">
              <h2 className="font-semibold tracking-tight">{a.titulo}</h2>
              {a.descricao && (
                <p className="text-sm text-neutral-600">{a.descricao}</p>
              )}
              {enviado && (
                <p className="text-xs text-neutral-500">
                  <Dados a={a} nomes={nomes} />
                </p>
              )}
            </div>
            {podeEditar && (
              <div className="px-2 pb-2">
                <SubirArquivo grupo={a.grupo} primeiro={!enviado} />
              </div>
            )}
          </li>
        );
      })}
      {podeEditar && <NovoArquivo referencia />}
      {!atuais.length && !podeEditar && (
        <li className="text-sm text-neutral-500">
          Nenhuma imagem de referência ainda.
        </li>
      )}
    </ul>
  );
}
