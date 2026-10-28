import type { Metadata } from "next";
import { Suspense } from "react";
import {
  BarraFiltros,
  SeletorDeVisao,
} from "@/components/os/filtros/barra-filtros";
import {
  campoAgrupar,
  campoPrioridade,
  campoSetor,
  campoStatus,
} from "@/components/os/filtros/opcoes";
import { CargaPorPessoa } from "@/components/os/lista/carga";
import {
  Atualizado,
  EsqueletoVisao,
  PainelDaBusca,
} from "@/components/os/lista/topo";
import { VisaoLista } from "@/components/os/lista/visao-lista";
import { CabecalhoOperacoes } from "@/components/os/operacoes";
import { SeuDia } from "@/components/os/seu-dia/seu-dia";
import { Cartao } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import {
  type Busca,
  CARTOES_DA_TELA,
  type ChaveCartao,
  COLUNAS_DA_TELA,
  descreverFiltros,
  type Filtros,
  paraParametros,
} from "@/lib/os/lista";
import {
  cargaDoSetor,
  contarCartoes,
  estadoDaLista,
  horaDaVisita,
  nomesDosFiltros,
  opcoesDeCategoria,
  paginaDaLista,
  pessoasPorSetor,
} from "@/server/os/visoes";

export const metadata: Metadata = { title: "Geral" };

const DETALHES: Partial<Record<ChaveCartao, string>> = {
  sem_responsavel: "na fila, para distribuir",
  atrasados: "passaram do prazo",
  abertos: "aberto, em andamento ou aguardando",
  concluidos_mes: "concluídos ou fechados",
};

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <>
      <CabecalhoOperacoes descricao="Tudo o que é dos seus setores, para distribuir e cobrar: a fila sem responsável, os atrasados e a carga de cada pessoa. Atribua, mude prazo e prioridade direto na lista." />
      <Suspense fallback={<EsqueletoVisao />}>
        <Protegido permissao="os.meu_setor">
          <Setor busca={searchParams} />
          <Suspense fallback={null}>
            <SeuDia />
          </Suspense>
          <Suspense fallback={null}>
            <PainelDaBusca busca={searchParams} caminho="/os/meu-setor" />
          </Suspense>
        </Protegido>
      </Suspense>
    </>
  );
}

async function Setor({ busca }: { busca: Promise<Busca> }) {
  const params = await busca;
  const e = await estadoDaLista("setor", params);
  const { a, filtros, disponiveis, setores } = e;
  if (!setores.length)
    return (
      <Cartao>
        <p className="text-sm text-neutral-600">
          Você ainda não faz parte de nenhum setor. Peça ao administrador para
          incluir você em Tickets › Configurações › Setores.
        </p>
      </Cartao>
    );

  const pessoas = pessoasPorSetor(a, setores);
  // Quem está em mais de um setor aparece uma vez.
  const membros = [
    ...new Map(
      setores.flatMap((s) => pessoas[s] ?? []).map((p) => [p.id, p]),
    ).values(),
  ].sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
  // A página, os cartões e a carga por pessoa: tudo contado no banco.
  const [pagina, valores, carga] = await Promise.all([
    paginaDaLista(e),
    contarCartoes(e),
    cargaDoSetor(e, membros),
  ]);
  const href = (extra: Filtros, cartao?: string) => {
    const p = paraParametros({ ...filtros, ...extra });
    if (cartao) p.set("cartao", cartao);
    return `/os/meu-setor?${p.toString()}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <Atualizado hora={horaDaVisita(a)} />
      <VisaoLista
        barra={
          <>
            <BarraFiltros
              tela="setor"
              valores={filtros}
              lembrados={e.lembrados}
              fixos={["agrupar"]}
              busca={{ placeholder: "Buscar por número, título ou descrição…" }}
              campos={[
                ...(disponiveis.length > 1
                  ? [
                      {
                        ...campoSetor(disponiveis),
                        chave: "setores" as const,
                        multipla: true,
                        largura: "w-52",
                      },
                    ]
                  : []),
                { ...campoStatus, largura: "w-40" },
                {
                  chave: "responsavel",
                  rotulo: "Responsável",
                  todos:
                    setores.length > 1 ? "Todas as pessoas" : "Todos do setor",
                  opcoes: membros.map((p) => ({ valor: p.id, rotulo: p.nome })),
                  largura: "w-48",
                },
              ]}
              extras={[
                {
                  chave: "categoria",
                  rotulo: "Categoria",
                  todos: "Todas as categorias",
                  opcoes: opcoesDeCategoria(a, setores),
                },
                campoPrioridade,
                {
                  chave: "aberto_por",
                  rotulo: "Aberto por",
                  todos: "Qualquer pessoa",
                  opcoes: [{ valor: "eu", rotulo: "Abertos por mim" }],
                },
              ]}
              etiqueta
              periodo
            />
            <CargaPorPessoa
              carga={carga}
              hrefPessoa={Object.fromEntries(
                membros.map((p) => [p.id, href({ responsavel: p.id })]),
              )}
              hrefFila={href({ responsavel: undefined }, "sem_responsavel")}
            />
          </>
        }
        linhas={pagina.linhas}
        total={pagina.total}
        pagina={pagina.pagina}
        cartoes={CARTOES_DA_TELA.setor.map((chave) => ({
          chave,
          detalhe: DETALHES[chave],
          valor: valores[chave] ?? 0,
        }))}
        cartao={e.cartao}
        ordem={e.ordem}
        busca={e.q}
        agrupamento={e.modo}
        acoesDoTitulo={
          <SeletorDeVisao tela="setor" valores={filtros} campo={campoAgrupar} />
        }
        colunas={COLUNAS_DA_TELA.setor}
        agora={a.agora.toISOString()}
        eu={a.ctx.usuario.id}
        avisoHoras={a.avisoHoras}
        pessoasPorSetor={pessoas}
        exportar={
          a.ctx.pode("os.exportar")
            ? {
                tela: "setor",
                titulo: "Geral",
                filtros: descreverFiltros(
                  "setor",
                  filtros,
                  nomesDosFiltros(filtros, a),
                ),
                nomeArquivo: "geral",
              }
            : null
        }
        vazio="Nenhum chamado com esses filtros."
      />
    </div>
  );
}
