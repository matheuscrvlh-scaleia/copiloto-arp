import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando, EmConstrucao, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";

export const metadata: Metadata = { title: "Performance & Capital" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Performance & Capital"
        description="Painel do Pedro em regime de caixa: executivo, indicadores com meta, resultado mensal, receita e setores, dívida e cobertura."
      />
      <Suspense fallback={<Carregando />}>
        <Protegido permissao="financeiro.performance_capital">
          <EmConstrucao motivo="Depende da importação do relatório Orçamento Realizado Anual do ENET e do cadastro de dívida e metas." />
        </Protegido>
      </Suspense>
    </>
  );
}
