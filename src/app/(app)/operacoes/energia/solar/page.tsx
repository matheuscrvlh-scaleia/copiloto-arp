import type { Metadata } from "next";
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
} from "@/components/dashboard/tela";
import { Alerta, kwh } from "@/components/operacoes/energia/contas/comum";
import { FiltrosEnergia } from "@/components/operacoes/energia/contas/filtros";
import { pontosDosMeses } from "@/components/operacoes/energia/contas/grafico";
import {
  COLUNAS_EXPORTAR_SOLAR,
  ListaCreditos,
  ListaSaldos,
  linhasParaExportarSolar,
} from "@/components/operacoes/energia/solar/listas";
import { BotaoExportar } from "@/components/os/exportar";
import { Cartao, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { competenciaDaUrl, formatarMes, formatarMoeda } from "@/lib/formato";
import { nomeDaUnidade } from "@/lib/operacoes/energisa-contas";
import {
  creditosPorOrigem,
  ehFonteSolar,
  FONTES_SOLAR,
  type FonteSolar,
  gera,
  resumoSolar,
  serieSolar,
  situacaoDaFonte,
} from "@/lib/operacoes/solar";
import { contextoOp, parametros } from "@/server/operacoes/base";
import {
  creditosDoMes,
  faturasAte,
  mesDaTela,
  mesesComFatura,
  mesesDoGrafico,
  unidadesDeEnergia,
} from "@/server/operacoes/contas";

export const metadata: Metadata = { title: "Energia solar" };

const FATURAS = "Faturas da Energisa importadas";
const EXEMPLO = "faturas de exemplo da Energisa, até a primeira importação";

type Busca = Record<string, string | string[] | undefined>;
const um = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

export default function Page({
  searchParams,
}: PageProps<"/operacoes/energia/solar">) {
  return (
    <>
      <PageHeader
        title="Energia solar"
        description="Só consulta: quanto foi gerado, quanto foi compensado nas contas e quanto sobra de crédito. O cadastro das usinas é da Sustentabilidade."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="operacoes.solar.ver">
          <Tela busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Tela({ busca }: { busca: Promise<Busca> }) {
  const [sp, ctx, meses, unidadesLista, p] = await Promise.all([
    busca,
    contextoOp(),
    mesesComFatura(),
    unidadesDeEnergia(),
    parametros(),
  ]);
  const fonte: FonteSolar = ehFonteSolar(p.solar_fonte)
    ? p.solar_fonte
    : "a_confirmar";
  const mes = mesDaTela(meses, competenciaDaUrl(sp.mes));
  if (!mes) {
    return (
      <Cartao>
        <p className="text-sm text-neutral-600">
          Nenhuma fatura da Energisa importada. Esta tela mostra a compensação e
          o saldo de créditos lidos das faturas: importe-as em Operações ›
          Importações. Geração das usinas: fonte {fonteTexto(fonte)}.
        </p>
      </Cartao>
    );
  }

  const unidades = new Map(unidadesLista.map((u) => [u.matricula, u]));
  const [todas, itens] = await Promise.all([
    faturasAte(mes),
    creditosDoMes(mes),
  ]);
  const comFatura = [...new Set(todas.map((f) => f.matricula))].sort();
  const unidade = comFatura.includes(um(sp.unidade)) ? um(sp.unidade) : "";
  const historico = unidade
    ? todas.filter((f) => f.matricula === unidade)
    : todas;
  const doMes = historico.filter((f) => f.referencia === mes);
  const creditos = creditosPorOrigem(
    itens.filter((i) => !unidade || i.matricula === unidade),
  );
  const resumo = resumoSolar(doMes, unidades, fonte);
  const temGeradora = unidadesLista.some((u) => gera(u.papel));
  const situacao = situacaoDaFonte(fonte, temGeradora, resumo.geracao !== null);
  const mesesGrafico = mesesDoGrafico(mes);
  const serie = serieSolar(historico, mesesGrafico, unidades, fonte);
  const exemplo = doMes.some((f) => f.exemplo) ? EXEMPLO : undefined;
  const nomeUnidade = unidade
    ? nomeDaUnidade(unidade, unidades.get(unidade))
    : "Todas";
  const linhaFiltros = `Mês: ${formatarMes(mes)} · Unidade: ${nomeUnidade}`;

  return (
    <div className="flex flex-col gap-6">
      <FiltrosEnergia
        data-guia="op-solar-filtros"
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
        aviso={situacao.completa ? undefined : "Geração não informada"}
        acoes={
          ctx.pode("operacoes.exportar") ? (
            <BotaoExportar
              titulo="Energia solar"
              filtros={`${linhaFiltros} · ${ctx.dadosDe}`}
              nomeArquivo={`energia-solar-${mes.slice(0, 7)}`}
              colunas={COLUNAS_EXPORTAR_SOLAR}
              linhas={linhasParaExportarSolar(creditos, doMes, unidades)}
            />
          ) : undefined
        }
      />

      <Alerta
        tipo={situacao.completa ? "info" : "atencao"}
        titulo={
          situacao.completa
            ? "De onde vêm os números"
            : "Geração das usinas não informada"
        }
        guia="op-solar-fonte"
      >
        {situacao.texto}
      </Alerta>

      {resumo.aExpirar.length > 0 && (
        <Alerta
          guia="op-solar-expirar"
          titulo="Crédito a expirar no próximo ciclo"
        >
          <ul className="flex flex-col gap-0.5">
            {resumo.aExpirar.map((a) => (
              <li key={a.matricula}>
                {nomeDaUnidade(a.matricula, unidades.get(a.matricula))}:{" "}
                {kwh(a.kwh)} expiram na próxima fatura se não forem usados.
              </li>
            ))}
          </ul>
        </Alerta>
      )}

      <Cartoes modulo="operacoes-solar">
        <CartaoDaTela
          titulo="Geração do mês"
          valor={resumo.geracao === null ? "—" : kwh(resumo.geracao)}
          detalhe={
            resumo.geracao === null
              ? "Geração não informada"
              : "Energia injetada na rede (fatura da geradora)"
          }
          fonte={
            resumo.geracao === null
              ? `Fonte ${fonteTexto(fonte)}`
              : "Fatura da unidade geradora"
          }
          exemplo={resumo.geracao !== null && exemplo && "faturas de exemplo"}
        />
        <CartaoDaTela
          titulo="Compensado nas contas"
          valor={kwh(resumo.compensadoKwh)}
          detalhe={`${doMes.length} ${doMes.length === 1 ? "fatura" : "faturas"} de ${formatarMes(mes)}`}
          calculo='Soma dos kWh dos itens "Energia Atv Injetada" das faturas do mês (oUC: crédito de outra unidade; mUC: da própria).'
          fonte={FATURAS}
          exemplo={exemplo && "faturas de exemplo"}
        />
        <CartaoDaTela
          titulo="Valor compensado"
          valor={formatarMoeda(resumo.valorCompensado)}
          detalhe="Desconto dos créditos nas faturas"
          fonte={FATURAS}
          exemplo={exemplo && "faturas de exemplo"}
        />
        <CartaoDaTela
          titulo="Saldo de créditos"
          valor={kwh(resumo.saldoKwh)}
          detalhe={`${kwh(resumo.expirarKwh)} a expirar no próximo ciclo`}
          calculo='Soma do "Saldo Acumulado" impresso na fatura de cada unidade no mês.'
          fonte={FATURAS}
          exemplo={exemplo && "faturas de exemplo"}
        />
      </Cartoes>

      <Secao
        titulo="Geração e compensação por mês"
        descricao="kWh nos 12 meses até o mês escolhido; sem fonte de geração, só a compensação"
        exemplo={exemplo}
      >
        <div data-guia="op-solar-grafico">
          <Linhas
            pontos={pontosDosMeses(mesesGrafico)}
            series={[
              {
                chave: "geracao",
                rotulo: "Geração",
                cor: 1,
                valores: serie.geracao,
              },
              {
                chave: "compensacao",
                rotulo: "Compensado nas contas",
                cor: 2,
                valores: serie.compensacao,
              },
            ]}
            descricao="Geração e compensação de energia solar por mês, em kWh"
          />
        </div>
        <Fonte>
          Compensação: {FATURAS}. Geração: {fonteTexto(fonte)}.
        </Fonte>
      </Secao>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
        <Secao
          titulo="Créditos usados no mês"
          descricao={`Por unidade, origem e mês em que o crédito foi gerado, em ${formatarMes(mes)}`}
          exemplo={exemplo}
        >
          <div data-guia="op-solar-creditos">
            <ListaCreditos creditos={creditos} unidades={unidades} />
          </div>
          <Fonte>
            Itens "Energia Atv Injetada GDI" das faturas: oUC = crédito vindo de
            outra unidade; mUC = crédito da própria unidade.
          </Fonte>
        </Secao>
        <Secao
          titulo="Saldo de créditos por unidade"
          descricao="Saldo acumulado e o que expira no próximo ciclo, como impresso na fatura"
          exemplo={exemplo}
        >
          <div data-guia="op-solar-saldos">
            <ListaSaldos faturas={doMes} unidades={unidades} />
          </div>
          <Fonte>
            "Saldo Acumulado" e "A expirar no próximo ciclo" da fatura de cada
            unidade; papel (gera ou consome) em Operações › Parâmetros.
          </Fonte>
        </Secao>
      </div>
    </div>
  );
}

const fonteTexto = (f: FonteSolar) =>
  `${FONTES_SOLAR[f]}${f === "inversor" || f === "planilha" ? " (ainda não ligada)" : ""}`;

function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <IndicadoresCarregando
        className="sm:grid-cols-2 xl:grid-cols-4"
        quantidade={4}
      />
      <CartaoCarregando altura="h-72" />
      <CartaoCarregando altura="h-64" />
    </TelaCarregando>
  );
}
