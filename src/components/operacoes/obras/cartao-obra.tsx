import { ChevronRight, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { SeloStatus } from "@/components/dashboard/indicador";
import {
  BASE,
  dias,
  Negativo,
  pct,
  pontos,
  SeloObra,
  SeloRelatorio,
} from "@/components/operacoes/diario/comum";
import { FotoDaObra, hrefDaObra } from "@/components/operacoes/diario/painel";
import {
  formatarData,
  formatarMoeda,
  formatarNumero,
  formatarPct,
} from "@/lib/formato";
import { type LinhaDoPainel, OBRA_CONCLUIDA } from "@/lib/operacoes/diario";
import type { Indicadores } from "@/lib/operacoes/obras";
import { rotuloMes } from "@/lib/operacoes/obras";

// Cartão de uma obra na tela de Obras, com as duas fontes lado a lado:
// - Execução (aplicativo Diário de Obra): status, avanço físico contra o
//   prazo consumido, prazos, relatórios e dias sem relatório;
// - Orçamento (planilha importada): orçado, realizado acumulado, % executado
//   contra o previsto até o mês, ritmo e situação do orçamento.
// As duas partes se juntam pelo vínculo "obra do Diário" em Dados da obra.
// Status sempre com cor, ícone e texto.

const reais = (c: number) => formatarMoeda(c / 100);
const limitar = (v: number | null) => Math.max(0, Math.min(100, v ?? 0));

export interface OrcamentoDaObra {
  id: string;
  responsavel: string | null;
  ativa: boolean;
  exemplo: boolean;
  revisao: { codigo: string; data: string | null } | null;
  indicadores: Indicadores;
}

export interface ObraDaTela {
  chave: string;
  nome: string;
  /** Obra do orçamento (null: só existe no Diário de Obra). */
  orc: OrcamentoDaObra | null;
  /** Obra do Diário de Obra (null: sem vínculo com o aplicativo). */
  exec: LinhaDoPainel | null;
}

export const hrefDaObraDaTela = (o: ObraDaTela) =>
  o.orc
    ? `/operacoes/obras/${o.orc.id}`
    : o.exec
      ? hrefDaObra(o.exec.obra.id)
      : "/operacoes/obras";

export function CartaoObra({
  obra,
  verOrcamento,
  verExecucao,
  importa,
}: {
  obra: ObraDaTela;
  /** Permissão de ver o orçamento (operacoes.obras.ver). */
  verOrcamento: boolean;
  /** Permissão de ver o Diário de Obra (operacoes.obras.diario). */
  verExecucao: boolean;
  /** Permissão de importar orçamento e ligar a obra ao Diário. */
  importa: boolean;
}) {
  const { orc, exec } = obra;
  const encerrada = orc ? !orc.ativa : exec?.obra.statusId === OBRA_CONCLUIDA;
  const subtitulo = [
    exec?.obra.grupo,
    exec?.obra.responsavel ?? orc?.responsavel,
    orc && !orc.ativa ? "Encerrada" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <article
      data-guia="op-obras-cartao"
      className={`vidro flex flex-col gap-4 rounded-[1.75rem] p-5 ${encerrada ? "opacity-75" : ""}`}
    >
      <header className="flex items-start justify-between gap-3">
        <Link
          href={hrefDaObraDaTela(obra)}
          className="group flex min-w-0 items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/25"
        >
          <FotoDaObra
            url={exec?.obra.ficha?.fotoUrl ?? null}
            nome={obra.nome}
          />
          <span className="min-w-0">
            <span className="flex items-center gap-1 text-base font-semibold underline-offset-4 group-hover:underline">
              <span className="truncate">{obra.nome}</span>
              <ChevronRight
                className="size-4 shrink-0 text-neutral-400 transition group-hover:translate-x-0.5"
                aria-hidden
              />
            </span>
            <span className="block truncate text-xs text-neutral-500">
              {subtitulo || "—"}
            </span>
          </span>
        </Link>
        <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          {orc?.exemplo && (
            <span
              title="Dados de exemplo (fictícios)"
              className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-medium text-amber-800"
            >
              <TriangleAlert className="size-3" aria-hidden />
              Exemplo
            </span>
          )}
          {exec && <SeloObra id={exec.obra.statusId} />}
        </span>
      </header>

      <div
        className={`grid gap-3 ${verOrcamento && verExecucao ? "lg:grid-cols-2" : ""}`}
      >
        {verExecucao && (
          <Bloco
            titulo="Execução"
            fonte="Diário de Obra"
            href={exec ? hrefDaObra(exec.obra.id) : undefined}
          >
            {exec ? (
              <Execucao l={exec} />
            ) : (
              <Vazio>
                Sem obra do Diário de Obra ligada.{" "}
                {orc && importa
                  ? "Ligue na obra, em Dados da obra."
                  : "Quem importa o orçamento liga a obra ao aplicativo."}
              </Vazio>
            )}
          </Bloco>
        )}
        {verOrcamento && (
          <Bloco
            titulo="Orçamento"
            fonte={
              orc?.revisao
                ? `Revisão ${orc.revisao.codigo}${orc.revisao.data ? ` de ${formatarData(orc.revisao.data)}` : ""}`
                : "Planilha de orçamento"
            }
            href={orc ? `/operacoes/obras/${orc.id}` : undefined}
          >
            {orc ? (
              <Orcamento i={orc.indicadores} />
            ) : (
              <Vazio>
                Sem orçamento importado. A obra entra no orçamento com a
                planilha, em{" "}
                <Link
                  href="/operacoes/importacoes"
                  className="font-medium underline underline-offset-4"
                >
                  Operações › Importações
                </Link>
                .
              </Vazio>
            )}
          </Bloco>
        )}
      </div>
    </article>
  );
}

function Bloco({
  titulo,
  fonte,
  href,
  children,
}: {
  titulo: string;
  fonte: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-neutral-900/[0.035] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-sm font-semibold">
          {titulo}{" "}
          <span className="text-xs font-normal text-neutral-500">
            · {fonte}
          </span>
        </h4>
        {href && (
          <Link
            href={href}
            className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-neutral-600 underline-offset-4 hover:text-neutral-900 hover:underline"
          >
            Abrir
            <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Vazio({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-neutral-500">{children}</p>;
}

/** Barra de 0–100% com uma marca de referência (número sempre escrito). */
function BarraComMarca({
  valor,
  marca,
  rotulo,
  tituloMarca,
}: {
  valor: number | null;
  marca: number | null;
  rotulo: string;
  tituloMarca: string;
}) {
  return (
    <div
      className="relative h-2 rounded-full bg-neutral-900/[0.08]"
      role="img"
      aria-label={rotulo}
    >
      <span
        className="absolute inset-y-0 left-0 rounded-full bg-[var(--serie-1)]"
        style={{ width: `${limitar(valor)}%` }}
      />
      {marca !== null && (
        <span
          className="absolute -top-1 -bottom-1 w-0.5 rounded bg-neutral-900/60"
          style={{ left: `calc(${limitar(marca)}% - 1px)` }}
          title={tituloMarca}
        />
      )}
    </div>
  );
}

function Campo({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-neutral-500">{rotulo}</dt>
      <dd className="text-sm font-medium tabular-nums">{children}</dd>
    </div>
  );
}

function Execucao({ l }: { l: LinhaDoPainel }) {
  const { obra } = l;
  const ficha = obra.ficha;
  const fotos = ficha?.visaoGeral?.total?.fotos;
  return (
    <>
      <div>
        <div className="flex items-baseline justify-between text-xs text-neutral-500">
          <span>Avanço físico</span>
          <span className="font-medium text-neutral-900 tabular-nums">
            {pct(obra.realizado)}
          </span>
        </div>
        <div className="mt-1.5">
          <BarraComMarca
            valor={obra.realizado}
            marca={l.consumido}
            rotulo={`Avanço físico ${pct(obra.realizado)}; prazo consumido ${pct(l.consumido)}`}
            tituloMarca="Prazo consumido"
          />
        </div>
        <p className="mt-1 text-[11px] text-neutral-500">
          Marca: prazo consumido ({pct(l.consumido)}) · desvio{" "}
          <Negativo valor={l.desvio} texto={pontos(l.desvio)} />
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Campo rotulo="Início · fim">
          {formatarData(obra.dataInicio)} · {formatarData(obra.dataFim)}
        </Campo>
        <Campo rotulo="Prazo · decorrido">
          {dias(obra.prazo.contratual)} · {dias(obra.prazo.decorrido)}
        </Campo>
        <Campo rotulo="A vencer">
          <span className={l.vencido ? "text-red-700" : ""}>
            {dias(obra.prazo.aVencer)}
            {l.vencido ? " (vencido)" : ""}
          </span>
        </Campo>
        <Campo rotulo="Cliente · contrato">
          <span className="block truncate font-normal">
            {ficha?.cliente ?? "—"}
            {ficha?.numeroContrato ? ` · ${ficha.numeroContrato}` : ""}
          </span>
        </Campo>
        <Campo rotulo="Relatórios · fotos">
          {formatarNumero(l.relatorios)}
          {l.aAprovar > 0 ? ` (${formatarNumero(l.aAprovar)} a aprovar)` : ""}
          {" · "}
          {fotos === null || fotos === undefined ? "—" : formatarNumero(fotos)}
        </Campo>
        <Campo rotulo="Dias sem relatório">
          {l.semRelatorio.length > 0 ? (
            <span className="inline-flex items-center gap-1 text-amber-900">
              <TriangleAlert className="size-3.5" aria-hidden />
              {formatarNumero(l.semRelatorio.length)}
            </span>
          ) : (
            "0"
          )}
        </Campo>
      </dl>
      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
        Último relatório:
        {l.ultimo ? (
          <Link
            href={`${BASE}/relatorios/${encodeURIComponent(l.ultimo.id)}`}
            className="inline-flex items-center gap-2 text-neutral-800 underline-offset-4 hover:underline"
          >
            <span className="tabular-nums">
              {formatarData(l.ultimo.data)} · nº {l.ultimo.numero}
            </span>
            <SeloRelatorio id={l.ultimo.statusId} />
          </Link>
        ) : (
          <span className="text-neutral-400">nenhum</span>
        )}
      </div>
    </>
  );
}

function Orcamento({ i }: { i: Indicadores }) {
  const previsto = i.orcado > 0 ? (i.previstoAteMes / i.orcado) * 100 : null;
  return (
    <>
      <div>
        <div className="flex items-baseline justify-between text-xs text-neutral-500">
          <span>Executado do orçado</span>
          <span className="font-medium text-neutral-900 tabular-nums">
            {formatarPct(i.pctExecutado)}
          </span>
        </div>
        <div className="mt-1.5">
          <BarraComMarca
            valor={i.pctExecutado}
            marca={previsto}
            rotulo={`Executado ${formatarPct(i.pctExecutado)} do orçado; previsto até ${rotuloMes(i.mesRef)}: ${formatarPct(previsto)}`}
            tituloMarca={`Previsto até ${rotuloMes(i.mesRef)}`}
          />
        </div>
        <p className="mt-1 text-[11px] text-neutral-500">
          Marca: previsto até {rotuloMes(i.mesRef)} ({reais(i.previstoAteMes)})
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Campo rotulo="Orçado">{reais(i.orcado)}</Campo>
        <Campo rotulo="Realizado acumulado">{reais(i.realizado)}</Campo>
        <Campo rotulo="Saldo">{reais(i.saldo)}</Campo>
      </dl>
      <div className="flex flex-wrap gap-1.5">
        <span title={i.ritmo.detalhe}>
          <SeloStatus status={i.ritmo.status} rotulo={i.ritmo.rotulo} />
        </span>
        <span title={i.orcamento.detalhe}>
          <SeloStatus status={i.orcamento.status} rotulo={i.orcamento.rotulo} />
        </span>
      </div>
    </>
  );
}
