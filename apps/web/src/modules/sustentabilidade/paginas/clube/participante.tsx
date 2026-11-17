import { formatarDocumento } from "@arp/shared/documentos";
import { formatarData, formatarNumero } from "@arp/shared/formato";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { z } from "zod";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { Link, naoEncontrado, useParametro } from "@/lib/navegacao";
import { consultaDoParticipante } from "../../api-clube";
import {
  ListaDeAcoes,
  ListaDeContribuicoes,
  RegistrarAcao,
  RegistrarContribuicao,
} from "../../components/clube/contribuicoes";
import {
  FormasEDados,
  FormContato,
  FormValorCombinado,
  SairDoClube,
  VoltarAoClube,
} from "../../components/clube/edicao";
import {
  Resumo,
  SeloDaEntrevista,
  SeloDaSituacao,
  TopoDaTela,
  Voltar,
} from "../../components/clube/tela";
import { ListaDeTermos, RegistrarTermo } from "../../components/clube/termos";
import { useContextoSu } from "../../contexto-su";

// /sustentabilidade/clube/:id (app/(app)/sustentabilidade/clube/[id]/page.tsx).

const BASE = "/sustentabilidade/clube";

export default function Page() {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-40" />
          <CartaoCarregando altura="h-64" />
        </TelaCarregando>
      }
    >
      <Tela />
    </Suspense>
  );
}

function Tela() {
  const id = useParametro("id");
  const ctx = useContextoSu();
  const editar = ctx.pode("sustentabilidade.clube.editar");
  if (!editar && !ctx.pode("sustentabilidade.clube.ver")) return <SemAcesso />;
  if (!z.uuid().safeParse(id).success) naoEncontrado();
  return <Participante id={id} />;
}

