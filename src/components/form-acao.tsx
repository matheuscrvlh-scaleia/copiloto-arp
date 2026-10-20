"use client";

import { useActionState } from "react";

export interface EstadoAcao {
  ok?: string;
  erro?: string;
}

export type Acao = (
  anterior: EstadoAcao,
  form: FormData,
) => Promise<EstadoAcao>;

const BOTAO = {
  primario:
    "bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-60",
  secundario:
    "border border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400 disabled:opacity-60",
  perigo:
    "border border-red-200 bg-white text-red-700 hover:border-red-400 disabled:opacity-60",
} as const;

/** Formulário de uma Server Action, com estado de envio e mensagem de retorno. */
export function FormAcao({
  acao,
  children,
  rotulo = "Salvar",
  rotuloEnviando = "Salvando…",
  variante = "primario",
  confirmar,
  className = "",
}: {
  acao: Acao;
  children?: React.ReactNode;
  rotulo?: string;
  rotuloEnviando?: string;
  variante?: keyof typeof BOTAO;
  /** Pergunta antes de enviar (ações que não têm volta). */
  confirmar?: string;
  className?: string;
}) {
  const [estado, executar, enviando] = useActionState(acao, {});
  return (
    <form
      action={executar}
      className={className}
      onSubmit={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault();
      }}
    >
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={enviando}
          className={`rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-wait ${BOTAO[variante]}`}
        >
          {enviando ? rotuloEnviando : rotulo}
        </button>
        {estado.erro && (
          <span role="alert" className="text-xs text-red-700">
            {estado.erro}
          </span>
        )}
        {estado.ok && !enviando && (
          <output className="text-xs text-green-700">{estado.ok}</output>
        )}
      </div>
    </form>
  );
}
