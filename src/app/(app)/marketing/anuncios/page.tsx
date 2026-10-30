import { Filter, Layers, Megaphone, Target } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { ColunasEmpilhadas } from "@/components/dashboard/graficos/colunas-empilhadas";
import { Dispersao } from "@/components/dashboard/graficos/dispersao";
import { Linhas } from "@/components/dashboard/graficos/linhas";
import { Secao } from "@/components/dashboard/tabela";
import { BarraDeFiltros } from "@/components/marketing/filtros";
import { TabelaMkt } from "@/components/marketing/tabela";
import {
  CartaoMkt,
  Cartoes,
  Fonte,
  fontesReais,
  hrefCom,
  TopoDaTela,
  variacaoContra,
} from "@/components/marketing/tela";
import { ProvedorDetalhe } from "@/components/modal-detalhe";
import { BotaoExportar } from "@/components/os/exportar";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { formatarMoeda, formatarNumero, formatarPct } from "@/lib/formato";
import { status } from "@/lib/indicadores";
import {
  type CampanhaLinha,
  linhasDeCampanha,
  PLATAFORMAS,
  type Plataforma,
  rotuloSituacao,
  rotuloTipo,
  somar,
  type Totais,
} from "@/lib/marketing/anuncios";
import { linhaDeFiltros, mesesAte, semanasAte } from "@/lib/marketing/periodo";
import { metaMkt } from "@/server/marketing/base";
import {
  type Busca,
  INTERESSES,
  type Interesse,
  interesseDasLandingPages,
  lerFiltros,
} from "@/server/marketing/filtros";
import { dadosAnuncios, dadosRdDosAnuncios } from "@/server/marketing/fontes";

export const metadata: Metadata = { title: "Performance de anúncios" };

const BASE = "/marketing/anuncios";
const FONTE = "Meta Ads, Google Ads e TikTok Ads; leads do RD Station";

