import type { ConsultaDoPeriodo } from "@arp/shared/rh/contratos/comum";
import { useDeferredValue, useMemo } from "react";
import { useBusca } from "@/lib/navegacao";
import { filtrosDaBusca } from "./api";

/**
 * Filtros de período da URL para a consulta da tela. Adiados: ao trocar o
 * filtro, a tela antiga fica até a nova chegar (sem piscar o esqueleto).
 */
export function useFiltrosDoPeriodo(): ConsultaDoPeriodo {
  const busca = useBusca();
  return useDeferredValue(useMemo(() => filtrosDaBusca(busca), [busca]));
}
