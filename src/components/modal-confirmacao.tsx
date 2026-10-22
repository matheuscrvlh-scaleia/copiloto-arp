"use client";

import { CircleAlert, CircleHelp, CircleX } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { EstadoAcao } from "@/components/form-acao";
import { separarPergunta } from "@/lib/confirmacao";

// Modal padrão de confirmação e de erro das ações (excluir, remover,
// inativar...). Mesmo visual do modal de detalhe: <dialog> (Esc fecha, foco
// preso dentro, fundo inerte), no <body> para não herdar o tom do cartão de
// onde saiu. Depois de confirmar, fica aberto enquanto a ação roda; se ela
// voltar com erro, o erro aparece nele, com a opção de tentar de novo.

export interface PropsModalConfirmacao {
  aberto: boolean;
  /** "Pergunta? Explicação.": a pergunta vira o título. */
  pergunta?: string;
  erro?: string;
  aoConfirmar: () => void;
  aoFechar: () => void;
}

/**
 * Liga um formulário de Server Action ao modal: segura o envio até a
 * confirmação e leva para o modal o erro da volta. Com erroNoModal, o erro
 * abre o modal mesmo sem confirmação.
 */
export function useConfirmacao({
  confirmar,
  estado,
  erroNoModal = false,
}: {
  confirmar?: string;
  estado: EstadoAcao;
  erroNoModal?: boolean;
}) {
  const form = useRef<HTMLFormElement>(null);
  const liberado = useRef(false);
  const aguardando = useRef(false);
  const anterior = useRef(estado);
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string>();

  // Cada volta da ação é um estado novo: erro fica no modal; sucesso fecha.
  useEffect(() => {
    if (estado === anterior.current) return;
    anterior.current = estado;
    if (!aguardando.current && !erroNoModal) return;
    aguardando.current = false;
    if (estado.erro) {
      setErro(estado.erro);
      setAberto(true);
    } else {
      setAberto(false);
    }
  }, [estado, erroNoModal]);

  const modal: PropsModalConfirmacao = {
    aberto,
    pergunta: confirmar,
    erro,
    aoConfirmar() {
      setErro(undefined);
      liberado.current = true;
      form.current?.requestSubmit();
    },
    aoFechar() {
      setAberto(false);
    },
  };

  return {
    form,
    onSubmit(e: React.FormEvent<HTMLFormElement>) {
      if (confirmar && !liberado.current) {
        e.preventDefault();
        setErro(undefined);
        setAberto(true);
        return;
      }
      liberado.current = false;
      aguardando.current = Boolean(confirmar);
    },
    modal,
  };
}

export function ModalConfirmacao(
  props: PropsModalConfirmacao & {
    /** Texto do botão que confirma (ex.: "Remover"). */
    rotulo: string;
    rotuloEnviando?: string;
    perigo?: boolean;
    enviando: boolean;
  },
) {
  // Só existe no navegador e só enquanto aberto: abre ao montar.
  if (!props.aberto) return null;
  return createPortal(<Painel {...props} />, document.body);
}

function Painel({
  pergunta,
  erro,
  rotulo,
  rotuloEnviando = "Um instante…",
  perigo = false,
  enviando,
  aoConfirmar,
  aoFechar,
}: Parameters<typeof ModalConfirmacao>[0]) {
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

  const { titulo, texto } = erro
    ? { titulo: "Não deu para concluir", texto: erro }
    : separarPergunta(pergunta ?? "");
  const alerta = Boolean(erro) || perigo;
  const Icone = erro ? CircleX : perigo ? CircleAlert : CircleHelp;
  const fechar = () => {
    if (!enviando) aoFechar();
  };

  return (
    <dialog
      ref={dialogo}
      role={erro ? "alertdialog" : undefined}
      aria-labelledby={idTitulo}
      aria-describedby={texto ? idTexto : undefined}
      aria-busy={enviando}
      // Esc: fecha pelo estado (o <dialog> some ao desmontar), nunca no meio do envio.
      onCancel={(e) => {
        e.preventDefault();
        fechar();
      }}
      // Clicar fora do painel (no fundo) fecha.
      onClick={(e) => {
        if (e.target === e.currentTarget) fechar();
      }}
      onKeyDown={() => undefined}
      className="modal-confirmacao m-auto w-[min(28rem,calc(100vw-1.5rem))] overflow-hidden rounded-[2rem] border-0 bg-transparent p-0 text-neutral-900 backdrop:bg-black/45 backdrop:backdrop-blur-md"
    >
      <div className="painel-modal relative isolate overflow-hidden rounded-[2rem] p-6 md:p-7">
        <div
          aria-hidden
          className={`absolute -top-16 -right-10 -z-10 h-32 w-2/3 rounded-full blur-3xl ${alerta ? "bg-red-500/20" : "bg-marca/25"}`}
        />
        <span
          aria-hidden
          className={`grid size-11 place-items-center rounded-full ${alerta ? "bg-red-500/15 text-red-700" : "bg-neutral-900/[0.06] text-neutral-800"}`}
        >
          <Icone className="size-5" />
        </span>
        <h2
          id={idTitulo}
          className="mt-4 text-lg font-semibold tracking-tight text-balance"
        >
          {titulo}
        </h2>
        {texto && (
          <p id={idTexto} className="mt-1.5 text-sm text-neutral-600">
            {texto}
          </p>
        )}

        {/* Cancelar vem antes no DOM: é ele que recebe o foco ao abrir. */}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={fechar}
            disabled={enviando}
            className="rounded-full border border-neutral-200 bg-white px-5 py-2.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 disabled:opacity-60"
          >
            {erro ? "Fechar" : "Cancelar"}
          </button>
          {pergunta && (
            <button
              type="button"
              onClick={aoConfirmar}
              disabled={enviando}
              className={`rounded-full px-5 py-2.5 text-sm font-medium transition disabled:cursor-wait disabled:opacity-70 ${perigo ? "bg-red-600 text-[#fff] hover:brightness-110" : "bg-neutral-900 text-white hover:bg-neutral-800"}`}
            >
              {enviando ? rotuloEnviando : erro ? "Tentar de novo" : rotulo}
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
