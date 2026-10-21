import { Maximize2 } from "lucide-react";
import { TOM, type Tom } from "@/components/estilos";
import { type Direcao, rotuloStatus, type Status } from "@/lib/indicadores";
import { AbreDetalhe, type Detalhe } from "../modal-detalhe";
import { type ItemGrafico, MiniArea } from "./graficos";

// Cores de status reservadas (nunca usadas para série); sempre com ícone e texto.
const STATUS: Record<Status, { cor: string; icone: string }> = {
  ok: { cor: "#0ca30c", icone: "✓" },
  atencao: { cor: "#fab219", icone: "!" },
  fora: { cor: "#d03b3b", icone: "✕" },
  sem_meta: { cor: "#a3a3a3", icone: "–" },
  sem_dado: { cor: "#a3a3a3", icone: "–" },
};

export function SeloStatus({
  status,
  direcao,
  rotulo,
}: {
  status: Status;
  direcao?: Direcao;
  /** Texto no lugar do rótulo padrão do semáforo (ex.: "Bate" numa conferência). */
  rotulo?: string;
}) {
  const { cor, icone } = STATUS[status];
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-neutral-900/[0.06] py-1 pr-2.5 pl-1 text-xs font-medium text-neutral-700">
      <span
        aria-hidden
        className="grid size-4 place-items-center rounded-full text-[10px] font-bold text-[#fff]"
        style={{ backgroundColor: cor }}
      >
        {icone}
      </span>
      {rotulo ?? rotuloStatus(status, direcao)}
    </span>
  );
}

export interface Variacao {
  texto: string;
  /** Se a mudança é boa, ruim ou neutra (define a cor do texto). */
  sentido: "bom" | "ruim" | "neutro";
}

export function CartaoIndicador({
  titulo,
  valor,
  detalhe,
  status,
  direcao,
  meta,
  variacao,
  serie,
  origem,
  tom = "claro",
  children,
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
  status?: Status;
  direcao?: Direcao;
  meta?: string;
  variacao?: Variacao;
  /** Tendência dos últimos meses, desenhada no pé do cartão. */
  serie?: ItemGrafico[];
  /** De onde vem o número e quem o forma (abre o modal ao clicar). */
  origem?: Detalhe;
  /** Vidro claro (padrão), preto ou verde. */
  tom?: Tom;
  children?: React.ReactNode;
}) {
  return (
    <ComDetalhe origem={origem}>
      <div
        className={`${TOM[tom]} flutua flex h-full flex-col gap-3 rounded-[1.75rem] p-5`}
      >
        <Titulo texto={titulo} clicavel={!!origem} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-3xl font-semibold tracking-tight">{valor}</p>
          {status && <SeloStatus status={status} direcao={direcao} />}
        </div>
        <div className="flex flex-col gap-1 text-xs text-neutral-500">
          {variacao && (
            <span
              className={
                variacao.sentido === "bom"
                  ? "text-green-700"
                  : variacao.sentido === "ruim"
                    ? "text-red-700"
                    : "text-neutral-500"
              }
            >
              {variacao.texto}
            </span>
          )}
          {detalhe && <span>{detalhe}</span>}
          {meta && <span>{meta}</span>}
        </div>
        {serie && serie.length > 1 && (
          <div className="mt-auto pt-1">
            <MiniArea itens={serie} descricao={`${titulo} nos últimos meses`} />
          </div>
        )}
        {children}
      </div>
    </ComDetalhe>
  );
}

/** Indicador que ainda depende de outra fonte de dados. */
export function CartaoPendente({
  titulo,
  motivo,
  meta,
  origem,
}: {
  titulo: string;
  motivo: string;
  meta?: string;
  /** O que falta e de onde o número vai vir (abre o modal ao clicar). */
  origem?: Detalhe;
}) {
  return (
    <ComDetalhe origem={origem}>
      <div className="flex h-full flex-col gap-3 rounded-[1.75rem] border border-dashed border-neutral-900/15 bg-white/25 p-5 backdrop-blur-xl">
        <Titulo texto={titulo} clicavel={!!origem} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-3xl font-semibold tracking-tight text-neutral-300">
            —
          </p>
          <span className="whitespace-nowrap rounded-full bg-neutral-900/[0.06] px-2.5 py-1 text-xs font-medium text-neutral-500">
            Pendente
          </span>
        </div>
        <div className="flex flex-col gap-1 text-xs text-neutral-500">
          <span>{motivo}</span>
          {meta && <span>{meta}</span>}
        </div>
      </div>
    </ComDetalhe>
  );
}

/** Cartão que abre o modal; sem detalhe (ou sem permissão), cartão comum. */
function ComDetalhe({
  origem,
  children,
}: {
  origem?: Detalhe;
  children: React.ReactNode;
}) {
  if (!origem) return children;
  return (
    <AbreDetalhe detalhe={origem} className="flex rounded-[1.75rem] *:flex-1">
      {children}
    </AbreDetalhe>
  );
}

function Titulo({ texto, clicavel }: { texto: string; clicavel: boolean }) {
  return (
    <p className="flex items-start justify-between gap-2 text-sm font-medium text-neutral-600">
      {texto}
      {clicavel && (
        <span
          title="Ver de onde vêm os dados"
          className="grid size-6 shrink-0 place-items-center rounded-full bg-neutral-900/[0.05] text-neutral-500 transition group-hover/detalhe:bg-neutral-900 group-hover/detalhe:text-white"
        >
          <Maximize2 className="size-3" aria-hidden />
          <span className="sr-only">Ver de onde vêm os dados</span>
        </span>
      )}
    </p>
  );
}