export default function Page({
  searchParams,
}: PageProps<"/marketing/anuncios">) {
  return (
    <>
      <PageHeader
        title="Performance de anúncios"
        description="Uma linha por campanha de Meta, Google e TikTok, com o custo por lead calculado pelos leads que de fato chegaram no RD Station."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="marketing.anuncios">
          <Tela busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

const SITUACAO_OPCOES = [
  { valor: "ativa", rotulo: "Só ativas" },
  { valor: "pausada", rotulo: "Só pausadas" },
];
const ehAtiva = (s: string | null) => s === "ACTIVE" || s === "ENABLED";

async function Tela({ busca }: { busca: Promise<Busca> }) {
  const f = await lerFiltros("anuncios", await busca, "semana_passada");
  const { ctx, periodo, anterior } = f;
  const plataforma = f.um("plataforma") as Plataforma | "";
  const tipo = f.um("tipo");
  const situacao = f.um("situacao");
  const interesse = f.um("interesse") as Interesse | "";
  const q = f.um("q").trim().toLowerCase();
  const cartao = f.um("cartao");

  const [anuncios, rd, interesseDe, metaCpl] = await Promise.all([
    dadosAnuncios(),
    dadosRdDosAnuncios(),
    interesseDasLandingPages(),
    metaMkt("marketing.custo_por_lead", mesesAte(periodo.ate, 1)[0] as string),
  ]);
  const aceita = interesse
    ? (c: { conversion_identifier: string }) =>
        interesseDe(c.conversion_identifier) === interesse
    : undefined;

  // Filtros da barra (o do cartão só vale para a lista).
  const filtrar = (ls: CampanhaLinha[]) =>
    ls.filter(
      (l) =>
        (!plataforma || l.plataforma === plataforma) &&
        (!tipo || l.tipo === tipo) &&
        (!situacao ||
          (situacao === "ativa"
            ? ehAtiva(l.situacao)
            : !ehAtiva(l.situacao) && l.situacao !== null)) &&
        (!q || l.nome.toLowerCase().includes(q)),
    );
  const doPeriodo = linhasDeCampanha(anuncios, rd.conversoes, periodo, aceita);
  const base = filtrar(doPeriodo.linhas);
  const ant = filtrar(
    linhasDeCampanha(anuncios, rd.conversoes, anterior, aceita).linhas,
  );
  const t = somar(base);
  const ta = somar(ant);
  const meta = metaCpl?.meta ?? null;
  const acimaDaMeta = (l: CampanhaLinha) =>
    meta !== null &&
    (l.custoPorLead === null ? l.investimento > 0 : l.custoPorLead > meta);
  const lista =
    cartao === "com_lead"
      ? base.filter((l) => l.leadsRd > 0)
      : cartao === "acima_meta"
        ? base.filter(acimaDaMeta)
        : base;

  // 12 semanas até a semana do fim do período.
  const semanas = semanasAte(periodo.ate, 12);
  const porSemana = semanas.map((s) =>
    filtrar(linhasDeCampanha(anuncios, rd.conversoes, s, aceita).linhas),
  );
  const pontos = semanas.map((s) => ({
    chave: s.de,
    rotulo: s.rotulo,
    titulo: `Semana de ${s.rotulo} a ${s.ate.slice(8, 10)}/${s.ate.slice(5, 7)}`,
  }));
  const plats = (Object.keys(PLATAFORMAS) as Plataforma[]).filter(
    (p) => !plataforma || p === plataforma,
  );
  const seriePor = (campo: "investimento" | "leadsRd") =>
    plats.map((p) => ({
      chave: p,
      rotulo: PLATAFORMAS[p].rotulo,
      cor: PLATAFORMAS[p].cor,
      valores: porSemana.map((ls) =>
        ls.filter((l) => l.plataforma === p).reduce((s, l) => s + l[campo], 0),
      ),
    }));
  const cplSemanal = porSemana.map((ls) => somar(ls).custoPorLead);

  // Filtros escritos (iguais no Excel e no PDF).
  const tiposPresentes = [
    ...new Map(
      doPeriodo.linhas.map((l) => [l.tipo, rotuloTipo(l.tipo)]),
    ).entries(),
  ];
  const linhaFiltros = linhaDeFiltros([
    { rotulo: "Período", valor: f.rotulo },
    {
      rotulo: "Plataforma",
      valor: plataforma ? PLATAFORMAS[plataforma].rotulo : "Todas",
    },
    { rotulo: "Tipo", valor: tipo ? rotuloTipo(tipo) : "Todos" },
    {
      rotulo: "Situação",
      valor: situacao
        ? (SITUACAO_OPCOES.find((o) => o.valor === situacao)?.rotulo ??
          situacao)
        : "Ativas e pausadas com gasto no período",
    },
    {
      rotulo: "Interesse do lead",
      valor: interesse ? INTERESSES[interesse] : "Todos",
    },
    ...(q ? [{ rotulo: "Busca", valor: f.um("q") }] : []),
    ...(cartao
      ? [
          {
            rotulo: "Cartão",
            valor:
              cartao === "com_lead"
                ? "Campanhas com lead"
                : "Custo por lead acima da meta",
          },
        ]
      : []),
  ]);

  const subtotais = Object.fromEntries(
    plats.map((p) => {
      const s = somar(lista.filter((l) => l.plataforma === p));
      return [p, { rotulo: PLATAFORMAS[p].rotulo, celulas: celulasTotais(s) }];
    }),
  );
  const tl = somar(lista);
  const hrefCartao = (c: string) =>
    hrefCom(BASE, f.busca, { cartao: cartao === c ? null : c });
  const exportar = ctx.pode("marketing.exportar");

  return (
    <ProvedorDetalhe>
      <div className="flex flex-col gap-6">
        <BarraDeFiltros
          tela="anuncios"
          periodo={periodo}
          hoje={ctx.hoje}
          lembrado={f.lembrado}
          selecoes={[
            {
              chave: "plataforma",
              rotulo: "Plataforma",
              todos: "Todas as plataformas",
              valor: plataforma,
              icone: <Layers className="size-4" />,
              opcoes: (Object.keys(PLATAFORMAS) as Plataforma[]).map((p) => ({
                valor: p,
                rotulo: PLATAFORMAS[p].rotulo,
              })),
            },
            {
              chave: "tipo",
              rotulo: "Tipo de campanha",
              todos: "Todos os tipos",
              valor: tipo,
              icone: <Megaphone className="size-4" />,
              largura: "w-48",
              opcoes: tiposPresentes.map(([valor, rotulo]) => ({
                valor,
                rotulo,
              })),
            },
            {
              chave: "situacao",
              rotulo: "Situação",
              todos: "Com gasto no período",
              valor: situacao,
              icone: <Filter className="size-4" />,
              opcoes: SITUACAO_OPCOES,
            },
            {
              chave: "interesse",
              rotulo: "Interesse do lead",
              todos: "Todos os interesses",
              valor: interesse,
              icone: <Target className="size-4" />,
              opcoes: (
                ["evento", "locacao", "outro", "sem_tipo"] as Interesse[]
              ).map((i) => ({ valor: i, rotulo: INTERESSES[i] })),
            },
          ]}
          busca={{
            chave: "q",
            valor: f.um("q"),
            placeholder: "Buscar campanha…",
          }}
        />

        <TopoDaTela
          dadosDe={ctx.dadosDe}
          filtros={linhaFiltros}
          reais={fontesReais(
            anuncios.metaReal && "Meta Ads",
            rd.lidoEm && "leads do RD Station",
          )}
          aviso={anuncios.avisoMeta}
          acoes={
            exportar ? (
              <BotaoExportar
                titulo="Performance de anúncios"
                filtros={`${linhaFiltros} · ${ctx.dadosDe}`}
                nomeArquivo="performance-de-anuncios"
                colunas={COLUNAS_EXPORTAR}
                linhas={linhasExportar(lista, plats, tl)}
              />
            ) : undefined
          }
        />

        <Cartoes>
          <CartaoMkt
            titulo="Investimento"
            exemplo={
              plataforma !== "meta" &&
              "investimento do Google Ads e do TikTok Ads (os da Meta são reais)"
            }
            valor={formatarMoeda(t.investimento)}
            variacao={variacaoContra(
              t.investimento,
              ta.investimento,
              f.rotuloAnterior,
              "neutro",
            )}
            detalhe={`${base.length} ${base.length === 1 ? "campanha" : "campanhas"} com gasto`}
            fonte="Meta Ads, Google Ads e TikTok Ads"
            href={cartao ? hrefCom(BASE, f.busca, { cartao: null }) : undefined}
          />
          <CartaoMkt
            titulo="Leads no RD vindos de anúncio"
            exemplo={
              plataforma !== "meta" &&
              "leads do Google Ads e do TikTok Ads (os da Meta são reais)"
            }
            valor={formatarNumero(t.leadsRd)}
            variacao={variacaoContra(t.leadsRd, ta.leadsRd, f.rotuloAnterior)}
            detalhe={`Conversões da plataforma: ${formatarNumero(t.conversoesPlataforma)} (contadas do jeito dela, não somam)`}
            calculo="Conversões do RD Station cuja campanha de origem (traffic_campaign) é uma das campanhas da lista."
            fonte="RD Station"
            href={hrefCartao("com_lead")}
            ativo={cartao === "com_lead"}
          />
          <CartaoMkt
            titulo="Custo por lead"
            exemplo={
              plataforma !== "meta" &&
              "investimento e leads do Google Ads e do TikTok Ads (os da Meta são reais)"
            }
            valor={formatarMoeda(t.custoPorLead)}
            variacao={
              t.custoPorLead !== null && ta.custoPorLead !== null
                ? variacaoContra(
                    t.custoPorLead,
                    ta.custoPorLead,
                    f.rotuloAnterior,
                    "menor_melhor",
                  )
                : undefined
            }
            status={
              metaCpl && t.custoPorLead !== null
                ? status(t.custoPorLead, metaCpl)
                : undefined
            }
            direcao="menor_melhor"
            meta={
              meta !== null
                ? `Meta: até ${formatarMoeda(meta)}`
                : "Defina a meta em Configurações"
            }
            calculo="Investimento ÷ leads do RD Station vindos dessas campanhas. Nunca usa as conversões da plataforma."
            fonte="Anúncios e RD Station"
            href={hrefCartao("acima_meta")}
            ativo={cartao === "acima_meta"}
          />
          <CartaoMkt
            titulo="Cliques no link"
            exemplo={
              plataforma !== "meta" &&
              "cliques do Google Ads e do TikTok Ads (os da Meta são reais)"
            }
            valor={formatarNumero(t.cliques)}
            variacao={variacaoContra(t.cliques, ta.cliques, f.rotuloAnterior)}
            detalhe={`CTR ${formatarPct(t.ctr)} · CPC ${formatarMoeda(t.cpc)}`}
            fonte="Meta Ads, Google Ads e TikTok Ads"
          />
        </Cartoes>

        <Secao
          titulo="Campanhas"
          descricao={`${f.rotulo} · uma linha por campanha, da que mais investiu para a que menos investiu. Clique para ver o dia a dia.`}
        >
          <TabelaMkt
            colunas={COLUNAS}
            ordemInicial={{ coluna: 4, desc: true }}
            placeholder="Buscar nesta lista…"
            rotuloGrupo="Subtotal por plataforma"
            subtotais={subtotais}
            vazio="Nenhuma campanha com gasto nesse filtro."
            linhas={lista.map((l) => ({
              chave: l.id,
              grupo: l.plataforma,
              busca: `${l.nome} ${l.rotuloPlataforma} ${rotuloTipo(l.tipo)}`,
              href: hrefCom(`${BASE}/${l.id}`, f.busca, {
                cartao: null,
                q: null,
              }),
              tom:
                acimaDaMeta(l) && l.custoPorLead === null
                  ? "atencao"
                  : undefined,
              celulas: celulas(l, meta),
              ordem: [
                l.rotuloPlataforma,
                l.nome,
                rotuloTipo(l.tipo),
                rotuloSituacao(l.situacao),
                l.investimento,
                l.impressoes,
                l.alcance,
                l.cliques,
                l.ctr,
                l.cpc,
                l.conversoesPlataforma,
                l.leadsRd,
                l.custoPorLead,
                l.visualizacoes,
              ],
            }))}
            rodape={[
              "Total",
              `${lista.length} campanhas`,
              "",
              "",
              ...celulasTotais(tl).slice(4),
            ]}
          />
          <Fonte>
            {FONTE}. Alcance: o Google não informa alcance por campanha (célula
            vazia, não zero); no Meta e no TikTok é a soma dos dias. Situação: o
            TikTok não a entrega nos campos usados. Linha em amarelo: gastou e
            não trouxe lead no RD.
          </Fonte>
        </Secao>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Secao
            tom="escuro"
            titulo="Investimento por semana"
            calculo="Soma do investimento (spend) de todas as campanhas em cada semana, separada por plataforma. Últimas 12 semanas até a semana do fim do período; os filtros da tela valem aqui. Fonte: relatório diário do Meta Ads, do Google Ads (cost_micros) e do TikTok Ads."
            exemplo={
              plataforma !== "meta" &&
              "investimentos do Google Ads e do TikTok Ads (os da Meta são reais)"
            }
            descricao="Últimas 12 semanas, por plataforma"
          >
            <ColunasEmpilhadas
              pontos={pontos}
              series={seriePor("investimento")}
              unidade="moeda0"
              descricao="Investimento por semana e plataforma, últimas 12 semanas"
            />
            <Fonte>Meta Ads, Google Ads e TikTok Ads</Fonte>
          </Secao>
          <Secao
            tom="verde"
            titulo="Leads no RD por semana"
            calculo="Conversões do RD Station em cada semana cujo traffic_campaign (UTM) é igual ao nome de uma campanha, somadas pela plataforma dessa campanha. Lead sem UTM, ou com campanha que não existe nos anúncios, não entra. Nunca usa as conversões que a plataforma informa. Fonte: RD Station."
            exemplo={
              plataforma !== "meta" &&
              "leads do Google Ads e do TikTok Ads (os da Meta são reais)"
            }
            descricao="Últimas 12 semanas, pela plataforma da campanha de origem"
          >
            <ColunasEmpilhadas
              pontos={pontos}
              series={seriePor("leadsRd")}
              descricao="Leads no RD vindos de anúncio por semana e plataforma"
            />
            <Fonte>RD Station (traffic_campaign)</Fonte>
          </Secao>
          <Secao
            tom="verde"
            titulo="Custo por lead por semana"
            calculo="Investimento da semana ÷ leads no RD vindos das campanhas naquela semana. Semana sem lead fica sem ponto. Linha tracejada: meta de custo por lead do mês (Configurações › Metas). Fontes: anúncios (investimento) e RD Station (leads)."
            exemplo={
              plataforma !== "meta" &&
              "investimentos e leads do Google Ads e do TikTok Ads (os da Meta são reais)"
            }
            descricao="Investimento ÷ leads do RD, com a linha da meta"
          >
            <Linhas
              pontos={pontos}
              unidade="moeda"
              descricao="Custo por lead por semana"
              series={[
                {
                  chave: "cpl",
                  rotulo: "Custo por lead",
                  cor: 1,
                  valores: cplSemanal,
                },
              ]}
              meta={
                meta !== null
                  ? { valor: meta, texto: `Meta ${formatarMoeda(meta, 0)}` }
                  : undefined
              }
            />
            <Fonte>Anúncios e RD Station; meta em Configurações</Fonte>
          </Secao>
          <Secao
            titulo="Onde a verba rende"
            calculo="Um ponto por campanha com lead no período. Horizontal: investimento no período. Vertical: custo por lead = investimento ÷ leads no RD da campanha. Campanha sem lead não aparece (não tem custo por lead). Cor: plataforma. Fontes: anúncios e RD Station."
            exemplo={
              plataforma !== "meta" &&
              "campanhas do Google Ads e do TikTok Ads (os da Meta são reais)"
            }
            descricao="Cada campanha com lead no período: investimento × custo por lead. Abaixo e à direita: investe muito e o lead sai barato."
          >
            <Dispersao
              descricao="Investimento por custo por lead de cada campanha"
              pontos={base
                .filter((l) => l.custoPorLead !== null)
                .map((l) => ({
                  chave: l.id,
                  rotulo: l.nome,
                  x: l.investimento,
                  y: l.custoPorLead as number,
                  cor: PLATAFORMAS[l.plataforma].cor,
                  href: hrefCom(`${BASE}/${l.id}`, f.busca, {
                    cartao: null,
                    q: null,
                  }),
                }))}
              eixoX={{ rotulo: "Investimento", unidade: "moeda0" }}
              eixoY={{ rotulo: "Custo por lead", unidade: "moeda0" }}
              quadrantes={[
                "Lead caro, pouca verba",
                "Lead caro, muita verba",
                "Lead barato, pouca verba",
                "Lead barato, muita verba",
              ]}
              legenda={plats.map((p) => ({
                chave: p,
                rotulo: PLATAFORMAS[p].rotulo,
                cor: PLATAFORMAS[p].cor,
              }))}
            />
            <Fonte>Anúncios e RD Station</Fonte>
          </Secao>
        </div>

        <Secao
          tom="escuro"
          titulo="Conferência com o RD"
          descricao={`${f.rotulo}${interesse ? ` · interesse ${INTERESSES[interesse]}` : ""}`}
        >
          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-neutral-400">Leads no RD no período</p>
              <p className="text-2xl font-semibold tabular-nums">
                {formatarNumero(doPeriodo.leadsTotal)}
              </p>
            </div>
            <div>
              <p className="text-neutral-400">Casados com uma campanha</p>
              <p className="text-2xl font-semibold tabular-nums">
                {formatarNumero(doPeriodo.leadsTotal - doPeriodo.semCampanha)}
              </p>
            </div>
            <div>
              <p className="text-neutral-400">Origem não identificada</p>
              <p className="text-2xl font-semibold tabular-nums">
                {formatarNumero(doPeriodo.semCampanha)}
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs text-neutral-400">
            Lead sem campanha identificada (sem UTM ou de origem orgânica) nunca
            entra numa campanha: aparece no Painel como &quot;origem não
            identificada&quot;. Se a diferença crescer, vale conferir a UTM dos
            anúncios.
          </p>
        </Secao>
      </div>
    </ProvedorDetalhe>
  );
}

const COLUNAS = [
  { titulo: "Plataforma" },
  { titulo: "Campanha", classe: "min-w-56 max-w-72 whitespace-normal" },
  { titulo: "Tipo" },
  { titulo: "Situação" },
  { titulo: "Investimento", numero: true },
  { titulo: "Impressões", numero: true },
  {
    titulo: "Alcance",
    numero: true,
    dica: "Google não informa alcance por campanha",
  },
  { titulo: "Cliques no link", numero: true },
  { titulo: "CTR", numero: true },
  { titulo: "CPC", numero: true },
  { titulo: "Conversões da plataforma", numero: true },
  { titulo: "Leads no RD", numero: true },
  { titulo: "Custo por lead", numero: true },
  { titulo: "Visualizações de vídeo", numero: true },
];

function Ponto({ p }: { p: Plataforma }) {
  return (
    <span
      className="mr-1.5 inline-block size-2 rounded-full align-middle"
      style={{ backgroundColor: `var(--serie-${PLATAFORMAS[p].cor})` }}
      aria-hidden
    />
  );
}

function celulas(l: CampanhaLinha, meta: number | null): React.ReactNode[] {
  const caro =
    meta !== null && l.custoPorLead !== null && l.custoPorLead > meta;
  return [
    <span key="p" className="whitespace-nowrap">
      <Ponto p={l.plataforma} />
      {l.rotuloPlataforma}
    </span>,
    <span key="n" className="font-medium">
      {l.nome}
    </span>,
    rotuloTipo(l.tipo),
    rotuloSituacao(l.situacao) ?? (
      <span key="s" className="text-neutral-400">
        —
      </span>
    ),
    formatarMoeda(l.investimento),
    formatarNumero(l.impressoes),
    l.alcance === null ? (
      <span key="a" className="text-neutral-300">
        —
      </span>
    ) : (
      formatarNumero(l.alcance)
    ),
    formatarNumero(l.cliques),
    formatarPct(l.ctr, 2),
    formatarMoeda(l.cpc),
    formatarNumero(l.conversoesPlataforma),
    <span key="l" className="font-semibold">
      {formatarNumero(l.leadsRd)}
    </span>,
    l.custoPorLead === null ? (
      <span key="c" className="text-neutral-400">
        sem lead
      </span>
    ) : (
      <span
        key="c"
        className={caro ? "font-semibold text-red-700" : "font-semibold"}
      >
        {formatarMoeda(l.custoPorLead)}
      </span>
    ),
    l.visualizacoes === null ? "" : formatarNumero(l.visualizacoes),
  ];
}

function celulasTotais(t: Totais): React.ReactNode[] {
  return [
    "",
    "",
    "",
    "",
    formatarMoeda(t.investimento),
    formatarNumero(t.impressoes),
    "",
    formatarNumero(t.cliques),
    formatarPct(t.ctr, 2),
    formatarMoeda(t.cpc),
    formatarNumero(t.conversoesPlataforma),
    formatarNumero(t.leadsRd),
    formatarMoeda(t.custoPorLead),
    "",
  ];
}

const MOEDA = "#,##0.00";
const COLUNAS_EXPORTAR = [
  { titulo: "Plataforma" },
  { titulo: "Campanha" },
  { titulo: "Tipo" },
  { titulo: "Situação" },
  { titulo: "Investimento (R$)", numero: true, formato: MOEDA },
  { titulo: "Impressões", numero: true },
  { titulo: "Alcance", numero: true },
  { titulo: "Cliques no link", numero: true },
  { titulo: "CTR (%)", numero: true, formato: "0.00" },
  { titulo: "CPC (R$)", numero: true, formato: MOEDA },
  { titulo: "Conversões da plataforma", numero: true },
  { titulo: "Leads no RD", numero: true },
  { titulo: "Custo por lead (R$)", numero: true, formato: MOEDA },
  { titulo: "Visualizações de vídeo", numero: true },
];

type Celula = string | number | null;
const r2 = (v: number | null) =>
  v === null ? null : Math.round(v * 100) / 100;

/** A lista da tela com os subtotais por plataforma e o total geral. */
function linhasExportar(
  lista: CampanhaLinha[],
  plats: Plataforma[],
  total: Totais,
): Celula[][] {
  const linha = (l: CampanhaLinha): Celula[] => [
    l.rotuloPlataforma,
    l.nome,
    rotuloTipo(l.tipo),
    rotuloSituacao(l.situacao) ?? "",
    r2(l.investimento),
    l.impressoes,
    l.alcance,
    l.cliques,
    r2(l.ctr),
    r2(l.cpc),
    l.conversoesPlataforma,
    l.leadsRd,
    r2(l.custoPorLead),
    l.visualizacoes,
  ];
  const tot = (rotulo: string, t: Totais): Celula[] => [
    rotulo,
    "",
    "",
    "",
    r2(t.investimento),
    t.impressoes,
    null,
    t.cliques,
    r2(t.ctr),
    r2(t.cpc),
    t.conversoesPlataforma,
    t.leadsRd,
    r2(t.custoPorLead),
    null,
  ];
  const out: Celula[][] = [];
  for (const p of plats) {
    const ls = lista.filter((l) => l.plataforma === p);
    if (!ls.length) continue;
    out.push(
      ...ls.map(linha),
      tot(`Subtotal ${PLATAFORMAS[p].rotulo}`, somar(ls)),
    );
  }
  out.push(tot("Total geral", total));
  return out;
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
