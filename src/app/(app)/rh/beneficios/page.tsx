import type { Metadata } from "next";
import { Suspense } from "react";
import { Carregando, EmConstrucao, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";

export const metadata: Metadata = { title: "Benefícios" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Benefícios"
        description="Cadastro de benefícios e vínculo por funcionário, faixas etárias do plano de saúde, coparticipação por tempo de casa e dependentes."
      />
      <Suspense fallback={<Carregando />}>
        <Protegido permissao="rh.beneficios">
          <EmConstrucao motivo="Próxima etapa: cadastro de benefícios e envio da tabela de faixas do plano de saúde." />
        </Protegido>
      </Suspense>
    </>
  );
}
