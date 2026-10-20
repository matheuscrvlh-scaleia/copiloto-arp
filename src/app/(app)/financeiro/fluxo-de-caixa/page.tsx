import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando, EmConstrucao, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";

export const metadata: Metadata = { title: "Fluxo de caixa" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Fluxo de caixa"
        description="Entradas de contratos e saídas do contas a pagar, realizado até hoje e previsto a partir de amanhã."
      />
      <Suspense fallback={<Carregando />}>
        <Protegido permissao="financeiro.fluxo_de_caixa">
          <EmConstrucao motivo="Aguarda a liberação da API do ENET (Grupo EASE)." />
        </Protegido>
      </Suspense>
    </>
  );
}
