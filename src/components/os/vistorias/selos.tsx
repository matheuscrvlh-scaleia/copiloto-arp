import {
  CircleCheck,
  CircleDashed,
  CircleX,
  ClipboardCheck,
  type LucideIcon,
  PenLine,
} from "lucide-react";
import { TIPOS_VISTORIA, type TipoVistoria } from "@/lib/os/rotulos";
import {
  ROTULOS_SITUACAO,
  type SituacaoVistoria,
} from "@/lib/os/vistoria-regras";

// Selos da vistoria: a cor sempre vem com ícone e texto.

const PILULA =
  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium";

const SITUACAO: Record<
  SituacaoVistoria,
  { Icone: LucideIcon; classe: string }
> = {
  andamento: {
    Icone: CircleDashed,
    classe: "bg-violet-400/20 text-violet-700",
  },
  aguardando_assinatura: {
    Icone: PenLine,
    classe: "bg-amber-50 text-amber-900",
  },
  concluida: { Icone: CircleCheck, classe: "bg-green-50 text-green-700" },
  cancelada: { Icone: CircleX, classe: "bg-neutral-100 text-neutral-600" },
};

export function SeloSituacaoVistoria({
  situacao,
}: {
  situacao: SituacaoVistoria;
}) {
  const { Icone, classe } = SITUACAO[situacao];
  return (
    <span className={`${PILULA} ${classe}`}>
      <Icone className="size-3.5" aria-hidden />
      {ROTULOS_SITUACAO[situacao]}
    </span>
  );
}

/** "Entrada", "Saída"… (sem o "Vistoria de"). */
export function tipoCurto(tipo: TipoVistoria): string {
  return TIPOS_VISTORIA[tipo].replace(/^Vistoria (de )?/, "");
}

export function SeloTipoVistoria({ tipo }: { tipo: TipoVistoria }) {
  return (
    <span className={`${PILULA} bg-neutral-900/[0.06] text-neutral-700`}>
      <ClipboardCheck className="size-3.5" aria-hidden />
      {tipoCurto(tipo)}
    </span>
  );
}
