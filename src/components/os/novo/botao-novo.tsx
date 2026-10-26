import { dadosDoFormulario } from "@/server/os/formulario";
import { NovoChamado } from "./novo-chamado";

// Botão flutuante "+ Novo" de todas as telas do módulo (o layout de /os o
// renderiza dentro de <Suspense>). Lê a sessão: sem os.acessar, não aparece.
export async function BotaoNovoChamado() {
  const dados = await dadosDoFormulario();
  if (!dados) return null;
  return <NovoChamado dados={dados} />;
}
