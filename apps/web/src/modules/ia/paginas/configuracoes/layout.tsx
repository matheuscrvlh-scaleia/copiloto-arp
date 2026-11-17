import { Abas } from "@/components/abas-de-configuracoes";
import { PageHeader } from "@/components/page-header";
import { Filhas } from "@/lib/navegacao";
import { useSessao } from "@/lib/sessao";
import { abasDeConfiguracoes } from "./abas";

export default function Layout() {
  const sessao = useSessao();
  return (
    <>
      <PageHeader
        title="Configurações"
        description="Ajustes do sistema como um todo. Cada aba aparece para quem tem a permissão dela."
      />
      <div className="mb-6">
        <Abas abas={abasDeConfiguracoes(sessao)} />
      </div>
      <Filhas />
    </>
  );
}
