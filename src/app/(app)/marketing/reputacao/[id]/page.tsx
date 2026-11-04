import { ArrowLeft, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  CartaoCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { BarrasHorizontais } from "@/components/dashboard/graficos/barras-horizontais";
import { Secao } from "@/components/dashboard/tabela";
import {
  AbrirNaFerramenta,
  CartaoDaTela,
  Cartoes,
  Fonte,
  hrefCom,
  TopoDaTela,
  variacaoContra,
} from "@/components/dashboard/tela";
import {
  ListaDeAvaliacoes,
  SeloSituacao,
} from "@/components/marketing/reputacao/avaliacoes";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { formatarNumero, formatarPct } from "@/lib/formato";
import { dentro, linhaDeFiltros } from "@/lib/marketing/periodo";
import {
  linhasDeLocatarios,
  medir,
  SITUACOES,
} from "@/lib/marketing/reputacao";
import { locatarios, parametros, temasEcodigos } from "@/server/marketing/base";
import { type Busca, lerFiltros } from "@/server/marketing/filtros";
import { dadosReputacao } from "@/server/marketing/fontes";

export const metadata: Metadata = { title: "Avaliações do locatário" };

const BASE = "/marketing/reputacao";
const GOOGLE = "Google Perfil da Empresa";
const ACESSO: Record<string, string> = {
  gerente: "Perfil administrado pela ARP",
  consulta_publica: "Consulta pública (dados parciais)",
  sem_acesso: "Sem acesso",
};

export default function Page({
  params,
  searchParams,
}: PageProps<"/marketing/reputacao/[id]">) {
  return (
    <Suspense fallback={<Esqueleto />}>
      <Protegido permissao="marketing.reputacao">
        <Tela params={params} busca={searchParams} />
      </Protegido>
    </Suspense>
  );
}

const nota = (v: number | null) => (v === null ? "—" : formatarNumero(v, 1));

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
    "reputacao_detalhe",
    { ...b, _: "1" },
    "ultimos_30",
  );
  const [fontes, p, lista, { temas }] = await Promise.all([
    dadosReputacao(),
    parametros(),
    locatarios(),
    temasEcodigos(),
  ]);
  const cadastro = lista.find((l) => l.id === id);
  if (!cadastro) notFound();
  const temasAtivos = temas.filter((t) => t.ativo).map((t) => t.nome);
  const tema = temasAtivos.includes(f.um("tema")) ? f.um("tema") : "";
  const cartao = f.um("cartao");
  const hoje = f.ctx.hoje;
  const [l] = linhasDeLocatarios(
    fontes,
    [cadastro],
    p,
    temasAtivos,
    f.periodo,
    hoje,
    tema,
  );
  if (!l) notFound();
  const ant = medir(l.avaliacoes, f.anterior, tema);
  const doPeriodo = l.avaliacoes.filter(
    (a) =>
      dentro(a.data, f.periodo) &&
      (!tema || a.tema === tema) &&
      (cartao !== "reclamacoes" || a.reclamacao),
  );
  const semFiltro = Object.fromEntries(
    Object.entries(b).filter(([k]) => k !== "_"),
  );
  const aqui = (muda: Record<string, string | null>) =>
    hrefCom(`${BASE}/${id}`, semFiltro, muda);
  const voltar = hrefCom(BASE, semFiltro, {
    aba: "locatarios",
    cartao: null,
  });

  const filtros = linhaDeFiltros([
    { rotulo: "Período", valor: f.rotulo },
    { rotulo: "Tema", valor: tema || "Todos" },
    ...(cartao === "reclamacoes"
      ? [{ rotulo: "Cartão", valor: "Só reclamações" }]
      : []),
  ]);

  return (
    <>
      <Link
        href={voltar}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900"
      >
        <ArrowLeft className="size-4" aria-hidden /> Reputação dos locatários
      </Link>
      <PageHeader
        title={l.nome}
        description={`${l.categoria} · ${ACESSO[l.acesso] ?? l.acesso}${l.titulo && l.titulo !== l.nome ? ` · no Google: ${l.titulo}` : ""}`}
      />
      <div className="flex flex-col gap-6">
        <TopoDaTela
          dadosDe={f.ctx.dadosDe}
          filtros={filtros}
          acoes={
            l.mapsUri ? (
              <AbrirNaFerramenta href={l.mapsUri} ferramenta="Google" />
            ) : undefined
          }
        />
        {(tema || cartao) && (
          <div className="flex flex-wrap gap-2">
            {tema && (
              <Link
                href={aqui({ tema: null })}
                scroll={false}
                className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white"
              >
                Tema: {tema} <X className="size-3" aria-label="tirar" />
              </Link>
            )}
            {cartao === "reclamacoes" && (
              <Link
                href={aqui({ cartao: null })}
                scroll={false}
                className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white"
              >
                Só reclamações <X className="size-3" aria-label="tirar" />
              </Link>
            )}
          </div>
        )}

        {l.semDados ? (
          <p className="vidro rounded-[1.75rem] p-6 text-sm text-neutral-600">
            Sem dados: o link do Google em Configurações está vazio ou inválido,
            ou o perfil não está acessível. O locatário segue na lista da
            Reputação com essa marca, sem nota.
          </p>
        ) : (
          <>
            {l.parcial && (
              <p className="rounded-2xl bg-amber-400/15 px-4 py-3 text-sm text-amber-900">
                Dados parciais: a ARP não administra este perfil, e o Google
                entrega só a nota, o total e até 5 avaliações, sem garantia de
                serem as mais novas. Novas, reclamações e situação podem ficar
                abaixo do real.
              </p>
            )}
            <Cartoes modulo="marketing">
              <CartaoDaTela
                titulo="Nota média"
                exemplo={
                  "avaliações do Google Perfil da Empresa, até a ferramenta ser ligada"
                }
                valor={nota(l.nota)}
                detalhe={`${formatarNumero(l.total ?? 0)} avaliações no Google`}
                calculo="Nota que o Google mostra no perfil (averageRating)."
                fonte={GOOGLE}
              />
              <CartaoDaTela
                titulo="Novas no período"
                exemplo={
                  "avaliações do Google Perfil da Empresa, até a ferramenta ser ligada"
                }
                valor={formatarNumero(l.periodo.novas)}
                variacao={variacaoContra(
                  l.periodo.novas,
                  ant.novas,
                  f.rotuloAnterior,
                )}
                detalhe={`Nota das novas: ${nota(l.periodo.notaDasNovas)} · respondidas ${formatarPct(l.periodo.taxaResposta)}`}
                fonte={GOOGLE}
              />
              <CartaoDaTela
                titulo="Reclamações no período"
                exemplo={
                  "avaliações do Google Perfil da Empresa, até a ferramenta ser ligada"
                }
                valor={formatarNumero(l.periodo.reclamacoes)}
                variacao={variacaoContra(
                  l.periodo.reclamacoes,
                  ant.reclamacoes,
                  f.rotuloAnterior,
                  "menor_melhor",
                )}
                detalhe={
                  l.periodo.temaMaisCitado
                    ? `Tema mais citado: ${l.periodo.temaMaisCitado}`
                    : undefined
                }
                fonte={GOOGLE}
                href={aqui({
                  cartao: cartao === "reclamacoes" ? null : "reclamacoes",
                })}
                ativo={cartao === "reclamacoes"}
              />
              <CartaoDaTela
                titulo="Situação"
                exemplo={
                  "avaliações do Google Perfil da Empresa, até a ferramenta ser ligada"
                }
                valor={SITUACOES[l.situacao].rotulo}
                detalhe={`${l.janela.reclamacoes} ${l.janela.reclamacoes === 1 ? "reclamação" : "reclamações"} nos últimos ${p.janela_reputacao_dias} dias · nota das novas ${nota(l.janela.notaDasNovas)}`}
                calculo={`Alerta: ${p.reclamacoes_alerta} ou mais reclamações em ${p.janela_reputacao_dias} dias; Atenção: de ${p.reclamacoes_atencao} a ${p.reclamacoes_alerta - 1}, ou nota das novas abaixo de ${nota(p.nota_atencao)} (Configurações).`}
                fonte={`${GOOGLE} e Configurações`}
              />
            </Cartoes>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
              <Secao
                titulo="Avaliações"
                descricao={`${f.rotulo} · a mais recente primeiro`}
              >
                <ListaDeAvaliacoes avaliacoes={doPeriodo} mapsUri={l.mapsUri} />
                <Fonte>
                  {GOOGLE}. Tema: classificação automática na lista de temas de
                  Configurações.
                </Fonte>
              </Secao>
              <Secao
                tom="verde"
                titulo="Estrelas"
                calculo="Avaliações deste local feitas no período, contadas por número de estrelas (starRating), de 5 a 1. Fonte: Google Perfil da Empresa."
                exemplo={
                  "avaliações do Google Perfil da Empresa, até a ferramenta ser ligada"
                }
                descricao={`${f.rotulo}, de 5 a 1`}
              >
                <div className="mb-4">
                  <SeloSituacao situacao={l.situacao} />
                </div>
                <BarrasHorizontais
                  descricao="Avaliações do locatário por número de estrelas"
                  itens={medir(l.avaliacoes, f.periodo).distribuicao.map(
                    (n, i) => ({
                      chave: String(5 - i),
                      rotulo: `${5 - i} ${i === 4 ? "estrela" : "estrelas"}`,
                      valor: n,
                      texto: formatarNumero(n),
                    }),
                  )}
                />
                <Fonte>{GOOGLE}</Fonte>
              </Secao>
            </div>
          </>
        )}
      </div>
    </>
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
      <CartaoCarregando altura="h-96" />
    </TelaCarregando>
  );
}
