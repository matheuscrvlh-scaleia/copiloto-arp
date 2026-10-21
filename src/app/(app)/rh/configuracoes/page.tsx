import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Carregando, Cartao } from "@/components/page-header";
import { abasDoUsuario } from "./secoes";

/** /rh/configuracoes abre a primeira aba que o usuário pode ver. */
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
  return (
    <Cartao>
      <p className="text-sm text-neutral-600">
        Você não tem acesso às configurações do RH. Peça a liberação ao
        administrador.
      </p>
    </Cartao>
  );
}
