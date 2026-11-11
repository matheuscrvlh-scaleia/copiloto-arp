import {
  AlertTriangle,
  ArrowRight,
  Bell,
  GitCompare,
  Info,
  Sparkles,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { BarraDeFiltros } from "@/components/dashboard/barra-de-filtros";
import { ColunasEmpilhadas } from "@/components/dashboard/graficos/colunas-empilhadas";
import { Linhas } from "@/components/dashboard/graficos/linhas";
import { SeloStatus } from "@/components/dashboard/indicador";
import { Secao } from "@/components/dashboard/tabela";
import { TabelaLista } from "@/components/dashboard/tabela-lista";
import {
  CartaoDaTela,
  Cartoes,
  Fonte,
  fontesReais,
  juntarAvisos,
  TopoDaTela,
  variacaoContra,
} from "@/components/dashboard/tela";
import { BotaoExportar } from "@/components/os/exportar";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { formatarMoeda, formatarNumero, formatarPct } from "@/lib/formato";
import { status } from "@/lib/indicadores";
import { type Alerta, avaliarAlertas, NIVEIS } from "@/lib/marketing/alertas";
import { linhasDeCampanha, somar } from "@/lib/marketing/anuncios";
import {
  type LinhaResumo,
  linhasDoResumo,
  type UnidadeResumo,
} from "@/lib/marketing/painel";
import {
  COMPARACOES,
  linhaDeFiltros,
  mesesAte,
  paramsDoPeriodoMkt,
  semanasAte,
} from "@/lib/marketing/periodo";
import { entradasPorDia, resumoFluxo } from "@/lib/marketing/publico";
import {
  eventosDoCalendario,
  resumoRadar,
  type SinalizacaoLinha,
  sinalizacoesDoMarketing,
  tarefasDoTime,
} from "@/lib/marketing/radar";
import { linhasPorRede, resumoRedes } from "@/lib/marketing/redes";
import {
  fracaoDoMes,
  mesAteHoje,
  metaNoRitmo,
  resumoReputacao,
} from "@/lib/marketing/reputacao";
import {
  buscasDaMarca,
  buscasDoPeriodo,
  ga4Do,
  resumoSite,
  totalTrafego,
} from "@/lib/marketing/site";
import {
  locatarios,
  metaMkt,
  parametros,
  quadrosVisiveis,
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
  dadosRd,
  dadosRdDosAnuncios,
  dadosRedes,
  dadosReputacao,
  dadosSite,
} from "@/server/marketing/fontes";
import { dadosPublico } from "@/server/marketing/publico";

export const metadata: Metadata = { title: "Painel do Marketing" };

export default function Page({ searchParams }: PageProps<"/marketing">) {
  return (
    <>
      <PageHeader
        title="Painel do Marketing"
        description="Três perguntas numa tela: estamos atraindo mais pessoas? Nossa marca está ficando mais forte? Onde precisamos agir?"
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
    rdAnuncios,
    site,
    redes,
    reputacao,
    asana,
    params,
    lista,
    { temas, codigos },
    regras,
    interesseDe,
    metaCpl,
    metaLeads,
    metaNovas,
    metaNota,
    publico,
    ve,
  ] = await Promise.all([
    dadosAnuncios(),
    dadosRd(),
    dadosRdDosAnuncios(),
    dadosSite(),
    dadosRedes(),
    dadosReputacao(),
    dadosAsana(),
    parametros(),
    locatarios(),
    temasEcodigos(),
    regrasAlerta(),
    interesseDasLandingPages(),
    metaMkt("marketing.custo_por_lead", mesDoPeriodo),
    metaMkt("marketing.leads_mes", mesAtual),
    metaMkt("marketing.avaliacoes_novas_arp", mesAtual),
    metaMkt("marketing.nota_media_arp", mesAtual),
    dadosPublico(hoje),
    quadrosVisiveis("painel"),
  ]);

  // Cada frente, na semana e na anterior.
  const campanhas = linhasDeCampanha(anuncios, rdAnuncios.conversoes, periodo);
  const ads = somar(campanhas.linhas);
  const adsAnt = somar(
    linhasDeCampanha(anuncios, rdAnuncios.conversoes, anterior).linhas,
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

  // As três perguntas: público (câmeras), marca (buscas) e onde agir.
  const porDia = publico ? entradasPorDia(publico.contagens) : null;
  const fluxo = porDia ? resumoFluxo(porDia, periodo) : null;
  const fluxoAnt = porDia ? resumoFluxo(porDia, anterior) : null;
  const marca = buscasDaMarca(site.buscas, periodo, params.termos_marca);
  const marcaAnt = buscasDaMarca(site.buscas, anterior, params.termos_marca);
  const organica = (p: typeof periodo) =>
    totalTrafego(ga4Do(site.ga4, p, "Organic Search")).sessoes;
  const eventos = eventosDoCalendario(
    asana.tarefas,
    params,
    periodo.de,
    periodo.ate,
  );
  const eventosAnt = eventosDoCalendario(
    asana.tarefas,
    params,
    anterior.de,
    anterior.ate,
  );
  const campanhasAnt = linhasDeCampanha(
    anuncios,
    rdAnuncios.conversoes,
    anterior,
  );
  const ambiencia = pode("marketing.radar")
    ? sinalizacoesDoMarketing(
        asana.tarefas,
        params.asana_projeto_ronda,
        codigos,
        hoje,
      )
        .filter((s) => !s.concluida)
        .sort((a, b) => b.diasEmAberto - a.diasEmAberto)
    : [];
  const termos = buscasDoPeriodo(site.buscas, periodo, 8);
  const redesReais = linhasPorRede(redes, periodo, ["instagram", "facebook"]);

  const query = new URLSearchParams(paramsDoPeriodoMkt(periodo)).toString();
  const resumo = linhasDoResumo(
    {
      ...(fluxo && fluxoAnt
        ? {
            publico: {
              atual: fluxo.diasComDado ? fluxo.total : null,
              anterior: fluxoAnt.diasComDado ? fluxoAnt.total : null,
            },
          }
        : {}),
      marca: {
        atual: marca?.impressoes ?? null,
        anterior: marcaAnt?.impressoes ?? null,
      },
      eventos: { atual: eventos.length, anterior: eventosAnt.length },
      anuncios: {
        atual: ads,
        anterior: adsAnt,
        semCampanha: campanhas.semCampanha,
      },
      site: { atual: sit, anterior: sitAnt, leadsNoMes },
      redes: { atual: red, anterior: redAnt },
      reputacao: rep,
      radar,
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
      somar(linhasDeCampanha(anuncios, rdAnuncios.conversoes, s).linhas)
        .custoPorLead,
  );

  const linhaFiltros = linhaDeFiltros([
    { rotulo: "Período", valor: f.rotulo },
    { rotulo: "Comparação", valor: f.rotuloAnterior },
  ]);
  const cartaoLeads = pode("marketing.site");

  return (
    <div className="flex flex-col gap-6">
      <BarraDeFiltros
        modulo="marketing"
        tela="painel"
        periodo={periodo}
        hoje={hoje}
        lembrado={f.lembrado}
        atalhos={["semana_passada", "esta_semana", "ultimos_30", "mes_passado"]}
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
        ]}
      />

      <TopoDaTela
        dadosDe={ctx.dadosDe}
        filtros={linhaFiltros}
        reais={fontesReais(
          anuncios.metaReal && "Meta Ads",
          anuncios.googleReal && "Google Ads",
          redes.metaReal && "Instagram e Facebook",
          site.siteReal && "Google Analytics",
          rd.lidoEm && "leads do RD Station",
          asana.lidoEm && "radar do Asana",
          !!publico?.contagens.length && "câmeras de contagem",
        )}
        aviso={juntarAvisos(
          anuncios.avisoMeta,
          anuncios.avisoGoogle,
          redes.avisoMeta,
          site.avisoSite,
        )}
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

      <Cartoes modulo="marketing">
        {ve("fluxo") && fluxo && fluxoAnt && (
          <CartaoDaTela
            titulo="Fluxo de visitantes"
            valor={fluxo.diasComDado ? formatarNumero(fluxo.total) : "—"}
            variacao={
              fluxo.diasComDado && fluxoAnt.diasComDado
                ? variacaoContra(fluxo.total, fluxoAnt.total, f.rotuloAnterior)
                : undefined
            }
            detalhe={
              fluxo.diasComDado
                ? `Média ${formatarNumero(Math.round(fluxo.mediaPorDia ?? 0))}/dia em ${fluxo.diasComDado} dias com contagem`
                : "As câmeras ainda não contaram neste período"
            }
            calculo="Entradas contadas pelas câmeras no período, somando todas. Dia sem contagem fica de fora."
            fonte="Câmeras de contagem"
            href={`/marketing/publico?${query}`}
          />
        )}
        {ve("buscas_marca") && pode("marketing.site") && (
          <CartaoDaTela
            titulo="Buscas pela marca ARP"
            valor={marca ? formatarNumero(marca.impressoes) : "—"}
            variacao={
              marca && marcaAnt
                ? variacaoContra(
                    marca.impressoes,
                    marcaAnt.impressoes,
                    f.rotuloAnterior,
                  )
                : undefined
            }
            detalhe={
              marca
                ? `${formatarNumero(marca.cliques)} cliques para o site`
                : `Search Console sem dados. Busca orgânica no site: ${formatarNumero(organica(periodo))} sessões`
            }
            calculo="Vezes em que a ARP apareceu no Google em buscas com os termos da marca (Configurações › Benchmark e marca). Sem o Search Console, mostra as sessões que vieram da busca orgânica (GA4)."
            fonte="Google Search Console e GA4"
            href={`/marketing/site?${query}`}
          />
        )}
        {ve("eventos") && pode("marketing.radar") && (
          <CartaoDaTela
            titulo="Eventos e ativações"
            valor={formatarNumero(eventos.length)}
            variacao={variacaoContra(
              eventos.length,
              eventosAnt.length,
              f.rotuloAnterior,
              "neutro",
            )}
            detalhe={`${formatarNumero(radar.eventosProximos30)} nos próximos 30 dias`}
            calculo="Eventos do calendário do Asana com algum dia dentro do período."
            fonte="Calendário do Asana"
            href="/marketing/radar?aba=calendario"
          />
        )}
        {ve("campanhas") && pode("marketing.anuncios") && (
          <CartaoDaTela
            titulo="Campanhas ativas"
            exemplo="campanhas do TikTok Ads (Meta e Google são reais)"
            valor={formatarNumero(campanhas.linhas.length)}
            variacao={variacaoContra(
              campanhas.linhas.length,
              campanhasAnt.linhas.length,
              f.rotuloAnterior,
              "neutro",
            )}
            detalhe={`${formatarMoeda(ads.investimento)} investidos`}
            calculo="Campanhas com gasto no período, nas três plataformas."
            fonte="Meta Ads, Google Ads e TikTok Ads"
            href={`/marketing/anuncios?${query}`}
          />
        )}
      </Cartoes>

      <Cartoes modulo="marketing">
        {ve("investimento") && pode("marketing.anuncios") && (
          <CartaoDaTela
            titulo="Investimento em anúncios"
            exemplo="investimento do TikTok Ads (Meta e Google são reais)"
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
        {ve("leads") && cartaoLeads && (
          <CartaoDaTela
            titulo="Leads no RD"
            exemplo={!rd.lidoEm && "o RD Station ainda não foi sincronizado"}
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
        {ve("custo_por_lead") && pode("marketing.anuncios") && (
          <CartaoDaTela
            titulo="Custo por lead"
            exemplo="investimento e leads do TikTok Ads (Meta e Google são reais)"
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
                : "Defina a meta em Configurações"
            }
            calculo="Investimento ÷ leads do RD Station vindos das campanhas (traffic_campaign)."
            fonte="Anúncios e RD Station"
            href={`/marketing/anuncios?${query}&cartao=acima_meta`}
          />
        )}
      </Cartoes>

      {ve("onde_agir") && (
        <Secao
          tom="escuro"
          titulo="Onde agir"
          descricao="Primeiro a ambiência (sinalizações da ronda abertas para o Marketing), depois os alertas, do mais grave ao mais leve. As regras e os limites ficam em Configurações."
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {pode("marketing.radar") && <Ambiencia lista={ambiencia} />}
            <ListaDeAlertas alertas={alertas} />
          </div>
          <Fonte>
            Ronda de ambiência no Asana; regras de alerta de Configurações sobre
            os dados de cada tela
          </Fonte>
        </Secao>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {ve("buscas_site") && pode("marketing.site") && (
          <Secao
            titulo="Buscas no Google que levam ao site"
            descricao="Os termos com mais cliques no período"
            calculo="Cliques e impressões de cada termo no Google Search Console, no período. Fonte: Google Search Console."
          >
            {termos.length ? (
              <TabelaLista
                semBusca
                caber
                colunas={[
                  { titulo: "Termo", classe: "whitespace-normal" },
                  { titulo: "Cliques", numero: true },
                  { titulo: "Impressões", numero: true },
                  { titulo: "Posição", numero: true },
                ]}
                linhas={termos.map((t) => ({
                  chave: t.termo,
                  busca: t.termo,
                  href: `/marketing/site?${query}`,
                  ordem: [t.termo, t.cliques, t.impressoes, t.posicao],
                  celulas: [
                    t.termo,
                    formatarNumero(t.cliques),
                    formatarNumero(t.impressoes),
                    t.posicao === null ? "—" : formatarNumero(t.posicao, 1),
                  ],
                }))}
              />
            ) : (
              <p className="py-6 text-center text-sm text-neutral-500">
                {site.avisoBuscas ??
                  "O Search Console não trouxe buscas neste período."}{" "}
                Pela busca orgânica vieram {formatarNumero(organica(periodo))}{" "}
                sessões ao site (GA4).
              </p>
            )}
            <Fonte>Google Search Console; sessões orgânicas do GA4</Fonte>
          </Secao>
        )}
        {ve("redes") && pode("marketing.redes") && (
          <Secao
            titulo="Redes sociais: engajamento"
            descricao="Seguidores, novos seguidores e interações de cada rede no período"
            calculo="Interações: curtidas, comentários, compartilhamentos e salvamentos. Taxa: interações ÷ alcance. O Facebook não entrega interações. Fonte: Meta (Instagram e Facebook)."
          >
            <TabelaLista
              semBusca
              caber
              colunas={[
                { titulo: "Rede" },
                { titulo: "Seguidores", numero: true },
                { titulo: "Novos", numero: true },
                { titulo: "Interações", numero: true },
                { titulo: "Taxa", numero: true },
              ]}
              linhas={redesReais.map((r) => ({
                chave: r.rede,
                busca: r.rotulo,
                href: `/marketing/redes?${query}`,
                ordem: [r.rotulo, r.seguidores, r.novos, r.interacoes, r.taxa],
                celulas: [
                  r.rotulo,
                  r.seguidores === null ? "—" : formatarNumero(r.seguidores),
                  r.novos === null ? "—" : formatarNumero(r.novos),
                  r.interacoes === null ? "—" : formatarNumero(r.interacoes),
                  r.taxa === null ? "—" : formatarPct(r.taxa),
                ],
              }))}
            />
            <Fonte>
              Instagram e Facebook (Meta). YouTube e TikTok entram quando forem
              ligados.
            </Fonte>
          </Secao>
        )}
      </div>

      {ve("resumo") && (
        <Secao
          titulo="Resumo por frente"
          descricao={`${f.rotulo} contra a ${f.rotuloAnterior}. Clique numa linha para abrir a tela no mesmo período.`}
        >
          <TabelaLista
            colunas={COLUNAS}
            semBusca
            caber
            alturaMax="max-h-[600px]"
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
            Público: câmeras; marca: Search Console; eventos: calendário do
            Asana; anúncios: Meta, Google e TikTok Ads; leads: RD Station; site:
            Google Analytics 4; redes: Instagram, Facebook, YouTube e TikTok;
            reputação: Google Meu Negócio; radar: Asana. Reputação e radar não
            seguem o período: mês até hoje ou foto de agora.
          </Fonte>
        </Secao>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {ve("leads_semana") && cartaoLeads && (
          <Secao
            tom="verde"
            titulo="Leads no RD por semana"
            calculo="Contatos únicos que converteram no RD Station em cada semana, pelo interesse da landing page (Evento ou Locação, em Configurações › Landing pages). Outros = contatos únicos − Evento − Locação. Últimas 12 semanas. Fonte: RD Station."
            exemplo={!rd.lidoEm && "o RD Station ainda não foi sincronizado"}
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
            <Fonte>RD Station; tipo da landing page em Configurações</Fonte>
          </Secao>
        )}
        {ve("cpl_semana") && pode("marketing.anuncios") && (
          <Secao
            tom="verde"
            titulo="Custo por lead por semana"
            calculo="Investimento da semana em anúncios ÷ leads no RD vindos dessas campanhas (traffic_campaign = nome da campanha). Semana sem lead fica sem ponto. Linha tracejada: meta do mês (Configurações › Metas). Fontes: Meta Ads, Google Ads, TikTok Ads e RD Station."
            exemplo="investimento e leads do TikTok Ads (Meta e Google são reais)"
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
            <Fonte>Anúncios e RD Station; meta em Configurações</Fonte>
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
  { titulo: "Indicador", classe: "whitespace-normal" },
  { titulo: "Período", numero: true },
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
      <span
        key="m"
        className="inline-flex flex-wrap items-center justify-end gap-x-2 gap-y-1"
      >
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

/** Ambiência no topo do Onde agir: as sinalizações abertas, as mais antigas primeiro. */
function Ambiencia({ lista }: { lista: SinalizacaoLinha[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
        <Sparkles className="size-3.5" aria-hidden />
        Ambiência
      </p>
      {!lista.length ? (
        <p className="py-4 text-sm text-neutral-500">
          Nenhuma sinalização da ronda aberta para o Marketing.
        </p>
      ) : (
        <ul className="-mx-2 flex max-h-[420px] flex-col gap-1 overflow-y-auto px-2">
          {lista.slice(0, 8).map((s) => (
            <li key={s.gid}>
              <a
                href={s.link}
                target="_blank"
                rel="noreferrer"
                className="group flex gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-neutral-900/[0.04]"
              >
                <span className="mt-0.5 inline-flex h-6 shrink-0 items-center rounded-full bg-neutral-900/[0.06] px-2 font-mono text-[11px] font-semibold">
                  {s.codigo}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {s.descricao}
                  </span>
                  <span className="block text-xs text-neutral-500">
                    {[
                      s.local,
                      `aberta há ${formatarNumero(s.diasEmAberto)} dias`,
                      s.responsavel,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </a>
            </li>
          ))}
          {lista.length > 8 && (
            <li>
              <Link
                href="/marketing/radar?aba=sinalizacoes"
                className="px-2 text-xs font-medium text-neutral-600 underline-offset-4 hover:underline"
              >
                Ver as {formatarNumero(lista.length)} sinalizações abertas
              </Link>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

const ICONE_NIVEL = {
  urgente: { icone: AlertTriangle, classe: "bg-red-600/10 text-red-700" },
  atencao: { icone: Bell, classe: "bg-amber-500/15 text-amber-900" },
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
    <ul className="-mx-2 flex max-h-[600px] flex-col gap-2 overflow-y-auto px-2">
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
  { titulo: "Período" },
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
