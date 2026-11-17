import { Abas } from "@/components/abas-de-configuracoes";
import { PageHeader } from "@/components/page-header";
import { Filhas } from "@/lib/navegacao";
import { useSessao } from "@/lib/sessao";
import { abasDeConfiguracoesSu } from "../../configuracoes";

export default function Layout() {
  const sessao = useSessao();
  return (
    <>
      <PageHeader
        title="Configurações de Sustentabilidade"
        description="O que alimenta o módulo, na ordem em que se usa: importe o histórico, cadastre os coletores e ajuste os parâmetros."
      />
      <div className="mb-6">
        <Abas abas={abasDeConfiguracoesSu(sessao)} />
      </div>
      <Filhas />
    </>
  );
}
