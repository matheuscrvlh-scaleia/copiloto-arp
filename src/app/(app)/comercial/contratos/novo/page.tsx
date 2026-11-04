import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { EsqueletoDoAssistente, TelaDoAssistente } from "../tela-do-assistente";

export const metadata: Metadata = { title: "Novo contrato" };

export default async function Page({
  searchParams,
}: PageProps<"/comercial/contratos/novo">) {
  return (
    <>
      <PageHeader
        title="Central de Contratos"
        description="Contrato novo, em 8 etapas guiadas. O rascunho é salvo na base ao avançar ou ao clicar em Salvar rascunho."
      />
      <Suspense fallback={<EsqueletoDoAssistente />}>
        <Etapa busca={searchParams} />
      </Suspense>
    </>
  );
}

async function Etapa({
  busca,
}: {
  busca: Promise<Record<string, string | string[] | undefined>>;
}) {
  const e = Number((await busca).etapa) || 1;
  return <TelaDoAssistente id={null} etapa={e} />;
}
