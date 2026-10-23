"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

// Janela curta das alterações rápidas (novo prazo, motivo de Aguardando,
// motivo da reabertura). <dialog> no <body>: Esc fecha, foco preso dentro,
// fundo inerte; no celular sobe do rodapé, com a largura toda.

export function JanelaRapida({
  aberta,
  titulo,
  descricao,
  aoFechar,
  travada = false,
  children,
}: {
  aberta: boolean;
  titulo: string;
  descricao?: string;
  aoFechar: () => void;
  /** Enquanto grava, não fecha. */
  travada?: boolean;
  children: React.ReactNode;
}) {
  if (!aberta) return null;
  return createPortal(
    <Painel
      titulo={titulo}
      descricao={descricao}
      aoFechar={aoFechar}
      travada={travada}
    >
      {children}
    </Painel>,
    document.body,
  );
}

function Painel({
  titulo,
  descricao,
  aoFechar,
  travada,
  children,
}: {
  titulo: string;
  descricao?: string;
  aoFechar: () => void;
  travada: boolean;
  children: React.ReactNode;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const idTexto = useId();

  useEffect(() => {
    dialogo.current?.showModal();
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);

  const fechar = () => {
    if (!travada) aoFechar();
  };

  return (
    <dialog
      ref={dialogo}
      aria-labelledby={idTitulo}
      aria-describedby={descricao ? idTexto : undefined}
      aria-busy={travada}
      onCancel={(e) => {
        e.preventDefault();
        fechar();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) fechar();
      }}
      onKeyDown={() => undefined}
      className="modal-confirmacao m-0 mt-auto w-full max-w-none overflow-hidden rounded-t-[2rem] border-0 bg-transparent p-0 text-neutral-900 backdrop:bg-black/45 backdrop:backdrop-blur-md sm:m-auto sm:w-[min(28rem,calc(100vw-1.5rem))] sm:rounded-[2rem]"
    >
      <div className="painel-modal relative isolate rounded-t-[2rem] p-6 sm:rounded-[2rem] md:p-7">
        <div
          aria-hidden
          className="absolute -top-16 -right-10 -z-10 h-32 w-2/3 rounded-full bg-marca/25 blur-3xl"
        />
        <button
          type="button"
          onClick={fechar}
          aria-label="Fechar"
          className="absolute top-5 right-5 grid size-9 place-items-center rounded-full bg-neutral-900/[0.06] text-neutral-700 transition hover:bg-neutral-900 hover:text-white"
        >
          <X className="size-4" aria-hidden />
        </button>
        <h2
          id={idTitulo}
          className="pr-10 text-lg font-semibold tracking-tight text-balance"
        >
          {titulo}
        </h2>
        {descricao && (
          <p id={idTexto} className="mt-1.5 text-sm text-neutral-600">
            {descricao}
          </p>
        )}
        <div className="mt-5">{children}</div>
      </div>
    </dialog>
  );
}

/** Rodapé padrão: Cancelar e o botão que grava. */
export function BotoesDaJanela({
  rotulo,
  enviando,
  aoCancelar,
  desabilitado = false,
  perigo = false,
}: {
  rotulo: string;
  enviando: boolean;
  aoCancelar: () => void;
  desabilitado?: boolean;
  perigo?: boolean;
}) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={aoCancelar}
        disabled={enviando}
        className="rounded-full border border-neutral-200 bg-white px-5 py-2.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 disabled:opacity-60"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={enviando || desabilitado}
        className={`rounded-full px-5 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${perigo ? "bg-red-600 text-[#fff] hover:brightness-110" : "bg-neutral-900 text-white hover:bg-neutral-800"}`}
      >
        {enviando ? "Salvando…" : rotulo}
      </button>
    </div>
  );
}
