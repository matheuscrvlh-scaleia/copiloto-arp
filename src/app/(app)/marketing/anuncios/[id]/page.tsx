import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  CartaoCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { AreaLinha } from "@/components/dashboard/graficos/area-linha";
import { BarrasHorizontais } from "@/components/dashboard/graficos/barras-horizontais";
import { Colunas } from "@/components/dashboard/graficos/colunas";
import { Rosca } from "@/components/dashboard/graficos/rosca";
import { Secao } from "@/components/dashboard/tabela";
import { TabelaMkt } from "@/components/marketing/tabela";
import {
  AbrirNaFerramenta,
  CartaoMkt,
  Cartoes,
  Fonte,
  hrefCom,
  TopoDaTela,
  variacaoContra,
} from "@/components/marketing/tela";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import {
  formatarData,
  formatarMoeda,
  formatarNumero,
  formatarPct,
} from "@/lib/formato";
import {
  diaADia,
  linhasDeCampanha,
  linkNaPlataforma,
  PLATAFORMAS,
  quebraMeta,
  rotuloSituacao,
  rotuloTipo,
  termosDePesquisa,
} from "@/lib/marketing/anuncios";
import { diaDaSemana, linhaDeFiltros } from "@/lib/marketing/periodo";
import {
  type Busca,
  INTERESSES,
  type Interesse,
  interesseDasLandingPages,
  lerFiltros,
} from "@/server/marketing/filtros";
import { dadosAnuncios, dadosRd } from "@/server/marketing/fontes";

export const metadata: Metadata = { title: "Detalhe da campanha" };

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export default function Page({
  params,
  searchParams,
}: PageProps<"/marketing/anuncios/[id]">) {
  return (
    <Suspense fallback={<Esqueleto />}>
      <Protegido permissao="marketing.anuncios">
        <Tela params={params} busca={searchParams} />
      </Protegido>
    </Suspense>
  );
}

