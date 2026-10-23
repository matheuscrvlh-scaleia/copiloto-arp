"use client";

import { Loader, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { type Opcao, Selecao } from "@/components/selecao";

// Filtros da lista de ativos, guardados na URL (?cat=…&local=…), para o
// link levar os filtros junto e os cartões do topo filtrarem a lista.

export interface FiltroAtivos {
  chave: string;
  rotulo: string;
  opcoes: Opcao[];
}

export function FiltrosAtivos({
  filtros,
  busca,
}: {
  filtros: FiltroAtivos[];
  busca: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [carregando, iniciar] = useTransition();
  const [texto, setTexto] = useState(busca);
  // A busca mudou por fora (cartão, "Limpar"): o campo acompanha.
  const [anterior, setAnterior] = useState(busca);
  if (busca !== anterior) {
    setAnterior(busca);
    setTexto(busca);
  }

  function trocar(mudancas: Record<string, string>) {
    const novos = new URLSearchParams(params);
    for (const [k, v] of Object.entries(mudancas)) {
      if (v) novos.set(k, v);
      else novos.delete(k);
    }
    const q = novos.toString();
    iniciar(() =>
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false }),
    );
  }

  // Busca enquanto digita, sem uma ida ao servidor por tecla.
  useEffect(() => {
    if (texto === busca) return;
    const t = setTimeout(() => trocar({ q: texto.trim() }), 350);
    return () => clearTimeout(t);
  });

  const filtrando =
    busca !== "" ||
    filtros.some((f) => params.get(f.chave)) ||
    params.has("incompleto") ||
    params.has("preventiva");

  return (
    <div
      className="vidro flex flex-wrap items-center gap-1 rounded-[1.75rem] p-1.5 md:rounded-full"
      aria-busy={carregando}
    >
      <label className="flex min-w-0 flex-1 basis-full items-center gap-2 rounded-full py-1 pr-3 pl-1.5 text-sm sm:basis-56">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-neutral-900 text-white">
          {carregando ? (
            <Loader
              className="size-3.5 animate-spin motion-reduce:animate-none"
              aria-hidden
            />
          ) : (
            <Search className="size-3.5" aria-hidden />
          )}
        </span>
        <span className="sr-only">Buscar ativo</span>
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Código, nome ou número de série…"
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-neutral-400"
        />
      </label>
      {filtros.map((f) => (
        <Selecao
          key={f.chave}
          variante="embutida"
          rotulo={f.rotulo}
          className="max-w-full"
          valor={params.get(f.chave) ?? ""}
          aoMudar={(v) => trocar({ [f.chave]: v })}
          opcoes={f.opcoes}
        />
      ))}
      {filtrando && (
        <button
          type="button"
          onClick={() => {
            setTexto("");
            trocar({
              q: "",
              incompleto: "",
              preventiva: "",
              ...Object.fromEntries(filtros.map((f) => [f.chave, ""])),
            });
          }}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-neutral-500 transition hover:bg-white/70 hover:text-neutral-900"
        >
          <X className="size-3.5" aria-hidden />
          Limpar
        </button>
      )}
    </div>
  );
}
