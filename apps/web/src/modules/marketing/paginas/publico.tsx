import { formatarData, formatarNumero } from "@arp/shared/formato";
import {
  COMPARACOES,
  diaDaSemana,
  linhaDeFiltros,
} from "@arp/shared/marketing/periodo";
import {
  comparativoAnual,
  DIAS_DA_SEMANA,
  diasComEvento,
  diasDoPeriodo,
  entradasDaFonte,
  FONTES_FLUXO,
  fonteDoFluxo,
  incrementoEmEventos,
  mediaPorDiaDaSemana,
  mediaPorHora,
  resumoFluxo,
} from "@arp/shared/marketing/publico";
import { eventosDoCalendario } from "@arp/shared/marketing/radar";
import { visiveisDa } from "@arp/shared/marketing/visualizacao";
import { useSuspenseQueries } from "@tanstack/react-query";
import { CalendarDays, Car, GitCompare } from "lucide-react";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { BarraDeFiltros } from "@/components/dashboard/barra-de-filtros";
import { Colunas } from "@/components/dashboard/graficos/colunas";
import { Linhas } from "@/components/dashboard/graficos/linhas";
import { Secao } from "@/components/dashboard/tabela";
import {
  CartaoDaTela,
  Cartoes,
  Fonte,
  TopoDaTela,
  variacaoContra,
} from "@/components/dashboard/tela";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import {
  consultaDoAsana,
  consultaDoPublico,
  consultaDosParametros,
} from "../api";
import { type FiltrosLidos, useFiltrosMkt } from "../base";

// /marketing/publico: o fluxo contado pelas câmeras (pessoas) ou, sem elas,
// as entradas do estacionamento (veículos, do WPS).

export default function Page() {
  return (
    <>
      <PageHeader
        title="Público e visitação"
        description="Quanto público vem ao Espaço ARP, em que dias e horários, e quanto os eventos movem o fluxo. Pelas câmeras (só números, nunca imagem) ou pelas entradas do estacionamento."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="marketing.publico">
          <Tela />
        </Protegido>
      </Suspense>
    </>
  );
}

const fmt = (v: number | null) =>
  v === null ? "—" : formatarNumero(Math.round(v));

function Tela() {
  const f = useFiltrosMkt("publico", "ultimos_30");
  return f ? <Publico f={f} /> : <Esqueleto />;
}

