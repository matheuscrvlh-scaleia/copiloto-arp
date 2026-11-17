import { useMemo } from "react";
import { type NavSection, navigationFor } from "@/config/navigation";
import { useSessao } from "@/lib/sessao";

/**
 * Seções do menu que a pessoa pode ver. O menu e a barra do topo usam a
 * mesma regra; a lista só muda quando as permissões mudam.
 */
export function useSecoes(): NavSection[] {
  const { usuario } = useSessao();
  return useMemo(
    () =>
      navigationFor(
        (p) => usuario.permissoes.includes(p),
        usuario.programas.length > 0,
      ),
    [usuario.permissoes, usuario.programas],
  );
}
