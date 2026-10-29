import type { Metadata } from "next";
import { Suspense } from "react";
import { PainelDaBusca } from "@/components/os/lista/topo";
import { CabecalhoOperacoes } from "@/components/os/operacoes";
import { SeuDia } from "@/components/os/seu-dia/seu-dia";
import { EsqueletoQuadro, TelaQuadro } from "@/components/os/telas/quadro";
import { Protegido } from "@/components/protegido";

export const metadata: Metadata = { title: "Quadro" };

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <>
      <CabecalhoOperacoes descricao="Os chamados em colunas por status. Arraste o cartão para andar com ele; clique no título para ver o detalhe ao lado." />
      <Suspense fallback={<EsqueletoQuadro />}>
        <Protegido permissao="os.acessar">
          <TelaQuadro busca={searchParams} />
          <Suspense fallback={null}>
            <SeuDia />
          </Suspense>
          <Suspense fallback={null}>
            <PainelDaBusca busca={searchParams} caminho="/os/quadro" />
          </Suspense>
        </Protegido>
      </Suspense>
    </>
  );
}
