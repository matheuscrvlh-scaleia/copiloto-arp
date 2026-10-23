import { FileDown } from "lucide-react";
import Link from "next/link";
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
import { paramsDoPeriodo } from "@/lib/periodo";
import {
  contexto,
  categorias as lerCategorias,
  pessoas as lerPessoas,
  type Setor,
} from "@/server/os/base";
import { type Busca, lerFiltrosDoPainel } from "@/server/os/paineis";
import { setoresDoPainel } from "./acesso";
import { montarPainel } from "./montar";

// Tela de um painel (geral ou de setor): abas dos setores, filtros, os 4
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

  // Os links das abas levam o período e a pessoa (a categoria é do setor).
  const qs = new URLSearchParams({
    ...paramsDoPeriodo(f.periodo),
    ...(f.pessoa ? { pessoa: f.pessoa } : {}),
  }).toString();
  const abas = [
    ...(ctx.pode("os.painel_geral")
      ? [{ chave: "geral", href: `${ROTAS_OS.paineis}?${qs}`, rotulo: "Geral" }]
      : []),
    ...visiveis.map((s) => ({
      chave: s.id,
      href: `${ROTAS_OS.paineis}/${slugDoSetor(s.nome)}?${qs}`,
      rotulo: s.nome,
    })),
  ];
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
        {abas.length > 1 && (
          <nav
            aria-label="Painéis por setor"
            className="vidro inline-flex max-w-full gap-1 self-start overflow-x-auto rounded-full p-1"
          >
            {abas.map((a) => {
              const atual = (setor?.id ?? "geral") === a.chave;
              return (
                <Link
                  key={a.chave}
                  href={a.href}
                  aria-current={atual ? "page" : undefined}
                  className="shrink-0 rounded-full px-4 py-2 text-sm text-neutral-500 transition hover:text-neutral-900 aria-[current=page]:bg-neutral-900 aria-[current=page]:font-medium aria-[current=page]:text-white"
                >
                  {a.rotulo}
                </Link>
              );
            })}
          </nav>
        )}

        <FiltroPeriodo
          de={f.periodo.de}
          ate={f.periodo.ate}
          atalho={f.periodo.atalho}
          hoje={f.hoje}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FiltrosDoPainel
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
