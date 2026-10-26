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
  PainelDaBusca,
} from "@/components/os/lista/topo";
import { VisaoLista } from "@/components/os/lista/visao-lista";
import { SeuDia } from "@/components/os/seu-dia/seu-dia";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import {
  type Busca,
  CARTOES_DA_TELA,
  type ChaveCartao,
  COLUNAS_DA_TELA,
  descreverFiltros,
} from "@/lib/os/lista";
import {
  contarCartoes,
  estadoDaLista,
  horaDaVisita,
  nomesDosFiltros,
  paginaDaLista,
  pessoasPorSetor,
} from "@/server/os/visoes";

export const metadata: Metadata = { title: "Abertos por mim" };

const DETALHES: Partial<Record<ChaveCartao, string>> = {
  aguardando_confirmacao: "concluídos, confirme ou reabra",
  em_andamento: "alguém está cuidando",
  atrasados: "passaram do prazo",
  fechados_mes: "resolvidos neste mês",
};

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
          <Suspense fallback={null}>
            <PainelDaBusca busca={searchParams} caminho="/os/abertos-por-mim" />
          </Suspense>
        </Protegido>
      </Suspense>
    </>
  );
}

async function Abertos({ busca }: { busca: Promise<Busca> }) {
  const params = await busca;
  const e = await estadoDaLista("abertos", params);
  const { a, filtros } = e;
  // Só a página (o andamento dos avisos, só das linhas dela) e os cartões.
  const [pagina, valores] = await Promise.all([
    paginaDaLista(e),
    contarCartoes(e),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <Atualizado hora={horaDaVisita(a)} />
      <BarraFiltros
        tela="abertos"
        valores={filtros}
        lembrados={e.lembrados}
        busca={{ placeholder: "Buscar por número, título ou descrição…" }}
        campos={[
          { ...campoTipo, largura: "w-44" },
          { ...campoSetor(a.setores.filter((s) => s.ativo)), largura: "w-48" },
          { ...campoStatus, largura: "w-40" },
        ]}
        extras={[campoPrioridade]}
        etiqueta
      />
      <VisaoLista
        linhas={pagina.linhas}
        total={pagina.total}
        pagina={pagina.pagina}
        cartoes={CARTOES_DA_TELA.abertos.map((chave) => ({
          chave,
          detalhe: DETALHES[chave],
          valor: valores[chave] ?? 0,
        }))}
        cartao={e.cartao}
        ordem={e.ordem}
        busca={e.q}
        agrupamento={e.modo}
        colunas={COLUNAS_DA_TELA.abertos}
        agora={a.agora.toISOString()}
        eu={a.ctx.usuario.id}
        avisoHoras={a.avisoHoras}
        pessoasPorSetor={pessoasPorSetor(
          a,
          pagina.linhas.filter((l) => l.podeAtribuir).map((l) => l.setorId),
        )}
        exportar={
          a.ctx.pode("os.exportar")
            ? {
                tela: "abertos",
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
    </div>
  );
}
