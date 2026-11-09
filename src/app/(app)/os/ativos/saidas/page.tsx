import { FileText, Filter } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Abas } from "@/components/admin/ui";
import {
  CartaoCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { CartaoIndicador, SeloStatus } from "@/components/dashboard/indicador";
import {
  type Coluna,
  Nota,
  Secao,
  Tabela,
} from "@/components/dashboard/tabela";
import { classeCampo } from "@/components/estilos";
import { BotaoRegistrarSaida, rotaRecibo } from "@/components/os/ativos/saida";
import { BotaoExportar } from "@/components/os/exportar";
import { tonsDaTela } from "@/components/os/tons";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { Selecao } from "@/components/selecao";
import { formatarData, formatarMoeda, formatarNumero } from "@/lib/formato";
import { ROTAS_OS, rotaAtivo } from "@/lib/os/rotas";
import {
  type FiltroSaidas,
  lerFiltroSaidas,
  totaisDasSaidas,
} from "@/lib/os/saidas";
import { hojeEmBrasilia, paraBrasilia } from "@/lib/os/tempo";
import { categoriasDeAtivo } from "@/server/os/ativos";
import { contexto, pessoas } from "@/server/os/base";
import {
  listasDeSaida,
  relatorioDeSaidas,
  type SaidaNoRelatorio,
  tiposUsados,
} from "@/server/os/saidas";

// Relatório de saídas de ativos (venda, doação, descarte, devolução):
// período, tipo e responsável, com o total vendido, em Excel e PDF. É uma
// aba de Ativos (sem item novo no menu). Daqui também sai a saída de uma
// sobra sem cadastro, que vira um ativo já baixado.

export const metadata: Metadata = { title: "Saídas de ativos" };

type Busca = Record<string, string | string[] | undefined>;

const TONS = tonsDaTela("saidas-de-ativos");

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
      <Abas
        atual={`${ROTAS_OS.ativos}/saidas`}
        abas={[
          { href: ROTAS_OS.ativos, rotulo: "Lista" },
          {
            href: `${ROTAS_OS.ativos}?visao=decisao`,
            rotulo: "Decisão de troca",
          },
          { href: `${ROTAS_OS.ativos}/saidas`, rotulo: "Saídas" },
        ]}
      />
      <Suspense fallback={<Esqueleto />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function descrever(f: FiltroSaidas, responsavel: string | null): string {
  return [
    f.de || f.ate
      ? `Período: ${f.de ? formatarData(f.de) : "início"} a ${f.ate ? formatarData(f.ate) : "hoje"}`
      : "Período: todo o histórico",
    f.tipo && `Tipo: ${f.tipo}`,
    f.responsavel && `Responsável: ${responsavel ?? "—"}`,
    f.desfeitas ? "Com as saídas desfeitas" : "Sem as saídas desfeitas",
  ]
    .filter(Boolean)
    .join(" · ");
}

async function Conteudo({ searchParams }: { searchParams: Promise<Busca> }) {
  const [ctx, sp] = await Promise.all([contexto(), searchParams]);
  if (
    !ctx.pode("os.ativos") &&
    !ctx.pode("os.ativos_gerenciar") &&
    !ctx.pode("os.ativos_saida")
  )
    return <SemAcesso />;
  const agora = new Date();
  const hoje = hojeEmBrasilia(agora);
  const f = lerFiltroSaidas(sp);
  const podeSaida = ctx.pode("os.ativos_saida");
  const [linhas, tipos, listaPessoas, listas, categorias] = await Promise.all([
    relatorioDeSaidas(f),
    tiposUsados(),
    pessoas(),
    podeSaida ? listasDeSaida() : null,
    podeSaida ? categoriasDeAtivo() : [],
  ]);
  const nomeResp = f.responsavel
    ? (listaPessoas.find((p) => p.id === f.responsavel)?.nome ?? null)
    : null;
  const filtros = descrever(f, nomeResp);
  const t = totaisDasSaidas(linhas);
  const contar = (tipo: string) =>
    t.porTipo.find((p) => p.tipo === tipo)?.quantidade ?? 0;
  const opcoesPessoas = listaPessoas.map((p) => ({
    valor: p.id,
    rotulo: p.nome,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-neutral-500">
          Atualizado às {paraBrasilia(agora).hora}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {ctx.pode("os.exportar") && (
            <BotaoExportar
              titulo="Saídas de ativos"
              filtros={filtros}
              nomeArquivo="saidas-de-ativos"
              colunas={COLUNAS_EXPORTAR}
              linhas={linhas.map(linhaExportar)}
            />
          )}
          {listas && (
            <BotaoRegistrarSaida
              variante="primario"
              tipos={listas.tipos}
              formas={listas.formas}
              pessoas={opcoesPessoas}
              hoje={hoje}
              responsavelPadrao={
                listaPessoas.some((p) => p.id === ctx.usuario.id)
                  ? ctx.usuario.id
                  : ""
              }
              sobra={{
                categorias: categorias.map((c) => ({
                  valor: c.id,
                  rotulo: c.nome,
                })),
              }}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CartaoIndicador
          tom={TONS[0]}
          titulo="Saídas"
          valor={formatarNumero(t.quantidade)}
          detalhe="no período, sem as desfeitas"
        />
        <CartaoIndicador
          tom={TONS[1]}
          titulo="Total vendido"
          valor={formatarMoeda(t.vendidoCentavos / 100)}
          detalhe={`${formatarNumero(contar("Venda"))} ${contar("Venda") === 1 ? "venda" : "vendas"}`}
        />
        <CartaoIndicador
          tom={TONS[2]}
          titulo="Doações"
          valor={formatarNumero(contar("Doação"))}
          detalhe="sem custo para quem recebeu"
        />
        <CartaoIndicador
          tom={TONS[3]}
          titulo="Descartes"
          valor={formatarNumero(contar("Descarte"))}
          detalhe={`devoluções: ${formatarNumero(contar("Devolução"))}`}
        />
      </div>

      <form
        method="get"
        data-guia="os-saidas-filtros"
        className="vidro flex flex-wrap items-end gap-3 rounded-[1.75rem] p-4"
      >
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
          De
          <input
            type="date"
            name="de"
            defaultValue={f.de ?? ""}
            className={classeCampo}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
          Até
          <input
            type="date"
            name="ate"
            defaultValue={f.ate ?? ""}
            className={classeCampo}
          />
        </label>
        <div className="flex min-w-44 flex-col gap-1 text-xs font-medium text-neutral-600">
          <span>Tipo</span>
          <Selecao
            name="tipo"
            rotulo="Tipo de saída"
            valorInicial={f.tipo ?? ""}
            opcoes={[
              { valor: "", rotulo: "Todos os tipos" },
              ...tipos.map((x) => ({ valor: x, rotulo: x })),
            ]}
          />
        </div>
        <div className="flex min-w-52 flex-col gap-1 text-xs font-medium text-neutral-600">
          <span>Responsável</span>
          <Selecao
            name="resp"
            rotulo="Responsável"
            valorInicial={f.responsavel ?? ""}
            opcoes={[{ valor: "", rotulo: "Todos" }, ...opcoesPessoas]}
          />
        </div>
        <label className="inline-flex items-center gap-2 pb-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            name="desfeitas"
            value="1"
            defaultChecked={f.desfeitas}
          />
          Mostrar desfeitas
        </label>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          <Filter className="size-4" aria-hidden />
          Filtrar
        </button>
        <Link
          href={`${ROTAS_OS.ativos}/saidas`}
          className="pb-2 text-sm text-neutral-500 underline-offset-4 hover:text-neutral-900 hover:underline"
        >
          Limpar
        </Link>
      </form>

      <Secao
        titulo={`${formatarNumero(linhas.length)} ${linhas.length === 1 ? "saída" : "saídas"}`}
        descricao={filtros}
      >
        <Tabela
          colunas={COLUNAS}
          linhas={linhas}
          chave={(s) => s.id}
          vazio="Nenhuma saída no período. A saída se registra na ficha do ativo (botão Registrar saída) ou aqui, para uma sobra sem cadastro."
          rodape={[
            "Total vendido",
            "",
            "",
            "",
            formatarMoeda(t.vendidoCentavos / 100),
            "",
            "",
            "",
            "",
            "",
          ]}
        />
      </Secao>

      <Nota>
        Total vendido soma o valor das saídas do tipo Venda que valem (sem as
        desfeitas). Tipos de saída e formas de recebimento em Configurações ›
        Parâmetros › Saída de ativos.
      </Nota>
    </div>
  );
}

const COLUNAS: Coluna<SaidaNoRelatorio>[] = [
  { titulo: "Data", valor: (s) => formatarData(s.data) },
  {
    titulo: "Ativo",
    valor: (s) =>
      s.ativo ? (
        <Link
          href={`${rotaAtivo(s.ativo.id)}#saida`}
          className="font-medium underline-offset-2 hover:underline"
        >
          <span className="font-mono text-xs text-neutral-500">
            {s.ativo.codigo}
          </span>{" "}
          {s.ativo.nome}
        </Link>
      ) : (
        "—"
      ),
  },
  { titulo: "Tipo", valor: (s) => s.tipo },
  { titulo: "Quantidade", valor: (s) => s.quantidade ?? "—" },
  {
    titulo: "Valor",
    numero: true,
    valor: (s) => (s.valor === null ? "—" : formatarMoeda(Number(s.valor))),
  },
  { titulo: "Recebimento", valor: (s) => s.forma ?? "—" },
  { titulo: "Destinatário", valor: (s) => s.destinatario ?? "—" },
  { titulo: "Responsável", valor: (s) => s.responsavel ?? "—" },
  {
    titulo: "Situação",
    valor: (s) => (
      <SeloStatus
        status={s.desfeita ? "sem_dado" : "ok"}
        rotulo={s.desfeita ? "Desfeita" : "Valendo"}
      />
    ),
  },
  {
    titulo: "Recibo",
    valor: (s) => (
      <a
        href={rotaRecibo(s.id)}
        target="_blank"
        rel="noreferrer"
        aria-label={`Recibo em PDF da saída de ${formatarData(s.data)}`}
        className="inline-flex items-center gap-1 text-xs font-medium text-neutral-700 underline-offset-2 hover:underline"
      >
        <FileText className="size-3.5" aria-hidden />
        PDF
      </a>
    ),
  },
];

const COLUNAS_EXPORTAR = [
  { titulo: "Data" },
  { titulo: "Código" },
  { titulo: "Ativo" },
  { titulo: "Tipo" },
  { titulo: "Quantidade" },
  { titulo: "Valor (R$)", numero: true, formato: "#,##0.00" },
  { titulo: "Recebimento" },
  { titulo: "Destinatário" },
  { titulo: "Responsável" },
  { titulo: "Nota fiscal" },
  { titulo: "Situação" },
];

function linhaExportar(s: SaidaNoRelatorio) {
  return [
    formatarData(s.data),
    s.ativo?.codigo ?? "",
    s.ativo?.nome ?? "",
    s.tipo,
    s.quantidade ?? "",
    s.valor === null ? null : Number(s.valor),
    s.forma ?? "",
    s.destinatario ?? "",
    s.responsavel ?? "",
    s.notaFiscal ?? "Não",
    s.desfeita ? "Desfeita" : "Valendo",
  ];
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <IndicadoresCarregando quantidade={4} />
      <CartaoCarregando altura="h-[32rem]" />
    </TelaCarregando>
  );
}
