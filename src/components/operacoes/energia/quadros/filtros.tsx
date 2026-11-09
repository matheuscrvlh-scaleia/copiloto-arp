"use client";

import { CircleDot, LayoutGrid, Loader, RotateCcw, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Selecao } from "@/components/selecao";

// Barra de filtros dos quadros (spec 4.3 e 4.5), numa linha: o bloco troca
// o quadro, o status e a busca (sala, ocupante ou número) apagam no
// desenho o que fica de fora. Tudo na URL: o link leva os filtros.
// "Limpar" volta status e busca ao padrão e fica no mesmo quadro.

export function FiltrosDoQuadro({
  quadros,
  quadro,
  status,
  busca,
  opcoesStatus,
}: {
  quadros: { valor: string; rotulo: string }[];
  quadro: string;
  status: string;
  busca: string;
  opcoesStatus: { valor: string; rotulo: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [carregando, iniciar] = useTransition();
  const [texto, setTexto] = useState(busca);
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(espera.current), []);

  function ir(muda: (p: URLSearchParams) => void) {
    const novos = new URLSearchParams(params);
    novos.delete("caixa");
    muda(novos);
    const q = novos.toString();
    iniciar(() =>
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false }),
    );
  }

  function limpar() {
    clearTimeout(espera.current);
    setTexto("");
    ir((p) => {
      p.delete("status");
      p.delete("q");
    });
  }

  const divisor = (
    <span
      className="hidden h-6 w-px bg-neutral-900/10 sm:block dark:bg-white/15"
      aria-hidden
    />
  );

  return (
    <fieldset
      data-guia="op-energia-filtros"
      className="vidro m-0 flex min-w-0 flex-wrap items-center gap-1 rounded-[1.75rem] p-1.5 sm:rounded-full"
      aria-busy={carregando}
    >
      <legend className="sr-only">Filtros dos quadros de medidores</legend>
      <Selecao
        variante="embutida"
        rotulo="Bloco (quadro)"
        icone={<LayoutGrid className="size-4" />}
        className="w-56 max-w-full"
        valor={quadro}
        aoMudar={(v) => ir((p) => p.set("quadro", v))}
        opcoes={quadros}
      />
      {divisor}
      <Selecao
        variante="embutida"
        rotulo="Status"
        icone={<CircleDot className="size-4" />}
        className="w-52 max-w-full"
        valor={status}
        aoMudar={(v) =>
          ir((p) => {
            if (v) p.set("status", v);
            else p.delete("status");
          })
        }
        opcoes={opcoesStatus}
      />
      {divisor}
      <label className="flex min-w-40 flex-1 items-center gap-2 px-3">
        <Search className="size-4 shrink-0 text-neutral-400" aria-hidden />
        <input
          type="search"
          value={texto}
          placeholder="Buscar sala, ocupante ou número da caixa"
          onChange={(e) => {
            const v = e.target.value;
            setTexto(v);
            clearTimeout(espera.current);
            espera.current = setTimeout(
              () =>
                ir((p) => {
                  if (v.trim()) p.set("q", v.trim());
                  else p.delete("q");
                }),
              350,
            );
          }}
          className="w-full bg-transparent py-1.5 text-sm outline-none placeholder:text-neutral-400"
          aria-label="Buscar sala, ocupante ou número da caixa"
        />
      </label>
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
          disabled={(!status && !busca && !texto) || carregando}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-neutral-600 transition hover:bg-white/70 hover:text-neutral-900 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Limpar
        </button>
      </span>
    </fieldset>
  );
}
