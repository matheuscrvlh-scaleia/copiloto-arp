import {
  CARTOES_DA_TELA,
  type ChaveCartao,
  COLUNAS_DA_TELA,
  descreverFiltros,
  type Filtros,
  paraParametros,
} from "@arp/shared/os/lista";
import { Cartao } from "@/components/page-header";
import { usePermissao, useSessao } from "@/lib/sessao";
import {
  horaDaVisita,
  nomesDosFiltros,
  opcoesDeCategoria,
  pessoasPorSetor,
} from "@/modules/os/apoio";
import {
  BarraFiltros,
  SeletorDeVisao,
} from "@/modules/os/components/filtros/barra-filtros";
import {
  campoAgrupar,
  campoPrioridade,
  campoSetor,
  campoStatus,
} from "@/modules/os/components/filtros/opcoes";
import { CargaPorPessoa } from "@/modules/os/components/lista/carga";
import { Atualizado } from "@/modules/os/components/lista/topo";
import { VisaoLista } from "@/modules/os/components/lista/visao-lista";
import { useLista } from "@/modules/os/components/telas/lista";

// Geral dos chamados (/os/meu-setor) e Meu setor das OS
// (/os/ordens/meu-setor) são a mesma tela; `ordens` troca a tabela, os filtros lembrados e os textos.

const DETALHES: Partial<Record<ChaveCartao, string>> = {
  sem_responsavel: "na fila, para distribuir",
  atrasados: "passaram do prazo",
  abertos: "aberto, em andamento ou aguardando",
  concluidos_mes: "concluídos ou fechados",
};

export function TelaGeral({
  caminho,
  ordens = false,
}: {
  /** Endereço da tela (os links da carga por pessoa voltam para ela). */
  caminho: string;
  ordens?: boolean;
}) {
  const tela = ordens ? "os_setor" : "setor";
  const e = useLista(tela);
  const { a, filtros, disponiveis, setores, pagina } = e;
  const { usuario } = useSessao();
  const podeExportar = usePermissao("os.exportar");
  if (!setores.length)
    return (
      <Cartao>
        <p className="text-sm text-neutral-600">
          Você ainda não faz parte de nenhum setor. Peça ao administrador para
          incluir você em Tickets › Configurações › Setores.
        </p>
      </Cartao>
    );

  const pessoas = pessoasPorSetor(a, setores);
  // Quem está em mais de um setor aparece uma vez.
  const membros = [
    ...new Map(
      setores.flatMap((s) => pessoas[s] ?? []).map((p) => [p.id, p]),
    ).values(),
  ].sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
  // A página, os cartões e a carga por pessoa: tudo contado no banco.
  const valores = e.cartoes;
  const carga = e.carga ?? [];
  const href = (extra: Filtros, cartao?: string) => {
    const p = paraParametros({ ...filtros, ...extra });
    if (cartao) p.set("cartao", cartao);
    return `${caminho}?${p.toString()}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <Atualizado hora={horaDaVisita(e.agora)} />
      <VisaoLista
        barra={
          <>
            <BarraFiltros
              tela={tela}
              valores={filtros}
              lembrados={e.lembrados}
              fixos={["agrupar"]}
              busca={{ placeholder: "Buscar por número, título ou descrição…" }}
              campos={[
                ...(disponiveis.length > 1
                  ? [
                      {
                        ...campoSetor(disponiveis),
                        chave: "setores" as const,
                        multipla: true,
                        largura: "w-52",
                      },
                    ]
                  : []),
                { ...campoStatus, largura: "w-40" },
                {
                  chave: "responsavel",
                  rotulo: "Responsável",
                  todos:
                    setores.length > 1 ? "Todas as pessoas" : "Todos do setor",
                  opcoes: membros.map((p) => ({ valor: p.id, rotulo: p.nome })),
                  largura: "w-48",
                },
              ]}
              extras={[
                {
                  chave: "categoria",
                  rotulo: "Categoria",
                  todos: "Todas as categorias",
                  opcoes: opcoesDeCategoria(a, setores),
                },
                campoPrioridade,
                {
                  chave: "aberto_por",
                  rotulo: "Aberto por",
                  todos: "Qualquer pessoa",
                  opcoes: [{ valor: "eu", rotulo: "Abertos por mim" }],
                },
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
          </>
        }
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
          <SeletorDeVisao tela={tela} valores={filtros} campo={campoAgrupar} />
        }
        colunas={COLUNAS_DA_TELA.setor}
        agora={e.agora}
        eu={usuario.id}
        avisoHoras={a.avisoHoras}
        pessoasPorSetor={pessoas}
        exportar={
          podeExportar
            ? {
                tela,
                titulo: ordens ? "Meu setor (OS)" : "Geral",
                filtros: descreverFiltros(
                  tela,
                  filtros,
                  nomesDosFiltros(filtros, a),
                ),
                nomeArquivo: ordens ? "os-meu-setor" : "geral",
              }
            : null
        }
        vazio={
          ordens
            ? "Nenhuma OS com esses filtros."
            : "Nenhum chamado com esses filtros."
        }
      />
    </div>
  );
}
