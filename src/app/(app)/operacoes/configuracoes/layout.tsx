import { Suspense } from "react";
import { Abas } from "@/components/abas-de-configuracoes";
import { PageHeader } from "@/components/page-header";
import { abasDeConfiguracoesOp } from "@/server/operacoes/configuracoes";

export default function Layout({
  children,
}: LayoutProps<"/operacoes/configuracoes">) {
  return (
    <>
      <PageHeader
        title="Configurações de Operações"
        description="O que alimenta o módulo, na ordem em que se usa: cadastre os hidrômetros e as salas, importe os arquivos do mês e ajuste os parâmetros."
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
  return <Abas abas={await abasDeConfiguracoesOp()} />;
}
