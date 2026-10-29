import type { Metadata } from "next";
import { Suspense } from "react";
import { PainelDaBusca } from "@/components/os/lista/topo";
import { CabecalhoOrdens } from "@/components/os/operacoes";
import { EsqueletoQuadro, TelaQuadro } from "@/components/os/telas/quadro";
import { Protegido } from "@/components/protegido";
import { ROTAS_OS } from "@/lib/os/rotas";

export const metadata: Metadata = { title: "Quadro das OS" };

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <>
      <CabecalhoOrdens descricao="As OS em colunas por status. Arraste o cartão para andar com ela; clique no título para ver o detalhe ao lado." />
      <Suspense fallback={<EsqueletoQuadro />}>
        <Protegido permissao="os.acessar">
          <TelaQuadro busca={searchParams} ordens />
          <Suspense fallback={null}>
            <PainelDaBusca
              busca={searchParams}
              caminho={ROTAS_OS.ordensQuadro}
            />
          </Suspense>
        </Protegido>
      </Suspense>
    </>
  );
}
