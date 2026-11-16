import { dadosDe } from "@arp/shared/comercial/formato";
import { formatarDataHora, formatarNumero } from "@arp/shared/formato";
import {
  recebeResposta,
  textoDaResposta,
} from "@arp/shared/formularios/campos";
import { useSuspenseQueries } from "@tanstack/react-query";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { TabelaLista } from "@/components/dashboard/tabela-lista";
import { TopoDaTela } from "@/components/dashboard/tela";
import { BotaoExportar } from "@/components/exportar";
import { SemAcesso } from "@/components/protegido";
import { Link, useParametro } from "@/lib/navegacao";
import { usePermissao } from "@/lib/sessao";
import {
  consultaDasRespostas,
  consultaDoFormulario,
  rotaDoFormulario,
} from "../api";
import { RespostasPorDia, ResumoDasRespostas } from "../components/blocos";
import { CabecalhoDoFormulario } from "../components/cabecalho";
import { ChatDasRespostas } from "../components/chat";

// /relatorios/:id: as respostas de um relatório (chat, por dia, resumo por
// pergunta, lista e Excel).

export default function Pagina() {
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
      <Tela />
    </Suspense>
  );
}

/** Colunas da lista: até 6 perguntas; o Excel leva todas. */
const NA_LISTA = 6;

function Tela() {
  const ve = usePermissao(["formularios.ver", "formularios.editar"]);
  if (!ve) return <SemAcesso />;
  return <Respostas />;
}

function Respostas() {
  const id = useParametro("id");
  const edita = usePermissao("formularios.editar");
  const exporta = usePermissao("formularios.exportar");
  const [{ data: f }, { data: respostas }] = useSuspenseQueries({
    queries: [consultaDoFormulario(id), consultaDasRespostas(id)],
  });

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
      <CabecalhoDoFormulario f={f} aba="respostas" edita={edita} />
      <div className="flex flex-col gap-6">
        <TopoDaTela
          dadosDe={agora}
          filtros={`${formatarNumero(respostas.length)} ${respostas.length === 1 ? "resposta" : "respostas"}`}
          acoes={
            exporta && respostas.length ? (
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
            {edita && (
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
