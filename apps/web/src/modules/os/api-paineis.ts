import { respostaPainel } from "@arp/shared/os/contratos/paineis";
import type { Busca } from "@arp/shared/os/lista";
import { queryOptions } from "@tanstack/react-query";
import { api, BASE_DA_API } from "@/lib/api";
import { consultaDaBusca } from "./api";

// Chamadas dos painéis do Tickets (prefixo /api/v1/os). As chaves começam
// por "os": toda gravação do módulo (que invalida chavesOs.tudo) atualiza o
// painel também.

/**
 * GET /api/v1/os/paineis (`setor`: o slug ou id do endereço; sem ele, o
 * painel geral).
 */
export const consultaDoPainel = (busca: Busca, setor: string | null) => {
  const consulta = {
    ...consultaDaBusca(busca),
    ...(setor === null ? {} : { setor }),
  };
  return queryOptions({
    queryKey: ["os", "paineis", consulta] as const,
    queryFn: ({ signal }) =>
      api.get("/os/paineis", {
        esquema: respostaPainel,
        consulta,
        sinal: signal,
      }),
  });
};

/** GET /api/v1/os/paineis/exportar: o PDF do painel (link de download). */
export function enderecoDoPdf(parametros: URLSearchParams): string {
  return `${BASE_DA_API}/os/paineis/exportar?${parametros}`;
}
