import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Abas } from "./abas";
import { abasDoUsuario } from "./secoes";

export default function Layout({ children }: LayoutProps<"/os/configuracoes">) {
  return (
    <>
      <PageHeader
        title="Configurações de chamados"
        description="O que faz o módulo servir a todos os setores sem programação nova: catálogo, pessoas, terceirizados, prazos, textos e metas. Toda alteração fica registrada."
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
      {children}
    </>
  );
}

async function AbasDoUsuario() {
  return <Abas abas={await abasDoUsuario()} />;
}
