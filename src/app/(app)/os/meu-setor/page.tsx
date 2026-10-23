import type { Metadata } from "next";
import { Suspense } from "react";
import { BarraFiltros } from "@/components/os/filtros/barra-filtros";
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
  cargaPorPessoa,
  descreverFiltros,
  type Filtros,
  paraParametros,
} from "@/lib/os/lista";
import { buscarChamados } from "@/server/os/base";
import {
  apoio,
  encerradosNoMes,
  filtrosDaTela,
  horaDaVisita,
  nomesDosFiltros,
  opcoesDeCategoria,
  paraConsulta,
  paraLinha,
  pessoasPorSetor,
  semRepetir,
  setoresDisponiveis,
} from "@/server/os/visoes";

export const metadata: Metadata = { title: "Meu setor" };

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
  const [a, lidos] = await Promise.all([
    apoio(),
    filtrosDaTela("setor", params),
  ]);
  const disponiveis = setoresDisponiveis(a);
  if (!disponiveis.length)
    return (
      <Cartao>
        <p className="text-sm text-neutral-600">
          Você ainda não faz parte de nenhum setor. Peça ao administrador para
          incluir você em Tickets › Configurações › Setores.
        </p>
      </Cartao>
    );

  // Setor escolhido (lembrado); sem escolha válida, o primeiro dos meus.
  const setorId =
    disponiveis.find((s) => s.id === lidos.filtros.setor)?.id ??
    disponiveis.find((s) => a.ctx.setores.includes(s.id))?.id ??
    disponiveis[0]?.id ??
    "";
  const filtros: Filtros = { ...lidos.filtros, setor: setorId };
  const consulta = paraConsulta(filtros, "meu_setor");
  const [doSetor, encerrados] = await Promise.all([
    buscarChamados(consulta),
    encerradosNoMes({ setor: setorId }, consulta, "concluido_em", a.agora),
  ]);
  const doFiltro = new Set(doSetor.map((c) => c.id));
  const linhas = semRepetir(doSetor, encerrados).map((c) =>
    paraLinha(c, a, !doFiltro.has(c.id)),
  );

  const pessoas = pessoasPorSetor(a, [setorId]);
  const membros = pessoas[setorId] ?? [];
  const ctx = {
    agora: a.agora,
    eu: a.ctx.usuario.id,
    avisoHoras: a.avisoHoras,
  };
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
        lembrados={lidos.lembrados}
        fixos={["setor", "agrupar"]}
        periodo
        etiqueta
        campos={[
          ...(disponiveis.length > 1
            ? [{ ...campoSetor(disponiveis, undefined), largura: "w-56" }]
            : []),
          campoAgrupar,
          {
            chave: "responsavel",
            rotulo: "Responsável",
            todos: "Todos do setor",
            opcoes: membros.map((p) => ({ valor: p.id, rotulo: p.nome })),
            largura: "w-52",
          },
          {
            chave: "categoria",
            rotulo: "Categoria",
            todos: "Todas as categorias",
            opcoes: opcoesDeCategoria(a, [setorId]),
            largura: "w-52",
          },
          campoStatus,
          campoPrioridade,
        ]}
      />
      <CargaPorPessoa
        carga={cargaPorPessoa(linhas, membros, ctx)}
        hrefPessoa={Object.fromEntries(
          membros.map((p) => [p.id, href({ responsavel: p.id })]),
        )}
        hrefFila={href({ responsavel: undefined }, "sem_responsavel")}
      />
      <VisaoLista
        linhas={linhas}
        cartoes={[
          { chave: "sem_responsavel", detalhe: "na fila, para distribuir" },
          { chave: "atrasados", detalhe: "passaram do prazo" },
          { chave: "abertos", detalhe: "aberto, em andamento ou aguardando" },
          { chave: "concluidos_mes", detalhe: "concluídos ou fechados" },
        ]}
        agrupamento={filtros.agrupar ?? "responsavel"}
        colunas={{ solicitante: true }}
        agora={a.agora.toISOString()}
        eu={a.ctx.usuario.id}
        avisoHoras={a.avisoHoras}
        pessoasPorSetor={pessoas}
        exportar={
          a.ctx.pode("os.exportar")
            ? {
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
