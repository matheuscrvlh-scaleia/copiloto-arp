import { hojeEmBrasilia } from "@arp/shared/os/tempo";
import type { Permissao } from "@arp/shared/permissions";
import { useMemo } from "react";
import { useSessao } from "@/lib/sessao";
import { type Busca, useFiltrosLembrados } from "@/modules/shell/api";

// Base das telas do Comercial (o server/comercial/filtros de antes): os
// filtros de cada tela, os da URL ou, sem nenhum, os últimos que a pessoa
// usou. O "Dados de…" e o "hoje" das contas vêm da resposta da API (momento).

export type { Busca };

export interface ContextoCom {
  pode: (p: Permissao) => boolean;
  /** "aaaa-mm-dd" de hoje em Brasília (no navegador; a API manda o dela). */
  hoje: string;
}

export interface FiltrosCom {
  ctx: ContextoCom;
  /** Filtros que valem (URL ou lembrados). */
  busca: Busca;
  /** Query lembrada para a barra colocar na URL (ou null). */
  lembrado: string | null;
  /** Valor de um filtro ("" quando não veio: a tela aplica o padrão). */
  um: (chave: string) => string;
}

/** Permissões e hoje de quem está logado. */
export function useContextoCom(): ContextoCom {
  const { pode } = useSessao();
  return useMemo(
    () => ({
      pode: (p: Permissao) => pode(p),
      hoje: hojeEmBrasilia(new Date()),
    }),
    [pode],
  );
}

/** Os filtros da tela; null enquanto a API responde os lembrados. */
export function useFiltrosCom(tela: string): FiltrosCom | null {
  const ctx = useContextoCom();
  const { busca, lembrado, pronto } = useFiltrosLembrados("comercial", tela);
  return useMemo(() => {
    if (!pronto) return null;
    const um = (chave: string) => {
      const v = busca[chave];
      return (Array.isArray(v) ? v[0] : v) ?? "";
    };
    return { ctx, busca, lembrado, um };
  }, [ctx, busca, lembrado, pronto]);
}
