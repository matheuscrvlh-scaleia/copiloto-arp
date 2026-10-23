import type { Metadata } from "next";
import { Suspense } from "react";
import { BarraFiltros } from "@/components/os/filtros/barra-filtros";
import {
  campoPrioridade,
  campoSetor,
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
  apoio,
  filtrosDaTela,
  horaDaVisita,
  nomesDosFiltros,
  opcoesDeCategoria,
  paraConsulta,
  paraLinha,
  pessoasPorSetor,
  semRepetir,
} from "@/server/os/visoes";

export const metadata: Metadata = { title: "Minha caixa" };

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <>
      <PageHeader
        title="Minha caixa"
        description="O que está com você para fazer: os seus chamados, os destinos seus e do seu setor e a fila do setor, pelo prazo. Em cima, o que espera a sua confirmação."
      />
      <Suspense fallback={<EsqueletoVisao />}>
        <Protegido permissao="os.acessar">
          <Caixa busca={searchParams} />
          <Suspense fallback={null}>
            <SeuDia />
          </Suspense>
        </Protegido>
      </Suspense>
    </>
  );
}

async function Caixa({ busca }: { busca: Promise<Busca> }) {
  const params = await busca;
  const [a, { filtros, lembrados }] = await Promise.all([
    apoio(),
    filtrosDaTela("caixa", params),
  ]);
  const consulta = paraConsulta(filtros, "minha_caixa");
  const [minhas, paraConfirmar] = await Promise.all([
    buscarChamados(consulta),
    // Pedidos meus que já foram concluídos: esperam a minha confirmação.
    buscarChamados({
      ...consulta,
      recorte: "abertos_por_mim",
      status: ["concluido"],
    }),
  ]);
  const linhas = semRepetir(paraConfirmar, minhas).map((c) => paraLinha(c, a));
  const setores = a.setores.filter((s) => s.ativo);

  return (
    <div className="flex flex-col gap-5">
      <Atualizado hora={horaDaVisita(a)} />
      <BarraFiltros
        tela="caixa"
        valores={filtros}
        lembrados={lembrados}
        etiqueta
        campos={[
          campoTipo,
          campoSetor(setores),
          {
            chave: "categoria",
            rotulo: "Categoria",
            todos: "Todas as categorias",
            opcoes: opcoesDeCategoria(
              a,
              filtros.setor ? [filtros.setor] : null,
            ),
            largura: "w-52",
          },
          campoPrioridade,
        ]}
      />
      <VisaoLista
        linhas={linhas}
        cartoes={[
          { chave: "atrasados", detalhe: "passaram do prazo" },
          { chave: "vence_hoje", detalhe: "até o fim do dia" },
          {
            chave: "aguardando_confirmacao",
            detalhe: "pedidos seus já concluídos",
          },
          { chave: "em_andamento" },
        ]}
        agrupamento="caixa"
        colunas={{ setor: true, solicitante: true }}
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
                titulo: "Minha caixa",
                filtros: descreverFiltros(
                  "caixa",
                  filtros,
                  nomesDosFiltros(filtros, a),
                ),
                nomeArquivo: "minha-caixa",
              }
            : null
        }
        vazio="Nada com você agora. Quando um chamado chegar para você ou para o seu setor, ele aparece aqui."
      />
      <PainelDaLista busca={params} caminho="/os" />
    </div>
  );
}
