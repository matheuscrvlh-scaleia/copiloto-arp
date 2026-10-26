import {
  Building2,
  CircleCheck,
  Inbox,
  type LucideIcon,
  Timer,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { TOM } from "@/components/estilos";
import { BotaoExportar } from "@/components/os/exportar";
import { Atualizado, PainelDaBusca } from "@/components/os/lista/topo";
import { hrefDaPagina, Paginacao } from "@/components/os/paginacao";
import { CLASSE_MARCADO, tonsDaTela } from "@/components/os/tons";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { formatarNumero } from "@/lib/formato";
import {
  CARTOES_OS,
  type CartaoOS,
  extrasAtivos,
  type FiltrosOS,
  lerFiltrosOS,
  urlDosFiltros,
} from "@/lib/os/ordem-lista";
import { paginaDaUrl, totalDePaginas } from "@/lib/os/paginacao";
import { PARAM_PAINEL } from "@/lib/os/rotas";
import { paraBrasilia } from "@/lib/os/tempo";
import { exportarOrdens } from "@/server/os/acoes/ordens";
import { contexto } from "@/server/os/base";
import {
  cadastros,
  contarCartoesOS,
  filtroDaListaOS,
  paginaDeOS,
} from "@/server/os/ordem-consulta";
import {
  CAMINHO_ORDENS as CAMINHO,
  descreverFiltros,
  opcoesDeCategoria,
  paraTela,
} from "@/server/os/ordens-tela";
import { FiltrosOrdens } from "./filtros";
import { ListaOrdens } from "./lista";
import { Relatorios } from "./relatorios";

export const metadata: Metadata = { title: "Ordens de serviço" };

type Busca = Record<string, string | string[] | undefined>;

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  return (
    <>
      <PageHeader
        title="Ordens de serviço"
        description="A central de Operações: as OS internas e terceirizadas com tempo, técnicos, minuto-homem e custo. Filtre, abra o detalhe ao lado, imprima em lote e baixe as planilhas de sempre."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="os.acessar">
          <Ordens busca={searchParams} />
          <Suspense fallback={null}>
            <PainelDaBusca busca={searchParams} caminho={CAMINHO} />
          </Suspense>
        </Protegido>
      </Suspense>
    </>
  );
}

async function Ordens({ busca }: { busca: Promise<Busca> }) {
  const params = await busca;
  const f = lerFiltrosOS(params);
  const pagina = paginaDaUrl(params.pagina);
  const agora = new Date();
  const [ctx, cad] = await Promise.all([contexto(), cadastros()]);
  // Só a página mostrada vem do banco; os cartões são contagens.
  const filtro = filtroDaListaOS(f, cad, agora);
  const [{ linhas: pag, total }, contagem] = await Promise.all([
    paginaDeOS(filtro, f.cartao, pagina, agora),
    contarCartoesOS(filtro, agora),
  ]);
  const ultima = totalDePaginas(total);
  if (pagina > ultima) redirect(hrefDaPagina(CAMINHO, params, ultima));
  const comCustos = ctx.pode("os.custos");
  const linhas = pag.map((o) => paraTela(o, cad, comCustos, params));
  // A exportação relê o filtro inteiro no clique (sem a página e a janela).
  const filtros: Record<string, string> = {};
  for (const [k, v] of Object.entries(params))
    if (typeof v === "string" && k !== "pagina" && k !== PARAM_PAINEL)
      filtros[k] = v;

  return (
    <div className="flex flex-col gap-5">
      <Atualizado hora={paraBrasilia(agora).hora} />
      <FiltrosOrdens
        f={f}
        extras={extrasAtivos(f)}
        categorias={opcoesDeCategoria(cad)}
        tecnicos={[...cad.tecnicos.values()].map((t) => ({
          valor: t.id,
          rotulo: t.nome,
          descricao: t.desligado_em ? "desligado" : undefined,
        }))}
        empresas={[...cad.empresas.values()].map((e) => ({
          valor: e.id,
          rotulo: e.nome,
        }))}
      />
      <Cartoes f={f} contagem={contagem} />
      <ListaOrdens
        key={pagina}
        linhas={linhas}
        total={total}
        comCustos={comCustos}
        acoes={
          ctx.pode("os.exportar") && (
            <BotaoExportar
              titulo="Ordens de serviço"
              filtros={descreverFiltros(f, cad)}
              nomeArquivo="ordens-de-servico"
              total={total}
              carregar={exportarOrdens.bind(null, filtros)}
            />
          )
        }
        paginacao={
          <Paginacao
            pagina={pagina}
            total={total}
            href={(p) => hrefDaPagina(CAMINHO, params, p)}
          />
        }
      />
      {ctx.pode("os.exportar") && (
        <Relatorios hoje={paraBrasilia(agora).data} comCustos={comCustos} />
      )}
    </div>
  );
}

const ICONES: Record<CartaoOS, LucideIcon> = {
  abertas: Inbox,
  em_execucao: Timer,
  terceirizadas: Building2,
  finalizadas_mes: CircleCheck,
};

const DETALHE: Record<CartaoOS, string> = {
  abertas: "aberto, em andamento ou aguardando",
  em_execucao: "com o cronômetro rodando",
  terceirizadas: "com o terceirizado, ainda abertas",
  finalizadas_mes: "fechadas neste mês",
};

const TONS = tonsDaTela("ordens");

/** Os quatro cartões; clicar filtra a lista (de novo, volta para todas). */
function Cartoes({
  f,
  contagem,
}: {
  f: FiltrosOS;
  contagem: Record<CartaoOS, number>;
}) {
  return (
    <nav
      aria-label="Filtrar pelos indicadores"
      className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4"
    >
      {(Object.keys(CARTOES_OS) as CartaoOS[]).map((c, i) => {
        const Icone = ICONES[c];
        const marcado = f.cartao === c;
        return (
          <Link
            key={c}
            href={urlDosFiltros(CAMINHO, f, { cartao: marcado ? null : c })}
            aria-current={marcado ? "true" : undefined}
            scroll={false}
            className={`flutua flex min-h-32 flex-col gap-2 rounded-[1.75rem] p-4 outline-none transition focus-visible:ring-2 focus-visible:ring-marca md:p-5 ${TOM[TONS[i] ?? "claro"]} ${marcado ? CLASSE_MARCADO : ""}`}
          >
            <span className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium text-neutral-600">
                {CARTOES_OS[c]}
              </span>
              <Icone className="size-4 shrink-0 opacity-60" aria-hidden />
            </span>
            <span className="mt-auto text-3xl font-semibold tracking-tight tabular-nums">
              {formatarNumero(contagem[c])}
            </span>
            <span className="text-xs text-neutral-500">
              {marcado ? "Filtrando · toque para ver todas" : DETALHE[c]}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <IndicadoresCarregando
        quantidade={4}
        className="grid-cols-2 xl:grid-cols-4"
      />
      <CartaoCarregando altura="h-[36rem]" />
    </TelaCarregando>
  );
}
