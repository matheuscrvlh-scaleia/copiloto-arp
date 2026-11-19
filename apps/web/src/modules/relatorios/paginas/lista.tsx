import { formatarDataHora, formatarNumero } from "@arp/shared/formato";
import {
  ROTULO_SITUACAO,
  SITUACOES,
  type Situacao,
} from "@arp/shared/formularios/formulario";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import {
  CartaoCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { TabelaLista } from "@/components/dashboard/tabela-lista";
import { CartaoDaTela, Cartoes, hrefCom } from "@/components/dashboard/tela";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { useBusca } from "@/lib/navegacao";
import { usePermissao } from "@/lib/sessao";
import { consultaDaLista, ROTA_FORMULARIOS, rotaDoFormulario } from "../api";
import { SeloSituacao } from "../components/blocos";
import { NovoRelatorio } from "../components/novo";

// /formularios: todos os formulários, com os cartões por situação (filtro na
// URL: ?situacao=publicado) e o "Novo formulário" para quem edita.

const DETALHE: Record<Situacao, string> = {
  publicado: "recebendo respostas pelo link",
  rascunho: "em montagem, link ainda fechado",
  encerrado: "link fechado; respostas guardadas",
};

export default function Pagina() {
  return (
    <>
      <PageHeader
        title="Formulários"
        description="Monte um formulário com as perguntas que quiser (em branco ou de um modelo), publique e mande o link ou o QR code: quem recebe responde sem login, pelo celular. As respostas chegam aqui, com gráficos, Excel e um chat para perguntar sobre elas."
      />
      <Suspense fallback={<Esqueleto />}>
        <Tela />
      </Suspense>
    </>
  );
}

function Tela() {
  const ve = usePermissao(["formularios.ver", "formularios.editar"]);
  if (!ve) return <SemAcesso />;
  return <Lista />;
}

function Lista() {
  const edita = usePermissao("formularios.editar");
  const b = useBusca();
  const { data: todos } = useSuspenseQuery(consultaDaLista);
  const pedida = Array.isArray(b.situacao) ? b.situacao[0] : b.situacao;
  const situacao = SITUACOES.find((s) => s === pedida) ?? null;
  const lista = situacao ? todos.filter((f) => f.efetiva === situacao) : todos;
  const respostas = todos.reduce((s, f) => s + f.total_respostas, 0);

  const colunas = [
    { titulo: "Formulário" },
    { titulo: "Situação" },
    { titulo: "Perguntas", numero: true },
    { titulo: "Respostas", numero: true },
    { titulo: "Última resposta" },
    { titulo: "Atualizado" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {edita && (
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
            fonte="formulários do sistema"
            href={hrefCom(ROTA_FORMULARIOS, b, {
              situacao: situacao === s ? null : s,
            })}
            ativo={situacao === s}
          />
        ))}
        <CartaoDaTela
          titulo="Respostas recebidas"
          valor={formatarNumero(respostas)}
          detalhe="somando todos os formulários"
          fonte="respostas enviadas pelos links"
        />
      </Cartoes>

      <Secao
        titulo="Todos os formulários"
        descricao={`${situacao ? `Só os ${ROTULO_SITUACAO[situacao].toLowerCase()}s (clique no cartão de novo para ver todos). ` : ""}Clique no formulário para ver as respostas, editar as perguntas ou pegar o link.`}
      >
        <TabelaLista
          colunas={colunas}
          ordemInicial={{ coluna: 5, desc: true }}
          vazio={
            todos.length
              ? "Nenhum formulário nessa situação."
              : edita
                ? "Nenhum formulário ainda. Comece por “Novo formulário”."
                : "Nenhum formulário ainda."
          }
          placeholder="Buscar pelo título…"
          rodape={[
            `${formatarNumero(lista.length)} ${lista.length === 1 ? "formulário" : "formulários"}`,
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
