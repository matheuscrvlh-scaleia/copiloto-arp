import { Suspense } from "react";
import { AbasConfiguracoes } from "@/components/comercial/configuracoes/abas";
import { PageHeader } from "@/components/page-header";
import { abasDoUsuario } from "./secoes";

export default function Layout({
  children,
}: LayoutProps<"/comercial/configuracoes">) {
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
      {children}
    </>
  );
}

async function AbasDoUsuario() {
  return <AbasConfiguracoes abas={await abasDoUsuario()} />;
}
