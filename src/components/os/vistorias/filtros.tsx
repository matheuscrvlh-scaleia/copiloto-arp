"use client";

import { ArrowRight, Loader, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { type Opcao, Selecao } from "@/components/selecao";

// Filtros da lista de vistorias, na URL (?tipo=…&de=…), para o link levar
// os filtros e os cartões do topo filtrarem junto.

export interface FiltroVistorias {
  chave: string;
  rotulo: string;
  opcoes: Opcao[];
}

/** Parâmetros que o "Limpar" apaga (o cartão escolhido também). */
const DA_BARRA = ["q", "de", "ate", "cartao"];

export function FiltrosVistorias({
  filtros,
  busca,
  de,
  ate,
}: {
  filtros: FiltroVistorias[];
  busca: string;
  de: string;
  ate: string;
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
    // Filtro novo, lista nova: volta à página 1.
    novos.delete("pagina");
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
    if (texto.trim() === busca) return;
    const t = setTimeout(() => trocar({ q: texto.trim() }), 350);
    return () => clearTimeout(t);
  });

  const filtrando =
    DA_BARRA.some((k) => params.get(k)) ||
    filtros.some((f) => params.get(f.chave));
  const campoData =
    "rounded-full bg-transparent px-2 py-1.5 text-sm tabular-nums outline-none transition hover:bg-white/70 focus-visible:bg-white/90 focus-visible:ring-2 focus-visible:ring-neutral-900/15 [color-scheme:light] dark:[color-scheme:dark] dark:hover:bg-white/10";

  return (
    <fieldset
      className="vidro m-0 flex min-w-0 flex-wrap items-center gap-1 rounded-[1.75rem] px-3 py-1.5 md:rounded-full"
      aria-busy={carregando}
    >
      <legend className="sr-only">Filtros das vistorias</legend>
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
        <span className="sr-only">Buscar vistoria</span>
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Código, locatário ou unidade…"
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
      <div className="flex items-center gap-0.5 px-3">
        <label className="flex items-center gap-1">
          <span className="pl-1 text-xs text-neutral-500">De</span>
          <input
            type="date"
            className={campoData}
            value={de}
            max={ate || undefined}
            onChange={(e) => trocar({ de: e.target.value })}
            aria-label="Data inicial da vistoria"
          />
        </label>
        <ArrowRight
          className="size-3.5 shrink-0 text-neutral-400"
          aria-hidden
        />
        <label className="flex items-center gap-1">
          <span className="sr-only">Até</span>
          <input
            type="date"
            className={campoData}
            value={ate}
            min={de || undefined}
            onChange={(e) => trocar({ ate: e.target.value })}
            aria-label="Data final da vistoria"
          />
        </label>
      </div>
      {filtrando && (
        <button
          type="button"
          onClick={() => {
            setTexto("");
            trocar({
              ...Object.fromEntries(DA_BARRA.map((k) => [k, ""])),
              ...Object.fromEntries(filtros.map((f) => [f.chave, ""])),
            });
          }}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-neutral-500 transition hover:bg-white/70 hover:text-neutral-900"
        >
          <X className="size-3.5" aria-hidden />
          Limpar
        </button>
      )}
    </fieldset>
  );
}
