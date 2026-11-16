import { Abas } from "@/components/abas-de-configuracoes";
import { PageHeader } from "@/components/page-header";
import { Filhas } from "@/lib/navegacao";
import { useSessao } from "@/lib/sessao";
import { abasDoUsuario } from "../configuracoes-secoes";

export default function Layout() {
  const sessao = useSessao();
  return (
    <>
      <PageHeader
        title="Configurações do RH"
        description="Tudo o que alimenta o módulo: importações do mês, cadastros manuais e parâmetros do cálculo."
      />
      <div className="mb-6">
        <Abas abas={abasDoUsuario(sessao)} />
      </div>
      <Filhas />
    </>
  );
}
