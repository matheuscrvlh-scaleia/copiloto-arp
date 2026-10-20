"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useState } from "react";
import { type Opcao, Selecao } from "@/components/selecao";

// Tabela com busca no topo e rolagem só vertical: ocupa a altura do quadro,
// cabeçalho e rodapé ficam presos, e o texto quebra em vez de rolar para o
// lado. Opcionalmente filtra por seleções e pagina. As linhas chegam prontas
// (e já ordenadas) do servidor.

export interface ColunaBusca {
  titulo: string;
  /** Números alinham à direita e não quebram. */
  numero?: boolean;
}

export interface LinhaBusca {
  chave: string;
  /** Texto em que a busca procura. */
  busca: string;
  celulas: React.ReactNode[];
  /** Valor da linha em cada filtro, pela chave do filtro. */
  filtros?: Record<string, string>;
}

export interface FiltroBusca {
  chave: string;
  rotulo: string;
  /** Rótulo da opção que não filtra (ex.: "Todos os departamentos"). */
  todos: string;
  opcoes: Opcao[];
}

const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function TabelaBusca({
  colunas,
  linhas,
  rodape,
  filtros = [],
  porPagina,
  placeholder = "Buscar…",
  vazio = "Nenhum registro.",
}: {
  colunas: ColunaBusca[];
  linhas: LinhaBusca[];
  rodape?: React.ReactNode[];
  filtros?: FiltroBusca[];
  /** Linhas por página; sem ele, mostra tudo e rola. */
  porPagina?: number;
  placeholder?: string;
  vazio?: string;
}) {
  const [busca, setBusca] = useState("");
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});
  const [pagina, setPagina] = useState(0);
  const termo = sem(busca.trim());
  const filtrando =
    termo !== "" || Object.values(escolhas).some((v) => v !== "");
  const visiveis = linhas.filter(
    (l) =>
      (!termo || sem(l.busca).includes(termo)) &&
      Object.entries(escolhas).every(([k, v]) => !v || l.filtros?.[k] === v),
  );
  const paginas = porPagina
    ? Math.max(1, Math.ceil(visiveis.length / porPagina))
    : 1;
  const atual = Math.min(pagina, paginas - 1);
  const mostradas = porPagina
    ? visiveis.slice(atual * porPagina, (atual + 1) * porPagina)
    : visiveis;
  const alinhar = (c?: ColunaBusca) =>
    c?.numero
      ? "text-right tabular-nums whitespace-nowrap"
      : "text-left break-words";

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-56 flex-1 items-center gap-2 rounded-full border border-neutral-900/10 bg-white/70 py-1.5 pr-4 pl-1.5 text-sm">
          <span className="grid size-7 place-items-center rounded-full bg-neutral-900 text-white">
            <Search className="size-3.5" aria-hidden />
          </span>
          <span className="sr-only">{placeholder}</span>
          <input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(0);
            }}
            placeholder={placeholder}
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-neutral-400"
          />
        </label>
        {filtros.map((f) => (
          <Selecao
            key={f.chave}
            variante="pilula"
            rotulo={f.rotulo}
            className="w-56 max-w-full"
            valor={escolhas[f.chave] ?? ""}
            aoMudar={(v) => {
              setEscolhas((e) => ({ ...e, [f.chave]: v }));
              setPagina(0);
            }}
            opcoes={[{ valor: "", rotulo: f.todos }, ...f.opcoes]}
          />
        ))}
      </div>
      <div className="-mx-2 min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        {mostradas.length === 0 ? (
          <p className="px-2 py-6 text-sm text-neutral-500">
            {filtrando ? "Nada encontrado." : vazio}
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-white/90 backdrop-blur">
              <tr className="border-b border-neutral-200 text-xs text-neutral-500">
                {colunas.map((c) => (
                  <th
                    key={c.titulo}
                    className={`px-2 py-2 font-medium ${alinhar(c)}`}
                  >
                    {c.titulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mostradas.map((l) => (
                <tr
                  key={l.chave}
                  className="border-b border-neutral-900/[0.06] transition-colors last:border-0 hover:bg-white/50"
                >
                  {l.celulas.map((v, i) => (
                    <td
                      // biome-ignore lint/suspicious/noArrayIndexKey: posição da coluna é a identidade da célula
                      key={i}
                      className={`px-2 py-2 ${alinhar(colunas[i])}`}
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {rodape && !filtrando && (
              <tfoot className="sticky bottom-0 bg-white/90 backdrop-blur">
                <tr className="border-t border-neutral-300 font-semibold">
                  {rodape.map((v, i) => (
                    <td
                      // biome-ignore lint/suspicious/noArrayIndexKey: posição da coluna é a identidade da célula
                      key={i}
                      className={`px-2 py-2 ${alinhar(colunas[i])}`}
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
      {porPagina && visiveis.length > 0 && (
        <nav
          aria-label="Paginação"
          className="flex items-center justify-between gap-3 text-xs text-neutral-500"
        >
          <span className="tabular-nums">
            {atual * porPagina + 1}–
            {Math.min((atual + 1) * porPagina, visiveis.length)} de{" "}
            {visiveis.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPagina(atual - 1)}
              disabled={atual === 0}
              aria-label="Página anterior"
              className="vidro grid size-8 place-items-center rounded-full text-neutral-700 transition hover:border-neutral-400 disabled:opacity-40"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <span className="tabular-nums">
              {atual + 1} / {paginas}
            </span>
            <button
              type="button"
              onClick={() => setPagina(atual + 1)}
              disabled={atual >= paginas - 1}
              aria-label="Próxima página"
              className="vidro grid size-8 place-items-center rounded-full text-neutral-700 transition hover:border-neutral-400 disabled:opacity-40"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
