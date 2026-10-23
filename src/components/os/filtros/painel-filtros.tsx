"use client";

import { ArrowRight, X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { classeCampo } from "@/components/estilos";
import { Selecao } from "@/components/selecao";
import {
  ATALHOS_PERIODO,
  type AtalhoPeriodo,
  atalhoDoPeriodo,
  type CampoFiltro,
  periodoDoAtalho,
} from "@/lib/os/lista";
import type { CampoBarra, Valores } from "./barra-filtros";

// Painel "Filtros" da barra das visões: o que não cabe na linha
// (categoria, prioridade, etiqueta, período e, no celular, os principais
// que saíram da linha). No computador abre embaixo do botão; no celular
// ocupa a tela. Cada escolha vale na hora (vai para a URL), como na linha.
// Fica no <body> e abaixo das listas da Seleção (z-60), que abrem por cima.

const ESPERA_MS = 500;
const SEM_PERIODO = "";
const PERSONALIZADO = "personalizado";

export function PainelFiltros({
  ancora,
  aoFechar,
  valores,
  trocar,
  ocultos,
  extras,
  etiqueta,
  periodo,
  hoje,
}: {
  ancora: React.RefObject<HTMLButtonElement | null>;
  aoFechar: () => void;
  valores: Valores;
  trocar: (mudancas: Partial<Record<CampoFiltro, string>>) => void;
  /** Principais que no celular ficam fora da linha. */
  ocultos: CampoBarra[];
  extras: CampoBarra[];
  etiqueta: boolean;
  periodo: boolean;
  /** aaaa-mm-dd (Brasília): base dos atalhos de período. */
  hoje: string;
}) {
  const painel = useRef<HTMLDivElement>(null);
  const idTitulo = useId();
  const [pos, setPos] = useState<{ topo: number; direita: number } | null>(
    null,
  );

  // Embaixo do botão, alinhado à direita dele (no computador).
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
  // o foco entra no painel e volta para o botão ao fechar. Só ao abrir e
  // fechar: a cada filtro trocado a barra redesenha e o foco ficaria pulando.
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
        {ocultos.map((c) => (
          <div key={c.chave} className="md:hidden">
            <Campo campo={c} valores={valores} trocar={trocar} />
          </div>
        ))}
        {extras.map((c) => (
          <Campo key={c.chave} campo={c} valores={valores} trocar={trocar} />
        ))}
        {etiqueta && (
          <Etiqueta
            valor={valores.etiqueta ?? ""}
            aoMudar={(v) => trocar({ etiqueta: v })}
          />
        )}
        {periodo && (
          <Periodo
            de={valores.de}
            ate={valores.ate}
            hoje={hoje}
            aoMudar={(de, ate) => trocar({ de, ate })}
          />
        )}
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

function Rotulo({ children, id }: { children: React.ReactNode; id: string }) {
  return (
    <label htmlFor={id} className="text-xs font-medium text-neutral-500">
      {children}
    </label>
  );
}

function Campo({
  campo,
  valores,
  trocar,
}: {
  campo: CampoBarra;
  valores: Valores;
  trocar: (mudancas: Partial<Record<CampoFiltro, string>>) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Rotulo id={id}>{campo.rotulo}</Rotulo>
      <Selecao
        id={id}
        rotulo={campo.rotulo}
        valor={valores[campo.chave] ?? ""}
        aoMudar={(v) => trocar({ [campo.chave]: v })}
        opcoes={
          campo.todos !== undefined
            ? [{ valor: "", rotulo: campo.todos }, ...campo.opcoes]
            : campo.opcoes
        }
      />
    </div>
  );
}

/** Etiqueta digitada: aplica quando a pessoa para de digitar. */
function Etiqueta({
  valor,
  aoMudar,
}: {
  valor: string;
  aoMudar: (v: string) => void;
}) {
  const [texto, setTexto] = useState(valor);
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(espera.current), []);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-neutral-500">Etiqueta</span>
      <input
        type="search"
        value={texto}
        maxLength={40}
        onChange={(e) => {
          const v = e.target.value;
          setTexto(v);
          clearTimeout(espera.current);
          espera.current = setTimeout(() => aoMudar(v.trim()), ESPERA_MS);
        }}
        placeholder="Ex.: elétrica"
        className={classeCampo}
      />
    </label>
  );
}

/** Período de abertura: atalhos ou "Personalizado" com as duas datas. */
function Periodo({
  de,
  ate,
  hoje,
  aoMudar,
}: {
  de: string | undefined;
  ate: string | undefined;
  hoje: string;
  aoMudar: (de: string, ate: string) => void;
}) {
  const id = useId();
  const atual = atalhoDoPeriodo(de, ate, hoje);
  const [personalizado, setPersonalizado] = useState(atual === PERSONALIZADO);
  const escolha = personalizado ? PERSONALIZADO : (atual ?? SEM_PERIODO);

  function escolher(v: string) {
    if (v === PERSONALIZADO) {
      setPersonalizado(true);
      return;
    }
    setPersonalizado(false);
    if (v === SEM_PERIODO) aoMudar("", "");
    else {
      const p = periodoDoAtalho(v as AtalhoPeriodo, hoje);
      aoMudar(p.de, p.ate);
    }
  }

  /** Datas fora de ordem são trocadas. */
  function data(qual: "de" | "ate", v: string) {
    let novoDe = qual === "de" ? v : (de ?? "");
    let novoAte = qual === "ate" ? v : (ate ?? "");
    if (novoDe && novoAte && novoDe > novoAte)
      [novoDe, novoAte] = [novoAte, novoDe];
    aoMudar(novoDe, novoAte);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Rotulo id={id}>Aberto em</Rotulo>
      <Selecao
        id={id}
        rotulo="Período de abertura"
        valor={escolha}
        aoMudar={escolher}
        opcoes={[
          { valor: SEM_PERIODO, rotulo: "Qualquer data" },
          ...Object.entries(ATALHOS_PERIODO).map(([valor, rotulo]) => ({
            valor,
            rotulo,
          })),
          {
            valor: PERSONALIZADO,
            rotulo: "Personalizado",
            descricao: "Escolha a data inicial e a final",
          },
        ]}
      />
      {personalizado && (
        <div className="mt-1 flex items-center gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-xs text-neutral-500">De</span>
            <input
              type="date"
              value={de ?? ""}
              max={ate || hoje}
              onChange={(e) => data("de", e.target.value)}
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
              value={ate ?? ""}
              min={de || undefined}
              onChange={(e) => data("ate", e.target.value)}
              className={`${classeCampo} tabular-nums`}
            />
          </label>
        </div>
      )}
    </div>
  );
}
