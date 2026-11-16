import {
  formatarData,
  formatarHoras,
  formatarMes,
  formatarMoeda,
  formatarNumero,
  formatarPct,
  formatarSaldoHoras,
} from "@arp/shared/formato";
import { status } from "@arp/shared/indicadores";
import { descreverPeriodo, paramsDoPeriodo } from "@arp/shared/periodo";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { BarrasHorizontais, Colunas } from "@/components/dashboard/graficos";
import {
  CartaoIndicador,
  CartaoPendente,
  SeloStatus,
  type Variacao,
} from "@/components/dashboard/indicador";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { AbreDetalhe, ProvedorDetalhe } from "@/components/modal-detalhe";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { Link } from "@/lib/navegacao";
import { consultaDoPainel } from "../api";
import { comCarga, useCargaDoQuadro } from "../detalhes";
import { useFiltrosDoPeriodo } from "../filtros";

export default function Page() {
  return (
    <>
      <PageHeader
        title="Painel de RH"
        description="Indicadores de pessoal do período, com semáforo pela meta configurada em Parâmetros."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="rh.painel">
          <Painel />
        </Protegido>
      </Suspense>
    </>
  );
}

function variacaoPp(
  atual: number | null,
  anterior: number | null,
  rotulo: string,
): Variacao | undefined {
  if (atual === null || anterior === null) return undefined;
  const d = atual - anterior;
  return {
    texto: `${d > 0 ? "+" : ""}${formatarNumero(d, 1)} p.p. vs ${rotulo}`,
    sentido: Math.abs(d) < 0.05 ? "neutro" : d < 0 ? "bom" : "ruim",
  };
}

/**
 * Os números e os detalhes (modais) vêm prontos da API, já filtrados pelas
 * permissões de quem vê (lista de pessoas só com rh.jornada / rh.quadro;
 * custo só com rh.custo_pessoal; R$ por pessoa só com o custo individual).
 */
