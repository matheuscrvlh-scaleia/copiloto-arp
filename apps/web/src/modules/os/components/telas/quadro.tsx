import { descreverFiltros } from "@arp/shared/os/lista";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { usePermissao } from "@/lib/sessao";
import {
  horaDaVisita,
  nomesDosFiltros,
  opcoesDeCategoria,
} from "@/modules/os/apoio";
import { BarraFiltros } from "@/modules/os/components/filtros/barra-filtros";
import {
  campoPrioridade,
  campoRecorte,
  campoSetor,
  campoTipoSemAviso,
} from "@/modules/os/components/filtros/opcoes";
import { Atualizado } from "@/modules/os/components/lista/topo";
import { Quadro } from "@/modules/os/components/quadro/quadro";
import { useQuadro } from "@/modules/os/components/telas/lista";

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

export function TelaQuadro({ ordens = false }: { ordens?: boolean }) {
  const tela = ordens ? "os_quadro" : "quadro";
  // Uma consulta por coluna na API: os primeiros cartões e o total real.
  const e = useQuadro(ordens);
  const { a, valores, colunas } = e;
  const podeExportar = usePermissao("os.exportar");

  return (
    <div className="flex flex-col gap-5">
      <Atualizado hora={horaDaVisita(e.agora)} />
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
        agora={e.agora}
        avisoHoras={a.avisoHoras}
        comFechados={!!e.filtros.fechados}
        ordens={ordens}
        exportar={
          podeExportar
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
