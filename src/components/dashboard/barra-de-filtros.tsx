"use client";

import {
  ArrowRight,
  CalendarDays,
  Loader,
  RotateCcw,
  Search,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Selecao } from "@/components/selecao";
import {
  ATALHOS_MKT,
  type AtalhoMkt,
  dataMktValida,
  diasEntre,
} from "@/lib/marketing/periodo";
import { lembrarFiltros } from "@/server/preferencias/acoes";
import type { ModuloComFiltros } from "@/server/preferencias/filtros";

// Barra de filtros das telas do Marketing e do Comercial (spec 4.3): uma linha só, já
// preenchida com o padrão da tela, e "Limpar". Tudo fica na URL (o link leva
// os filtros) e o sistema lembra os últimos de cada pessoa por tela: abrir a
// tela sem filtros na URL volta aos últimos usados.

const PERSONALIZADO = "personalizado";
const DO_PERIODO = ["periodo", "de", "ate"];

export interface FiltroSelecao {
  /** Nome do parâmetro na URL. */
  chave: string;
  rotulo: string;
  /** Rótulo da opção que não filtra (valor ""). */
  todos: string;
  opcoes: { valor: string; rotulo: string }[];
  valor: string;
  icone?: React.ReactNode;
  /** Largura (classe), ex.: "w-48". */
  largura?: string;
}

export function BarraDeFiltros({
  modulo,
  tela,
  periodo,
  hoje,
  atalhos,
  selecoes = [],
  busca,
  lembrado,
}: {
  /** Módulo e chave da tela para lembrar os filtros (ex.: "anuncios"). */
  modulo: ModuloComFiltros;
  tela: string;
  /** Sem período (ex.: Marca), a barra mostra só as seleções. */
  periodo?: { de: string; ate: string; atalho: AtalhoMkt | null };
  /** aaaa-mm-dd: nada depois de hoje. */
  hoje: string;
  /** Atalhos oferecidos (padrão: todos). */
  atalhos?: AtalhoMkt[];
  selecoes?: FiltroSelecao[];
  busca?: { chave: string; valor: string; placeholder: string };
  /**
   * Filtros guardados da pessoa, quando a URL veio sem nenhum: a barra os
   * coloca na URL ao abrir.
   */
  lembrado?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [carregando, iniciar] = useTransition();
  const [texto, setTexto] = useState(busca?.valor ?? "");
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (lembrado && params.size === 0)
      router.replace(`${pathname}?${lembrado}`, { scroll: false });
  }, [lembrado, params, pathname, router]);

  function ir(muda: (p: URLSearchParams) => void) {
    const novos = new URLSearchParams(params);
    novos.delete("limpar");
    muda(novos);
    const q = novos.toString();
    void lembrarFiltros(modulo, tela, q);
    iniciar(() => router.replace(`${pathname}?${q}`, { scroll: false }));
  }

  // A aba não é filtro: Limpar fica nela.
  function limpar() {
    void lembrarFiltros(modulo, tela, "");
    setTexto("");
    const aba = params.get("aba");
    const q = aba ? `aba=${encodeURIComponent(aba)}&limpar=1` : "limpar=1";
    iniciar(() => router.replace(`${pathname}?${q}`, { scroll: false }));
  }

  function escolherData(qual: "de" | "ate", valor: string) {
    if (!periodo || !dataMktValida(valor)) return;
    ir((p) => {
      for (const k of DO_PERIODO) p.delete(k);
      let de = qual === "de" ? valor : periodo.de;
      let ate = qual === "ate" ? valor : periodo.ate;
      if (de > ate) [de, ate] = [ate, de];
      p.set("de", de);
      p.set("ate", ate);
    });
  }

  const lista = ATALHOS_MKT.filter(
    (a) => !atalhos || atalhos.includes(a.valor),
  );
  const campoData =
    "rounded-full bg-transparent px-2 py-1.5 text-sm font-medium tabular-nums text-neutral-900 outline-none transition hover:bg-white/70 focus-visible:bg-white/90 focus-visible:ring-2 focus-visible:ring-neutral-900/15 [color-scheme:light] dark:[color-scheme:dark] dark:hover:bg-white/10";
  const divisor = (
    <span
      className="hidden h-6 w-px bg-neutral-900/10 sm:block dark:bg-white/15"
      aria-hidden
    />
  );
  const temFiltro = [...params.keys()].some(
    (k) => k !== "limpar" && k !== "aba",
  );

  return (
    <fieldset
      className="vidro m-0 flex min-w-0 flex-wrap items-center gap-1 rounded-[1.75rem] p-1.5 sm:rounded-full"
      aria-busy={carregando}
    >
      <legend className="sr-only">Filtros da tela</legend>
      {periodo && (
        <>
          <Selecao
            variante="embutida"
            rotulo="Período"
            icone={<CalendarDays className="size-4" />}
            className="w-48"
            valor={periodo.atalho ?? PERSONALIZADO}
            aoMudar={(v) =>
              v !== PERSONALIZADO &&
              ir((p) => {
                for (const k of DO_PERIODO) p.delete(k);
                p.set("periodo", v);
              })
            }
            opcoes={[
              ...lista.map((a) => ({ valor: a.valor, rotulo: a.rotulo })),
              {
                valor: PERSONALIZADO,
                rotulo: "Personalizado",
                descricao: "Escolha a data inicial e a final",
              },
            ]}
          />
          <div className="flex items-center gap-0.5 px-1">
            <input
              type="date"
              className={campoData}
              value={periodo.de}
              max={hoje}
              onChange={(e) => escolherData("de", e.target.value)}
              aria-label="Data inicial"
            />
            <ArrowRight
              className="size-3.5 shrink-0 text-neutral-400"
              aria-hidden
            />
            <input
              type="date"
              className={campoData}
              value={periodo.ate}
              min={periodo.de}
              max={hoje}
              onChange={(e) => escolherData("ate", e.target.value)}
              aria-label="Data final"
            />
          </div>
        </>
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
              })
            }
            opcoes={[{ valor: "", rotulo: f.todos }, ...f.opcoes]}
          />
        </span>
      ))}

      {busca && (
        <>
          {divisor}
          <label className="flex min-w-40 flex-1 items-center gap-2 px-3">
            <Search className="size-4 shrink-0 text-neutral-400" aria-hidden />
            <input
              type="search"
              value={texto}
              placeholder={busca.placeholder}
              onChange={(e) => {
                const v = e.target.value;
                setTexto(v);
                clearTimeout(espera.current);
                espera.current = setTimeout(
                  () =>
                    ir((p) => {
                      if (v.trim()) p.set(busca.chave, v.trim());
                      else p.delete(busca.chave);
                    }),
                  350,
                );
              }}
              className="w-full bg-transparent py-1.5 text-sm outline-none placeholder:text-neutral-400"
              aria-label={busca.placeholder}
            />
          </label>
        </>
      )}

      <span className="ml-auto flex items-center gap-2 pl-2 text-xs text-neutral-500">
        {carregando ? (
          <span className="flex items-center gap-1.5 px-2">
            <Loader
              className="size-3.5 animate-spin motion-reduce:animate-none"
              aria-hidden
            />
            Atualizando…
          </span>
        ) : (
          periodo && (
            <span className="px-1">
              {diasEntre(periodo.de, periodo.ate)}{" "}
              {diasEntre(periodo.de, periodo.ate) === 1 ? "dia" : "dias"}
            </span>
          )
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
