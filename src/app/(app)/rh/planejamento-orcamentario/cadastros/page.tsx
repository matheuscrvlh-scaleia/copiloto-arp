import type { Metadata } from "next";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { SemAcesso } from "@/components/protegido";
import { CategoriasDeGasto } from "@/components/rh/categorias-gasto";
import { AbasDoOrcamento } from "@/components/rh/orcamento";
import { pode } from "@/server/auth";

export const metadata: Metadata = {
  title: "Cadastros · Planejamento orçamentário",
};

export default function Page() {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando />
        </TelaCarregando>
      }
    >
      <Tela />
    </Suspense>
  );
}

async function Tela() {
  if (!(await pode("rh.orcamento.lancar"))) return <SemAcesso />;
  return (
    <div className="flex flex-col gap-6">
      <AbasDoOrcamento cadastros />
      <CategoriasDeGasto />
    </div>
  );
}
