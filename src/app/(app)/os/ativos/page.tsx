import { CircleDashed, FolderTree, Plus, QrCode } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Abas } from "@/components/admin/ui";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { CartaoIndicador } from "@/components/dashboard/indicador";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { FiltrosAtivos } from "@/components/os/ativos/filtros";
import { DecisaoDeTroca, TabelaAtivos } from "@/components/os/ativos/lista";
import { BotaoExportar } from "@/components/os/exportar";
import { hrefDaPagina, Paginacao } from "@/components/os/paginacao";
import { CLASSE_MARCADO, tonsDaTela } from "@/components/os/tons";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { formatarNumero, formatarPct } from "@/lib/formato";
import { type FiltroAtivos, lerFiltroAtivos } from "@/lib/os/ativos-lista";
import { intervalo, paginaDaUrl, totalDePaginas } from "@/lib/os/paginacao";
import { ROTAS_OS } from "@/lib/os/rotas";
import { SITUACOES_ATIVO, type SituacaoAtivo } from "@/lib/os/rotulos";
import { SINAIS, type Sinal } from "@/lib/os/sinal";
import { hojeEmBrasilia, paraBrasilia } from "@/lib/os/tempo";
import { exportarAtivos } from "@/server/os/acoes/ativos";
import {
  type CategoriaAtivo,
  indicadoresDosAtivos,
  paginaDeAtivos,
} from "@/server/os/ativos";
import { contexto } from "@/server/os/base";

const TONS = tonsDaTela("ativos");

export const metadata: Metadata = { title: "Ativos" };

