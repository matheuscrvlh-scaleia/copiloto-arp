import { ArrowLeft, ClipboardList, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { Linhas } from "@/components/dashboard/graficos/linhas";
import { SeloStatus } from "@/components/dashboard/indicador";
import { Secao } from "@/components/dashboard/tabela";
import {
  AbasDaTela,
  CartaoDaTela,
  Cartoes,
  Fonte,
  hrefCom,
  TopoDaTela,
} from "@/components/dashboard/tela";
import { BotaoImportarOrcamento } from "@/components/operacoes/obras/botao-importar";
import { EditarObra } from "@/components/operacoes/obras/editar-obra";
import { FiltrosDaObra } from "@/components/operacoes/obras/filtros";
import { Lancamentos } from "@/components/operacoes/obras/lancamentos";
import {
  exportarComparacao,
  exportarMensal,
  exportarPorEtapa,
  gradeMensal,
  ListaDeRevisoes,
  TabelaComparacao,
  TabelaMensal,
  TabelaPorEtapa,
} from "@/components/operacoes/obras/tabelas";
import { BotaoExportar } from "@/components/os/exportar";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import {
  formatarData,
  formatarDataHora,
  formatarMoeda,
  formatarNumero,
  formatarPct,
} from "@/lib/formato";
import { linhaDeFiltros } from "@/lib/marketing/periodo";
import {
  compararRevisoes,
  curvaS,
  indicadoresDaObra,
  linhasPorEtapa,
  type Mes,
  mesDoDia,
  mesesEntre,
  rotuloMes,
  rotuloMesLongo,
} from "@/lib/operacoes/obras";
import type { CelulaExportar, ColunaExportar } from "@/lib/os/exportar";
import { contextoOp } from "@/server/operacoes/base";
import { dadosDaObra, obrasDoDiario } from "@/server/operacoes/obras";

export const metadata: Metadata = { title: "Obra · previsto e realizado" };

const FONTE = "Planilha de orçamento e realizado lançado";
const ABAS = {
  resumo: "Previsto × realizado",
  mensal: "Mês a mês",
  revisoes: "Revisões",
  lancamentos: "Realizado lançado",
} as const;
type Aba = keyof typeof ABAS;
type Busca = Record<string, string | string[] | undefined>;

export default function Page({
  params,
  searchParams,
}: PageProps<"/operacoes/obras/[id]">) {
  return (
    <Suspense fallback={<Esqueleto />}>
      <Protegido permissao="operacoes.obras.ver">
        <Tela params={params} busca={searchParams} />
      </Protegido>
    </Suspense>
  );
}

const mesDaUrl = (v: string): Mes | null =>
  /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? `${v}-01` : null;

async function Tela({
  params,
  busca: buscaP,
}: {
  params: Promise<{ id: string }>;
  busca: Promise<Busca>;
}) {
  const [{ id }, busca, ctx] = await Promise.all([
    params,
    buscaP,
    contextoOp(),
  ]);
  if (!z.uuid().safeParse(id).success) notFound();
  const importa = ctx.pode("operacoes.obras.importar");
  const [d, doDiario] = await Promise.all([
    dadosDaObra(id),
    importa ? obrasDoDiario() : Promise.resolve([]),
  ]);
  if (!d) notFound();
  const um = (k: string) => {
    const v = busca[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };

  // Revisão mostrada: a escolhida no filtro, senão a vigente.
  const confirmadas = d.revisoes.filter((r) => r.status !== "previa");
  const vigente = confirmadas.find((r) => r.vigente) ?? confirmadas[0] ?? null;
  const rev = confirmadas.find((r) => r.codigo === um("rev")) ?? vigente;
  const previa = d.revisoes.find((r) => r.status === "previa");
  const etapasDe = (revisaoId: string | undefined) =>
    d.etapas.filter((e) => e.revisaoId === revisaoId);
  const etapas = etapasDe(rev?.id);
  const previsto = etapas.flatMap((e) => e.previsto);
  const lancados = d.lancamentos;

  // Período: limita a curva, a grade e a lista; o mês de referência dos
  // cartões é o "até" (nunca depois do mês atual).
  const mesAtual = mesDoDia(ctx.hoje);
  const todos = [...previsto, ...lancados].map((v) => v.mes).sort();
  const primeiro = todos[0] ?? mesAtual;
  const ultimo = todos.at(-1) ?? mesAtual;
  let de = mesDaUrl(um("de"));
  let ate = mesDaUrl(um("ate"));
  if (de && ate && de > ate) [de, ate] = [ate, de];
  const mesRef = ate && ate < mesAtual ? ate : mesAtual;
  const i = indicadoresDaObra({
    orcado: rev?.total ?? 0,
    previsto,
    realizado: lancados,
    mesRef,
    limites: d.limites,
  });
  const curva = curvaS(previsto, lancados, { atual: mesAtual, de, ate });
  const meses = mesesEntre(de ?? primeiro, ate ?? ultimo);
  const noPeriodo = (m: Mes) => (!de || m >= de) && (!ate || m <= ate);
  const lancadosNoPeriodo = lancados.filter((l) => noPeriodo(l.mes));
  const porEtapa = linhasPorEtapa(
    etapas,
    lancados.filter((l) => l.mes <= mesRef),
    mesRef,
    d.limites,
  );
  const grade = gradeMensal(etapas, lancadosNoPeriodo);

  // Comparação: a revisão escolhida contra outra (padrão: a anterior).
  const outras = confirmadas.filter((r) => r.codigo !== rev?.codigo);
  const anterior =
    outras.find((r) => r.codigo === um("cmp")) ??
    outras.find((r) => rev && r.codigo < rev.codigo) ??
    outras[0] ??
    null;
  // A mais velha à esquerda ("antes"), a mais nova à direita ("depois").
  const [revA, revB] =
    rev && anterior
      ? anterior.codigo < rev.codigo
        ? [anterior, rev]
        : [rev, anterior]
      : [null, null];
  const comparacao =
    revA && revB ? compararRevisoes(etapasDe(revA.id), etapasDe(revB.id)) : [];

  const aba: Aba = um("aba") in ABAS ? (um("aba") as Aba) : "resumo";
  const base = `/operacoes/obras/${d.obra.id}`;
  const reais = (c: number) => formatarMoeda(c / 100);
  const ultimoLancado = lancados
    .map((l) => l.mes)
    .sort()
    .at(-1);
  const filtros = linhaDeFiltros([
    { rotulo: "Obra", valor: d.obra.nome },
    {
      rotulo: "Revisão",
      valor: rev
        ? `${rev.codigo}${rev.data ? ` de ${formatarData(rev.data)}` : ""}${rev.vigente ? " (vigente)" : ""}`
        : "—",
    },
    {
      rotulo: "Período",
      valor:
        de || ate
          ? `${rotuloMesLongo(de ?? primeiro)} a ${rotuloMesLongo(ate ?? ultimo)}`
          : "Toda a obra",
    },
  ]);
  const exemplo = d.obra.exemplo
    ? "obra, orçamento e realizado, até a planilha real ser importada"
    : undefined;
  const avisos = (rev?.avisos ?? []).filter((a) => a.nivel !== "info");

  const exportar = (() => {
    if (aba === "mensal") return exportarMensal(grade, meses);
    if (aba === "revisoes" && revA && revB)
      return exportarComparacao(comparacao, revA.codigo, revB.codigo);
    if (aba === "lancamentos") {
      const colunas: ColunaExportar[] = [
        { titulo: "Mês" },
        { titulo: "Etapa" },
        { titulo: "Valor (R$)", numero: true },
        { titulo: "Descrição" },
        { titulo: "Origem" },
        { titulo: "Lançado por" },
        { titulo: "Lançado em" },
      ];
      return {
        colunas,
        linhas: lancadosNoPeriodo.map((l): CelulaExportar[] => [
          rotuloMesLongo(l.mes),
          l.etapa,
          l.centavos / 100,
          l.descricao,
          l.origem === "planilha" ? "Planilha" : "Tela",
          l.lancadoPor,
          formatarDataHora(l.lancadoEm),
        ]),
      };
    }
    return exportarPorEtapa(porEtapa, mesRef);
  })();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/operacoes/obras"
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Obras
        </Link>
        <PageHeader
          title={d.obra.nome}
          description={[
            rev
              ? `Orçamento ${rev.codigo}${rev.data ? ` de ${formatarData(rev.data)}` : ""}`
              : "Sem orçamento confirmado",
            ultimoLancado
              ? `realizado lançado até ${rotuloMesLongo(ultimoLancado)}`
              : "nenhum realizado lançado",
            d.obra.responsavel ? `responsável: ${d.obra.responsavel}` : null,
            d.obra.ativa ? null : "obra encerrada",
          ]
            .filter(Boolean)
            .join(" · ")}
        />
        <div className="-mt-2 flex flex-wrap items-center gap-2">
          {importa && (
            <>
              <BotaoImportarOrcamento
                obraId={d.obra.id}
                rotulo="Importar nova revisão"
              />
              <EditarObra obra={d.obra} obrasDoDiario={doDiario} />
            </>
          )}
          {d.obra.diarioObraId && ctx.pode("operacoes.obras.diario") && (
            <Link
              href={`/operacoes/obras/diario/${encodeURIComponent(d.obra.diarioObraId)}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
            >
              <ClipboardList className="size-4" aria-hidden />
              Ver execução (Diário de Obra)
            </Link>
          )}
        </div>
      </div>

      {confirmadas.length > 0 && (
        <FiltrosDaObra
          revisoes={confirmadas.map((r) => ({
            valor: r.codigo,
            rotulo: `${r.codigo}${r.data ? ` · ${formatarData(r.data)}` : ""}${r.vigente ? " (vigente)" : ""}`,
          }))}
          revisao={rev?.codigo ?? ""}
          de={de?.slice(0, 7) ?? ""}
          ate={ate?.slice(0, 7) ?? ""}
          primeiro={primeiro.slice(0, 7)}
          ultimo={ultimo.slice(0, 7)}
        />
      )}

      <TopoDaTela
        dadosDe={ctx.dadosDe}
        filtros={filtros}
        exemplo={exemplo}
        acoes={
          ctx.pode("operacoes.exportar") ? (
            <BotaoExportar
              titulo={`${d.obra.nome} · ${ABAS[aba]}`}
              filtros={`${filtros} · ${ctx.dadosDe}`}
              nomeArquivo={`obra-${aba}`}
              colunas={exportar.colunas}
              linhas={exportar.linhas}
            />
          ) : undefined
        }
      />

      {previa && (
        <Aviso>
          Há uma prévia da revisão {previa.codigo} esperando confirmação.
          Confirme ou descarte em{" "}
          <Link
            href="/operacoes/importacoes"
            className="font-medium underline underline-offset-4"
          >
            Operações › Importações
          </Link>
          ; até lá, vale a {vigente?.codigo ?? "revisão anterior"}.
        </Aviso>
      )}
      {avisos.length > 0 && (
        <Aviso>
          Avisos da importação da {rev?.codigo}:{" "}
          {avisos.map((a) => a.mensagem).join(" ")}
        </Aviso>
      )}

      {!rev ? (
        <Secao titulo="Orçamento">
          <p className="py-4 text-sm text-neutral-500">
            Esta obra ainda não tem orçamento confirmado.{" "}
            {importa
              ? "Use “Importar nova revisão” acima para trazer a planilha."
              : "Peça a quem importa para trazer a planilha em Operações › Importações."}
          </p>
        </Secao>
      ) : (
        <>
          <Cartoes modulo="operacoes-obra">
            <CartaoDaTela
              titulo={`Orçamento total (${rev.codigo})`}
              valor={reais(i.orcado)}
              detalhe={
                rev.totalArquivo !== null && rev.totalArquivo !== rev.total
                  ? `Planilha: ${reais(rev.totalArquivo)} (diferença ${reais(rev.totalArquivo - rev.total)})`
                  : `${formatarNumero(etapas.length)} etapas`
              }
              fonte={FONTE}
              calculo="Soma das etapas da revisão (inclui o que a planilha já trazia como realizado)."
              exemplo={exemplo && "valores de exemplo"}
            />
            <CartaoDaTela
              titulo="Realizado acumulado"
              valor={reais(i.realizadoAteMes)}
              detalhe={`${formatarPct(i.orcado > 0 ? (i.realizadoAteMes / i.orcado) * 100 : null)} do orçado · até ${rotuloMes(mesRef)}`}
              fonte={FONTE}
              exemplo={exemplo && "valores de exemplo"}
            />
            <CartaoDaTela
              titulo="Saldo a desembolsar"
              valor={reais(i.orcado - i.realizadoAteMes)}
              detalhe={i.orcamento.rotulo}
              status={i.orcamento.status}
              fonte={FONTE}
              calculo={`Orçamento total menos o realizado acumulado. ${i.orcamento.detalhe}`}
            />
            <CartaoDaTela
              titulo={`Desvio de ${rotuloMes(mesRef)}`}
              valor={reais(i.desvioNoMes)}
              detalhe={`Realizado ${reais(i.realizadoNoMes)} − previsto ${reais(i.previstoNoMes)} no mês`}
              status={i.ritmo.status}
              fonte={FONTE}
              calculo="Realizado menos previsto no mês de referência (o mês atual ou o fim do período)."
            />
          </Cartoes>

          <AbasDaTela
            rotulo="Partes da obra"
            ativa={aba}
            abas={(Object.keys(ABAS) as Aba[]).map((k) => ({
              chave: k,
              rotulo:
                k === "lancamentos"
                  ? `${ABAS[k]} (${formatarNumero(lancadosNoPeriodo.length)})`
                  : ABAS[k],
              href: hrefCom(base, busca, { aba: k === "resumo" ? null : k }),
            }))}
          />

          {aba === "resumo" && (
            <>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <Secao
                  titulo="Previsto e realizado acumulados"
                  descricao="Curva S: o previsto da revisão e o realizado lançado, somados mês a mês."
                  className="xl:col-span-2"
                  calculo="Previsto: soma das etapas da revisão em cada mês, acumulada desde o início. Realizado: soma dos lançamentos de cada mês, acumulada, até o mês atual."
                >
                  {curva.length ? (
                    <div data-guia="op-obras-curva">
                      <Linhas
                        pontos={curva.map((p) => ({
                          chave: p.mes,
                          rotulo: rotuloMes(p.mes),
                          titulo: rotuloMesLongo(p.mes),
                        }))}
                        series={[
                          {
                            chave: "previsto",
                            rotulo: "Previsto acumulado",
                            cor: "neutro",
                            valores: curva.map((p) => p.previstoAcum / 100),
                          },
                          {
                            chave: "realizado",
                            rotulo: "Realizado acumulado",
                            cor: 1,
                            valores: curva.map((p) =>
                              p.realizadoAcum === null
                                ? null
                                : p.realizadoAcum / 100,
                            ),
                          },
                        ]}
                        unidade="moeda0"
                        altura={240}
                        descricao={`Previsto e realizado acumulados de ${d.obra.nome}, ${rev.codigo}`}
                      />
                    </div>
                  ) : (
                    <p className="py-6 text-sm text-neutral-500">
                      Nada previsto nem realizado no período escolhido.
                    </p>
                  )}
                  <Fonte>{FONTE}</Fonte>
                </Secao>
                <Secao
                  titulo="Ritmo do desembolso"
                  descricao={`Até ${rotuloMesLongo(mesRef)}`}
                  calculo={`Índice = realizado acumulado ÷ previsto acumulado até o mês. Abaixo de ${formatarNumero(d.limites.desvioPontos)} pontos (obras_limite_desvio) fica vermelho; acima de +${formatarNumero(d.limites.orcamentoPct)} pontos, amarelo. Limites em Operações › Parâmetros.`}
                >
                  <div
                    data-guia="op-obras-ritmo"
                    className="flex flex-col gap-4"
                  >
                    <div className="flex flex-col gap-1.5">
                      <SeloStatus
                        status={i.ritmo.status}
                        rotulo={i.ritmo.rotulo}
                      />
                      <p className="text-sm text-neutral-600">
                        {i.ritmo.detalhe}
                      </p>
                    </div>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-xs text-neutral-500">
                          Índice (realizado ÷ previsto)
                        </dt>
                        <dd className="text-2xl font-semibold tabular-nums">
                          {i.indice === null
                            ? "—"
                            : formatarNumero(i.indice, 2)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-neutral-500">Desvio</dt>
                        <dd
                          className={`text-2xl font-semibold tabular-nums ${(i.desvioPontos ?? 0) < 0 ? "text-red-700" : ""}`}
                        >
                          {i.desvioPontos === null
                            ? "—"
                            : `${i.desvioPontos > 0 ? "+" : ""}${formatarNumero(i.desvioPontos, 1)} p.p.`}
                        </dd>
                      </div>
                    </dl>
                    <div className="flex flex-col gap-1.5 border-t border-neutral-900/[0.06] pt-3">
                      <p className="text-xs text-neutral-500">Orçamento</p>
                      <SeloStatus
                        status={i.orcamento.status}
                        rotulo={i.orcamento.rotulo}
                      />
                      <p className="text-sm text-neutral-600">
                        {i.orcamento.detalhe}
                      </p>
                    </div>
                  </div>
                </Secao>
              </div>
              <Secao
                titulo="Por etapa"
                descricao={`Previsto da ${rev.codigo} contra o realizado até ${rotuloMesLongo(mesRef)}. Estouro: realizado acima do previsto da etapa em mais de ${formatarNumero(d.limites.orcamentoPct)}% (parâmetro).`}
              >
                <TabelaPorEtapa linhas={porEtapa} mesRef={mesRef} />
                <Fonte>{FONTE}</Fonte>
              </Secao>
            </>
          )}

          {aba === "mensal" && (
            <Secao
              titulo="Mês a mês"
              descricao={`Uma linha por etapa e uma coluna por mês (${meses.length ? `${rotuloMesLongo(meses[0] ?? primeiro)} a ${rotuloMesLongo(meses.at(-1) ?? ultimo)}` : "—"}), com previsto e realizado e os totais.`}
            >
              <TabelaMensal grade={grade} meses={meses} />
              <Fonte>{FONTE}</Fonte>
            </Secao>
          )}

          {aba === "revisoes" && (
            <>
              <Secao
                titulo="Comparação entre revisões"
                descricao={
                  revA && revB
                    ? `O que mudou de ${revA.codigo} para ${revB.codigo}, por etapa: valor total e meses previstos.`
                    : "A comparação aparece quando houver uma segunda revisão (R01)."
                }
              >
                {revA && revB ? (
                  <>
                    {outras.length > 1 && (
                      <nav
                        aria-label="Comparar com"
                        className="mb-3 flex flex-wrap items-center gap-1.5 text-sm"
                      >
                        <span className="text-neutral-500">
                          Comparar a {rev.codigo} com:
                        </span>
                        {outras.map((r) => (
                          <Link
                            key={r.codigo}
                            href={hrefCom(base, busca, { cmp: r.codigo })}
                            scroll={false}
                            aria-current={
                              r.codigo === anterior?.codigo ? "true" : undefined
                            }
                            className="rounded-full border border-neutral-200 px-3 py-1 font-medium text-neutral-700 hover:border-neutral-400 aria-[current=true]:border-neutral-900 aria-[current=true]:bg-neutral-900 aria-[current=true]:text-white"
                          >
                            {r.codigo}
                          </Link>
                        ))}
                      </nav>
                    )}
                    <TabelaComparacao
                      linhas={comparacao}
                      antes={revA.codigo}
                      depois={revB.codigo}
                    />
                  </>
                ) : (
                  <p className="py-4 text-sm text-neutral-500">
                    Só há uma revisão do orçamento.
                  </p>
                )}
              </Secao>
              <Secao
                titulo="Revisões do orçamento"
                descricao="Cada planilha importada vira uma revisão; a anterior continua guardada. Desfazer uma importação volta à revisão anterior (Operações › Importações)."
              >
                <ListaDeRevisoes
                  revisoes={d.revisoes.map((r) => ({
                    codigo: r.codigo,
                    data: r.data,
                    total: r.total,
                    totalArquivo: r.totalArquivo,
                    vigente: r.vigente,
                    status: r.status,
                    avisos: r.avisos.filter((a) => a.nivel !== "info").length,
                    importadaEm: r.importadaEm,
                  }))}
                />
              </Secao>
            </>
          )}

          {aba === "lancamentos" && (
            <Secao
              titulo="Realizado lançado"
              descricao={`O que foi pago em cada etapa, com a nota ou a medição${de || ate ? " (no período escolhido)" : ""}. O realizado que veio da planilha só sai desfazendo a importação.`}
            >
              <Lancamentos
                obraId={d.obra.id}
                etapas={[...new Set(etapas.map((e) => e.nome))]}
                lancamentos={lancadosNoPeriodo.map((l) => ({
                  id: l.id,
                  etapa: l.etapa,
                  mes: l.mes,
                  centavos: l.centavos,
                  descricao: l.descricao,
                  temAnexo: !!l.anexo,
                  link: l.link,
                  origem: l.origem,
                  lancadoPor: l.lancadoPor,
                  lancadoEm: l.lancadoEm,
                }))}
                podeLancar={importa}
                mesMaximo={mesAtual.slice(0, 7)}
              />
            </Secao>
          )}
        </>
      )}
    </div>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="note"
      className="flex items-start gap-2 rounded-2xl border border-amber-300/60 bg-amber-400/10 px-4 py-3 text-sm text-amber-900"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <CartaoCarregando altura="h-24" />
      <FiltrosCarregando />
      <IndicadoresCarregando quantidade={4} />
      <CartaoCarregando altura="h-[22rem]" />
    </TelaCarregando>
  );
}
