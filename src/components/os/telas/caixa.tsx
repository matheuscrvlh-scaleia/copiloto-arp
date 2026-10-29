import { BarraFiltros } from "@/components/os/filtros/barra-filtros";
import {
  campoPrioridade,
  campoSetor,
  campoStatus,
  campoTipoSemAviso,
} from "@/components/os/filtros/opcoes";
import { Atualizado } from "@/components/os/lista/topo";
import { VisaoLista } from "@/components/os/lista/visao-lista";
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

// Minha caixa: a dos chamados (/os) e a das OS (/os/ordens/caixa) são a
// mesma tela; `ordens` troca a tabela, os filtros lembrados e os textos.

const DETALHES: Record<
  "caixa" | "abertos",
  Partial<Record<ChaveCartao, string>>
> = {
  caixa: {
    atrasados: "passaram do prazo",
    vence_hoje: "até o fim do dia",
    aguardando_confirmacao: "pedidos seus já concluídos",
  },
  abertos: {
    aguardando_confirmacao: "concluídos, confirme ou reabra",
    em_andamento: "alguém está cuidando",
    atrasados: "passaram do prazo",
    fechados_mes: "resolvidos neste mês",
  },
};

export async function TelaCaixa({
  busca,
  ordens = false,
}: {
  busca: Promise<Busca>;
  ordens?: boolean;
}) {
  const params = await busca;
  const tela = ordens ? "os_caixa" : "caixa";
  const e = await estadoDaLista(tela, params);
  const { a, filtros } = e;
  // Só a página e os números dos cartões (contados no banco), em paralelo.
  const [pagina, valores] = await Promise.all([
    paginaDaLista(e),
    contarCartoes(e),
  ]);
  const setores = a.setores.filter((s) => s.ativo);
  // "Abertos por mim" é filtro: troca a lista (estadoDaLista).
  const lista = e.tela === "abertos" ? "abertos" : "caixa";
  const titulo = lista === "abertos" ? "Abertos por mim" : "Minha caixa";
  const arquivo = lista === "abertos" ? "abertos-por-mim" : "minha-caixa";

  return (
    <div className="flex flex-col gap-5">
      <Atualizado hora={horaDaVisita(a)} />
      <VisaoLista
        barra={
          <BarraFiltros
            tela={tela}
            valores={filtros}
            lembrados={e.lembrados}
            busca={{ placeholder: "Buscar por número, título ou descrição…" }}
            campos={[
              {
                chave: "aberto_por",
                rotulo: "Mostrar",
                todos: "Com você",
                opcoes: [{ valor: "eu", rotulo: "Abertos por mim" }],
                largura: "w-48",
              },
              ...(ordens ? [] : [{ ...campoTipoSemAviso, largura: "w-44" }]),
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
                tela,
                titulo: ordens ? `${titulo} (OS)` : titulo,
                filtros: descreverFiltros(
                  tela,
                  filtros,
                  nomesDosFiltros(filtros, a),
                ),
                nomeArquivo: ordens ? `os-${arquivo}` : arquivo,
              }
            : null
        }
        vazio={
          ordens
            ? lista === "abertos"
              ? "Você não tem OS abertas por você em andamento. Use o botão + Nova OS para abrir uma."
              : "Nenhuma OS com você agora. Quando uma OS chegar para você ou para o seu setor, ela aparece aqui."
            : lista === "abertos"
              ? "Você não tem pedidos em aberto. Use o botão + Novo para abrir um chamado."
              : "Nada com você agora. Quando um chamado chegar para você ou para o seu setor, ele aparece aqui."
        }
      />
    </div>
  );
}
