import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando, EmConstrucao, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";

export const metadata: Metadata = { title: "Plano orçamentário" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Plano orçamentário"
        description="Realizado por conta do plano PO - ARP e por setor, mês a mês e ano contra ano."
      />
      <Suspense fallback={<Carregando />}>
        <Protegido permissao="financeiro.plano_orcamentario">
          <EmConstrucao motivo="Aguarda a liberação da API do ENET (Grupo EASE)." />
        </Protegido>
      </Suspense>
    </>
  );
}
