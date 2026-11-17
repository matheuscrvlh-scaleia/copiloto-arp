import { Cartao } from "@/components/page-header";
import { Redirecionar } from "@/lib/navegacao";
import { useSessao } from "@/lib/sessao";
import { abasDeConfiguracoesSu } from "../../configuracoes";

/** /sustentabilidade/configuracoes abre a primeira aba que o usuário pode ver. */
export default function Inicio() {
  const [primeira] = abasDeConfiguracoesSu(useSessao());
  if (primeira) return <Redirecionar para={primeira.href} />;
  return (
    <Cartao>
      <p className="text-sm text-neutral-600">
        Você não tem acesso às configurações de Sustentabilidade. Peça a
        liberação ao administrador.
      </p>
    </Cartao>
  );
}
