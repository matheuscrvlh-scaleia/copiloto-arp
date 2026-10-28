import "server-only";
import { after } from "next/server";
import {
  type AcessoPortal,
  abrirPortal,
  marcarAcesso,
} from "@/server/os/portal-publico";

/**
 * Confere a sessão da loja e registra o acesso depois da resposta (não
 * atrasa a tela). Null: precisa entrar com o CNPJ.
 */
export async function acessoDaPagina(): Promise<AcessoPortal | null> {
  const acesso = await abrirPortal();
  if (acesso) after(() => marcarAcesso(acesso, new Date()));
  return acesso;
}
