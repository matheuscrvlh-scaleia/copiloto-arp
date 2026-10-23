import "server-only";
import { after } from "next/server";
import {
  type AcessoPortal,
  abrirPortal,
  marcarAcesso,
} from "@/server/os/portal-publico";

/**
 * Confere o token da página e registra o acesso depois da resposta (não
 * atrasa a tela). Null: link inativo.
 */
export async function acessoDaPagina(
  token: string,
): Promise<AcessoPortal | null> {
  const acesso = await abrirPortal(token);
  if (acesso) after(() => marcarAcesso(acesso, new Date()));
  return acesso;
}
