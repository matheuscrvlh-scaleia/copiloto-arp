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
  PainelDaLista,
} from "@/components/os/lista/topo";
import { VisaoLista } from "@/components/os/lista/visao-lista";
import { SeuDia } from "@/components/os/seu-dia/seu-dia";
import { Cartao, PageHeader } from "@/components/page-header";
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

export const metadata: Metadata = { title: "Meu setor" };

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
      <PageHeader
        title="Meu setor"
        description="Tudo o que é do setor, para distribuir e cobrar: a fila sem responsável, os atrasados e a carga de cada pessoa. Atribua, mude prazo e prioridade direto na lista."
      />
      <Suspense fallback={<EsqueletoVisao />}>
        <Protegido permissao="os.meu_setor">
          <Setor busca={searchParams} />
          <Suspense fallback={null}>
            <SeuDia />
          </Suspense>
        </Protegido>
      </Suspense>
    </>
  );
}

async function Setor({ busca }: { busca: Promise<Busca> }) {
  const params = await busca;
  const e = await estadoDaLista("setor", params);
  const { a, filtros, disponiveis } = e;
  const setorId = filtros.setor;
  if (!setorId)
    return (
      <Cartao>
        <p className="text-sm text-neutral-600">
          Você ainda não faz parte de nenhum setor. Peça ao administrador para
          incluir você em Tickets › Configurações › Setores.
        </p>
      </Cartao>
    );

  const pessoas = pessoasPorSetor(a, [setorId]);
  const membros = pessoas[setorId] ?? [];
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
      <BarraFiltros
        tela="setor"
        valores={filtros}
        lembrados={e.lembrados}
        fixos={["setor", "agrupar"]}
        busca={{ placeholder: "Buscar por número, título ou descrição…" }}
        campos={[
          ...(disponiveis.length > 1
            ? [{ ...campoSetor(disponiveis, undefined), largura: "w-48" }]
            : []),
          { ...campoStatus, largura: "w-40" },
          {
            chave: "responsavel",
            rotulo: "Responsável",
            todos: "Todos do setor",
            opcoes: membros.map((p) => ({ valor: p.id, rotulo: p.nome })),
            largura: "w-48",
          },
        ]}
        extras={[
          {
            chave: "categoria",
            rotulo: "Categoria",
            todos: "Todas as categorias",
            opcoes: opcoesDeCategoria(a, [setorId]),
          },
          campoPrioridade,
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
      <VisaoLista
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
                titulo: `Meu setor · ${a.setorPorId.get(setorId)?.nome ?? ""}`,
                filtros: descreverFiltros(
                  "setor",
                  filtros,
                  nomesDosFiltros(filtros, a),
                ),
                nomeArquivo: "meu-setor",
              }
            : null
        }
        vazio="Nenhum chamado do setor com esses filtros."
      />
      <PainelDaLista busca={params} caminho="/os/meu-setor" />
    </div>
  );
}
