import { filtrarGastos } from "@arp/shared/rh/orcamento";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useDeferredValue, useMemo } from "react";
import { useBusca } from "@/lib/navegacao";
import { consultaDoOrcamento, consultaDoOrcamentoDaBusca } from "./api";

/**
 * O que as abas Dashboard e Lançamentos leem igual (telaDoOrcamento de
 * antes), com os gastos do filtro. Filtros adiados: a tela fica até a nova
 * chegar.
 */
export function useTelaDoOrcamento() {
  const busca = useBusca();
  const filtros = useDeferredValue(
    useMemo(() => consultaDoOrcamentoDaBusca(busca), [busca]),
  );
  const { data } = useSuspenseQuery(consultaDoOrcamento(filtros));
  return {
    ...data,
    doFiltro: filtrarGastos(data.gastos, {
      mes: data.mes,
      categoria: data.categoria,
    }),
  };
}
