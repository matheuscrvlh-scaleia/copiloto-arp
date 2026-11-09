import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  CartaoCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { Secao } from "@/components/dashboard/tabela";
import {
  CartaoDaTela,
  Cartoes,
  hrefCom,
  TopoDaTela,
} from "@/components/dashboard/tela";
import { BotaoImportarOrcamento } from "@/components/operacoes/obras/botao-importar";
import { CartaoObra } from "@/components/operacoes/obras/cartao-obra";
import { BotaoExportar } from "@/components/os/exportar";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { formatarMoeda, formatarNumero, formatarPct } from "@/lib/formato";
import { linhaDeFiltros } from "@/lib/marketing/periodo";
import {
  indicadoresDaObra,
  mesDoDia,
  rotuloMes,
  rotuloMesLongo,
} from "@/lib/operacoes/obras";
import { contextoOp, parametros } from "@/server/operacoes/base";
import { limitesDe, obrasComValores } from "@/server/operacoes/obras";

export const metadata: Metadata = { title: "Obras · previsto e realizado" };

const BASE = "/operacoes/obras";
const FONTE = "Planilha de orçamento (revisão vigente) e realizado lançado";
const SITUACOES = {
  abaixo: "Abaixo do previsto",
  estouro: "Estouro do orçamento",
} as const;
type Situacao = keyof typeof SITUACOES;

type Busca = Record<string, string | string[] | undefined>;

