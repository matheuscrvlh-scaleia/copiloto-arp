import {
  Building2,
  CircleCheck,
  Inbox,
  type LucideIcon,
  Timer,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { TOM } from "@/components/estilos";
import { Atualizado, PainelDaLista } from "@/components/os/lista/topo";
import { CLASSE_MARCADO, tonsDaTela } from "@/components/os/tons";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { formatarNumero } from "@/lib/formato";
import {
  descreverPeriodos,
  formatarDuracao,
  minutoHomem,
  minutosDaOS,
} from "@/lib/os/calculos";
import {
  CARTOES_OS,
  type CartaoOS,
  contarCartoes,
  FILTROS_STATUS,
  type FiltrosOS,
  lerFiltrosOS,
  localConfere,
  noCartao,
  statusDoFiltro,
  urlDosFiltros,
} from "@/lib/os/ordem-lista";
import { PARAM_PAINEL } from "@/lib/os/rotas";
import { EXECUCOES } from "@/lib/os/rotulos";
import { paraBrasilia } from "@/lib/os/tempo";
import { contexto } from "@/server/os/base";
import {
  type Cadastros,
  cadastros,
  consultarOS,
  type LinhaOS,
  localDa,
  sessoesDa,
  tecnicosDa,
  tipoServicoDa,
  valoresDa,
} from "@/server/os/ordem-consulta";
import { FiltrosOrdens } from "./filtros";
import { type LinhaOSTela, ListaOrdens } from "./lista";
import { Relatorios } from "./relatorios";

export const metadata: Metadata = { title: "Ordens de serviço" };

const CAMINHO = "/os/ordens";
const LIMITE = 1000;

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
        </Protegido>
      </Suspense>
    </>
  );
}

async function Ordens({ busca }: { busca: Promise<Busca> }) {
  const params = await busca;
  const f = lerFiltrosOS(params);
  const [ctx, cad, todas] = await Promise.all([
    contexto(),
    cadastros(),
    consultarOS({
      status: statusDoFiltro(f.status),
      execucao: f.execucao,
      categoria: f.categoria,
      empresa: f.empresa,
      rateio: f.rateio,
      de: f.de,
      ate: f.ate,
      limite: LIMITE,
    }),
  ]);
  const agora = new Date();
  const comCustos = ctx.pode("os.custos");

  // Técnico e local não são colunas do chamado: filtram aqui.
  const filtradas = todas.filter(
    (o) =>
      (!f.tecnico ||
        o.sessoes.some((s) =>
          s.sessao_tecnicos.some((t) => t.tecnico_id === f.tecnico),
        )) &&
      localConfere(localDa(o, cad), f.local),
  );
  const contagem = contarCartoes(
    filtradas.map((o) => ({ ...o, sessoes: sessoesDa(o) })),
    agora,
  );
  const visiveis = f.cartao
    ? filtradas.filter((o) =>
        noCartao({ ...o, sessoes: sessoesDa(o) }, f.cartao as CartaoOS, agora),
      )
    : filtradas;
  const linhas = visiveis.map((o) => paraTela(o, cad, comCustos, params));

  return (
    <div className="flex flex-col gap-5">
      <Atualizado hora={paraBrasilia(agora).hora} />
      <FiltrosOrdens
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
        linhas={linhas}
        comCustos={comCustos}
        exportar={
          ctx.pode("os.exportar")
            ? {
                titulo: "Ordens de serviço",
                filtros: descreverFiltros(f, cad),
              }
            : null
        }
        limitado={todas.length >= LIMITE}
      />
      {ctx.pode("os.exportar") && (
        <Relatorios hoje={paraBrasilia(agora).data} comCustos={comCustos} />
      )}
      <PainelDaLista busca={params} caminho={CAMINHO} />
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

function paraTela(
  o: LinhaOS,
  cad: Cadastros,
  comCustos: boolean,
  params: Busca,
): LinhaOSTela {
  const sessoes = sessoesDa(o);
  const minutos = minutosDaOS(sessoes);
  const mh = minutoHomem(sessoes);
  const v = comCustos ? valoresDa(o) : { valor: null, valorRateio: null };
  const painel = new URLSearchParams();
  for (const [k, x] of Object.entries(params))
    if (k !== PARAM_PAINEL && typeof x === "string") painel.set(k, x);
  painel.set(PARAM_PAINEL, o.id);
  return {
    id: o.id,
    numero: o.numero,
    titulo: o.titulo,
    status: o.status,
    aguardando: o.aguardando_tipo,
    execucao: o.execucao,
    tipoServico: tipoServicoDa(o, cad),
    local: localDa(o, cad),
    tecnicos:
      o.execucao === "terceirizada" && o.empresa_id
        ? [cad.empresas.get(o.empresa_id)?.nome, ...tecnicosDa(o, cad)]
            .filter(Boolean)
            .join(", ")
        : tecnicosDa(o, cad).join(", "),
    periodos: descreverPeriodos(sessoes),
    minutos,
    duracao: formatarDuracao(minutos),
    minutoHomem: mh,
    hh: formatarDuracao(mh),
    rodando: sessoes.some((s) => s.fim === null),
    rateio: o.rateio,
    valor: comCustos ? (v.valor ?? 0) : null,
    valorRateio: comCustos ? (v.valorRateio ?? 0) : null,
    exemplo: o.exemplo,
    href: `${CAMINHO}?${painel.toString()}`,
  };
}

function opcoesDeCategoria(cad: Cadastros) {
  return [...cad.categorias.values()]
    .filter((c) => c.tipo_padrao === "os" || c.registrar_tempo)
    .map((c) => ({
      valor: c.id,
      rotulo: c.nome,
      descricao: c.pai_id ? cad.categorias.get(c.pai_id)?.nome : undefined,
    }));
}

/** Linha de filtros do arquivo exportado. */
function descreverFiltros(f: FiltrosOS, cad: Cadastros): string {
  const partes = [
    f.status && `Status: ${FILTROS_STATUS[f.status]}`,
    f.execucao && `Execução: ${EXECUCOES[f.execucao]}`,
    f.categoria && `Tipo: ${cad.categorias.get(f.categoria)?.nome ?? "—"}`,
    f.tecnico && `Técnico: ${cad.tecnicos.get(f.tecnico)?.nome ?? "—"}`,
    f.empresa && `Empresa: ${cad.empresas.get(f.empresa)?.nome ?? "—"}`,
    f.rateio !== null && `Rateio: ${f.rateio ? "Sim" : "Não"}`,
    (f.de || f.ate) &&
      `Criadas: ${f.de ? f.de.split("-").reverse().join("/") : "início"} a ${f.ate ? f.ate.split("-").reverse().join("/") : "hoje"}`,
    f.local && `Local: ${f.local}`,
    f.cartao && CARTOES_OS[f.cartao],
  ].filter(Boolean);
  return partes.length ? partes.join(" · ") : "Todas as OS";
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
