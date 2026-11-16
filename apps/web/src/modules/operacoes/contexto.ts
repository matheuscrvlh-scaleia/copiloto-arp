import { dadosDe } from "@arp/shared/comercial/formato";
import { hojeEmBrasilia } from "@arp/shared/os/tempo";
import type { Permissao } from "@arp/shared/permissions";
import { useMemo } from "react";
import { type Usuario, useSessao } from "@/lib/sessao";

// O `contextoOp()` do sistema antigo, na tela: quem está logado, as
// permissões, "hoje" (Brasília) e o "Dados de dd/mm/aaaa às hh:mm" da
// leitura.

export interface ContextoOp {
  usuario: Usuario;
  pode: (p: Permissao) => boolean;
  /** "aaaa-mm-dd" de hoje em Brasília. */
  hoje: string;
  /** "Dados de dd/mm/aaaa às hh:mm" (hora de Brasília) desta leitura. */
  dadosDe: string;
}

/** `lidoEm`: quando a consulta chegou (dataUpdatedAt); padrão, agora. */
export function useContextoOp(lidoEm?: number): ContextoOp {
  const sessao = useSessao();
  return useMemo(() => {
    const agora = lidoEm ? new Date(lidoEm) : new Date();
    return {
      usuario: sessao.usuario,
      pode: (p: Permissao) => sessao.pode(p),
      hoje: hojeEmBrasilia(agora),
      dadosDe: dadosDe(agora),
    };
  }, [sessao, lidoEm]);
}
