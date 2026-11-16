import type { RespostaPainel } from "@arp/shared/os/contratos/paineis";
import { useSuspenseQuery } from "@tanstack/react-query";
import { FileDown } from "lucide-react";
import { useDeferredValue } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { Nota } from "@/components/dashboard/tabela";
import { SemAcesso } from "@/components/protegido";
import { tonsDaTela, tonsDosBlocos } from "@/components/tons";
import { Redirecionar, useBusca, useParametrosDeBusca } from "@/lib/navegacao";
import { usePermissao } from "@/lib/sessao";
import { consultaDoPainel, enderecoDoPdf } from "@/modules/os/api-paineis";
import { BlocoDoPainel } from "./blocos";
import { FiltrosDoPainel } from "./filtros";
import { CartaoLista, ProvedorPainel } from "./provedor";

// Tela de um painel (geral ou de setor): filtros (setor entre eles), os 4
// cartões e os blocos. Os números vêm prontos da API (montarPainel).

/**
 * Lê o painel (`setor`: o do endereço; null: o geral) e decide entre a tela,
 * o aviso sem acesso e o painel do primeiro setor.
 */
export function TelaDoPainel({ setor }: { setor: string | null }) {
  const params = useParametrosDeBusca();
  const busca = useDeferredValue(useBusca());
  const { data } = useSuspenseQuery(consultaDoPainel(busca, setor));
  if (data.tipo === "sem_acesso") return <SemAcesso />;
  if (data.tipo === "redirecionar") {
    const qs = new URLSearchParams(
      [...params.entries()].filter(([, v]) => typeof v === "string"),
    ).toString();
    return <Redirecionar para={`${data.para}${qs ? `?${qs}` : ""}`} />;
  }
  return <Painel dados={data} />;
}

function Painel({
  dados,
}: {
  dados: Extract<RespostaPainel, { tipo: "painel" }>;
}) {
  const params = useParametrosDeBusca();
  const exportar = usePermissao("os.exportar");
  const { painel } = dados;
  // Cada painel (geral e de cada setor) com a sua mistura de tons.
  const chaveTons = `painel:${dados.setorId ?? "geral"}`;
  const tonsCartoes = tonsDaTela(chaveTons, painel.cartoes.length);
  const tonsBlocos = tonsDosBlocos(chaveTons, painel.blocos.length);
  const pdf = new URLSearchParams({
    ...Object.fromEntries(params.entries()),
    ...(dados.setorId ? { setor: dados.setorId } : {}),
  });

  return (
    <ProvedorPainel linhas={painel.linhas} exportar={exportar}>
      <div className="flex flex-col gap-6">
        <FiltroPeriodo
          de={dados.periodo.de}
          ate={dados.periodo.ate}
          atalho={dados.periodo.atalho}
          hoje={dados.hoje}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FiltrosDoPainel
            setores={dados.setores}
            setor={dados.rotaAtual}
            categorias={dados.categorias}
            categoria={dados.categoria}
            pessoas={dados.pessoas}
            pessoa={dados.pessoa}
          />
          <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
            <span>
              {painel.titulo} · atualizado às {painel.atualizadoAs}
            </span>
            {exportar && (
              <a
                data-guia="exportar"
                href={enderecoDoPdf(pdf)}
                download
                className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
              >
                <FileDown className="size-4" aria-hidden />
                PDF do painel
              </a>
            )}
          </div>
        </div>

        <div
          data-guia="cartoes"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {painel.cartoes.map((c, i) => (
            <CartaoLista
              key={c.titulo}
              cartao={{ ...c, tom: tonsCartoes[i] ?? c.tom }}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-flow-row-dense xl:grid-cols-12">
          {painel.blocos.map((b, i) => (
            <BlocoDoPainel
              key={b.id}
              bloco={{ ...b, tom: b.tom ?? tonsBlocos[i] }}
              exportar={exportar}
              filtros={dados.textoFiltros}
            />
          ))}
        </div>

        <Nota>
          Clique em qualquer número para ver os chamados que o formam. Em aberto
          e atrasados contam{" "}
          {dados.periodo.ate < dados.hoje ? "no fim do período" : "agora"}
          {"; "}fechados, no prazo e tempos contam a conclusão dentro do
          período. O tempo em Aguardando sai dos prazos e dos tempos. Metas em
          Configurações › Parâmetros. O histórico importado entra nos números;
          onde o sistema anterior não tinha a medida, o bloco avisa.
        </Nota>
      </div>
    </ProvedorPainel>
  );
}

/** Blocos no lugar do painel enquanto os dados chegam. */
export function EsqueletoDoPainel() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <IndicadoresCarregando quantidade={4} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <CartaoCarregando className="xl:col-span-7" altura="h-80" />
        <CartaoCarregando className="xl:col-span-5" altura="h-80" />
        <CartaoCarregando className="xl:col-span-6" altura="h-72" />
        <CartaoCarregando className="xl:col-span-6" altura="h-72" />
      </div>
    </TelaCarregando>
  );
}
