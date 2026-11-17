import {
  formatarData,
  formatarMoeda,
  formatarNumero,
  formatarPct,
} from "@arp/shared/formato";
import { status } from "@arp/shared/indicadores";
import {
  type Alerta,
  avaliarAlertas,
  NIVEIS,
} from "@arp/shared/marketing/alertas";
import { linhasDeCampanha, somar } from "@arp/shared/marketing/anuncios";
import { postsRecentes } from "@arp/shared/marketing/benchmark";
import {
  type LinhaResumo,
  linhasDoResumo,
  type UnidadeResumo,
} from "@arp/shared/marketing/painel";
import {
  COMPARACOES,
  linhaDeFiltros,
  mesesAte,
  paramsDoPeriodoMkt,
  somarDias,
} from "@arp/shared/marketing/periodo";
import {
  entradasDaFonte,
  FONTES_FLUXO,
  fonteDoFluxo,
  resumoFluxo,
} from "@arp/shared/marketing/publico";
import {
  eventosDoCalendario,
  resumoRadar,
  type SinalizacaoLinha,
  sinalizacoesDoMarketing,
  tarefasDoTime,
} from "@arp/shared/marketing/radar";
import {
  linhasPorRede,
  resumoRedes,
  seguidoresEm,
  somarRedes,
} from "@arp/shared/marketing/redes";
import {
  fracaoDoMes,
  mesAteHoje,
  metaNoRitmo,
  resumoReputacao,
} from "@arp/shared/marketing/reputacao";
import {
  buscasDaMarca,
  buscasDoPeriodo,
  ga4Do,
  resumoSite,
  totalTrafego,
} from "@arp/shared/marketing/site";
import { visiveisDa } from "@arp/shared/marketing/visualizacao";
import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Film,
  GitCompare,
  Heart,
  Info,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { BarraDeFiltros } from "@/components/dashboard/barra-de-filtros";
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
import { BotaoExportar } from "@/components/exportar";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { Link } from "@/lib/navegacao";
import {
  consultaDaReputacao,
  consultaDasLandingPages,
  consultaDasMetas,
  consultaDasRedes,
  consultaDasRegras,
  consultaDoAsana,
  consultaDoBenchmark,
  consultaDoPublico,
  consultaDoRd,
  consultaDoRdDosAnuncios,
  consultaDoSite,
  consultaDosAnuncios,
  consultaDosLocatarios,
  consultaDosParametros,
  consultaDosTemasECodigos,
} from "../api";
import {
  type FiltrosLidos,
  interesseDasLandingPages,
  metaMkt,
  useFiltrosMkt,
} from "../base";

// /marketing: o Painel, com as três perguntas do Marketing numa tela.

export default function Page() {
  return (
    <>
      <PageHeader
        title="Painel do Marketing"
        description="Três perguntas numa tela: estamos atraindo mais pessoas? Nossa marca está ficando mais forte? Onde precisamos agir?"
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="marketing.painel">
          <Tela />
        </Protegido>
      </Suspense>
    </>
  );
}

function Tela() {
  const f = useFiltrosMkt("painel", "semana_passada");
  return f ? <Painel f={f} /> : <Esqueleto />;
}

