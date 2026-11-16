import type { Permissao } from "@arp/shared/permissions";
import { usePermissao } from "@/lib/sessao";
import { Cartao } from "./page-header";

/**
 * Mostra o conteúdo só para quem tem a permissão (com lista, basta uma).
 * Os dados continuam protegidos pela API e pelo RLS de qualquer forma.
 */
export function Protegido({
  permissao,
  children,
}: {
  permissao: Permissao | readonly Permissao[];
  children: React.ReactNode;
}) {
  if (!usePermissao(permissao)) return <SemAcesso />;
  return children;
}

/** Aviso de tela sem acesso (para telas que conferem várias permissões). */
export function SemAcesso() {
  return (
    <Cartao>
      <p className="text-sm text-neutral-600">
        Você não tem acesso a esta tela. Peça a liberação ao administrador.
      </p>
    </Cartao>
  );
}
