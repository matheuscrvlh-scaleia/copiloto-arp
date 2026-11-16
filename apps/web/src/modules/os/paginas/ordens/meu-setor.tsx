import { ROTAS_OS } from "@arp/shared/os/rotas";
import { Suspense } from "react";
import { Protegido } from "@/components/protegido";
import {
  EsqueletoVisao,
  PainelDaBusca,
} from "@/modules/os/components/lista/topo";
import { CabecalhoOrdens } from "@/modules/os/components/operacoes";
import { TelaGeral } from "@/modules/os/components/telas/geral";

export default function Pagina() {
  return (
    <>
      <CabecalhoOrdens descricao="As OS dos seus setores, para distribuir e cobrar: a fila sem responsável, as atrasadas e a carga de cada pessoa. Atribua, mude prazo e prioridade direto na lista." />
      <Suspense fallback={<EsqueletoVisao />}>
        <Protegido permissao="os.meu_setor">
          <TelaGeral caminho={ROTAS_OS.ordensMeuSetor} ordens />
          <Suspense fallback={null}>
            <PainelDaBusca caminho={ROTAS_OS.ordensMeuSetor} />
          </Suspense>
        </Protegido>
      </Suspense>
    </>
  );
}
