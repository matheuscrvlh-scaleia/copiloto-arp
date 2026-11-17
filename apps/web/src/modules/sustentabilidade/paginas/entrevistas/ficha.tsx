import { formatarData, formatarDataHora } from "@arp/shared/formato";
import {
  ROTA_ENTREVISTAS,
  rotaAplicar,
  rotaFicha,
} from "@arp/shared/sustentabilidade/entrevistas-chamados";
import { ROTULO_TIPO_ENTREVISTA } from "@arp/shared/sustentabilidade/entrevistas-respostas";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, Play } from "lucide-react";
import { Suspense } from "react";
import { z } from "zod";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { Link, naoEncontrado, useBusca, useParametro } from "@/lib/navegacao";
import { botao } from "@/modules/os/components/ordem/estilos";
import {
  consultaDaEntrevistaSalva,
  consultaDaFicha,
} from "../../api-entrevistas";
import {
  AcoesDaFicha,
  AnexarPapel,
} from "../../components/entrevistas/ficha-acoes";
import { LinkDoChamado } from "../../components/entrevistas/link-chamado";
import { PilulaSituacao } from "../../components/entrevistas/lista-controle";
import { RespostasDaEntrevista } from "../../components/entrevistas/respostas";
import { useContextoSu } from "../../contexto-su";

// /sustentabilidade/entrevistas/:contrato (app/(app)/sustentabilidade/entrevistas/[contrato]/page.tsx).

const ORIGEM: Record<string, string> = {
  sistema: "Aplicada no sistema",
  forms: "Importada do Forms",
  papel: "Papel digitalizado",
};

export default function Page() {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-64" />
          <CartaoCarregando altura="h-96" />
        </TelaCarregando>
      }
    >
      <Tela />
    </Suspense>
  );
}

const ACESSA = [
  "sustentabilidade.entrevistas.ver",
  "sustentabilidade.entrevistas.aplicar",
  "sustentabilidade.entrevistas.dispensar",
  "sustentabilidade.entrevistas.respostas",
] as const;

function Tela() {
  const id = useParametro("contrato");
  const ctx = useContextoSu();
  if (!ACESSA.some((p) => ctx.pode(p))) return <SemAcesso />;
  if (!z.uuid().safeParse(id).success) naoEncontrado();
  return <Ficha id={id} />;
}

function Ficha({ id }: { id: string }) {
  const b = useBusca();
  const { data: ficha, dataUpdatedAt } = useSuspenseQuery(consultaDaFicha(id));
  const ctx = useContextoSu(dataUpdatedAt);
  const { contrato: c, linha: l } = ficha;
  const podeAplicar = ctx.pode("sustentabilidade.entrevistas.aplicar");
  const podeCorrigir = ctx.pode("sustentabilidade.entrevistas.dispensar");
  const ver = typeof b.entrevista === "string" ? b.entrevista : null;
  const aberta = ver ? ficha.entrevistas.find((e) => e.id === ver) : null;

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
              {aberta.completa ? (
                <Suspense fallback={<CartaoCarregando altura="h-40" />}>
                  <Respostas entrevistaId={aberta.id} />
                </Suspense>
              ) : (
                <Indisponiveis />
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
              motivos={ficha.motivosDispensa}
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

/** As respostas da entrevista aberta (versão em que foi respondida). */
function Respostas({ entrevistaId }: { entrevistaId: string }) {
  const { data } = useSuspenseQuery(consultaDaEntrevistaSalva(entrevistaId));
  if (!data.respostas) return <Indisponiveis />;
  return (
    <RespostasDaEntrevista
      definicao={data.respostas.definicao}
      respostas={data.respostas.respostas}
    />
  );
}

function Indisponiveis() {
  return (
    <p className="text-sm text-neutral-500">
      As respostas desta entrevista não estão disponíveis para você.
    </p>
  );
}
