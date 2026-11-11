import { FileDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import {
  AvisosDoDiario,
  BASE,
  Campos,
  dataHoraDoApp,
  dias,
  SeloRelatorio,
  TopoDiario,
  Voltar,
} from "@/components/operacoes/diario/comum";
import { RelatorioCompleto } from "@/components/operacoes/diario/relatorio";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { formatarData } from "@/lib/formato";
import { contextoOp } from "@/server/operacoes/base";
import { estadoDoDiario, relatorioCompleto } from "@/server/operacoes/diario";

export const metadata: Metadata = { title: "Relatório do Diário de Obra" };

export default function Page({
  params,
}: PageProps<"/operacoes/obras/diario/relatorios/[id]">) {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-40" />
          <CartaoCarregando altura="h-[40rem]" />
        </TelaCarregando>
      }
    >
      <Protegido permissao="operacoes.obras.diario">
        <Tela params={params} />
      </Protegido>
    </Suspense>
  );
}

async function Tela({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [ctx, estado, r] = await Promise.all([
    contextoOp(),
    estadoDoDiario(),
    relatorioCompleto(decodeURIComponent(id)),
  ]);
  if (!r) notFound();
  const d = r.dados;
  const prazo = d?.prazo;
  const modelo = r.modelo ?? "Relatório";

  return (
    <div className="flex flex-col gap-6">
      <Voltar href={`${BASE}/${encodeURIComponent(r.obraId)}?aba=relatorios`}>
        {r.obra}
      </Voltar>
      <PageHeader
        title={`${modelo} nº ${r.numero}`}
        description={`${r.obra} · ${formatarData(r.data)}${r.dataFim ? ` a ${formatarData(r.dataFim)}` : ""}${d?.diaDaSemana ? ` · ${d.diaDaSemana}` : ""}. Só consulta: o relatório é lançado e aprovado no aplicativo.`}
      />
      <TopoDiario
        estado={estado}
        podeAtualizar={ctx.pode("operacoes.obras.atualizar")}
        exportar={
          d?.linkPdf ? (
            <a
              href={d.linkPdf}
              target="_blank"
              rel="noopener noreferrer"
              data-guia="op-diario-pdf"
              className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
            >
              <FileDown className="size-4" aria-hidden />
              PDF do aplicativo
            </a>
          ) : undefined
        }
      />
      <AvisosDoDiario estado={estado} />

      <Campos
        itens={[
          {
            rotulo: "Obra",
            valor: (
              <Link
                href={`${BASE}/${encodeURIComponent(r.obraId)}`}
                className="underline-offset-4 hover:underline"
              >
                {r.obra}
              </Link>
            ),
          },
          { rotulo: "Status", valor: <SeloRelatorio id={r.statusId} /> },
          { rotulo: "Modelo", valor: r.modelo ?? "—" },
          {
            rotulo: "Prazo no dia",
            valor: prazo
              ? `${dias(prazo.contratual ?? null)} · decorrido ${dias(prazo.decorrido ?? null)} · a vencer ${dias(prazo.aVencer ?? null)}`
              : "—",
          },
          {
            rotulo: "Criado por",
            valor: [r.autor, r.autorCargo].filter(Boolean).join(" · ") || "—",
          },
          {
            rotulo: "Criado em",
            valor: `${dataHoraDoApp(r.criadoNoApp)}${r.app ? ` · ${r.app}` : ""}`,
          },
          {
            rotulo: "Alterado no aplicativo",
            valor: dataHoraDoApp(d?.modified ?? null),
          },
          {
            rotulo: "PDF",
            valor: d?.linkPdf ? "No botão PDF do aplicativo" : "Indisponível",
          },
        ]}
      />

      {d ? (
        <RelatorioCompleto r={d} obraId={r.obraId} />
      ) : (
        <p className="vidro rounded-[1.75rem] px-6 py-8 text-sm text-neutral-600">
          O relatório completo ainda não foi lido do aplicativo (a consulta
          continua de onde parou na próxima atualização). Por enquanto, só os
          dados da lista estão guardados.
        </p>
      )}
    </div>
  );
}
