import {
  Blocks,
  CalendarClock,
  FilePlus2,
  FileSignature,
  Filter,
  ShieldCheck,
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
import {
  CartaoDaTela,
  CartoesComercial,
  FiltrosComercial,
  hrefDoCartao,
  TabelaLista,
  TopoComercial,
  Valor,
} from "@/components/comercial/tela";
import { Secao } from "@/components/dashboard/tabela";
import { Fonte } from "@/components/dashboard/tela";
import { BotaoExportar } from "@/components/os/exportar";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import {
  GARANTIAS,
  type Garantia,
  rotuloVersao,
  STATUS,
  type StatusContrato,
  TIPOS,
  type TipoContrato,
} from "@/lib/comercial/contrato";
import { somarDias } from "@/lib/comercial/datas";
import { dadosDe, linhaDeFiltros } from "@/lib/comercial/formato";
import { formatarData, formatarDataHora, formatarNumero } from "@/lib/formato";
import {
  type LinhaContrato,
  listaDeContratos,
} from "@/server/comercial/contratos";
import { type Busca, lerFiltros } from "@/server/comercial/filtros";

export const metadata: Metadata = { title: "Contratos" };

const BASE = "/comercial/contratos";
const FONTE =
  "Base do centralizador (contratos e distratos montados no sistema)";

const ATUALIZACAO = {
  "30": "Últimos 30 dias",
  "90": "Últimos 90 dias",
  "365": "Últimos 12 meses",
  todos: "Qualquer data",
} as const;
type Atualizacao = keyof typeof ATUALIZACAO;

const CARTOES = {
  rascunho: "Rascunhos",
  pronto: "Prontos para gerar",
  gerado_mes: "Gerados no mês",
} as const;

export default function Page({
  searchParams,
}: PageProps<"/comercial/contratos">) {
  return (
    <>
      <PageHeader
        title="Contratos"
        description="Contratos e distratos montados no assistente de 8 etapas. Os dados ficam no centralizador; nada vai para o ENET."
      />
      <Suspense fallback={<Esqueleto />}>
        <Tela busca={searchParams} />
      </Suspense>
    </>
  );
}

async function Tela({ busca }: { busca: Promise<Busca> }) {
  const f = await lerFiltros("contratos", await busca);
  const { ctx } = f;
  if (
    !ctx.pode("comercial.contratos.ver") &&
    !ctx.pode("comercial.contratos.editar") &&
    !ctx.pode("comercial.contratos.gerar")
  )
    return <SemAcesso />;
  const valores = ctx.pode("comercial.valores.ver");
  const editar = ctx.pode("comercial.contratos.editar");

  const tipo = f.um("tipo") as TipoContrato | "";
  const status = f.um("status") as StatusContrato | "";
  const garantia = f.um("garantia") as Garantia | "";
  const bloco = f.um("bloco");
  const atualizacao = (
    f.um("atualizacao") in ATUALIZACAO ? f.um("atualizacao") : "90"
  ) as Atualizacao;
  const cartao = f.um("cartao") as keyof typeof CARTOES | "";
  const desde =
    atualizacao === "todos"
      ? null
      : `${somarDias(ctx.hoje, -Number(atualizacao))}T00:00:00-03:00`;

  const todas = await listaDeContratos(desde);
  const filtradas = todas.filter(
    (c) =>
      (!tipo || c.tipo === tipo) &&
      (!status || c.status === status) &&
      (!garantia || c.garantia === garantia) &&
      (!bloco || c.bloco === bloco),
  );
  const mes = ctx.hoje.slice(0, 7);
  const doMes = (c: LinhaContrato) =>
    c.status === "gerado" && (c.geradoEm ?? "").slice(0, 7) === mes;
  const lista =
    cartao === "gerado_mes"
      ? filtradas.filter(doMes)
      : cartao
        ? filtradas.filter((c) => c.status === cartao)
        : filtradas;
  const conta = {
    rascunho: filtradas.filter((c) => c.status === "rascunho").length,
    pronto: filtradas.filter((c) => c.status === "pronto").length,
    gerado_mes: filtradas.filter(doMes).length,
  };
  const blocos = [...new Set(todas.map((c) => c.bloco).filter(Boolean))].sort(
    (a, b) => String(a).localeCompare(String(b), "pt-BR", { numeric: true }),
  ) as string[];

  const linhaFiltros = linhaDeFiltros([
    { rotulo: "Tipo", valor: tipo ? TIPOS[tipo] : "Todos" },
    { rotulo: "Status", valor: status ? STATUS[status] : "Todos" },
    { rotulo: "Garantia", valor: garantia ? GARANTIAS[garantia] : "Todas" },
    { rotulo: "Bloco", valor: bloco || "Todos" },
    { rotulo: "Atualização", valor: ATUALIZACAO[atualizacao] },
    ...(cartao ? [{ rotulo: "Cartão", valor: CARTOES[cartao] }] : []),
  ]);
  const exemplo = todas.some((c) => c.exemplo);
  const agora = dadosDe(new Date());

  const colunas = [
    { titulo: "Tipo" },
    { titulo: "LUC(s)" },
    { titulo: "Locatário", classe: "min-w-48 max-w-72 whitespace-normal" },
    { titulo: "Parte" },
    { titulo: "Garantia" },
    ...(valores ? [{ titulo: "Aluguel", numero: true }] : []),
    { titulo: "Status" },
    { titulo: "Versão" },
    { titulo: "Atualizado" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <FiltrosComercial
        tela="contratos"
        hoje={ctx.hoje}
        lembrado={f.lembrado}
        selecoes={[
          {
            chave: "tipo",
            rotulo: "Tipo",
            todos: "Contratos e distratos",
            valor: tipo,
            icone: <FileSignature className="size-4" />,
            opcoes: Object.entries(TIPOS).map(([valor, rotulo]) => ({
              valor,
              rotulo,
            })),
          },
          {
            chave: "status",
            rotulo: "Status",
            todos: "Todos os status",
            valor: status,
            icone: <Filter className="size-4" />,
            opcoes: Object.entries(STATUS).map(([valor, rotulo]) => ({
              valor,
              rotulo,
            })),
          },
          {
            chave: "garantia",
            rotulo: "Garantia",
            todos: "Todas as garantias",
            valor: garantia,
            icone: <ShieldCheck className="size-4" />,
            opcoes: Object.entries(GARANTIAS).map(([valor, rotulo]) => ({
              valor,
              rotulo,
            })),
          },
          {
            chave: "bloco",
            rotulo: "Bloco",
            todos: "Todos os blocos",
            valor: bloco,
            icone: <Blocks className="size-4" />,
            opcoes: blocos.map((b) => ({
              valor: b,
              rotulo: /^\d+$/.test(b) ? `Bloco ${b}` : b,
            })),
          },
          {
            chave: "atualizacao",
            rotulo: "Atualização",
            todos: "Últimos 90 dias",
            valor: atualizacao === "90" ? "" : atualizacao,
            icone: <CalendarClock className="size-4" />,
            opcoes: (["30", "365", "todos"] as Atualizacao[]).map((a) => ({
              valor: a,
              rotulo: ATUALIZACAO[a],
            })),
          },
        ]}
      />

      <TopoComercial
        dadosDe={agora}
        filtros={linhaFiltros}
        exemplo={
          exemplo ? "contratos e distratos marcados como exemplo" : undefined
        }
        acoes={
          <>
            {editar && (
              <>
                <Link
                  href={`${BASE}/distrato/novo`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
                >
                  <FileSignature className="size-4" aria-hidden />
                  Fazer distrato
                </Link>
                <Link
                  data-guia="novo-contrato"
                  href={`${BASE}/novo`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
                >
                  <FilePlus2 className="size-4" aria-hidden />
                  Novo contrato
                </Link>
              </>
            )}
            {ctx.pode("comercial.exportar") && (
              <BotaoExportar
                titulo="Contratos"
                filtros={`${linhaFiltros} · ${agora}`}
                nomeArquivo="contratos"
                colunas={[
                  { titulo: "Tipo" },
                  { titulo: "LUC(s)" },
                  { titulo: "Locatário" },
                  { titulo: "Parte" },
                  { titulo: "Garantia" },
                  ...(valores
                    ? [
                        {
                          titulo: "Aluguel (R$)",
                          numero: true,
                          formato: "#,##0.00",
                        },
                      ]
                    : []),
                  { titulo: "Status" },
                  { titulo: "Versão" },
                  { titulo: "Atualizado em" },
                  { titulo: "Atualizado por" },
                ]}
                linhas={lista.map((c) => [
                  TIPOS[c.tipo],
                  c.lucs.join(", "),
                  c.locatario ?? "",
                  c.parte ? c.parte.toUpperCase() : "",
                  c.tipo === "distrato"
                    ? ""
                    : c.garantia
                      ? GARANTIAS[c.garantia]
                      : "",
                  ...(valores ? [c.aluguel] : []),
                  STATUS[c.status],
                  rotuloVersao(c.versao),
                  formatarDataHora(c.atualizadoEm),
                  c.atualizadoPor ?? "",
                ])}
              />
            )}
          </>
        }
      />

      <CartoesComercial>
        {(Object.keys(CARTOES) as (keyof typeof CARTOES)[]).map((k) => (
          <CartaoDaTela
            key={k}
            titulo={CARTOES[k]}
            valor={formatarNumero(conta[k])}
            detalhe={
              k === "gerado_mes"
                ? `Gerados em ${formatarData(`${mes}-01`).slice(3)}`
                : `Nos filtros da tela (${ATUALIZACAO[atualizacao].toLowerCase()})`
            }
            fonte="Base do centralizador"
            href={hrefDoCartao(BASE, f.busca, k)}
            ativo={cartao === k}
          />
        ))}
      </CartoesComercial>

      <Secao
        titulo="Contratos e distratos"
        descricao="Do mais recente para o mais antigo. Clique para abrir no assistente."
      >
        <TabelaLista
          colunas={colunas}
          placeholder="Buscar por locatário, LUC ou bloco…"
          vazio="Nenhum contrato com esses filtros."
          linhas={lista.map((c) => ({
            chave: c.id,
            href: `${BASE}/${c.id}`,
            busca: `${c.locatario ?? ""} ${c.lucs.join(" ")} ${c.bloco ?? ""}`,
            celulas: [
              TIPOS[c.tipo],
              <span key="l" className="font-mono text-xs">
                {c.lucs.join(", ") || "—"}
              </span>,
              <span key="n" className="font-medium">
                {c.locatario ?? (
                  <span className="text-neutral-400">Sem locatário</span>
                )}
              </span>,
              c.parte ? c.parte.toUpperCase() : "—",
              c.tipo === "distrato"
                ? "—"
                : c.garantia
                  ? GARANTIAS[c.garantia]
                  : "—",
              ...(valores ? [<Valor key="a" valor={c.aluguel} />] : []),
              <span
                key="s"
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.status === "gerado" ? "bg-green-100 text-green-800" : c.status === "pronto" ? "bg-sky-100 text-sky-800" : "bg-neutral-100 text-neutral-700"}`}
              >
                {STATUS[c.status]}
              </span>,
              rotuloVersao(c.versao),
              <span key="u" className="whitespace-nowrap text-xs">
                {formatarDataHora(c.atualizadoEm)}
                {c.atualizadoPor ? ` · ${c.atualizadoPor}` : ""}
              </span>,
            ],
            ordem: [
              TIPOS[c.tipo],
              c.lucs.join(","),
              c.locatario,
              c.parte,
              c.garantia,
              ...(valores ? [c.aluguel] : []),
              STATUS[c.status],
              c.versao,
              c.atualizadoEm,
            ],
          }))}
          rodape={[
            "Total",
            `${lista.length} ${lista.length === 1 ? "registro" : "registros"}`,
            "",
            "",
            "",
            ...(valores
              ? [
                  <Valor
                    key="t"
                    valor={lista.reduce(
                      (t, c) =>
                        t + (c.tipo === "contrato" ? (c.aluguel ?? 0) : 0),
                      0,
                    )}
                  />,
                ]
              : []),
            "",
            "",
            "",
          ]}
        />
        <Fonte>
          {FONTE}. Aluguel: contratos com aluguel fixo; no percentual, o mínimo
          da primeira faixa.
        </Fonte>
      </Secao>
    </div>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <IndicadoresCarregando
        className="sm:grid-cols-2 xl:grid-cols-3"
        quantidade={3}
      />
      <CartaoCarregando altura="h-96" />
    </TelaCarregando>
  );
}
