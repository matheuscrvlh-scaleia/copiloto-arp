import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Abas } from "./abas";
import { abasDoUsuario } from "./secoes";

export default function Layout({ children }: LayoutProps<"/rh/configuracoes">) {
  return (
    <>
      <PageHeader
        title="Configurações do RH"
        description="Tudo o que alimenta o módulo: importações do mês, cadastros manuais e parâmetros do cálculo."
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
  return <Abas abas={await abasDoUsuario()} />;
}