async function Tela({
  params,
  busca,
}: {
  params: Promise<{ id: string }>;
  busca: Promise<Busca>;
}) {
  const [{ id }, b] = await Promise.all([params, busca]);
  // Detalhe usa os filtros que vieram no link (não os lembrados).
  const f = await lerFiltros(
    "anuncios_detalhe",
    { ...b, _: "1" },
    "semana_passada",
  );
  const interesse = f.um("interesse") as Interesse | "";
  const [anuncios, rd, interesseDe] = await Promise.all([
    dadosAnuncios(),
    dadosRd(),
    interesseDasLandingPages(),
  ]);
  const aceita = interesse
    ? (c: { conversion_identifier: string }) =>
        interesseDe(c.conversion_identifier) === interesse
    : undefined;
  const conversoes = aceita ? rd.conversoes.filter(aceita) : rd.conversoes;
  const c = linhasDeCampanha(anuncios, conversoes, f.periodo).linhas.find(
    (l) => l.id === id,
  );
  if (!c) {
    const existe = anuncios.campanhas.some((x) => x.id === id);
    if (!existe) notFound();
  }
  const ant = linhasDeCampanha(anuncios, conversoes, f.anterior).linhas.find(
    (l) => l.id === id,
  );
  const campanha = anuncios.campanhas.find((x) => x.id === id);
  if (!campanha) notFound();
  const ref = { id, nome: campanha.nome, plataforma: campanha.plataforma };
  const dias = diaADia(anuncios, conversoes, ref, f.periodo);
  const voltar = hrefCom(
    "/marketing/anuncios",
    Object.fromEntries(Object.entries(b).filter(([k]) => k !== "_")),
    {},
  );

  const filtros = linhaDeFiltros([
    { rotulo: "Período", valor: f.rotulo },
    {
      rotulo: "Interesse do lead",
      valor: interesse ? INTERESSES[interesse] : "Todos",
    },
  ]);

  return (
    <>
      <Link
        href={voltar}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900"
      >
        <ArrowLeft className="size-4" aria-hidden /> Performance de anúncios
      </Link>
      <PageHeader
        title={campanha.nome}
        description={`${PLATAFORMAS[campanha.plataforma].ferramenta} · ${rotuloTipo(campanha.tipo)}${rotuloSituacao(campanha.situacao) ? ` · ${rotuloSituacao(campanha.situacao)}` : ""}`}
      />
      <div className="flex flex-col gap-6">
        <TopoDaTela
          dadosDe={f.ctx.dadosDe}
          filtros={filtros}
          acoes={
            <AbrirNaFerramenta
              href={linkNaPlataforma(ref)}
              ferramenta={PLATAFORMAS[campanha.plataforma].ferramenta}
            />
          }
        />
        {!c ? (
          <p className="vidro rounded-[1.75rem] p-6 text-sm text-neutral-600">
            Sem gasto nesta campanha em {f.rotulo}. Escolha outro período na
            lista.
          </p>
        ) : (
          <>
            <Cartoes>
              <CartaoMkt
                titulo="Investimento"
                valor={formatarMoeda(c.investimento)}
                variacao={
                  ant
                    ? variacaoContra(
                        c.investimento,
                        ant.investimento,
                        f.rotuloAnterior,
                        "neutro",
                      )
                    : undefined
                }
                fonte={PLATAFORMAS[c.plataforma].ferramenta}
              />
              <CartaoMkt
                titulo="Leads no RD"
                valor={formatarNumero(c.leadsRd)}
                variacao={
                  ant
                    ? variacaoContra(c.leadsRd, ant.leadsRd, f.rotuloAnterior)
                    : undefined
                }
                detalhe={`Conversões da plataforma: ${formatarNumero(c.conversoesPlataforma)}`}
                fonte="RD Station"
              />
              <CartaoMkt
                titulo="Custo por lead"
                valor={
                  c.custoPorLead === null
                    ? "sem lead"
                    : formatarMoeda(c.custoPorLead)
                }
                variacao={
                  ant?.custoPorLead && c.custoPorLead
                    ? variacaoContra(
                        c.custoPorLead,
                        ant.custoPorLead,
                        f.rotuloAnterior,
                        "menor_melhor",
                      )
                    : undefined
                }
                fonte="Anúncios e RD Station"
              />
              <CartaoMkt
                titulo="Cliques no link"
                valor={formatarNumero(c.cliques)}
                detalhe={`CTR ${formatarPct(c.ctr, 2)} · CPC ${formatarMoeda(c.cpc)}${c.frequencia ? ` · frequência ${formatarNumero(c.frequencia, 2)}` : ""}`}
                fonte={PLATAFORMAS[c.plataforma].ferramenta}
              />
            </Cartoes>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Secao titulo="Investimento por dia" descricao={f.rotulo}>
                <AreaLinha
                  descricao="Investimento por dia"
                  itens={dias.map((d) => ({
                    chave: d.data,
                    rotulo:
                      dias.length > 14
                        ? d.data.slice(8, 10)
                        : `${DIAS[diaDaSemana(d.data)]} ${d.data.slice(8, 10)}`,
                    titulo: formatarData(d.data),
                    valor: d.investimento,
                    texto: formatarMoeda(d.investimento),
                    detalhe: `${formatarNumero(d.cliques)} cliques`,
                  }))}
                />
                <Fonte>{PLATAFORMAS[c.plataforma].ferramenta}</Fonte>
              </Secao>
              <Secao titulo="Leads no RD por dia" descricao={f.rotulo}>
                <Colunas
                  descricao="Leads no RD por dia"
                  itens={dias.map((d) => ({
                    chave: d.data,
                    rotulo:
                      dias.length > 14
                        ? d.data.slice(8, 10)
                        : (DIAS[diaDaSemana(d.data)] ?? ""),
                    titulo: formatarData(d.data),
                    valor: d.leadsRd,
                    texto: formatarNumero(d.leadsRd),
                    detalhe: `Conversões da plataforma: ${d.conversoesPlataforma}`,
                  }))}
                />
                <Fonte>RD Station</Fonte>
              </Secao>
            </div>

            {c.plataforma === "meta" && (
              <QuebrasMeta anuncios={anuncios} id={id} periodo={f.periodo} />
            )}
            {c.plataforma === "google" && c.tipo === "SEARCH" && (
              <Secao
                titulo="Termos de pesquisa"
                descricao={`Os 20 com mais cliques · ${f.rotulo}`}
              >
                <TabelaMkt
                  semBusca
                  colunas={[
                    { titulo: "Termo" },
                    { titulo: "Impressões", numero: true },
                    { titulo: "Cliques", numero: true },
                    { titulo: "Investimento", numero: true },
                  ]}
                  ordemInicial={{ coluna: 2, desc: true }}
                  linhas={termosDePesquisa(
                    anuncios.google.termos,
                    id,
                    f.periodo,
                  ).map((t) => ({
                    chave: t.termo,
                    busca: t.termo,
                    celulas: [
                      t.termo,
                      formatarNumero(t.impressoes),
                      formatarNumero(t.cliques),
                      formatarMoeda(t.investimento),
                    ],
                    ordem: [t.termo, t.impressoes, t.cliques, t.investimento],
                  }))}
                />
                <Fonte>Google Ads (search_term_view)</Fonte>
              </Secao>
            )}

            <Secao titulo="Dia a dia" descricao={f.rotulo}>
              <TabelaMkt
                semBusca
                colunas={[
                  { titulo: "Data" },
                  { titulo: "Investimento", numero: true },
                  { titulo: "Impressões", numero: true },
                  { titulo: "Cliques no link", numero: true },
                  { titulo: "Conversões da plataforma", numero: true },
                  { titulo: "Leads no RD", numero: true },
                  { titulo: "Custo por lead", numero: true },
                ]}
                ordemInicial={{ coluna: 0, desc: false }}
                linhas={dias.map((d) => ({
                  chave: d.data,
                  busca: d.data,
                  celulas: [
                    `${formatarData(d.data)} (${DIAS[diaDaSemana(d.data)]})`,
                    formatarMoeda(d.investimento),
                    formatarNumero(d.impressoes),
                    formatarNumero(d.cliques),
                    formatarNumero(d.conversoesPlataforma),
                    formatarNumero(d.leadsRd),
                    d.leadsRd ? formatarMoeda(d.investimento / d.leadsRd) : "—",
                  ],
                  ordem: [
                    d.data,
                    d.investimento,
                    d.impressoes,
                    d.cliques,
                    d.conversoesPlataforma,
                    d.leadsRd,
                    d.leadsRd ? d.investimento / d.leadsRd : null,
                  ],
                }))}
                rodape={[
                  "Total",
                  formatarMoeda(c.investimento),
                  formatarNumero(c.impressoes),
                  formatarNumero(c.cliques),
                  formatarNumero(c.conversoesPlataforma),
                  formatarNumero(c.leadsRd),
                  formatarMoeda(c.custoPorLead),
                ]}
              />
              <Fonte>{PLATAFORMAS[c.plataforma].ferramenta} e RD Station</Fonte>
            </Secao>
          </>
        )}
      </div>
    </>
  );
}

