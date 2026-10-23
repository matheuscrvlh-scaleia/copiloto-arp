"use client";

import {
  ArrowRight,
  Building2,
  CalendarRange,
  Columns3,
  Eye,
  Flag,
  FolderTree,
  Layers,
  ListFilter,
  Loader,
  type LucideIcon,
  Tag,
  User,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { lembrarFiltros } from "@/app/(app)/os/visoes-actions";
import { type Opcao, Selecao } from "@/components/selecao";
import type { CampoFiltro, Tela } from "@/lib/os/lista";
import { PARAM_PAINEL } from "@/lib/os/rotas";

// Barra de filtros das visões, numa linha: cada escolha vai para a URL (o
// link leva os filtros junto) e fica lembrada para a próxima visita
// (core.preferencias). "Limpar" volta ao padrão e esquece os lembrados; as
// escolhas de visão (setor do Meu setor, recorte, agrupamento) ficam.

export const ICONES = {
  tipo: Layers,
  setor: Building2,
  categoria: FolderTree,
  responsavel: User,
  prioridade: Flag,
  status: ListFilter,
  etiqueta: Tag,
  agrupar: Columns3,
  recorte: Eye,
  visao: CalendarRange,
} satisfies Partial<Record<CampoFiltro, LucideIcon>>;

export interface CampoBarra {
  chave: CampoFiltro;
  rotulo: string;
  /** Opção sem filtro (o padrão), ex.: "Todos os tipos". */
  todos?: string;
  opcoes: Opcao[];
  /** Classe de largura (ex.: "w-44"). */
  largura?: string;
}

const ESPERA_MS = 500;

export function BarraFiltros({
  tela,
  valores,
  campos,
  fixos = [],
  periodo = false,
  etiqueta = false,
  lembrados = false,
}: {
  tela: Tela;
  /** Filtros em vigor (da URL ou os lembrados). */
  valores: Partial<Record<CampoFiltro, string>>;
  campos: CampoBarra[];
  /** Escolhas de visão que o "Limpar" mantém. */
  fixos?: CampoFiltro[];
  /** Período de abertura (de / até). */
  periodo?: boolean;
  /** Campo de etiqueta (texto). */
  etiqueta?: boolean;
  /** Os filtros vieram da última visita. */
  lembrados?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [carregando, iniciar] = useTransition();
  const [textoEtiqueta, setTextoEtiqueta] = useState(valores.etiqueta ?? "");
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(espera.current), []);

  const chavesDaTela = new Set<string>([
    ...campos.map((c) => c.chave),
    ...fixos,
    ...(periodo ? ["de", "ate"] : []),
    ...(etiqueta ? ["etiqueta"] : []),
  ]);

  /** Parâmetros que não são filtros (ex.: data do calendário) seguem na URL. */
  function outrosParametros(): URLSearchParams {
    const p = new URLSearchParams();
    for (const [k, v] of params.entries())
      if (!chavesDaTela.has(k) && k !== PARAM_PAINEL && k !== "cartao")
        p.set(k, v);
    return p;
  }

  function aplicar(novos: Partial<Record<string, string>>) {
    const limpos = Object.fromEntries(
      Object.entries(novos).filter((e): e is [string, string] => !!e[1]),
    );
    void lembrarFiltros(tela, limpos);
    const p = outrosParametros();
    for (const [k, v] of Object.entries(limpos)) p.set(k, v);
    // Sem nenhum filtro na URL a tela usaria os lembrados: marca o padrão.
    if (![...p.keys()].some((k) => chavesDaTela.has(k))) p.set("f", "0");
    iniciar(() =>
      router.replace(`${pathname}?${p.toString()}`, { scroll: false }),
    );
  }

  const trocar = (chave: string, valor: string) =>
    aplicar({ ...valores, [chave]: valor });

  function digitarEtiqueta(v: string) {
    setTextoEtiqueta(v);
    clearTimeout(espera.current);
    espera.current = setTimeout(() => trocar("etiqueta", v.trim()), ESPERA_MS);
  }

  const filtrando = Object.entries(valores).some(
    ([k, v]) => v && !fixos.includes(k as CampoFiltro),
  );

  function limpar() {
    clearTimeout(espera.current);
    setTextoEtiqueta("");
    aplicar(
      Object.fromEntries(
        fixos.map((k) => [k, valores[k] ?? ""] as const),
      ) as Partial<Record<string, string>>,
    );
  }

  const campoData =
    "rounded-full bg-transparent px-2 py-1.5 text-sm font-medium tabular-nums text-neutral-900 outline-none transition hover:bg-white/70 focus-visible:bg-white/90 focus-visible:ring-2 focus-visible:ring-neutral-900/15 [color-scheme:light] dark:[color-scheme:dark] dark:hover:bg-white/10";

  return (
    <div className="flex flex-col gap-1.5" aria-busy={carregando}>
      <fieldset className="vidro m-0 flex min-w-0 flex-wrap items-center gap-1 rounded-[1.75rem] p-1.5 sm:rounded-full">
        <legend className="sr-only">Filtros</legend>
        {campos.map((c) => {
          const Icone = ICONES[c.chave as keyof typeof ICONES] ?? ListFilter;
          return (
            <Selecao
              key={c.chave}
              variante="embutida"
              rotulo={c.rotulo}
              icone={<Icone className="size-4" />}
              className={`${c.largura ?? "w-44"} max-w-full`}
              valor={valores[c.chave] ?? ""}
              aoMudar={(v) => trocar(c.chave, v)}
              opcoes={
                c.todos !== undefined
                  ? [{ valor: "", rotulo: c.todos }, ...c.opcoes]
                  : c.opcoes
              }
            />
          );
        })}
        {etiqueta && (
          <label className="flex w-40 max-w-full items-center gap-2 rounded-full py-2 pr-3 pl-3.5 text-sm transition focus-within:bg-white/90 hover:bg-white/70 dark:focus-within:bg-white/15 dark:hover:bg-white/10">
            <Tag className="size-4 shrink-0 text-neutral-500" aria-hidden />
            <span className="sr-only">Etiqueta</span>
            <input
              type="search"
              value={textoEtiqueta}
              onChange={(e) => digitarEtiqueta(e.target.value)}
              placeholder="Etiqueta"
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-neutral-400"
            />
          </label>
        )}
        {periodo && (
          <div className="flex items-center gap-0.5 px-1">
            <label className="flex items-center gap-1">
              <span className="pl-1 text-xs text-neutral-500">Aberto de</span>
              <input
                type="date"
                className={campoData}
                value={valores.de ?? ""}
                max={valores.ate || undefined}
                onChange={(e) => trocar("de", e.target.value)}
              />
            </label>
            <ArrowRight
              className="size-3.5 shrink-0 text-neutral-400"
              aria-hidden
            />
            <label className="flex items-center gap-1">
              <span className="sr-only">até</span>
              <input
                type="date"
                className={campoData}
                value={valores.ate ?? ""}
                min={valores.de || undefined}
                onChange={(e) => trocar("ate", e.target.value)}
              />
            </label>
          </div>
        )}
        {carregando && (
          <Loader
            className="mx-2 size-3.5 shrink-0 animate-spin text-neutral-500 motion-reduce:animate-none"
            aria-label="Atualizando"
          />
        )}
        {filtrando && (
          <button
            type="button"
            onClick={limpar}
            className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-neutral-600 transition hover:bg-white/70 hover:text-neutral-900 dark:hover:bg-white/10"
          >
            <X className="size-3.5" aria-hidden />
            Limpar
          </button>
        )}
      </fieldset>
      {lembrados && filtrando && (
        <p className="px-4 text-xs text-neutral-500">
          Filtros da sua última visita.
        </p>
      )}
    </div>
  );
}
