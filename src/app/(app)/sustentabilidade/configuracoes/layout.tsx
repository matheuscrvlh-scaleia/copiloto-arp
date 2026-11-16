import { Suspense } from "react";
import { Abas } from "@/components/abas-de-configuracoes";
import { PageHeader } from "@/components/page-header";
import { abasDeConfiguracoesSu } from "@/server/sustentabilidade/configuracoes";

export default function Layout({
  children,
}: LayoutProps<"/sustentabilidade/configuracoes">) {
  return (
    <>
      <PageHeader
        title="Configurações de Sustentabilidade"
        description="O que alimenta o módulo, na ordem em que se usa: importe o histórico, cadastre os coletores e ajuste os parâmetros."
      />
      <div className="mb-6">
        <Suspense fallback={<div className="vidro h-11 w-72 rounded-full" />}>
          <AbasDoUsuario />
        </Suspense>
      </div>
      {children}
    </>
  );
}

async function AbasDoUsuario() {
  return <Abas abas={await abasDeConfiguracoesSu()} />;
}
