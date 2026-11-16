import {
  competenciaDaUrl,
  formatarMes,
  formatarMoeda,
  formatarNumero,
} from "@arp/shared/formato";
import {
  alertasDeConsumo,
  compararComMedia,
  nomeDaUnidade,
  totaisDoMes,
} from "@arp/shared/operacoes/energisa-contas";
import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { Linhas } from "@/components/dashboard/graficos/linhas";
import { Secao } from "@/components/dashboard/tabela";
import {
  CartaoDaTela,
  Cartoes,
  Fonte,
  TopoDaTela,
  variacaoContra,
} from "@/components/dashboard/tela";
import { BotaoExportar } from "@/components/exportar";
import { Cartao, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { Link, useBusca } from "@/lib/navegacao";
import {
  consultaDasFaturas,
  consultaDasUnidades,
  consultaDosMesesComFatura,
  consultaDosParametros,
} from "../api";
import { Alerta, kwh } from "../components/energia/contas/comum";
import { FiltrosEnergia } from "../components/energia/contas/filtros";
import {
  pontosDosMeses,
  seriesDoConsumo,
} from "../components/energia/contas/grafico";
import {
  COLUNAS_EXPORTAR,
  ListaContas,
  linhasParaExportar,
} from "../components/energia/contas/lista";
import { mesDaTela, mesesDoGrafico } from "../contas";
import { useContextoOp } from "../contexto";
import { mapaDeLinks } from "../filtros";

const IMPORTAR = "/operacoes/configuracoes/importacoes?tipo=energisa";
const FONTE = "Faturas da Energisa importadas";
const EXEMPLO = "faturas de exemplo da Energisa, até a primeira importação";

const um = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

export default function Page() {
  return (
    <>
      <PageHeader
        title="Contas de energia"
        description="Faturas da Energisa das unidades em nome da ARP (área comum): consumo, gasto e quanto a energia solar compensou."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="operacoes.energia.contas">
          <Tela />
        </Protegido>
      </Suspense>
    </>
  );
}

function BotaoImportar() {
  return (
    <Link
      href={IMPORTAR}
      data-guia="op-contas-importar"
      className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
    >
      <Upload className="size-4" aria-hidden />
      Importar faturas
    </Link>
  );
}

function Tela() {
  const sp = useBusca();
  const [{ data: dm }] = useSuspenseQueries({
    queries: [consultaDosMesesComFatura],
  });
  const mes = mesDaTela(dm.meses, competenciaDaUrl(sp.mes));
  if (!mes) {
    return (
      <Cartao>
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-neutral-600">
            Nenhuma fatura importada. Importe as faturas da Energisa (PDF) em
            Operações › Importações: cada fatura passa por uma prévia antes de
            entrar aqui.
          </p>
          <BotaoImportar />
        </div>
      </Cartao>
    );
  }
  return <Mes meses={dm.meses} mes={mes} unidadePedida={um(sp.unidade)} />;
}

function Mes({
  meses,
  mes,
  unidadePedida,
}: {
  meses: string[];
  mes: string;
  unidadePedida: string;
}) {
  const [{ data: du }, { data: dp }] = useSuspenseQueries({
    queries: [consultaDasUnidades, consultaDosParametros],
  });
  const { data: df, dataUpdatedAt } = useSuspenseQuery(consultaDasFaturas(mes));
  const ctx = useContextoOp(dataUpdatedAt);
  const p = dp.parametros;
  const unidades = new Map(du.unidades.map((u) => [u.matricula, u]));
  const todas = df.faturas;
  const comFatura = [...new Set(todas.map((f) => f.matricula))].sort();
  const unidade = comFatura.includes(unidadePedida) ? unidadePedida : "";
  const historico = unidade
    ? todas.filter((f) => f.matricula === unidade)
    : todas;
  const doMes = historico.filter((f) => f.referencia === mes);
  const pct = Number(p.energia_alerta_pct);
  const totais = totaisDoMes(doMes);
  const comparacao = compararComMedia(historico, doMes, mes);
  const alertas = alertasDeConsumo(historico, doMes, mes, pct);
  const pdfs = mapaDeLinks(df.pdfs);
  const exemplo = doMes.some((f) => f.exemplo) ? EXEMPLO : undefined;
  const mesesGrafico = mesesDoGrafico(mes);
  const nomeUnidade = unidade
    ? nomeDaUnidade(unidade, unidades.get(unidade))
    : "Todas";
  const linhaFiltros = `Mês: ${formatarMes(mes)} · Unidade: ${nomeUnidade}`;

  return (
    <div className="flex flex-col gap-6">
      <FiltrosEnergia
        data-guia="op-contas-filtros"
        meses={meses}
        mes={mes}
        unidade={unidade}
        unidades={comFatura.map((m) => ({
          valor: m,
          rotulo: `${nomeDaUnidade(m, unidades.get(m))}${unidades.get(m)?.apelido ? ` (${m})` : ""}`,
        }))}
      />

      <TopoDaTela
        dadosDe={ctx.dadosDe}
        filtros={linhaFiltros}
        exemplo={exemplo}
        acoes={
          <>
            <BotaoImportar />
            {ctx.pode("operacoes.exportar") && (
              <BotaoExportar
                titulo="Contas de energia"
                filtros={`${linhaFiltros} · ${ctx.dadosDe}`}
                nomeArquivo={`contas-de-energia-${mes.slice(0, 7)}`}
                colunas={COLUNAS_EXPORTAR}
                linhas={linhasParaExportar(doMes, unidades)}
              />
            )}
          </>
        }
      />

      {alertas.length > 0 && (
        <Alerta
          guia="op-contas-alerta"
          titulo={`Consumo acima da média em ${alertas.length} ${alertas.length === 1 ? "unidade" : "unidades"}`}
        >
          <ul className="flex flex-col gap-0.5">
            {alertas.map((a) => (
              <li key={a.matricula}>
                {nomeDaUnidade(a.matricula, unidades.get(a.matricula))}:{" "}
                {kwh(a.consumo)}, {formatarNumero(a.acima, 0)}% acima da média
                dos 12 meses anteriores ({kwh(Math.round(a.media))}).
              </li>
            ))}
          </ul>
          <p className="mt-1">
            O alerta vale a partir de {formatarNumero(pct, 0)}% (Operações ›
            Parâmetros).
          </p>
        </Alerta>
      )}

      <Cartoes modulo="operacoes-contas">
        <CartaoDaTela
          titulo="Total do mês"
          valor={formatarMoeda(totais.total)}
          detalhe={`${totais.faturas} ${totais.faturas === 1 ? "fatura" : "faturas"} de ${formatarMes(mes)}`}
          fonte={FONTE}
          exemplo={exemplo && "faturas de exemplo"}
        />
        <CartaoDaTela
          titulo="Consumo"
          valor={kwh(totais.consumoKwh)}
          variacao={
            comparacao
              ? variacaoContra(
                  comparacao.atual,
                  comparacao.media,
                  "média de 12 meses",
                  "menor_melhor",
                )
              : undefined
          }
          detalhe={
            comparacao
              ? `Média de 12 meses: ${kwh(Math.round(comparacao.media))}`
              : "Sem meses anteriores para comparar"
          }
          calculo="Consumo do mês das unidades com histórico contra a soma das médias de cada unidade nos 12 meses anteriores (só os meses com fatura). Alerta por unidade a partir do percentual de Parâmetros."
          fonte={FONTE}
          exemplo={exemplo && "faturas de exemplo"}
        />
        <CartaoDaTela
          titulo="Energia compensada"
          valor={kwh(totais.compensadoKwh)}
          detalhe="Créditos da geração solar (Lei 14.300/22)"
          calculo='Soma dos kWh dos itens "Energia Atv Injetada" das faturas (oUC: crédito de outra unidade; mUC: da própria).'
          fonte={FONTE}
          exemplo={exemplo && "faturas de exemplo"}
        />
        <CartaoDaTela
          titulo="Valor compensado"
          valor={formatarMoeda(totais.valorCompensado)}
          detalhe="Desconto dos créditos nas faturas"
          calculo='Soma dos valores (negativos na fatura) dos itens "Energia Atv Injetada".'
          fonte={FONTE}
          exemplo={exemplo && "faturas de exemplo"}
        />
      </Cartoes>

      <Secao
        titulo="Faturas do mês"
        descricao={`Uma linha por unidade em ${formatarMes(mes)}. Clique na unidade para ver os itens da fatura; "PDF" abre o original.`}
        exemplo={exemplo}
      >
        <div data-guia="op-contas-tabela">
          <ListaContas
            faturas={doMes}
            unidades={unidades}
            totais={totais}
            alertas={alertas}
            pdfs={pdfs}
          />
        </div>
        <Fonte>
          {FONTE}: itens "Consumo em kWh", "Energia Atv Injetada GDI" (oUC/mUC),
          adicional de bandeira, contribuição de iluminação pública e a linha
          "TOTAL". Toda fatura entra só quando a soma dos itens bate com o total
          (ou com o motivo de quem confirmou).
        </Fonte>
      </Secao>

      <Secao
        titulo="Consumo por mês"
        descricao="kWh por unidade nos 12 meses até o mês escolhido, montado com as faturas importadas"
        exemplo={exemplo}
      >
        <div data-guia="op-contas-grafico">
          <Linhas
            pontos={pontosDosMeses(mesesGrafico)}
            series={seriesDoConsumo(historico, mesesGrafico, unidades)}
            descricao="Consumo em kWh por mês e por unidade"
          />
        </div>
        <Fonte>
          {FONTE}. O histórico de 13 meses impresso na fatura só existe como
          imagem do gráfico: o sistema não o lê; mês sem fatura importada fica
          sem ponto.
        </Fonte>
      </Secao>
    </div>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <IndicadoresCarregando
        className="sm:grid-cols-2 xl:grid-cols-4"
        quantidade={4}
      />
      <CartaoCarregando altura="h-80" />
      <CartaoCarregando altura="h-72" />
    </TelaCarregando>
  );
}
