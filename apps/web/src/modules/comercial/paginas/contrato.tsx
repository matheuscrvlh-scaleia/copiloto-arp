import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { naoEncontrado, useBusca, useParametro } from "@/lib/navegacao";
import { EsqueletoDoAssistente, TelaDoAssistente } from "./tela-do-assistente";

// /comercial/contratos/:id (app/(app)/comercial/contratos/[id]/page.tsx).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function Page() {
  return (
    <>
      <PageHeader
        title="Central de Contratos"
        description="Contrato ou distrato montado no sistema. Cada gravação fica no histórico, com quem alterou e quando."
      />
      <Suspense fallback={<EsqueletoDoAssistente />}>
        <Conteudo />
      </Suspense>
    </>
  );
}

function Conteudo() {
  const id = useParametro("id");
  const b = useBusca();
  if (!UUID.test(id)) naoEncontrado();
  return <TelaDoAssistente id={id} etapa={Number(b.etapa) || 0} />;
}
