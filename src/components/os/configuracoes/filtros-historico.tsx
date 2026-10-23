"use client";

import { ArrowRight, Database, Loader, Search, User, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Selecao } from "@/components/selecao";

// Busca e filtros do histórico do módulo, guardados na URL (o link leva a
// busca junto). A busca espera a pessoa parar de digitar; qualquer mudança
// volta à página 1.

const ESPERA_MS = 400;
const FILTROS = ["q", "tabela", "quem", "de", "ate", "registro"];

export function FiltrosHistoricoOS({
  tabelas,
  autores,
  hoje,
}: {
  tabelas: { tabela: string; nome: string }[];
  autores: { id: string; nome: string }[];
  /** aaaa-mm-dd: limite das datas. */
  hoje: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [carregando, iniciar] = useTransition();
  const [texto, setTexto] = useState(params.get("q") ?? "");
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);

  function ir(muda: (p: URLSearchParams) => void) {
    const novos = new URLSearchParams(params);
    muda(novos);
    novos.delete("pagina");
    iniciar(() =>
      router.replace(`${pathname}?${novos.toString()}`, { scroll: false }),
    );
  }

  const trocar = (nome: string, valor: string) =>
    ir((p) => {
      if (valor) p.set(nome, valor);
      else p.delete(nome);
    });

  function buscar(valor: string) {
    setTexto(valor);
    clearTimeout(espera.current);
    espera.current = setTimeout(() => trocar("q", valor.trim()), ESPERA_MS);
  }
  useEffect(() => () => clearTimeout(espera.current), []);

  const filtrando = FILTROS.some((k) => params.has(k));
  const campoData =
    "rounded-full bg-transparent px-2 py-1.5 text-sm font-medium tabular-nums text-neutral-900 outline-none transition hover:bg-white/70 focus-visible:bg-white/90 focus-visible:ring-2 focus-visible:ring-neutral-900/15 [color-scheme:light] dark:[color-scheme:dark] dark:hover:bg-white/10";

  return (
    <div className="flex flex-col gap-2" aria-busy={carregando}>
      <label className="flex items-center gap-2 rounded-full border border-neutral-900/10 bg-white/70 py-1.5 pr-4 pl-1.5 text-sm">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-neutral-900 text-white">
          <Search className="size-3.5" aria-hidden />
        </span>
        <span className="sr-only">Buscar no histórico</span>
        <input
          type="search"
          value={texto}
          onChange={(e) => buscar(e.target.value)}
          placeholder="Número do chamado (#123), pessoa ou o que mudou (ex.: feriado)"
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-neutral-400"
        />
        {carregando && (
          <Loader
            className="size-3.5 shrink-0 animate-spin text-neutral-500 motion-reduce:animate-none"
            aria-label="Atualizando"
          />
        )}
      </label>

      <fieldset className="vidro m-0 flex min-w-0 flex-wrap items-center gap-1 rounded-[1.75rem] p-1.5 sm:rounded-full">
        <legend className="sr-only">Filtros do histórico</legend>
        <Selecao
          variante="embutida"
          rotulo="O quê"
          icone={<Database className="size-4" />}
          className="w-60 max-w-full"
          valor={params.get("tabela") ?? ""}
          aoMudar={(v) => trocar("tabela", v)}
          opcoes={[
            { valor: "", rotulo: "Tudo do módulo" },
            ...tabelas.map((t) => ({ valor: t.tabela, rotulo: t.nome })),
          ]}
        />
        <Selecao
          variante="embutida"
          rotulo="Quem"
          icone={<User className="size-4" />}
          className="w-56 max-w-full"
          valor={params.get("quem") ?? ""}
          aoMudar={(v) => trocar("quem", v)}
          opcoes={[
            { valor: "", rotulo: "Todas as pessoas" },
            ...autores.map((a) => ({ valor: a.id, rotulo: a.nome })),
          ]}
        />
        <div className="flex items-center gap-0.5 px-1">
          <label className="flex items-center gap-1">
            <span className="pl-1 text-xs text-neutral-500">De</span>
            <input
              type="date"
              className={campoData}
              value={params.get("de") ?? ""}
              max={hoje}
              onChange={(e) => trocar("de", e.target.value)}
              aria-label="Data inicial"
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
              value={params.get("ate") ?? ""}
              max={hoje}
              onChange={(e) => trocar("ate", e.target.value)}
              aria-label="Data final"
            />
          </label>
        </div>
        {params.get("registro") && (
          <button
            type="button"
            onClick={() => trocar("registro", "")}
            className="flex items-center gap-1.5 rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white"
          >
            Um registro só
            <X className="size-3.5" aria-label="tirar o filtro" />
          </button>
        )}
        {filtrando && (
          <button
            type="button"
            onClick={() => {
              clearTimeout(espera.current);
              setTexto("");
              ir((p) => {
                for (const k of FILTROS) p.delete(k);
              });
            }}
            className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-neutral-600 transition hover:bg-white/70 hover:text-neutral-900 dark:hover:bg-white/10"
          >
            <X className="size-3.5" aria-hidden />
            Limpar filtros
          </button>
        )}
      </fieldset>
    </div>
  );
}
