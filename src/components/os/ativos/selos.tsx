import {
  Archive,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleX,
  type LucideIcon,
  Pause,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Wrench,
} from "lucide-react";
import type { SituacaoGarantia } from "@/lib/os/ativos";
import { SITUACOES_ATIVO, type SituacaoAtivo } from "@/lib/os/rotulos";
import { type Criterio, SINAIS, type Sinal } from "@/lib/os/sinal";

// Selos dos ativos. A cor nunca vem sozinha: sempre ícone e texto. Servem
// em componentes de servidor e de cliente.

const PILULA =
  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium";

const TOM = {
  verde: "bg-green-50 text-green-700",
  amarelo: "bg-amber-50 text-amber-900",
  vermelho: "bg-red-50 text-red-700",
  neutro: "bg-neutral-900/[0.06] text-neutral-600",
} as const;

const SINAL: Record<Sinal, { Icone: LucideIcon; tom: keyof typeof TOM }> = {
  manter: { Icone: CircleCheck, tom: "verde" },
  avaliar: { Icone: CircleAlert, tom: "amarelo" },
  trocar: { Icone: CircleX, tom: "vermelho" },
  incompleto: { Icone: CircleDashed, tom: "neutro" },
};

export function SeloSinal({ sinal }: { sinal: Sinal }) {
  const { Icone, tom } = SINAL[sinal];
  return (
    <span className={`${PILULA} ${TOM[tom]}`}>
      <Icone className="size-3.5" aria-hidden />
      {SINAIS[sinal]}
    </span>
  );
}

export const CRITERIOS: Record<Criterio, string> = {
  manter: "Manter",
  avaliar: "Avaliar",
  trocar: "Trocar",
  sem_dado: "Sem dado",
};

/** Um critério do sinal (peso, corretivas ou idade), com o valor ao lado. */
export function SeloCriterio({
  criterio,
  texto,
}: {
  criterio: Criterio;
  /** Valor do critério ("62%", "4 corretivas"). */
  texto?: string;
}) {
  const { Icone, tom } =
    criterio === "sem_dado" ? SINAL.incompleto : SINAL[criterio];
  return (
    <span className={`${PILULA} ${TOM[tom]}`}>
      <Icone className="size-3.5" aria-hidden />
      {texto ?? CRITERIOS[criterio]}
      {texto && <span className="sr-only"> ({CRITERIOS[criterio]})</span>}
    </span>
  );
}

const SITUACAO: Record<
  SituacaoAtivo,
  { Icone: LucideIcon; tom: keyof typeof TOM }
> = {
  em_uso: { Icone: CircleCheck, tom: "verde" },
  em_manutencao: { Icone: Wrench, tom: "amarelo" },
  parado: { Icone: Pause, tom: "vermelho" },
  baixado: { Icone: Archive, tom: "neutro" },
};

export function SeloSituacaoAtivo({
  situacao,
  motivo,
}: {
  situacao: SituacaoAtivo;
  /** Baixa: "Vendido", "Doado"… (saída do ativo) ou o motivo digitado. */
  motivo?: string | null;
}) {
  const { Icone, tom } = SITUACAO[situacao];
  const texto =
    situacao === "baixado" && motivo
      ? `${SITUACOES_ATIVO[situacao]} – ${motivo}`
      : SITUACOES_ATIVO[situacao];
  return (
    <span className={`${PILULA} ${TOM[tom]} max-w-64`} title={texto}>
      <Icone className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{texto}</span>
    </span>
  );
}

/** Ficha sem os dados que o sinal de troca precisa. */
export function SeloIncompleto({ faltas }: { faltas: string[] }) {
  return (
    <span
      title={`Falta: ${faltas.join(", ")}`}
      className={`${PILULA} border border-dashed border-amber-300 bg-amber-50 text-amber-900`}
    >
      <CircleDashed className="size-3.5" aria-hidden />
      Cadastro incompleto
    </span>
  );
}

const GARANTIA: Record<
  SituacaoGarantia,
  { Icone: LucideIcon; tom: keyof typeof TOM; rotulo: string }
> = {
  vigente: { Icone: ShieldCheck, tom: "verde", rotulo: "Na garantia" },
  vencendo: { Icone: ShieldAlert, tom: "amarelo", rotulo: "Garantia vencendo" },
  vencida: { Icone: ShieldX, tom: "neutro", rotulo: "Garantia vencida" },
};

export function SeloGarantia({ situacao }: { situacao: SituacaoGarantia }) {
  const { Icone, tom, rotulo } = GARANTIA[situacao];
  return (
    <span className={`${PILULA} ${TOM[tom]}`}>
      <Icone className="size-3.5" aria-hidden />
      {rotulo}
    </span>
  );
}
