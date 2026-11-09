"use client";

import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Lock,
  Send,
  Unlock,
} from "lucide-react";
import { classeCampo } from "@/components/estilos";
import type { SituacaoEnvio } from "@/lib/operacoes/limpeza";
import { ROTULO_ENVIO } from "@/lib/operacoes/limpeza";

// Peças pequenas da tela do rateio: campo com rótulo, célula numérica da
// tabela e os selos de situação (sempre cor + ícone + texto).

export const celula = "px-2 py-2";
export const campoCelula =
  "w-20 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-right text-sm tabular-nums outline-none transition focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5 disabled:border-transparent disabled:bg-transparent disabled:text-neutral-800";

export function Campo({
  rotulo,
  ajuda,
  children,
}: {
  rotulo: string;
  ajuda?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: o controle vem em children
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-neutral-600">{rotulo}</span>
      {children}
      {ajuda && <span className="text-[11px] text-neutral-500">{ajuda}</span>}
    </label>
  );
}

export function Entrada(
  props: React.InputHTMLAttributes<HTMLInputElement> & { numero?: boolean },
) {
  const { numero, className = "", ...resto } = props;
  return (
    <input
      {...resto}
      inputMode={numero ? "decimal" : resto.inputMode}
      autoComplete="off"
      className={`${classeCampo} ${numero ? "text-right tabular-nums" : ""} ${className}`}
    />
  );
}

export function SeloMes({
  status,
  incompleto,
}: {
  status: "aberto" | "fechado";
  incompleto: boolean;
}) {
  if (status === "fechado")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-2.5 py-0.5 text-xs font-medium text-white">
        <Lock className="size-3" aria-hidden /> Fechado
      </span>
    );
  if (incompleto)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/25 px-2.5 py-0.5 text-xs font-medium text-amber-900">
        <CircleAlert className="size-3" aria-hidden /> Incompleto
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-400/20 px-2.5 py-0.5 text-xs font-medium text-sky-900">
      <Unlock className="size-3" aria-hidden /> Aberto
    </span>
  );
}

const ESTILO_ENVIO: Record<SituacaoEnvio, { cor: string; icone: typeof Send }> =
  {
    enviado: { cor: "bg-green-400/20 text-green-800", icone: CircleCheck },
    enviado_atrasado: {
      cor: "bg-amber-400/25 text-amber-900",
      icone: CircleCheck,
    },
    no_prazo: {
      cor: "bg-neutral-900/[0.06] text-neutral-700",
      icone: CircleDashed,
    },
    atrasado: { cor: "bg-red-500/15 text-red-800", icone: CircleAlert },
    historico: { cor: "bg-neutral-900/[0.06] text-neutral-600", icone: Send },
  };

export function SeloEnvio({ situacao }: { situacao: SituacaoEnvio }) {
  const { cor, icone: Icone } = ESTILO_ENVIO[situacao];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cor}`}
    >
      <Icone className="size-3" aria-hidden /> {ROTULO_ENVIO[situacao]}
    </span>
  );
}

export function SeloConferencia({
  situacao,
}: {
  situacao: "bate" | "nao_bate" | "sem_contrato";
}) {
  if (situacao === "bate")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-400/20 px-2.5 py-0.5 text-xs font-medium text-green-800">
        <CircleCheck className="size-3" aria-hidden /> Bate com o contrato
      </span>
    );
  if (situacao === "nao_bate")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-800">
        <CircleAlert className="size-3" aria-hidden /> Não bate com o contrato
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900/[0.06] px-2.5 py-0.5 text-xs font-medium text-neutral-600">
      <CircleDashed className="size-3" aria-hidden /> Sem conferência
    </span>
  );
}