function Participante({ id }: { id: string }) {
  const { data: d, dataUpdatedAt } = useSuspenseQuery(
    consultaDoParticipante(id),
  );
  const ctx = useContextoSu(dataUpdatedAt);
  const editar = ctx.pode("sustentabilidade.clube.editar");

  const p = d.participante;
  const comValores = ctx.pode("sustentabilidade.valores");
  const veContato = ctx.pode("sustentabilidade.contato");
  const veEntrevistas = ctx.pode("sustentabilidade.entrevistas.ver");
  const desde = d.termos.length
    ? d.termos.reduce(
        (m, t) => (t.assinado_em < m ? t.assinado_em : m),
        (d.termos[0] as { assinado_em: string }).assinado_em,
      )
    : null;
  const lucs = [
    ...new Set(
      d.entrevistas
        .filter((e) => e.contrato.situacao === "vigente")
        .flatMap((e) => e.contrato.lucs),
    ),
  ];

  return (
    <>
      <Voltar href={BASE}>Clube SustentArp</Voltar>
      <PageHeader
        title={p.nome}
        description={`${formatarDocumento(p.cliente_doc)} · ${d.locatario ? "Locatário" : "Não locatário"}`}
      />
      <div className="flex flex-col gap-6">
        <TopoDaTela
          dadosDe={ctx.dadosDe}
          acoes={
            editar && !p.saiu_em ? (
              <SairDoClube participanteId={p.id} hoje={ctx.hoje} />
            ) : undefined
          }
        />

        {p.saiu_em && (
          <div
            data-guia="saiu"
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-neutral-900/[0.05] px-4 py-3 text-sm text-neutral-700"
          >
            <p>
              <strong>Saiu do clube em {formatarData(p.saiu_em)}.</strong>{" "}
              {p.saiu_motivo}
            </p>
            {editar && <VoltarAoClube participanteId={p.id} />}
          </div>
        )}
        {d.situacao === "interessado" && (
          <p className="rounded-2xl bg-sky-500/10 px-4 py-3 text-sm text-sky-900">
            Interessado: demonstrou interesse na entrevista e ainda não tem
            termo.{" "}
            {editar
              ? "Registre o termo para ele entrar no clube."
              : "Quem edita o Clube registra o termo."}
          </p>
        )}

        <Secao titulo="Resumo" descricao="Participação do cliente no clube">
          <Resumo
            itens={[
              {
                rotulo: "Situação",
                valor: <SeloDaSituacao situacao={d.situacao} />,
              },
              {
                rotulo: "Participa do clube",
                valor: p.saiu_em
                  ? `Saiu em ${formatarData(p.saiu_em)}`
                  : d.situacao === "interessado" || !desde
                    ? "Ainda não"
                    : `Sim, desde ${formatarData(desde)}`,
              },
              { rotulo: "Válido até", valor: formatarData(d.validoAte) },
              {
                rotulo: "Formas de participação",
                valor: p.formas.length ? p.formas.join(", ") : "—",
              },
              {
                rotulo: "LUCs dos contratos",
                valor: lucs.length ? lucs.join(", ") : "—",
              },
              ...(comValores
                ? [
                    {
                      rotulo: "Valor combinado por mês",
                      valor:
                        d.valorCombinadoMes === null
                          ? "—"
                          : formatarNumero(d.valorCombinadoMes, 2),
                    },
                  ]
                : []),
            ]}
          />
          {p.exemplo && (
            <div className="mt-3">
              <Nota>
                Dados de exemplo (fictícios): este participante não é um cliente
                real.
              </Nota>
            </div>
          )}
        </Secao>

        <Secao
          titulo="Termos"
          descricao={`Um por ano, válido por ${d.validadeMeses} ${d.validadeMeses === 1 ? "mês" : "meses"} a partir da assinatura. Trinta dias antes (Parâmetros: ${d.avisoDias}) o sistema abre o chamado Renovar termo do Clube.`}
        >
          {editar && (
            <div className="mb-3 flex justify-end">
              <RegistrarTermo
                participanteId={p.id}
                nome={p.nome}
                hoje={ctx.hoje}
                validadeMeses={d.validadeMeses}
              />
            </div>
          )}
          <ListaDeTermos
            termos={d.termos.map((t) => ({
              id: t.id,
              ano: t.ano,
              assinadoEm: t.assinado_em,
              validoAte: t.valido_ate,
              temArquivo: !!t.arquivo,
              temAssinatura: !!t.assinatura,
            }))}
            hoje={ctx.hoje}
            podeEditar={editar}
          />
        </Secao>

        <Secao
          titulo="Contribuições"
          descricao={`O sistema só registra o que foi recebido: não gera cobrança.${comValores ? "" : " Valores em reais só para quem tem a permissão de valores."}`}
        >
          {editar && (
            <div className="mb-3 flex justify-end">
              <RegistrarContribuicao
                participanteId={p.id}
                formas={d.formasDeContribuicao}
                hoje={ctx.hoje}
              />
            </div>
          )}
          <ListaDeContribuicoes
            contribuicoes={d.contribuicoes}
            comValores={comValores}
            podeEditar={editar}
          />
        </Secao>

        <Secao
          titulo="Ações"
          descricao="Entrega de resíduos, oficina, evento ou outra: mostram o engajamento, que não depende de pagar."
        >
          {editar && (
            <div className="mb-3 flex justify-end">
              <RegistrarAcao
                participanteId={p.id}
                tipos={d.tiposDeAcao}
                hoje={ctx.hoje}
              />
            </div>
          )}
          <ListaDeAcoes acoes={d.acoes} podeEditar={editar} />
        </Secao>

        <Secao
          titulo="Dados do participante"
          descricao="Formas de participação, valor combinado e contato."
        >
          <div className="flex flex-col gap-6">
            {editar ? (
              <FormasEDados
                participanteId={p.id}
                formas={p.formas}
                formasDoClube={d.formasDoClube}
                nome={p.nome}
                nomeEditavel={p.locatario_manual}
              />
            ) : (
              <p className="text-sm text-neutral-700">
                Formas de participação: {p.formas.join(", ") || "nenhuma"}.
              </p>
            )}
            {comValores &&
              (editar ? (
                <FormValorCombinado
                  participanteId={p.id}
                  valor={d.valorCombinadoMes}
                />
              ) : (
                <p className="text-sm text-neutral-700">
                  Valor combinado por mês:{" "}
                  {d.valorCombinadoMes === null
                    ? "não há"
                    : formatarNumero(d.valorCombinadoMes, 2)}
                  .
                </p>
              ))}
            {veContato &&
              (editar ? (
                <FormContato participanteId={p.id} contato={d.contato} />
              ) : (
                <p className="text-sm text-neutral-700">
                  Contato:{" "}
                  {[d.contato?.contato, d.contato?.email, d.contato?.telefone]
                    .filter(Boolean)
                    .join(" · ") || "não informado"}
                  .
                </p>
              ))}
          </div>
        </Secao>

        <Secao
          titulo="Sustentabilidade do cliente"
          descricao="Entrevistas de resíduos dos contratos deste cliente (4.4). Como o sistema ainda não tem a ficha do cliente, esta visão fica aqui (a confirmar)."
        >
          {d.entrevistas.length === 0 ? (
            <p className="py-4 text-sm text-neutral-500">
              Este CPF ou CNPJ não tem contrato. Participante cadastrado à mão
              não tem entrevista.
            </p>
          ) : (
            <div
              data-guia="entrevistas-do-cliente"
              className="-mx-2 overflow-x-auto"
            >
              <table className="w-full min-w-max border-collapse text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                    <th className="px-2 py-2 font-medium">Contrato</th>
                    <th className="px-2 py-2 font-medium">LUCs</th>
                    <th className="px-2 py-2 font-medium">Bloco</th>
                    <th className="px-2 py-2 font-medium">Entrevista</th>
                    <th className="px-2 py-2 font-medium">Última</th>
                    <th className="px-2 py-2 font-medium">
                      Válida até (ou prevista)
                    </th>
                    {veEntrevistas && (
                      <th className="w-24" aria-label="Ficha" />
                    )}
                  </tr>
                </thead>
                <tbody>
                  {d.entrevistas.map((e) => (
                    <tr
                      key={e.contratoId}
                      className="border-b border-neutral-900/[0.06] last:border-0"
                    >
                      <td className="px-2 py-2">
                        {e.contrato.contrato ?? "—"}
                        {e.contrato.situacao === "encerrado" && (
                          <span className="ml-2 text-xs text-neutral-500">
                            encerrado
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 font-mono text-xs">
                        {e.contrato.lucs.join(", ") || "—"}
                      </td>
                      <td className="px-2 py-2">{e.contrato.bloco ?? "—"}</td>
                      <td className="px-2 py-2">
                        {e.foraDaLista ? (
                          <span className="text-xs text-neutral-500">
                            fora da lista (encerrado ou tipo dispensado)
                          </span>
                        ) : (
                          <SeloDaEntrevista situacao={e.situacao} />
                        )}
                      </td>
                      <td className="px-2 py-2 tabular-nums">
                        {formatarData(e.ultimaData)}
                      </td>
                      <td className="px-2 py-2 tabular-nums">
                        {formatarData(e.validaAte ?? e.dataPrevista)}
                      </td>
                      {veEntrevistas && (
                        <td className="px-2 py-2 text-right">
                          <Link
                            href={`/sustentabilidade/entrevistas/${e.contratoId}`}
                            className="text-xs font-medium text-neutral-700 underline underline-offset-4 hover:text-neutral-900"
                          >
                            Abrir a ficha
                          </Link>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Secao>
      </div>
    </>
  );
}
