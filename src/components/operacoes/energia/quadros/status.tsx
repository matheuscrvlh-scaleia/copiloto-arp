import { CircleCheck, CircleDashed, Clock3, TriangleAlert } from "lucide-react";
import { STATUS, type StatusCaixa } from "@/lib/operacoes/energia";

// Status da caixa sempre com cor, ícone e texto (WCAG 1.4.1): verde
// ocupado, amarelo reservado, cinza livre (spec 4.5). As cores usam os
// tons que o tema escuro redefine (globals.css).

export const COR_DO_STATUS: Record<StatusCaixa, string> = {
  ocupado: "border-green-700/35 bg-green-50 text-green-800",
  reservado: "border-amber-900/30 bg-amber-50 text-amber-900",
  livre: "border-neutral-300 bg-neutral-50 text-neutral-600",
};

const ICONE = {
  ocupado: CircleCheck,
  reservado: Clock3,
  livre: CircleDashed,
} as const;

export function statusValido(s: string): StatusCaixa {
  return s === "ocupado" || s === "reservado" ? s : "livre";
}

export function IconeDoStatus({
  status,
  className = "size-3.5",
}: {
  status: StatusCaixa;
  className?: string;
}) {
  const Icone = ICONE[status];
  return <Icone className={`shrink-0 ${className}`} aria-hidden />;
}

/** Selo: ícone + texto na cor do status. */
export function SeloDoStatus({ status }: { status: string }) {
  const s = statusValido(status);
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${COR_DO_STATUS[s]}`}
    >
      <IconeDoStatus status={s} className="size-3" />
      {STATUS[s].rotulo}
    </span>
  );
}

/** Selo vermelho de "sem termo" (ou o aviso do locatário novo). */
export function SeloSemTermo({ texto = "Sem termo" }: { texto?: string }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-red-700/40 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
      <TriangleAlert className="size-3" aria-hidden />
      {texto}
    </span>
  );
}

/** Legenda acessível da grade (cor + ícone + texto de cada estado). */
export function LegendaDoQuadro() {
  return (
    <ul
      aria-label="Legenda do desenho do quadro"
      className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-neutral-600"
    >
      {(Object.keys(STATUS) as StatusCaixa[]).map((s) => (
        <li key={s} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className={`grid size-5 place-items-center rounded-md border ${COR_DO_STATUS[s]}`}
          >
            <IconeDoStatus status={s} className="size-3" />
          </span>
          {STATUS[s].descricao}
        </li>
      ))}
      <li className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="grid size-5 place-items-center rounded-md border border-green-700/35 bg-green-50 text-red-700 ring-2 ring-red-700 ring-inset"
        >
          <TriangleAlert className="size-3" />
        </span>
        Ocupada sem termo de energia
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="size-5 rounded-md border border-neutral-300 bg-neutral-50 opacity-25"
        />
        Fora do filtro
      </li>
    </ul>
  );
}
