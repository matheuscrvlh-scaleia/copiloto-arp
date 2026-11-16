import { ROTAS_OS } from "@arp/shared/os/rotas";
import { Suspense } from "react";
import { Protegido } from "@/components/protegido";
import {
  EsqueletoVisao,
  PainelDaBusca,
} from "@/modules/os/components/lista/topo";
import { CabecalhoOrdens } from "@/modules/os/components/operacoes";
import { TelaCaixa } from "@/modules/os/components/telas/caixa";

export default function Pagina() {
  return (
    <>
      <CabecalhoOrdens descricao="As OS que estão com você para fazer: as suas, os destinos seus e do seu setor e a fila do setor, pelo prazo. Em cima, o que espera a sua confirmação. Em Mostrar, veja as OS que você abriu." />
      <Suspense fallback={<EsqueletoVisao />}>
        <Protegido permissao="os.acessar">
          <TelaCaixa ordens />
          <Suspense fallback={null}>
            <PainelDaBusca caminho={ROTAS_OS.ordensCaixa} />
          </Suspense>
        </Protegido>
      </Suspense>
    </>
  );
}
