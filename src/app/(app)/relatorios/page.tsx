import type { Metadata } from "next";
import { Suspense } from "react";
import {
  CartaoCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { TabelaLista } from "@/components/dashboard/tabela-lista";
import { CartaoDaTela, Cartoes, hrefCom } from "@/components/dashboard/tela";
import { SeloSituacao } from "@/components/formularios/blocos";
import { NovoRelatorio } from "@/components/formularios/novo";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { formatarDataHora, formatarNumero } from "@/lib/formato";
import {
  ROTULO_SITUACAO,
  SITUACOES,
  type Situacao,
} from "@/lib/formularios/formulario";
import {
  contexto,
  listaDeFormularios,
  ROTA_FORMULARIOS,
  rotaDoFormulario,
} from "@/server/formularios/base";

export const metadata: Metadata = { title: "Relatórios" };

const DETALHE: Record<Situacao, string> = {
  publicado: "recebendo respostas pelo link",
  rascunho: "em montagem, link ainda fechado",
  encerrado: "link fechado; respostas guardadas",
};

export default function Page({ searchParams }: PageProps<"/relatorios">) {
  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Monte um relatório com as perguntas que quiser (em branco ou de um modelo), publique e mande o link ou o QR code: quem recebe responde sem login, pelo celular. As respostas chegam aqui, com gráficos, Excel e um chat para perguntar sobre elas."
      />
      <Suspense fallback={<Esqueleto />}>
        <Tela busca={searchParams} />
      </Suspense>
    </>
  );
}

async function Tela({
  busca,
}: {
  busca: PageProps<"/relatorios">["searchParams"];
}) {
  const [ctx, b] = await Promise.all([contexto(), busca]);
  if (!ctx.ve) return <SemAcesso />;
  const todos = await listaDeFormularios();
  const pedida = Array.isArray(b.situacao) ? b.situacao[0] : b.situacao;
  const situacao = (SITUACOES as readonly string[]).includes(pedida ?? "")
    ? (pedida as Situacao)
    : null;
  const lista = situacao ? todos.filter((f) => f.efetiva === situacao) : todos;
  const respostas = todos.reduce((s, f) => s + f.total_respostas, 0);

  const colunas = [
    { titulo: "Relatório" },
    { titulo: "Situação" },
    { titulo: "Perguntas", numero: true },
    { titulo: "Respostas", numero: true },
    { titulo: "Última resposta" },
    { titulo: "Atualizado" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {ctx.edita && (
        <div data-guia="formularios-novo" className="flex flex-col">
          <NovoRelatorio />
        </div>
      )}

      <Cartoes modulo="formularios">
        {(["publicado", "rascunho", "encerrado"] as const).map((s) => (
          <CartaoDaTela
            key={s}
            titulo={`${ROTULO_SITUACAO[s]}s`}
            valor={formatarNumero(todos.filter((f) => f.efetiva === s).length)}
            detalhe={DETALHE[s]}
            fonte="relatórios do sistema"
            href={hrefCom(ROTA_FORMULARIOS, b, {
              situacao: situacao === s ? null : s,
            })}
            ativo={situacao === s}
          />
        ))}
        <CartaoDaTela
          titulo="Respostas recebidas"
          valor={formatarNumero(respostas)}
          detalhe="somando todos os relatórios"
          fonte="respostas enviadas pelos links"
        />
      </Cartoes>

      <Secao
        titulo="Todos os relatórios"
        descricao={`${situacao ? `Só os ${ROTULO_SITUACAO[situacao].toLowerCase()}s (clique no cartão de novo para ver todos). ` : ""}Clique no relatório para ver as respostas, editar as perguntas ou pegar o link.`}
      >
        <TabelaLista
          colunas={colunas}
          ordemInicial={{ coluna: 5, desc: true }}
          vazio={
            todos.length
              ? "Nenhum relatório nessa situação."
              : ctx.edita
                ? "Nenhum relatório ainda. Comece por “Novo relatório”."
                : "Nenhum relatório ainda."
          }
          placeholder="Buscar pelo título…"
          rodape={[
            `${formatarNumero(lista.length)} ${lista.length === 1 ? "relatório" : "relatórios"}`,
            "",
            "",
            formatarNumero(lista.reduce((s, f) => s + f.total_respostas, 0)),
            "",
            "",
          ]}
          linhas={lista.map((f) => ({
            chave: f.id,
            href: rotaDoFormulario(f.id),
            busca: f.titulo,
            ordem: [
              f.titulo.toLowerCase(),
              f.efetiva,
              f.perguntas,
              f.total_respostas,
              f.ultima_resposta_em,
              f.atualizado_em,
            ],
            celulas: [
              <span key="t" className="font-medium">
                {f.titulo}
              </span>,
              <SeloSituacao key="s" situacao={f.efetiva} />,
              formatarNumero(f.perguntas),
              formatarNumero(f.total_respostas),
              f.ultima_resposta_em ? (
                formatarDataHora(f.ultima_resposta_em)
              ) : (
                <span key="u" className="text-neutral-400">
                  —
                </span>
              ),
              formatarDataHora(f.atualizado_em),
            ],
          }))}
        />
        <div className="mt-3">
          <Nota>
            Publicado com data de encerramento vencida ou limite de respostas
            atingido conta como encerrado.
          </Nota>
        </div>
      </Secao>
    </div>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <IndicadoresCarregando quantidade={4} />
      <CartaoCarregando altura="h-96" />
    </TelaCarregando>
  );
}
