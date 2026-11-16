import { Suspense } from "react";
import { Carregando } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { Redirecionar } from "@/lib/navegacao";
import { useAbasDoUsuario } from "./secoes";

/** /comercial/configuracoes abre a primeira aba que a pessoa pode ver. */
export default function Page() {
  return (
    <Suspense fallback={<Carregando />}>
      <PrimeiraAba />
    </Suspense>
  );
}

function PrimeiraAba() {
  const [primeira] = useAbasDoUsuario();
  if (primeira) return <Redirecionar para={primeira.href} />;
  return <SemAcesso />;
}
