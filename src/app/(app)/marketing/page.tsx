import { AlertTriangle, ArrowRight, Bell, Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { Colunas } from "@/components/dashboard/graficos/colunas";
import { ColunasEmpilhadas } from "@/components/dashboard/graficos/colunas-empilhadas";
import { Linhas } from "@/components/dashboard/graficos/linhas";
import { SeloStatus } from "@/components/dashboard/indicador";
import { Secao } from "@/components/dashboard/tabela";
import { BarraDeFiltros } from "@/components/marketing/filtros";
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
  formatarMoeda,
  formatarNumero,
  formatarPct,
} from "@/lib/formato";
import { status } from "@/lib/indicadores";
import { type Alerta, avaliarAlertas, NIVEIS } from "@/lib/marketing/alertas";
import { linhasDeCampanha, somar } from "@/lib/marketing/anuncios";
import {
  type LinhaResumo,
  linhasDoResumo,
  type UnidadeResumo,
} from "@/lib/marketing/painel";
import {
  linhaDeFiltros,
  mesesAte,
  paramsDoPeriodoMkt,
  semanasAte,
  somarDias,
} from "@/lib/marketing/periodo";
import { resumoPublico } from "@/lib/marketing/publico";
import { resumoRadar, tarefasDoTime } from "@/lib/marketing/radar";
import { resumoRedes } from "@/lib/marketing/redes";
import {
  fracaoDoMes,
  mesAteHoje,
  metaNoRitmo,
  resumoReputacao,
} from "@/lib/marketing/reputacao";
import { resumoSite } from "@/lib/marketing/site";
import {
  locatarios,
  metaMkt,
  parametros,
  regrasAlerta,
  temasEcodigos,
} from "@/server/marketing/base";
import {
  type Busca,
  interesseDasLandingPages,
  lerFiltros,
} from "@/server/marketing/filtros";
import {
  dadosAnuncios,
  dadosAsana,
  dadosPassagens,
  dadosRd,
  dadosRedes,
  dadosReputacao,
  dadosSite,
} from "@/server/marketing/fontes";

export const metadata: Metadata = { title: "Painel do Marketing" };

