import {
  ClipboardList,
  type LucideIcon,
  Megaphone,
  MessageSquareShare,
  Wrench,
} from "lucide-react";
import { formatarDataHora } from "@/lib/formato";
import { type SituacaoPrazo, situacaoDoPrazo } from "@/lib/os/prazo";
import {
  MOTIVOS_AGUARDANDO,
  type MotivoAguardando,
  PRIORIDADES,
  type Prioridade,
  STATUS,
  type StatusChamado,
  TIPOS,
  type TipoChamado,
} from "@/lib/os/rotulos";
import { prazoRelativo } from "@/lib/os/texto";

// Selos do módulo Chamados e OS. A cor nunca vem sozinha: sempre com texto
// (e ícone, quando ajuda). Servem em componentes de servidor e de cliente.

const PILULA =
  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium";

const COR_STATUS: Record<StatusChamado, string> = {
  aberto: "#2a78d6",
  em_andamento: "#7c5cd6",
  aguardando: "#eda100",
  concluido: "#1baf7a",
  fechado: "#0ca30c",
  cancelado: "#a3a3a3",
};

export function SeloStatusChamado({
  status,
  aguardando,
}: {
  status: StatusChamado;
  /** Motivo de Aguardando, mostrado junto ("Aguardando · Material"). */
  aguardando?: MotivoAguardando | null;
}) {
  return (
    <span className={`${PILULA} bg-neutral-900/[0.06] text-neutral-700`}>
      <span
        aria-hidden
        className="size-2 rounded-full"
        style={{ backgroundColor: COR_STATUS[status] }}
      />
      {STATUS[status]}
      {status === "aguardando" && aguardando && (
        <span className="text-neutral-500">
          · {MOTIVOS_AGUARDANDO[aguardando]}
        </span>
      )}
    </span>
  );
}

/** Cor do status (quadro, calendário, gráficos). */
export function corDoStatus(status: StatusChamado): string {
  return COR_STATUS[status];
}

const COR_PRIORIDADE: Record<Prioridade, string> = {
  baixa: "bg-neutral-900/[0.06] text-neutral-600",
  media: "bg-neutral-900/[0.06] text-neutral-800",
  alta: "bg-amber-50 text-amber-900",
  urgente: "bg-red-50 text-red-700",
};

export function SeloPrioridade({ prioridade }: { prioridade: Prioridade }) {
  const barras = { baixa: 1, media: 2, alta: 3, urgente: 4 }[prioridade];
  return (
    <span className={`${PILULA} ${COR_PRIORIDADE[prioridade]}`}>
      <span aria-hidden className="flex items-end gap-px">
        {[1, 2, 3, 4].map((b) => (
          <span
            key={b}
            className={`w-[3px] rounded-full ${b <= barras ? "bg-current" : "bg-current opacity-20"}`}
            style={{ height: `${3 + b * 2}px` }}
          />
        ))}
      </span>
      {PRIORIDADES[prioridade]}
    </span>
  );
}

const COR_PRAZO: Record<SituacaoPrazo, string> = {
  atrasado: "bg-red-50 text-red-700",
  vence_hoje: "bg-amber-50 text-amber-900",
  vencendo: "bg-amber-50 text-amber-900",
  no_prazo: "bg-neutral-900/[0.06] text-neutral-700",
  sem_prazo: "bg-neutral-900/[0.04] text-neutral-500",
  encerrado: "bg-neutral-900/[0.04] text-neutral-500",
};

/**
 * Prazo relativo ("vence em 2h", "atrasado há 3 dias"): vermelho quando
 * venceu, amarelo nas últimas horas (aviso dos parâmetros). A data exata
 * fica no title.
 */
export function SeloPrazo({
  prazo,
  status,
  agora,
  avisoHoras = 24,
}: {
  prazo: string | null;
  status: StatusChamado;
  agora: Date;
  avisoHoras?: number;
}) {
  const situacao = situacaoDoPrazo({ prazo, status }, agora, avisoHoras);
  if (!prazo) {
    return (
      <span className={`${PILULA} ${COR_PRAZO.sem_prazo}`}>Sem prazo</span>
    );
  }
  return (
    <span
      title={`Prazo: ${formatarDataHora(prazo)}`}
      className={`${PILULA} ${COR_PRAZO[situacao]}`}
    >
      {situacao === "encerrado"
        ? formatarDataHora(prazo).slice(0, 10)
        : prazoRelativo(prazo, agora)}
    </span>
  );
}

const ICONE_TIPO: Record<TipoChamado, LucideIcon> = {
  tarefa: ClipboardList,
  solicitacao: MessageSquareShare,
  os: Wrench,
  aviso: Megaphone,
};

export function IconeTipo({
  tipo,
  className = "size-4",
}: {
  tipo: TipoChamado;
  className?: string;
}) {
  const Icone = ICONE_TIPO[tipo];
  return <Icone className={className} aria-hidden />;
}

export function SeloTipo({ tipo }: { tipo: TipoChamado }) {
  return (
    <span className={`${PILULA} bg-neutral-900/[0.06] text-neutral-700`}>
      <IconeTipo tipo={tipo} className="size-3.5" />
      {TIPOS[tipo]}
    </span>
  );
}

/** Setor com a cor dele (bolinha + nome). */
export function SeloSetor({ nome, cor }: { nome: string; cor: string }) {
  return (
    <span className={`${PILULA} bg-neutral-900/[0.06] text-neutral-700`}>
      <span
        aria-hidden
        className="size-2 rounded-full"
        style={{ backgroundColor: cor }}
      />
      {nome}
    </span>
  );
}

/** Marca de dado de exemplo (ilustrativo) numa linha ou ficha. */
export function SeloExemplo() {
  return (
    <span
      title="Dado de exemplo, gerado para o protótipo"
      className={`${PILULA} bg-violet-400/20 text-violet-700`}
    >
      Exemplo
    </span>
  );
}
