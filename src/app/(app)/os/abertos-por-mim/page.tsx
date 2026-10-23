import type { Metadata } from "next";
import { Suspense } from "react";
import { BarraFiltros } from "@/components/os/filtros/barra-filtros";
import {
  campoPrioridade,
  campoSetor,
  campoStatus,
  campoTipo,
} from "@/components/os/filtros/opcoes";
import {
  Atualizado,
  EsqueletoVisao,
  PainelDaLista,
} from "@/components/os/lista/topo";
import { VisaoLista } from "@/components/os/lista/visao-lista";
import { SeuDia } from "@/components/os/seu-dia/seu-dia";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { type Busca, descreverFiltros } from "@/lib/os/lista";
import { buscarChamados } from "@/server/os/base";
import {
  andamentoDosAvisos,
  apoio,
  encerradosNoMes,
  filtrosDaTela,
  horaDaVisita,
  nomesDosFiltros,
  paraConsulta,
  paraLinha,
  pessoasPorSetor,
  semRepetir,
} from "@/server/os/visoes";

export const metadata: Metadata = { title: "Abertos por mim" };

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <>
      <PageHeader
        title="Abertos por mim"
        description="O que você pediu a outros setores e pessoas: em que pé está, o que atrasou e o que espera a sua confirmação. Avisos para vários setores mostram quem ainda falta."
      />
      <Suspense fallback={<EsqueletoVisao />}>
        <Protegido permissao="os.acessar">
          <Abertos busca={searchParams} />
          <Suspense fallback={null}>
            <SeuDia />
          </Suspense>
        </Protegido>
      </Suspense>
    </>
  );
}

async function Abertos({ busca }: { busca: Promise<Busca> }) {
  const params = await busca;
  const [a, { filtros, lembrados }] = await Promise.all([
    apoio(),
    filtrosDaTela("abertos", params),
  ]);
  const consulta = paraConsulta(filtros, "abertos_por_mim");
  const [meus, fechados] = await Promise.all([
    buscarChamados(consulta),
    encerradosNoMes(
      { abertoPor: a.ctx.usuario.id },
      consulta,
      "fechado_em",
      a.agora,
    ),
  ]);
  const doFiltro = new Set(meus.map((c) => c.id));
  const todos = semRepetir(meus, fechados);
  const destinos = await andamentoDosAvisos(
    todos.filter((c) => c.tipo === "aviso").map((c) => c.id),
    a,
  );
  const linhas = todos.map((c) => ({
    ...paraLinha(c, a, !doFiltro.has(c.id)),
    destinos: destinos.get(c.id) ?? null,
  }));

  return (
    <div className="flex flex-col gap-5">
      <Atualizado hora={horaDaVisita(a)} />
      <BarraFiltros
        tela="abertos"
        valores={filtros}
        lembrados={lembrados}
        etiqueta
        campos={[
          campoTipo,
          campoSetor(a.setores.filter((s) => s.ativo)),
          campoStatus,
          campoPrioridade,
        ]}
      />
      <VisaoLista
        linhas={linhas}
        cartoes={[
          {
            chave: "aguardando_confirmacao",
            detalhe: "concluídos, confirme ou reabra",
          },
          { chave: "em_andamento", detalhe: "alguém está cuidando" },
          { chave: "atrasados", detalhe: "passaram do prazo" },
          { chave: "fechados_mes", detalhe: "resolvidos neste mês" },
        ]}
        agrupamento="status"
        colunas={{ setor: true }}
        agora={a.agora.toISOString()}
        eu={a.ctx.usuario.id}
        avisoHoras={a.avisoHoras}
        pessoasPorSetor={pessoasPorSetor(
          a,
          linhas.filter((l) => l.podeAtribuir).map((l) => l.setorId),
        )}
        exportar={
          a.ctx.pode("os.exportar")
            ? {
                titulo: "Abertos por mim",
                filtros: descreverFiltros(
                  "abertos",
                  filtros,
                  nomesDosFiltros(filtros, a),
                ),
                nomeArquivo: "abertos-por-mim",
              }
            : null
        }
        vazio="Você não tem pedidos em aberto. Use o botão + Novo para abrir um chamado."
      />
      <PainelDaLista busca={params} caminho="/os/abertos-por-mim" />
    </div>
  );
}
