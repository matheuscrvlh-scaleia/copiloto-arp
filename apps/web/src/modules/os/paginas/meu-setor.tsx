import { ROTAS_OS } from "@arp/shared/os/rotas";
import { Suspense } from "react";
import { Protegido } from "@/components/protegido";
import {
  EsqueletoVisao,
  PainelDaBusca,
} from "@/modules/os/components/lista/topo";
import { CabecalhoOperacoes } from "@/modules/os/components/operacoes";
import { SeuDia } from "@/modules/os/components/seu-dia/seu-dia";
import { TelaGeral } from "@/modules/os/components/telas/geral";

export default function Pagina() {
  return (
    <>
      <CabecalhoOperacoes descricao="Tudo o que é dos seus setores, para distribuir e cobrar: a fila sem responsável, os atrasados e a carga de cada pessoa. Atribua, mude prazo e prioridade direto na lista." />
      <Suspense fallback={<EsqueletoVisao />}>
        <Protegido permissao="os.meu_setor">
          <TelaGeral caminho={ROTAS_OS.meuSetor} />
          <Suspense fallback={null}>
            <SeuDia />
          </Suspense>
          <Suspense fallback={null}>
            <PainelDaBusca caminho={ROTAS_OS.meuSetor} />
          </Suspense>
        </Protegido>
      </Suspense>
    </>
  );
}
