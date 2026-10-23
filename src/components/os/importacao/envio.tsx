"use client";

import { FileArchive, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import type { EstadoAcao } from "@/components/form-acao";

// Passo 1 da importação: o "Backup Geral" (ou o pacote de importação) vai
// direto do navegador para o bucket privado, por endereços assinados que o
// servidor gera depois de conferir a permissão: um backup com fotos passa
// muito do limite de uma requisição ao servidor. Depois do envio, o servidor
// lê o pacote e monta a prévia.

type Preparar = (arquivos: { nome: string; tamanho: number }[]) => Promise<
  | {
      importacaoId: string;
      chave: string;
      enderecos: { nome: string; url: string; tamanho: number }[];
    }
  | { erro: string }
>;

type Etapa = "escolher" | "enviando" | "lendo";

const mb = (n: number) =>
  `${(n / 1_048_576).toLocaleString("pt-BR", { maximumFractionDigits: n < 10_485_760 ? 1 : 0 })} MB`;

/** PUT com progresso (o fetch não informa o progresso do envio). */
function enviar(
  url: string,
  chave: string,
  arquivo: File,
  aoAndar: (enviados: number) => void,
): Promise<void> {
  return new Promise((resolver, rejeitar) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("apikey", chave);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader(
      "content-type",
      arquivo.type || "application/octet-stream",
    );
    xhr.upload.onprogress = (e) => aoAndar(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolver();
      rejeitar(
        new Error(
          xhr.status === 413 || /size|large/i.test(xhr.responseText)
            ? `${arquivo.name} passa do tamanho máximo do armazenamento: divida o backup em ZIPs menores (por exemplo, as fotos em partes).`
            : `${arquivo.name}: o arquivo não foi aceito (HTTP ${xhr.status}).`,
        ),
      );
    };
    xhr.onerror = () =>
      rejeitar(new Error(`${arquivo.name}: a conexão caiu durante o envio.`));
    xhr.send(arquivo);
  });
}

export function EnvioDoBackup({
  preparar,
  ler,
}: {
  preparar: Preparar;
  ler: (importacaoId: string) => Promise<EstadoAcao>;
}) {
  const id = useId();
  const campo = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [enviados, setEnviados] = useState<number[]>([]);
  const [etapa, setEtapa] = useState<Etapa>("escolher");
  const [erro, setErro] = useState<string | null>(null);

  const total = arquivos.reduce((t, a) => t + a.size, 0);
  const feito = enviados.reduce((t, n) => t + n, 0);
  const ocupado = etapa !== "escolher";

  function escolher(lista: FileList | null) {
    setErro(null);
    setArquivos(lista ? [...lista].filter((a) => a.size > 0) : []);
  }

  async function comecar() {
    if (!arquivos.length) {
      setErro("Escolha o backup (ZIP) ou os arquivos do pacote.");
      return;
    }
    setErro(null);
    setEtapa("enviando");
    setEnviados(arquivos.map(() => 0));
    try {
      const preparo = await preparar(
        arquivos.map((a) => ({ nome: a.name, tamanho: a.size })),
      );
      if ("erro" in preparo) throw new Error(preparo.erro);
      // Dois por vez: rápido sem estourar a conexão do celular.
      const fila = preparo.enderecos.map((e, i) => ({ e, i }));
      const trabalhar = async () => {
        for (let item = fila.shift(); item; item = fila.shift()) {
          const { e, i } = item;
          const arquivo = arquivos[i];
          if (!arquivo) continue;
          await enviar(e.url, preparo.chave, arquivo, (n) =>
            setEnviados((v) => v.map((x, k) => (k === i ? n : x))),
          );
          setEnviados((v) => v.map((x, k) => (k === i ? arquivo.size : x)));
        }
      };
      await Promise.all([trabalhar(), trabalhar()]);
      setEtapa("lendo");
      const r = await ler(preparo.importacaoId);
      if (r.erro) setErro(r.erro);
      setArquivos([]);
      setEtapa("escolher");
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha no envio.");
      setEtapa("escolher");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <label
        htmlFor={id}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-neutral-900/15 px-4 py-8 text-center transition hover:border-neutral-900/40 ${ocupado ? "pointer-events-none opacity-60" : ""}`}
      >
        <Upload className="size-6 text-neutral-500" aria-hidden />
        <span className="text-sm font-medium">
          Escolha o backup (.zip) ou os arquivos do pacote
        </span>
        <span className="max-w-md text-xs text-neutral-500">
          Envie sem editar nada. Pode ser um ZIP só, vários ZIPs (dados e fotos
          separados) ou os arquivos JSON/CSV soltos.
        </span>
        <input
          ref={campo}
          id={id}
          type="file"
          multiple
          disabled={ocupado}
          accept=".zip,.json,.csv,image/*,application/zip"
          onChange={(e) => escolher(e.target.files)}
          className="sr-only"
        />
      </label>

      {arquivos.length > 0 && (
        <ul className="flex flex-col gap-2">
          {arquivos.map((a, i) => {
            const pct = a.size
              ? Math.round(((enviados[i] ?? 0) / a.size) * 100)
              : 0;
            return (
              <li
                key={`${a.name}-${a.size}-${a.lastModified}`}
                className="flex items-center gap-3 rounded-2xl bg-white/60 px-3 py-2 ring-1 ring-neutral-900/[0.06]"
              >
                <FileArchive
                  className="size-4 shrink-0 text-neutral-500"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{a.name}</p>
                  {etapa === "enviando" && (
                    <div
                      role="progressbar"
                      aria-label={`Envio de ${a.name}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={pct}
                      className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-900/[0.08]"
                    >
                      <div
                        className="h-full rounded-full bg-marca transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
                <span className="shrink-0 text-xs text-neutral-500 tabular-nums">
                  {mb(a.size)}
                </span>
                {!ocupado && (
                  <button
                    type="button"
                    aria-label={`Tirar ${a.name}`}
                    onClick={() => setArquivos((l) => l.filter((x) => x !== a))}
                    className="grid size-8 place-items-center rounded-full text-neutral-500 hover:bg-neutral-900/[0.06]"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={comecar}
          disabled={ocupado || !arquivos.length}
          className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {etapa === "enviando"
            ? `Enviando… ${total ? Math.round((feito / total) * 100) : 0}%`
            : etapa === "lendo"
              ? "Lendo o pacote e conferindo…"
              : "Enviar e ver a prévia"}
        </button>
        {arquivos.length > 0 && etapa === "escolher" && (
          <span className="text-xs text-neutral-500">
            {arquivos.length} {arquivos.length === 1 ? "arquivo" : "arquivos"} ·{" "}
            {mb(total)}
          </span>
        )}
        <output aria-live="polite" className="sr-only">
          {etapa === "lendo" ? "Envio concluído. Lendo o pacote." : ""}
        </output>
        {erro && (
          <span role="alert" className="text-sm text-red-700">
            {erro}
          </span>
        )}
      </div>
      <p className="text-xs text-neutral-500">
        Nada entra no módulo antes da sua confirmação na prévia.
      </p>
    </div>
  );
}
