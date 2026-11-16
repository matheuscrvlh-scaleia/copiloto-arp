import type { ConsultaDoCusto } from "@arp/shared/rh/contratos/custo";
import { useDeferredValue, useMemo } from "react";
import { useBusca } from "@/lib/navegacao";
import { consultaDoCustoDaBusca } from "./api";

/**
 * ?mes, ?dep e ?comparar da URL para a consulta do custo. Adiados: ao trocar
 * a competência, a tela antiga fica até a nova chegar.
 */
export function useFiltrosDoCusto(): ConsultaDoCusto {
  const busca = useBusca();
  return useDeferredValue(
    useMemo(() => consultaDoCustoDaBusca(busca), [busca]),
  );
}