function Painel({ f }: { f: FiltrosLidos }) {
  const { ctx, periodo, anterior } = f;
  const { hoje, pode } = ctx;
  const mesAtual = `${hoje.slice(0, 7)}-01`;
  const mesDoPeriodo = mesesAte(periodo.ate, 1)[0] ?? mesAtual;

  const [
    { data: anuncios },
    { data: rd },
    { data: rdAnuncios },
    { data: site },
    { data: redes },
    { data: reputacao },
    { data: asana },
    { data: params },
    { data: lista },
    {
      data: { temas, codigos },
    },
    { data: regras },
    { data: lps },
    { data: metas },
    { data: publico },
  ] = useSuspenseQueries({
    queries: [
      consultaDosAnuncios,
      consultaDoRd,
      consultaDoRdDosAnuncios,
      consultaDoSite,
      consultaDasRedes,
      consultaDaReputacao,
      consultaDoAsana,
      consultaDosParametros,
      consultaDosLocatarios,
      consultaDosTemasECodigos,
      consultaDasRegras,
      consultaDasLandingPages,
      consultaDasMetas,
      consultaDoPublico,
    ],
  });
  const interesseDe = interesseDasLandingPages(lps);
  const metaCpl = metaMkt(metas, "marketing.custo_por_lead", mesDoPeriodo);
  const metaLeads = metaMkt(metas, "marketing.leads_mes", mesAtual);
  const metaNovas = metaMkt(metas, "marketing.avaliacoes_novas_arp", mesAtual);
  const metaNota = metaMkt(metas, "marketing.nota_media_arp", mesAtual);
  const ve = visiveisDa("painel", params.quadros_ocultos);

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

  // As três perguntas: público (câmeras ou estacionamento), marca (buscas)
  // e onde agir.
  const fonteFluxo = publico ? fonteDoFluxo(publico, "") : null;
  const porDia =
    publico && fonteFluxo ? entradasDaFonte(publico, fonteFluxo) : null;
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
  const META: ("instagram" | "facebook")[] = ["instagram", "facebook"];
  const redesReais = linhasPorRede(redes, periodo, META);
  const engajamento = somarRedes(redesReais);
  const engajamentoAnt = somarRedes(linhasPorRede(redes, anterior, META));
  // Seguidores de hoje (a última foto diária), não os do fim do período: a
  // foto atrasada denuncia a sincronização da Meta parada.
  const ultimaFoto = redes.instagram.dias
    .filter((d) => d.followers_count !== null)
    .reduce<string | null>((m, d) => (m && m > d.date ? m : d.date), null);
  const fotoAtrasada = !!ultimaFoto && ultimaFoto < somarDias(hoje, -1);

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

  const linhaFiltros = linhaDeFiltros([
    { rotulo: "Período", valor: f.rotulo },
    { rotulo: "Comparação", valor: f.rotuloAnterior },
  ]);

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
          !!porDia?.size && !!fonteFluxo && FONTES_FLUXO[fonteFluxo].rotulo,
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
        {ve("nota_google") && pode("marketing.reputacao") && (
          <CartaoDaTela
            titulo="Nota no Google"
            exemplo="avaliações do Google (o Perfil da Empresa ainda não foi ligado)"
            valor={rep.notaArp === null ? "—" : formatarNumero(rep.notaArp, 1)}
            detalhe={
              rep.totalArp === null
                ? "Sem o perfil da ARP no Google"
                : `${formatarNumero(rep.totalArp)} avaliações · ${formatarNumero(rep.novasNoMes)} novas no mês`
            }
            status={
              metaNota && rep.notaArp !== null
                ? status(rep.notaArp, metaNota)
                : undefined
            }
            meta={
              metaNota
                ? `Meta: ${formatarNumero(metaNota.meta, 1)}`
                : "Defina a meta em Configurações"
            }
            calculo="Nota média e total de avaliações do perfil da ARP no Google, como estão hoje (não segue o período)."
            fonte="Google Perfil da Empresa"
            href="/marketing/reputacao"
          />
        )}
        {ve("engajamento") && pode("marketing.redes") && (
          <CartaoDaTela
            titulo="Taxa de engajamento"
            valor={
              engajamento.taxa === null ? "—" : formatarPct(engajamento.taxa)
            }
            variacao={
              engajamento.taxa !== null && engajamentoAnt.taxa !== null
                ? variacaoContra(
                    engajamento.taxa,
                    engajamentoAnt.taxa,
                    f.rotuloAnterior,
                  )
                : undefined
            }
            detalhe={`${formatarNumero(engajamento.interacoes)} interações · alcance ${formatarNumero(engajamento.alcanceEVisualizacoes)}`}
            calculo="Interações (curtidas, comentários, compartilhamentos e salvamentos) ÷ alcance no período. Só o Instagram: o Facebook não entrega interações; YouTube e TikTok entram quando forem ligados."
            fonte="Instagram (Meta)"
            href={`/marketing/redes?${query}`}
          />
        )}
        {ve("fluxo") && fluxo && fluxoAnt && fonteFluxo && (
          <CartaoDaTela
            titulo={FONTES_FLUXO[fonteFluxo].titulo}
            valor={fluxo.diasComDado ? formatarNumero(fluxo.total) : "—"}
            variacao={
              fluxo.diasComDado && fluxoAnt.diasComDado
                ? variacaoContra(fluxo.total, fluxoAnt.total, f.rotuloAnterior)
                : undefined
            }
            detalhe={
              fluxo.diasComDado
                ? `Média ${formatarNumero(Math.round(fluxo.mediaPorDia ?? 0))} ${FONTES_FLUXO[fonteFluxo].unidade}/dia em ${fluxo.diasComDado} dias com contagem`
                : "Ainda sem contagem neste período"
            }
            calculo={
              fonteFluxo === "cameras"
                ? "Entradas contadas pelas câmeras no período, somando todas. Dia sem contagem fica de fora."
                : "Veículos que entraram no estacionamento no período (WPS), de todos os tipos. Sem as câmeras, é a medida do público. Dia sem leitura fica de fora."
            }
            fonte={FONTES_FLUXO[fonteFluxo].rotulo}
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
      </Cartoes>

      <Cartoes modulo="marketing">
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
            descricao="Seguidores de hoje; novos seguidores e interações de cada rede no período"
            calculo="Seguidores: a última foto diária gravada pela sincronização da Meta (todo dia de manhã). Interações: curtidas, comentários, compartilhamentos e salvamentos. Taxa: interações ÷ alcance. O Facebook não entrega interações. Fonte: Meta (Instagram e Facebook)."
          >
            <TabelaLista
              semBusca
              caber
              colunas={[
                { titulo: "Rede" },
                { titulo: "Seguidores hoje", numero: true },
                { titulo: "Novos", numero: true },
                { titulo: "Interações", numero: true },
                { titulo: "Taxa", numero: true },
              ]}
              linhas={redesReais.map((r) => {
                const seguidores = seguidoresEm(redes, r.rede, hoje);
                return {
                  chave: r.rede,
                  busca: r.rotulo,
                  href: `/marketing/redes?${query}`,
                  ordem: [r.rotulo, seguidores, r.novos, r.interacoes, r.taxa],
                  celulas: [
                    r.rotulo,
                    seguidores === null ? "—" : formatarNumero(seguidores),
                    r.novos === null ? "—" : formatarNumero(r.novos),
                    r.interacoes === null ? "—" : formatarNumero(r.interacoes),
                    r.taxa === null ? "—" : formatarPct(r.taxa),
                  ],
                };
              })}
            />
            {fotoAtrasada && ultimaFoto && (
              <p role="alert" className="text-xs text-amber-800">
                A última foto dos seguidores é de {formatarData(ultimaFoto)}: a
                sincronização da Meta não gravou depois disso. Confira em
                Configurações › Integrações › Meta.
              </p>
            )}
            <Fonte>
              {`Instagram e Facebook (Meta)${ultimaFoto ? `; seguidores da foto de ${formatarData(ultimaFoto)}` : ""}. YouTube e TikTok entram quando forem ligados.`}
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

      {ve("posts_benchmark") && pode("marketing.reputacao") && (
        <Suspense fallback={<CartaoCarregando altura="h-72" />}>
          <PostsDoBenchmark />
        </Suspense>
      )}

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

/** Os posts mais recentes de cada referência do Benchmark, em miniatura. */
function PostsDoBenchmark() {
  const { data: dados } = useSuspenseQuery(consultaDoBenchmark);
  if (!dados) return null;
  const lidas = dados.referencias.flatMap(({ referencia: r, leitura }) =>
    leitura?.ok ? [{ id: r.id, nome: r.nome, conta: leitura.conta }] : [],
  );
  const semLeitura = dados.referencias.flatMap(({ referencia: r, leitura }) =>
    leitura && !leitura.ok
      ? [{ id: r.id, nome: r.nome, usuario: r.instagram, aviso: leitura.aviso }]
      : [],
  );
  return (
    <Secao
      titulo="Posts das referências"
      descricao="Os 6 posts mais recentes de cada perfil do Benchmark. Clique para abrir no Instagram."
      calculo="Posts públicos das contas cadastradas em Configurações › Benchmark e marca, lidos pela conta da ARP na Meta (business discovery) e relidos a cada hora. Só contas comerciais ou de criador entregam os posts."
    >
      {!lidas.length && (
        <p className="py-6 text-center text-sm text-neutral-500">
          {dados.referencias.length
            ? "Nenhuma referência com o Instagram lido."
            : "Nenhuma referência cadastrada. Inclua em Configurações › Benchmark e marca."}
        </p>
      )}
      <div className="flex flex-col gap-5">
        {lidas.map((x) => (
          <div key={x.id} className="flex flex-col gap-2">
            <p className="text-sm font-semibold">
              {x.nome}
              <a
                href={`https://www.instagram.com/${x.conta.username}/`}
                target="_blank"
                rel="noreferrer"
                className="ml-2 text-xs font-normal text-neutral-500 hover:underline"
              >
                @{x.conta.username}
              </a>
            </p>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {postsRecentes(x.conta, 6).map((m) => (
                <li key={m.id}>
                  <a
                    href={m.permalink}
                    target="_blank"
                    rel="noreferrer"
                    title={m.caption || undefined}
                    className="group relative block aspect-square overflow-hidden rounded-xl bg-neutral-100"
                  >
                    {m.miniatura ? (
                      <img
                        src={m.miniatura}
                        alt={m.caption.slice(0, 120)}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 size-full object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <Film
                        className="absolute inset-0 m-auto size-6 text-neutral-300"
                        aria-hidden
                      />
                    )}
                    <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-neutral-900/70 to-transparent px-2 pt-4 pb-1 text-[11px] font-medium text-white">
                      <span>
                        {formatarData(m.timestamp.slice(0, 10)).slice(0, 5)}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <Heart className="size-3" aria-hidden />
                        {formatarNumero(m.like_count)}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <MessageCircle className="size-3" aria-hidden />
                        {formatarNumero(m.comments_count)}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {semLeitura.map((x) => (
        <p key={x.id} className="text-xs text-amber-800">
          {x.nome}
          {x.usuario ? ` (@${x.usuario})` : ""}: {x.aviso}
        </p>
      ))}
      <Fonte>Instagram (business discovery da Meta)</Fonte>
    </Secao>
  );
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
