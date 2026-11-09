import { Upload } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { TopoDaTela } from "@/components/dashboard/tela";
import {
  EtapasDaImportacao,
  FiltrosDeImportacoes,
  ROTA_IMPORTACOES,
  TabelaDeImportacoes,
} from "@/components/operacoes/importacoes/historico";
import { hrefDaPagina, Paginacao } from "@/components/os/paginacao";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { formatarData, formatarNumero } from "@/lib/formato";
import {
  type FiltroImportacoes,
  lerFiltroImportacoes,
  POR_PAGINA,
  STATUS_IMPORTACAO,
  TIPOS,
  TIPOS_IMPORTACAO,
  tiposQuePode,
} from "@/lib/operacoes/importacoes";
import { totalDePaginas } from "@/lib/os/paginacao";
import { contextoOp } from "@/server/operacoes/base";
import { paginaDeImportacoes } from "@/server/operacoes/importacoes";

export const metadata: Metadata = { title: "Importações de Operações" };

type Busca = Record<string, string | string[] | undefined>;

export default function Page({
  searchParams,
}: PageProps<"/operacoes/importacoes">) {
  return (
    <>
      <PageHeader
        title="Importações"
        description="Água, faturas da Energisa, orçamento de obra e histórico do rateio: enviar, conferir a prévia e confirmar. Toda importação fica aqui, com o Desfazer."
      />
      <Suspense fallback={<Esqueleto />}>
        <Historico busca={searchParams} />
      </Suspense>
    </>
  );
}

function descrever(f: FiltroImportacoes): string {
  return [
    `Tipo: ${f.tipo ? TIPOS_IMPORTACAO[f.tipo].curto : "todos"}`,
    `Situação: ${f.status ? STATUS_IMPORTACAO[f.status].rotulo : "todas"}`,
    (f.de || f.ate) &&
      `Enviadas: ${f.de ? formatarData(f.de) : "início"} a ${f.ate ? formatarData(f.ate) : "hoje"}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

async function Historico({ busca }: { busca: Promise<Busca> }) {
  const [ctx, sp] = await Promise.all([contextoOp(), busca]);
  const podeTipo = tiposQuePode(ctx.pode);
  // Quem vê o histórico: quem importa algum tipo (o menu) ou vê a área.
  const vistos = TIPOS.filter(
    (t) =>
      podeTipo.includes(t) ||
      (t === "agua" && ctx.pode("operacoes.agua.ver")) ||
      (t === "orcamento" && ctx.pode("operacoes.obras.ver")) ||
      (t === "limpeza" && ctx.pode("operacoes.limpeza.ver")),
  );
  if (!vistos.length) return <SemAcesso />;
  const f = lerFiltroImportacoes(sp);
  const { linhas, total } = await paginaDeImportacoes(f);
  const ultima = totalDePaginas(total, POR_PAGINA);
  if (f.pagina > ultima) redirect(hrefDaPagina(ROTA_IMPORTACOES, sp, ultima));

  return (
    <div className="flex flex-col gap-6">
      <TopoDaTela
        dadosDe={ctx.dadosDe}
        filtros={descrever(f)}
        exemplo={
          linhas.some((l) => l.exemplo)
            ? "importações marcadas como exemplo"
            : undefined
        }
        acoes={
          podeTipo.length ? (
            <Link
              href={`${ROTA_IMPORTACOES}/nova`}
              data-guia="op-importacoes-nova"
              className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-lg transition hover:bg-neutral-800"
            >
              <Upload className="size-4" aria-hidden />
              Nova importação
            </Link>
          ) : undefined
        }
      />

      {podeTipo.length > 0 && <EtapasDaImportacao />}

      <FiltrosDeImportacoes f={f} tipos={vistos} />

      <Secao
        titulo="Histórico de importações"
        descricao={`${formatarNumero(total)} ${total === 1 ? "importação" : "importações"} · da mais nova para a mais antiga. Clique no olho para ver o resumo, os avisos e os arquivos.`}
      >
        <div className="flex flex-col gap-4">
          <TabelaDeImportacoes linhas={linhas} podeTipo={podeTipo} />
          <Paginacao
            pagina={f.pagina}
            total={total}
            porPagina={POR_PAGINA}
            href={(p) => hrefDaPagina(ROTA_IMPORTACOES, sp, p)}
          />
        </div>
      </Secao>

      <Nota>
        Desfazer apaga o que a importação trouxe; na água, se ela substituiu
        outra do mesmo mês, a anterior volta a valer. Mês que não batia com o
        resumo do arquivo só entra com motivo e fica marcado “incompleto”.
      </Nota>
    </div>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <CartaoCarregando altura="h-[32rem]" />
    </TelaCarregando>
  );
}
