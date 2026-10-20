import type { Permissao } from "@/lib/permissions";
import { pode } from "@/server/auth";
import { Cartao } from "./page-header";

/**
 * Mostra o conteúdo só para quem tem a permissão. Lê a sessão: use dentro
 * de <Suspense>. Os dados continuam protegidos pelo RLS de qualquer forma.
 */
export async function Protegido({
  permissao,
  children,
}: {
  permissao: Permissao;
  children: React.ReactNode;
}) {
  if (!(await pode(permissao))) {
    return (
      <Cartao>
        <p className="text-sm text-neutral-600">
          Você não tem acesso a esta tela. Peça a liberação ao administrador.
        </p>
      </Cartao>
    );
  }
  return children;
}