type Busca = Record<string, string | string[] | undefined>;

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  return (
    <>
      <PageHeader
        title="Ativos"
        description="Cada ativo junta as OS feitas nele: quanto custou, quanto quebrou e quando vale trocar."
      />
      <Suspense fallback={<Esqueleto />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const um = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

/** Endereço com os filtros de agora, trocando alguns (volta à página 1). */
function link(sp: Busca, mudancas: Record<string, string>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const valor = um(v);
    if (valor && k !== "pagina") p.set(k, valor);
  }
  for (const [k, v] of Object.entries(mudancas)) {
    if (v) p.set(k, v);
    else p.delete(k);
  }
  const q = p.toString();
  return q ? `${ROTAS_OS.ativos}?${q}` : ROTAS_OS.ativos;
}

function descreverFiltros(
  f: FiltroAtivos,
  categorias: CategoriaAtivo[],
): string {
  return [
    f.q && `Busca: ${f.q}`,
    f.cat &&
      `Categoria: ${f.cat === "sem" ? "sem categoria" : (categorias.find((c) => c.id === f.cat)?.nome ?? "")}`,
    f.local && `Local: ${f.local === "sem" ? "sem bloco" : f.local}`,
    f.situacao &&
      `Situação: ${f.situacao === "todas" ? "todas" : (SITUACOES_ATIVO[f.situacao as SituacaoAtivo] ?? f.situacao)}`,
    f.sinal && `Sinal: ${SINAIS[f.sinal as Sinal] ?? f.sinal}`,
    f.incompleto && "Só cadastro incompleto",
    f.preventiva && "Só com preventiva atrasada",
  ]
    .filter(Boolean)
    .join(" · ");
}

async function Conteudo({ searchParams }: { searchParams: Promise<Busca> }) {
  const [ctx, sp] = await Promise.all([contexto(), searchParams]);
  if (!ctx.pode("os.ativos") && !ctx.pode("os.ativos_gerenciar"))
    return <SemAcesso />;
  const agora = new Date();
  const hoje = hojeEmBrasilia(agora);
  const f = lerFiltroAtivos(sp);
  const pagina = paginaDaUrl(sp.pagina);
  // Só a página mostrada vem inteira; os cartões são contagens.
  const [ind, { ativos: linhas, total }] = await Promise.all([
    indicadoresDosAtivos(agora),
    paginaDeAtivos(f, pagina, agora),
  ]);
  const ultima = totalDePaginas(total);
  if (pagina > ultima) redirect(hrefDaPagina(ROTAS_OS.ativos, sp, ultima));
  const verCustos = ctx.pode("os.custos");
  const gerenciar = ctx.pode("os.ativos_gerenciar");
  const { faixas, categorias } = ind;

  const cartoes: {
    titulo: string;
    valor: string;
    detalhe: string;
    href: string;
    ativo: boolean;
  }[] = [
    {
      titulo: "Ativos",
      valor: formatarNumero(ind.emUso),
      detalhe: `em uso, em manutenção ou parados${ind.incompletos ? ` · ${ind.incompletos} com cadastro incompleto` : ""}`,
      href: ROTAS_OS.ativos + (f.visao === "decisao" ? "?visao=decisao" : ""),
      ativo: false,
    },
    {
      titulo: "Preventivas atrasadas",
      valor: formatarNumero(ind.atrasadas),
      detalhe: ind.atrasadas
        ? `em ${ind.comAtraso} ${ind.comAtraso === 1 ? "ativo" : "ativos"}`
        : "nenhuma OS de plano vencida",
      href: link(sp, { preventiva: f.preventiva ? "" : "atrasada" }),
      ativo: f.preventiva,
    },
    {
      titulo: "Em manutenção",
      valor: formatarNumero(ind.manutencao),
      detalhe: `${ind.parados} ${ind.parados === 1 ? "parado" : "parados"}`,
      href: link(sp, {
        situacao: f.situacao === "em_manutencao" ? "" : "em_manutencao",
      }),
      ativo: f.situacao === "em_manutencao",
    },
    {
      titulo: "Sinal Trocar",
      valor: formatarNumero(ind.trocar),
      detalhe: "pelo pior dos três critérios",
      href: link(sp, { sinal: f.sinal === "trocar" ? "" : "trocar" }),
      ativo: f.sinal === "trocar",
    },
  ];

  const descricaoFiltros = descreverFiltros(f, categorias);
  const busca: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp))
    if (typeof v === "string" && k !== "pagina") busca[k] = v;
  const paginacao = (
    <Paginacao
      pagina={pagina}
      total={total}
      href={(p) => hrefDaPagina(ROTAS_OS.ativos, sp, p)}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-neutral-500">
          Atualizado às {paraBrasilia(agora).hora}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {ctx.pode("os.exportar") && (
            <BotaoExportar
              titulo={f.visao === "decisao" ? "Decisão de troca" : "Ativos"}
              filtros={descricaoFiltros}
              nomeArquivo={
                f.visao === "decisao" ? "decisao-de-troca" : "ativos"
              }
              total={total}
              carregar={exportarAtivos.bind(null, busca)}
            />
          )}
          {gerenciar && (
            <>
              <Link
                href={`${ROTAS_OS.ativos}/categorias`}
                className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
              >
                <FolderTree className="size-4" aria-hidden />
                Categorias
              </Link>
              <Link
                href={`${ROTAS_OS.ativos}/etiquetas`}
                className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
              >
                <QrCode className="size-4" aria-hidden />
                Etiquetas
              </Link>
              <Link
                href={`${ROTAS_OS.ativos}/novo`}
                className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-lg transition hover:bg-neutral-800"
              >
                <Plus className="size-4" aria-hidden />
                Novo ativo
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cartoes.map((c, i) => (
          <Link
            key={c.titulo}
            href={c.href}
            scroll={false}
            aria-current={c.ativo ? "true" : undefined}
            className={`flex rounded-[1.75rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca *:flex-1 ${c.ativo ? CLASSE_MARCADO : ""}`}
          >
            <CartaoIndicador
              titulo={c.titulo}
              valor={c.valor}
              detalhe={c.detalhe}
              tom={TONS[i]}
            />
          </Link>
        ))}
      </div>

      {ind.incompletos > 0 && !f.incompleto && (
        <Link
          href={link(sp, { incompleto: "1" })}
          scroll={false}
          className="flex items-center gap-3 rounded-3xl border border-dashed border-amber-300 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 transition hover:bg-amber-50"
        >
          <CircleDashed className="size-4 shrink-0" aria-hidden />
          <span className="flex-1">
            {ind.incompletos === 1
              ? "1 ativo está com o cadastro incompleto"
              : `${ind.incompletos} ativos estão com o cadastro incompleto`}{" "}
            (local, compra, reposição ou vida útil). Sem esses dados o sinal de
            troca não sai.
          </span>
          <span className="font-medium whitespace-nowrap">Ver quais →</span>
        </Link>
      )}

      <div className="flex flex-col gap-3">
        <Abas
          atual={link(sp, { visao: f.visao === "decisao" ? "decisao" : "" })}
          abas={[
            { href: link(sp, { visao: "" }), rotulo: "Lista" },
            {
              href: link(sp, { visao: "decisao" }),
              rotulo: "Decisão de troca",
            },
          ]}
        />
        <FiltrosAtivos
          busca={f.q}
          filtros={[
            {
              chave: "cat",
              rotulo: "Categoria",
              opcoes: [
                { valor: "", rotulo: "Todas as categorias" },
                ...categorias.map((c) => ({ valor: c.id, rotulo: c.nome })),
                { valor: "sem", rotulo: "Sem categoria" },
              ],
            },
            {
              chave: "local",
              rotulo: "Local",
              opcoes: [
                { valor: "", rotulo: "Todos os locais" },
                ...ind.blocos.map((b) => ({ valor: b, rotulo: b })),
                { valor: "sem", rotulo: "Sem bloco" },
              ],
            },
            {
              chave: "situacao",
              rotulo: "Situação",
              opcoes: [
                { valor: "", rotulo: "Em uso, manutenção e parados" },
                ...Object.entries(SITUACOES_ATIVO).map(([valor, rotulo]) => ({
                  valor,
                  rotulo,
                })),
                { valor: "todas", rotulo: "Todas, com os baixados" },
              ],
            },
            {
              chave: "sinal",
              rotulo: "Sinal",
              opcoes: [
                { valor: "", rotulo: "Todos os sinais" },
                ...Object.entries(SINAIS).map(([valor, rotulo]) => ({
                  valor,
                  rotulo,
                })),
              ],
            },
          ]}
        />
      </div>

      {f.visao === "decisao" ? (
        <Secao
          titulo="Decisão de troca"
          descricao={`Do maior para o menor peso da manutenção (custo de 12 meses ÷ valor de reposição). Avaliar a partir de ${formatarPct(faixas.pesoAvaliar, 0)}, trocar acima de ${formatarPct(faixas.pesoTrocar, 0)}; corretivas: avaliar a partir de ${faixas.corretivasAvaliar}, trocar a partir de ${faixas.corretivasTrocar}; idade: avaliar a partir de ${formatarPct(faixas.idadeAvaliarPct, 0)} da vida útil.`}
        >
          <div className="flex flex-col gap-4">
            <DecisaoDeTroca
              ativos={linhas}
              faixas={faixas}
              verCustos={verCustos}
              inicio={intervalo(pagina).de}
            />
            {paginacao}
          </div>
        </Secao>
      ) : (
        <Secao
          titulo={`${formatarNumero(total)} ${total === 1 ? "ativo" : "ativos"}`}
          descricao={descricaoFiltros || "Clique no nome para abrir a ficha"}
        >
          <div className="flex flex-col gap-4">
            <TabelaAtivos ativos={linhas} verCustos={verCustos} hoje={hoje} />
            {paginacao}
          </div>
        </Secao>
      )}

      <Nota>
        Custo e corretivas somam as OS do ativo (sem as canceladas), pela data
        de abertura. Corretiva é toda OS que não vem de plano preventivo nem de
        categoria preventiva. Faixas do sinal em Configurações › Parâmetros.
        {verCustos ? "" : " Valores em reais ficam com quem vê custos."}
      </Nota>
    </div>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <IndicadoresCarregando quantidade={4} />
      <FiltrosCarregando />
      <CartaoCarregando altura="h-[36rem]" />
    </TelaCarregando>
  );
}
