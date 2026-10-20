import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando, EmConstrucao, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";

export const metadata: Metadata = { title: "Importação e parâmetros" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Importação e parâmetros"
        description="Envio mensal do relatório Orçamento Realizado Anual do ENET e cadastro de dívida, metas, fechamento e faixas da régua."
      />
      <Suspense fallback={<Carregando />}>
        <Protegido permissao="financeiro.importacao_parametros">
          <EmConstrucao motivo="Próxima etapa do Financeiro: envio do relatório Orçamento Realizado Anual do ENET." />
        </Protegido>
      </Suspense>
    </>
  );
}
