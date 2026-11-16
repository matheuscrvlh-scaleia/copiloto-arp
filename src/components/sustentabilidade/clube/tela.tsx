import { ArrowLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ComponentProps } from "react";
import { BarraDeFiltros } from "@/components/dashboard/barra-de-filtros";
import { Cartoes, hrefCom } from "@/components/dashboard/tela";
import { formatarNumero } from "@/lib/formato";
import type { SituacaoClube } from "@/lib/sustentabilidade/clube-lista";
import { ROTULO_SITUACAO_CLUBE } from "@/lib/sustentabilidade/clube-lista";
import {
  ROTULO_SITUACAO,
  type SituacaoEntrevista,
} from "@/lib/sustentabilidade/situacao";

// Peças comuns das telas do Clube: barra de filtros e cartões do módulo
// Sustentabilidade, link do cartão que filtra a lista e os selos de situação.

export {
  AbasDaTela,
  CartaoDaTela,
  Fonte,
  hrefCom,
  TopoDaTela,
} from "@/components/dashboard/tela";

/** Barra de filtros; lembra os filtros em "sustentabilidade.filtros.<tela>". */
export function FiltrosSu(
  props: Omit<ComponentProps<typeof BarraDeFiltros>, "modulo">,
) {
  return <BarraDeFiltros modulo="sustentabilidade" {...props} />;
}

/** Linha de até 4 cartões, com o ritmo de cores do módulo. */
export function CartoesSu({ children }: { children: React.ReactNode }) {
  return <Cartoes modulo="sustentabilidade">{children}</Cartoes>;
}

/** Link do cartão: liga o filtro `cartao=<chave>`; clicar de novo desliga. */
export function hrefDoCartao(
  base: string,
  busca: Record<string, string | string[] | undefined>,
  chave: string,
): string {
  const atual = busca.cartao;
  const ligado = (Array.isArray(atual) ? atual[0] : atual) === chave;
  return hrefCom(base, busca, { cartao: ligado ? null : chave });
}

/** Reais "1.234,56" (sem o R$, como nas planilhas); null vira "—". */
export function Reais({ valor }: { valor: number | null }) {
  if (valor === null) return <span className="text-neutral-400">—</span>;
  return (
    <span
      className={`whitespace-nowrap tabular-nums ${valor < 0 ? "text-red-700" : ""}`}
    >
      {formatarNumero(valor, 2)}
    </span>
  );
}

const SELO =
  "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium";

const TOM_SITUACAO: Record<SituacaoClube, string> = {
  ativo: "bg-green-400/20 text-green-800",
  a_vencer: "bg-amber-400/20 text-amber-800",
  vencido: "bg-red-500/10 text-red-700",
  saiu: "bg-neutral-900/[0.07] text-neutral-600",
  interessado: "bg-sky-500/10 text-sky-800",
};

export function SeloDaSituacao({ situacao }: { situacao: SituacaoClube }) {
  return (
    <span className={`${SELO} ${TOM_SITUACAO[situacao]}`}>
      {ROTULO_SITUACAO_CLUBE[situacao]}
    </span>
  );
}

const TOM_ENTREVISTA: Record<SituacaoEntrevista, string> = {
  em_dia: "bg-green-400/20 text-green-800",
  a_vencer: "bg-amber-400/20 text-amber-800",
  vencida: "bg-red-500/10 text-red-700",
  pendente: "bg-red-500/10 text-red-700",
  aguardando: "bg-neutral-900/[0.07] text-neutral-600",
  dispensada: "bg-neutral-900/[0.07] text-neutral-600",
};

export function SeloDaEntrevista({
  situacao,
}: {
  situacao: SituacaoEntrevista | null;
}) {
  if (!situacao) return <span className="text-neutral-400">—</span>;
  return (
    <span className={`${SELO} ${TOM_ENTREVISTA[situacao]}`}>
      {ROTULO_SITUACAO[situacao]}
    </span>
  );
}

/** "Voltar para …" no alto das páginas de detalhe. */
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
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900"
    >
      <ArrowLeft className="size-4" aria-hidden /> {children}
    </Link>
  );
}

/** Atalho em pílula (outra tela do módulo). */
export function Atalho({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
    >
      {children}
      <ArrowUpRight className="size-4" aria-hidden />
    </Link>
  );
}

/** Dados em pares rótulo e valor (resumo do detalhe). */
export function Resumo({
  itens,
}: {
  itens: { rotulo: string; valor: React.ReactNode }[];
}) {
  return (
    <dl
      data-guia="resumo"
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4"
    >
      {itens.map((r) => (
        <div
          key={r.rotulo}
          className="min-w-0 rounded-2xl bg-neutral-900/[0.04] px-4 py-3"
        >
          <dt className="text-[11px] text-neutral-500">{r.rotulo}</dt>
          <dd className="mt-0.5 break-words text-base font-semibold tabular-nums">
            {r.valor}
          </dd>
        </div>
      ))}
    </dl>
  );
}
