import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando, EmConstrucao, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";

export const metadata: Metadata = { title: "Painel financeiro" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Painel financeiro"
        description="Resumo do mês: recebido de contratos, pago a fornecedores, resultado e valor em atraso, com os indicadores de cobrança."
      />
      <Suspense fallback={<Carregando />}>
        <Protegido permissao="financeiro.painel">
          <EmConstrucao motivo="Aguarda a liberação da API do ENET (Grupo EASE)." />
        </Protegido>
      </Suspense>
    </>
  );
}
