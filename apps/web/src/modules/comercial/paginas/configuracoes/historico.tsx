import { LIMITE_HISTORICO } from "@arp/shared/comercial/contratos/configuracoes";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Protegido } from "@/components/protegido";
import {
  BlocoHistorico,
  TopoConfiguracoes,
} from "@/modules/comercial/components/configuracoes/historico";
import { consultaHistorico } from "../../api/configuracoes";

// /comercial/configuracoes/historico

export default function Page() {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-12" />
          <CartaoCarregando altura="h-96" />
        </TelaCarregando>
      }
    >
      <Protegido permissao="comercial.parametros.editar">
        <Tela />
      </Protegido>
    </Suspense>
  );
}

function Tela() {
  const {
    data: { linhas },
  } = useSuspenseQuery(consultaHistorico(undefined, LIMITE_HISTORICO));
  return (
    <div className="flex flex-col gap-6">
      <TopoConfiguracoes ultima={linhas[0]} />
      <BlocoHistorico
        linhas={linhas}
        descricao={`Parâmetros, listas, de-para, faixas, feriados, metas e os cadastros do módulo (kit, temas do Censo, imóveis da pesquisa). As ${linhas.length} alterações mais recentes; abra cada uma para ver o antes e o depois.`}
      />
    </div>
  );
}
