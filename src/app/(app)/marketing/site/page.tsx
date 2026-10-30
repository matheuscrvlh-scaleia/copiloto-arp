import { Filter, Globe, Route, Sparkles, Target } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { BarrasHorizontais } from "@/components/dashboard/graficos/barras-horizontais";
import { ColunasEmpilhadas } from "@/components/dashboard/graficos/colunas-empilhadas";
import { Funil } from "@/components/dashboard/graficos/funil";
import type { CorSerie } from "@/components/dashboard/graficos/series";
import { Secao } from "@/components/dashboard/tabela";
import { BarraDeFiltros } from "@/components/marketing/filtros";
import { TabelaMkt } from "@/components/marketing/tabela";
import {
  CartaoMkt,
  Cartoes,
  Fonte,
  hrefCom,
  TopoDaTela,
  variacaoContra,
} from "@/components/marketing/tela";
import { type Detalhe, ProvedorDetalhe } from "@/components/modal-detalhe";
import { BotaoExportar } from "@/components/os/exportar";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { formatarNumero, formatarPct } from "@/lib/formato";
import { linhaDeFiltros, semanasAte } from "@/lib/marketing/periodo";
import {
  type BuscaTermo,
  buscasDoPeriodo,
  type CanalLinha,
  COR_CANAL,
  cidadesDosLeads,
  colunasLeads,
  contarLeads,
  dataHoraDoLead,
  etapasDosLeads,
  ga4Do,
  type InteresseLp,
  type LandingPageLinha,
  type LeadLinha,
  leadsDoPeriodo,
  leadsPorInteresse,
  linhasDeCanal,
  linhasDeLandingPage,
  linhasExportarLeads,
  minutosESegundos,
  quebraDoCanal,
  rotuloCanal,
  rotuloInteresse,
  type Trafego,
  totalTrafego,
} from "@/lib/marketing/site";
import {
  type Busca,
  INTERESSES,
  type Interesse,
  interesseDasLandingPages,
  lerFiltros,
} from "@/server/marketing/filtros";
import { dadosRd, dadosSite } from "@/server/marketing/fontes";

export const metadata: Metadata = { title: "Site e leads" };

const BASE = "/marketing/site";
const GA4 = "Google Analytics 4";
const RD = "RD Station Marketing";

