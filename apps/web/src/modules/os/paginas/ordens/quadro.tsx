import { ROTAS_OS } from "@arp/shared/os/rotas";
import { Suspense } from "react";
import { Protegido } from "@/components/protegido";
import { PainelDaBusca } from "@/modules/os/components/lista/topo";
import { CabecalhoOrdens } from "@/modules/os/components/operacoes";
import {
  EsqueletoQuadro,
  TelaQuadro,
} from "@/modules/os/components/telas/quadro";

export default function Pagina() {
  return (
    <>
      <CabecalhoOrdens descricao="As OS em colunas por status. Arraste o cartão para andar com ela; clique no título para ver o detalhe ao lado." />
      <Suspense fallback={<EsqueletoQuadro />}>
        <Protegido permissao="os.acessar">
          <TelaQuadro ordens />
          <Suspense fallback={null}>
            <PainelDaBusca caminho={ROTAS_OS.ordensQuadro} />
          </Suspense>
        </Protegido>
      </Suspense>
    </>
  );
}
