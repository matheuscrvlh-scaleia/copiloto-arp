"use client";

import {
  AlertTriangle,
  CircleCheck,
  Clock,
  Hourglass,
  Inbox,
  UserX,
} from "lucide-react";
import { TOM } from "@/components/estilos";
import { CLASSE_MARCADO, tonsDaTela } from "@/components/os/tons";
import { formatarNumero } from "@/lib/formato";
import type { ChaveCartao } from "@/lib/os/lista";
import { CARTOES } from "@/lib/os/lista";

// Cartões de indicador das visões (no máximo 4): o número e, ao clicar,
// a lista mostra só o que ele conta. Clicar de novo volta para a lista toda.

const ICONE: Record<ChaveCartao, typeof Inbox> = {
  atrasados: AlertTriangle,
  vence_hoje: Clock,
  aguardando_confirmacao: CircleCheck,
  em_andamento: Hourglass,
  sem_responsavel: UserX,
  abertos: Inbox,
  concluidos_mes: CircleCheck,
  fechados_mes: CircleCheck,
};

/** Número que pede atenção quando passa de zero. */
const ALERTA: Partial<Record<ChaveCartao, "red" | "amber" | "violet">> = {
  atrasados: "red",
  vence_hoje: "amber",
  aguardando_confirmacao: "violet",
  sem_responsavel: "amber",
};

const COR_ALERTA = {
  red: "bg-red-50 text-red-700",
  amber: "bg-amber-50 text-amber-900",
  violet: "bg-violet-400/20 text-violet-700",
} as const;

export interface CartaoVisao {
  chave: ChaveCartao;
  valor: number;
  /** Linha pequena embaixo (ex.: "pedidos por você"). */
  detalhe?: string;
}

export function CartoesFiltro({
  cartoes,
  ativo,
  aoEscolher,
}: {
  cartoes: CartaoVisao[];
  ativo: ChaveCartao | null;
  aoEscolher: (c: ChaveCartao | null) => void;
}) {
  // Cada visão tem cartões diferentes: eles mesmos sorteiam os tons.
  const tons = tonsDaTela(cartoes.map((c) => c.chave).join());
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
      {cartoes.slice(0, 4).map((c, i) => {
        const Icone = ICONE[c.chave];
        const marcado = ativo === c.chave;
        const alerta = c.valor > 0 ? ALERTA[c.chave] : undefined;
        return (
          <button
            key={c.chave}
            type="button"
            aria-pressed={marcado}
            onClick={() => aoEscolher(marcado ? null : c.chave)}
            className={`flutua flex min-h-32 flex-col gap-2 rounded-[1.75rem] p-4 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-marca md:p-5 ${TOM[tons[i] ?? "claro"]} ${marcado ? CLASSE_MARCADO : ""}`}
          >
            <span className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium text-neutral-600">
                {CARTOES[c.chave].titulo}
              </span>
              <span
                aria-hidden
                className={`grid size-7 shrink-0 place-items-center rounded-full ${alerta ? COR_ALERTA[alerta] : "bg-neutral-900/[0.06] text-neutral-500"}`}
              >
                <Icone className="size-3.5" />
              </span>
            </span>
            <span className="text-3xl font-semibold tracking-tight tabular-nums">
              {formatarNumero(c.valor)}
            </span>
            <span className="mt-auto text-xs text-neutral-500">
              {marcado
                ? "Filtrando a lista · clique para ver tudo"
                : (c.detalhe ?? "Clique para filtrar a lista")}
            </span>
          </button>
        );
      })}
    </div>
  );
}
