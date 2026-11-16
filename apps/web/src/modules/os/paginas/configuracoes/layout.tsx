import { Abas } from "@/components/abas-de-configuracoes";
import { PageHeader } from "@/components/page-header";
import { Filhas } from "@/lib/navegacao";
import { useAbasDoUsuario } from "./secoes";

// app/(app)/os/configuracoes/layout.tsx

export default function Layout() {
  return (
    <>
      <PageHeader
        title="Configurações de chamados"
        description="O que faz o módulo servir a todos os setores sem programação nova: catálogo, pessoas, terceirizados, prazos, textos e metas. Toda alteração fica registrada."
      />
      <div className="mb-6">
        <Abas abas={useAbasDoUsuario()} />
      </div>
      <Filhas />
    </>
  );
}
