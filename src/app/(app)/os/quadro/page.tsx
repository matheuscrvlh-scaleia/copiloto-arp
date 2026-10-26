import type { Metadata } from "next";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { BarraFiltros } from "@/components/os/filtros/barra-filtros";
import {
  campoPrioridade,
  campoRecorte,
  campoSetor,
  campoTipo,
} from "@/components/os/filtros/opcoes";
import { Atualizado, PainelDaBusca } from "@/components/os/lista/topo";
import { Quadro } from "@/components/os/quadro/quadro";
import { SeuDia } from "@/components/os/seu-dia/seu-dia";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { type Busca, descreverFiltros } from "@/lib/os/lista";
import {
  colunasDoQuadro,
  estadoDoQuadro,
  horaDaVisita,
  nomesDosFiltros,
  opcoesDeCategoria,
} from "@/server/os/visoes";

export const metadata: Metadata = { title: "Quadro" };

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <>
      <PageHeader
        title="Quadro"
        description="Os chamados em colunas por status. Arraste o cartão para andar com ele; clique no título para ver o detalhe ao lado."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="os.acessar">
          <QuadroDaTela busca={searchParams} />
          <Suspense fallback={null}>
            <SeuDia />
          </Suspense>
          <Suspense fallback={null}>
            <PainelDaBusca busca={searchParams} caminho="/os/quadro" />
          </Suspense>
        </Protegido>
      </Suspense>
    </>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <span aria-hidden className="carregando h-4 w-36 rounded-full" />
      <span
        aria-hidden
        className="carregando h-12 w-full max-w-3xl rounded-full"
      />
      <div aria-hidden className="flex gap-3 overflow-hidden">
        {[1, 2, 3, 4].map((i) => (
          <CartaoCarregando
            key={i}
            altura="h-[32rem]"
            className="w-72 shrink-0"
          />
        ))}
      </div>
    </TelaCarregando>
  );
}

async function QuadroDaTela({ busca }: { busca: Promise<Busca> }) {
  const params = await busca;
  const e = await estadoDoQuadro(params);
  const { a, valores } = e;
  // Uma consulta por coluna: os primeiros cartões e o total real dela.
  const colunas = await colunasDoQuadro(e);

  return (
    <div className="flex flex-col gap-5">
      <Atualizado hora={horaDaVisita(a)} />
      <BarraFiltros
        tela="quadro"
        valores={valores}
        lembrados={e.lembrados}
        fixos={["recorte"]}
        campos={[
          campoRecorte(e.permitidos),
          ...(e.comSetor
            ? [{ ...campoSetor(e.setores), largura: "w-48" }]
            : []),
          { ...campoTipo, largura: "w-44" },
        ]}
        extras={[
          {
            chave: "categoria",
            rotulo: "Categoria",
            todos: "Todas as categorias",
            opcoes: opcoesDeCategoria(
              a,
              valores.setor ? [valores.setor] : null,
            ),
          },
          campoPrioridade,
          {
            chave: "fechados",
            rotulo: "Fechados",
            todos: "Sem os fechados",
            opcoes: [{ valor: "1", rotulo: "Com os fechados recentes" }],
          },
        ]}
      />
      <Quadro
        colunas={colunas}
        mais={e.mais}
        agora={a.agora.toISOString()}
        avisoHoras={a.avisoHoras}
        comFechados={!!e.filtros.fechados}
        exportar={
          a.ctx.pode("os.exportar")
            ? {
                titulo: "Quadro",
                filtros: descreverFiltros(
                  "quadro",
                  valores,
                  nomesDosFiltros(valores, a),
                ),
              }
            : null
        }
      />
    </div>
  );
}
