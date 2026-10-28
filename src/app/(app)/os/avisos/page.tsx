import type { Metadata } from "next";
import { Suspense } from "react";
import { BarraFiltros } from "@/components/os/filtros/barra-filtros";
import {
  campoPrioridade,
  campoSetor,
  campoStatus,
} from "@/components/os/filtros/opcoes";
import {
  Atualizado,
  EsqueletoVisao,
  PainelDaBusca,
} from "@/components/os/lista/topo";
import { VisaoLista } from "@/components/os/lista/visao-lista";
import { CabecalhoOperacoes } from "@/components/os/operacoes";
import { Protegido } from "@/components/protegido";
import {
  type Busca,
  CARTOES_DA_TELA,
  type ChaveCartao,
  COLUNAS_DA_TELA,
  descreverFiltros,
} from "@/lib/os/lista";
import { ROTAS_OS } from "@/lib/os/rotas";
import {
  contarCartoes,
  estadoDaLista,
  horaDaVisita,
  nomesDosFiltros,
  opcoesDeCategoria,
  paginaDaLista,
  pessoasPorSetor,
} from "@/server/os/visoes";

export const metadata: Metadata = { title: "Avisos" };

// A Minha caixa só dos avisos: os que chegaram para você ou para o seu
// setor e, em Mostrar, os que você mandou (com quem já concluiu e quem falta).

const DETALHES: Record<
  "caixa" | "abertos",
  Partial<Record<ChaveCartao, string>>
> = {
  caixa: {
    atrasados: "passaram do prazo",
    vence_hoje: "até o fim do dia",
    aguardando_confirmacao: "avisos seus já concluídos",
  },
  abertos: {
    aguardando_confirmacao: "concluídos, confirme ou reabra",
    em_andamento: "alguém está cuidando",
    atrasados: "passaram do prazo",
    fechados_mes: "resolvidos neste mês",
  },
};

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <>
      <CabecalhoOperacoes descricao="Os avisos que chegaram para você e para o seu setor, pelo prazo. Em Mostrar, veja os que você mandou e quem ainda falta concluir." />
      <Suspense fallback={<EsqueletoVisao />}>
        <Protegido permissao="os.acessar">
          <Avisos busca={searchParams} />
          <Suspense fallback={null}>
            <PainelDaBusca busca={searchParams} caminho={ROTAS_OS.avisos} />
          </Suspense>
        </Protegido>
      </Suspense>
    </>
  );
}

async function Avisos({ busca }: { busca: Promise<Busca> }) {
  const params = await busca;
  const e = await estadoDaLista("avisos", params);
  const { a, filtros } = e;
  const [pagina, valores] = await Promise.all([
    paginaDaLista(e),
    contarCartoes(e),
  ]);
  const setores = a.setores.filter((s) => s.ativo);
  // "Abertos por mim" é filtro: troca a lista (estadoDaLista).
  const lista = e.tela === "abertos" ? "abertos" : "caixa";

  return (
    <div className="flex flex-col gap-5">
      <Atualizado hora={horaDaVisita(a)} />
      <VisaoLista
        barra={
          <BarraFiltros
            tela="avisos"
            valores={filtros}
            lembrados={e.lembrados}
            busca={{ placeholder: "Buscar por número, título ou descrição…" }}
            campos={[
              {
                chave: "aberto_por",
                rotulo: "Mostrar",
                todos: "Com você",
                opcoes: [{ valor: "eu", rotulo: "Mandados por mim" }],
                largura: "w-48",
              },
              { ...campoSetor(setores), largura: "w-48" },
              ...(lista === "abertos"
                ? [{ ...campoStatus, largura: "w-40" }]
                : []),
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
        }
        linhas={pagina.linhas}
        total={pagina.total}
        pagina={pagina.pagina}
        cartoes={CARTOES_DA_TELA[lista].map((chave) => ({
          chave,
          detalhe: DETALHES[lista][chave],
          valor: valores[chave] ?? 0,
        }))}
        cartao={e.cartao}
        ordem={e.ordem}
        busca={e.q}
        agrupamento={e.modo}
        colunas={COLUNAS_DA_TELA[lista]}
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
                tela: "avisos",
                titulo:
                  lista === "abertos" ? "Avisos mandados por mim" : "Avisos",
                filtros: descreverFiltros(
                  "avisos",
                  filtros,
                  nomesDosFiltros(filtros, a),
                ),
                nomeArquivo:
                  lista === "abertos" ? "avisos-mandados-por-mim" : "avisos",
              }
            : null
        }
        vazio={
          lista === "abertos"
            ? "Você não mandou avisos em aberto. Use o botão + Novo e escolha Aviso."
            : "Nenhum aviso com você agora. Quando um aviso chegar para você ou para o seu setor, ele aparece aqui."
        }
      />
    </div>
  );
}
