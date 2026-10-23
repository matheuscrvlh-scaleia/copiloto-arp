"use client";

import {
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
  Search,
  SlidersHorizontal,
  Tag,
  User,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { lembrarFiltros } from "@/app/(app)/os/visoes-actions";
import { type Opcao, Selecao } from "@/components/selecao";
import {
  type CampoFiltro,
  descreverPeriodo,
  TELAS,
  type Tela,
} from "@/lib/os/lista";
import { PARAM_PAINEL } from "@/lib/os/rotas";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import { PainelFiltros } from "./painel-filtros";

// Barra de filtros das visões, numa linha limpa: os 3–4 filtros principais,
// a busca da lista e o botão "Filtros", que abre um painel com o resto
// (categoria, prioridade, etiqueta, período). Os filtros do painel ativos
// aparecem como chips removíveis embaixo. Cada escolha vai para a URL (o
// link leva os filtros junto) e fica lembrada para a próxima visita
// (core.preferencias). "Limpar" volta ao padrão e esquece os lembrados; as
// escolhas de visão (setor do Meu setor, recorte, agrupamento) ficam. No
// celular a linha mostra só os 2 primeiros; o resto vai para o painel.

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

export type Valores = Partial<Record<CampoFiltro, string>>;

const ESPERA_MS = 500;

/** Na linha do celular, só os primeiros principais. */
const NO_CELULAR = 2;

/**
 * Parâmetros que não sobrevivem a uma troca de filtro: a janela lateral, o
 * cartão, a página e o "mostrar mais" do quadro (voltam ao começo).
 */
const DESCARTADOS = new Set([PARAM_PAINEL, "cartao", "pagina", "mais", "f"]);

/** Troca filtros da tela na URL e lembra a escolha (core.preferencias). */
export function useFiltrosDaTela(tela: Tela) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [carregando, iniciar] = useTransition();
  const chaves = new Set<string>(TELAS[tela]);

  function navegar(p: URLSearchParams) {
    const qs = p.toString();
    iniciar(() =>
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }),
    );
  }

  function aplicar(
    novos: Partial<Record<string, string | undefined>>,
    extra?: (p: URLSearchParams) => void,
  ) {
    const limpos = Object.fromEntries(
      Object.entries(novos).filter((e): e is [string, string] => !!e[1]),
    );
    void lembrarFiltros(tela, limpos);
    // Parâmetros que não são filtros (ex.: data do calendário, busca, ordem)
    // seguem na URL.
    const p = new URLSearchParams();
    for (const [k, v] of params.entries())
      if (!chaves.has(k) && !DESCARTADOS.has(k)) p.append(k, v);
    for (const [k, v] of Object.entries(limpos)) p.set(k, v);
    extra?.(p);
    // Sem nenhum filtro na URL a tela usaria os lembrados: marca o padrão.
    if (![...p.keys()].some((k) => chaves.has(k))) p.set("f", "0");
    navegar(p);
  }

  return { aplicar, navegar, params, carregando };
}

