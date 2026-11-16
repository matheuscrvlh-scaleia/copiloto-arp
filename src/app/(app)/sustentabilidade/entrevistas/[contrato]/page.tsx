import { ArrowLeft, FileText, Play } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { botao } from "@/components/os/ordem/estilos";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import {
  AcoesDaFicha,
  AnexarPapel,
} from "@/components/sustentabilidade/entrevistas/ficha-acoes";
import { LinkDoChamado } from "@/components/sustentabilidade/entrevistas/link-chamado";
import { PilulaSituacao } from "@/components/sustentabilidade/entrevistas/lista-controle";
import { RespostasDaEntrevista } from "@/components/sustentabilidade/entrevistas/respostas";
import { formatarData, formatarDataHora } from "@/lib/formato";
import {
  ROTA_ENTREVISTAS,
  rotaAplicar,
  rotaFicha,
} from "@/lib/sustentabilidade/entrevistas-chamados";
import { ROTULO_TIPO_ENTREVISTA } from "@/lib/sustentabilidade/entrevistas-respostas";
import { contextoSu } from "@/server/sustentabilidade/base";
import {
  entrevistaCompleta,
  fichaDoContrato,
  versoesDoQuestionario,
} from "@/server/sustentabilidade/entrevistas";

export const metadata: Metadata = { title: "Ficha da entrevista" };

const ORIGEM: Record<string, string> = {
  sistema: "Aplicada no sistema",
  forms: "Importada do Forms",
  papel: "Papel digitalizado",
};

export default function Page({
  params,
  searchParams,
}: PageProps<"/sustentabilidade/entrevistas/[contrato]">) {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-64" />
          <CartaoCarregando altura="h-96" />
        </TelaCarregando>
      }
    >
      <Tela params={params} busca={searchParams} />
    </Suspense>
  );
}

