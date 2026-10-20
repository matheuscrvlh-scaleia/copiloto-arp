import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando, EmConstrucao, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";

export const metadata: Metadata = { title: "Endomarketing" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Endomarketing"
        description="Gastos de endomarketing, no total e por colaborador, comparados com o orçamento aprovado."
      />
      <Suspense fallback={<Carregando />}>
        <Protegido permissao="rh.endomarketing">
          <EmConstrucao motivo="Depende dos gastos lançados no ENET, cuja API ainda não foi liberada." />
        </Protegido>
      </Suspense>
    </>
  );
}
