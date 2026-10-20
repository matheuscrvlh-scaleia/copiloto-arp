import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando, EmConstrucao, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";

export const metadata: Metadata = { title: "Inadimplência" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Inadimplência"
        description="Uma linha por cliente, somando contratos e vencimentos, com dias em atraso, etapa da régua e quem já pode ser negativado. Clique abre as parcelas."
      />
      <Suspense fallback={<Carregando />}>
        <Protegido permissao="financeiro.inadimplencia">
          <EmConstrucao motivo="Aguarda a liberação da API do ENET (Grupo EASE)." />
        </Protegido>
      </Suspense>
    </>
  );
}
