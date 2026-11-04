import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Carregando } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { abasDoUsuario } from "./secoes";

/** /comercial/configuracoes abre a primeira aba que a pessoa pode ver. */
export default function Page() {
  return (
    <Suspense fallback={<Carregando />}>
      <PrimeiraAba />
    </Suspense>
  );
}

async function PrimeiraAba() {
  const [primeira] = await abasDoUsuario();
  if (primeira) redirect(primeira.href);
  return <SemAcesso />;
}
