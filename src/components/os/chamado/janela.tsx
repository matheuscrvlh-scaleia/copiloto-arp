"use client";

import { X } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  type Acao,
  type EstadoAcao,
  useEnvioSemLimpar,
} from "@/components/form-acao";

// Janela (modal) das ações do chamado, no mesmo visual dos modais do
// sistema (painel-modal, fundo escuro com desfoque), no <body>: Esc fecha,
// foco preso dentro, a página atrás não rola. No celular ocupa a largura
// toda e sobe do rodapé, com botões grandes.

const LARGURAS = {
  sm: "sm:w-[min(28rem,calc(100vw-1.5rem))]",
  md: "sm:w-[min(36rem,calc(100vw-1.5rem))]",
  lg: "sm:w-[min(52rem,calc(100vw-1.5rem))]",
  xl: "sm:w-[min(66rem,calc(100vw-1.5rem))]",
} as const;

export function Janela({
  aberta,
  aoFechar,
  titulo,
  descricao,
  largura = "md",
  travada = false,
  cheia = false,
  children,
}: {
  aberta: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  largura?: keyof typeof LARGURAS;
  /** Enquanto envia, Esc e clique fora não fecham. */
  travada?: boolean;
  /** O conteúdo cuida do próprio respiro e da rolagem (colunas, rodapé fixo). */
  cheia?: boolean;
  children: React.ReactNode;
}) {
  if (!aberta) return null;
  return createPortal(
    <Painel
      aoFechar={aoFechar}
      titulo={titulo}
      descricao={descricao}
      largura={largura}
      travada={travada}
      cheia={cheia}
    >
      {children}
    </Painel>,
    document.body,
  );
}

function Painel({
  aoFechar,
  titulo,
  descricao,
  largura,
  travada,
  cheia,
  children,
}: Omit<Parameters<typeof Janela>[0], "aberta"> & {
  largura: keyof typeof LARGURAS;
}) {
  const painel = useRef<HTMLDivElement>(null);
  const idTitulo = useId();
  const fechar = useRef(aoFechar);
  fechar.current = () => {
    if (!travada) aoFechar();
  };
  useCamadaModal(painel, () => fechar.current());

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: clicar no fundo fecha; o teclado fecha com Esc
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-md transition-opacity duration-300 starting:opacity-0 sm:items-center sm:p-3 motion-reduce:transition-none"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) fechar.current();
      }}
    >
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        className={`painel-modal relative transition-[opacity,translate] duration-300 ease-out starting:translate-y-6 starting:opacity-0 motion-reduce:transition-none isolate flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[2rem] text-neutral-900 outline-none sm:max-h-[88dvh] sm:rounded-[2rem] ${LARGURAS[largura]}`}
      >
        <div
          aria-hidden
          className="absolute -top-16 -right-10 -z-10 h-32 w-2/3 rounded-full bg-marca/20 blur-3xl"
        />
        <header className="flex shrink-0 items-start gap-3 px-5 pt-5 pb-3 sm:px-7 sm:pt-6">
          <div className="min-w-0 flex-1">
            <h2
              id={idTitulo}
              className="text-lg font-semibold tracking-tight text-balance"
            >
              {titulo}
            </h2>
            {descricao && (
              <p className="mt-1 text-sm text-neutral-600">{descricao}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => fechar.current()}
            aria-label="Fechar"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-neutral-900/[0.06] text-neutral-700 transition hover:bg-neutral-900 hover:text-white"
          >
            <X className="size-4" aria-hidden />
          </button>
        </header>
        <div
          className={
            cheia
              ? "flex min-h-0 flex-1 flex-col"
              : "min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-7 sm:pb-7"
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Comportamento de modal para uma camada (janela ou painel lateral): foco
 * no painel ao abrir e de volta ao sair, Tab preso dentro, Esc fecha e a
 * página atrás não rola. Não usa <dialog>: a lista da Seleção, desenhada no
 * <body>, ficaria por baixo da camada do topo e sem clique.
 */
export function useCamadaModal(
  painel: React.RefObject<HTMLElement | null>,
  aoFechar: () => void,
) {
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;
  useEffect(() => {
    const el = painel.current;
    const antes = document.activeElement as HTMLElement | null;
    const rolagem = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    el?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (!el) return;
      // Só a camada mais de cima responde (janela aberta sobre o painel).
      const camadas = document.querySelectorAll("[aria-modal=true]");
      if (camadas[camadas.length - 1] !== el) return;
      if (e.key === "Escape") {
        // A lista da Seleção aberta fecha primeiro (ela trata o Esc).
        if (document.querySelector(".selecao-lista")) return;
        e.preventDefault();
        fechar.current();
        return;
      }
      if (e.key !== "Tab" || !el.contains(document.activeElement)) return;
      const itens = [...el.querySelectorAll<HTMLElement>(FOCAVEIS)];
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      if (!primeiro || !ultimo) return;
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.documentElement.style.overflow = rolagem;
      antes?.focus?.();
    };
  }, [painel]);
}

export const BOTAO_PRIMARIO =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60";
export const BOTAO_SECUNDARIO =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-5 py-2.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 disabled:opacity-60";
export const BOTAO_PERIGO =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-medium text-[#fff] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60";

/**
 * Formulário de uma Server Action dentro da janela: fecha sozinho quando a
 * ação volta sem erro; com erro, mostra a mensagem e fica aberto.
 */
export function FormNaJanela({
  acao,
  aoConcluir,
  rotulo,
  rotuloEnviando = "Um instante…",
  perigo = false,
  bloqueio,
  children,
}: {
  acao: Acao;
  aoConcluir: () => void;
  rotulo: string;
  rotuloEnviando?: string;
  perigo?: boolean;
  /** Motivo para não deixar enviar (o botão fica desligado). */
  bloqueio?: string | null;
  children: React.ReactNode;
}) {
  const [estado, executar, enviando] = useActionState(acao, {});
  const form = useRef<HTMLFormElement>(null);
  const enviar = useEnvioSemLimpar(executar, estado, form);
  const anterior = useRef<EstadoAcao>(estado);
  useEffect(() => {
    if (estado === anterior.current) return;
    anterior.current = estado;
    if (!estado.erro) aoConcluir();
  }, [estado, aoConcluir]);

  return (
    <form ref={form} onSubmit={enviar} className="flex flex-col gap-4">
      {children}
      {bloqueio && (
        <p
          role="alert"
          className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {bloqueio}
        </p>
      )}
      {estado.erro && (
        <p
          role="alert"
          className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {estado.erro}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="submit"
          disabled={enviando || !!bloqueio}
          className={perigo ? BOTAO_PERIGO : BOTAO_PRIMARIO}
        >
          {enviando ? rotuloEnviando : rotulo}
        </button>
      </div>
    </form>
  );
}

/** Estado aberto/fechado de uma janela. */
export function useJanela(inicial = false) {
  const [aberta, setAberta] = useState(inicial);
  return {
    aberta,
    abrir: () => setAberta(true),
    fechar: () => setAberta(false),
  };
}
