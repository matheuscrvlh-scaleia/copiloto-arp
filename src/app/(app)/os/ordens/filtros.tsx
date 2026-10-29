"use client";

import {
  ArrowRight,
  CalendarDays,
  HardHat,
  ListFilter,
  Loader,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { classeCampo } from "@/components/estilos";
import { type Opcao, Selecao } from "@/components/selecao";
import {
  FILTROS_STATUS,
  type FiltrosOS,
  PERIODOS_OS,
} from "@/lib/os/ordem-lista";
import { PARAM_PAINEL } from "@/lib/os/rotas";
import { EXECUCOES } from "@/lib/os/rotulos";

// Filtros da tela Ordens de serviço, guardados na URL (o link leva os
// filtros junto), no mesmo desenho da barra das visões: uma linha com os
// principais (status, execução, período) e a busca; o resto (setor,
// responsável, tipo, técnico, empresa, rateio, local) fica no painel
// "Filtros", e o que
// estiver em uso aparece em etiquetas removíveis embaixo da barra. No
// celular, a linha mostra status e execução; o período vai para o painel,
// que abre em tela cheia.

const ESPERA_MS = 400;
const PERSONALIZADO = "personalizado";
/** Tudo o que esta barra escreve na URL (o "Limpar" apaga). */
const CHAVES = [
  "q",
  "status",
  "execucao",
  "periodo",
  "de",
  "ate",
  "setor",
  "responsavel",
  "categoria",
  "tecnico",
  "empresa",
  "rateio",
  "local",
  "cartao",
];

type Troca = Record<string, string | null>;

export function FiltrosOrdens({
  f,
  extras,
  setores,
  pessoas,
  categorias,
  tecnicos,
  empresas,
}: {
  f: FiltrosOS;
  /** Quantos filtros do painel estão em uso. */
  extras: number;
  setores: Opcao[];
  /** Pessoas e a fila (sem responsável). */
  pessoas: Opcao[];
  categorias: Opcao[];
  tecnicos: Opcao[];
  empresas: Opcao[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [carregando, iniciar] = useTransition();
  const [aberto, setAberto] = useState(false);
  const botaoFiltros = useRef<HTMLButtonElement>(null);

  /** Troca parâmetros; mudar filtro volta à página 1 e fecha a janela. */
  const trocar = useCallback(
    (troca: Troca) => {
      const p = new URLSearchParams(params);
      p.delete(PARAM_PAINEL);
      p.delete("pagina");
      for (const [k, v] of Object.entries(troca)) {
        if (v) p.set(k, v);
        else p.delete(k);
      }
      const qs = p.toString();
      iniciar(() =>
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }),
      );
    },
    [params, pathname, router],
  );

  const filtrando = CHAVES.some((k) => params.has(k));
  const rotuloDe = (lista: Opcao[], valor: string | null) =>
    lista.find((o) => o.valor === valor)?.rotulo ?? "—";
  const chips: { chave: string; texto: string }[] = [
    f.setor && {
      chave: "setor",
      texto: `Setor: ${rotuloDe(setores, f.setor)}`,
    },
    f.responsavel && {
      chave: "responsavel",
      texto: `Responsável: ${rotuloDe(pessoas, f.responsavel)}`,
    },
    f.categoria && {
      chave: "categoria",
      texto: `Tipo: ${rotuloDe(categorias, f.categoria)}`,
    },
    f.tecnico && {
      chave: "tecnico",
      texto: `Técnico: ${rotuloDe(tecnicos, f.tecnico)}`,
    },
    f.empresa && {
      chave: "empresa",
      texto: `Empresa: ${rotuloDe(empresas, f.empresa)}`,
    },
    f.rateio !== null && {
      chave: "rateio",
      texto: f.rateio ? "Com rateio" : "Sem rateio",
    },
    f.local && { chave: "local", texto: `Local: ${f.local}` },
  ].filter((e): e is { chave: string; texto: string } => !!e);
  // No celular o período sai da linha: conta no botão quando está em uso.
  const periodoEmUso = !!(f.periodo || f.de || f.ate);
  const naLinha =
    "max-w-full shrink-0 max-md:w-auto max-md:min-w-0 max-md:flex-1 max-md:basis-32";

  return (
    <div className="flex flex-col gap-2" aria-busy={carregando}>
      <fieldset className="vidro m-0 flex min-w-0 flex-wrap items-center gap-1 rounded-[1.75rem] p-1.5 xl:flex-nowrap xl:rounded-full">
        <legend className="sr-only">Filtros das ordens de serviço</legend>
        <Selecao
          variante="embutida"
          rotulo="Status"
          icone={<ListFilter className="size-4" />}
          className={`w-44 ${naLinha}`}
          valor={f.status ?? ""}
          aoMudar={(v) => trocar({ status: v })}
          opcoes={opcoesStatus}
        />
        <Selecao
          variante="embutida"
          rotulo="Execução"
          icone={<HardHat className="size-4" />}
          className={`w-52 ${naLinha}`}
          valor={f.execucao ?? ""}
          aoMudar={(v) => trocar({ execucao: v })}
          opcoes={opcoesExecucao}
        />
        <div className="hidden md:block">
          <PeriodoNaLinha f={f} trocar={trocar} />
        </div>
        <Busca valor={f.q ?? ""} aoMudar={(v) => trocar({ q: v })} />
        {carregando && (
          <Loader
            className="mx-1 size-3.5 shrink-0 animate-spin text-neutral-500 motion-reduce:animate-none"
            aria-label="Atualizando"
          />
        )}
        <button
          ref={botaoFiltros}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={aberto}
          data-aberto={aberto}
          onClick={() => setAberto((a) => !a)}
          className="ml-auto flex shrink-0 items-center gap-2 rounded-full py-2 pr-3 pl-3.5 text-sm font-medium text-neutral-800 transition hover:bg-white/70 data-[aberto=true]:bg-white/90 dark:hover:bg-white/10"
        >
          <SlidersHorizontal className="size-4 text-neutral-500" aria-hidden />
          Filtros
          <Contador
            n={extras + (periodoEmUso ? 1 : 0)}
            className="grid md:hidden"
          />
          <Contador n={extras} className="hidden md:grid" />
        </button>
      </fieldset>

      {(chips.length > 0 || filtrando) && (
        <div className="flex flex-wrap items-center gap-1.5 px-1">
          {chips.map((c) => (
            <span
              key={c.chave}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-neutral-900/[0.06] py-1 pr-1 pl-3 text-xs font-medium text-neutral-700"
            >
              <span className="truncate">{c.texto}</span>
              <button
                type="button"
                onClick={() => trocar({ [c.chave]: null })}
                aria-label={`Tirar o filtro ${c.texto}`}
                className="grid size-5 shrink-0 place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-900 hover:text-white"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
          {filtrando && (
            <button
              type="button"
              onClick={() =>
                trocar(Object.fromEntries(CHAVES.map((k) => [k, null])))
              }
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-neutral-600 transition hover:bg-white/70 hover:text-neutral-900 dark:hover:bg-white/10"
            >
              <X className="size-3.5" aria-hidden />
              Limpar
            </button>
          )}
        </div>
      )}

      {aberto && (
        <PainelFiltros ancora={botaoFiltros} aoFechar={() => setAberto(false)}>
          <div className="md:hidden">
            <PeriodoNoPainel f={f} trocar={trocar} />
          </div>
          <Campo rotulo="Setor">
            {(id) => (
              <Selecao
                id={id}
                rotulo="Setor"
                valor={f.setor ?? ""}
                aoMudar={(v) => trocar({ setor: v })}
                opcoes={[{ valor: "", rotulo: "Todos os setores" }, ...setores]}
              />
            )}
          </Campo>
          <Campo rotulo="Responsável">
            {(id) => (
              <Selecao
                id={id}
                rotulo="Responsável"
                valor={f.responsavel ?? ""}
                aoMudar={(v) => trocar({ responsavel: v })}
                opcoes={[{ valor: "", rotulo: "Qualquer pessoa" }, ...pessoas]}
              />
            )}
          </Campo>
          <Campo rotulo="Tipo de serviço">
            {(id) => (
              <Selecao
                id={id}
                rotulo="Tipo de serviço"
                valor={f.categoria ?? ""}
                aoMudar={(v) => trocar({ categoria: v })}
                opcoes={[
                  { valor: "", rotulo: "Todos os tipos" },
                  ...categorias,
                ]}
              />
            )}
          </Campo>
          <Campo rotulo="Técnico">
            {(id) => (
              <Selecao
                id={id}
                rotulo="Técnico"
                valor={f.tecnico ?? ""}
                aoMudar={(v) => trocar({ tecnico: v })}
                opcoes={[
                  { valor: "", rotulo: "Todos os técnicos" },
                  ...tecnicos,
                ]}
              />
            )}
          </Campo>
          <Campo rotulo="Empresa terceirizada">
            {(id) => (
              <Selecao
                id={id}
                rotulo="Empresa terceirizada"
                valor={f.empresa ?? ""}
                aoMudar={(v) => trocar({ empresa: v })}
                opcoes={[
                  { valor: "", rotulo: "Todas as empresas" },
                  ...empresas,
                ]}
              />
            )}
          </Campo>
          <Campo rotulo="Rateio">
            {(id) => (
              <Selecao
                id={id}
                rotulo="Rateio"
                valor={f.rateio === null ? "" : f.rateio ? "sim" : "nao"}
                aoMudar={(v) => trocar({ rateio: v })}
                opcoes={[
                  { valor: "", rotulo: "Com e sem rateio" },
                  { valor: "sim", rotulo: "Com rateio" },
                  { valor: "nao", rotulo: "Sem rateio" },
                ]}
              />
            )}
          </Campo>
          <Local valor={f.local ?? ""} aoMudar={(v) => trocar({ local: v })} />
        </PainelFiltros>
      )}
    </div>
  );
}

const opcoesStatus: Opcao[] = [
  { valor: "", rotulo: "Todos os status" },
  ...Object.entries(FILTROS_STATUS).map(([valor, rotulo]) => ({
    valor,
    rotulo,
  })),
];

const opcoesExecucao: Opcao[] = [
  { valor: "", rotulo: "Interna e terceirizada" },
  ...Object.entries(EXECUCOES).map(([valor, rotulo]) => ({ valor, rotulo })),
];

const opcoesPeriodo: Opcao[] = [
  { valor: "", rotulo: "Qualquer data" },
  ...Object.entries(PERIODOS_OS).map(([valor, rotulo]) => ({
    valor,
    rotulo,
  })),
  {
    valor: PERSONALIZADO,
    rotulo: "Personalizado",
    descricao: "Escolha a data inicial e a final",
  },
];

function Contador({ n, className }: { n: number; className: string }) {
  if (n === 0) return null;
  return (
    <span
      className={`${className} size-5 place-items-center rounded-full bg-neutral-900 text-[11px] font-semibold text-white tabular-nums`}
    >
      {n}
      <span className="sr-only"> ativos</span>
    </span>
  );
}

/** Texto que só vai para a URL quando a pessoa para de digitar. */
function useTextoComEspera(valor: string, aoMudar: (v: string) => void) {
  const [texto, setTexto] = useState(valor);
  // O valor mudou por fora ("Limpar", etiqueta, voltar): o campo acompanha.
  const [anterior, setAnterior] = useState(valor);
  if (valor !== anterior) {
    setAnterior(valor);
    setTexto(valor);
  }
  const mudar = useRef(aoMudar);
  mudar.current = aoMudar;
  useEffect(() => {
    if (texto.trim() === valor) return;
    const t = setTimeout(() => mudar.current(texto.trim()), ESPERA_MS);
    return () => clearTimeout(t);
  }, [texto, valor]);
  return [texto, setTexto] as const;
}

function Busca({
  valor,
  aoMudar,
}: {
  valor: string;
  aoMudar: (v: string) => void;
}) {
  const [texto, setTexto] = useTextoComEspera(valor, aoMudar);
  return (
    <label className="order-last flex min-w-0 basis-full items-center gap-2 rounded-full py-2 pr-3 pl-3.5 text-sm transition focus-within:bg-white/90 hover:bg-white/70 md:order-none md:min-w-48 md:flex-1 md:basis-auto dark:focus-within:bg-white/15 dark:hover:bg-white/10">
      <Search className="size-4 shrink-0 text-neutral-500" aria-hidden />
      <span className="sr-only">Buscar OS</span>
      <input
        type="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Nº, título ou descrição…"
        className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-neutral-400"
      />
    </label>
  );
}

function Local({
  valor,
  aoMudar,
}: {
  valor: string;
  aoMudar: (v: string) => void;
}) {
  const [texto, setTexto] = useTextoComEspera(valor, aoMudar);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-neutral-500">Local</span>
      <input
        type="search"
        value={texto}
        maxLength={80}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Loja, bloco, ponto…"
        className={classeCampo}
      />
    </label>
  );
}

/** Estado do período: atalho, "Personalizado" (com as datas) ou nenhum. */
function usePeriodo(f: FiltrosOS, trocar: (t: Troca) => void) {
  const comDatas = !f.periodo && !!(f.de || f.ate);
  const [personalizado, setPersonalizado] = useState(comDatas);
  const mostrarDatas = personalizado || comDatas;
  return {
    valor: f.periodo ?? (mostrarDatas ? PERSONALIZADO : ""),
    mostrarDatas,
    escolher(v: string) {
      if (v === PERSONALIZADO) {
        setPersonalizado(true);
        return;
      }
      setPersonalizado(false);
      trocar({ periodo: v, de: null, ate: null });
    },
    /** Datas fora de ordem são trocadas. */
    data(qual: "de" | "ate", v: string) {
      let de = qual === "de" ? v : (f.de ?? "");
      let ate = qual === "ate" ? v : (f.ate ?? "");
      if (de && ate && de > ate) [de, ate] = [ate, de];
      trocar({ periodo: null, de, ate });
    },
  };
}

/** Período de criação na linha: atalhos e, no personalizado, De → Até. */
function PeriodoNaLinha({
  f,
  trocar,
}: {
  f: FiltrosOS;
  trocar: (t: Troca) => void;
}) {
  const p = usePeriodo(f, trocar);
  const campoData =
    "rounded-full bg-transparent px-2 py-1.5 text-sm font-medium tabular-nums text-neutral-900 outline-none transition hover:bg-white/70 focus-visible:bg-white/90 focus-visible:ring-2 focus-visible:ring-neutral-900/15 [color-scheme:light] dark:[color-scheme:dark] dark:hover:bg-white/10";
  return (
    <div className="flex items-center gap-0.5">
      <Selecao
        variante="embutida"
        rotulo="Período de criação"
        icone={<CalendarDays className="size-4" />}
        className="w-44 max-w-full shrink-0"
        valor={p.valor}
        aoMudar={p.escolher}
        opcoes={opcoesPeriodo}
      />
      {p.mostrarDatas && (
        <>
          <input
            type="date"
            className={campoData}
            value={f.de ?? ""}
            onChange={(e) => p.data("de", e.target.value)}
            aria-label="Criadas a partir de"
          />
          <ArrowRight
            className="size-3.5 shrink-0 text-neutral-400"
            aria-hidden
          />
          <input
            type="date"
            className={campoData}
            value={f.ate ?? ""}
            min={f.de ?? undefined}
            onChange={(e) => p.data("ate", e.target.value)}
            aria-label="Criadas até"
          />
        </>
      )}
    </div>
  );
}

/** O mesmo período no painel (celular). */
function PeriodoNoPainel({
  f,
  trocar,
}: {
  f: FiltrosOS;
  trocar: (t: Troca) => void;
}) {
  const p = usePeriodo(f, trocar);
  return (
    <Campo rotulo="Criadas em">
      {(id) => (
        <>
          <Selecao
            id={id}
            rotulo="Período de criação"
            valor={p.valor}
            aoMudar={p.escolher}
            opcoes={opcoesPeriodo}
          />
          {p.mostrarDatas && (
            <div className="mt-1 flex items-center gap-2">
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-xs text-neutral-500">De</span>
                <input
                  type="date"
                  value={f.de ?? ""}
                  onChange={(e) => p.data("de", e.target.value)}
                  className={`${classeCampo} tabular-nums`}
                />
              </label>
              <ArrowRight
                className="mt-5 size-3.5 shrink-0 text-neutral-400"
                aria-hidden
              />
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-xs text-neutral-500">Até</span>
                <input
                  type="date"
                  value={f.ate ?? ""}
                  min={f.de ?? undefined}
                  onChange={(e) => p.data("ate", e.target.value)}
                  className={`${classeCampo} tabular-nums`}
                />
              </label>
            </div>
          )}
        </>
      )}
    </Campo>
  );
}

function Campo({
  rotulo,
  children,
}: {
  rotulo: string;
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-neutral-500">
        {rotulo}
      </label>
      {children(id)}
    </div>
  );
}

/**
 * Painel do botão "Filtros", no desenho do painel das visões: embaixo do
 * botão e alinhado à direita dele no computador, tela cheia no celular.
 * Fica no <body> (dentro da barra de vidro seria cortado) e abaixo das
 * listas da Seleção (z-60), que abrem por cima. Cada escolha vale na hora.
 */
function PainelFiltros({
  ancora,
  aoFechar,
  children,
}: {
  ancora: React.RefObject<HTMLButtonElement | null>;
  aoFechar: () => void;
  children: React.ReactNode;
}) {
  const painel = useRef<HTMLDivElement>(null);
  const idTitulo = useId();
  const [pos, setPos] = useState<{ topo: number; direita: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    const posicionar = () => {
      const b = ancora.current?.getBoundingClientRect();
      if (b)
        setPos({
          topo: b.bottom + 8,
          direita: Math.max(8, window.innerWidth - b.right),
        });
    };
    posicionar();
    window.addEventListener("resize", posicionar);
    window.addEventListener("scroll", posicionar, true);
    return () => {
      window.removeEventListener("resize", posicionar);
      window.removeEventListener("scroll", posicionar, true);
    };
  }, [ancora]);

  // Esc e clique fora fecham (a lista de uma Seleção aberta não é "fora");
  // o foco entra no painel e volta ao botão ao fechar. Só ao abrir e
  // fechar: a cada filtro trocado a barra redesenha.
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;
  useEffect(() => {
    const aoFechar = () => fechar.current();
    const botao = ancora.current;
    painel.current?.focus();
    const celular = window.matchMedia("(max-width: 767px)").matches;
    if (celular) document.documentElement.style.overflow = "hidden";
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Element;
      if (
        painel.current?.contains(alvo) ||
        botao?.contains(alvo) ||
        alvo.closest?.(".selecao-lista")
      )
        return;
      aoFechar();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector(".selecao-lista"))
        aoFechar();
    };
    window.addEventListener("pointerdown", fora);
    window.addEventListener("keydown", tecla);
    return () => {
      window.removeEventListener("pointerdown", fora);
      window.removeEventListener("keydown", tecla);
      if (celular) document.documentElement.style.overflow = "";
      botao?.focus();
    };
  }, [ancora]);

  const estilo = pos
    ? ({
        "--topo": `${pos.topo}px`,
        "--direita": `${pos.direita}px`,
      } as React.CSSProperties)
    : undefined;

  return createPortal(
    <div
      ref={painel}
      role="dialog"
      aria-labelledby={idTitulo}
      tabIndex={-1}
      style={estilo}
      className="painel-modal fixed inset-0 z-50 flex flex-col overflow-hidden text-neutral-900 outline-none md:inset-auto md:top-[var(--topo)] md:right-[var(--direita)] md:max-h-[min(36rem,calc(100dvh_-_var(--topo)_-_1rem))] md:w-[22rem] md:rounded-[1.75rem]"
    >
      <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
        <h2 id={idTitulo} className="text-base font-semibold tracking-tight">
          Filtros
        </h2>
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar os filtros"
          className="grid size-8 place-items-center rounded-full bg-neutral-900/[0.06] text-neutral-700 transition hover:bg-neutral-900 hover:text-white"
        >
          <X className="size-4" aria-hidden />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4">
        {children}
      </div>

      <footer className="flex justify-end border-t border-neutral-900/[0.06] px-5 py-3">
        <button
          type="button"
          onClick={aoFechar}
          className="w-full rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 md:w-auto"
        >
          Pronto
        </button>
      </footer>
    </div>,
    document.body,
  );
}