export function BarraFiltros({
  tela,
  valores,
  campos,
  extras = [],
  fixos = [],
  periodo = false,
  etiqueta = false,
  lembrados = false,
  busca,
}: {
  tela: Tela;
  /** Filtros em vigor (da URL ou os lembrados). */
  valores: Valores;
  /** Principais, na linha (no celular, só os 2 primeiros). */
  campos: CampoBarra[];
  /** O resto, no painel "Filtros". */
  extras?: CampoBarra[];
  /** Escolhas de visão que o "Limpar" mantém. */
  fixos?: CampoFiltro[];
  /** Período de abertura (de / até), no painel. */
  periodo?: boolean;
  /** Etiqueta (texto), no painel. */
  etiqueta?: boolean;
  /** Os filtros vieram da última visita. */
  lembrados?: boolean;
  /** Busca da lista na linha (?q=, no servidor). */
  busca?: { placeholder: string };
}) {
  const { aplicar, navegar, params, carregando } = useFiltrosDaTela(tela);
  const [aberto, setAberto] = useState(false);
  const botaoFiltros = useRef<HTMLButtonElement>(null);
  const hoje = useMemo(() => hojeEmBrasilia(new Date()), []);

  const qUrl = params.get("q") ?? "";
  const [texto, setTexto] = useState(qUrl);
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(espera.current), []);
  // A busca mudou por fora (voltar do navegador, "Limpar"): acompanha.
  const ultimaQ = useRef(qUrl);
  useEffect(() => {
    if (qUrl !== ultimaQ.current) {
      ultimaQ.current = qUrl;
      setTexto(qUrl);
    }
  }, [qUrl]);

  function digitar(v: string) {
    setTexto(v);
    clearTimeout(espera.current);
    espera.current = setTimeout(() => {
      const p = new URLSearchParams(params);
      p.delete("pagina");
      p.delete(PARAM_PAINEL);
      const t = v.trim();
      ultimaQ.current = t;
      if (t) p.set("q", t);
      else p.delete("q");
      navegar(p);
    }, ESPERA_MS);
  }

  const trocar = (mudancas: Partial<Record<CampoFiltro, string>>) =>
    aplicar({ ...valores, ...mudancas });

  const ativo = (k: CampoFiltro) => !!valores[k] && !fixos.includes(k);
  const filtrando =
    (Object.keys(valores) as CampoFiltro[]).some(ativo) || !!qUrl;

  function limpar() {
    clearTimeout(espera.current);
    setTexto("");
    ultimaQ.current = "";
    aplicar(
      Object.fromEntries(fixos.map((k) => [k, valores[k] ?? ""] as const)),
      (p) => p.delete("q"),
    );
  }

  // Chips: o que está ativo no painel (os principais já aparecem na linha).
  const chips: { chave: string; texto: string; tirar: () => void }[] = [
    ...extras
      .filter((c) => ativo(c.chave))
      .map((c) => ({
        chave: c.chave,
        texto: `${c.rotulo}: ${c.opcoes.find((o) => o.valor === valores[c.chave])?.rotulo ?? valores[c.chave]}`,
        tirar: () => trocar({ [c.chave]: "" }),
      })),
    ...(etiqueta && valores.etiqueta
      ? [
          {
            chave: "etiqueta",
            texto: `Etiqueta: #${valores.etiqueta}`,
            tirar: () => trocar({ etiqueta: "" }),
          },
        ]
      : []),
    ...(periodo && (valores.de || valores.ate)
      ? [
          {
            chave: "periodo",
            texto: `Aberto: ${descreverPeriodo(valores.de, valores.ate, hoje)}`,
            tirar: () => trocar({ de: "", ate: "" }),
          },
        ]
      : []),
  ];
  const ocultos = campos.slice(NO_CELULAR);
  const nOcultos = ocultos.filter((c) => ativo(c.chave)).length;
  const comPainel = extras.length > 0 || etiqueta || periodo;
  const soNoCelular = !comPainel && ocultos.length > 0;

  return (
    <div className="flex flex-col gap-2" aria-busy={carregando}>
      <fieldset className="vidro m-0 flex min-w-0 flex-wrap items-center gap-1 rounded-[1.75rem] p-1.5 xl:flex-nowrap xl:rounded-full">
        <legend className="sr-only">Filtros</legend>
        {campos.map((c, i) => {
          const Icone = ICONES[c.chave as keyof typeof ICONES] ?? ListFilter;
          return (
            <Selecao
              key={c.chave}
              variante="embutida"
              rotulo={c.rotulo}
              icone={<Icone className="size-4" />}
              className={`${c.largura ?? "w-44"} max-w-full shrink-0 max-md:w-auto max-md:min-w-0 max-md:flex-1 max-md:basis-32 ${i >= NO_CELULAR ? "hidden md:block" : ""}`}
              valor={valores[c.chave] ?? ""}
              aoMudar={(v) => trocar({ [c.chave]: v })}
              opcoes={
                c.todos !== undefined
                  ? [{ valor: "", rotulo: c.todos }, ...c.opcoes]
                  : c.opcoes
              }
            />
          );
        })}
        {busca && (
          <label className="order-last flex min-w-0 basis-full items-center gap-2 rounded-full py-2 pr-3 pl-3.5 text-sm transition focus-within:bg-white/90 hover:bg-white/70 md:order-none md:min-w-48 md:flex-1 md:basis-auto dark:focus-within:bg-white/15 dark:hover:bg-white/10">
            <Search className="size-4 shrink-0 text-neutral-500" aria-hidden />
            <span className="sr-only">Buscar na lista</span>
            <input
              type="search"
              value={texto}
              onChange={(e) => digitar(e.target.value)}
              placeholder={busca.placeholder}
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-neutral-400"
            />
          </label>
        )}
        {carregando && (
          <Loader
            className="mx-1 size-3.5 shrink-0 animate-spin text-neutral-500 motion-reduce:animate-none"
            aria-label="Atualizando"
          />
        )}
        {(comPainel || ocultos.length > 0) && (
          <button
            ref={botaoFiltros}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={aberto}
            onClick={() => setAberto((a) => !a)}
            className={`ml-auto flex shrink-0 items-center gap-2 rounded-full py-2 pr-3 pl-3.5 text-sm font-medium text-neutral-800 transition hover:bg-white/70 data-[aberto=true]:bg-white/90 dark:hover:bg-white/10 ${soNoCelular ? "md:hidden" : ""}`}
            data-aberto={aberto}
          >
            <SlidersHorizontal
              className="size-4 text-neutral-500"
              aria-hidden
            />
            Filtros
            <Contador n={chips.length + nOcultos} className="grid md:hidden" />
            <Contador n={chips.length} className="hidden md:grid" />
          </button>
        )}
      </fieldset>

      {(chips.length > 0 || filtrando) && (
        <div className="flex flex-wrap items-center gap-1.5 px-1">
          {chips.map((c) => (
            <span
              key={c.chave}
              className="inline-flex items-center gap-1 rounded-full bg-neutral-900/[0.06] py-1 pr-1 pl-3 text-xs font-medium text-neutral-700"
            >
              {c.texto}
              <button
                type="button"
                onClick={c.tirar}
                aria-label={`Tirar o filtro ${c.texto}`}
                className="grid size-5 place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-900 hover:text-white"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
          {filtrando && (
            <button
              type="button"
              onClick={limpar}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-neutral-600 transition hover:bg-white/70 hover:text-neutral-900 dark:hover:bg-white/10"
            >
              <X className="size-3.5" aria-hidden />
              Limpar
            </button>
          )}
          {lembrados && filtrando && (
            <span className="text-xs text-neutral-500">
              · Filtros da sua última visita.
            </span>
          )}
        </div>
      )}

      {aberto && (
        <PainelFiltros
          ancora={botaoFiltros}
          aoFechar={() => setAberto(false)}
          valores={valores}
          trocar={trocar}
          ocultos={ocultos}
          extras={extras}
          etiqueta={etiqueta}
          periodo={periodo}
          hoje={hoje}
        />
      )}
    </div>
  );
}

function Contador({ n, className }: { n: number; className: string }) {
  if (!n) return null;
  return (
    <span
      className={`${className} size-5 place-items-center rounded-full bg-neutral-900 text-[11px] font-semibold text-white tabular-nums`}
    >
      {n}
      <span className="sr-only"> ativos</span>
    </span>
  );
}

/**
 * Uma escolha de visão fora da barra (ex.: "Agrupar por", junto do título
 * da lista): mesma URL e mesma memória dos filtros.
 */
export function SeletorDeVisao({
  tela,
  valores,
  campo,
  className = "",
}: {
  tela: Tela;
  valores: Valores;
  campo: CampoBarra;
  className?: string;
}) {
  const { aplicar, carregando } = useFiltrosDaTela(tela);
  const Icone = ICONES[campo.chave as keyof typeof ICONES] ?? ListFilter;
  return (
    <div className="flex items-center gap-1" aria-busy={carregando}>
      <Selecao
        variante="embutida"
        rotulo={campo.rotulo}
        icone={<Icone className="size-4" />}
        className={`${campo.largura ?? "w-44"} max-w-full ${className}`}
        valor={valores[campo.chave] ?? ""}
        aoMudar={(v) => aplicar({ ...valores, [campo.chave]: v })}
        opcoes={
          campo.todos !== undefined
            ? [{ valor: "", rotulo: campo.todos }, ...campo.opcoes]
            : campo.opcoes
        }
      />
      {carregando && (
        <Loader
          className="size-3.5 shrink-0 animate-spin text-neutral-500 motion-reduce:animate-none"
          aria-label="Atualizando"
        />
      )}
    </div>
  );
}
