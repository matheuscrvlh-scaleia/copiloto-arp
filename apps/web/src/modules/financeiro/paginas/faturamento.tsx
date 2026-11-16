import { Suspense } from "react";
import { Carregando, EmConstrucao, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";

export default function Page() {
  return (
    <>
      <PageHeader
        title="Faturamento e recebimentos"
        description="Faturado, recebido e a receber do mês, por tipo de cobrança e por cliente."
      />
      <Suspense fallback={<Carregando />}>
        <Protegido permissao="financeiro.faturamento">
          <EmConstrucao motivo="Aguarda a liberação da API do ENET (Grupo EASE)." />
        </Protegido>
      </Suspense>
    </>
  );
}
