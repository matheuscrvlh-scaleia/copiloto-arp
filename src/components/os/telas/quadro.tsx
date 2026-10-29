import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { BarraFiltros } from "@/components/os/filtros/barra-filtros";
import {
  campoPrioridade,
  campoRecorte,
  campoSetor,
  campoTipoSemAviso,
} from "@/components/os/filtros/opcoes";
import { Atualizado } from "@/components/os/lista/topo";
import { Quadro } from "@/components/os/quadro/quadro";
import { type Busca, descreverFiltros } from "@/lib/os/lista";
import {
  colunasDoQuadro,
  estadoDoQuadro,
  horaDaVisita,
  nomesDosFiltros,
  opcoesDeCategoria,
} from "@/server/os/visoes";

// Quadro: o dos chamados (/os/quadro) e o das OS (/os/ordens/quadro) são a
// mesma tela; `ordens` troca a tabela, os filtros lembrados e os textos.

export function EsqueletoQuadro() {
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

export async function TelaQuadro({
  busca,
  ordens = false,
}: {
  busca: Promise<Busca>;
  ordens?: boolean;
}) {
  const params = await busca;
  const tela = ordens ? "os_quadro" : "quadro";
  const e = await estadoDoQuadro(params, ordens);
  const { a, valores } = e;
  // Uma consulta por coluna: os primeiros cartões e o total real dela.
  const colunas = await colunasDoQuadro(e);

  return (
    <div className="flex flex-col gap-5">
      <Atualizado hora={horaDaVisita(a)} />
      <BarraFiltros
        tela={tela}
        valores={valores}
        lembrados={e.lembrados}
        fixos={["recorte"]}
        campos={[
          campoRecorte(e.permitidos),
          ...(e.comSetor
            ? [{ ...campoSetor(e.setores), largura: "w-48" }]
            : []),
          ...(ordens ? [] : [{ ...campoTipoSemAviso, largura: "w-44" }]),
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
        ordens={ordens}
        exportar={
          a.ctx.pode("os.exportar")
            ? {
                titulo: ordens ? "Quadro das OS" : "Quadro",
                filtros: descreverFiltros(
                  tela,
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
