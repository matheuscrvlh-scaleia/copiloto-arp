import { Suspense } from "react";
import { CartaoCarregando } from "@/components/carregando";
import { PageHeader } from "@/components/page-header";
import { ConteudoDoNovo } from "@/modules/os/components/novo/conteudo";

export default function Pagina() {
  return (
    <>
      <PageHeader
        title="Nova Ordem de Serviço"
        description="Escolha a categoria, escreva o título e envie. Tempo, materiais e terceirizado entram depois, no detalhe da OS."
      />
      <Suspense fallback={<CartaoCarregando altura="h-[32rem]" />}>
        <ConteudoDoNovo ehOS />
      </Suspense>
    </>
  );
}
