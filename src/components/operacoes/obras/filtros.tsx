"use client";

import { FileStack, Loader, RotateCcw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Selecao } from "@/components/selecao";

// Filtros da obra (spec 4.9: obra, revisão do orçamento e período), numa
// linha, pela URL (?rev=R00&de=2026-07&ate=2027-06), com "Limpar". A aba
// não é filtro: Limpar fica nela.

const CHAVES = ["rev", "de", "ate"];

export function FiltrosDaObra({
  revisoes,
  revisao,
  de,
  ate,
  primeiro,
  ultimo,
}: {
  revisoes: { valor: string; rotulo: string }[];
  /** Código da revisão mostrada. */
  revisao: string;
  /** "aaaa-mm" ou "". */
  de: string;
  ate: string;
  /** Limites do período ("aaaa-mm"). */
  primeiro: string;
  ultimo: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [carregando, iniciar] = useTransition();

  function ir(muda: Record<string, string>) {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(muda)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const q = p.toString();
    iniciar(() =>
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false }),
    );
  }

  const temFiltro = CHAVES.some((k) => params.has(k));
  const campoMes =
    "rounded-full bg-transparent px-2 py-1.5 text-sm font-medium tabular-nums text-neutral-900 outline-none transition hover:bg-white/70 focus-visible:bg-white/90 focus-visible:ring-2 focus-visible:ring-neutral-900/15 [color-scheme:light] dark:[color-scheme:dark] dark:hover:bg-white/10";

  return (
    <fieldset
      data-guia="filtros"
      aria-busy={carregando}
      className="vidro m-0 flex min-w-0 flex-wrap items-center gap-1 rounded-[1.75rem] p-1.5 sm:rounded-full"
    >
      <legend className="sr-only">Filtros da obra</legend>
      <Selecao
        variante="embutida"
        rotulo="Revisão do orçamento"
        icone={<FileStack className="size-4" />}
        className="w-56"
        valor={revisao}
        aoMudar={(v) => ir({ rev: v })}
        opcoes={revisoes}
      />
      <span
        className="hidden h-6 w-px bg-neutral-900/10 sm:block dark:bg-white/15"
        aria-hidden
      />
      <label className="flex items-center gap-1 pl-2 text-sm text-neutral-500">
        De
        <input
          type="month"
          aria-label="Período: de"
          className={campoMes}
          value={de}
          min={primeiro}
          max={ate || ultimo}
          onChange={(e) => ir({ de: e.target.value })}
        />
      </label>
      <label className="flex items-center gap-1 text-sm text-neutral-500">
        até
        <input
          type="month"
          aria-label="Período: até"
          className={campoMes}
          value={ate}
          min={de || primeiro}
          max={ultimo}
          onChange={(e) => ir({ ate: e.target.value })}
        />
      </label>
      <div className="ml-auto flex items-center gap-1">
        {carregando && (
          <Loader
            className="size-4 animate-spin text-neutral-500"
            aria-label="Atualizando"
          />
        )}
        <button
          type="button"
          disabled={!temFiltro}
          onClick={() => ir({ rev: "", de: "", ate: "" })}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-neutral-600 transition hover:bg-white/70 hover:text-neutral-900 disabled:opacity-40 dark:hover:bg-white/10"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Limpar
        </button>
      </div>
    </fieldset>
  );
}