export default function Page({ searchParams }: PageProps<"/operacoes/obras">) {
  return (
    <>
      <PageHeader
        title="Obras"
        description="Desembolso de cada obra: o previsto na planilha de orçamento contra o realizado lançado, mês a mês. O avanço físico e os relatórios ficam no Diário de Obra."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="operacoes.obras.ver">
          <Tela busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Tela({ busca: buscaP }: { busca: Promise<Busca> }) {
  const [busca, ctx, obras, p] = await Promise.all([
    buscaP,
    contextoOp(),
    obrasComValores(),
    parametros(),
  ]);
  const um = (k: string) => {
    const v = busca[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const situacao: Situacao | "" =
    um("situacao") in SITUACOES ? (um("situacao") as Situacao) : "";
  const mesRef = mesDoDia(ctx.hoje);
  const limites = limitesDe(p);

  const todas = obras
    .map((o) => ({
      obra: o,
      i: indicadoresDaObra({
        orcado: o.vigente?.total ?? 0,
        previsto: o.previsto,
        realizado: o.realizado,
        mesRef,
        limites,
      }),
    }))
    // Em andamento primeiro; dentro de cada grupo, pelo nome.
    .sort((a, b) => Number(b.obra.ativa) - Number(a.obra.ativa));
  const ativas = todas.filter((l) => l.obra.ativa);
  const abaixo = ativas.filter((l) => l.i.ritmo.status === "fora");
  const estouro = ativas.filter((l) => l.i.orcamento.status === "fora");
  const lista =
    situacao === "abaixo" ? abaixo : situacao === "estouro" ? estouro : todas;
  const orcado = ativas.reduce((s, l) => s + l.i.orcado, 0);
  const realizado = ativas.reduce((s, l) => s + l.i.realizado, 0);

  const filtros = linhaDeFiltros([
    { rotulo: "Situação", valor: situacao ? SITUACOES[situacao] : "Todas" },
    { rotulo: "Mês de referência", valor: rotuloMesLongo(mesRef) },
  ]);
  const exemplo = obras.some((o) => o.exemplo)
    ? "obras, orçamentos e realizado, até a planilha real ser importada"
    : undefined;
  const importa = ctx.pode("operacoes.obras.importar");
  const reais = (c: number) => formatarMoeda(c / 100);
  const cartao = (k: Situacao) =>
    hrefCom(BASE, busca, { situacao: situacao === k ? null : k });

  return (
    <div className="flex flex-col gap-6">
      <TopoDaTela
        dadosDe={ctx.dadosDe}
        filtros={filtros}
        exemplo={exemplo}
        acoes={
          <>
            {importa && <BotaoImportarOrcamento />}
            {ctx.pode("operacoes.exportar") && (
              <BotaoExportar
                titulo="Obras · previsto e realizado"
                filtros={`${filtros} · ${ctx.dadosDe}`}
                nomeArquivo="obras-previsto-realizado"
                colunas={[
                  { titulo: "Obra" },
                  { titulo: "Revisão" },
                  { titulo: "Orçado (R$)", numero: true },
                  { titulo: "Realizado (R$)", numero: true },
                  { titulo: "Executado (%)", numero: true },
                  {
                    titulo: `Previsto até ${rotuloMes(mesRef)} (R$)`,
                    numero: true,
                  },
                  { titulo: "Índice (realizado ÷ previsto)", numero: true },
                  { titulo: "Ritmo" },
                  { titulo: "Orçamento" },
                ]}
                linhas={lista.map(({ obra, i }) => [
                  obra.ativa ? obra.nome : `${obra.nome} (encerrada)`,
                  obra.vigente?.codigo ?? "—",
                  i.orcado / 100,
                  i.realizado / 100,
                  i.pctExecutado === null
                    ? null
                    : Math.round(i.pctExecutado * 10) / 10,
                  i.previstoAteMes / 100,
                  i.indice === null ? null : Math.round(i.indice * 100) / 100,
                  i.ritmo.rotulo,
                  i.orcamento.rotulo,
                ])}
              />
            )}
          </>
        }
      />

      <Cartoes modulo="operacoes">
        <CartaoDaTela
          titulo="Orçado (revisões vigentes)"
          valor={reais(orcado)}
          detalhe={`${formatarNumero(ativas.length)} ${ativas.length === 1 ? "obra em andamento" : "obras em andamento"}`}
          fonte={FONTE}
          calculo="Soma das etapas da revisão vigente de cada obra em andamento."
          exemplo={exemplo && "valores de exemplo"}
        />
        <CartaoDaTela
          titulo="Realizado acumulado"
          valor={reais(realizado)}
          detalhe={`${formatPctSeguro(realizado, orcado)} do orçado · saldo ${reais(orcado - realizado)}`}
          fonte={FONTE}
          calculo="Soma de todo o realizado lançado (e do trazido pela planilha na primeira importação) das obras em andamento."
          exemplo={exemplo && "valores de exemplo"}
        />
        <CartaoDaTela
          titulo={SITUACOES.abaixo}
          valor={formatarNumero(abaixo.length)}
          detalhe={`Desvio abaixo de ${formatarNumero(limites.desvioPontos)} pontos até ${rotuloMes(mesRef)} (parâmetro)`}
          status={abaixo.length ? "fora" : "ok"}
          fonte={FONTE}
          href={cartao("abaixo")}
          ativo={situacao === "abaixo"}
        />
        <CartaoDaTela
          titulo={SITUACOES.estouro}
          valor={formatarNumero(estouro.length)}
          detalhe={`Realizado acima do orçado em mais de ${formatarNumero(limites.orcamentoPct)}% (parâmetro)`}
          status={estouro.length ? "fora" : "ok"}
          fonte={FONTE}
          href={cartao("estouro")}
          ativo={situacao === "estouro"}
        />
      </Cartoes>

      <Secao
        titulo="Obras"
        descricao={`Clique numa obra para ver o previsto × realizado por etapa e por mês, a curva e as revisões. Ritmo: realizado acumulado ÷ previsto acumulado até ${rotuloMesLongo(mesRef)}.`}
      >
        {lista.length === 0 ? (
          <p className="py-6 text-sm text-neutral-500">
            {obras.length === 0 ? (
              <>
                Nenhuma obra cadastrada. A obra entra com a planilha de
                orçamento:{" "}
                {importa
                  ? "use “Importar orçamento” acima ou "
                  : "peça a quem importa, "}
                em{" "}
                <Link
                  href="/operacoes/importacoes"
                  className="font-medium underline underline-offset-4"
                >
                  Operações › Importações
                </Link>
                .
              </>
            ) : (
              "Nenhuma obra nesta situação."
            )}
          </p>
        ) : (
          <div
            data-guia="op-obras-lista"
            className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3"
          >
            {lista.map(({ obra, i }) => (
              <CartaoObra
                key={obra.id}
                obra={{
                  id: obra.id,
                  nome: obra.nome,
                  responsavel: obra.responsavel,
                  ativa: obra.ativa,
                  exemplo: obra.exemplo,
                  revisao: obra.vigente
                    ? { codigo: obra.vigente.codigo, data: obra.vigente.data }
                    : null,
                }}
                indicadores={i}
              />
            ))}
          </div>
        )}
      </Secao>
    </div>
  );
}

function formatPctSeguro(parte: number, todo: number) {
  return formatarPct(todo > 0 ? (parte / todo) * 100 : null);
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <IndicadoresCarregando quantidade={4} />
      <CartaoCarregando altura="h-[28rem]" />
    </TelaCarregando>
  );
}