function Painel() {
  const filtrosDaUrl = useFiltrosDoPeriodo();
  const { data } = useSuspenseQuery(consultaDoPainel(filtrosDaUrl));
  const carga = useCargaDoQuadro();
  const {
    filtros: { periodo, anterior, rotulo, hoje, departamento, departamentos },
    metas: {
      absenteismo: metaAbs,
      banco: metaBanco,
      custo: metaCusto,
      turnover: metaTurnover,
    },
    custo,
    ponto,
    quadro,
  } = data;
  const rotuloAnt = descreverPeriodo(anterior);
  const ativos = quadro.ativos;
  const ativosAnt = quadro.ativosAnterior;
  const tv = quadro.turnover;
  const semTurnover = quadro.semTurnover;
  const movimento = quadro.movimento;
  const evolucao = quadro.evolucao;
  const bancoHoras = ponto.banco_positivo_min / 60;

  // Os links levam o período.
  const filtrosUrl = (dep = departamento) =>
    new URLSearchParams({
      ...paramsDoPeriodo(periodo),
      ...(dep ? { dep } : {}),
    }).toString();
  const linkJornada = (dep = departamento) => ({
    href: `/rh/jornada?${filtrosUrl(dep)}`,
    rotulo: "Abrir a Jornada",
  });
  const origemReceita = custo.origemReceita ?? undefined;
  const metaTexto = (m: { meta: number } | null, f: (v: number) => string) =>
    m ? `Meta: até ${f(m.meta)}` : "Defina a meta em Parâmetros";

  return (
    <ProvedorDetalhe>
      <div className="flex flex-col gap-6">
        <FiltroPeriodo
          de={periodo.de}
          ate={periodo.ate}
          atalho={periodo.atalho}
          hoje={hoje}
          departamentos={departamentos}
          departamento={departamento}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {custo.totais && custo.sobreReceita !== null ? (
            <CartaoIndicador
              titulo="Custo de pessoal sobre a receita"
              valor={formatarPct(custo.sobreReceita)}
              status={status(custo.sobreReceita, metaCusto)}
              meta={metaTexto(metaCusto, (v) => formatarPct(v))}
              detalhe={`${custo.rotulo} · custo ÷ faturamento bruto`}
              origem={origemReceita}
            />
          ) : (
            <CartaoPendente
              titulo="Custo de pessoal sobre a receita"
              motivo={
                custo.totais && custo.competencia
                  ? departamento
                    ? "Por departamento não há receita: o % é só da empresa."
                    : `Falta o faturamento de ${custo.semFaturamento.map(formatarMes).join(", ")} (lançado em Cadastros até a API do ENET).`
                  : custo.motivo
              }
              meta={
                metaCusto
                  ? metaTexto(metaCusto, (v) => formatarPct(v))
                  : undefined
              }
              origem={origemReceita}
            />
          )}
          {custo.totais && custo.competencia && custo.origemTotal ? (
            <CartaoIndicador
              titulo="Custo total de pessoal"
              tom="escuro"
              valor={formatarMoeda(custo.totais.custo_total, 0)}
              serie={custo.serie}
              variacao={custo.variacao}
              detalhe={`${custo.rotulo} · ${custo.totais.colaboradores} pessoas${custo.ficticia ? " · salários fictícios (protótipo)" : ""}`}
              meta={`Remuneração ${formatarMoeda(custo.totais.remuneracao, 0)} · + encargos e provisões ${formatarMoeda(custo.totais.encargos + custo.totais.provisoes, 0)}`}
              origem={custo.origemTotal}
            />
          ) : (
            <CartaoPendente
              titulo="Custo total de pessoal"
              motivo={custo.motivo}
            />
          )}
          <CartaoIndicador
            titulo="Headcount"
            valor={formatarNumero(ativos)}
            detalhe={`Ativos em ${formatarData(periodo.ate)} (Copiloto RH)`}
            serie={evolucao}
            variacao={{
              texto: `${ativos - ativosAnt >= 0 ? "+" : ""}${ativos - ativosAnt} vs ${formatarData(anterior.ate)}`,
              sentido: "neutro",
            }}
            origem={comCarga(quadro.origemAtivos, carga)}
          />
          {ponto.semDado ? (
            <CartaoPendente
              titulo="Absenteísmo"
              motivo={ponto.semDado}
              meta={
                metaAbs ? metaTexto(metaAbs, (v) => formatarPct(v)) : undefined
              }
            />
          ) : (
            <CartaoIndicador
              titulo="Absenteísmo"
              tom="verde"
              valor={formatarPct(ponto.absenteismo)}
              status={status(ponto.absenteismo, metaAbs)}
              meta={metaTexto(metaAbs, (v) => formatarPct(v))}
              variacao={variacaoPp(
                ponto.absenteismo,
                ponto.absenteismoAnterior,
                rotuloAnt,
              )}
              detalhe={ponto.parcial ?? "Faltas e atrasos ÷ horas previstas"}
              origem={ponto.origemAbsenteismo}
            />
          )}
          {ponto.semDado ? (
            <CartaoPendente
              titulo="Banco de horas positivo"
              motivo={ponto.semDado}
              meta={
                metaBanco
                  ? metaTexto(metaBanco, (v) => `${formatarNumero(v)}h`)
                  : undefined
              }
            />
          ) : (
            <CartaoIndicador
              titulo="Banco de horas positivo"
              valor={formatarSaldoHoras(ponto.banco_positivo_min)}
              status={status(ponto.comLinhas ? bancoHoras : null, metaBanco)}
              meta={metaTexto(metaBanco, (v) => `${formatarNumero(v)}h`)}
              detalhe={`Saldo em ${formatarData(ponto.ate)}: ${formatarSaldoHoras(ponto.banco_saldo_min)} · ${ponto.textoBanco}`}
              origem={ponto.origemBanco}
            />
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Secao
            titulo="Evolução do headcount"
            descricao="Colaboradores ativos no fim de cada mês (Copiloto RH)"
            className="lg:col-span-2"
          >
            <Colunas
              itens={evolucao}
              descricao="Colaboradores ativos no fim de cada mês, últimos 12 meses"
              detalhes={Object.fromEntries(
                Object.entries(quadro.detalhesEvolucao).map(([c, d]) => [
                  c,
                  comCarga(d, carga),
                ]),
              )}
            />
          </Secao>

          <Secao tom="escuro" titulo="Movimento" descricao={rotulo}>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <AbreDetalhe
                detalhe={comCarga(quadro.origemAdmissoes, carga)}
                className="-m-2 rounded-2xl p-2 hover:bg-white/50"
              >
                <p className="text-neutral-500">Admissões</p>
                <p className="text-2xl font-semibold">{movimento.admissoes}</p>
              </AbreDetalhe>
              <AbreDetalhe
                detalhe={comCarga(quadro.origemDesligamentos, carga)}
                className="-m-2 rounded-2xl p-2 hover:bg-white/50"
              >
                <p className="text-neutral-500">Desligamentos</p>
                <p className="text-2xl font-semibold">
                  {movimento.desligamentos}
                </p>
              </AbreDetalhe>
              <AbreDetalhe
                detalhe={comCarga(quadro.origemTurnover, carga)}
                className="col-span-2 -m-2 mt-2 rounded-2xl p-2 hover:bg-white/50"
              >
                <p className="text-neutral-500">Turnover Geral</p>
                <p className="mt-1 flex items-center gap-3">
                  <span className="text-2xl font-semibold">
                    {formatarPct(tv?.turnover ?? null)}
                  </span>
                  {tv && (
                    <SeloStatus status={status(tv.turnover, metaTurnover)} />
                  )}
                </p>
              </AbreDetalhe>
            </div>
            <p className="mt-4 text-xs text-neutral-500">
              {tv
                ? `${tv.taxas
                    .slice(1)
                    .map(
                      (t) =>
                        `${t.rotulo.replace("Turnover ", "")}: ${formatarPct(t.valor)}`,
                    )
                    .join(" · ")} · Copiloto RH`
                : semTurnover}
            </p>
            <Link
              href={`/rh/quadro?${filtrosUrl()}`}
              className="mt-4 inline-block text-sm font-medium underline-offset-4 hover:underline"
            >
              Ver quadro e turnover →
            </Link>
          </Secao>
        </div>

        <Secao
          titulo="Absenteísmo por setor"
          descricao={`${rotulo} · faltas e atrasos ÷ horas previstas`}
        >
          {ponto.semDado ? (
            <p className="text-sm text-neutral-500">{ponto.semDado}</p>
          ) : (
            <BarrasHorizontais
              descricao="Absenteísmo por setor"
              meta={
                metaAbs
                  ? {
                      valor: metaAbs.meta,
                      texto: `Meta: até ${formatarPct(metaAbs.meta)}`,
                    }
                  : undefined
              }
              itens={ponto.setores.map((s) => ({
                chave: s.chave,
                rotulo: s.departamento,
                valor: s.absenteismo ?? 0,
                texto: formatarPct(s.absenteismo),
                detalhe: `${s.colaboradores} pessoas · faltas ${formatarHoras(s.faltas_min)} · atrasos ${formatarHoras(s.atrasos_min)}`,
              }))}
              detalhes={Object.fromEntries(
                ponto.setores.map((s) => [s.chave, s.origem]),
              )}
            />
          )}
          <Link
            href={linkJornada().href}
            className="mt-4 inline-block text-sm font-medium underline-offset-4 hover:underline"
          >
            Ver jornada por funcionário →
          </Link>
        </Secao>

        <Nota>
          Fontes: ponto (Secullum) de {formatarData(ponto.de)} a{" "}
          {formatarData(ponto.ate)}, sincronizado todo dia (o dia de hoje entra
          amanhã); colaboradores, admissões, desligamentos e turnover do
          Copiloto RH; custo pela folha de cada mês do período, com encargos,
          provisões e benefícios dos Parâmetros. Custo e receita são mensais: um
          período dentro do mês mostra o mês inteiro.
        </Nota>
      </div>
    </ProvedorDetalhe>
  );
}

/** Blocos no lugar dos cartões da tela enquanto os dados chegam. */
function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <IndicadoresCarregando
        className="sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5"
        quantidade={5}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CartaoCarregando className="lg:col-span-2" altura="h-80" />
        <CartaoCarregando altura="h-80" />
      </div>
      <CartaoCarregando altura="h-80" />
    </TelaCarregando>
  );
}