function QuebrasMeta({
  anuncios,
  id,
  periodo,
}: {
  anuncios: Awaited<ReturnType<typeof dadosAnuncios>>;
  id: string;
  periodo: { de: string; ate: string };
}) {
  const plat = quebraMeta(
    anuncios.meta.quebras,
    id,
    periodo,
    "publisher_platform",
  );
  const estados = quebraMeta(anuncios.meta.quebras, id, periodo, "region");
  const total = plat.reduce((s, p) => s + p.investimento, 0);
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Secao
        titulo="Facebook × Instagram"
        descricao="Investimento por onde o anúncio apareceu"
      >
        <Rosca
          descricao="Investimento por plataforma do Meta"
          centro={{ valor: formatarMoeda(total, 0), rotulo: "investido" }}
          fatias={plat.map((p) => ({
            chave: p.chave,
            rotulo: p.chave === "instagram" ? "Instagram" : "Facebook",
            valor: p.investimento,
            texto: `${formatarMoeda(p.investimento)} · ${formatarNumero(p.cliques)} cliques`,
            cor: p.chave === "instagram" ? 5 : 1,
          }))}
        />
        <Fonte>Meta Ads (publisher_platform)</Fonte>
      </Secao>
      <Secao
        titulo="Por estado"
        descricao="Investimento por região de quem viu o anúncio"
      >
        <BarrasHorizontais
          descricao="Investimento por estado"
          itens={estados.map((e) => ({
            chave: e.chave,
            rotulo: e.chave,
            valor: e.investimento,
            texto: formatarMoeda(e.investimento),
            detalhe: `${formatarNumero(e.impressoes)} impressões · ${formatarNumero(e.cliques)} cliques`,
          }))}
        />
        <Fonte>Meta Ads (region)</Fonte>
      </Secao>
    </div>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <CartaoCarregando altura="h-20" />
      <IndicadoresCarregando
        className="sm:grid-cols-2 xl:grid-cols-4"
        quantidade={4}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CartaoCarregando altura="h-72" />
        <CartaoCarregando altura="h-72" />
      </div>
    </TelaCarregando>
  );
}
