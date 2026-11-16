import { Cartao } from "@/components/page-header";
import { Redirecionar } from "@/lib/navegacao";
import { useSessao } from "@/lib/sessao";
import { abasDeConfiguracoesOp } from "../../configuracoes";

/** /operacoes/configuracoes abre a primeira aba que o usuário pode ver. */
export default function Page() {
  const [primeira] = abasDeConfiguracoesOp(useSessao());
  if (primeira) return <Redirecionar para={primeira.href} />;
  return (
    <Cartao>
      <p className="text-sm text-neutral-600">
        Você não tem acesso às configurações de Operações. Peça a liberação ao
        administrador.
      </p>
    </Cartao>
  );
}
