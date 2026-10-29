import { CalendarDays, PartyPopper } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { ColunasEmpilhadas } from "@/components/dashboard/graficos/colunas-empilhadas";
import { Faixas } from "@/components/dashboard/graficos/faixas";
import { MapaDeCalor } from "@/components/dashboard/graficos/mapa-calor";
import { Secao } from "@/components/dashboard/tabela";
import { BarraDeFiltros } from "@/components/marketing/filtros";
import { EfeitoDoEvento } from "@/components/marketing/publico/efeito";
import { TabelaMkt } from "@/components/marketing/tabela";
import {
  CartaoMkt,
  Cartoes,
  Fonte,
  TopoDaTela,
  variacaoContra,
} from "@/components/marketing/tela";
import { BotaoExportar } from "@/components/os/exportar";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import {
  formatarData,
  formatarHoras,
  formatarNumero,
  formatarPct,
} from "@/lib/formato";
import { linhaDeFiltros, semanasAte } from "@/lib/marketing/periodo";
import {
  COLUNAS_FLUXO,
  efeitoDoEvento,
  FAIXAS_PERMANENCIA,
  type FiltroDias,
  faixasDePermanencia,
  finsDeSemana,
  fluxoPorDia,
  type LinhaDia,
  linhasDoPeriodo,
  linhasExportarFluxo,
  mapaDeCalor,
  nomeCurtoDoDia,
  nomeDoDia,
  ORDEM_DIAS,
  rotuloHora,
  totaisFluxo,
} from "@/lib/marketing/publico";
import { eventosDoCalendario, eventosPorDia } from "@/lib/marketing/radar";
import { parametros } from "@/server/marketing/base";
import { type Busca, lerFiltros } from "@/server/marketing/filtros";
import { dadosAsana, dadosPassagens } from "@/server/marketing/fontes";

export const metadata: Metadata = { title: "Público e visitação" };

const FONTE = "Estacionamento (WPS) e calendário de eventos do Asana";

