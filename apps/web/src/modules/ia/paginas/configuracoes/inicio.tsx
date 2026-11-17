import { SemAcesso } from "@/components/protegido";
import { Redirecionar } from "@/lib/navegacao";
import { useSessao } from "@/lib/sessao";
import { abasDeConfiguracoes } from "./abas";

/** /admin/configuracoes: vai para a primeira aba que a pessoa pode abrir. */
export default function Inicio() {
  const primeira = abasDeConfiguracoes(useSessao())[0];
  if (primeira) return <Redirecionar para={primeira.href} />;
  return <SemAcesso />;
}
