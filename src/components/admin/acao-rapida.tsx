"use client";

import { useActionState } from "react";
import type { Acao } from "@/components/form-acao";
import {
  ModalConfirmacao,
  useConfirmacao,
} from "@/components/modal-confirmacao";

const ESTILO = {
  icone: {
    normal:
      "grid size-9 place-items-center rounded-full opacity-60 hover:bg-[rgb(127_127_127/0.15)] hover:opacity-100",
    perigo:
      "grid size-9 place-items-center rounded-full opacity-60 hover:bg-red-50 hover:text-red-700 hover:opacity-100",
  },
  texto: {
    normal:
      "inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-400",
    perigo:
      "inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:border-red-400",
  },
} as const;

/**
 * Um botão que dispara uma Server Action (inativar, excluir...), com
 * confirmação opcional. O erro aparece no modal de confirmação; o sucesso
 * aparece na própria tela, que a ação atualiza.
 */
export function AcaoRapida({
  acao,
  campos,
  rotulo,
  icone,
  confirmar,
  perigo = false,
  comTexto = false,
}: {
  acao: Acao;
  campos: Record<string, string>;
  rotulo: string;
  icone: React.ReactNode;
  confirmar?: string;
  perigo?: boolean;
  /** Pílula com ícone e texto; sem isso, só o ícone (com dica). */
  comTexto?: boolean;
}) {
  const [estado, executar, enviando] = useActionState(acao, {});
  const confirmacao = useConfirmacao({ confirmar, estado, erroNoModal: true });
  return (
    <form
      ref={confirmacao.form}
      action={executar}
      onSubmit={confirmacao.onSubmit}
    >
      {Object.entries(campos).map(([nome, valor]) => (
        <input key={nome} type="hidden" name={nome} value={valor} />
      ))}
      <button
        type="submit"
        disabled={enviando}
        title={rotulo}
        aria-label={comTexto ? undefined : rotulo}
        className={`transition disabled:cursor-wait disabled:opacity-40 ${ESTILO[comTexto ? "texto" : "icone"][perigo ? "perigo" : "normal"]}`}
      >
        {icone}
        {comTexto && rotulo}
      </button>
      <ModalConfirmacao
        {...confirmacao.modal}
        rotulo={rotulo}
        perigo={perigo}
        enviando={enviando}
      />
    </form>
  );
}
