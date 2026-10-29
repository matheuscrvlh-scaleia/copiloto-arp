import { PageHeader } from "@/components/page-header";
import { AbasConfiguracoes } from "./abas";

export default function Layout({
  children,
}: LayoutProps<"/marketing/configuracoes">) {
  return (
    <>
      <PageHeader
        title="Configurações do Marketing"
        description="Tudo o que as ferramentas não entregam e o Marketing informa: cadastros, metas, regras de alerta e a ligação com cada ferramenta. Cada alteração fica no histórico, com a opção de voltar."
      />
      <div className="mb-6">
        <AbasConfiguracoes />
      </div>
      {children}
    </>
  );
}
