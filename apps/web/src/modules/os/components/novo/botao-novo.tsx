import { useSuspenseQuery } from "@tanstack/react-query";
import { usePermissao } from "@/lib/sessao";
import { consultaDoFormulario } from "@/modules/os/api";
import { NovoChamado } from "./novo-chamado";

// Botão flutuante "+ Novo" de todas as telas do módulo (o layout de /os o
// renderiza dentro de <Suspense>). Lê a sessão: sem os.acessar, não aparece.
export function BotaoNovoChamado() {
  if (!usePermissao("os.acessar")) return null;
  return <Botao />;
}

function Botao() {
  const { data: dados } = useSuspenseQuery(consultaDoFormulario);
  return <NovoChamado dados={dados} />;
}
