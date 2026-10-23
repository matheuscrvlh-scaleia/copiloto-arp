"use client";

import { X } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import type { Acao } from "@/components/form-acao";

// Botão que abre um formulário numa janela (plano preventivo, baixa,
// anexo, categoria). Fecha sozinha quando a ação dá certo e deixa o "ok"
// ao lado do botão; o erro aparece dentro da janela, junto dos campos.

const BOTAO = {
  primario:
    "inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800",
  secundario:
    "inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400",
  perigo:
    "inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:border-red-400",
  icone:
    "grid size-9 place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-900/[0.06] hover:text-neutral-900",
} as const;

export function Janela({
  acao,
  rotulo,
  icone,
  titulo,
  descricao,
  enviar = "Salvar",
  enviando: rotuloEnviando = "Salvando…",
  variante = "secundario",
  perigo = false,
  children,
}: {
  acao: Acao;
  /** Texto do botão que abre (no ícone, vira a dica e o nome acessível). */
  rotulo: string;
  icone?: React.ReactNode;
  titulo: string;
  descricao?: string;
  enviar?: string;
  enviando?: string;
  variante?: keyof typeof BOTAO;
  /** Botão de enviar em vermelho (baixa, exclusão). */
  perigo?: boolean;
  children: React.ReactNode;
}) {
  const [estado, executar, enviando] = useActionState(acao, {});
  const [aberto, setAberto] = useState(false);
  const dialogo = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    if (estado.ok) setAberto(false);
  }, [estado]);

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (aberto && !d.open) {
      d.showModal();
      document.documentElement.style.overflow = "hidden";
    } else if (!aberto && d.open) d.close();
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [aberto]);

  const fechar = () => {
    if (!enviando) setAberto(false);
  };

  return (
    <>
      <span className="inline-flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-haspopup="dialog"
          title={variante === "icone" ? rotulo : undefined}
          aria-label={variante === "icone" ? rotulo : undefined}
          className={BOTAO[variante]}
        >
          {icone}
          {variante !== "icone" && rotulo}
        </button>
        {estado.ok && !aberto && (
          <output className="text-xs text-green-700">{estado.ok}</output>
        )}
      </span>
      <dialog
        ref={dialogo}
        aria-labelledby={idTitulo}
        onCancel={(e) => {
          e.preventDefault();
          fechar();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) fechar();
        }}
        onKeyDown={() => undefined}
        className="modal-detalhe m-auto max-h-[min(90dvh,52rem)] w-[min(36rem,calc(100vw-1.5rem))] overflow-hidden rounded-[2rem] border-0 bg-transparent p-0 text-neutral-900 backdrop:bg-black/45 backdrop:backdrop-blur-md"
      >
        <form
          action={executar}
          className="painel-modal flex max-h-[min(90dvh,52rem)] flex-col rounded-[2rem]"
        >
          <header className="relative shrink-0 px-6 pt-6 pb-3 pr-16">
            <h2
              id={idTitulo}
              className="text-xl font-semibold tracking-tight text-balance"
            >
              {titulo}
            </h2>
            {descricao && (
              <p className="mt-1 text-sm text-neutral-500">{descricao}</p>
            )}
            <button
              type="button"
              onClick={fechar}
              aria-label="Fechar"
              className="absolute top-5 right-5 grid size-10 place-items-center rounded-full bg-neutral-900 text-white transition hover:scale-105"
            >
              <X className="size-4" aria-hidden />
            </button>
          </header>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-3">
            {children}
          </div>
          <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-neutral-900/[0.06] px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
            {estado.erro && (
              <p role="alert" className="text-xs text-red-700 sm:mr-auto">
                {estado.erro}
              </p>
            )}
            <button
              type="button"
              onClick={fechar}
              disabled={enviando}
              className="rounded-full border border-neutral-200 bg-white px-5 py-2.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className={`rounded-full px-5 py-2.5 text-sm font-medium transition disabled:cursor-wait disabled:opacity-70 ${perigo ? "bg-red-600 text-[#fff] hover:brightness-110" : "bg-neutral-900 text-white hover:bg-neutral-800"}`}
            >
              {enviando ? rotuloEnviando : enviar}
            </button>
          </footer>
        </form>
      </dialog>
    </>
  );
}
