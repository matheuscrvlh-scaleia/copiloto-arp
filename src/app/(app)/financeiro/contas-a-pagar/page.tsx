import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando, EmConstrucao, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";

export const metadata: Metadata = { title: "Contas a pagar" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Contas a pagar"
        description="Notas a vencer, para a conferência da manhã, e títulos pagos no formato do relatório do ENET."
      />
      <Suspense fallback={<Carregando />}>
        <Protegido permissao="financeiro.contas_a_pagar">
          <EmConstrucao motivo="Aguarda a liberação da API do ENET (Grupo EASE)." />
        </Protegido>
      </Suspense>
    </>
  );
}
