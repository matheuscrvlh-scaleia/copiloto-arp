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
import { Atualizado, PainelDaLista } from "@/components/os/lista/topo";
import { Quadro } from "@/components/os/quadro/quadro";
import { SeuDia } from "@/components/os/seu-dia/seu-dia";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { type Busca, descreverFiltros, type Recorte } from "@/lib/os/lista";
import { buscarChamados } from "@/server/os/base";
import {
  apoio,
  contagens,
  filtrosDaTela,
  horaDaVisita,
  nomesDosFiltros,
  opcoesDeCategoria,
  paraConsulta,
  paraLinha,
  semRepetir,
  setoresDisponiveis,
} from "@/server/os/visoes";

export const metadata: Metadata = { title: "Quadro" };

/** Fechados recentes que a coluna Fechado mostra quando pedida. */
const FECHADOS_RECENTES = 40;

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
  const [a, { filtros, lembrados }] = await Promise.all([
    apoio(),
    filtrosDaTela("quadro", params),
  ]);
  const permitidos: Recorte[] = [
    "minha_caixa",
    ...(a.ctx.pode("os.meu_setor") ? (["meu_setor"] as const) : []),
    "abertos_por_mim",
    ...(a.ctx.pode("os.todos_setores") ? (["todos"] as const) : []),
  ];
  const recorte =
    filtros.recorte && permitidos.includes(filtros.recorte)
      ? filtros.recorte
      : "minha_caixa";
  const comSetor = recorte === "meu_setor" || recorte === "todos";
  const setores =
    recorte === "todos"
      ? a.setores.filter((s) => s.ativo)
      : setoresDisponiveis(a);
  const valores = {
    ...filtros,
    recorte,
    setor: comSetor ? filtros.setor : undefined,
  };
  const consulta = paraConsulta({ ...valores, status: undefined }, recorte);
  const [abertos, fechados] = await Promise.all([
    buscarChamados(consulta),
    filtros.fechados
      ? buscarChamados({
          ...consulta,
          status: ["fechado"],
          limite: FECHADOS_RECENTES,
        })
      : Promise.resolve([]),
  ]);
  const todos = semRepetir(abertos, fechados);
  const numeros = await contagens(todos.map((c) => c.id));
  const cartoes = todos.map((c) => ({
    ...paraLinha(c, a),
    contagens: numeros.get(c.id),
  }));

  return (
    <div className="flex flex-col gap-5">
      <Atualizado hora={horaDaVisita(a)} />
      <BarraFiltros
        tela="quadro"
        valores={valores}
        lembrados={lembrados}
        fixos={["recorte"]}
        campos={[
          campoRecorte(permitidos),
          ...(comSetor ? [campoSetor(setores)] : []),
          campoTipo,
          {
            chave: "categoria",
            rotulo: "Categoria",
            todos: "Todas as categorias",
            opcoes: opcoesDeCategoria(
              a,
              valores.setor ? [valores.setor] : null,
            ),
            largura: "w-52",
          },
          campoPrioridade,
          {
            chave: "fechados",
            rotulo: "Fechados",
            todos: "Sem os fechados",
            opcoes: [{ valor: "1", rotulo: "Com os fechados recentes" }],
            largura: "w-56",
          },
        ]}
      />
      <Quadro
        cartoes={cartoes}
        agora={a.agora.toISOString()}
        avisoHoras={a.avisoHoras}
        comFechados={!!filtros.fechados}
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
      <PainelDaLista busca={params} caminho="/os/quadro" />
    </div>
  );
}
