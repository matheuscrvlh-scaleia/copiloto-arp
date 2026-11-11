import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { TabelaLista } from "@/components/dashboard/tabela-lista";
import { TopoDaTela } from "@/components/dashboard/tela";
import {
  RespostasPorDia,
  ResumoDasRespostas,
} from "@/components/formularios/blocos";
import { CabecalhoDoFormulario } from "@/components/formularios/cabecalho";
import { ChatDasRespostas } from "@/components/formularios/chat";
import { BotaoExportar } from "@/components/os/exportar";
import { SemAcesso } from "@/components/protegido";
import { dadosDe } from "@/lib/comercial/formato";
import { formatarDataHora, formatarNumero } from "@/lib/formato";
import { recebeResposta, textoDaResposta } from "@/lib/formularios/campos";
import {
  contexto,
  formularioPorId,
  respostasDo,
  rotaDoFormulario,
} from "@/server/formularios/base";

export const metadata: Metadata = { title: "Respostas do relatório" };

export default function Page({ params }: PageProps<"/relatorios/[id]">) {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-28" />
          <CartaoCarregando altura="h-72" />
          <CartaoCarregando altura="h-96" />
        </TelaCarregando>
      }
    >
      <Tela params={params} />
    </Suspense>
  );
}

/** Colunas da lista: até 6 perguntas; o Excel leva todas. */
const NA_LISTA = 6;

async function Tela({ params }: Pick<PageProps<"/relatorios/[id]">, "params">) {
  const [{ id }, ctx] = await Promise.all([params, contexto()]);
  if (!ctx.ve) return <SemAcesso />;
  const [f, respostas] = await Promise.all([
    formularioPorId(id),
    respostasDo(id),
  ]);
  if (!f) notFound();

  const perguntas = f.campos.filter(recebeResposta);
  const naLista = perguntas.slice(0, NA_LISTA);
  const colunas = [
    { titulo: "Enviada em" },
    // Numeradas: duas perguntas com o mesmo título não se confundem.
    ...naLista.map((c, i) => ({
      titulo: `${i + 1}. ${c.titulo}`,
      classe: "max-w-72",
    })),
  ];
  const exportar = [
    { titulo: "Enviada em" },
    ...perguntas.map((c, i) => ({ titulo: `${i + 1}. ${c.titulo}` })),
  ];
  const agora = dadosDe(new Date());

  return (
    <>
      <CabecalhoDoFormulario f={f} aba="respostas" edita={ctx.edita} />
      <div className="flex flex-col gap-6">
        <TopoDaTela
          dadosDe={agora}
          filtros={`${formatarNumero(respostas.length)} ${respostas.length === 1 ? "resposta" : "respostas"}`}
          acoes={
            ctx.pode("formularios.exportar") && respostas.length ? (
              <BotaoExportar
                titulo={f.titulo}
                filtros={`Respostas · ${agora}`}
                nomeArquivo={`formulario-${
                  f.titulo
                    .normalize("NFD")
                    .replace(/[^\w\s-]/g, "")
                    .trim()
                    .replace(/\s+/g, "-")
                    .toLowerCase()
                    .slice(0, 60) || "respostas"
                }`}
                colunas={exportar}
                linhas={respostas.map((r) => [
                  formatarDataHora(r.enviada_em),
                  ...perguntas.map((c) =>
                    textoDaResposta(c.tipo, r.respostas[c.id]),
                  ),
                ])}
              />
            ) : undefined
          }
        />

        {respostas.length === 0 ? (
          <Secao titulo="Respostas">
            <p className="text-sm text-neutral-500">
              {f.efetiva === "publicado"
                ? "Nenhuma resposta ainda. Mande o link (em Link e configurações) e acompanhe por aqui."
                : f.situacao === "rascunho"
                  ? "Relatório em rascunho: publique em Link e configurações para o link começar a receber respostas."
                  : "Relatório encerrado sem respostas."}
            </p>
            {ctx.edita && (
              <Link
                href={rotaDoFormulario(f.id, "configuracoes")}
                className="mt-3 inline-flex text-sm font-medium underline underline-offset-4"
              >
                Ir para Link e configurações
              </Link>
            )}
          </Secao>
        ) : (
          <>
            <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
              <ChatDasRespostas
                campos={f.campos}
                registros={respostas.map((r) => ({
                  enviada_em: r.enviada_em,
                  respostas: r.respostas,
                }))}
              />
              <RespostasPorDia
                datas={respostas.map((r) => r.enviada_em)}
                agora={new Date()}
              />
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="px-1 text-base font-semibold">
                Resumo por pergunta
              </h2>
              <ResumoDasRespostas
                campos={f.campos}
                respostas={respostas.map((r) => r.respostas)}
              />
              <Nota>
                Resumo das perguntas atuais. Respostas a perguntas que já saíram
                do relatório aparecem no detalhe de cada resposta.
              </Nota>
            </div>

            <Secao
              titulo="Todas as respostas"
              descricao={
                perguntas.length > NA_LISTA
                  ? `As ${NA_LISTA} primeiras perguntas; clique na linha para ver a resposta inteira. O Excel leva todas.`
                  : "Clique na linha para ver a resposta inteira."
              }
            >
              <TabelaLista
                colunas={colunas}
                ordemInicial={{ coluna: 0, desc: true }}
                placeholder="Buscar nas respostas…"
                rodape={[
                  `${formatarNumero(respostas.length)} ${respostas.length === 1 ? "resposta" : "respostas"}`,
                  ...naLista.map(() => ""),
                ]}
                linhas={respostas.map((r) => {
                  const textos = perguntas.map((c) =>
                    textoDaResposta(c.tipo, r.respostas[c.id]),
                  );
                  return {
                    chave: r.id,
                    href: rotaDoFormulario(f.id, `respostas/${r.id}`),
                    busca: textos.join(" "),
                    ordem: [
                      r.enviada_em,
                      ...naLista.map((c) => {
                        const v = r.respostas[c.id];
                        return typeof v === "number"
                          ? v
                          : textoDaResposta(c.tipo, v) || null;
                      }),
                    ],
                    celulas: [
                      formatarDataHora(r.enviada_em),
                      ...naLista.map((c, i) =>
                        textos[i] ? (
                          <span
                            key={c.id}
                            className="line-clamp-2 max-w-72 whitespace-normal"
                          >
                            {textos[i]}
                          </span>
                        ) : (
                          <span key={c.id} className="text-neutral-400">
                            —
                          </span>
                        ),
                      ),
                    ],
                  };
                })}
              />
            </Secao>
          </>
        )}
      </div>
    </>
  );
}
