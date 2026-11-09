import { ChevronRight, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { SeloStatus } from "@/components/dashboard/indicador";
import { formatarData, formatarMoeda, formatarPct } from "@/lib/formato";
import type { Indicadores } from "@/lib/operacoes/obras";
import { rotuloMes } from "@/lib/operacoes/obras";

// Cartão de uma obra na lista: revisão vigente, orçado, realizado
// acumulado, % executado (barra), ritmo do desembolso contra o previsto até
// o mês (limite de desvio em Parâmetros) e situação do orçamento
// (tolerância de estouro em Parâmetros). Status sempre com cor, ícone e texto.

const reais = (c: number) => formatarMoeda(c / 100);

export function CartaoObra({
  obra,
  indicadores: i,
}: {
  obra: {
    id: string;
    nome: string;
    responsavel: string | null;
    ativa: boolean;
    exemplo: boolean;
    revisao: { codigo: string; data: string | null } | null;
  };
  indicadores: Indicadores;
}) {
  const pct = Math.max(0, Math.min(100, i.pctExecutado ?? 0));
  const previsto =
    i.orcado > 0
      ? Math.max(0, Math.min(100, (i.previstoAteMes / i.orcado) * 100))
      : 0;
  return (
    <Link
      href={`/operacoes/obras/${obra.id}`}
      data-guia="op-obras-cartao"
      className={`vidro group flex flex-col gap-4 rounded-[1.75rem] p-5 outline-none transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-neutral-900/25 ${obra.ativa ? "" : "opacity-75"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">{obra.nome}</h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            {obra.revisao
              ? `Orçamento ${obra.revisao.codigo}${obra.revisao.data ? ` de ${formatarData(obra.revisao.data)}` : ""}`
              : "Sem orçamento confirmado"}
            {obra.responsavel ? ` · ${obra.responsavel}` : ""}
            {obra.ativa ? "" : " · Encerrada"}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1">
          {obra.exemplo && (
            <span
              title="Dados de exemplo (fictícios)"
              className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-medium text-amber-800"
            >
              <TriangleAlert className="size-3" aria-hidden />
              Exemplo
            </span>
          )}
          <ChevronRight
            className="size-4 text-neutral-400 transition group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-neutral-500">Orçado</dt>
          <dd className="font-semibold tabular-nums">{reais(i.orcado)}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Realizado acumulado</dt>
          <dd className="font-semibold tabular-nums">{reais(i.realizado)}</dd>
        </div>
      </dl>

      <div>
        <div className="flex items-baseline justify-between text-xs text-neutral-500">
          <span>Executado</span>
          <span className="font-medium text-neutral-900 tabular-nums">
            {formatarPct(i.pctExecutado)}
          </span>
        </div>
        <div
          className="relative mt-1.5 h-2 rounded-full bg-neutral-900/[0.08]"
          role="img"
          aria-label={`Executado ${formatarPct(i.pctExecutado)} do orçado; previsto até ${rotuloMes(i.mesRef)}: ${formatarPct(i.orcado > 0 ? previsto : null)}`}
        >
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-[var(--serie-1)]"
            style={{ width: `${pct}%` }}
          />
          {i.orcado > 0 && (
            <span
              className="absolute -top-1 -bottom-1 w-0.5 rounded bg-neutral-900/60"
              style={{ left: `calc(${previsto}% - 1px)` }}
              title={`Previsto até ${rotuloMes(i.mesRef)}`}
            />
          )}
        </div>
        <p className="mt-1 text-[11px] text-neutral-500">
          Marca: previsto até {rotuloMes(i.mesRef)} ({reais(i.previstoAteMes)})
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span title={i.ritmo.detalhe}>
          <SeloStatus status={i.ritmo.status} rotulo={i.ritmo.rotulo} />
        </span>
        <span title={i.orcamento.detalhe}>
          <SeloStatus status={i.orcamento.status} rotulo={i.orcamento.rotulo} />
        </span>
      </div>
    </Link>
  );
}
