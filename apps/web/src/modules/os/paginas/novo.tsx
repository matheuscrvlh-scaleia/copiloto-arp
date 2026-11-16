import { Suspense } from "react";
import { CartaoCarregando } from "@/components/carregando";
import { PageHeader } from "@/components/page-header";
import { ConteudoDoNovo } from "@/modules/os/components/novo/conteudo";

export default function Pagina() {
  return (
    <>
      <PageHeader
        title="Novo chamado"
        description="Escolha a categoria, escreva o título e envie. O resto é opcional."
      />
      <Suspense fallback={<CartaoCarregando altura="h-[32rem]" />}>
        <ConteudoDoNovo ehOS={false} />
      </Suspense>
    </>
  );
}