async function Tela({
  params,
  busca,
}: {
  params: Promise<{ contrato: string }>;
  busca: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ contrato: id }, b, ctx] = await Promise.all([
    params,
    busca,
    contextoSu(),
  ]);
  const acessa = [
    "sustentabilidade.entrevistas.ver",
    "sustentabilidade.entrevistas.aplicar",
    "sustentabilidade.entrevistas.dispensar",
    "sustentabilidade.entrevistas.respostas",
  ] as const;
  if (!acessa.some((p) => ctx.pode(p))) return <SemAcesso />;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ficha = await fichaDoContrato(id);
  if (!ficha) notFound();
  const { contrato: c, linha: l } = ficha;
  const podeAplicar = ctx.pode("sustentabilidade.entrevistas.aplicar");
  const podeCorrigir = ctx.pode("sustentabilidade.entrevistas.dispensar");
  const ver = typeof b.entrevista === "string" ? b.entrevista : null;
  const aberta = ver ? ficha.entrevistas.find((e) => e.id === ver) : null;
  const [completa, versoes] = aberta?.completa
    ? await Promise.all([
        entrevistaCompleta(aberta.id),
        versoesDoQuestionario(),
      ])
    : [null, null];

  const kv: [string, React.ReactNode][] = [
    ["Situação", <PilulaSituacao key="s" situacao={l.situacao} />],
    ["Chamado", <LinkDoChamado key="c" c={l.chamado} />],
    ["CPF ou CNPJ", c.cliente_doc || "—"],
    ["Tipo de loja", c.tipo_loja ?? "—"],
    ["Ramo de atividade", c.ramo ?? "—"],
    ["Ativação (cadastro)", formatarData(c.ativacao)],
    [
      "Inauguração que vale",
      l.ativacaoCorrigida
        ? `${formatarData(l.ativacao)} (corrigida: ${c.ativacao_corrigida_motivo ?? "sem motivo"})`
        : formatarData(l.ativacao),
    ],
    ["Data prevista", formatarData(l.dataPrevista)],
    ["Última entrevista", formatarData(l.ultima)],
    ["Válida até", formatarData(l.validaAte)],
    [
      "Prazo",
      c.validade_meses_especifica
        ? `${c.validade_meses_especifica} meses (específico deste contrato)`
        : "O do setor econômico (Parâmetros)",
    ],
    ...(c.rescisao
      ? ([["Rescisão", formatarData(c.rescisao)]] as [string, string][])
      : []),
    ...(l.fora ? ([["Fora da lista", l.fora]] as [string, string][]) : []),
    ...(c.dispensada_motivo
      ? ([
          [
            "Dispensada",
            `${c.dispensada_motivo}${ficha.dispensadaPor ? ` · ${ficha.dispensadaPor}` : ""}${c.dispensada_em ? ` · ${formatarDataHora(c.dispensada_em)}` : ""}`,
          ],
        ] as [string, string][])
      : []),
  ];

  return (
    <>
      <Link
        href={ROTA_ENTREVISTAS}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Entrevistas
      </Link>
      <PageHeader
        title={c.cliente_nome}
        description={[
          c.contrato ? `Contrato ${c.contrato}` : "Contrato sem número",
          c.lucs.length ? `LUC ${c.lucs.join("/")}` : "",
          c.bloco ?? "",
        ]
          .filter(Boolean)
          .join(" · ")}
      />
      <div className="flex flex-col gap-6">
        {podeAplicar && l.naLista && l.situacao !== "dispensada" && (
          <div data-guia="executar" className="flex flex-wrap gap-2">
            <Link href={rotaAplicar(c.id)} className={botao.primario}>
              <Play className="size-4" aria-hidden />
              Executar entrevista
            </Link>
          </div>
        )}

        <Secao titulo="Contrato e situação">
          <dl
            data-guia="resumo"
            className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3"
          >
            {kv.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-xs text-neutral-500">{k}</dt>
                <dd className="mt-0.5 break-words text-neutral-900">{v}</dd>
              </div>
            ))}
          </dl>
          {c.exemplo && (
            <div className="mt-4">
              <Nota>
                Dados de exemplo (fictícios): contrato criado para teste.
              </Nota>
            </div>
          )}
        </Secao>

        <Secao
          titulo="Histórico de entrevistas"
          descricao="Da mais nova para a mais antiga, com a versão do questionário em que foi respondida."
        >
          {ficha.entrevistas.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Nenhuma entrevista ainda.{" "}
              {podeAplicar && l.naLista
                ? "Toque em “Executar entrevista” para aplicar o questionário."
                : "A entrevista é aplicada pelo chamado “Entrevista de resíduos” do setor."}
            </p>
          ) : (
            <ul data-guia="historico" className="flex flex-col gap-3">
              {ficha.entrevistas.map((e) => (
                <li
                  key={e.id}
                  className="rounded-2xl border border-neutral-200 bg-white/70 p-4 text-sm"
                >
                  <p className="font-medium">
                    {formatarData(e.data)} ·{" "}
                    {ROTULO_TIPO_ENTREVISTA[e.tipo as "primeira"] ?? e.tipo} ·{" "}
                    {e.setor ?? "sem setor"} · versão {e.versao} do questionário
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {ORIGEM[e.origem] ?? e.origem}
                    {e.entrevistador ? ` · ${e.entrevistador}` : ""}
                    {e.respondente ? ` · respondeu ${e.respondente}` : ""}
                    {e.validaAte
                      ? ` · válida até ${formatarData(e.validaAte)}`
                      : ""}
                    {e.transferidaDe
                      ? ` · transferida de ${e.transferidaDe}`
                      : ""}
                    {e.exemplo ? " · exemplo (fictícia)" : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {e.completa ? (
                      <Link
                        href={`${rotaFicha(c.id)}?entrevista=${e.id}#respostas`}
                        scroll={false}
                        className="text-sm font-medium underline-offset-4 hover:underline"
                      >
                        Ver respostas
                      </Link>
                    ) : (
                      <span className="text-xs text-neutral-500">
                        Respostas e PDF só com “Entrevistas – ver respostas”.
                      </span>
                    )}
                    {e.pdf && (
                      <a
                        href={e.pdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
                      >
                        <FileText className="size-4" aria-hidden />
                        PDF assinado
                      </a>
                    )}
                    {e.anexos.map((a) =>
                      a.url ? (
                        <a
                          key={a.caminho}
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm underline-offset-4 hover:underline"
                        >
                          {a.nome}
                        </a>
                      ) : null,
                    )}
                  </div>
                  {podeCorrigir && e.completa && (
                    <div className="mt-3">
                      <AnexarPapel entrevistaId={e.id} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Secao>

        {aberta && (
          <section id="respostas" className="scroll-mt-6">
            <Secao
              titulo={`Respostas de ${formatarData(aberta.data)}`}
              descricao={`Texto da versão ${aberta.versao} do questionário, em que a entrevista foi respondida.`}
            >
              {completa && versoes?.get(completa.formulario_versao) ? (
                <RespostasDaEntrevista
                  definicao={
                    versoes.get(completa.formulario_versao) ?? { secoes: [] }
                  }
                  respostas={completa.respostas}
                />
              ) : (
                <p className="text-sm text-neutral-500">
                  As respostas desta entrevista não estão disponíveis para você.
                </p>
              )}
            </Secao>
          </section>
        )}

        {ficha.transferencias.length > 0 && (
          <Secao titulo="Transferências">
            <ul className="flex flex-col gap-2 text-sm">
              {ficha.transferencias.map((t) => (
                <li key={`${t.entrevistaId}-${t.quando}`}>
                  {formatarDataHora(t.quando)} · de {t.de} para {t.para} ·{" "}
                  {t.motivo}
                  {t.quem ? ` · ${t.quem}` : ""}
                </li>
              ))}
            </ul>
          </Secao>
        )}

        {podeCorrigir && (
          <Secao
            titulo="Dispensar ou corrigir"
            descricao="Cada mudança fica no histórico com quem fez e quando."
          >
            <AcoesDaFicha
              contratoId={c.id}
              dispensada={c.dispensada_motivo != null}
              motivos={ficha.parametros.motivos_dispensa}
              ativacaoCorrigida={c.ativacao_corrigida}
              validadeEspecifica={c.validade_meses_especifica}
              entrevistas={ficha.entrevistas.map((e) => ({
                id: e.id,
                rotulo: `${formatarData(e.data)} · ${e.setor ?? "sem setor"}`,
              }))}
              mesmoCliente={ficha.mesmoCliente}
            />
          </Secao>
        )}
      </div>
    </>
  );
}
