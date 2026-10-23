"use client";

import {
  AlertTriangle,
  ArrowRight,
  CircleCheck,
  Clock,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { marcarSeuDiaVisto } from "@/app/(app)/os/visoes-actions";
import { formatarNumero } from "@/lib/formato";

// "Seu dia": na primeira entrada do dia no módulo, um resumo do que pede
// atenção (atrasados, vencem hoje, aguardando a sua confirmação), com
// atalhos para a Minha caixa já filtrada. Abriu, conta como visto hoje.

export interface ResumoDoDia {
  nome: string;
  saudacao: string;
  data: string;
  atrasados: number;
  hoje: number;
  confirmar: number;
}

const ITENS = [
  {
    chave: "atrasados",
    rotulo: "Atrasados",
    cartao: "atrasados",
    Icone: AlertTriangle,
    cor: "bg-red-50 text-red-700",
  },
  {
    chave: "hoje",
    rotulo: "Vencem hoje",
    cartao: "vence_hoje",
    Icone: Clock,
    cor: "bg-amber-50 text-amber-900",
  },
  {
    chave: "confirmar",
    rotulo: "Aguardando sua confirmação",
    cartao: "aguardando_confirmacao",
    Icone: CircleCheck,
    cor: "bg-violet-400/20 text-violet-700",
  },
] as const;

export function ModalSeuDia({ resumo }: { resumo: ResumoDoDia }) {
  const [montado, setMontado] = useState(false);
  const [aberto, setAberto] = useState(true);
  useEffect(() => {
    setMontado(true);
    void marcarSeuDiaVisto();
  }, []);
  if (!montado || !aberto) return null;
  return createPortal(
    <Painel resumo={resumo} aoFechar={() => setAberto(false)} />,
    document.body,
  );
}

function Painel({
  resumo,
  aoFechar,
}: {
  resumo: ResumoDoDia;
  aoFechar: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  useEffect(() => {
    dialogo.current?.showModal();
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);
  const total = resumo.atrasados + resumo.hoje + resumo.confirmar;

  return (
    <dialog
      ref={dialogo}
      aria-labelledby={idTitulo}
      onCancel={(e) => {
        e.preventDefault();
        aoFechar();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
      onKeyDown={() => undefined}
      className="modal-confirmacao m-0 mt-auto w-full max-w-none overflow-hidden rounded-t-[2rem] border-0 bg-transparent p-0 text-neutral-900 backdrop:bg-black/45 backdrop:backdrop-blur-md sm:m-auto sm:w-[min(34rem,calc(100vw-1.5rem))] sm:rounded-[2rem]"
    >
      <div className="painel-modal relative isolate overflow-hidden rounded-t-[2rem] p-6 sm:rounded-[2rem] md:p-8">
        <div
          aria-hidden
          className="absolute -top-24 -right-16 -z-10 h-56 w-3/4 rounded-full bg-marca/30 blur-3xl"
        />
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar"
          className="absolute top-5 right-5 grid size-9 place-items-center rounded-full bg-neutral-900/[0.06] text-neutral-700 transition hover:bg-neutral-900 hover:text-white"
        >
          <X className="size-4" aria-hidden />
        </button>
        <p className="text-[11px] font-semibold tracking-[0.2em] text-marca-escuro uppercase">
          Seu dia · {resumo.data}
        </p>
        <h2
          id={idTitulo}
          className="mt-2 pr-10 text-2xl font-semibold tracking-tight md:text-3xl"
        >
          {resumo.saudacao}, {resumo.nome.split(" ")[0]}
        </h2>
        <p className="mt-1.5 text-sm text-neutral-600">
          {total
            ? "Isto pede a sua atenção hoje."
            : "Nada atrasado, vencendo hoje ou esperando você. Bom trabalho!"}
        </p>

        <ul className="mt-6 flex flex-col gap-2">
          {ITENS.map((i) => {
            const n = resumo[i.chave];
            return (
              <li key={i.chave}>
                <Link
                  href={`/os?cartao=${i.cartao}`}
                  onClick={aoFechar}
                  className="group flex items-center gap-3 rounded-2xl border border-neutral-900/[0.06] bg-white/60 p-3 transition hover:border-neutral-900/20 hover:bg-white/90"
                >
                  <span
                    aria-hidden
                    className={`grid size-10 shrink-0 place-items-center rounded-full ${n ? i.cor : "bg-neutral-900/[0.05] text-neutral-400"}`}
                  >
                    <i.Icone className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium">
                    {i.rotulo}
                  </span>
                  <span
                    className={`text-2xl font-semibold tabular-nums ${n ? "" : "text-neutral-400"}`}
                  >
                    {formatarNumero(n)}
                  </span>
                  <ArrowRight
                    className="size-4 text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-neutral-900"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={aoFechar}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          <Sparkles className="size-4" aria-hidden />
          Começar o dia
        </button>
      </div>
    </dialog>
  );
}
