import { Abas } from "@/components/abas-de-configuracoes";
import { PageHeader } from "@/components/page-header";
import { Filhas } from "@/lib/navegacao";
import { useSessao } from "@/lib/sessao";
import { abasDeConfiguracoesOp } from "../../configuracoes";

export default function Layout() {
  const sessao = useSessao();
  return (
    <>
      <PageHeader
        title="Configurações de Operações"
        description="O que alimenta o módulo, na ordem em que se usa: cadastre os hidrômetros e as salas, importe os arquivos do mês e ajuste os parâmetros."
      />
      <div className="mb-6">
        <Abas abas={abasDeConfiguracoesOp(sessao)} />
      </div>
      <Filhas />
    </>
  );
}
