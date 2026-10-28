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
  PainelDaBusca,
} from "@/components/os/lista/topo";
import { VisaoLista } from "@/components/os/lista/visao-lista";
import { CabecalhoOperacoes } from "@/components/os/operacoes";
import { SeuDia } from "@/components/os/seu-dia/seu-dia";
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
  opcoesDeCategoria,
  paginaDaLista,
  pessoasPorSetor,
} from "@/server/os/visoes";

export const metadata: Metadata = { title: "Minha caixa" };

const DETALHES: Partial<Record<ChaveCartao, string>> = {
  atrasados: "passaram do prazo",
  vence_hoje: "até o fim do dia",
  aguardando_confirmacao: "pedidos seus já concluídos",
};

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <>
      <CabecalhoOperacoes descricao="O que está com você para fazer: os seus chamados, os destinos seus e do seu setor e a fila do setor, pelo prazo. Em cima, o que espera a sua confirmação." />
      <Suspense fallback={<EsqueletoVisao />}>
        <Protegido permissao="os.acessar">
          <Caixa busca={searchParams} />
          <Suspense fallback={null}>
            <SeuDia />
          </Suspense>
          <Suspense fallback={null}>
            <PainelDaBusca busca={searchParams} caminho="/os" />
          </Suspense>
        </Protegido>
      </Suspense>
    </>
  );
}

async function Caixa({ busca }: { busca: Promise<Busca> }) {
  const params = await busca;
  const e = await estadoDaLista("caixa", params);
  const { a, filtros } = e;
  // Só a página e os números dos cartões (contados no banco), em paralelo.
  const [pagina, valores] = await Promise.all([
    paginaDaLista(e),
    contarCartoes(e),
  ]);
  const setores = a.setores.filter((s) => s.ativo);

  return (
    <div className="flex flex-col gap-5">
      <Atualizado hora={horaDaVisita(a)} />
      <BarraFiltros
        tela="caixa"
        valores={filtros}
        lembrados={e.lembrados}
        busca={{ placeholder: "Buscar por número, título ou descrição…" }}
        campos={[
          { ...campoTipo, largura: "w-44" },
          { ...campoSetor(setores), largura: "w-48" },
        ]}
        extras={[
          {
            chave: "categoria",
            rotulo: "Categoria",
            todos: "Todas as categorias",
            opcoes: opcoesDeCategoria(
              a,
              filtros.setor ? [filtros.setor] : null,
            ),
          },
          campoPrioridade,
        ]}
        etiqueta
      />
      <VisaoLista
        linhas={pagina.linhas}
        total={pagina.total}
        pagina={pagina.pagina}
        cartoes={CARTOES_DA_TELA.caixa.map((chave) => ({
          chave,
          detalhe: DETALHES[chave],
          valor: valores[chave] ?? 0,
        }))}
        cartao={e.cartao}
        ordem={e.ordem}
        busca={e.q}
        agrupamento={e.modo}
        colunas={COLUNAS_DA_TELA.caixa}
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
                tela: "caixa",
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
    </div>
  );
}
