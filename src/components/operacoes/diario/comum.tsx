import {
  ArrowLeft,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CirclePause,
  CirclePlay,
  type LucideIcon,
  PencilLine,
  PlugZap,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { TopoDaTela } from "@/components/dashboard/tela";
import { FormAcao } from "@/components/form-acao";
import { dadosDe } from "@/lib/comercial/formato";
import { formatarData, formatarNumero, formatarPct } from "@/lib/formato";
import {
  STATUS_OBRA,
  STATUS_RELATORIO,
  STATUS_TAREFA,
  statusDe,
  type TomStatus,
} from "@/lib/operacoes/diario";
import { atualizarDiarioAgora } from "@/server/operacoes/acoes/diario";
import type { EstadoDiario } from "@/server/operacoes/diario";

// Peças comuns das telas do Diário de Obra: selos de status (cor, ícone e
// texto), topo com "Dados do Diário de Obra de…" e o botão Atualizar agora,
// avisos de falha e de token não configurado, e os formatos dos números.

/** Tela única das obras (orçamento e execução). */
export const OBRAS = "/operacoes/obras";
export const BASE = `${OBRAS}/diario`;
export const INTEGRACOES = "/admin/integracoes";
export const FONTE = "Diário de Obra (aplicativo)";

// ---------------------------------------------------------------------------
// Formatos
// ---------------------------------------------------------------------------

export const pct = (v: number | null) => formatarPct(v, 1);
export const dias = (v: number | null) =>
  v === null ? "—" : `${formatarNumero(v)} d`;
/** Pontos percentuais, com sinal. */
export const pontos = (v: number | null) =>
  v === null ? "—" : `${v > 0 ? "+" : ""}${formatarNumero(v, 1)} p.p.`;
/** "aaaa-mm-ddThh:mm:ss" (horário local do aplicativo) → "dd/mm/aaaa hh:mm". */
export function dataHoraDoApp(v: string | null | undefined): string {
  if (!v) return "—";
  return `${formatarData(v.slice(0, 10))} ${v.slice(11, 16)}`.trim();
}
/** Instante (timestamptz) → "dd/mm/aaaa às hh:mm" em Brasília. */
export const quando = (iso: string) => dadosDe(iso).replace("Dados de ", "");

/** Número negativo em vermelho (spec 4.3). */
export function Negativo({
  valor,
  texto,
}: {
  valor: number | null;
  texto: string;
}) {
  return (
    <span className={valor !== null && valor < 0 ? "text-red-700" : ""}>
      {texto}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Selos
// ---------------------------------------------------------------------------

const PILULA =
  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium";

const COR: Record<TomStatus, string> = {
  neutro: "bg-neutral-900/[0.06] text-neutral-700",
  info: "bg-violet-100 text-violet-700",
  alerta: "bg-amber-50 text-amber-900",
  ok: "bg-green-50 text-green-800",
  perigo: "bg-red-50 text-red-700",
};

function Selo({
  rotulo,
  tom,
  icone: Icone,
}: {
  rotulo: string;
  tom: TomStatus;
  icone: LucideIcon;
}) {
  return (
    <span className={`${PILULA} ${COR[tom]}`}>
      <Icone className="size-3.5" aria-hidden />
      {rotulo}
    </span>
  );
}

const ICONE_OBRA: Record<number, LucideIcon> = {
  1: CircleDashed,
  2: CirclePause,
  3: CirclePlay,
  4: CircleCheck,
};
const ICONE_RELATORIO: Record<number, LucideIcon> = {
  1: PencilLine,
  3: CircleAlert,
  4: CircleCheck,
};
const ICONE_TAREFA: Record<number, LucideIcon> = {
  1: CircleDashed,
  2: CirclePlay,
  3: CircleCheck,
};

export function SeloObra({ id }: { id: number }) {
  return (
    <Selo
      {...statusDe(STATUS_OBRA, id)}
      icone={ICONE_OBRA[id] ?? CircleDashed}
    />
  );
}

export function SeloRelatorio({ id }: { id: number }) {
  return (
    <Selo
      {...statusDe(STATUS_RELATORIO, id)}
      icone={ICONE_RELATORIO[id] ?? CircleDashed}
    />
  );
}

export function SeloTarefa({ id }: { id: number | null }) {
  if (id === null) return <span className="text-neutral-400">—</span>;
  return (
    <Selo
      {...statusDe(STATUS_TAREFA, id)}
      icone={ICONE_TAREFA[id] ?? CircleDashed}
    />
  );
}

/** Condição do clima: "Impraticável" em vermelho, com ícone. */
export function Condicao({ texto }: { texto: string | null | undefined }) {
  if (!texto) return <span className="text-neutral-400">—</span>;
  const ruim = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .startsWith("impratic");
  return ruim ? (
    <span className="inline-flex items-center gap-1 font-medium text-red-700">
      <TriangleAlert className="size-3.5" aria-hidden />
      {texto}
    </span>
  ) : (
    <span>{texto}</span>
  );
}

/** Barrinha de percentual (o número sempre escrito ao lado). */
export function Barra({ valor }: { valor: number | null }) {
  const v = Math.min(Math.max(valor ?? 0, 0), 100);
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className="inline-block h-1.5 w-16 overflow-hidden rounded-full bg-neutral-900/10"
      >
        <span
          className={`block h-full rounded-full ${v >= 100 ? "bg-green-600" : "bg-marca"}`}
          style={{ width: `${v}%` }}
        />
      </span>
      <span className="tabular-nums">{pct(valor)}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Estrutura
// ---------------------------------------------------------------------------

export function Voltar({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900"
    >
      <ArrowLeft className="size-4" aria-hidden /> {children}
    </Link>
  );
}

/** Pares rótulo e valor (cabeçalho da obra, do relatório e da tarefa). */
export function Campos({
  itens,
}: {
  itens: { rotulo: string; valor: React.ReactNode }[];
}) {
  return (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {itens.map((r) => (
        <div
          key={r.rotulo}
          className="min-w-0 rounded-2xl bg-neutral-900/[0.04] px-4 py-3"
        >
          <dt className="text-[11px] text-neutral-500">{r.rotulo}</dt>
          <dd className="mt-0.5 break-words text-sm font-medium">
            {r.valor ?? "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Nota em letra pequena, abaixo de uma lista. */
export function Rodape({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 text-[11px] leading-snug text-neutral-400">{children}</p>
  );
}

// ---------------------------------------------------------------------------
// Topo, avisos e "sem token"
// ---------------------------------------------------------------------------

/**
 * Topo das telas: "Dados do Diário de Obra de dd/mm/aaaa às hh:mm" (última
 * consulta que deu certo), aviso de falha ou de consulta em andamento, selo
 * de dados de exemplo, exportar e o botão Atualizar agora.
 */
export function TopoDiario({
  estado,
  filtros,
  exportar,
  podeAtualizar,
  outroExemplo,
}: {
  estado: EstadoDiario;
  filtros?: string;
  exportar?: React.ReactNode;
  podeAtualizar: boolean;
  /** Outra fonte da tela ainda de exemplo (ex.: o orçamento das obras). */
  outroExemplo?: string;
}) {
  const dadosDoApp = estado.ultima
    ? `Dados do Diário de Obra de ${quando(estado.ultima.em)}`
    : estado.exemplo
      ? undefined
      : "Ainda sem consulta ao aplicativo";
  const aviso = estado.rodando
    ? `Consulta em andamento desde ${quando(estado.rodando)}`
    : estado.falha
      ? "A última consulta falhou: mostrando a cópia anterior"
      : estado.ultima?.pendente
        ? "Parte dos relatórios ainda está chegando (continua na próxima consulta)"
        : undefined;
  const atualizar = podeAtualizar && estado.configurado && (
    <div data-guia="op-diario-atualizar">
      <FormAcao
        acao={atualizarDiarioAgora}
        rotulo="Atualizar agora"
        rotuloEnviando="Iniciando…"
        variante="secundario"
      />
    </div>
  );
  return (
    <TopoDaTela
      dadosDe={dadosDoApp}
      filtros={filtros}
      aviso={aviso}
      exemplo={
        [
          estado.exemplo
            ? "Diário de Obra (obras e relatórios fictícios até a primeira consulta)"
            : null,
          outroExemplo,
        ]
          .filter(Boolean)
          .join(" · ") || undefined
      }
      acoes={
        exportar || atualizar ? (
          <>
            {exportar}
            {atualizar}
          </>
        ) : undefined
      }
    />
  );
}

/**
 * Avisos do topo: token não configurado (com o link para configurar) e
 * falha da última consulta (com o motivo). As telas continuam mostrando a
 * última cópia guardada.
 */
export function AvisosDoDiario({ estado }: { estado: EstadoDiario }) {
  if (!estado.configurado)
    return (
      <div
        role="note"
        className="flex items-start gap-3 rounded-3xl bg-amber-50 px-5 py-4 text-sm text-amber-900"
      >
        <PlugZap className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          {estado.desativado
            ? "A integração com o Diário de Obra está desativada. "
            : "A consulta ao aplicativo depende de configurar o Diário de Obra (token da API) em "}
          <Link
            href={INTEGRACOES}
            className="font-medium underline underline-offset-4"
          >
            Administração › Integrações
          </Link>
          {estado.desativado ? " (reative para voltar a consultar)." : "."}
          {estado.exemplo &&
            " Até lá, as telas mostram obras e relatórios fictícios."}
        </p>
      </div>
    );
  if (estado.falha)
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-3xl bg-red-50 px-5 py-4 text-sm text-red-700"
      >
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          A consulta de {quando(estado.falha.em)} ao aplicativo falhou
          {estado.falha.erro ? ` (${estado.falha.erro.slice(0, 200)})` : ""}.{" "}
          {estado.ultima
            ? `As telas mostram a cópia de ${quando(estado.ultima.em)}.`
            : "Ainda não há cópia guardada."}{" "}
          Se o token mudou, atualize em{" "}
          <Link
            href={INTEGRACOES}
            className="font-medium underline underline-offset-4"
          >
            Administração › Integrações
          </Link>
          .
        </p>
      </div>
    );
  return null;
}

/** Tela sem nada guardado: diz do que depende. */
export function SemDados({ estado }: { estado: EstadoDiario }) {
  return (
    <div className="vidro rounded-[1.75rem] px-6 py-10 text-center text-sm text-neutral-600">
      {estado.configurado ? (
        <p>
          Nenhuma obra guardada ainda.{" "}
          {estado.rodando
            ? "A primeira consulta ao aplicativo está em andamento."
            : "Use Atualizar agora ou espere a próxima consulta automática."}
        </p>
      ) : (
        <p>
          Nenhuma obra para mostrar. As telas do Diário de Obra dependem de
          configurar o token da API do aplicativo em{" "}
          <Link
            href={INTEGRACOES}
            className="font-medium text-neutral-900 underline underline-offset-4"
          >
            Administração › Integrações
          </Link>
          .
        </p>
      )}
    </div>
  );
}
