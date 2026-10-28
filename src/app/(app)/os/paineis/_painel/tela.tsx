import { FileDown } from "lucide-react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { SeloIlustrativo } from "@/components/dashboard/indicador";
import { Nota } from "@/components/dashboard/tabela";
import { BlocoDoPainel } from "@/components/os/paineis/blocos";
import { FiltrosDoPainel } from "@/components/os/paineis/filtros";
import { CartaoLista, ProvedorPainel } from "@/components/os/paineis/provedor";
import { tonsDaTela, tonsDosBlocos } from "@/components/os/tons";
import { slugDoSetor } from "@/lib/os/indicadores-setor";
import { ROTAS_OS } from "@/lib/os/rotas";
import {
  contexto,
  categorias as lerCategorias,
  pessoas as lerPessoas,
  type Setor,
} from "@/server/os/base";
import { setoresDoPainel } from "@/server/os/paineis/acesso";
import { type Busca, lerFiltrosDoPainel } from "@/server/os/paineis/consultas";
import { montarPainel } from "@/server/os/paineis/montar";

// Tela de um painel (geral ou de setor): filtros (setor entre eles), os 4
// cartões e os blocos. Os números vêm prontos de montarPainel.

export async function Painel({
  busca,
  setor,
}: {
  busca: Busca;
  setor: Setor | null;
}) {
  const agora = new Date();
  const [ctx, f, visiveis, cats, gente] = await Promise.all([
    contexto(),
    lerFiltrosDoPainel(busca, setor, agora),
    setoresDoPainel(),
    lerCategorias(),
    lerPessoas(),
  ]);
  const painel = await montarPainel(f, agora);
  const exportar = ctx.pode("os.exportar");
  // Cada painel (geral e de cada setor) com a sua mistura de tons.
  const chaveTons = `painel:${setor?.id ?? "geral"}`;
  const tonsCartoes = tonsDaTela(chaveTons, painel.cartoes.length);
  const tonsBlocos = tonsDosBlocos(chaveTons, painel.blocos.length);

  // Setor é filtro: cada opção é a rota do painel dele.
  const opcoesSetor = [
    ...(ctx.pode("os.painel_geral")
      ? [{ rota: ROTAS_OS.paineis, nome: "Todos os setores" }]
      : []),
    ...visiveis.map((s) => ({
      rota: `${ROTAS_OS.paineis}/${slugDoSetor(s.nome)}`,
      nome: s.nome,
    })),
  ];
  const rotaAtual = setor
    ? `${ROTAS_OS.paineis}/${slugDoSetor(setor.nome)}`
    : ROTAS_OS.paineis;
  const opcoesCategoria = cats
    .filter((c) => c.ativo && (!setor || c.setor_id === setor.id))
    .map((c) => {
      const pai = c.pai_id ? cats.find((p) => p.id === c.pai_id) : undefined;
      return {
        id: c.id,
        nome: pai ? `${pai.nome} › ${c.nome}` : c.nome,
        grupo: setor
          ? undefined
          : (visiveis.find((s) => s.id === c.setor_id)?.nome ?? undefined),
      };
    });
  const pessoasDoRecorte = gente.filter(
    (p) => !setor || p.setores.includes(setor.id),
  );
  const textoFiltros = [
    painel.titulo,
    painel.rotulo,
    f.categoria
      ? `Categoria: ${opcoesCategoria.find((c) => c.id === f.categoria?.id)?.nome}`
      : "",
    f.pessoa ? `Pessoa: ${gente.find((p) => p.id === f.pessoa)?.nome}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const pdf = new URLSearchParams({
    ...Object.fromEntries(
      Object.entries(busca).flatMap(([k, v]) =>
        typeof v === "string" ? [[k, v]] : [],
      ),
    ),
    ...(setor ? { setor: setor.id } : {}),
  });

  return (
    <ProvedorPainel linhas={painel.linhas}>
      <div className="flex flex-col gap-6">
        <FiltroPeriodo
          de={f.periodo.de}
          ate={f.periodo.ate}
          atalho={f.periodo.atalho}
          hoje={f.hoje}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FiltrosDoPainel
            setores={opcoesSetor}
            setor={rotaAtual}
            categorias={opcoesCategoria}
            categoria={f.categoria?.id ?? null}
            pessoas={pessoasDoRecorte}
            pessoa={f.pessoa}
          />
          <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
            {painel.temExemplo && (
              <SeloIlustrativo texto="Inclui dados de exemplo" />
            )}
            <span>
              {painel.titulo} · atualizado às {painel.atualizadoAs}
            </span>
            {exportar && (
              <a
                href={`${ROTAS_OS.paineis}/exportar?${pdf}`}
                download
                className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
              >
                <FileDown className="size-4" aria-hidden />
                PDF do painel
              </a>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
              filtros={textoFiltros}
            />
          ))}
        </div>

        <Nota>
          Clique em qualquer número para ver os chamados que o formam. Em aberto
          e atrasados contam{" "}
          {f.periodo.ate < f.hoje ? "no fim do período" : "agora"}; fechados, no
          prazo e tempos contam a conclusão dentro do período. O tempo em
          Aguardando sai dos prazos e dos tempos. Metas em Configurações ›
          Parâmetros. O histórico importado entra nos números; onde o sistema
          anterior não tinha a medida, o bloco avisa.
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
