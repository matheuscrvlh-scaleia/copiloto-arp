import {
  CircleAlert,
  CircleCheck,
  CircleX,
  Inbox,
  type LucideIcon,
  Wrench,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { formatarData, formatarDataHora } from "@/lib/formato";
import type { Etapa } from "@/lib/os/portal";
import {
  type MotivoAguardando,
  type StatusChamado,
  statusNoPortal,
} from "@/lib/os/rotulos";
import { paraBrasilia } from "@/lib/os/tempo";

// Peças visuais do portal do lojista (servidor): moldura, selo de status
// em palavras simples e etapas do pedido.

/** Timestamp do banco → "24/10/2026" no dia de Brasília. */
export const dataDe = (iso: string) =>
  formatarData(paraBrasilia(new Date(iso)).data);

export function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh px-4 py-5 sm:py-8">
      <div aria-hidden className="aurora">
        <i />
        <i />
        <i />
      </div>
      <div className="mx-auto flex max-w-2xl flex-col gap-5">{children}</div>
      <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-neutral-500">
        Portal do lojista · Espaço ARP, Nova Friburgo
      </p>
    </div>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <Image
        src="/brand/logo.png"
        alt="ARP"
        width={36}
        height={36}
        className="rounded-xl"
        priority
      />
      <span className="text-sm leading-tight">
        <span className="block font-semibold text-neutral-900">ARP</span>
        <span className="block text-xs text-neutral-500">
          Portal do lojista
        </span>
      </span>
    </span>
  );
}

const SELO_PADRAO = {
  Icone: Inbox,
  classe: "bg-neutral-900/[0.06] text-neutral-700",
};

const SELOS: Record<string, { Icone: LucideIcon; classe: string }> = {
  Recebido: SELO_PADRAO,
  "Em atendimento": { Icone: Wrench, classe: "bg-violet-100 text-violet-700" },
  "Aguardando você": {
    Icone: CircleAlert,
    classe: "bg-amber-50 text-amber-900",
  },
  Concluído: { Icone: CircleCheck, classe: "bg-green-50 text-green-700" },
  Cancelado: {
    Icone: CircleX,
    classe: "bg-neutral-900/[0.06] text-neutral-500",
  },
};

/** Status em palavras simples, sempre com ícone. */
export function SeloPedido({
  status,
  aguardando,
}: {
  status: StatusChamado;
  aguardando: MotivoAguardando | null;
}) {
  const rotulo = statusNoPortal(status, aguardando);
  const { Icone, classe } = SELOS[rotulo] ?? SELO_PADRAO;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${classe}`}
    >
      <Icone className="size-3.5" aria-hidden />
      {rotulo}
    </span>
  );
}

/** Recebido → Em atendimento → Concluído. */
export function Etapas({ etapas }: { etapas: Etapa[] }) {
  return (
    <ol className="grid grid-cols-3 gap-2">
      {etapas.map((e, i) => (
        <li key={e.rotulo} className="flex flex-col gap-1.5">
          <span
            aria-hidden
            className={`h-1.5 rounded-full ${e.feita ? "bg-marca" : "bg-neutral-900/10"}`}
          />
          <span
            className={`text-xs font-medium ${e.feita ? "text-neutral-900" : "text-neutral-400"}`}
          >
            <span className="sr-only">
              Etapa {i + 1}: {e.feita ? "feita" : "pendente"} —{" "}
            </span>
            {e.rotulo}
          </span>
          {e.em && (
            <span className="text-[11px] text-neutral-500 tabular-nums">
              {formatarDataHora(e.em)}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

/** Linha de "Meus pedidos". */
export function ItemPedido({
  href,
  numero,
  titulo,
  status,
  aguardando,
  criadoEm,
  avaliar,
  icone,
}: {
  href: string;
  numero: number;
  titulo: string;
  status: StatusChamado;
  aguardando: MotivoAguardando | null;
  criadoEm: string;
  avaliar: boolean;
  icone: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-white/60 focus-visible:bg-white/60 focus-visible:outline-none"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-marca/20 text-marca-escuro">
          {icone}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            <span className="text-neutral-500 tabular-nums">#{numero}</span>{" "}
            {titulo}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <SeloPedido status={status} aguardando={aguardando} />
            <span>Aberto em {dataDe(criadoEm)}</span>
            {avaliar && (
              <span className="font-medium text-neutral-800">· Avalie</span>
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}
