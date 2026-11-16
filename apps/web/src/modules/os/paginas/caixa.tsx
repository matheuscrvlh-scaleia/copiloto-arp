import { Suspense } from "react";
import { Protegido } from "@/components/protegido";
import {
  EsqueletoVisao,
  PainelDaBusca,
} from "@/modules/os/components/lista/topo";
import { CabecalhoOperacoes } from "@/modules/os/components/operacoes";
import { SeuDia } from "@/modules/os/components/seu-dia/seu-dia";
import { TelaCaixa } from "@/modules/os/components/telas/caixa";

export default function Pagina() {
  return (
    <>
      <CabecalhoOperacoes descricao="O que está com você para fazer: os seus chamados, os destinos seus e do seu setor e a fila do setor, pelo prazo. Em cima, o que espera a sua confirmação. Em Mostrar, veja o que você abriu para outros setores e pessoas." />
      <Suspense fallback={<EsqueletoVisao />}>
        <Protegido permissao="os.acessar">
          <TelaCaixa />
          <Suspense fallback={null}>
            <SeuDia />
          </Suspense>
          <Suspense fallback={null}>
            <PainelDaBusca caminho="/os" />
          </Suspense>
        </Protegido>
      </Suspense>
    </>
  );
}
