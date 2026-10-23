"use client";

import { FileSpreadsheet, FileText, Loader } from "lucide-react";
import { useState } from "react";
import type { CelulaExportar, ColunaExportar } from "@/lib/os/exportar";

// Exportar Excel e PDF com um clique, exatamente o que está na tela.
// Contrato (estável, outras telas já usam):
//   <BotaoExportar
//     titulo="Minha caixa"                   // título do arquivo
//     filtros="Tipo: OS · Setor: Operações"  // linha de filtros, escrita abaixo do título
//     nomeArquivo="minha-caixa"              // sem extensão
//     colunas={[{ titulo: "Número" }, { titulo: "Valor", numero: true }]}
//     linhas={[["#12", 1234.5], …]}          // exatamente o que está na tela
//   />
// Lista paginada no servidor: em vez de `linhas`, passe `carregar` (Server
// Action que lê o resultado filtrado inteiro e devolve { colunas, linhas });
// ela só roda no clique. `total` (opcional) vai na dica do botão.
// Gera no navegador (o que a pessoa vê já passou pelo RLS e pelas
// permissões), carregando o gerador só no clique. Quem não tem a permissão
// de exportar não recebe o botão (a tela decide).

export type { CelulaExportar, ColunaExportar } from "@/lib/os/exportar";

type Formato = "xlsx" | "pdf";

const TIPO: Record<Formato, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

function baixar(bytes: Uint8Array, nome: string, formato: Formato) {
  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], { type: TIPO[formato] }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  // Dá tempo ao navegador de começar o download antes de soltar o arquivo.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function BotaoExportar({
  titulo,
  filtros,
  nomeArquivo,
  colunas = [],
  linhas = [],
  carregar,
  total,
}: {
  titulo: string;
  filtros?: string;
  nomeArquivo: string;
  colunas?: ColunaExportar[];
  linhas?: CelulaExportar[][];
  /** Lê tudo no clique (listas paginadas); senão vale `colunas`/`linhas`. */
  carregar?: () => Promise<{
    colunas: ColunaExportar[];
    linhas: CelulaExportar[][];
  }>;
  /** Linhas do resultado inteiro, para a dica do botão. */
  total?: number;
}) {
  const [gerando, setGerando] = useState<Formato | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const quantas = total ?? (carregar ? null : linhas.length);
  const dica = (onde: string) =>
    quantas === null
      ? `Baixar em ${onde} (o resultado inteiro)`
      : `Baixar em ${onde} (${quantas} ${quantas === 1 ? "linha" : "linhas"})`;

  async function exportar(formato: Formato) {
    setGerando(formato);
    setErro(null);
    try {
      const [gerador, conteudo] = await Promise.all([
        import("@/lib/os/exportar"),
        carregar ? carregar() : Promise.resolve({ colunas, linhas }),
      ]);
      const agora = new Date();
      const dados = { titulo, filtros, ...conteudo, geradoEm: agora };
      const bytes =
        formato === "xlsx"
          ? await gerador.gerarExcel(dados)
          : await gerador.gerarPdf(dados);
      baixar(
        bytes,
        gerador.nomeDoArquivo(nomeArquivo, agora, formato),
        formato,
      );
    } catch (e) {
      console.error("exportar", e);
      setErro("Não foi possível gerar o arquivo. Tente de novo.");
    } finally {
      setGerando(null);
    }
  }

  const botao =
    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-white/80 hover:text-neutral-900 disabled:cursor-wait disabled:opacity-60 dark:hover:bg-white/10";

  return (
    <div className="flex items-center gap-2">
      <fieldset
        aria-label="Exportar"
        className="vidro m-0 inline-flex items-center gap-0.5 rounded-full p-1"
      >
        <button
          type="button"
          className={botao}
          disabled={gerando !== null}
          onClick={() => exportar("xlsx")}
          title={dica("Excel")}
        >
          {gerando === "xlsx" ? (
            <Loader
              className="size-3.5 animate-spin motion-reduce:animate-none"
              aria-hidden
            />
          ) : (
            <FileSpreadsheet className="size-3.5" aria-hidden />
          )}
          Excel
        </button>
        <button
          type="button"
          className={botao}
          disabled={gerando !== null}
          onClick={() => exportar("pdf")}
          title={dica("PDF")}
        >
          {gerando === "pdf" ? (
            <Loader
              className="size-3.5 animate-spin motion-reduce:animate-none"
              aria-hidden
            />
          ) : (
            <FileText className="size-3.5" aria-hidden />
          )}
          PDF
        </button>
      </fieldset>
      {erro && (
        <span role="alert" className="text-xs text-red-700">
          {erro}
        </span>
      )}
    </div>
  );
}
