import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { EsqueletoDoAssistente, TelaDoAssistente } from "../tela-do-assistente";

export const metadata: Metadata = { title: "Contrato" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function Page({
  params,
  searchParams,
}: PageProps<"/comercial/contratos/[id]">) {
  return (
    <>
      <PageHeader
        title="Central de Contratos"
        description="Contrato ou distrato montado no sistema. Cada gravação fica no histórico, com quem alterou e quando."
      />
      <Suspense fallback={<EsqueletoDoAssistente />}>
        <Conteudo params={params} busca={searchParams} />
      </Suspense>
    </>
  );
}

async function Conteudo({
  params,
  busca,
}: {
  params: Promise<{ id: string }>;
  busca: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, b] = await Promise.all([params, busca]);
  if (!UUID.test(id)) notFound();
  return <TelaDoAssistente id={id} etapa={Number(b.etapa) || 0} />;
}