function Publico({ f }: { f: FiltrosLidos }) {
  const { ctx, periodo, anterior } = f;
  const [{ data: dados }, { data: asana }, { data: params }] =
    useSuspenseQueries({
      queries: [consultaDoPublico, consultaDoAsana, consultaDosParametros],
    });
  const ve = visiveisDa("publico", params.quadros_ocultos);
  if (!dados) return null;

  const fonte = fonteDoFluxo(dados, f.um("fonte"));
  const F = FONTES_FLUXO[fonte];
  const cameras = fonte === "cameras";
  const porDia = entradasDaFonte(dados, fonte);
  const r = resumoFluxo(porDia, periodo);
  const rAnt = resumoFluxo(porDia, anterior);
  const eventos = eventosDoCalendario(
    asana.tarefas,
    params,
    periodo.de,
    periodo.ate,
  );
  const diasEvento = diasComEvento(eventos);
  const inc = incrementoEmEventos(porDia, periodo, diasEvento);

  const diaPedido = f.um("dia");
  const diaSemana = /^[0-6]$/.test(diaPedido) ? Number(diaPedido) : null;
  const ano = Number(periodo.ate.slice(0, 4));
  const anual = comparativoAnual(porDia, ano, diaSemana);
  const semDado = cameras
    ? dados.contagens.length === 0
    : dados.estacionamento.length === 0;
  const desde = cameras
    ? dados.contagens[0]?.inicio.slice(0, 10)
    : dados.estacionamento[0]?.dia;

  const linhaFiltros = linhaDeFiltros([
    { rotulo: "Período", valor: f.rotulo },
    { rotulo: "Comparação", valor: f.rotuloAnterior },
    { rotulo: "Fonte", valor: F.rotulo },
  ]);

  return (
    <div className="flex flex-col gap-6">
      <BarraDeFiltros
        modulo="marketing"
        tela="publico"
        periodo={periodo}
        hoje={ctx.hoje}
        lembrado={f.lembrado}
        selecoes={[
          {
            chave: "comparar",
            rotulo: "Comparar com",
            todos: "Período anterior",
            valor: f.comparar,
            icone: <GitCompare className="size-4" />,
            largura: "w-64",
            opcoes: COMPARACOES.map((c) => ({ ...c })),
          },
          {
            chave: "fonte",
            rotulo: "Fonte do fluxo",
            todos: "Fonte automática",
            valor: f.um("fonte"),
            icone: <Car className="size-4" />,
            largura: "w-56",
            opcoes: [
              { valor: "cameras", rotulo: FONTES_FLUXO.cameras.rotulo },
              {
                valor: "estacionamento",
                rotulo: FONTES_FLUXO.estacionamento.rotulo,
              },
            ],
          },
          {
            chave: "dia",
            rotulo: "Dia da semana do comparativo anual",
            todos: "Todos os dias",
            valor: diaSemana === null ? "" : String(diaSemana),
            icone: <CalendarDays className="size-4" />,
            largura: "w-48",
            opcoes: DIAS_DA_SEMANA.map((d, i) => ({
              valor: String(i),
              rotulo: d,
            })),
          },
        ]}
      />

      <TopoDaTela
        dadosDe={ctx.dadosDe}
        filtros={linhaFiltros}
        reais={semDado ? undefined : F.rotulo}
        aviso={
          !semDado
            ? undefined
            : cameras
              ? "As câmeras ainda não mandaram contagem. Confira o cartão Câmeras em Administração › Configurações › Integrações, ou escolha o estacionamento no filtro Fonte do fluxo."
              : "O estacionamento ainda não foi sincronizado. Confira o cartão Estacionamento (WPS) em Administração › Configurações › Integrações."
        }
      />

      {ve("cartoes") && (
        <Cartoes modulo="marketing">
          <CartaoDaTela
            titulo={F.titulo}
            valor={formatarNumero(r.total)}
            variacao={
              rAnt.diasComDado
                ? variacaoContra(r.total, rAnt.total, f.rotuloAnterior)
                : undefined
            }
            detalhe={`${r.diasComDado} de ${r.diasNoPeriodo} dias com contagem`}
            calculo={
              cameras
                ? "Soma das entradas contadas por todas as câmeras no período. Dia sem contagem fica de fora (não conta como zero)."
                : "Soma dos veículos que entraram no estacionamento no período, de todos os tipos. Dia sem leitura do WPS fica de fora (não conta como zero)."
            }
            fonte={F.rotulo}
          />
          <CartaoDaTela
            titulo="Média por dia"
            valor={fmt(r.mediaPorDia)}
            variacao={
              r.mediaPorDia !== null && rAnt.mediaPorDia !== null
                ? variacaoContra(
                    r.mediaPorDia,
                    rAnt.mediaPorDia,
                    f.rotuloAnterior,
                  )
                : undefined
            }
            detalhe={`Dia útil ${fmt(r.mediaDiaUtil)} · Fim de semana ${fmt(r.mediaFimDeSemana)}`}
            calculo={`Entradas (${F.unidade}) ÷ dias com contagem. Dia útil: segunda a sexta; fim de semana: sábado e domingo.`}
            fonte={F.rotulo}
          />
          <CartaoDaTela
            titulo="Incremento em dias de evento"
            valor={
              inc.variacao === null
                ? "—"
                : `${inc.variacao > 0 ? "+" : ""}${formatarNumero(inc.variacao, 1)}%`
            }
            detalhe={`Com evento ${fmt(inc.comEvento)}/dia · Sem evento ${fmt(inc.semEvento)}/dia`}
            calculo="Média de entradas nos dias com evento no calendário do Asana ÷ média nos dias sem evento do mesmo período − 1."
            fonte={`${F.rotulo} e calendário do Asana`}
          />
          <CartaoDaTela
            titulo="Dia de maior fluxo"
            valor={r.pico ? formatarNumero(r.pico.entradas) : "—"}
            detalhe={
              r.pico
                ? `${DIAS_DA_SEMANA[diaDaSemana(r.pico.dia)]}, ${formatarData(r.pico.dia)}${diasEvento.has(r.pico.dia) ? " · com evento" : ""}`
                : "Sem contagem no período"
            }
            fonte={F.rotulo}
          />
        </Cartoes>
      )}

      {ve("por_dia") && (
        <Secao
          titulo="Fluxo por dia"
          descricao="Entradas de cada dia do período. Dia com evento no calendário aparece destacado."
          calculo={`Entradas (${F.unidade}) do dia, horário de Brasília. Fonte: ${F.rotulo}.`}
        >
          <Colunas
            descricao="Entradas por dia no período"
            itens={diasDoPeriodo(porDia, periodo).map((d) => ({
              chave: d.dia,
              rotulo: d.dia.slice(8, 10),
              valor: d.entradas ?? 0,
              texto: d.entradas === null ? "sem contagem" : fmt(d.entradas),
              titulo: `${DIAS_DA_SEMANA[diaDaSemana(d.dia)]}, ${formatarData(d.dia)}`,
              detalhe: eventos
                .filter((e) => e.inicio <= d.dia && e.fim >= d.dia)
                .map((e) => e.nome)
                .join(" · "),
              destaque: diasEvento.has(d.dia),
            }))}
          />
          <Fonte>
            {`${F.rotulo}${desde ? ` (desde ${formatarData(desde)})` : ""}; eventos do calendário do Asana`}
          </Fonte>
        </Secao>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {ve("por_hora") && cameras && (
          <Secao
            titulo="Fluxo por hora"
            descricao="Média de entradas em cada hora, nos dias com contagem do período"
            calculo="Entradas de cada hora ÷ dias com contagem no período. Fonte: câmeras de contagem."
          >
            <Colunas
              descricao="Média de entradas por hora do dia"
              itens={mediaPorHora(dados.contagens, periodo).map((v, h) => ({
                chave: String(h),
                rotulo: `${h}h`,
                valor: v ?? 0,
                texto: fmt(v),
                titulo: `${h}h às ${h + 1}h`,
              }))}
            />
            <Fonte>Câmeras de contagem</Fonte>
          </Secao>
        )}
        {ve("dia_da_semana") && (
          <Secao
            titulo="Média por dia da semana"
            descricao="Quanto cada dia da semana recebe, em média, no período"
            calculo={`Entradas de cada dia da semana ÷ quantos desses dias tiveram contagem. Fonte: ${F.rotulo}.`}
          >
            <Colunas
              rotularTodas
              descricao="Média de entradas por dia da semana"
              itens={mediaPorDiaDaSemana(porDia, periodo).map((v, i) => ({
                chave: String(i),
                rotulo: (DIAS_DA_SEMANA[i] ?? "").slice(0, 3),
                valor: v ?? 0,
                texto: fmt(v),
                titulo: DIAS_DA_SEMANA[i],
              }))}
            />
            <Fonte>{F.rotulo}</Fonte>
          </Secao>
        )}
      </div>

      {ve("comparativo_anual") && (
        <Secao
          titulo={`Comparativo anual: ${ano - 1} × ${ano}`}
          descricao={`Média de entradas por dia em cada mês${diaSemana === null ? "" : `, só ${DIAS_DA_SEMANA[diaSemana]?.toLowerCase()}`}. Escolha o dia da semana no filtro.`}
          calculo={`Média das entradas dos dias com contagem de cada mês (do dia da semana escolhido). Mês sem contagem fica sem ponto. Fonte: ${F.rotulo}.`}
        >
          <Linhas
            descricao="Média de entradas por dia, mês a mês, no ano e no anterior"
            pontos={anual.map((m) => ({
              chave: m.mes,
              rotulo: m.mes.slice(0, 3),
              titulo: m.mes,
            }))}
            series={[
              {
                chave: "anterior",
                rotulo: String(ano - 1),
                cor: "neutro",
                valores: anual.map((m) => m.anterior),
              },
              {
                chave: "atual",
                rotulo: String(ano),
                cor: 1,
                valores: anual.map((m) => m.atual),
              },
            ]}
          />
          <Fonte>
            {F.rotulo}. O histórico começa no primeiro dia com contagem; antes
            disso o mês fica sem ponto.
          </Fonte>
        </Secao>
      )}
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
      <CartaoCarregando altura="h-72" />
    </TelaCarregando>
  );
}