export default function Page({ searchParams }: PageProps<"/marketing/site">) {
  return (
    <>
      <PageHeader
        title="Site e leads"
        description="O site e as landing pages estão gerando contato? Tráfego do site, conversões do RD Station e quem quer Evento ou Locação."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="marketing.site">
          <Tela busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

const ORDEM_INTERESSES: Interesse[] = [
  "evento",
  "locacao",
  "outro",
  "sem_tipo",
];
const COR_INTERESSE: Record<InteresseLp, CorSerie> = {
  evento: 1,
  locacao: 2,
  outro: 3,
  sem_tipo: "neutro",
};
const ETAPAS = ["Lead", "Lead qualificado", "Cliente"];

async function Tela({ busca }: { busca: Promise<Busca> }) {
  const f = await lerFiltros("site", await busca, "semana_passada");
  const { ctx, periodo, anterior } = f;
  const canal = f.um("canal");
  const interesse = f.um("interesse") as Interesse | "";
  const lp = f.um("lp");
  const etapa = f.um("etapa");
  const cartao = f.um("cartao") as "evento" | "locacao" | "";
  // Sem a permissão, nome, e-mail e telefone nem saem do servidor.
  const comContato = ctx.pode("marketing.site.dados_lead");

  const [site, rd, interesseDe] = await Promise.all([
    dadosSite(),
    dadosRd(),
    interesseDasLandingPages(),
  ]);

  const filtroLeads = { interesse, landingPage: lp, canal, etapa };
  const leads = leadsDoPeriodo(
    rd,
    periodo,
    interesseDe,
    comContato,
    filtroLeads,
  );
  const c = contarLeads(leads);
  const ca = contarLeads(
    leadsDoPeriodo(rd, anterior, interesseDe, false, filtroLeads),
  );
  const t = totalTrafego(ga4Do(site.ga4, periodo, canal));
  const ta = totalTrafego(ga4Do(site.ga4, anterior, canal));
  const canais = linhasDeCanal(site.ga4, periodo, canal);
  const lps = linhasDeLandingPage(rd.landingPages, periodo, interesseDe, {
    interesse,
    landingPage: lp,
  });
  const tlp = somarLps(lps);
  const buscas = buscasDoPeriodo(site.buscas, periodo);
  const lista = cartao ? leads.filter((l) => l.interesse === cartao) : leads;

  // 12 semanas até a semana do fim do período.
  const semanas = semanasAte(periodo.ate, 12);
  const pontos = semanas.map((s) => ({
    chave: s.de,
    rotulo: s.rotulo,
    titulo: `Semana de ${s.rotulo} a ${s.ate.slice(8, 10)}/${s.ate.slice(5, 7)}`,
  }));
  const leadsSemana = semanas.map((s) =>
    leadsPorInteresse(leadsDoPeriodo(rd, s, interesseDe, false, filtroLeads)),
  );
  const seriesLeads = ORDEM_INTERESSES.filter(
    (i) => !interesse || i === interesse,
  ).map((i) => ({
    chave: i,
    rotulo: INTERESSES[i],
    cor: COR_INTERESSE[i],
    valores: leadsSemana.map((s) => s[i]),
  }));
  const canaisSemana = semanas.map((s) => linhasDeCanal(site.ga4, s, canal));
  const comCor = Object.keys(COR_CANAL);
  const seriesCanais = [
    ...comCor
      .filter((k) => !canal || k === canal)
      .map((k) => ({
        chave: k,
        rotulo: rotuloCanal(k),
        cor: COR_CANAL[k] as CorSerie,
        valores: canaisSemana.map(
          (ls) => ls.find((l) => l.canal === k)?.sessoes ?? 0,
        ),
      })),
    ...(canal && comCor.includes(canal)
      ? []
      : [
          {
            chave: "outros",
            rotulo: canal ? rotuloCanal(canal) : "Outros canais",
            cor: "neutro" as const,
            valores: canaisSemana.map((ls) =>
              ls
                .filter((l) => !comCor.includes(l.canal))
                .reduce((s, l) => s + l.sessoes, 0),
            ),
          },
        ]),
  ];
  const cidades = cidadesDosLeads(leads);
  const etapas = etapasDosLeads(leads);

  // Opções dos filtros (todo o histórico das fontes).
  const opcoesCanal = [
    ...new Set(site.ga4.map((l) => l.sessionDefaultChannelGroup)),
  ]
    .map((v) => ({ valor: v, rotulo: rotuloCanal(v) }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  const nomesLp = new Map(
    rd.landingPages.map((l) => [l.conversion_identifier, l.nome]),
  );
  const opcoesLp = [...nomesLp.entries()]
    .map(([valor, rotulo]) => ({ valor, rotulo }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));

  const linhaFiltros = linhaDeFiltros([
    { rotulo: "Período", valor: f.rotulo },
    { rotulo: "Canal de origem", valor: canal ? rotuloCanal(canal) : "Todos" },
    { rotulo: "Interesse", valor: interesse ? INTERESSES[interesse] : "Todos" },
    {
      rotulo: "Landing page",
      valor: lp ? (nomesLp.get(lp) ?? lp) : "Todas",
    },
    { rotulo: "Etapa do funil", valor: etapa || "Todas" },
    ...(cartao
      ? [{ rotulo: "Cartão", valor: `Leads de ${INTERESSES[cartao]}` }]
      : []),
  ]);
  const hrefCartao = (k: string) =>
    hrefCom(BASE, f.busca, { cartao: cartao === k ? null : k });
  const exportar = ctx.pode("marketing.exportar");
  const colsLeads = colunasLeads(comContato);

  return (
    <ProvedorDetalhe exportar={exportar}>
      <div className="flex flex-col gap-6">
        <BarraDeFiltros
          tela="site"
          periodo={periodo}
          hoje={ctx.hoje}
          lembrado={f.lembrado}
          selecoes={[
            {
              chave: "canal",
              rotulo: "Canal de origem",
              todos: "Todos os canais",
              valor: canal,
              icone: <Globe className="size-4" />,
              largura: "w-48",
              opcoes: opcoesCanal,
            },
            {
              chave: "interesse",
              rotulo: "Interesse",
              todos: "Todos os interesses",
              valor: interesse,
              icone: <Target className="size-4" />,
              opcoes: ORDEM_INTERESSES.map((i) => ({
                valor: i,
                rotulo: INTERESSES[i],
              })),
            },
            {
              chave: "lp",
              rotulo: "Landing page",
              todos: "Todas as landing pages",
              valor: lp,
              icone: <Route className="size-4" />,
              largura: "w-56",
              opcoes: opcoesLp,
            },
            {
              chave: "etapa",
              rotulo: "Etapa do funil",
              todos: "Todas as etapas",
              valor: etapa,
              icone: <Filter className="size-4" />,
              opcoes: ETAPAS.map((e) => ({ valor: e, rotulo: e })),
            },
          ]}
        />

        <TopoDaTela
          dadosDe={ctx.dadosDe}
          filtros={linhaFiltros}
          reais={rd.lidoEm ? "leads e landing pages do RD Station" : undefined}
          acoes={
            exportar ? (
              <>
                <BotaoExportar
                  titulo="Leads do período"
                  filtros={`${linhaFiltros} · ${ctx.dadosDe}`}
                  nomeArquivo="leads-do-periodo"
                  colunas={colsLeads}
                  linhas={linhasExportarLeads(lista, comContato)}
                />
                <BotaoExportar
                  titulo="Site e landing pages"
                  filtros={`${linhaFiltros} · ${ctx.dadosDe}`}
                  nomeArquivo="site-e-landing-pages"
                  colunas={COLUNAS_EXPORTAR_SITE}
                  linhas={linhasExportarSite(canais, t, lps, tlp, buscas)}
                />
              </>
            ) : undefined
          }
        />

        <Cartoes>
          <CartaoMkt
            titulo="Sessões no site"
            valor={formatarNumero(t.sessoes)}
            variacao={variacaoContra(t.sessoes, ta.sessoes, f.rotuloAnterior)}
            detalhe={`Taxa de engajamento ${formatarPct(t.taxaEngajamento)}`}
            fonte={GA4}
          />
          <CartaoMkt
            titulo="Leads no RD (contatos únicos)"
            valor={formatarNumero(c.unicos)}
            variacao={variacaoContra(c.unicos, ca.unicos, f.rotuloAnterior)}
            detalhe={`${formatarNumero(c.conversoes)} ${c.conversoes === 1 ? "conversão" : "conversões"} (o mesmo contato pode converter em mais de uma landing page)`}
            calculo="Contatos diferentes que converteram no período. A lista abaixo tem uma linha por conversão."
            fonte={RD}
            href={cartao ? hrefCom(BASE, f.busca, { cartao: null }) : undefined}
          />
          <CartaoMkt
            titulo="Leads de Locação"
            valor={formatarNumero(c.locacao)}
            variacao={variacaoContra(c.locacao, ca.locacao, f.rotuloAnterior)}
            calculo="Contatos únicos que converteram numa landing page cadastrada como Locação em Configurações."
            fonte={`${RD} e Configurações`}
            href={hrefCartao("locacao")}
            ativo={cartao === "locacao"}
          />
          <CartaoMkt
            titulo="Leads de Evento"
            valor={formatarNumero(c.evento)}
            variacao={variacaoContra(c.evento, ca.evento, f.rotuloAnterior)}
            calculo="Contatos únicos que converteram numa landing page cadastrada como Evento em Configurações."
            fonte={`${RD} e Configurações`}
            href={hrefCartao("evento")}
            ativo={cartao === "evento"}
          />
        </Cartoes>

        <Secao
          titulo="Tráfego por canal"
          descricao={`${f.rotulo} · clique no canal para ver a quebra por origem/mídia e campanha.`}
        >
          <TabelaMkt
            colunas={COLUNAS_CANAL}
            ordemInicial={{ coluna: 1, desc: true }}
            placeholder="Buscar canal…"
            vazio="Nenhuma sessão nesse filtro."
            linhas={canais.map((l) => ({
              chave: l.canal,
              busca: `${l.rotulo} ${l.canal}`,
              detalhe: detalheDoCanal(site.ga4, periodo, l, f.rotulo),
              celulas: [
                <span key="c" className="font-medium">
                  {l.rotulo}
                </span>,
                ...celulasTrafego(l),
              ],
              ordem: [
                l.rotulo,
                l.sessoes,
                l.usuarios,
                l.novos,
                l.taxaEngajamento,
                l.tempoMedio,
                l.eventosChave,
              ],
            }))}
            rodape={["Total", ...celulasTrafego(t)]}
          />
          <Fonte>
            {GA4} (sessionDefaultChannelGroup). Usuários somados dia a dia: quem
            volta em outro dia conta de novo. Eventos-chave: a confirmar quais
            estão configurados no site.
          </Fonte>
        </Secao>

        <Secao
          tom="escuro"
          titulo="Landing pages do RD"
          descricao={`${f.rotulo} · o interesse vem do cadastro em Configurações; landing page sem cadastro aparece como "Sem tipo".`}
        >
          <TabelaMkt
            colunas={COLUNAS_LP}
            ordemInicial={{ coluna: 3, desc: true }}
            placeholder="Buscar landing page…"
            vazio="Nenhuma landing page com visita nesse filtro."
            linhas={lps.map((l) => ({
              chave: l.id,
              busca: `${l.nome} ${rotuloInteresse(l.interesse)}`,
              tom: l.interesse === "sem_tipo" ? "atencao" : undefined,
              celulas: [
                <span key="n" className="font-medium">
                  {l.nome}
                </span>,
                l.interesse === "sem_tipo" ? (
                  <span key="i" className="text-amber-900">
                    Sem tipo · cadastre em Configurações
                  </span>
                ) : (
                  rotuloInteresse(l.interesse)
                ),
                formatarNumero(l.visitas),
                <span key="c" className="font-semibold">
                  {formatarNumero(l.conversoes)}
                </span>,
                formatarPct(l.taxa),
              ],
              ordem: [
                l.nome,
                rotuloInteresse(l.interesse),
                l.visitas,
                l.conversoes,
                l.taxa,
              ],
            }))}
            rodape={[
              "Total",
              `${lps.length} landing pages`,
              formatarNumero(tlp.visitas),
              formatarNumero(tlp.conversoes),
              formatarPct(tlp.taxa),
            ]}
          />
          <Fonte>
            {RD} (visits_count, conversion_count) e cadastro de landing pages em
            Configurações. Linha em amarelo: landing page sem tipo.
          </Fonte>
        </Secao>

        <Secao
          titulo="Leads do período"
          descricao={`${f.rotulo} · uma linha por conversão, a mais recente primeiro${cartao ? ` · só ${INTERESSES[cartao]}` : ""}.${comContato ? "" : " Nome, e-mail e telefone só para quem tem a permissão de ver dados do lead."}`}
        >
          <TabelaMkt
            colunas={colsLeads}
            ordemInicial={{ coluna: 0, desc: true }}
            placeholder="Buscar nos leads…"
            vazio="Nenhuma conversão nesse filtro."
            alturaMax="max-h-[36rem]"
            linhas={lista.map((l) => ({
              chave: l.evento,
              busca: buscaDoLead(l),
              celulas: celulasDoLead(l, comContato),
              ordem: [
                l.data,
                ...(comContato
                  ? [l.nome ?? "", l.email ?? "", l.telefone ?? ""]
                  : [l.numero]),
                l.cidade,
                l.nomeLandingPage,
                rotuloInteresse(l.interesse),
                l.origem,
                l.campanha || null,
                l.etapa,
              ],
            }))}
            rodape={[
              "Total",
              `${formatarNumero(lista.length)} conversões · ${formatarNumero(contarLeads(lista).unicos)} contatos`,
            ]}
          />
          <Fonte>
            {RD} (conversões, traffic_source / traffic_medium, traffic_campaign
            e lifecycle_stage). A etapa do funil é a de hoje no RD.
          </Fonte>
        </Secao>

        <Secao
          titulo="Buscas no Google que trazem ao site"
          descricao={`${f.rotulo} · os 20 termos com mais cliques. "Oportunidade": já na 1ª página (posição 4 a 10), aparece bastante e quase ninguém clica.`}
        >
          <TabelaMkt
            colunas={COLUNAS_BUSCA}
            ordemInicial={{ coluna: 1, desc: true }}
            placeholder="Buscar termo…"
            vazio="Nenhuma busca no período."
            linhas={buscas.map((b) => ({
              chave: b.termo,
              busca: b.termo,
              celulas: [
                <span key="t" className="flex items-center gap-2">
                  <span className="font-medium">{b.termo}</span>
                  {b.oportunidade && <SeloOportunidade />}
                </span>,
                formatarNumero(b.cliques),
                formatarNumero(b.impressoes),
                formatarPct(b.ctr),
                b.posicao === null ? "—" : formatarNumero(b.posicao, 1),
              ],
              ordem: [b.termo, b.cliques, b.impressoes, b.ctr, b.posicao],
            }))}
          />
          <Fonte>
            Google Search Console (query, clicks, impressions, ctr, position).
            Posição média ponderada pelas impressões. Os filtros de canal,
            interesse e landing page não se aplicam às buscas.
          </Fonte>
        </Secao>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Secao
            tom="escuro"
            titulo="Leads por semana, por interesse"
            calculo="Contatos únicos que converteram no RD Station em cada semana, pelo interesse da landing page (Configurações › Landing pages). Quem converteu em Evento e em Locação na mesma semana conta nas duas cores. Últimas 12 semanas. Fonte: RD Station."
            exemplo={!rd.lidoEm && "o RD Station ainda não foi sincronizado"}
            descricao="Últimas 12 semanas, contatos únicos em cada semana"
          >
            <ColunasEmpilhadas
              pontos={pontos}
              series={seriesLeads}
              descricao="Leads únicos por semana e interesse da landing page, últimas 12 semanas"
            />
            <Fonte>
              {RD} e Configurações. Quem converteu em Evento e em Locação na
              mesma semana aparece nas duas cores.
            </Fonte>
          </Secao>
          <Secao
            tom="verde"
            titulo="Sessões por canal"
            calculo="Sessões no site em cada semana por canal (sessionDefaultChannelGroup: busca orgânica, social pago, direto, indicação…). Últimas 12 semanas. Fonte: Google Analytics 4."
            exemplo={
              "sessões do Google Analytics 4, até a ferramenta ser ligada"
            }
            descricao="Últimas 12 semanas"
          >
            <ColunasEmpilhadas
              pontos={pontos}
              series={seriesCanais}
              descricao="Sessões no site por semana e canal, últimas 12 semanas"
            />
            <Fonte>{GA4}</Fonte>
          </Secao>
          <Secao
            titulo="Do site ao cliente"
            calculo="Etapas no período: sessões no site (GA4) → visitas às landing pages (RD) → conversões (RD) → contatos que converteram e hoje são lead qualificado ou cliente (RD) → clientes (RD). Cada etapa mostra a passagem para a seguinte. Fontes diferentes: a passagem é uma indicação, não um rastreio pessoa a pessoa."
            exemplo={
              "sessões do Google Analytics 4 (visitas, conversões e etapas vêm do RD Station)"
            }
            descricao={`${f.rotulo} · cada etapa com a passagem para a seguinte`}
          >
            <Funil
              descricao="Funil: sessões, visitas às landing pages, conversões, leads qualificados e clientes"
              etapas={[
                {
                  chave: "sessoes",
                  rotulo: "Sessões no site",
                  valor: t.sessoes,
                },
                {
                  chave: "visitas",
                  rotulo: "Visitas às landing pages",
                  valor: tlp.visitas,
                },
                {
                  chave: "conversoes",
                  rotulo: "Conversões",
                  valor: c.conversoes,
                },
                {
                  chave: "qualificados",
                  rotulo: "Lead qualificado ou cliente",
                  valor: etapas.qualificados,
                },
                {
                  chave: "clientes",
                  rotulo: "Cliente",
                  valor: etapas.clientes,
                },
              ]}
            />
            <Fonte>
              {GA4} (sessões) e {RD} (visitas, conversões e etapa de hoje dos
              contatos que converteram no período). Fontes diferentes: a
              passagem é uma indicação, não um rastreio pessoa a pessoa.
            </Fonte>
          </Secao>
          <Secao
            titulo="De onde vêm os leads"
            calculo="Contatos únicos que converteram no período, pela cidade e UF do cadastro no RD Station (city, state); as 10 maiores. Contato sem cidade entra em Sem cidade (os formulários da ARP não pedem cidade). Fonte: RD Station."
            exemplo={!rd.lidoEm && "o RD Station ainda não foi sincronizado"}
            descricao={`${f.rotulo} · as 10 cidades com mais contatos`}
          >
            <BarrasHorizontais
              descricao="Leads únicos por cidade, 10 maiores"
              vazio="Nenhum lead no período."
              itens={cidades.map((x) => ({
                chave: x.cidade,
                rotulo: x.cidade,
                valor: x.leads,
                texto: `${formatarNumero(x.leads)} ${x.leads === 1 ? "lead" : "leads"}`,
              }))}
            />
            <Fonte>{RD} (city, state do contato)</Fonte>
          </Secao>
        </div>
      </div>
    </ProvedorDetalhe>
  );
}

function SeloOportunidade() {
  return (
    <span
      title="Posição 4 a 10, impressões acima da mediana da lista e CTR abaixo do da lista"
      className="inline-flex items-center gap-1 rounded-full bg-violet-400/20 px-2 py-0.5 text-[11px] font-medium text-violet-800"
    >
      <Sparkles className="size-3" aria-hidden />
      Oportunidade
    </span>
  );
}

function celulasTrafego(t: Trafego): React.ReactNode[] {
  return [
    formatarNumero(t.sessoes),
    formatarNumero(t.usuarios),
    formatarNumero(t.novos),
    formatarPct(t.taxaEngajamento),
    minutosESegundos(t.tempoMedio),
    formatarNumero(t.eventosChave),
  ];
}

function detalheDoCanal(
  ga4: Parameters<typeof quebraDoCanal>[0],
  periodo: Parameters<typeof quebraDoCanal>[1],
  l: CanalLinha,
  rotuloPeriodo: string,
): Detalhe {
  const tabela = (por: "origem" | "campanha", titulo: string) => ({
    titulo,
    colunas: [
      { titulo: por === "origem" ? "Origem / mídia" : "Campanha" },
      { titulo: "Sessões", numero: true },
      { titulo: "Taxa de engajamento", numero: true },
      { titulo: "Tempo médio", numero: true },
      { titulo: "Eventos-chave", numero: true },
    ],
    linhas: quebraDoCanal(ga4, periodo, l.canal, por).map((q) => ({
      chave: q.chave,
      celulas: [
        q.chave,
        formatarNumero(q.trafego.sessoes),
        formatarPct(q.trafego.taxaEngajamento),
        minutosESegundos(q.trafego.tempoMedio),
        formatarNumero(q.trafego.eventosChave),
      ],
      ordem: [
        q.chave,
        q.trafego.sessoes,
        q.trafego.taxaEngajamento,
        q.trafego.tempoMedio,
        q.trafego.eventosChave,
      ],
    })),
  });
  return {
    secao: "Tráfego por canal",
    titulo: l.rotulo,
    subtitulo: rotuloPeriodo,
    resumo: [
      { rotulo: "Sessões", valor: formatarNumero(l.sessoes) },
      { rotulo: "Usuários", valor: formatarNumero(l.usuarios) },
      { rotulo: "Taxa de engajamento", valor: formatarPct(l.taxaEngajamento) },
      { rotulo: "Eventos-chave", valor: formatarNumero(l.eventosChave) },
    ],
    fontes: [
      {
        rotulo: "Fonte",
        valor: `${GA4} (sessionSourceMedium, sessionCampaignName)`,
      },
    ],
    tabelas: [
      tabela("origem", "Por origem / mídia"),
      tabela("campanha", "Por campanha"),
    ],
  };
}

function buscaDoLead(l: LeadLinha): string {
  return [
    l.nome,
    l.email,
    l.telefone,
    `Lead nº ${l.numero}`,
    l.cidade,
    l.uf,
    l.nomeLandingPage,
    rotuloInteresse(l.interesse),
    l.origem,
    l.campanha,
    l.etapa,
  ]
    .filter(Boolean)
    .join(" ");
}

function celulasDoLead(l: LeadLinha, comContato: boolean): React.ReactNode[] {
  return [
    <span key="d" className="whitespace-nowrap tabular-nums">
      {dataHoraDoLead(l.data)}
    </span>,
    ...(comContato
      ? [
          <span key="n" className="font-medium">
            {l.nome}
          </span>,
          l.email ?? "",
          <span key="t" className="whitespace-nowrap">
            {l.telefone}
          </span>,
        ]
      : [
          <span key="n" className="font-medium">
            Lead nº {l.numero}
          </span>,
        ]),
    l.cidade ? `${l.cidade}/${l.uf}` : "",
    l.nomeLandingPage,
    l.interesse === "sem_tipo" ? (
      <span key="i" className="text-amber-900">
        Sem tipo
      </span>
    ) : (
      rotuloInteresse(l.interesse)
    ),
    l.origem,
    l.campanha || (
      <span key="c" className="text-neutral-400">
        sem campanha
      </span>
    ),
    l.etapa,
  ];
}

interface TotalLps {
  visitas: number;
  conversoes: number;
  taxa: number | null;
}

function somarLps(ls: LandingPageLinha[]): TotalLps {
  const visitas = ls.reduce((s, l) => s + l.visitas, 0);
  const conversoes = ls.reduce((s, l) => s + l.conversoes, 0);
  return {
    visitas,
    conversoes,
    taxa: visitas ? (conversoes / visitas) * 100 : null,
  };
}

const COLUNAS_CANAL = [
  { titulo: "Canal" },
  { titulo: "Sessões", numero: true },
  { titulo: "Usuários", numero: true },
  { titulo: "Novos usuários", numero: true },
  { titulo: "Taxa de engajamento", numero: true },
  {
    titulo: "Tempo médio",
    numero: true,
    dica: "Duração média da sessão (m:ss)",
  },
  {
    titulo: "Eventos-chave",
    numero: true,
    dica: "A confirmar quais estão configurados no site",
  },
];

const COLUNAS_LP = [
  { titulo: "Landing page", classe: "min-w-56" },
  { titulo: "Interesse" },
  { titulo: "Visitas", numero: true },
  { titulo: "Conversões", numero: true },
  { titulo: "Taxa de conversão", numero: true },
];

const COLUNAS_BUSCA = [
  { titulo: "Termo", classe: "min-w-64" },
  { titulo: "Cliques", numero: true },
  { titulo: "Impressões", numero: true },
  { titulo: "CTR", numero: true },
  { titulo: "Posição média", numero: true },
];

// Relatório "Site e landing pages": Quadros 1, 2 e 4 na mesma planilha. O
// cabeçalho do arquivo é o do Quadro 1; os outros vêm depois, com título e
// cabeçalho em linhas próprias (nenhuma coluna é "número": a mesma coluna
// leva texto e número).
const COLUNAS_EXPORTAR_SITE = [
  { titulo: "Canal" },
  { titulo: "Sessões" },
  { titulo: "Usuários" },
  { titulo: "Novos usuários" },
  { titulo: "Taxa de engajamento (%)" },
  { titulo: "Tempo médio (m:ss)" },
  { titulo: "Eventos-chave" },
];

type Celula = string | number | null;
const r1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);

function linhasExportarSite(
  canais: CanalLinha[],
  total: Trafego,
  lps: LandingPageLinha[],
  tlp: TotalLps,
  buscas: BuscaTermo[],
): Celula[][] {
  const trafego = (rotulo: string, t: Trafego): Celula[] => [
    rotulo,
    t.sessoes,
    t.usuarios,
    t.novos,
    r1(t.taxaEngajamento),
    minutosESegundos(t.tempoMedio),
    t.eventosChave,
  ];
  const vazio = (n: number): Celula[] => Array<Celula>(n).fill("");
  return [
    ...canais.map((l) => trafego(l.rotulo, l)),
    trafego("Total", total),
    vazio(7),
    ["Landing pages do RD", ...vazio(6)],
    [
      "Landing page",
      "Interesse",
      "Visitas",
      "Conversões",
      "Taxa de conversão (%)",
      "",
      "",
    ],
    ...lps.map((l): Celula[] => [
      l.nome,
      rotuloInteresse(l.interesse),
      l.visitas,
      l.conversoes,
      r1(l.taxa),
      "",
      "",
    ]),
    ["Total", "", tlp.visitas, tlp.conversoes, r1(tlp.taxa), "", ""],
    vazio(7),
    ["Buscas no Google (20 termos com mais cliques)", ...vazio(6)],
    [
      "Termo",
      "Cliques",
      "Impressões",
      "CTR (%)",
      "Posição média",
      "Oportunidade",
      "",
    ],
    ...buscas.map((b): Celula[] => [
      b.termo,
      b.cliques,
      b.impressoes,
      r1(b.ctr),
      r1(b.posicao),
      b.oportunidade ? "Sim" : "",
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
      <CartaoCarregando altura="h-80" />
      <CartaoCarregando altura="h-80" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CartaoCarregando altura="h-80" />
        <CartaoCarregando altura="h-80" />
      </div>
    </TelaCarregando>
  );
}