export default function Page({ searchParams }: PageProps<"/marketing">) {
  return (
    <>
      <PageHeader
        title="Painel do Marketing"
        description="A semana do Marketing numa tela: o que aconteceu, contra a semana anterior e a meta, e onde agir primeiro."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="marketing.painel">
          <Tela busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Tela({ busca }: { busca: Promise<Busca> }) {
  const f = await lerFiltros("painel", await busca, "semana_passada");
  const { ctx, periodo, anterior } = f;
  const { hoje, pode } = ctx;
  const mesAtual = `${hoje.slice(0, 7)}-01`;
  const mesDoPeriodo = mesesAte(periodo.ate, 1)[0] as string;

  const [
    anuncios,
    rd,
    site,
    redes,
    reputacao,
    asana,
    passagens,
    params,
    lista,
    { temas, codigos },
    regras,
    interesseDe,
    metaCpl,
    metaLeads,
    metaNovas,
    metaNota,
  ] = await Promise.all([
    dadosAnuncios(),
    dadosRd(),
    dadosSite(),
    dadosRedes(),
    dadosReputacao(),
    dadosAsana(),
    dadosPassagens(),
    parametros(),
    locatarios(),
    temasEcodigos(),
    regrasAlerta(),
    interesseDasLandingPages(),
    metaMkt("marketing.custo_por_lead", mesDoPeriodo),
    metaMkt("marketing.leads_mes", mesAtual),
    metaMkt("marketing.avaliacoes_novas_arp", mesAtual),
    metaMkt("marketing.nota_media_arp", mesAtual),
  ]);

  // Cada frente, na semana e na anterior.
  const campanhas = linhasDeCampanha(anuncios, rd.conversoes, periodo);
  const ads = somar(campanhas.linhas);
  const adsAnt = somar(
    linhasDeCampanha(anuncios, rd.conversoes, anterior).linhas,
  );
  const sit = resumoSite(site, rd, periodo, interesseDe);
  const sitAnt = resumoSite(site, rd, anterior, interesseDe);
  const leadsNoMes = resumoSite(
    site,
    rd,
    mesAteHoje(hoje),
    interesseDe,
  ).leadsUnicos;
  const red = resumoRedes(redes, periodo);
  const redAnt = resumoRedes(redes, anterior);
  const regraSemResposta = regras.find(
    (r) => r.regra === "avaliacao_sem_resposta" && r.ativa,
  );
  const rep = resumoReputacao({
    fontes: reputacao,
    locatarios: lista.filter((l) => l.ativo),
    parametros: params,
    temasCadastrados: temas.filter((t) => t.ativo).map((t) => t.nome),
    hoje,
    limiteSemRespostaDias: regraSemResposta?.limite ?? null,
  });
  const radar = resumoRadar(asana, params, codigos, regras, hoje);
  const pub = resumoPublico(passagens, params, hoje);
  const pubAnt = resumoPublico(passagens, params, somarDias(hoje, -7));

  const query = new URLSearchParams(paramsDoPeriodoMkt(periodo)).toString();
  const resumo = linhasDoResumo(
    {
      anuncios: {
        atual: ads,
        anterior: adsAnt,
        semCampanha: campanhas.semCampanha,
      },
      site: { atual: sit, anterior: sitAnt, leadsNoMes },
      redes: { atual: red, anterior: redAnt },
      reputacao: rep,
      radar,
      publico: { atual: pub, anterior: pubAnt },
      metas: {
        custoPorLead: metaCpl,
        leadsMes: metaLeads,
        avaliacoesNovas: metaNovas,
        notaMedia: metaNota,
      },
      hoje,
      query,
    },
    pode,
    { moeda: (v) => formatarMoeda(v), numero: (v) => formatarNumero(v) },
  );

  const diaDoMes = Number(hoje.slice(8, 10));
  const alertas = avaliarAlertas(
    regras,
    {
      sinalizacoesAbertas: radar.sinalizacoesAbertas,
      locatariosEmAlerta: rep.lojasEmAlerta.map((l) => ({
        id: l.id,
        nome: l.nome,
        reclamacoes: l.reclamacoes,
        tema: l.temaMaisCitado,
      })),
      avaliacoesSemResposta: rep.semResposta.map((a) => ({
        id: a.id,
        dias: a.dias,
        estrelas: a.estrelas,
      })),
      custoPorLead: { valor: ads.custoPorLead, meta: metaCpl?.meta ?? null },
      campanhasSemLead: campanhas.linhas
        .filter((l) => l.leadsRd === 0 && l.investimento > 0)
        .map((l) => ({ id: l.id, nome: l.nome, investimento: l.investimento })),
      avaliacoesNoMes: {
        realizado: rep.novasNoMes,
        meta: metaNovas?.meta ?? null,
        diaDoMes,
        diasNoMes: Math.round(diaDoMes / fracaoDoMes(hoje)),
      },
      tarefasAtrasadas: tarefasDoTime(
        asana.tarefas,
        params.asana_projetos_marketing,
        hoje,
      )
        .filter((t) => t.situacao === "atrasada")
        .map((t) => ({
          nome: t.nome,
          dias: t.diasAtraso ?? 0,
          link: "/marketing/radar?aba=tarefas&situacao=atrasadas",
        })),
      landingPagesSemTipo: sit.landingPagesSemTipo.map((lp) => ({
        identificador: lp.id,
        nome: lp.nome,
      })),
    },
    pode,
  );

  // 12 semanas até a do período, para os gráficos.
  const semanas = semanasAte(periodo.ate, 12);
  const pontos = semanas.map((s) => ({
    chave: s.de,
    rotulo: s.rotulo,
    titulo: `Semana de ${s.rotulo} a ${s.ate.slice(8, 10)}/${s.ate.slice(5, 7)}`,
  }));
  const leadsSemana = semanas.map((s) => resumoSite(site, rd, s, interesseDe));
  const cplSemana = semanas.map(
    (s) =>
      somar(linhasDeCampanha(anuncios, rd.conversoes, s).linhas).custoPorLead,
  );
  const fins = Array.from({ length: 12 }, (_, i) =>
    resumoPublico(passagens, params, somarDias(hoje, -7 * (11 - i))),
  );

  const linhaFiltros = linhaDeFiltros([{ rotulo: "Semana", valor: f.rotulo }]);
  const cartaoLeads = pode("marketing.site");

  return (
    <div className="flex flex-col gap-6">
      <BarraDeFiltros
        tela="painel"
        periodo={periodo}
        hoje={hoje}
        lembrado={f.lembrado}
        atalhos={["semana_passada", "esta_semana", "ultimos_30", "mes_passado"]}
        selecoes={[]}
      />

      <TopoDaTela
        dadosDe={ctx.dadosDe}
        filtros={linhaFiltros}
        acoes={
          pode("marketing.exportar") ? (
            <BotaoExportar
              titulo="Resumo semanal do Marketing"
              filtros={`${linhaFiltros} · ${ctx.dadosDe}`}
              nomeArquivo="resumo-semanal-marketing"
              colunas={COLUNAS_EXPORTAR}
              linhas={linhasExportar(resumo, alertas)}
            />
          ) : undefined
        }
      />

      <Cartoes>
        {pode("marketing.anuncios") && (
          <CartaoMkt
            titulo="Investimento em anúncios"
            valor={formatarMoeda(ads.investimento)}
            variacao={variacaoContra(
              ads.investimento,
              adsAnt.investimento,
              f.rotuloAnterior,
              "neutro",
            )}
            detalhe={`${campanhas.linhas.length} campanhas com gasto`}
            fonte="Meta Ads, Google Ads e TikTok Ads"
            href={`/marketing/anuncios?${query}`}
          />
        )}
        {cartaoLeads && (
          <CartaoMkt
            titulo="Leads no RD"
            valor={formatarNumero(sit.leadsUnicos)}
            variacao={variacaoContra(
              sit.leadsUnicos,
              sitAnt.leadsUnicos,
              f.rotuloAnterior,
            )}
            detalhe={`Evento ${formatarNumero(sit.leadsEvento)} · Locação ${formatarNumero(sit.leadsLocacao)}`}
            calculo="Contatos únicos que converteram em alguma landing page do RD Station no período."
            fonte="RD Station"
            href={`/marketing/site?${query}`}
          />
        )}
        {pode("marketing.anuncios") && (
          <CartaoMkt
            titulo="Custo por lead"
            valor={formatarMoeda(ads.custoPorLead)}
            variacao={
              ads.custoPorLead !== null && adsAnt.custoPorLead !== null
                ? variacaoContra(
                    ads.custoPorLead,
                    adsAnt.custoPorLead,
                    f.rotuloAnterior,
                    "menor_melhor",
                  )
                : undefined
            }
            status={
              metaCpl && ads.custoPorLead !== null
                ? status(ads.custoPorLead, metaCpl)
                : undefined
            }
            direcao="menor_melhor"
            meta={
              metaCpl
                ? `Meta: até ${formatarMoeda(metaCpl.meta)}`
                : "Defina a meta em Parâmetros"
            }
            calculo="Investimento ÷ leads do RD Station vindos das campanhas (traffic_campaign)."
            fonte="Anúncios e RD Station"
            href={`/marketing/anuncios?${query}&cartao=acima_meta`}
          />
        )}
        {pode("marketing.publico") && (
          <CartaoMkt
            titulo="Carros no último fim de semana"
            valor={formatarNumero(pub.entradas)}
            variacao={variacaoContra(
              pub.entradas,
              pubAnt.entradas,
              "fim de semana anterior",
            )}
            detalhe={`${formatarData(pub.de)} e ${formatarData(pub.ate)}${pub.ocupacaoMaxima !== null ? ` · ocupação máxima ${formatarPct(pub.ocupacaoMaxima)}` : ""}`}
            fonte="Estacionamento (cancelas)"
            href="/marketing/publico?periodo=fim_de_semana"
          />
        )}
      </Cartoes>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Secao
          className="xl:col-span-3"
          titulo="Resumo por frente"
          descricao={`${f.rotulo} contra a ${f.rotuloAnterior}. Clique numa linha para abrir a tela no mesmo período.`}
        >
          <TabelaMkt
            colunas={COLUNAS}
            semBusca
            vazio="Nenhuma tela do Marketing liberada para você além do Painel."
            linhas={resumo.map((l) => ({
              chave: l.chave,
              busca: `${l.frente} ${l.indicador}`,
              href: l.href,
              celulas: celulas(l),
              ordem: [
                l.frente,
                l.indicador,
                l.atual,
                l.anterior,
                l.variacao,
                l.meta?.valor ?? null,
              ],
            }))}
          />
          <Fonte>
            Anúncios: Meta, Google e TikTok Ads; leads: RD Station; site: Google
            Analytics 4; redes: Instagram, Facebook, YouTube e TikTok;
            reputação: Google Meu Negócio; radar: Asana; público:
            estacionamento. Reputação e radar não seguem a semana: mês até hoje
            ou foto de agora.
          </Fonte>
        </Secao>

        <Secao
          className="xl:col-span-2"
          titulo="Onde agir"
          descricao="Do mais grave ao mais leve. As regras e os limites ficam em Parâmetros."
        >
          <ListaDeAlertas alertas={alertas} />
          <Fonte>
            Regras de alerta de Parâmetros sobre os dados de cada tela
          </Fonte>
        </Secao>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {cartaoLeads && (
          <Secao
            titulo="Leads no RD por semana"
            descricao="Contatos únicos, pelo tipo da landing page"
          >
            <ColunasEmpilhadas
              pontos={pontos}
              descricao="Leads no RD por semana e interesse, últimas 12 semanas"
              series={[
                {
                  chave: "evento",
                  rotulo: "Evento",
                  cor: 1,
                  valores: leadsSemana.map((s) => s.leadsEvento),
                },
                {
                  chave: "locacao",
                  rotulo: "Locação",
                  cor: 2,
                  valores: leadsSemana.map((s) => s.leadsLocacao),
                },
                {
                  chave: "outros",
                  rotulo: "Outros",
                  cor: "neutro",
                  valores: leadsSemana.map((s) =>
                    Math.max(0, s.leadsUnicos - s.leadsEvento - s.leadsLocacao),
                  ),
                },
              ]}
            />
            <Fonte>RD Station; tipo da landing page em Parâmetros</Fonte>
          </Secao>
        )}
        {pode("marketing.anuncios") && (
          <Secao
            titulo="Custo por lead por semana"
            descricao="Investimento ÷ leads do RD, com a linha da meta"
          >
            <Linhas
              pontos={pontos}
              unidade="moeda"
              descricao="Custo por lead por semana, últimas 12 semanas"
              series={[
                {
                  chave: "cpl",
                  rotulo: "Custo por lead",
                  cor: 1,
                  valores: cplSemana,
                },
              ]}
              meta={
                metaCpl
                  ? {
                      valor: metaCpl.meta,
                      texto: `Meta ${formatarMoeda(metaCpl.meta, 0)}`,
                    }
                  : undefined
              }
            />
            <Fonte>Anúncios e RD Station; meta em Parâmetros</Fonte>
          </Secao>
        )}
        {pode("marketing.publico") && (
          <Secao
            titulo="Carros por fim de semana"
            descricao="Entradas de sábado e domingo, últimos 12 fins de semana"
          >
            <Colunas
              descricao="Carros que entraram no estacionamento por fim de semana"
              itens={fins.map((x) => ({
                chave: x.de,
                rotulo: `${x.de.slice(8, 10)}/${x.de.slice(5, 7)}`,
                titulo: `${formatarData(x.de)} e ${formatarData(x.ate)}`,
                valor: x.entradas,
                texto: `${formatarNumero(x.entradas)} carros`,
                detalhe:
                  x.ocupacaoMaxima !== null
                    ? `Ocupação máxima ${formatarPct(x.ocupacaoMaxima)}`
                    : undefined,
              }))}
            />
            <Fonte>Estacionamento (cancelas); vagas em Parâmetros</Fonte>
          </Secao>
        )}
      </div>

      {pode("marketing.reputacao") && metaNovas && (
        <p className="text-xs text-neutral-500">
          Avaliações novas da ARP no mês: {formatarNumero(rep.novasNoMes)} de{" "}
          {formatarNumero(metaNovas.meta)} (no ritmo, já seriam{" "}
          {formatarNumero(Math.floor(metaNoRitmo(metaNovas, hoje).meta))}).
        </p>
      )}
    </div>
  );
}

const COLUNAS = [
  { titulo: "Frente" },
  { titulo: "Indicador", classe: "min-w-52 whitespace-normal" },
  { titulo: "Semana", numero: true },
  { titulo: "Anterior", numero: true },
  { titulo: "Variação", numero: true },
  { titulo: "Meta", numero: true },
];

function valor(v: number | null, u: UnidadeResumo): string {
  if (v === null) return "—";
  if (u === "moeda") return formatarMoeda(v);
  if (u === "pct") return formatarPct(v);
  if (u === "nota") return formatarNumero(v, 1);
  return formatarNumero(v);
}

function celulas(l: LinhaResumo): React.ReactNode[] {
  const ruim =
    l.variacao !== null &&
    Math.abs(l.variacao) >= 0.05 &&
    (l.direcao === "menor_melhor" ? l.variacao > 0 : l.variacao < 0);
  return [
    <span key="f" className="whitespace-nowrap text-neutral-500">
      {l.frente}
    </span>,
    <span key="i">
      <span className="font-medium">{l.indicador}</span>
      {l.quando && (
        <span className="ml-1.5 text-xs text-neutral-400">({l.quando})</span>
      )}
    </span>,
    <span key="a" className="font-semibold">
      {valor(l.atual, l.unidade)}
    </span>,
    <span key="b" className="text-neutral-500">
      {l.anterior === null ? "" : valor(l.anterior, l.unidade)}
    </span>,
    l.variacao === null ? (
      ""
    ) : (
      <span key="v" className={ruim ? "font-medium text-red-700" : ""}>
        {`${l.variacao > 0 ? "+" : ""}${formatarNumero(l.variacao, 1)}%`}
      </span>
    ),
    l.meta ? (
      <span key="m" className="inline-flex items-center justify-end gap-2">
        <span className="text-neutral-500">{l.meta.texto}</span>
        {l.status && l.status !== "sem_dado" && l.status !== "sem_meta" && (
          <SeloStatus
            status={l.status}
            direcao={l.direcao === "neutro" ? undefined : l.direcao}
          />
        )}
      </span>
    ) : (
      ""
    ),
  ];
}

const ICONE_NIVEL = {
  urgente: { icone: AlertTriangle, classe: "bg-red-600/10 text-red-700" },
  atencao: { icone: Bell, classe: "bg-amber-500/15 text-amber-800" },
  aviso: { icone: Info, classe: "bg-neutral-900/[0.06] text-neutral-600" },
} as const;

function ListaDeAlertas({ alertas }: { alertas: Alerta[] }) {
  if (!alertas.length)
    return (
      <p className="py-6 text-center text-sm text-neutral-500">
        Nada pedindo atenção agora nas telas liberadas para você.
      </p>
    );
  return (
    <ul className="flex flex-col gap-2">
      {alertas.map((a) => {
        const { icone: Icone, classe } = ICONE_NIVEL[a.nivel];
        return (
          <li key={a.chave}>
            <Link
              href={a.href}
              className="group flex gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-neutral-900/[0.04]"
            >
              <span
                className={`mt-0.5 inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-semibold ${classe}`}
              >
                <Icone className="size-3.5" aria-hidden />
                {NIVEIS[a.nivel].rotulo}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-neutral-900">
                  {a.titulo}
                </span>
                <span className="block text-xs text-neutral-500">
                  {a.descricao}
                </span>
              </span>
              <ArrowRight
                className="mt-1 size-4 shrink-0 text-neutral-300 transition-colors group-hover:text-neutral-600"
                aria-hidden
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

const COLUNAS_EXPORTAR = [
  { titulo: "Frente" },
  { titulo: "Indicador" },
  { titulo: "Semana" },
  { titulo: "Anterior" },
  { titulo: "Variação" },
  { titulo: "Meta" },
];

/** O resumo da tela e, embaixo, os alertas: cabe numa página A4. */
function linhasExportar(resumo: LinhaResumo[], alertas: Alerta[]) {
  return [
    ...resumo.map((l) => [
      l.frente,
      l.quando ? `${l.indicador} (${l.quando})` : l.indicador,
      valor(l.atual, l.unidade),
      l.anterior === null ? "" : valor(l.anterior, l.unidade),
      l.variacao === null
        ? ""
        : `${l.variacao > 0 ? "+" : ""}${formatarNumero(l.variacao, 1)}%`,
      l.meta?.texto ?? "",
    ]),
    ...alertas.map((a) => [
      `Alerta: ${NIVEIS[a.nivel].rotulo}`,
      a.titulo,
      "",
      "",
      "",
      "",
    ]),
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
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <CartaoCarregando altura="h-96" className="xl:col-span-3" />
        <CartaoCarregando altura="h-96" className="xl:col-span-2" />
      </div>
    </TelaCarregando>
  );
}
