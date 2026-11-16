import {
  CARTOES_DA_TELA,
  type ChaveCartao,
  COLUNAS_DA_TELA,
  descreverFiltros,
  ORDEM_DOS_AVISOS,
} from "@arp/shared/os/lista";
import { ROTAS_OS } from "@arp/shared/os/rotas";
import { Suspense } from "react";
import { Protegido } from "@/components/protegido";
import { usePermissao, useSessao } from "@/lib/sessao";
import {
  horaDaVisita,
  nomesDosFiltros,
  opcoesDeCategoria,
  pessoasPorSetor,
} from "@/modules/os/apoio";
import { BarraFiltros } from "@/modules/os/components/filtros/barra-filtros";
import {
  campoPrioridade,
  campoSetor,
} from "@/modules/os/components/filtros/opcoes";
import {
  Atualizado,
  EsqueletoVisao,
  PainelDaBusca,
} from "@/modules/os/components/lista/topo";
import { VisaoLista } from "@/modules/os/components/lista/visao-lista";
import { CabecalhoOperacoes } from "@/modules/os/components/operacoes";
import { useLista } from "@/modules/os/components/telas/lista";

// Aviso é para ser lido: os que chegaram para você ou para o seu setor (não
// lidos primeiro) e, em Mostrar, os que você mandou (quem já leu e quem falta).

const DETALHES: Record<
  "avisos" | "avisos_mandados",
  Partial<Record<ChaveCartao, string>>
> = {
  avisos: {
    nao_lidos: "esperam a sua leitura",
    lidos: "você já marcou como lido",
  },
  avisos_mandados: {
    faltam_ler: "alguém ainda não leu",
    todos_leram: "todos já marcaram como lido",
  },
};

export default function Pagina() {
  return (
    <>
      <CabecalhoOperacoes descricao="Os avisos que chegaram para você e para o seu setor, os não lidos primeiro. Em Mostrar, veja os que você mandou e quem ainda não leu." />
      <Suspense fallback={<EsqueletoVisao />}>
        <Protegido permissao="os.acessar">
          <Avisos />
          <Suspense fallback={null}>
            <PainelDaBusca caminho={ROTAS_OS.avisos} />
          </Suspense>
        </Protegido>
      </Suspense>
    </>
  );
}

function Avisos() {
  const e = useLista("avisos");
  const { a, filtros, pagina } = e;
  const valores = e.cartoes;
  const { usuario } = useSessao();
  const podeExportar = usePermissao("os.exportar");
  const setores = a.setores.filter((s) => s.ativo);
  // "Mandados por mim" é filtro: troca a lista (estadoDaLista).
  const lista = e.tela === "avisos_mandados" ? "avisos_mandados" : "avisos";

  return (
    <div className="flex flex-col gap-5">
      <Atualizado hora={horaDaVisita(e.agora)} />
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
        ordemPadrao={ORDEM_DOS_AVISOS}
        busca={e.q}
        agrupamento={e.modo}
        colunas={COLUNAS_DA_TELA[lista]}
        agora={e.agora}
        eu={usuario.id}
        avisoHoras={a.avisoHoras}
        pessoasPorSetor={pessoasPorSetor(
          a,
          pagina.linhas.filter((l) => l.podeAtribuir).map((l) => l.setorId),
        )}
        exportar={
          podeExportar
            ? {
                tela: "avisos",
                titulo:
                  lista === "avisos_mandados"
                    ? "Avisos mandados por mim"
                    : "Avisos",
                filtros: descreverFiltros(
                  "avisos",
                  filtros,
                  nomesDosFiltros(filtros, a),
                ),
                nomeArquivo:
                  lista === "avisos_mandados"
                    ? "avisos-mandados-por-mim"
                    : "avisos",
              }
            : null
        }
        vazio={
          lista === "avisos_mandados"
            ? "Você ainda não mandou avisos. Use o botão + Novo e escolha Aviso."
            : "Nenhum aviso com você agora. Quando um aviso chegar para você ou para o seu setor, ele aparece aqui."
        }
      />
    </div>
  );
}
