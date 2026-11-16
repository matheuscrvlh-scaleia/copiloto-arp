import { Suspense } from "react";
import { Protegido } from "@/components/protegido";
import { PainelDaBusca } from "@/modules/os/components/lista/topo";
import { CabecalhoOperacoes } from "@/modules/os/components/operacoes";
import { SeuDia } from "@/modules/os/components/seu-dia/seu-dia";
import {
  EsqueletoQuadro,
  TelaQuadro,
} from "@/modules/os/components/telas/quadro";

export default function Pagina() {
  return (
    <>
      <CabecalhoOperacoes descricao="Os chamados em colunas por status. Arraste o cartão para andar com ele; clique no título para ver o detalhe ao lado." />
      <Suspense fallback={<EsqueletoQuadro />}>
        <Protegido permissao="os.acessar">
          <TelaQuadro />
          <Suspense fallback={null}>
            <SeuDia />
          </Suspense>
          <Suspense fallback={null}>
            <PainelDaBusca caminho="/os/quadro" />
          </Suspense>
        </Protegido>
      </Suspense>
    </>
  );
}
