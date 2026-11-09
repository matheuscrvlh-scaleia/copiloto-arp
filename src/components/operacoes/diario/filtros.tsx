"use client";

import { ArrowRight, Loader, RotateCcw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Selecao } from "@/components/selecao";

// Barra de filtros das telas do Diário de Obra (spec 4.3): uma linha, já com
// o padrão da tela, e "Limpar". Tudo fica na URL (o link leva os filtros);
// a aba não é filtro e fica ao limpar.

export interface SelecaoDiario {
  /** Nome do parâmetro na URL. */
  chave: string;
  rotulo: string;
  /** Rótulo da opção que não filtra (valor ""). */
  todos: string;
  valor: string;
  opcoes: { valor: string; rotulo: string }[];
  icone?: React.ReactNode;
  largura?: string;
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;

export function FiltrosDiario({
  selecoes,
  periodo,
  manter = ["aba"],
}: {
  selecoes: SelecaoDiario[];
  /** Período (data inicial e final, sempre juntas, como na API). */
  periodo?: { de: string; ate: string; max: string };
  /** Parâmetros que "Limpar" mantém. */
  manter?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [carregando, iniciar] = useTransition();

  function ir(muda: (p: URLSearchParams) => void) {
    const novos = new URLSearchParams(params);
    muda(novos);
    const q = novos.toString();
    iniciar(() =>
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false }),
    );
  }

  function escolherData(qual: "de" | "ate", valor: string) {
    if (!periodo || !DATA.test(valor)) return;
    ir((p) => {
      let de = qual === "de" ? valor : periodo.de;
      let ate = qual === "ate" ? valor : periodo.ate;
      if (de > ate) [de, ate] = [ate, de];
      p.set("de", de);
      p.set("ate", ate);
    });
  }

  function limpar() {
    ir((p) => {
      for (const k of [...p.keys()]) if (!manter.includes(k)) p.delete(k);
    });
  }

  const temFiltro = [...params.keys()].some((k) => !manter.includes(k));
  const campoData =
    "rounded-full bg-transparent px-2 py-1.5 text-sm font-medium tabular-nums text-neutral-900 outline-none transition hover:bg-white/70 focus-visible:bg-white/90 focus-visible:ring-2 focus-visible:ring-neutral-900/15 [color-scheme:light] dark:[color-scheme:dark] dark:hover:bg-white/10";
  const divisor = (
    <span
      className="hidden h-6 w-px bg-neutral-900/10 sm:block dark:bg-white/15"
      aria-hidden
    />
  );

  return (
    <fieldset
      data-guia="filtros"
      className="vidro m-0 flex min-w-0 flex-wrap items-center gap-1 rounded-[1.75rem] p-1.5 sm:rounded-full"
      aria-busy={carregando}
    >
      <legend className="sr-only">Filtros da tela</legend>
      {periodo && (
        <div className="flex items-center gap-0.5 px-1">
          <label className="flex items-center gap-1">
            <span className="pl-2 text-xs text-neutral-500">Período</span>
            <input
              type="date"
              className={campoData}
              value={periodo.de}
              max={periodo.max}
              onChange={(e) => escolherData("de", e.target.value)}
              aria-label="Data inicial"
            />
          </label>
          <ArrowRight
            className="size-3.5 shrink-0 text-neutral-400"
            aria-hidden
          />
          <input
            type="date"
            className={campoData}
            value={periodo.ate}
            min={periodo.de}
            max={periodo.max}
            onChange={(e) => escolherData("ate", e.target.value)}
            aria-label="Data final"
          />
        </div>
      )}
      {selecoes.map((f, i) => (
        <span key={f.chave} className="contents">
          {(periodo || i > 0) && divisor}
          <Selecao
            variante="embutida"
            rotulo={f.rotulo}
            icone={f.icone}
            className={`${f.largura ?? "w-44"} max-w-full`}
            valor={f.valor}
            aoMudar={(v) =>
              ir((p) => {
                if (v) p.set(f.chave, v);
                else p.delete(f.chave);
                // Escolher no filtro desfaz o filtro do cartão.
                p.delete("cartao");
              })
            }
            opcoes={[{ valor: "", rotulo: f.todos }, ...f.opcoes]}
          />
        </span>
      ))}
      <span className="ml-auto flex items-center gap-2 pl-2 text-xs text-neutral-500">
        {carregando && (
          <span className="flex items-center gap-1.5 px-2">
            <Loader
              className="size-3.5 animate-spin motion-reduce:animate-none"
              aria-hidden
            />
            Atualizando…
          </span>
        )}
        <button
          type="button"
          onClick={limpar}
          disabled={!temFiltro || carregando}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-neutral-600 transition hover:bg-white/70 hover:text-neutral-900 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Limpar
        </button>
      </span>
    </fieldset>
  );
}
