import { useMemo } from "react";
import { type Busca, useFiltrosLembrados } from "@/modules/shell/api";

// Os filtros que valem numa tela de Operações: os da URL ou, sem nenhum, os
// últimos que a pessoa usou (o `filtrosLembrados` do sistema antigo). null
// enquanto a API responde os lembrados.

export interface FiltrosOp {
  busca: Busca;
  lembrado: string | null;
  um: (chave: string) => string;
}

export function useFiltrosOp(tela: string): FiltrosOp | null {
  const { busca, lembrado, pronto } = useFiltrosLembrados("operacoes", tela);
  return useMemo(() => {
    if (!pronto) return null;
    const um = (chave: string) => {
      const v = busca[chave];
      return (Array.isArray(v) ? v[0] : v) ?? "";
    };
    return { busca, lembrado, um };
  }, [busca, lembrado, pronto]);
}

/** Mapa de links (caminho → endereço) como os componentes portados usam. */
export const mapaDeLinks = (links: Record<string, string>) =>
  new Map(Object.entries(links));
