import {
  CircleDashed,
  CircleDollarSign,
  CircleMinus,
  RefreshCcw,
  TriangleAlert,
  Upload,
} from "lucide-react";
import Link from "next/link";
import type { ComponentProps } from "react";
import { BarraDeFiltros } from "@/components/dashboard/barra-de-filtros";
import { AbasDaTela } from "@/components/dashboard/tela";
import { ALERTAS, type Alerta } from "@/lib/operacoes/agua-alertas";
import {
  formatarVisor,
  ROTULO_TIPO,
  type TipoAgua,
} from "@/lib/operacoes/agua-formato";
import { BOTAO_PRIMARIO } from "./estilos";

// Peças comuns das telas da água (spec 4.4): as abas (uma rota por aba, para
// cada uma lembrar os próprios filtros), a barra de filtros do módulo, o
// tipo de faturamento e os alertas (sempre cor + ícone + texto) e o visor
// desenhado dos dados de exemplo (que não têm foto de verdade).

export const BASE_AGUA = "/operacoes/agua";

export const ABAS_AGUA = [
  { chave: "leituras", rotulo: "Leituras do mês", href: BASE_AGUA },
  {
    chave: "hidrometros",
    rotulo: "Hidrômetros",
    href: `${BASE_AGUA}/hidrometros`,
  },
  { chave: "extrato", rotulo: "Extrato", href: `${BASE_AGUA}/extrato` },
  {
    chave: "galeria",
    rotulo: "Galeria de fotos",
    href: `${BASE_AGUA}/galeria`,
  },
] as const;
export type AbaAgua = (typeof ABAS_AGUA)[number]["chave"];

/** Texto do selo de exemplo (sem arquivo real do parceiro ainda). */
export const EXEMPLO_AGUA =
  "leituras da água, até o primeiro arquivo do parceiro";

/** Abas e o botão de importar (para quem importa). */
export function AbasDaAgua({
  ativa,
  podeImportar,
}: {
  ativa: AbaAgua;
  podeImportar: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <AbasDaTela
        rotulo="Visões da água"
        ativa={ativa}
        abas={ABAS_AGUA.map((a) => ({ ...a }))}
      />
      {podeImportar && (
        <Link
          href={`${BASE_AGUA}/importar`}
          data-guia="op-agua-importar-botao"
          className={BOTAO_PRIMARIO}
        >
          <Upload className="size-4" aria-hidden />
          Importar faturamento do mês
        </Link>
      )}
    </div>
  );
}

/** Barra de filtros que lembra os filtros na chave "operacoes.filtros.<tela>". */
export function FiltrosAgua(
  props: Omit<ComponentProps<typeof BarraDeFiltros>, "modulo">,
) {
  return <BarraDeFiltros modulo="operacoes" {...props} />;
}

const TIPO = {
  FATURADO: {
    icone: CircleDollarSign,
    classe: "bg-sky-500/15 text-sky-800",
  },
  MINIMO: { icone: CircleMinus, classe: "bg-cyan-500/15 text-cyan-800" },
  ZERO: { icone: CircleDashed, classe: "bg-neutral-500/15 text-neutral-700" },
  REFATURADO: { icone: RefreshCcw, classe: "bg-violet-500/15 text-violet-800" },
} as const;

/** Tipo de faturamento: cor, ícone e texto. */
export function TipoFaturamento({ tipo }: { tipo: TipoAgua }) {
  const t = TIPO[tipo];
  const Icone = t.icone;
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${t.classe}`}
    >
      <Icone className="size-3" aria-hidden />
      {ROTULO_TIPO[tipo]}
    </span>
  );
}

/** Alertas da leitura: rótulo curto com a explicação na dica. */
export function Alertas({ alertas }: { alertas: Alerta[] }) {
  if (!alertas.length)
    return <span className="text-xs text-neutral-400">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {alertas.map((a) => (
        <span
          key={a.codigo}
          title={a.texto}
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-800"
        >
          <TriangleAlert className="size-3" aria-hidden />
          {ALERTAS[a.codigo].rotulo}
          <span className="sr-only">: {a.texto}</span>
        </span>
      ))}
    </span>
  );
}

/**
 * Visor desenhado com a leitura, no lugar da foto dos dados de exemplo
 * (não há foto de verdade para mostrar).
 */
export function VisorDeExemplo({
  leitura,
  className = "",
}: {
  leitura: number | null;
  className?: string;
}) {
  const texto = formatarVisor(leitura).padStart(8, "0");
  return (
    <svg
      viewBox="0 0 160 100"
      role="img"
      aria-label={`Visor de exemplo: ${formatarVisor(leitura)} m³`}
      className={className}
    >
      <rect width="160" height="100" rx="10" fill="#1f2a2e" />
      <circle
        cx="80"
        cy="50"
        r="44"
        fill="#e8eef0"
        stroke="#9fb3b9"
        strokeWidth="3"
      />
      <rect x="34" y="38" width="92" height="22" rx="3" fill="#111" />
      <text
        x="80"
        y="54"
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
        fontSize="14"
        fill="#f5f5f5"
        letterSpacing="1"
      >
        {texto}
      </text>
      <text x="80" y="76" textAnchor="middle" fontSize="8" fill="#4b5d63">
        m³ · foto de exemplo
      </text>
    </svg>
  );
}
