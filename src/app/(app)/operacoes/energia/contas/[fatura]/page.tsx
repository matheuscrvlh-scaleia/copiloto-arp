import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { TopoDaTela } from "@/components/dashboard/tela";
import { DetalheDaFatura } from "@/components/operacoes/energia/contas/detalhe";
import { ROTA_CONTAS } from "@/components/operacoes/energia/contas/lista";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { formatarMes } from "@/lib/formato";
import { nomeDaUnidade } from "@/lib/operacoes/energisa-contas";
import { contextoOp } from "@/server/operacoes/base";
import {
  faturaComItens,
  linksDosPdfs,
  unidadesDeEnergia,
} from "@/server/operacoes/contas";

export const metadata: Metadata = { title: "Fatura de energia" };

export default function Page({
  params,
}: PageProps<"/operacoes/energia/contas/[fatura]">) {
  return (
    <>
      <Link
        href={ROTA_CONTAS}
        className="mb-2 inline-block text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Contas de energia
      </Link>
      <Suspense
        fallback={
          <TelaCarregando>
            <CartaoCarregando altura="h-64" />
            <CartaoCarregando altura="h-80" />
          </TelaCarregando>
        }
      >
        <Protegido permissao="operacoes.energia.contas">
          <Tela params={params} />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Tela({ params }: { params: Promise<{ fatura: string }> }) {
  const { fatura: bruto } = await params;
  const id = z.uuid().safeParse(bruto);
  if (!id.success) notFound();
  const [f, unidades, ctx] = await Promise.all([
    faturaComItens(id.data),
    unidadesDeEnergia(),
    contextoOp(),
  ]);
  if (!f) notFound();
  const unidade = unidades.find((u) => u.matricula === f.matricula);
  const pdfs = await linksDosPdfs([f.arquivo]);
  return (
    <>
      <PageHeader
        title={`${nomeDaUnidade(f.matricula, unidade)} · ${formatarMes(f.referencia)}`}
        description={
          f.vigente
            ? "Fatura da Energisa confirmada na importação."
            : "Fatura ainda em prévia: só passa a valer nas telas depois de confirmada em Operações › Importações."
        }
      />
      <div className="flex flex-col gap-6">
        <TopoDaTela
          dadosDe={ctx.dadosDe}
          exemplo={f.exemplo ? "fatura de exemplo" : undefined}
        />
        <DetalheDaFatura
          fatura={f}
          unidade={unidade}
          pdf={f.arquivo ? pdfs.get(f.arquivo) : undefined}
        />
      </div>
    </>
  );
}