export default function Page({
  searchParams,
}: PageProps<"/marketing/publico">) {
  return (
    <>
      <PageHeader
        title="Público e visitação"
        description="O fluxo de carros do estacionamento por dia e horário, cruzado com o calendário de eventos, para ver o efeito de cada evento."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="marketing.publico">
          <Tela busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Tela({ busca }: { busca: Promise<Busca> }) {
  const f = await lerFiltros("publico", await busca, "fim_de_semana");
  const { ctx, periodo, anterior } = f;
  const diaUrl = f.um("dia");
  const diaSemana = /^[0-6]$/.test(diaUrl) ? Number(diaUrl) : null;
  const soComEvento = f.um("evento") === "sim";
  const filtro: FiltroDias = { diaSemana, soComEvento };

  const [passagens, asana, params] = await Promise.all([
    dadosPassagens(),
    dadosAsana(),
    parametros(),
  ]);
  const { vagas, janela_recorrencia_dias: janela } = params;

  // Uma passada nas passagens (placa fica aqui no servidor); daqui em
  // diante só os dias agregados.
  const fluxo = fluxoPorDia(passagens, janela);
  const semanas = semanasAte(periodo.ate, 12);
  // Eventos do período anterior até o fim da semana do período (12 semanas).
  const inicio12 = semanas[0]?.de ?? anterior.de;
  const deEventos = inicio12 < anterior.de ? inicio12 : anterior.de;
  const ateEventos = semanas.at(-1)?.ate ?? periodo.ate;
  const eventosDoDia = new Map(
    [
      ...eventosPorDia(
        eventosDoCalendario(asana.tarefas, params, deEventos, ateEventos),
        deEventos,
        ateEventos,
      ),
    ].map(([d, es]) => [d, [...new Set(es.map((e) => e.nome))]]),
  );

  const linhas = linhasDoPeriodo(fluxo, periodo, vagas, eventosDoDia, filtro);
  const ant = linhasDoPeriodo(fluxo, anterior, vagas, eventosDoDia, filtro);
  const t = totaisFluxo(linhas, vagas);
  const ta = totaisFluxo(ant, vagas);

  const calor = mapaDeCalor(linhas);
  const faixas = faixasDePermanencia(linhas);
  const fds = finsDeSemana(fluxo, periodo.ate, 12, eventosDoDia);
  const efeito = efeitoDoEvento(fds);

  const linhaFiltros = linhaDeFiltros([
    { rotulo: "Período", valor: f.rotulo },
    {
      rotulo: "Dia da semana",
      valor: diaSemana === null ? "Todos" : nomeDoDia(diaSemana),
    },
    { rotulo: "Só dias com evento", valor: soComEvento ? "Sim" : "Não" },
  ]);
  const exportar = ctx.pode("marketing.exportar");

  return (
    <div className="flex flex-col gap-6">
      <BarraDeFiltros
        tela="publico"
        periodo={periodo}
        hoje={ctx.hoje}
        lembrado={f.lembrado}
        selecoes={[
          {
            chave: "dia",
            rotulo: "Dia da semana",
            todos: "Todos os dias",
            valor: diaUrl,
            icone: <CalendarDays className="size-4" />,
            opcoes: ORDEM_DIAS.map((d) => ({
              valor: String(d),
              rotulo: nomeDoDia(d),
            })),
          },
          {
            chave: "evento",
            rotulo: "Só dias com evento",
            todos: "Com e sem evento",
            valor: soComEvento ? "sim" : "",
            icone: <PartyPopper className="size-4" />,
            largura: "w-48",
            opcoes: [{ valor: "sim", rotulo: "Só dias com evento" }],
          },
        ]}
      />

      <TopoDaTela
        dadosDe={ctx.dadosDe}
        filtros={linhaFiltros}
        acoes={
          exportar ? (
            <BotaoExportar
              titulo="Fluxo do estacionamento"
              filtros={`${linhaFiltros} · ${ctx.dadosDe}`}
              nomeArquivo="fluxo-do-estacionamento"
              colunas={COLUNAS_FLUXO}
              linhas={linhasExportarFluxo(linhas, t)}
            />
          ) : undefined
        }
      />

      <Cartoes>
        <CartaoMkt
          titulo="Entradas de carros"
          valor={formatarNumero(t.entradas)}
          variacao={variacaoContra(t.entradas, ta.entradas, f.rotuloAnterior)}
          detalhe={`${t.dias} ${t.dias === 1 ? "dia" : "dias"} · pico às ${rotuloHora(t.horaPico) || "—"}`}
          fonte="Estacionamento (WPS)"
        />
        <CartaoMkt
          titulo="Média por dia"
          valor={t.mediaPorDia === null ? "—" : formatarNumero(t.mediaPorDia)}
          variacao={
            t.mediaPorDia !== null && ta.mediaPorDia !== null
              ? variacaoContra(t.mediaPorDia, ta.mediaPorDia, f.rotuloAnterior)
              : undefined
          }
          detalhe={`Ocupação máxima: ${formatarPct(t.ocupacaoPct)} de ${formatarNumero(vagas)} vagas`}
          fonte="Estacionamento (WPS); vagas em Configurações"
        />
        <CartaoMkt
          titulo="Permanência média"
          valor={
            t.permanenciaMedia === null
              ? "—"
              : formatarHoras(t.permanenciaMedia)
          }
          variacao={
            t.permanenciaMedia !== null && ta.permanenciaMedia !== null
              ? variacaoContra(
                  t.permanenciaMedia,
                  ta.permanenciaMedia,
                  f.rotuloAnterior,
                )
              : undefined
          }
          detalhe={
            t.permanenciaMediana === null
              ? undefined
              : `Mediana: ${formatarHoras(t.permanenciaMediana)}`
          }
          calculo="Média de saída − entrada dos carros que entraram no período."
          fonte="Estacionamento (WPS)"
        />
        <CartaoMkt
          titulo="Carros que voltaram"
          valor={formatarPct(t.voltaramPct)}
          variacao={
            t.voltaramPct !== null && ta.voltaramPct !== null
              ? variacaoContra(t.voltaramPct, ta.voltaramPct, f.rotuloAnterior)
              : undefined
          }
          detalhe={`${formatarNumero(t.voltaram)} entradas de placas já vistas`}
          calculo={`Entradas de placas que já tinham entrado nos ${janela} dias anteriores ÷ entradas. A placa só serve para essa conta e não aparece em lugar nenhum.`}
          fonte="Estacionamento (WPS); janela em Configurações"
        />
      </Cartoes>

      <Secao
        titulo="Dia a dia"
        descricao={`${f.rotulo} · uma linha por dia, com os eventos do calendário.`}
      >
        <TabelaMkt
          colunas={COLUNAS}
          ordemInicial={{ coluna: 0, desc: false }}
          placeholder="Buscar dia ou evento…"
          vazio="Nenhum dia nesse filtro."
          linhas={linhas.map((l) => ({
            chave: l.data,
            busca: `${formatarData(l.data)} ${nomeDoDia(l.diaSemana)} ${l.eventos.join(" ")}`,
            celulas: celulas(l),
            ordem: [
              l.data,
              l.eventos.join(", ") || null,
              l.entradas,
              l.horaPico,
              l.ocupacaoPct,
              l.permanenciaMedia,
              l.voltaramPct,
            ],
          }))}
          rodape={[
            "Total",
            `${t.dias} ${t.dias === 1 ? "dia" : "dias"}`,
            formatarNumero(t.entradas),
            rotuloHora(t.horaPico),
            formatarPct(t.ocupacaoPct),
            t.permanenciaMedia === null
              ? "—"
              : formatarHoras(t.permanenciaMedia),
            formatarPct(t.voltaramPct),
          ]}
        />
        <Fonte>
          {FONTE}. Ocupação máxima: maior quantidade de carros dentro ao mesmo
          tempo ÷ {formatarNumero(vagas)} vagas (Configurações). Carros que
          voltaram: placas que já tinham entrado nos {janela} dias anteriores.
          Campos do WPS a confirmar; se o WPS não tiver API, a alternativa é
          importar o relatório de passagens que ele já exporta (a confirmar com
          Operações).
        </Fonte>
      </Secao>

      <EfeitoDoEvento efeito={efeito} semanas={fds.length} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Secao
          titulo="Entradas por fim de semana"
          descricao="Sábado + domingo, últimas 12 semanas; em destaque os fins de semana com evento"
        >
          <ColunasEmpilhadas
            descricao="Entradas de carros por fim de semana, com e sem evento"
            pontos={fds.map((x) => ({
              chave: x.sabado,
              rotulo: `${x.sabado.slice(8, 10)}/${x.sabado.slice(5, 7)}`,
              titulo: `${formatarData(x.sabado)} e ${formatarData(x.domingo)}${x.eventos.length ? ` · ${x.eventos.join(", ")}` : " · sem evento"}`,
            }))}
            series={[
              {
                chave: "com",
                rotulo: "Com evento",
                cor: 1,
                valores: fds.map((x) => (x.eventos.length ? x.entradas : null)),
              },
              {
                chave: "sem",
                rotulo: "Sem evento",
                cor: "neutro",
                valores: fds.map((x) => (x.eventos.length ? null : x.entradas)),
              },
            ]}
          />
          <Fonte>{FONTE}</Fonte>
        </Secao>
        <Secao
          titulo="Quando os carros chegam"
          descricao={`Média de entradas por dia da semana e hora · ${f.rotulo}`}
        >
          {calor.dias.length ? (
            <MapaDeCalor
              descricao="Média de entradas por dia da semana e hora"
              rotuloValor="entradas em média"
              linhas={calor.dias.map(nomeCurtoDoDia)}
              colunas={calor.horas.map((h) => `${h}h`)}
              valores={calor.valores}
            />
          ) : (
            <p className="text-sm text-neutral-500">Sem entradas no período.</p>
          )}
          <Fonte>Estacionamento (WPS), hora da entrada</Fonte>
        </Secao>
        <Secao
          tom="verde"
          titulo="Quanto tempo ficam"
          descricao={`Carros por tempo de permanência${t.permanenciaMediana === null ? "" : ` · mediana ${formatarHoras(t.permanenciaMediana)}`}`}
        >
          <Faixas
            descricao="Carros por faixa de permanência"
            itens={FAIXAS_PERMANENCIA.map((fx, i) => ({
              chave: fx.chave,
              rotulo: fx.rotulo,
              valor: faixas[i] ?? 0,
              texto: formatarNumero(faixas[i] ?? 0),
            }))}
          />
          <Fonte>Estacionamento (WPS), saída − entrada</Fonte>
        </Secao>
      </div>
    </div>
  );
}

const COLUNAS = [
  { titulo: "Data" },
  { titulo: "Evento no dia", classe: "min-w-48 max-w-72 whitespace-normal" },
  { titulo: "Entradas", numero: true },
  { titulo: "Hora de pico", dica: "Hora com mais entradas" },
  {
    titulo: "Ocupação máxima",
    numero: true,
    dica: "Maior quantidade de carros dentro ao mesmo tempo ÷ vagas",
  },
  { titulo: "Permanência média", numero: true },
  {
    titulo: "Carros que voltaram",
    numero: true,
    dica: "Placas que já tinham entrado na janela de Configurações ÷ entradas",
  },
];

function celulas(l: LinhaDia): React.ReactNode[] {
  return [
    <span key="d" className="whitespace-nowrap tabular-nums">
      {formatarData(l.data)}
      <span className="block text-xs text-neutral-500">
        {nomeDoDia(l.diaSemana)}
      </span>
    </span>,
    l.eventos.length ? (
      <span key="e" className="font-medium">
        {l.eventos.join(", ")}
      </span>
    ) : (
      <span key="e" className="text-neutral-400">
        —
      </span>
    ),
    <span key="n" className="font-semibold">
      {formatarNumero(l.entradas)}
    </span>,
    rotuloHora(l.horaPico) || "—",
    l.ocupacaoPct === null ? (
      "—"
    ) : (
      <span
        key="o"
        title={`${l.dentroMax} carros dentro às ${l.horaDentroMax}`}
      >
        {formatarPct(l.ocupacaoPct)}
      </span>
    ),
    l.permanenciaMedia === null ? "—" : formatarHoras(l.permanenciaMedia),
    formatarPct(l.voltaramPct),
  ];
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <IndicadoresCarregando
        className="sm:grid-cols-2 xl:grid-cols-4"
        quantidade={4}
      />
      <CartaoCarregando altura="h-96" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CartaoCarregando altura="h-80" />
        <CartaoCarregando altura="h-80" />
      </div>
    </TelaCarregando>
  );
}
