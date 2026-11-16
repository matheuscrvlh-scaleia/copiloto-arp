import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Filhas } from "@/lib/navegacao";
import { AbasConfiguracoes } from "../../components/configuracoes/abas";
import { useAbasDoUsuario } from "./secoes";

// app/(app)/comercial/configuracoes/layout.tsx

export default function Layout() {
  return (
    <>
      <PageHeader
        title="Configurações do Comercial"
        description="Tudo o que muda sem programação nova: de-para de fontes, faixas, prazos, textos, listas, metas e a importação do histórico. Cada alteração fica no histórico, com quem, quando, antes e depois."
      />
      <div className="mb-6">
        <Suspense
          fallback={
            <div className="vidro h-11 w-full max-w-3xl rounded-full" />
          }
        >
          <AbasDoUsuario />
        </Suspense>
      </div>
      <Filhas />
    </>
  );
}

function AbasDoUsuario() {
  return <AbasConfiguracoes abas={useAbasDoUsuario()} />;
}
