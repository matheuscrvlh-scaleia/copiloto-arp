"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useState } from "react";

// Lista em cartões empilhados com busca (melhor que tabela no celular). Os
// itens chegam prontos do servidor; a busca procura no texto de cada um.

export interface ItemBusca {
  chave: string;
  busca: string;
  conteudo: React.ReactNode;
}

const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function ListaBusca({
  itens,
  placeholder = "Buscar…",
  vazio = "Nada por aqui.",
  porPagina = 25,
}: {
  itens: ItemBusca[];
  placeholder?: string;
  vazio?: string;
  porPagina?: number;
}) {
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(0);
  const termo = sem(busca.trim());
  const visiveis = termo
    ? itens.filter((i) => sem(i.busca).includes(termo))
    : itens;
  const paginas = Math.max(1, Math.ceil(visiveis.length / porPagina));
  const atual = Math.min(pagina, paginas - 1);
  const mostrados = visiveis.slice(atual * porPagina, (atual + 1) * porPagina);

  return (
    <div className="flex flex-col gap-3">
      <label className="relative block">
        <span className="sr-only">{placeholder}</span>
        <Search
          className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-neutral-400"
          aria-hidden
        />
        <input
          type="search"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setPagina(0);
          }}
          placeholder={placeholder}
          className="w-full rounded-full border border-neutral-200 bg-white/80 py-2.5 pr-4 pl-10 text-sm outline-none transition focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5"
        />
      </label>
      {mostrados.length === 0 ? (
        <p className="py-6 text-sm text-neutral-500">
          {termo ? "Nada encontrado." : vazio}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-900/[0.06]">
          {mostrados.map((i) => (
            <li key={i.chave} className="py-3 first:pt-1 last:pb-1">
              {i.conteudo}
            </li>
          ))}
        </ul>
      )}
      {paginas > 1 && (
        <nav
          aria-label="Páginas"
          className="flex items-center justify-end gap-2 text-sm text-neutral-600"
        >
          <span className="tabular-nums">
            {atual * porPagina + 1}–
            {Math.min((atual + 1) * porPagina, visiveis.length)} de{" "}
            {visiveis.length}
          </span>
          <button
            type="button"
            onClick={() => setPagina(atual - 1)}
            disabled={atual === 0}
            aria-label="Página anterior"
            className="grid size-8 place-items-center rounded-full hover:bg-white disabled:opacity-40"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setPagina(atual + 1)}
            disabled={atual >= paginas - 1}
            aria-label="Próxima página"
            className="grid size-8 place-items-center rounded-full hover:bg-white disabled:opacity-40"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </nav>
      )}
    </div>
  );
}
