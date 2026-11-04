import type { Metadata } from "next";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import {
  BlocoHistorico,
  TopoConfiguracoes,
} from "@/components/comercial/configuracoes/historico";
import { Protegido } from "@/components/protegido";
import { historicoCom, LIMITE_HISTORICO } from "@/server/comercial/parametros";

export const metadata: Metadata = { title: "Histórico do Comercial" };

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

async function Tela() {
  const linhas = await historicoCom(null, LIMITE_HISTORICO);
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
